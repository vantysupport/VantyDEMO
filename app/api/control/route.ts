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

export async function GET(req: NextRequest) {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  const raw = data as Record<string, unknown> | null

  // ¿Quién pregunta? Si trae token y pertenece a un centro, devolvemos la config
  // de ESE centro (overrides) mezclada sobre la global. Sin token → global.
  let centerTenant: string | null = null
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (token) {
    const { data: ud } = await supabaseAdmin.auth.getUser(token)
    const uid = ud?.user?.id
    if (uid) {
      const { data: prof } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', uid).maybeSingle()
      centerTenant = (prof as { tenant_id?: string | null } | null)?.tenant_id ?? null
    }
  }
  let center: Record<string, unknown> = {}
  if (centerTenant) {
    const { data: cs } = await supabaseAdmin
      .from('center_settings').select('*').eq('tenant_id', centerTenant).maybeSingle()
    center = (cs as Record<string, unknown> | null) || {}
  }

  const obj = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {})

  // Merge: defaults → global → centro.
  const features: FeaturesConfig = {
    ...DEFAULT_FEATURES, ...obj(raw?.features), ...obj(center.features),
  } as FeaturesConfig
  const roles_config: RolesConfig = {
    ...DEFAULT_ROLES_CONFIG, ...obj(raw?.roles_config), ...obj(center.roles_config),
  } as RolesConfig
  const limits = { ...obj(raw?.limits), ...obj(center.limits) } as Record<string, number>
  const aria_limits = { ...obj(raw?.aria_limits), ...obj(center.aria_limits) }

  return NextResponse.json({
    maintenance: !!raw?.maintenance,        // mantenimiento sigue siendo global
    maintenance_msg: (raw?.maintenance_msg as string) || '',
    limits,
    aria_limits,
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
    tenantId?: string   // si viene → la config se guarda para ESE centro (override)
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

  // ── Config GLOBAL (app_settings id=1) vs POR CENTRO (center_settings tenant) ──
  const cfgTenant = typeof body.tenantId === 'string' && body.tenantId ? body.tenantId : null
  const objc = (v: unknown) => (v && typeof v === 'object' ? v as Record<string, unknown> : {})
  const loadCenterCol = async (col: string): Promise<Record<string, unknown>> => {
    if (!cfgTenant) return {}
    const { data } = await supabaseAdmin.from('center_settings').select(col).eq('tenant_id', cfgTenant).maybeSingle()
    return (data as Record<string, unknown> | null) || {}
  }
  const loadGlobalCol = async (col: string): Promise<Record<string, unknown>> => {
    const { data } = await supabaseAdmin.from('app_settings').select(col).eq('id', 1).maybeSingle()
    return (data as Record<string, unknown> | null) || {}
  }
  const saveCfg = (patch: Record<string, unknown>) => cfgTenant
    ? supabaseAdmin.from('center_settings').upsert({ tenant_id: cfgTenant, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
    : supabaseAdmin.from('app_settings').upsert({ id: 1, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'id' })

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
    const { error } = await saveCfg({ limits })
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
    const { error } = await saveCfg({ aria_limits })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── set_features: activa/desactiva módulos y sub-módulos (global o por centro) ─
  if (action === 'set_features') {
    const incoming = body.features && typeof body.features === 'object' ? body.features : {}
    const features: Partial<FeaturesConfig> = {}
    for (const k of Object.keys(DEFAULT_FEATURES) as (keyof FeaturesConfig)[]) {
      if (k in incoming) features[k] = !!incoming[k]
    }
    // Base = defaults → global → lo que ya tenga el centro → el cambio entrante.
    const globalF = objc((await loadGlobalCol('features')).features)
    const prev = objc((await loadCenterCol('features')).features)
    const merged = { ...DEFAULT_FEATURES, ...globalF, ...prev, ...features }
    const { error } = await saveCfg({ features: merged })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, features: merged })
  }

  // ── set_roles_config: qué roles existen (global o por centro) ─────────────
  if (action === 'set_roles_config') {
    const incoming = body.roles_config && typeof body.roles_config === 'object' ? body.roles_config : {}
    const roles_config: Partial<RolesConfig> = {}
    for (const k of Object.keys(DEFAULT_ROLES_CONFIG) as (keyof RolesConfig)[]) {
      if (k in incoming) roles_config[k] = !!incoming[k]
    }
    const globalR = objc((await loadGlobalCol('roles_config')).roles_config)
    const prev = objc((await loadCenterCol('roles_config')).roles_config)
    const merged = { ...DEFAULT_ROLES_CONFIG, ...globalR, ...prev, ...roles_config } as RolesConfig
    merged.jefe = true   // siempre al menos un rol admin
    const { error } = await saveCfg({ roles_config: merged })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, roles_config: merged })
  }

  // ── get_center_settings: config efectiva de UN centro (para editar en /control) ─
  if (action === 'get_center_settings') {
    const tid = typeof body.tenantId === 'string' ? body.tenantId : ''
    if (!tid) return NextResponse.json({ error: 'falta tenantId' }, { status: 400 })
    const { data: g } = await supabaseAdmin.from('app_settings').select('features, roles_config, limits, aria_limits').eq('id', 1).maybeSingle()
    const { data: c } = await supabaseAdmin.from('center_settings').select('*').eq('tenant_id', tid).maybeSingle()
    const gg = (g as Record<string, unknown> | null) || {}
    const cc = (c as Record<string, unknown> | null) || {}
    return NextResponse.json({
      features:     { ...DEFAULT_FEATURES, ...objc(gg.features), ...objc(cc.features) },
      roles_config: { ...DEFAULT_ROLES_CONFIG, ...objc(gg.roles_config), ...objc(cc.roles_config) },
      limits:       { ...objc(gg.limits), ...objc(cc.limits) },
      aria_limits:  { ...objc(gg.aria_limits), ...objc(cc.aria_limits) },
    })
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

  // ── CENTROS DEMO ───────────────────────────────────────────────────────────
  // Cada centro = una cuenta admin (role 'jefe') marcada is_demo=true.
  // El programador la crea con N días; puede apagar/encender/extender/eliminar.

  if (action === 'list_centers') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, center_name, demo_active, demo_expires_at, created_at, active_session_at, role, tenant_id')
      .eq('is_demo', true)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ centers: data || [] })
  }

  if (action === 'create_center') {
    const b = body as Record<string, unknown>
    const email = String(b.email || '').trim().toLowerCase()
    const password = String(b.password || '')
    const centerName = String(b.center_name || '').slice(0, 120).trim()
    const days = Math.max(1, Math.floor(Number(b.days) || 15))
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Correo inválido' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })

    // 1) Crear el usuario en auth (email ya confirmado: es una demo).
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { center_name: centerName },
    })
    if (cErr || !created?.user?.id) {
      return NextResponse.json({ error: cErr?.message || 'No se pudo crear la cuenta' }, { status: 500 })
    }
    const uid = created.user.id
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    const tenantId = crypto.randomUUID()   // 🔒 cada centro = su propio tenant aislado

    // 2) Marcar el perfil como centro demo + admin. upsert por si un trigger ya lo creó.
    const { error: pErr } = await supabaseAdmin.from('profiles').upsert({
      id: uid,
      email,
      full_name: centerName || email,
      center_name: centerName,
      role: 'jefe',
      is_demo: true,
      demo_active: true,
      demo_expires_at: expires,
      tenant_id: tenantId,
    }, { onConflict: 'id' })
    if (pErr) {
      // Rollback: si no pudimos marcar el perfil, borramos el usuario huérfano.
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {})
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, id: uid, demo_expires_at: expires })
  }

  if (action === 'update_center') {
    const b = body as Record<string, unknown>
    const id = String(b.id || '')
    if (!id) return NextResponse.json({ error: 'Falta el id del centro' }, { status: 400 })

    const patch: Record<string, unknown> = {}
    if (typeof b.demo_active === 'boolean') patch.demo_active = b.demo_active
    if (typeof b.center_name === 'string') {
      patch.center_name = (b.center_name as string).slice(0, 120).trim()
      patch.full_name = patch.center_name
    }
    // Días: 'days' fija una NUEVA ventana desde ahora; 'add_days' extiende sobre lo existente.
    if (b.days != null) {
      const days = Math.max(1, Math.floor(Number(b.days) || 0))
      patch.demo_expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    } else if (b.add_days != null) {
      const add = Math.floor(Number(b.add_days) || 0)
      const { data: cur } = await supabaseAdmin.from('profiles').select('demo_expires_at').eq('id', id).maybeSingle()
      const base = (cur as { demo_expires_at?: string } | null)?.demo_expires_at
      const from = base && new Date(base).getTime() > Date.now() ? new Date(base).getTime() : Date.now()
      patch.demo_expires_at = new Date(from + add * 24 * 60 * 60 * 1000).toISOString()
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    const { error } = await supabaseAdmin.from('profiles').update(patch).eq('id', id).eq('is_demo', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Si lo apagamos, cortamos su sesión activa (logout en su próximo request igual lo bloquea).
    if (patch.demo_active === false) {
      await supabaseAdmin.from('profiles')
        .update({ active_session_id: null, active_session_at: null })
        .eq('id', id)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'delete_center') {
    const b = body as Record<string, unknown>
    const id = String(b.id || '')
    if (!id) return NextResponse.json({ error: 'Falta el id del centro' }, { status: 400 })

    // Seguridad: solo se puede borrar una cuenta marcada is_demo.
    const { data: target } = await supabaseAdmin
      .from('profiles').select('id, is_demo').eq('id', id).maybeSingle()
    if (!target || !(target as { is_demo?: boolean }).is_demo) {
      return NextResponse.json({ error: 'Esa cuenta no es un centro demo (no se borra).' }, { status: 400 })
    }

    // Borrar el usuario de auth. Si profiles tiene FK on delete cascade, el perfil
    // se va con él; si no, lo borramos explícito a continuación.
    const { error: dErr } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (dErr && !/not found/i.test(dErr.message)) {
      return NextResponse.json({ error: dErr.message }, { status: 500 })
    }
    await supabaseAdmin.from('profiles').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
