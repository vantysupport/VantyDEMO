// app/api/secretaria/appointments/route.ts
// Notifica al PADRE (in-app + WhatsApp + EMAIL + CALENDAR) Y al ADMIN (in-app + EMAIL)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync, notifyParentDirect } from '@/lib/notifications'
import { sendEmail, buildEmailCita, buildEmailAdmin } from '@/lib/email'

const CENTRO_EMAIL = 'contacto@santi.com'
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL || 'https://taller-jugando-aprendo.vercel.app'

// ── Sincronizar cita al calendario (Google o Microsoft) del admin ─────────────
async function sincronizarCalendario(apt: any, childName: string) {
  try {
    // Buscar el admin que tiene Google Calendar o Microsoft Calendar conectado
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, google_calendar_token, microsoft_calendar_token')
      .in('role', ['admin', 'jefe'])

    if (!admins || admins.length === 0) return

    for (const admin of admins) {
      // Google Calendar
      if (admin.google_calendar_token) {
        const res = await fetch(`${APP_URL}/api/google-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:        'sync-appointment',
            userId:        admin.id,
            appointmentId: apt.id,
            appointment: {
              date:        apt.appointment_date,
              time:        apt.appointment_time?.slice(0, 5),
              patientName: childName,
              serviceType: apt.service_type || 'Terapia',
              notes:       apt.notes || '',
              modality:    apt.modalidad || 'presencial',
              sessionType: apt.is_group ? 'grupal' : 'individual',
              childId:     apt.child_id,
              videoLink:   apt.video_link || '',
            },
          }),
        })
        const data = await res.json()
        console.log(`[Calendar] Google → ${data.ok ? '✅' : '❌'}`, data.error || '')
        break // solo el primer admin con Google Calendar
      }

      // Microsoft Calendar
      if (admin.microsoft_calendar_token) {
        const res = await fetch(`${APP_URL}/api/microsoft-calendar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:        'sync-appointment',
            userId:        admin.id,
            appointmentId: apt.id,
            appointment: {
              date:        apt.appointment_date,
              time:        apt.appointment_time?.slice(0, 5),
              patientName: childName,
              serviceType: apt.service_type || 'Terapia',
              notes:       apt.notes || '',
              modality:    apt.modalidad || 'presencial',
              sessionType: apt.is_group ? 'grupal' : 'individual',
              childId:     apt.child_id,
              videoLink:   apt.video_link || '',
            },
          }),
        })
        const data = await res.json()
        console.log(`[Calendar] Microsoft → ${data.ok ? '✅' : '❌'}`, data.error || '')
        break
      }
    }
  } catch (e) {
    console.error('[Calendar] Error sincronizando:', e)
  }
}

async function crearNotifInApp(userId: string, payload: {
  tipo: string; titulo: string; mensaje: string; prioridad?: number; metadata?: Record<string, any>
}) {
  try {
    await supabaseAdmin.from('notificaciones').insert({
      user_id: userId, tipo: payload.tipo, titulo: payload.titulo,
      mensaje: payload.mensaje, prioridad: payload.prioridad ?? 2,
      canal: 'in_app', leida: false, metadata: payload.metadata || {},
    })
  } catch (e) { console.error('[notif] error insertando notificacion:', e) }
}

async function notificarPadre(childId: string, tipo: 'nueva' | 'cancelada' | 'actualizada', apt: any) {
  try {
    const { data: child } = await supabaseAdmin
      .from('children').select('name, parent_id').eq('id', childId).maybeSingle()
    if (!child?.parent_id) return

    const childName = child.name || 'su hijo/a'
    const fecha     = apt.appointment_date || ''
    const hora      = apt.appointment_time?.slice(0, 5) || ''
    const servicio  = apt.service_type || 'Terapia'

    const mensajes = {
      nueva:       { titulo: '📅 Nueva cita programada',  mensaje: `Se programó una cita para ${childName} el ${fecha} a las ${hora}. Servicio: ${servicio}. ¡Te esperamos!` },
      cancelada:   { titulo: '❌ Cita cancelada',          mensaje: `La cita de ${childName} del ${fecha} a las ${hora} fue cancelada. Contactá al centro para reprogramar.` },
      actualizada: { titulo: '🔄 Cita actualizada',        mensaje: `La cita de ${childName} fue actualizada: ${fecha} a las ${hora}. Servicio: ${servicio}.` },
    }

    await crearNotifInApp(child.parent_id, {
      tipo: `cita_${tipo}`, titulo: mensajes[tipo].titulo, mensaje: mensajes[tipo].mensaje,
      prioridad: tipo === 'cancelada' ? 1 : 2,
      metadata: { appointment_id: apt.id, fecha, hora },
    })

    const { data: parentProfile } = await supabaseAdmin
      .from('profiles')
      .select('phone, email, wsp_notif, google_calendar_email, microsoft_calendar_email')
      .eq('id', child.parent_id)
      .maybeSingle()

    const citaVars = {
      paciente: childName, fecha, hora, servicio,
      modalidad: apt.modalidad || 'Presencial',
      ...(apt.video_link ? { link: apt.video_link } : {}),
    }

    // EMAIL al padre
    const emailPadre = (!parentProfile?.email || parentProfile.email.includes('@prueba'))
      ? (parentProfile?.google_calendar_email || parentProfile?.microsoft_calendar_email || null)
      : parentProfile.email

    const { subject, html } = buildEmailCita(tipo, citaVars)
    if (emailPadre) await sendEmail(emailPadre, subject, html)
    await sendEmail(CENTRO_EMAIL, subject, html)

    // WhatsApp
    const wspTipo = tipo === 'cancelada' ? 'cita_cancelada' : 'cita_confirmada'
    const wspVars = { fecha, hora, paciente: childName, tipo: apt.modalidad || servicio, ...(apt.video_link ? { link: apt.video_link } : {}) }
    notifyAsync({ tipo: wspTipo, vars: wspVars })
    try {
      if (parentProfile?.wsp_notif !== false) {
        await notifyParentDirect(parentProfile?.phone ?? null, wspTipo, wspVars)
      }
    } catch { /* silencioso */ }

  } catch (e) { console.error('[notif padre] error:', e) }
}

