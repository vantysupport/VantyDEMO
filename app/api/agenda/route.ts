// app/api/agenda/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync, notifyParentDirect } from '@/lib/notifications'

// ─── GET: obtener agenda ──────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fecha       = searchParams.get('fecha')        // YYYY-MM-DD
  const fechaInicio = searchParams.get('fecha_inicio')
  const fechaFin    = searchParams.get('fecha_fin')
  const terapeutaId = searchParams.get('terapeuta_id')
  const childId     = searchParams.get('child_id')
  const estado      = searchParams.get('estado')

  try {
    let query = supabaseAdmin
      .from('agenda_sesiones')
      .select(`
        *,
        children(id, name, diagnosis, age),
        terapeuta:terapeuta_id(id, email, raw_user_meta_data)
      `)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (fecha)        query = query.eq('fecha', fecha)
    if (fechaInicio)  query = query.gte('fecha', fechaInicio)
    if (fechaFin)     query = query.lte('fecha', fechaFin)
    if (terapeutaId)  query = query.eq('terapeuta_id', terapeutaId)
    if (childId)      query = query.eq('child_id', childId)
    if (estado)       query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── POST: crear / actualizar sesión ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    // CREAR sesión
    if (action === 'crear' || !action) {
      const { child_id, terapeuta_id, fecha, hora_inicio, hora_fin, tipo, modalidad, notas } = body

      if (!child_id || !terapeuta_id || !fecha || !hora_inicio) {
        return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
      }

      // Verificar conflicto de horario para el terapeuta
      const { data: conflicto } = await supabaseAdmin
        .from('agenda_sesiones')
        .select('id')
        .eq('terapeuta_id', terapeuta_id)
        .eq('fecha', fecha)
        .eq('hora_inicio', hora_inicio)
        .neq('estado', 'cancelada')
        .single()

      if (conflicto) {
        return NextResponse.json({ error: 'El terapeuta ya tiene una sesion en ese horario' }, { status: 409 })
      }

      // ── Generar link de videollamada si es virtual ──
      let meeting_link: string | null = null
      if (modalidad === 'virtual') {
        const tempId = `${child_id}-${fecha}-${hora_inicio}`.replace(/:/g, '-')
        meeting_link = `https://meet.jit.si/SantiMeet-${tempId}`
      }

      const { data, error } = await supabaseAdmin
        .from('agenda_sesiones')
        .insert({ child_id, terapeuta_id, fecha, hora_inicio, hora_fin, tipo, modalidad, notas, estado: 'programada', ...(meeting_link ? { meeting_link } : {}) })
        .select('*, children(name)')
        .single()

      if (error) throw error

      // Crear notificación para el padre
      await crearNotificacionCita(child_id, data, 'nueva')

      // Notificar al padre (si tiene WSP) + al admin
      const childName = (data as any).children?.name || 'Paciente'
      const { data: parentLink } = await supabaseAdmin
        .from('parent_accounts').select('user_id').eq('child_id', child_id).maybeSingle()
      if (parentLink?.user_id) {
        const { data: parentProf } = await supabaseAdmin
          .from('profiles').select('phone, wsp_notif').eq('id', parentLink.user_id).maybeSingle()
        if ((parentProf as any)?.phone && (parentProf as any)?.wsp_notif !== false) {
          // Notificar directo al padre via microservicio Baileys — incluir link si es virtual
          await notifyParentDirect((parentProf as any).phone, 'cita_confirmada', {
            fecha, hora: hora_inicio, paciente: childName,
            tipo: modalidad === 'virtual' ? 'Virtual 📹' : (tipo || 'Presencial'),
            ...(meeting_link ? { link: meeting_link } : {}),
          })
        }
      }
      // Notificar al admin también
      await notifyAsync({
        tipo: 'cita_confirmada',
        vars: {
          fecha, hora: hora_inicio, paciente: childName,
          tipo: modalidad === 'virtual' ? 'Virtual 📹' : (tipo || 'Presencial'),
          ...(meeting_link ? { link: meeting_link } : {}),
        },
      })

      // ── Agregar al Google / Microsoft Calendar del padre (si tiene OAuth) ──
      try {
        if (parentLink?.user_id) {
          const { data: session } = await supabaseAdmin.auth.admin.getUserById(parentLink.user_id)
          const identities = (session?.user as any)?.identities || []
          const googleId   = identities.find((i: any) => i.provider === 'google')
          const microsoftId = identities.find((i: any) => i.provider === 'azure')
          const { data: terapInfo } = await supabaseAdmin
            .from('profiles').select('full_name').eq('id', terapeuta_id).maybeSingle()

          if (googleId || microsoftId) {
            const { addCalendarReminder } = await import('@/lib/calendar-integration')
            // Token está en la sesión de Supabase — usar provider_token
            const { data: userSession } = await supabaseAdmin.auth.admin.listUsers()
            // Fire and forget — no bloquear la respuesta
          }
        }
      } catch { /* Calendar es nice-to-have, no bloquea */ }

      return NextResponse.json({ data, calendarHint: 'ok' })
    }

    // ACTUALIZAR estado
    if (action === 'actualizar_estado') {
      const { id, estado, notas } = body
      const { data, error } = await supabaseAdmin
        .from('agenda_sesiones')
        .update({ estado, notas: notas || undefined, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, children(name, id)')
        .single()

      if (error) throw error

      // Notificar cancelación
      if (estado === 'cancelada' && data.children) {
        await crearNotificacionCita((data.children as any).id, data, 'cancelada')

        const cancelFecha = (data as any).fecha || ''
        const cancelHora  = (data as any).hora_inicio || ''
        const cancelNombre = (data.children as any).name || 'Paciente'
        const cancelChildId = (data.children as any).id

        // WhatsApp al admin
        notifyAsync({
          tipo: 'cita_cancelada',
          vars: { fecha: cancelFecha, hora: cancelHora, paciente: cancelNombre },
        })

        // WhatsApp directo al padre via Baileys
        try {
          const { data: pLink } = await supabaseAdmin
            .from('parent_accounts').select('user_id').eq('child_id', cancelChildId).maybeSingle()
          if (pLink?.user_id) {
            const { data: pProf } = await supabaseAdmin
              .from('profiles').select('phone, wsp_notif').eq('id', pLink.user_id).maybeSingle()
            if ((pProf as any)?.phone && (pProf as any)?.wsp_notif !== false) {
              notifyParentDirect((pProf as any).phone, 'cita_cancelada', {
                fecha: cancelFecha, hora: cancelHora, paciente: cancelNombre,
              })
            }
          }
        } catch { /* silencioso */ }
      }

      // ── Notificar "sesión iniciada" cuando el terapeuta marca como confirmada ──
      if (estado === 'confirmada' && data.children) {
        const inicioFecha  = (data as any).fecha || ''
        const inicioHora   = (data as any).hora_inicio || ''
        const inicioNombre = (data.children as any).name || 'Paciente'
        const inicioChildId = (data.children as any).id
        const meetingLink  = (data as any).meeting_link || null

        try {
          const { data: pLink } = await supabaseAdmin
            .from('parent_accounts').select('user_id').eq('child_id', inicioChildId).maybeSingle()
          if (pLink?.user_id) {
            const { data: pProf } = await supabaseAdmin
              .from('profiles').select('phone, wsp_notif').eq('id', pLink.user_id).maybeSingle()
            if ((pProf as any)?.phone && (pProf as any)?.wsp_notif !== false) {
              notifyParentDirect((pProf as any).phone, 'sesion_iniciada', {
                fecha: inicioFecha, hora: inicioHora, paciente: inicioNombre,
                ...(meetingLink ? { link: meetingLink } : {}),
              })
            }
          }
        } catch { /* silencioso */ }
      }

      return NextResponse.json({ data })
    }

    // ACTUALIZAR sesión completa
    if (action === 'editar') {
      const { id, ...updates } = body
      delete updates.action
      const { data, error } = await supabaseAdmin
        .from('agenda_sesiones')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── DELETE: cancelar sesión ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const { error } = await supabaseAdmin
      .from('agenda_sesiones')
      .update({ estado: 'cancelada' })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── HELPERS ─────────────────────────────────────────────────
async function crearNotificacionCita(childId: string, sesion: any, tipo: string) {
  try {
    // Buscar cuentas de padres del paciente
    const { data: padres } = await supabaseAdmin
      .from('parent_accounts')
      .select('user_id, nombre')
      .eq('child_id', childId)

    if (!padres || padres.length === 0) return

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name')
      .eq('id', childId)
      .single()

    const nombreNino = (child as any)?.name || 'su hijo/a'
    const fecha = sesion.fecha
    const hora  = sesion.hora_inicio?.slice(0, 5) || ''

    const mensajes: Record<string, { titulo: string; mensaje: string }> = {
      nueva: {
        titulo: 'Nueva cita programada',
        mensaje: `Se programo una sesion para ${nombreNino} el ${fecha} a las ${hora}. Te esperamos!`
      },
      cancelada: {
        titulo: 'Cita cancelada',
        mensaje: `La sesion de ${nombreNino} del ${fecha} a las ${hora} fue cancelada. Contactanos para reprogramar.`
      },
      recordatorio: {
        titulo: 'Recordatorio de cita - Manana',
        mensaje: `Recordatorio: ${nombreNino} tiene sesion manana ${fecha} a las ${hora}. Por favor confirma asistencia.`
      }
    }

    const notif = mensajes[tipo] || mensajes.nueva

    const notificaciones = padres.map(padre => ({
      user_id: padre.user_id,
      child_id: childId,
      tipo: 'cita_' + tipo,
      titulo: notif.titulo,
      mensaje: notif.mensaje,
      prioridad: tipo === 'cancelada' ? 1 : 2,
      canal: 'in_app',
      metadata: { sesion_id: sesion.id, fecha, hora }
    }))

    await supabaseAdmin.from('notificaciones').insert(notificaciones)
  } catch (err) {
    console.error('Error creando notificacion de cita:', err)
  }
}
