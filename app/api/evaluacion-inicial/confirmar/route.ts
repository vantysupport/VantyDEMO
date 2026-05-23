// app/api/evaluacion-inicial/confirmar/route.ts
// El padre acepta (o rechaza) la recomendación de la IA.
// Si acepta → estado 'confirmado', se desbloquea la segunda anamnesis.
// Si rechaza → estado 'rechazado', se notifica al especialista para contactarlo.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id, acepta, motivo_rechazo } = await req.json()
    if (!evaluacion_id) {
      return NextResponse.json({ error: 'evaluacion_id requerido' }, { status: 400 })
    }

    const ahora = new Date().toISOString()
    const patch: Record<string, any> = { updated_at: ahora }

    if (acepta) {
      patch.estado = 'confirmado'
      patch.confirmado_en = ahora
    } else {
      patch.estado = 'rechazado'
      patch.rechazado_en = ahora
      if (motivo_rechazo) patch.mensaje_al_especialista = motivo_rechazo
    }

    const { data, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update(patch)
      .eq('id', evaluacion_id)
      .select('*, children:child_id (id, name, parent_id)')
      .single()
    if (error) throw error

    // Notificar admin / especialistas
    try {
      const { data: equipo } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'jefe', 'especialista'])

      const nombre = (data as any)?.children?.name || 'Paciente'
      const titulo = acepta
        ? '✅ Padre aceptó recomendación de evaluación'
        : '⚠️ Padre NO aceptó la recomendación'
      const mensaje = acepta
        ? `${nombre} confirmó. Continuará con la segunda anamnesis.`
        : `${nombre} no está de acuerdo. ${motivo_rechazo ? `Motivo: "${motivo_rechazo}"` : 'Contactar para conversar.'}`

      const notis = (equipo || []).map((e: any) => ({
        user_id: e.id,
        title: titulo,
        message: mensaje,
        type: 'evaluacion_inicial',
        is_read: false,
        created_at: ahora,
      }))
      if (notis.length > 0) await supabaseAdmin.from('notifications').insert(notis)
    } catch (e) { console.warn('[confirmar] no se pudo notificar', e) }

    return NextResponse.json({ ok: true, evaluacion: data })
  } catch (e: any) {
    console.error('[evaluacion-inicial][confirmar]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
