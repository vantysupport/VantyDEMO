// app/api/evaluacion-inicial/anamnesis/route.ts
// El padre completa la SEGUNDA anamnesis (psicológica o neuropsicológica)
// dependiendo de la recomendación. Las respuestas se guardan en
// `anamnesis_especifica` (JSONB) y avanza al estado 'anamnesis_completa'.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id, respuestas } = await req.json()
    if (!evaluacion_id || !respuestas) {
      return NextResponse.json({ error: 'evaluacion_id y respuestas requeridos' }, { status: 400 })
    }

    const ahora = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        anamnesis_especifica: respuestas,
        anamnesis_completada_en: ahora,
        estado: 'anamnesis_completa',
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select()
      .single()
    if (error) throw error

    // 🔮 Disparar recomendación IA de terapias en background (best-effort).
    //    Si el catálogo está vacío o falla, igual seguimos.
    try {
      const url = new URL('/api/evaluacion-inicial/recomendar-terapias', req.url)
      // fire-and-forget — el cliente verá las recomendaciones al refrescar
      fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacion_id }),
      }).catch(() => {})
    } catch { /* ignore */ }

    return NextResponse.json({ ok: true, evaluacion: data })
  } catch (e: any) {
    console.error('[evaluacion-inicial][anamnesis]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
