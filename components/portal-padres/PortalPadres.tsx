'use client'
import { useI18n } from '@/lib/i18n-context'
// components/portal-padres/PortalPadres.tsx
import { useState } from 'react'
import ChatPadres from './ChatPadres'
import TareasHogar from '../tareas/TareasHogar'
import ProgresoGraficas from '../graficos/ProgresoGraficas'

interface PortalPadresProps {
  childId: string
  parentUserId: string
  childName: string
}

export default function PortalPadres({ childId, parentUserId, childName }: PortalPadresProps) {
  const { t, locale } = useI18n()
  const [tab, setTab] = useState<'inicio' | 'chat' | 'tareas' | 'progreso' | 'citas'>('inicio')

  const tabs = [
    { id: 'inicio',   label: 'Inicio',    icono: '🏠' },
    { id: 'chat',     label: 'Preguntas', icono: '💬' },
    { id: 'tareas',   label: 'Tareas',    icono: '📋' },
    { id: 'progreso', label: 'Progreso',  icono: '📈' },
    { id: 'citas',    label: 'Citas',     icono: '📅' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">

      {/* Header del portal */}
      <div className="bg-blue-700 text-white px-4 pt-8 pb-16">
        <p className="text-blue-200 text-sm">Centro Vanty ABA</p>
        <h1 className="text-2xl font-bold mt-1">Hola 👋</h1>
        <p className="text-blue-100 mt-1">Seguimiento de <span className="font-semibold">{childName}</span></p>
      </div>

      {/* Contenido flotante sobre el header */}
      <div className="-mt-8 mx-4 mb-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* Tabs de navegación */}
          <div className="flex flex-wrap border-b">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)}
                className={`flex-1 min-w-[70px] py-3 px-2 text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                  tab === t.id
                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                <span className="text-lg">{t.icono}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Contenido de cada tab */}
          <div className="p-4">
            {tab === 'inicio' && <InicioTab childId={childId} childName={childName} />}
            {tab === 'chat'   && <ChatPadres childId={childId} parentUserId={parentUserId} childName={childName} />}
            {tab === 'tareas' && <TareasHogar childId={childId} modoParent={true} parentUserId={parentUserId} />}
            {tab === 'progreso' && <ProgresoGraficas childId={childId} modoParent={true} />}
            {tab === 'citas'  && <CitasTab childId={childId} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TAB INICIO ──────────────────────────────────────────────
function InicioTab({ childId, childName }: { childId: string; childName: string }) {
  const { t } = useI18n()
  const [datos, setDatos] = useState<any>(null)
  const [cargando, setCargando] = useState(true)

  useState(() => {
    Promise.all([
      fetch(`/api/progreso-paciente?child_id=${childId}&semanas=4&locale=${localStorage.getItem('vanty_locale') || 'es'}`).then(r => r.json()),
      fetch(`/api/tareas-hogar?child_id=${childId}&activas=true&locale=${localStorage.getItem('vanty_locale') || 'es'}`).then(r => r.json()),
      fetch(`/api/agenda?child_id=${childId}`).then(r => r.json()),
    ]).then(([progreso, tareas, agenda]) => {
      setDatos({ progreso, tareas, agenda })
    }).finally(() => setCargando(false))
  })

  if (cargando) return <CargandoSpinner />

  const tareasHoy     = datos?.tareas?.data?.filter((t: any) => !t.completada) || []
  const proximaCita   = datos?.agenda?.data?.[0]
  const reporteSemanal = datos?.progreso?.reporteSemanal

  return (
    <div className="space-y-4">

      {/* Reporte semanal IA */}
      {reporteSemanal && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <p className="font-semibold text-blue-800 text-sm">{t('familias.actualizacionSemanal')}</p>
          </div>
          <p className="text-gray-700 text-sm leading-relaxed">{reporteSemanal}</p>
        </div>
      )}

      {/* Próxima cita */}
      {proximaCita && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📅</span>
            <p className="font-semibold text-gray-700 text-sm">{t('common.proximaCita')}</p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800">
                {new Date(proximaCita.fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <p className="text-gray-500 text-sm">{proximaCita.hora_inicio?.slice(0, 5)} • {proximaCita.tipo}</p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              proximaCita.estado === 'confirmada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }`}>
              {proximaCita.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}
            </span>
          </div>
        </div>
      )}

      {/* Tareas pendientes */}
      {tareasHoy.length > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📋</span>
            <p className="font-semibold text-orange-700 text-sm">{tareasHoy.length} tarea{tareasHoy.length > 1 ? 's' : ''} pendiente{tareasHoy.length > 1 ? 's' : ''}</p>
          </div>
          {tareasHoy.slice(0, 2).map((t: any) => (
            <div key={t.id} className="bg-white rounded-lg p-3 mb-2 border border-orange-100">
              <p className="font-medium text-gray-800 text-sm">{t.titulo}</p>
              <p className="text-xs text-gray-500 mt-1">Asignada: {new Date(t.fecha_asignada).toLocaleDateString('es-PE')}</p>
            </div>
          ))}
        </div>
      )}

      {/* Progreso rápido */}
      {datos?.progreso?.asistencia && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📊</span>
            <p className="font-semibold text-gray-700 text-sm">{t('familias.resumen4Semanas')}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat icono="✅" valor={datos.progreso.asistencia.asistidas} label="Sesiones" color="blue" />
            <MiniStat icono="📋" valor={`${datos.progreso.tareas.adherencia}%`} label="Tareas" color="orange" />
            <MiniStat icono="📈" valor={`${datos.progreso.asistencia.tasa}%`} label="Asistencia" color="green" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB CITAS ────────────────────────────────────────────────
function CitasTab({ childId }: { childId: string }) {
  const { t } = useI18n()
  const [citas, setCitas] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  useState(() => {
    fetch(`/api/agenda?child_id=${childId}`)
      .then(r => r.json())
      .then(data => setCitas(data.data || []))
      .finally(() => setCargando(false))
  })

  if (cargando) return <CargandoSpinner />

  const citasFuturas  = citas.filter(c => c.fecha >= new Date().toISOString().split('T')[0])
  const citasPasadas  = citas.filter(c => c.fecha < new Date().toISOString().split('T')[0]).slice(0, 10)

  return (
    <div className="space-y-4">
      {citasFuturas.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 text-sm mb-3">{t('familias.proximasCitas2')}</h3>
          <div className="space-y-2">
            {citasFuturas.map(c => (
              <CitaCard key={c.id} cita={c} futura />
            ))}
          </div>
        </div>
      )}

      {citasPasadas.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-500 text-sm mb-3">{t('familias.historialReciente')}</h3>
          <div className="space-y-2">
            {citasPasadas.map(c => (
              <CitaCard key={c.id} cita={c} />
            ))}
          </div>
        </div>
      )}

      {citas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-gray-500">No hay citas registradas</p>
        </div>
      )}
    </div>
  )
}

