'use client'

/**
 * ParentSessionAnalytics
 * ───────────────────────
 * Admin component showing how long each parent has been connected.
 * Drop this anywhere inside the admin panel.
 *
 * Features:
 * - Total time connected per parent (last N days)
 * - Session count, avg session duration, last seen date
 * - Device breakdown (mobile vs desktop)
 * - Per-parent session history timeline
 * - Days-range filter
 */

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine
} from 'recharts'
import { Clock, Users, Smartphone, Monitor, ChevronDown, ChevronUp, Loader2, RefreshCw, Calendar } from 'lucide-react'
import { formatDuration, formatDurationShort } from '@/lib/hooks/useSessionTracker'

// ── Helpers ───────────────────────────────────────────────────────────────────
function ago(isoDate: string): string {
  const diff = (Date.now() - new Date(isoDate).getTime()) / 1000
  if (diff < 60)    return 'hace unos segundos'
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function colorByTime(seconds: number): string {
  if (seconds >= 7200) return '#059669'   // ≥ 2h  green
  if (seconds >= 1800) return '#6366f1'   // ≥ 30m purple
  if (seconds >= 300)  return '#f59e0b'   // ≥ 5m  amber
  return '#94a3b8'                         // <5m   grey
}

const RANGE_OPTIONS = [
  { label: '7 días',  value: 7  },
  { label: '30 días', value: 30 },
  { label: '90 días', value: 90 },
]

export default function ParentSessionAnalytics() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/session-logs?summary=true&days=${days}`)
      const json = await res.json()
      setData(json.data || [])
    } catch { /* silently fail */ }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const totalParents = data.length
  const totalSeconds = data.reduce((a, b) => a + (b.total_seconds || 0), 0)
  const totalSessions = data.reduce((a, b) => a + (b.session_count || 0), 0)
  const avgPerParent = totalParents > 0 ? Math.round(totalSeconds / totalParents) : 0

  // Chart data: top 10 parents by time
  const chartData = data.slice(0, 10).map(p => ({
    name: p.profile?.full_name?.split(' ')[0] || 'Padre',
    minutes: Math.round((p.total_seconds || 0) / 60),
    seconds: p.total_seconds || 0,
  }))

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
            <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <h2 className="font-black text-lg leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Tiempo de Conexión · Padres
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Cuánto tiempo estuvieron conectados en los últimos {days} días</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Days range filter */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
            {RANGE_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setDays(opt.value)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={days === opt.value
                  ? { background: 'var(--text-primary)', color: 'var(--card)' }
                  : { background: 'var(--card)', color: 'var(--text-muted)' }}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-xl transition-all"
            style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Users size={15} />, label: 'Padres activos', value: totalParents, color: '#3d5a99' },
          { icon: <Clock size={15} />, label: 'Tiempo total', value: formatDurationShort(totalSeconds), color: '#5a3d99' },
          { icon: <Calendar size={15} />, label: 'Total sesiones', value: totalSessions, color: '#2d7a56' },
          { icon: <Clock size={15} />, label: 'Prom. por padre', value: formatDurationShort(avgPerParent), color: '#956020' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl p-4 relative overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: stat.color }} />
            <div className="flex items-center gap-1.5 mb-1 pl-1" style={{ color: stat.color }}>
              {stat.icon}
            </div>
            <p className="text-2xl font-black pl-1 leading-none mb-0.5" style={{ color: stat.color }}>
              {stat.value}
            </p>
            <p className="text-[11px] font-semibold pl-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-indigo-400" size={28} />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-14 rounded-2xl" style={{ border: '2px dashed var(--card-border)', background: 'var(--card)' }}>
          <Clock size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-bold text-slate-400">Sin datos de sesión en los últimos {days} días</p>
          <p className="text-xs text-slate-300 mt-1">Agrega el hook <code>useSessionTracker</code> en el portal de padres</p>
        </div>
      ) : (
        <>
          {/* ── Bar chart top 10 ── */}
          <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
              📊 Top padres por tiempo conectado (minutos)
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}m`} />
                <Tooltip
                  formatter={(v: any, _: any, props: any) => [formatDuration(props.payload.seconds), 'Tiempo total']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card)', color: 'var(--text-primary)' }}
                />
                <Bar dataKey="minutes" radius={[5, 5, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={colorByTime(entry.seconds)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Per-parent rows ── */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              👥 Desglose por padre
            </p>
            {data.map(parent => (
              <ParentRow
                key={parent.parent_id}
                parent={parent}
                expanded={expanded === parent.parent_id}
                onToggle={() => setExpanded(expanded === parent.parent_id ? null : parent.parent_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Single parent row ──────────────────────────────────────────────────────────
function ParentRow({ parent, expanded, onToggle }: { parent: any; expanded: boolean; onToggle: () => void; key?: any }) {
  const name = parent.profile?.full_name || parent.profile?.email || 'Padre desconocido'
  const initial = name.charAt(0).toUpperCase()
  const barColor = colorByTime(parent.total_seconds)
  const hasDesktop = parent.devices?.includes('desktop')
  const hasMobile  = parent.devices?.includes('mobile')

  // Build mini timeline for sparkline
  const sessionsByDay: Record<string, number> = {}
  for (const s of parent.sessions || []) {
    const day = s.started_at?.slice(0, 10)
    if (day) sessionsByDay[day] = (sessionsByDay[day] || 0) + (s.duration_seconds || 0)
  }
  const sparkData = Object.entries(sessionsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, seconds]) => ({ date, minutes: Math.round(seconds / 60) }))

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      {/* Row header */}
      <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={onToggle}>
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
          style={{ background: `linear-gradient(135deg, ${barColor}, ${barColor}99)` }}>
          {initial}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{name}</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {parent.profile?.email}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="font-black text-sm" style={{ color: barColor }}>
              {formatDuration(parent.total_seconds)}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {parent.session_count} {parent.session_count === 1 ? 'sesión' : 'sesiones'}
            </p>
          </div>

          {/* Device badges */}
          <div className="flex gap-1">
            {hasDesktop && (
              <span className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>
                <Monitor size={12} />
              </span>
            )}
            {hasMobile && (
              <span className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>
                <Smartphone size={12} />
              </span>
            )}
          </div>

          {/* Last seen */}
          {parent.last_seen && (
            <p className="text-[10px] text-right hidden md:block" style={{ color: 'var(--text-muted)', minWidth: '80px' }}>
              {ago(parent.last_seen)}
            </p>
          )}

          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '16px', background: 'var(--muted-bg)' }}>
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Tiempo total',       value: formatDuration(parent.total_seconds) },
              { label: 'Prom. por sesión',   value: formatDuration(parent.avg_session_seconds) },
              { label: 'Última conexión',    value: parent.last_seen ? new Date(parent.last_seen).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-3 text-center"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <p className="font-black text-base" style={{ color: 'var(--text-primary)' }}>{m.value}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
              </div>
            ))}
          </div>

          {/* Sparkline — minutes per day */}
          {sparkData.length >= 2 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                📅 Minutos conectado por día (últimas 2 semanas)
              </p>
              <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <ResponsiveContainer width="100%" height={90}>
                  <LineChart data={sparkData} margin={{ top: 4, right: 8, bottom: 4, left: -30 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="var(--card-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                      tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                    <Tooltip
                      formatter={(v: any) => [`${v} min`, 'Tiempo']}
                      contentStyle={{ borderRadius: '10px', fontSize: '11px', border: '1px solid var(--card-border)', background: 'var(--card)', color: 'var(--text-primary)' }}
                    />
                    <Line type="monotone" dataKey="minutes" stroke={barColor} strokeWidth={2}
                      dot={{ r: 3, fill: barColor, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Session history list */}
          {parent.sessions?.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                🕐 Historial de sesiones recientes
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {parent.sessions.slice(0, 20).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: '130px' }}>
                      {new Date(s.started_at).toLocaleString('es-PE', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <span className="font-bold" style={{ color: colorByTime(s.duration_seconds || 0) }}>
                      {s.duration_seconds ? formatDuration(s.duration_seconds) : '—'}
                    </span>
                    <span className="flex items-center gap-1 ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {s.device === 'mobile' ? <Smartphone size={10} /> : <Monitor size={10} />}
                      {s.device}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
