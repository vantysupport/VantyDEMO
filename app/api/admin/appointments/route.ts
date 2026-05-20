import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync, notifyParentDirect } from '@/lib/notifications'

// Helper: notificar al padre de un paciente
async function notificarPadre(childId: string, tipo: 'cita_confirmada' | 'cita_cancelada', vars: Record<string, string>) {
  try {
    const { data: parentLink } = await supabaseAdmin
      .from('parent_accounts').select('user_id').eq('child_id', childId).maybeSingle()
    if (parentLink?.user_id) {
      const { data: parentProf } = await supabaseAdmin
        .from('profiles').select('phone').eq('id', parentLink.user_id).maybeSingle()
      if ((parentProf as any)?.phone) {
        await notifyParentDirect((parentProf as any).phone, tipo, vars)
      }
    }
    // También notificar al admin del centro
    await notifyAsync({ tipo, vars })
  } catch (err) {
    console.error('[notificarPadre] Error:', err)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('appointments')
      .select('*, children(name, parent_id)')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const appointments = Array.isArray(body) ? body : [body]

    // Generar video_link para citas virtuales antes de insertar
    const appointmentsConLink = appointments.map((apt: any) => {
      if (apt.modalidad === 'virtual' && !apt.video_link && !apt.videoLink) {
        const tempId = `${apt.child_id}-${apt.appointment_date}-${(apt.appointment_time || '').replace(/:/g, '-')}`
        return { ...apt, video_link: `https://meet.jit.si/SantiMeet-${tempId}` }
      }
      return apt
    })

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .insert(appointmentsConLink)
      .select('*, children(name)')

    if (error) throw error

    // Notificar al padre — fire-and-forget para no bloquear la respuesta al cliente
    // (cada notificación puede tardar hasta 8 s por el timeout de Baileys)
    Promise.all(
      (data || []).map((apt: any) => {
        if (!apt.child_id) return Promise.resolve()
        const childName = apt.children?.name || 'Paciente'
        const fecha     = apt.appointment_date || ''
        const hora      = apt.appointment_time || ''
        const modalidad = apt.modalidad === 'virtual' ? 'Virtual 📹' : (apt.appointment_type || 'Presencial')
        const videoLink = apt.video_link || apt.videoLink || null
        return notificarPadre(apt.child_id, 'cita_confirmada', {
          fecha, hora, paciente: childName, tipo: modalidad,
          ...(videoLink ? { link: videoLink } : {}),
        })
      })
    ).catch(err => console.error('[notif fire-and-forget]', err))

    // Responder inmediatamente — las notificaciones corren en background
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, appointment_date, appointment_time, notes } = body
    if (!id) throw new Error('id es requerido')

    const updates: Record<string, any> = {}
    if (status !== undefined) updates.status = status
    if (appointment_date !== undefined) updates.appointment_date = appointment_date
    if (appointment_time !== undefined) {
      // Normaliza a HH:MM:SS
      const t = String(appointment_time)
      updates.appointment_time = t.length === 5 ? `${t}:00` : t
    }
    if (notes !== undefined) updates.notes = notes

    if (Object.keys(updates).length === 0) {
      throw new Error('No hay campos para actualizar')
    }

    const { data, error } = await supabaseAdmin
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    const locale = request.headers.get('x-locale') || 'es'

    // 1. Leer la cita ANTES de borrarla — necesitamos los event IDs y el especialista
    const { data: apt } = await supabaseAdmin
      .from('appointments')
      .select('id, google_calendar_event_id, microsoft_calendar_event_id, parent_google_calendar_event_id, parent_microsoft_calendar_event_id, created_by, child_id')
      .eq('id', id)
      .single()

    // 2. Borrar en Google Calendar si hay event ID
    if (apt?.google_calendar_event_id && apt?.created_by) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:  'delete-event',
            userId:  apt.created_by,
            eventId: apt.google_calendar_event_id,
          }),
        })
      } catch { /* silent — no bloquear el borrado de DB */ }
    }

    // 3. Borrar en Microsoft Calendar si hay event ID
    if (apt?.microsoft_calendar_event_id && apt?.created_by) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/microsoft-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:  'delete-event',
            userId:  apt.created_by,
            eventId: apt.microsoft_calendar_event_id,
          }),
        })
      } catch { /* silent */ }
    }

    // 4. Borrar eventos del PADRE en Google Calendar
    if (apt?.parent_google_calendar_event_id && apt?.child_id) {
      try {
        // Buscar parent_id del niño
        const { data: child } = await supabaseAdmin
          .from('children').select('parent_id').eq('id', apt.child_id).single()
        if (child?.parent_id) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/google-calendar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action:  'delete-event',
              userId:  child.parent_id,
              eventId: apt.parent_google_calendar_event_id,
            }),
          })
        }
      } catch { /* silent */ }
    }

    // 5. Borrar eventos del PADRE en Microsoft Calendar
    if (apt?.parent_microsoft_calendar_event_id && apt?.child_id) {
      try {
        const { data: child } = await supabaseAdmin
          .from('children').select('parent_id').eq('id', apt.child_id).single()
        if (child?.parent_id) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/microsoft-calendar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action:  'delete-event',
              userId:  child.parent_id,
              eventId: apt.parent_microsoft_calendar_event_id,
            }),
          })
        }
      } catch { /* silent */ }
    }

    // 5b. Notificar al padre SOLO si la cita no estaba ya completada/realizada
    // (borrar un historial completado no debe generar "cita cancelada")
    if (apt?.child_id) {
      try {
        const { data: childData } = await supabaseAdmin
          .from('appointments')
          .select('appointment_date, appointment_time, appointment_type, status, children(name)')
          .eq('id', id).maybeSingle()
        const aptStatus = (childData as any)?.status || ''
        const esCompletada = ['completed', 'realizada', 'done', 'completada'].includes(aptStatus)
        if (!esCompletada) {
          const childName = (childData as any)?.children?.name || 'Paciente'
          notificarPadre(apt.child_id, 'cita_cancelada', {
            fecha:    (childData as any)?.appointment_date || '',
            hora:     (childData as any)?.appointment_time || '',
            paciente: childName,
          })
        }
      } catch { /* silent */ }
    }

    // 6. Borrar la cita en DB
    const { error } = await supabaseAdmin.from('appointments').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
