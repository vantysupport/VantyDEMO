'use client'

import { useI18n } from '@/lib/i18n-context'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Users, Key, Mail, Loader2, Search, Shield, RefreshCw,
  CheckCircle2, X, Eye, EyeOff, Ticket, AlertCircle, User,
  Clock, Calendar, ChevronDown, ChevronUp, Send, Lock,
  Crown, Stethoscope, Heart, Plus, ToggleLeft, ToggleRight,
  Edit2, Briefcase, UserCheck, UserX, Filter, Link2, Unlink,
  ClipboardList} from 'lucide-react'
import { useToast } from '@/components/Toast'

const ROLES = [
  { value: 'jefe',        label: 'Director',      description: 'Acceso total al sistema',  icon: Crown,         dotColor: 'bg-sky-500', badgeClass: 'role-director'    },
  { value: 'especialista',label: 'Especialista',  description: 'Terapeuta / Clínico',      icon: Stethoscope,   dotColor: 'bg-sky-500',   badgeClass: 'role-especialista' },
  { value: 'padre',       label: 'Padre / Tutor', description: 'Portal de familias',       icon: Heart,         dotColor: 'bg-pink-500',   badgeClass: 'role-padre'       },
  { value: 'secretaria',  label: 'Secretaria(o)', description: 'Apoyo administrativo',     icon: ClipboardList, dotColor: 'bg-sky-500', badgeClass: 'role-secretaria'  },
]

// Especialidades sugeridas (datalist) — el usuario puede elegir una o escribir la suya.
const SPECIALTY_SUGGESTIONS = [
  'Neuropsicología',
  'Psicología clínica',
  'Terapia ABA',
  'Terapia de lenguaje / Fonoaudiología',
  'Terapia ocupacional',
  'Psicopedagogía',
  'Terapia física',
  'Psicología educativa',
  'Dirección / Coordinación clínica',
  'Secretaría / Admisión',
]

function getRoleInfo(role: string) {
  const { t } = useI18n()

  return ROLES.find(r => r.value === role || (role === 'admin' && r.value === 'jefe')) || ROLES[0]
}

function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n()

  const info = getRoleInfo(role)
  const Icon = info.icon
  return (
    <span className={`role-badge ${info.badgeClass}`}>
      <Icon size={10} />
      {info.label}
    </span>
  )
}

