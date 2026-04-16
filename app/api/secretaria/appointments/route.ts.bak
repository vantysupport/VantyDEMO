// app/api/secretaria/appointments/route.ts
// API exclusiva para secretaria: crea/actualiza/elimina citas
// y notifica al PADRE (in-app + Telegram/WhatsApp) Y al ADMIN
// SIN integraciones Google Calendar / Microsoft Calendar

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync } from '@/lib/notifications'

// ── Helper: crear notificación in-app para un usuario ─────────────────────────
async function crearNotifInApp(userId: string, payload: {
  tipo: string
  titulo: string
  mensaje: string
  prioridad?: number
  metadata?: Record<string, any>
}) {
  try {
    await supabaseAdmin.from('notificaciones').insert({
      user_id: userId,
      tipo: payload.tipo,
      titulo: payload.titulo,
      mensaje: payload.mensaje,
      prioridad: payload.prioridad ?? 2,
      canal: 'in_app',
      leida: false,
      metadata: payload.metadata || {},
    })
  } catch (e) {
    console.error('[notif] error insertando notificacion:', e)
  }
}

// ── Helper: notificar al padre del niño ───────────────────────────────────────
async function notificarPadre(childId: string, tipo: 'nueva' | 'cancelada' | 'actualizada', apt: any) {
  try {
    // 1. Buscar parent_id del niño
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, parent_id')
      .eq('id', childId)
      .maybeSingle()

    if (!child?.parent_id) return

    const childName = child.name || 'su hijo/a'
    const fecha = apt.appointment_date || ''
    const hora  = apt.appointment_time?.slice(0, 5) || ''
    const servicio = apt.service_type || 'Terapia'

    const mensajes = {
      nueva: {
        titulo: '📅 Nueva cita programada',
        mensaje: `Se programó una cita para ${childName} el ${fecha} a las ${hora}. Servicio: ${servicio}. ¡Te esperamos!`,
      },
      cancelada: {
        titulo: '❌ Cita cancelada',
        mensaje: `La cita de ${childName} del ${fecha} a las ${hora} fue cancelada. Contactá al centro para reprogramar.`,
      },
      actualizada: {
        titulo: '🔄 Cita actualizada',
        mensaje: `La cita de ${childName} fue actualizada: ${fecha} a las ${hora}. Servicio: ${servicio}.`,
      },
    }

    const notif = mensajes[tipo]

    // 2. Notificación in-app al padre
    await crearNotifInApp(child.parent_id, {
      tipo: `cita_${tipo}`,
      titulo: notif.titulo,
      mensaje: notif.mensaje,
      prioridad: tipo === 'cancelada' ? 1 : 2,
      metadata: { appointment_id: apt.id, fecha, hora },
    })

    // 3. Telegram/WhatsApp al canal del admin (incluye datos del padre y paciente)
    notifyAsync({
      tipo: tipo === 'cancelada' ? 'cita_cancelada' : 'cita_confirmada',
      vars: {
        fecha,
        hora,
        paciente: childName,
        tipo: apt.modalidad || apt.service_type || 'Presencial',
      },
    })

    // 4. Intentar notificar directo al padre por WhatsApp si tiene número
    try {
      const { data: parentProfile } = await supabaseAdmin
        .from('profiles')
        .select('phone, wsp_notif')
        .eq('id', child.parent_id)
        .maybeSingle()

      if (parentProfile?.phone && parentProfile?.wsp_notif !== false) {
        const wspUrl = process.env.WSP_SERVICE_URL
        if (wspUrl) {
          const message = notif.mensaje
          await fetch(`${wspUrl}/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-service-secret': process.env.WSP_SERVICE_SECRET || '',
            },
            body: JSON.stringify({ to: parentProfile.phone, message }),
            signal: AbortSignal.timeout(6000),
          }).catch(() => {})
        }
      }
    } catch { /* silencioso */ }

  } catch (e) {
    console.error('[notif padre] error:', e)
  }
}

// ── Helper: notificar a todos los admins ──────────────────────────────────────
async function notificarAdmins(accion: string, apt: any, childName: string, secretariaName: string) {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'admin')

    if (!admins || admins.length === 0) return

    const fecha = apt.appointment_date || ''
    const hora  = apt.appointment_time?.slice(0, 5) || ''

    const accionLabels: Record<string, string> = {
      created:        'Nueva cita creada',
      updated:        'Cita actualizada',
      cancelled:      'Cita cancelada',
      status_changed: 'Estado de cita cambiado',
    }
    const label = accionLabels[accion] || 'Cambio en cita'

    for (const admin of admins) {
      await crearNotifInApp(admin.id, {
        tipo: `admin_secretaria_${accion}`,
        titulo: `${label} — ${childName}`,
        mensaje: `La secretaria ${secretariaName} registró: ${label.toLowerCase()} para ${childName} el ${fecha} a las ${hora}. Servicio: ${apt.service_type || 'Terapia'}.`,
        prioridad: accion === 'cancelled' ? 1 : 2,
        metadata: {
          appointment_id: apt.id,
          secretaria: secretariaName,
          accion,
        },
      })
    }
  } catch (e) {
    console.error('[notif admin] error:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/secretaria/appointments — crear cita
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { secretaria_name, ...aptPayload } = body

    // 1. Insertar cita
    const { data: apt, error } = await supabaseAdmin
      .from('appointments')
      .insert(aptPayload)
      .select('*, children(name)')
      .single()

    if (error) throw error

    const childName = (apt as any).children?.name || 'Paciente'

    // 2. Notificar padre + admins (fire & forget)
    Promise.all([
      notificarPadre(apt.child_id, 'nueva', apt),
      notificarAdmins('created', apt, childName, secretaria_name || 'Secretaria'),
    ]).catch(() => {})

    return NextResponse.json({ data: apt })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/secretaria/appointments — actualizar cita
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, secretaria_name, accion, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const { data: apt, error } = await supabaseAdmin
      .from('appointments')
      .update(updates)
      .eq('id', id)
      .select('*, children(name)')
      .single()

    if (error) throw error

    const childName = (apt as any).children?.name || 'Paciente'
    const tipo = accion === 'status_changed' && updates.status === 'cancelled'
      ? 'cancelada'
      : accion === 'status_changed'
        ? 'actualizada'
        : 'actualizada'

    Promise.all([
      notificarPadre(apt.child_id, tipo, apt),
      notificarAdmins(accion || 'updated', apt, childName, secretaria_name || 'Secretaria'),
    ]).catch(() => {})

    return NextResponse.json({ data: apt })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/secretaria/appointments — eliminar cita
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, secretaria_name } = body

    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    // Leer la cita antes de borrar para tener los datos para la notificación
    const { data: apt } = await supabaseAdmin
      .from('appointments')
      .select('*, children(name)')
      .eq('id', id)
      .maybeSingle()

    const { error } = await supabaseAdmin.from('appointments').delete().eq('id', id)
    if (error) throw error

    if (apt) {
      const childName = (apt as any).children?.name || 'Paciente'
      Promise.all([
        notificarPadre(apt.child_id, 'cancelada', apt),
        notificarAdmins('cancelled', apt, childName, secretaria_name || 'Secretaria'),
      ]).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
