// app/api/admin/documentos-emitidos/route.ts
//
// Lista documentos emitidos por el sistema, con filtros opcionales.
// Usado por el panel admin "Reportes IA" para mostrar el historial.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { invalidarDocumento } from '@/lib/registrar-documento'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const childId = searchParams.get('child_id')
    const tipo    = searchParams.get('tipo')
    const q       = searchParams.get('q')        // búsqueda por código o paciente
    const valido  = searchParams.get('valido')   // '1' | '0' | null
    const limit   = Math.min(Number(searchParams.get('limit') || '100'), 500)

    let query = supabaseAdmin
      .from('documentos_emitidos')
      .select('codigo_doc, child_id, tipo, tipo_label, paciente_nombre, paciente_iniciales, fecha_emision, especialista, valido, file_name, metadata, notas')
      .order('fecha_emision', { ascending: false })
      .limit(limit)

    if (childId)        query = query.eq('child_id', childId)
    if (tipo)           query = query.eq('tipo', tipo)
    if (valido === '1') query = query.eq('valido', true)
    if (valido === '0') query = query.eq('valido', false)
    if (q) {
      // OR sobre código o nombre del paciente
      query = query.or(`codigo_doc.ilike.%${q}%,paciente_nombre.ilike.%${q}%,file_name.ilike.%${q}%`)
    }

    const { data, error } = await query
    if (error) throw error

    // Conteo agregado por tipo (para el header de estadísticas)
    const { data: stats } = await supabaseAdmin
      .from('documentos_emitidos')
      .select('tipo, valido')
      .limit(5000)

    const conteoPorTipo: Record<string, number> = {}
    let totalValidos = 0
    let totalInvalidos = 0
    for (const r of (stats || [])) {
      const t = (r as any).tipo as string
      conteoPorTipo[t] = (conteoPorTipo[t] || 0) + 1
      if ((r as any).valido) totalValidos++
      else totalInvalidos++
    }

    return NextResponse.json({
      ok: true,
      documentos: data || [],
      total: (data || []).length,
      stats: {
        total_validos: totalValidos,
        total_invalidos: totalInvalidos,
        por_tipo: conteoPorTipo,
      },
    })
  } catch (e: any) {
    console.error('[documentos-emitidos][GET]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// Invalidar un documento (admin) — soft delete (queda en BD pero marcado como inválido)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { codigo_doc, motivo } = body
    if (!codigo_doc) {
      return NextResponse.json({ error: 'codigo_doc requerido' }, { status: 400 })
    }
    await invalidarDocumento(codigo_doc, motivo)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// Eliminar definitivamente un documento del historial (hard delete)
//   El QR del .docx ya impreso seguirá apuntando a /verificar/<codigo> pero
//   la página mostrará "Código no encontrado" porque ya no existe en BD.
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const codigo = searchParams.get('codigo_doc')
    if (!codigo) {
      return NextResponse.json({ error: 'codigo_doc requerido' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('documentos_emitidos')
      .delete()
      .eq('codigo_doc', codigo)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
