// app/api/evaluacion-inicial/route.ts
// Endpoint principal del flujo de Evaluación Inicial.
//
// GET    ?child_id=...           → obtiene la evaluación del paciente (la última)
// GET    ?id=...                 → obtiene una evaluación por id (con servicios)
// POST   { child_id, respuestas }→ crea/actualiza la evaluación con el intake del padre
// PATCH  { id, ...campos }       → actualiza campos puntuales (admin)
// DELETE ?id=...                 → elimina una evaluación (admin)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAuditEvent } from '@/lib/audit-log'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── GET ───────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    const childId = searchParams.get('child_id')

    if (id) {
      const { data: eval_, error } = await supabaseAdmin
        .from('evaluaciones_iniciales')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!eval_) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })

      const { data: servicios } = await supabaseAdmin
        .from('evaluacion_servicios')
        .select('*')
        .eq('evaluacion_id', id)
        .eq('activo', true)
        .order('orden', { ascending: true })

      return NextResponse.json({ ok: true, evaluacion: eval_, servicios: servicios || [] })
    }

    if (childId) {
      const { data: eval_, error } = await supabaseAdmin
        .from('evaluaciones_iniciales')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error

      if (!eval_) return NextResponse.json({ ok: true, evaluacion: null, servicios: [] })

      const { data: servicios } = await supabaseAdmin
        .from('evaluacion_servicios')
        .select('*')
        .eq('evaluacion_id', eval_.id)
        .eq('activo', true)
        .order('orden', { ascending: true })

      return NextResponse.json({ ok: true, evaluacion: eval_, servicios: servicios || [] })
    }

    return NextResponse.json({ error: 'Falta id o child_id' }, { status: 400 })
  } catch (e: any) {
    console.error('[evaluacion-inicial][GET]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── POST (intake del padre) ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { child_id, parent_id, respuestas } = body

    if (!child_id || !respuestas) {
      return NextResponse.json({ error: 'child_id y respuestas son obligatorios' }, { status: 400 })
    }

    // Verificar que existe el child
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, name, parent_id')
      .eq('id', child_id)
      .maybeSingle()
    if (!child) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const parentIdFinal = parent_id || (child as any).parent_id || null

    // Buscar evaluación existente (si ya hizo intake antes)
    const { data: existente } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('id, estado')
      .eq('child_id', child_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const ahora = new Date().toISOString()

    if (existente) {
      // Actualizar la existente
      const { data: updated, error } = await supabaseAdmin
        .from('evaluaciones_iniciales')
        .update({
          respuestas_intake: respuestas,
          intake_completado_en: ahora,
          estado: 'analizando',
          updated_at: ahora,
        })
        .eq('id', existente.id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ ok: true, evaluacion: updated, created: false })
    }

    // Crear nueva evaluación
    const { data: nueva, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .insert({
        child_id,
        parent_id: parentIdFinal,
        respuestas_intake: respuestas,
        intake_completado_en: ahora,
        estado: 'analizando',
      })
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, evaluacion: nueva, created: true })
  } catch (e: any) {
    console.error('[evaluacion-inicial][POST]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── PATCH (admin actualiza estado / asigna especialista / documento) ────
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...campos } = body
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const permitidos = [
      'estado',
      'recomendacion',
      'recomendacion_razon',
      'recomendacion_resumen',
      'recomendacion_areas',
      'especialista_asignado_id',
      'asignado_en',
      'documento_url',
      'documento_md',
      // Permite al admin editar la selección de terapias hecha por el padre
      'terapias_seleccionadas',
      'nota_cambio_terapias',
      'terapias_cambiadas_por_admin',
    ]
    const patch: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const k of Object.keys(campos)) {
      if (permitidos.includes(k)) patch[k] = campos[k]
    }

    const { data, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    return NextResponse.json({ ok: true, evaluacion: data })
  } catch (e: any) {
    console.error('[evaluacion-inicial][PATCH]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    // Cargar info para el audit log antes de borrar
    const { data: evalToDelete } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('id, child_id, estado, parent_id')
      .eq('id', id).maybeSingle()

    const { error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .delete()
      .eq('id', id)
    if (error) throw error

    // Audit log (best-effort)
    await logAuditEvent({
      action: 'delete',
      resource_type: 'evaluacion',
      resource_id: id,
      child_id: evalToDelete?.child_id || null,
      description: 'Evaluación inicial eliminada por admin',
      metadata: { estado_previo: evalToDelete?.estado, parent_id: evalToDelete?.parent_id },
      req,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[evaluacion-inicial][DELETE]', e)
    await logAuditEvent({
      action: 'delete',
      resource_type: 'evaluacion',
      resource_id: new URL(req.url).searchParams.get('id') || undefined,
      description: 'Intento fallido de eliminar evaluación inicial',
      success: false,
      errorMessage: e?.message,
      req,
    })
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
