'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import GraficoProgramaABA from '@/components/graficos/GraficoProgramaABA'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Cell, PieChart, Pie, ComposedChart, Area
} from 'recharts'
import {
  Plus, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Target, BarChart3, BarChart2, Edit3, CheckCircle2, AlertTriangle, Clock,
  Loader2, X, Save, Activity, Zap, Brain, BookOpen, ArrowRight, Trash2
} from 'lucide-react'
import { useToast } from '@/components/Toast'

// ── Tipo de gráfico por programa (guardado en estado) ─────────────────────────
type TipoGrafico = 'lineas' | 'barras' | 'histograma' | 'pie'

const TIPOS_GRAFICO_PROGRAMA = [
  { id: 'lineas'    as TipoGrafico, emoji: '📈', label: 'Líneas' },
  { id: 'barras'    as TipoGrafico, emoji: '📊', label: 'Barras' },
  { id: 'histograma'as TipoGrafico, emoji: '🗂️', label: 'Histograma' },
  { id: 'pie'       as TipoGrafico, emoji: '🥧', label: 'Pie' },
]

function colorPorPct(pct: number) {
  if (pct >= 90) return '#059669'
  if (pct >= 70) return '#6366f1'
  if (pct >= 45) return '#f59e0b'
  return '#ef4444'
}

// ── Colores por área ────────────────────────────────────────────────────────
const AREA_COLOR: Record<string, { dot: string }> = {
  comunicacion: { dot: '#3d6eaa' },
  conducta:     { dot: '#aa4a4a' },
  cognitivo:    { dot: '#6a4aaa' },
  social:       { dot: '#2e8a60' },
  autonomia:    { dot: '#9a7020' },
  academico:    { dot: '#3a7aaa' },
  sensorial:    { dot: '#aa5a80' },
}

const AREA_CONFIG: Record<string, { color: string; bg: string; label: string; emoji: string }> = {
  comunicacion: { color: 'text-blue-700 dark:text-blue-300',   bg: 'bg-blue-50 dark:bg-blue-900/25 border-blue-200 dark:border-blue-800',   label: 'Comunicación',   emoji: '💬' },
  conducta:     { color: 'text-red-700 dark:text-red-300',     bg: 'bg-red-50 dark:bg-red-900/25 border-red-200 dark:border-red-800',       label: 'Conducta',       emoji: '🎯' },
  cognitivo:    { color: 'text-violet-700 dark:text-violet-300', bg: 'bg-violet-50 dark:bg-violet-900/25 border-violet-200 dark:border-violet-800', label: 'Cognitivo', emoji: '🧠' },
  social:       { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/25 border-emerald-200 dark:border-emerald-800', label: 'Social', emoji: '👥' },
  autonomia:    { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/25 border-amber-200 dark:border-amber-800', label: 'Autonomía',    emoji: '🌟' },
  academico:    { color: 'text-indigo-700 dark:text-indigo-300', bg: 'bg-indigo-50 dark:bg-indigo-900/25 border-indigo-200 dark:border-indigo-800', label: 'Académico', emoji: '📚' },
  sensorial:    { color: 'text-pink-700 dark:text-pink-300',   bg: 'bg-pink-50 dark:bg-pink-900/25 border-pink-200 dark:border-pink-800',   label: 'Sensorial',      emoji: '✋' },
}

// Removed 'seguimiento' — mantenimiento covers it
const FASE_COLORS: Record<string, string> = {
  linea_base: '#94a3b8', intervencion: '#6366f1',
  mantenimiento: '#10b981',
}


export default function ProgramasABAView({ childId, childName }: { childId: string; childName: string }) {
  const toast = useToast()
  const { t } = useI18n()

  const FASE_LABELS: Record<string, string> = {
    linea_base:    'Baseline',
    intervencion:  t('programas.intervencion'),
    mantenimiento: t('programas.mantenimiento'),
  }
  const CHART_TIPO_LABELS: Record<string, string> = {
    lineas:     t('reportes.lineas'),
    barras:     t('reportes.barras'),
    histograma: t('reportes.histograma'),
    pie:        t('reportes.pie'),
  }

  const AREA_LABELS: Record<string, string> = {
    comunicacion: t('programas.areaComunicacion') || 'Communication',
    conducta:     t('programas.areaConducca') || 'Behavior',
    cognitivo:    t('programas.areaCognitivo') || 'Cognitive',
    social:       t('programas.areaSocial') || 'Social',
    autonomia:    t('programas.areaAutonomia') || 'Autonomy',
    academico:    t('programas.areaAcademico') || 'Academic',
    sensorial:    t('programas.areaSensorial') || 'Sensory',
  }

  const [programas, setProgramas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCrear, setShowCrear] = useState(false)
  const [programaActivo, setProgramaActivo] = useState<any>(null)
  const [showRegistrarSesion, setShowRegistrarSesion] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [filtroArea, setFiltroArea] = useState<string>('todos')
  // Tipo de gráfico por programa: { [programaId]: TipoGrafico }
  const [tiposGrafico, setTiposGrafico] = useState<Record<string, TipoGrafico>>({})

  function setTipoGrafico(programaId: string, tipo: TipoGrafico) {
    setTiposGrafico(prev => ({ ...prev, [programaId]: tipo }))
  }

  const loadProgramas = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/programas-aba?child_id=${childId}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setProgramas(json.data || [])
    } catch { toast.error('Error cargando programas') }
    finally { setLoading(false) }
  }, [childId])

  useEffect(() => { loadProgramas() }, [loadProgramas])

  // Análisis proactivo del agente al cargar
  useEffect(() => {
    if (!childId) return
    setLoadingAI(true)
    fetch(`/api/agente/chat?action=analisis_proactivo&child_id=${childId}`)
      .then(r => r.json())
      .then(data => setAiAnalysis(data))
      .catch(() => {})
      .finally(() => setLoadingAI(false))
  }, [childId])

  const areas = ['todos', ...Object.keys(AREA_CONFIG)]
  const programasFiltrados = filtroArea === 'todos'
    ? programas
    : programas.filter(p => p.area === filtroArea)

  // Helper: misma lógica que el badge "Criterio alcanzado" en ProgramaCard
  const programaCriterioAlcanzado = (p: any) => {
    const todasSesiones = (p.sesiones_datos_aba || []).sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const crit = p.criterio_dominio_pct || 90
    const critSesiones = p.criterio_sesiones_consecutivas || 2
    // Filtrar por el set más reciente activo
    const setsConSes = Array.from(new Set(todasSesiones.map((s: any) => s.set ?? '__none__')))
    const setAct = setsConSes[setsConSes.length - 1] ?? '__none__'
    const sesActivo = todasSesiones.filter((s: any) => (s.set ?? '__none__') === setAct)
    if (sesActivo.length < critSesiones) return false
    const last = sesActivo.slice(-critSesiones)
    return last.every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
  }

  const stats = {
    activos: programas.filter(p => p.estado === 'activo').length,
    dominados: programas.filter(p => p.estado === 'dominado' || programaCriterioAlcanzado(p)).length,
    enIntervencion: programas.filter(p => p.fase_actual === 'intervencion' || p.fase_actual === 'linea_base').length,
    alertas: aiAnalysis?.alertas?.length || 0,
  }

  const STAT_CFG = [
    { label: t('programas.activos'),        value: stats.activos,        icon: '◉', lightBg: '#f0f4ff', lightNum: '#3d5a99', lightLabel: '#6b7a9a', darkBg: 'rgba(61,90,153,0.12)', darkNum: '#7b9cd4', darkLabel: '#6b7a9a', bar: '#3d5a99' },
    { label: t('programas.dominados'),       value: stats.dominados,      icon: '✓', lightBg: '#f0faf5', lightNum: '#2d7a56', lightLabel: '#5a8a70', darkBg: 'rgba(45,122,86,0.12)',  darkNum: '#6ab890', darkLabel: '#5a8a70', bar: '#2d7a56' },
    { label: t('programas.enIntervencion'),  value: stats.enIntervencion, icon: '▶', lightBg: '#f5f0ff', lightNum: '#5a3d99', lightLabel: '#7a6a9a', darkBg: 'rgba(90,61,153,0.12)',  darkNum: '#9d80d4', darkLabel: '#7a6a9a', bar: '#5a3d99' },
    { label: t('programas.alertasIA'),       value: stats.alertas,        icon: '⚑', lightBg: '#fff8ee', lightNum: '#956020', lightLabel: '#9a7a4a', darkBg: 'rgba(149,96,32,0.12)',  darkNum: '#d4a060', darkLabel: '#9a7a4a', bar: '#956020' },
  ]

  return (
    <div className="pb-10">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
            <Activity size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {t('programas.titulo')}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Registro conductual · {childName}</p>
          </div>
        </div>

        <button onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all"
          style={{ background: 'var(--text-primary)', color: 'var(--card)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
          <Plus size={15} /> {t('programas.nuevo')}
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {STAT_CFG.map(s => (
          <div key={s.label} className="rounded-2xl p-4 relative overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: s.bar }} />
            <p className="text-3xl font-black pl-1 leading-none mb-1"
              style={{ color: s.bar }}>
              {s.value}
            </p>
            <p className="text-[11px] font-semibold pl-1" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Alertas IA ── */}
      {loadingAI && (
        <div className="rounded-xl p-3.5 flex items-center gap-3 mb-4"
          style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{t('dashboard.ariAnalizando')}</p>
        </div>
      )}
      {aiAnalysis && aiAnalysis.alertas?.length > 0 && (
        <div className="space-y-2 mb-5">
          <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 mb-2"
            style={{ color: 'var(--text-muted)' }}>
            <Brain size={10} style={{ color: 'var(--text-muted)' }} /> Análisis ARIA
          </p>
          {aiAnalysis.resumen && (
            <div className="rounded-xl p-4" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', borderLeft: '3px solid var(--text-muted)' }}>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{aiAnalysis.resumen}</p>
            </div>
          )}
          {aiAnalysis.alertas.map((alerta: any, i: number) => (
            <AlertaCard key={i} alerta={alerta} />
          ))}
        </div>
      )}

      {/* ── Filtros por área ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {areas.map(area => (
          <button key={area} onClick={() => setFiltroArea(area)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={filtroArea === area
              ? { background: 'var(--text-primary)', color: 'var(--card)', border: '1px solid transparent' }
              : { background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
            {area === 'todos' ? `${t('programas.todos')}` : `${AREA_CONFIG[area]?.emoji} ${AREA_LABELS[area] || AREA_CONFIG[area]?.label}`}
          </button>
        ))}
      </div>

      {/* Lista de programas */}
      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="animate-spin text-indigo-400" size={28} />
          <p className="text-sm" style={{color:"var(--text-muted)"}}>{t('programas.sinProgramas')}</p>
        </div>
      ) : programasFiltrados.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--card-border)] bg-[var(--card)] rounded-3xl p-14 text-center">
          <div className="w-14 h-14 dark:bg-indigo-900/30 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 size={26} className="text-indigo-300" />
          </div>
          <p className="font-bold text-slate-500 mb-1">{t('programas.sinProgramas')}{filtroArea !== 'todos' ? ` ${t('programas.enArea').replace('{area}', AREA_CONFIG[filtroArea]?.label || '')}` : ''}</p>
          <p className="text-xs" style={{color:"var(--text-muted)",opacity:0.6}}>{t('programas.creaElPrimero').replace('{nombre}', childName)}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {programasFiltrados.map(prog => (
            <ProgramaCard
              key={prog.id}
              programa={prog}
              onRegistrarSesion={() => { setProgramaActivo(prog); setShowRegistrarSesion(true) }}
              onReload={loadProgramas}
              onDeleteSesion={(sesionId: string) => {
                setProgramas(prev => prev.map(p => p.id !== prog.id ? p : {
                  ...p,
                  sesiones_datos_aba: (p.sesiones_datos_aba || []).filter((s: any) => s.id !== sesionId)
                }))
              }}
              tipoGrafico={tiposGrafico[prog.id] || 'lineas'}
              onChangeTipoGrafico={(tipo: TipoGrafico) => setTipoGrafico(prog.id, tipo)}
            />
          ))}
        </div>
      )}

      {/* Modales */}
      {showCrear && (
        <CrearProgramaModal
          childId={childId}
          onClose={() => setShowCrear(false)}
          onCreated={() => { setShowCrear(false); loadProgramas() }}
        />
      )}
      {showRegistrarSesion && programaActivo && (
        <RegistrarSesionModal
          programa={programaActivo}
          childId={childId}
          onClose={() => { setShowRegistrarSesion(false); setProgramaActivo(null) }}
          onSaved={() => { setShowRegistrarSesion(false); setProgramaActivo(null); loadProgramas() }}
        />
      )}
    </div>
  )
}

