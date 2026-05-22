// app/api/admin/delete-patient/route.ts
// Eliminación profunda de un paciente y todos sus datos relacionados.
//
// El DELETE directo desde el cliente fallaba con foreign-key constraint
// porque varias tablas referencian `children.id` SIN `ON DELETE CASCADE`.
// Este endpoint hace el borrado en el orden correcto: primero los dependientes,
// después el propio child.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Lista ordenada de tablas que referencian a children.id.
// El orden importa: primero las que dependen de programas_aba (sesiones_datos_aba
// vía programa_id → child_id), después el resto, finalmente el child.
const TABLAS_HIJAS_DIRECTAS = [
  // Citas y agenda
  'appointments',
  'agenda_sesiones',
  // Programas ABA — al borrar el programa, sus objetivos_cp y sesiones_datos_aba
  // deberían caer por cascada interna (si está configurado), si no, los borramos
  'sesiones_datos_aba',         // por seguridad, antes que programas_aba
  'objetivos_cp',                // idem
  'programas_aba',
  // Sesiones legacy
  'registro_aba',
  'aba_sessions_v2',
  // Comunicación
  'chat_familias',
  'chat_padres',
  'notifications',
  'parent_messages',
  // Clínica
  'clinical_template_responses',
  'anamnesis_completa',
  'form_responses',
  'parent_forms',
  'tareas_hogar',
  'registro_entorno_hogar',
  // Evaluaciones profesionales
  'evaluacion_brief2',
  'evaluacion_ados2',
  'evaluacion_vineland3',
  'evaluacion_wiscv',
  'evaluacion_basc3',
  // IA / análisis
  'agente_alertas',
  'predicciones_ia',
  'patrones_detectados',
  'engagement_planes',
  // Bienestar y reportes
  'parent_wellbeing_checkins',
  'reportes_generados',
  // Práctica casa (puede no existir aún en algunos ambientes)
  'practica_casa_registros',
]

export async function POST(req: NextRequest) {
  try {
    const { child_id, confirm_name } = await req.json()

    if (!child_id) {
      return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
    }

    // 1. Verificar que el paciente exista y obtener su nombre para confirmación
    const { data: child, error: childErr } = await supabaseAdmin
      .from('children')
      .select('id, name, parent_id')
      .eq('id', child_id)
      .maybeSingle()

    if (childErr) throw childErr
    if (!child) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
    }

    // 2. Si el paciente tiene cuenta de padre vinculada, requerir confirmación por nombre
    if ((child as any).parent_id) {
      if (!confirm_name || String(confirm_name).trim() !== String((child as any).name).trim()) {
        return NextResponse.json({
          error: 'El paciente tiene cuenta de padre vinculada. Debe confirmar escribiendo el nombre exacto.',
          requiresNameConfirmation: true,
          patientName: (child as any).name,
        }, { status: 400 })
      }
    }

    // 3. Borrar en cascada manual — tabla por tabla
    const resultado: Record<string, number | string> = {}
    let programaIds: string[] = []

    // Cargar IDs de programas para limpiar sesiones_datos_aba/objetivos_cp por programa_id también
    try {
      const { data: progs } = await supabaseAdmin
        .from('programas_aba')
        .select('id')
        .eq('child_id', child_id)
      programaIds = (progs || []).map((p: any) => p.id)
    } catch { /* tabla puede no existir */ }

    for (const tabla of TABLAS_HIJAS_DIRECTAS) {
      try {
        // Para sesiones_datos_aba y objetivos_cp filtramos por programa_id (no tienen child_id)
        if ((tabla === 'sesiones_datos_aba' || tabla === 'objetivos_cp') && programaIds.length > 0) {
          const { error, count } = await supabaseAdmin
            .from(tabla)
            .delete({ count: 'exact' })
            .in('programa_id', programaIds)
          if (error && !error.message.includes('does not exist')) {
            resultado[tabla] = `error: ${error.message}`
          } else {
            resultado[tabla] = count ?? 0
          }
          continue
        }

        // Resto: filtran por child_id directamente
        const { error, count } = await supabaseAdmin
          .from(tabla)
          .delete({ count: 'exact' })
          .eq('child_id', child_id)
        if (error) {
          // Si la tabla no existe en este ambiente, ignorar silenciosamente
          if (error.message.includes('does not exist') || error.code === '42P01') {
            resultado[tabla] = 'tabla no existe (skip)'
          } else {
            resultado[tabla] = `error: ${error.message}`
          }
        } else {
          resultado[tabla] = count ?? 0
        }
      } catch (e: any) {
        resultado[tabla] = `excepción: ${e?.message || 'desconocida'}`
      }
    }

    // 4. Finalmente borrar el child
    const { error: deleteErr } = await supabaseAdmin
      .from('children')
      .delete()
      .eq('id', child_id)

    if (deleteErr) {
      return NextResponse.json({
        error: `No se pudo eliminar el paciente final: ${deleteErr.message}`,
        detalle_limpieza: resultado,
      }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      deleted: child_id,
      patientName: (child as any).name,
      registros_limpiados: resultado,
    })
  } catch (e: any) {
    console.error('[delete-patient] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
