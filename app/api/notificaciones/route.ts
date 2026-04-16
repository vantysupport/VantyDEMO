// app/api/notificaciones/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId     = searchParams.get('user_id')
  const soloNoLeidas = searchParams.get('no_leidas') === 'true'

  if (!userId) return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })

  try {
    let query = supabaseAdmin
      .from('notificaciones')
      .select('*, children(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (soloNoLeidas) query = query.eq('leida', false)

    const { data, error } = await query
    if (error) throw error

    const totalNoLeidas = data?.filter(n => !n.leida).length || 0
    return NextResponse.json({ data, totalNoLeidas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, id, userId } = body

    if (action === 'marcar_leida') {
      await supabaseAdmin.from('notificaciones').update({ leida: true }).eq('id', id)
      return NextResponse.json({ success: true })
    }

    if (action === 'marcar_todas_leidas') {
      await supabaseAdmin.from('notificaciones').update({ leida: true }).eq('user_id', userId).eq('leida', false)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await supabaseAdmin.from('notificaciones').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