// ── Tarjeta de alerta IA ─────────────────────────────────────────────────────
function AlertaCard({ alerta }: { alerta: any; key?: any }) {
  const cfg: Record<string, { border: string; icon: string; label: string }> = {
    alta:  { border: '#c0524a', icon: '⚠', label: '#c0524a' },
    media: { border: '#b07830', icon: '!', label: '#b07830' },
    baja:  { border: '#4a7aaa', icon: 'i', label: '#4a7aaa' },
  }
  const c = cfg[alerta.prioridad] || cfg.media
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--muted-bg)', border: `1px solid var(--card-border)`, borderLeft: `3px solid ${c.border}` }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-black w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: `${c.border}18`, color: c.border }}>
          {c.icon}
        </span>
        <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{alerta.titulo}</p>
      </div>
      <p className="text-xs leading-relaxed pl-6" style={{ color: 'var(--text-secondary)' }}>{alerta.mensaje}</p>
    </div>
  )
}

// ── Tarjeta de programa con gráfica ─────────────────────────────────────────

// Componente separado para la mini gráfica — resuelve el problema de ancho en móvil
function MiniChart({ chartData, minSlots, criterio }: { chartData: any[]; minSlots: number; criterio: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(containerRef.current)
    setWidth(containerRef.current.offsetWidth)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="mt-3 h-16 w-full" style={{ overflow: 'hidden' }}>
      {width > 0 && (
        <LineChart width={width} height={64} data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <XAxis dataKey="sesion" type="number" domain={[0, minSlots + 1]} hide />
          <YAxis domain={[0, 100]} hide width={0} />
          <Line type="linear" dataKey="pct" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls={false} />
          <ReferenceLine y={criterio} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
        </LineChart>
      )}
    </div>
  )
}


