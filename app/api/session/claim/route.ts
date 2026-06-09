// app/api/session/claim/route.ts
// Reclama la sesión única para el usuario autenticado (por su access token).
// Atómico: un único UPDATE condicional. Devuelve { claimed: boolean }.
//   claimed=false  => ya hay otra sesión activa y viva ("in_use").

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const STALE_MS = 60_000 // 60s sin heartbeat => sesión considerada muerta

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'no_auth' }, { status: 401 })

    const { data: u, error: ue } = await supabaseAdmin.auth.getUser(token)
    if (ue || !u?.user) return NextResponse.json({ error: 'invalid' }, { status: 401 })
    const uid = u.user.id

    let sessionId = ''
    try { const b = await req.json(); sessionId = (b?.sessionId as string) || '' } catch {}
    if (!sessionId) return NextResponse.json({ error: 'no_session' }, { status: 400 })

    const nowIso = new Date().toISOString()
    const threshold = new Date(Date.now() - STALE_MS).toISOString()

    // Toma la sesión solo si: no hay ninguna, o ya es mía, o la actual está vieja.
    // El UPDATE es atómico (Postgres re-evalúa el WHERE bajo concurrencia).
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ active_session_id: sessionId, active_session_at: nowIso })
      .eq('id', uid)
      .or(`active_session_id.is.null,active_session_id.eq.${sessionId},active_session_at.lt.${threshold}`)
      .select('id')

    if (error) return NextResponse.json({ error: 'db' }, { status: 500 })

    const claimed = Array.isArray(data) && data.length > 0
    return NextResponse.json({ ok: true, claimed })
  } catch {
    return NextResponse.json({ error: 'server' }, { status: 500 })
  }
}
