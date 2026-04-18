'use client'

import { useI18n } from '@/lib/i18n-context'
import { supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, Users, LogOut, Calendar, FileText,
  User, Loader2, Menu, X, Stethoscope, MessageCircle,
  Key, ChevronRight, Sparkles, Maximize2, Minimize2, Minus,
  Zap, Bell, Settings
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import EspecialistaHome from './components/EspecialistaHome'
import PatientsView from '@/app/admin/components/PatientsView'
import ChatEspecialistas from '@/app/admin/components/ChatEspecialistas'
import MiAgenda from './components/MiAgenda'
import MiPerfil from './components/MiPerfil'
import MisFormularios from './components/MisFormularios'
import LocaleSelector from '@/app/components/LocaleSelector'
import { ThemeToggleButton, useTheme } from '@/components/ThemeContext'
import ARIAAgentChat from '@/app/admin/components/ARIAAgentChat'
import InteligenciaHubView from '@/app/admin/components/InteligenciaHubView'

function SidebarLink({ icon: Icon, label, active, onClick, small, badge }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-left
        ${active
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/50'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
        } ${small ? 'text-xs' : 'text-sm'}`}
    >
      <Icon size={small ? 15 : 17} className={`flex-shrink-0 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`} />
      <span className={`font-semibold truncate flex-1 ${small ? 'text-xs' : ''}`}>{label}</span>
      {badge > 0 && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0
          ${active ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

export default function EspecialistaDashboard() {
  const router = useRouter()
  const toast = useToast()
  const { t } = useI18n()
  const { isDark } = useTheme()

  const NAV_ITEMS = [
    { id: 'inicio',       icon: LayoutDashboard, label: t('nav.inicio') },
    { id: 'agenda',       icon: Calendar,        label: 'Agenda' },
    { id: 'pacientes',    icon: Users,           label: 'Pacientes' },
    { id: 'prediccion',   icon: Zap,             label: 'Análisis Predictivo' },
    { id: 'evaluaciones', icon: MessageCircle,   label: 'Chat' },
    { id: 'perfil',       icon: User,            label: t('nav.miperfil') },
  ]

  const PAGE_TITLES: Record<string, string> = {
    inicio:       'Panel Principal',
    agenda:       'Agenda',
    pacientes:    'Pacientes',
    prediccion:   'Análisis Predictivo',
    evaluaciones: 'Chat',
    perfil:       'Mi Perfil',
  }

  const [activeView, setActiveView]                 = useState('inicio')
  const [profile, setProfile]                       = useState<any>(null)
  const [loading, setLoading]                       = useState(true)
  const [sidebarOpen, setSidebarOpen]               = useState(false)
  const [showProfileMenu, setShowProfileMenu]       = useState(false)
  const [showNotifications, setShowNotifications]   = useState(false)
  const [citasHoy, setCitasHoy]                     = useState<any[]>([])
  const [chatUnread, setChatUnread]                 = useState(0)
  const [familiasUnread, setFamiliasUnread]         = useState(0)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword]               = useState('')
  const [confirmPassword, setConfirmPassword]       = useState('')
  const [changingPassword, setChangingPassword]     = useState(false)
  const [ariaOpen, setAriaOpen]                     = useState(false)
  const [ariaExpanded, setAriaExpanded]             = useState(false)
  const [ariaMinimized, setAriaMinimized]           = useState(false)
  const [activeChild, setActiveChild]               = useState<{id: string, name: string} | null>(null)

  useEffect(() => { if (activeView !== 'pacientes') setActiveChild(null) }, [activeView])

  // Reset unread when entering chat
  useEffect(() => {
    if (activeView === 'evaluaciones') {
      setChatUnread(0)
      setFamiliasUnread(0)
      // Mark all as read in DB
      if (profile?.id) {
        supabase.from('chat_especialista_admin')
          .update({ read_at: new Date().toISOString() })
          .eq('recipient_id', profile.id)
          .is('read_at', null)
          .then(() => {})
      }
    }
  }, [activeView, profile?.id])

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof || (prof.role !== 'especialista' && prof.role !== 'admin')) {
        if (prof?.role === 'jefe') { router.push('/admin'); return }
        if (prof?.role === 'padre') { router.push('/padre'); return }
        if (prof?.role === 'secretaria') { router.push('/secretaria'); return }
        router.push('/login'); return
      }
      setProfile({ ...prof, email: session.user.email })
    } catch { router.push('/login') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    const fetchCitasHoy = async () => {
      const hoy = new Date().toISOString().split('T')[0]
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('appointments')
        .select('*, children(name)')
        .eq('appointment_date', hoy)
        .eq('specialist_id', session.user.id)
        .order('appointment_time', { ascending: true })
      if (data) setCitasHoy(data)

      // Load initial chat unread count — solo mensajes recientes no leídos
      const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('chat_especialista_admin')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', session.user.id)
        .is('read_at', null)
        .gte('created_at', hace7dias)
      setChatUnread(count || 0)

      // Realtime: new messages → increment badge (team chat)
      const channel = supabase
        .channel('esp-chat-unread')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_especialista_admin',
          filter: `recipient_id=eq.${session.user.id}`,
        }, () => {
          setChatUnread(prev => prev + 1)
        })
        .subscribe()

      // Familias unread: mensajes de padres no leídos
      const { count: famCount } = await supabase
        .from('chat_familias')
        .select('id', { count: 'exact', head: true })
        .eq('sender_role', 'padre')
        .not('read_by', 'cs', `{${session.user.id}}`)
      setFamiliasUnread(famCount || 0)

      const chFam = supabase
        .channel('esp-familias-unread')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'chat_familias',
        }, (payload: any) => {
          if (payload.new.sender_role === 'padre' && payload.new.sender_id !== session.user.id) {
            setFamiliasUnread(prev => prev + 1)
          }
        }).subscribe()

      return () => { supabase.removeChannel(channel); supabase.removeChannel(chFam) }
    }
    fetchCitasHoy()
  }, [])

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.warning('Mínimo 6 caracteres'); return }
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Contraseña actualizada')
      setShowChangePassword(false)
      setNewPassword(''); setConfirmPassword('')
    } catch (e: any) { toast.error(e.message) }
    finally { setChangingPassword(false) }
  }

  // Adapta los destinos del admin ('ninos','agenda') al sistema del especialista
  const adminNavigateTo = (view: string) => {
    if (view === 'ninos') setActiveView('pacientes')
    else if (view === 'agenda') setActiveView('agenda')
    else setActiveView(view)
  }

  const renderView = () => {
    if (!profile) return null
    switch (activeView) {
      case 'inicio':       return <EspecialistaHome userId={profile.id} profile={profile} setActiveView={setActiveView} />
      case 'pacientes':    return <PatientsView onPatientSelect={(id, name) => id && name ? setActiveChild({ id, name }) : setActiveChild(null)} />
      case 'prediccion':   return <InteligenciaHubView />
      case 'formularios':  return <MisFormularios userId={profile.id} />
      case 'evaluaciones': return <ChatEspecialistas userId={profile.id} userName={profile.full_name || 'Especialista'} userAvatarUrl={profile.avatar_url} onAvatarUpdate={(url: string) => setProfile((p: any) => ({ ...p, avatar_url: url }))} />
      case 'agenda':       return <MiAgenda isDark={isDark} />
      case 'perfil':       return <MiPerfil profile={profile} onUpdate={loadProfile} onAvatarUpdate={(url: string) => setProfile((p: any) => ({ ...p, avatar_url: url }))} onLogout={handleLogout} />
      default:             return <EspecialistaHome userId={profile.id} profile={profile} setActiveView={setActiveView} />
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-sky-50/20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-2xl shadow-blue-300/50">
            <Stethoscope size={30} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
            <Sparkles size={9} className="text-white" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-black text-slate-800 text-sm">Neuropsicología y Terapias SANTI</p>
          <p className="text-xs text-slate-400 mt-0.5">{t('especialista.cargandoPanel')}</p>
        </div>
        <Loader2 size={18} className="animate-spin text-blue-500" />
      </div>
    </div>
  )

  const userName = profile?.full_name || 'Especialista'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div className="flex h-screen bg-[#f8f8fb] font-sans overflow-hidden">

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed md:static z-40 h-full w-[215px] flex flex-col sidebar-transition
        border-r transition-transform duration-300
        ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-100'} shadow-sm
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 h-[60px] border-b flex-shrink-0
          ${isDark ? 'border-[#21262d]' : 'border-slate-100/80'}`}>
          <div className="relative w-8 h-8 flex-shrink-0 rounded-full bg-white p-0.5 shadow-sm">
            <Image src="/images/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-black text-[13px] leading-tight truncate ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              Neuropsicología y Terapias SANTI
            </p>
            <p className={`text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Panel Clínico
            </p>
          </div>
          <button onClick={() => setSidebarOpen(false)}
            className="ml-auto md:hidden text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <SidebarLink
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeView === item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false) }}
              badge={item.id === 'evaluaciones' ? chatUnread + familiasUnread : 0}
            />
          ))}
        </nav>

        {/* User footer */}
        <div className={`p-3 border-t flex-shrink-0 ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
          <div
            className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors
              ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-50'}`}
            onClick={() => setActiveView('perfil')}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              ) : userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                {userName}
              </p>
              <p className={`text-[10px] truncate ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                {profile?.email || profile?.specialty || ''}
              </p>
            </div>
            <Settings size={14} className="text-slate-400 flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* Mobile overlay - removed, sidebar is desktop only */}

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className={`h-14 md:h-16 flex items-center justify-between px-3 md:px-6 flex-shrink-0 border-b
          ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setSidebarOpen(true)} className={`md:hidden p-2 rounded-lg transition-colors
              ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}>
              <Menu size={18} />
            </button>
            <div>
              <h1 className={`text-sm md:text-base font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {PAGE_TITLES[activeView] || 'Panel'}
              </h1>
              <p className={`text-[10px] hidden sm:block ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                Neuropsicología y Terapias SANTI · {t('especialista.titulo')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSelector compact={true} />
            <ThemeToggleButton />
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 rounded-lg relative transition-colors
                  ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <Bell size={18} />
                {(citasHoy.length > 0 || chatUnread > 0) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>
              {showNotifications && (
                <div className={`absolute right-0 top-11 w-72 rounded-2xl shadow-2xl border p-4 z-50
                  ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      Notificaciones
                    </p>
                    <button onClick={() => setShowNotifications(false)}>
                      <X size={16} className="text-slate-400" />
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {/* Mensajes no leídos */}
                    {chatUnread > 0 && (
                      <div className="space-y-1.5">
                        <p className={`text-[10px] font-black uppercase tracking-widest px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          Chat Equipo
                        </p>
                        <button
                          onClick={() => { setActiveView('evaluaciones'); setShowNotifications(false) }}
                          className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors
                            ${isDark ? 'bg-violet-900/20 hover:bg-violet-900/30' : 'bg-violet-50 hover:bg-violet-100'}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
                          <p className={`text-xs font-medium ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
                            {chatUnread} mensaje{chatUnread !== 1 ? 's' : ''} sin leer
                          </p>
                        </button>
                      </div>
                    )}
                    {citasHoy.length > 0 ? (
                      <>
                        <p className={`text-[10px] font-black uppercase tracking-widest px-1 mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                          Citas de hoy
                        </p>
                        {citasHoy.map(c => (
                          <div key={c.id} className={`flex items-start gap-3 p-3 rounded-xl
                            ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                              {c.children?.name} · {c.appointment_time?.slice(0,5)}
                            </p>
                          </div>
                        ))}
                      </>
                    ) : (
                      chatUnread === 0 && <p className="text-xs text-slate-400 text-center py-4">Sin notificaciones</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        {activeView === 'evaluaciones' ? (
          <div className={`flex-1 overflow-hidden p-0 md:p-4 admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
            <div className="md:hidden h-full px-2 pt-2">
              {renderView()}
            </div>
            <div className="hidden md:block h-full">
              {renderView()}
            </div>
          </div>
        ) : activeView === 'pacientes' ? (
          <div className={`flex-1 overflow-hidden flex flex-col admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
            {renderView()}
          </div>
        ) : (
          <div className={`flex-1 overflow-y-auto admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-[#f8f8fb]'}`}>
            <div className="px-5 pt-5 pb-6">
              {renderView()}
            </div>
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}

      {/* Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className={`rounded-2xl shadow-2xl w-full max-w-sm p-6 border
            ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className={`font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('especialista.cambiarPass')}</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Mínimo 6 caracteres</p>
              </div>
              <button onClick={() => setShowChangePassword(false)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors
                  ${isDark ? 'bg-[#21262d] hover:bg-[#30363d] text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                <X size={15} />
              </button>
            </div>
            <div className="space-y-3">
              <input type="password" placeholder={t('ui.new_password')} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
                  ${isDark
                    ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`} />
              <input type="password" placeholder={t('ui.confirm_password')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all
                  ${isDark
                    ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`} />
              <button onClick={handleChangePassword} disabled={changingPassword}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200/40">
                {changingPassword ? <Loader2 size={15} className="animate-spin" /> : null}
                {changingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── ARIA FLOTANTE ── */}
      {ariaOpen && (
        <div className="fixed bottom-6 right-4 md:right-6 z-[90] w-[calc(100vw-2rem)] rounded-3xl shadow-2xl overflow-hidden border flex flex-col transition-all duration-300 bg-white dark:bg-[#161b22] border-slate-200 dark:border-[#30363d]"
          style={{
            maxWidth: ariaExpanded ? '900px' : '448px',
            height: ariaMinimized ? '54px' : ariaExpanded ? '860px' : '560px',
          }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="6" y="9" width="16" height="13" rx="3" fill="white" fillOpacity="0.9"/>
                  <rect x="9" y="13" width="3" height="3" rx="1" fill="#7c3aed"/>
                  <rect x="16" y="13" width="3" height="3" rx="1" fill="#7c3aed"/>
                  <rect x="11" y="17" width="6" height="1.5" rx="0.75" fill="#7c3aed"/>
                  <rect x="13" y="6" width="2" height="4" rx="1" fill="white" fillOpacity="0.9"/>
                  <circle cx="14" cy="5.5" r="1.5" fill="white"/>
                  <rect x="2" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
                  <rect x="23.5" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
                </svg>
              </div>
              <div>
                <p className="text-white font-black text-sm leading-tight flex items-center gap-2">
                  ARIA <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[9px] font-black">IA</span>
                </p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>
                  <p className="text-violet-200 text-[10px] font-medium">{activeChild ? `Caso: ${activeChild.name}` : 'Asistente Clínico · Activa'}</p>
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
              <ARIAAgentChat userId={profile?.id || ''} compact={true}
                childId={activeChild?.id}
                childName={activeChild?.name}
                contexto={activeChild ? 'paciente' : 'general'} />
            </div>
          )}
        </div>
      )}

      {/* Botón flotante ARIA */}
      {!ariaOpen && (
        <button onClick={() => setAriaOpen(true)}
          className="fixed bottom-6 right-4 md:right-6 z-[91] w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 bg-gradient-to-br from-violet-600 to-indigo-600"
          title="ARIA — Asistente IA">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="9" width="16" height="13" rx="3" fill="white" fillOpacity="0.9"/>
            <rect x="9" y="13" width="3" height="3" rx="1" fill="#7c3aed"/>
            <rect x="16" y="13" width="3" height="3" rx="1" fill="#7c3aed"/>
            <rect x="11" y="17" width="6" height="1.5" rx="0.75" fill="#7c3aed"/>
            <rect x="13" y="6" width="2" height="4" rx="1" fill="white" fillOpacity="0.9"/>
            <circle cx="14" cy="5.5" r="1.5" fill="white"/>
            <rect x="2" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
            <rect x="23.5" y="12" width="2.5" height="5" rx="1.25" fill="white" fillOpacity="0.7"/>
          </svg>
          <span className="pointer-events-none absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-20"/>
        </button>
      )}
    </div>
  )
}
