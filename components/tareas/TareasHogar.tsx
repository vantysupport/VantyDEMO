'use client'
import { useI18n } from '@/lib/i18n-context'
// components/tareas/TareasHogar.tsx
import { useState, useEffect } from 'react'

interface TareasHogarProps {
  childId: string
  modoParent?: boolean
  parentUserId?: string
}

export default function TareasHogar({ childId, modoParent = false, parentUserId }: TareasHogarProps) {
  const { t, locale } = useI18n()
  const [tareas, setTareas]       = useState<any[]>([])
  const [cargando, setCargando]   = useState(true)
  const [completando, setCompletando] = useState<string | null>(null)
  const [notaPadre, setNotaPadre] = useState('')
  const [tareaSeleccionada, setTareaSeleccionada] = useState<any>(null)
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => { cargarTareas() }, [childId])

  async function cargarTareas() {
    try {
      const res = await fetch(`/api/tareas-hogar?child_id=${childId}&activas=true`)
      const data = await res.json()
      setTareas(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }

  async function completarTarea(id: string, dificultad: string) {
    setCompletando(id)
    try {
      await fetch('/api/tareas-hogar', {
        method: 'POST',
        headers: { 'x-locale': locale || 'es', 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', action: 'completar', id, nota_padre: notaPadre, dificultad_reportada: dificultad })
      })
      setTareas(prev => prev.map(t => t.id === id ? { ...t, completada: true } : t))
      setModalAbierto(false)
      setNotaPadre('')
      setTareaSeleccionada(null)
    } catch {} finally { setCompletando(null) }
  }

  if (cargando) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  const pendientes  = tareas.filter(t => !t.completada)
  const completadas = tareas.filter(t => t.completada)
  const adherencia  = tareas.length > 0 ? Math.round((completadas.length / tareas.length) * 100) : 0

  return (
    <div className="space-y-4">

      {/* Stats rápidos */}
      {tareas.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{tareas.length}</p>
            <p className="text-xs text-blue-500">Total</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-700">{pendientes.length}</p>
            <p className="text-xs text-orange-500">Pendientes</p>
          </div>
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-700">{adherencia}%</p>
            <p className="text-xs text-green-500">Completadas</p>
          </div>
        </div>
      )}

      {/* Tareas pendientes */}
      {pendientes.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 text-sm mb-3">📋 Tareas pendientes</h3>
          <div className="space-y-3">
            {pendientes.map(t => (
              <div key={t.id} className="bg-orange-50 border border-orange-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 text-sm">{t.titulo}</p>
                    {t.objetivo && <p className="text-xs text-gray-500 mt-1">Objetivo: {t.objetivo}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Asignada el {new Date(t.fecha_asignada).toLocaleDateString('es-PE')}
                      {t.fecha_limite && ` • Vence: ${new Date(t.fecha_limite).toLocaleDateString('es-PE')}`}
                    </p>
                  </div>
                  {modoParent && (
                    <button
                      onClick={() => { setTareaSeleccionada(t); setModalAbierto(true) }}
                      className="bg-green-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex-shrink-0">
                      ✓ Listo
                    </button>
                  )}
                </div>

                {/* Instrucciones expandibles */}
                {t.instrucciones && (
                  <details className="mt-3">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 font-medium">
                      Ver instrucciones paso a paso
                    </summary>
                    <div className="mt-2 bg-white rounded-lg p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-line border border-blue-100">
                      {t.instrucciones}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tareas completadas */}
      {completadas.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-500 text-sm mb-3">✅ Completadas</h3>
          <div className="space-y-2">
            {completadas.slice(0, 5).map(t => (
              <div key={t.id} className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
                <div className="bg-green-500 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">✓</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-700 text-sm line-through">{t.titulo}</p>
                  {t.nota_padre && <p className="text-xs text-gray-500 mt-0.5 no-underline">"{t.nota_padre}"</p>}
                </div>
                {t.dificultad_reportada && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    t.dificultad_reportada === 'facil' ? 'bg-green-100 text-green-700' :
                    t.dificultad_reportada === 'moderado' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {t.dificultad_reportada}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tareas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-gray-500 font-medium">{t('familias.sinTareasPend')}</p>
          <p className="text-gray-400 text-sm mt-1">El terapeuta asignará nuevas actividades después de la próxima sesión.</p>
        </div>
      )}

      {/* Modal completar tarea */}
      {modalAbierto && tareaSeleccionada && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-gray-800">{t('familias.completasteTarea')}</h3>
            <p className="text-gray-600 text-sm">"{tareaSeleccionada.titulo}"</p>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t('familias.comoDificultad')}</label>
              <div className="grid grid-cols-3 gap-2">
                {['facil', 'moderado', 'dificil'].map(d => (
                  <button key={d} onClick={() => completarTarea(tareaSeleccionada.id, d)}
                    disabled={completando === tareaSeleccionada.id}
                    className={`py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      d === 'facil'    ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                      d === 'moderado' ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                                         'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}>
                    {d === 'facil' ? '😊 Fácil' : d === 'moderado' ? '😐 Regular' : '😓 Difícil'}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={notaPadre}
              onChange={e => setNotaPadre(e.target.value)}
              placeholder="{t('familias.notaOpcional')}"
              rows={3}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />

            <button onClick={() => { setModalAbierto(false); setTareaSeleccionada(null) }}
              className="w-full py-2 text-gray-500 text-sm hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
