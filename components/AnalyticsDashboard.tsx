'use client'
import { useI18n } from '@/lib/i18n-context'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  TrendingUp, TrendingDown, Activity, Users, Calendar, Target, 
  Award, BarChart3, Brain, Heart, Zap, Clock, CheckCircle2,
  AlertCircle, X, RefreshCw, Download
} from 'lucide-react'

// ==============================================================================
// INTERFACES
// ==============================================================================
interface AnalyticsDashboardProps {
  childId?: string;
  childName?: string;
  onClose?: () => void;
}

interface KPIData {
  totalSessions: number;
  sessionsGrowth: number;
  avgProgress: number;
  progressGrowth: number;
  goalsAchieved: number;
  totalGoals: number;
  attendanceRate: number;
  attendanceGrowth: number;
}

interface ChartDataPoint {
  date: string;
  progress: number;
  attention?: number;
  behavior?: number;
}

interface Trend {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  confidence: number;
}

// ==============================================================================
// COMPONENTE PRINCIPAL
// ==============================================================================
export default function AnalyticsDashboard({ childId, childName, onClose }: AnalyticsDashboardProps) {
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [developmentAreas, setDevelopmentAreas] = useState<any[]>([]);
  const [fechaAnalisis, setFechaAnalisis] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFechaAnalisis(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [childId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId })
      });

      if (!response.ok) throw new Error('Error cargando analytics');

      const data = await response.json();
      
      setKpiData({
        totalSessions: data.totalSessions || 0,
        sessionsGrowth: data.sessionsGrowth || 0,
        avgProgress: data.avgProgress || 0,
        progressGrowth: data.progressGrowth || 0,
        goalsAchieved: data.goalsAchieved || 0,
        totalGoals: data.totalGoals || 0,
        attendanceRate: data.attendanceRate || 0,
        attendanceGrowth: data.attendanceGrowth || 0
      });

      setChartData(data.progressOverTime || []);
      setTrends(data.trends || []);
      setDevelopmentAreas(data.developmentAreas || []);

    } catch (error) {
      console.error('Error cargando analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── EXPORTAR WORD — genera documento .docx profesional via servidor ─────────
  const exportarPDF = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await fetch('/api/reporte-word', {
        method: 'POST',
        headers: { 'x-locale': locale || 'es', 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, tipo: 'padres' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(err.error || 'Error generando reporte')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      const safeName = (childName || 'paciente').toLowerCase().replace(/\s+/g, '-')
      a.download = match?.[1] || `Reporte_${safeName}_${new Date().toISOString().slice(0,10)}.docx`
      a.href = url
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error exportando reporte:', err)
      alert('Error al generar el reporte: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl p-8 max-w-md">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-lg font-bold text-gray-800">Analizando datos...</p>
            <p className="text-sm text-gray-500">{t('dashboard.generandoInsights')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center">
        <div ref={reportRef} className="bg-white rounded-3xl shadow-2xl max-w-7xl w-full my-8">
          
          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-3xl p-8 text-white relative">
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            )}
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <BarChart3 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-black">{t('dashboard.dashboardAnalytics')}</h2>
                {childName && (
                  <p className="text-blue-100 text-lg font-medium mt-1">{childName}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4" />
              <span className="opacity-90">
                Último análisis: {fechaAnalisis}
              </span>
            </div>
          </div>

          {/* CONTENIDO */}
          <div className="p-8 space-y-6">
            
            {/* KPIs */}
            {kpiData && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard
                  title="Sesiones Totales"
                  value={kpiData.totalSessions}
                  change={kpiData.sessionsGrowth}
                  icon={<Calendar className="w-6 h-6" />}
                  color="blue"
                />
                <KPICard
                  title={t("dashboard.progresoPromedio")}
                  value={`${kpiData.avgProgress}%`}
                  change={kpiData.progressGrowth}
                  icon={<TrendingUp className="w-6 h-6" />}
                  color="green"
                />
                <KPICard
                  title="Objetivos Logrados"
                  value={`${kpiData.goalsAchieved}/${kpiData.totalGoals}`}
                  change={20}
                  icon={<Target className="w-6 h-6" />}
                  color="purple"
                />
                <KPICard
                  title="Asistencia"
                  value={`${kpiData.attendanceRate}%`}
                  change={kpiData.attendanceGrowth}
                  icon={<CheckCircle2 className="w-6 h-6" />}
                  color="yellow"
                />
              </div>
            )}

            {/* GRÁFICO DE PROGRESO */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-gray-800">{t('dashboard.evolucionProgreso')}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Activity className="w-4 h-4" />
                    <span>Últimas {chartData.length} sesiones</span>
                  </div>
                </div>
                
                <SimpleLineChart data={chartData} />
              </div>
            )}

            {/* ÁREAS DE DESARROLLO */}
            {developmentAreas.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-6">
                <h3 className="text-xl font-black text-gray-800 mb-6">{t('dashboard.areasDesarrollo')}</h3>
                
                <div className="space-y-4">
                  {developmentAreas.map((area, idx) => (
                    <DevelopmentAreaBar
                      key={idx}
                      area={area.area}
                      score={area.score}
                      maxScore={100}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* TENDENCIAS IDENTIFICADAS */}
            {trends.length > 0 && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Brain className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-black text-gray-800">{t('dashboard.insightsIA')}</h3>
                </div>

                <div className="space-y-3">
                  {trends.map((trend, idx) => (
                    <TrendCard key={idx} trend={trend} />
                  ))}
                </div>
              </div>
            )}

            {/* BOTONES DE ACCIÓN */}
            <div data-no-print className="flex gap-3 justify-end pt-4">
              <button
                onClick={loadAnalytics}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-700 flex items-center gap-2 transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                Actualizar
              </button>
              <button
                onClick={exportarPDF}
                disabled={exporting}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-200 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generando PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Exportar Reporte Word
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==============================================================================
// COMPONENTES AUXILIARES
// ==============================================================================

// KPI CARD
function KPICard({ title, value, change, icon, color }: any) {
  const isPositive = change >= 0;
  
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-yellow-500 to-yellow-600'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
          {icon}
        </div>
        <div className={`
          flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full
          ${isPositive ? 'bg-white/20' : 'bg-black/20'}
        `}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(change)}%
        </div>
      </div>
      <p className="text-sm opacity-90 font-medium mb-1">{title}</p>
      <p className="text-3xl font-black">{value}</p>
    </div>
  );
}

// GRÁFICO DE LÍNEA PROFESIONAL — SVG responsive con dimensiones reales
function SimpleLineChart({ data }: { data: ChartDataPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 800, h: 280 })
  const [tooltip, setTooltip] = useState<{ idx: number } | null>(null)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({ w: containerRef.current.clientWidth, h: 280 })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  if (!data || data.length === 0) return null

  const W = dims.w
  const H = dims.h
  const PAD = { top: 24, right: 24, bottom: 44, left: 52 }
  const iW = W - PAD.left - PAD.right
  const iH = H - PAD.top - PAD.bottom

  // Fixed domain: always multiples of 10, so 4 sessions shows in 40% of chart
  const domainMax = Math.max(10, Math.ceil(data.length / 10) * 10)

  const norm = (v: any): number => {
    if (v === null || v === undefined) return 0
    const n = Number(v)
    if (isNaN(n)) return 0
    return n <= 5 && n > 0 ? Math.round((n / 5) * 100) : Math.min(100, Math.max(0, n))
  }

  // xOf uses domainMax so 4 pts span only 4/10 of the chart width
  const xOf = (i: number) => PAD.left + (i / Math.max(1, domainMax - 1)) * iW
  const yOf = (v: number) => PAD.top + iH - (v / 100) * iH

  const series = [
    { key: 'progress',  label: 'Logro',    color: '#6366F1', shadow: '#6366F140' },
    { key: 'attention', label: 'Atención', color: '#10B981', shadow: '#10B98140' },
    { key: 'behavior',  label: 'Conducta', color: '#F59E0B', shadow: '#F59E0B40' },
  ]

  // Construir path suavizado con curvas bezier
  const smoothPath = (key: string): string => {
    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(norm((d as any)[key] ?? 0)) }))
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const cp1x = (pts[i - 1].x + pts[i].x) / 2
      const cp1y = pts[i - 1].y
      const cp2x = cp1x
      const cp2y = pts[i].y
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
    }
    return d
  }

  const smoothArea = (key: string): string => {
    const pts = data.map((d, i) => ({ x: xOf(i), y: yOf(norm((d as any)[key] ?? 0)) }))
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const cp1x = (pts[i - 1].x + pts[i].x) / 2
      d += ` C ${cp1x.toFixed(1)} ${pts[i - 1].y.toFixed(1)}, ${cp1x.toFixed(1)} ${pts[i].y.toFixed(1)}, ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`
    }
    const base = yOf(0)
    d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${base.toFixed(1)} L ${pts[0].x.toFixed(1)} ${base.toFixed(1)} Z`
    return d
  }

  const gridLines = [100, 90, 75, 50, 25, 0]
  // Show label every 10 sessions, always show first and last
  const labelStep = data.length <= 10 ? 1 : 10
  const activeD = tooltip !== null ? data[tooltip.idx] : null

  return (
    <div className="space-y-3">
      {/* Leyenda */}
      <div className="flex items-center gap-5 flex-wrap px-1">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} />
            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-xs font-semibold text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Contenedor SVG con dimensiones reales */}
      <div ref={containerRef} className="relative w-full" style={{ height: H }}>
        <svg
          width={W}
          height={H}
          className="overflow-visible"
        >
          <defs>
            {series.map(s => (
              <linearGradient key={s.key} id={`grad-${s.key}-${W}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="85%" stopColor={s.color} stopOpacity="0.02" />
              </linearGradient>
            ))}
            <filter id="line-shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Fondo del área del gráfico */}
          <rect
            x={PAD.left} y={PAD.top}
            width={iW} height={iH}
            fill="#F8FAFF"
            rx="8"
          />

          {/* Grid lines */}
          {gridLines.map(v => (
            <g key={v}>
              <line
                x1={PAD.left} y1={yOf(v)}
                x2={W - PAD.right} y2={yOf(v)}
                stroke={v === 90 ? '#ef444440' : v === 0 ? '#CBD5E1' : '#E2E8F0'}
                strokeWidth={v === 90 ? 2 : v === 0 ? 1.5 : 1}
                strokeDasharray={v === 90 ? '8 4' : v > 0 && v < 100 ? '4 4' : ''}
              />
              <text
                x={PAD.left - 8} y={yOf(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill={v === 90 ? '#ef4444' : '#94A3B8'}
                fontFamily="system-ui, sans-serif"
                fontWeight={v === 90 ? '700' : '600'}
              >{v === 90 ? '90% ✓' : `${v}%`}</text>
            </g>
          ))}

          {/* Áreas */}
          {series.map(s => (
            <path
              key={`area-${s.key}`}
              d={smoothArea(s.key)}
              fill={`url(#grad-${s.key}-${W})`}
            />
          ))}

          {/* Líneas suavizadas con sombra */}
          {series.map(s => (
            <path
              key={`line-${s.key}`}
              d={smoothPath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#line-shadow)"
            />
          ))}

          {/* Puntos con hover */}
          {data.map((d, i) => {
            const isActive = tooltip?.idx === i
            const px = xOf(i)
            const py = yOf(norm(d.progress))
            return (
              <g key={i}>
                {/* Zona hover invisible */}
                <rect
                  x={px - 20} y={PAD.top}
                  width={40} height={iH}
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setTooltip({ idx: i })}
                  onMouseLeave={() => setTooltip(null)}
                />
                {/* Línea vertical al hacer hover */}
                {isActive && (
                  <line
                    x1={px} y1={PAD.top}
                    x2={px} y2={PAD.top + iH}
                    stroke="#6366F1"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    opacity={0.4}
                  />
                )}
                {/* Punto progreso */}
                <circle
                  cx={px} cy={py}
                  r={isActive ? 7 : 4.5}
                  fill={isActive ? '#6366F1' : 'white'}
                  stroke="#6366F1"
                  strokeWidth={isActive ? 0 : 2.5}
                  style={{ transition: 'r 0.15s, fill 0.15s' }}
                />
                {/* Punto atención */}
                {d.attention !== undefined && (
                  <circle
                    cx={px} cy={yOf(norm(d.attention))}
                    r={isActive ? 5 : 3.5}
                    fill={isActive ? '#10B981' : 'white'}
                    stroke="#10B981"
                    strokeWidth={2}
                    style={{ transition: 'r 0.15s' }}
                  />
                )}
                {/* Punto conducta */}
                {d.behavior !== undefined && (
                  <circle
                    cx={px} cy={yOf(norm(d.behavior))}
                    r={isActive ? 5 : 3.5}
                    fill={isActive ? '#F59E0B' : 'white'}
                    stroke="#F59E0B"
                    strokeWidth={2}
                    style={{ transition: 'r 0.15s' }}
                  />
                )}
              </g>
            )
          })}

          {/* Etiquetas eje X — cada 10 slots del dominio */}
          {Array.from({ length: domainMax / 10 + 1 }, (_, i) => i * 10).map(slot => {
            const x = PAD.left + (slot / Math.max(1, domainMax - 1)) * iW
            const hasData = slot < data.length
            return (
              <g key={slot}>
                <line x1={x} y1={PAD.top + iH} x2={x} y2={PAD.top + iH + 4} stroke="#CBD5E1" strokeWidth={1} />
                <text
                  x={x} y={H - 8}
                  textAnchor="middle"
                  fontSize={11}
                  fill={hasData ? '#94A3B8' : '#CBD5E1'}
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                >{slot === 0 ? 'S1' : `S${slot}`}</text>
              </g>
            )
          })}
        </svg>

        {/* Tooltip flotante HTML (fuera del SVG para mejor estilo) */}
        {tooltip !== null && activeD && (() => {
          const px = xOf(tooltip.idx)
          const leftPct = (px / W) * 100
          const isRight = leftPct > 60
          return (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                top: 20,
                left: isRight ? 'auto' : px + 14,
                right: isRight ? W - px + 14 : 'auto',
              }}
            >
              <div className="bg-gray-900/95 backdrop-blur-sm text-white rounded-2xl px-3.5 py-3 shadow-2xl text-xs font-semibold min-w-[148px] border border-white/10">
                <p className="text-gray-300 font-bold mb-2 pb-1.5 border-b border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block"/>
                  {activeD.date}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-gray-300">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"/>Logro
                    </span>
                    <span className="font-black text-indigo-300 tabular-nums">{norm(activeD.progress)}%</span>
                  </div>
                  {activeD.attention !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/>Atención
                      </span>
                      <span className="font-black text-emerald-300 tabular-nums">{norm(activeD.attention)}%</span>
                    </div>
                  )}
                  {activeD.behavior !== undefined && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Conducta
                      </span>
                      <span className="font-black text-amber-300 tabular-nums">{norm(activeD.behavior)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}



// BARRA DE ÁREA DE DESARROLLO — diseño premium con gradiente y badge
function DevelopmentAreaBar({ area, score, maxScore }: any) {
  const percentage = Math.min(100, Math.max(0, (score / maxScore) * 100))

  const getStyle = (pct: number) => {
    if (pct >= 75) return { gradient: 'from-emerald-400 to-emerald-600', label: 'Excelente', labelColor: 'text-emerald-600 bg-emerald-50' }
    if (pct >= 50) return { gradient: 'from-blue-400 to-indigo-500',    label: 'Bien',      labelColor: 'text-indigo-600 bg-indigo-50'  }
    if (pct >= 25) return { gradient: 'from-amber-400 to-orange-500',   label: 'Regular',   labelColor: 'text-amber-600 bg-amber-50'    }
    return              { gradient: 'from-red-400 to-rose-600',         label: 'Atención',  labelColor: 'text-rose-600 bg-rose-50'       }
  }

  const style = getStyle(percentage)

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-gray-700">{area}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${style.labelColor}`}>{style.label}</span>
          <span className="text-sm font-black text-gray-900 tabular-nums">{score}<span className="text-gray-400 font-medium">/{maxScore}</span></span>
        </div>
      </div>
      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${style.gradient} rounded-full transition-all duration-1000 ease-out relative`}
          style={{ width: `${percentage}%` }}
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full" />
        </div>
      </div>
      <div className="mt-1 text-right">
        <span className="text-[10px] font-bold text-gray-400 tabular-nums">{Math.round(percentage)}%</span>
      </div>
    </div>
  )
}

// TARJETA DE TENDENCIA
function TrendCard({ trend }: { trend: Trend }) {
  const iconMap = {
    positive: { Icon: TrendingUp, bg: 'bg-green-100', text: 'text-green-600' },
    negative: { Icon: TrendingDown, bg: 'bg-red-100', text: 'text-red-600' },
    neutral: { Icon: Activity, bg: 'bg-gray-100', text: 'text-gray-600' }
  };

  const { Icon, bg, text } = iconMap[trend.type];

  return (
    <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-all">
      <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-6 h-6 ${text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-800 mb-1">{trend.title}</h4>
        <p className="text-sm text-gray-600 leading-relaxed">{trend.description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <p className="text-xs text-gray-500 font-medium">Confianza</p>
          <p className="text-lg font-black text-gray-900">{trend.confidence}%</p>
        </div>
      </div>
    </div>
  );
}