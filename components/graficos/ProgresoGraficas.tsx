'use client'

import { useI18n } from '@/lib/i18n-context'
// components/graficos/ProgresoGraficas.tsx — Gráficos ABA profesionales

import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  Legend, ReferenceLine, Cell, PieChart, Pie, ComposedChart, Area, LabelList
} from 'recharts'

interface ProgresoGraficasProps { childId: string; modoParent?: boolean }
type TipoGrafico = 'lineas' | 'barras' | 'combinado' | 'histograma' | 'pie' | 'radar'

const TIPOS: { id: TipoGrafico; label: string; emoji: string; desc: string }[] = [
  { id: 'lineas',     label: 'Líneas',     emoji: '📈', desc: 'Evolución temporal' },
  { id: 'barras',     label: 'Barras',     emoji: '📊', desc: 'Comparación por sesión' },
  { id: 'combinado',  label: 'Combinado',  emoji: '📉', desc: 'Línea + área' },
  { id: 'histograma', label: 'Histograma', emoji: '🗂️', desc: 'Distribución de logros' },
  { id: 'pie',        label: 'Pie Chart',  emoji: '🥧', desc: 'Proporción de niveles' },
  { id: 'radar',      label: 'Radar',      emoji: '🎯', desc: 'Perfil de habilidades' },
]

const C = { logro: '#5B21B6', atencion: '#059669', tolerancia: '#D97706', comunicacion: '#0891B2', criterio: '#EF4444' }
const CRITERIO_PCT = 90
const CRITERIO_SESS = 2

function colorLogro(p: number) { return p >= 90 ? '#059669' : p >= 70 ? '#2563EB' : p >= 45 ? '#D97706' : '#DC2626' }
function fmtFecha(f: string) {
  if (!f) return ''
  const [, m, d] = f.split('-')
  return `${d}-${'ene,feb,mar,abr,may,jun,jul,ago,sep,oct,nov,dic'.split(',')[parseInt(m)-1]}`
}

function TooltipABA({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const logro = payload.find((p: any) => p.dataKey === 'logro')?.value
  // label is now the session number "n"; get actual date from payload
  const fechaStr = payload[0]?.payload?.fecha
  const displayLabel = fechaStr ? `S${label} · ${fmtFecha(fechaStr)}` : `Sesión ${label}`
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--card-border)", color: "var(--text-primary)" }} className="rounded-2xl shadow-2xl p-3 text-xs min-w-[160px]">
      <p className="font-black mb-2 border-b pb-1" style={{ color: "var(--text-primary)", borderColor: "var(--card-border)" }}>{displayLabel}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-3 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span style={{ color: "var(--text-secondary)" }}>{p.name}</span>
          </span>
          <span className="font-black" style={{ color: p.color }}>{p.value}%</span>
        </div>
      ))}
      {logro != null && (
        <div className={`mt-2 pt-1 border-t border-slate-100 text-center font-bold rounded-lg py-1 text-[10px] ${
          logro >= 90 ? 'bg-emerald-50 text-emerald-700' : logro >= 70 ? 'bg-blue-50 text-blue-700' : logro >= 45 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
        }`}>
          {logro >= 90 ? '✅ Criterio logrado' : logro >= 70 ? '🔵 Avanzando' : logro >= 45 ? '🟡 En proceso' : '🔴 Requiere ajuste'}
        </div>
      )}
    </div>
  )
}

function TickY({ x, y, payload }: any) {
  return <text x={x} y={y} dy={4} textAnchor="end" fill={payload.value === 90 ? '#EF4444' : 'var(--text-muted)'} fontSize={10} fontWeight={payload.value === 90 ? 700 : 400}>{payload.value}%</text>
}

