'use client'

import PWAInstallButton from '@/components/PWAInstallButton'
import { useI18n } from '@/lib/i18n-context'

import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

import {
  LayoutDashboard, Users, LogOut, Bell, Brain, Calendar, BookOpen, MessageCircle,
  X, User, FileText, Loader2, Key, BarChart3, ShieldCheck, Upload,
  ChevronRight, Settings, Crown, Stethoscope, ShoppingBag, Activity,
  Database, Sparkles, Zap, Maximize2, Minimize2, Minus, DollarSign, Mic
} from 'lucide-react'

import AnalyticsDashboard from '@/components/AnalyticsDashboard'
import { useToast } from '@/components/Toast'
import { ThemeToggleButton, useTheme } from '@/components/ThemeContext'
import DashboardHome from './components/DashboardHome'
import PatientsView from './components/PatientsView'
import CalendarView from './components/CalendarView'
import ExcelImportView from './components/ExcelImportView'
import UserManagementView from './components/UserManagementView'
import EvaluacionesUnificadas from './components/EvaluacionesUnificadas'
import ResourcesManagementView from './components/ResourcesManagementView'
import MensajesPendientesPanel from './components/MensajesPendientesPanel'
import AIReportView from './components/AIReportView'
import StoreManagementView from './components/StoreManagementView'
import CatalogoTerapiasView from './components/CatalogoTerapiasView'
import KnowledgeBaseView from './components/KnowledgeBaseView'
import ARIAAgentChat from './components/ARIAAgentChat'
import ProgramasABAView from './components/ProgramasABAView'
import DashboardGraficasABA from './components/DashboardGraficasABA'
import InteligenciaHubView from './components/InteligenciaHubView'
import LocaleSelector from '@/app/components/LocaleSelector'
import WhatsAppQRPanel from './components/WhatsAppQRPanel'
import ConfiguracionView from './components/ConfiguracionView'
import ARIAFloatingChat from './components/ARIAFloatingChat'
import ChatEspecialistas from './components/ChatEspecialistas'
import AdminPagos from './components/AdminPagos'
import AdminReportesFinancieros from './components/AdminReportesFinancieros'
import FonemasAdminView from './components/FonemasAdminView'

// ── Features & Roles types (mirrors control/route.ts) ────────────────────────
type FeaturesConfig = {
  agenda: boolean; ninos: boolean; inteligencia: boolean; cerebro: boolean
  pagos: boolean; reportes_financieros: boolean; recursos_adicionales: boolean
  chat_especialistas: boolean
  ninos_info: boolean; ninos_programas: boolean; ninos_evaluaciones: boolean
  ninos_eval_inicial: boolean; ninos_historial: boolean; ninos_fichas: boolean
  ninos_documentos: boolean
}
type RolesConfig = { jefe: boolean; especialista: boolean; secretaria: boolean; padre: boolean }

const DEFAULT_FEATURES: FeaturesConfig = {
  agenda: true, ninos: true, inteligencia: true, cerebro: true,
  pagos: true, reportes_financieros: true, recursos_adicionales: true, chat_especialistas: true,
  ninos_info: true, ninos_programas: true, ninos_evaluaciones: true,
  ninos_eval_inicial: true, ninos_historial: true, ninos_fichas: true, ninos_documentos: true,
}

const ROLE_ICON: Record<string, any> = {
  jefe: Crown,
  admin: Crown,
  especialista: Stethoscope,
}

