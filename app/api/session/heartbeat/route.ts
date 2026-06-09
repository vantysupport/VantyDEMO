// app/api/session/heartbeat/route.ts
// Mantiene viva la sesión. Identifica por userId + sessionId (token secreto en
// el localStorage del dueño). No necesita auth: solo el dueño conoce su sessionId,
// y mantener viva una sesión no es una operación sensible.
// Devuelve { owner: boolean }. owner=false => otra sesión tomó la cuenta.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    let userId = ''
    let sessionId = ''
    try {
      const b = await req.json()
      userId = (b?.userId as string) || ''
      sessionId = (b?.sessionId as string) || ''
    } catch {}
    if (!userId || !sessionId) return NextResponse.json({ owner: true })

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ active_session_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('active_session_id', sessionId)
      .select('id')

    if (error) return NextResponse.json({ owner: true }) // ante error, no expulsar
    const owner = Array.isArray(data) && data.length > 0
    return NextResponse.json({ owner })
  } catch {
    return NextResponse.json({ owner: true })
  }
}