function RoleSelector({ currentRole, onSelect, disabled }: {
  currentRole: string
  onSelect: (role: string) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const current = getRoleInfo(currentRole)

  const handleOpen = () => {
    if (disabled) return
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const dropdownW = 260
      const dropdownH = ROLES.length * 68 + 8
      // Position below button, aligned to right edge
      let left = rect.right - dropdownW
      if (left < 8) left = 8
      // Flip up if not enough space below
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow < dropdownH ? rect.top - dropdownH - 4 : rect.bottom + 4
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
      >
        <current.icon size={13} />
        <span>{current.label}</span>
        <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 rounded-xl overflow-hidden"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
              top: pos.top,
              left: pos.left,
              width: '260px',
            }}
          >
            {ROLES.map(r => {
              const RIcon = r.icon
              const isSelected = currentRole === r.value || (currentRole === 'admin' && r.value === 'jefe')
              return (
                <button
                  key={r.value}
                  onClick={() => { onSelect(r.value); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:opacity-90"
                  style={{ background: isSelected ? 'rgba(37,99,235,0.12)' : 'transparent' }}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.dotColor}`} />
                  <RIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.description}</p>
                  </div>
                  {isSelected && <CheckCircle2 size={13} className="text-sky-500 flex-shrink-0" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

interface UserData {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  profile: {
    full_name?: string
    role?: string
    tokens?: number
    phone?: string
    specialty?: string
    is_active?: boolean
  } | null
}

function StatCard({ value, label, icon: Icon, color }: any) {
  const { t } = useI18n()

  return (
    <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

function PacientesVinculados({ userId, children, onUnlink }: {
  userId: string
  children: any[]
  onUnlink: (childId: string) => void
}) {
  const { t } = useI18n()
  const hijos = children.filter(c =>
    c.parent_id === userId ||
    (c.parent_ids && c.parent_ids.includes(userId))
  )

  if (hijos.length === 0) return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
      <p className="text-xs text-amber-500 font-medium flex items-center gap-1.5">
        <AlertCircle size={11} /> {t('usuarios.sinPacientesVinculados')} — {t('usuarios.vincularPaciente')}
      </p>
    </div>
  )

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
      <p className="text-[10px] font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
        Pacientes vinculados ({hijos.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {hijos.map((h: any) => (
          <div key={h.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', color: '#be185d' }}>
            <Heart size={10} />
            {h.name}
            <button onClick={() => onUnlink(h.id)} title={t('ui.unlink')}
              className="ml-1 hover:text-red-600 transition-colors">
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UserManagementView() {
  const { t } = useI18n()
  const toast = useToast()
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'jefe' | 'especialista' | 'padre' | 'secretaria' | 'todos'>('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSpecialty, setFilterSpecialty] = useState<string>('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [children, setChildren] = useState<any[]>([])

  // Vinculación múltiple: un hijo puede tener 2 padres
  const [linkingParent, setLinkingParent] = useState<UserData | null>(null)
  const [selectedChildId, setSelectedChildId] = useState('')
  const [savingLink, setSavingLink] = useState(false)

  // Password change
  const [changingPasswordFor, setChangingPasswordFor] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Tokens
  const [editingTokensFor, setEditingTokensFor] = useState<string | null>(null)
  const [newTokens, setNewTokens] = useState(0)
  const [savingTokens, setSavingTokens] = useState(false)

  // Especialidad / clasificación de equipo (interno)
  const [editingSpecialtyFor, setEditingSpecialtyFor] = useState<string | null>(null)
  const [newSpecialty, setNewSpecialty] = useState('')
  const [savingSpecialty, setSavingSpecialty] = useState(false)

  // Create user
  const [createForm, setCreateForm] = useState({ email: '', password: '', full_name: '', role: 'especialista', specialty: '' })
  const [creatingUser, setCreatingUser] = useState(false)

  const cargarUsuarios = useCallback(async () => {
    setIsLoading(true)
    try {
      const { createClient: cc } = await import('@supabase/supabase-js')
      const sb = cc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        // Obtener rol actual del usuario logueado
        const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single()
        if (prof) setCurrentUserRole(prof.role || '')
      }

      const resUsers = await fetch('/api/admin/users')
      const json = await resUsers.json()
      if (json.error) throw new Error(json.error)
      setUsers(json.data || [])

      // Cargar niños usando API admin (bypassa RLS)
      try {
        const kidsRes = await fetch('/api/admin/children')
        const kidsJson = await kidsRes.json()
        if (kidsJson.data) setChildren(kidsJson.data)
      } catch (e) { console.error('[UserMgmt] children fetch failed:', e) }
    } catch (err: any) {
      toast.error('Error cargando usuarios: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { cargarUsuarios() }, [cargarUsuarios])

  // Protección: director no puede cambiar rol de otro director
  // Solo un "super director" (el primero registrado / admin) puede hacerlo
  const canChangeRole = (targetUser: UserData) => {
    const targetRole = targetUser.profile?.role || ''
    const isTargetDirector = targetRole === 'jefe' || targetRole === 'admin'
    if (isTargetDirector) return false
    // Don't block if currentUserId not loaded yet — let the server handle self-change protection
    if (currentUserId && targetUser.id === currentUserId) return false
    return true
  }

  const handleChangeRole = async (user: UserData, newRole: string) => {
    if (!canChangeRole(user)) {
      const targetRole = user.profile?.role || ''
      const isDirector = targetRole === 'jefe' || targetRole === 'admin'
      if (isDirector) toast.error('No podés cambiar el rol de un Director.')
      else toast.warning('No podés cambiarte el rol a ti mismo.')
      return
    }
    setSavingRole(user.id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'update_role', userId: user.id, role: newRole , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`✅ Rol actualizado → ${newRole}`)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, profile: { ...u.profile, role: newRole } } : u))
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally {
      setSavingRole(null)
    }
  }

  const handleToggleActive = async (user: UserData) => {
    if (user.id === currentUserId) return
    const targetRole = user.profile?.role || ''
    if (targetRole === 'jefe' || targetRole === 'admin') {
      toast.error('No podés desactivar a un Director.')
      return
    }
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'toggle_active', userId: user.id , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(json.is_active ? '✅ Usuario activado' : '⏸ Usuario desactivado')
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, profile: { ...u.profile, is_active: json.is_active } } : u))
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleChangePassword = async () => {
    if (!changingPasswordFor) return
    if (!newPassword || newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return }
    setSavingPassword(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'change_password', userId: changingPasswordFor.id, newPassword , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('✅ Contraseña actualizada')
      setChangingPasswordFor(null); setNewPassword(''); setConfirmPassword('')
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingPassword(false) }
  }

  const handleUpdateTokens = async (userId: string) => {
    setSavingTokens(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'update_tokens', userId, tokens: newTokens , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('✅ Tokens actualizados')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, profile: { ...u.profile, tokens: newTokens } } : u))
      setEditingTokensFor(null)
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingTokens(false) }
  }

  const handleUpdateSpecialty = async (userId: string) => {
    setSavingSpecialty(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'update_profile', userId, specialty: newSpecialty.trim() }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('✅ Especialidad actualizada')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, profile: { ...u.profile, specialty: newSpecialty.trim() } } : u))
      setEditingSpecialtyFor(null)
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingSpecialty(false) }
  }

  const handleSendResetEmail = async (user: UserData) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'send_reset_email', email: user.email , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`📧 Email enviado a ${user.email}`)
    } catch (err: any) { toast.error('Error: ' + err.message) }
  }

  // Vinculación múltiple: un hijo puede tener HASTA 2 padres
  const handleLinkParentChild = async () => {
    if (!linkingParent || !selectedChildId) return
    setSavingLink(true)
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

      const child = children.find(c => c.id === selectedChildId)
      if (!child) throw new Error('Paciente no encontrado')

      const linkRes = await fetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: selectedChildId, parentId: linkingParent.id })
      })
      const linkJson = await linkRes.json()
      if (linkJson.error) throw new Error(linkJson.error)
      toast.success(`✅ ${child.name} vinculado a ${linkingParent.profile?.full_name || linkingParent.email}`)

      setChildren(prev => prev.map(c => c.id === selectedChildId ? { ...c, parent_id: linkingParent.id } : c))
      setLinkingParent(null); setSelectedChildId('')
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setSavingLink(false) }
  }

  const handleUnlinkChild = async (childId: string) => {
    try {
      const res = await fetch('/api/admin/children', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, parentId: null })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setChildren(prev => prev.map(c => c.id === childId ? { ...c, parent_id: null } : c))
      toast.success('Paciente desvinculado')
    } catch (err: any) { toast.error('Error: ' + err.message) }
  }

  const handleCreateUser = async () => {
    if (!createForm.email || !createForm.password) { toast.error('Email y contraseña son requeridos'); return }
    setCreatingUser(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ action: 'create_user', ...createForm, newPassword: createForm.password, locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('✅ Usuario creado')
      setShowCreateModal(false)
      setCreateForm({ email: '', password: '', full_name: '', role: 'especialista', specialty: '' })
      cargarUsuarios()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally { setCreatingUser(false) }
  }

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase()
    const matchSearch = !term || u.email.toLowerCase().includes(term) || u.profile?.full_name?.toLowerCase().includes(term)
    const role = u.profile?.role || ''
    const matchTab = activeTab === 'todos' || (activeTab === 'jefe' && (role === 'jefe' || role === 'admin')) || activeTab === role
    const matchSpecialty = !filterSpecialty || u.profile?.specialty === filterSpecialty
    return matchSearch && matchTab && matchSpecialty
  })

  // Especialidades existentes en el equipo (para el filtro), ordenadas
  const especialidadesEquipo = Array.from(
    new Set(users.map(u => u.profile?.specialty).filter(Boolean) as string[])
  ).sort()

  const totalJefes = users.filter(u => u.profile?.role === 'jefe' || u.profile?.role === 'admin').length
  const totalEspecialistas = users.filter(u => u.profile?.role === 'especialista').length
  const totalPadres = users.filter(u => u.profile?.role === 'padre').length
  const totalSecretarias = users.filter(u => u.profile?.role === 'secretaria').length
  const totalActivos = users.filter(u => u.profile?.is_active !== false).length

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-sky-500" size={32} />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in pb-6">

      {/* Datalist global de especialidades (lo usan el modal de crear y la edición inline) */}
      <datalist id="specialty-suggestions">
        {/* Sugeridas + las que ya existen en el equipo (dinámicas) */}
        {Array.from(new Set([
          ...SPECIALTY_SUGGESTIONS,
          ...users.map(u => u.profile?.specialty).filter(Boolean) as string[],
        ])).map(sp => <option key={sp} value={sp} />)}
      </datalist>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('usuarios.gestion')}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{users.length} usuarios registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cargarUsuarios} className="p-2 rounded-xl transition-colors hover:opacity-80"
            style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>
            <RefreshCw size={16} />
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm">
            <Plus size={16} /> {t('usuarios.nuevo')}
          </button>
        </div>
      </div>

      {/* Tabs por rol */}
      <div className="flex gap-1 border-b overflow-x-auto scrollbar-hide" style={{ borderColor: 'var(--card-border)' }}>
        {[
          { id: 'todos',       label: t('common.todos'),        count: users.length,        icon: Users,       color: 'text-slate-500' },
          { id: 'jefe',        label: 'Directores',   count: totalJefes,          icon: Crown,       color: 'text-sky-600' },
          { id: 'especialista',label: 'Especialistas', count: totalEspecialistas,  icon: Stethoscope, color: 'text-sky-600' },
          { id: 'padre',       label: 'Padres',       count: totalPadres,         icon: Heart,       color: 'text-pink-600' },
          { id: 'secretaria',  label: 'Secretarias', count: totalSecretarias,    icon: ClipboardList, color: 'text-sky-600' },
        ].map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs md:text-sm font-bold rounded-t-xl border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                isActive ? `border-sky-600 ${tab.color}` : 'border-transparent'
              }`}
              style={{ color: isActive ? undefined : 'var(--text-muted)', background: isActive ? 'rgba(37,99,235,0.07)' : 'transparent' }}>
              <Icon size={13} />
              {tab.label}
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: isActive ? '#2563eb' : 'var(--muted-bg)', color: isActive ? '#fff' : 'var(--text-muted)' }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard value={totalActivos}       label="Activos"       icon={UserCheck}   color="bg-emerald-500" />
        <StatCard value={totalJefes}         label="Directores"    icon={Crown}        color="bg-sky-500" />
        <StatCard value={totalEspecialistas} label="Especialistas" icon={Stethoscope}  color="bg-sky-500" />
        <StatCard value={totalPadres}        label="Padres"        icon={Heart}        color="bg-pink-500" />
        <StatCard value={totalSecretarias}   label="Secretarias"  icon={ClipboardList}color="bg-sky-500" />
      </div>

      {/* Buscador + filtro por especialidad */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            {...{placeholder: t('ui.search_user')}}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
        </div>
        {especialidadesEquipo.length > 0 && (
          <div className="relative sm:w-64">
            <Briefcase size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <select value={filterSpecialty} onChange={e => setFilterSpecialty(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
              <option value="">Todas las especialidades</option>
              {especialidadesEquipo.map(sp => <option key={sp} value={sp}>{sp}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Lista de usuarios */}
      <div className="space-y-2">
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
            <Users size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('ui.no_patients')}</p>
          </div>
        )}

        {filteredUsers.map(user => {
          const isExpanded = expandedUser === user.id
          const isActive = user.profile?.is_active !== false
          const role = user.profile?.role || 'padre'
          const isDirector = role === 'jefe' || role === 'admin'
          const isSelf = user.id === currentUserId

          return (
            <div key={user.id} className={`rounded-2xl transition-all duration-200 ${!isActive ? 'opacity-60' : ''}`}
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>

              {/* Fila principal */}
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0
                  ${isDirector ? 'bg-gradient-to-br from-sky-500 to-sky-700'
                    : role === 'especialista' ? 'bg-gradient-to-br from-sky-500 to-sky-700'
                    : 'bg-gradient-to-br from-pink-500 to-pink-700'}`}>
                  {(user.profile?.full_name || user.email).charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {user.profile?.full_name || 'Sin nombre'}
                    </p>
                    <RoleBadge role={role} />
                    {/* Especialidad (clasificación interna del equipo) */}
                    {role !== 'padre' && user.profile?.specialty && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1"
                        style={{ background: 'rgba(123,94,167,0.12)', color: '#7b5ea7' }}>
                        <Briefcase size={9} /> {user.profile.specialty}
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">TÚ</span>
                    )}
                    {!isActive && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">{t('usuarios.inactivo2')}</span>
                    )}
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                </div>

                {/* Acciones rápidas */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {savingRole === user.id ? (
                    <Loader2 size={16} className="animate-spin text-sky-500" />
                  ) : (
                    <RoleSelector
                      currentRole={role}
                      onSelect={(newRole) => handleChangeRole(user, newRole)}
                      disabled={isSelf || isDirector}
                    />
                  )}

                  {/* Toggle activo — protegido para directores y uno mismo */}
                  <button
                    onClick={() => handleToggleActive(user)}
                    disabled={isSelf || isDirector}
                    title={isSelf ? 'No podés desactivarte' : isDirector ? 'No podés desactivar directores' : isActive ? 'Desactivar' : 'Activar'}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ color: isActive ? '#10b981' : 'var(--text-muted)' }}>
                    {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>

                  {/* Expandir */}
                  <button onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                    style={{ color: 'var(--text-muted)', background: 'var(--muted-bg)' }}>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {/* Panel expandido */}
              {isExpanded && (
                <div className="border-t px-4 py-4 animate-fade-in" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Meta */}
                    <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <p className="flex items-center gap-1.5"><Calendar size={11} /> Creado: {new Date(user.created_at).toLocaleDateString('es')}</p>
                      <p className="flex items-center gap-1.5"><Clock size={11} /> Último acceso: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es') : 'Nunca'}</p>
                      <p className="flex items-center gap-1.5"><Ticket size={11} /> Tokens: <strong style={{ color: 'var(--text-primary)' }}>{user.profile?.tokens ?? 0}</strong></p>

                      {/* Especialidad / clasificación de equipo — solo staff (no padres) */}
                      {role !== 'padre' && (
                        editingSpecialtyFor === user.id ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Briefcase size={11} />
                            <input
                              type="text" value={newSpecialty} autoFocus list="specialty-suggestions"
                              onChange={e => setNewSpecialty(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleUpdateSpecialty(user.id); if (e.key === 'Escape') setEditingSpecialtyFor(null) }}
                              placeholder="Elegí una o escribí la tuya…"
                              className="flex-1 px-2 py-1 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                              style={{ background: 'var(--card)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
                            <button onClick={() => handleUpdateSpecialty(user.id)} disabled={savingSpecialty}
                              className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50" title="Guardar">
                              {savingSpecialty ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            </button>
                            <button onClick={() => setEditingSpecialtyFor(null)} className="p-1 rounded-md hover:text-red-500" style={{ color: 'var(--text-muted)' }} title="Cancelar">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="flex items-center gap-1.5">
                            <Briefcase size={11} />
                            {user.profile?.specialty
                              ? <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user.profile.specialty}</span>
                              : <span className="italic">Sin especialidad asignada</span>}
                            <button
                              onClick={() => { setEditingSpecialtyFor(user.id); setNewSpecialty(user.profile?.specialty || '') }}
                              className="ml-1 text-sky-500 hover:underline font-semibold">
                              {user.profile?.specialty ? 'editar' : 'asignar'}
                            </button>
                          </p>
                        )
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setChangingPasswordFor(user); setNewPassword(''); setConfirmPassword('') }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                        <Lock size={12} /> Cambiar contraseña
                      </button>

                      <button onClick={() => handleSendResetEmail(user)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                        style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                        <Send size={12} /> {t('common.enviandoReset')}
                      </button>

                      {editingTokensFor === user.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" value={newTokens} onChange={e => setNewTokens(parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
                          <button onClick={() => handleUpdateTokens(user.id)} disabled={savingTokens}
                            className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-50">
                            {savingTokens ? <Loader2 size={12} className="animate-spin" /> : t('common.guardar')}
                          </button>
                          <button onClick={() => setEditingTokensFor(null)} className="px-2 py-1.5 rounded-lg hover:text-red-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingTokensFor(user.id); setNewTokens(user.profile?.tokens || 0) }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                          <Ticket size={12} /> Editar tokens
                        </button>
                      )}

                      {!user.email_confirmed && (
                        <button onClick={async () => {
                          try {
                            const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' }, body: JSON.stringify({ action: 'confirm_email', userId: user.id }) })
                            const json = await res.json()
                            if (json.error) throw new Error(json.error)
                            toast.success('✅ Email confirmado')
                            cargarUsuarios()
                          } catch (err: any) { toast.error('Error: ' + err.message) }
                        }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#059669' }}>
                          <CheckCircle2 size={12} /> Confirmar email
                        </button>
                      )}

                      {role === 'padre' && (
                        <button onClick={() => { setLinkingParent(user)
      // Recargar niños al abrir modal
      fetch('/api/admin/children').then(r=>r.json()).then(j=>{
        if(j.data) setChildren(j.data)
      }).catch(()=>{}); setSelectedChildId('') }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{ background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)', color: '#be185d' }}>
                          <Link2 size={12} /> {t('common.vincular')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pacientes vinculados */}
                  {role === 'padre' && (
                    <PacientesVinculados userId={user.id} children={children} onUnlink={handleUnlinkChild} />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal Cambiar Contraseña */}
      {changingPasswordFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-scale-in" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{t('ui.change_password')}</h3>
              <button onClick={() => setChangingPasswordFor(null)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Usuario: <strong style={{ color: 'var(--text-primary)' }}>{changingPasswordFor.profile?.full_name || changingPasswordFor.email}</strong>
            </p>
            <div className="space-y-3">
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} {...{placeholder: t('ui.new_password')}} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
                <button onClick={() => setShowPwd(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input type={showPwd ? 'text' : 'password'} {...{placeholder: t('ui.confirm_password')}} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
            </div>
            <button onClick={handleChangePassword} disabled={savingPassword}
              className="mt-4 w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
              Actualizar contraseña
            </button>
          </div>
        </div>
      )}

      {/* Modal Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl shadow-2xl p-6 w-full max-w-md animate-scale-in" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Plus size={18} className="text-sky-500" /> Crear nuevo usuario
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <div className="space-y-3">
              {['Nombre completo', 'Email', 'Contraseña (mínimo 6 caracteres)'].map((ph, i) => (
                <input key={i} placeholder={ph} type={i === 2 ? 'password' : i === 1 ? 'email' : 'text'}
                  value={i === 0 ? createForm.full_name : i === 1 ? createForm.email : createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, [i === 0 ? 'full_name' : i === 1 ? 'email' : 'password']: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
              ))}
              <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
                <option value="jefe">👑 Director — Acceso total</option>
                <option value="especialista">{t('ui.specialist_role')}</option>
                <option value="padre">{t('usuarios.rolPadre')}</option>
                <option value="secretaria">📋 Secretaria(o) — Apoyo administrativo</option>
              </select>
              {createForm.role !== 'padre' && (
                <input list="specialty-suggestions" placeholder="Especialidad / área (elegí una o escribí la tuya)" value={createForm.specialty}
                  onChange={e => setCreateForm(f => ({ ...f, specialty: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
              )}
            </div>
            <button onClick={handleCreateUser} disabled={creatingUser}
              className="mt-4 w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {creatingUser ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Crear usuario
            </button>
          </div>
        </div>
      )}

      {/* Modal Vincular Paciente */}
      {linkingParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-scale-in" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Heart size={18} className="text-pink-500" /> Vincular paciente
              </h3>
              <button onClick={() => setLinkingParent(null)} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
              Padre/Tutor: <strong style={{ color: 'var(--text-primary)' }}>{linkingParent.profile?.full_name || linkingParent.email}</strong>
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Si el paciente ya tiene tutor asignado, será reemplazado. Para acceso de dos tutores simultáneos, creá dos cuentas de padre y vincinalas por separado.
            </p>
            <label className="text-xs font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>
              Seleccioná el paciente
            </label>
            <select value={selectedChildId} onChange={e => setSelectedChildId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 mb-4"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
              <option value="">{t('usuarios.selPaciente2')}</option>
              {children.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.parent_id && c.parent_id !== linkingParent.id ? ' ⚠️ ya tiene tutor' : ''}
                </option>
              ))}
            </select>
            {children.length === 0 && (
              <p className="text-xs text-amber-500 font-medium mb-3">No hay pacientes registrados.</p>
            )}
            <button onClick={handleLinkParentChild} disabled={savingLink || !selectedChildId}
              className="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white"
              style={{ background: '#db2777' }}>
              {savingLink ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              Vincular
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