function SidebarLink({ icon: Icon, label, active, onClick, small, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-left
        ${active
          ? 'bg-gradient-to-r from-sky-600 to-cyan-600 text-white shadow-md shadow-sky-500/30'
          : 'text-slate-500 dark:text-slate-400 hover:bg-sky-50/70 dark:hover:bg-[#21262d] hover:text-slate-800 dark:hover:text-slate-200'
        } ${small ? 'text-xs' : 'text-sm'}`}
    >
      <Icon size={small ? 15 : 17} className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-sky-500'}`} />
      <span className={`font-semibold truncate flex-1 ${small ? 'text-xs' : ''}`}>{label}</span>
      {badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
          ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

function RecursosAdicionalesView({ isDark }: { isDark: boolean }) {
  const [tab, setTab] = useState<'recursos' | 'tienda' | 'terapias' | 'fonemas'>('recursos')
  return (
    <div className="flex flex-col gap-4">
      <div className={`flex gap-1 p-1 rounded-xl w-fit flex-wrap ${isDark ? 'bg-[#21262d]' : 'bg-slate-100'}`}>
        {([
          { id: 'recursos', icon: BookOpen, label: 'Recursos' },
          { id: 'tienda',   icon: ShoppingBag, label: 'Tienda' },
          { id: 'terapias', icon: Sparkles,   label: 'Catálogo Terapias' },
          { id: 'fonemas',  icon: Mic,         label: 'Fonemas' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${tab === t.id
                ? 'bg-sky-600 text-white shadow-md'
                : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'recursos' && <ResourcesManagementView />}
      {tab === 'tienda'   && <StoreManagementView />}
      {tab === 'terapias' && <CatalogoTerapiasView />}
      {tab === 'fonemas'  && <FonemasAdminView />}
    </div>
  )
}

export default function AdminDashboard() {
  const router = useRouter()
  const toast = useToast()
  const { isDark } = useTheme()
  const { t } = useI18n()

  // ── Features & Roles from control API ──────────────────────────────────────
  const [features, setFeatures] = useState<FeaturesConfig>(DEFAULT_FEATURES)
  const [rolesConfig, setRolesConfig] = useState<RolesConfig>({ jefe: true, especialista: true, secretaria: true, padre: true })

  useEffect(() => {
    fetch('/api/control', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        if (j.features) setFeatures({ ...DEFAULT_FEATURES, ...j.features })
        if (j.roles_config) setRolesConfig(rc => ({ ...rc, ...j.roles_config }))
      })
      .catch(() => { /* silently fallback to defaults */ })
  }, [])

  // ── Nav items filtered by features ─────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'inicio',       icon: LayoutDashboard, label: t('nav.inicio'),          roles: ['jefe','admin','especialista','terapeuta'], featureKey: null },
    { id: 'agenda',       icon: Calendar,        label: t('nav.agenda'),          roles: ['jefe','admin'],                            featureKey: 'agenda' },
    { id: 'ninos',        icon: Users,           label: t('nav.pacientes'),       roles: ['jefe','admin','especialista','terapeuta'], featureKey: 'ninos' },
    { id: 'inteligencia', icon: Zap,             label: t('nav.hub'),             roles: ['jefe','admin','especialista'],             featureKey: 'inteligencia' },
    { id: 'cerebro',      icon: Database,        label: t('nav.cerebro'),         roles: ['jefe','admin'],                            featureKey: 'cerebro' },
    { id: 'pagos',        icon: DollarSign,      label: 'Pagos',                  roles: ['jefe','admin'],                            featureKey: 'pagos' },
    { id: 'reportes-financieros', icon: BarChart3, label: 'Reportes Financieros', roles: ['jefe'],                                   featureKey: 'reportes_financieros' },
    { id: 'recursos-adicionales', icon: BookOpen, label: 'Recursos Adicionales',  roles: ['jefe','admin','especialista','terapeuta','secretaria'], featureKey: 'recursos_adicionales' },
    { id: 'chat-especialistas', icon: MessageCircle, label: 'Chat Equipo',        roles: ['jefe'],                                   featureKey: 'chat_especialistas' },
  ]

  const MOBILE_NAV = [
    { id: 'inicio',       icon: LayoutDashboard, label: t('nav.inicio') },
    { id: 'ninos',        icon: Users,           label: t('nav.pacientes') },
    { id: 'vadi',         icon: Sparkles,        label: t('nav.aria') },
    { id: 'evaluaciones', icon: FileText,        label: t('nav.evaluaciones') },
  ]
  const SECONDARY_NAV = [
    { id: 'usuarios', icon: Key, label: t('nav.usuarios'), roles: ['jefe','admin'] },
    { id: 'config',   icon: User, label: 'Mi Perfil' },
    { id: 'importar', icon: Upload, label: t('nav.importarCSV'), hidden: true },
  ]
  const PAGE_TITLES: Record<string, string> = {
    inicio: t('dashboard.titulo'), agenda: t('nav.agenda'),
    ninos: t('nav.pacientes'),
    reportes: t('nav.historial'), recursos: t('nav.recursos'), 'recursos-adicionales': 'Recursos Adicionales',
    mensajes: t('mensajes.titulo'), usuarios: t('nav.usuarios'),
    importar: 'Importar CSV', vadi: t('nav.aria'),
    cerebro: t('nav.cerebro'), inteligencia: t('nav.hub'),
    pagos: 'Pagos y Facturación', 'reportes-financieros': 'Reportes Financieros',
    'chat-especialistas': 'Chat Equipo', config: 'Mi Perfil',
  }

  const [currentView, setCurrentView] = useState('inicio')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [selectedChildReport, setSelectedChildReport] = useState<{id: string, name: string} | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [userId, setUserId] = useState('')
  const [chatUnread, setChatUnread] = useState(0)
  const [ariaOpen, setAriaOpen] = useState(false)
  const [ariaExpanded, setAriaExpanded] = useState(false)
  const [ariaMinimized, setAriaMinimized] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [activeChild, setActiveChild] = useState<{id: string, name: string} | null>(null)
  const [pendingChildId, setPendingChildId] = useState<string | null>(null)
  const [pendingChildTab, setPendingChildTab] = useState<string | null>(null)

  // Clear patient context when leaving patients view
  useEffect(() => { if (currentView !== 'ninos') setActiveChild(null) }, [currentView])

  // Reset unread when entering chat
  useEffect(() => {
    if (currentView === 'chat-especialistas') {
      setChatUnread(0)
      if (userId) {
        supabase.from('chat_especialista_admin')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', userId)
          .is('read_at', null)
          .then(() => {})
      }
    }
  }, [currentView, userId])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: any } }) => {
      if (user?.email) {
        setUserEmail(user.email)
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        if (profile) setUserProfile(profile)

        const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { count } = await supabase
          .from('chat_especialista_admin')
          .select('id', { count: 'exact', head: true })
          .eq('recipient_id', user.id)
          .is('read_at', null)
          .gte('created_at', hace7dias)
        setChatUnread(count || 0)

        const channel = supabase
          .channel('admin-chat-unread')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_especialista_admin',
            filter: `recipient_id=eq.${user.id}`,
          }, () => {
            setChatUnread(prev => prev + 1)
          })
          .subscribe()
        return () => { supabase.removeChannel(channel) }
      }
    })
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('appointments')
      .select('*, children(name)')
      .eq('appointment_date', hoy)
      .order('appointment_time', { ascending: true })
    if (data) {
      setNotifications(data.map(c => ({
        id: c.id,
        titulo: 'Cita para hoy',
        detalle: `${c.children?.name} · ${c.appointment_time?.slice(0, 5)}`,
      })))
    }
  }

  const handleLogout = async () => {
    try {
      await releaseSessionNow()
      await supabase.auth.signOut()
      router.push('/login')
    } catch { toast.error('Error al cerrar sesión') }
  }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.warning('Mínimo 6 caracteres'); return }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Contraseña actualizada')
      setShowChangePassword(false)
    } catch (e: any) { toast.error(e.message) }
    finally { setChangingPassword(false) }
  }

  const navigateTo = (view: string) => { setCurrentView(view); setSidebarOpen(false) }
  const navigateToPatient = (childId: string, tab?: string) => {
    setPendingChildId(childId); setPendingChildTab(tab || null); setCurrentView('ninos'); setSidebarOpen(false)
  }

  const role = userProfile?.role || 'admin'
  const RoleIcon = ROLE_ICON[role] || User
  const roleName = role === 'jefe' || role === 'admin' ? 'Jefe' : role === 'especialista' ? 'Especialista' : 'Usuario'
  const userName = userProfile?.full_name || 'Usuario'
  const userInitial = userName.charAt(0).toUpperCase()

  // ── Helper: check if a feature is enabled ──────────────────────────────────
  const feat = (key: keyof FeaturesConfig) => features[key] !== false

  // ── Filtered nav items (by role AND feature flag) ──────────────────────────
  const visibleNavItems = NAV_ITEMS.filter(item => {
    const roleOk = item.roles.includes(role) || role === 'admin' || role === 'jefe'
    const featureOk = !item.featureKey || feat(item.featureKey as keyof FeaturesConfig)
    return roleOk && featureOk
  })

  return (
    <>
    <PWAInstallButton />
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-200
      ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>

      {/* SIDEBAR */}
      <aside className={`
        fixed md:static z-40 h-full w-[215px] flex flex-col sidebar-transition
        border-r transition-transform duration-300
        ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-100'} shadow-sm
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${focusMode ? 'md:-translate-x-full md:w-0 md:overflow-hidden md:border-0' : ''}
      `}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-[60px] border-b flex-shrink-0
          ${isDark ? 'border-[#21262d]' : 'border-slate-100/80'}`}>
          <div
            className="relative w-10 h-10 flex-shrink-0 rounded-full shadow-md ring-2 overflow-hidden"
            style={{ background: '#ffffff', padding: '3px', borderColor: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}
          >
            <Image src="/images/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-[13px] leading-tight truncate tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              Neuropsicología y Terapias SANTI
            </p>
            <p className={`text-[10px] font-semibold tracking-wide ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
              Panel {roleName}
            </p>
          </div>
          <button onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {/* Main nav — filtered by features */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {visibleNavItems.map(item => (
            <SidebarLink
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={currentView === item.id}
              onClick={() => navigateTo(item.id)}
              badge={item.id === 'chat-especialistas' ? chatUnread : 0}
            />
          ))}

          <div className={`pt-4 mt-2 border-t ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
            <p className={`text-[10px] font-bold px-3 mb-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Sistema
            </p>
            {SECONDARY_NAV.filter((item: any) => !item.hidden && (!item.roles || item.roles.includes(role))).map(item => (
              <SidebarLink
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={currentView === item.id}
                onClick={() => navigateTo(item.id)}
                small
                badge={0}
              />
            ))}
          </div>
        </nav>

        {/* User footer */}
        <div className={`p-3 border-t flex-shrink-0 ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
          <div
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors
              ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-50'}`}
            onClick={() => { setCurrentView('config'); setSidebarOpen(false) }}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
              {userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {userName}
              </p>
              <p className={`text-[10px] truncate ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {userEmail}
              </p>
            </div>
            <Settings size={14} className="text-slate-400 flex-shrink-0" />
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* MAIN */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {focusMode && (
          <button
            onClick={() => setFocusMode(false)}
            title="Salir del modo enfoque"
            className={`hidden md:flex fixed top-3 right-4 z-50 items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg border transition-all hover:scale-105
              ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-300 hover:bg-[#30363d]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            Salir de pantalla completa
          </button>
        )}

        {/* Topbar */}
        <header className={`h-14 md:h-16 flex items-center justify-between px-3 md:px-6 flex-shrink-0 border-b transition-all duration-300
          ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'}
          ${focusMode ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2 md:gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden p-2 rounded-lg transition-colors
                ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
            >
              <LayoutDashboard size={18} />
            </button>
            <div>
              <h1 className={`text-sm md:text-lg font-bold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {PAGE_TITLES[currentView] || 'Panel'}
              </h1>
              <p className={`text-[10px] hidden sm:block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Neuropsicología y Terapias SANTI · Gestión Integral
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentView === 'reportes' && selectedChildReport && (
              <button
                onClick={() => setShowAnalytics(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold text-xs shadow hover:shadow-md transition-all"
              >
                <BarChart3 size={14} /> Analytics
              </button>
            )}

            <button
              onClick={() => setFocusMode(f => !f)}
              title="Pantalla completa"
              className={`hidden md:flex p-2 rounded-lg transition-colors
                ${focusMode
                  ? (isDark ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-50 text-sky-600')
                  : (isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500')
                }`}
            >
              {focusMode
                ? <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                : <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              }
            </button>

            <LocaleSelector compact={true} />
            <ThemeToggleButton />

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false) }}
                className={`p-2 rounded-lg relative transition-colors
                  ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <Bell size={18} />
                {(notifications.length > 0 || chatUnread > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              {showNotifications && (
                <div className={`absolute right-0 top-11 w-72 rounded-2xl shadow-2xl border p-4 z-50 animate-scale-in
                  ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Notificaciones</p>
                    <button onClick={() => setShowNotifications(false)}><X size={16} className="text-slate-400" /></button>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {chatUnread > 0 && (
                      <div className="space-y-1.5">
                        <p className={`text-[10px] font-bold px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Chat Equipo</p>
                        <button
                          onClick={() => { navigateTo('chat-especialistas'); setShowNotifications(false) }}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors
                            ${isDark ? 'bg-sky-900/20 hover:bg-sky-900/30' : 'bg-sky-50 hover:bg-sky-100'}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                          <p className={`text-xs font-medium ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                            {chatUnread} mensaje{chatUnread !== 1 ? 's' : ''} sin leer
                          </p>
                        </button>
                      </div>
                    )}
                    {notifications.length > 0 && (
                      <div className="space-y-1.5">
                        <p className={`text-[10px] font-bold px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Citas de hoy</p>
                        {notifications.map(n => (
                          <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl ${isDark ? 'bg-sky-900/20' : 'bg-sky-50'}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-1.5 flex-shrink-0" />
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{n.detalle}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {notifications.length === 0 && chatUnread === 0 && (
                      <p className="text-xs text-slate-400 text-center py-4">{t('ui.no_appts_today')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto transition-colors flex flex-col admin-content
          ${currentView === 'ninos' || currentView === 'agenda' || currentView === 'chat-especialistas' ? 'p-0 overflow-hidden' : 'p-3 md:p-4 pb-28 md:pb-8'}
          ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
          {currentView !== 'usuarios' && (
            <div className={`flex-1 ${currentView === 'ninos' || currentView === 'chat-especialistas' ? 'min-h-0 h-full flex flex-col overflow-hidden' : ''}`}>
              {currentView === 'inicio'       && <DashboardHome navigateTo={navigateTo} navigateToPatient={navigateToPatient} />}
              {currentView === 'agenda'       && feat('agenda') && <CalendarView />}
              {currentView === 'ninos'        && feat('ninos') && (
                <PatientsView
                  initialChildId={pendingChildId}
                  initialTab={pendingChildTab}
                  onPatientSelect={(id: string, name: string) => { setActiveChild({ id, name }); setPendingChildId(null); setPendingChildTab(null) }}
                  // Pass feature flags down so PatientsView can hide disabled tabs
                  enabledTabs={{
                    info: feat('ninos_info'),
                    programas: feat('ninos_programas'),
                    evaluaciones: feat('ninos_evaluaciones'),
                    'eval-inicial': feat('ninos_eval_inicial'),
                    historial: feat('ninos_historial'),
                    fichas: feat('ninos_fichas'),
                    documentos: feat('ninos_documentos'),
                  }}
                />
              )}
              {currentView === 'reportes'     && <AIReportView onChildSelect={setSelectedChildReport} />}
              {currentView === 'recursos'     && <ResourcesManagementView />}
              {currentView === 'tienda'       && <StoreManagementView />}
              {currentView === 'terapias'     && <CatalogoTerapiasView />}
              {currentView === 'recursos-adicionales' && feat('recursos_adicionales') && <RecursosAdicionalesView isDark={isDark} />}
              {currentView === 'config'       && (
                <ConfiguracionView onAvatarUpdate={(url) => setUserProfile((p: any) => ({ ...p, avatar_url: url }))} />
              )}
              {currentView === 'programas'    && (
                <div className="max-w-4xl mx-auto">
                  <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sm text-sky-700">
                    💡 Selecciona un paciente desde <button onClick={() => navigateTo('ninos')} className="font-bold underline">{t('nav.pacientes')}</button> para ver sus programas ABA.
                  </div>
                </div>
              )}
              {currentView === 'vadi'         && (
                <div className="max-w-3xl mx-auto">
                  <ARIAAgentChat userId={userId} />
                </div>
              )}
              {currentView === 'cerebro'      && feat('cerebro') && <KnowledgeBaseView />}
              {currentView === 'inteligencia' && feat('inteligencia') && <InteligenciaHubView />}
              {currentView === 'pagos'        && feat('pagos') && <AdminPagos profile={userProfile} />}
              {currentView === 'reportes-financieros' && feat('reportes_financieros') && <AdminReportesFinancieros />}
              {currentView === 'mensajes' && <MensajesPendientesPanel />}
              {currentView === 'chat-especialistas' && feat('chat_especialistas') && (
                <ChatEspecialistas
                  userId={userId}
                  userName={userProfile?.full_name || 'Admin'}
                  userAvatarUrl={userProfile?.avatar_url}
                  onAvatarUpdate={(url) => setUserProfile((p: any) => ({ ...p, avatar_url: url }))}
                />
              )}
              {currentView === 'importar'     && <ExcelImportView />}
            </div>
          )}
          {currentView === 'usuarios' && (
            <div className="flex-1 min-h-0">
              {/* Pass rolesConfig so UserManagementView only shows enabled roles */}
              <UserManagementView rolesConfig={rolesConfig} />
            </div>
          )}
        </div>
      </main>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className={`rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in
            ${isDark ? 'bg-[#161b22] border border-[#30363d]' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className={`text-lg font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Cambiar Contraseña</h2>
              <button onClick={() => setShowChangePassword(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                {...{placeholder: t('ui.new_password')}}
                className={`w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500
                  ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                {...{placeholder: t('ui.confirm_password')}}
                className={`w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-sky-500
                  ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-200 placeholder-slate-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`} />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowChangePassword(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                  Cancelar
                </button>
                <button onClick={handleChangePassword} disabled={changingPassword}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
                  {changingPassword ? <><Loader2 size={16} className="animate-spin" /> Actualizando...</> : 'Actualizar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAnalytics && selectedChildReport && (
        <AnalyticsDashboard
          childId={selectedChildReport.id}
          childName={selectedChildReport.name}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* ARIA Flotante */}
      {ariaOpen && currentView !== 'chat-especialistas' && (
        <div className={`fixed bottom-6 md:bottom-6 right-4 md:right-6 z-[90] w-[calc(100vw-2rem)] rounded-3xl shadow-2xl overflow-hidden border flex flex-col transition-all duration-300
          ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}
          style={{
            maxWidth: ariaExpanded ? '900px' : '448px',
            height: ariaMinimized ? '54px' : ariaExpanded ? '860px' : '560px',
          }}>
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="9" width="16" height="13" rx="3" fill="white" fillOpacity="0.9"/>
                  <rect x="9" y="13" width="3" height="3" rx="1" fill="#0284c7"/>
                  <rect x="16" y="13" width="3" height="3" rx="1" fill="#0284c7"/>
                  <rect x="11" y="17" width="6" height="1.5" rx="0.75" fill="#0284c7"/>
                  <rect x="13" y="6" width="2" height="4" rx="1" fill="white" fillOpacity="0.9"/>
                  <circle cx="14" cy="5.5" r="1.5" fill="white"/>
                  <rect x="2" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
                  <rect x="23.5" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-tight flex items-center gap-2">
                  ARIA <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[9px] font-bold">IA</span>
                </p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>
                  <p className="text-sky-200 text-[10px] font-medium">{(currentView === 'ninos' && activeChild) ? `Caso: ${activeChild.name}` : 'Asistente Clínico · Activa'}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setAriaMinimized(m => !m)} className="p-1.5 hover:bg-white/20 rounded-xl transition-all" title={ariaMinimized ? 'Restaurar' : 'Minimizar'}>
                <Minus size={15} className="text-white"/>
              </button>
              <button onClick={() => { setAriaExpanded(x => !x); setAriaMinimized(false) }} className="p-1.5 hover:bg-white/20 rounded-xl transition-all" title={ariaExpanded ? 'Reducir' : 'Ampliar'}>
                {ariaExpanded ? <Minimize2 size={15} className="text-white"/> : <Maximize2 size={15} className="text-white"/>}
              </button>
              <button onClick={() => { setAriaOpen(false); setAriaExpanded(false); setAriaMinimized(false) }} className="p-1.5 hover:bg-white/20 rounded-xl transition-all" title="Cerrar">
                <X size={16} className="text-white"/>
              </button>
            </div>
          </div>
          {!ariaMinimized && (
          <div className="flex-1 min-h-0">
            <ARIAAgentChat userId={userId} compact={true}
              childId={currentView === 'ninos' ? activeChild?.id : undefined}
              childName={currentView === 'ninos' ? activeChild?.name : undefined}
              contexto={currentView === 'ninos' && activeChild ? 'paciente' : 'general'} />
          </div>
          )}
        </div>
      )}

      {/* Botón flotante ARIA */}
      {!ariaOpen && currentView !== 'chat-especialistas' && (
        <button
          onClick={() => setAriaOpen(true)}
          className="fixed bottom-6 md:bottom-6 right-4 md:right-6 z-[91] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 bg-gradient-to-br from-sky-600 to-cyan-600"
          title="ARIA — Asistente IA">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="9" width="16" height="13" rx="3" fill="white" fillOpacity="0.9"/>
            <rect x="9" y="13" width="3" height="3" rx="1" fill="#0284c7"/>
            <rect x="16" y="13" width="3" height="3" rx="1" fill="#0284c7"/>
            <rect x="11" y="17" width="6" height="1.5" rx="0.75" fill="#0284c7"/>
            <rect x="13" y="6" width="2" height="4" rx="1" fill="white" fillOpacity="0.9"/>
            <circle cx="14" cy="5.5" r="1.5" fill="white"/>
            <rect x="2" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
            <rect x="23.5" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
          </svg>
          <span className="pointer-events-none absolute inset-0 rounded-full bg-sky-400 animate-ping opacity-20"/>
        </button>
      )}
    </div>
    </>
  )
}
