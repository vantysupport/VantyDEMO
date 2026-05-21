'use client'

import { useEffect, useState, useCallback } from 'react'
import type { JSX } from 'react'
import { supabase as supabaseClient } from '@/lib/supabase'
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle,
  Phone, CalendarDays, Baby, Video, Loader2,
  ChevronLeft, ChevronRight, Mail, Info, MapPin, Users, MessageSquare
} from 'lucide-react'
import VideoCallModal from '@/components/VideoCallModal'

interface Appointment {
  id: string; child_id: string; parent_id: string
  appointment_date: string; appointment_time: string
  service_type: string; status: string; notes: string
  is_group: boolean; group_name: string; type: string
  children?: { name: string; birth_date: string }
}
interface Props {
  profile: any; selectedChild: any
  onCancelAppointment: (id: string, reschedule: boolean) => void
  onChangeView: (view: string) => void
}

const MESES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DIAS    = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB']

const STATUS_CFG: Record<string, { label: string; pill: string; badge: string; bar: string; dot: string }> = {
  confirmed: { label: 'Confirmada',    pill: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200',   bar: '#3b82f6', dot: 'bg-blue-500'   },
  pending:   { label: 'Por confirmar', pill: 'bg-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: '#f59e0b', dot: 'bg-amber-400'  },
  cancelled: { label: 'Cancelada',     pill: 'bg-red-400',    badge: 'bg-red-50 text-red-700 border-red-200',       bar: '#ef4444', dot: 'bg-red-400'    },
  completed: { label: 'Realizada',     pill: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200', bar: '#8b5cf6', dot: 'bg-violet-500' },
  realizada: { label: 'Realizada',     pill: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200', bar: '#8b5cf6', dot: 'bg-violet-500' },
}

function fmt(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
function isUpcoming(d: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, mo, dy] = d.split('-').map(Number)
  return new Date(y, mo - 1, dy) >= today
}

export default function MisCitasView({ profile, selectedChild, onCancelAppointment, onChangeView }: Props) {
  const supabase = supabaseClient
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(() => new Date().toISOString().split('T')[0])
  const [videoSession, setVideoSession] = useState<any>(null)
  const [activeVid, setActiveVid]       = useState<Record<string, any>>({})
  const [mes, setMes]                   = useState(new Date())

  const año       = mes.getFullYear()
  const mesN      = mes.getMonth()
  const hoy       = new Date().toISOString().split('T')[0]
  const primerDia = new Date(año, mesN, 1).getDay()
  const diasEnMes = new Date(año, mesN + 1, 0).getDate()

  const porFecha: Record<string, Appointment[]> = {}
  appointments.forEach(a => { (porFecha[a.appointment_date] = porFecha[a.appointment_date] || []).push(a) })

  const citasDelDia   = diaSeleccionado ? (porFecha[diaSeleccionado] || []) : []
  const proximasCitas = appointments.filter(a => a.appointment_date >= hoy && a.status !== 'cancelled').slice(0, 12)
  const upcoming      = proximasCitas.length
  const completed     = appointments.filter(a => a.status === 'completed' || a.status === 'realizada').length

  const pollVid = useCallback(async (apts: Appointment[]) => {
    const virt = apts.filter(a => (a as any).modalidad === 'virtual' && isUpcoming(a.appointment_date) && (a.status === 'confirmed' || a.status === 'pending'))
    if (!virt.length) return
    const res: Record<string, any> = {}
    await Promise.all(virt.map(async apt => {
      try { const r = await fetch(`/api/video-call?appointment_id=${apt.id}`); const d = await r.json(); if (d.session?.roomUrl) res[apt.id] = d.session } catch {}
    }))
    setActiveVid(res)
  }, [])

  const load = async () => {
    if (!profile?.id) return
    setLoading(true)
    const [{ data: kids1 }, { data: parentLinks }] = await Promise.all([
      supabase.from('children').select('id').eq('parent_id', profile.id),
      supabase.from('parent_accounts').select('child_id').eq('user_id', profile.id),
    ])
    const allChildIds = [...new Set([...(kids1 || []).map((c: any) => c.id), ...(parentLinks || []).map((p: any) => p.child_id)])]
    let q = supabase.from('appointments').select('*, children(name, birth_date)').order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true })
    if (selectedChild?.id) q = q.eq('child_id', selectedChild.id)
    else if (allChildIds.length > 0) { const parts = [...allChildIds.map((id: string) => `child_id.eq.${id}`), `parent_id.eq.${profile.id}`]; q = q.or(parts.join(',')) }
    else q = q.eq('parent_id', profile.id)
    const { data } = await q
    setAppointments(data || [])
    pollVid(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id, selectedChild?.id])
  useEffect(() => {
    if (!appointments.length) return
    const i = setInterval(() => pollVid(appointments), 15000)
    return () => clearInterval(i)
  }, [appointments, pollVid])


  const V = {
    card:   'var(--card)',
    border: 'var(--card-border)',
    muted:  'var(--muted-bg)',
    tp:     'var(--text-primary)',
    ts:     'var(--text-secondary)',
    tm:     'var(--text-muted)',
  }

  return (
    <div className="pb-20 md:pb-8">
      {videoSession && (
        <VideoCallModal roomUrl={videoSession.roomUrl} sessionId={videoSession.sessionId}
          appointmentId={videoSession.appointmentId} participantName={profile?.full_name || 'Padre/Madre'}
          onClose={() => { setVideoSession(null); load() }}/>
      )}

      {/* HEADER */}
      <div className="flex flex-row items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <h2 className="font-black text-xl md:text-3xl tracking-tight flex items-center gap-2 sm:gap-3"
            style={{ color: V.tp }}>
            <div className="hidden sm:flex p-2.5 rounded-2xl flex-shrink-0 items-center justify-center"
              style={{ background: 'rgba(59,130,246,0.12)' }}>
              <Calendar className="text-blue-500" size={26}/>
            </div>
            Mis sesiones
          </h2>
          <p className="text-sm font-medium mt-1 ml-1" style={{ color: V.tm }}>
            {selectedChild?.name ? `${selectedChild.name.split(' ')[0]} · ` : ''}
            {appointments.length} citas · {upcoming} próximas · {completed} realizadas
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {([
            { n: upcoming,            label: 'Próximas',   color: '#2563eb' },
            { n: completed,           label: 'Realizadas', color: '#7c3aed' },
            { n: appointments.length, label: 'Total',      color: V.tm },
          ] as const).map(({ n, label, color }) => (
            <div key={label} className="rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 text-center"
              style={{ background: V.card, border: `1px solid ${V.border}` }}>
              <div className="text-lg sm:text-xl font-black leading-none" style={{ color }}>{n}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide mt-0.5" style={{ color: V.tm }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* CALENDAR */}
        <div className="xl:col-span-8 rounded-3xl overflow-hidden shadow-sm"
          style={{ background: V.card, border: `1px solid ${V.border}` }}>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4"
            style={{ borderBottom: `1px solid ${V.border}` }}>
            <button onClick={() => setMes(new Date(año, mesN - 1, 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ color: V.tm, background: V.muted }}>
              <ChevronLeft size={18}/>
            </button>
            <h3 className="font-black text-lg" style={{ color: V.tp }}>
              {MESES[mesN]} <span className="font-semibold" style={{ color: V.tm }}>{año}</span>
            </h3>
            <button onClick={() => setMes(new Date(año, mesN + 1, 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{ color: V.tm, background: V.muted }}>
              <ChevronRight size={18}/>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${V.border}` }}>
            {DIAS.map((d, i) => (
              <div key={d} className="text-center py-3 text-[10px] font-black uppercase tracking-widest"
                style={{ color: i === 0 || i === 6 ? V.tm : V.ts }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-blue-500"/>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {Array.from({ length: primerDia }, (_, i) => (
                <div key={`e-${i}`} className="min-h-[58px] sm:min-h-[88px]"
                  style={{ borderBottom: `1px solid ${V.border}`, borderRight: `1px solid ${V.border}`, background: V.muted }}/>
              ))}
              {Array.from({ length: diasEnMes }, (_, i) => {
                const dia      = i + 1
                const fechaStr = `${año}-${String(mesN + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
                const citasDia = porFecha[fechaStr] || []
                const esHoy    = fechaStr === hoy
                const esSel    = fechaStr === diaSeleccionado
                const hasCitas = citasDia.length > 0
                return (
                  <button key={dia}
                    onClick={() => setDiaSeleccionado(esSel ? '' : fechaStr)}
                    className="min-h-[58px] sm:min-h-[88px] p-1 sm:p-1.5 text-left flex flex-col gap-0.5 sm:gap-1 transition-colors"
                    style={{
                      borderBottom: `1px solid ${V.border}`,
                      borderRight: `1px solid ${V.border}`,
                      background: esSel ? 'rgba(37,99,235,0.12)' : esHoy ? 'rgba(37,99,235,0.06)' : 'transparent',
                    }}>
                    <span className="w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black flex-shrink-0"
                      style={{
                        background: esSel || esHoy ? '#2563eb' : 'transparent',
                        color: esSel || esHoy ? '#fff' : hasCitas ? V.tp : V.tm,
                      }}>
                      {dia}
                    </span>
                    <div className="flex flex-col gap-0.5 w-full">
                      {citasDia.slice(0, 2).map((c, idx) => {
                        const s = STATUS_CFG[c.status] || STATUS_CFG.confirmed
                        return (
                          <div key={idx} className={`w-full px-1 sm:px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-bold truncate flex items-center gap-0.5 sm:gap-1 text-white ${s.pill}`}>
                            {(c as any).modalidad === 'virtual'
                              ? <Video size={7} className="flex-shrink-0 opacity-80"/>
                              : <MapPin size={7} className="flex-shrink-0 opacity-80"/>
                            }
                            <span className="truncate">{c.appointment_time?.slice(0, 5)}<span className="hidden sm:inline"> {c.children?.name || selectedChild?.name}</span></span>
                          </div>
                        )
                      })}
                      {citasDia.length > 2 && (
                        <span className="text-[9px] font-bold px-1" style={{ color: V.tm }}>+{citasDia.length - 2} más</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="xl:col-span-4 flex flex-col gap-4">

          {/* Day detail */}
          <div className="rounded-3xl overflow-hidden shadow-sm flex flex-col"
            style={{ background: V.card, border: `1px solid ${V.border}` }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${V.border}` }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Calendar size={15} className="text-blue-500"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: V.tm }}>
                  {diaSeleccionado === hoy ? 'HOY' : 'DÍA SELECCIONADO'}
                </p>
                <p className="text-sm font-black capitalize truncate" style={{ color: V.tp }}>
                  {diaSeleccionado
                    ? new Date(diaSeleccionado + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
                    : 'Selecciona un día'}
                </p>
              </div>
              <span className="text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ background: V.muted, color: V.tm, border: `1px solid ${V.border}` }}>
                {citasDelDia.length} citas
              </span>
            </div>
            {citasDelDia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: V.muted }}>
                  <CalendarDays size={22} style={{ color: V.tm }}/>
                </div>
                <p className="text-sm font-black" style={{ color: V.tm }}>Sin sesiones este día</p>
                <p className="text-xs mt-1" style={{ color: V.tm, opacity: 0.6 }}>Selecciona un día con citas</p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                {citasDelDia
                  .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
                  .map(c => {
                    const s = STATUS_CFG[c.status] || STATUS_CFG.confirmed
                    const roomUrl = activeVid[c.id]?.roomUrl || (c as any).video_link
                    return (
                      <div key={c.id} className="px-4 py-3" style={{ borderBottom: `1px solid ${V.border}` }}>
                        <div className="flex items-center gap-3">
                          <div className="w-0.5 h-10 rounded-full flex-shrink-0" style={{ background: s.bar }}/>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black truncate" style={{ color: V.tp }}>{c.service_type || c.type || 'Terapia ABA'}</p>
                            <p className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: V.tm }}>
                              <Clock size={9}/> {fmt(c.appointment_time)}
                              {c.children?.name && <><Baby size={9}/> {c.children.name}</>}
                            </p>
                          </div>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex-shrink-0 ${s.badge}`}>{s.label}</span>
                        </div>
                        {roomUrl && (c.status === 'confirmed' || c.status === 'pending') && (
                          <a href={roomUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-2 ml-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                            style={{ textDecoration: 'none' }}>
                            <Video size={12}/> Unirse a videollamada
                          </a>
                        )}
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Upcoming */}
          <div className="rounded-3xl overflow-hidden shadow-sm flex-1"
            style={{ background: V.card, border: `1px solid ${V.border}` }}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${V.border}` }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.12)' }}>
                <Clock size={15} className="text-emerald-500"/>
              </div>
              <h3 className="font-black text-sm flex-1" style={{ color: V.tp }}>Próximas sesiones</h3>
              <span className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ background: V.muted, color: V.tm, border: `1px solid ${V.border}` }}>
                {proximasCitas.length}
              </span>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-blue-500"/></div>
            ) : proximasCitas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: V.muted }}>
                  <Users size={22} style={{ color: V.tm }}/>
                </div>
                <p className="text-sm font-black" style={{ color: V.tm }}>Sin sesiones próximas</p>
                <p className="text-xs mt-1" style={{ color: V.tm, opacity: 0.6 }}>Las citas las programa el centro</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {proximasCitas.map(c => {
                  const s     = STATUS_CFG[c.status] || STATUS_CFG.confirmed
                  const fecha = new Date(c.appointment_date + 'T00:00:00')
                  const esHoyC = c.appointment_date === hoy
                  return (
                    <button key={c.id}
                      onClick={() => { setDiaSeleccionado(c.appointment_date); setMes(fecha) }}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors"
                      style={{ borderBottom: `1px solid ${V.border}` }}>
                      <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: esHoyC ? '#2563eb' : V.muted, color: esHoyC ? '#fff' : V.ts }}>
                        <span className="text-[8px] font-bold leading-none uppercase">{MESES_S[fecha.getMonth()]}</span>
                        <span className="text-sm font-black leading-tight">{fecha.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black truncate" style={{ color: V.tp }}>{c.service_type || c.type || 'Terapia ABA'}</p>
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: V.tm }}>
                          <Clock size={9}/> {fmt(c.appointment_time)}
                          {esHoyC && <span className="font-black text-blue-500">· Hoy</span>}
                        </p>
                      </div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`}/>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Contact */}
          <div className="rounded-3xl p-5 text-white shadow-xl"
            style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <MessageSquare size={16} className="text-white"/>
              </div>
              <div>
                <p className="font-black text-sm">Gestionar sesiones</p>
                <p className="text-[11px] text-white/60">Cambios · Cancelaciones · Nuevas citas</p>
              </div>
            </div>
            <p className="text-xs text-white/60 mb-4 leading-relaxed">
              Las citas son programadas por el equipo del centro. Para cualquier cambio contáctanos directamente.
            </p>
            <div className="flex flex-col gap-2">
              <a href="tel:+51991070734" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', textDecoration: 'none', color: 'white' }}>
                <Phone size={14}/> +51 991 070 734
              </a>
              <a href="mailto:contacto@santi.com" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(255,255,255,0.1)', textDecoration: 'none', color: 'white' }}>
                <Mail size={14}/> Escribir al centro
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
