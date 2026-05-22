'use client'

// Panel de admin para gestionar la Evaluación Inicial de un paciente.
// Se monta dentro de la ficha del paciente (PatientsView) en una tab nueva.
//
// Permite:
//  • Ver el intake llenado por el padre
//  • Ver / regenerar la recomendación de la IA
//  • CRUD de servicios ofrecidos (con precios editables)
//  • Marcar especialista asignado
//  • Ver el documento generado tras la selección del padre

import { useEffect, useState } from 'react'
import {
  ClipboardCheck, Brain, Heart, Loader2, Plus, Trash2, Save, X,
  Sparkles, FileText, RefreshCw, CheckCircle2, AlertCircle,
  DollarSign, Clock, User, Edit3, Award
} from 'lucide-react'

type Props = {
  childId: string
  childName: string
}

const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
  pendiente_intake:   { label: 'Esperando intake del padre',  color: 'bg-slate-100 text-slate-700' },
  analizando:         { label: 'Analizando con IA',           color: 'bg-blue-100 text-blue-700' },
  recomendado:        { label: 'Recomendación lista',         color: 'bg-purple-100 text-purple-700' },
  servicios_listos:   { label: 'Servicios configurados',      color: 'bg-indigo-100 text-indigo-700' },
  seleccionado:       { label: 'Padre seleccionó servicio',   color: 'bg-green-100 text-green-700' },
  completado:         { label: 'Evaluación completada',       color: 'bg-emerald-100 text-emerald-700' },
}

