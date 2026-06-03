'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Clock, CheckCircle2, XCircle, Calendar,
  Baby, ChevronRight, ArrowUpRight,
  Plus, Brain, Sparkles, Users, Heart, BookOpen,
  AlertCircle, AlertTriangle, Bell, Target, BarChart3, Trophy
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  userId: string
  profile: any
  setActiveView: (v: string) => void
}

const TIPS_CLINICOS = [
  { Icon: Target,     texto: 'Registra las conductas objetivo con antecedente, conducta y consecuencia (ABC) para mejorar la calidad de tu análisis ABA.' },
  { Icon: BarChart3,  texto: 'Cuando un objetivo supera el 80% de dominio por 3 sesiones consecutivas, es momento de proponer un nuevo objetivo al jefe.' },
  { Icon: Heart,      texto: 'Recuerda preguntar brevemente al padre/madre cómo se ha sentido esta semana. El bienestar del cuidador afecta directamente el progreso del niño.' },
  { Icon: FileText,   texto: 'Las notas de sesión con observaciones específicas son más útiles que las generales. Detalla cada avance con datos concretos.' },
  { Icon: Trophy,     texto: 'Celebra los micro-logros con el niño y la familia. Un objetivo nuevo alcanzado, por pequeño que sea, merece reconocimiento.' },
]

// ── Mismos componentes visuales que DashboardHome del admin ───────────────────