// Componente para el gráfico de detalle — un solo ResponsiveContainer, sin overlay
function DetailChart({ chartData, chartHeight, minSlots, programa, segments, mergedSegments, segColorMap, dividers, crit, faseLabel }: any) {
  const margin = { top: 24, right: 16, bottom: 20, left: 4 }
  const YAXIS_W = 40

  // Use mergedSegments if available (fixes non-contiguous Set 1 showing as separate line)
  const lineSegments: any[] = mergedSegments ?? segments.map((seg: any, si: number) => ({
    key: `${seg.fase}||${seg.set}`,
    label: seg.label,
    fase: seg.fase,
    set: seg.set,
    indices: new Set(Array.from({ length: seg.endIdx - seg.startIdx + 1 }, (_: any, k: number) => seg.startIdx + k)),
    color: segColorMap[si],
  }))

  // Calcular divisores de SET (no de fase) — posición absoluta en número de sesión
  // Un divisor de set ocurre cuando el campo "set" cambia entre dos puntos consecutivos con datos
  const setDividers: { x: number; label: string; nextColor: string }[] = []
  const realPoints = chartData.filter((d: any) => d.pct !== null)
  for (let i = 1; i < realPoints.length; i++) {
    const prevSet = realPoints[i - 1].set ?? '__none__'
    const currSet = realPoints[i].set ?? '__none__'
    if (prevSet !== currSet) {
      // La línea va entre la sesión i-1 y la sesión i (ambas en 1-based)
      const xPos = (realPoints[i - 1].sesion + realPoints[i].sesion) / 2
      const mseg = lineSegments.find((s: any) => s.set === currSet || (!s.set && currSet === '__none__'))
      setDividers.push({
        x: xPos,
        label: realPoints[i].set || '',
        nextColor: mseg ? mseg.color : '#6366f1',
      })
    }
  }

  // Divisores de fase (cuando cambia la fase pero NO el set — línea más suave)
  const faseDividers: number[] = []
  for (let i = 1; i < realPoints.length; i++) {
    const prevSet = realPoints[i - 1].set ?? '__none__'
    const currSet = realPoints[i].set ?? '__none__'
    const prevFase = realPoints[i - 1].fase
    const currFase = realPoints[i].fase
    if (prevSet === currSet && prevFase !== currFase) {
      faseDividers.push((realPoints[i - 1].sesion + realPoints[i].sesion) / 2)
    }
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <LineChart data={chartData} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
        <XAxis
          dataKey="sesion"
          type="number"
          domain={[0, minSlots + 1]}
          ticks={Array.from({ length: minSlots }, (_: any, i: number) => i + 1)}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          interval={Math.max(0, Math.floor(minSlots / 10) - 1)}
          label={{ value: 'Sesión', position: 'insideBottom', offset: -8, fontSize: 10, fill: 'var(--text-muted)' }}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
          tickFormatter={(v: number) => `${v}%`}
          width={YAXIS_W}
        />
        <Tooltip
          formatter={(value: any) => [`${value}%`, 'Éxito']}
          labelFormatter={(label: any) => {
            const d = chartData.find((p: any) => p.sesion === label)
            if (!d) return `Sesión ${label}`
            const segIdx = segments.findIndex((s: any) => (label - 1) >= s.startIdx && (label - 1) <= s.endIdx)
            const segName = segIdx >= 0 ? segments[segIdx].label : ''
            return `Sesión ${label} · ${d.fecha}${segName ? ` · ${segName}` : ''}`
          }}
          contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'var(--card)' }}
        />
        {/* Líneas verticales de cambio de SET — punteadas gruesas estilo ABA */}
        {setDividers.map((div: any, i: number) => (
          <ReferenceLine
            key={`setdiv-${i}`}
            x={div.x}
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="6 4"
            label={{
              value: div.label,
              position: 'insideTopRight',
              fontSize: 9,
              fill: div.nextColor,
              fontWeight: 700,
            }}
          />
        ))}
        {/* Líneas verticales de cambio de FASE (dentro del mismo set) — más suaves */}
        {faseDividers.map((x: number, i: number) => (
          <ReferenceLine key={`fasediv-${i}`} x={x} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
        ))}
        {/* Línea horizontal de criterio de dominio */}
        <ReferenceLine y={programa.criterio_dominio_pct} stroke="#10b981" strokeDasharray="6 3" strokeWidth={2} />
        {/* Una línea por set (merged) con su color — Set 1 agrupa todos sus puntos aunque no sean contiguos */}
        {lineSegments.map((seg: any, si: number) => {
          const color = seg.color
          return (
            <Line
              key={`seg_${si}`}
              type="linear"
              dataKey={(d: any) => {
                const idx = chartData.indexOf(d)
                return seg.indices.has(idx) ? d.pct : null
              }}
              stroke={color}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, index } = props
                if (!seg.indices.has(index)) return <g key={index} />
                const dotColor = (chartData[index]?.pct ?? 0) >= crit ? '#059669' : color
                return <circle key={index} cx={cx} cy={cy} r={4} fill={dotColor} stroke="white" strokeWidth={1.5} />
              }}
              connectNulls={false}
              isAnimationActive={false}
              legendType="none"
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ProgramaCard({ programa, onRegistrarSesion, onReload, onDeleteSesion, tipoGrafico = 'lineas', onChangeTipoGrafico }: any) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)
  const toast = useToast()
  const [editingTitulo, setEditingTitulo] = useState(false)
  const [tempTitulo, setTempTitulo] = useState(programa.titulo)
  const [localTitulo, setLocalTitulo] = useState(programa.titulo)

  const saveTitulo = async (nuevo: string) => {
    setEditingTitulo(false)
    const trimmed = nuevo.trim()
    if (!trimmed || trimmed === localTitulo) { setTempTitulo(localTitulo); return }
    setLocalTitulo(trimmed)
    const res = await fetch('/api/programas-aba', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'actualizar_programa', programa_id: programa.id, updates: { titulo: trimmed } }),
    })
    const json = await res.json()
    if (json.error) { toast.error(json.error); setLocalTitulo(programa.titulo); setTempTitulo(programa.titulo); return }
    toast.success('✏️ Título actualizado')
  }

  const area = AREA_CONFIG[programa.area] || AREA_CONFIG.comunicacion
  // Use detalle (fresh from API) when available, fallback to prop — this ensures the
  // chart reflects deletions/additions without needing a full page reload
  const sesiones = [...((detalle ?? programa).sesiones_datos_aba || [])].sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))

  // ── Agrupar por set: calcular stats SOLO del set más reciente activo ──
  // El set activo es el último set que tiene al menos una sesión registrada
  const setsConSesiones = Array.from(new Set(sesiones.map((s: any) => s.set ?? '__none__')))
  const setActivo = setsConSesiones[setsConSesiones.length - 1] ?? '__none__'
  const sesionesSetActivo = sesiones.filter((s: any) => (s.set ?? '__none__') === setActivo)

  // Calcular tendencia local — solo sobre el set activo
  const recientes = sesionesSetActivo.slice(-5).map((s: any) => s.porcentaje_exito).filter(Boolean)
  const promedio = recientes.length > 0 ? recientes.reduce((a: number, b: number) => a + b, 0) / recientes.length : 0
  const ultimoPct = sesionesSetActivo[sesionesSetActivo.length - 1]?.porcentaje_exito ?? null
  const anterior = sesionesSetActivo[sesionesSetActivo.length - 2]?.porcentaje_exito ?? null
  const tendencia = ultimoPct !== null && anterior !== null
    ? ultimoPct > anterior + 3 ? 'up' : ultimoPct < anterior - 3 ? 'down' : 'stable'
    : 'stable'

  // ── Check for criterion streak — solo sobre el set activo ──
  const crit = programa.criterio_dominio_pct || 90
  const critSesiones = programa.criterio_sesiones_consecutivas || 2
  const criterioAlcanzado = (() => {
    if (sesionesSetActivo.length < critSesiones) return false
    const last = sesionesSetActivo.slice(-critSesiones)
    return last.every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
  })()
  // Check if 1 away (one session at criterion, one needed)
  const unaFalta = !criterioAlcanzado && critSesiones >= 2 && sesionesSetActivo.length >= 1 && (() => {
    const last = sesionesSetActivo.slice(-(critSesiones - 1))
    return last.length === critSesiones - 1 && last.every((s: any) => (s.porcentaje_exito ?? 0) >= crit)
  })()

  const fetchDetalle = async () => {
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/programas-aba?id=${programa.id}&t=${Date.now()}`, { cache: 'no-store' })
      const json = await res.json()
      setDetalle(json.data || programa)
    } catch {
      setDetalle(programa)
    }
    finally { setLoadingDetalle(false) }
  }

  const loadDetalle = async () => {
    if (detalle) { setExpanded(!expanded); return }
    setExpanded(true)
    await fetchDetalle()
  }

  // Preparar datos para la gráfica
  const chartDataRaw = sesiones.map((s: any, i: number) => ({
    sesion: i + 1,
    pct: s.porcentaje_exito,
    fase: s.fase,
    fecha: s.fecha,
    set: s.set ?? null,
  }))
  // Pad to minimum 10 slots so the X axis always shows at least S1–S10
  const minSlots = Math.max(10, chartDataRaw.length)
  const chartData = [
    ...chartDataRaw,
    ...Array.from({ length: minSlots - chartDataRaw.length }, (_, i) => ({
      sesion: chartDataRaw.length + i + 1,
      pct: null as any,
      fase: null,
      fecha: null,
      set: null,
    }))
  ]

  // Detectar cambios de fase para líneas verticales
  const cambiosFase: number[] = []
  for (let i = 1; i < chartData.length; i++) {
    if (chartData[i].fase !== chartData[i - 1].fase) cambiosFase.push(i + 1)
  }

  const faseLabel: Record<string, string> = {
    linea_base: 'Baseline', intervencion: t('programas.intervencion'),
    mantenimiento: t('programas.mantenimiento'),
  }

  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="p-5 cursor-pointer" onClick={loadDetalle}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${area.bg} border shrink-0`}>
            {area.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editingTitulo ? (
                <input
                  autoFocus
                  value={tempTitulo}
                  onChange={e => setTempTitulo(e.target.value)}
                  onBlur={() => saveTitulo(tempTitulo)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') { setTempTitulo(localTitulo); setEditingTitulo(false) }
                  }}
                  onClick={e => e.stopPropagation()}
                  className="font-bold text-sm rounded-lg px-2 py-0.5 outline-none border-2 border-indigo-400"
                  style={{ color: 'var(--text-primary)', background: 'var(--input-bg)', minWidth: '160px', maxWidth: '260px' }}
                />
              ) : (
                <h3
                  className="font-bold text-sm leading-snug cursor-text group flex items-center gap-1"
                  style={{ color: 'var(--text-primary)' }}
                  title="Doble clic para editar el título"
                  onDoubleClick={e => { e.stopPropagation(); setTempTitulo(localTitulo); setEditingTitulo(true) }}
                >
                  {localTitulo}
                  <Edit3 size={11} className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0" />
                </h3>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${area.bg} ${area.color}`}>
                {area.label}
              </span>
              <FaseTag fase={programa.fase_actual} />
              {criterioAlcanzado && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                  🏆 Criterio alcanzado
                </span>
              )}
              {unaFalta && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 border border-amber-200">
                  ⚡ ¡Vas bien! Falta 1 sesión
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1 line-clamp-1">{programa.objetivo_lp}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-xs flex items-center gap-1" style={{color:"var(--text-muted)"}}>
                <BarChart3 size={10} /> {sesiones.length} {t('programas.sesiones') || 'sesiones'}
              </span>
              {ultimoPct !== null && (
                <span className="text-xs font-bold flex items-center gap-1">
                  {tendencia === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
                  {tendencia === 'down' && <TrendingDown size={12} className="text-red-500" />}
                  {tendencia === 'stable' && <Minus size={12} className="text-slate-400" />}
                  <span className={tendencia === 'up' ? 'text-emerald-600' : tendencia === 'down' ? 'text-red-600' : 'text-slate-500'}>
                    {ultimoPct.toFixed(0)}%
                  </span>
                </span>
              )}
              <span className="text-xs" style={{color:"var(--text-muted)"}}>
                {t('programas.criterio')}: {programa.criterio_dominio_pct}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={e => { e.stopPropagation(); onRegistrarSesion() }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap" style={{ background: 'var(--text-primary)', color: 'var(--card)' }}>
              <span className="hidden sm:inline">{t('programas.agregarSesion')}</span>
              <span className="sm:hidden">+ {t('programas.sesiones') || 'Sesión'}</span>
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (!confirm(`¿Eliminar el programa "${programa.titulo}" y todas sus sesiones? Esta acción no se puede deshacer.`)) return
                const res = await fetch('/api/programas-aba', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'eliminar_programa', programa_id: programa.id }),
                })
                const json = await res.json()
                if (json.error) { alert(json.error); return }
                window.location.reload()
              }}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-all"
              title="Eliminar programa"
            >
              <Trash2 size={14} />
            </button>
            {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>

        {/* Mini gráfica */}
        {sesiones.length >= 2 && (
          <MiniChart chartData={chartData} minSlots={minSlots} criterio={programa.criterio_dominio_pct} />
        )}
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="p-5 space-y-5" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--muted-bg)' }}>
          {loadingDetalle ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-indigo-400" size={24} />
            </div>
          ) : detalle ? (
            <>
              {/* Gráfica completa con selector de tipo */}
              {chartData.length >= 2 && (
                <div>
                  {/* Header con selector de tipo */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      📈 Gráfica de progreso
                    </p>
                    {/* Selector de tipo */}
                    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                      {([
                        { id: 'lineas'     as const, label: t('reportes.lineas'),     emoji: '📈' },
                        { id: 'barras'     as const, label: t('reportes.barras'),     emoji: '📊' },
                        { id: 'histograma' as const, label: t('reportes.histograma'), emoji: '🗂️' },
                        { id: 'pie'        as const, label: t('reportes.pie'),        emoji: '🥧' },
                      ] as const).map(t => (
                        <button key={t.id} onClick={() => onChangeTipoGrafico(t.id)}
                          title={t.label}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                          style={tipoGrafico === t.id
                            ? { background: 'var(--card)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: 'var(--text-primary)' }
                            : { color: 'var(--text-muted)', background: 'transparent' }}>
                          {t.emoji}
                          <span className="ml-1 hidden sm:inline">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>

                    {/* ── ABA Phase Chart — segmentos con líneas verticales y labels ── */}
                    {tipoGrafico === 'lineas' && (() => {
                      // Build segments usando índices ABSOLUTOS de chartData (no de realData)
                      type Seg = { label: string; fase: string; set: string | null; startIdx: number; endIdx: number }
                      const segments: Seg[] = []
                      if (chartData.length > 0) {
                        let segStart = -1
                        let curKey = ''
                        for (let i = 0; i < chartData.length; i++) {
                          const d = chartData[i]
                          if (d.pct === null) {
                            // fin de datos reales — cerrar segmento abierto
                            if (segStart >= 0) {
                              const prev = chartData[i - 1]
                              segments.push({ label: prev.set || faseLabel[prev.fase] || prev.fase, fase: prev.fase, set: prev.set, startIdx: segStart, endIdx: i - 1 })
                              segStart = -1; curKey = ''
                            }
                            continue
                          }
                          const key = `${d.fase}||${d.set}`
                          if (key !== curKey) {
                            if (segStart >= 0) {
                              const prev = chartData[i - 1]
                              segments.push({ label: prev.set || faseLabel[prev.fase] || prev.fase, fase: prev.fase, set: prev.set, startIdx: segStart, endIdx: i - 1 })
                            }
                            segStart = i; curKey = key
                          }
                          // último punto
                          if (i === chartData.length - 1 && segStart >= 0) {
                            segments.push({ label: d.set || faseLabel[d.fase] || d.fase, fase: d.fase, set: d.set, startIdx: segStart, endIdx: i })
                          }
                        }
                      }

                      // Color palette — stable by unique fase||set key so Set 1 always = same color
                      const segColors = ['#6366f1','#ef4444','#3b82f6','#8b5cf6','#f59e0b','#10b981','#ec4899']
                      const uniqueSegKeys: string[] = []
                      segments.forEach(seg => {
                        const k = `${seg.fase}||${seg.set}`
                        if (!uniqueSegKeys.includes(k)) uniqueSegKeys.push(k)
                      })
                      const segColorMap = segments.map(seg =>
                        segColors[uniqueSegKeys.indexOf(`${seg.fase}||${seg.set}`) % segColors.length]
                      )

                      // Merge segments that share the same fase||set key into a single logical group
                      // so that returning to Set 1 after Set 2 draws on the SAME line, not a new one.
                      type MergedSeg = { key: string; label: string; fase: string; set: string | null; indices: Set<number>; color: string }
                      const mergedMap = new Map<string, MergedSeg>()
                      segments.forEach((seg, si) => {
                        const k = `${seg.fase}||${seg.set}`
                        if (!mergedMap.has(k)) {
                          mergedMap.set(k, { key: k, label: seg.label, fase: seg.fase, set: seg.set, indices: new Set(), color: segColorMap[si] })
                        }
                        const ms = mergedMap.get(k)!
                        for (let idx = seg.startIdx; idx <= seg.endIdx; idx++) ms.indices.add(idx)
                      })
                      const mergedSegments = Array.from(mergedMap.values())

                      // Divider x-positions — endIdx is 0-based, sesion is 1-based
                      const dividers = segments.slice(0, -1).map(seg => seg.endIdx + 2)

                      // Build per-point color: dot color matches its segment
                      const dotColorByIdx = chartData.map((_: any, i: number) => {
                        const segIdx = segments.findIndex(s => i >= s.startIdx && i <= s.endIdx)
                        return segIdx >= 0 ? segColorMap[segIdx] : '#6366f1'
                      })

                      const chartHeight = 260

                      return (
                        <div>
                          {/* ── Main chart — un solo LineChart con divisores y labels internos ── */}
                          <DetailChart
                            chartData={chartData}
                            chartHeight={chartHeight}
                            minSlots={minSlots}
                            programa={programa}
                            segments={segments}
                            mergedSegments={mergedSegments}
                            segColorMap={segColorMap}
                            dividers={dividers}
                            crit={crit}
                            faseLabel={faseLabel}
                          />

                          {/* ── Legend — deduplicated by fase||set key ── */}
                          <div className="flex flex-wrap gap-3 px-4 pb-3 pt-1">
                            {mergedSegments.map((seg) => {
                              const color = seg.color
                              return (
                              <span key={seg.key} className="flex items-center gap-1 text-[10px] font-bold" style={{ color }}>
                                <span className="w-4 border-t-2 inline-block" style={{ borderColor: color }} />
                                {seg.label}{seg.set && seg.fase ? ` (${faseLabel[seg.fase] || seg.fase})` : ''}
                              </span>
                              )
                            })}
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <span className="w-4 border-t-2 border-dashed border-emerald-500 inline-block" />
                              Criterio {programa.criterio_dominio_pct}%
                            </span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* ── Barras con divisores de fase/set ── */}
                    {tipoGrafico === 'barras' && (() => {
                      // Build segments same as lineas
                      type Seg = { label: string; fase: string; set: string | null; startIdx: number; endIdx: number }
                      const segs: Seg[] = []
                      const realDataB = chartData.filter((d: any) => d.pct !== null)
                      if (realDataB.length > 0) {
                        let sStart = 0
                        let curK = `${realDataB[0].fase}||${realDataB[0].set}`
                        for (let i = 1; i <= realDataB.length; i++) {
                          const k = i < realDataB.length ? `${realDataB[i].fase}||${realDataB[i].set}` : null
                          if (k !== curK) {
                            const prev = realDataB[sStart]
                            segs.push({ label: prev.set || (faseLabel[prev.fase] || prev.fase), fase: prev.fase, set: prev.set, startIdx: sStart, endIdx: i - 1 })
                            if (i < realDataB.length) { curK = k!; sStart = i }
                          }
                        }
                      }
                      const total = realDataB.length
                      const segColors = ['#6366f1','#ef4444','#3b82f6','#8b5cf6','#f59e0b','#10b981','#ec4899']
                      const uniqueBarKeys: string[] = []
                      segs.forEach(seg => { const k = `${seg.fase}||${seg.set}`; if (!uniqueBarKeys.includes(k)) uniqueBarKeys.push(k) })
                      const barColorMap = segs.map(seg => segColors[uniqueBarKeys.indexOf(`${seg.fase}||${seg.set}`) % segColors.length])
                      const dividers = segs.slice(0, -1).map(s => s.endIdx + 2)

                      return (
                        <div>
                          {segs.length > 1 && (
                            <div className="flex" style={{ paddingLeft: '44px', paddingRight: '16px' }}>
                              {segs.map((seg, i) => {
                                const width = ((seg.endIdx - seg.startIdx + 1) / total) * 100
                                const color = barColorMap[i]
                                return (
                                  <div key={i} className="flex flex-col items-center justify-end pb-1 border-r last:border-r-0"
                                    style={{ width: `${width}%`, minWidth: '28px', borderColor: '#cbd5e1' }}>
                                    <span className="text-[10px] font-black truncate px-1 text-center w-full" style={{ color }}>{seg.label}</span>
                                    <span className="text-[9px] font-semibold text-slate-400 truncate px-1 text-center w-full">
                                      {seg.set ? (faseLabel[seg.fase] || seg.fase) : ''}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 24, left: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                              <XAxis dataKey="sesion"
                                type="number"
                                domain={[0, minSlots + 1]}
                                ticks={Array.from({ length: minSlots }, (_, i) => i + 1)}
                                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                interval={Math.max(0, Math.floor(minSlots / 10) - 1)}
                                label={{ value: 'Sesión', position: 'insideBottom', offset: -10, fontSize: 10, fill: 'var(--text-muted)' }} />
                              <YAxis domain={[0, 100]} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={(v: any) => `${v}%`} width={40} />
                              <Tooltip
                                formatter={(value: any) => [`${value}%`, 'Éxito']}
                                labelFormatter={(label) => { const d = chartData[label - 1]; return d ? `Sesión ${label} · ${d.fecha}${d.set ? ` · ${d.set}` : ''}` : `Sesión ${label}` }}
                                contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'var(--card)' }}
                              />
                              {dividers.map((x, i) => <ReferenceLine key={`bd-${i}`} x={x} stroke="#64748b" strokeWidth={2} strokeDasharray="6 4" />)}
                              <ReferenceLine y={programa.criterio_dominio_pct} stroke="#10b981" strokeDasharray="6 3" strokeWidth={2} />
                              <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                {chartData.map((entry: any, index: number) => (
                                  <Cell key={index} fill={
                                    entry.pct >= programa.criterio_dominio_pct ? '#059669'
                                    : entry.pct >= 70 ? '#6366f1'
                                    : entry.pct >= 45 ? '#D97706' : '#DC2626'
                                  } />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )
                    })()}

                    {/* ── Histograma de distribución ── */}
                    {tipoGrafico === 'histograma' && (() => {
                      const critPct = programa.criterio_dominio_pct
                      const histData = [
                        { rango: '0-25%',        count: chartData.filter((d: any) => d.pct < 26).length,                    color: '#DC2626' },
                        { rango: '26-50%',       count: chartData.filter((d: any) => d.pct >= 26 && d.pct < 51).length,     color: '#D97706' },
                        { rango: '51-75%',       count: chartData.filter((d: any) => d.pct >= 51 && d.pct < 76).length,     color: '#6366f1' },
                        { rango: '76-89%',       count: chartData.filter((d: any) => d.pct >= 76 && d.pct < critPct).length, color: '#0891B2' },
                        { rango: `${critPct}%+`, count: chartData.filter((d: any) => d.pct >= critPct).length,              color: '#059669' },
                      ]
                      const maxCount = Math.max(...histData.map(h => h.count), 1)
                      return (
                        <div className="p-4">
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={histData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                              <XAxis dataKey="rango" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                                label={{ value: 'Sesiones', angle: -90, position: 'insideLeft', fontSize: 10, fill: 'var(--text-muted)' }} />
                              <Tooltip
                                formatter={(v: any) => [`${v} sesiones`, 'Cantidad']}
                                contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'var(--card)' }}
                              />
                              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                {histData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )
                    })()}

                    {/* ── Pie chart mejorado ── */}
                    {tipoGrafico === 'pie' && (() => {
                      const critPct = programa.criterio_dominio_pct
                      const realPie = chartData.filter((d: any) => d.pct !== null)
                      const pieRaw = [
                        { name: `≥${critPct}% · Criterio`, value: realPie.filter((d: any) => d.pct >= critPct).length, color: '#059669', bg: '#d1fae5' },
                        { name: '70-89% · Cerca',          value: realPie.filter((d: any) => d.pct >= 70 && d.pct < critPct).length, color: '#6366f1', bg: '#ede9fe' },
                        { name: '45-69% · En proceso',     value: realPie.filter((d: any) => d.pct >= 45 && d.pct < 70).length, color: '#D97706', bg: '#fef3c7' },
                        { name: '<45% · Inicial',          value: realPie.filter((d: any) => d.pct < 45).length, color: '#DC2626', bg: '#fee2e2' },
                      ].filter(p => p.value > 0)
                      const total = realPie.length
                      const pct = (v: number) => total > 0 ? Math.round((v / total) * 100) : 0

                      const RADIAN = Math.PI / 180
                      const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
                        if (value === 0) return null
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
                        const x = cx + radius * Math.cos(-midAngle * RADIAN)
                        const y = cy + radius * Math.sin(-midAngle * RADIAN)
                        return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">{pct(value)}%</text>
                      }

                      return (
                        <div className="p-4">
                          <div className="flex flex-col sm:flex-row items-center gap-4">
                            {/* Donut */}
                            <div className="w-full sm:w-auto sm:shrink-0">
                              <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                  <Pie data={pieRaw} dataKey="value" nameKey="name"
                                    cx="50%" cy="50%"
                                    innerRadius={55} outerRadius={95}
                                    paddingAngle={2}
                                    labelLine={false}
                                    label={renderLabel}>
                                    {pieRaw.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                  </Pie>
                                  <Tooltip
                                    formatter={(v: any, name: any) => [`${v} sesiones (${pct(v)}%)`, name]}
                                    contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'var(--card)' }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                              {/* Center label */}
                              <p className="text-center -mt-2 text-xs font-bold text-slate-400">{total} sesiones</p>
                            </div>

                            {/* Legend cards */}
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              {pieRaw.map(p => (
                                <div key={p.name} className="rounded-xl p-3 flex items-center gap-2.5" style={{ background: p.bg }}>
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: p.color }} />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-black truncate" style={{ color: p.color }}>{p.value} sesiones</p>
                                    <p className="text-[10px] text-slate-500 font-semibold truncate">{p.name}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Sets / Objetivos CP */}
              {detalle.objetivos_cp?.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">🎯 Sets / Objetivos</p>
                  <div className="space-y-2">
                    {[...detalle.objetivos_cp].sort((a: any, b: any) => (a.numero_set ?? 0) - (b.numero_set ?? 0)).map((obj: any) => (
                      <div key={obj.id} className={`flex items-center gap-3 p-3 rounded-xl border text-sm ${
                        obj.estado === 'dominado' ? 'bg-emerald-50 border-emerald-200' :
                        obj.estado === 'en_progreso' ? 'bg-indigo-50 border-indigo-200' :
                        'bg-white border-slate-100'
                      }`}>
                        <span className="w-6 h-6 bg-indigo-600 text-white rounded-full text-[10px] font-black flex items-center justify-center shrink-0">
                          {obj.numero_set}
                        </span>
                        {obj._editando ? (
                          <input
                            autoFocus
                            defaultValue={obj.descripcion}
                            onBlur={async (e) => {
                              const nueva = e.target.value.trim()
                              if (!nueva || nueva === obj.descripcion) {
                                setDetalle((prev: any) => prev ? {
                                  ...prev,
                                  objetivos_cp: prev.objetivos_cp.map((o: any) => o.id === obj.id ? { ...o, _editando: false } : o)
                                } : prev)
                                return
                              }
                              const res = await fetch('/api/programas-aba', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'actualizar_objetivo', objetivo_id: obj.id, descripcion: nueva }),
                              })
                              const json = await res.json()
                              if (json.error) { toast.error(json.error); return }
                              toast.success('✏️ Set actualizado')
                              fetchDetalle()
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            className="flex-1 text-sm font-medium bg-white border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-300 text-slate-700"
                          />
                        ) : (
                          <span className="flex-1 font-medium text-slate-700">{obj.descripcion}</span>
                        )}
                        <button
                          onClick={() => setDetalle((prev: any) => prev ? {
                            ...prev,
                            objetivos_cp: prev.objetivos_cp.map((o: any) => o.id === obj.id ? { ...o, _editando: !o._editando } : o)
                          } : prev)}
                          className="p-1 text-slate-300 hover:text-indigo-400 transition-all shrink-0"
                          title="Editar descripción"
                        >
                          <Edit3 size={12} />
                        </button>
                        <select
                          value={obj.estado || 'pendiente'}
                          onChange={async (e) => {
                            const nuevoEstado = e.target.value
                            const res = await fetch('/api/programas-aba', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'actualizar_objetivo', objetivo_id: obj.id, estado: nuevoEstado }),
                            })
                            const json = await res.json()
                            if (json.error) { toast.error(json.error); return }
                            toast.success(`Set ${obj.numero_set} → ${nuevoEstado === 'dominado' ? '✅ Dominado' : nuevoEstado === 'en_progreso' ? '🔄 En progreso' : '⏳ Pendiente'}`)
                            // Recargar detalle completo para que el gráfico refleje el nuevo estado
                            fetchDetalle()
                          }}
                          className={`text-[10px] font-black px-2 py-1 rounded-full border-0 cursor-pointer outline-none ${
                            obj.estado === 'dominado' ? 'bg-emerald-100 text-emerald-700' :
                            obj.estado === 'en_progreso' ? 'bg-indigo-100 text-indigo-700' :
                            'bg-[var(--muted-bg)] text-[var(--text-muted)]'
                          }`}
                        >
                          <option value="pendiente">⏳ {t('programas.pendiente')}</option>
                          <option value="en_progreso">🔄 {t('programas.enProgreso')}</option>
                          <option value="dominado">✅ {t('programas.dominado')}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  {/* Agregar set adicional */}
                  <button
                    onClick={async () => {
                      const desc = prompt('Descripción del nuevo set:')
                      if (!desc?.trim()) return
                      const res = await fetch('/api/programas-aba', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'agregar_set', programa_id: programa.id, descripcion: desc.trim() }),
                      })
                      const json = await res.json()
                      if (json.error) { toast.error(json.error); return }
                      toast.success('✅ Set agregado')
                      fetchDetalle()
                    }}
                    className="mt-2 w-full py-2 border-2 border-dashed border-[var(--card-border)] rounded-xl text-xs font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all"
                  >
                    + Agregar set
                  </button>
                </div>
              )}

              {/* Últimas sesiones */}
              {detalle.sesiones_datos_aba?.length > 0 && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">📋 {t('programas.ultimasSesiones')}</p>
                  <div className="space-y-1.5">
                    {[...detalle.sesiones_datos_aba].sort((a: any, b: any) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, 6).map((s: any) => (
                      <SesionRow
                        key={s.id}
                        s={s}
                        programa={programa}
                        onDelete={async () => {
                          if (!confirm('¿Eliminar esta sesión?')) return
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'eliminar_sesion', sesion_id: s.id }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success('🗑 Sesión eliminada')
                          onDeleteSesion?.(s.id)
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).filter((x: any) => x.id !== s.id)
                            }
                          })
                        }}
                        onDateChange={async (nuevaFecha: string) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'actualizar_sesion_fecha', sesion_id: s.id, fecha: nuevaFecha }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success('📅 Fecha actualizada')
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id ? { ...x, fecha: nuevaFecha } : x
                              )
                            }
                          })
                        }}
                        onPctChange={async (pct: number, correctas: number, totales: number) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'editar_sesion',
                              sesion_id: s.id,
                              updates: { respuestas_correctas: correctas, oportunidades_totales: totales },
                            }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success('✏️ Porcentaje actualizado')
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id
                                  ? { ...x, porcentaje_exito: pct, respuestas_correctas: correctas, oportunidades_totales: totales, respuestas_incorrectas: Math.max(0, totales - correctas) }
                                  : x
                              )
                            }
                          })
                        }}
                        onSetChange={async (nuevoSet: string) => {
                          const res = await fetch('/api/programas-aba', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'editar_sesion',
                              sesion_id: s.id,
                              updates: { set: nuevoSet },
                            }),
                          })
                          const json = await res.json()
                          if (json.error) { toast.error(json.error); return }
                          toast.success(`🎯 Set cambiado a ${nuevoSet}`)
                          setDetalle((prev: any) => {
                            const base = prev ?? programa
                            return {
                              ...base,
                              sesiones_datos_aba: (base.sesiones_datos_aba || []).map((x: any) =>
                                x.id === s.id ? { ...x, set: nuevoSet } : x
                              )
                            }
                          })
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Detalles del procedimiento */}
              {(detalle.sd_estimulo || detalle.reforzadores || detalle.materiales) && (
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">📌 Procedimiento</p>
                  <div className="rounded-xl p-4 border border-[var(--card-border)] bg-[var(--card)] space-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {detalle.sd_estimulo && <p><span className="font-bold">📍 Sd:</span> {detalle.sd_estimulo}</p>}
                    {detalle.unidad_positiva && <p><span className="font-bold">✅ Unidad +:</span> {detalle.unidad_positiva}</p>}
                    {detalle.unidad_negativa && <p><span className="font-bold">❎ Unidad -:</span> {detalle.unidad_negativa}</p>}
                    {(detalle.reforzadores || detalle.ayudas) && <p><span className="font-bold">🤝🏼 Ayudas:</span> {detalle.reforzadores || detalle.ayudas}</p>}
                    {detalle.correccion_error && <p><span className="font-bold">{t('programas.correccion')}</span> {detalle.correccion_error}</p>}
                    {detalle.reforzadores && <p><span className="font-bold">Reforzadores:</span> {detalle.reforzadores}</p>}
                    {detalle.materiales && <p><span className="font-bold">Materiales:</span> {detalle.materiales}</p>}
                  </div>
                </div>
              )}
              {/* Práctica en casa del padre */}
              <PracticaCasaPanel programaId={programa.id} programaNombre={programa.titulo} objetivos={detalle?.objetivos_cp || []} />

            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Panel de práctica en casa registrada por el padre ──────────────────────────
function PracticaCasaPanel({ programaId, programaNombre, objetivos = [] }: { programaId: string; programaNombre: string; objetivos?: any[] }) {
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const desde = new Date()
        desde.setDate(desde.getDate() - 56)
        const { data, error: sbError } = await supabase
          .from('programa_practica_casa')
          .select('fecha, objetivo_id')
          .eq('programa_id', programaId)
          .gte('fecha', desde.toISOString().split('T')[0])
          .order('fecha', { ascending: false })
        if (sbError) throw new Error(sbError.message)
        // Cualquier registro existente = practicado ese día
        setRegistros((data || []).map((r: any) => ({ ...r, practicado: true })))
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [programaId])

  // Agrupar por semana (lun-dom)
  const weeks: { label: string; days: { fecha: string; practicado: boolean; label: string; objetivoId?: string }[] }[] = []
  const hoy = new Date()

  for (let w = 0; w < 4; w++) {
    const dias: { fecha: string; practicado: boolean; label: string; objetivoId?: string }[] = []
    for (let d = 6; d >= 0; d--) {
      const date = new Date(hoy)
      date.setDate(hoy.getDate() - w * 7 - d)
      const fechaStr = date.toISOString().split('T')[0]
      const reg = registros.find((r: any) => r.fecha === fechaStr)
      dias.push({
        fecha: fechaStr,
        practicado: !!reg,
        label: ['D','L','M','X','J','V','S'][date.getDay()],
        objetivoId: reg?.objetivo_id || undefined,
      })
    }
    const semanaLabel = w === 0 ? 'Esta semana' : w === 1 ? 'Semana pasada' : `Hace ${w} semanas`
    const count = dias.filter(d => d.practicado).length
    weeks.push({ label: `${semanaLabel} · ${count}/7 días`, days: dias })
  }

  const totalDias = registros.length
  const adherencia = totalDias > 0 ? Math.round((totalDias / 56) * 100) : 0

  const adherenciaColor = adherencia >= 70 ? '#059669' : adherencia >= 40 ? '#d97706' : '#dc2626'
  const adherenciaLabel = adherencia >= 70 ? 'Buena adherencia' : adherencia >= 40 ? 'Adherencia moderada' : 'Baja adherencia'

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          🏠 Práctica en casa (padre)
        </p>
        {!loading && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: `${adherenciaColor}18`, color: adherenciaColor, border: `1px solid ${adherenciaColor}30` }}>
            {adherenciaLabel} · {adherencia}%
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cargando registros...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--card)', border: '1px solid #fca5a5' }}>
          <p className="text-xs font-medium text-red-500">Error al cargar: {error}</p>
          <p className="text-[10px] text-red-400 mt-1">Tabla: programa_practica_casa · ID: {programaId?.slice(0,8)}...</p>
        </div>
      ) : registros.length === 0 ? (
        <div className="rounded-xl p-4 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            El padre aún no ha registrado práctica en casa para este programa.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {weeks.map((week, wi) => (
            <div key={wi} className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <p className="text-[10px] font-bold mb-2.5" style={{ color: 'var(--text-muted)' }}>{week.label}</p>
              <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-1 min-w-[280px]">
                {week.days.map((day, di) => {
                  const obj = day.objetivoId ? objetivos.find((o: any) => o.id === day.objetivoId) : null
                  return (
                    <div key={di} className="flex flex-col items-center gap-1">
                      <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>{day.label}</span>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                          background: day.practicado ? 'rgba(5,150,105,0.15)' : 'var(--muted-bg)',
                          border: `1.5px solid ${day.practicado ? '#059669' : 'var(--card-border)'}`,
                        }}>
                        {day.practicado
                          ? <CheckCircle2 size={14} color="#059669" />
                          : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--card-border)', display: 'block' }} />
                        }
                      </div>
                      {obj && (
                        <span className="text-[8px] font-black text-center leading-tight" style={{ color: '#059669' }}>
                          Set {obj.numero_set}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fila de sesión con edición de fecha inline ────────────────────────────────
function SesionRow({ s, programa, onDelete, onDateChange, onPctChange, onSetChange }: {
  s: any; programa: any; onDelete: () => void; onDateChange: (fecha: string) => void; onPctChange: (pct: number, correctas: number, totales: number) => void; onSetChange: (nuevoSet: string) => void
}) {
  const [editingDate, setEditingDate] = useState(false)
  const [tempDate, setTempDate] = useState(s.fecha)
  const [editingPct, setEditingPct] = useState(false)
  const [tempCorrectas, setTempCorrectas] = useState(String(s.respuestas_correctas ?? ''))
  const [tempTotales, setTempTotales] = useState(String(s.oportunidades_totales ?? ''))
  const [editingSet, setEditingSet] = useState(false)
  const availableSets: string[] = [...(programa.objetivos_cp || [])].sort((a: any, b: any) => (a.numero_set ?? 0) - (b.numero_set ?? 0)).map((o: any) =>
    o.numero_set ? `Set ${o.numero_set}` : o.descripcion
  )

  const commitPct = () => {
    setEditingPct(false)
    const c = parseInt(tempCorrectas)
    const t = parseInt(tempTotales)
    if (!isNaN(c) && !isNaN(t) && t > 0) {
      onPctChange(Math.round((c / t) * 100), c, t)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-xl p-3 border border-[var(--card-border)] bg-[var(--card)] text-xs flex-wrap">
      {/* Fecha: click para editar */}
      {editingDate ? (
        <input
          type="date"
          autoFocus
          value={tempDate}
          onChange={e => setTempDate(e.target.value)}
          onBlur={() => {
            setEditingDate(false)
            if (tempDate && tempDate !== s.fecha) onDateChange(tempDate)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') { setTempDate(s.fecha); setEditingDate(false) }
          }}
          className="w-32 rounded-lg px-2 py-0.5 text-xs font-bold outline-none border-2 border-indigo-400"
          style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
        />
      ) : (
        <button
          onClick={() => { setTempDate(s.fecha); setEditingDate(true) }}
          className="w-20 shrink-0 text-left text-slate-400 hover:text-indigo-500 hover:underline transition-colors"
          title="Haz clic para editar la fecha"
        >
          {s.fecha}
        </button>
      )}
      <FaseTag fase={s.fase} small />
      {/* Set badge — click to change */}
      {editingSet ? (
        <div className="flex items-center gap-1 flex-wrap">
          {availableSets.map(setLabel => (
            <button
              key={setLabel}
              onClick={() => { setEditingSet(false); if (setLabel !== s.set) onSetChange(setLabel) }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                setLabel === s.set
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-indigo-500 border-indigo-300 hover:bg-indigo-50'
              }`}
            >{setLabel}</button>
          ))}
          <button onClick={() => setEditingSet(false)} className="text-slate-400 hover:text-slate-600 text-[10px] px-1">✕</button>
        </div>
      ) : (
        <button
          onClick={() => setEditingSet(true)}
          title="Clic para cambiar de set"
          className="text-indigo-500 font-semibold text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded-md hover:bg-indigo-100 transition-colors"
        >
          {s.set || <span className="text-slate-400">set?</span>}
        </button>
      )}
      {s.porcentaje_exito !== null && (
        editingPct ? (
          <span className="flex items-center gap-1">
            <input
              type="number" min={0} max={s.oportunidades_totales || 999} autoFocus
              value={tempCorrectas}
              onChange={e => setTempCorrectas(e.target.value)}
              onBlur={commitPct}
              onKeyDown={e => { if (e.key === 'Enter') commitPct(); if (e.key === 'Escape') setEditingPct(false) }}
              className="w-10 rounded-md px-1 py-0.5 text-xs font-bold outline-none border-2 border-indigo-400 text-center"
              style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              title="Respuestas correctas"
            />
            <span className="text-slate-400">/</span>
            <input
              type="number" min={1}
              value={tempTotales}
              onChange={e => setTempTotales(e.target.value)}
              onBlur={commitPct}
              onKeyDown={e => { if (e.key === 'Enter') commitPct(); if (e.key === 'Escape') setEditingPct(false) }}
              className="w-10 rounded-md px-1 py-0.5 text-xs font-bold outline-none border-2 border-indigo-400 text-center"
              style={{ background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              title="Oportunidades totales"
            />
          </span>
        ) : (
          <button
            onClick={() => { setTempCorrectas(String(s.respuestas_correctas ?? '')); setTempTotales(String(s.oportunidades_totales ?? '')); setEditingPct(true) }}
            title="Clic para editar"
            className={`font-black hover:underline transition-colors ${
              s.porcentaje_exito >= programa.criterio_dominio_pct ? 'text-emerald-600' :
              s.porcentaje_exito >= 70 ? 'text-amber-600' : 'text-red-500'
            }`}
          >{s.porcentaje_exito}%</button>
        )
      )}
      {s.oportunidades_totales > 0 && (
        <span className="text-slate-400">{s.respuestas_correctas}/{s.oportunidades_totales}</span>
      )}
      {s.notas && <span className="text-slate-400 italic flex-1 truncate">{s.notas}</span>}
      <button
        onClick={onDelete}
        className="ml-auto p-1 text-slate-300 hover:text-red-400 shrink-0"
        title="Eliminar sesión"
      >
        <X size={13} />
      </button>
    </div>
  )
}

