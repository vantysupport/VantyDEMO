'use client'

import PWAInstallButton from '@/components/PWAInstallButton'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useSessionTracker } from '@/lib/hooks/useSessionTracker'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Home, Calendar, MessageCircle, User, LogOut, Plus, 
  Clock, Ticket, CheckCircle2, AlertCircle, ChevronRight, Menu, 
  Sparkles, Send, Lock, X, Loader2, TrendingUp, Activity, Heart, Brain, Trash2, RefreshCw,
  Award, Target, Smile, Book, Star, Zap, Bell, Download, Share2, Eye, Mail, Phone,
  Settings, HelpCircle, FileText, Video, Headphones, Image as ImageIcon, ExternalLink,
  Camera, Upload, Gift, PartyPopper, Flame, TrendingDown, Baby, Stethoscope, PlayCircle,
  CalendarDays, ShoppingBag, BookOpen, MoreHorizontal, FolderOpen, Users,
  Shield, KeyRound, ServerCog, UserCog, Database, ScrollText, ClipboardCheck
} from 'lucide-react'

import { NavBtnDesktop, NavBtnMobile, NotificationItem, HelpItem } from './components/shared'
import LocaleSelector from '@/app/components/LocaleSelector'
import VideoCallModal from '@/components/VideoCallModal'
import { ThemeToggleButton } from '@/components/ThemeContext'
import AgendaView from './components/AgendaView'
import HomeViewInnovative from './components/HomeView'
import ResourcesView from './components/ResourcesView'
import ParentFormsView from './components/ParentFormsView'
import MisCitasView from './components/MisCitasView'
import ProfileView from './components/ProfileView'
import NotifWhatsAppPanel from './components/NotifWhatsAppPanel'
import StoreView from './components/StoreView'
import DocumentosView from '@/app/admin/components/DocumentosView'
import ChatInterface from './components/ChatInterface'
import ChatFamilias from './components/ChatFamilias'
import ProgramasABAView from './components/ProgramasABAView'
import EngagementView from './components/EngagementView'
import EvaluacionInicialView from './components/EvaluacionInicialView'
import PushNotificationBanner from '../../components/PushNotificationBanner'
import { TIME_SLOTS, calculateAge } from './utils/helpers'