function CitaCard({ cita, futura }: { cita: any; futura?: boolean }) {
  const estadoConfig: Record<string, { bg: string; text: string; label: string }> = {
    programada: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Programada' },
    confirmada: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Confirmada' },
    realizada:  { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Realizada' },
    cancelada:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelada' },
    no_asistio: { bg: 'bg-gray-100',   text: 'text-gray-700',   label: 'No asistió' },
  }
  const cfg = estadoConfig[cita.estado] || estadoConfig.programada

  return (
    <div className={`rounded-xl p-3 border ${futura ? 'border-blue-100 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-800 text-sm">
            {new Date(cita.fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{cita.hora_inicio?.slice(0, 5)} • {cita.tipo} • {cita.modalidad}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
      </div>
      {cita.notas && <p className="text-xs text-gray-600 mt-2 italic">{cita.notas}</p>}
    </div>
  )
}

// ─── UTILS ────────────────────────────────────────────────────
function CargandoSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}

function MiniStat({ icono, valor, label, color }: { icono: string; valor: any; label: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'text-blue-700 bg-blue-50', green: 'text-green-700 bg-green-50', orange: 'text-orange-700 bg-orange-50'
  }
  return (
    <div className={`${colors[color]} rounded-xl p-3 text-center`}>
      <p className="text-lg">{icono}</p>
      <p className="font-bold text-lg">{valor}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  )
}
