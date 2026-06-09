// app/api/session/heartbeat/route.ts
// Mantiene viva la sesión del usuario autenticado. Devuelve { owner: boolean }.
//   owner=false => otra sesión tomó la cuenta; el cliente debe salir.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ owner: false }, { status: 401 })

    const { data: u, error: ue } = await supabaseAdmin.auth.getUser(token)
    if (ue || !u?.user) return NextResponse.json({ owner: false }, { status: 401 })
    const uid = u.user.id

    let sessionId = ''
    try { const b = await req.json(); sessionId = (b?.sessionId as string) || '' } catch {}
    if (!sessionId) return NextResponse.json({ owner: false }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ active_session_at: new Date().toISOString() })
      .eq('id', uid)
      .eq('active_session_id', sessionId)
      .select('id')

    if (error) return NextResponse.json({ owner: true }) // ante error, no expulsar
    const owner = Array.isArray(data) && data.length > 0
    return NextResponse.json({ owner })
  } catch {
    return NextResponse.json({ owner: true })
  }
}
