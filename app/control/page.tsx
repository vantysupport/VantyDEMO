'use client'
// app/control/page.tsx — Panel del PROGRAMADOR (rol asignado solo en Supabase).
//  • Modo mantenimiento (mensaje de soporte a todos menos al programador).
//  • Límites de perfiles (solo advertir).
//  • Registro de errores reales (DB/APIs) — solo visibles aquí.

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ShieldCheck, Power, Users, AlertTriangle, RefreshCw, Trash2, Save, LogOut, Loader2,
  Activity, ChevronDown, Gauge, Terminal, Bot, Clock, MessageSquare,
} from 'lucide-react'

type ErrLog = { id: string; message: string; detail: string; source: string; url: string; user_email: string; created_at: string }

const LIMIT_FIELDS = [
  { key: 'admin', label: 'Admins / Directores' },
  { key: 'especialista', label: 'Especialistas' },
  { key: 'secretaria', label: 'Secretarias' },
  { key: 'padre', label: 'Padres / Tutores' },
  { key: 'paciente', label: 'Pacientes' },
]

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
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<ErrLog[]>([])
  const [openErr, setOpenErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

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
    })()
  }, [router, loadStatus, loadErrors, loadCounts])

  const saveMaintenance = async (on: boolean) => {
    setBusy('maint')
    setMaintenance(on)
    try {
      const token = await getToken()
      const r = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_maintenance', on, msg: maintMsg }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setMaintenance(!on); alert('No se pudo guardar: ' + (j.error || r.status)) }
    } catch { setMaintenance(!on) } finally { setBusy(null) }
  }

  const saveMsg = async () => {
    setBusy('maint')
    try {
      const token = await getToken()
      const r = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_maintenance', on: maintenance, msg: maintMsg }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) alert('No se pudo guardar el mensaje: ' + (j.error || r.status))
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
      if (!res.ok) alert('No se pudieron guardar los límites: ' + (j.error || res.status))
      else await loadStatus()
    } catch { alert('Error de red al guardar límites.') } finally { setBusy(null) }
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
      if (!res.ok) alert('No se pudo guardar ARIA: ' + (j.error || res.status) + '\n(¿Corriste el SQL de control-programador con aria_limits?)')
      else await loadStatus()
    } catch { alert('Error de red al guardar ARIA.') } finally { setBusy(null) }
  }

  const clearErrors = async () => {
    if (!confirm('¿Borrar todos los errores registrados?')) return
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
          <p className="text-slate-400 text-sm mb-5">Esta sección es solo para el rol <span className="font-mono text-sky-400">programador</span>.</p>
          <button onClick={() => router.replace('/login')} className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold transition-colors">Volver al inicio</button>
        </div>
      </div>
    )
  }

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
              <p className="text-[11px] text-slate-500 font-mono">control.santi · sistema</p>
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
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Errores</span>
                <AlertTriangle size={15} className={errors.length ? 'text-rose-400' : 'text-slate-500'} />
              </div>
              <p className={`mt-2 text-2xl font-black ${errors.length ? 'text-rose-300' : 'text-slate-200'}`}>{errors.length}</p>
              <p className="text-[11px] text-slate-500">registrados</p>
            </div>
            <div className="ctl-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Mantenim.</span>
                <Power size={15} className={maintenance ? 'text-amber-400' : 'text-slate-500'} />
              </div>
              <p className={`mt-2 text-lg font-black ${maintenance ? 'text-amber-300' : 'text-slate-300'}`}>{maintenance ? 'Activo' : 'Apagado'}</p>
              <p className="text-[11px] text-slate-500">interruptor global</p>
            </div>
            <div className="ctl-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">ARIA</span>
                <Bot size={15} className={aria.enabled ? 'text-violet-300' : 'text-slate-500'} />
              </div>
              <p className={`mt-2 text-lg font-black ${aria.enabled ? 'text-violet-200' : 'text-slate-300'}`}>{aria.enabled ? 'Con límite' : 'Sin límite'}</p>
              <p className="text-[11px] text-slate-500">{aria.enabled ? `${aria.maxMessages || '∞'} msg / ${aria.windowHours}h` : 'IA de padres'}</p>
            </div>
          </div>

          {/* Población del sistema — conteos reales desde la base */}
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

          {/* Mantenimiento + ARIA — lado a lado en pantallas grandes */}
          <div className="grid lg:grid-cols-2 gap-5 items-start">
            {/* Modo mantenimiento */}
            <section className="ctl-card p-5">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-400/20 flex items-center justify-center"><Power size={15} className="text-amber-400" /></div>
                <h2 className="font-bold text-[15px] text-white">Modo mantenimiento</h2>
                <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-full border ${maintenance ? 'bg-amber-500/10 border-amber-400/30 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                  {maintenance ? 'ACTIVO' : 'APAGADO'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3 ml-[42px]">
                Cuando está activo, todos (menos tú) ven el mensaje de soporte y no pueden usar la app. Tú sí sigues entrando.
              </p>
              <textarea
                value={maintMsg}
                onChange={e => setMaintMsg(e.target.value)}
                rows={2}
                placeholder="Mensaje para los usuarios (opcional). Ej: Estamos realizando mejoras…"
                className="ctl-input w-full text-sm rounded-xl px-3 py-2.5 mb-3 transition-shadow"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => saveMaintenance(!maintenance)} disabled={busy === 'maint'}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-colors shadow-lg ${maintenance ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40'}`}>
                  {busy === 'maint' ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                  {maintenance ? 'Desactivar mantenimiento' : 'Activar mantenimiento'}
                </button>
                <button onClick={saveMsg} disabled={busy === 'maint'}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-50 transition-colors">
                  <Save size={14} /> Guardar mensaje
                </button>
              </div>
            </section>

            {/* ARIA · IA — límites por audiencia */}
            <section className="ctl-card p-5">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-400/20 flex items-center justify-center"><Bot size={15} className="text-violet-300" /></div>
                <h2 className="font-bold text-[15px] text-white">ARIA · IA</h2>
              </div>

              {/* Padres / familias */}
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5 mb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-bold text-white">Padres / familias</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${aria.enabled ? 'bg-violet-500/10 border-violet-400/30 text-violet-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{aria.enabled ? 'LÍMITE ACTIVO' : 'SIN LÍMITE'}</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><MessageSquare size={11} /> Máx. mensajes</span>
                    <input type="number" min={0} inputMode="numeric" value={aria.maxMessages} onChange={e => setAria(a => ({ ...a, maxMessages: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="∞" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Clock size={11} /> Cada (horas)</span>
                    <input type="number" min={1} inputMode="numeric" value={aria.windowHours} onChange={e => setAria(a => ({ ...a, windowHours: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="5" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => saveAria({ enabled: !aria.enabled })} disabled={busy === 'aria'} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-colors ${aria.enabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'}`}>{busy === 'aria' ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}{aria.enabled ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => saveAria()} disabled={busy === 'aria'} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-50"><Save size={13} /> Guardar</button>
                  </div>
                </div>
              </div>

              {/* Personal (jefe / especialista) */}
              <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-bold text-white">Personal (jefe / especialista)</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${aria.staffEnabled ? 'bg-violet-500/10 border-violet-400/30 text-violet-200' : 'bg-white/5 border-white/10 text-slate-400'}`}>{aria.staffEnabled ? 'LÍMITE ACTIVO' : 'SIN LÍMITE'}</span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><MessageSquare size={11} /> Máx. mensajes</span>
                    <input type="number" min={0} inputMode="numeric" value={aria.staffMaxMessages} onChange={e => setAria(a => ({ ...a, staffMaxMessages: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="∞" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Clock size={11} /> Cada (horas)</span>
                    <input type="number" min={1} inputMode="numeric" value={aria.staffWindowHours} onChange={e => setAria(a => ({ ...a, staffWindowHours: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="5" className="ctl-input w-24 text-sm rounded-lg px-3 py-2 font-mono" />
                  </label>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => saveAria({ staffEnabled: !aria.staffEnabled })} disabled={busy === 'aria'} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 transition-colors ${aria.staffEnabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-violet-600 hover:bg-violet-500'}`}>{busy === 'aria' ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}{aria.staffEnabled ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => saveAria()} disabled={busy === 'aria'} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 disabled:opacity-50"><Save size={13} /> Guardar</button>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">Ejemplo: 20 mensajes cada 5 horas. Vacío o 0 = sin tope. Aplica por persona.</p>
            </section>
          </div>

          {/* Límites de perfiles */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-400/20 flex items-center justify-center"><Gauge size={15} className="text-sky-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Límites de perfiles</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4 ml-[42px]">Tope máximo por tipo (el badge muestra cuántos hay ahora). Vacío o 0 = sin límite. <span className="text-slate-500">Padres se bloquea al registrar; el resto avisa.</span></p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {LIMIT_FIELDS.map(f => (
                <label key={f.key} className="flex items-center justify-between gap-3 text-sm rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-300 font-semibold truncate">{f.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 shrink-0">{counts[f.key] ?? 0} ahora</span>
                  </span>
                  <input
                    type="number" min={0} inputMode="numeric"
                    value={limits[f.key] ?? ''}
                    onChange={e => setLimits(s => ({ ...s, [f.key]: e.target.value.replace(/[^0-9]/g, '') }))}
                    placeholder="∞"
                    className="ctl-input w-20 text-sm rounded-lg px-2 py-1.5 text-right font-mono transition-shadow shrink-0"
                  />
                </label>
              ))}
            </div>
            <button onClick={saveLimits} disabled={busy === 'limits'}
              className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-50 transition-colors shadow-lg shadow-sky-900/40">
              {busy === 'limits' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar límites
            </button>
          </section>

          {/* Registro de errores */}
          <section className="ctl-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-400/20 flex items-center justify-center"><Terminal size={15} className="text-rose-400" /></div>
              <h2 className="font-bold text-[15px] text-white">Errores del sistema</h2>
              <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">{errors.length}</span>
              <div className="ml-auto flex gap-3">
                <button onClick={loadErrors} className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"><RefreshCw size={13} /> Actualizar</button>
                <button onClick={clearErrors} disabled={busy === 'clear'} className="flex items-center gap-1.5 text-xs font-bold text-rose-400 hover:text-rose-300 disabled:opacity-50 transition-colors"><Trash2 size={13} /> Limpiar</button>
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

          <p className="text-center text-[11px] text-slate-600 font-mono pb-2">SANTI · panel restringido · rol programador</p>
        </div>
      </main>
    </div>
  )
}
