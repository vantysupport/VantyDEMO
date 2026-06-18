'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/components/ThemeContext'
import {
  ArrowLeft, Baby, BarChart3, Brain, Calendar, Check, ChevronRight,
  ClipboardList, Edit, Link, Link2Off, Loader2, Mail, Plus, Save,
  Search, Stethoscope, User, UserCheck, Users, X,
  FolderOpen, FileText, Heart, Trash2, Settings, Smile, Meh, Frown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getControlStatus } from '@/lib/control'
import { adminFetch } from '@/lib/admin-fetch'
import { useToast } from '@/components/Toast'
import { calcularEdadNumerica } from '../utils/helpers'
import ProgramasABAView from './ProgramasABAView'
import EvaluacionesUnificadas from './EvaluacionesUnificadas'
import AIReportView from './AIReportView'
import DocumentosView from './DocumentosView'
import { RellenarFicha, GestorPlantillas } from './PlantillasClinicas'
import EvaluacionInicialAdmin from './EvaluacionInicialAdmin'

// ── Color badge por diagnóstico ────────────────────────────────────────────
const DX_BORDER: Record<string, string> = {
  'TEA': '#0284c7', 'TDAH': '#0891b2', 'Retraso': '#f59e0b', 'Autismo': '#0284c7',
  'TDA': '#0891b2', 'TDL': '#10b981',
}
const getDxStyle = (dx: string) => {
  const k = Object.keys(DX_BORDER).find(k => dx?.includes(k))
  const color = k ? DX_BORDER[k] : '#64748b'
  return { background: `${color}10`, color, border: `1px solid ${color}30` }
}