export default function EvaluacionInicialAdmin({ childId, childName }: Props) {
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [servicios, setServicios] = useState<any[]>([])
  const [reanalizando, setReanalizando] = useState(false)
  const [showAddServicio, setShowAddServicio] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [verDocumento, setVerDocumento] = useState(false)

  useEffect(() => { if (childId) cargar() }, [childId])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/evaluacion-inicial?child_id=${childId}`)
      const data = await res.json()
      if (data.ok) {
        setEvaluacion(data.evaluacion)
        setServicios(data.servicios || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const reanalizar = async () => {
    if (!evaluacion?.id) return
    setReanalizando(true)
    try {
      const res = await fetch('/api/evaluacion-inicial/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evaluacion.id }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      await cargar()
    } catch (e: any) {
      alert('Error al analizar: ' + e.message)
    } finally {
      setReanalizando(false)
    }
  }

  const eliminarServicio = async (id: string) => {
    if (!confirm('¿Eliminar este servicio?')) return
    await fetch(`/api/evaluacion-inicial/servicios?id=${id}&force=1`, { method: 'DELETE' })
    cargar()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  if (!evaluacion) {
    return (
      <div className="rounded-2xl p-8 text-center border-2 border-dashed" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
        <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sin evaluación inicial</p>
        <p className="text-sm">El padre aún no ha llenado la ficha intake. Aparecerá aquí en cuanto la complete.</p>
      </div>
    )
  }

  const estadoInfo = ESTADO_LABEL[evaluacion.estado] || ESTADO_LABEL.pendiente_intake
  const areas = evaluacion.recomendacion_areas || {}

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck size={22} className="text-indigo-500" />
              <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Evaluación Inicial — {childName}</h2>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${estadoInfo.color}`}>
              {estadoInfo.label}
            </span>
            {evaluacion.intake_completado_en && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Intake llenado: {new Date(evaluacion.intake_completado_en).toLocaleString('es-PE')}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {evaluacion.respuestas_intake && (
              <button
                onClick={reanalizar}
                disabled={reanalizando}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {reanalizando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {evaluacion.recomendacion ? 'Re-analizar con IA' : 'Analizar con IA'}
              </button>
            )}
            {evaluacion.documento_md && (
              <button
                onClick={() => setVerDocumento(true)}
                className="px-3 py-2 rounded-lg border-2 text-xs font-bold flex items-center gap-1.5"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
              >
                <FileText size={14} /> Ver documento
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RECOMENDACIÓN IA */}
      {evaluacion.recomendacion && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <h3 className="text-sm font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            {evaluacion.recomendacion === 'psicologica' ? <Heart size={16} className="text-pink-500" /> : <Brain size={16} className="text-indigo-500" />}
            Recomendación IA
          </h3>
          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
            style={{
              background: evaluacion.recomendacion === 'psicologica' ? '#fce7f3' : '#e0e7ff',
              color: evaluacion.recomendacion === 'psicologica' ? '#be185d' : '#4338ca',
            }}>
            {evaluacion.recomendacion === 'psicologica' ? 'Evaluación Psicológica Emocional' :
             evaluacion.recomendacion === 'neuropsicologica' ? 'Evaluación Neuropsicológica' :
             'Ambas evaluaciones'}
          </div>
          {evaluacion.recomendacion_resumen && (
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              {evaluacion.recomendacion_resumen}
            </p>
          )}
          {evaluacion.recomendacion_razon && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-indigo-600 mb-2">Ver razonamiento clínico completo</summary>
              <div className="mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {evaluacion.recomendacion_razon}
              </div>
            </details>
          )}

          {(areas.areas_a_evaluar?.length || areas.señales_detectadas?.length) && (
            <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
              {areas.areas_a_evaluar?.length > 0 && (
                <div>
                  <p className="font-bold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Áreas a evaluar</p>
                  <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {areas.areas_a_evaluar.map((a: string, i: number) => <li key={i}>· {a}</li>)}
                  </ul>
                </div>
              )}
              {areas.señales_detectadas?.length > 0 && (
                <div>
                  <p className="font-bold uppercase mb-1.5" style={{ color: 'var(--text-muted)' }}>Señales detectadas</p>
                  <ul className="space-y-1" style={{ color: 'var(--text-secondary)' }}>
                    {areas.señales_detectadas.map((s: any, i: number) => (
                      <li key={i}><strong>{s.categoria}:</strong> {s.descripcion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {areas.urgencia && (
            <p className="mt-3 text-xs">
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>Urgencia: </span>
              <span className={`font-bold ${
                areas.urgencia === 'alta' ? 'text-red-600' :
                areas.urgencia === 'media' ? 'text-amber-600' : 'text-green-600'
              }`}>{areas.urgencia.toUpperCase()}</span>
            </p>
          )}
        </div>
      )}

      {/* SERVICIOS */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Award size={16} className="text-amber-500" /> Servicios ofrecidos a la familia
          </h3>
          <button
            onClick={() => setShowAddServicio(true)}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={14} /> Agregar servicio
          </button>
        </div>

        {servicios.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Aún no hay servicios configurados. Crea uno (o regenera la recomendación para que la IA proponga).
          </p>
        ) : (
          <div className="space-y-3">
            {servicios.map(s => (
              <ServicioCard
                key={s.id}
                servicio={s}
                editing={editingId === s.id}
                onEdit={() => setEditingId(s.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={async (patch) => {
                  await fetch('/api/evaluacion-inicial/servicios', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: s.id, ...patch }),
                  })
                  setEditingId(null)
                  cargar()
                }}
                onDelete={() => eliminarServicio(s.id)}
                isSelected={evaluacion.servicio_seleccionado_id === s.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* INTAKE LLENADO POR EL PADRE */}
      {evaluacion.respuestas_intake && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <details>
            <summary className="cursor-pointer text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <User size={16} /> Respuestas del intake ({Object.keys(evaluacion.respuestas_intake).length} campos)
            </summary>
            <div className="mt-4 space-y-3 text-sm">
              {Object.entries(evaluacion.respuestas_intake).map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs font-bold uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    {k.replace(/_/g, ' ')}
                  </p>
                  <p style={{ color: 'var(--text-primary)' }}>
                    {Array.isArray(v) ? v.join(', ') : String(v ?? '—')}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* MENSAJE DEL PADRE */}
      {evaluacion.mensaje_al_especialista && (
        <div className="rounded-2xl p-5 border-2 border-amber-300 bg-amber-50">
          <p className="text-xs font-bold uppercase tracking-wider mb-2 text-amber-700">💬 Mensaje del padre</p>
          <p className="text-sm text-amber-900 italic">"{evaluacion.mensaje_al_especialista}"</p>
        </div>
      )}

      {/* MODAL DOCUMENTO */}
      {verDocumento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setVerDocumento(false)}>
          <div className="max-w-3xl w-full max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
              <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <FileText size={18} /> Documento generado
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([evaluacion.documento_md || ''], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `evaluacion-inicial-${childName}.md`
                    a.click()
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                >Descargar .md</button>
                <button onClick={() => setVerDocumento(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>
            </div>
            <pre className="overflow-y-auto p-5 text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>
              {evaluacion.documento_md}
            </pre>
          </div>
        </div>
      )}

      {/* MODAL AGREGAR SERVICIO */}
      {showAddServicio && (
        <AgregarServicioModal
          evaluacionId={evaluacion.id}
          onClose={() => setShowAddServicio(false)}
          onSaved={() => { setShowAddServicio(false); cargar() }}
        />
      )}
    </div>
  )
}

// ─── Card editable de servicio ─────────────────────────────────────────────
function ServicioCard({
  servicio, editing, onEdit, onCancelEdit, onSave, onDelete, isSelected,
}: {
  servicio: any
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSave: (patch: any) => Promise<void>
  onDelete: () => void
  isSelected: boolean
}) {
  const [f, setF] = useState({ ...servicio })
  useEffect(() => setF({ ...servicio }), [servicio.id, editing])

  if (editing) {
    const incluyeStr = Array.isArray(f.incluye) ? f.incluye.join('\n') : ''
    return (
      <div className="rounded-xl p-4 border-2 border-indigo-400" style={{ background: 'var(--card)' }}>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Tipo</label>
            <select value={f.tipo || ''} onChange={e => setF({ ...f, tipo: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
              <option value="psicologica">Psicológica</option>
              <option value="neuropsicologica">Neuropsicológica</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Nombre</label>
            <input value={f.nombre || ''} onChange={e => setF({ ...f, nombre: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Precio (PEN)</label>
            <input type="number" step="0.01" value={f.precio ?? ''} onChange={e => setF({ ...f, precio: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Duración</label>
            <input value={f.duracion || ''} onChange={e => setF({ ...f, duracion: e.target.value })}
              placeholder="3 sesiones de 60 min"
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Descripción</label>
          <textarea value={f.descripcion || ''} onChange={e => setF({ ...f, descripcion: e.target.value })} rows={2}
            className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>¿Por qué para este caso?</label>
          <textarea value={f.por_que || ''} onChange={e => setF({ ...f, por_que: e.target.value })} rows={2}
            className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Incluye (uno por línea)</label>
          <textarea value={incluyeStr} onChange={e => setF({ ...f, incluye: e.target.value.split('\n').map((s: string) => s.trim()).filter(Boolean) })} rows={3}
            className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => onSave({ tipo: f.tipo, nombre: f.nombre, precio: f.precio, duracion: f.duracion, descripcion: f.descripcion, por_que: f.por_que, incluye: f.incluye })}
            className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold flex items-center gap-1.5">
            <Save size={14} /> Guardar
          </button>
          <button onClick={onCancelEdit} className="px-3 py-1.5 rounded-lg text-xs font-bold border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-xl p-4 border ${isSelected ? 'border-green-500 ring-2 ring-green-200' : ''}`}
      style={{ background: 'var(--card)', borderColor: isSelected ? '#22c55e' : 'var(--card-border)' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${servicio.tipo === 'psicologica' ? 'bg-pink-100 text-pink-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {servicio.tipo}
            </span>
            {isSelected && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1">
                <CheckCircle2 size={10} /> Elegido por la familia
              </span>
            )}
          </div>
          <h4 className="font-black text-base" style={{ color: 'var(--text-primary)' }}>{servicio.nombre}</h4>
          {servicio.duracion && (
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
              <Clock size={11} /> {servicio.duracion}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          {servicio.precio != null && (
            <p className="text-xl font-black text-indigo-600">
              {Number(servicio.precio).toFixed(0)} <span className="text-xs">PEN</span>
            </p>
          )}
          <div className="flex gap-1 mt-1 justify-end">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100" title="Editar">
              <Edit3 size={14} className="text-blue-600" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50" title="Eliminar">
              <Trash2 size={14} className="text-red-600" />
            </button>
          </div>
        </div>
      </div>

      {servicio.descripcion && (
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{servicio.descripcion}</p>
      )}
      {servicio.por_que && (
        <div className="rounded-lg p-2 text-xs mb-2" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
          <strong className="text-indigo-600">Justificación: </strong>{servicio.por_que}
        </div>
      )}
      {Array.isArray(servicio.incluye) && servicio.incluye.length > 0 && (
        <ul className="text-xs space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
          {servicio.incluye.map((i: string, idx: number) => (
            <li key={idx} className="flex items-center gap-1.5">
              <CheckCircle2 size={10} className="text-green-500" /> {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Modal para agregar servicio ─────────────────────────────────────────
function AgregarServicioModal({
  evaluacionId, onClose, onSaved,
}: { evaluacionId: string; onClose: () => void; onSaved: () => void }) {
  const [catalogo, setCatalogo] = useState<any[]>([])
  const [tipo, setTipo] = useState('psicologica')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [porQue, setPorQue] = useState('')
  const [precio, setPrecio] = useState<string>('')
  const [duracion, setDuracion] = useState('')
  const [incluye, setIncluye] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    fetch('/api/evaluacion-inicial/servicios?catalogo=1')
      .then(r => r.json())
      .then(d => setCatalogo(d.catalogo || []))
  }, [])

  const aplicarTemplate = (t: any) => {
    setTipo(t.tipo)
    setNombre(t.nombre)
    setDescripcion(t.descripcion || '')
    setDuracion(t.duracion || '')
    setIncluye(Array.isArray(t.incluye) ? t.incluye.join('\n') : '')
    if (t.precio_default) setPrecio(String(t.precio_default))
  }

  const guardar = async () => {
    if (!nombre.trim()) { alert('El nombre es obligatorio'); return }
    setGuardando(true)
    try {
      await fetch('/api/evaluacion-inicial/servicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacionId,
          tipo, nombre, descripcion, por_que: porQue,
          precio: precio ? Number(precio) : null,
          duracion,
          incluye: incluye.split('\n').map(s => s.trim()).filter(Boolean),
        }),
      })
      onSaved()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={onClose}>
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>Agregar servicio</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
        </div>

        {catalogo.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Plantillas rápidas</p>
            <div className="flex gap-2 flex-wrap">
              {catalogo.map(t => (
                <button key={t.id} onClick={() => aplicarTemplate(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                  + {t.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                <option value="psicologica">Psicológica</option>
                <option value="neuropsicologica">Neuropsicológica</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Precio (PEN)</label>
              <input type="number" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Nombre del servicio *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Duración</label>
            <input value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="3 sesiones de 60 min"
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Descripción</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>¿Por qué para este caso?</label>
            <textarea value={porQue} onChange={e => setPorQue(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Incluye (uno por línea)</label>
            <textarea value={incluye} onChange={e => setIncluye(e.target.value)} rows={4}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={guardar} disabled={guardando}
            className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {guardando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar servicio
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border-2 font-bold"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
