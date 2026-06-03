'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, BarChart3, Loader2,
  Users, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Search, Plus, Activity, MessageCircle, Target, Brain, Star, BookOpen, Hand, Pin
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const AREA_CONFIG: Record<string, { color: string; bg: string; label: string; Icon: any }> = {
  comunicacion: { color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200',     label: 'Comunicación', Icon: MessageCircle },
  conducta:     { color: 'text-rose-700',     bg: 'bg-rose-50 border-rose-200',       label: 'Conducta',     Icon: Target },
  cognitivo:    { color: 'text-cyan-700',  bg: 'bg-cyan-50 border-cyan-200', label: 'Cognitivo',    Icon: Brain },
  social:       { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200',label: 'Social',      Icon: Users },
  autonomia:    { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   label: 'Autonomía',    Icon: Star },
  academico:    { color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200', label: 'Académico',    Icon: BookOpen },
  sensorial:    { color: 'text-pink-700',    bg: 'bg-pink-50 border-pink-200',     label: 'Sensorial',    Icon: Hand },
}

const FASE_COLORS: Record<string, string> = {
  linea_base: '#94a3b8', intervencion: '#0284c7',
  mantenimiento: '#10b981', seguimiento: '#f59e0b',
}

function ProgramaChart({ programa, expanded }: { programa: any; expanded: boolean }) {
  const { t } = useI18n()
  const sesiones = programa.sesiones_datos_aba || []
  const data = sesiones.map((s: any, i: number) => ({
    sesion: i + 1, pct: s.porcentaje_exito, fase: s.fase, fecha: s.fecha, set: s.set_actual || s.fase
  }))
  const cambiosFase: number[] = []
  for (let i = 1; i < data.length; i++) {
    if (data[i].fase !== data[i - 1].fase) cambiosFase.push(i + 1)
  }
  const faseLabel: Record<string, string> = {
    linea_base: 'Línea Base', intervencion: 'Intervención',
    mantenimiento: 'Mantenimiento', seguimiento: 'Seguimiento',
  }
  const ultimoPct = data.length > 0 ? data[data.length - 1].pct : null
  const prevPct = data.length > 1 ? data[data.length - 2].pct : null
  const tendencia = ultimoPct === null ? 'none'
    : prevPct === null ? 'stable'
    : ultimoPct > prevPct + 3 ? 'up'
    : ultimoPct < prevPct - 3 ? 'down'
    : 'stable'

  // Detectar logro ABA: ≥90% en 2 sesiones consecutivas
  const logroABA = data.length >= 2 &&
    data[data.length - 1].pct >= 90 &&
    data[data.length - 2].pct >= 90

  const area = AREA_CONFIG[programa.area] || { color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', label: programa.area, Icon: Pin }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4">
      <div className="flex items-start gap-2 mb-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${area.bg} ${area.color}`}>
          <area.Icon size={11} /> {area.label}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          programa.fase_actual === 'intervencion' ? 'bg-sky-50 border-sky-200 text-sky-700' :
          programa.fase_actual === 'mantenimiento' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          programa.fase_actual === 'dominado' ? 'bg-green-100 border-green-200 text-green-700' :
          'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          {faseLabel[programa.fase_actual] || programa.fase_actual}
        </span>
        {logroABA && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-100 border-emerald-300 text-emerald-700 flex items-center gap-1">
            🏆 LOGRO ABA
          </span>
        )}
        {ultimoPct !== null && (
          <span className={`ml-auto font-bold text-sm flex items-center gap-1 ${
            tendencia === 'up' ? 'text-emerald-600' : tendencia === 'down' ? 'text-red-500' : 'text-slate-500'
          }`}>
            {tendencia === 'up' && <TrendingUp size={12} />}
            {tendencia === 'down' && <TrendingDown size={12} />}
            {tendencia === 'stable' && <Minus size={12} />}
            {ultimoPct?.toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-slate-700 mb-1 line-clamp-1">{programa.titulo}</p>
      <p className="text-[10px] text-slate-400 mb-3 line-clamp-1">{programa.objetivo_lp}</p>

      {data.length >= 2 ? (
        expanded ? (
          <>
            {/* Leyenda fases */}
            <div className="flex gap-2 mb-2 flex-wrap">
              {Object.entries(faseLabel).map(([key, lbl]) => {
                if (!data.some((d: any) => d.fase === key)) return null
                return (
                  <span key={key} className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: FASE_COLORS[key] }} />
                    {lbl}
                  </span>
                )
              })}
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                <span className="w-4 border-t-2 border-dashed border-emerald-400" />
                Criterio {programa.criterio_dominio_pct}%
              </span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{ top: 10, right: 16, bottom: 20, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sesion" tick={{ fontSize: 10 }} ticks={Array.from({length: Math.ceil((data.length || 1) / 10) * 10 + 1}, (_, i) => i).filter(i => i % 10 === 0 || i === 1 || i <= data.length).slice(0, 20)} label={{ value: t('programas.sesionLabel'), position: 'insideBottom', offset: -6, fontSize: 10 }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]} width={36} />
                <Tooltip
                  formatter={(v: any) => [`${v}%`, 'Éxito']}
                  labelFormatter={(l) => {
                    const d = data.find((s: any) => s.sesion === l)
                    return d ? `Sesión ${l} · ${d.fecha} · ${faseLabel[d.fase] || d.fase}` : `Sesión ${l}`
                  }}
                />
                {cambiosFase.map(x => (
                  <ReferenceLine key={x} x={x} stroke="#e2e8f0" strokeDasharray="3 3" />
                ))}
                <ReferenceLine y={programa.criterio_dominio_pct} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5}
                  label={{ value: `${programa.criterio_dominio_pct}%`, position: 'right', fontSize: 9, fill: '#10b981' }} />
                <Line type="linear" dataKey="pct" stroke="#0284c7" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0284c7', strokeWidth: 0 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </>
        ) : (
          <ResponsiveContainer width="100%" height={56}>
            <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 0 }}>
              <Line type="linear" dataKey="pct" stroke="#0284c7" strokeWidth={2} dot={false} />
              <ReferenceLine y={programa.criterio_dominio_pct} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        )
      ) : (
        <div className="h-12 flex items-center justify-center text-[10px] text-slate-300 gap-1">
          <BarChart3 size={12} /> {data.length === 0 ? 'Sin sesiones aún' : 'Se necesitan 2+ sesiones para la gráfica'}
        </div>
      )}
      <div className="mt-2 text-[10px] text-slate-400 text-right">{sesiones.length} {sesiones.length !== 1 ? t('programas.sesionesPlural') : t('programas.sesionPlural')}</div>
    </div>
  )
}

export default function DashboardGraficasABA({ onIrAPacientes }: { onIrAPacientes: () => void }) {
  const { t, locale } = useI18n()
  const [pacientes, setPacientes] = useState<any[]>([])
  const [programasPorPaciente, setProgramasPorPaciente] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [graficasExpandidas, setGraficasExpandidas] = useState<Record<string, boolean>>({})
  const [busqueda, setBusqueda] = useState('')
  const [soloConDatos, setSoloConDatos] = useState(false)

  useEffect(() => {
    cargarTodo()
  }, [])

  const cargarTodo = async () => {
    setLoading(true)
    try {
      const { data: ninos } = await supabase.from('children').select('*').order('name')
      if (!ninos) return

      const programasPorPac: Record<string, any[]> = {}
      await Promise.all(
        ninos.map(async (n: any) => {
          const res = await fetch(`/api/programas-aba?child_id=${n.id}&locale=${localStorage.getItem('vanty_locale') || 'es'}`)
          const json = await res.json()
          programasPorPac[n.id] = json.data || []
        })
      )
      setPacientes(ninos)
      setProgramasPorPaciente(programasPorPac)
    } finally {
      setLoading(false)
    }
  }

  const togglePaciente = (id: string) => setExpandidos(p => ({ ...p, [id]: !p[id] }))
  const toggleGrafica = (id: string) => setGraficasExpandidas(p => ({ ...p, [id]: !p[id] }))

  const pacientesFiltrados = pacientes.filter(p => {
    const matchBusqueda = p.name?.toLowerCase().includes(busqueda.toLowerCase())
    const programas = programasPorPaciente[p.id] || []
    const tieneDatos = programas.some((prog: any) => (prog.sesiones_datos_aba || []).length > 0)
    return matchBusqueda && (!soloConDatos || tieneDatos)
  })

  const totalProgramas = Object.values(programasPorPaciente).flat().length
  const totalSesiones = Object.values(programasPorPaciente).flat()
    .reduce((acc: number, p: any) => acc + (p.sesiones_datos_aba?.length || 0), 0)
  const totalDominados = Object.values(programasPorPaciente).flat()
    .filter((p: any) => p.estado === 'dominado').length

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 className="animate-spin text-sky-400" size={32} />
      <p className="text-sm text-slate-400">{t('common.cargandoPacientes')}</p>
    </div>
  )

  return (
    <div className="space-y-5 pb-10">
      {/* Resumen global */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: t('nav.pacientes'), value: pacientes.length, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Programas', value: totalProgramas, icon: Activity, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Sesiones', value: totalSesiones, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Dominados', value: totalDominados, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-800">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            {...{placeholder: t('ui.search_patient')}}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-300"
          />
        </div>
        <button
          onClick={() => setSoloConDatos(!soloConDatos)}
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
            soloConDatos
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
          }`}
        >
          Solo con datos
        </button>
        <button onClick={cargarTodo} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:border-sky-300 transition-all">
          Actualizar
        </button>
      </div>

      {/* Lista de pacientes */}
      {pacientesFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <BarChart3 size={36} className="text-slate-200 mx-auto mb-3" />
          <p className="font-bold text-slate-500 mb-1">
            {soloConDatos ? 'Ningún paciente tiene sesiones registradas aún' : 'No se encontraron pacientes'}
          </p>
          <p className="text-xs text-slate-400 mb-4">
            {soloConDatos
              ? 'Ve a Pacientes, abre un paciente y registra sesiones ABA'
              : 'Intenta con otro término de búsqueda'}
          </p>
          <button onClick={onIrAPacientes}
            className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 transition-all flex items-center gap-2 mx-auto">
            <Users size={15} /> Ir a Pacientes
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {pacientesFiltrados.map(paciente => {
            const programas = programasPorPaciente[paciente.id] || []
            const sesionesTotales = programas.reduce((acc: number, p: any) => acc + (p.sesiones_datos_aba?.length || 0), 0)
            const programasActivos = programas.filter((p: any) => p.estado === 'activo').length
            const programasDominados = programas.filter((p: any) => p.estado === 'dominado').length
            const hasDatos = sesionesTotales > 0
            const isExpandido = expandidos[paciente.id]

            return (
              <div key={paciente.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                {/* Header paciente */}
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all"
                  onClick={() => togglePaciente(paciente.id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {paciente.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800 text-sm">{paciente.name}</p>
                      {paciente.diagnosis && (
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                          {paciente.diagnosis}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-slate-400">{programas.length} programa{programas.length !== 1 ? 's' : ''}</span>
                      {programasActivos > 0 && <span className="text-[11px] text-sky-500 font-bold">{programasActivos} activo{programasActivos !== 1 ? 's' : ''}</span>}
                      {programasDominados > 0 && <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-0.5"><CheckCircle2 size={10} /> {programasDominados} dominado{programasDominados !== 1 ? 's' : ''}</span>}
                      {!hasDatos && <span className="text-[11px] text-amber-500 flex items-center gap-0.5"><AlertTriangle size={10} /> Sin sesiones</span>}
                      {hasDatos && <span className="text-[11px] text-slate-400">{sesionesTotales} sesión{sesionesTotales !== 1 ? 'es' : ''}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!hasDatos && (
                      <span className="text-[10px] text-slate-300 font-medium hidden sm:block">{t('common.sinDatos')}</span>
                    )}
                    {isExpandido ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* Programas expandidos */}
                {isExpandido && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    {programas.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-400">
                        <Plus size={20} className="mx-auto mb-2 text-slate-300" />
                        Este paciente no tiene programas ABA. Crea uno desde la vista de Pacientes.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {programas.map((prog: any) => (
                          <div key={prog.id}>
                            <div
                              className="cursor-pointer"
                              onClick={() => toggleGrafica(`${paciente.id}-${prog.id}`)}
                            >
                              <div className="flex items-center justify-between mb-1 px-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {graficasExpandidas[`${paciente.id}-${prog.id}`] ? 'Ver menos' : 'Ver gráfica completa'}
                                </span>
                                {graficasExpandidas[`${paciente.id}-${prog.id}`]
                                  ? <ChevronUp size={12} className="text-slate-300" />
                                  : <ChevronDown size={12} className="text-slate-300" />}
                              </div>
                            </div>
                            <ProgramaChart
                              programa={prog}
                              expanded={!!graficasExpandidas[`${paciente.id}-${prog.id}`]}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
