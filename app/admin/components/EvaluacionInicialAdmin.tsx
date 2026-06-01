'use client'

// Panel de admin/especialista para gestionar la Evaluación Inicial de un paciente.
//
// El admin ve:
//  • Estado completo del flujo
//  • Intake del padre + 2ª anamnesis
//  • Análisis clínico completo de la IA (razonamiento, áreas, señales — uso interno)
//  • Terapias que eligió la familia
//  • Botón para ENVIAR RESPUESTA al padre
//  • Descarga del documento clínico interno

import { useEffect, useState } from 'react'
import {
  ClipboardCheck, Brain, Heart, Loader2, X, Sparkles, FileText, RefreshCw,
  CheckCircle2, User, Send, Award, Clock, Download, MessageCircle, Edit3, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Props = { childId: string; childName: string }

const ESTADO_LABEL: Record<string, { label: string; color: string; pasos: number }> = {
  pendiente_intake:       { label: '1/7 · Esperando intake del padre',         color: 'bg-slate-100 text-slate-700',    pasos: 1 },
  analizando:             { label: '2/7 · IA analizando',                       color: 'bg-blue-100 text-blue-700',      pasos: 2 },
  recomendado:            { label: '3/7 · Esperando que el padre confirme',     color: 'bg-purple-100 text-purple-700',  pasos: 3 },
  confirmado:             { label: '4/7 · Padre llenando 2ª anamnesis',         color: 'bg-indigo-100 text-indigo-700',  pasos: 4 },
  anamnesis_completa:     { label: '5/7 · Padre eligiendo terapias',            color: 'bg-violet-100 text-violet-700',  pasos: 5 },
  terapia_seleccionada:   { label: '6/7 · 🔔 ESPERANDO TU RESPUESTA',           color: 'bg-amber-100 text-amber-700',    pasos: 6 },
  revisado:               { label: '7/7 · Respuesta enviada',                   color: 'bg-green-100 text-green-700',    pasos: 7 },
  completado:             { label: '✅ Completado',                              color: 'bg-emerald-100 text-emerald-700',pasos: 7 },
  rechazado:              { label: '⚠️ Padre NO aceptó · contactar',             color: 'bg-red-100 text-red-700',        pasos: 3 },
}

// Render de texto con **negritas** y --- (markdown sencillo de la IA) → formato limpio
function RichText({ texto }: { texto: string }) {
  const lineas = (texto || '').split('\n')
  const renderInline = (linea: string, key: number) => {
    const partes = linea.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={key} className="leading-relaxed mb-1.5 last:mb-0">
        {partes.map((p, i) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{p.slice(2, -2)}</strong>
          }
          // limpiar asteriscos sueltos
          return <span key={i}>{p.replace(/\*+/g, '')}</span>
        })}
      </p>
    )
  }
  return (
    <div>
      {lineas.map((ln, i) => {
        const t = ln.trim()
        if (t === '') return null
        if (/^[-—*_]{2,}$/.test(t)) {
          return <hr key={i} className="my-2.5 border-0 h-px" style={{ background: 'var(--card-border)' }} />
        }
        return renderInline(ln, i)
      })}
    </div>
  )
}

