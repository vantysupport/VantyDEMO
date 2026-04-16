'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Calendar, Users, CheckCircle2, XCircle,
  Clock, Loader2, RefreshCw, Download, TrendingUp, AlertCircle
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const STATUS_COLORS: Record<string, string> = {
  confirmed: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
  pending:   '#f59e0b',
  realizada: '#10b981',
}

function KPI({ label, value, sub, icon: Icon, bar }: any) {
  return (
    <div className="rounded-xl p-5 relative overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: bar }} />
      <div className="flex items-start justify-between pl-3 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${bar}15` }}>
          <Icon size={14} style={{ color: bar }} />
        </div>
      </div>
      <p className="text-4xl font-black leading-none pl-3 mb-1" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs pl-3" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

export default function SecretariaReportes() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'trimestre'>('mes')
  const [stats, setStats] = useState({
    total: 0, confirmed: 0, completed: 0, cancelled: 0, pending: 0,
    porDia: [] as any[], porEstado: [] as any[], porTerapeuta: [] as any[], tasaAsistencia: 0
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      let desde: Date
      if (periodo === 'semana') { desde = new Date(now); desde.setDate(now.getDate() - 7) }
      else if (periodo === 'mes') { desde = new Date(now.getFullYear(), now.getMonth(), 1) }
      else { desde = new Date(now); desde.setMonth(now.getMonth() - 3) }

      const { data } = await supabase
        .from('appointments')
        .select('id, appointment_date, status, therapist_name, appointment_type')
        .gte('appointment_date', desde.toISOString().split('T')[0])
        .order('appointment_date')
        .limit(1000)

      const apts = data || []
      const completed = apts.filter(a => ['completed','realizada'].includes(a.status))
      const cancelled = apts.filter(a => a.status === 'cancelled')

      // Por día (últimos 14 días)
      const diasMap: Record<string, number> = {}
      apts.forEach(a => { diasMap[a.appointment_date] = (diasMap[a.appointment_date] || 0) + 1 })
      const porDia = Object.entries(diasMap).slice(-14).map(([date, count]) => ({
        dia: new Date(date + 'T00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' }),
        citas: count,
      }))

      // Por estado
      const porEstado = [
        { name: 'Completadas', value: completed.length, color: '#10b981' },
        { name: 'Pendientes',  value: apts.filter(a => a.status === 'pending').length, color: '#f59e0b' },
        { name: 'Confirmadas', value: apts.filter(a => a.status === 'confirmed').length, color: '#3b82f6' },
        { name: 'Canceladas',  value: cancelled.length, color: '#ef4444' },
      ].filter(e => e.value > 0)

      // Por terapeuta
      const tMap: Record<string, number> = {}
      apts.forEach(a => { if (a.therapist_name) tMap[a.therapist_name] = (tMap[a.therapist_name] || 0) + 1 })
      const porTerapeuta = Object.entries(tMap).sort(([,a],[,b]) => b - a).slice(0, 6).map(([name, count]) => ({ name, count }))

      setStats({
        total: apts.length,
        confirmed: apts.filter(a => a.status === 'confirmed').length,
        completed: completed.length,
        cancelled: cancelled.length,
        pending:   apts.filter(a => a.status === 'pending').length,
        porDia, porEstado, porTerapeuta,
        tasaAsistencia: apts.length > 0 ? Math.round((completed.length / apts.length) * 100) : 0,
      })
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const exportCSV = async () => {
    const { data } = await supabase.from('appointments')
      .select('appointment_date, appointment_time, status, therapist_name, children(name)')
      .gte('appointment_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
      .order('appointment_date')
    const rows = [
      ['Fecha','Hora','Paciente','Terapeuta','Estado'],
      ...(data || []).map((a: any) => [a.appointment_date, a.appointment_time?.slice(0,5)||'', a.children?.name||'', a.therapist_name||'', a.status])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob); const el = document.createElement('a')
    el.href = url; el.download = `reporte_asistencia_${new Date().toISOString().slice(0,7)}.csv`; el.click()
    URL.revokeObjectURL(url); toast.success('Reporte exportado')
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #3a68a0, #10b981, #f59e0b)' }} />
        <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Reportes de Asistencia</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Estadísticas de sesiones y programación</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Período */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--card-border)' }}>
              {(['semana','mes','trimestre'] as const).map(p => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className="px-3 py-1.5 text-xs font-bold transition-all"
                  style={{ background: periodo === p ? '#3b82f6' : 'var(--muted-bg)', color: periodo === p ? '#fff' : 'var(--text-muted)' }}>
                  {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Trimestre'}
                </button>
              ))}
            </div>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              <Download size={13} /> CSV
            </button>
            <button onClick={cargar} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)', background: 'var(--muted-bg)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total citas"   value={loading ? '—' : stats.total}          sub="Este período"      icon={Calendar}     bar="#3a68a0" />
        <KPI label="Completadas"   value={loading ? '—' : stats.completed}      sub="Sesiones realizadas" icon={CheckCircle2} bar="#10b981" />
        <KPI label="Canceladas"    value={loading ? '—' : stats.cancelled}      sub="No realizadas"    icon={XCircle}      bar="#ef4444" />
        <KPI label="% Asistencia"  value={loading ? '—' : `${stats.tasaAsistencia}%`} sub="Tasa efectividad" icon={TrendingUp}   bar="#f59e0b" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Citas por día */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Citas por día</h3>
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{stats.total} total</span>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.porDia} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }} cursor={{ fill: 'var(--muted-bg)' }} />
                  <Bar dataKey="citas" name="Citas" fill="#3a68a0" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Por estado */}
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Distribución por estado</h3>
            </div>
            <div className="p-5 flex items-center gap-4">
              {stats.porEstado.length > 0 ? (
                <>
                  <ResponsiveContainer width="55%" height={160}>
                    <PieChart>
                      <Pie data={stats.porEstado} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value">
                        {stats.porEstado.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {stats.porEstado.map(e => (
                      <div key={e.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                        <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
                        <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>{e.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-[160px]">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos</p>
                </div>
              )}
            </div>
          </div>

          {/* Por terapeuta */}
          <div className="rounded-xl overflow-hidden lg:col-span-2" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <h3 className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Sesiones por terapeuta</h3>
            </div>
            <div className="p-5 space-y-3">
              {stats.porTerapeuta.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin datos para este período</p>
              ) : stats.porTerapeuta.map((t, i) => {
                const max = stats.porTerapeuta[0]?.count || 1
                const pct = Math.round((t.count / max) * 100)
                return (
                  <div key={t.name} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                      style={{ background: '#3a68a0' }}>{t.name.charAt(0)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                        <span className="text-xs font-black ml-2" style={{ color: 'var(--text-muted)' }}>{t.count}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#3a68a0' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
