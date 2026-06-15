import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Panel de control del programador.
//  • GET  → estado público seguro: { maintenance, maintenance_msg, limits }.
//           Lo usan la "barrera" de mantenimiento y los chequeos de límite.
//           NUNCA expone errores ni datos sensibles.
//  • POST 'log_error'   → cualquiera puede registrar un error (pasa pre-login).
//  • POST resto (set_maintenance / set_limits / get_errors / clear_errors)
//           → SOLO rol 'programador' (verificado por token).
// Usa service_role (bypassa RLS). Ver supabase/control-programador.sql.

async function isProgramador(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return false
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).single()
  return (profile as { role?: string } | null)?.role === 'programador'
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('maintenance, maintenance_msg, limits')
    .eq('id', 1)
    .maybeSingle()
  return NextResponse.json({
    maintenance: !!(data as { maintenance?: boolean } | null)?.maintenance,
    maintenance_msg: (data as { maintenance_msg?: string } | null)?.maintenance_msg || '',
    limits: (data as { limits?: Record<string, number> } | null)?.limits || {},
  })
}

export async function POST(req: NextRequest) {
  let body: {
    action?: string; message?: string; detail?: string; source?: string; url?: string
    user_email?: string; on?: boolean; msg?: string; limits?: Record<string, number>
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const action = body?.action

  // Registrar un error — abierto (los errores también ocurren antes del login).
  if (action === 'log_error') {
    const message = String(body.message || '').slice(0, 500)
    const detail = String(body.detail || '').slice(0, 4000)
    if (!message && !detail) return NextResponse.json({ ok: true })
    await supabaseAdmin.from('error_logs').insert({
      message,
      detail,
      source: String(body.source || '').slice(0, 100),
      url: String(body.url || '').slice(0, 300),
      user_email: String(body.user_email || '').slice(0, 200),
    })
    return NextResponse.json({ ok: true })
  }

  // El resto requiere rol programador.
  if (!(await isProgramador(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (action === 'set_maintenance') {
    const { error } = await supabaseAdmin.from('app_settings').upsert(
      { id: 1, maintenance: !!body.on, maintenance_msg: String(body.msg || '').slice(0, 300), updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'set_limits') {
    const raw = body.limits && typeof body.limits === 'object' ? body.limits : {}
    const limits: Record<string, number> = {}
    for (const k of Object.keys(raw)) {
      const n = Number(raw[k])
      limits[k] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
    }
    const { error } = await supabaseAdmin.from('app_settings').upsert(
      { id: 1, limits, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'get_errors') {
    const { data, error } = await supabaseAdmin
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ errors: data || [] })
  }

  if (action === 'clear_errors') {
    await supabaseAdmin.from('error_logs').delete().not('id', 'is', null)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
