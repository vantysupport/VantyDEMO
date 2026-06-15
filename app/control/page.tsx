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
  const [errors, setErrors] = useState<ErrLog[]>([])
  const [openErr, setOpenErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/control', { cache: 'no-store' })
      const j = await r.json()
      setMaintenance(!!j.maintenance)
      setMaintMsg(j.maintenance_msg || '')
      const lim: Record<string, string> = {}
      for (const f of LIMIT_FIELDS) lim[f.key] = j.limits?.[f.key] ? String(j.limits[f.key]) : ''
      setLimits(lim)
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
    })()
  }, [router, loadStatus, loadErrors])

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
      if (!r.ok) setMaintenance(!on)
    } catch { setMaintenance(!on) } finally { setBusy(null) }
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
      await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_limits', limits: payload }),
      })
    } catch { /* noop */ } finally { setBusy(null) }
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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-sky-600" size={28} /></div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center">
        <div>
          <p className="text-slate-700 font-bold mb-2">Acceso restringido</p>
          <p className="text-slate-500 text-sm mb-4">Esta sección es solo para el rol programador.</p>
          <button onClick={() => router.replace('/login')} className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-bold">Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-sky-400" />
          <div>
            <h1 className="font-black text-base leading-tight">Panel del Programador</h1>
            <p className="text-[11px] text-slate-400">Control del sistema · SANTI</p>
          </div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white">
          <LogOut size={15} /> Salir
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 md:p-6 flex flex-col gap-5">
        {/* Modo mantenimiento */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Power size={16} className={maintenance ? 'text-amber-600' : 'text-slate-400'} />
            <h2 className="font-extrabold text-sm">Modo mantenimiento</h2>
            <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full ${maintenance ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {maintenance ? 'ACTIVO' : 'Apagado'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Cuando está activo, todos (menos tú) ven el mensaje de soporte y no pueden usar la app. Tú sí sigues entrando.
          </p>
          <textarea
            value={maintMsg}
            onChange={e => setMaintMsg(e.target.value)}
            rows={2}
            placeholder="Mensaje para los usuarios (opcional). Ej: Estamos realizando mejoras…"
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-sky-400 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveMaintenance(!maintenance)} disabled={busy === 'maint'}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 ${maintenance ? 'bg-emerald-600' : 'bg-amber-600'}`}>
              {busy === 'maint' ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              {maintenance ? 'Desactivar mantenimiento' : 'Activar mantenimiento'}
            </button>
            <button
              onClick={async () => { setBusy('maint'); try { const token = await getToken(); await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'set_maintenance', on: maintenance, msg: maintMsg }) }) } finally { setBusy(null) } }}
              disabled={busy === 'maint'}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-slate-100 text-slate-600 disabled:opacity-50">
              <Save size={14} /> Guardar mensaje
            </button>
          </div>
        </section>

        {/* Límites de perfiles */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users size={16} className="text-sky-500" />
            <h2 className="font-extrabold text-sm">Límites de perfiles</h2>
          </div>
          <p className="text-xs text-slate-500 mb-3">Cantidad máxima por tipo. Vacío o 0 = sin límite. (Por ahora solo advierte al crear.)</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {LIMIT_FIELDS.map(f => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600 font-semibold">{f.label}</span>
                <input
                  type="number" min={0} inputMode="numeric"
                  value={limits[f.key] ?? ''}
                  onChange={e => setLimits(s => ({ ...s, [f.key]: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="∞"
                  className="w-24 text-sm rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-sky-400 text-right"
                />
              </label>
            ))}
          </div>
          <button onClick={saveLimits} disabled={busy === 'limits'}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-sky-600 text-white disabled:opacity-50">
            {busy === 'limits' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar límites
          </button>
        </section>

        {/* Registro de errores */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-rose-500" />
            <h2 className="font-extrabold text-sm">Errores del sistema</h2>
            <span className="text-[11px] font-bold text-slate-400">{errors.length}</span>
            <div className="ml-auto flex gap-2">
              <button onClick={loadErrors} className="flex items-center gap-1 text-xs font-bold text-sky-600"><RefreshCw size={13} /> Actualizar</button>
              <button onClick={clearErrors} disabled={busy === 'clear'} className="flex items-center gap-1 text-xs font-bold text-rose-600 disabled:opacity-50"><Trash2 size={13} /> Limpiar</button>
            </div>
          </div>
          {errors.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">Sin errores registrados. 🎉</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[420px] overflow-auto">
              {errors.map(e => (
                <div key={e.id} className="rounded-lg border border-slate-100 bg-slate-50">
                  <button onClick={() => setOpenErr(openErr === e.id ? null : e.id)} className="w-full text-left px-3 py-2 flex items-start gap-2">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 shrink-0 mt-0.5">{e.source || 'app'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-semibold text-slate-700 truncate">{e.message || '(sin mensaje)'}</span>
                      <span className="block text-[10px] text-slate-400">{new Date(e.created_at).toLocaleString('es-PE')}{e.user_email ? ` · ${e.user_email}` : ''}</span>
                    </span>
                  </button>
                  {openErr === e.id && (
                    <div className="px-3 pb-2">
                      {e.url && <p className="text-[10px] text-slate-400 break-all mb-1">URL: {e.url}</p>}
                      <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white border border-slate-200 rounded p-2 max-h-60 overflow-auto">{e.detail || '(sin detalle)'}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