export default function ProgresoGraficas({ childId, modoParent = false }: ProgresoGraficasProps) {
  const { t } = useI18n()
  const [datos, setDatos]     = useState<any>(null)
  const [cargando, setCargando] = useState(true)
  const [semanas, setSemanas] = useState(12)
  const [tipo, setTipo]       = useState<TipoGrafico>('lineas')
  const [selector, setSelector] = useState(false)
  const [detalle, setDetalle] = useState<any>(null)

  useEffect(() => { cargar() }, [childId, semanas])

  async function cargar() {
    setCargando(true)
    try { const r = await fetch(`/api/progreso-paciente?child_id=${childId}&semanas=${semanas}&locale=${localStorage.getItem('vanty_locale') || 'es'}`); setDatos(await r.json()) }
    catch {} finally { setCargando(false) }
  }

  if (cargando) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-violet-200 border-t-violet-600" />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Cargando datos clínicos...</p>
    </div>
  )
  if (!datos) return <p className="text-center py-8" style={{ color: "var(--text-muted)" }}>Sin datos</p>

  const { graficaABA = [], asistencia, tareas, evaluaciones, reporteSemanal } = datos

  // Criterio de dominio
  let consec = 0, cumplido = false, nConsec = 0
  for (let i = graficaABA.length - 1; i >= 0; i--) {
    if (graficaABA[i].logro >= CRITERIO_PCT) { consec++; if (consec >= CRITERIO_SESS) { cumplido = true; nConsec = consec; break } }
    else break
  }
  const promedio = graficaABA.length > 0 ? Math.round(graficaABA.reduce((a: number, s: any) => a + s.logro, 0) / graficaABA.length) : 0
  const conColor = graficaABA.map((s: any) => ({ ...s, fill: colorLogro(s.logro) }))

  // X domain: show actual sessions with a small right-padding of 1 slot
  // Always minimum 10 slots so the chart doesn't look cramped
  const totalSessions = graficaABA.length
  const xDomainMax = Math.max(10, totalSessions + 1)
  // Number each session for a clean numeric X axis
  const graficaNum   = graficaABA.map((s: any, i: number) => ({ ...s, n: i + 1 }))
  const conColorNum  = conColor.map((s: any, i: number) => ({ ...s, n: i + 1 }))
  // Build sensible ticks: every 1 if ≤10, every 5 if ≤30, every 10 beyond
  const tickStep = totalSessions <= 10 ? 1 : totalSessions <= 30 ? 5 : 10
  const xTicks = Array.from({ length: Math.ceil(xDomainMax / tickStep) + 1 }, (_, i) => i * tickStep).filter(v => v >= 1 && v <= xDomainMax)

  const histo = [
    { rango: '0-25%',   label: 'Emergente', count: graficaABA.filter((s: any) => s.logro < 26).length,                  color: '#DC2626' },
    { rango: '26-50%',  label: 'Parcial',   count: graficaABA.filter((s: any) => s.logro >= 26 && s.logro < 51).length, color: '#D97706' },
    { rango: '51-75%',  label: 'Progreso',  count: graficaABA.filter((s: any) => s.logro >= 51 && s.logro < 76).length, color: '#2563EB' },
    { rango: '76-89%',  label: 'Avanzado',  count: graficaABA.filter((s: any) => s.logro >= 76 && s.logro < 90).length, color: '#0891B2' },
    { rango: '90-100%', label: 'Dominado',  count: graficaABA.filter((s: any) => s.logro >= 90).length,                 color: '#059669' },
  ]
  const pieData = histo.filter(h => h.count > 0).map(h => ({ name: h.label, value: h.count, color: h.color }))

  const ult3 = graficaABA.slice(-3)
  const avg = (key: string) => ult3.length > 0 ? Math.round(ult3.reduce((a: number, s: any) => a + (s[key] || 0), 0) / ult3.length) : 0
  const radarData = ult3.length > 0 ? [
    { h: 'Logro',        v: avg('logro') },
    { h: 'Atención',     v: avg('atencion') },
    { h: 'Tolerancia',   v: avg('tolerancia') },
    { h: 'Comunicación', v: avg('comunicacion') },
    { h: 'Asistencia',   v: asistencia?.tasa || 0 },
    { h: 'Tareas',       v: tareas?.adherencia || 0 },
  ] : []

  const tipoActual = TIPOS.find(t => t.id === tipo)
  const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  const MARGINS = { top: 8, right: 48, left: 4, bottom: 24 }
  const TIPO_LABELS: Record<string, string> = {
    lineas:     t('reportes.lineas'),
    barras:     t('reportes.barras'),
    combinado:  t('reportes.combinado'),
    histograma: t('reportes.histograma'),
    pie:        t('reportes.pie'),
    radar:      t('reportes.radar'),
  }

  return (
    <div className="space-y-4">

      {/* Controles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--muted-bg)' }}>
          {[4, 8, 12, 24].map(s => (
            <button key={s} onClick={() => setSemanas(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${semanas === s ? "text-violet-600 shadow-sm" : ""}`} style={{ background: semanas === s ? "var(--card)" : "transparent", color: semanas === s ? undefined : "var(--text-secondary)" }}>
              {s} {t('reportes.semanas').substring(0,3)}
            </button>
          ))}
        </div>
        {!modoParent && (
          <div className="relative">
            <button onClick={() => setSelector(!selector)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:border-violet-400 shadow-sm transition-all"
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
              {tipoActual?.emoji} {TIPO_LABELS[tipoActual?.id ?? 'lineas'] || tipoActual?.label}
              <svg className={`w-3 h-3 text-slate-400 transition-transform ${selector ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {selector && (
              <div className="absolute right-0 top-11 z-30 rounded-2xl shadow-2xl p-2 w-52" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                <p className="text-[10px] font-black uppercase tracking-wider px-2 py-1.5" style={{ color: "var(--text-muted)" }}>{t('ui.tipoGrafico')}</p>
                {TIPOS.map(t => (
                  <button key={t.id} onClick={() => { setTipo(t.id); setSelector(false) }}
                    className='w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all' style={{ background: tipo === t.id ? 'rgba(109,40,217,0.15)' : 'transparent', color: tipo === t.id ? '#a78bfa' : 'var(--text-secondary)' }}>
                    <span className="text-base">{t.emoji}</span>
                    <div className="flex-1"><p className="text-xs font-bold">{t.label}</p><p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.desc}</p></div>
                    {tipo === t.id && <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Criterio de dominio */}
      <div className='rounded-2xl p-4 border-2' style={{ background: cumplido ? 'rgba(6,78,59,0.15)' : consec > 0 ? 'rgba(92,57,0,0.15)' : 'var(--muted-bg)', borderColor: cumplido ? '#059669' : consec > 0 ? '#d97706' : 'var(--card-border)' }}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${cumplido ? 'bg-emerald-100' : consec > 0 ? 'bg-amber-100' : 'bg-slate-100'}`}>
            {cumplido ? '🏆' : consec > 0 ? '🔥' : '🎯'}
          </div>
          <div className="flex-1">
            <p className={`font-black text-sm`} style={{ color: cumplido ? '#059669' : consec > 0 ? '#d97706' : 'var(--text-primary)' }}>
              {t('reportes.criterioDominio')}: {CRITERIO_PCT}% {t('common.en')} {CRITERIO_SESS} {t('reportes.sesionesConsecutivas')}
            </p>
            <p className={`text-xs mt-0.5 ${cumplido ? 'text-emerald-600' : consec > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
              {cumplido ? `✅ ${t('reportes.criterioCumplido')} ${nConsec} ${t('reportes.sesiones')} ≥ ${CRITERIO_PCT}%` : consec > 0 ? `⚡ ${consec}/${CRITERIO_SESS} ${t('reportes.sesiones')} — ${t('reportes.cerca')}` : `${t('reportes.promedio')}: ${promedio}% — ${t('reportes.meta')}: ${CRITERIO_PCT}%`}
            </p>
            <div className="mt-2 bg-white rounded-full h-2 overflow-hidden border border-slate-200">
              <div className={`h-full rounded-full transition-all duration-700 ${cumplido ? 'bg-emerald-500' : consec > 0 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${Math.min(100, promedio)}%` }} />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className='font-black text-3xl tabular-nums' style={{ color: cumplido ? '#059669' : consec > 0 ? '#d97706' : 'var(--text-primary)' }}>{promedio}%</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t('reportes.promedio')}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: t('reportes.asistencia'), val: asistencia?.tasa ?? 0, sub: `${asistencia?.asistidas ?? 0} de ${asistencia?.total ?? 0} sesiones`, color: 'text-violet-700', bar: 'bg-violet-500' },
          { label: t('reportes.tareasEnCasa'), val: tareas?.adherencia ?? 0, sub: `${tareas?.completadas ?? 0} de ${tareas?.total ?? 0} tareas`, color: 'text-emerald-600', bar: 'bg-emerald-500' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
            <p className={`text-3xl font-black tabular-nums ${stat.color}`}>{stat.val}%</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{stat.sub}</p>
            <div className="mt-2 rounded-full h-2 overflow-hidden" style={{ background: "var(--muted-bg)" }}>
              <div className={`${stat.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${stat.val}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico principal */}
      {graficaABA.length > 0 ? (
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-black text-sm" style={{ color: "var(--text-primary)" }}>{tipoActual?.emoji} {t('reportes.progreso')} — {TIPO_LABELS[tipoActual?.id ?? 'lineas'] || tipoActual?.label}</h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{graficaABA.length} {t('reportes.sesiones')} · {semanas} {t('reportes.semanas')}</p>
            </div>
            {['lineas','barras','combinado'].includes(tipo) && (
              <div className="flex items-center gap-1 text-[10px] text-red-400 font-bold bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                <span className="inline-block w-4 border-t-2 border-dashed border-red-400" />
                Criterio {CRITERIO_PCT}%
              </div>
            )}
          </div>

          {/* LÍNEAS */}
          {tipo === 'lineas' && (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={graficaNum} margin={MARGINS}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="n" type="number" domain={[1, xDomainMax]} ticks={xTicks} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v: any) => `S${v}`} label={{ value: 'Sesión', position: 'insideBottom', offset: -8, fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 100]} tick={<TickY />} ticks={TICKS} />
                <Tooltip content={<TooltipABA />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <ReferenceLine y={CRITERIO_PCT} stroke={C.criterio} strokeDasharray="6 3" strokeWidth={2}
                  label={{ value: `${t('reportes.meta')} ${CRITERIO_PCT}%`, position: 'insideTopLeft', fontSize: 9, fill: C.criterio, fontWeight: 700 }} />
                <Line type="linear" dataKey="logro" stroke={C.logro} strokeWidth={3} dot={{ r: 5, fill: C.logro, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} name="Logro obj." />
                {!modoParent && <>
                  <Line type="linear" dataKey="atencion"     stroke={C.atencion}     strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Atención" />
                  <Line type="linear" dataKey="tolerancia"   stroke={C.tolerancia}   strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Tolerancia" />
                  <Line type="linear" dataKey="comunicacion" stroke={C.comunicacion} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Comunicación" />
                </>}
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* BARRAS */}
          {tipo === 'barras' && (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={conColorNum} margin={MARGINS}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="n" type="number" domain={[1, xDomainMax]} ticks={xTicks} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v: any) => `S${v}`} label={{ value: 'Sesión', position: 'insideBottom', offset: -8, fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 100]} tick={<TickY />} ticks={TICKS} />
                <Tooltip content={<TooltipABA />} />
                <ReferenceLine y={CRITERIO_PCT} stroke={C.criterio} strokeDasharray="6 3" strokeWidth={2}
                  label={{ value: t('reportes.meta'), position: 'insideTopLeft', fontSize: 9, fill: C.criterio, fontWeight: 700 }} />
                <Bar dataKey="logro" name="Logro obj." radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {conColor.map((e: any, i: number) => <Cell key={i} fill={e.fill} />)}
                  <LabelList dataKey="logro" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* COMBINADO */}
          {tipo === 'combinado' && (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={graficaNum} margin={MARGINS}>
                <defs>
                  <linearGradient id="gLogro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.logro} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.logro} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="n" type="number" domain={[1, xDomainMax]} ticks={xTicks} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickFormatter={(v: any) => `S${v}`} label={{ value: 'Sesión', position: 'insideBottom', offset: -8, fontSize: 9, fill: 'var(--text-muted)' }} />
                <YAxis domain={[0, 100]} tick={<TickY />} ticks={TICKS} />
                <Tooltip content={<TooltipABA />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <ReferenceLine y={CRITERIO_PCT} stroke={C.criterio} strokeDasharray="6 3" strokeWidth={2} />
                <Area type="linear" dataKey="logro" fill="url(#gLogro)" stroke={C.logro} strokeWidth={2.5} name="Logro obj." dot={{ r: 4, fill: C.logro, stroke: '#fff', strokeWidth: 2 }} />
                {!modoParent && <>
                  <Line type="linear" dataKey="atencion"     stroke={C.atencion}     strokeWidth={1.5} name="Atención"     dot={false} strokeDasharray="4 2" />
                  <Line type="linear" dataKey="tolerancia"   stroke={C.tolerancia}   strokeWidth={1.5} name="Tolerancia"   dot={false} strokeDasharray="4 2" />
                  <Line type="linear" dataKey="comunicacion" stroke={C.comunicacion} strokeWidth={1.5} name="Comunicación" dot={false} strokeDasharray="4 2" />
                </>}
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* HISTOGRAMA */}
          {tipo === 'histograma' && (
            <div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={histo} margin={MARGINS}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [`${v} sesión${v !== 1 ? 'es' : ''}`, '']} labelFormatter={(l: any) => `${l} — ${histo.find(h=>h.label===l)?.rango||''}`} />
                  <Bar dataKey="count" name="Sesiones" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {histo.map((e, i) => <Cell key={i} fill={e.color} />)}
                    <LabelList dataKey="count" position="top" formatter={(v: any) => v > 0 ? v : ''} style={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {histo.map(h => (
                  <div key={h.rango} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: h.color + '18', color: h.color }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                    {h.label} {h.count > 0 && <span className="font-black">({h.count})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIE CHART */}
          {tipo === 'pie' && (
            pieData.length === 0
              ? <p className="text-center text-slate-400 py-8 text-sm">{t('ui.sinDatosMostrar')}</p>
              : <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={260}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={35} paddingAngle={3} strokeWidth={2} stroke="#fff">
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [`${v} sesión${v !== 1 ? 'es' : ''}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{t('ui.distribucion')}</p>
                    {histo.map(h => (
                      <div key={h.rango} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: h.color }} />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-bold text-slate-600">{h.label}</span>
                            <span className="font-black" style={{ color: h.color }}>{h.count}</span>
                          </div>
                          <div className="bg-slate-100 rounded-full h-1 mt-0.5">
                            <div className="h-full rounded-full" style={{ background: h.color, width: graficaABA.length > 0 ? `${(h.count/graficaABA.length)*100}%` : '0%' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 text-right">Total: {graficaABA.length} sesiones</p>
                  </div>
                </div>
          )}

          {/* RADAR */}
          {tipo === 'radar' && (
            radarData.length === 0
              ? <p className="text-center text-slate-400 py-8 text-sm">Necesitas al menos 1 sesión</p>
              : <div>
                  <p className="text-xs text-slate-400 mb-1 text-center">Promedio últimas {ult3.length} sesiones</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                      <PolarGrid stroke="var(--card-border)" />
                      <PolarAngleAxis dataKey="h" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                      <Radar dataKey="v" stroke={C.logro} fill={C.logro} fillOpacity={0.15} strokeWidth={2.5} dot={{ r: 4, fill: C.logro }} />
                      <Tooltip formatter={(v: any) => [`${v}%`, '']} />
                    </RadarChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {radarData.map((d: any) => (
                      <div key={d.h} className="text-center p-2 bg-violet-50 rounded-xl">
                        <p className="font-black text-violet-700 text-lg tabular-nums">{d.v}%</p>
                        <p className="text-[10px] text-slate-500">{d.h}</p>
                      </div>
                    ))}
                  </div>
                </div>
          )}

          {/* Detalle de sesiones (click) */}
          {['lineas','barras','combinado'].includes(tipo) && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{t('ui.sesionesClic')}</p>
              <div className="flex gap-2 flex-wrap">
                {graficaABA.map((s: any, i: number) => (
                  <button key={i} onClick={() => setDetalle(detalle?.fecha === s.fecha ? null : s)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${detalle?.fecha === s.fecha ? 'border-violet-500 text-violet-400' : ''}`}
                    style={detalle?.fecha === s.fecha
                      ? { background: 'rgba(109,40,217,0.15)' }
                      : { background: 'var(--muted-bg)', color: 'var(--text-secondary)', borderColor: colorLogro(s.logro) + '50' }
                    }>
                    {fmtFecha(s.fecha)} <span className="font-black" style={{ color: colorLogro(s.logro) }}>{s.logro}%</span>
                  </button>
                ))}
              </div>
              {detalle && (
                <div className="mt-3 p-3 rounded-xl text-xs space-y-1.5" style={{ background: "var(--muted-bg)", border: "1px solid var(--card-border)" }}>
                  <p className="font-black mb-2" style={{ color: "var(--text-primary)" }}>📋 {fmtFecha(detalle.fecha)}</p>
                  {detalle.objetivo && <div><span className="font-bold" style={{ color: "var(--text-muted)" }}>Objetivo: </span><span style={{ color: "var(--text-primary)" }}>{detalle.objetivo}</span></div>}
                  {detalle.tecnicas && <div><span className="font-bold" style={{ color: "var(--text-muted)" }}>Técnicas: </span><span style={{ color: "var(--text-primary)" }}>{detalle.tecnicas}</span></div>}
                  {detalle.notas   && <div><span className="font-bold" style={{ color: "var(--text-muted)" }}>Observaciones: </span><span style={{ color: "var(--text-primary)" }}>{detalle.notas}</span></div>}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t" style={{ borderColor: "var(--card-border)" }}>
                    {[['Atención', detalle.atencion, C.atencion], ['Tolerancia', detalle.tolerancia, C.tolerancia], ['Comunicación', detalle.comunicacion, C.comunicacion]].map(([l, v, c]: any) => (
                      <div key={l} className="text-center p-2 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
                        <p className="font-black text-base tabular-nums" style={{ color: c }}>{v}%</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <p className="text-5xl mb-3">📊</p>
          <p className="text-sm font-bold" style={{ color: "var(--text-secondary)" }}>{t('ui.sinSesiones2')}</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{t('ui.registraSesiones')}</p>
        </div>
      )}

      {/* Reporte IA */}
      {reporteSemanal && !modoParent && (
        <div className="bg-gradient-to-r from-violet-50 dark:from-violet-950/40 to-purple-50 dark:to-purple-950/40 border border-violet-200 dark:border-violet-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span>🧠</span>
            <p className="font-black text-violet-800 dark:text-violet-300 text-sm">{t('reportes.analisisARIA')}</p>
            <span className="ml-auto text-[10px] bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-bold">{t('reportes.iaClinica')}</span>
          </div>
          <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed">{reporteSemanal}</p>
        </div>
      )}

      {/* Evaluaciones */}
      {!modoParent && evaluaciones && Object.keys(evaluaciones).length > 0 && (
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <h3 className="font-black text-slate-700 dark:text-slate-300 text-sm mb-3">{t('ui.evalsNeurop')}</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(evaluaciones).map(([nombre, d]: [string, any]) => (
              <div key={nombre} className="flex items-center gap-2 p-2.5 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-100 dark:border-violet-800">
                <div className="w-7 h-7 bg-violet-100 dark:bg-violet-800/50 rounded-lg flex items-center justify-center text-xs font-black text-violet-700 dark:text-violet-300">✓</div>
                <div>
                  <p className="font-black text-violet-800 dark:text-violet-300 text-xs">{nombre}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{d[0]?.created_at ? new Date(d[0].created_at).toLocaleDateString('es-PE') : 'N/A'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
