// app/api/booking/slots/route.ts
// Calcula los horarios DISPONIBLES para un link de reserva.
// GET ?token=XXXX
//   → devuelve { dias: [{ fecha, label, slots: [{ time, label }] }] }
//   excluyendo: días cerrados, fuera de horario, slots pasados y los ya reservados.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const DIAS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
function minToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })

    const { data: link } = await supabaseAdmin
      .from('booking_links').select('*').eq('token', token).maybeSingle()
    if (!link) return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })
    if (!link.active) return NextResponse.json({ error: 'Este link ya no está activo.' }, { status: 410 })
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este link de reserva ya venció.' }, { status: 410 })
    }
    if (link.slots_used >= link.max_slots) {
      return NextResponse.json({ error: 'Este link ya completó todas sus reservas.' }, { status: 410 })
    }

    const { data: config } = await supabaseAdmin
      .from('booking_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()
    if (!config) return NextResponse.json({ error: 'El centro aún no configuró su disponibilidad.' }, { status: 400 })

    const dur = Number(config.session_duration_min) || 45
    const step = Number(config.slot_step_min) >= dur ? Number(config.slot_step_min) : dur
    const workingHours = config.working_hours || {}
    const closedDates: string[] = config.closed_dates || []
    const maxDays = Math.min(Number(config.max_advance_days) || 30, 60)

    // Citas ya reservadas en el rango (para excluir). Si el link tiene especialista,
    // bloqueamos por especialista; si no, bloqueamos globalmente.
    const hoy = new Date()
    const desde = hoy.toISOString().slice(0, 10)
    const hasta = new Date(hoy.getTime() + maxDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    let qApt = supabaseAdmin.from('appointments')
      .select('appointment_date, appointment_time, specialist_id, status')
      .gte('appointment_date', desde)
      .lte('appointment_date', hasta)
    const { data: apts } = await qApt
    const ocupados = new Set<string>()
    for (const a of (apts || [])) {
      if (a.status === 'cancelled' || a.status === 'cancelada') continue
      // Si el link tiene especialista, solo cuentan las citas de ESE especialista.
      // Si no, cualquier cita ocupa el horario (centro completo).
      if (link.specialist_id && a.specialist_id && a.specialist_id !== link.specialist_id) continue
      const time = String(a.appointment_time || '').slice(0, 5)
      ocupados.add(`${a.appointment_date}_${time}`)
    }

    const ahoraMin = hoy.getHours() * 60 + hoy.getMinutes()
    const dias: any[] = []

    for (let d = 0; d < maxDays; d++) {
      const fecha = new Date(hoy.getTime() + d * 24 * 60 * 60 * 1000)
      const fechaStr = fecha.toISOString().slice(0, 10)
      if (closedDates.includes(fechaStr)) continue

      const dow = fecha.getDay() // 0=domingo
      const cfgDia = workingHours[String(dow)]
      if (!cfgDia || !cfgDia.activo || !Array.isArray(cfgDia.bloques) || cfgDia.bloques.length === 0) continue

      // Cada rango se divide en turnos según la duración + descanso (paso = step).
      const slots: { time: string; label: string }[] = []
      for (const bloque of cfgDia.bloques) {
        if (!bloque?.inicio || !bloque?.fin) continue
        const ini = hhmmToMin(bloque.inicio)
        const fin = hhmmToMin(bloque.fin)
        for (let t = ini; t + dur <= fin; t += step) {
          const time = minToHHMM(t)
          // Excluir turnos pasados de hoy (al menos 30 min de anticipación)
          if (d === 0 && t <= ahoraMin + 30) continue
          // Excluir ocupados
          if (ocupados.has(`${fechaStr}_${time}`)) continue
          slots.push({ time, label: `${time} – ${minToHHMM(t + dur)}` })
        }
      }
      if (slots.length > 0) {
        dias.push({
          fecha: fechaStr,
          label: `${DIAS_ES[dow]} ${fecha.getDate()} de ${fecha.toLocaleDateString('es-ES', { month: 'long' })}`,
          slots,
        })
      }
    }

    return NextResponse.json({
      ok: true,
      dias,
      duracion: dur,
      maxSlots: link.max_slots,
      slotsUsados: link.slots_used,
      slotsRestantes: link.max_slots - link.slots_used,
      planType: link.plan_type,
      serviceType: link.service_type,
    })
  } catch (e: any) {
    console.error('[booking/slots]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
