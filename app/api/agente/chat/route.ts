// app/api/agente/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { vantyAgent } from '@/lib/vanty-agent'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mensaje, childId, userId, conversacionId, contexto } = body

    if (!mensaje || !userId) {
      return NextResponse.json({ error: 'mensaje y userId son requeridos' }, { status: 400 })
    }

    const locale = req.headers.get('x-locale') || 'es'
    const response = await vantyAgent.chat(mensaje, {
      childId, userId, conversacionId, contexto, locale,
    })

    return NextResponse.json(response)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')
  const childId = searchParams.get('child_id')
  const userId = searchParams.get('user_id')

  try {
    if (action === 'analisis_proactivo' && childId) {
      const analysis = await vantyAgent.analizarPacienteProactivo(childId)
      return NextResponse.json(analysis)
    }

    if (action === 'alertas' && childId) {
      const { data } = await supabaseAdmin
        .from('agente_alertas')
        .select('*')
        .eq('child_id', childId)
        .eq('resuelta', false)
        .order('prioridad', { ascending: true })
        .order('created_at', { ascending: false })
      return NextResponse.json({ data })
    }

    if (action === 'alertas_todas') {
      const { data } = await supabaseAdmin
        .from('agente_alertas')
        .select('*, children(name)')
        .eq('resuelta', false)
        .order('prioridad', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50)
      return NextResponse.json({ data })
    }

    if (action === 'conversaciones' && userId) {
      const { data } = await supabaseAdmin
        .from('agente_conversaciones')
        .select('id, titulo, contexto, created_at, child_id, children(name)')
        .eq('user_id', userId)
        .eq('activa', true)
        .order('updated_at', { ascending: false })
        .limit(20)
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, id } = body

    if (action === 'resolver_alerta') {
      await supabaseAdmin
        .from('agente_alertas')
        .update({ resuelta: true })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    if (action === 'marcar_leida') {
      await supabaseAdmin
        .from('agente_alertas')
        .update({ leida: true })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
