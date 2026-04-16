'use client'
// components/graficos/GraficoProgramaABA.tsx
// Gráfico Thread Learning: una línea por programa con cortes verticales de sets

import { useMemo } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Label
} from 'recharts'

interface SesionDato {
  fecha: string
  porcentaje_exito: number
  fase?: string
  objetivo_cp_id?: string
}

interface ObjetivoSet {
  id: string
  numero_set: number
  titulo?: string
  descripcion?: string
}

interface CambioFase {
  id: string
  fecha_cambio?: string
  created_at: string
  fase_nueva: string
  fase_anterior?: string
  motivo?: string
}

interface GraficoProgramaABAProps {
  titulo: string
  sesiones: SesionDato[]
  objetivos?: ObjetivoSet[]
  cambiosFase?: CambioFase[]
  criterio?: number   // default 90
  color?: string      // default violeta
  compact?: boolean
}

function fmtFecha(f: string) {
  if (!f) return ''
  const d = new Date(f)
  return `${d.getDate().toString().padStart(2,'0')}-${(d.getMonth()+1).toString().padStart(2,'0')}`
}

function colorPct(p: number) {
  if (p >= 90) return '#059669'
  if (p >= 70) return '#2563EB'
  if (p >= 45) return '#D97706'
  return '#DC2626'
}

const TooltipCustom = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const pct = payload[0]?.value
  return (
    <div className="rounded-xl shadow-2xl p-3 text-xs min-w-[140px]"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}>
      <p className="font-black mb-1 border-b pb-1" style={{ borderColor: 'var(--card-border)' }}>
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full inline-block" style={{ background: colorPct(pct) }} />
        <span style={{ color: 'var(--text-secondary)' }}>Logro:</span>
        <span className="font-black" style={{ color: colorPct(pct) }}>{pct}%</span>
      </div>
    </div>
  )
}

export default function GraficoProgramaABA({
  titulo,
  sesiones,
  objetivos = [],
  cambiosFase = [],
  criterio = 90,
  color = '#7c3aed',
  compact = false,
}: GraficoProgramaABAProps) {

  // Construir datos del gráfico — siempre en base a 10 sesiones (proporcional)
  const data = useMemo(() => {
    const mapped = sesiones.map((s, i) => ({
      index: i,
      fecha: fmtFecha(s.fecha),
      fechaRaw: s.fecha,
      pct: s.porcentaje_exito ?? 0,
    }))
    // Si hay menos de 10 sesiones, completar con slots vacíos para mantener escala
    const total = Math.max(10, Math.ceil(mapped.length / 10) * 10)
    const padded = [...mapped]
    while (padded.length < total) {
      padded.push({ index: padded.length, fecha: '', fechaRaw: '', pct: null as any })
    }
    return padded
  }, [sesiones])

  // Calcular en qué índice del array cae cada cambio de set
  // Un "cambio de set" ocurre cuando la sesión cambia de objetivo_cp_id o cuando hay un cambio de fase
  const setBreaks = useMemo(() => {
    const breaks: { index: number; label: string }[] = []

    // Por cambios de fase registrados
    cambiosFase.forEach(cf => {
      const fecha = cf.fecha_cambio || cf.created_at?.split('T')[0] || ''
      const idx = sesiones.findIndex(s => s.fecha >= fecha)
      if (idx > 0 && !breaks.find(b => b.index === idx)) {
        const setNum = breaks.length + 2
        breaks.push({ index: idx, label: `Set ${setNum}` })
      }
    })

    // Por cambio de objetivo_cp_id dentro de sesiones
    if (breaks.length === 0 && sesiones.length > 1) {
      let prevId = sesiones[0].objetivo_cp_id
      sesiones.forEach((s, i) => {
        if (i > 0 && s.objetivo_cp_id && s.objetivo_cp_id !== prevId) {
          const setNum = breaks.length + 2
          if (!breaks.find(b => b.index === i)) {
            breaks.push({ index: i, label: `Set ${setNum}` })
          }
          prevId = s.objetivo_cp_id
        }
      })
    }

    return breaks
  }, [cambiosFase, sesiones])

  // Calcular logro (90% en 2 sesiones consecutivas)
  const consecutivos = useMemo(() => {
    let count = 0
    for (let i = sesiones.length - 1; i >= 0; i--) {
      if ((sesiones[i].porcentaje_exito ?? 0) >= criterio) count++
      else break
    }
    return count
  }, [sesiones, criterio])

  const logrado = consecutivos >= 2
  const promedio = sesiones.length > 0
    ? Math.round(sesiones.reduce((s, x) => s + (x.porcentaje_exito ?? 0), 0) / sesiones.length)
    : 0
  const ultimoPct = sesiones.length > 0 ? (sesiones[sesiones.length - 1]?.porcentaje_exito ?? 0) : 0

  if (data.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-center text-sm"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
        <p className="font-bold">{titulo}</p>
        <p className="text-xs mt-1">Sin sesiones registradas</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>

      {/* Header del programa */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            📈 {titulo}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {sesiones.length} sesiones · Promedio: {promedio}%
            {setBreaks.length > 0 && ` · ${setBreaks.length + 1} sets`}
          </p>
        </div>
        {/* Indicador logro */}
        <div className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
          logrado
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
        }`}>
          {logrado ? '✅ LOGRO' : `🎯 ${ultimoPct}%`}
        </div>
      </div>

      {/* Etiquetas de sets sobre el gráfico */}
      {setBreaks.length > 0 && (
        <div className="relative px-14 pt-2" style={{ height: 22 }}>
          <span className="absolute text-[9px] font-black uppercase tracking-wider"
            style={{ left: 56, color: 'var(--text-muted)' }}>
            Set 1
          </span>
          {setBreaks.map((br, i) => {
            const leftPct = data.length > 1 ? (br.index / (data.length - 1)) * 100 : 0
            return (
              <span key={i}
                className="absolute text-[9px] font-black uppercase tracking-wider"
                style={{
                  left: `calc(3.5rem + ${leftPct}% * 0.82)`,
                  color: 'var(--text-muted)',
                  transform: 'translateX(-50%)',
                }}>
                {br.label}
              </span>
            )
          })}
        </div>
      )}

      {/* Gráfico */}
      <div style={{ height: compact ? 160 : 220 }} className="px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--card-border)' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
              tickFormatter={v => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={<TooltipCustom />} />

            {/* Línea criterio 90% */}
            <ReferenceLine
              y={criterio}
              stroke="#EF4444"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: `Meta ${criterio}%`, position: 'insideTopRight', fontSize: 8, fill: '#EF4444' }}
            />

            {/* Cortes verticales de set — ReferenceLine en index */}
            {setBreaks.map((br, i) => (
              <ReferenceLine
                key={i}
                x={data[br.index]?.fecha}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="0"
                label={{ value: `▼ ${br.label}`, position: 'insideTopLeft', fontSize: 8, fill: '#818cf8' }}
              />
            ))}

            {/* Línea principal */}
            <Line
              type="linear"
              dataKey="pct"
              stroke={color}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props
                const c = colorPct(payload.pct)
                return <circle key={props.key} cx={cx} cy={cy} r={4} fill={c} stroke="var(--card)" strokeWidth={2} />
              }}
              activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: 'var(--card)' }}
              name="Logro"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