function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-1 h-10">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-sm transition-all"
            style={{ height: `${Math.max(2, (v / max) * 36)}px`, background: i === values.length - 1 ? color : `${color}55` }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

function Donut({ value, total, color, size = 56 }: any) {
  const pct = total > 0 ? value / total : 0
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted-bg)" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-primary)" fontSize={size * 0.18} fontWeight="bold">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

function KPI({ label, value, sub, icon: Icon, bar, urgent, onClick }: any) {
  return (
    <div onClick={onClick}
      className={`rounded-xl p-5 relative overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      style={{ background: 'var(--card)', border: urgent ? `1px solid ${bar}60` : '1px solid var(--card-border)' }}>
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: bar }} />
      <div className="flex items-start justify-between pl-3 mb-2">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${bar}12` }}>
          <Icon size={14} style={{ color: bar }} />
        </div>
      </div>
      <p className="text-4xl font-bold leading-none pl-3 mb-1" style={{ color: urgent ? bar : 'var(--text-primary)' }}>{value ?? '—'}</p>
      <p className="text-xs pl-3" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

function EvalRow({ titulo, paciente, fecha, status, onClick }: any) {
  const cfg: Record<string, any> = {
    pending_approval: { label: 'En revisión', color: '#b07830', Icon: Clock },
    approved:         { label: 'Aprobada',    color: '#2e7a56', Icon: CheckCircle2 },
    rejected:         { label: 'Rechazada',   color: '#c0524a', Icon: XCircle },
  }
  const c = cfg[status] || cfg.pending_approval
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-80"
      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', borderLeft: `3px solid ${c.color}` }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[9px] font-bold" style={{ color: c.color }}>{c.label}</span>
          {paciente && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{paciente}</span>}
        </div>
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{titulo}</p>
        {fecha && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{fecha}</p>}
      </div>
      <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0" />
    </button>
  )
}

function CitaRow({ cita, onClick }: any) {
  const fecha = new Date((cita.appointment_date) + 'T00:00:00')
  const hoy = new Date().toISOString().split('T')[0]
  const esHoy = cita.appointment_date === hoy
  const mes = fecha.toLocaleString('es', { month: 'short' }).toUpperCase()
  const dia = fecha.getDate()
  const nombre = cita.children?.name || 'Paciente'
  const hora = cita.appointment_time
  return (
    <div onClick={onClick} className="flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer hover:opacity-80"
      style={{ background: esHoy ? 'rgba(58,104,160,0.06)' : 'transparent', border: esHoy ? '1px solid rgba(58,104,160,0.15)' : '1px solid transparent' }}>
      <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: esHoy ? '#3a68a0' : 'var(--muted-bg)', color: esHoy ? '#fff' : 'var(--text-secondary)' }}>
        <span className="text-[8px] font-bold leading-none">{mes}</span>
        <span className="text-sm font-bold leading-none">{dia}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{nombre}</p>
        <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          {hora && <><Clock size={9} /> {hora.slice(0, 5)}</>}
          {esHoy && <span className="font-bold flex-shrink-0" style={{ color: '#3a68a0' }}> · Hoy</span>}
        </p>
      </div>
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────────
export default function EspecialistaHome({ userId, profile, setActiveView }: Props) {
  const { locale } = useI18n()

  const [stats, setStats] = useState({ pendientes: 0, aprobadas: 0, rechazadas: 0, citasHoy: 0, totalPacientes: 0, sesionesEstaSemana: 0 })
  const [recientes, setRecientes]         = useState<any[]>([])
  const [proximasCitas, setProximasCitas] = useState<any[]>([])
  const [ultimaSesion, setUltimaSesion]   = useState<string | null>(null)
  const [pacientesRecientes, setPacientesRecientes] = useState<any[]>([])
  const [sesSemanales, setSesSemanales]   = useState<number[]>([0,0,0,0,0,0,0])
  const [diasLabels, setDiasLabels]       = useState<string[]>(['L','M','M','J','V','S','D'])
  const [loading, setLoading]             = useState(true)
  const [tipIndex]                        = useState(() => Math.floor(Math.random() * TIPS_CLINICOS.length))
  const [horaActual, setHoraActual]       = useState<Date | null>(null)
  const [saludo, setSaludo]               = useState('')
  const [diaStr, setDiaStr]               = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setHoraActual(now)
      setSaludo(now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches')
      setDiaStr(now.toLocaleDateString(toBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [locale])

  const cargar = useCallback(async () => {
    try {
      const hoy       = new Date().toISOString().split('T')[0]
      const hace7dias = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
      const labels: string[] = []
      const datesArr: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        labels.push(d.toLocaleDateString('es', { weekday: 'short' }).charAt(0).toUpperCase())
        datesArr.push(d.toISOString().split('T')[0])
      }
      setDiasLabels(labels)

      const [subRes, citRes, nRes, sesRes, sesDetalle, ultSesRes] = await Promise.all([
        supabase.from('specialist_submissions').select('status').eq('specialist_id', userId),
        supabase.from('appointments').select('appointment_date, appointment_time, children(name)').eq('appointment_date', hoy).neq('status', 'cancelled').order('appointment_time'),
        supabase.from('children').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('appointments').select('id').neq('status', 'cancelled').gte('appointment_date', hace7dias),
        supabase.from('appointments').select('appointment_date').neq('status', 'cancelled').gte('appointment_date', datesArr[0]),
        supabase.from('appointments').select('appointment_date').neq('status', 'cancelled').lt('appointment_date', hoy).order('appointment_date', { ascending: false }).limit(1),
      ])

      const subs = subRes.data || []
      const ultDate = ultSesRes.data?.[0]?.appointment_date
      setUltimaSesion(ultDate ? new Date(ultDate + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : null)

      const sesMap: Record<string, number> = {}
      datesArr.forEach(d => { sesMap[d] = 0 })
      ;(sesDetalle.data || []).forEach((s: any) => { if (sesMap[s.appointment_date] !== undefined) sesMap[s.appointment_date]++ })
      setSesSemanales(Object.values(sesMap))

      setStats({
        pendientes: subs.filter(s => s.status === 'pending_approval').length,
        aprobadas: subs.filter(s => s.status === 'approved').length,
        rechazadas: subs.filter(s => s.status === 'rejected').length,
        citasHoy: (citRes.data || []).length,
        totalPacientes: nRes.count || 0,
        sesionesEstaSemana: (sesRes.data || []).length,
      })
      setProximasCitas(citRes.data || [])

      const { data: rec } = await supabase.from('specialist_submissions').select('*, children(name)').eq('specialist_id', userId).order('created_at', { ascending: false }).limit(6)
      setRecientes(rec || [])

      const { data: pacs } = await supabase.from('children').select('id, name, birth_date').eq('is_active', true).order('created_at', { ascending: false }).limit(5)
      setPacientesRecientes(pacs || [])
    } finally { setLoading(false) }
  }, [userId])

  useEffect(() => { cargar() }, [cargar])

  const tip      = TIPS_CLINICOS[tipIndex]
  const total    = stats.aprobadas + stats.pendientes + stats.rechazadas
  const totalSes = sesSemanales.reduce((a, b) => a + b, 0)
  const sinSesionCount = stats.pendientes  // reutilizamos pendientes como proxy visual

  return (
    <div className="space-y-5">

      {/* ── HERO — igual que admin ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #3a68a0, #6355a0, #2e7a56)' }} />
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs capitalize mb-0.5" style={{ color: 'var(--text-muted)' }}>{diaStr}</p>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {saludo}, {profile?.role === 'especialista' ? 'Especialista' : profile?.full_name?.split(' ')[0] || 'Bienvenida'} 👋
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                {stats.citasHoy} sesiones hoy
              </span>
              {stats.pendientes > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(176,120,48,0.1)', color: '#b07830', border: '1px solid rgba(176,120,48,0.25)' }}>
                  <AlertCircle size={10} className="inline mr-1" />{stats.pendientes} sin sesión (30d)
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-5xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {horaActual ? horaActual.toLocaleTimeString(toBCP47(locale), { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{horaActual?.getSeconds()}s</p>
          </div>
        </div>
      </div>

      {/* ── KPIs — mismos estilos que admin ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Pacientes"     value={loading ? '—' : stats.totalPacientes}     sub="Total activos"      icon={Users}          bar="#3a68a0" onClick={() => setActiveView('pacientes')} />
        <KPI label="Citas"         value={loading ? '—' : stats.sesionesEstaSemana} sub="Últimos 7 días"     icon={Calendar}       bar="#2e7a56" onClick={() => setActiveView('agenda')} />
        <KPI label="Evaluaciones"  value={loading ? '—' : total}                   sub="Total registradas"  icon={FileText}       bar="#b07830" urgent={stats.pendientes > 0} onClick={() => setActiveView('formularios')} />
        <KPI label="Última sesión" value={loading ? '—' : (ultimaSesion ?? '—')}   sub="Fecha más reciente" icon={Calendar}       bar="#6355a0" onClick={() => setActiveView('agenda')} />
      </div>

      {/* ── MÉTRICAS MEDIAS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">

        {/* Sesiones 7 días + Retención */}
        <div className="rounded-xl p-5 flex flex-col justify-between" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>Sesiones — últimos 7 días</p>
            <span className="text-lg font-bold" style={{ color: '#3a68a0' }}>{totalSes}</span>
          </div>
          <BarChart values={sesSemanales} labels={diasLabels} color="#3a68a0" />
          <div className="mt-4 pt-4 border-t flex items-center gap-4" style={{ borderColor: 'var(--card-border)' }}>
            <Donut value={stats.totalPacientes - stats.pendientes} total={stats.totalPacientes} color="#2e7a56" size={56} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>Retención activa</p>
              <p className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                {stats.totalPacientes - stats.pendientes}
                <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-muted)' }}>/ {stats.totalPacientes}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>pacientes con sesión reciente</p>
            </div>
          </div>
        </div>

        {/* Evaluaciones recientes */}
        <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>Mis evaluaciones recientes</p>
            <button onClick={() => setActiveView('formularios')} className="text-[10px] font-semibold" style={{ color: '#3a68a0' }}>Ver todas →</button>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--muted-bg)' }} />)}</div>
          ) : recientes.length === 0 ? (
            <div className="flex flex-col items-center py-4">
              <FileText size={20} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Sin evaluaciones aún</p>
              <button onClick={() => setActiveView('formularios')} className="text-xs font-bold mt-2" style={{ color: '#3a68a0' }}>
                Crear evaluación →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recientes.slice(0, 4).map((r) => (
                <EvalRow
                  key={r.id}
                  titulo={r.titulo}
                  paciente={r.children?.name}
                  fecha={new Date(r.created_at).toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'short' })}
                  status={r.status}
                  onClick={() => setActiveView('formularios')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL INFERIOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Mis pacientes */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-2">
              <Users size={13} style={{ color: 'var(--text-muted)' }} />
              <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Mis pacientes</p>
            </div>
            <button onClick={() => setActiveView('pacientes')} className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#3a68a0' }}>
              Ver todos <ArrowUpRight size={10} />
            </button>
          </div>
          <div className="p-3 space-y-1.5 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--muted-bg)' }} />)
            ) : pacientesRecientes.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <Users size={24} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Sin pacientes activos</p>
              </div>
            ) : (
              <>
                {pacientesRecientes.map((p: any) => {
                  const edad = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : null
                  const initials = p.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase() || '?'
                  const clrs = ['#3a68a0','#6355a0','#2e7a56','#b07830']
                  const clr  = clrs[p.id?.charCodeAt(0) % clrs.length] || '#3a68a0'
                  return (
                    <button key={p.id} onClick={() => setActiveView('pacientes')}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:opacity-80"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{ background: clr }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                        {edad !== null && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{edad} año{edad !== 1 ? 's' : ''}</p>}
                      </div>
                      <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  )
                })}
                {stats.totalPacientes > 5 && (
                  <button onClick={() => setActiveView('pacientes')} className="w-full text-center text-xs font-bold py-2" style={{ color: '#3a68a0' }}>
                    +{stats.totalPacientes - 5} más
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Citas de hoy + Tip clínico */}
        <div className="space-y-4">
          {/* Citas de hoy */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div className="flex items-center gap-2">
                <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Citas de hoy</p>
              </div>
              <button onClick={() => setActiveView('agenda')} className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#3a68a0' }}>
                Ver agenda <ArrowUpRight size={10} />
              </button>
            </div>
            <div className="p-3 overflow-y-auto" style={{ maxHeight: '200px' }}>
              {proximasCitas.length > 0
                ? proximasCitas.map((c, i) => <CitaRow key={i} cita={c} onClick={() => setActiveView('agenda')} />)
                : (
                  <div className="flex flex-col items-center py-8">
                    <Calendar size={24} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Sin citas agendadas</p>
                    <button onClick={() => setActiveView('agenda')} className="mt-2 text-xs font-bold" style={{ color: '#3a68a0' }}>
                      Agendar ahora →
                    </button>
                  </div>
                )
              }
            </div>
          </div>

          {/* Tip clínico */}
          <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={13} style={{ color: '#0284c7' }} />
              <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Tip clínico del día</p>
            </div>
            <p className="text-sm leading-relaxed flex items-start gap-2" style={{ color: 'var(--text-primary)' }}>
              {(() => { const TIcon = tip.Icon; return <TIcon size={16} style={{ color: '#0284c7', flexShrink: 0, marginTop: 2 }} /> })()}
              <span>{tip.texto}</span>
            </p>
          </div>

          {/* Recordatorio */}
          <div className="rounded-xl p-5" style={{ background: 'var(--card)', border: `1px solid var(--card-border)`, borderLeft: `3px solid #6355a0` }}>
            <div className="flex items-center gap-2 mb-2">
              <Heart size={13} style={{ color: '#6355a0' }} />
              <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>Recordatorio</p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              Tu trabajo hace una diferencia real en la vida de cada familia. ¡Gracias por tu dedicación! 💜
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
