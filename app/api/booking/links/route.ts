// app/api/booking/links/route.ts
// Gestión de links de reserva.
// GET  → lista links (opcional ?token= para uno; ?child_id= para filtrar).
// POST → crea un link nuevo. Devuelve el token/URL.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function genToken(): string {
  // token corto, legible, no adivinable
  return (
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  ).toUpperCase()
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const childId = searchParams.get('child_id')

    if (token) {
      // Carga pública del link (para la página de reserva) — incluye datos del paciente/especialista
      const { data: link, error } = await supabaseAdmin
        .from('booking_links').select('*').eq('token', token).maybeSingle()
      if (error) throw error
      if (!link) return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 })

      let childName: string | null = null
      let specialistName: string | null = null
      if (link.child_id) {
        const { data: c } = await supabaseAdmin.from('children').select('name').eq('id', link.child_id).maybeSingle()
        childName = (c as any)?.name || null
      }
      if (link.specialist_id) {
        const { data: s } = await supabaseAdmin.from('profiles').select('full_name, specialty').eq('id', link.specialist_id).maybeSingle()
        specialistName = (s as any)?.full_name || null
      }
      return NextResponse.json({ ok: true, link, childName, specialistName })
    }

    let q = supabaseAdmin.from('booking_links').select('*').order('created_at', { ascending: false }).limit(100)
    if (childId) q = q.eq('child_id', childId)
    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true, links: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      child_id, specialist_id, max_slots, plan_type,
      service_type, modalidad, notas, expires_in_days, created_by,
    } = body

    const token = genToken()
    const expires_at = expires_in_days
      ? new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 días por defecto

    const { data, error } = await supabaseAdmin.from('booking_links').insert({
      token,
      child_id: child_id || null,
      specialist_id: specialist_id || null,
      max_slots: Math.max(1, Number(max_slots) || 1),
      plan_type: plan_type || 'individual',
      service_type: service_type || 'Terapia',
      modalidad: modalidad || 'presencial',
      notas: notas || null,
      expires_at,
      created_by: created_by || null,
    }).select().single()
    if (error) throw error

    return NextResponse.json({ ok: true, link: data, token })
  } catch (e: any) {
    console.error('[booking/links][POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH → desactivar / reactivar un link
export async function PATCH(req: NextRequest) {
  try {
    const { id, active } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const { error } = await supabaseAdmin.from('booking_links').update({ active }).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE → eliminar un link permanentemente
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const { error } = await supabaseAdmin.from('booking_links').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
