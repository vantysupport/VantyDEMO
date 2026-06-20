// app/api/google-calendar/route.ts
// Handles Google Calendar OAuth and event sync
import { NextRequest, NextResponse } from 'next/server'
import { logServerError } from '@/lib/log-server-error'
import { supabaseAdmin } from '@/lib/supabase-admin'

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID     || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
const REDIRECT_URI         = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  : 'http://localhost:3000/api/google-calendar/callback'

// ─── GET: generate OAuth URL ─────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  // Return OAuth URL for client to redirect to
  if (action === 'auth-url') {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
    ].join(' ')

    const userId = searchParams.get('userId') || ''
    const role   = searchParams.get('role')   || 'admin'   // 'padre' | 'admin'

    const params = new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      response_type: 'code',
      scope:         scopes,
      access_type:   'offline',
      prompt:        'consent',
      state:         `${userId}:${role}`, // pass userId + role through OAuth flow
    })

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    return NextResponse.json({ url })
  }

  // Check if user has connected Google Calendar
  if (action === 'status') {
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ connected: false })

    const { data } = await supabaseAdmin
      .from('profiles')
      .select('google_calendar_token, google_calendar_email')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      connected: !!data?.google_calendar_token,
      email: data?.google_calendar_email || null,
    })
  }

  // Disconnect Google Calendar
  if (action === 'disconnect') {
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    await supabaseAdmin
      .from('profiles')
      .update({ google_calendar_token: null, google_calendar_refresh_token: null, google_calendar_email: null })
      .eq('id', userId)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// ─── POST: sync appointment to Google Calendar ───────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, userId, appointmentId, appointment } = body

    if (action === 'sync-appointment') {
      console.log('[GCal] sync-appointment → appointmentId:', appointmentId, '| childId:', appointment?.childId)
      // Get user's Google token
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('google_calendar_token, google_calendar_refresh_token, google_calendar_email')
        .eq('id', userId)
        .single()

      if (!profile?.google_calendar_token) {
        console.error('[GCal] No token for userId:', userId)
        return NextResponse.json({ ok: false, error: 'Google Calendar not connected' })
      }

      // Try to refresh token if needed
      let accessToken = profile.google_calendar_token
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id:     GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: profile.google_calendar_refresh_token || '',
            grant_type:    'refresh_token',
          }),
        })
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          accessToken = refreshData.access_token
          await supabaseAdmin.from('profiles').update({ google_calendar_token: accessToken }).eq('id', userId)
        }
      } catch (refreshErr) {
        console.error('[GCal] Token refresh failed:', refreshErr)
        /* use existing token */
      }

      // Fetch parent email from the appointment's child record
      let parentEmail: string | null = appointment.parentEmail || null
      if (!parentEmail && appointmentId) {
        const { data: apt } = await supabaseAdmin
          .from('appointments')
          .select('child_id, children(profiles!children_parent_id_fkey(email))')
          .eq('id', appointmentId)
          .single()
        parentEmail = (apt?.children as any)?.profiles?.email || null
      }
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

      // Título del evento
      const tituloEvento = esGrupal
        ? `🧩 Sesión Grupal: ${groupName || nombrePaciente}`
        : `🧩 ${nombrePaciente} — ${serviceType || 'Sesión ABA'}`

      // Descripción enriquecida
      const lineas = [
        esVirtual ? '📹 Sesión Virtual' : '📍 Sesión Presencial',
        `👤 Paciente: ${nombrePaciente}`,
        esGrupal && groupName ? `👥 Grupo: ${groupName}` : null,
        `🏥 Servicio: ${serviceType || 'Sesión ABA'}`,
        `📋 Modalidad: ${esVirtual ? 'Virtual' : 'Presencial'}`,
        recurrencia ? `🔁 Cita recurrente (${recurrencia === 'weekly' ? 'Semanal' : 'Quincenal'}, ${recurrenciaSemanas} semanas)` : null,
        notes ? `📝 Notas: ${notes}` : null,
        esVirtual && videoLink ? `\n🔗 Link videollamada: ${videoLink}` : null,
        '\n🏫 Centro Vanty ABA',
      ].filter(Boolean).join('\n')

      // Attendees: always include admin's Google email + parent email if available
      const attendees: { email: string; displayName?: string }[] = []
      if (profile.google_calendar_email) {
        attendees.push({ email: profile.google_calendar_email, displayName: 'Terapeuta' })
      }
      if (parentEmail) {
        attendees.push({ email: parentEmail, displayName: `Familia — ${patientName}` })
      }

      const event: any = {
        summary:     tituloEvento,
        description: lineas,
        start: { dateTime: startISO, timeZone: 'America/Lima' },
        end:   { dateTime: endISO,   timeZone: 'America/Lima' },
        ...(esVirtual && videoLink ? {
          location: videoLink,
          conferenceData: {
            createRequest: { requestId: `vanty-${appointmentId || Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } }
          },
        } : {}),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'email', minutes: 1440 },
          ],
        },
        colorId: '9', // blueberry
        ...(attendees.length > 0 ? { attendees, guestsCanSeeOtherGuests: false } : {}),
        sendUpdates: attendees.some(a => a.displayName?.startsWith('Familia')) ? 'all' : 'none',
      }

      const gcalRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=${event.sendUpdates}`,
        {
          method: 'POST',
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...event, sendUpdates: undefined }),
        }
      )

      if (!gcalRes.ok) {
        const errText = await gcalRes.text()
        console.error('[GCal] Event creation failed:', gcalRes.status, errText)
        await logServerError(`Google Calendar ${gcalRes.status} (create)`, errText, 'api:google-calendar')
        return NextResponse.json({ ok: false, error: 'No se pudo crear el evento en Google Calendar.' })
      }

      const gcalData = await gcalRes.json()
      console.log('[GCal] ✅ Event created:', gcalData.id, gcalData.htmlLink)

      if (appointmentId) {
        await supabaseAdmin
          .from('appointments')
          .update({ google_calendar_event_id: gcalData.id })
          .eq('id', appointmentId)
      }

      // ── También crear evento en el Google Calendar del PADRE si está conectado ──
      // Evitar duplicados: verificar si ya existe parent_google_calendar_event_id en esta cita
      let parentGcalEventId: string | null = null
      let skipParentSync = false

      if (appointmentId) {
        const { data: existingApt } = await supabaseAdmin
          .from('appointments')
          .select('parent_google_calendar_event_id')
          .eq('id', appointmentId)
          .single()
        if (existingApt?.parent_google_calendar_event_id) {
          skipParentSync = true
          parentGcalEventId = existingApt.parent_google_calendar_event_id
          console.log('[GCal] ⏭️ Esta cita ya tiene evento del padre, saltando:', parentGcalEventId)
        }
      }

      // También verificar si este padre ya recibió un evento en OTRA cita del mismo grupo/fecha/hora
      if (!skipParentSync && appointment.childId) {
        const { data: childCheck } = await supabaseAdmin
          .from('children')
          .select('parent_id')
          .eq('id', appointment.childId)
          .single()

        if (childCheck?.parent_id) {
          // Buscar si el padre ya tiene evento en otra cita de la misma fecha/hora
          const { data: existingParentApt } = await supabaseAdmin
            .from('appointments')
            .select('id, parent_google_calendar_event_id')
            .eq('appointment_date', appointment.date)
            .eq('appointment_time', (appointment.time || '00:00') + ':00')
            .not('parent_google_calendar_event_id', 'is', null)
            .neq('id', appointmentId || '')
            .limit(10)

          if (existingParentApt && existingParentApt.length > 0) {
            // Ver si alguna de esas citas es del mismo padre
            for (const otherApt of existingParentApt) {
              const { data: otherChild } = await supabaseAdmin
                .from('appointments')
                .select('child_id, children(parent_id)')
                .eq('id', otherApt.id)
                .single()
              const otherParentId = (otherChild?.children as any)?.parent_id
              if (otherParentId === childCheck.parent_id) {
                skipParentSync = true
                parentGcalEventId = otherApt.parent_google_calendar_event_id
                console.log('[GCal] ⏭️ Padre ya tiene evento en otra cita del mismo grupo, saltando duplicado')
                break
              }
            }
          }
        }
      }

      if (appointment.childId && !skipParentSync) {
        try {
          // Buscar el parent_id del niño
          const { data: child } = await supabaseAdmin
            .from('children')
            .select('parent_id')
            .eq('id', appointment.childId)
            .single()

          if (child?.parent_id) {
            // Ver si el padre tiene Google Calendar conectado
            const { data: parentProfile } = await supabaseAdmin
              .from('profiles')
              .select('google_calendar_token, google_calendar_refresh_token, google_calendar_email')
              .eq('id', child.parent_id)
              .single()

            if (!parentProfile?.google_calendar_token) {
              console.log('[GCal] ⚠️ Padre no tiene Google Calendar conectado. parent_id:', child.parent_id)
            }
            if (parentProfile?.google_calendar_token) {
              // Refresh token del padre si es necesario
              let parentToken = parentProfile.google_calendar_token
              try {
                const rr = await fetch('https://oauth2.googleapis.com/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    client_id:     process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
                    client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
                    refresh_token: parentProfile.google_calendar_refresh_token || '',
                    grant_type:    'refresh_token',
                  }),
                })
                if (rr.ok) {
                  const rd = await rr.json()
                  parentToken = rd.access_token
                  await supabaseAdmin.from('profiles')
                    .update({ google_calendar_token: parentToken })
                    .eq('id', child.parent_id)
                }
              } catch { /* use existing */ }

              // Crear evento en el calendario del padre (sin attendees extra)
              const parentEvent: any = {
                summary:     tituloEvento,
                description: lineas,
                start: { dateTime: startISO, timeZone: 'America/Lima' },
                end:   { dateTime: endISO,   timeZone: 'America/Lima' },
                reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }] },
                colorId: '9',
                ...(esVirtual && videoLink ? { location: videoLink } : {}),
              }

              console.log('[GCal] 🔄 Intentando crear evento en calendario del padre:', child.parent_id)

              const parentRes = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${parentToken}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(parentEvent),
                }
              )

              if (parentRes.ok) {
                const parentData = await parentRes.json()
                parentGcalEventId = parentData.id
                console.log('[GCal] ✅ Evento creado en calendario del PADRE:', parentData.id)
                // Guardar event_id del padre en la cita
                if (appointmentId) {
                  await supabaseAdmin
                    .from('appointments')
                    .update({ parent_google_calendar_event_id: parentData.id })
                    .eq('id', appointmentId)
                }
              } else {
                const errText = await parentRes.text()
                console.error('[GCal] ❌ Error creando evento en calendario del PADRE:', parentRes.status, errText)

                // Si el token expiró (401), limpiar token para que el padre reconecte
                if (parentRes.status === 401) {
                  console.log('[GCal] 🔑 Token del padre expirado — limpiando para que reconecte')
                  await supabaseAdmin.from('profiles')
                    .update({ google_calendar_token: null, google_calendar_refresh_token: null })
                    .eq('id', child.parent_id)
                }
              }
            }
          }
        } catch (parentErr) {
          console.error('[GCal] ❌ Excepción al crear evento del padre:', parentErr)
        }
      }

      return NextResponse.json({
        ok: true,
        eventId: gcalData.id,
        eventUrl: gcalData.htmlLink,
        parentNotified: !!parentEmail,
        parentEmail,
        parentGcalEventId,
      })
    }

    // Sync ALL upcoming appointments at once
    if (action === 'sync-all') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('google_calendar_token, google_calendar_refresh_token')
        .eq('id', userId)
        .single()

      if (!profile?.google_calendar_token) {
        console.error('[GCal] No token for userId:', userId)
        return NextResponse.json({ ok: false, error: 'Google Calendar not connected' })
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: apts } = await supabaseAdmin
        .from('appointments')
        .select('*, children(name)')
        .gte('appointment_date', today)
        .neq('status', 'cancelled')
        .is('google_calendar_event_id', null)
        .limit(50)

      let synced = 0
      for (const apt of apts || []) {
        const syncRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'sync-appointment',
            userId,
            appointmentId: apt.id,
            appointment: {
              date:        apt.appointment_date,
              time:        apt.appointment_time?.slice(0, 5),
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

    // ── Borrar evento del calendario ────────────────────────────────────
    if (action === 'update-event') {
      const { eventId, appointment_date, appointment_time, notifyAttendees } = body
      if (!eventId) return NextResponse.json({ ok: true, skipped: 'no eventId' })
      if (!appointment_date || !appointment_time) {
        return NextResponse.json({ ok: false, error: 'appointment_date y appointment_time requeridos' })
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('google_calendar_token, google_calendar_refresh_token')
        .eq('id', userId)
        .single()

      if (!profile?.google_calendar_token) {
        return NextResponse.json({ ok: true, skipped: 'not connected' })
      }

      let accessToken = profile.google_calendar_token
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id:     process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
            refresh_token: profile.google_calendar_refresh_token || '',
            grant_type:    'refresh_token',
          }),
        })
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          accessToken = refreshData.access_token
          await supabaseAdmin.from('profiles').update({ google_calendar_token: accessToken }).eq('id', userId)
        }
      } catch { /* use existing token */ }

      const timeClean = String(appointment_time).slice(0, 5)
      const [hh, mm] = timeClean.split(':').map(Number)
      const endHH = String(Math.floor((hh * 60 + mm + 60) / 60) % 24).padStart(2, '0')
      const endMM = String((mm + 60) % 60).padStart(2, '0')
      const startISO = `${appointment_date}T${timeClean}:00`
      const endISO   = `${appointment_date}T${endHH}:${endMM}:00`

      const sendUpdates = notifyAttendees ? 'all' : 'none'

      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=${sendUpdates}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            start: { dateTime: startISO, timeZone: 'America/Lima' },
            end:   { dateTime: endISO,   timeZone: 'America/Lima' },
          }),
        }
      )

      if (!patchRes.ok && patchRes.status !== 404 && patchRes.status !== 410) {
        const err = await patchRes.text()
        console.error('[GCal] update-event failed:', patchRes.status, err)
        await logServerError(`Google Calendar ${patchRes.status} (update)`, err, 'api:google-calendar')
        return NextResponse.json({ ok: false, error: 'No se pudo actualizar el evento en Google Calendar.' })
      }

      return NextResponse.json({ ok: true, updated: eventId })
    }

    if (action === 'delete-event') {
      const { eventId } = body
      if (!eventId) return NextResponse.json({ ok: true, skipped: 'no eventId' })

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('google_calendar_token, google_calendar_refresh_token')
        .eq('id', userId)
        .single()

      if (!profile?.google_calendar_token) {
        return NextResponse.json({ ok: true, skipped: 'not connected' })
      }

      let accessToken = profile.google_calendar_token
      try {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id:     process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
            client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
            refresh_token: profile.google_calendar_refresh_token || '',
            grant_type:    'refresh_token',
          }),
        })
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json()
          accessToken = refreshData.access_token
          await supabaseAdmin.from('profiles').update({ google_calendar_token: accessToken }).eq('id', userId)
        }
      } catch { /* use existing token */ }

      const delRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      )

      // 404 = ya fue borrado, igual es OK
      if (!delRes.ok && delRes.status !== 404 && delRes.status !== 410) {
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
