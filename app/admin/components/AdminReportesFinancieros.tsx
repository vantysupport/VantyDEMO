'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign, TrendingUp, Users, Calendar, Download,
  RefreshCw, Loader2, CheckCircle2, ArrowUpRight, ArrowDownRight,
  BarChart3, Package, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
  Legend
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const MESES     = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_L   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS    = ['#3a68a0','#10b981','#f59e0b','#0ea5e9','#ef4444','#ec4899','#06b6d4','#84cc16']
const METHODS   = ['efectivo','yape','plin','transferencia','tarjeta','otro']

// ── KPI grande con comparativa ────────────────────────────────────────────────
function KPIBig({ label, value, sub, icon: Icon, bar, delta, deltaLabel }: any) {
  const up = delta >= 0
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="absolute top-0 left-0 w-1.5 h-full rounded-l-2xl" style={{ background: bar }} />
      <div className="flex items-start justify-between pl-4 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${bar}18` }}>
          <Icon size={18} style={{ color: bar }} />
        </div>
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="font-bold leading-none pl-4 mb-1 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: 'var(--text-primary)', fontSize: 'clamp(1.1rem, 2.2vw, 2.25rem)' }}>{value}</p>
      <p className="text-xs font-bold pl-4 mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-[10px] pl-4 mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-4 py-3 shadow-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'var(--text-muted)' }}>{p.name}:</span>
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
            {p.name === 'Sesiones' ? p.value : `S/ ${Number(p.value).toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdminReportesFinancieros() {
  const toast = useToast()
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'overview' | 'pacientes' | 'servicios'>('overview')
  const [anio, setAnio]               = useState(new Date().getFullYear())
  const [mesFilter, setMesFilter]     = useState<number | null>(null) // null = todo el año

  const [raw, setRaw] = useState({ payments: [] as any[], appointments: [] as any[], specialists: [] as any[] })
  const [data, setData] = useState({
    totalAnio: 0, totalMes: 0, totalPendiente: 0, sesionesAnio: 0,
    deltaMes: 0, // % vs mes anterior
    porMes: [] as any[], porMetodo: [] as any[],
    porTerapeuta: [] as any[], porPaciente: [] as any[], porServicio: [] as any[],
    tasaCobro: 0,
  })

  const compute = useCallback((pays: any[], apts: any[], specs: any[], año: number, mes: number | null) => {
    // Build specialist lookup
    const specMap: Record<string, string> = {}
    specs.forEach(s => { specMap[s.id] = s.full_name || 'Sin nombre' })

    const paid      = pays.filter(p => p.status === 'paid')
    const pending   = pays.filter(p => p.status === 'pending')
    const sum       = (arr: any[]) => arr.reduce((a, p) => a + Number(p.amount), 0)
    const now       = new Date()
    const curMes    = now.getMonth()
    const prevMes   = curMes === 0 ? 11 : curMes - 1
    const prevAnio  = curMes === 0 ? año - 1 : año

    const paidThisMes = paid.filter(p => {
      const d = new Date(p.paid_at || p.created_at)
      return d.getMonth() === curMes && d.getFullYear() === año
    })
    const paidPrevMes = paid.filter(p => {
      const d = new Date(p.paid_at || p.created_at)
      return d.getMonth() === prevMes && d.getFullYear() === prevAnio
    })
    const thisMesTotal = sum(paidThisMes)
    const prevMesTotal = sum(paidPrevMes)
    const deltaMes = prevMesTotal > 0 ? ((thisMesTotal - prevMesTotal) / prevMesTotal) * 100 : 0

    // Por mes (12 meses)
    const porMes = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2,'0')
      const mp = paid.filter(p => (p.paid_at || p.created_at).startsWith(`${año}-${m}`))
      const pp = pending.filter(p => p.created_at.startsWith(`${año}-${m}`))
      return { mes: MESES[i], ingresos: sum(mp), pendiente: sum(pp), sesiones: mp.length }
    })

    // Por método de pago
    const porMetodo = METHODS.map((m, i) => ({
      name: m.charAt(0).toUpperCase() + m.slice(1),
      value: sum(paid.filter(p => p.payment_method === m)),
      color: COLORS[i % COLORS.length],
    })).filter(m => m.value > 0)

    // Por terapeuta — join payments → appointments via child_id
    const tMap: Record<string, { name: string; ingresos: number; sesiones: number; color: string }> = {}
    paid.forEach(p => {
      // Find appointment for this child near payment date
      const relatedApt = apts.find(a =>
        a.child_id === p.child_id &&
        a.specialist_id &&
        Math.abs(new Date(a.appointment_date).getTime() - new Date(p.paid_at || p.created_at).getTime()) < 30 * 24 * 3600 * 1000
      )
      const specId   = relatedApt?.specialist_id || null
      const specName = specId ? (specMap[specId] || 'Otro') : 'Sin asignar'
      if (!tMap[specName]) tMap[specName] = { name: specName, ingresos: 0, sesiones: 0, color: COLORS[Object.keys(tMap).length % COLORS.length] }
      tMap[specName].ingresos += Number(p.amount)
      tMap[specName].sesiones++
    })
    const porTerapeuta = Object.values(tMap).sort((a, b) => b.ingresos - a.ingresos)

    // Por paciente
    const pMap: Record<string, { name: string; ingresos: number; sesiones: number }> = {}
    paid.forEach(p => {
      const id = p.child_id || 'none'
      if (!pMap[id]) pMap[id] = { name: p.children?.name || '—', ingresos: 0, sesiones: 0 }
      pMap[id].ingresos += Number(p.amount)
      pMap[id].sesiones++
    })
    const porPaciente = Object.values(pMap).sort((a, b) => b.ingresos - a.ingresos).slice(0, 12)

    // Por servicio
    const sMap: Record<string, { value: number; count: number }> = {}
    paid.forEach(p => {
      const s = p.concept?.replace(/ \(\d+\/\d+\)$/, '') || 'Otro'
      if (!sMap[s]) sMap[s] = { value: 0, count: 0 }
      sMap[s].value += Number(p.amount)
      sMap[s].count++
    })
    const porServicio = Object.entries(sMap).sort(([,a],[,b]) => b.value - a.value)
      .map(([name, v], i) => ({ name, ...v, color: COLORS[i % COLORS.length] }))

    setData({
      totalAnio: sum(paid),
      totalMes: thisMesTotal,
      totalPendiente: sum(pending),
      sesionesAnio: paid.length,
      deltaMes,
      porMes, porMetodo, porTerapeuta, porPaciente, porServicio,
      tasaCobro: pays.length > 0 ? Math.round((paid.length / pays.length) * 100) : 0,
    })
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const inicio = `${anio}-01-01`
      const fin    = `${anio}-12-31`

      const [{ data: pays }, { data: apts }, { data: specs }] = await Promise.all([
        supabase.from('payments').select('*, children(name, id)').gte('created_at', inicio).lte('created_at', fin + 'T23:59:59').order('created_at'),
        supabase.from('appointments').select('id, child_id, appointment_date, specialist_id, service_type').gte('appointment_date', inicio).lte('appointment_date', fin),
        supabase.from('profiles').select('id, full_name').in('role', ['especialista','terapeuta','admin','jefe']),
      ])
      const p = pays || [], a = apts || [], s = specs || []
      setRaw({ payments: p, appointments: a, specialists: s })
      compute(p, a, s, anio, mesFilter)
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [anio, compute])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (raw.payments.length > 0) compute(raw.payments, raw.appointments, raw.specialists, anio, mesFilter) }, [mesFilter])

  const exportCSV = async () => {
    const rows = [['Fecha','Paciente','Concepto','Monto','Método','Estado'],
      ...raw.payments.map((p: any) => [new Date(p.created_at).toLocaleDateString('es-PE'), p.children?.name||'—', p.concept, p.amount, p.payment_method, p.status])]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `reporte_financiero_${anio}.csv`; a.click()
    URL.revokeObjectURL(url); toast.success('Reporte exportado')
  }

  const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`

  // Filtered porMes for selected month
  const chartData = mesFilter !== null ? data.porMes.filter((_, i) => i === mesFilter) : data.porMes

  return (
    <div className="space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #10b981 0%, #3a68a0 40%, #f59e0b 70%, #0ea5e9 100%)' }} />
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Reportes Financieros</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ingresos, facturación y métricas del centro · {MESES_L[new Date().getMonth()]} {anio}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Año */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--card-border)' }}>
              {[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
                <button key={y} onClick={() => setAnio(y)}
                  className="px-4 py-2 text-xs font-bold transition-all"
                  style={{ background: anio === y ? '#10b981' : 'var(--muted-bg)', color: anio === y ? '#fff' : 'var(--text-muted)' }}>
                  {y}
                </button>
              ))}
            </div>
            {/* Mes filter */}
            <select value={mesFilter ?? ''} onChange={e => setMesFilter(e.target.value === '' ? null : Number(e.target.value))}
              className="px-3 py-2 rounded-xl text-xs font-bold border-2 outline-none"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
              <option value="">Todo el año</option>
              {MESES_L.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              <Download size={13} /> CSV
            </button>
            <button onClick={cargar} className="p-2 rounded-xl transition-all hover:opacity-70"
              style={{ color: 'var(--text-muted)', background: 'var(--muted-bg)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPIBig label="Ingresos del año"    value={loading ? '—' : fmt(data.totalAnio)}         sub={`${anio}`}              icon={DollarSign}  bar="#10b981" />
        <KPIBig label="Este mes"            value={loading ? '—' : fmt(data.totalMes)}           sub={MESES_L[new Date().getMonth()]} icon={TrendingUp} bar="#3a68a0" delta={data.deltaMes} />
        <KPIBig label="Cobros realizados"   value={loading ? '—' : data.sesionesAnio}            sub={`${data.tasaCobro}% tasa de cobro`} icon={CheckCircle2} bar="#0ea5e9" />
        <KPIBig label="Por cobrar"          value={loading ? '—' : fmt(data.totalPendiente)}     sub="Pendiente de pago"     icon={Calendar}    bar="#f59e0b" />
      </div>

      {/* ── TABS ────────────────────────────────────────────────────────────── */}
      <div className="flex rounded-2xl p-1.5 border gap-1.5" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
        {[
          { id: 'overview',    label: '📈 Ingresos' },
          { id: 'pacientes',   label: '🧒 Pacientes' },
          { id: 'servicios',   label: '🏷️ Servicios' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: tab === t.id ? 'var(--card)' : 'transparent',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
              border: tab === t.id ? '1px solid var(--card-border)' : '1px solid transparent',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: '#3a68a0' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Calculando métricas...</p>
        </div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <div className="space-y-4">

              {/* Area chart — ingresos vs pendiente */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Evolución de ingresos {anio}</h3>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Ingresos cobrados vs pendientes por mes</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    {[{ color: '#10b981', label: 'Cobrado' }, { color: '#f59e0b', label: 'Pendiente' }].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm" style={{ background: l.color }} />
                        <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.porMes} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gPendiente" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `S/${v}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="ingresos" name="Cobrado"   stroke="#10b981" strokeWidth={2.5} fill="url(#gIngresos)"  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      <Area type="monotone" dataKey="pendiente" name="Pendiente" stroke="#f59e0b" strokeWidth={2} fill="url(#gPendiente)" dot={{ r: 3, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom row: método pago + sesiones por mes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Por método */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Métodos de pago</h3>
                    <DollarSign size={15} style={{ color: '#f59e0b' }} />
                  </div>
                  <div className="p-5">
                    {data.porMetodo.length === 0 ? (
                      <div className="flex items-center justify-center h-[160px]">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width="50%" height={160}>
                          <PieChart>
                            <Pie data={data.porMetodo} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={3}>
                              {data.porMetodo.map((e, i) => <Cell key={i} fill={e.color} />)}
                            </Pie>
                            <Tooltip formatter={(v: any) => `S/ ${Number(v).toFixed(2)}`}
                              contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 11, color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                              labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                              itemStyle={{ color: 'var(--text-secondary)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2.5">
                          {data.porMetodo.map(m => {
                            const total = data.porMetodo.reduce((a,x) => a + x.value, 0)
                            const pct = total > 0 ? Math.round(m.value / total * 100) : 0
                            return (
                              <div key={m.name}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                                  </div>
                                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                                  <div style={{ width: `${pct}%`, background: m.color, height: '100%', borderRadius: '999px' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sesiones por mes */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Sesiones pagadas por mes</h3>
                    <Activity size={15} style={{ color: '#3a68a0' }} />
                  </div>
                  <div className="p-5">
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={data.porMes} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="sesiones" name="Sesiones" fill="#3a68a0" radius={[5,5,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Tabla resumen mes a mes */}
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Resumen mensual {anio}</h3>
                  <button
                    onClick={async () => {
                      const res = await fetch(`/api/pagos/reporte-mensual?anio=${anio}&mes=0`)
                      if (!res.ok) { toast.error('Error generando reporte'); return }
                      const blob = await res.blob()
                      const url  = URL.createObjectURL(blob)
                      const a    = document.createElement('a')
                      a.href     = url
                      a.download = `reporte_financiero_${anio}.xlsx`
                      a.click(); URL.revokeObjectURL(url)
                      toast.success('Excel anual exportado')
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:opacity-80"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                    <Download size={12} /> Excel anual
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                        {['Mes','Sesiones','Cobrado','Pendiente','Total',''].map(h => (
                          <th key={h} className="text-left px-5 py-2.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.porMes.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--card-border)', opacity: m.ingresos + m.pendiente === 0 ? 0.4 : 1 }}>
                          <td className="px-5 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{MESES_L[i]}</td>
                          <td className="px-5 py-3" style={{ color: 'var(--text-muted)' }}>{m.sesiones}</td>
                          <td className="px-5 py-3 font-bold" style={{ color: '#10b981' }}>S/ {m.ingresos.toFixed(2)}</td>
                          <td className="px-5 py-3 font-medium" style={{ color: '#f59e0b' }}>S/ {m.pendiente.toFixed(2)}</td>
                          <td className="px-5 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>S/ {(m.ingresos + m.pendiente).toFixed(2)}</td>
                          <td className="px-3 py-3">
                            {(m.ingresos + m.pendiente) > 0 && (
                              <button
                                onClick={async () => {
                                  const res  = await fetch(`/api/pagos/reporte-mensual?anio=${anio}&mes=${i + 1}`)
                                  if (!res.ok) { toast.error('Error'); return }
                                  const blob = await res.blob()
                                  const url  = URL.createObjectURL(blob)
                                  const a    = document.createElement('a')
                                  a.href     = url; a.download = `reporte_${MESES_L[i].toLowerCase()}_${anio}.xlsx`
                                  a.click(); URL.revokeObjectURL(url)
                                  toast.success(`Excel de ${MESES_L[i]} exportado`)
                                }}
                                title={`Descargar reporte de ${MESES_L[i]}`}
                                className="p-1.5 rounded-lg transition-all hover:opacity-70"
                                style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                <Download size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--muted-bg)', borderTop: '2px solid var(--card-border)' }}>
                        <td className="px-5 py-3 font-bold text-xs" style={{ color: 'var(--text-muted)' }}>Total {anio}</td>
                        <td className="px-5 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{data.sesionesAnio}</td>
                        <td className="px-5 py-3 font-bold" style={{ color: '#10b981' }}>S/ {data.totalAnio.toFixed(2)}</td>
                        <td className="px-5 py-3 font-bold" style={{ color: '#f59e0b' }}>S/ {data.totalPendiente.toFixed(2)}</td>
                        <td className="px-5 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>S/ {(data.totalAnio + data.totalPendiente).toFixed(2)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TERAPEUTAS ── */}
          {/* ── PACIENTES ── */}
          {tab === 'pacientes' && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Ingresos por paciente {anio}</h3>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{data.porPaciente.length} pacientes</span>
                </div>
                <div className="p-5 space-y-3">
                  {data.porPaciente.length === 0 ? (
                    <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
                  ) : data.porPaciente.map((p, i) => {
                    const max = data.porPaciente[0]?.ingresos || 1
                    const pct = Math.round(p.ingresos / max * 100)
                    return (
                      <div key={p.name} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'var(--muted-bg)' }}>
                        <span className="text-[11px] font-bold w-5 text-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: COLORS[i % COLORS.length] }}>{p.name.charAt(0).toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                            <p className="text-sm font-bold ml-2 flex-shrink-0" style={{ color: '#10b981' }}>S/ {p.ingresos.toFixed(2)}</p>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--card)' }}>
                            <div style={{ width: `${pct}%`, background: COLORS[i % COLORS.length], height: '100%', borderRadius: '999px', transition: 'width 0.6s ease' }} />
                          </div>
                          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{p.sesiones} sesiones pagadas</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── SERVICIOS ── */}
          {tab === 'servicios' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Distribución por servicio</h3>
                  </div>
                  <div className="p-5">
                    {data.porServicio.length === 0 ? (
                      <div className="flex items-center justify-center h-[200px]">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={data.porServicio} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={3}>
                            {data.porServicio.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => `S/ ${Number(v).toFixed(2)}`}
                            contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 11, color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                            labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                            itemStyle={{ color: 'var(--text-secondary)' }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Ranking por servicio</h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                    {data.porServicio.slice(0, 8).map((s, i) => (
                      <div key={s.name} className="flex items-center gap-3 px-5 py-3.5">
                        <span className="text-xs font-bold w-5 text-center" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <p className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{s.name}</p>
                        <div className="text-right">
                          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>S/ {s.value.toFixed(2)}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.count} cobros</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
