'use client'

import { useState, useEffect } from 'react'
import {
  Calendar, CalendarDays, Users, CheckCircle2, XCircle,
  AlertCircle, Loader2, ArrowRight, Clock, ChevronRight,
  TrendingUp, Activity
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

// ── AppointmentRow ────────────────────────────────────────────────────────────
function AppointmentRow({ apt }: { apt: any }) {
  const fecha = new Date(apt.appointment_date + 'T00:00:00')
  const mesCorto = fecha.toLocaleString('es', { month: 'short' }).replace('.', '').toUpperCase()
  const dia = fecha.getDate()
  const esHoy = apt.appointment_date === new Date().toISOString().split('T')[0]

  const statusCfg: Record<string, { label: string; dot: string }> = {
    confirmed: { label: 'Confirmada', dot: '#10b981' },
    pending:   { label: 'Pendiente',  dot: '#f59e0b' },
    cancelled: { label: 'Cancelada',  dot: '#ef4444' },
    completed: { label: 'Completada', dot: '#3b82f6' },
    realizada: { label: 'Realizada',  dot: '#3b82f6' },
  }
  const s = statusCfg[apt.status] || { label: apt.status, dot: '#9ca3af' }

  return (
    <div className="flex items-center gap-3 py-3 px-4"
      style={{ borderBottom: '1px solid var(--card-border)' }}>
      {/* Fecha pill */}
      <div className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: esHoy ? '#3b82f6' : 'var(--muted-bg)' }}>
        <span className="text-[9px] font-black uppercase leading-none"
          style={{ color: esHoy ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>{mesCorto}</span>
        <span className="text-sm font-black leading-tight"
          style={{ color: esHoy ? '#fff' : 'var(--text-primary)' }}>{dia}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {apt.children?.name || apt.patient_name || 'Paciente'}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {apt.appointment_time?.slice(0, 5) || '—'} · {apt.therapist_name || 'Terapeuta'}
        </p>
      </div>

      {/* Status dot + label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
        <span className="text-[11px] font-semibold" style={{ color: s.dot }}>{s.label}</span>
      </div>
    </div>
  )
}

// ── WeeklyMiniChart ───────────────────────────────────────────────────────────
function WeeklyMiniChart() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const DAYS = ['L','M','X','J','V','S','D']
        const today = new Date()
        const dow = today.getDay()
        const monday = new Date(today)
        monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
        const weekDates = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(monday); d.setDate(monday.getDate() + i)
          return d.toISOString().split('T')[0]
        })
        const { data: apts } = await supabase
          .from('appointments').select('appointment_date, status')
          .in('appointment_date', weekDates)
        const todayStr = today.toISOString().split('T')[0]
        const rows = weekDates.map((date, i) => {
          const da = (apts || []).filter(a => a.appointment_date === date)
          return {
            day: DAYS[i], date, isToday: date === todayStr,
            total: da.length,
            ok:   da.filter(a => ['completed','realizada','confirmed'].includes(a.status)).length,
            pend: da.filter(a => a.status === 'pending').length,
            canc: da.filter(a => a.status === 'cancelled').length,
          }
        })
        setData(rows)
      } finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex justify-center py-4">
      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  )

  const max = Math.max(...data.map(d => d.total), 1)

  return (
    <div className="flex items-end gap-2 px-1" style={{ height: 60 }}>
      {data.map(d => {
        const barH = d.total > 0 ? Math.max((d.total / max) * 40, 6) : 0
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
            {d.total > 0 && (
              <span className="text-[10px] font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {d.total}
              </span>
            )}
            <div className="flex flex-col justify-end w-full" style={{ height: 40 }}>
              {d.total > 0 ? (
                <div className="w-full rounded-md overflow-hidden"
                  style={{
                    height: barH,
                    background: d.isToday ? '#3b82f6' : '#10b981',
                    opacity: d.isToday ? 1 : 0.7
                  }} />
              ) : (
                <div className="w-full rounded-sm" style={{
                  height: 3,
                  background: d.isToday ? 'rgba(59,130,246,0.4)' : 'var(--card-border)'
                }} />
              )}
            </div>
            <span className="text-[10px] font-black"
              style={{ color: d.isToday ? '#3b82f6' : 'var(--text-muted)' }}>
              {d.day}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
interface Props { onNavigate?: (view: string) => void }

export default function SecretariaHome({ onNavigate }: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [horaActual, setHoraActual] = useState<Date | null>(null)
  const [stats, setStats] = useState({
    hoy: 0, semana: 0, pendientes: 0, canceladas: 0, pacientes: 0, completadas: 0
  })
  const [proximasCitas, setProximasCitas] = useState<any[]>([])
  const [citasRecientes, setCitasRecientes] = useState<any[]>([])

  useEffect(() => {
    setHoraActual(new Date())
    const t = setInterval(() => setHoraActual(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const hoyStr = new Date().toISOString().split('T')[0]
      const d = new Date(); const day = d.getDay()
      const lunesStr = (() => { const x = new Date(d); x.setDate(d.getDate() - (day === 0 ? 6 : day - 1)); return x.toISOString().split('T')[0] })()
      const viernesStr = (() => { const x = new Date(d); x.setDate(d.getDate() + (day === 0 ? 0 : 7 - day)); return x.toISOString().split('T')[0] })()
      const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30)

      const { data: todas } = await supabase
        .from('appointments').select('*, children(name)')
        .gte('appointment_date', hace30.toISOString().split('T')[0])
        .order('appointment_date', { ascending: false }).limit(200)
      const { data: pacientes } = await supabase.from('children').select('id').eq('is_active', true)

      const allApts = todas || []
      setProximasCitas(allApts.filter(a => a.appointment_date >= hoyStr).slice(0, 8))
      setCitasRecientes(allApts.filter(a => a.appointment_date < hoyStr).slice(0, 6))
      setStats({
        hoy: allApts.filter(a => a.appointment_date === hoyStr).length,
        semana: allApts.filter(a => a.appointment_date >= lunesStr && a.appointment_date <= viernesStr).length,
        pendientes: allApts.filter(a => a.status === 'pending').length,
        canceladas: allApts.filter(a => a.status === 'cancelled').length,
        pacientes: pacientes?.length || 0,
        completadas: allApts.filter(a => ['completed', 'realizada'].includes(a.status)).length,
      })
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const saludo = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  })()

  const hoyStr = new Date().toISOString().split('T')[0]
  const citasHoy = (proximasCitas.length > 0 ? proximasCitas : citasRecientes)
    .filter(a => a.appointment_date === hoyStr)
  const listaCitas = proximasCitas.length > 0 ? proximasCitas : citasRecientes

  const diaStr = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-5 pb-8">

      {/* ── HERO ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #2563eb, #7c3aed, #059669)' }} />
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs capitalize mb-0.5" style={{ color: 'var(--text-muted)' }}>{diaStr}</p>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              {saludo} 👋
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                {loading ? '—' : stats.hoy} citas hoy
              </span>
              {!loading && stats.pendientes > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#b07830', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <AlertCircle size={10} className="inline mr-1" />{stats.pendientes} pendientes
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-5xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {horaActual ? horaActual.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {horaActual ? horaActual.getSeconds() + 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: 'Citas hoy',   value: stats.hoy,         sub: 'Programadas',     icon: Calendar,     bar: '#2563eb', nav: 'agenda' },
          { label: 'Pendientes',  value: stats.pendientes,  sub: 'Sin confirmar',   icon: AlertCircle,  bar: '#f59e0b', nav: 'agenda' },
          { label: 'Canceladas',  value: stats.canceladas,  sub: 'Últimos 30 días', icon: XCircle,      bar: '#ef4444', nav: undefined },
          { label: 'Completadas', value: stats.completadas, sub: 'Últimos 30 días', icon: CheckCircle2, bar: '#10b981', nav: undefined },
        ] as const).map(({ label, value, sub, icon: Icon, bar, nav }) => (
          <button key={label}
            onClick={() => nav && onNavigate?.(nav)}
            className={`rounded-xl p-5 relative overflow-hidden transition-all text-left ${nav ? 'cursor-pointer hover:shadow-md' : ''}`}
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: bar }} />
            <div className="flex items-start justify-between pl-3 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${bar}18` }}>
                <Icon size={14} style={{ color: bar }} />
              </div>
            </div>
            <p className="text-4xl font-black leading-none pl-3 mb-1" style={{ color: loading ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {loading ? '—' : value}
            </p>
            <p className="text-xs pl-3" style={{ color: 'var(--text-muted)' }}>{sub}</p>
          </button>
        ))}
      </div>

      {/* ── 2 COLS: Actividad + Resumen ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
        <div className="rounded-xl p-5 flex flex-col" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Actividad semanal</p>
            <span className="text-sm font-black" style={{ color: '#2563eb' }}>{loading ? '—' : stats.semana}</span>
          </div>
          <WeeklyMiniChart />
        </div>
        <div className="rounded-xl p-5 flex flex-col justify-between" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <p className="text-[11px] font-black uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>Resumen</p>
          <div className="flex flex-col gap-4">
            {([
              { label: 'Pacientes activos', value: stats.pacientes,   icon: Users,        color: '#3b82f6' },
              { label: 'Esta semana',       value: stats.semana,      icon: TrendingUp,   color: '#10b981' },
              { label: 'Completadas (30d)', value: stats.completadas, icon: CheckCircle2, color: '#8b5cf6' },
            ] as const).map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}12` }}>
                  <Icon size={14} style={{ color }}/>
                </div>
                <div className="flex-1">
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <p className="text-lg font-black tabular-nums" style={{ color: loading ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                  {loading ? '—' : value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOY ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: '#2563eb' }}/>
            <h3 className="text-[13px] font-black" style={{ color: 'var(--text-primary)' }}>Hoy</h3>
            {citasHoy.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: '#2563eb', color: '#fff' }}>
                {citasHoy.length}
              </span>
            )}
          </div>
          <button onClick={() => onNavigate?.('agenda')} className="flex items-center gap-1 text-[11px] font-bold hover:opacity-70" style={{ color: '#2563eb' }}>
            Ver agenda <ChevronRight size={12}/>
          </button>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }}/></div>
        ) : citasHoy.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--muted-bg)' }}>
              <Calendar size={22} style={{ color: 'var(--text-muted)' }}/>
            </div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Sin citas para hoy</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Disfruta el día libre 🎉</p>
          </div>
        ) : (
          <div>{citasHoy.slice(0, 5).map((apt: any) => <AppointmentRow key={apt.id} apt={apt}/>)}</div>
        )}
      </div>

      {/* ── PRÓXIMAS / RECIENTES ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-2">
            <CalendarDays size={14} style={{ color: 'var(--text-muted)' }}/>
            <h3 className="text-[13px] font-black" style={{ color: 'var(--text-primary)' }}>
              {proximasCitas.length > 0 ? 'Próximas citas' : 'Citas recientes'}
            </h3>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }}/></div>
        ) : listaCitas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Calendar size={26} style={{ color: 'var(--text-muted)' }}/>
            <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Sin citas registradas</p>
          </div>
        ) : (
          <div>{listaCitas.slice(0, 6).map((apt: any) => <AppointmentRow key={apt.id} apt={apt}/>)}</div>
        )}
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {listaCitas.length > 6 ? `+${listaCitas.length - 6} más` : `${listaCitas.length} citas`}
          </span>
          <button onClick={() => onNavigate?.('agenda')} className="flex items-center gap-1 text-[12px] font-bold hover:opacity-70" style={{ color: '#2563eb' }}>
            Ver agenda <ArrowRight size={12}/>
          </button>
        </div>
      </div>

    </div>
  )
}
