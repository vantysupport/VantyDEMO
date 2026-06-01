// app/api/appointments/notify-admin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, appointment, childName, secretariaName } = body

    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('role', 'admin')

    const adminIds = (admins || []).map((a: any) => a.id).filter(Boolean)

    const actionLabels: Record<string, string> = {
      created: 'Nueva cita creada',
      updated: 'Cita actualizada',
      cancelled: 'Cita cancelada',
      status_changed: 'Estado de cita cambiado',
    }
    const label = actionLabels[action] || 'Cambio en cita'

    notifyAsync({
      tipo: action === 'cancelled' ? 'cita_cancelada' : 'cita_confirmada',
      vars: {
        fecha: appointment?.appointment_date || '',
        hora: appointment?.appointment_time?.slice(0, 5) || '',
        paciente: childName || 'Paciente',
        tipo: appointment?.service_type || 'Terapia',
        secretaria: secretariaName || 'Secretaria',
        accion: label,
      },
    })

    if (adminIds.length > 0) {
      const dateFormatted = appointment?.appointment_date
        ? new Date(appointment.appointment_date + 'T12:00:00').toLocaleDateString('es', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })
        : ''
      const timeFormatted = appointment?.appointment_time?.slice(0, 5) || ''

      const notifs = adminIds.map((adminId: string) => ({
        user_id: adminId,
        tipo: 'admin_' + action,
        titulo: `${label} — ${childName}`,
        mensaje: `${secretariaName} registró: ${label.toLowerCase()} para ${childName} el ${dateFormatted} a las ${timeFormatted}. Servicio: ${appointment?.service_type || 'Terapia'}.`,
        prioridad: action === 'cancelled' ? 1 : 2,
        canal: 'in_app',
        metadata: { appointment_id: appointment?.id, action, secretaria: secretariaName },
        leida: false,
      }))

      await supabaseAdmin.from('notificaciones').insert(notifs)
    }

    return NextResponse.json({ ok: true, notified: adminIds.length })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
