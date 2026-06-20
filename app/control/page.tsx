'use client'
// app/control/page.tsx — Panel del PROGRAMADOR (rol asignado solo en Supabase).
//  • Modo mantenimiento.
//  • Módulos del sistema: activa/desactiva secciones y sub-secciones.
//  • Roles: configura cuáles roles existen en el sistema.
//  • Límites de perfiles y ARIA.
//  • Registro de errores.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ShieldCheck, Power, Users, AlertTriangle, RefreshCw, Trash2, Save, LogOut, Loader2,
  Activity, ChevronDown, Gauge, Terminal, Bot, Clock, MessageSquare,
  ToggleLeft, ToggleRight, Puzzle, Crown, Stethoscope, Heart, ClipboardList, Layers,
  Building2, Plus, PowerOff, CalendarClock, Pencil,
} from 'lucide-react'

type Center = {
  id: string
  email: string
  full_name?: string | null
  center_name?: string | null
  demo_active: boolean
  demo_expires_at: string | null
  created_at: string
  active_session_at?: string | null
}

/** Días restantes a partir de una fecha ISO (puede ser negativo → vencido). */
function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

type ErrLog = { id: string; message: string; detail: string; source: string; url: string; user_email: string; created_at: string }

type FeaturesConfig = {
  agenda: boolean; ninos: boolean; inteligencia: boolean; cerebro: boolean
  pagos: boolean; reportes_financieros: boolean; recursos_adicionales: boolean; chat_especialistas: boolean
  ninos_info: boolean; ninos_programas: boolean; ninos_evaluaciones: boolean
  ninos_eval_inicial: boolean; ninos_historial: boolean; ninos_fichas: boolean; ninos_documentos: boolean
  intel_predicciones: boolean; intel_patrones: boolean; intel_objetivos: boolean
  intel_sugerencias: boolean; intel_reportes: boolean; intel_seguridad: boolean
  cerebro_aprender: boolean; cerebro_diagnosticos: boolean; cerebro_biblioteca: boolean
  pagos_dashboard: boolean; pagos_registros: boolean; pagos_agrupado: boolean; pagos_tarifas: boolean
  reportes_overview: boolean; reportes_pacientes: boolean; reportes_servicios: boolean
  recursos_recursos: boolean; recursos_tienda: boolean; recursos_terapias: boolean; recursos_fonemas: boolean
}

type RolesConfig = { jefe: boolean; especialista: boolean; secretaria: boolean; padre: boolean }

const DEFAULT_FEATURES: FeaturesConfig = {
  agenda: true, ninos: true, inteligencia: true, cerebro: true,
  pagos: true, reportes_financieros: true, recursos_adicionales: true, chat_especialistas: true,
  ninos_info: true, ninos_programas: true, ninos_evaluaciones: true,
  ninos_eval_inicial: true, ninos_historial: true, ninos_fichas: true, ninos_documentos: true,
  intel_predicciones: true, intel_patrones: true, intel_objetivos: true,
  intel_sugerencias: true, intel_reportes: true, intel_seguridad: true,
  cerebro_aprender: true, cerebro_diagnosticos: true, cerebro_biblioteca: true,
  pagos_dashboard: true, pagos_registros: true, pagos_agrupado: true, pagos_tarifas: true,
  reportes_overview: true, reportes_pacientes: true, reportes_servicios: true,
  recursos_recursos: true, recursos_tienda: true, recursos_terapias: true, recursos_fonemas: true,
}

const DEFAULT_ROLES: RolesConfig = { jefe: true, especialista: true, secretaria: true, padre: true }

const MAIN_MODULES = [
  { key: 'agenda', label: 'Agenda / Calendario', icon: '📅' },
  { key: 'ninos', label: 'Pacientes', icon: '👥' },
  { key: 'inteligencia', label: 'Inteligencia Hub (IA)', icon: '⚡' },
  { key: 'cerebro', label: 'Cerebro (Base Conocimiento)', icon: '🧠' },
  { key: 'pagos', label: 'Pagos y Facturación', icon: '💳' },
  { key: 'reportes_financieros', label: 'Reportes Financieros', icon: '📊' },
  { key: 'recursos_adicionales', label: 'Recursos Adicionales', icon: '📚' },
  { key: 'chat_especialistas', label: 'Chat del Equipo', icon: '💬' },
] as const

const PATIENT_TABS = [
  { key: 'ninos_info', label: 'Información del paciente', icon: '👤' },
  { key: 'ninos_programas', label: 'Programas ABA', icon: '📈' },
  { key: 'ninos_evaluaciones', label: 'Evaluaciones', icon: '📋' },
  { key: 'ninos_eval_inicial', label: 'Evaluación Inicial', icon: '🔍' },
  { key: 'ninos_historial', label: 'Historial & IA', icon: '🤖' },
  { key: 'ninos_fichas', label: 'Fichas clínicas', icon: '📄' },
  { key: 'ninos_documentos', label: 'Documentos', icon: '📁' },
] as const

