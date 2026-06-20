'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useCallback } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Clock,
  Loader2, CalendarDays, Check, Users, Video, MapPin
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

/* ── Google Calendar mini ──────────────────────────────────────────────── */
function GoogleCalendarMini({ userId, isDark }: { userId: string; isDark: boolean }) {
  const toast = useToast()
  const [status,     setStatus]     = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [busy,       setBusy]       = useState(false)

  const check = async () => {
    try {
      const res  = await fetch(`/api/google-calendar?action=status&userId=${userId}`)
      const data = await res.json()
      setStatus(data.connected ? 'connected' : 'disconnected')
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    if (!userId) return
    check()
    const p = new URLSearchParams(window.location.search)
    if (p.get('gcal') === 'connected') {
      toast.success('Google Calendar conectado'); check()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [userId])

  const connect = async () => {
    setBusy(true)
    try {
      const res  = await fetch(`/api/google-calendar?action=auth-url&userId=${userId}&role=especialista`)
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { toast.error('Error conectando Google Calendar'); setBusy(false) }
  }

  const disconnect = async () => {
    if (!confirm('¿Desconectar Google Calendar?')) return
    await fetch(`/api/google-calendar?action=disconnect&userId=${userId}`)
    setStatus('disconnected')
    toast.success('Google Calendar desconectado')
  }

  if (status === 'loading') return null
  return status === 'connected' ? (
    <button onClick={disconnect}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all
        ${isDark
          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
        }`}>
      <Check size={12} /> Google Calendar
    </button>
  ) : (
    <button onClick={connect} disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50
        ${isDark
          ? 'bg-[#21262d] text-slate-300 border border-[#30363d] hover:bg-sky-900/30 hover:text-sky-400 hover:border-sky-700'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'
        }`}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : <CalendarDays size={13} />}
      Conectar Google
    </button>
  )
}

/* ── Microsoft mini ─────────────────────────────────────────────────────── */
function MicrosoftCalendarMini({ userId, isDark }: { userId: string; isDark: boolean }) {
  const toast = useToast()
  const [status,     setStatus]     = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [busy,       setBusy]       = useState(false)

  const check = async () => {
    try {
      const res  = await fetch(`/api/microsoft-calendar?action=status&userId=${userId}`)
      const data = await res.json()
      setStatus(data.connected ? 'connected' : 'disconnected')
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    if (!userId) return
    check()
    const p = new URLSearchParams(window.location.search)
    if (p.get('mscal') === 'connected') {
      toast.success('Outlook Calendar conectado'); check()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [userId])

  const connect = async () => {
    setBusy(true)
    try {
      const res  = await fetch(`/api/microsoft-calendar?action=auth-url&userId=${userId}&role=especialista`)
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { toast.error('Error conectando Outlook Calendar'); setBusy(false) }
  }

  const disconnect = async () => {
    if (!confirm('¿Desconectar Outlook Calendar?')) return
    await fetch(`/api/microsoft-calendar?action=disconnect&userId=${userId}`)
    setStatus('disconnected')
    toast.success('Outlook Calendar desconectado')
  }

  const MSIcon = () => (
    <svg width="13" height="13" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  )

  if (status === 'loading') return null
  return status === 'connected' ? (
    <button onClick={disconnect}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all
        ${isDark
          ? 'bg-sky-900/30 text-sky-400 border border-sky-800 hover:bg-red-900/30 hover:text-red-400 hover:border-red-800'
          : 'bg-sky-50 text-sky-700 border border-sky-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
        }`}>
      <MSIcon /> Outlook
    </button>
  ) : (
    <button onClick={connect} disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50
        ${isDark
          ? 'bg-[#21262d] text-slate-300 border border-[#30363d] hover:bg-sky-900/30 hover:text-sky-400 hover:border-sky-700'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'
        }`}>
      {busy ? <Loader2 size={13} className="animate-spin" /> : <MSIcon />}
      Conectar Outlook
    </button>
  )
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string; badgeLight: string; badgeDark: string; bar: string }> = {
  confirmed: { bg: 'bg-sky-500',    text: 'text-white', dot: 'bg-emerald-500', badgeLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',  badgeDark: 'bg-emerald-900/40 text-emerald-400 border-emerald-800', bar: '#10b981' },
  pending:   { bg: 'bg-amber-400',   text: 'text-white', dot: 'bg-amber-400',   badgeLight: 'bg-amber-50 text-amber-700 border-amber-200',        badgeDark: 'bg-amber-900/40 text-amber-400 border-amber-800',       bar: '#f59e0b' },
  cancelled: { bg: 'bg-red-400',     text: 'text-white', dot: 'bg-red-400',     badgeLight: 'bg-red-50 text-red-700 border-red-200',              badgeDark: 'bg-red-900/40 text-red-400 border-red-800',             bar: '#ef4444' },
  completed: { bg: 'bg-sky-500',  text: 'text-white', dot: 'bg-sky-500',    badgeLight: 'bg-sky-50 text-sky-700 border-sky-200',           badgeDark: 'bg-sky-900/40 text-sky-400 border-sky-800',          bar: '#0284c7' },
}
const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmada', pending: 'Pendiente', cancelled: 'Cancelada', completed: 'Completada',
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function MiAgenda({ isDark = false }: { isDark?: boolean }) {
  const toast = useToast()
  const { t } = useI18n()

  const [citas,           setCitas]           = useState<any[]>([])
  const [loading,         setLoading]         = useState(true)
  const [mes,             setMes]             = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [userId,          setUserId]          = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user?.id) setUserId(session.user.id)
    })
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('appointments')
        .select('*, children(name, profiles!children_parent_id_fkey(full_name))')
        .order('appointment_date')
        .order('appointment_time')
      setCitas(data || [])
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const año       = mes.getFullYear()
  const mesN      = mes.getMonth()
  const hoy       = new Date().toISOString().split('T')[0]
  const primerDia = new Date(año, mesN, 1).getDay()
  const diasEnMes = new Date(año, mesN + 1, 0).getDate()

  const citasPorFecha: Record<string, any[]> = {}
  citas.forEach(c => {
    if (!citasPorFecha[c.appointment_date]) citasPorFecha[c.appointment_date] = []
    citasPorFecha[c.appointment_date].push(c)
  })

  const citasDelDia   = diaSeleccionado ? (citasPorFecha[diaSeleccionado] || []) : []
  const proximasCitas = citas.filter(c => c.appointment_date >= hoy && c.status !== 'cancelled').slice(0, 10)
  const citasVirtuales = citas.filter(c => c.is_virtual).length

  const fechaSelFmt = diaSeleccionado
    ? new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  /* Color helpers — mismo patrón page.tsx */
  const card    = isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'
  const divLine = isDark ? 'border-[#21262d]'              : 'border-slate-200'
  const txt1    = isDark ? 'text-slate-100'                : 'text-slate-800'
  const txt3    = isDark ? 'text-slate-500'                : 'text-slate-400'
  const hoverBg = isDark ? 'hover:bg-[#1c2128]'           : 'hover:bg-slate-50'
  const cellBorder = isDark ? 'border-[#21262d]'           : 'border-slate-100'

  return (
    <div className="pb-28 md:pb-8">

      {/* ── Header — igual al admin ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className={`font-bold text-2xl md:text-3xl tracking-tight flex items-center gap-3 ${txt1}`}>
            <div className="p-2.5 rounded-2xl flex-shrink-0" style={{ background: 'rgba(2,132,199,0.15)' }}>
              <Calendar className="text-sky-500" size={28} />
            </div>
            Agenda
          </h2>
          <p className={`text-sm font-medium mt-1 ml-1 ${txt3}`}>
            {citas.length} citas · {citasDelDia.length} hoy · {citasVirtuales} virtuales
          </p>
        </div>

      </div>

      {/* ── Layout principal ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* ════ CALENDARIO — mismo estilo admin ════ */}
        <div className={`xl:col-span-8 ${card} rounded-3xl border shadow-sm overflow-hidden`}>

          {/* Nav mes */}
          <div className={`flex items-center justify-between p-5 border-b ${divLine}`}>
            <button
              onClick={() => setMes(new Date(año, mesN - 1, 1))}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${txt3}
                ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}`}
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className={`font-bold text-lg capitalize ${txt1}`}>
              {MESES[mesN]} <span className={`font-semibold ${txt3}`}>{año}</span>
            </h3>
            <button
              onClick={() => setMes(new Date(año, mesN + 1, 1))}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${txt3}
                ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}`}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Cabecera días */}
          <div className={`grid grid-cols-7 border-b ${divLine}`}>
            {DIAS.map(d => (
              <div key={d} className={`text-center py-3 text-[10px] font-bold ${txt3}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Celdas — misma estructura que admin */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-sky-500" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {Array.from({ length: primerDia }, (_, i) => (
                <div key={`e-${i}`} className={`min-h-[56px] sm:min-h-[80px] border-b border-r ${cellBorder}
                  ${isDark ? 'bg-[#0d1117]/50' : 'bg-slate-50/30'}`} />
              ))}

              {Array.from({ length: diasEnMes }, (_, i) => {
                const dia      = i + 1
                const fechaStr = `${año}-${String(mesN + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
                const citasDia = citasPorFecha[fechaStr] || []
                const esHoy    = fechaStr === hoy
                const esSel    = fechaStr === diaSeleccionado

                return (
                  <button
                    key={dia}
                    onClick={() => setDiaSeleccionado(esSel ? '' : fechaStr)}
                    className={`min-h-[56px] sm:min-h-[80px] border-b border-r ${cellBorder} p-1.5 text-left transition-all
                      flex flex-col gap-1 group
                      ${esSel
                        ? isDark ? 'bg-sky-900/30' : 'bg-sky-50'
                        : esHoy
                          ? isDark ? 'bg-sky-950/40' : 'bg-sky-50/60'
                          : isDark ? 'hover:bg-[#1c2128]' : 'hover:bg-slate-50'
                      }`}
                  >
                    {/* Número del día */}
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all
                      ${esSel
                        ? 'bg-sky-600 text-white'
                        : esHoy
                          ? 'bg-sky-600 text-white'
                          : isDark ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-700 group-hover:text-slate-900'
                      }`}>
                      {dia}
                    </span>

                    {/* Citas del día — misma pill que admin */}
                    <div className="flex flex-col gap-0.5 w-full">
                      {citasDia.slice(0, 2).map((c, idx) => {
                        const col = STATUS_COLORS[c.status] || STATUS_COLORS.confirmed
                        return (
                          <div
                            key={idx}
                            className={`w-full px-1.5 py-0.5 rounded-md text-[9px] font-bold truncate flex items-center gap-1 ${col.bg} ${col.text}`}
                          >
                            {c.is_virtual
                              ? <Video size={8} className="flex-shrink-0 opacity-80" />
                              : <MapPin size={8} className="flex-shrink-0 opacity-80" />
                            }
                            {c.appointment_time?.slice(0,5)} {c.children?.name}
                          </div>
                        )
                      })}
                      {citasDia.length > 2 && (
                        <span className={`text-[9px] font-bold px-1 ${txt3}`}>
                          +{citasDia.length - 2} más
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ════ PANEL DERECHO ════ */}
        <div className="xl:col-span-4 flex flex-col gap-4">

          {/* HOY */}
          <div className={`${card} rounded-3xl border shadow-sm overflow-hidden flex flex-col`}>
            <div className={`px-5 py-4 border-b ${divLine} flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                ${isDark ? 'bg-sky-900/40' : 'bg-sky-50'}`}>
                <Calendar size={15} className={isDark ? 'text-sky-400' : 'text-sky-600'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-bold ${txt3}`}>HOY</p>
                <p className={`text-sm font-bold capitalize truncate ${txt1}`}>
                  {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0
                ${isDark ? 'bg-[#21262d] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {citasDelDia.length} citas
              </span>
            </div>

            {citasDelDia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3
                  ${isDark ? 'bg-[#1c2128]' : 'bg-slate-50'}`}>
                  <CalendarDays size={22} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                </div>
                <p className={`text-sm font-bold ${txt3}`}>Sin citas este día</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
                  Selecciona otro día del calendario
                </p>
              </div>
            ) : (
              <div className={`divide-y ${divLine} max-h-56 overflow-y-auto`}>
                {citasDelDia
                  .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
                  .map(c => {
                    const col = STATUS_COLORS[c.status] || STATUS_COLORS.confirmed
                    return (
                      <div key={c.id}
                        className={`px-4 py-3 flex items-center gap-3 transition-colors ${hoverBg}`}>
                        <div className="w-0.5 h-9 rounded-full flex-shrink-0" style={{ background: col.bar }} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${txt1}`}>{c.children?.name}</p>
                          <p className={`text-xs flex items-center gap-1 mt-0.5 ${txt3}`}>
                            <Clock size={9} /> {c.appointment_time?.slice(0,5)}
                            {c.service_type && <> · {c.service_type}</>}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0
                          ${isDark ? col.badgeDark : col.badgeLight}`}>
                          {STATUS_LABEL[c.status] || 'Confirmada'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* CITAS */}
          <div className={`${card} rounded-3xl border shadow-sm overflow-hidden flex-1`}>
            <div className={`px-5 py-4 border-b ${divLine} flex items-center gap-3`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
                ${isDark ? 'bg-emerald-900/30' : 'bg-emerald-50'}`}>
                <Clock size={15} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
              </div>
              <h3 className={`font-bold text-sm flex-1 ${txt1}`}>Citas</h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border
                ${isDark
                  ? 'bg-[#21262d] text-slate-500 border-[#30363d]'
                  : 'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                {proximasCitas.length}
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={18} className="animate-spin text-sky-500" />
              </div>
            ) : proximasCitas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3
                  ${isDark ? 'bg-[#1c2128]' : 'bg-slate-50'}`}>
                  <Users size={22} className={isDark ? 'text-slate-600' : 'text-slate-300'} />
                </div>
                <p className={`text-sm font-bold ${txt3}`}>Sin citas próximas</p>
              </div>
            ) : (
              <div className={`divide-y ${divLine} max-h-80 overflow-y-auto`}>
                {proximasCitas.map(c => {
                  const col       = STATUS_COLORS[c.status] || STATUS_COLORS.confirmed
                  const fecha     = new Date(c.appointment_date + 'T00:00:00')
                  const esHoyItem = c.appointment_date === hoy
                  return (
                    <button key={c.id}
                      onClick={() => { setDiaSeleccionado(c.appointment_date); setMes(fecha) }}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${hoverBg}`}>
                      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0
                        ${esHoyItem
                          ? 'bg-sky-600 text-white'
                          : isDark ? 'bg-[#21262d] text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}>
                        <span className="text-[8px] font-bold leading-none uppercase">
                          {MESES[fecha.getMonth()].slice(0,3)}
                        </span>
                        <span className="text-sm font-bold leading-tight">{fecha.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${txt1}`}>{c.children?.name}</p>
                        <p className={`text-xs flex items-center gap-1 mt-0.5 ${txt3}`}>
                          <Clock size={9} /> {c.appointment_time?.slice(0,5)}
                          {esHoyItem && <span className={`font-bold ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>· Hoy</span>}
                        </p>
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