function FaseTag({ fase, small }: { fase: string; small?: boolean }) {
  const { t } = useI18n()
  const labels: Record<string, { label: string; border: string; color: string }> = {
    linea_base:    { label: 'Baseline',                         border: '#94a3b8', color: '#64748b' },
    intervencion:  { label: 'Intervención',                     border: '#4a6eaa', color: '#4a6eaa' },
    mantenimiento: { label: t('programas.mantenimiento'),       border: '#3a8a60', color: '#3a8a60' },
    dominado:      { label: t('programas.dominado'),            border: '#3a8a60', color: '#3a8a60' },
  }
  const cfg = labels[fase] || { label: fase, border: '#94a3b8', color: '#64748b' }
  return (
    <span className={`rounded-md font-semibold ${small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'}`}
      style={{ border: `1px solid ${cfg.border}40`, color: cfg.color, background: `${cfg.border}12` }}>
      {cfg.label}
    </span>
  )
}

// ── Modal: Registrar Sesión ──────────────────────────────────────────────────
function RegistrarSesionModal({ programa, childId, onClose, onSaved }: any) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fase: programa.fase_actual === 'linea_base' ? 'linea_base' : (programa.fase_actual || 'intervencion'),
    oportunidades_totales: '',
    respuestas_correctas: '',
    set_activo: '',
    notas: '',
    fecha: new Date().toISOString().split('T')[0],
  })

  const pct = form.oportunidades_totales && form.respuestas_correctas
    ? ((Number(form.respuestas_correctas) / Number(form.oportunidades_totales)) * 100).toFixed(1)
    : null

  const crit = programa.criterio_dominio_pct || 90
  const critSesiones = programa.criterio_sesiones_consecutivas || 2

  // Check recent sessions for criterion progress (sorted by date)
  const sesiones = [...(programa.sesiones_datos_aba || [])].sort((a: any, b: any) => (a.fecha || "").localeCompare(b.fecha || ""))
  const recentAtCrit = sesiones.slice(-critSesiones + 1).filter((s: any) => (s.porcentaje_exito ?? 0) >= crit).length
  const currentPctNum = pct ? Number(pct) : null
  const meetsThisSession = currentPctNum !== null && currentPctNum >= crit

  let criterioMsg = null
  if (pct) {
    if (meetsThisSession && recentAtCrit >= critSesiones - 1) {
      criterioMsg = { type: 'success', msg: `🏆 ¡Criterio alcanzado! ${critSesiones} sesiones consecutivas al ${crit}%` }
    } else if (meetsThisSession && critSesiones > 1) {
      const remaining = critSesiones - 1 - recentAtCrit
      if (remaining === 1) criterioMsg = { type: 'close', msg: `⚡ ¡Vas muy bien! Falta 1 sesión más al ${crit}% para dominar` }
      else criterioMsg = { type: 'progress', msg: `👍 Buen trabajo, sigue así` }
    }
  }

  const handleSave = async () => {
    if (!form.oportunidades_totales) {
      toast.error('Ingresa oportunidades totales')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/programas-aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          action: 'registrar_sesion',
          sesion: {
            programa_id: programa.id,
            child_id: childId,
            fecha: form.fecha,
            fase: form.fase,
            oportunidades_totales: Number(form.oportunidades_totales) || 0,
            respuestas_correctas: Number(form.respuestas_correctas) || 0,
            respuestas_incorrectas: Math.max(0, Number(form.oportunidades_totales) - Number(form.respuestas_correctas)),
            set: form.set_activo || null,
            notas: form.notas,
          },
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('✅ Sesión registrada')
      onSaved()
    } catch (e: any) {
      toast.error(e.message)
    } finally { setSaving(false) }
  }

  // Fetch sets for this program
  const sets = [...(programa.objetivos_cp || [])].sort((a: any, b: any) => (a.numero_set ?? 0) - (b.numero_set ?? 0))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="rounded-3xl bg-[var(--card)] w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="font-black text-lg" style={{color:"var(--text-primary)"}}>{t('programas.registrarSesion')}</h3>
              <p className="text-sm text-slate-400 mt-0.5">{programa.titulo}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--muted-bg)]"><X size={18} /></button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">{t('common.fecha')}</label>
                <input type="date" value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full p-3 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">{t('ui.phase')}</label>
                <select value={form.fase} onChange={e => setForm(f => ({ ...f, fase: e.target.value }))}
                  className="w-full p-3 bg-[var(--input-bg)] border-2 border-[var(--input-border)] rounded-xl text-sm font-bold outline-none focus:border-indigo-400">
                  <option value="linea_base">Baseline</option>
                  <option value="intervencion">{t('ui.intervention')}</option>
                  <option value="mantenimiento">{t('programas.mantenimiento')}</option>
                </select>
              </div>
            </div>

            {/* % de éxito */}
            <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">{t('programas.pctExito')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 font-bold block mb-1">{t('ui.total_opportunities')}</label>
                  <input type="number" min="0" value={form.oportunidades_totales}
                    onChange={e => setForm(f => ({ ...f, oportunidades_totales: e.target.value }))}
                    placeholder="10" className="w-full p-3 bg-white border-2 border-indigo-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 text-center text-lg" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-bold block mb-1">{t('ui.correct_responses')}</label>
                  <input type="number" min="0" value={form.respuestas_correctas}
                    onChange={e => setForm(f => ({ ...f, respuestas_correctas: e.target.value }))}
                    placeholder="8" className="w-full p-3 bg-white border-2 border-indigo-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 text-center text-lg" />
                </div>
              </div>
              {pct && (
                <div className={`mt-3 text-center py-2 rounded-xl font-black text-2xl ${
                  Number(pct) >= crit ? 'bg-emerald-100 text-emerald-700' :
                  Number(pct) >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                }`}>
                  {pct}%
                  {Number(pct) >= crit && <span className="text-sm ml-1">✅ Criterio!</span>}
                </div>
              )}
              {criterioMsg && (
                <div className={`mt-2 text-center py-1.5 px-3 rounded-lg text-xs font-bold ${
                  criterioMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  criterioMsg.type === 'close' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-50 text-slate-500'
                }`}>
                  {criterioMsg.msg}
                </div>
              )}
            </div>

            {/* Sets — reemplaza nivel de ayuda */}
            {sets.length > 0 && (
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">🎯 Set activo</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sets.map((s: any) => (
                    <button key={s.id}
                      onClick={() => setForm(f => ({ ...f, set_activo: s.numero_set ? `Set ${s.numero_set}` : s.descripcion }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        form.set_activo === (s.numero_set ? `Set ${s.numero_set}` : s.descripcion)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300'
                      }`}>
                      {s.numero_set ? `Set ${s.numero_set}` : s.descripcion}
                    </button>
                  ))}
                </div>
                <input
                  value={form.set_activo}
                  onChange={e => setForm(f => ({ ...f, set_activo: e.target.value }))}
                  placeholder="Ej: Set 2, Nivel 3 (opcional)"
                  className="w-full p-3 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
            )}

            {/* Notas */}
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">📝 Notas</label>
              <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                rows={2} placeholder="Observaciones de la sesión..."
                className="w-full p-3 rounded-xl text-sm resize-none outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={onClose} className="flex-1 py-3 text-slate-400 font-bold border-2 border-slate-100 rounded-xl hover:bg-[var(--muted-bg)]">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Guardando...' : 'Guardar Sesión'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Crear Programa ────────────────────────────────────────────────────
function CrearProgramaModal({ childId, onClose, onCreated }: any) {
  const { t } = useI18n()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    titulo: '', area: '', area_tags: [] as string[], objetivo_lp: '',
    sd_estimulo: '', correccion_error: '', reforzadores: '', materiales: '',
    unidad_positiva: '', unidad_negativa: '', generalizacion: 'Promover con la familia que realicen este ejercicio en casa.',
    total_unidades: '10u.', notas_programa: '', drive_url: '',
    tipo_medicion: 'porcentaje', criterio_dominio_pct: 90, criterio_sesiones_consecutivas: 2,
    fase_actual: 'intervencion',
  })
  const [objetivos, setObjetivos] = useState([{ descripcion: '' }])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggleAreaTag = (tag: string) => {
    setForm(f => ({
      ...f,
      area_tags: f.area_tags.includes(tag) ? f.area_tags.filter(t => t !== tag) : [...f.area_tags, tag]
    }))
  }

  const handleSave = async () => {
    if (!form.titulo || !form.objetivo_lp || !form.area) { toast.error('Título, área y objetivo son requeridos'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/programas-aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          action: 'crear_programa',
          programa: { ...form, child_id: childId,
            ayudas: form.reforzadores, // backward compat
          },
          objetivos: objetivos.filter(o => o.descripcion.trim()),
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('✅ Programa creado')
      onCreated()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const AREA_TAG_OPTIONS = Object.entries(AREA_CONFIG).map(([k, v]) => ({ key: k, ...v }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="rounded-3xl bg-[var(--card)] w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-black text-lg" style={{color:"var(--text-primary)"}}>{t('programas.nuevoPrograma')}</h3>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--muted-bg)]"><X size={18} /></button>
          </div>

          {/* Steps */}
          <div className="flex gap-1 mb-5">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? 'bg-indigo-500' : 'bg-slate-100'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('programas.paso1Info')}</p>
              {/* Área — texto libre */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">{t('programas.area')} *</label>
                <input value={form.area}
                  onChange={e => set('area', e.target.value)}
                  placeholder="Ej: Comunicación, Conducta..."
                  className="w-full rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">{t('programas.nombrePrograma')} *</label>
                <input value={form.titulo} onChange={e => set('titulo', e.target.value)}
                  placeholder={t('programas.placeholderNombre')}
                  className="w-full p-3 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">🎯 Objetivo a corto plazo 1 *</label>
                <textarea value={form.objetivo_lp} onChange={e => set('objetivo_lp', e.target.value)}
                  rows={2} placeholder="Con un criterio de éxito de 90% en 2 sesiones consecutivas, el estudiante..."
                  className="w-full p-3 rounded-xl text-sm resize-none outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">🎯 Objetivo a corto plazo 2</label>
                <textarea value={(form as any).objetivo_cp2 ?? ''} onChange={e => set('objetivo_cp2', e.target.value)}
                  rows={2} placeholder="Con un criterio de éxito de 90% en 2 sesiones consecutivas, el estudiante..."
                  className="w-full p-3 rounded-xl text-sm resize-none outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Fase inicial</label>
                <select value={form.fase_actual} onChange={e => set('fase_actual', e.target.value)}
                  className="w-full rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }}>
                  <option value="intervencion">Intervención</option>
                  <option value="linea_base">Baseline</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Paso 2 · Sets / Objetivos CP</p>
              <p className="text-xs" style={{color:"var(--text-muted)"}}>{t('programas.definePasos')}</p>
              {objetivos.map((obj, i) => (
                <div key={i} className="flex gap-2">
                  <span className="w-7 h-7 bg-indigo-600 text-white rounded-full text-xs font-black flex items-center justify-center shrink-0 mt-2.5">{i + 1}</span>
                  <input value={obj.descripcion}
                    onChange={e => {
                      const updated = [...objetivos]
                      updated[i] = { descripcion: e.target.value }
                      setObjetivos(updated)
                    }}
                    placeholder={`Set ${i + 1}: ej: Permanece sentado ${(i + 1) * 3} minutos`}
                    className="flex-1 p-3 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
                  {objetivos.length > 1 && (
                    <button onClick={() => setObjetivos(objetivos.filter((_, j) => j !== i))}
                      className="p-2.5 text-slate-300 hover:text-red-400 mt-1"><X size={14} /></button>
                  )}
                </div>
              ))}
              <button onClick={() => setObjetivos([...objetivos, { descripcion: '' }])}
                className="w-full py-2.5 border-2 border-dashed border-[var(--card-border)] rounded-xl text-sm font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-500">
                + Agregar set
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">{t('programas.criterioDominio')}</label>
                  <input type="number" min="0" max="100" value={form.criterio_dominio_pct}
                    onChange={e => set('criterio_dominio_pct', Number(e.target.value))}
                    className="w-full p-3 bg-[var(--input-bg)] border-2 border-[var(--input-border)] rounded-xl text-sm font-bold outline-none focus:border-indigo-400 text-center" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1.5">Sesiones consecutivas</label>
                  <input type="number" min="1" value={form.criterio_sesiones_consecutivas}
                    onChange={e => set('criterio_sesiones_consecutivas', Number(e.target.value))}
                    className="w-full p-3 bg-[var(--input-bg)] border-2 border-[var(--input-border)] rounded-xl text-sm font-bold outline-none focus:border-indigo-400 text-center" />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Paso 3 · Procedimiento</p>
              {[
                { key: 'materiales',       label: '📚 Materiales',                    placeholder: 'Materiales necesarios para la sesión' },
                { key: 'sd_estimulo',      label: '📍 Sd / Estímulo discriminativo',  placeholder: 'Instrucción verbal o gesto que inicia la conducta' },
                { key: 'unidad_positiva',  label: '✅ Unidad positiva',               placeholder: 'Respuesta correcta esperada' },
                { key: 'unidad_negativa',  label: '❎ Unidad negativa',              placeholder: 'Respuesta incorrecta / error' },
                { key: 'reforzadores',     label: '🤝🏼 Ayudas',                       placeholder: 'Las indicadas en el set. Ej: Gesto + verbal' },
                { key: 'correccion_error', label: '📍 Corrección del error',          placeholder: 'Cómo se corrige si la respuesta es incorrecta' },
                { key: 'generalizacion',   label: '➡️ Generalización',               placeholder: 'Promover con la familia que realicen este ejercicio en casa.' },
                { key: 'notas_programa',   label: '🙈 Notas',                         placeholder: 'Observaciones generales del programa...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs font-bold text-slate-500 block mb-1">{label}</label>
                  <textarea value={(form as any)[key] ?? ''} onChange={e => set(key, e.target.value)}
                    rows={key === 'generalizacion' || key === 'notas_programa' ? 2 : 1} placeholder={placeholder}
                    className="w-full p-3 rounded-xl text-sm resize-none outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
                </div>
              ))}
              {/* Total unidades */}
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">📍 Total</label>
                <input value={(form as any).total_unidades ?? '10u.'} onChange={e => set('total_unidades', e.target.value)}
                  placeholder="10u."
                  className="w-full p-3 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)', padding: '10px 14px' }} />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 text-slate-500 font-bold border-2 border-slate-100 rounded-xl hover:bg-[var(--muted-bg)]">
                ← Atrás
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!form.titulo || !form.objetivo_lp || !form.area}
                className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {t('programas.siguiente')} <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving}
                className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {saving ? 'Creando...' : 'Crear Programa'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