const INTEL_TABS = [
  { key: 'intel_predicciones', label: 'Predicciones IA', icon: '🧠' },
  { key: 'intel_patrones', label: 'Patrones ABA', icon: '📊' },
  { key: 'intel_objetivos', label: 'Objetivos IA', icon: '🎯' },
  { key: 'intel_sugerencias', label: 'Alertas Proactivas', icon: '⚡' },
  { key: 'intel_reportes', label: 'Reportes IA', icon: '📑' },
  { key: 'intel_seguridad', label: 'Seguridad', icon: '🛡️' },
] as const

const CEREBRO_TABS = [
  { key: 'cerebro_aprender', label: 'Aprender / Ingerir', icon: '📥' },
  { key: 'cerebro_diagnosticos', label: 'Diagnósticos CIE-11', icon: '🔬' },
  { key: 'cerebro_biblioteca', label: 'Biblioteca', icon: '📚' },
] as const

const PAGOS_TABS = [
  { key: 'pagos_dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'pagos_registros', label: 'Registros', icon: '💳' },
  { key: 'pagos_agrupado', label: 'Por paciente', icon: '👥' },
  { key: 'pagos_tarifas', label: 'Tarifas', icon: '🏷️' },
] as const

const REPORTES_TABS = [
  { key: 'reportes_overview', label: 'Ingresos', icon: '📈' },
  { key: 'reportes_pacientes', label: 'Por paciente', icon: '👤' },
  { key: 'reportes_servicios', label: 'Por servicio', icon: '🧩' },
] as const

const RECURSOS_TABS = [
  { key: 'recursos_recursos', label: 'Recursos', icon: '📖' },
  { key: 'recursos_tienda', label: 'Tienda', icon: '🛒' },
  { key: 'recursos_terapias', label: 'Catálogo Terapias', icon: '✨' },
  { key: 'recursos_fonemas', label: 'Fonemas', icon: '🎤' },
] as const

const ROLE_OPTIONS = [
  { key: 'jefe', label: 'Director / Jefe', desc: 'Acceso total — no se puede desactivar', icon: Crown, locked: true },
  { key: 'especialista', label: 'Especialista', desc: 'Terapeuta / Clínico', icon: Stethoscope, locked: false },
  { key: 'secretaria', label: 'Secretaria(o)', desc: 'Apoyo administrativo', icon: ClipboardList, locked: false },
  { key: 'padre', label: 'Padre / Tutor', desc: 'Portal de familias', icon: Heart, locked: false },
] as const

const LIMIT_FIELDS = [
  { key: 'admin', label: 'Admins / Directores' },
  { key: 'especialista', label: 'Especialistas' },
  { key: 'secretaria', label: 'Secretarias' },
  { key: 'padre', label: 'Padres / Tutores' },
  { key: 'paciente', label: 'Pacientes' },
]

// ── Toggle helper ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${on ? 'bg-sky-600' : 'bg-white/10'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ControlPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'loading' | 'denied' | 'ok'>('loading')

  const [maintenance, setMaintenance] = useState(false)
  const [maintMsg, setMaintMsg] = useState('')
  const [limits, setLimits] = useState<Record<string, string>>({})
  const [aria, setAria] = useState<{
    enabled: boolean; maxMessages: string; windowHours: string
    staffEnabled: boolean; staffMaxMessages: string; staffWindowHours: string
  }>({ enabled: false, maxMessages: '', windowHours: '5', staffEnabled: false, staffMaxMessages: '', staffWindowHours: '5' })
  const [features, setFeatures] = useState<FeaturesConfig>(DEFAULT_FEATURES)
  const [rolesConfig, setRolesConfig] = useState<RolesConfig>(DEFAULT_ROLES)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<ErrLog[]>([])
  const [openErr, setOpenErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [autoPurgeDays, setAutoPurgeDays] = useState<number>(7)  // auto-limpiar errores más viejos que N días

  // ── Centros demo ──────────────────────────────────────────────────────────
  const [centers, setCenters] = useState<Center[]>([])
  const [newCenter, setNewCenter] = useState({ name: '', email: '', password: '', days: '15' })

  const getToken = async () => {
    let token = (await supabase.auth.getSession()).data.session?.access_token || ''
    if (!token) {
      try { token = (await supabase.auth.refreshSession()).data.session?.access_token || '' } catch { /* noop */ }
    }
    return token
  }

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/control', { cache: 'no-store' })
      const j = await r.json()
      setMaintenance(!!j.maintenance)
      setMaintMsg(j.maintenance_msg || '')
      const lim: Record<string, string> = {}
      for (const f of LIMIT_FIELDS) lim[f.key] = j.limits?.[f.key] ? String(j.limits[f.key]) : ''
      setLimits(lim)
      const al = j.aria_limits || {}
      setAria({
        enabled: !!al.enabled,
        maxMessages: al.maxMessages ? String(al.maxMessages) : '',
        windowHours: al.windowHours ? String(al.windowHours) : '5',
        staffEnabled: !!al.staffEnabled,
        staffMaxMessages: al.staffMaxMessages ? String(al.staffMaxMessages) : '',
        staffWindowHours: al.staffWindowHours ? String(al.staffWindowHours) : '5',
      })
      if (j.features) setFeatures({ ...DEFAULT_FEATURES, ...j.features })
      if (j.roles_config) setRolesConfig({ ...DEFAULT_ROLES, ...j.roles_config })
    } catch { /* noop */ }
  }, [])

  const loadErrors = useCallback(async () => {
    try {
      const token = await getToken()
      const r = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_errors' }),
      })
      if (!r.ok) return
      const j = await r.json()
      setErrors(j.errors || [])
    } catch { /* noop */ }
  }, [])

  const loadCounts = useCallback(async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || ''
      const r = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get_counts' }),
      })
      if (!r.ok) return
      const j = await r.json()
      setCounts(j.counts || {})
    } catch { /* noop */ }
  }, [])

  // ── Centros demo: carga + acciones ────────────────────────────────────────
  const ctlPost = useCallback(async (payload: Record<string, unknown>) => {
    const token = await getToken()
    return fetch('/api/control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
  }, [])

  const loadCenters = useCallback(async () => {
    try {
      const r = await ctlPost({ action: 'list_centers' })
      if (!r.ok) return
      const j = await r.json()
      setCenters(j.centers || [])
    } catch { /* noop */ }
  }, [ctlPost])

  const createCenter = useCallback(async () => {
    const name = newCenter.name.trim()
    const email = newCenter.email.trim()
    const password = newCenter.password
    const days = parseInt(newCenter.days || '15', 10) || 15
    if (!email || !password) { alert('Completá correo y contraseña.'); return }
    setBusy('center-create')
    try {
      const r = await ctlPost({ action: 'create_center', center_name: name, email, password, days })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { alert('Error: ' + (j.error || r.status)); return }
      setNewCenter({ name: '', email: '', password: '', days: '15' })
      await loadCenters()
    } catch { alert('Error de red.') } finally { setBusy(null) }
  }, [ctlPost, newCenter, loadCenters])

  const updateCenter = useCallback(async (id: string, patch: Record<string, unknown>, key: string) => {
    setBusy(key)
    try {
      const r = await ctlPost({ action: 'update_center', id, ...patch })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { alert('Error: ' + (j.error || r.status)); return }
      await loadCenters()
    } catch { alert('Error de red.') } finally { setBusy(null) }
  }, [ctlPost, loadCenters])

  const deleteCenter = useCallback(async (c: Center) => {
    const label = c.center_name || c.email
    if (!confirm(`¿Eliminar el centro "${label}" y su cuenta por completo?\n\nEsta acción no se puede deshacer.`)) return
    setBusy('center-del-' + c.id)
    try {
      const r = await ctlPost({ action: 'delete_center', id: c.id })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { alert('Error: ' + (j.error || r.status)); return }
      await loadCenters()
    } catch { alert('Error de red.') } finally { setBusy(null) }
  }, [ctlPost, loadCenters])

  /** Auto-purge: borra silenciosamente errores más viejos que autoPurgeDays días */
  const purgeOldErrors = useCallback(async (days: number) => {
    try {
      const token = await getToken()
      const r = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'purge_old_errors', days }),
      })
      if (!r.ok) return
      const j = await r.json()
      if (j.deleted > 0) {
        // Reload errors after purge so UI reflects the deletion
        await loadErrors()
      }
    } catch { /* silent — purge failing doesn't matter */ }
  }, [loadErrors])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!uid) { router.replace('/login'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      if ((p as { role?: string } | null)?.role !== 'programador') { setPhase('denied'); return }
      setPhase('ok')
      await loadStatus()
      await loadErrors()
      await loadCounts()
      await loadCenters()
      await purgeOldErrors(autoPurgeDays) // auto-limpiar errores viejos al cargar
    })()
  }, [router, loadStatus, loadErrors, loadCounts, loadCenters, purgeOldErrors, autoPurgeDays])

  const saveMaintenance = async (on: boolean) => {
    setBusy('maint'); setMaintenance(on)
    try {
      const token = await getToken()
      const r = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_maintenance', on, msg: maintMsg }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setMaintenance(!on); alert('Error: ' + (j.error || r.status)) }
    } catch { setMaintenance(!on) } finally { setBusy(null) }
  }

  const saveMsg = async () => {
    setBusy('maint')
    try {
      const token = await getToken()
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_maintenance', on: maintenance, msg: maintMsg }),
      })
    } finally { setBusy(null) }
  }

  const saveLimits = async () => {
    setBusy('limits')
    try {
      const payload: Record<string, number> = {}
      for (const f of LIMIT_FIELDS) {
        const n = parseInt(limits[f.key] || '0', 10)
        payload[f.key] = Number.isFinite(n) && n > 0 ? n : 0
      }
      const token = await getToken()
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_limits', limits: payload }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) alert('Error al guardar límites: ' + (j.error || res.status))
      else await loadStatus()
    } catch { alert('Error de red.') } finally { setBusy(null) }
  }

  const saveAria = async (override?: Partial<{ enabled: boolean; staffEnabled: boolean }>) => {
    setBusy('aria')
    const next = { ...aria, ...(override || {}) }
    if (override) setAria(a => ({ ...a, ...override }))
    try {
      const token = await getToken()
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'set_aria_limits',
          aria_limits: {
            enabled: next.enabled,
            maxMessages: parseInt(next.maxMessages || '0', 10) || 0,
            windowHours: parseInt(next.windowHours || '5', 10) || 5,
            staffEnabled: next.staffEnabled,
            staffMaxMessages: parseInt(next.staffMaxMessages || '0', 10) || 0,
            staffWindowHours: parseInt(next.staffWindowHours || '5', 10) || 5,
          },
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) alert('Error ARIA: ' + (j.error || res.status))
      else await loadStatus()
    } catch { alert('Error de red.') } finally { setBusy(null) }
  }

  /** Toggle a single feature and persist immediately */
  const toggleFeature = async (key: keyof FeaturesConfig, value: boolean) => {
    const next = { ...features, [key]: value }
    setFeatures(next)
    try {
      const token = await getToken()
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_features', features: { [key]: value } }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setFeatures(features); alert('Error: ' + (j.error || res.status)) }
    } catch { setFeatures(features); alert('Error de red.') }
  }

  /** Toggle a single role and persist immediately */
  const toggleRole = async (key: keyof RolesConfig, value: boolean) => {
    const next = { ...rolesConfig, [key]: value }
    setRolesConfig(next)
    try {
      const token = await getToken()
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_roles_config', roles_config: { [key]: value } }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setRolesConfig(rolesConfig); alert('Error: ' + (j.error || res.status)) }
      else if (j.roles_config) setRolesConfig({ ...DEFAULT_ROLES, ...j.roles_config })
    } catch { setRolesConfig(rolesConfig); alert('Error de red.') }
  }

  const clearErrors = async () => {
    if (!confirm('¿Borrar todos los errores?')) return
    setBusy('clear')
    try {
      const token = await getToken()
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'clear_errors' }),
      })
      setErrors([])
    } catch { /* noop */ } finally { setBusy(null) }
  }


  const logout = async () => { await supabase.auth.signOut(); router.replace('/login') }

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]"><Loader2 className="animate-spin text-sky-400" size={28} /></div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a] p-6 text-center">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 max-w-sm">
          <ShieldCheck size={28} className="text-rose-400 mx-auto mb-3" />
          <p className="text-slate-100 font-bold mb-1">Acceso restringido</p>
          <p className="text-slate-400 text-sm mb-5">Solo para el rol <span className="font-mono text-sky-400">programador</span>.</p>
          <button onClick={() => router.replace('/login')} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold">Volver</button>
        </div>
      </div>
    )
  }

  const activeModules = MAIN_MODULES.filter(m => features[m.key as keyof FeaturesConfig]).length
  const ALL_SUB_TABS = [...PATIENT_TABS, ...INTEL_TABS, ...CEREBRO_TABS, ...PAGOS_TABS, ...REPORTES_TABS, ...RECURSOS_TABS]
  const activeTabs = ALL_SUB_TABS.filter(t => features[t.key as keyof FeaturesConfig]).length
  const activeRoles = ROLE_OPTIONS.filter(r => rolesConfig[r.key as keyof RolesConfig]).length

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200">
      <style>{`
        .ctl-grid{ background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 0); background-size:22px 22px; }
        .ctl-card{ background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.08); border-radius:16px; }
        .ctl-input{ background:rgba(2,6,23,.6); border:1px solid rgba(255,255,255,.1); color:#e2e8f0; }
        .ctl-input::placeholder{ color:#475569; }
        .ctl-input:focus{ border-color:#38bdf8; outline:none; box-shadow:0 0 0 3px rgba(56,189,248,.15); }
      `}</style>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0e1a]/90 backdrop-blur">
        <div className="max-w-[1500px] mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center">
              <ShieldCheck size={18} className="text-sky-400" />
            </div>
            <div>
              <h1 className="font-black text-[15px] leading-tight tracking-tight text-white">Panel del Programador</h1>
              <p className="text-[11px] text-slate-500 font-mono">control.vanty · sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`hidden sm:flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full border ${maintenance ? 'bg-amber-500/10 border-amber-400/30 text-amber-300' : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'}`}>
              <span className="relative flex h-2 w-2">
                {!maintenance && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${maintenance ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </span>
              {maintenance ? 'EN MANTENIMIENTO' : 'OPERATIVO'}
            </span>
            <button onClick={logout} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors">
              <LogOut size={15} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="ctl-grid">
        <div className="max-w-[1500px] mx-auto p-4 md:p-6 flex flex-col gap-5">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="ctl-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Estado</span>
                <Activity size={15} className={maintenance ? 'text-amber-400' : 'text-emerald-400'} />
              </div>
              <p className={`mt-2 text-lg font-black ${maintenance ? 'text-amber-300' : 'text-emerald-300'}`}>{maintenance ? 'Mantenimiento' : 'Operativo'}</p>
              <p className="text-[11px] text-slate-500">{maintenance ? 'Usuarios bloqueados' : 'Todo funcionando'}</p>
            </div>
            <div className="ctl-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Módulos</span>
                <Puzzle size={15} className="text-sky-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-white">{activeModules}<span className="text-sm text-slate-500 font-bold"> / {MAIN_MODULES.length}</span></p>
              <p className="text-[11px] text-slate-500">activos en sidebar</p>
            </div>
            <div className="ctl-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Sub-módulos</span>
                <Layers size={15} className="text-violet-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-white">{activeTabs}<span className="text-sm text-slate-500 font-bold"> / {ALL_SUB_TABS.length}</span></p>
              <p className="text-[11px] text-slate-500">pestañas activas total</p>
            </div>
            <div className="ctl-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Roles</span>
                <Users size={15} className="text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-black text-white">{activeRoles}<span className="text-sm text-slate-500 font-bold"> / {ROLE_OPTIONS.length}</span></p>
              <p className="text-[11px] text-slate-500">roles habilitados</p>
            </div>
          </div>

          {/* ── MÓDULOS DEL SISTEMA ──────────────────────────────────────────── */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center"><Puzzle size={15} className="text-sky-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Módulos del sistema</h2>
              <span className="ml-auto text-[10px] font-bold font-mono text-slate-500">se aplica al instante</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-[42px]">Activa o desactiva secciones enteras de la barra lateral. Los cambios se reflejan de inmediato para todos los usuarios.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {MAIN_MODULES.map(m => {
                const isOn = features[m.key as keyof FeaturesConfig]
                return (
                  <div key={m.key} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors
                    ${isOn ? 'bg-sky-500/5 border-sky-400/20' : 'bg-white/[0.02] border-white/5'}`}>
                    <span className="text-lg leading-none">{m.icon}</span>
                    <span className={`flex-1 text-sm font-semibold ${isOn ? 'text-slate-200' : 'text-slate-500'}`}>{m.label}</span>
                    <Toggle on={isOn} onChange={v => toggleFeature(m.key as keyof FeaturesConfig, v)} />
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── SUB-MÓDULOS ─────────────────────────────────────────────────── */}

          {/* Helper component for sub-module grids */}
          {([
            {
              parentKey: 'ninos' as keyof FeaturesConfig,
              parentLabel: 'Pacientes',
              color: 'violet',
              tabs: PATIENT_TABS,
            },
            {
              parentKey: 'inteligencia' as keyof FeaturesConfig,
              parentLabel: 'Inteligencia Hub',
              color: 'sky',
              tabs: INTEL_TABS,
            },
            {
              parentKey: 'cerebro' as keyof FeaturesConfig,
              parentLabel: 'Cerebro',
              color: 'emerald',
              tabs: CEREBRO_TABS,
            },
            {
              parentKey: 'pagos' as keyof FeaturesConfig,
              parentLabel: 'Pagos y Facturación',
              color: 'amber',
              tabs: PAGOS_TABS,
            },
            {
              parentKey: 'reportes_financieros' as keyof FeaturesConfig,
              parentLabel: 'Reportes Financieros',
              color: 'rose',
              tabs: REPORTES_TABS,
            },
            {
              parentKey: 'recursos_adicionales' as keyof FeaturesConfig,
              parentLabel: 'Recursos Adicionales',
              color: 'teal',
              tabs: RECURSOS_TABS,
            },
          ] as const).map(section => {
            const parentOn = features[section.parentKey]
            const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
              violet: { bg: 'bg-violet-500/5', border: 'border-violet-400/20', text: 'text-violet-400', badge: 'bg-sky-500/10 border-sky-400/30 text-sky-300' },
              sky:    { bg: 'bg-sky-500/5',    border: 'border-sky-400/20',    text: 'text-sky-400',    badge: 'bg-sky-500/10 border-sky-400/30 text-sky-300' },
              emerald:{ bg: 'bg-emerald-500/5',border: 'border-emerald-400/20',text: 'text-emerald-400',badge: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300' },
              amber:  { bg: 'bg-amber-500/5',  border: 'border-amber-400/20',  text: 'text-amber-400',  badge: 'bg-amber-500/10 border-amber-400/30 text-amber-300' },
              rose:   { bg: 'bg-rose-500/5',   border: 'border-rose-400/20',   text: 'text-rose-400',   badge: 'bg-rose-500/10 border-rose-400/30 text-rose-300' },
              teal:   { bg: 'bg-teal-500/5',   border: 'border-teal-400/20',   text: 'text-teal-400',   badge: 'bg-teal-500/10 border-teal-400/30 text-teal-300' },
            }
            const c = colorMap[section.color]
            return (
              <section key={section.parentKey as string} className="ctl-card p-5">
                <div className="flex items-center gap-2.5 mb-1">
                  <div className={`w-8 h-8 rounded-lg ${c.bg} border ${c.border} flex items-center justify-center`}>
                    <Layers size={15} className={c.text} />
                  </div>
                  <h2 className="font-bold text-[15px] text-white">Pestañas: {section.parentLabel}</h2>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${parentOn ? c.badge : 'bg-white/5 border-white/10 text-slate-500'}`}>
                    {parentOn ? 'módulo activo' : 'módulo desactivado'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4 ml-[42px]">Controla qué pestañas aparecen dentro de este módulo.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {(section.tabs as readonly { key: string; label: string; icon: string }[]).map(t => {
                    const isOn = features[t.key as keyof FeaturesConfig]
                    const disabled = !parentOn
                    return (
                      <div key={t.key} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors
                        ${disabled ? 'opacity-40' : ''}
                        ${isOn && !disabled ? `${c.bg} ${c.border}` : 'bg-white/[0.02] border-white/5'}`}>
                        <span className="text-base leading-none">{t.icon}</span>
                        <span className={`flex-1 text-sm font-semibold ${isOn && !disabled ? 'text-slate-200' : 'text-slate-500'}`}>{t.label}</span>
                        <Toggle on={isOn} onChange={v => toggleFeature(t.key as keyof FeaturesConfig, v)} disabled={disabled} />
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* ── ROLES DEL SISTEMA ────────────────────────────────────────────── */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center"><Users size={15} className="text-emerald-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Roles del sistema</h2>
              <span className="ml-auto text-[10px] font-bold font-mono text-slate-500">afecta panel de usuarios</span>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-[42px]">
              Define qué roles aparecen como opción al crear o editar usuarios. El rol <span className="font-mono text-sky-400">Director</span> siempre está activo.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {ROLE_OPTIONS.map(r => {
                const RIcon = r.icon
                const isOn = rolesConfig[r.key as keyof RolesConfig]
                return (
                  <div key={r.key} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3.5 transition-colors
                    ${isOn ? 'bg-emerald-500/5 border-emerald-400/20' : 'bg-white/[0.02] border-white/5'}`}>
                    <RIcon size={15} className={`mt-0.5 shrink-0 ${isOn ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isOn ? 'text-slate-200' : 'text-slate-500'}`}>{r.label}</p>
                      <p className="text-[11px] text-slate-500 leading-tight">{r.desc}</p>
                    </div>
                    <Toggle on={isOn} onChange={v => toggleRole(r.key as keyof RolesConfig, v)} disabled={r.locked} />
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── POBLACIÓN ───────────────────────────────────────────────────── */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center"><Users size={15} className="text-emerald-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Población del sistema</h2>
              <span className="ml-auto text-[10px] font-bold font-mono text-slate-500">en vivo desde la base</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {LIMIT_FIELDS.map(f => {
                const actual = counts[f.key] ?? 0
                const lim = parseInt(limits[f.key] || '0', 10) || 0
                return (
                  <div key={f.key} className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                    <p className="text-[11px] font-semibold text-slate-400 leading-tight">{f.label}</p>
                    <p className="mt-1.5 text-2xl font-black text-white">{actual}{lim > 0 && <span className="text-sm text-slate-500 font-bold"> / {lim}</span>}</p>
                    <p className={`text-[10px] ${lim > 0 && actual >= lim ? 'text-rose-400' : 'text-slate-500'}`}>{lim > 0 ? (actual >= lim ? 'límite alcanzado' : 'dentro del límite') : 'sin tope'}</p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── CENTROS DEMO ─────────────────────────────────────────────────── */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-400/20 flex items-center justify-center"><Building2 size={15} className="text-indigo-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Centros demo</h2>
              <span className="ml-auto text-[10px] font-bold font-mono text-slate-500">{centers.length} centro{centers.length === 1 ? '' : 's'}</span>
            </div>

            {/* Crear centro */}
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4 mb-4">
              <p className="text-[11px] font-bold text-slate-300 mb-3 flex items-center gap-1.5"><Plus size={13} className="text-indigo-400" /> Crear cuenta de demo (admin)</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <input value={newCenter.name} onChange={e => setNewCenter(c => ({ ...c, name: e.target.value }))}
                  placeholder="Nombre del centro" className="ctl-input text-sm rounded-lg px-3 py-2 lg:col-span-1" />
                <input value={newCenter.email} onChange={e => setNewCenter(c => ({ ...c, email: e.target.value }))}
                  placeholder="Correo" type="email" autoComplete="off" className="ctl-input text-sm rounded-lg px-3 py-2 lg:col-span-1" />
                <input value={newCenter.password} onChange={e => setNewCenter(c => ({ ...c, password: e.target.value }))}
                  placeholder="Contraseña" autoComplete="new-password" className="ctl-input text-sm rounded-lg px-3 py-2 lg:col-span-1" />
                <div className="flex items-center gap-1.5">
                  <input value={newCenter.days} onChange={e => setNewCenter(c => ({ ...c, days: e.target.value.replace(/\D/g, '') }))}
                    placeholder="15" inputMode="numeric" className="ctl-input text-sm rounded-lg px-3 py-2 w-20 text-center" />
                  <span className="text-[11px] text-slate-500 font-semibold">días</span>
                </div>
                <button onClick={createCenter} disabled={busy === 'center-create'}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-2 text-xs font-bold text-white transition-colors">
                  {busy === 'center-create' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Crear
                </button>
              </div>
            </div>

            {/* Lista de centros */}
            {centers.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-6">No hay centros demo todavía. Creá el primero arriba.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {centers.map(c => {
                  const dl = daysLeft(c.demo_expires_at)
                  const expired = dl != null && dl <= 0
                  const off = !c.demo_active
                  const stateColor = off ? 'text-slate-500' : expired ? 'text-rose-400' : dl != null && dl <= 3 ? 'text-amber-400' : 'text-emerald-400'
                  const stateLabel = off ? 'Apagado' : expired ? 'Vencido' : dl == null ? 'Sin vencimiento' : `${dl} día${dl === 1 ? '' : 's'} restantes`
                  const cid = 'center-' + c.id
                  return (
                    <div key={c.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5 flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-white truncate">{c.center_name || c.full_name || '(sin nombre)'}</p>
                        <p className="text-[11px] text-slate-500 truncate">{c.email}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[12px] font-black ${stateColor}`}>{stateLabel}</p>
                        <p className="text-[10px] text-slate-600">desde {new Date(c.created_at).toLocaleDateString()}</p>
                      </div>

                      {/* Acciones */}
                      <div className="flex items-center gap-1.5">
                        <button title="+7 días" onClick={() => updateCenter(c.id, { add_days: 7 }, cid)} disabled={busy === cid}
                          className="flex items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 disabled:opacity-50">
                          <CalendarClock size={12} /> +7d
                        </button>
                        <button title="Fijar días" onClick={() => {
                            const v = prompt('¿Cuántos días de demo desde hoy?', String(dl != null && dl > 0 ? dl : 15))
                            if (v == null) return
                            const n = parseInt(v, 10); if (!Number.isFinite(n) || n <= 0) { alert('Número inválido.'); return }
                            updateCenter(c.id, { days: n }, cid)
                          }} disabled={busy === cid}
                          className="flex items-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 disabled:opacity-50">
                          <Pencil size={12} /> Días
                        </button>
                        <button title={off ? 'Encender' : 'Apagar'} onClick={() => updateCenter(c.id, { demo_active: off }, cid)} disabled={busy === cid}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 ${off ? 'bg-emerald-600/80 hover:bg-emerald-600 text-white' : 'bg-amber-600/80 hover:bg-amber-600 text-white'}`}>
                          {off ? <Power size={12} /> : <PowerOff size={12} />} {off ? 'Encender' : 'Apagar'}
                        </button>
                        <button title="Eliminar centro" onClick={() => deleteCenter(c)} disabled={busy === 'center-del-' + c.id}
                          className="flex items-center justify-center rounded-lg bg-rose-600/80 hover:bg-rose-600 p-1.5 text-white disabled:opacity-50">
                          {busy === 'center-del-' + c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* ── MANTENIMIENTO + ARIA ─────────────────────────────────────────── */}
          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <section className="ctl-card p-5">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-400/20 flex items-center justify-center"><Power size={15} className="text-amber-400" /></div>
                <h2 className="font-bold text-[15px] text-white">Modo mantenimiento</h2>
                <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full border ${maintenance ? 'bg-amber-500/10 border-amber-400/30 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                  {maintenance ? 'ACTIVO' : 'APAGADO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3 ml-[42px]">Cuando está activo, todos (menos tú) ven el mensaje y no pueden usar la app.</p>
              <textarea
                value={maintMsg}
                onChange={e => setMaintMsg(e.target.value)}
                rows={2}
                placeholder="Mensaje para los usuarios (opcional)."
                className="ctl-input w-full text-sm rounded-xl px-3 py-2.5 mb-3 transition-shadow"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => saveMaintenance(!maintenance)} disabled={busy === 'maint'}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors shadow-lg ${maintenance ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
                  {busy === 'maint' ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                  {maintenance ? 'Desactivar' : 'Activar mantenimiento'}
                </button>
                <button onClick={saveMsg} disabled={busy === 'maint'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-50">
                  <Save size={14} /> Guardar mensaje
                </button>
              </div>
            </section>

            <section className="ctl-card p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-400/20 flex items-center justify-center"><Bot size={15} className="text-violet-300" /></div>
                <h2 className="font-bold text-[15px] text-white">ARIA · IA</h2>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5 mb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-bold text-white">Padres / familias</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${aria.enabled ? 'bg-violet-500/10 border-violet-400/30 text-violet-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{aria.enabled ? 'LÍMITE ACTIVO' : 'SIN LÍMITE'}</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide"><MessageSquare size={11} className="inline mr-1" />Máx. mensajes</span>
                    <input type="number" min={0} value={aria.maxMessages} onChange={e => setAria(a => ({ ...a, maxMessages: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="∞" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide"><Clock size={11} className="inline mr-1" />Cada (horas)</span>
                    <input type="number" min={1} value={aria.windowHours} onChange={e => setAria(a => ({ ...a, windowHours: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="5" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => saveAria({ enabled: !aria.enabled })} disabled={busy === 'aria'} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 ${aria.enabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'}`}>{busy === 'aria' ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}{aria.enabled ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => saveAria()} disabled={busy === 'aria'} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-50"><Save size={13} /> Guardar</button>
                  </div>
                </div>
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-bold text-white">Personal (jefe / especialista)</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${aria.staffEnabled ? 'bg-violet-500/10 border-violet-400/30 text-violet-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{aria.staffEnabled ? 'LÍMITE ACTIVO' : 'SIN LÍMITE'}</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide"><MessageSquare size={11} className="inline mr-1" />Máx. mensajes</span>
                    <input type="number" min={0} value={aria.staffMaxMessages} onChange={e => setAria(a => ({ ...a, staffMaxMessages: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="∞" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide"><Clock size={11} className="inline mr-1" />Cada (horas)</span>
                    <input type="number" min={1} value={aria.staffWindowHours} onChange={e => setAria(a => ({ ...a, staffWindowHours: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="5" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => saveAria({ staffEnabled: !aria.staffEnabled })} disabled={busy === 'aria'} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 ${aria.staffEnabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'}`}>{busy === 'aria' ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}{aria.staffEnabled ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => saveAria()} disabled={busy === 'aria'} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-50"><Save size={13} /> Guardar</button>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── LÍMITES DE PERFILES ──────────────────────────────────────────── */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center"><Gauge size={15} className="text-sky-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Límites de perfiles</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-[42px]">Tope máximo por tipo. Vacío o 0 = sin límite.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {LIMIT_FIELDS.map(f => (
                <label key={f.key} className="flex items-center justify-between gap-3 text-sm rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-300 font-semibold truncate">{f.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 shrink-0">{counts[f.key] ?? 0} ahora</span>
                  </span>
                  <input type="number" min={0} value={limits[f.key] ?? ''} onChange={e => setLimits(s => ({ ...s, [f.key]: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="∞" className="ctl-input w-20 text-sm rounded-lg px-2 py-1.5 text-right font-mono shrink-0" />
                </label>
              ))}
            </div>
            <button onClick={saveLimits} disabled={busy === 'limits'}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 shadow-lg shadow-sky-900/40">
              {busy === 'limits' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar límites
            </button>
          </section>

          {/* ── ERRORES ──────────────────────────────────────────────────────── */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-400/20 flex items-center justify-center"><Terminal size={15} className="text-rose-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Errores del sistema</h2>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">{errors.length}</span>
              <span className="text-[10px] text-slate-600 font-mono hidden sm:inline">· se auto-limpian errores &gt;{autoPurgeDays}d al cargar</span>
              <div className="ml-auto flex items-center gap-3 flex-wrap">
                {/* Auto-purge config */}
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock size={11} />
                  Auto-limpiar tras
                  <select
                    value={autoPurgeDays}
                    onChange={e => setAutoPurgeDays(Number(e.target.value))}
                    className="ctl-input text-[11px] rounded-lg px-2 py-1 font-mono"
                    style={{ width: '72px' }}
                  >
                    {[1, 3, 7, 14, 30].map(d => (
                      <option key={d} value={d}>{d} día{d !== 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => { loadErrors(); loadCounts() }} className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300"><RefreshCw size={13} /> Actualizar</button>
                <button onClick={clearErrors} disabled={busy === 'clear'} className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 disabled:opacity-50"><Trash2 size={13} /> Limpiar todo</button>
              </div>
            </div>
            {errors.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={22} className="text-emerald-400" />
                </div>
                <p className="text-sm text-slate-300 font-semibold">Sin errores registrados</p>
                <p className="text-xs text-slate-500">El sistema está limpio.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[460px] overflow-auto pr-1">
                {errors.map(e => (
                  <div key={e.id} className="rounded-xl border border-white/5 bg-black/30 overflow-hidden">
                    <button onClick={() => setOpenErr(openErr === e.id ? null : e.id)} className="w-full text-left px-3 py-2.5 flex items-start gap-2.5 hover:bg-white/[0.03] transition-colors">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 shrink-0 shadow-[0_0_8px_rgba(244,63,94,.6)]" />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-400/20 text-sky-300 shrink-0">{e.source || 'app'}</span>
                          <span className="text-[13px] font-medium text-slate-200 truncate font-mono">{e.message || '(sin mensaje)'}</span>
                        </span>
                        <span className="block text-[10px] text-slate-500 mt-1 font-mono">{new Date(e.created_at).toLocaleString('es-PE')}{e.user_email ? ` · ${e.user_email}` : ''}</span>
                      </span>
                      <ChevronDown size={15} className={`text-slate-500 shrink-0 mt-1 transition-transform ${openErr === e.id ? 'rotate-180' : ''}`} />
                    </button>
                    {openErr === e.id && (
                      <div className="px-3 pb-3">
                        {e.url && <p className="text-[10px] text-slate-500 break-all mb-1.5 font-mono">URL: {e.url}</p>}
                        <pre className="text-[11px] leading-relaxed text-emerald-300/90 whitespace-pre-wrap break-words bg-black/50 border border-white/10 rounded-lg p-3 max-h-72 overflow-auto font-mono">{e.detail || '(sin detalle)'}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-center text-[11px] text-slate-600 font-mono pb-2">Vanty ABA · panel restringido · rol programador</p>
        </div>
      </main>
    </div>
  )
}
