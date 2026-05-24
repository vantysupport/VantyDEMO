'use client'

import { useI18n } from '@/lib/i18n-context'
// app/admin/components/InteligenciaHubView.tsx
// 🧠 Hub de Inteligencia Artificial — Predicciones + Seguridad + Engagement Padres

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts'
import {
  Brain, Shield, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, RefreshCw, Users, Target,
  Lock, Eye, BarChart3, Zap, ArrowUp, ArrowDown,
  ChevronRight, ChevronLeft, Activity, Sparkles, Clock, Star, Heart,
  MessageCircle, BookOpen, Award, UserCheck
} from 'lucide-react'

type Tab = 'predicciones' | 'seguridad' | 'patrones' | 'objetivos' | 'reportes' | 'sugerencias'

interface Paciente { id: string; name: string; nombre?: string; diagnosis: string }

interface Prediccion {
  prediccion_30d: number
  prediccion_90d: number
  confianza: number
  tendencia: 'positiva' | 'negativa' | 'estable'
  areas_riesgo: string[]
  areas_fortaleza: string[]
  analisis_ia: string | null
  ultimo_logro: number
  sesiones_analizadas: number
  data_points: { sesion: number; logro: number }[]
}
interface Benchmark {
  scoreGlobal: number
  nivelCompetitivo: string
  centralReachScore: number
  ventaja: number
  metricas: Record<string, { valor: number; score: number; benchmark: { label: string; optimo: number; bueno: number } }>
  analisisEstrategico: string | null
  totalPacientes: number
  totalSesiones: number
}
interface Seguridad {
  scoreSeguridad: number
  totalAccesos: number
  alertasActivas: number
  alertasCriticas: number
  exportacionesTotal: number
  accesosPorRol: Record<string, number>
  actividadHoras: number[]
  estado: 'seguro' | 'alerta' | 'critico'
}

