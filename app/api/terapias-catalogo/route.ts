// app/api/terapias-catalogo/route.ts
// CRUD del catálogo global de terapias del centro.
// GET → lista terapias activas (público para autenticados)
// POST/PATCH/DELETE → admin solamente

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('all') === '1'

    let q = supabaseAdmin.from('terapias_catalogo').select('*').order('orden', { ascending: true })
    if (!includeInactive) q = q.eq('activo', true)

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true, terapias: data || [] })
  } catch (e: any) {
    console.error('[terapias-catalogo][GET]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      nombre, descripcion, por_que, imagen_url, precio, moneda,
      duracion, modalidad, categoria, orden, color_tema,
    } = body

    if (!nombre?.trim()) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('terapias_catalogo')
      .insert({
        nombre: nombre.trim(),
        descripcion: descripcion ?? null,
        por_que: por_que ?? null,
        imagen_url: imagen_url ?? null,
        precio: precio ?? null,
        moneda: moneda ?? 'PEN',
        duracion: duracion ?? null,
        modalidad: modalidad ?? 'presencial',
        categoria: categoria ?? null,
        color_tema: color_tema ?? 'indigo',
        orden: orden ?? 0,
        activo: true,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, terapia: data })
  } catch (e: any) {
    console.error('[terapias-catalogo][POST]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...campos } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const permitidos = ['nombre', 'descripcion', 'por_que', 'imagen_url', 'precio', 'moneda',
                        'duracion', 'modalidad', 'categoria', 'orden', 'activo', 'color_tema']
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const k of Object.keys(campos)) {
      if (permitidos.includes(k)) patch[k] = campos[k]
    }

    const { data, error } = await supabaseAdmin
      .from('terapias_catalogo')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, terapia: data })
  } catch (e: any) {
    console.error('[terapias-catalogo][PATCH]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const force = searchParams.get('force') === '1'
    if (force) {
      const { error } = await supabaseAdmin.from('terapias_catalogo').delete().eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin.from('terapias_catalogo').update({ activo: false }).eq('id', id)
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[terapias-catalogo][DELETE]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
