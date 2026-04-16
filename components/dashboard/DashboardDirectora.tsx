'use client'
// components/dashboard/DashboardDirectora.tsx
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n-context'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Metricas {
  hoy: { fecha: string; sesiones: { total: number; realizadas: number; canceladas: number; programadas: number }; tasaAsistencia: number }
  pacientes: { total: number; nuevosMes: number; progresoPromedio: number }
  alertas: { total: number; urgentes: number; recientes: any[] }
  tareas: { total: number; completadas: number; completitudPct: number; formPendientes: number }
  financiero: { ingresosMes: number; facturasPendientes: number }
  graficas: { sesionesXFecha: any[]; cargaTerapeutas: any[] }
  proximasSesiones: any[]
}

export default function DashboardDirectora() {
  const { t } = useI18n()
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cargando, setCargando] = useState(true)
  const [periodo, setPeriodo] = useState('7d')

  useEffect(() => {
    cargarMetricas()
    const interval = setInterval(cargarMetricas, 60000) // Actualizar cada minuto
    return () => clearInterval(interval)
  }, [periodo])

  async function cargarMetricas() {
    try {
      const res = await fetch(`/api/dashboard/metricas?periodo=${periodo}`)
      const data = await res.json()
      setMetricas(data)
    } catch (err) {
      console.error('Error cargando metricas:', err)
    } finally {
      setCargando(false)
    }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  )

  if (!metricas) return <p className="text-red-500 p-4">{t('common.errorDashboard')}</p>

  const { hoy, pacientes, alertas, tareas, financiero, graficas, proximasSesiones } = metricas

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('dashboard.dashboardClinico')}</h1>
          <p className="text-gray-500 text-sm">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${periodo === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-blue-50'}`}>
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
        </div>
      </div>

      {/* Alertas urgentes banner */}
      {alertas.urgentes > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-bold text-red-700">{alertas.urgentes} alerta{alertas.urgentes > 1 ? 's' : ''} urgente{alertas.urgentes > 1 ? 's' : ''} sin resolver</p>
            <p className="text-red-600 text-sm">{t('dashboard.requierenAtencion')}</p>
          </div>
          <button className="ml-auto bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
            Ver alertas
          </button>
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          titulo="Sesiones Hoy"
          valor={`${hoy.sesiones.realizadas}/${hoy.sesiones.total}`}
          subtitulo={`${hoy.sesiones.programadas} pendientes`}
          color="blue"
          icono="📅"
          progreso={hoy.tasaAsistencia}
        />
        <KPICard
          titulo="Pacientes Activos"
          valor={pacientes.total}
          subtitulo={`+${pacientes.nuevosMes} este mes`}
          color="green"
          icono="👦"
        />
        <KPICard
          titulo="Progreso Promedio"
          valor={`${pacientes.progresoPromedio}%`}
          subtitulo="En sesiones ABA"
          color="purple"
          icono="📈"
          progreso={pacientes.progresoPromedio}
        />
        <KPICard
          titulo="Alertas Activas"
          valor={alertas.total}
          subtitulo={`${alertas.urgentes} urgentes`}
          color={alertas.urgentes > 0 ? "red" : "gray"}
          icono="🔔"
        />
      </div>

      {/* Segunda fila de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          titulo="Tareas Completadas"
          valor={`${tareas.completadas}/${tareas.total}`}
          subtitulo={`${tareas.completitudPct}% adherencia familias`}
          color="orange"
          icono="✅"
          progreso={tareas.completitudPct}
        />
        <KPICard
          titulo="Forms Pendientes"
          valor={tareas.formPendientes}
          subtitulo="Padres sin completar"
          color={tareas.formPendientes > 5 ? "red" : "gray"}
          icono="📝"
        />
        <KPICard
          titulo="Ingresos del Mes"
          valor={`S/ ${financiero.ingresosMes.toLocaleString()}`}
          subtitulo={`${financiero.facturasPendientes} facturas pendientes`}
          color="green"
          icono="💰"
        />
        <KPICard
          titulo="Asistencia Hoy"
          valor={`${hoy.tasaAsistencia}%`}
          subtitulo={`${hoy.sesiones.canceladas} canceladas`}
          color={hoy.tasaAsistencia >= 80 ? "green" : "orange"}
          icono="📊"
          progreso={hoy.tasaAsistencia}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Sesiones por fecha */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">{t('dashboard.sesionesPorDia')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={graficas.sesionesXFecha.slice(-14)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={f => f.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={l => 'Fecha: ' + l} />
              <Legend />
              <Bar dataKey="realizadas" fill="#1B5EA1" name="Realizadas" radius={[3, 3, 0, 0]} />
              <Bar dataKey="canceladas" fill="#CB4335" name="Canceladas" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Próximas sesiones */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold text-gray-700 mb-4">{t('dashboard.proximasSesiones')}</h3>
          <div className="space-y-3">
            {proximasSesiones.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No hay sesiones programadas</p>
            ) : proximasSesiones.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer">
                <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-md min-w-[56px] text-center">
                  {s.hora_inicio?.slice(0, 5)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{s.children?.name || 'Sin nombre'}</p>
                  <p className="text-xs text-gray-500">{s.children?.diagnosis} • {s.tipo}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  s.fecha === new Date().toISOString().split('T')[0] ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {s.fecha === new Date().toISOString().split('T')[0] ? 'Hoy' : s.fecha?.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas recientes */}
      {alertas.recientes && alertas.recientes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">{t('dashboard.alertasRecientes')}</h3>
            <button className="text-blue-600 text-sm hover:underline">{t('dashboard.verTodas')}</button>
          </div>
          <div className="space-y-2">
            {alertas.recientes.map((alerta: any) => (
              <div key={alerta.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                alerta.prioridad === 1 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
              }`}>
                <span className="mt-0.5">{alerta.prioridad === 1 ? '🔴' : '🟡'}</span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{alerta.titulo}</p>
                  <p className="text-xs text-gray-600">{alerta.children?.name} • {alerta.descripcion?.slice(0, 80)}...</p>
                </div>
                <button className="text-xs text-blue-600 hover:underline whitespace-nowrap">Resolver</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── COMPONENTE KPI ───────────────────────────────────────────
function KPICard({ titulo, valor, subtitulo, color, icono, progreso }: {
  titulo: string; valor: any; subtitulo: string; color: string; icono: string; progreso?: number
}) {
  const colores: Record<string, { bg: string; text: string; bar: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   bar: 'bg-blue-500' },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  bar: 'bg-green-500' },
    red:    { bg: 'bg-red-50',    text: 'text-red-700',    bar: 'bg-red-500' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', bar: 'bg-purple-500' },
    gray:   { bg: 'bg-gray-50',   text: 'text-gray-700',   bar: 'bg-gray-400' },
  }
  const c = colores[color] || colores.gray

  return (
    <div className={`${c.bg} rounded-xl p-4 border border-white shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{titulo}</p>
          <p className={`text-2xl font-bold ${c.text} mt-1`}>{valor}</p>
          <p className="text-gray-500 text-xs mt-1">{subtitulo}</p>
        </div>
        <span className="text-2xl">{icono}</span>
      </div>
      {progreso !== undefined && (
        <div className="mt-3">
          <div className="bg-white rounded-full h-1.5 overflow-hidden">
            <div className={`${c.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${Math.min(progreso, 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
