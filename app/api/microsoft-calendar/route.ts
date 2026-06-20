// app/api/microsoft-calendar/route.ts
// Handles Microsoft (Outlook) Calendar OAuth and event sync
import { NextRequest, NextResponse } from 'next/server'
import { logServerError } from '@/lib/log-server-error'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MS_CLIENT_ID     = process.env.MICROSOFT_CALENDAR_CLIENT_ID     || ''
const MS_CLIENT_SECRET = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || ''
const MS_TENANT        = process.env.MICROSOFT_TENANT_ID || '3e32a281-36d9-4099-8105-e9460f1ab7a7'
const REDIRECT_URI     = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/microsoft-calendar/callback`
  : 'http://localhost:3000/api/microsoft-calendar/callback'

// ─── GET ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'auth-url') {
    const userId = searchParams.get('userId') || ''
    const role   = searchParams.get('role')   || 'admin'
    const scopes = [
      'openid', 'profile', 'email', 'offline_access',
      'Calendars.ReadWrite',
    ].join(' ')

    const params = new URLSearchParams({
      client_id:     MS_CLIENT_ID,
      response_type: 'code',
      redirect_uri:  REDIRECT_URI,
      scope:         scopes,
      response_mode: 'query',
      state:         `${userId}:${role}`,
    })

    const url = `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize?${params}`
    return NextResponse.json({ url })
  }

  if (action === 'status') {
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ connected: false })

    const { data } = await supabaseAdmin
      .from('profiles')
      .select('microsoft_calendar_token, microsoft_calendar_email')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      connected: !!data?.microsoft_calendar_token,
      email: data?.microsoft_calendar_email || null,
    })
  }

  if (action === 'disconnect') {
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    await supabaseAdmin
      .from('profiles')
      .update({
        microsoft_calendar_token: null,
        microsoft_calendar_refresh_token: null,
        microsoft_calendar_email: null,
      })
      .eq('id', userId)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// ─── POST: sync appointment ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, userId, appointmentId, appointment } = body

    if (action === 'sync-appointment') {
      console.log('[MSCal] sync-appointment → appointmentId:', appointmentId, '| childId:', appointment?.childId)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('microsoft_calendar_token, microsoft_calendar_refresh_token, microsoft_calendar_email')
        .eq('id', userId)
        .single()

      if (!profile?.microsoft_calendar_token) {
        return NextResponse.json({ ok: false, error: 'Microsoft Calendar not connected' })
      }

      // Refresh token if needed
      let accessToken = profile.microsoft_calendar_token
      try {
        const refreshRes = await fetch(
          `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id:     MS_CLIENT_ID,
              client_secret: MS_CLIENT_SECRET,
              refresh_token: profile.microsoft_calendar_refresh_token || '',
              grant_type:    'refresh_token',
              scope:         'Calendars.ReadWrite offline_access',
            }),
          }
        )
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          accessToken = refreshData.access_token
          await supabaseAdmin
            .from('profiles')
            .update({ microsoft_calendar_token: accessToken })
            .eq('id', userId)
        }
      } catch { /* use existing token */ }

      // Fetch parent email if not provided
      let parentEmail: string | null = appointment.parentEmail || null
      if (!parentEmail && appointment.childId) {
        const { data: child } = await supabaseAdmin
          .from('children')
          .select('profiles!children_parent_id_fkey(email)')
          .eq('id', appointment.childId)
          .single()
        parentEmail = (child?.profiles as any)?.email || null
      }

      // Build event
      const {
        date, time, patientName, serviceType, notes, modality,
        groupName, sessionType, recurrencia, recurrenciaSemanas, videoLink,
      } = appointment

      // Hora local Lima — sin conversión UTC
      const timeClean = (time || '00:00').slice(0, 5)
      const [hh, mm] = timeClean.split(':').map(Number)
      const endHH = String(Math.floor((hh * 60 + mm + 60) / 60) % 24).padStart(2, '0')
      const endMM = String((mm + 60) % 60).padStart(2, '0')
      const startISO = `${date}T${timeClean}:00`
      const endISO   = `${date}T${endHH}:${endMM}:00`

      const nombrePaciente = (patientName || '').trim() || 'Paciente'
      const esGrupal       = sessionType === 'grupal'
      const esVirtual      = modality === 'virtual'

      const tituloEvento = esGrupal
        ? `🧩 Sesión Grupal: ${groupName || nombrePaciente}`
        : `🧩 ${nombrePaciente} — ${serviceType || 'Sesión ABA'}`

      const lineas = [
        esVirtual ? '📹 Sesión Virtual' : '📍 Sesión Presencial',
        `👤 Paciente: ${nombrePaciente}`,
        esGrupal && groupName ? `👥 Grupo: ${groupName}` : null,
        `🏥 Servicio: ${serviceType || 'Sesión ABA'}`,
        `📋 Modalidad: ${esVirtual ? 'Virtual' : 'Presencial'}`,
        recurrencia ? `🔁 Cita recurrente (${recurrencia === 'weekly' ? 'Semanal' : 'Quincenal'}, ${recurrenciaSemanas} semanas)` : null,
        notes ? `📝 Notas: ${notes}` : null,
        esVirtual && videoLink ? `<br/>🔗 <a href="${videoLink}">Unirse a la videollamada</a>` : null,
        '<br/>🏫 Centro Vanty ABA',
      ].filter(Boolean).join('<br/>')

      const attendees = []
      if (parentEmail) {
        attendees.push({
          emailAddress: { address: parentEmail, name: `Familia — ${patientName}` },
          type: 'required',
        })
      }

      const event: any = {
        subject: tituloEvento,
        body: {
          contentType: 'HTML',
          content: `
            <b>${modality === 'virtual' ? '📹 Sesión Virtual' : '📍 Sesión Presencial'}</b><br/>
            Centro: Vanty ABA<br/>
            Paciente: ${patientName}<br/>
            ${notes ? `📝 ${notes}` : ''}
          `,
        },
        start: { dateTime: startISO, timeZone: 'SA Pacific Standard Time' },
        end:   { dateTime: endISO,   timeZone: 'SA Pacific Standard Time' },
        isReminderOn: true,
        reminderMinutesBeforeStart: 60,
        ...(attendees.length > 0 ? { attendees } : {}),
      }

      const msRes = await fetch(
        'https://graph.microsoft.com/v1.0/me/events',
        {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      )

      if (!msRes.ok) {
        const err = await msRes.json()
        return NextResponse.json({ ok: false, error: err.error?.message || 'Microsoft Calendar error' })
      }

      const msData = await msRes.json()

      if (appointmentId) {
        await supabaseAdmin
          .from('appointments')
          .update({ microsoft_calendar_event_id: msData.id })
          .eq('id', appointmentId)
      }

      // ── También crear evento en el Microsoft Calendar del PADRE ──
      let parentMsEventId: string | null = null
      let skipParentMsSync = false

      // Evitar duplicados: verificar si ya existe parent_microsoft_calendar_event_id en esta cita
      if (appointmentId) {
        const { data: existingApt } = await supabaseAdmin
          .from('appointments')
          .select('parent_microsoft_calendar_event_id')
          .eq('id', appointmentId)
          .single()
        if (existingApt?.parent_microsoft_calendar_event_id) {
          skipParentMsSync = true
          parentMsEventId = existingApt.parent_microsoft_calendar_event_id
          console.log('[MSCal] ⏭️ Esta cita ya tiene evento del padre, saltando:', parentMsEventId)
        }
      }

      // Verificar si este padre ya recibió evento en otra cita del mismo grupo/fecha/hora
      if (!skipParentMsSync && appointment.childId) {
        const { data: childCheck } = await supabaseAdmin
          .from('children')
          .select('parent_id')
          .eq('id', appointment.childId)
          .single()

        if (childCheck?.parent_id) {
          const { data: existingParentApts } = await supabaseAdmin
            .from('appointments')
            .select('id, parent_microsoft_calendar_event_id')
            .eq('appointment_date', appointment.date)
            .eq('appointment_time', (appointment.time || '00:00') + ':00')
            .not('parent_microsoft_calendar_event_id', 'is', null)
            .neq('id', appointmentId || '')
            .limit(10)

          if (existingParentApts && existingParentApts.length > 0) {
            for (const otherApt of existingParentApts) {
              const { data: otherChild } = await supabaseAdmin
                .from('appointments')
                .select('child_id, children(parent_id)')
                .eq('id', otherApt.id)
                .single()
              const otherParentId = (otherChild?.children as any)?.parent_id
              if (otherParentId === childCheck.parent_id) {
                skipParentMsSync = true
                parentMsEventId = otherApt.parent_microsoft_calendar_event_id
                console.log('[MSCal] ⏭️ Padre ya tiene evento en otra cita del mismo grupo, saltando duplicado')
                break
              }
            }
          }
        }
      }

      if (appointment.childId && !skipParentMsSync) {
        try {
          const { data: child } = await supabaseAdmin
            .from('children')
            .select('parent_id')
            .eq('id', appointment.childId)
            .single()

          if (child?.parent_id) {
            const { data: parentProfile } = await supabaseAdmin
              .from('profiles')
              .select('microsoft_calendar_token, microsoft_calendar_refresh_token')
              .eq('id', child.parent_id)
              .single()

            if (!parentProfile?.microsoft_calendar_token) {
              console.log('[MSCal] ⚠️ Padre no tiene Microsoft Calendar conectado. parent_id:', child.parent_id)
            }
            if (parentProfile?.microsoft_calendar_token) {
              let parentToken = parentProfile.microsoft_calendar_token
              try {
                const rr = await fetch(
                  `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                      client_id:     MS_CLIENT_ID,
                      client_secret: MS_CLIENT_SECRET,
                      refresh_token: parentProfile.microsoft_calendar_refresh_token || '',
                      grant_type:    'refresh_token',
                      scope:         'Calendars.ReadWrite offline_access',
                    }),
                  }
                )
                if (rr.ok) {
                  const rd = await rr.json()
                  parentToken = rd.access_token
                  await supabaseAdmin.from('profiles')
                    .update({ microsoft_calendar_token: parentToken })
                    .eq('id', child.parent_id)
                }
              } catch { /* use existing */ }

              const parentEvent: any = {
                subject: tituloEvento,
                body: { contentType: 'HTML', content: lineas },
                start: { dateTime: startISO, timeZone: 'SA Pacific Standard Time' },
                end:   { dateTime: endISO,   timeZone: 'SA Pacific Standard Time' },
                isReminderOn: true,
                reminderMinutesBeforeStart: 60,
                ...(esVirtual && videoLink ? {
                  location: { displayName: '📹 Videollamada Vanty ABA', uniqueId: videoLink, uniqueIdType: 'locationStore' },
                } : {}),
              }

              console.log('[MSCal] 🔄 Intentando crear evento en calendario del padre:', child.parent_id)

              const parentRes = await fetch(
                'https://graph.microsoft.com/v1.0/me/events',
                {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${parentToken}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(parentEvent),
                }
              )
              if (parentRes.ok) {
                const parentData = await parentRes.json()
                parentMsEventId = parentData.id
                console.log('[MSCal] ✅ Evento creado en calendario del PADRE:', parentData.id)
                if (appointmentId) {
                  await supabaseAdmin
                    .from('appointments')
                    .update({ parent_microsoft_calendar_event_id: parentData.id })
                    .eq('id', appointmentId)
                }
              } else {
                const errText = await parentRes.text()
                console.error('[MSCal] ❌ Error creando evento en calendario del PADRE:', parentRes.status, errText)
                if (parentRes.status === 401) {
                  console.log('[MSCal] 🔑 Token del padre expirado — limpiando para que reconecte')
                  await supabaseAdmin.from('profiles')
                    .update({ microsoft_calendar_token: null, microsoft_calendar_refresh_token: null })
                    .eq('id', child.parent_id)
                }
              }
            }
          }
        } catch (parentErr) {
          console.error('[MSCal] ❌ Excepción al crear evento del padre:', parentErr)
        }
      }

      return NextResponse.json({
        ok: true,
        eventId: msData.id,
        eventUrl: msData.webLink,
        parentNotified: !!parentEmail,
        parentMsEventId,
      })
    }

    // ── Sincronizar TODAS las citas próximas a Microsoft Calendar ──────────
    if (action === 'sync-all') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('microsoft_calendar_token, microsoft_calendar_refresh_token')
        .eq('id', userId)
        .single()

      if (!profile?.microsoft_calendar_token) {
        return NextResponse.json({ ok: false, error: 'Microsoft Calendar not connected' })
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: apts } = await supabaseAdmin
        .from('appointments')
        .select('*, children(name)')
        .gte('appointment_date', today)
        .neq('status', 'cancelled')
        .is('microsoft_calendar_event_id', null)
        .limit(50)

      let synced = 0
      for (const apt of apts || []) {
        const syncRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/microsoft-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-appointment',
            userId,
            appointmentId: apt.id,
            appointment: {
              date:        apt.appointment_date,
              time:        apt.appointment_time?.slice(0, 5),
              childId:     apt.child_id,
              patientName: apt.children?.name || 'Paciente',
              serviceType: apt.service_type,
              notes:       apt.notes,
              modality:    apt.modalidad,
            },
          }),
        })
        if ((await syncRes.json()).ok) synced++
      }

      return NextResponse.json({ ok: true, synced })
    }

    // ── Borrar evento del calendario Outlook ───────────────────────────
    if (action === 'update-event') {
      const { eventId, appointment_date, appointment_time } = body
      if (!eventId) return NextResponse.json({ ok: true, skipped: 'no eventId' })
      if (!appointment_date || !appointment_time) {
        return NextResponse.json({ ok: false, error: 'appointment_date y appointment_time requeridos' })
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('microsoft_calendar_token, microsoft_calendar_refresh_token')
        .eq('id', userId)
        .single()

      if (!profile?.microsoft_calendar_token) {
        return NextResponse.json({ ok: true, skipped: 'not connected' })
      }

      let accessToken = profile.microsoft_calendar_token
      try {
        const refreshRes = await fetch(
          `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id:     MS_CLIENT_ID,
              client_secret: MS_CLIENT_SECRET,
              refresh_token: profile.microsoft_calendar_refresh_token || '',
              grant_type:    'refresh_token',
              scope:         'Calendars.ReadWrite offline_access',
            }),
          }
        )
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          accessToken = refreshData.access_token
          await supabaseAdmin.from('profiles').update({ microsoft_calendar_token: accessToken }).eq('id', userId)
        }
      } catch { /* use existing token */ }

      const timeClean = String(appointment_time).slice(0, 5)
      const [hh, mm] = timeClean.split(':').map(Number)
      const endHH = String(Math.floor((hh * 60 + mm + 60) / 60) % 24).padStart(2, '0')
      const endMM = String((mm + 60) % 60).padStart(2, '0')
      const startISO = `${appointment_date}T${timeClean}:00`
      const endISO   = `${appointment_date}T${endHH}:${endMM}:00`

      const patchRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: { dateTime: startISO, timeZone: 'America/Lima' },
            end:   { dateTime: endISO,   timeZone: 'America/Lima' },
          }),
        }
      )

      if (!patchRes.ok && patchRes.status !== 404) {
        const err = await patchRes.text()
        console.error('[MSCal] update-event failed:', patchRes.status, err)
        await logServerError(`Microsoft Calendar ${patchRes.status} (update)`, err, 'api:microsoft-calendar')
        return NextResponse.json({ ok: false, error: 'No se pudo actualizar el evento en Microsoft Calendar.' })
      }

      return NextResponse.json({ ok: true, updated: eventId })
    }

    if (action === 'delete-event') {
      const { eventId } = body
      if (!eventId) return NextResponse.json({ ok: true, skipped: 'no eventId' })

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('microsoft_calendar_token, microsoft_calendar_refresh_token')
        .eq('id', userId)
        .single()

      if (!profile?.microsoft_calendar_token) {
        return NextResponse.json({ ok: true, skipped: 'not connected' })
      }

      let accessToken = profile.microsoft_calendar_token
      try {
        const refreshRes = await fetch(
          `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id:     MS_CLIENT_ID,
              client_secret: MS_CLIENT_SECRET,
              refresh_token: profile.microsoft_calendar_refresh_token || '',
              grant_type:    'refresh_token',
              scope:         'Calendars.ReadWrite offline_access',
            }),
          }
        )
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          accessToken = refreshData.access_token
          await supabaseAdmin.from('profiles').update({ microsoft_calendar_token: accessToken }).eq('id', userId)
        }
      } catch { /* use existing token */ }

      const delRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      )

      if (!delRes.ok && delRes.status !== 404) {
        const err = await delRes.text()
        return NextResponse.json({ ok: false, error: err })
      }

      return NextResponse.json({ ok: true, deleted: eventId })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
