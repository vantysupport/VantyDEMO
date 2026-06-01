// app/api/evaluacion-inicial/servicios/route.ts
// CRUD de servicios asociados a una evaluación inicial.
//
// GET    ?evaluacion_id=...   → lista servicios de esa evaluación
// GET    ?catalogo=1          → lista catálogo global de plantillas
// POST   { evaluacion_id, ...campos }  → crea un servicio
// PATCH  { id, ...campos }    → actualiza
// DELETE ?id=...              → elimina (soft: activo=false) o hard si force=1

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    if (searchParams.get('catalogo')) {
      const { data, error } = await supabaseAdmin
        .from('evaluacion_servicios_catalogo')
        .select('*')
        .eq('activo', true)
        .order('tipo')
      if (error) throw error
      return NextResponse.json({ ok: true, catalogo: data || [] })
    }

    const evalId = searchParams.get('evaluacion_id')
    if (!evalId) return NextResponse.json({ error: 'evaluacion_id requerido' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('evaluacion_servicios')
      .select('*')
      .eq('evaluacion_id', evalId)
      .order('orden', { ascending: true })
    if (error) throw error

    return NextResponse.json({ ok: true, servicios: data || [] })
  } catch (e: any) {
    console.error('[servicios][GET]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { evaluacion_id, tipo, nombre, descripcion, por_que, precio, duracion, incluye, orden } = body

    if (!evaluacion_id || !nombre || !tipo) {
      return NextResponse.json({ error: 'evaluacion_id, tipo y nombre son obligatorios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('evaluacion_servicios')
      .insert({
        evaluacion_id,
        tipo,
        nombre,
        descripcion: descripcion ?? null,
        por_que: por_que ?? null,
        precio: precio ?? null,
        duracion: duracion ?? null,
        incluye: incluye ?? null,
        orden: orden ?? 0,
        activo: true,
      })
      .select()
      .single()
    if (error) throw error

    // Si la evaluación estaba en 'recomendado', pasarla a 'servicios_listos'
    await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({ estado: 'servicios_listos', updated_at: new Date().toISOString() })
      .eq('id', evaluacion_id)
      .eq('estado', 'recomendado')

    return NextResponse.json({ ok: true, servicio: data })
  } catch (e: any) {
    console.error('[servicios][POST]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...campos } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const permitidos = ['tipo', 'nombre', 'descripcion', 'por_que', 'precio', 'duracion', 'incluye', 'orden', 'activo']
    const patch: Record<string, any> = {}
    for (const k of Object.keys(campos)) {
      if (permitidos.includes(k)) patch[k] = campos[k]
    }

    const { data, error } = await supabaseAdmin
      .from('evaluacion_servicios')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, servicio: data })
  } catch (e: any) {
    console.error('[servicios][PATCH]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const force = searchParams.get('force') === '1'

    if (force) {
      const { error } = await supabaseAdmin
        .from('evaluacion_servicios')
        .delete()
        .eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('evaluacion_servicios')
        .update({ activo: false })
        .eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[servicios][DELETE]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
