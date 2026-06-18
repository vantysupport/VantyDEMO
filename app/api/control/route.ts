import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Panel de control del programador.
//  • GET  → estado público seguro: { maintenance, maintenance_msg, limits, features, roles_config }.
//           Lo usan la "barrera" de mantenimiento y los chequeos de límite.
//           NUNCA expone errores ni datos sensibles.
//  • POST 'log_error'   → cualquiera puede registrar un error (pasa pre-login).
//  • POST resto (set_maintenance / set_limits / set_features / set_roles_config /
//               get_errors / clear_errors)
//           → SOLO rol 'programador' (verificado por token).
// Usa service_role (bypassa RLS). Ver supabase/control-programador.sql.

// ── Tipos ────────────────────────────────────────────────────────────────────

/** Módulos de la barra lateral y sus sub-módulos */
export type FeaturesConfig = {
  // Módulos principales (sidebar)
  agenda: boolean
  ninos: boolean              // pacientes
  inteligencia: boolean       // hub IA
  cerebro: boolean
  pagos: boolean
  reportes_financieros: boolean
  recursos_adicionales: boolean
  chat_especialistas: boolean
  // Sub-módulos: Pacientes
  ninos_info: boolean
  ninos_programas: boolean
  ninos_evaluaciones: boolean
  ninos_eval_inicial: boolean
  ninos_historial: boolean
  ninos_fichas: boolean
  ninos_documentos: boolean
  // Sub-módulos: Inteligencia Hub
  intel_predicciones: boolean
  intel_patrones: boolean
  intel_objetivos: boolean
  intel_sugerencias: boolean
  intel_reportes: boolean
  intel_seguridad: boolean
  // Sub-módulos: Cerebro (Knowledge Base)
  cerebro_aprender: boolean
  cerebro_diagnosticos: boolean
  cerebro_biblioteca: boolean
  // Sub-módulos: Pagos
  pagos_dashboard: boolean
  pagos_registros: boolean
  pagos_agrupado: boolean
  pagos_tarifas: boolean
  // Sub-módulos: Reportes Financieros
  reportes_overview: boolean
  reportes_pacientes: boolean
  reportes_servicios: boolean
  // Sub-módulos: Recursos Adicionales
  recursos_recursos: boolean
  recursos_tienda: boolean
  recursos_terapias: boolean
  recursos_fonemas: boolean
}

/** Roles que existen en el sistema y son asignables desde el panel de usuarios */
export type RolesConfig = {
  jefe: boolean
  especialista: boolean
  secretaria: boolean
  padre: boolean
}

const DEFAULT_FEATURES: FeaturesConfig = {
  agenda: true, ninos: true, inteligencia: true, cerebro: true,
  pagos: true, reportes_financieros: true, recursos_adicionales: true, chat_especialistas: true,
  // Pacientes
  ninos_info: true, ninos_programas: true, ninos_evaluaciones: true,
  ninos_eval_inicial: true, ninos_historial: true, ninos_fichas: true, ninos_documentos: true,
  // Inteligencia
  intel_predicciones: true, intel_patrones: true, intel_objetivos: true,
  intel_sugerencias: true, intel_reportes: true, intel_seguridad: true,
  // Cerebro
  cerebro_aprender: true, cerebro_diagnosticos: true, cerebro_biblioteca: true,
  // Pagos
  pagos_dashboard: true, pagos_registros: true, pagos_agrupado: true, pagos_tarifas: true,
  // Reportes Financieros
  reportes_overview: true, reportes_pacientes: true, reportes_servicios: true,
  // Recursos Adicionales
  recursos_recursos: true, recursos_tienda: true, recursos_terapias: true, recursos_fonemas: true,
}