// ── Nombre a mostrar según rol (apodo para admin/secretaria) ──────────────
const getDisplayName = (p: any, role: string) => {
  const useApodo = ['admin', 'secretaria', 'jefe'].includes(role)
  return (useApodo && p.apodo) ? p.apodo : p.name
}
const PALETTES = [
  'from-sky-500 to-sky-600', 'from-blue-500 to-sky-600',
  'from-emerald-500 to-teal-600',  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm'|'md'|'lg' }) {
  const pal = PALETTES[name.charCodeAt(0) % PALETTES.length]
  const sz  = { sm: 'w-9 h-9 text-base', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' }[size]
  return (
    <div className={`bg-gradient-to-br ${pal} ${sz} rounded-2xl flex items-center justify-center font-bold text-white flex-shrink-0 shadow-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── InfoCard premium (ícono en tile tintado + jerarquía) ───────────────────
function InfoCard({ icon: Icon, label, color = '#0284c7', children }: {
  icon: any; label: string; color?: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl p-4 transition-all hover:shadow-md"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, color }}>
          <Icon size={13} />
        </div>
        <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      {children}
    </div>
  )
}

// ── InfoPill ──────────────────────────────────────────────────────────────
function InfoPill({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl space-y-1" style={{ background: 'var(--muted-bg)' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-sky-500">{icon}</span>
        <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{value || '—'}</p>
    </div>
  )
}

// ── Sección vinculación de cuenta ─────────────────────────────────────────
function LinkedAccountSection({ nino, onLinked }: { nino: any; onLinked: () => void }) {
  const toast = useToast()
  const [linkedUser, setLinkedUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  // Cargar usuario vinculado
  useEffect(() => {
    const fetchLinked = async () => {
      if (!nino.parent_id) { setLinkedUser(null); return }
      setLoadingUser(true)
      const { data } = await supabase.from('profiles').select('id, full_name, email, role').eq('id', nino.parent_id).maybeSingle()
      setLinkedUser(data || null)
      setLoadingUser(false)
    }
    fetchLinked()
  }, [nino.id, nino.parent_id])

  const handleSearch = async () => {
    if (!emailSearch.trim()) return
    setSearching(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .ilike('email', `%${emailSearch.trim()}%`)
        .in('role', ['padre', 'jefe', 'especialista', 'admin'])
        .limit(8)
      setSearchResults(data || [])
    } catch (e: any) { toast.error(e.message) }
    finally { setSearching(false) }
  }

  const handleLink = async (user: any) => {
    setLinking(true)
    try {
      const res = await adminFetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: nino.id, parentId: user.id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`${nino.name} vinculado a ${user.full_name || user.email}`)
      setLinkedUser(user)
      setShowLinkModal(false)
      setEmailSearch(''); setSearchResults([])
      onLinked()
    } catch (e: any) { toast.error(e.message) }
    finally { setLinking(false) }
  }

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await adminFetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: nino.id, parentId: null }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Paciente desvinculado de la cuenta')
      setLinkedUser(null)
      onLinked()
    } catch (e: any) { toast.error(e.message) }
    finally { setUnlinking(false) }
  }

  return (
    <>
      <div className="rounded-2xl p-4 mt-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <UserCheck size={13} style={{ color: 'var(--text-muted)' }} />
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
              Cuenta vinculada
            </p>
          </div>
          {!loadingUser && (
            linkedUser
              ? <button onClick={handleUnlink} disabled={unlinking}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                  {unlinking ? <Loader2 size={10} className="animate-spin"/> : <Link2Off size={10}/>}
                  Desvincular
                </button>
              : <button onClick={() => setShowLinkModal(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                  style={{ background: '#dbeafe', color: '#2563eb', border: '1px solid #93c5fd' }}>
                  <Link size={10}/> Vincular cuenta
                </button>
          )}
        </div>

        {loadingUser
          ? <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }}/></div>
          : linkedUser
            ? <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-white"/>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: '#065f46' }}>
                    {linkedUser.full_name || '(sin nombre)'}
                  </p>
                  <p className="text-xs truncate flex items-center gap-1" style={{ color: '#059669' }}>
                    <Mail size={10}/>{linkedUser.email}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#d1fae5', color: '#065f46' }}>
                  {linkedUser.role}
                </span>
              </div>
            : <div className="flex flex-col items-center py-3 gap-2 text-center">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted-bg)' }}>
                  <Link size={16} style={{ color: 'var(--text-muted)' }}/>
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Sin cuenta vinculada</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Vincula una cuenta para que el padre/tutor acceda al portal
                  </p>
                </div>
              </div>
        }
      </div>

      {/* Modal de búsqueda y vinculación */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl p-5 space-y-4"
            style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Vincular cuenta a {nino.name}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Busca por email del padre, tutor o familiar
                </p>
              </div>
              <button onClick={() => { setShowLinkModal(false); setEmailSearch(''); setSearchResults([]) }}
                className="p-2 rounded-xl hover:bg-slate-100">
                <X size={16} style={{ color: 'var(--text-muted)' }}/>
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}/>
                <input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={emailSearch}
                  onChange={e => setEmailSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border outline-none"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                />
              </div>
              <button onClick={handleSearch} disabled={searching || !emailSearch.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-sky-600 text-white disabled:opacity-50 flex items-center gap-1.5">
                {searching ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
                Buscar
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {searchResults.map(u => (
                  <div key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-sky-50 dark:hover:bg-blue-900/20 transition-all"
                    style={{ borderColor: 'var(--card-border)' }}>
                    <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-white"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {u.full_name || '(sin nombre)'}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                    </div>
                    <button onClick={() => handleLink(u)} disabled={linking}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-sky-600 text-white disabled:opacity-50 flex-shrink-0">
                      {linking ? <Loader2 size={10} className="animate-spin"/> : <Link size={10}/>}
                      Vincular
                    </button>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && emailSearch && !searching && (
              <div className="text-center py-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  No se encontraron usuarios con ese email
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Primero crea la cuenta del padre desde Gestión de Usuarios
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Card de bienestar del padre ────────────────────────────────────────────
// Muestra el último chequeo de bienestar y el historial (collapsable).
const MOOD_CONFIG: Record<string, { Icon: any; label: string; bg: string; border: string; color: string }> = {
  bien:    { Icon: Smile, label: 'Bien',    bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  regular: { Icon: Meh,   label: 'Regular', bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
  dificil: { Icon: Frown, label: 'Difícil', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
}

function ParentWellbeingCard({ childId }: { childId: string }) {
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/parent-wellbeing?child_id=${childId}&limit=12`)
      .then(r => r.json())
      .then(json => { if (!cancelled) setCheckins(json?.data || []) })
      .catch(() => { if (!cancelled) setCheckins([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [childId])

  if (loading) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Heart size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            Bienestar del padre/madre
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={12} className="animate-spin" /> Cargando...
        </div>
      </div>
    )
  }

  if (checkins.length === 0) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Heart size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            Bienestar del padre/madre
          </p>
        </div>
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
          Aún no hay chequeos de bienestar registrados. El padre/madre los recibe mensualmente desde su app.
        </p>
      </div>
    )
  }

  const ultimo = checkins[0]
  const cfg = MOOD_CONFIG[ultimo.mood] || MOOD_CONFIG.regular
  const fechaUltimo = new Date(ultimo.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Heart size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            Bienestar del padre/madre
          </p>
        </div>
        {checkins.length > 1 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] font-semibold hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            {expanded ? 'Ocultar historial' : `Ver historial (${checkins.length})`}
          </button>
        )}
      </div>

      {/* Último check-in */}
      <div
        className="rounded-lg p-3 flex items-start gap-3"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {(() => { const MI = cfg.Icon; return <MI size={26} style={{ color: cfg.color, flexShrink: 0 }} /> })()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
            <p className="text-[10px]" style={{ color: cfg.color, opacity: 0.75 }}>{fechaUltimo}</p>
          </div>
          {ultimo.nota && (
            <p className="text-xs mt-1.5 italic leading-relaxed" style={{ color: cfg.color }}>
              "{ultimo.nota}"
            </p>
          )}
        </div>
      </div>

      {/* Historial expandido */}
      {expanded && checkins.length > 1 && (
        <div className="mt-3 space-y-1.5">
          {checkins.slice(1).map((c: any) => {
            const ccfg = MOOD_CONFIG[c.mood] || MOOD_CONFIG.regular
            const fecha = new Date(c.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
            return (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-lg p-2"
                style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
              >
                {(() => { const MI = ccfg.Icon; return <MI size={15} style={{ color: ccfg.color, flexShrink: 0 }} /> })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>{ccfg.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fecha}</p>
                  </div>
                  {c.nota && (
                    <p className="text-[11px] mt-0.5 italic" style={{ color: 'var(--text-secondary)' }}>"{c.nota}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Card: Contador de sesiones (auto desde agenda + ajuste manual histórico) ──
function SessionCounterCard({ nino, onSaved }: { nino: any; onSaved: () => void }) {
  const toast = useToast()
  const [sessionsBefore, setSessionsBefore] = useState<number>(nino.sessions_before_platform || 0)
  const [autoCount, setAutoCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [tempInput, setTempInput] = useState(String(nino.sessions_before_platform || 0))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSessionsBefore(nino.sessions_before_platform || 0)
    setTempInput(String(nino.sessions_before_platform || 0))
  }, [nino.id, nino.sessions_before_platform])

  // Contar sesiones reales en la plataforma:
  //   appointments con status completed/completada/realizada + aba_sessions_v2 + agenda_sesiones realizadas
  // Tomamos el MAX entre las fuentes (no se suman porque pueden solaparse)
  useEffect(() => {
    let cancelled = false
    async function loadAuto() {
      setLoading(true)
      try {
        const [a, b, c] = await Promise.all([
          supabase.from('appointments').select('id', { count: 'exact', head: true })
            .eq('child_id', nino.id).in('status', ['completed','completada','realizada']),
          supabase.from('agenda_sesiones').select('id', { count: 'exact', head: true })
            .eq('child_id', nino.id).in('estado', ['realizada','completada','completed']),
          supabase.from('aba_sessions_v2').select('id', { count: 'exact', head: true })
            .eq('child_id', nino.id),
        ])
        const max = Math.max(a.count || 0, b.count || 0, c.count || 0)
        if (!cancelled) setAutoCount(max)
      } catch { /* silencioso */ }
      finally { if (!cancelled) setLoading(false) }
    }
    loadAuto()
    return () => { cancelled = true }
  }, [nino.id])

  const total = sessionsBefore + autoCount

  const handleSave = async () => {
    const n = parseInt(tempInput.replace(/[^0-9]/g, ''), 10)
    if (isNaN(n) || n < 0) { toast.error('Ingresá un número válido (0 o mayor)'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('children')
        .update({ sessions_before_platform: n })
        .eq('id', nino.id)
      if (error) throw error
      setSessionsBefore(n)
      setEditing(false)
      toast.success('✓ Contador actualizado')
      onSaved()
    } catch (e: any) {
      toast.error('Error: ' + (e?.message || 'no se pudo guardar'))
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <BarChart3 size={12} style={{ color: 'var(--text-muted)' }} />
          <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            Total de sesiones del paciente
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => { setTempInput(String(sessionsBefore)); setEditing(true) }}
            className="flex items-center gap-1 text-[10px] font-semibold hover:underline"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Edit size={10}/> Ajustar previas
          </button>
        )}
      </div>

      {/* Total grande */}
      <div className="flex items-baseline gap-2 mb-3">
        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {loading ? '…' : total}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>sesiones totales</p>
      </div>

      {/* Desglose */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2.5" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-[9px] font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Previas al sistema
          </p>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type="number"
                min={0}
                autoFocus
                value={tempInput}
                onChange={e => setTempInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') { setEditing(false); setTempInput(String(sessionsBefore)) }
                }}
                className="w-16 px-2 py-1 rounded-md text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400"
                style={{ background: 'var(--card)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                title="Guardar"
              >
                {saving ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>}
              </button>
              <button
                onClick={() => { setEditing(false); setTempInput(String(sessionsBefore)) }}
                className="p-1 rounded-md bg-slate-100 text-slate-500 hover:text-slate-700"
                title="Cancelar"
              >
                <X size={12}/>
              </button>
            </div>
          ) : (
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {sessionsBefore}
            </p>
          )}
        </div>
        <div className="rounded-lg p-2.5" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-[9px] font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            En la plataforma
          </p>
          <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {loading ? '…' : autoCount}
          </p>
        </div>
      </div>

      <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
        💡 Las "previas al sistema" son sesiones que el paciente tuvo antes de empezar a usar la plataforma. Se suman a las citas completadas registradas aquí.
      </p>
    </div>
  )
}

// ── Tab Info del paciente ──────────────────────────────────────────────────
function PatientInfoTab({ nino, onSaved, onDeleted }: { nino: any; onSaved: () => void; onDeleted?: () => void }) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [specialists, setSpecialists] = useState<any[]>([])
  const [form, setForm] = useState({
    name:          nino.name || '',
    birth_date:    nino.birth_date || '',
    diagnosis:     nino.diagnosis || '',
    age:           String(nino.age || '').replace(/[^0-9]/g, ''),
    apodo:         nino.apodo || '',
    notas:         nino.notas || '',
    specialist_id: nino.specialist_id || '',
  })

  // Cargar especialistas disponibles (incluye especialidad — solo uso interno)
  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, email, role, specialty')
      .in('role', ['especialista', 'terapeuta', 'jefe', 'admin'])
      .order('full_name')
      .then(({ data }) => setSpecialists(data || []))
  }, [])

  useEffect(() => {
    setForm({
      name:          nino.name || '',
      birth_date:    nino.birth_date || '',
      diagnosis:     nino.diagnosis || '',
      age:           String(nino.age || '').replace(/[^0-9]/g, ''),
      apodo:         nino.apodo || '',
      notas:         nino.notas || '',
      specialist_id: nino.specialist_id || '',
    })
    setEditing(false)
  }, [nino.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const edadNum: number | null = form.birth_date
        ? calcularEdadNumerica(form.birth_date)
        : (form.age.trim() ? parseInt(form.age.replace(/[^0-9]/g, ''), 10) || null : null)

      const { error } = await supabase.from('children').update({
        name:          form.name.trim(),
        birth_date:    form.birth_date || null,
        diagnosis:     form.diagnosis.trim() || null,
        age:           edadNum,
        apodo:         form.apodo.trim() || null,
        notas:         form.notas.trim() || null,
        specialist_id: form.specialist_id || null,
      }).eq('id', nino.id)
      if (error) throw error
      toast.success(t('common.exitoGuardado'))
      setEditing(false)
      onSaved()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ─── Eliminar paciente ──────────────────────────────────────────────────────
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    const tieneCuentaVinculada = !!nino.parent_id
    const nombre = nino.name || 'el paciente'

    // Mensaje de confirmación detallado según vinculación
    const mensaje = tieneCuentaVinculada
      ? `⚠️ "${nombre}" TIENE una cuenta de padre/madre vinculada.\n\n` +
        `Si lo eliminás, esa familia ya no podrá ver su información.\n\n` +
        `Esta acción borrará TODO el historial del paciente:\n` +
        `· Citas y agenda\n` +
        `· Programas ABA y sesiones registradas\n` +
        `· Evaluaciones, formularios y fichas\n` +
        `· Documentos y reportes\n\n` +
        `Esta acción NO se puede deshacer.\n\n` +
        `Para confirmar, escribí el nombre exacto del paciente:`
      : `¿Eliminar a "${nombre}"?\n\n` +
        `Este paciente NO tiene cuenta de padre vinculada (probablemente es de prueba).\n\n` +
        `Se borrará todo su historial (citas, programas, evaluaciones, fichas, documentos).\n\n` +
        `Esta acción no se puede deshacer.`

    let confirmName = ''
    if (tieneCuentaVinculada) {
      const respuesta = prompt(mensaje, '')
      if (respuesta == null) return  // cancelado
      if (respuesta.trim() !== nombre.trim()) {
        toast.error('El nombre no coincide. Eliminación cancelada.')
        return
      }
      confirmName = respuesta.trim()
    } else {
      if (!confirm(mensaje)) return
    }

    setDeleting(true)
    try {
      // Usamos el endpoint /api/admin/delete-patient — borra en cascada manual
      // todas las tablas relacionadas (appointments, programas_aba, evaluaciones,
      // fichas, etc.) antes de eliminar al niño. El cliente no puede hacer esto
      // directo porque appointments tiene FK sin ON DELETE CASCADE.
      const res = await fetch('/api/admin/delete-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: nino.id, confirm_name: confirmName }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Error desconocido')

      // Log informativo de qué se limpió por consola
      if (json.registros_limpiados) {
        console.log(`[delete-patient] "${nombre}" eliminado · limpieza:`, json.registros_limpiados)
      }
      toast.success(`"${nombre}" eliminado correctamente`)
      onDeleted?.()
    } catch (e: any) {
      toast.error(`No se pudo eliminar: ${e?.message || 'error desconocido'}`)
    } finally {
      setDeleting(false)
    }
  }

  const birthFormatted = nino.birth_date
    ? new Date(nino.birth_date + 'T12:00:00').toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const ageDisplay = nino.age
    ? `${String(nino.age).replace(/[^0-9]/g, '')} ${t('common.anos')}`
    : birthFormatted ? `${calcularEdadNumerica(nino.birth_date)} ${t('common.anos')}` : '—'

  const specialistObj = specialists.find(s => s.id === (nino.specialist_id || form.specialist_id)) || null
  const specialistName = specialistObj?.full_name || null
  const specialistSpecialty = specialistObj?.specialty || null   // solo visible en panel interno

  const fieldCls = "w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors"
  const fieldStyle = { borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--muted-bg)' }
  const labelCls = "block text-[10px] font-bold mb-1.5"

  return (
    <div className="p-4 md:p-6">
      {!editing ? (
        /* ───────────── VISTA ───────────── */
        <div className="space-y-2">
          <div className="flex justify-end mb-1 gap-2">
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
              <Edit size={12}/> {t('common.editar')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"
              style={{ background: 'transparent', color: '#dc2626', border: '1px solid rgba(220,38,38,0.30)' }}
              title={nino.parent_id ? 'Paciente con cuenta de padre vinculada — requiere confirmación por nombre' : 'Eliminar paciente'}
            >
              {deleting ? <Loader2 size={12} className="animate-spin"/> : <Trash2 size={12}/>}
              Eliminar
            </button>
          </div>

          {/* Fila 1: Fecha nacimiento + Edad */}
          <div className="grid grid-cols-2 gap-2">
            <InfoCard icon={Calendar} label={t('pacientes.fechaNacimiento')} color="#0284c7">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {birthFormatted || '—'}
              </p>
            </InfoCard>
            <InfoCard icon={Baby} label={t('ui.age')} color="#06b6d4">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{ageDisplay}</p>
            </InfoCard>
          </div>

          {/* Fila 2: Diagnóstico + Apodo */}
          <div className="grid grid-cols-2 gap-2">
            <InfoCard icon={Stethoscope} label={t('pacientes.diagnostico')} color="#0ea5e9">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {nino.diagnosis || '—'}
              </p>
            </InfoCard>
            <InfoCard icon={User} label="Apodo" color="#0369a1">
              {nino.apodo
                ? <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{nino.apodo}</p>
                : <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin apodo</p>
              }
            </InfoCard>
          </div>

          {/* Fila 3: Especialista asignado */}
          <InfoCard icon={Stethoscope} label="Especialista asignado" color="#0284c7">
            {specialistName
              ? <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
                    <User size={11} className="text-white"/>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{specialistName}</p>
                    {specialistSpecialty && (
                      <p className="text-[11px] leading-tight truncate" style={{ color: '#0284c7' }}>{specialistSpecialty}</p>
                    )}
                  </div>
                </div>
              : <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin especialista asignado</p>
            }
          </InfoCard>

          {/* Fila 4: Notas */}
          <InfoCard icon={ClipboardList} label="Notas del paciente" color="#0284c7">
            {nino.notas
              ? <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                  {nino.notas}
                </p>
              : <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin notas adicionales</p>
            }
          </InfoCard>

          {/* ── Contador de sesiones (auto + previas manuales) ── */}
          <SessionCounterCard nino={nino} onSaved={onSaved} />

          {/* ── Cuenta vinculada ── */}
          <LinkedAccountSection nino={nino} onLinked={onSaved} />

          {/* ── Bienestar del padre ── */}
          <ParentWellbeingCard childId={nino.id} />
        </div>

      ) : (
        /* ───────────── EDICIÓN ───────────── */
        <div className="space-y-3 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          {/* Header edición */}
          <div className="flex items-center justify-between pb-2 mb-1" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              {t('common.editar')}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                {t('common.cancelar')}
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: 'var(--text-primary)', color: 'var(--card)' }}>
                {saving ? <Loader2 size={12} className="animate-spin"/> : <Save size={12}/>}
                {t('common.guardar')}
              </button>
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('common.nombre')}</label>
            <input type="text" value={form.name} placeholder="Ej: María García"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
          </div>

          {/* Apodo */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Apodo / Nombre corto</label>
            <input type="text" value={form.apodo} placeholder="Ej: Mía, Titi, Fer..."
              onChange={e => setForm(f => ({ ...f, apodo: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Nombre informal o como prefiere que lo llamen
            </p>
          </div>

          {/* Fecha nacimiento */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.fechaNacimiento')}</label>
            <input type="date" value={form.birth_date}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
          </div>

          {/* Diagnóstico */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('pacientes.diagnostico')}</label>
            <input type="text" value={form.diagnosis} placeholder="Ej: TEA Nivel 2, TDAH..."
              onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
              className={fieldCls} style={fieldStyle} />
          </div>

          {/* Edad manual */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>{t('ui.age')} (años)</label>
            <input type="number" min="0" max="99" value={form.age} placeholder="Ej: 8"
              onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/[^0-9]/g, '') }))}
              className={fieldCls} style={fieldStyle} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Se calcula automáticamente si hay fecha de nacimiento
            </p>
          </div>

          {/* Especialista asignado */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Especialista asignado</label>
            <select value={form.specialist_id}
              onChange={e => setForm(f => ({ ...f, specialist_id: e.target.value }))}
              className={fieldCls} style={fieldStyle}>
              <option value="">— Sin asignar —</option>
              {specialists.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}{s.specialty ? ` — ${s.specialty}` : ` (${s.role})`}
                </option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls} style={{ color: 'var(--text-muted)' }}>Notas del paciente</label>
            <textarea value={form.notas} rows={4}
              placeholder="Observaciones generales, datos de interés, rutinas, preferencias, alergias, contacto de emergencia..."
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              className={`${fieldCls} resize-none`} style={fieldStyle} />
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL — Layout adaptativo móvil / desktop
// ═══════════════════════════════════════════════════════════════════════════
// ── FichasTab — dos sub-tabs grandes ─────────────────────────────────────────
function FichasTab({ childId, childName, currentRole }: {
  childId: string; childName: string; currentRole: string
}) {
  const { isDark } = useTheme()
  const [subTab, setSubTab] = useState<'plantillas' | 'rellenar'>('rellenar')
  const canManage = ['jefe', 'admin', 'especialista'].includes(currentRole)

  const cc = {
    active:   isDark ? 'bg-[#161b22] text-slate-100 shadow border border-[#30363d]' : 'bg-white text-slate-800 shadow border border-slate-200',
    inactive: isDark ? 'text-slate-500 hover:text-slate-300 border border-transparent' : 'text-slate-400 hover:text-slate-600 border border-transparent',
    bar:      isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-200',
  }

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className={`flex-shrink-0 px-3 sm:px-5 pt-4 pb-3 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
        <div className={`flex rounded-2xl p-1.5 gap-1.5 border ${cc.bar}`}>
          {canManage && (
            <button onClick={() => setSubTab('plantillas')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${subTab === 'plantillas' ? cc.active : cc.inactive}`}>
              <Settings size={15} /> Gestionar fichas
            </button>
          )}
          <button onClick={() => setSubTab('rellenar')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${subTab === 'rellenar' ? cc.active : cc.inactive}`}>
            <ClipboardList size={15} /> Fichas del paciente
          </button>
        </div>
      </div>

      {/* Content — fluye en el scroll principal del detalle (sin scroll anidado) */}
      <div className="p-3 sm:p-5">
        {subTab === 'plantillas' && canManage && <GestorPlantillas isDark={isDark} />}
        {subTab === 'rellenar' && <RellenarFichaConWord childId={childId} childName={childName} isDark={isDark} />}
      </div>
    </div>
  )
}

// ── RellenarFichaConWord — guarda ficha + genera Word automáticamente ─────────
function RellenarFichaConWord({ childId, childName, isDark }: {
  childId: string; childName: string; isDark: boolean
}) {
  const toast = useToast()

  const handleSaved = async (responseId: string) => {
    // Auto-generar Word y guardar en patient_documents
    try {
      const res = await fetch('/api/reporte-ficha-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId }),
      })
      if (!res.ok) return

      const blob  = await res.blob()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user!.id).maybeSingle()

      // Subir al bucket
      const fileName = `Ficha_${childName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`
      const path = `${childId}/${Date.now()}_${fileName}`
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })

      const { error: upErr } = await supabase.storage.from('patient-documents').upload(path, file, { upsert: false })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('patient-documents').getPublicUrl(path)

      await supabase.from('patient_documents').insert({
        child_id:         childId,
        uploaded_by:      user!.id,
        uploader_role:    profile?.role || 'especialista',
        uploader_name:    profile?.full_name || 'Clínico',
        file_name:        fileName,
        file_url:         publicUrl,
        file_type:        'word',
        file_size:        blob.size,
        category:         'informe',
        description:      'Ficha clínica generada automáticamente',
        visible_to_parent: false,
      })

      toast.success('Word generado y guardado en Documentos del paciente')
    } catch (e: any) {
      console.error('Error auto-generando Word:', e)
    }
  }

  return <RellenarFicha childId={childId} childName={childName} isDark={isDark} onSaved={handleSaved} />
}

export default function PatientsView({ onPatientSelect, initialChildId, initialTab, enabledTabs }: {
  onPatientSelect?: (id: string, name: string) => void
  initialChildId?: string | null
  initialTab?: string | null
  enabledTabs?: {
    info?: boolean; programas?: boolean; evaluaciones?: boolean
    'eval-inicial'?: boolean; historial?: boolean; fichas?: boolean; documentos?: boolean
  }
} = {}) {
  const { t } = useI18n()
  const toast  = useToast()

  const [pacientes, setPacientes] = useState<any[]>([])
  const [pacienteLimit, setPacienteLimit] = useState(0)
  const [filtrados, setFiltrados] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentRole, setCurrentRole] = useState('')

  // En móvil: 'list' | 'detail'. En desktop ambos visibles.
  const [mobileView, setMobileView] = useState<'list'|'detail'>('list')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'info'|'programas'|'evaluaciones'|'eval-inicial'|'historial'|'fichas'|'documentos'>('info')

  // Nuevo paciente
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name:'', birth_date:'', diagnosis:'' })
  const [saving, setSaving] = useState(false)

  // ── Edición inline del nombre en el header ────────────────────────────────
  const [editingHeaderName, setEditingHeaderName] = useState(false)
  const [headerNameInput, setHeaderNameInput] = useState('')
  const [savingHeaderName, setSavingHeaderName] = useState(false)

  const startEditHeaderName = () => {
    setHeaderNameInput(selected?.name || '')
    setEditingHeaderName(true)
  }
  const cancelEditHeaderName = () => { setEditingHeaderName(false); setHeaderNameInput('') }
  const saveHeaderName = async () => {
    const trimmed = headerNameInput.trim()
    if (!trimmed || trimmed === selected?.name) { cancelEditHeaderName(); return }
    setSavingHeaderName(true)
    try {
      const { error } = await supabase.from('children').update({ name: trimmed }).eq('id', selected.id)
      if (error) throw error
      const updated = { ...selected, name: trimmed }
      setSelected(updated)
      setPacientes(prev => prev.map(p => p.id === selected.id ? { ...p, name: trimmed } : p))
      setFiltrados(prev => prev.map(p => p.id === selected.id ? { ...p, name: trimmed } : p))
      if (onPatientSelect) onPatientSelect(selected.id, trimmed)
      toast.success(t('common.exitoGuardado'))
      setEditingHeaderName(false)
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingHeaderName(false) }
  }

  // ── Cargar ────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase.from('children').select('*').order('name', { ascending: true })
    if (data) { setPacientes(data); setFiltrados(data) }
    setIsLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { getControlStatus().then(st => setPacienteLimit(Number(st.limits?.paciente || 0))).catch(() => {}) }, [])

  // Auto-seleccionar paciente si viene desde una alerta del dashboard
  useEffect(() => {
    if (!initialChildId || pacientes.length === 0) return
    const target = pacientes.find(p => p.id === initialChildId)
    if (target) {
      selectPatient(target, initialTab || undefined)
    }
  }, [initialChildId, pacientes])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setCurrentRole(data?.role || '')
    })
  }, [])

  // ── Filtrar ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setFiltrados(pacientes); return }
    const q = search.toLowerCase()
    setFiltrados(pacientes.filter(p => p.name?.toLowerCase().includes(q) || p.diagnosis?.toLowerCase().includes(q) || p.apodo?.toLowerCase().includes(q)))
  }, [search, pacientes])

  // ── Seleccionar paciente ──────────────────────────────────────────────────
  const selectPatient = (p: any, overrideTab?: string) => {
    setSelected(p); setTab((overrideTab as any) || 'info')
    setMobileView('detail')   // en móvil ir a la ficha
    if (onPatientSelect) onPatientSelect(p.id, p.name)  // notify parent for ARIA context
  }

  // ── Volver a la lista (solo móvil) ────────────────────────────────────────
  const goBack = () => { setMobileView('list'); setSelected(null) }

  // ── Crear nuevo ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error(t('pacientes.nombreRequerido')); return }
    // Bloqueo de límite de pacientes (lo define el programador en /control).
    try {
      const st = await getControlStatus()
      const limit = Number(st.limits?.paciente || 0)
      if (limit > 0) {
        const { count } = await supabase.from('children').select('id', { count: 'exact', head: true })
        if ((count || 0) >= limit) {
          toast.error(`Límite de pacientes alcanzado (${count}/${limit}). Solo el programador puede ampliarlo.`)
          return
        }
      }
    } catch { /* si falla el chequeo, deja que la base decida */ }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('children').insert({
        name: newForm.name.trim(),
        birth_date: newForm.birth_date || null,
        diagnosis: newForm.diagnosis.trim() || null,
        age: newForm.birth_date ? calcularEdadNumerica(newForm.birth_date) : null,
      }).select().single()
      if (error) throw error
      toast.success(t('pacientes.creado'))
      setNewForm({ name:'', birth_date:'', diagnosis:'' })
      setShowNew(false)
      await cargar()
      if (data) selectPatient(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const TABS = [
    { id:'info',         icon:<User size={14}/>,          label: t('pacientes.informacion'), short: 'Info'  },
    { id:'programas',    icon:<BarChart3 size={14}/>,     label: t('nav.programas'),          short: 'ABA'   },
    { id:'evaluaciones', icon:<ClipboardList size={14}/>, label: t('nav.evaluaciones'),       short: 'Eval.' },
    { id:'eval-inicial', icon:<ClipboardList size={14}/>, label: 'Evaluación Inicial',        short: 'Inicial' },
    { id:'historial',    icon:<Brain size={14}/>,         label: 'Historial & IA',            short: 'Hist.' },
    { id:'fichas',       icon:<FileText size={14}/>,      label: 'Fichas',                    short: 'Fichas'},
    { id:'documentos',   icon:<FolderOpen size={14}/>,    label: 'Documentos',                short: 'Docs'  },
  ].filter(tb => !enabledTabs || enabledTabs[tb.id as keyof typeof enabledTabs] !== false) as const

  // ── PANEL LISTA ───────────────────────────────────────────────────────────
  const ListPanel = (
    <div
      className={`
        flex flex-col bg-white dark:bg-slate-900 overflow-hidden
        /* móvil: ocupa todo si no hay detalle */
        ${mobileView === 'detail' ? 'hidden' : 'flex'}
        /* desktop: columna fija al lado */
        md:flex md:w-64 xl:w-72 md:flex-shrink-0 md:border-r
        h-full
      `}
      style={{ borderColor:'var(--card-border)', background:'var(--card)' }}
    >
      {/* Header */}
      <div className="p-3 border-b space-y-2 flex-shrink-0" style={{ borderColor:'var(--card-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold" style={{ color:'var(--text-muted)' }}>
            {t('nav.pacientes')} · <span className="font-normal">{filtrados.length}</span>
            {pacienteLimit > 0 && (
              <span className={`ml-1.5 font-bold ${pacientes.length >= pacienteLimit ? 'text-rose-500' : 'text-slate-400'}`}>
                ({pacientes.length}/{pacienteLimit})
              </span>
            )}
          </h2>
          <button onClick={()=>setShowNew(true)}
            className="w-7 h-7 rounded-lg bg-sky-600 hover:bg-sky-700 flex items-center justify-center transition-all shadow-sm">
            <Plus size={14} className="text-white"/>
          </button>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder={t('ui.search_patient')}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none border"
            style={{ background:'var(--muted-bg)', borderColor:'var(--card-border)', color:'var(--text-primary)' }}/>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {isLoading
          ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" size={20} style={{ color:'var(--text-muted)' }}/></div>
          : filtrados.length === 0
            ? <div className="py-12 text-center">
                <Users className="mx-auto mb-2" size={32} style={{ color:'var(--text-muted)', opacity:0.3 }}/>
                <p className="text-xs font-bold" style={{ color:'var(--text-muted)' }}>
                  {search ? t('common.sinResultados') : t('pacientes.sinPacientes')}
                </p>
              </div>
            : filtrados.map(p => (
                <button key={p.id} onClick={()=>selectPatient(p)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all border
                    ${selected?.id===p.id
                      ? 'bg-sky-50 border-sky-200 dark:bg-sky-900/30'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Avatar name={p.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color:'var(--text-primary)' }}>
                      {getDisplayName(p, currentRole)}
                    </p>
                    <p className="text-[11px] truncate" style={{ color:'var(--text-muted)' }}>
                      {p.diagnosis || t('pacientes.sinDiagnostico')} · {p.birth_date ? calcularEdadNumerica(p.birth_date) : (p.age || '?')} {t('common.anos')}
                    </p>
                  </div>
                  {selected?.id===p.id
                    ? <Check size={13} className="text-sky-500 flex-shrink-0"/>
                    : <ChevronRight size={13} className="flex-shrink-0 opacity-30"/>}
                </button>
              ))
        }
      </div>
    </div>
  )

  // ── PANEL DETALLE ─────────────────────────────────────────────────────────
  const DetailPanel = (
    <div
      className={`
        flex-1 flex flex-col overflow-hidden
        ${mobileView === 'list' ? 'hidden' : 'flex'}
        md:flex
      `}
    >
      {selected ? (
        <>
          {/* Header paciente */}
          <div className="flex-shrink-0" style={{ background:'var(--card)' }}>
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              {/* Botón volver — solo móvil */}
              <button onClick={goBack}
                className="md:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 transition-all flex-shrink-0">
                <ArrowLeft size={18} style={{ color:'var(--text-primary)' }}/>
              </button>
              <Avatar name={selected.name} size="md"/>
              <div className="flex-1 min-w-0">
                {editingHeaderName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={headerNameInput}
                      onChange={e => setHeaderNameInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveHeaderName(); if (e.key === 'Escape') cancelEditHeaderName() }}
                      className="flex-1 min-w-0 text-base font-bold rounded-lg px-2 py-0.5 leading-tight outline-none"
                      style={{ background: 'var(--muted-bg)', color: 'var(--text-primary)', border: '1.5px solid #0284c7' }}
                    />
                    <button onClick={saveHeaderName} disabled={savingHeaderName}
                      className="p-1 rounded-lg flex-shrink-0 transition-all"
                      style={{ background: '#0284c7', color: '#fff' }}>
                      {savingHeaderName ? <Loader2 size={13} className="animate-spin"/> : <Check size={13}/>}
                    </button>
                    <button onClick={cancelEditHeaderName}
                      className="p-1 rounded-lg flex-shrink-0 transition-all"
                      style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                      <X size={13}/>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group">
                    <h1 className="text-lg font-bold truncate leading-tight" style={{ color:'var(--text-primary)' }}>
                      {selected.name}
                    </h1>
                    <button onClick={startEditHeaderName}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg flex-shrink-0 transition-all"
                      title={t('common.editar')}
                      style={{ color: 'var(--text-muted)' }}>
                      <Edit size={13}/>
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={getDxStyle(selected.diagnosis)}>
                    {selected.diagnosis || t('pacientes.sinDiagnostico')}
                  </span>
                  {(selected.birth_date || selected.age) &&
                    <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                      {selected.birth_date ? calcularEdadNumerica(selected.birth_date) : selected.age} {t('common.anos')}
                    </span>}
                </div>
              </div>
            </div>

            {/* Tabs premium — pill activo con tinte + indicador degradado */}
            <div className="border-b px-2" style={{ borderColor: 'var(--card-border)' }}>
              <div className="flex w-full gap-0.5">
              {TABS.map(tb => {
                const activo = tab===tb.id
                return (
                <button key={tb.id} onClick={()=>setTab(tb.id)}
                  className="group relative flex flex-1 flex-col items-center gap-1.5 px-1 pt-3 pb-3 transition-all rounded-t-xl"
                  style={{
                    color: activo ? '#0284c7' : 'var(--text-muted)',
                    background: activo ? 'rgba(2,132,199,0.06)' : 'transparent',
                  }}
                  title={tb.label}>
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 group-hover:scale-105"
                    style={{ background: activo ? 'rgba(2,132,199,0.14)' : 'transparent' }}>
                    {tb.id === 'info'         && <User         size={17}/>}
                    {tb.id === 'programas'    && <BarChart3    size={17}/>}
                    {tb.id === 'evaluaciones' && <ClipboardList size={17}/>}
                    {tb.id === 'eval-inicial' && <ClipboardList size={17}/>}
                    {tb.id === 'historial'    && <Brain        size={17}/>}
                    {tb.id === 'fichas'       && <FileText     size={17}/>}
                    {tb.id === 'documentos'   && <FolderOpen   size={17}/>}
                  </span>
                  <span className="sm:hidden text-[9px] font-semibold whitespace-nowrap">{tb.short}</span>
                  <span className="hidden sm:block text-[10.5px] font-semibold whitespace-nowrap">{tb.label}</span>
                  {activo && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-9 h-[3px] rounded-full"
                      style={{ background: 'linear-gradient(90deg,#0284c7,#06b6d4)' }}/>
                  )}
                </button>
                )
              })}
              </div>
            </div>
          </div>

          {/* Contenido tab */}
          <div className="flex-1 overflow-y-auto pb-28 md:pb-10">
            {tab==='info' &&
              <PatientInfoTab
                nino={selected}
                onSaved={async()=>{
                  await cargar()
                  // Fetch fresh data directly from DB to avoid stale closure
                  const { data: fresh } = await supabase.from('children').select('*').eq('id', selected.id).maybeSingle()
                  if (fresh) setSelected(fresh)
                }}
                onDeleted={async()=>{
                  // El paciente fue eliminado — recargar la lista y deseleccionarlo
                  setSelected(null)
                  await cargar()
                }}
              />}
            {tab==='programas' && <div className="p-3 sm:p-5"><ProgramasABAView childId={selected.id} childName={selected.name}/></div>}
            {tab==='evaluaciones' && <div className="p-3 sm:p-5"><EvaluacionesUnificadas initialChildId={selected.id} initialChildName={selected.name}/></div>}
            {tab==='eval-inicial' && <div className="p-3 sm:p-5"><EvaluacionInicialAdmin childId={selected.id} childName={selected.name} /></div>}
            {tab==='historial' && <div className="p-3 sm:p-5"><AIReportView initialChildId={selected.id} /></div>}
            {tab==='fichas' && (
              <FichasTab
                childId={selected.id}
                childName={selected.name}
                currentRole={currentRole}
              />
            )}
            {tab==='documentos' && <div className="p-3 sm:p-5"><DocumentosView childId={selected.id} childName={selected.name} currentRole="admin" /></div>}
          </div>
        </>
      ) : (
        /* Empty state — solo visible en desktop */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-50 to-cyan-100 flex items-center justify-center">
            <Users size={36} className="text-sky-400"/>
          </div>
          <div className="text-center">
            <h3 className="font-bold text-lg mb-1" style={{ color:'var(--text-primary)' }}>{t('pacientes.seleccionaUno')}</h3>
            <p className="text-sm max-w-xs" style={{ color:'var(--text-muted)' }}>{t('pacientes.seleccionaDesc')}</p>
          </div>
          <button onClick={()=>setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold shadow-sm">
            <Plus size={15}/> {t('pacientes.nuevo')}
          </button>
        </div>
      )}
    </div>
  )

  // ── MODAL nuevo paciente ──────────────────────────────────────────────────
  const NewModal = showNew && (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl p-5 space-y-4"
        style={{ background:'var(--card)' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color:'var(--text-primary)' }}>{t('pacientes.nuevo')}</h3>
          <button onClick={()=>setShowNew(false)} className="p-2 rounded-xl hover:bg-slate-100">
            <X size={16} style={{ color:'var(--text-muted)' }}/>
          </button>
        </div>
        <div className="space-y-3">
          {[
            { key:'name',       label:t('common.nombre'),            type:'text', placeholder:'Ej: María García', req:true },
            { key:'birth_date', label:t('pacientes.fechaNacimiento'), type:'date', placeholder:'',                req:false },
            { key:'diagnosis',  label:t('pacientes.diagnostico'),    type:'text', placeholder:'Ej: TEA Nivel 2',  req:false },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold mb-1.5" style={{ color:'var(--text-muted)' }}>
                {f.label}{f.req && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input type={f.type} placeholder={f.placeholder}
                value={(newForm as any)[f.key]}
                onChange={e=>setNewForm(fm=>({...fm,[f.key]:e.target.value}))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none border"
                style={{ background:'var(--muted-bg)', borderColor:'var(--card-border)', color:'var(--text-primary)' }}/>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={()=>setShowNew(false)}
            className="flex-1 py-3 rounded-xl font-bold text-sm border"
            style={{ borderColor:'var(--card-border)', color:'var(--text-muted)' }}>
            {t('common.cancelar')}
          </button>
          <button onClick={handleCreate} disabled={saving||!newForm.name.trim()}
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-sky-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
            {t('pacientes.crear')}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background:'var(--bg)' }}>
      {ListPanel}
      {DetailPanel}
      {NewModal}
    </div>
  )
}