// ─── Helpers visuales ────────────────────────────────────────────────────────
function ScoreRing({ score, size = 80, color }: { score: number; size?: number; color: string }) {
  const { t } = useI18n()

  const r = size / 2 - 8
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size * 0.22} fontWeight="bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-400 border-red-500/30',
    yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  }
  return (
    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${colors[color] || colors.blue}`}>
      {label}
    </span>
  )
}

// ─── Mini Barra de Progreso ──────────────────────────────────────────────────
function ProgressBar({ value, max = 100, color = 'blue' }: { value: number; max?: number; color?: string }) {

  const pct = Math.min(100, (value / max) * 100)
  const colors: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', red: 'bg-red-500',
    yellow: 'bg-amber-500', purple: 'bg-purple-500', gray: 'bg-slate-400'
  }
  return (
    <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
      <div className={`h-full rounded-full transition-all duration-700 ${colors[color] || colors.blue}`}
        style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Sparkline con Recharts ──────────────────────────────────────────────────
function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  const { t } = useI18n()
  if (!data || data.length < 2) return <span className="text-xs text-slate-400">{t('common.sinDatos')}</span>
  const pts = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width={100} height={36}>
      <LineChart data={pts} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
        <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 2" strokeWidth={1} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ─── Gráfico de líneas de progreso ABA (para analytics) ──────────────────────
function LineChartProgreso({ sesiones, criterio = 90, color = '#7c3aed', titulo = '' }: {

  sesiones: { fecha: string; porcentaje_exito: number; fase?: string }[]
  criterio?: number
  color?: string
  titulo?: string
}) {
  const { t } = useI18n()
  if (!sesiones || sesiones.length < 2) return (
    <div className="flex items-center justify-center h-24 rounded-xl border" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('ui.few_sessions')}</p>
    </div>
  )

  const data = sesiones.map((s, i) => ({
    n: i + 1,
    pct: s.porcentaje_exito,
    fecha: s.fecha?.slice(5) || '',
  }))

  return (
    <div className="w-full">
      {titulo && <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>{titulo}</p>}
      <ResponsiveContainer width="100%" height={130}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 18, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
          <XAxis dataKey="n" tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
            ticks={Array.from({length: Math.ceil(data.length / 10) + 1}, (_, i) => (i + 1) * 10).filter((t: number) => t <= data.length + 10).concat([1]).sort((a: number, b: number) => a - b)}
            interval={0}
            label={{ value: 'Sesión', position: 'insideBottom', offset: -6, fontSize: 9, fill: 'var(--text-muted)' }}
          />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 90, 100]} tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={(v: any) => `${v}%`} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 11 }}
            formatter={(v: any) => [`${v}%`, 'Logro']}
          />
          <ReferenceLine y={criterio} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1.5} />
          <Area type="monotone" dataKey="pct" fill={`${color}18`} stroke="none" />
          <Line type="monotone" dataKey="pct" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRAMA CARD — colapsable
// ═══════════════════════════════════════════════════════════════════════════════
function ProgramaCard({ prog, t }: { prog: any; t: any }) {
  const [open, setOpen] = useState(true)
  const badge = prog.criterio_logrado
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    : prog.ultimo_porcentaje >= prog.criterio_dominio
    ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 border-b flex items-center justify-between text-left transition-opacity hover:opacity-80"
        style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
        <div className="min-w-0 flex-1">
          <p className="font-black text-sm truncate" style={{ color: 'var(--text-primary)' }}>{prog.nombre || prog.titulo || 'Sin nombre'}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{prog.objetivo || prog.objetivo_lp || prog.descripcion || prog.area || ''}</p>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${badge}`}>{prog.estado_general}</span>
          <span className="text-[10px] font-black" style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {prog.total_sesiones > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Última sesión', value: `${prog.ultimo_porcentaje}%`, highlight: prog.ultimo_porcentaje >= prog.criterio_dominio, color: null },
                  { label: 'Media', value: `${prog.media}%`, highlight: false, color: null },
                  {
                    label: 'Tendencia',
                    value: prog.tendencia_slope > 0 ? '▲ Creciente' : prog.tendencia_slope < 0 ? '▼ Decreciente' : '● Nula',
                    highlight: false,
                    color: prog.tendencia_slope > 0 ? '#34d399' : prog.tendencia_slope < 0 ? '#f87171' : '#94a3b8',
                  },
                ].map(m => (
                  <div key={m.label} className="rounded-xl p-2.5 text-center border" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                    <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                    <p className={`text-lg font-black ${m.highlight ? 'text-emerald-400' : ''}`}
                      style={m.color ? { color: m.color, fontSize: m.label === 'Tendencia' ? '11px' : undefined } : !m.highlight ? { color: 'var(--text-primary)' } : {}}>
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>

              {prog.sets?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>SETS</p>
                  {prog.sets.map((set: any) => (
                    <div key={set.nombre} className="flex items-center justify-between rounded-lg px-3 py-2 border" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${set.criterio_logrado ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{set.nombre}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>media {set.media}%</span>
                        <span className={`text-xs font-black ${set.criterio_logrado ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {set.criterio_logrado ? '✅ Logrado' : `${set.ultimo_pct}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Tendencia: <span className={`font-bold ${prog.tendencia_slope > 0 ? 'text-emerald-400' : prog.tendencia_slope < 0 ? 'text-red-400' : ''}`}>
                  {prog.tendencia_descripcion}
                </span>
                {' · '}{prog.total_sesiones} sesiones
              </p>
            </>
          ) : (
            <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>Sin sesiones registradas</p>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PREDICCIONES
// ═══════════════════════════════════════════════════════════════════════════════
function TabPredicciones({ pacientes }: { pacientes: Paciente[] }) {
    const { t } = useI18n()

    const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null)
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null)
  const [loading, setLoading] = useState(false)
  const [showMobileDetail, setShowMobileDetail] = useState(false)

  const generarPrediccion = async (p: Paciente) => {
    setSelectedPaciente(p)
    setLoading(true)
    setPrediccion(null)
    setShowMobileDetail(true)
    try {
      const res = await fetch('/api/agente-prediccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: p.id, childName: p.name, semanas: 12 })
      })
      const data = await res.json()
      setPrediccion(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const tendenciaIcon = prediccion?.tendencia === 'positiva' ? <TrendingUp size={16} className="text-emerald-500" />
    : prediccion?.tendencia === 'negativa' ? <TrendingDown size={16} className="text-red-500" />
    : <Minus size={16} className="text-slate-400" />

  const tendenciaColor = prediccion?.tendencia === 'positiva' ? 'green'
    : prediccion?.tendencia === 'negativa' ? 'red' : 'blue'

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ border: '1px solid var(--card-border)', background: 'var(--card)' }}>

      {/* ── MÓVIL: Vista detalle (aparece encima de la lista) ── */}
      {showMobileDetail && (
        <div className="lg:hidden flex flex-col" style={{ minHeight: 'calc(100vh - 260px)' }}>
          {/* Barra superior con botón volver */}
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
            <button
              onClick={() => { setShowMobileDetail(false); setSelectedPaciente(null); setPrediccion(null) }}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-500 active:text-blue-700 transition-colors"
            >
              <ChevronLeft size={16} /> Pacientes
            </button>
            {selectedPaciente && (
              <span className="text-xs font-bold truncate ml-1" style={{ color: 'var(--text-primary)' }}>
                · {selectedPaciente.name}
              </span>
            )}
          </div>
          {/* Panel resultados móvil */}
          <div className="flex-1 overflow-y-auto">
            
        {!selectedPaciente && !loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <Brain size={48} className="text-slate-300 mb-4" style={{ opacity: 0.4 }} />
            <p className="font-black text-base" style={{ color: 'var(--text-muted)' }}>Selecciona un paciente</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>La IA analizará sus últimas 12 semanas</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('hub.analizandoPatrones')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('ui.calculating')}</p>
          </div>
        )}

        {prediccion && !loading && selectedPaciente && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Header paciente */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 md:p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">{t('hub.analisPorPrograma')}</p>
                  <h3 className="text-lg md:text-xl font-black truncate">{selectedPaciente.name}</h3>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {(prediccion as any).programas_analizados || 0} programas · {(prediccion as any).total_sesiones_unificado ?? (prediccion as any).analisis_por_programa?.reduce((a: number, p: any) => a + p.total_sesiones, 0) ?? 0} sesiones totales
                  </p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-2 text-center flex-shrink-0">
                  <p className="text-white/70 text-[10px] uppercase tracking-wide">{t('ui.criteria')}</p>
                  <p className="text-white font-black text-sm">≥90% × 2</p>
                  <p className="text-white/70 text-[10px]">sesiones consecutivas</p>
                </div>
              </div>
            </div>

            {/* Sin programas */}
            {((prediccion as any).programas_analizados === 0) && (
              <div className="rounded-xl p-6 text-center border-2 border-dashed" style={{ borderColor: "var(--card-border)", background: "var(--muted-bg)" }}>
                <p className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>Sin programas ABA con datos</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{(prediccion as any).mensaje || 'Crea programas ABA en la ficha del paciente y registra al menos una sesión para generar análisis.'}</p>
              </div>
            )}

            {/* Por programa — colapsables */}
            {((prediccion as any).analisis_por_programa || []).map((prog: any) => (
              <ProgramaCard key={prog.programa_id} prog={prog} t={t} />
            ))}

            {/* Análisis IA general */}
            {(prediccion as any).resumen_general && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", borderColor: "var(--card-border)" }}>
                  <Sparkles size={14} className="text-violet-300" />
                  <p className="text-xs font-black uppercase tracking-wider text-violet-200">Análisis Clínico IA — Analista Conductual ABA</p>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300 font-bold border border-violet-500/30">IA</span>
                </div>
                <div className="p-4 md:p-5 space-y-4">
                  {(prediccion as any).resumen_general
                    .split(/\n\n+/)
                    .filter((block: string) => block.trim())
                    .map((block: string, i: number) => {
                      const isHeader = /^\*\*[^*]+\*\*$/.test(block.trim())
                      if (isHeader) {
                        const label = block.trim().replace(/\*\*/g, '')
                        const colors: Record<string, string> = {
                          'EVALUACIÓN DEL ESTADO CLÍNICO ACTUAL': '10B981',
                          'ANÁLISIS POR PROGRAMA DE INTERVENCIÓN': '3B82F6',
                          'HIPÓTESIS CLÍNICA Y VARIABLES EN JUEGO': 'F59E0B',
                          'INDICACIONES TERAPÉUTICAS PRIORITARIAS': 'EF4444',
                          'CRITERIOS DE AVANCE Y MONITOREO': '8B5CF6',
                          'ESTADO GENERAL': '10B981',
                          'POR PROGRAMA': '3B82F6',
                          'PRIORIDADES': 'F59E0B',
                          'PRÓXIMOS PASOS CLÍNICOS': '8B5CF6',
                        }
                        const color = Object.entries(colors).find(([k]) => label.includes(k))?.[1] || '64748B'
                        return (
                          <div key={i} className="flex items-center gap-2 pt-2">
                            <div className="h-0.5 w-3 rounded-full" style={{ background: `#${color}` }}/>
                            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: `#${color}` }}>{label}</p>
                            <div className="flex-1 h-px" style={{ background: `#${color}30` }}/>
                          </div>
                        )
                      }
                      const isNumbered = /^\d+\.\s/.test(block.trim())
                      if (isNumbered) {
                        const lines = block.trim().split('\n').filter(Boolean)
                        return (
                          <div key={i} className="space-y-2">
                            {lines.map((line: string, j: number) => {
                              const num = line.match(/^(\d+)\.\s/)
                              const text = line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '$1')
                              const [title, ...rest] = text.split(':')
                              return (
                                <div key={j} className="flex gap-3 items-start">
                                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                                    style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                                    {num?.[1]}
                                  </span>
                                  <div>
                                    {rest.length > 0 ? (
                                      <>
                                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}:</span>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}> {rest.join(':')}</span>
                                      </>
                                    ) : (
                                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{text}</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                      const parts = block.trim().split(/\*\*(.*?)\*\*/g)
                      return (
                        <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {parts.map((part: string, j: number) =>
                            j % 2 === 1
                              ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part}</strong>
                              : part
                          )}
                        </p>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

          </div>
        </div>
      )}

      {/* ── MÓVIL: Lista de pacientes (se oculta cuando hay detalle) ── */}
      {!showMobileDetail && (
        <div className="lg:hidden flex flex-col">
          <div className="px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
            <h3 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Users size={15} className="text-blue-500" /> {t('ui.generarPrediccion2')}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('hub.iaAnalizara')}</p>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            
          {pacientes.length === 0 && (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>{t('ui.no_patients')}</p>
          )}
          {pacientes.map(p => (
            <button key={p.id} onClick={() => generarPrediccion(p)}
              className="w-full text-left px-3.5 py-3 transition-colors flex items-center gap-3 border-b"
              style={{
                borderColor: 'var(--card-border)',
                borderLeft: selectedPaciente?.id === p.id ? '3px solid #3b82f6' : '3px solid transparent',
                background: selectedPaciente?.id === p.id ? 'rgba(37,99,235,0.12)' : 'transparent',
              }}
              onMouseEnter={e => { if (selectedPaciente?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'var(--card)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selectedPaciente?.id === p.id ? 'rgba(37,99,235,0.12)' : 'transparent' }}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-xs">{(p.name || p.nombre || '?').charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{p.diagnosis || 'Sin diagnóstico'}</p>
              </div>
              {selectedPaciente?.id === p.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 hidden lg:block" />
              )}
              <ChevronRight size={14} className="text-slate-400 lg:hidden flex-shrink-0" />
            </button>
          ))}

          </div>
        </div>
      )}

      {/* ── DESKTOP: Layout lado a lado ── */}
      <div className="hidden lg:flex h-full min-h-0 gap-0" style={{ minHeight: 'calc(100vh - 260px)' }}>

        {/* Lista de pacientes — panel fijo izquierdo */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
          <div className="px-4 py-3.5 border-b flex-shrink-0" style={{ borderColor: 'var(--card-border)' }}>
            <h3 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Users size={15} className="text-blue-500" /> {t('ui.generarPrediccion2')}
            </h3>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('hub.iaAnalizara')}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            
          {pacientes.length === 0 && (
            <p className="p-4 text-sm text-center" style={{ color: 'var(--text-muted)' }}>{t('ui.no_patients')}</p>
          )}
          {pacientes.map(p => (
            <button key={p.id} onClick={() => generarPrediccion(p)}
              className="w-full text-left px-3.5 py-3 transition-colors flex items-center gap-3 border-b"
              style={{
                borderColor: 'var(--card-border)',
                borderLeft: selectedPaciente?.id === p.id ? '3px solid #3b82f6' : '3px solid transparent',
                background: selectedPaciente?.id === p.id ? 'rgba(37,99,235,0.12)' : 'transparent',
              }}
              onMouseEnter={e => { if (selectedPaciente?.id !== p.id) (e.currentTarget as HTMLElement).style.background = 'var(--card)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selectedPaciente?.id === p.id ? 'rgba(37,99,235,0.12)' : 'transparent' }}
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-xs">{(p.name || p.nombre || '?').charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{p.diagnosis || 'Sin diagnóstico'}</p>
              </div>
              {selectedPaciente?.id === p.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 hidden lg:block" />
              )}
              <ChevronRight size={14} className="text-slate-400 lg:hidden flex-shrink-0" />
            </button>
          ))}

          </div>
        </div>

        {/* Panel de predicciones — scrollable derecho */}
        <div className="flex-1 overflow-y-auto min-h-0">
          
        {!selectedPaciente && !loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <Brain size={48} className="text-slate-300 mb-4" style={{ opacity: 0.4 }} />
            <p className="font-black text-base" style={{ color: 'var(--text-muted)' }}>Selecciona un paciente</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>La IA analizará sus últimas 12 semanas</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center" style={{ minHeight: '200px' }}>
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{t('hub.analizandoPatrones')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('ui.calculating')}</p>
          </div>
        )}

        {prediccion && !loading && selectedPaciente && (
          <div className="p-4 md:p-5 space-y-4">
            {/* Header paciente */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 md:p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">{t('hub.analisPorPrograma')}</p>
                  <h3 className="text-lg md:text-xl font-black truncate">{selectedPaciente.name}</h3>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {(prediccion as any).programas_analizados || 0} programas · {(prediccion as any).total_sesiones_unificado ?? (prediccion as any).analisis_por_programa?.reduce((a: number, p: any) => a + p.total_sesiones, 0) ?? 0} sesiones totales
                  </p>
                </div>
                <div className="bg-white/15 rounded-xl px-3 py-2 text-center flex-shrink-0">
                  <p className="text-white/70 text-[10px] uppercase tracking-wide">{t('ui.criteria')}</p>
                  <p className="text-white font-black text-sm">≥90% × 2</p>
                  <p className="text-white/70 text-[10px]">sesiones consecutivas</p>
                </div>
              </div>
            </div>

            {/* Sin programas */}
            {((prediccion as any).programas_analizados === 0) && (
              <div className="rounded-xl p-6 text-center border-2 border-dashed" style={{ borderColor: "var(--card-border)", background: "var(--muted-bg)" }}>
                <p className="font-bold text-sm mb-1" style={{ color: "var(--text-primary)" }}>Sin programas ABA con datos</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{(prediccion as any).mensaje || 'Crea programas ABA en la ficha del paciente y registra al menos una sesión para generar análisis.'}</p>
              </div>
            )}

            {/* Por programa — colapsables */}
            {((prediccion as any).analisis_por_programa || []).map((prog: any) => (
              <ProgramaCard key={prog.programa_id} prog={prog} t={t} />
            ))}

            {/* Análisis IA general */}
            {(prediccion as any).resumen_general && (
              <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="px-5 py-3 border-b flex items-center gap-2" style={{ background: "linear-gradient(135deg, #1e1b4b, #312e81)", borderColor: "var(--card-border)" }}>
                  <Sparkles size={14} className="text-violet-300" />
                  <p className="text-xs font-black uppercase tracking-wider text-violet-200">Análisis Clínico IA — Analista Conductual ABA</p>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-300 font-bold border border-violet-500/30">IA</span>
                </div>
                <div className="p-4 md:p-5 space-y-4">
                  {(prediccion as any).resumen_general
                    .split(/\n\n+/)
                    .filter((block: string) => block.trim())
                    .map((block: string, i: number) => {
                      const isHeader = /^\*\*[^*]+\*\*$/.test(block.trim())
                      if (isHeader) {
                        const label = block.trim().replace(/\*\*/g, '')
                        const colors: Record<string, string> = {
                          'EVALUACIÓN DEL ESTADO CLÍNICO ACTUAL': '10B981',
                          'ANÁLISIS POR PROGRAMA DE INTERVENCIÓN': '3B82F6',
                          'HIPÓTESIS CLÍNICA Y VARIABLES EN JUEGO': 'F59E0B',
                          'INDICACIONES TERAPÉUTICAS PRIORITARIAS': 'EF4444',
                          'CRITERIOS DE AVANCE Y MONITOREO': '8B5CF6',
                          'ESTADO GENERAL': '10B981',
                          'POR PROGRAMA': '3B82F6',
                          'PRIORIDADES': 'F59E0B',
                          'PRÓXIMOS PASOS CLÍNICOS': '8B5CF6',
                        }
                        const color = Object.entries(colors).find(([k]) => label.includes(k))?.[1] || '64748B'
                        return (
                          <div key={i} className="flex items-center gap-2 pt-2">
                            <div className="h-0.5 w-3 rounded-full" style={{ background: `#${color}` }}/>
                            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: `#${color}` }}>{label}</p>
                            <div className="flex-1 h-px" style={{ background: `#${color}30` }}/>
                          </div>
                        )
                      }
                      const isNumbered = /^\d+\.\s/.test(block.trim())
                      if (isNumbered) {
                        const lines = block.trim().split('\n').filter(Boolean)
                        return (
                          <div key={i} className="space-y-2">
                            {lines.map((line: string, j: number) => {
                              const num = line.match(/^(\d+)\.\s/)
                              const text = line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '$1')
                              const [title, ...rest] = text.split(':')
                              return (
                                <div key={j} className="flex gap-3 items-start">
                                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                                    style={{ background: 'rgba(139,92,246,0.15)', color: '#8B5CF6' }}>
                                    {num?.[1]}
                                  </span>
                                  <div>
                                    {rest.length > 0 ? (
                                      <>
                                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}:</span>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}> {rest.join(':')}</span>
                                      </>
                                    ) : (
                                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{text}</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      }
                      const parts = block.trim().split(/\*\*(.*?)\*\*/g)
                      return (
                        <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {parts.map((part: string, j: number) =>
                            j % 2 === 1
                              ? <strong key={j} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part}</strong>
                              : part
                          )}
                        </p>
                      )
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════════
function TabSeguridad() {
  const [datos, setDatos] = useState<Seguridad | null>(null)
  const [alertas, setAlertas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [res1, res2] = await Promise.all([
        fetch('/api/agente-guardian?tipo=resumen&dias=7'),
        fetch('/api/agente-guardian?tipo=alertas&dias=30')
      ])
      const d1 = await res1.json()
      const d2 = await res2.json()
      setDatos(d1)
      setAlertas(d2.alertas || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const estadoColor = datos?.estado === 'seguro' ? 'emerald' : datos?.estado === 'alerta' ? 'amber' : 'red'
  const scoreColor = (datos?.scoreSeguridad || 0) >= 80 ? '#10b981' : (datos?.scoreSeguridad || 0) >= 60 ? '#f59e0b' : '#ef4444'

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Score header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1  rounded-2xl border border-slate-200 p-5 flex flex-col items-center justify-center" style={{ background: "var(--card)" }}>
          <div className="relative">
            <ScoreRing score={datos?.scoreSeguridad || 0} size={100} color={scoreColor} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-black" style={{ color: scoreColor }}>{datos?.scoreSeguridad}</span>
            </div>
          </div>
          <p className="text-xs font-black text-slate-500 uppercase mt-2">Score Seguridad</p>
          <Badge label={datos?.estado || 'desconocido'} color={estadoColor} />
        </div>

        {[
          { icon: Eye, label: 'Accesos (7d)', value: datos?.totalAccesos || 0, color: 'blue' },
          { icon: AlertTriangle, label: 'Alertas activas', value: datos?.alertasActivas || 0, color: (datos?.alertasActivas || 0) > 0 ? 'red' : 'green' },
          { icon: Shield, label: 'Exportaciones', value: datos?.exportacionesTotal || 0, color: 'purple' },
        ].map(m => (
          <div key={m.label} className=" rounded-2xl border border-slate-200 p-5 flex flex-col justify-between" style={{ background: "var(--card)" }}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
              m.color === 'blue' ? 'bg-blue-50' : m.color === 'red' ? 'bg-red-50' : m.color === 'green' ? 'bg-emerald-50' : 'bg-purple-50'
            }`}>
              <m.icon size={18} className={
                m.color === 'blue' ? 'text-blue-600' : m.color === 'red' ? 'text-red-600' : m.color === 'green' ? 'text-emerald-600' : 'text-purple-600'
              } />
            </div>
            <p className={`text-3xl font-black ${
              m.color === 'blue' ? 'text-blue-700' : m.color === 'red' ? 'text-red-600' : m.color === 'green' ? 'text-emerald-600' : 'text-purple-700'
            }`}>{m.value}</p>
            <p className="text-xs text-slate-400 font-medium mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Accesos por rol */}
      {datos?.accesosPorRol && Object.keys(datos.accesosPorRol).length > 0 && (
        <div className=" rounded-2xl border border-slate-200 p-5" style={{ background: "var(--card)" }}>
          <h4 className="font-black text-slate-700 text-sm mb-4 flex items-center gap-2">
            <Users size={14} className="text-blue-500" /> Accesos por Rol (últimos 7 días)
          </h4>
          <div className="space-y-3">
            {Object.entries(datos.accesosPorRol).map(([rol, count]) => {
              const total = Object.values(datos.accesosPorRol).reduce((a: number, b: unknown) => a + (b as number), 0)
              const pct = Math.round(((count as number) / total) * 100)
              return (
                <div key={rol}>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-slate-600 capitalize">{rol}</span>
                    <span className="text-slate-400">{count} accesos ({pct}%)</span>
                  </div>
                  <ProgressBar value={pct} color="blue" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alertas activas */}
      <div className=" rounded-2xl border border-slate-200 overflow-hidden" style={{ background: "var(--card)" }}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-black text-slate-700 text-sm flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500" /> Alertas de Seguridad
          </h4>
          <button onClick={cargar} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
            <RefreshCw size={11} /> Actualizar
          </button>
        </div>
        {alertas.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-500 font-medium text-sm">✅ Sin alertas activas. Sistema seguro.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {alertas.map((a, i) => (
              <div key={i} className={`p-4 flex gap-3 ${a.nivel === 'critico' ? 'bg-red-50' : 'bg-amber-50/30'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.nivel === 'critico' ? 'bg-red-100' : 'bg-amber-100'}`}>
                  <AlertTriangle size={14} className={a.nivel === 'critico' ? 'text-red-600' : 'text-amber-600'} />
                </div>
                <div>
                  <p className="font-black text-sm text-slate-800" style={{ color: "var(--text-primary)" }}>{a.tipo?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{a.descripcion}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{new Date(a.timestamp).toLocaleString('es')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: COMPETITIVIDAD
// ═══════════════════════════════════════════════════════════════════════════════
function TabCompetitividad() {
  const { t } = useI18n()

  const [datos, setDatos] = useState<Benchmark | null>(null)
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(30)

  const cargar = useCallback(async (d = dias) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/benchmark?dias=${d}`)
      setDatos(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [dias])

  useEffect(() => { cargar() }, [cargar])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
    </div>
  )

  if (!datos) return null

  const scoreColor = datos.scoreGlobal >= 80 ? '#10b981' : datos.scoreGlobal >= 65 ? '#3b82f6' : datos.scoreGlobal >= 50 ? '#f59e0b' : '#ef4444'
  const ventajaPositiva = datos.ventaja > 0

  return (
    <div className="space-y-5">
      {/* Header competitivo */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-purple-200 text-xs font-black uppercase tracking-wider mb-1">Score Competitivo</p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black">{datos.scoreGlobal}</span>
              <span className="text-purple-300 text-lg mb-1">/100</span>
            </div>
            <p className="text-purple-100 font-bold mt-1">{datos.nivelCompetitivo}</p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-black text-sm mb-2 ${ventajaPositiva ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
              {ventajaPositiva ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              {Math.abs(datos.ventaja)} pts vs Central Reach
            </div>
            <p className="text-purple-300 text-xs">Central Reach: {datos.centralReachScore}/100</p>
            <p className="text-purple-400 text-xs mt-1">{datos.totalPacientes} pacientes · {datos.totalSesiones} sesiones</p>
          </div>
        </div>

        {/* Mini comparativa visual */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-purple-200 w-28">Neuropsicología y Terapias SANTI</span>
            <div className="flex-1 bg-white/20 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${datos.scoreGlobal}%` }} />
            </div>
            <span className="text-white font-black w-8">{datos.scoreGlobal}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-purple-300 w-28">Central Reach</span>
            <div className="flex-1 bg-white/20 rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full bg-purple-300 transition-all duration-700" style={{ width: `${datos.centralReachScore}%` }} />
            </div>
            <span className="text-purple-300 font-black w-8">{datos.centralReachScore}</span>
          </div>
        </div>
      </div>

      {/* Métricas detalladas */}
      <div className=" rounded-2xl border border-slate-200 overflow-hidden" style={{ background: "var(--card)" }}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-black text-slate-700 text-sm flex items-center gap-2">
            <BarChart3 size={14} className="text-purple-500" /> Métricas vs Estándares de Industria
          </h4>
          <div className="flex gap-1.5">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => { setDias(d); cargar(d) }}
                className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition-colors ${dias === d ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {Object.entries(datos.metricas).map(([key, m]: [string, any]) => {
            const score = Math.round(m.score)
            const scoreColor = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red'
            return (
              <div key={key} className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-bold text-slate-700 truncate">{m.benchmark.label}</p>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      <span className="text-sm font-black text-slate-800" style={{ color: "var(--text-primary)" }}>{m.valor}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        scoreColor === 'green' ? 'bg-emerald-100 text-emerald-700' :
                        scoreColor === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>{score}%</span>
                    </div>
                  </div>
                  <ProgressBar value={score} color={scoreColor === 'green' ? 'green' : scoreColor === 'yellow' ? 'yellow' : 'red'} />
                  <p className="text-[10px] text-slate-400 mt-1">Óptimo: {m.benchmark.optimo} · Bueno: {m.benchmark.bueno}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Análisis estratégico IA */}
      {datos.analisisEstrategico && (
        <div className=" rounded-2xl border border-slate-200 p-5" style={{ background: "var(--card)" }}>
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sparkles size={12} className="text-purple-500" /> ANÁLISIS ESTRATÉGICO IA
          </p>
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {datos.analisisEstrategico}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: PATRONES ABA (CAPA 1) — Rediseño neuropsicológico profesional
// ═══════════════════════════════════════════════════════════════════════════════
// accent = color principal, usado en borde izq, número, badge
// bg/border son suficientemente ligeros para light mode
const PATRON_CONFIG: Record<string, {
  label: string; icon: string; accent: string; lightBg: string; lightBorder: string; lightText: string; darkBg: string; darkBorder: string; darkText: string
}> = {
  regresion:     { label: 'Regresión Conductual',   icon: '↘', accent: '#c0524a', lightBg: '#fdf3f3', lightBorder: '#f0b8b5', lightText: '#9a3030', darkBg: 'rgba(192,82,74,0.12)',   darkBorder: 'rgba(192,82,74,0.3)',   darkText: '#e8a0a0' },
  estancamiento: { label: 'Estancamiento de Aprendizaje', icon: '→', accent: '#b07830', lightBg: '#fdf8ee', lightBorder: '#e8cc90', lightText: '#7a5010', darkBg: 'rgba(176,120,48,0.12)',  darkBorder: 'rgba(176,120,48,0.3)',  darkText: '#d9b87a' },
  aceleracion:   { label: 'Aceleración del Logro',  icon: '↗', accent: '#2e7a56', lightBg: '#f3faf6', lightBorder: '#a0d4b8', lightText: '#1a5c38', darkBg: 'rgba(46,122,86,0.12)',   darkBorder: 'rgba(46,122,86,0.3)',   darkText: '#7ec4a4' },
  inconsistencia:{ label: 'Variabilidad Alta',      icon: '⟺', accent: '#6355a0', lightBg: '#f7f5fc', lightBorder: '#c0b8e0', lightText: '#42357a', darkBg: 'rgba(99,85,160,0.12)',   darkBorder: 'rgba(99,85,160,0.3)',   darkText: '#c4b8e8' },
  dominio:       { label: 'Criterio de Dominio',    icon: '★', accent: '#3a68a0', lightBg: '#f3f7fc', lightBorder: '#a8c4e0', lightText: '#1e4878', darkBg: 'rgba(58,104,160,0.12)',  darkBorder: 'rgba(58,104,160,0.3)',  darkText: '#90b8d8' },
}

function PatronCard({ p, index }: { p: any; index: number; key?: any }) {
  const cfg = PATRON_CONFIG[p.tipo] || PATRON_CONFIG.estancamiento
  const delta = p.valor_actual - p.valor_anterior
  // Detect dark mode via CSS variable (--card is dark in dark mode)
  return (
    <div className="rounded-xl border transition-all overflow-hidden">
      {/* Accent bar top */}
      <div className="h-0.5" style={{ background: cfg.accent }} />
      <div className="p-5" style={{ background: 'var(--card)', borderTop: 'none' }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg font-black flex-shrink-0"
              style={{ background: `${cfg.accent}15`, color: cfg.accent, border: `1px solid ${cfg.accent}30` }}>
              {cfg.icon}
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ background: `${cfg.accent}12`, color: cfg.accent, border: `1px solid ${cfg.accent}30` }}>
                {cfg.label}
              </span>
              <p className="font-bold text-sm mt-1.5 leading-tight" style={{ color: 'var(--text-primary)' }}>{p.area}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Confianza</p>
            <div className="flex items-center gap-1.5 justify-end">
              <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                <div className="h-full rounded-full" style={{ width: `${p.confianza}%`, background: cfg.accent }} />
              </div>
              <span className="text-sm font-black" style={{ color: cfg.accent }}>{p.confianza}%</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Valor anterior', val: `${p.valor_anterior}%`, hi: false },
            { label: 'Valor actual',   val: `${p.valor_actual}%`,   hi: true  },
            { label: 'Δ Cambio',       val: `${delta >= 0 ? '+' : ''}${delta}%`, hi: false },
          ].map(m => (
            <div key={m.label} className="rounded-lg p-3 text-center"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
              <p className="text-base font-black" style={{ color: m.hi ? cfg.accent : 'var(--text-primary)' }}>{m.val}</p>
            </div>
          ))}
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{p.descripcion}</p>

        {/* Action */}
        <div className="rounded-lg px-4 py-3 flex items-start gap-2.5"
          style={{ background: `${cfg.accent}08`, border: `1px solid ${cfg.accent}25` }}>
          <span className="text-sm mt-0.5 flex-shrink-0" style={{ color: cfg.accent }}>💡</span>
          <p className="text-xs leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>{p.accion_sugerida}</p>
        </div>

        <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Basado en <strong style={{ color: 'var(--text-secondary)' }}>{p.sesiones_involucradas} sesiones</strong> · {p.semanas_detectado} sem. de monitoreo
        </p>
      </div>
    </div>
  )
}

function RenderMD({ text }: { text: string }) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

const SECTION_CFG = [
  { keys: ['INTERPRETACIÓN CLÍNICA', 'INTERPRETACIÓN'],      color: '#6355a0', icon: '🔬', bg: 'transparent' },
  { keys: ['HIPÓTESIS CLÍNICA', 'HIPÓTESIS'],                color: '#b07830', icon: '🧩', bg: 'transparent' },
  { keys: ['ANÁLISIS FUNCIONAL'],                            color: '#6355a0', icon: '📐', bg: 'transparent' },
  { keys: ['INDICACIONES TERAPÉUTICAS', 'INTERVENCIÓN'],     color: '#c0524a', icon: '🎯', bg: 'transparent' },
  { keys: ['PRONÓSTICO', 'CRITERIOS DE AVANCE'],             color: '#3a68a0', icon: '📈', bg: 'transparent' },
  { keys: ['SEÑAL POSITIVA', 'FORTALEZAS'],                  color: '#2e7a56', icon: '✦',  bg: 'transparent' },
] as const

function getSectionCfg(text: string) {
  const upper = text.toUpperCase()
  return SECTION_CFG.find(s => (s.keys as readonly string[]).some(k => upper.includes(k))) || null
}

function ResumenIACard({ texto }: { texto: string }) {
  const bloques = texto
    .split(/\n(?=\*\*[A-ZÁÉÍÓÚÑ])|\n\n+/)
    .map((b: string) => b?.trim())
    .filter(Boolean)

  type Section = { cfg: typeof SECTION_CFG[number] | null; label: string; paras: string[] }
  const sections: Section[] = []
  let current: Section = { cfg: null, label: '', paras: [] }

  bloques.forEach((bloque: string) => {
    const isHeader = /^\*\*[^*\n]{3,80}\*\*[:\s]*$/.test(bloque)
    if (isHeader) {
      if (current.paras.length > 0 || current.label) sections.push(current)
      const label = bloque.replace(/\*\*/g, '').replace(/:?\s*$/, '').trim()
      current = { cfg: getSectionCfg(label), label, paras: [] }
    } else {
      current.paras.push(bloque)
    }
  })
  if (current.paras.length > 0 || current.label) sections.push(current)

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #111827 0%, #1a1f35 60%, #1e1b3a 100%)', borderBottom: '1px solid rgba(100,100,160,0.25)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)' }}>
            <Brain size={16} className="text-violet-300" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest" style={{ color: '#d0d0e8' }}>Informe Neuropsicológico Clínico</p>
            <p className="text-[11px]" style={{ color: '#7a7a9a' }}>Análisis ABA · Supervisión Conductual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 rounded-full font-black border hidden sm:inline-block"
            style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', borderColor: 'var(--card-border)' }}>IA</span>
          <span className="text-[10px] px-2.5 py-1 rounded-full font-black border"
            style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', borderColor: 'var(--card-border)' }}>CONFIDENCIAL</span>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
        {sections.map((section, si) => {
          const c = section.cfg?.color || '#94a3b8'
          const bg = section.cfg?.bg || 'transparent'
          const icon = section.cfg?.icon || '▸'
          return (
            <div key={si} className="p-5 space-y-3" style={{ background: bg }}>
              {section.label && (
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-base leading-none" style={{ color: c }}>{icon}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: c }}>{section.label}</p>
                    <div className="flex-1 h-px" style={{ background: `${c}20` }} />
                  </div>
                </div>
              )}
              {section.paras.map((para: string, pi: number) => {
                if (/^\d+[\.)\s]/.test(para)) {
                  return (
                    <div key={pi} className="space-y-2">
                      {para.split('\n').filter(Boolean).map((line: string, li: number) => {
                        const m = line.match(/^(\d+)[.)]\s(.+)/)
                        if (!m) return <p key={li} className="text-sm leading-relaxed pl-8" style={{ color: 'var(--text-secondary)' }}><RenderMD text={line} /></p>
                        const [,num,txt] = m
                        const ci = txt.indexOf(':')
                        return (
                          <div key={li} className="flex gap-3 items-start">
                            <span className="w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ background: `${c}20`, color: c }}>{num}</span>
                            <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-secondary)' }}>
                              {ci > 0 && ci < 50
                                ? <><strong style={{ color: 'var(--text-primary)' }}>{txt.slice(0,ci)}:</strong><RenderMD text={txt.slice(ci+1)} /></>
                                : <RenderMD text={txt} />}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
                if (/^[▸•\-]\s/.test(para)) {
                  return (
                    <div key={pi} className="space-y-1.5">
                      {para.split('\n').filter(Boolean).map((line: string, li: number) => (
                        <div key={li} className="flex gap-2.5 items-start">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            <RenderMD text={line.replace(/^[▸•\-]\s/, '')} />
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                }
                return (
                  <p key={pi} className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-secondary)', paddingLeft: section.label ? '1.25rem' : '0', borderLeft: section.cfg ? `2px solid ${c}55` : 'none' }}>
                    <RenderMD text={para} />
                  </p>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="px-6 py-3 flex items-center justify-between"
        style={{ background: 'var(--muted-bg)', borderTop: '1px solid var(--card-border)' }}>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Generado por Analista Conductual IA · No reemplaza evaluación profesional certificada</p>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
      </div>
    </div>
  )
}


function TabPatrones({ pacientes }: { pacientes: Paciente[] }) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<Paciente | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const analizar = async () => {
    if (!selected) return
    setLoading(true); setError(''); setResultado(null)
    try {
      const res = await fetch('/api/agente-patrones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: selected.id, childName: selected.name }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResultado(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const urgentes = resultado?.patrones?.filter((p: any) => p.tipo === 'regresion' || p.tipo === 'estancamiento') || []
  const positivos = resultado?.patrones?.filter((p: any) => p.tipo === 'aceleracion' || p.tipo === 'dominio') || []
  const otros = resultado?.patrones?.filter((p: any) => p.tipo === 'inconsistencia') || []

  return (
    <div className="space-y-5">
      {/* Header informativo */}
      <div className="rounded-2xl p-5 border"
        style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <Activity size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Detector de Patrones ABA — CAPA 1</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Análisis de regresiones, plateaus, aceleraciones e inconsistencias conductuales</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
          {[
            { icon: '↘', label: 'Regresión',   color: '#c0524a' },
            { icon: '→', label: 'Estancamiento',      color: '#fbbf24' },
            { icon: '↗', label: 'Aceleración',  color: '#2e7a56' },
            { icon: '⟺', label: 'Variabilidad', color: '#6355a0' },
            { icon: '★', label: 'Dominio',      color: '#3a68a0' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="text-xs font-black" style={{ color: item.color }}>{item.icon}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selector + botón */}
      <div className="rounded-2xl p-5 border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            Selecciona Paciente
          </label>
          <select
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold outline-none border transition-all"
            style={{
              background: 'var(--input-bg)', borderColor: 'var(--input-border)',
              color: 'var(--text-primary)'
            }}
            value={selected?.id || ''} onChange={e => setSelected(pacientes.find(p => p.id === e.target.value) || null)}>
            <option value="">— Seleccionar paciente —</option>
            {pacientes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button onClick={analizar} disabled={!selected || loading}
          className="w-full py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2.5 transition-all"
          style={{
            background: !selected || loading ? 'var(--muted-bg)' : 'var(--text-primary)',
            color: 'var(--card)',
            boxShadow: 'none'
          }}>
          {loading
            ? <><RefreshCw size={15} className="animate-spin" /> Analizando historial clínico...</>
            : <><Activity size={15} /> Detectar Patrones</>}
        </button>
        {error && (
          <div className="rounded-xl px-4 py-3 text-xs font-medium"
            style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)', borderLeft: '3px solid #c0524a' }}>
            {error}
          </div>
        )}
      </div>

      {/* Resultados */}
      {resultado && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sesiones analizadas', val: resultado.sesiones_analizadas || 0, color: '#5e8fc0', icon: '📋' },
              { label: 'Patrones detectados', val: resultado.patrones?.length || 0,   color: '#7b6bbf', icon: '🔍' },
              { label: 'Requieren atención',  val: resultado.patrones_urgentes || 0,   color: resultado.patrones_urgentes > 0 ? '#c47070' : '#5a9e7a', icon: resultado.patrones_urgentes > 0 ? '⚠' : '✓' },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4 text-center border"
                style={{ background: `${m.color}12`, borderColor: `${m.color}25` }}>
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className="text-2xl font-black" style={{ color: m.color }}>{m.val}</p>
                <p className="text-[10px] mt-1 leading-tight" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
              </div>
            ))}
          </div>

          {/* Sin patrones */}
          {resultado.patrones?.length === 0 && (
            <div className="rounded-2xl p-8 text-center border"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
              <p className="text-3xl mb-3">✓</p>
              <p className="font-black text-sm mb-1" style={{ color: '#2e7a56' }}>Progreso Estable</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {resultado.resumen || `Sin patrones problemáticos en ${resultado.sesiones_analizadas} sesiones.`}
              </p>
            </div>
          )}

          {/* Patrones urgentes */}
          {urgentes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#c47070' }} />
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#c0524a' }}>
                  Requieren Atención Inmediata ({urgentes.length})
                </p>
              </div>
              {urgentes.map((p: any, i: number) => <PatronCard key={i} p={p} index={i} />)}
            </div>
          )}

          {/* Patrones positivos */}
          {positivos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#5a9e7a' }} />
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#2e7a56' }}>
                  Logros Clínicos ({positivos.length})
                </p>
              </div>
              {positivos.map((p: any, i: number) => <PatronCard key={i} p={p} index={i} />)}
            </div>
          )}

          {/* Otros */}
          {otros.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: '#7b6bbf' }} />
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#6355a0' }}>
                  Otras Observaciones ({otros.length})
                </p>
              </div>
              {otros.map((p: any, i: number) => <PatronCard key={i} p={p} index={i} />)}
            </div>
          )}

          {/* Informe Clínico IA */}
          {(resultado.analisis_ia || resultado.resumen) && resultado.patrones?.length > 0 && (
            <ResumenIACard texto={resultado.analisis_ia || resultado.resumen} />
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: OBJETIVOS ADAPTATIVOS (CAPA 1)
// ═══════════════════════════════════════════════════════════════════════════════
function TabObjetivos({ pacientes }: { pacientes: Paciente[] }) {
  const { t } = useI18n()

  const [selected, setSelected] = useState<Paciente | null>(null)
  const [resultado, setResultado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [accion, setAccion] = useState<'generar' | 'ajustar' | 'evaluar_dominio'>('generar')
  const [error, setError] = useState('')

  const ejecutar = async () => {
    if (!selected) return
    setLoading(true); setError(''); setResultado(null)
    try {
      const res = await fetch('/api/agente-objetivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: selected.id, childName: selected.name, accion }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResultado(json)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Target size={16} className="text-amber-600" />
          <span className="font-bold text-amber-800 text-sm">{t('hub.generadorObjetivos')}</span>
        </div>
        <p className="text-xs text-amber-600">Genera o ajusta objetivos terapéuticos ABA automáticamente según el progreso real del paciente.</p>
      </div>
      <div className=" rounded-2xl border border-slate-100 p-4 space-y-3" style={{ background: "var(--card)" }}>
        <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          value={selected?.id || ''} onChange={e => setSelected(pacientes.find(p => p.id === e.target.value) || null)}>
          <option value="">{t('hub.selecPaciente')}</option>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-2">
          {([['generar', 'Generar nuevos'], ['ajustar', 'Ajustar existentes'], ['evaluar_dominio', 'Evaluar dominio']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setAccion(val)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${accion === val ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
              {lbl}
            </button>
          ))}
        </div>
        <button onClick={ejecutar} disabled={!selected || loading}
          className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition">
          {loading ? <><RefreshCw size={14} className="animate-spin" /> {t('common.procesando')}</> : <><Target size={14} /> Ejecutar</>}
        </button>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
      {resultado && (
        <div className="space-y-3">
          {/* generar → resultado.resultado.objetivos_sugeridos */}
          {(resultado.resultado?.objetivos_sugeridos || []).map((obj: any, i: number) => (
            <div key={i} className=" rounded-xl border border-amber-100 p-4" style={{ background: "var(--card)" }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-bold text-sm text-slate-800" style={{ color: "var(--text-primary)" }}>{obj.titulo}</p>
                <div className="flex gap-1">
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">{obj.area}</span>
                  {obj.prioridad && <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${obj.prioridad === 'alta' ? 'bg-red-100 text-red-600' : obj.prioridad === 'media' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{obj.prioridad}</span>}
                </div>
              </div>
              <p className="text-xs text-slate-500">{obj.descripcion}</p>
              {obj.criterio_dominio && <p className="text-xs font-semibold text-slate-600 mt-1">✓ Meta: {obj.criterio_dominio}</p>}
              {obj.metodologia && <p className="text-xs text-slate-500 mt-1">Método: {obj.metodologia}</p>}
              {obj.justificacion_clinica && <p className="text-xs text-amber-700 mt-2 bg-amber-50 px-3 py-2 rounded-lg">{obj.justificacion_clinica}</p>}
            </div>
          ))}
          {/* ajustar → resultado.resultado.ajustes */}
          {(resultado.resultado?.ajustes || []).map((obj: any, i: number) => (
            <div key={i} className=" rounded-xl border border-orange-100 p-4" style={{ background: "var(--card)" }}>
              <p className="font-bold text-sm text-slate-800" style={{ color: "var(--text-primary)" }}>{obj.area}</p>
              <p className="text-xs text-slate-600 mt-1"><strong>{t('hub.queAjustar')}</strong> {obj.que_ajustar}</p>
              <p className="text-xs text-slate-600 mt-1"><strong>{t('hub.como')}</strong> {obj.como_ajustar}</p>
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 px-3 py-2 rounded-lg">Meta 4 semanas: {obj.meta_4_semanas}</p>
            </div>
          ))}
          {/* evaluar_dominio → resultado.resultado.evaluaciones */}
          {(resultado.resultado?.evaluaciones || []).map((obj: any, i: number) => (
            <div key={i} className=" rounded-xl border border-blue-100 p-4" style={{ background: "var(--card)" }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-bold text-sm text-slate-800" style={{ color: "var(--text-primary)" }}>{obj.programa}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${obj.estado === 'listo_para_avanzar' ? 'bg-green-100 text-green-700' : obj.estado === 'necesita_ajuste' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{obj.estado?.replace(/_/g,' ')}</span>
              </div>
              <p className="text-xs text-slate-600">Acción: {obj.accion}</p>
              <p className="text-xs text-slate-500 mt-1">{obj.justificacion}</p>
              {obj.siguiente_paso && <p className="text-xs text-blue-700 mt-2 bg-blue-50 px-3 py-2 rounded-lg">→ {obj.siguiente_paso}</p>}
            </div>
          ))}
          {/* texto_libre fallback */}
          {resultado.resultado?.texto_libre && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{resultado.resultado.texto_libre}</p>
            </div>
          )}
          <p className="text-xs text-slate-400">Programas analizados: {resultado.programas_analizados || 0} · Patrones considerados: {resultado.patrones_considerados || 0}</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: ALERTAS PROACTIVAS (CAPA 4)
// ═══════════════════════════════════════════════════════════════════════════════
function TabSugerencias() {
  const { t } = useI18n()

  const [sugerencias, setSugerencias] = useState<any[]>([])
  const [insightGlobal, setInsightGlobal] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ urgentes: number; pacientes_analizados: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const cargar = async () => {
    setLoading(true); setError('')
    try {
      // ✅ FIX: usar GET (no POST). POST solo sirve para marcar sugerencias como resueltas.
      const res = await fetch('/api/agente-sugerencias')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSugerencias(json.sugerencias || [])
      setInsightGlobal(json.insight_global || null)
      setMeta({ urgentes: json.urgentes || 0, pacientes_analizados: json.pacientes_analizados || 0 })
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const prioColor: Record<string, string> = {
    alta: 'bg-red-100 text-red-700 border-red-200',
    media: 'bg-amber-100 text-amber-700 border-amber-200',
    baja: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-orange-600" />
            <span className="font-bold text-orange-800 text-sm">Alertas Proactivas — CAPA 4</span>
          </div>
          <p className="text-xs text-orange-600">{t('hub.iaAlertaAntes')}</p>
          {meta && (
            <p className="text-[11px] text-orange-500 mt-1">
              {meta.pacientes_analizados} pacientes analizados · {meta.urgentes} alertas urgentes
            </p>
          )}
        </div>
        <button onClick={cargar} disabled={loading} className="p-2 hover:bg-orange-100 rounded-xl transition">
          <RefreshCw size={14} className={`text-orange-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Insight global IA (solo aparece si hay ≥2 alertas urgentes) */}
      {insightGlobal && (
        <div className=" rounded-xl border border-orange-200 p-4" style={{ background: "var(--card)" }}>
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles size={10} /> RESUMEN EJECUTIVO IA
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{insightGlobal}</p>
        </div>
      )}

      {error && <p className="text-red-500 text-xs">{error}</p>}
      {loading && <div className="flex justify-center py-8"><RefreshCw size={24} className="animate-spin text-orange-400" /></div>}
      {!loading && sugerencias.length === 0 && (
        <div className=" rounded-2xl border border-slate-100 p-10 text-center" style={{ background: "var(--card)" }}>
          <CheckCircle size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="font-bold text-slate-700" style={{ color: "var(--text-secondary)" }}>Sin alertas activas</p>
          <p className="text-xs text-slate-400 mt-1">{t('hub.todosPacientesOk')}</p>
        </div>
      )}
      {sugerencias.map((s: any, i: number) => (
        <div key={i} className=" rounded-xl border border-slate-100 p-4" style={{ background: "var(--card)" }}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${prioColor[s.prioridad]}`}>{s.prioridad}</span>
              <span className="ml-2 text-[10px] text-slate-400">{s.child_name}</span>
            </div>
            <span className="text-[10px] text-slate-400">{s.semanas_detectado}w</span>
          </div>
          <p className="font-bold text-sm text-slate-800" style={{ color: "var(--text-primary)" }}>{s.titulo}</p>
          <p className="text-xs text-slate-500 mt-1">{s.descripcion}</p>
          <p className="text-xs font-semibold mt-2 rounded-lg px-3 py-2" style={{ background: "var(--muted-bg)", color: "var(--text-secondary)" }}>→ {s.accion_concreta}</p>
          {s.dato_clave && <p className="text-[10px] text-slate-400 mt-1">Dato: {s.dato_clave}</p>}
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: REPORTES IA (CAPA 2)
// ═══════════════════════════════════════════════════════════════════════════════
type DocEmitido = {
  codigo_doc: string
  child_id: string | null
  tipo: string
  tipo_label: string
  paciente_nombre: string | null
  paciente_iniciales: string | null
  fecha_emision: string
  especialista: string | null
  valido: boolean
  file_name: string | null
  metadata: any
  notas: string | null
}

function TabReportes({ pacientes }: { pacientes: Paciente[] }) {
  const { t } = useI18n()

  const [selected, setSelected] = useState<Paciente | null>(null)
  const [tipo, setTipo] = useState<'padres' | 'seguro' | 'comparativo'>('padres')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Historial de documentos emitidos ───────────────────────────────────
  const [docs, setDocs] = useState<DocEmitido[]>([])
  const [stats, setStats] = useState<{ total_validos: number; total_invalidos: number; por_tipo: Record<string, number> } | null>(null)
  const [filterTipo, setFilterTipo] = useState<string>('')
  const [filterValido, setFilterValido] = useState<'' | '1' | '0'>('')
  const [filterQ, setFilterQ] = useState('')
  const [filterChildId, setFilterChildId] = useState<string>('')
  const [loadingDocs, setLoadingDocs] = useState(false)

  const cargarDocs = async () => {
    setLoadingDocs(true)
    try {
      const params = new URLSearchParams()
      if (filterChildId) params.set('child_id', filterChildId)
      if (filterTipo)    params.set('tipo', filterTipo)
      if (filterValido)  params.set('valido', filterValido)
      if (filterQ)       params.set('q', filterQ)
      const res = await fetch(`/api/admin/documentos-emitidos?${params.toString()}`)
      const json = await res.json()
      if (json.ok) {
        setDocs(json.documentos)
        setStats(json.stats)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => { cargarDocs() }, [filterTipo, filterValido, filterChildId])

  const invalidar = async (codigoDoc: string) => {
    const motivo = window.prompt('Motivo de la invalidación (opcional):')
    if (motivo === null) return  // canceló
    try {
      await fetch('/api/admin/documentos-emitidos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_doc: codigoDoc, motivo: motivo || 'Reemitido' }),
      })
      await cargarDocs()
    } catch (e: any) {
      alert('Error: ' + e.message)
    }
  }

  const generar = async () => {
    if (!selected) return
    setLoading(true); setError(''); setSuccess('')
    try {
      const res = await fetch('/api/reporte-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', childId: selected.id, tipo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error generando reporte')
      }
      // Descargar el .docx directamente
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match?.[1] || `Reporte_${tipo}_${selected.name}.docx`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(`✅ Reporte Word descargado: ${a.download}`)
      // Refrescar el historial de documentos emitidos
      setTimeout(() => cargarDocs(), 600)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const tipoInfo = {
    padres:      { label: 'Para padres',          desc: 'Lenguaje emocional y accesible',                  emoji: '👨‍👩‍👧' },
    seguro:      { label: 'Informe Clínico', desc: 'Formato oficial del centro (Área/Subárea/Sets)', emoji: '📋' },
    comparativo: { label: 'Comparativo + pred.',  desc: '"En 3 meses logrará X"',                          emoji: '📊' },
  }

  return (
    <div className="space-y-4">
      <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen size={16} className="text-teal-600" />
          <span className="font-bold text-teal-800 text-sm">Reportes Profesionales Word — CAPA 2</span>
        </div>
        <p className="text-xs text-teal-600">Genera documentos .docx profesionales listos para imprimir o enviar: para padres, aseguradoras o análisis comparativo.</p>
      </div>
      <div className=" rounded-2xl border border-slate-100 p-4 space-y-3" style={{ background: "var(--card)" }}>
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{'Paciente'}</label>
        <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
          value={selected?.id || ''} onChange={e => setSelected(pacientes.find(p => p.id === e.target.value) || null)}>
          <option value="">— Seleccionar —</option>
          {pacientes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t('hub.tipoReporte')}</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(tipoInfo) as [typeof tipo, typeof tipoInfo['padres']][]).map(([k, v]) => (
            <button key={k} onClick={() => setTipo(k)}
              className={`p-3 rounded-xl border text-left transition ${tipo === k ? 'border-teal-400 bg-teal-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-teal-200'}`}>
              <p className="text-lg mb-1">{v.emoji}</p>
              <p className={`text-xs font-bold ${tipo === k ? 'text-teal-700' : 'text-slate-600'}`}>{v.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{v.desc}</p>
            </button>
          ))}
        </div>

        <button onClick={generar} disabled={!selected || loading}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition">
          {loading
            ? <><RefreshCw size={14} className="animate-spin" /> Generando documento Word...</>
            : <><BookOpen size={14} /> Generar y Descargar .docx</>}
        </button>

        {error && <div className="bg-red-50 border border-red-100 rounded-xl p-3"><p className="text-red-600 text-xs">{error}</p></div>}
        {success && <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3"><p className="text-emerald-700 text-sm font-semibold">{success}</p></div>}
      </div>

      {/* ═══ HISTORIAL DE DOCUMENTOS EMITIDOS ═══ */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Historial de documentos emitidos</h3>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Cada documento generado queda registrado y es verificable vía QR
            </p>
          </div>
          {stats && (
            <div className="flex gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                ✓ {stats.total_validos} válidos
              </span>
              {stats.total_invalidos > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 font-bold border border-amber-200">
                  ⚠ {stats.total_invalidos} invalidados
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="🔍 Buscar por código o paciente…"
            value={filterQ}
            onChange={e => setFilterQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') cargarDocs() }}
            className="border rounded-lg px-3 py-2 text-xs md:col-span-2"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          />
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            <option value="">Todos los tipos</option>
            <option value="informe_clinico">Informe Clínico</option>
            <option value="reporte_padres">Reporte Padres</option>
            <option value="reporte_comparativo">Comparativo</option>
            <option value="reporte_seguro">Seguros</option>
            <option value="anamnesis_inicial">Anamnesis Inicial</option>
            <option value="anamnesis_legacy">Anamnesis</option>
            <option value="sesion_aba">Sesión ABA</option>
            <option value="ficha_clinica">Ficha Clínica</option>
          </select>
          <select
            value={filterValido}
            onChange={e => setFilterValido(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            <option value="">Todos los estados</option>
            <option value="1">Solo válidos</option>
            <option value="0">Solo invalidados</option>
          </select>
        </div>

        {/* Lista */}
        {loadingDocs ? (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
        ) : docs.length === 0 ? (
          <div className="py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No hay documentos emitidos con esos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--card-border)' }}>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wider" style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Paciente</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                  <th className="px-3 py-2 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => {
                  const fecha = new Date(d.fecha_emision)
                  const verifUrl = `/verificar/${encodeURIComponent(d.codigo_doc)}`
                  return (
                    <tr key={d.codigo_doc} className="border-t" style={{ borderColor: 'var(--card-border)' }}>
                      <td className="px-3 py-2 font-mono font-bold text-blue-700">{d.codigo_doc}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{d.tipo_label}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                        <span className="font-bold">{d.paciente_iniciales || '—'}</span>
                        {d.paciente_nombre && (
                          <span className="text-[10px] block opacity-60" title={d.paciente_nombre}>
                            {d.paciente_nombre.length > 28 ? d.paciente_nombre.slice(0, 28) + '…' : d.paciente_nombre}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                        {fecha.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-[10px] block opacity-60">
                          {fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {d.valido ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                            ✓ Válido
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700" title={d.notas || ''}>
                            ⚠ Invalidado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <a
                            href={verifUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir página de verificación"
                            className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold"
                          >
                            🔗 Ver
                          </a>
                          {d.valido && (
                            <button
                              onClick={() => invalidar(d.codigo_doc)}
                              title="Invalidar este documento"
                              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-bold"
                            >
                              ⚠ Invalidar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {docs.length > 0 && (
          <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
            Mostrando {docs.length} documento{docs.length === 1 ? '' : 's'}. Cada uno tiene QR escaneable que apunta a su URL de verificación pública.
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function InteligenciaHubView() {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('predicciones')
  const [pacientes, setPacientes] = useState<Paciente[]>([])

  useEffect(() => {
    // Usar API server-side que bypassa RLS de Supabase
    fetch('/api/admin/children')
      .then(r => r.json())
      .then(json => {
        const data = json.data || []
        setPacientes(data.map((r: any) => ({
          id: r.id,
          name: r.name || r.nombre || 'Sin nombre',
          diagnosis: r.diagnosis || r.diagnostico || '',
        })))
      })
      .catch(e => console.error('Error cargando pacientes Hub IA:', e))
  }, [])

  const tabs = [
    { id: 'predicciones' as Tab, icon: Brain, label: t('hub.predicciones'), color: 'blue' },
    { id: 'patrones' as Tab, icon: Activity, label: 'Patrones ABA', color: 'violet' },
    { id: 'objetivos' as Tab, icon: Target, label: 'Objetivos IA', color: 'amber' },
    { id: 'sugerencias' as Tab, icon: Sparkles, label: 'Alertas Proactivas', color: 'orange' },
    { id: 'reportes' as Tab, icon: BookOpen, label: 'Reportes IA', color: 'teal' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center">
          <Zap size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800" style={{ color: "var(--text-primary)" }}>{t('hub.hubInteligencia')}</h1>
          <p className="text-xs text-slate-400">6 agentes IA · Predicciones · Patrones · Objetivos · Reportes</p>
        </div>
      </div>

      {/* Tabs scrollable — mobile: solo icono + label corto, scroll horizontal */}
      <div
        className="flex gap-1 rounded-xl p-1.5 overflow-x-auto scrollbar-hide"
        style={{ background: 'var(--muted-bg)', WebkitOverflowScrolling: 'touch' }}
      >
        {tabs.map(tab_ => (
          <button key={tab_.id} onClick={() => setTab(tab_.id)}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg font-bold transition-all whitespace-nowrap flex-shrink-0 ${
              tab === tab_.id
                ? `bg-white shadow-sm text-sm ${
                    tab_.color === 'blue' ? 'text-blue-700' :
                    tab_.color === 'violet' ? 'text-violet-700' :
                    tab_.color === 'amber' ? 'text-amber-700' :
                    tab_.color === 'orange' ? 'text-orange-700' :
                    tab_.color === 'teal' ? 'text-teal-700' :
                    'text-emerald-700'
                  }`
                : 'text-slate-500 hover:text-slate-700 text-xs'
            }`}>
            <tab_.icon size={tab === tab_.id ? 14 : 13} />
            {/* En móvil, acortar etiquetas largas */}
            <span className="hidden sm:inline">{tab_.label}</span>
            <span className="sm:hidden">
              {tab_.label === 'Alertas Proactivas' ? 'Alertas' :
               tab_.label === 'Patrones ABA' ? 'Patrones' :
               tab_.label === 'Objetivos IA' ? 'Objetivos' :
               tab_.label === 'Reportes IA' ? 'Reportes' :
               tab_.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'predicciones' && (
        <div className="flex-1 min-h-0">
          <TabPredicciones pacientes={pacientes} />
        </div>
      )}
      {tab === 'patrones' && <TabPatrones pacientes={pacientes} />}
      {tab === 'objetivos' && <TabObjetivos pacientes={pacientes} />}
      {tab === 'sugerencias' && <TabSugerencias />}
      {tab === 'reportes' && <TabReportes pacientes={pacientes} />}
      {tab === 'seguridad' && <TabSeguridad />}
    </div>
  )
}
