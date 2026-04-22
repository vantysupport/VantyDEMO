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
  FolderOpen, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { calcularEdadNumerica } from '../utils/helpers'
import ProgramasABAView from './ProgramasABAView'
import EvaluacionesUnificadas from './EvaluacionesUnificadas'
import AIReportView from './AIReportView'
import DocumentosView from './DocumentosView'
import { RellenarFicha, GestorPlantillas } from './PlantillasClinicas'

// ── Color badge por diagnóstico ────────────────────────────────────────────
const DX_BORDER: Record<string, string> = {
  'TEA': '#7b5ea7', 'TDAH': '#3a68a0', 'Retraso': '#b07830', 'Autismo': '#7b5ea7',
  'TDA': '#3a68a0', 'TDL': '#2e7a56',
}
const getDxStyle = (dx: string) => {
  const k = Object.keys(DX_BORDER).find(k => dx?.includes(k))
  const color = k ? DX_BORDER[k] : '#64748b'
  return { background: `${color}10`, color, border: `1px solid ${color}30` }
}

// ── Avatar coloreado por inicial ───────────────────────────────────────────
const PALETTES = [
  'from-violet-500 to-purple-600', 'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
]
function Avatar({ name, size = 'md' }: { name: string; size?: 'sm'|'md'|'lg' }) {
  const pal = PALETTES[name.charCodeAt(0) % PALETTES.length]
  const sz  = { sm: 'w-9 h-9 text-base', md: 'w-12 h-12 text-lg', lg: 'w-16 h-16 text-2xl' }[size]
  return (
    <div className={`bg-gradient-to-br ${pal} ${sz} rounded-2xl flex items-center justify-center font-black text-white flex-shrink-0 shadow-sm`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ── InfoPill ──────────────────────────────────────────────────────────────
function InfoPill({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl space-y-1" style={{ background: 'var(--muted-bg)' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-blue-500">{icon}</span>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
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
      const { data } = await supabase.from('profiles').select('id, full_name, email, role').eq('id', nino.parent_id).single()
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
      const res = await fetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: nino.id, parentId: user.id }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`✅ ${nino.name} vinculado a ${user.full_name || user.email}`)
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
      const res = await fetch('/api/admin/children', {
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
      <div className="rounded-xl p-4 mt-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <UserCheck size={13} style={{ color: 'var(--text-muted)' }} />
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
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
                <h3 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
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
                className="px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white disabled:opacity-50 flex items-center gap-1.5">
                {searching ? <Loader2 size={13} className="animate-spin"/> : <Search size={13}/>}
                Buscar
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {searchResults.map(u => (
                  <div key={u.id}
                    className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
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
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 text-white disabled:opacity-50 flex-shrink-0">
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

// ── Tab Info del paciente ──────────────────────────────────────────────────
function PatientInfoTab({ nino, onSaved }: { nino: any; onSaved: () => void }) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm] = useState({
    name: nino.name || '',
    birth_date: nino.birth_date || '',
    diagnosis: nino.diagnosis || '',
    // FIX: extract only numeric part from age to avoid "22 años" syntax error
    age: String(nino.age || '').replace(/[^0-9]/g, ''),
  })

  useEffect(() => {
    setForm({
      name: nino.name || '',
      birth_date: nino.birth_date || '',
      diagnosis: nino.diagnosis || '',
      age: String(nino.age || '').replace(/[^0-9]/g, ''),
    })
    setEditing(false)
  }, [nino.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Use calcularEdadNumerica (returns integer) not calcularEdad (returns string like "22 años")
      const edadNum: number | null = form.birth_date
        ? calcularEdadNumerica(form.birth_date)
        : (form.age.trim() ? parseInt(form.age.replace(/[^0-9]/g, ''), 10) || null : null)

      const { error } = await supabase.from('children').update({
        name: form.name.trim(),
        birth_date: form.birth_date || null,
        diagnosis: form.diagnosis.trim() || null,
        age: edadNum,
      }).eq('id', nino.id)
      if (error) throw error
      toast.success(t('common.exitoGuardado'))
      setEditing(false)
      onSaved()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const birthFormatted = nino.birth_date
    ? new Date(nino.birth_date + 'T12:00:00').toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const ageDisplay = nino.age
    ? `${String(nino.age).replace(/[^0-9]/g, '')} ${t('common.anos')}`
    : birthFormatted ? `${calcularEdadNumerica(nino.birth_date)} ${t('common.anos')}` : '—'


  return (
    <div className="p-4 md:p-6">
      {/* ── Data fields ── */}
      {!editing ? (
        <div className="space-y-2">
          {/* Edit button */}
          <div className="flex justify-end mb-1">
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
              <Edit size={12}/> {t('common.editar')}
            </button>
          </div>
          {/* Row 1 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar size={12} style={{ color: 'var(--text-muted)' }}/>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {t('pacientes.fechaNacimiento')}
                </p>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {birthFormatted || '—'}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Baby size={12} style={{ color: 'var(--text-muted)' }}/>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {t('ui.age')}
                </p>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {ageDisplay}
              </p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Stethoscope size={12} style={{ color: 'var(--text-muted)' }}/>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {t('pacientes.diagnostico')}
                </p>
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {nino.diagnosis || '—'}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <User size={12} style={{ color: 'var(--text-muted)' }}/>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  ID
                </p>
              </div>
              <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {nino.id?.slice(0,12)}…
              </p>
            </div>
          </div>

          {/* ── Cuenta vinculada ── */}
          <LinkedAccountSection nino={nino} onLinked={onSaved} />
        </div>
      ) : (
        <div className="space-y-3 rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          {/* Edit form header with save/cancel */}
          <div className="flex items-center justify-between pb-2 mb-1" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
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
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('pacientes.fechaNacimiento')}
            </label>
            <input type="date" value={form.birth_date}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--muted-bg)' }} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('pacientes.diagnostico')}
            </label>
            <input type="text" value={form.diagnosis}
              onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))}
              placeholder="Ej: TEA Nivel 2, TDAH..."
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--muted-bg)' }} />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>
              {t('ui.age')} (años)
            </label>
            <input type="number" min="0" max="99"
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="Ej: 8"
              className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--muted-bg)' }} />
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Se calcula automáticamente si hay fecha de nacimiento
            </p>
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className={`flex-shrink-0 px-5 pt-4 pb-3 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
        <div className={`flex rounded-2xl p-1.5 gap-1.5 border ${cc.bar}`}>
          {canManage && (
            <button onClick={() => setSubTab('plantillas')}
              className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${subTab === 'plantillas' ? cc.active : cc.inactive}`}>
              ⚙️ Gestionar fichas
            </button>
          )}
          <button onClick={() => setSubTab('rellenar')}
            className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${subTab === 'rellenar' ? cc.active : cc.inactive}`}>
            📋 Fichas del paciente
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
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
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user!.id).single()

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

      toast.success('📄 Word generado y guardado en Documentos del paciente')
    } catch (e: any) {
      console.error('Error auto-generando Word:', e)
    }
  }

  return <RellenarFicha childId={childId} childName={childName} isDark={isDark} onSaved={handleSaved} />
}

export default function PatientsView({ onPatientSelect }: { onPatientSelect?: (id: string, name: string) => void } = {}) {
  const { t } = useI18n()
  const toast  = useToast()

  const [pacientes, setPacientes] = useState<any[]>([])
  const [filtrados, setFiltrados] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentRole, setCurrentRole] = useState('')

  // En móvil: 'list' | 'detail'. En desktop ambos visibles.
  const [mobileView, setMobileView] = useState<'list'|'detail'>('list')
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState<'info'|'programas'|'evaluaciones'|'historial'|'fichas'|'documentos'>('info')

  // Nuevo paciente
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ name:'', birth_date:'', diagnosis:'' })
  const [saving, setSaving] = useState(false)

  // ── Cargar ────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase.from('children').select('*').order('name', { ascending: true })
    if (data) { setPacientes(data); setFiltrados(data) }
    setIsLoading(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setCurrentRole(data?.role || '')
    })
  }, [])

  // ── Filtrar ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setFiltrados(pacientes); return }
    const q = search.toLowerCase()
    setFiltrados(pacientes.filter(p => p.name?.toLowerCase().includes(q) || p.diagnosis?.toLowerCase().includes(q)))
  }, [search, pacientes])

  // ── Seleccionar paciente ──────────────────────────────────────────────────
  const selectPatient = (p: any) => {
    setSelected(p); setTab('info')
    setMobileView('detail')   // en móvil ir a la ficha
    if (onPatientSelect) onPatientSelect(p.id, p.name)  // notify parent for ARIA context
  }

  // ── Volver a la lista (solo móvil) ────────────────────────────────────────
  const goBack = () => { setMobileView('list'); setSelected(null) }

  // ── Crear nuevo ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newForm.name.trim()) { toast.error(t('pacientes.nombreRequerido')); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('children').insert({
        name: newForm.name.trim(),
        birth_date: newForm.birth_date || null,
        diagnosis: newForm.diagnosis.trim() || null,
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
    { id:'info',         icon:<User size={14}/>,          label: t('pacientes.informacion') },
    { id:'programas',    icon:<BarChart3 size={14}/>,     label: t('nav.programas') },
    { id:'evaluaciones', icon:<ClipboardList size={14}/>, label: t('nav.evaluaciones') },
    { id:'historial',    icon:<Brain size={14}/>,         label: 'Historial & IA' },
    { id:'fichas',       icon:<FileText size={14}/>,      label: 'Fichas' },
    { id:'documentos',   icon:<FolderOpen size={14}/>,    label: 'Documentos' },
  ] as const

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
          <h2 className="text-xs font-black uppercase tracking-widest" style={{ color:'var(--text-muted)' }}>
            {t('nav.pacientes')} · <span className="font-normal">{filtrados.length}</span>
          </h2>
          <button onClick={()=>setShowNew(true)}
            className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-all shadow-sm">
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
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/30'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                  <Avatar name={p.name} size="sm"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color:'var(--text-primary)' }}>{p.name}</p>
                    <p className="text-[11px] truncate" style={{ color:'var(--text-muted)' }}>
                      {p.diagnosis || t('pacientes.sinDiagnostico')} · {p.age || '?'} {t('common.anos')}
                    </p>
                  </div>
                  {selected?.id===p.id
                    ? <Check size={13} className="text-blue-500 flex-shrink-0"/>
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
                <h1 className="text-lg font-black truncate leading-tight" style={{ color:'var(--text-primary)' }}>
                  {selected.name}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={getDxStyle(selected.diagnosis)}>
                    {selected.diagnosis || t('pacientes.sinDiagnostico')}
                  </span>
                  {selected.age &&
                    <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                      {selected.age} {t('common.anos')}
                    </span>}
                </div>
              </div>
            </div>

            {/* Tabs — scroll horizontal en pantallas pequeñas */}
            <div className="border-b" style={{ borderColor: 'var(--card-border)' }}>
              <div className="flex w-full">
              {TABS.map(tb => (
                <button key={tb.id} onClick={()=>setTab(tb.id)}
                  className={`flex flex-1 flex-col items-center gap-1 px-2 pt-3 pb-2.5 font-semibold border-b-2 transition-all whitespace-nowrap
                    ${tab===tb.id ? 'border-blue-500' : 'border-transparent'}`}
                  style={{ color: tab===tb.id ? 'var(--accent, #3b82f6)' : 'var(--text-muted)' }}
                  title={tb.label}>
                  <span className="flex-shrink-0" style={{ opacity: tab===tb.id ? 1 : 0.6 }}>
                    {tb.id === 'info'         && <User size={16}/>}
                    {tb.id === 'programas'    && <BarChart3 size={16}/>}
                    {tb.id === 'evaluaciones' && <ClipboardList size={16}/>}
                    {tb.id === 'historial'    && <Brain size={16}/>}
                    {tb.id === 'fichas'       && <FileText size={16}/>}
                    {tb.id === 'documentos'   && <FolderOpen size={16}/>}
                  </span>
                  <span className="text-[11px] font-bold">{tb.label}</span>
                </button>
              ))}
              </div>
            </div>
          </div>

          {/* Contenido tab */}
          <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
            {tab==='info' &&
              <PatientInfoTab nino={selected} onSaved={async()=>{
                await cargar()
                // Fetch fresh data directly from DB to avoid stale closure
                const { data: fresh } = await supabase.from('children').select('*').eq('id', selected.id).single()
                if (fresh) setSelected(fresh)
              }}/>}
            {tab==='programas' && <div style={{ padding: '20px 24px' }}><ProgramasABAView childId={selected.id} childName={selected.name}/></div>}
            {tab==='evaluaciones' && <div style={{ padding: '20px 24px' }}><EvaluacionesUnificadas initialChildId={selected.id} initialChildName={selected.name}/></div>}
            {tab==='historial' && <div style={{ padding: '20px 24px' }}><AIReportView initialChildId={selected.id} /></div>}
            {tab==='fichas' && (
              <FichasTab
                childId={selected.id}
                childName={selected.name}
                currentRole={currentRole}
              />
            )}
            {tab==='documentos' && <div style={{ padding: '20px 24px' }}><DocumentosView childId={selected.id} childName={selected.name} currentRole="admin" /></div>}
          </div>
        </>
      ) : (
        /* Empty state — solo visible en desktop */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-4 p-8">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <Users size={36} className="text-blue-400"/>
          </div>
          <div className="text-center">
            <h3 className="font-black text-lg mb-1" style={{ color:'var(--text-primary)' }}>{t('pacientes.seleccionaUno')}</h3>
            <p className="text-sm max-w-xs" style={{ color:'var(--text-muted)' }}>{t('pacientes.seleccionaDesc')}</p>
          </div>
          <button onClick={()=>setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm">
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
          <h3 className="text-lg font-black" style={{ color:'var(--text-primary)' }}>{t('pacientes.nuevo')}</h3>
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
              <label className="block text-xs font-black uppercase tracking-widest mb-1.5" style={{ color:'var(--text-muted)' }}>
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
            className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
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
