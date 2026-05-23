// app/api/parent-wellbeing/route.ts
// POST  → padre guarda su chequeo mensual (1 por mes por niño)
// GET   → staff/padre lee histórico para un niño

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MOODS_VALIDOS = ['bien', 'regular', 'dificil'] as const
type Mood = typeof MOODS_VALIDOS[number]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { parent_id, child_id, mood, nota } = body || {}

    if (!parent_id) return NextResponse.json({ error: 'parent_id requerido' }, { status: 400 })
    if (!child_id)  return NextResponse.json({ error: 'child_id requerido' },  { status: 400 })
    if (!MOODS_VALIDOS.includes(mood)) {
      return NextResponse.json({ error: 'mood inválido (bien|regular|dificil)' }, { status: 400 })
    }

    // Verificar que el child realmente pertenece a este parent
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, parent_id, name')
      .eq('id', child_id)
      .maybeSingle()

    if (!child) return NextResponse.json({ error: 'child no encontrado' }, { status: 404 })
    if (child.parent_id !== parent_id) {
      return NextResponse.json({ error: 'no autorizado para este niño' }, { status: 403 })
    }

    // ¿Ya respondió este mes para este niño? — actualizar en vez de duplicar
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const { data: existente } = await supabaseAdmin
      .from('parent_wellbeing_checkins')
      .select('id')
      .eq('parent_id', parent_id)
      .eq('child_id', child_id)
      .gte('created_at', inicioMes.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existente) {
      const { data, error } = await supabaseAdmin
        .from('parent_wellbeing_checkins')
        .update({ mood, nota: nota || null })
        .eq('id', existente.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data, updated: true })
    }

    const { data, error } = await supabaseAdmin
      .from('parent_wellbeing_checkins')
      .insert({ parent_id, child_id, mood, nota: nota || null })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ data, created: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const childId = searchParams.get('child_id')
    const parentId = searchParams.get('parent_id')
    const limit = Math.min(Number(searchParams.get('limit') || '12'), 50)

    if (!childId && !parentId) {
      return NextResponse.json({ error: 'child_id o parent_id requerido' }, { status: 400 })
    }

    let query = supabaseAdmin
      .from('parent_wellbeing_checkins')
      .select('id, parent_id, child_id, mood, nota, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (childId)  query = query.eq('child_id', childId)
    if (parentId) query = query.eq('parent_id', parentId)

    const { data, error } = await query
    if (error) {
      // Si la tabla no existe (42P01) o cualquier otro error de schema → devolver vacío
      // en lugar de 500, para que el dashboard del padre no se rompa.
      if (error.code === '42P01' || /does not exist|relation/.test(String(error.message))) {
        console.warn('[parent-wellbeing] tabla parent_wellbeing_checkins no existe, devolviendo vacío')
        return NextResponse.json({ data: [], _warning: 'tabla no inicializada' })
      }
      throw error
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 500 })
  }
}
