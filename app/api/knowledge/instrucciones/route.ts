// app/api/knowledge/instrucciones/route.ts
// ============================================================================
// API: Instrucciones del Centro — ARIA las incluye en cada análisis
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// ── GET: Listar instrucciones activas ──────────────────────────────────────
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('centro_instrucciones')
      .select('id, titulo, contenido, categoria, prioridad, activo, created_at')
      .eq('activo', true)
      .order('prioridad', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST: Crear nueva instrucción ──────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { titulo, contenido, categoria = 'protocolo', prioridad = 5 } = await request.json()

    if (!titulo || !contenido) {
      return NextResponse.json({ error: 'titulo y contenido son requeridos' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('centro_instrucciones')
      .insert({ titulo, contenido, categoria, prioridad, activo: true })
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, id: data.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── DELETE: Desactivar instrucción ─────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('centro_instrucciones')
      .update({ activo: false })
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
