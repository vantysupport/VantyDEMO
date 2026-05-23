// app/api/evaluacion-inicial/responder/route.ts
// El especialista/admin envía la respuesta final al padre tras revisar
// la selección de terapias. Estado pasa a 'revisado'.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id, respuesta, respondido_por } = await req.json()
    if (!evaluacion_id || !respuesta?.trim()) {
      return NextResponse.json({ error: 'evaluacion_id y respuesta requeridos' }, { status: 400 })
    }

    const ahora = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        respuesta_especialista: respuesta,
        respondido_en: ahora,
        respondido_por: respondido_por || null,
        estado: 'revisado',
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select('*, children:child_id (id, name, parent_id)')
      .single()
    if (error) throw error

    // Notificar al padre
    try {
      const parentId = (data as any)?.children?.parent_id
      if (parentId) {
        await supabaseAdmin.from('notifications').insert({
          user_id: parentId,
          title: '💬 Respuesta del especialista',
          message: 'Nuestro equipo ha revisado tu solicitud. Entra a "Evaluación Inicial" para ver la respuesta.',
          type: 'evaluacion_inicial',
          is_read: false,
          created_at: ahora,
        })
      }
    } catch (e) { console.warn('[responder] noti falló', e) }

    return NextResponse.json({ ok: true, evaluacion: data })
  } catch (e: any) {
    console.error('[evaluacion-inicial][responder]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
