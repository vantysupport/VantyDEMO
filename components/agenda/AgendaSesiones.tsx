'use client'
import { useI18n } from '@/lib/i18n-context'
// components/agenda/AgendaSesiones.tsx
import { useState, useEffect } from 'react'

const ESTADOS: Record<string, { label: string; color: string; bg: string }> = {
  programada: { label: 'Programada', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  confirmada: { label: 'Confirmada', color: 'text-green-700',  bg: 'bg-green-100' },
  realizada:  { label: 'Realizada',  color: 'text-blue-700',   bg: 'bg-blue-100' },
  cancelada:  { label: 'Cancelada',  color: 'text-red-700',    bg: 'bg-red-100' },
  no_asistio: { label: 'No asistió', color: 'text-gray-700',   bg: 'bg-gray-100' },
}

export default function AgendaSesiones({ childId }: { childId?: string }) {
  const { t } = useI18n()
  const [sesiones, setSesiones]   = useState<any[]>([])
  const [cargando, setCargando]   = useState(true)
  const [vista, setVista]         = useState<'semana' | 'mes'>('semana')
  const [fechaBase, setFechaBase] = useState(new Date())
  const [modal, setModal]         = useState<any>(null)
  const [formNueva, setFormNueva] = useState({ child_id: childId || '', terapeuta_id: '', fecha: '', hora_inicio: '', hora_fin: '', tipo: 'individual', modalidad: 'presencial', notas: '' })
  const [modalNueva, setModalNueva] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [pacientes, setPacientes] = useState<any[]>([])

  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => { cargarSesiones() }, [fechaBase, childId])
  useEffect(() => {
    if (!childId) {
      fetch('/api/agenda?estado=programada').then(r => r.json()).then(d => setPacientes(d.data?.map((s: any) => s.children) || []))
    }
  }, [])

  function getRange() {
    if (vista === 'semana') {
      const inicio = new Date(fechaBase)
      const dia = inicio.getDay()
      inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1)) // Lunes
      const fin = new Date(inicio)
      fin.setDate(fin.getDate() + 6)
      return { inicio: inicio.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
    } else {
      const inicio = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1)
      const fin    = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + 1, 0)
      return { inicio: inicio.toISOString().split('T')[0], fin: fin.toISOString().split('T')[0] }
    }
  }

  async function cargarSesiones() {
    setCargando(true)
    const { inicio, fin } = getRange()
    try {
      let url = `/api/agenda?fecha_inicio=${inicio}&fecha_fin=${fin}`
      if (childId) url += `&child_id=${childId}`
      const res = await fetch(url)
      const data = await res.json()
      setSesiones(data.data || [])
    } catch {} finally { setCargando(false) }
  }

  async function actualizarEstado(id: string, estado: string) {
    await fetch('/api/agenda', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'actualizar_estado', id, estado })
    })
    setSesiones(prev => prev.map(s => s.id === id ? { ...s, estado } : s))
    setModal(null)
  }

  async function crearSesion() {
    if (!formNueva.child_id || !formNueva.fecha || !formNueva.hora_inicio) return
    setGuardando(true)
    try {
      const res = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crear', ...formNueva })
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      await cargarSesiones()
      setModalNueva(false)
      setFormNueva(f => ({ ...f, fecha: '', hora_inicio: '', hora_fin: '', notas: '' }))
    } catch {} finally { setGuardando(false) }
  }

  // Agrupar por fecha
  const porFecha: Record<string, any[]> = {}
  sesiones.forEach(s => {
    if (!porFecha[s.fecha]) porFecha[s.fecha] = []
    porFecha[s.fecha].push(s)
  })

  const { inicio, fin } = getRange()

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

      {/* Header */}
      <div className="bg-blue-700 text-white p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{t('agenda.sesiones')}</h2>
          <button onClick={() => setModalNueva(true)}
            className="bg-white text-blue-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
            + Nueva
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { const d = new Date(fechaBase); d.setDate(d.getDate() - (vista === 'semana' ? 7 : 30)); setFechaBase(d) }}
            className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-500 transition-colors text-sm">◀</button>
          <div className="flex-1 text-center">
            <p className="font-semibold text-sm">
              {new Date(inicio + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} –
              {new Date(fin + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => { const d = new Date(fechaBase); d.setDate(d.getDate() + (vista === 'semana' ? 7 : 30)); setFechaBase(d) }}
            className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-500 transition-colors text-sm">▶</button>
        </div>
        <div className="flex gap-2 mt-3">
          {['semana', 'mes'].map(v => (
            <button key={v} onClick={() => setVista(v as any)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${vista === v ? 'bg-white text-blue-700 font-semibold' : 'bg-blue-600 text-blue-100 hover:bg-blue-500'}`}>
              {v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
          <button onClick={() => setFechaBase(new Date())} className="ml-auto text-xs text-blue-100 hover:text-white">Hoy</button>
        </div>
      </div>

      {/* Lista de sesiones */}
      <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
        {cargando ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : Object.keys(porFecha).length === 0 ? (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📅</p>
            <p className="text-gray-500">{t('agenda.sinSesiones2')}</p>
          </div>
        ) : Object.entries(porFecha).sort().map(([fecha, ses]) => (
          <div key={fecha}>
            <div className={`flex items-center gap-2 mb-2 ${fecha === hoy ? 'text-blue-700' : 'text-gray-500'}`}>
              <div className={`w-2 h-2 rounded-full ${fecha === hoy ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <p className="text-xs font-semibold uppercase tracking-wide">
                {fecha === hoy ? 'HOY - ' : ''}
                {new Date(fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
            <div className="space-y-2 ml-4">
              {ses.sort((a, b) => a.hora_inicio?.localeCompare(b.hora_inicio)).map((s: any) => {
                const cfg = ESTADOS[s.estado] || ESTADOS.programada
                return (
                  <div key={s.id}
                    onClick={() => setModal(s)}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-100">
                    <div className="text-center min-w-[48px]">
                      <p className="font-bold text-gray-800 text-sm">{s.hora_inicio?.slice(0, 5)}</p>
                      {s.hora_fin && <p className="text-gray-400 text-xs">{s.hora_fin?.slice(0, 5)}</p>}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800 text-sm">{s.children?.name || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-500">{s.tipo} • {s.modalidad}{s.meeting_link ? ' 📹' : ''}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Modal detalle sesión */}
      {modal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{modal.children?.name}</h3>
                <p className="text-sm text-gray-500">{modal.fecha} • {modal.hora_inicio?.slice(0, 5)} – {modal.hora_fin?.slice(0, 5) || '?'}</p>
                <p className="text-xs text-gray-400">{modal.tipo} • {modal.modalidad}</p>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            {modal.notas && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 italic">{modal.notas}</p>}
            {modal.meeting_link && (
              <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-3">
                <span className="text-xl">🔗</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Link de Videollamada</p>
                  <a
                    href={modal.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline break-all"
                  >
                    {modal.meeting_link}
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(modal.meeting_link); alert('Link copiado ✅') }}
                    className="mt-2 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors w-full"
                  >
                    📋 Copiar link
                  </button>
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">{t('agenda.cambiarEstado')}</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(ESTADOS).map(([estado, cfg]) => (
                  <button key={estado} onClick={() => actualizarEstado(modal.id, estado)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors ${modal.estado === estado ? cfg.bg + ' ' + cfg.color + ' ring-2 ring-offset-1 ring-blue-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal nueva sesión */}
      {modalNueva && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{t('agenda.nuevaSesion')}</h3>
              <button onClick={() => setModalNueva(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              {!childId && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Child ID del paciente</label>
                  <input value={formNueva.child_id} onChange={e => setFormNueva(f => ({ ...f, child_id: e.target.value }))}
                    placeholder={t('agenda.uuidPaciente')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t('agenda.terapeutaIdLabel')}</label>
                <input value={formNueva.terapeuta_id} onChange={e => setFormNueva(f => ({ ...f, terapeuta_id: e.target.value }))}
                  placeholder="UUID del terapeuta"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('agenda.fechaLabel')}</label>
                  <input type="date" value={formNueva.fecha} onChange={e => setFormNueva(f => ({ ...f, fecha: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('agenda.horaInicioLabel')}</label>
                  <input type="time" value={formNueva.hora_inicio} onChange={e => setFormNueva(f => ({ ...f, hora_inicio: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t('agenda.tipoLabel')}</label>
                  <select value={formNueva.tipo} onChange={e => setFormNueva(f => ({ ...f, tipo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    <option value="individual">Individual</option>
                    <option value="grupal">Grupal</option>
                    <option value="domiciliaria">Domiciliaria</option>
                    <option value="evaluacion">{t('agenda.evaluacionOpt')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Modalidad</label>
                  <select value={formNueva.modalidad} onChange={e => setFormNueva(f => ({ ...f, modalidad: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Notas (opcional)</label>
                <textarea value={formNueva.notas} onChange={e => setFormNueva(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
            </div>
            <button onClick={crearSesion} disabled={guardando || !formNueva.fecha || !formNueva.hora_inicio}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors">
              {guardando ? 'Guardando...' : 'Crear sesión'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