async function notificarAdmins(accion: string, apt: any, childName: string, secretariaName: string) {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles').select('id, full_name, email, google_calendar_email, microsoft_calendar_email').in('role', ['admin', 'jefe'])
    if (!admins || admins.length === 0) return

    const fecha = apt.appointment_date || ''
    const hora  = apt.appointment_time?.slice(0, 5) || ''
    const accionLabels: Record<string, string> = {
      created: 'Nueva cita creada', updated: 'Cita actualizada',
      cancelled: 'Cita cancelada',  status_changed: 'Estado de cita cambiado',
    }
    const accionMap: Record<string, 'nueva' | 'actualizada' | 'cancelada'> = {
      created: 'nueva', updated: 'actualizada', cancelled: 'cancelada', status_changed: 'actualizada',
    }
    const label = accionLabels[accion] || 'Cambio en cita'

    for (const admin of admins) {
      await crearNotifInApp(admin.id, {
        tipo: `admin_secretaria_${accion}`,
        titulo: `${label} — ${childName}`,
        mensaje: `La secretaria ${secretariaName} registró: ${label.toLowerCase()} para ${childName} el ${fecha} a las ${hora}. Servicio: ${apt.service_type || 'Terapia'}.`,
        prioridad: accion === 'cancelled' ? 1 : 2,
        metadata: { appointment_id: apt.id, secretaria: secretariaName, accion },
      })

      const adminEmail = (!admin.email || admin.email.includes('@prueba'))
        ? (admin.google_calendar_email || admin.microsoft_calendar_email || null)
        : admin.email

      const { subject, html } = buildEmailAdmin(accionMap[accion] ?? 'actualizada', {
        paciente: childName, fecha, hora,
        servicio: apt.service_type || 'Terapia',
        secretaria: secretariaName,
      })
      if (adminEmail) await sendEmail(adminEmail, subject, html)
      if (adminEmail !== CENTRO_EMAIL) await sendEmail(CENTRO_EMAIL, subject, html)
    }
  } catch (e) { console.error('[notif admin] error:', e) }
}

// ── POST — crear cita ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { secretaria_name, ...aptPayload } = body

    // Generar link Jitsi si es virtual (igual que el admin)
    if (aptPayload.modalidad === 'virtual' && !aptPayload.video_link) {
      const tempId = crypto.randomUUID()
      const fecha  = (aptPayload.appointment_date || '').replace(/-/g, '-')
      const hora   = (aptPayload.appointment_time || '').slice(0, 5).replace(':', '-')
      aptPayload.video_link = `https://meet.jit.si/SantiMeet-${tempId}-${fecha}-${hora}`
    }

    const { data: apt, error } = await supabaseAdmin
      .from('appointments').insert(aptPayload).select('*, children(name)').single()
    if (error) throw error
    const childName = (apt as any).children?.name || 'Paciente'

    await Promise.all([
      notificarPadre(apt.child_id, 'nueva', apt),
      notificarAdmins('created', apt, childName, secretaria_name || 'Secretaria'),
      sincronizarCalendario(apt, childName), // ← agrega al Google/Outlook del admin y del padre
    ])

    return NextResponse.json({ data: apt })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ── PATCH — actualizar cita ───────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, secretaria_name, accion, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const { data: apt, error } = await supabaseAdmin
      .from('appointments').update(updates).eq('id', id).select('*, children(name)').single()
    if (error) throw error
    const childName = (apt as any).children?.name || 'Paciente'
    const tipo = accion === 'status_changed' && updates.status === 'cancelled' ? 'cancelada' : 'actualizada'

    await Promise.all([
      notificarPadre(apt.child_id, tipo, apt),
      notificarAdmins(accion || 'updated', apt, childName, secretaria_name || 'Secretaria'),
    ])

    return NextResponse.json({ data: apt })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ── DELETE — cancelar cita ────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, secretaria_name } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const { data: apt } = await supabaseAdmin
      .from('appointments').select('*, children(name)').eq('id', id).maybeSingle()
    const { error } = await supabaseAdmin.from('appointments').delete().eq('id', id)
    if (error) throw error
    if (apt) {
      const childName = (apt as any).children?.name || 'Paciente'
      await Promise.all([
        notificarPadre(apt.child_id, 'cancelada', apt),
        notificarAdmins('cancelled', apt, childName, secretaria_name || 'Secretaria'),
      ])
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
