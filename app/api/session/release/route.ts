// app/api/session/release/route.ts
// Libera la "sesión única" de forma inmediata al cerrar la pestaña.
// Se invoca con navigator.sendBeacon (fiable en unload). Limpia por TOKEN
// (active_session_id), así no necesita auth: el token es un uuid secreto.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    let sessionId = ''
    try {
      const body = await req.json()
      sessionId = (body?.sessionId as string) || ''
    } catch { /* cuerpo vacío */ }

    if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 })

    await supabaseAdmin
      .from('profiles')
      .update({ active_session_id: null, active_session_at: null })
      .eq('active_session_id', sessionId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
