import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyParentDirect } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const { childId, tipo, vars } = await req.json()
    if (!childId || !tipo) return NextResponse.json({ error: 'childId y tipo requeridos' }, { status: 400 })

    // Buscar teléfono del padre
    const { data: parentLink } = await supabaseAdmin
      .from('parent_accounts').select('user_id').eq('child_id', childId).maybeSingle()

    if (parentLink?.user_id) {
      const { data: parentProf } = await supabaseAdmin
        .from('profiles').select('phone').eq('id', parentLink.user_id).maybeSingle()
      if ((parentProf as any)?.phone) {
        notifyParentDirect((parentProf as any).phone, tipo, vars || {})
        return NextResponse.json({ ok: true })
      }
    }

    return NextResponse.json({ ok: false, reason: 'no phone found' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