export default function EvaluacionInicialAdmin({ childId, childName }: Props) {
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [terapias, setTerapias] = useState<any[]>([])  // catálogo completo
  const [reanalizando, setReanalizando] = useState(false)
  const [reRecomendando, setReRecomendando] = useState(false)
  const [generandoWord, setGenerandoWord] = useState(false)
  const [verDocumento, setVerDocumento] = useState(false)
  const [showResponder, setShowResponder] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [enviandoResp, setEnviandoResp] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [eliminando, setEliminando] = useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  // Editor de terapias: el especialista puede cambiar lo que eligió el padre
  const [showEditTerapias, setShowEditTerapias] = useState(false)
  const [seleccionEdit, setSeleccionEdit] = useState<string[]>([])
  const [notaCambio, setNotaCambio] = useState('')
  const [guardandoTerapias, setGuardandoTerapias] = useState(false)

  useEffect(() => { if (childId) cargar() }, [childId])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        supabase.from('profiles').select('*').eq('email', data.user.email).maybeSingle()
          .then(({ data: p }) => setProfile(p))
      }
    })
  }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const [e1, e2] = await Promise.all([
        fetch(`/api/evaluacion-inicial?child_id=${childId}`).then(r => r.json()),
        fetch('/api/terapias-catalogo?all=1').then(r => r.json()),
      ])
      if (e1.ok) setEvaluacion(e1.evaluacion)
      if (e2.ok) setTerapias(e2.terapias || [])
    } finally { setLoading(false) }
  }

  const reanalizar = async () => {
    if (!evaluacion?.id) return
    setReanalizando(true)
    try {
      await fetch('/api/evaluacion-inicial/analizar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: evaluacion.id }),
      })
      await cargar()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setReanalizando(false) }
  }

  const regenerarInformeWord = async () => {
    if (!evaluacion?.id) return
    setGenerandoWord(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/generar-informe-word', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacion_id: evaluacion.id }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      alert(`✅ Informe generado: ${d.file_name}\nDisponible en la pestaña "Historial & IA" del paciente.`)
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setGenerandoWord(false) }
  }

  const reRecomendarTerapias = async () => {
    if (!evaluacion?.id) return
    setReRecomendando(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/recomendar-terapias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluacion_id: evaluacion.id }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      await cargar()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setReRecomendando(false) }
  }

  const abrirEditorTerapias = () => {
    setSeleccionEdit(evaluacion?.terapias_seleccionadas || [])
    setNotaCambio('')
    setShowEditTerapias(true)
  }

  const guardarSeleccionTerapias = async () => {
    if (!evaluacion?.id) return
    setGuardandoTerapias(true)
    try {
      const payload: any = {
        id: evaluacion.id,
        terapias_seleccionadas: seleccionEdit,
      }
      // Si la nota cambió, registrarla (campo opcional, va dentro del meta)
      if (notaCambio.trim()) {
        payload.nota_cambio_terapias = notaCambio.trim()
        payload.terapias_cambiadas_por_admin = true
      }
      const r = await fetch('/api/evaluacion-inicial', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'No se pudo guardar')
      setShowEditTerapias(false)
      await cargar()
    } catch (e: any) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setGuardandoTerapias(false)
    }
  }

  const eliminarEvaluacion = async () => {
    if (!evaluacion?.id) return
    setEliminando(true)
    try {
      const r = await fetch(`/api/evaluacion-inicial?id=${evaluacion.id}`, { method: 'DELETE' })
      const d = await r.json()
      if (!r.ok || d.error) throw new Error(d.error || 'No se pudo eliminar')
      setShowConfirmDelete(false)
      setEvaluacion(null)
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message)
    } finally {
      setEliminando(false)
    }
  }

  const enviarRespuesta = async () => {
    if (!respuesta.trim()) { alert('Escribe una respuesta'); return }
    setEnviandoResp(true)
    try {
      const r = await fetch('/api/evaluacion-inicial/responder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacion.id,
          respuesta,
          respondido_por: profile?.id,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      setShowResponder(false)
      setRespuesta('')
      await cargar()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setEnviandoResp(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
  }

  if (!evaluacion) {
    return (
      <div className="rounded-2xl p-8 text-center border-2 border-dashed" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
        <ClipboardCheck size={40} className="mx-auto mb-3 opacity-40" />
        <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sin evaluación inicial</p>
        <p className="text-sm">El padre aún no ha llenado la ficha intake.</p>
      </div>
    )
  }

  const estadoInfo = ESTADO_LABEL[evaluacion.estado] || ESTADO_LABEL.pendiente_intake
  const areas = evaluacion.recomendacion_areas || {}
  const terapiasElegidas = terapias.filter(t => (evaluacion.terapias_seleccionadas || []).includes(t.id))

  return (
    <div className="space-y-5">
      {/* HEADER + acciones */}
      <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck size={22} className="text-indigo-500" />
              <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Evaluación Inicial — {childName}</h2>
            </div>
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${estadoInfo.color}`}>
              {estadoInfo.label}
            </span>

            {/* Barra de progreso del flujo */}
            <div className="mt-3 flex items-center gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map(p => (
                <div key={p} className={`h-1.5 flex-1 rounded ${p <= estadoInfo.pasos ? 'bg-indigo-500' : 'bg-slate-200'}`} />
              ))}
            </div>

            {evaluacion.intake_completado_en && (
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                Intake: {new Date(evaluacion.intake_completado_en).toLocaleString('es-PE')}
                {evaluacion.confirmado_en && ` · Confirmado: ${new Date(evaluacion.confirmado_en).toLocaleString('es-PE')}`}
                {evaluacion.anamnesis_completada_en && ` · Anamnesis: ${new Date(evaluacion.anamnesis_completada_en).toLocaleString('es-PE')}`}
                {evaluacion.seleccionado_en && ` · Terapias elegidas: ${new Date(evaluacion.seleccionado_en).toLocaleString('es-PE')}`}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {evaluacion.respuestas_intake && (
              <button onClick={reanalizar} disabled={reanalizando}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {reanalizando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {evaluacion.recomendacion ? 'Re-analizar IA' : 'Analizar con IA'}
              </button>
            )}
            {evaluacion.estado === 'terapia_seleccionada' && (
              <button onClick={() => setShowResponder(true)}
                className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <Send size={14} /> Responder al padre
              </button>
            )}
            {(evaluacion.estado === 'revisado' || evaluacion.estado === 'completado') && (
              <button onClick={() => setShowResponder(true)}
                className="px-3 py-2 rounded-lg border-2 text-xs font-bold flex items-center gap-1.5"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                <Edit3 size={14} /> Editar respuesta
              </button>
            )}
            {evaluacion.anamnesis_especifica && (
              <button onClick={regenerarInformeWord} disabled={generandoWord}
                className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {generandoWord ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Generar informe Word
              </button>
            )}
            {evaluacion.documento_md && (
              <button onClick={() => setVerDocumento(true)}
                className="px-3 py-2 rounded-lg border-2 text-xs font-bold flex items-center gap-1.5"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                <FileText size={14} /> Doc. interno
              </button>
            )}
            {/* Eliminar evaluación (acción destructiva, va al final) */}
            <button onClick={() => setShowConfirmDelete(true)}
              className="px-3 py-2 rounded-lg border-2 text-xs font-bold flex items-center gap-1.5 hover:bg-red-50 transition-colors"
              style={{ borderColor: '#fecaca', color: '#dc2626' }}>
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => !eliminando && setShowConfirmDelete(false)}>
          <div className="rounded-2xl p-6 max-w-md w-full shadow-2xl border-2 border-red-200"
            style={{ background: 'var(--card)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                  ¿Eliminar evaluación inicial?
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Se borrará permanentemente la evaluación de <strong>{childName}</strong>, incluyendo el intake, la anamnesis específica, la recomendación de la IA y las terapias seleccionadas. Esta acción <strong>no se puede deshacer</strong>.
                </p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  El padre/madre podrá iniciar una nueva evaluación desde cero.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowConfirmDelete(false)} disabled={eliminando}
                className="px-4 py-2 rounded-lg border-2 text-sm font-bold disabled:opacity-50"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                Cancelar
              </button>
              <button onClick={eliminarEvaluacion} disabled={eliminando}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                {eliminando ? <><Loader2 size={14} className="animate-spin" /> Eliminando…</> : <><Trash2 size={14} /> Sí, eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERTA si está esperando respuesta */}
      {evaluacion.estado === 'terapia_seleccionada' && (
        <div className="rounded-2xl p-4 border-2 border-amber-400 bg-amber-50 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
            <Send size={18} />
          </div>
          <div className="flex-1">
            <p className="font-black text-amber-900">El padre está esperando tu respuesta</p>
            <p className="text-sm text-amber-800">
              Eligió {terapiasElegidas.length} terapia{terapiasElegidas.length === 1 ? '' : 's'}. Revisa toda la información abajo y envía un mensaje personalizado.
            </p>
          </div>
        </div>
      )}

      {/* RECOMENDACIÓN IA (uso interno) */}
      {evaluacion.recomendacion && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              {evaluacion.recomendacion === 'psicologica' ? <Heart size={16} className="text-pink-500" /> : <Brain size={16} className="text-indigo-500" />}
              Recomendación IA <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">USO INTERNO</span>
            </h3>
          </div>

          <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
            style={{
              background: evaluacion.recomendacion === 'psicologica' ? '#fce7f3' : '#e0e7ff',
              color: evaluacion.recomendacion === 'psicologica' ? '#be185d' : '#4338ca',
            }}>
            {evaluacion.recomendacion === 'psicologica' ? 'Evaluación Psicológica Emocional'
            : evaluacion.recomendacion === 'neuropsicologica' ? 'Evaluación Neuropsicológica'
            : 'Ambas evaluaciones'}
          </div>

          {evaluacion.mensaje_amigable_padre && (
            <details className="mb-3 rounded-lg p-3" style={{ background: 'rgba(99,102,241,0.06)' }}>
              <summary className="cursor-pointer text-xs font-bold uppercase text-indigo-700">Mensaje que vio el padre</summary>
              <p className="text-sm mt-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                {evaluacion.mensaje_amigable_padre}
              </p>
            </details>
          )}

          {evaluacion.recomendacion_razon && (
            <details className="text-sm" open>
              <summary className="cursor-pointer font-bold text-indigo-600 mb-2">Razonamiento clínico completo</summary>
              <div className="mt-2 leading-relaxed rounded-lg p-3 text-sm"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)' }}>
                <RichText texto={evaluacion.recomendacion_razon} />
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
                areas.urgencia === 'alta' ? 'text-red-600' : areas.urgencia === 'media' ? 'text-amber-600' : 'text-green-600'
              }`}>{areas.urgencia.toUpperCase()}</span>
            </p>
          )}
        </div>
      )}

      {/* TERAPIAS RECOMENDADAS POR LA IA (basadas en el catálogo) */}
      {evaluacion.terapias_recomendadas?.length > 0 && (
        <div className="rounded-2xl p-5 border" style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.3)' }}>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Sparkles size={16} className="text-purple-500" />
              Terapias recomendadas por IA <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">DEL CATÁLOGO</span>
            </h3>
            {evaluacion.anamnesis_especifica && (
              <button onClick={reRecomendarTerapias} disabled={reRecomendando}
                className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {reRecomendando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Re-recomendar
              </button>
            )}
          </div>

          {/* Lista de terapias recomendadas con orden */}
          <div className="space-y-2 mb-3">
            {evaluacion.terapias_recomendadas.map((id: string, i: number) => {
              const t = terapias.find(t => t.id === id)
              if (!t) return null
              const elegida = (evaluacion.terapias_seleccionadas || []).includes(id)
              return (
                <div key={id} className="rounded-lg p-3 border flex items-center gap-3" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                  <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  {t.imagen_url ? (
                    <img src={t.imagen_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                      <Sparkles size={14} className="text-purple-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.nombre}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {t.categoria && `${t.categoria} · `}{t.duracion}
                      {t.precio && ` · ${t.precio} ${t.moneda}`}
                    </p>
                  </div>
                  {elegida && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700 flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={10} /> Elegida
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Razonamiento */}
          {evaluacion.terapias_recomendadas_razon && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold text-purple-700 mb-2">Ver razonamiento de la IA</summary>
              <div className="mt-2 leading-relaxed rounded-lg p-3 text-sm"
                style={{ background: 'var(--card)', color: 'var(--text-secondary)' }}>
                <RichText texto={evaluacion.terapias_recomendadas_razon} />
              </div>
            </details>
          )}
        </div>
      )}

      {/* Botón para generar recomendación si no existe pero ya hay anamnesis */}
      {evaluacion.anamnesis_especifica && !evaluacion.terapias_recomendadas?.length && (
        <div className="rounded-2xl p-4 border-2 border-dashed flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Sparkles size={16} className="text-purple-500" />
            <span>La IA aún no ha recomendado terapias del catálogo para este caso.</span>
          </div>
          <button onClick={reRecomendarTerapias} disabled={reRecomendando}
            className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0">
            {reRecomendando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Generar ahora
          </button>
        </div>
      )}

      {/* TERAPIAS SELECCIONADAS */}
      {(terapiasElegidas.length > 0 || (evaluacion.estado === 'terapia_seleccionada' || evaluacion.estado === 'revisado' || evaluacion.estado === 'completado')) && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Award size={16} className="text-amber-500" /> Terapias elegidas
              {evaluacion.terapias_cambiadas_por_admin && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Ajustada por especialista
                </span>
              )}
            </h3>
            <button onClick={abrirEditorTerapias}
              className="px-3 py-1.5 rounded-lg border-2 text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-50 transition-colors"
              style={{ borderColor: '#a5b4fc', color: '#4f46e5' }}>
              <Edit3 size={12} /> Cambiar selección
            </button>
          </div>
          {terapiasElegidas.length === 0 ? (
            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
              La familia aún no eligió terapias o quedaron vacías. Podés seleccionar manualmente las que recomendás clínicamente.
            </p>
          ) : (
            <div className="space-y-2">
              {terapiasElegidas.map(t => (
                <div key={t.id} className="rounded-lg p-3 border flex items-center gap-3" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                  {t.imagen_url ? (
                    <img src={t.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <CheckCircle2 className="text-indigo-500" size={20} />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {t.categoria && `${t.categoria} · `}{t.duracion}
                      {t.precio && ` · ${t.precio} ${t.moneda}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {evaluacion.nota_cambio_terapias && (
            <div className="mt-3 rounded-lg p-3 text-xs border-l-4 border-indigo-400" style={{ background: 'rgba(99,102,241,0.05)' }}>
              <p className="font-bold mb-1" style={{ color: '#4f46e5' }}>📝 Nota del especialista sobre el cambio</p>
              <p style={{ color: 'var(--text-secondary)' }}>{evaluacion.nota_cambio_terapias}</p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: Cambiar selección de terapias */}
      {showEditTerapias && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur"
          onClick={() => !guardandoTerapias && setShowEditTerapias(false)}>
          <div className="max-w-3xl w-full rounded-2xl shadow-2xl flex flex-col" style={{ background: 'var(--card)', maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
              <div>
                <h3 className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Edit3 size={20} className="text-indigo-600" /> Cambiar selección de terapias
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Como especialista, podés ajustar las terapias para <strong>{childName}</strong> según tu criterio clínico. Tu selección reemplazará la del padre/madre.
                </p>
              </div>
              <button onClick={() => setShowEditTerapias(false)} disabled={guardandoTerapias}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-50">
                <X size={18} />
              </button>
            </div>

            {/* Catálogo */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                Catálogo completo · {seleccionEdit.length} seleccionada{seleccionEdit.length === 1 ? '' : 's'}
              </div>
              {terapias.length === 0 ? (
                <p className="text-sm italic text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No hay terapias activas en el catálogo.
                </p>
              ) : (
                terapias.map(t => {
                  const seleccionada = seleccionEdit.includes(t.id)
                  const recomendadaIA = (evaluacion.terapias_recomendadas || []).includes(t.id)
                  const elegidaPorPadre = (evaluacion.terapias_seleccionadas || []).includes(t.id)
                  return (
                    <button key={t.id}
                      onClick={() => setSeleccionEdit(arr =>
                        arr.includes(t.id) ? arr.filter(x => x !== t.id) : [...arr, t.id]
                      )}
                      className={`w-full text-left rounded-xl p-3 border-2 flex items-center gap-3 transition-all ${
                        seleccionada ? 'border-indigo-500 bg-indigo-50' : 'hover:border-indigo-200'
                      }`}
                      style={!seleccionada ? { borderColor: 'var(--card-border)', background: 'var(--card)' } : {}}>
                      {t.imagen_url ? (
                        <img src={t.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <Sparkles size={16} className="text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{t.nombre}</p>
                          {recomendadaIA && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-0.5">
                              <Sparkles size={8} /> IA
                            </span>
                          )}
                          {elegidaPorPadre && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              Padre
                            </span>
                          )}
                        </div>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {t.categoria && `${t.categoria} · `}{t.modalidad}
                          {t.duracion && ` · ${t.duracion}`}
                          {t.precio != null && ` · ${t.precio} ${t.moneda || 'PEN'}`}
                        </p>
                      </div>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        seleccionada ? 'bg-indigo-600' : 'border-2 border-slate-300'
                      }`}>
                        {seleccionada && <CheckCircle2 size={14} className="text-white" />}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Nota del cambio */}
            <div className="p-5 border-t" style={{ borderColor: 'var(--card-border)' }}>
              <label className="block text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Nota clínica (opcional) — por qué hiciste este cambio
              </label>
              <textarea value={notaCambio} onChange={e => setNotaCambio(e.target.value)} rows={2}
                placeholder="Ej: Tras la entrevista presencial considero que la terapia X es más prioritaria que la Y por…"
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-indigo-500 resize-none"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => setShowEditTerapias(false)} disabled={guardandoTerapias}
                  className="px-4 py-2 rounded-lg border-2 text-sm font-bold disabled:opacity-50"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                  Cancelar
                </button>
                <button onClick={guardarSeleccionTerapias} disabled={guardandoTerapias || seleccionEdit.length === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {guardandoTerapias ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : <><CheckCircle2 size={14} /> Guardar selección</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESPUESTA YA ENVIADA */}
      {evaluacion.respuesta_especialista && (
        <div className="rounded-2xl p-5 border-2 border-green-300 bg-green-50">
          <h3 className="text-sm font-black uppercase tracking-wider mb-2 text-green-700 flex items-center gap-2">
            <CheckCircle2 size={16} /> Respuesta enviada al padre
          </h3>
          <p className="text-xs mb-2 text-green-700">
            Enviado: {new Date(evaluacion.respondido_en).toLocaleString('es-PE')}
          </p>
          <div className="whitespace-pre-wrap text-sm bg-white rounded-lg p-3 text-slate-700">
            {evaluacion.respuesta_especialista}
          </div>
        </div>
      )}

      {/* MENSAJE DEL PADRE */}
      {evaluacion.mensaje_al_especialista && (
        <div className="rounded-2xl p-4 border-2 border-amber-300 bg-amber-50">
          <p className="text-xs font-bold uppercase mb-1 text-amber-700">💬 Mensaje del padre</p>
          <p className="text-sm text-amber-900 italic">"{evaluacion.mensaje_al_especialista}"</p>
        </div>
      )}

      {/* INTAKE */}
      {evaluacion.respuestas_intake && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <details>
            <summary className="cursor-pointer text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <User size={16} /> Intake inicial ({Object.keys(evaluacion.respuestas_intake).length} respuestas)
            </summary>
            <div className="mt-4 grid sm:grid-cols-2 gap-2.5 text-sm">
              {Object.entries(evaluacion.respuestas_intake).map(([k, v]) => {
                const esTabla = Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null && !Array.isArray(v[0])
                const vacio = v == null || v === '' || (Array.isArray(v) && v.length === 0)
                return (
                  <div key={k} className={esTabla ? 'sm:col-span-2' : ''}>
                    <div className="rounded-xl border px-3.5 py-2.5 h-full" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                      <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</p>
                      {esTabla ? (
                        <div className="space-y-1.5 mt-1.5">
                          {(v as any[]).map((fila, idx) => {
                            const entries = Object.entries(fila).filter(([, val]) => val != null && val !== '')
                            if (entries.length === 0) return null
                            return (
                              <div key={idx} className="rounded-lg border px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-1"
                                style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                                <span className="font-black px-1.5 rounded bg-indigo-100 text-indigo-700">#{idx + 1}</span>
                                {entries.map(([col, val]) => (
                                  <span key={col} style={{ color: 'var(--text-primary)' }}>
                                    <strong className="capitalize" style={{ color: 'var(--text-muted)' }}>{col.replace(/_/g, ' ')}:</strong> {String(val)}
                                  </span>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="leading-snug" style={{ color: vacio ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {Array.isArray(v) ? v.join(', ') : (vacio ? '—' : String(v))}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      )}

      {/* 2ª ANAMNESIS */}
      {evaluacion.anamnesis_especifica && (
        <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <details>
            <summary className="cursor-pointer text-sm font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <ClipboardCheck size={16} /> 2ª Anamnesis ({Object.keys(evaluacion.anamnesis_especifica).length} respuestas)
            </summary>
            <div className="mt-4 grid sm:grid-cols-2 gap-2.5 text-sm">
              {Object.entries(evaluacion.anamnesis_especifica).map(([k, v]) => {
                // Detectar tabla dinámica: array de objetos
                const esTabla = Array.isArray(v) && v.length > 0 && typeof v[0] === 'object' && v[0] !== null && !Array.isArray(v[0])
                const vacio = v == null || v === '' || (Array.isArray(v) && v.length === 0)
                return (
                  <div key={k} className={esTabla ? 'sm:col-span-2' : ''}>
                    <div className="rounded-xl border px-3.5 py-2.5 h-full" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                      <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</p>
                      {esTabla ? (
                        <div className="space-y-1.5 mt-1.5">
                          {(v as any[]).map((fila, idx) => {
                            const entries = Object.entries(fila).filter(([, val]) => val != null && val !== '')
                            if (entries.length === 0) return null
                            return (
                              <div key={idx} className="rounded-lg border px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-1"
                                style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                                <span className="font-black px-1.5 rounded bg-indigo-100 text-indigo-700">#{idx + 1}</span>
                                {entries.map(([col, val]) => (
                                  <span key={col} style={{ color: 'var(--text-primary)' }}>
                                    <strong className="capitalize" style={{ color: 'var(--text-muted)' }}>{col.replace(/_/g, ' ')}:</strong> {String(val)}
                                  </span>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="leading-snug" style={{ color: vacio ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                          {Array.isArray(v) ? v.join(', ') : (vacio ? '—' : String(v))}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      )}

      {/* MODAL: Responder al padre */}
      {showResponder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setShowResponder(false)}>
          <div className="max-w-2xl w-full rounded-2xl shadow-2xl p-6" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <MessageCircle size={20} className="text-green-600" /> Responder al padre
              </h3>
              <button onClick={() => setShowResponder(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)' }}>
              <strong>Esta respuesta se enviará al padre por la plataforma</strong> (y por notificación). Sé cálido, claro y profesional.
              Confirma terapias, propón horarios o pide info adicional.
            </div>

            <textarea
              value={respuesta || evaluacion.respuesta_especialista || ''}
              onChange={e => setRespuesta(e.target.value)}
              rows={10}
              placeholder={`Hola, soy [tu nombre], especialista de SANTI. He revisado el caso de ${childName} y…`}
              className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none text-sm"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
            />

            <div className="flex gap-2 mt-4">
              <button onClick={enviarRespuesta} disabled={enviandoResp}
                className="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {enviandoResp ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Enviar al padre
              </button>
              <button onClick={() => setShowResponder(false)} className="px-4 py-2.5 rounded-lg border-2 font-bold"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Documento clínico interno */}
      {verDocumento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setVerDocumento(false)}>
          <div className="max-w-3xl w-full max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
              <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <FileText size={18} /> Documento clínico interno
              </h3>
              <div className="flex gap-2">
                <button onClick={() => {
                    const blob = new Blob([evaluacion.documento_md || ''], { type: 'text/markdown' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `eval-inicial-${childName}.md`
                    a.click()
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1">
                  <Download size={12} /> Descargar .md
                </button>
                <button onClick={() => setVerDocumento(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
              </div>
            </div>
            <pre className="overflow-y-auto p-5 text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>
              {evaluacion.documento_md}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