export default function ParentDashboard() {
  const { t, locale } = useI18n()
  const router = useRouter()
   
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  // ── Session time tracker — automatically logs how long the parent is connected ──
  useSessionTracker(profile?.id)
  
  // --- NUEVOS ESTADOS PARA NOTIFICACIONES ---
  const [notifications, setNotifications] = useState<any[]>([])
  const unreadCount = notifications.filter(n => !n.is_read).length
  // ------------------------------------------

  const [pendingFormsCount, setPendingFormsCount] = useState(0)
  const [myChildren, setMyChildren] = useState<any[]>([])
  const [selectedChild, setSelectedChild] = useState<any>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [padreBloqueado, setPadreBloqueado] = useState(false)

  const NAV_ITEMS = [
    { id: 'home',        icon: Home,      label: t('nav.inicio') },
    { id: 'citas',       icon: Calendar,  label: t('nav.miscitas') },
    { id: 'actividades', icon: Zap,       label: t('nav.actividades') },
    { id: 'recursos',    icon: BookOpen,  label: 'Centro de Recursos' },
    { id: 'perfil',      icon: User,      label: t('nav.miperfil') },
  ]
  const [activeView, setActiveView] = useState('home')
  const [familiasUnread, setFamiliasUnread] = useState(0)
  const [showMoreMenu, setShowMoreMenu] = useState(false) 
  
  // Auto-navegar a perfil si el padre regresa del OAuth de calendario
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal') || params.get('mscal')) {
      setActiveView('profile')
    }
  }, [])

  // Límite de cuentas de padres — el que excede el tope no puede registrarse.
  // El orden y el número los define el programador en /control → Límites.
  useEffect(() => {
    if (!profile?.id) return
    let alive = true
    ;(async () => {
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const r = await fetch('/api/padre/limite', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const j = await r.json()
        if (alive) setPadreBloqueado(j?.allowed === false)
      } catch { /* fail open: si falla, no bloquea */ }
    })()
    return () => { alive = false }
  }, [profile?.id])
   
  const [selectedDate, setSelectedDate] = useState('')
  const [takenSlots, setTakenSlots] = useState<string[]>([])
  const [bookingLoading, setBookingLoading] = useState(false)

  const [showAddChild, setShowAddChild] = useState(false)
  const [showChangePass, setShowChangePass] = useState(false)
  // Estado de la evaluación inicial del paciente seleccionado.
  // Si está completa (revisado/completado/terapia_seleccionada), ocultamos el menú.
  const [evalInicialEstado, setEvalInicialEstado] = useState<string | null>(null)
  const evalInicialCompleta = ['terapia_seleccionada', 'revisado', 'completado'].includes(evalInicialEstado || '')
  const [showNotifications, setShowNotifications] = useState(false)
  const [selectedNoti, setSelectedNoti] = useState<any>(null)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const [videoCallSession, setVideoCallSession] = useState<{roomUrl:string;sessionId:string}|null>(null)

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }, [])

  // Cargar estado de evaluación inicial al cambiar de paciente o de vista.
  // Refrescar al cambiar de vista garantiza que, apenas el padre termina de llenar
  // la evaluación y navega a otra sección, el menú se actualiza y oculta el ítem.
  useEffect(() => {
    if (!selectedChild?.id || !profile?.id) { setEvalInicialEstado(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/evaluacion-inicial?child_id=${selectedChild.id}&parent_id=${profile.id}`)
        const data = await res.json()
        if (!cancelled) setEvalInicialEstado(data?.evaluacion?.estado || 'pendiente_intake')
      } catch { if (!cancelled) setEvalInicialEstado(null) }
    })()
    return () => { cancelled = true }
  }, [selectedChild?.id, profile?.id, refreshTrigger, activeView])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let parentEmail = session?.user?.email

        if (!parentEmail) {
           parentEmail = localStorage.getItem('padre_email') || undefined
        }

        if (!parentEmail) { 
            console.log("No se encontró sesión ni email guardado")
        router.push('/login')
            return 
        }

        const { data: parent, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', parentEmail)
            .single()
        
        if (error || !parent) throw new Error("Perfil no encontrado")

        // Redirect if wrong role
        if (parent?.role === 'secretaria') { router.push('/secretaria'); return }
        if (parent?.role === 'jefe' || parent?.role === 'admin' || parent?.role === 'especialista') { router.push('/admin'); return }

        setProfile(parent)

        // --- CONTAR FORMULARIOS PENDIENTES ---
        if (parent?.id) {
          const today = new Date().toISOString().split('T')[0]
          const { data: pendingForms } = await supabase
            .from('parent_forms')
            .select('id, deadline, status')
            .eq('parent_id', parent.id)
            .not('status', 'in', '("completed","expired")')
          const count = (pendingForms || []).filter((f: any) =>
            !f.deadline || f.deadline >= today
          ).length
          setPendingFormsCount(count)
        }
        // -------------------------------------

        // --- CARGAR NOTIFICACIONES REALES ---
        if (session?.user?.id) {
            const { data: notis } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
            
            if (notis) setNotifications(notis)
        }
        // ------------------------------------

        const { data: children } = await supabase
            .from('children')
            .select('*')
            .eq('parent_id', parent.id)
            .order('created_at', { ascending: true })

        if (children && children.length > 0) {
            setMyChildren(children)
            if(!selectedChild) setSelectedChild(children[0])
        }

      } catch (error) {
        console.error("Error de carga:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [refreshTrigger]) 

  useEffect(() => {
    const fetchSlots = async () => {
        const { data } = await supabase.from('appointments').select('appointment_time').eq('appointment_date', selectedDate)
        if(data) setTakenSlots(data.map(d => d.appointment_time?.slice(0,5) ?? '').filter(Boolean))
    }
    fetchSlots()
  }, [selectedDate, refreshTrigger])

  const triggerCelebration = (message: string) => {
    setCelebrationMessage(message)
    setShowSuccessAnimation(true)
    setTimeout(() => setShowSuccessAnimation(false), 3000)
  }

  // --- FUNCIÓN PARA ABRIR Y MARCAR LEÍDAS ---
  const handleOpenNotifications = async () => {
    setShowNotifications(true)

    // Si hay notificaciones sin leer, marcarlas como leídas visualmente y en BD
    if (unreadCount > 0) {
        // 1. Actualización optimista (Visual)
        const updatedNotis = notifications.map(n => ({ ...n, is_read: true }))
        setNotifications(updatedNotis)

        // 2. Actualización en Supabase
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', session.user.id)
                .eq('is_read', false)
        }
    }
  }
  // ------------------------------------------

  // La clínica agenda las citas directamente desde el panel administrativo

  const handleCancelAppointment = async (appointmentId: string, isReschedule: boolean = false) => {
    if(!confirm("¿Seguro que deseas cancelar esta cita? Si necesitás cambiar el horario, contactá al centro.")) return

    setBookingLoading(true)
    try {
        const { error: delError } = await supabase.from('appointments').delete().eq('id', appointmentId)
        if(delError) throw delError
        setRefreshTrigger(prev => prev + 1) 
        triggerCelebration('Solicitud enviada al centro')
    } catch (error: any) {
        alert("Error al cancelar: " + error.message)
    } finally {
        setBookingLoading(false)
    }
  }

  const handleAddChild = async (e: any) => {
    e.preventDefault()
    if (padreBloqueado) {
      alert('El centro alcanzó el número máximo de cuentas de familias. Comunícate con el centro para habilitar tu acceso.')
      return
    }

    const name = e.target.name.value
    const dob = e.target.dob.value
    const diagnosis = e.target.diagnosis?.value || 'En evaluación'
    
    if(!profile?.id) {
        alert("Error: No se encontró tu perfil")
        return
    }

    if(!name.trim()) {
        alert("El nombre es obligatorio")
        return
    }

    if(!dob) {
        alert("La fecha de nacimiento es obligatoria")
        return
    }

    try {
        const age = calculateAge(dob)

        const { data, error } = await supabase.from('children').insert([{
            parent_id: profile.id, 
            name: name.trim(), 
            birth_date: dob,
            age: age,
            diagnosis: diagnosis || 'En evaluación'
        }]).select()

        if (error) {
            // El trigger de base rechaza al padre que excede el límite → mensaje amable.
            if (/máximo de cuentas|PADRE_LIMIT/i.test(error.message || '')) {
                setPadreBloqueado(true)
                alert('El centro alcanzó el número máximo de cuentas de familias. Comunícate con el centro para habilitar tu acceso.')
            } else {
                alert("Error al guardar: " + error.message)
            }
            return
        }

        if (!data || data.length === 0) {
            alert("No se pudo crear el registro. Verifica los permisos en Supabase.")
            return
        }

        setMyChildren([...myChildren, data[0]])
        if(!selectedChild) setSelectedChild(data[0])
        setShowAddChild(false)
        triggerCelebration(`${name} agregado correctamente`)
        setRefreshTrigger(prev => prev + 1)

    } catch (err: any) {
        alert("Error inesperado: " + err.message)
    }
  }

  const handleUpdateProfile = async (e: any) => {
    e.preventDefault()
    const fullName = e.target.fullName.value
    const phone = e.target.phone.value
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          phone: phone 
        })
        .eq('id', profile.id)
      
      if (error) throw error
      
      setProfile({...profile, full_name: fullName, phone: phone})
      triggerCelebration('Perfil actualizado')
      setShowEditProfile(false)
      setRefreshTrigger(prev => prev + 1)
    } catch (error: any) {
      alert("Error al actualizar: " + error.message)
    }
  }

  const handleChangePassword = async (e: any) => {
    e.preventDefault()
    const newPass = e.target.newPassword.value
    const confirmPass = e.target.confirmPassword.value
    
    if (newPass !== confirmPass) {
      alert("Las contraseñas no coinciden")
      return
    }
    
    if (newPass.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres")
      return
    }
    
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      
      triggerCelebration('Contraseña actualizada')
      setShowChangePass(false)
    } catch (error: any) {
      alert("Error: " + error.message)
    }
  }

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100 gap-4">
      <div className="relative">
        <Loader2 className="animate-spin text-sky-600" size={56}/>
        <div className="absolute inset-0 animate-ping">
          <Loader2 className="text-sky-300 opacity-40" size={56}/>
        </div>
      </div>
      <p className="text-slate-500 font-bold text-sm animate-pulse">{t('familias.cargandoInfo')}</p>
    </div>
  )

  // ── BLOQUEO por límite de cuentas de padres (el N+1 no se registra) ───────
  if (!loading && myChildren.length === 0 && profile && padreBloqueado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-sky-100 border border-sky-100">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <Lock size={28} className="text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Registro no disponible por ahora</h1>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              El centro alcanzó el número máximo de cuentas de familias disponibles.
              Para habilitar tu acceso, comunícate con <strong className="text-sky-600">Vanty ABA</strong>.
            </p>
            <a href="https://wa.me/51994196916" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-sky-200 hover:opacity-90 transition-opacity">
              <Phone size={16} /> Contactar al centro
            </a>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
              className="mt-3 text-xs font-bold text-slate-400 hover:text-slate-600">Cerrar sesión</button>
          </div>
        </div>
      </div>
    )
  }

  // ── ONBOARDING para primer acceso (sin hijos registrados) ─────────────────
  if (!loading && myChildren.length === 0 && profile && !showAddChild) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          {/* Progress steps */}
          <div className="flex items-center justify-center gap-3 mb-10">
            {[t('familias.bienvenida'), t('familias.tuHijoA'), t('familias.primeraCita')].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-bold ${i === 0 ? 'text-sky-600' : 'text-slate-400'}`}>{step}</span>
                {i < 2 && <div className="w-8 h-px bg-slate-200" />}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-sky-100 border border-sky-100 text-center">
            {/* Avatar */}
            <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-sky-600 rounded-[22px] flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-sky-200 mx-auto mb-6">
              {profile?.full_name?.charAt(0) || 'F'}
            </div>

            <h1 className="text-2xl font-bold text-slate-800 mb-3">
              ¡Bienvenido/a, {profile?.full_name?.split(' ')[0]}! 🎉
            </h1>
            <p className="text-slate-500 text-base leading-relaxed mb-8">
              Estamos felices de tenerte en <strong className="text-sky-600">Vanty ABA</strong>.
              Para comenzar, necesitamos registrar a tu hijo/a y podrás acceder a todo el sistema de seguimiento con IA.
            </p>

            {/* Features preview */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { Icon: TrendingUp, label: 'Progreso en tiempo real' },
                { Icon: Sparkles,   label: 'Asistente IA 24/7' },
                { Icon: Calendar,   label: 'Citas con 1 click' },
              ].map(({ Icon, label }) => (
                <div key={label} className="bg-sky-50 rounded-2xl p-4 border border-sky-100">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
                    <Icon size={18} />
                  </div>
                  <p className="text-xs font-bold text-sky-700 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowAddChild(true)}
              className="w-full bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-sky-200 hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[.98] flex items-center justify-center gap-3"
            >
              <Baby size={20} /> Registrar a mi hijo/a ahora
            </button>

            <p className="text-xs text-slate-400 mt-4">
              Solo toma 1 minuto · Tus datos están protegidos
            </p>
          </div>

          {/* Help contact */}
          <p className="text-center text-sm text-slate-400 mt-6">
            ¿Tienes dudas? Escríbenos:{' '}
            <a href="https://wa.me/51994196916" className="text-sky-600 font-bold hover:underline">
              +51 994 196 916
            </a>
          </p>
        </div>

        {/* El modal de agregar hijo ya existe en el código principal */}
        {showAddChild && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-sky-100 to-sky-100 rounded-full blur-3xl opacity-50"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <Baby size={24} className="text-white"/>
                    </div>
                    <div>
                      <h3 className="font-bold text-2xl text-slate-800">Paso 2: Tu hijo/a</h3>
                      <p className="text-sm text-slate-400 font-medium">{t('ui.enter_basic_data')}</p>
                    </div>
                  </div>
                  <button onClick={()=>setShowAddChild(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <X size={22}/>
                  </button>
                </div>
                <form onSubmit={handleAddChild} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 block">{t('familias.nombreCompletoStar')}</label>
                    <input name="name" required className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-sky-400 transition-all" placeholder={t('familias.ejNombre')}/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 block">{t('familias.fechaNacStar')}</label>
                    <input name="dob" type="date" required className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-sky-400 transition-all"/>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-2 block">{t('familias.diagOpcional')}</label>
                    <input name="diagnosis" className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-sky-400 transition-all" placeholder="Ej: TEA Nivel 2"/>
                  </div>
                  <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl p-4">
                    <p className="text-xs text-sky-700 font-bold flex items-center gap-2">
                      <Sparkles size={14}/> La edad se calculará automáticamente
                    </p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={()=>setShowAddChild(false)} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-all">{t('common.cancelar')}</button>
                    <button type="submit" className="flex-1 bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2">
                      <CheckCircle2 size={18}/> {t('familias.guardarContinuar')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const PAGE_TITLES_MOBILE: Record<string, string> = {
    home: 'Inicio', miscitas: 'Agenda', engagement: 'Practicar en Casa',
    chat: 'Asistente IA', misformularios: 'Recursos adicionales',
    tienda: 'Tienda', documentos: 'Documentos', profile: 'Mi Perfil',
    'chat-familias': 'Chat', 'programas': 'Programas ABA',
    'evaluacion-inicial': 'Evaluación Inicial',
  }

  return (
    <div className="flex h-screen font-sans overflow-hidden" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        
        {/* 🔔 PUSH NOTIFICATIONS BANNER */}
        <PushNotificationBanner userId={profile?.id || null} />
        <PWAInstallButton />

        {/* 📹 VIDEOLLAMADA MODAL */}
        {videoCallSession && (
          <VideoCallModal
            roomUrl={videoCallSession.roomUrl}
            sessionId={videoCallSession.sessionId}
            participantName={profile?.full_name || 'Padre/Madre'}
            onClose={() => setVideoCallSession(null)}
          />
        )}

        {/* 🎉 ANIMACIÓN DE ÉXITO */}
        {showSuccessAnimation && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
                <div className="bg-white/95 backdrop-blur-xl p-12 rounded-[3rem] shadow-2xl border-4 border-green-500 animate-bounce">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                            <PartyPopper size={80} className="text-green-500 animate-pulse"/>
                            <div className="absolute inset-0 bg-green-400 blur-3xl opacity-50 animate-ping"></div>
                        </div>
                        <h2 className="text-4xl font-bold text-slate-800 text-center">{celebrationMessage}</h2>
                        <div className="flex gap-3">
                            <Star size={32} className="text-yellow-400 animate-spin"/>
                            <Star size={32} className="text-yellow-400 animate-spin" style={{animationDelay: '0.2s'}}/>
                            <Star size={32} className="text-yellow-400 animate-spin" style={{animationDelay: '0.4s'}}/>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* === SIDEBAR (PC) === */}
        <aside className="hidden lg:flex w-[230px] border-r flex-col z-20" style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>

            {/* Logo header */}
            <div className="flex items-center gap-3 px-5 h-[60px] flex-shrink-0" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
                <div className="w-8 h-8 bg-gradient-to-br from-sky-600 to-cyan-600 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md shadow-sky-200/50">
                    {profile?.full_name?.charAt(0) || 'F'}
                </div>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold leading-none mb-0.5" style={{ color: "var(--text-muted)" }}>Bienvenido/a</p>
                    <p className="font-bold text-[13px] truncate" style={{ color: "var(--text-primary)", fontSize: "12px", fontWeight: 700 }}>Portal Familias</p>
                </div>
            </div>

            {/* Role badge */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(2,132,199,0.1)", border: "1px solid rgba(2,132,199,0.2)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse flex-shrink-0" />
                    <span className="text-[10px] font-bold" style={{ color: "#0284c7" }}>Portal Familias</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
                <NavBtnDesktop icon={<Home size={17}/>} label="Inicio" active={activeView==='home'} onClick={()=>setActiveView('home')} />
                {!evalInicialCompleta && (
                  <NavBtnDesktop icon={<ClipboardCheck size={17}/>} label="Evaluación Inicial" active={activeView==='evaluacion-inicial'} onClick={()=>setActiveView('evaluacion-inicial')} badge="NUEVO" />
                )}
                <NavBtnDesktop icon={<Calendar size={17}/>} label="Agenda" active={activeView==='miscitas'} onClick={()=>setActiveView('miscitas')} />
                <NavBtnDesktop icon={<Heart size={17}/>} label="Practicar en Casa" active={activeView==='engagement'} onClick={()=>setActiveView('engagement')} badge="IA" />
                <NavBtnDesktop icon={<Sparkles size={17}/>} label={t('familias.asistente')} active={activeView==='chat'} onClick={()=>setActiveView('chat')} badge="NUEVO" />
                <NavBtnDesktop icon={<BookOpen size={17}/>} label="Programas ABA" active={activeView==='programas'} onClick={()=>setActiveView('programas')} />
                <NavBtnDesktop icon={<Users size={17}/>} label="Chat" active={activeView==='chat-familias'} onClick={()=>setActiveView('chat-familias')} badge={familiasUnread > 0 ? familiasUnread : null} />
                <NavBtnDesktop icon={<FileText size={17}/>} label="Recursos adicionales" active={activeView==='misformularios'||activeView==='tienda'||activeView==='documentos'} onClick={()=>setActiveView('misformularios')} badge={pendingFormsCount > 0 ? pendingFormsCount : null} />
                <NavBtnDesktop icon={<User size={17}/>} label="Mi Perfil" active={activeView==='profile'} onClick={()=>setActiveView('profile')} />
            </nav>

            {/* Bottom section */}
            <div className="p-3 space-y-2 flex-shrink-0" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
                <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(2,132,199,0.08)", border: "1px solid rgba(2,132,199,0.15)" }}>
                    <p className="text-[10px] font-bold flex items-center gap-1.5 mb-1" style={{ color: "#0284c7" }}>
                        <Calendar size={10}/> Tus citas
                    </p>
                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>Programadas por el equipo del centro. Para cambios contactá a recepción.</p>
                </div>
                <button
                    onClick={handleOpenNotifications}
                    className="w-full px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 active:scale-95 relative"
                    style={{ background: "var(--muted-bg)", border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}
                >
                    <Bell size={14}/>
                    Ver Notificaciones
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>
        </aside>

        {/* === CONTENIDO PRINCIPAL === */}
        <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-x-hidden">
            
            {/* 🖥️ HEADER DESKTOP */}
            <header className="hidden lg:flex h-14 items-center justify-between px-6 flex-shrink-0 border-b" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div>
                    <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {PAGE_TITLES_MOBILE[activeView as keyof typeof PAGE_TITLES_MOBILE] || 'Inicio'}
                    </h1>
                    <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>Vanty ABA · Portal Familias</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <LocaleSelector compact={true} />
                    <ThemeToggleButton className="!w-8 !h-8 !rounded-lg" />
                    <div className="relative">
                        <button onClick={handleOpenNotifications}
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center relative transition-colors">
                            <Bell size={16}/>
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"/>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* 📱 HEADER MÓVIL — mismo estilo admin */}
            <header className="lg:hidden h-14 flex items-center justify-between px-3 flex-shrink-0 border-b" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-2">
                    <div>
                        <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                            {PAGE_TITLES_MOBILE[activeView as keyof typeof PAGE_TITLES_MOBILE] || 'Inicio'}
                        </h1>
                        <p style={{ fontSize: "10px", color: "var(--text-muted)" }}>Portal Familias</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <LocaleSelector compact={true} />
                    <ThemeToggleButton className="!w-8 !h-8 !rounded-lg" />
                    <div className="relative">
                        <button onClick={handleOpenNotifications}
                            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center relative transition-colors">
                            <Bell size={16}/>
                            {unreadCount > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"/>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* 👶 SELECTOR DE HIJOS MEJORADO */}
            <div className="backdrop-blur-sm border-b py-4 px-4 md:px-8 flex gap-3 overflow-x-auto items-center scrollbar-hide" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <span className="text-[10px] font-bold text-slate-400 shrink-0 mr-2 flex items-center gap-2">
                    <User size={12}/> {t('ui.viendo')}
                </span>
                {myChildren.length > 0 ? myChildren.map(child => (
                    <button 
                        key={child.id} onClick={()=>setSelectedChild(child)}
                        className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl transition-all whitespace-nowrap border-2 shadow-sm hover:shadow-md group ${
                            selectedChild?.id === child.id 
                            ? 'bg-gradient-to-r from-sky-600 to-cyan-600 border-sky-500 text-white shadow-sky-200 scale-105' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'
                        }`}
                    >
                        <div className={`w-2.5 h-2.5 rounded-full ${selectedChild?.id === child.id ? 'bg-white animate-pulse' : 'bg-slate-300 group-hover:bg-sky-400'}`}></div>
                        <div className="text-left">
                            <span className="font-bold text-sm block">{child.name.split(' ')[0]}</span>
                            <span className={`text-[10px] font-semibold flex items-center gap-1 ${selectedChild?.id === child.id ? 'text-sky-100' : 'text-slate-400'}`}>
                                <Baby size={10}/> {calculateAge(child.birth_date)} años
                            </span>
                        </div>
                    </button>
                )) : <span className="text-xs text-slate-400 italic">{t('ui.no_patients')}</span>}
                <button 
                    onClick={()=>setShowAddChild(true)} 
                    className="w-10 h-10 rounded-2xl bg-sky-50 border-2 border-dashed border-sky-200 flex items-center justify-center text-sky-600 hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all shrink-0 hover:scale-110 active:scale-95 hover:rotate-90"
                >
                    <Plus size={18}/>
                </button>
            </div>

            <main className={`flex-1 ${activeView === 'chat' || activeView === 'chat-familias' ? 'overflow-hidden p-0 lg:p-4 lg:p-6 flex flex-col chat-main-mobile' : 'overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 lg:pb-6'}`} style={{ minHeight: 0, background: "var(--background)" }}>
                <div className={`w-full ${activeView === 'chat' || activeView === 'chat-familias' ? 'flex-1 flex flex-col min-h-0' : 'min-h-full'}`}>
                    {activeView === 'home' && (
                        <HomeViewInnovative
                            child={selectedChild}
                            onChangeView={setActiveView}
                            refreshTrigger={refreshTrigger}
                            onCancelAppointment={handleCancelAppointment}
                        />
                    )}

                    {(activeView === 'agenda' || activeView === 'miscitas') && (
                        <div className="animate-fade-in">
                          <MisCitasView
                            profile={profile}
                            selectedChild={selectedChild}
                            onCancelAppointment={handleCancelAppointment}
                            onChangeView={setActiveView}
                          />
                        </div>
                    )}

                    {activeView === 'chat' && (
                          <div className="lg:rounded-3xl lg:shadow-xl lg:border lg:border-slate-200/60 overflow-hidden flex flex-col flex-1 min-h-0 animate-fade-in chat-mobile-fix">
                            <ChatInterface childId={selectedChild?.id} childName={selectedChild?.name} onNavigateToStore={() => setActiveView('tienda')} parentId={profile?.id} />
                        </div>
                    )}

                    {(activeView === 'misformularios' || activeView === 'tienda' || activeView === 'documentos') && <ParentFormsView profile={profile} selectedChild={selectedChild} onFormsLoaded={(count: number) => setPendingFormsCount(count)} initialTab={activeView === 'tienda' ? 'store' : activeView === 'documentos' ? 'documentos' : 'forms'} />}
                    {activeView === 'programas' && selectedChild && <ProgramasABAView childId={selectedChild.id} childName={selectedChild.name} />}
                    {activeView === 'chat-familias' && selectedChild && (
                      <div className="overflow-hidden flex flex-col flex-1 min-h-0 rounded-none lg:rounded-3xl chat-mobile-fix" style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}>
                        <ChatFamilias childId={selectedChild.id} childName={selectedChild.name} profile={profile} />
                      </div>
                    )}
                    {activeView === 'chat-familias' && !selectedChild && (
                      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                        <MessageCircle size={32} className="text-slate-300"/>
                        <p className="font-bold text-slate-500">Selecciona un hijo/a para abrir el chat</p>
                      </div>
                    )}
                    {activeView === 'engagement' && <EngagementView childId={selectedChild?.id || ''} />}
                    {activeView === 'evaluacion-inicial' && (
                      <div className="animate-fade-in">
                        <EvaluacionInicialView child={selectedChild} profile={profile} />
                      </div>
                    )}
                    {activeView === 'profile' && (
                        <div className="animate-fade-in">
                          <ProfileView
                              profile={profile}
                              onLogout={async ()=>{await releaseSessionNow(); localStorage.removeItem('padre_email'); await supabase.auth.signOut(); router.push('/login')}}
                              onChangePass={()=>setShowChangePass(true)}
                              onEditProfile={()=>setShowEditProfile(true)}
                              onPrivacy={()=>setShowPrivacy(true)}
                              onHelp={()=>setShowHelp(true)}
                              onPhoneUpdated={(phone: string) => setProfile((p: any) => ({ ...p, phone }))}
                          />
                        </div>
                    )}
                </div>
            </main>

            {/* 📱 NAVEGACIÓN INFERIOR MÓVIL MEJORADA */}
            <nav className="lg:hidden backdrop-blur-xl border-t fixed bottom-0 w-full z-30" style={{ background: "var(--card)", borderColor: "var(--card-border)", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
              <div className="grid grid-cols-5 items-end px-1 pt-1">
                {/* Inicio */}
                <div className="flex justify-center">
                  <NavBtnMobile icon={<Home size={22}/>} label="Inicio" active={activeView==='home'} onClick={()=>setActiveView('home')} />
                </div>
                {/* Agenda */}
                <div className="flex justify-center">
                  <NavBtnMobile icon={<Calendar size={22}/>} label="Agenda" active={activeView==='miscitas'} onClick={()=>setActiveView('miscitas')} badge={null} />
                </div>
                {/* Botón IA central flotante */}
                <div className="flex justify-center">
                  <div className="relative" style={{ marginBottom: "0.75rem" }}>
                    <button 
                      onClick={()=>setActiveView('chat')} 
                      className={`w-14 h-14 rounded-[1.75rem] flex items-center justify-center shadow-xl border-4 transition-all active:scale-95 relative group ${
                          activeView==='chat'
                          ? 'bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-sky-300' 
                          : 'bg-gradient-to-br from-sky-600 to-cyan-600 text-white shadow-sky-300'
                      }`}
                      style={{ borderColor: "var(--card)", marginTop: "-1.75rem" }}
                    >
                      <Sparkles size={24} className="group-hover:animate-spin"/>
                      {activeView !== 'chat' && (
                          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full animate-bounce">
                              IA
                          </span>
                      )}
                    </button>
                    <span className="block text-center text-[10px] font-medium mt-0.5" style={{ color: activeView==='chat' ? '#0284c7' : 'var(--text-muted)' }}>Asistente</span>
                  </div>
                </div>
                {/* Perfil */}
                <div className="flex justify-center">
                  <NavBtnMobile icon={<User size={22}/>} label="Perfil" active={activeView==='profile'} onClick={()=>setActiveView('profile')} />
                </div>
                {/* Más */}
                <div className="flex justify-center relative">
                  <button
                    onClick={()=>setShowMoreMenu(v=>!v)}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${showMoreMenu ? 'text-sky-600' : 'text-slate-500'}`}
                  >
                    <MoreHorizontal size={22}/>
                    <span className="text-[10px] font-medium">Más</span>
                  </button>
                  {showMoreMenu && (
                    <div className="absolute bottom-14 right-0 rounded-2xl shadow-2xl border p-2 w-56 z-50 flex flex-col gap-1" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                      {[
                        // Solo mostramos Evaluación Inicial si aún NO está completa
                        ...(!evalInicialCompleta ? [{ id: 'evaluacion-inicial', icon: <ClipboardCheck size={18}/>, label: 'Evaluación Inicial', badge: 'NUEVO' as any }] : []),
                        { id: 'engagement',    icon: <Zap size={18}/>,            label: 'Practicar en Casa' },
                        { id: 'chat-familias', icon: <MessageCircle size={18}/>,  label: 'Chat', badge: familiasUnread > 0 ? familiasUnread : null },
                        { id: 'programas',     icon: <BookOpen size={18}/>,       label: 'Programas ABA' },
                        { id: 'misformularios',icon: <FileText size={18}/>,       label: 'Recursos adicionales', badge: pendingFormsCount > 0 ? pendingFormsCount : null },
                      ].map(item => (
                        <button key={item.id} onClick={()=>{setActiveView(item.id);setShowMoreMenu(false)}}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${activeView===item.id ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                          {item.icon}
                          <span className="flex-1 text-left">{item.label}</span>
                          {(item as any).badge && (
                            <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                              {(item as any).badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </nav>
        </div>

        {/* 🎨 MODAL - AGREGAR HIJO MEJORADO */}
        {showAddChild && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-scale-in relative overflow-hidden">
                    {/* Decoración de fondo */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-sky-100 to-sky-100 rounded-full blur-3xl opacity-50"></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-rose-100 to-yellow-100 rounded-full blur-3xl opacity-50"></div>
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                                    <Baby size={24} className="text-white"/>
                                </div>
                                <div>
                                    <h3 className="font-bold text-2xl text-slate-800">{t('pacientes.nuevo')}</h3>
                                    <p className="text-sm text-slate-400 font-medium">{t('familias.agendaInfoNino')}</p>
                                </div>
                            </div>
                            <button onClick={()=>setShowAddChild(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all hover:rotate-90">
                                <X size={22}/>
                            </button>
                        </div>

                        <form onSubmit={handleAddChild} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                    <User size={14}/> Nombre Completo <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    name="name" 
                                    required 
                                    className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-sky-400 transition-all hover:bg-white" 
                                    placeholder="Ej: María Fernanda López"
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                    <Calendar size={14}/> Fecha de Nacimiento <span className="text-red-500">*</span>
                                </label>
                                <input 
                                    name="dob" 
                                    type="date" 
                                    required 
                                    className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-sky-400 transition-all hover:bg-white"
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                    <Stethoscope size={14}/> Diagnóstico (Opcional)
                                </label>
                                <input 
                                    name="diagnosis" 
                                    className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-sky-400 transition-all hover:bg-white" 
                                    placeholder="Ej: TEA Nivel 2"
                                />
                            </div>

                            <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl p-4">
                                <p className="text-xs text-sky-700 font-bold flex items-center gap-2">
                                    <Sparkles size={14}/> La edad se calculará automáticamente
                                </p>
                            </div>
                            
                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={()=>setShowAddChild(false)} 
                                    className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-all hover:scale-105 active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={18}/> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {/* 🔐 MODAL - CAMBIAR CONTRASEÑA */}
        {showChangePass && (
             <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <Lock size={24} className="text-white"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-2xl text-slate-800">{t('familias.cambiarPass2')}</h3>
                                <p className="text-sm text-slate-400">{t('ui.new_access_key')}</p>
                            </div>
                        </div>
                        <button onClick={()=>setShowChangePass(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all hover:rotate-90">
                            <X size={22}/>
                        </button>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block">
                                Nueva Contraseña
                            </label>
                            <input 
                                name="newPassword" 
                                type="password" 
                                required 
                                minLength={6}
                                className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:border-sky-400 focus:bg-white transition-all" 
                                placeholder={t('familias.minimo6')}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block">
                                Confirmar Contraseña
                            </label>
                            <input 
                                name="confirmPassword" 
                                type="password" 
                                required 
                                minLength={6}
                                className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:border-sky-400 focus:bg-white transition-all" 
                                placeholder={t('familias.repitePass')}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={()=>setShowChangePass(false)} 
                                className="flex-1 py-4 font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition-all hover:scale-105 active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 bg-gradient-to-r from-sky-600 to-cyan-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-sky-700 transition-all hover:scale-105 active:scale-95"
                            >
                                Actualizar
                            </button>
                        </div>
                    </form>
                </div>
             </div>
        )}

        {/* ✏️ MODAL - EDITAR PERFIL */}
        {showEditProfile && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <User size={24} className="text-white"/>
                            </div>
                            <div>
                                <h3 className="font-bold text-2xl text-slate-800">{t('familias.editarPerfil2')}</h3>
                                <p className="text-sm text-slate-400">{t('familias.actualizaInfo')}</p>
                            </div>
                        </div>
                        <button onClick={()=>setShowEditProfile(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all hover:rotate-90">
                            <X size={22}/>
                        </button>
                    </div>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                <User size={14}/> Nombre Completo
                            </label>
                            <input 
                                name="fullName" 
                                defaultValue={profile?.full_name}
                                required 
                                className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-green-400 transition-all hover:bg-white" 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block">
                                <span className="flex items-center gap-2">
                                  <span>📱</span> Número WhatsApp
                                </span>
                                <span className="text-[10px] font-normal text-green-600 mt-0.5 block">
                                  Recibirás alertas de citas, informes y mensajes del terapeuta
                                </span>
                            </label>
                            <input 
                                name="phone" 
                                type="tel"
                                defaultValue={profile?.phone}
                                className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-green-400 transition-all hover:bg-white" 
                                placeholder="+51 999 888 777"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-2">
                                <Mail size={14}/> Email (no editable)
                            </label>
                            <input 
                                value={profile?.email}
                                disabled
                                className="w-full p-4 bg-slate-100 rounded-2xl font-semibold text-slate-400 cursor-not-allowed" 
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                type="button" 
                                onClick={()=>setShowEditProfile(false)} 
                                className="flex-1 py-4 font-bold text-slate-400 hover:bg-slate-50 rounded-2xl transition-all hover:scale-105 active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* 🔔 MODAL - NOTIFICACIONES (FIXED: iconos + modal detalle) */}
        {showNotifications && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={()=>{ setShowNotifications(false); setSelectedNoti(null) }}>
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in overflow-hidden max-h-[85vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                    <div className="bg-gradient-to-r from-sky-600 to-cyan-600 p-6 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                                <Bell size={24}/>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{t('familias.centrNotif')}</h3>
                                <p className="text-xs text-sky-100">{notifications.length} notificacion{notifications.length!==1?'es':''} · {unreadCount > 0 ? `${unreadCount} sin leer` : 'todas leídas'}</p>
                            </div>
                        </div>
                        <button onClick={()=>{ setShowNotifications(false); setSelectedNoti(null) }} className="p-2 hover:bg-white/10 rounded-xl transition-all hover:rotate-90">
                            <X size={20}/>
                        </button>
                    </div>

                    {/* Detalle de notificación seleccionada */}
                    {selectedNoti ? (
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <button onClick={()=>setSelectedNoti(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                <ChevronRight size={14} className="rotate-180"/> Volver
                            </button>
                            {(()=>{
                                const ft = selectedNoti.metadata?.form_type || selectedNoti.metadata?.source || selectedNoti.type || ''
                                const cfg =
                                    ft==='aba'            ? {icon:<Activity size={20}/>,      bg:'bg-sky-100', text:'text-sky-700', border:'border-sky-200', label:'Sesión ABA'} :
                                    ft==='anamnesis'      ? {icon:<FileText size={20}/>,      bg:'bg-sky-100',   text:'text-sky-700',   border:'border-sky-200',   label:'Historia Clínica'} :
                                    ft==='entorno_hogar'  ? {icon:<Home size={20}/>,          bg:'bg-green-100',  text:'text-green-700',  border:'border-green-200',  label:'Entorno del Hogar'} :
                                    ['brief2','ados2','vineland3','wiscv','basc3'].includes(ft) ? {icon:<Brain size={20}/>, bg:'bg-sky-100', text:'text-sky-700', border:'border-sky-200', label:'Evaluación Clínica'} :
                                    selectedNoti.type==='video_call'      ? {icon:<Video size={20}/>,         bg:'bg-sky-100', text:'text-sky-700', border:'border-sky-200', label:'Videollamada'} :
                                    selectedNoti.type==='form_request'    ? {icon:<FileText size={20}/>,      bg:'bg-orange-100', text:'text-orange-700', border:'border-orange-200', label:'Nuevo formulario'} :
                                    selectedNoti.type==='parent_message'  ? {icon:<MessageCircle size={20}/>, bg:'bg-sky-100',   text:'text-sky-700',   border:'border-sky-200',   label:'Mensaje del terapeuta'} :
                                    selectedNoti.type==='success'         ? {icon:<Star size={20}/>,          bg:'bg-yellow-100', text:'text-yellow-700', border:'border-yellow-200', label:'¡Buenas noticias!'} :
                                    selectedNoti.type==='warning'         ? {icon:<AlertCircle size={20}/>,   bg:'bg-red-100',    text:'text-red-700',    border:'border-red-200',    label:'Aviso'} :
                                                                             {icon:<Bell size={20}/>,           bg:'bg-sky-100',   text:'text-sky-700',   border:'border-sky-200',   label:'Notificación'}
                                return (
                                    <div className="space-y-4">
                                        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${cfg.border}`}>
                                            <div className={`${cfg.bg} ${cfg.text} p-3 rounded-xl`}>{cfg.icon}</div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-400">{cfg.label}</p>
                                                <p className="font-bold text-slate-800 text-sm">{selectedNoti.title}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 rounded-2xl p-5">
                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedNoti.message}</p>
                                        </div>
                                        {/* ── Botón unirse a videollamada ── */}
                                        {selectedNoti.type === 'video_call' && selectedNoti.metadata?.room_url && (
                                          <button
                                            onClick={() => {
                                              setVideoCallSession({ roomUrl: selectedNoti.metadata.room_url, sessionId: selectedNoti.metadata.session_id || '' })
                                              setShowNotifications(false)
                                              setSelectedNoti(null)
                                            }}
                                            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-white text-base shadow-xl transition-all hover:scale-[1.02] active:scale-[.98]"
                                            style={{background:'linear-gradient(135deg,#0284c7,#0ea5e9)',boxShadow:'0 8px 30px rgba(99,102,241,0.4)'}}
                                          >
                                            <Video size={20}/> Unirse a la videollamada
                                          </button>
                                        )}

                                        {selectedNoti.metadata?.source_title && (
                                            <div className="bg-sky-50 rounded-xl p-3 flex items-center gap-2">
                                                <FileText size={14} className="text-sky-500 flex-shrink-0"/>
                                                <div>
                                                    <p className="text-xs text-sky-400">{t('familias.generadoPor')}</p>
                                                    <p className="text-sm font-semibold text-sky-700">{selectedNoti.metadata.source_title}</p>
                                                </div>
                                            </div>
                                        )}
                                        <p className="text-xs text-slate-400 flex items-center gap-1">
                                            <Clock size={11}/> {new Date(selectedNoti.created_at).toLocaleDateString(toBCP47(locale),{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                                        </p>
                                    </div>
                                )
                            })()}
                        </div>
                    ) : (
                    <div className="p-5 space-y-3 overflow-y-auto flex-1">
                        {/* ── Banner videollamadas activas ── */}
                        {notifications.filter(n => n.type==='video_call' && n.metadata?.room_url).map(n => (
                          <button key={`vcall-${n.id}`}
                            onClick={() => { setVideoCallSession({roomUrl:n.metadata.room_url, sessionId:n.metadata.session_id||''}); setShowNotifications(false) }}
                            className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-sky-300 text-left transition-all hover:scale-[1.01] active:scale-[.99]"
                            style={{background:'linear-gradient(135deg,rgba(99,102,241,0.1),rgba(139,92,246,0.1))'}}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 animate-pulse" style={{background:'linear-gradient(135deg,#0284c7,#0ea5e9)'}}>
                              <Video size={20} className="text-white"/>
                            </div>
                            <div className="flex-1 text-left">
                              <p className="font-bold text-sky-700 text-sm">📹 Videollamada activa</p>
                              <p className="text-xs text-sky-500 font-semibold">{t('familias.terapeutaEspera')}</p>
                            </div>
                            <ChevronRight size={18} className="text-sky-400 shrink-0"/>
                          </button>
                        ))}
                        {notifications.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                                    <Bell size={40} className="text-slate-300"/>
                                </div>
                                <p className="font-bold text-slate-400 text-base">{t('familias.sinNotificaciones')}</p>
                                <p className="text-slate-300 text-sm mt-1">{t('familias.verasMensajes')}</p>
                            </div>
                        ) : (
                            notifications.map((noti) => {
                                const ft = noti.metadata?.form_type || noti.metadata?.source || noti.type || ''
                                const iconConfig =
                                    ft==='aba'            ? {icon:<Activity size={20}/>,      bg:'bg-sky-100', text:'text-sky-600', border:'border-sky-200', label:'Sesión ABA'} :
                                    ft==='anamnesis'      ? {icon:<FileText size={20}/>,      bg:'bg-sky-100',   text:'text-sky-600',   border:'border-sky-200',   label:'Historia Clínica'} :
                                    ft==='entorno_hogar'  ? {icon:<Home size={20}/>,          bg:'bg-green-100',  text:'text-green-600',  border:'border-green-200',  label:'Entorno del Hogar'} :
                                    ['brief2','ados2','vineland3','wiscv','basc3'].includes(ft) ? {icon:<Brain size={20}/>, bg:'bg-sky-100', text:'text-sky-600', border:'border-sky-200', label:'Evaluación Clínica'} :
                                    noti.type==='video_call'     ? {icon:<Video size={20}/>,         bg:'bg-sky-100', text:'text-sky-600', border:'border-sky-200', label:'Videollamada'} :
                                    noti.type==='form_request'   ? {icon:<FileText size={20}/>,      bg:'bg-orange-100', text:'text-orange-600', border:'border-orange-200', label:'Nuevo formulario'} :
                                    noti.type==='parent_message' ? {icon:<MessageCircle size={20}/>, bg:'bg-sky-100',   text:'text-sky-600',   border:'border-sky-200',   label:'Mensaje del terapeuta'} :
                                    noti.type==='success'        ? {icon:<Star size={20}/>,          bg:'bg-yellow-100', text:'text-yellow-600', border:'border-yellow-200', label:'¡Buenas noticias!'} :
                                    noti.type==='warning'        ? {icon:<AlertCircle size={20}/>,   bg:'bg-red-100',    text:'text-red-600',    border:'border-red-200',    label:'Aviso'} :
                                                                   {icon:<Bell size={20}/>,           bg:'bg-sky-100',   text:'text-sky-600',   border:'border-sky-200',   label:'Notificación'}
                                return (
                                    <button key={noti.id} onClick={()=>setSelectedNoti(noti)}
                                        className={`w-full text-left bg-slate-50 rounded-2xl border ${iconConfig.border} overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all`}>
                                        <div className="p-4 flex gap-3 items-start">
                                            <div className={`${iconConfig.bg} ${iconConfig.text} p-3 rounded-xl shrink-0 shadow-sm`}>
                                                {iconConfig.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-bold text-slate-800 text-sm leading-snug">{noti.title}</p>
                                                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0"/>
                                                </div>
                                                <p className="text-xs font-medium text-slate-400 mb-1">{iconConfig.label}</p>
                                                <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{noti.message}</p>
                                                <p className="text-slate-300 text-[10px] font-bold mt-2 flex items-center gap-1">
                                                    <Clock size={10}/> {new Date(noti.created_at).toLocaleDateString(toBCP47(locale),{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                                                    <span className="ml-1 text-sky-400">{t('familias.tocaParaLeer')}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })
                        )}
                    </div>
                    )}
                </div>
            </div>
        )}

        {/* 🔒 MODAL - PRIVACIDAD Y SEGURIDAD */}
        {showPrivacy && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowPrivacy(false)}>
                <div
                    className="rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-in overflow-hidden max-h-[92vh] flex flex-col"
                    style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header — gradiente Vanty con badges de cumplimiento */}
                    <div className="relative overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg,#0369a1 0%,#0284c7 50%,#db2777 100%)' }}>
                        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, background: 'rgba(255,255,255,.08)', borderRadius: '50%' }}/>
                        <div style={{ position: 'absolute', bottom: -30, left: 30, width: 100, height: 100, background: 'rgba(255,255,255,.06)', borderRadius: '50%' }}/>

                        <div className="relative z-10 p-6 text-white">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                                        <Shield size={24} strokeWidth={2.5}/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg leading-tight">Privacidad y Seguridad</h3>
                                        <p className="text-xs text-white/80 font-medium">Cómo Vanty protege los datos clínicos de tu familia</p>
                                    </div>
                                </div>
                                <button onClick={()=>setShowPrivacy(false)} className="p-2 hover:bg-white/15 rounded-xl transition-all">
                                    <X size={18}/>
                                </button>
                            </div>

                            {/* Badges técnicos */}
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {[
                                    { icon: <KeyRound size={10}/>, label: 'AES-256' },
                                    { icon: <ServerCog size={10}/>, label: 'TLS 1.3' },
                                    { icon: <Database size={10}/>, label: 'RLS activo' },
                                    { icon: <CheckCircle2 size={10}/>, label: 'Ley 29733 PE' },
                                ].map(b => (
                                    <span key={b.label} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(4px)' }}>
                                        {b.icon} {b.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Contenido — scrolleable */}
                    <div className="p-5 md:p-6 space-y-3 overflow-y-auto" style={{ background: 'var(--c-card)' }}>
                        {/* 1. Cifrado y arquitectura */}
                        <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--c-text-primary)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(2,132,199,0.15)' }}>
                                    <KeyRound size={13} className="text-sky-500"/>
                                </div>
                                Cifrado y arquitectura
                            </h4>
                            <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--c-text-secondary)' }}>
                                Toda la información clínica de tu familia se almacena cifrada con <strong>AES-256</strong> en reposo y se transmite por <strong>TLS 1.3</strong>. Cada fila en nuestra base de datos está protegida con <strong>Row Level Security</strong> — solo cuentas autorizadas pueden verla.
                            </p>
                        </div>

                        {/* 2. Quién accede */}
                        <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--c-text-primary)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(2,132,199,0.15)' }}>
                                    <UserCog size={13} className="text-sky-500"/>
                                </div>
                                Quién puede acceder
                            </h4>
                            <ul className="text-xs space-y-1.5" style={{ color: 'var(--c-text-secondary)' }}>
                                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0"/> <span><strong>Vos</strong> (padre/madre/tutor titular de la cuenta)</span></li>
                                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0"/> <span><strong>Terapeutas y especialistas del centro</strong> asignados al paciente</span></li>
                                <li className="flex items-start gap-2"><CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0"/> <span><strong>Soporte técnico</strong> de Vanty, solo bajo consentimiento explícito y acuerdo de confidencialidad</span></li>
                                <li className="flex items-start gap-2 pt-1 mt-1" style={{ borderTop: '1px dashed var(--c-border)' }}>
                                    <X size={12} className="text-red-500 mt-0.5 flex-shrink-0"/>
                                    <span><strong>Nunca:</strong> anunciantes, brokers de datos, ni terceros con fines comerciales</span>
                                </li>
                            </ul>
                        </div>

                        {/* 3. Inteligencia Artificial (ARIA) */}
                        <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--c-text-primary)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(219,39,119,0.15)' }}>
                                    <Brain size={13} className="text-pink-500"/>
                                </div>
                                Inteligencia Artificial (ARIA)
                            </h4>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                                Los datos clínicos <strong>no se utilizan para entrenar modelos públicos</strong>. ARIA procesa cada consulta de forma contextual — solo se envía la información mínima necesaria al proveedor de IA y se descarta después de generar la respuesta. La generación de reportes y análisis se realiza con datos anonimizados cuando es posible.
                            </p>
                        </div>

                        {/* 4. Tus derechos */}
                        <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--c-text-primary)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                    <ScrollText size={13} className="text-emerald-500"/>
                                </div>
                                Tus derechos (Ley 29733 · Perú)
                            </h4>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { label: 'Acceso',         desc: 'Solicitar copia de todo lo registrado' },
                                    { label: 'Rectificación',  desc: 'Corregir datos inexactos' },
                                    { label: 'Eliminación',    desc: 'Borrar tu cuenta y la del paciente' },
                                    { label: 'Portabilidad',   desc: 'Exportar tu historial en formato abierto' },
                                    { label: 'Oposición',      desc: 'Limitar el uso de tus datos' },
                                    { label: 'Información',    desc: 'Saber qué datos tenemos y por qué' },
                                ].map(d => (
                                    <div key={d.label} className="p-2 rounded-lg" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                                        <p className="text-[11px] font-bold" style={{ color: 'var(--c-text-primary)' }}>{d.label}</p>
                                        <p className="text-[10px] leading-tight" style={{ color: 'var(--c-text-muted)' }}>{d.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[10px] mt-2.5" style={{ color: 'var(--c-text-muted)' }}>
                                Para ejercer cualquier derecho:{' '}
                                <a href="mailto:vantysupport@gmail.com" className="font-bold underline" style={{ color: '#0284c7' }}>
                                    vantysupport@gmail.com
                                </a>
                            </p>
                        </div>

                        {/* 5. Retención */}
                        <div className="rounded-2xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                            <h4 className="font-bold text-sm mb-2 flex items-center gap-2" style={{ color: 'var(--c-text-primary)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
                                    <Database size={13} className="text-amber-500"/>
                                </div>
                                Conservación de datos
                            </h4>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                                Los datos clínicos se conservan durante el período activo de tratamiento y hasta <strong>5 años</strong> luego del último servicio, según la normativa peruana de registros clínicos. Podés solicitar la eliminación anticipada en cualquier momento.
                            </p>
                        </div>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <a
                                href="/privacidad"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all hover:shadow-xl active:scale-[.98]"
                                style={{ background: 'linear-gradient(135deg,#0369a1,#0284c7,#db2777)' }}
                            >
                                <ScrollText size={15}/> Leer Política Completa <ExternalLink size={12}/>
                            </a>
                            <a
                                href="mailto:vantysupport@gmail.com?subject=Consulta%20sobre%20privacidad%20de%20datos"
                                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-80"
                                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-primary)' }}
                            >
                                <Mail size={14}/> Contactar DPO
                            </a>
                        </div>

                        <p className="text-[10px] text-center pt-1" style={{ color: 'var(--c-text-muted)' }}>
                            Plataforma Vanty · Vanty ABA · Lima
                        </p>
                    </div>
                </div>
            </div>
        )}

        {/* ❓ MODAL - AYUDA */}
        {showHelp && (
            <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6 text-white flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                                <HelpCircle size={24}/>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Centro de Ayuda</h3>
                                <p className="text-xs text-green-100">Estamos aquí para ti</p>
                            </div>
                        </div>
                        <button onClick={()=>setShowHelp(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all hover:rotate-90">
                            <X size={20}/>
                        </button>
                    </div>
                    <div className="p-6 space-y-3 overflow-y-auto">
                        <HelpItem 
                            icon={<Calendar className="text-sky-600"/>}
                            title="¿Cómo ver mis citas?"
                            description="En la sección 'Agenda' podés ver todas las citas programadas por el centro. Para cambios o cancelaciones, contactá a recepción directamente."
                        />
                        <HelpItem 
                            icon={<MessageCircle className="text-sky-600"/>}
                            title="¿Cómo usar el Asistente IA?"
                            description="El asistente puede responder dudas sobre el progreso de tu hijo/a, dar consejos y explicar los reportes de las sesiones."
                        />
                        <HelpItem 
                            icon={<Book className="text-green-600"/>}
                            title="¿Dónde encuentro recursos?"
                            description="En la sección 'Biblioteca' encontrarás guías, videos y artículos sobre terapia ABA y desarrollo infantil."
                        />
                        
                        <div className="mt-6 bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-2xl border border-green-200">
                            <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                                <Phone size={18}/> Contacto Directo
                            </h4>
                            <div className="space-y-2 text-sm text-green-700">
                                <p className="flex items-center gap-2">
                                    <Mail size={14}/> <a href="mailto:vantysupport@gmail.com" className="hover:underline">vantysupport@gmail.com</a>
                                </p>
                                <p className="flex items-center gap-2">
                                    <Phone size={14}/> <a href="tel:+51994196916" className="hover:underline">+51 994 196 916</a>
                                </p>
                                <p className="text-xs text-green-600 mt-2">Horario: Lun-Vie 8:00 AM - 6:00 PM</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  )
}

// ==============================================================================
// SUB-COMPONENTES Y VISTAS
// ==============================================================================

