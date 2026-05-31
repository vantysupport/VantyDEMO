// app/api/booking/reserve/route.ts
// Confirma la reserva de uno o más horarios desde un link.
// POST { token, parentUserId, childId?, slots: [{fecha, time}] }
//   → crea appointments (aparecen en la agenda de todos) e incrementa slots_used.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { token, parentUserId, childId, slots } = await req.json()
    if (!token) return NextResponse.json({ error: 'token requerido' }, { status: 400 })
    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: 'Selecciona al menos un horario' }, { status: 400 })
    }

    const { data: link } = await supabaseAdmin
      .from('booking_links').select('*').eq('token', token).maybeSingle()
    if (!link) return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })
    if (!link.active) return NextResponse.json({ error: 'Este link ya no está activo.' }, { status: 410 })
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este link de reserva ya venció.' }, { status: 410 })
    }

    const restantes = link.max_slots - link.slots_used
    if (slots.length > restantes) {
      return NextResponse.json({ error: `Solo podés reservar ${restantes} cita(s) más con este link.` }, { status: 400 })
    }

    // Determinar el paciente: el del link, o el que pasa el padre (validando que sea suyo)
    let finalChildId = link.child_id || childId
    if (!finalChildId) {
      return NextResponse.json({ error: 'Falta indicar el paciente.' }, { status: 400 })
    }
    // Validar que el paciente pertenezca al padre (si vino parentUserId)
    if (parentUserId && !link.child_id) {
      const { data: child } = await supabaseAdmin
        .from('children').select('id, parent_id').eq('id', finalChildId).maybeSingle()
      if (!child || (child as any).parent_id !== parentUserId) {
        return NextResponse.json({ error: 'No tenés permiso para reservar para este paciente.' }, { status: 403 })
      }
    }

    // Re-validar disponibilidad (anti doble-reserva)
    const fechas = [...new Set(slots.map((s: any) => s.fecha))]
    const { data: existentes } = await supabaseAdmin
      .from('appointments')
      .select('appointment_date, appointment_time, specialist_id, status')
      .in('appointment_date', fechas as string[])
    const ocupados = new Set<string>()
    for (const a of (existentes || [])) {
      if (a.status === 'cancelled' || a.status === 'cancelada') continue
      if (link.specialist_id && a.specialist_id && a.specialist_id !== link.specialist_id) continue
      ocupados.add(`${a.appointment_date}_${String(a.appointment_time || '').slice(0, 5)}`)
    }
    const colision = slots.find((s: any) => ocupados.has(`${s.fecha}_${s.time}`))
    if (colision) {
      return NextResponse.json({
        error: `El horario ${colision.time} del ${colision.fecha} acaba de ser tomado. Elegí otro.`,
      }, { status: 409 })
    }

    // Crear las citas
    const rows = slots.map((s: any) => ({
      child_id: finalChildId,
      specialist_id: link.specialist_id || null,
      appointment_date: s.fecha,
      appointment_time: `${s.time}:00`,
      service_type: link.service_type || 'Terapia',
      modalidad: link.modalidad || 'presencial',
      status: 'confirmed',
      is_group: false,
      notes: `Reserva online${link.plan_type ? ` · ${link.plan_type}` : ''}${link.notas ? ` · ${link.notas}` : ''}`,
      reservado_online: true,
    }))

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('appointments').insert(rows).select('id, appointment_date, appointment_time')
    if (insErr) {
      // Si falla por columna reservado_online inexistente, reintentar sin ella
      if (/reservado_online/.test(insErr.message)) {
        const rows2 = rows.map(({ reservado_online, ...r }) => r)
        const { data: ins2, error: e2 } = await supabaseAdmin
          .from('appointments').insert(rows2).select('id, appointment_date, appointment_time')
        if (e2) throw e2
        await supabaseAdmin.from('booking_links')
          .update({ slots_used: link.slots_used + slots.length }).eq('id', link.id)
        return NextResponse.json({ ok: true, citas: ins2 })
      }
      throw insErr
    }

    // Incrementar contador del link
    await supabaseAdmin.from('booking_links')
      .update({ slots_used: link.slots_used + slots.length }).eq('id', link.id)

    return NextResponse.json({ ok: true, citas: inserted })
  } catch (e: any) {
    console.error('[booking/reserve]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