const DEFAULT_ROLES_CONFIG: RolesConfig = {
  jefe: true,
  especialista: true,
  secretaria: true,
  padre: true,
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function authProgramador(req: NextRequest): Promise<{ ok: boolean; reason?: string }> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return { ok: false, reason: 'sin token' }
  const { data: userData, error: uErr } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return { ok: false, reason: 'sesión inválida o expirada' }
  const { data: profile, error: pErr } = await supabaseAdmin
    .from('profiles').select('role').eq('id', uid).maybeSingle()
  if (pErr) return { ok: false, reason: 'no se pudo leer el perfil' }
  const role = (profile as { role?: string } | null)?.role
  if (role !== 'programador') return { ok: false, reason: `tu rol es "${role || 'ninguno'}"` }
  return { ok: true }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const raw = data as Record<string, unknown> | null

  // Merge stored features with defaults (so new features default to true)
  const storedFeatures = (raw?.features && typeof raw.features === 'object')
    ? raw.features as Partial<FeaturesConfig>
    : {}
  const features: FeaturesConfig = { ...DEFAULT_FEATURES, ...storedFeatures }

  const storedRoles = (raw?.roles_config && typeof raw.roles_config === 'object')
    ? raw.roles_config as Partial<RolesConfig>
    : {}
  const roles_config: RolesConfig = { ...DEFAULT_ROLES_CONFIG, ...storedRoles }

  return NextResponse.json({
    maintenance: !!raw?.maintenance,
    maintenance_msg: (raw?.maintenance_msg as string) || '',
    limits: (raw?.limits as Record<string, number>) || {},
    aria_limits: (raw?.aria_limits as Record<string, unknown>) || {},
    features,
    roles_config,
  })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: {
    action?: string; message?: string; detail?: string; source?: string; url?: string
    user_email?: string; on?: boolean; msg?: string; limits?: Record<string, number>
    aria_limits?: {
      enabled?: boolean; maxMessages?: number; windowHours?: number
      staffEnabled?: boolean; staffMaxMessages?: number; staffWindowHours?: number
    }
    features?: Partial<FeaturesConfig>
    roles_config?: Partial<RolesConfig>
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
  const auth = await authProgramador(req)
  if (!auth.ok) {
    return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })
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

  if (action === 'set_aria_limits') {
    const a = body.aria_limits && typeof body.aria_limits === 'object' ? body.aria_limits : {}
    const aria_limits = {
      enabled: !!a.enabled,
      maxMessages: Math.max(0, Math.floor(Number(a.maxMessages) || 0)),
      windowHours: Math.max(1, Math.floor(Number(a.windowHours) || 5)),
      staffEnabled: !!a.staffEnabled,
      staffMaxMessages: Math.max(0, Math.floor(Number(a.staffMaxMessages) || 0)),
      staffWindowHours: Math.max(1, Math.floor(Number(a.staffWindowHours) || 5)),
    }
    const { error } = await supabaseAdmin.from('app_settings').upsert(
      { id: 1, aria_limits, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── set_features: activa/desactiva módulos y sub-módulos ──────────────────
  if (action === 'set_features') {
    const incoming = body.features && typeof body.features === 'object' ? body.features : {}
    // Only allow known keys
    const features: Partial<FeaturesConfig> = {}
    for (const k of Object.keys(DEFAULT_FEATURES) as (keyof FeaturesConfig)[]) {
      if (k in incoming) features[k] = !!incoming[k]
    }
    // Merge with existing stored features
    const { data: existing } = await supabaseAdmin
      .from('app_settings').select('features').eq('id', 1).maybeSingle()
    const prev = ((existing as Record<string, unknown> | null)?.features as Partial<FeaturesConfig>) || {}
    const merged = { ...DEFAULT_FEATURES, ...prev, ...features }
    const { error } = await supabaseAdmin.from('app_settings').upsert(
      { id: 1, features: merged, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, features: merged })
  }

  // ── set_roles_config: activa/desactiva qué roles existen en el sistema ────
  if (action === 'set_roles_config') {
    const incoming = body.roles_config && typeof body.roles_config === 'object' ? body.roles_config : {}
    const roles_config: Partial<RolesConfig> = {}
    for (const k of Object.keys(DEFAULT_ROLES_CONFIG) as (keyof RolesConfig)[]) {
      if (k in incoming) roles_config[k] = !!incoming[k]
    }
    // Merge with existing
    const { data: existing } = await supabaseAdmin
      .from('app_settings').select('roles_config').eq('id', 1).maybeSingle()
    const prev = ((existing as Record<string, unknown> | null)?.roles_config as Partial<RolesConfig>) || {}
    const merged = { ...DEFAULT_ROLES_CONFIG, ...prev, ...roles_config }
    // Always keep jefe enabled (safety: at least one admin role must exist)
    merged.jefe = true
    const { error } = await supabaseAdmin.from('app_settings').upsert(
      { id: 1, roles_config: merged, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, roles_config: merged })
  }

  if (action === 'get_counts') {
    const tally = { admin: 0, especialista: 0, secretaria: 0, padre: 0, programador: 0 }
    const { data: profs } = await supabaseAdmin.from('profiles').select('role')
    for (const p of (profs || []) as { role?: string }[]) {
      const r = p.role
      if (r === 'jefe' || r === 'admin') tally.admin++
      else if (r === 'especialista' || r === 'terapeuta') tally.especialista++
      else if (r === 'secretaria') tally.secretaria++
      else if (r === 'padre') tally.padre++
      else if (r === 'programador') tally.programador++
    }
    const { count: paciente } = await supabaseAdmin.from('children').select('id', { count: 'exact', head: true })
    return NextResponse.json({ counts: { ...tally, paciente: paciente || 0 } })
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

  // purge_old_errors: elimina errores más antiguos que N días (default 7).
  // Se llama automáticamente al cargar el panel del programador.
  if (action === 'purge_old_errors') {
    const days = Math.max(1, Math.floor(Number((body as any).days) || 7))
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { error, count } = await supabaseAdmin
      .from('error_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, deleted: count ?? 0, days, cutoff })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
