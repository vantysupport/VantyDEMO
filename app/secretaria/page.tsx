'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard, Calendar, CalendarDays,
  User, Menu, X, Loader2, Settings, Bell,
  DollarSign, ClipboardList, TrendingUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'
import LocaleSelector from '@/app/components/LocaleSelector'
import { ThemeToggleButton } from '@/components/ThemeContext'
import SecretariaHome      from './components/SecretariaHome'
import SecretariaAgenda    from './components/SecretariaAgenda'
import SecretariaPagos     from './components/SecretariaPagos'
import AdminReportesFinancieros from '@/app/admin/components/AdminReportesFinancieros'
import SecretariaPerfil    from './components/SecretariaPerfil'

function SidebarLink({ icon: Icon, label, active, onClick, badge }: any) {
  const { isDark } = useTheme()
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left text-sm
        ${active
          ? 'bg-blue-600 text-white shadow-sm'
          : isDark ? 'text-slate-400 hover:bg-[#21262d] hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
        }`}>
      <Icon size={17} className={`flex-shrink-0 ${active ? 'text-white' : ''}`} />
      <span className="font-semibold truncate flex-1">{label}</span>
      {badge && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center
          ${active ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

export default function SecretariaDashboard() {
  const router = useRouter()
  const toast = useToast()
  const { isDark } = useTheme()

  const NAV_ITEMS = [
    { id: 'inicio',        icon: LayoutDashboard, label: 'Inicio' },
    { id: 'agenda',        icon: Calendar,        label: 'Agenda' },
    { id: 'pagos',                icon: DollarSign,      label: 'Pagos' },
    { id: 'reportes-financieros', icon: TrendingUp,      label: 'Rep. Financieros' },
    { id: 'perfil',        icon: User,            label: 'Mi Perfil' },
  ]

  const PAGE_TITLES: Record<string, string> = {
    inicio:       'Panel Principal',
    agenda:       'Agenda',
    pagos:                'Pagos y Facturación',
    'reportes-financieros': 'Reportes Financieros',
    perfil:       'Mi Perfil',
  }

  const NO_PADDING_VIEWS = ['agenda']

  const [activeView, setActiveView]   = useState('inicio')
  const [profile, setProfile]         = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatUnread, setChatUnread]   = useState(0)

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!prof) { router.push('/login'); return }
      if (prof.role === 'secretaria') { setProfile({ ...prof, email: session.user.email }) }
      else if (['jefe','admin'].includes(prof.role)) { router.push('/admin'); return }
      else if (prof.role === 'padre') { router.push('/padre'); return }
      else if (prof.role === 'especialista') { router.push('/especialista'); return }
      else { router.push('/login'); return }
    } catch { router.push('/login') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadProfile() }, [])

  const renderView = () => {
    if (!profile) return null
    switch (activeView) {
      case 'inicio':        return <SecretariaHome onNavigate={setActiveView} />
      case 'agenda':        return <SecretariaAgenda profile={profile} />
      case 'pagos':                 return <SecretariaPagos profile={profile} />
      case 'reportes-financieros':  return <AdminReportesFinancieros />
      case 'perfil':        return <SecretariaPerfil profile={profile} onUpdate={loadProfile} onAvatarUpdate={(url: string) => setProfile((p: any) => ({ ...p, avatar_url: url }))} />
      default:              return <SecretariaHome onNavigate={setActiveView} />
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
          <ClipboardList size={26} className="text-white" />
        </div>
        <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Neuropsicología y Terapias SANTI</p>
        <Loader2 size={18} className="animate-spin text-blue-500" />
      </div>
    </div>
  )

  const userName    = profile?.full_name || 'Secretaria'
  const userInitial = userName.charAt(0).toUpperCase()
  const noPadding   = NO_PADDING_VIEWS.includes(activeView)

  return (
    <div className="flex h-screen overflow-hidden font-sans" style={{ background: 'var(--bg)' }}>

      {/* ── SIDEBAR ── */}
      <aside className={`
        fixed md:static z-50 h-full w-[215px] flex flex-col flex-shrink-0
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ background: isDark ? '#161b22' : '#ffffff', borderRight: '1px solid var(--card-border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-[60px] flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="relative w-8 h-8 flex-shrink-0">
            <Image src="/images/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[13px] leading-tight" style={{ color: 'var(--text-primary)' }}>Neuropsicología y Terapias SANTI</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Panel Secretaría</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <SidebarLink key={item.id} icon={item.icon} label={item.label}
              active={activeView === item.id}
              onClick={() => { setActiveView(item.id); setSidebarOpen(false) }} />
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all hover:opacity-80"
            onClick={() => { setActiveView('perfil'); setSidebarOpen(false) }}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 overflow-hidden">
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                : userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{userName}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{profile?.email || 'Secretaria(o)'}</p>
            </div>
            <Settings size={14} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="h-[60px] flex items-center justify-between px-4 md:px-6 flex-shrink-0"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{PAGE_TITLES[activeView] || 'Panel'}</h1>
              <p className="text-[10px] hidden sm:block" style={{ color: 'var(--text-muted)' }}>Neuropsicología y Terapias SANTI · Gestión Integral</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <LocaleSelector compact={true} />
            <ThemeToggleButton />
            <button className="relative p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
              <Bell size={18} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className={`flex-1 admin-content ${isDark ? 'bg-[#0d1117]' : 'bg-[#f8f8fb]'}
          overflow-y-auto`}>
          <div className={noPadding ? 'h-full' : 'p-4 md:p-5 pb-6'}>
            {renderView()}
          </div>
        </div>
      </main>
    </div>
  )
}
