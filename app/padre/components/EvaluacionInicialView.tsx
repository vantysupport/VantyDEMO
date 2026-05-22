'use client'

// Flujo de Evaluación Inicial — vista del padre/madre.
// Etapas: intake → análisis IA → recomendación + servicios → selección → confirmación.

import { useEffect, useState } from 'react'
import {
  ClipboardCheck, Sparkles, Loader2, CheckCircle2, Brain, Heart,
  ChevronRight, ChevronLeft, AlertCircle, Send, Award, FileText, Clock, X
} from 'lucide-react'

type Props = {
  child: any
  profile: any
}

// ─── Definición de los pasos del intake ─────────────────────────────────
type Pregunta =
  | { id: string; type: 'text' | 'textarea' | 'number'; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: 'select' | 'radio'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'checkbox'; label: string; options: string[] }
  | { id: string; type: 'date'; label: string; required?: boolean }

type Seccion = { titulo: string; descripcion?: string; icono: string; preguntas: Pregunta[] }

const SECCIONES: Seccion[] = [
  {
    titulo: 'Motivo de consulta',
    descripcion: 'Cuéntanos en tus palabras qué te trae al centro.',
    icono: '💬',
    preguntas: [
      { id: 'motivo_principal', type: 'textarea', label: '¿Cuál es el motivo principal por el que buscas evaluación?', required: true },
      { id: 'desde_cuando', type: 'text', label: '¿Desde cuándo notas estas dificultades?', placeholder: 'Ej: hace 6 meses, desde que entró al colegio…', required: true },
      { id: 'quien_deriva', type: 'select', label: '¿Quién sugirió la evaluación?', options: ['Iniciativa propia', 'Colegio / docente', 'Pediatra / médico', 'Familiar', 'Otro profesional'], required: true },
    ],
  },
  {
    titulo: 'Desarrollo y antecedentes',
    descripcion: 'Información del embarazo, parto y primeros años.',
    icono: '👶',
    preguntas: [
      { id: 'embarazo', type: 'radio', label: 'El embarazo fue:', options: ['Normal', 'Con complicaciones', 'No lo sé'] },
      { id: 'tipo_parto', type: 'radio', label: 'Tipo de parto:', options: ['Natural', 'Cesárea programada', 'Cesárea de emergencia', 'No lo sé'] },
      { id: 'prematuro', type: 'radio', label: '¿Fue prematuro/a?', options: ['No', 'Sí, leve (35-37 sem)', 'Sí, moderado (32-34 sem)', 'Sí, severo (<32 sem)'] },
      { id: 'caminar_edad', type: 'text', label: '¿A qué edad caminó solo/a?', placeholder: 'Ej: 12 meses' },
      { id: 'primeras_palabras', type: 'text', label: '¿A qué edad dijo sus primeras palabras?', placeholder: 'Ej: 14 meses' },
      { id: 'antecedentes_medicos', type: 'checkbox', label: 'Marca si presentó alguno (puedes elegir varios):', options: ['Convulsiones', 'Meningitis o encefalitis', 'Golpes fuertes en la cabeza', 'Hospitalizaciones', 'Cirugías', 'Problemas auditivos', 'Problemas visuales', 'Ninguno'] },
    ],
  },
  {
    titulo: 'Área cognitiva y aprendizaje',
    descripcion: 'Atención, memoria, lenguaje y rendimiento escolar.',
    icono: '🧠',
    preguntas: [
      { id: 'escolaridad', type: 'select', label: 'Nivel escolar actual:', options: ['No asiste', 'Estimulación / Nido', 'Inicial', 'Primaria 1°-3°', 'Primaria 4°-6°', 'Secundaria 1°-3°', 'Secundaria 4°-5°'] },
      { id: 'rendimiento_escolar', type: 'radio', label: 'Rendimiento escolar general:', options: ['Bueno', 'Regular', 'Bajo', 'Muy bajo'] },
      { id: 'atencion', type: 'radio', label: '¿Tiene dificultades para mantener la atención?', options: ['No', 'A veces', 'Frecuentemente', 'Siempre'] },
      { id: 'memoria', type: 'radio', label: '¿Olvida instrucciones o lo que acaba de aprender?', options: ['No', 'A veces', 'Frecuentemente'] },
      { id: 'lectura', type: 'radio', label: 'Lectura:', options: ['No corresponde a su edad', 'Adecuada para su edad', 'Con dificultades', 'No lee aún'] },
      { id: 'escritura', type: 'radio', label: 'Escritura:', options: ['No corresponde a su edad', 'Adecuada para su edad', 'Con dificultades', 'No escribe aún'] },
      { id: 'matematicas', type: 'radio', label: 'Matemáticas:', options: ['Adecuadas', 'Con dificultades', 'No corresponde a su edad'] },
    ],
  },
  {
    titulo: 'Área socioemocional',
    descripcion: 'Cómo se siente, se relaciona y regula sus emociones.',
    icono: '❤️',
    preguntas: [
      { id: 'estado_animo', type: 'checkbox', label: 'Marca lo que observas frecuentemente:', options: ['Tristeza', 'Ansiedad / preocupación', 'Miedos intensos', 'Irritabilidad o enojo', 'Llanto frecuente', 'Cambios bruscos de humor', 'Está bien la mayoría del tiempo'] },
      { id: 'regulacion', type: 'radio', label: '¿Le cuesta calmarse cuando se frustra o enoja?', options: ['No', 'A veces', 'Frecuentemente'] },
      { id: 'vinculos', type: 'radio', label: 'Cómo se relaciona con otros niños:', options: ['Bien, hace amigos fácilmente', 'Le cuesta un poco', 'Se aísla / prefiere estar solo/a', 'Tiene conflictos frecuentes'] },
      { id: 'evento_estresante', type: 'textarea', label: '¿Ha vivido algún evento significativo recientemente? (mudanza, separación, duelo, bullying, etc.)' },
      { id: 'conductas_repetitivas', type: 'radio', label: '¿Tiene movimientos o conductas repetitivas, intereses muy fijos o le incomodan los cambios?', options: ['No', 'Un poco', 'Sí, claramente'] },
    ],
  },
  {
    titulo: 'Familia y entorno',
    icono: '🏠',
    preguntas: [
      { id: 'con_quien_vive', type: 'text', label: '¿Con quién vive?', placeholder: 'Ej: papá, mamá, dos hermanas…' },
      { id: 'dinamica_familiar', type: 'textarea', label: 'Cómo describirías la dinámica familiar actual:' },
      { id: 'antecedentes_familiares', type: 'checkbox', label: '¿Hay antecedentes familiares de alguno de estos?', options: ['TDAH', 'TEA / autismo', 'Dificultades de aprendizaje', 'Depresión / ansiedad', 'Epilepsia / convulsiones', 'Otros trastornos del desarrollo', 'Ninguno'] },
    ],
  },
  {
    titulo: 'Expectativas',
    icono: '✨',
    preguntas: [
      { id: 'expectativas', type: 'textarea', label: '¿Qué esperas obtener de esta evaluación?', required: true },
      { id: 'observaciones', type: 'textarea', label: '¿Algo más que quieras compartir con el equipo?' },
    ],
  },
]

export default function EvaluacionInicialView({ child, profile }: Props) {
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [servicios, setServicios] = useState<any[]>([])
  const [pasoActual, setPasoActual] = useState(0)
  const [respuestas, setRespuestas] = useState<Record<string, any>>({})
  const [enviando, setEnviando] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [servicioElegido, setServicioElegido] = useState<string | null>(null)
  const [mensajeEspecialista, setMensajeEspecialista] = useState('')
  const [enviandoSeleccion, setEnviandoSeleccion] = useState(false)
  const [verDocumento, setVerDocumento] = useState(false)

  useEffect(() => {
    if (!child?.id) return
    cargar()
  }, [child?.id])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/evaluacion-inicial?child_id=${child.id}`)
      const data = await res.json()
      if (data.ok) {
        setEvaluacion(data.evaluacion)
        setServicios(data.servicios || [])
        if (data.evaluacion?.respuestas_intake) {
          setRespuestas(data.evaluacion.respuestas_intake)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const setCampo = (id: string, valor: any) => {
    setRespuestas(r => ({ ...r, [id]: valor }))
  }

  const toggleCheck = (id: string, opcion: string) => {
    setRespuestas(r => {
      const arr: string[] = Array.isArray(r[id]) ? r[id] : []
      return { ...r, [id]: arr.includes(opcion) ? arr.filter(x => x !== opcion) : [...arr, opcion] }
    })
  }

  const validarPaso = (idx: number) => {
    const seccion = SECCIONES[idx]
    for (const p of seccion.preguntas) {
      if ((p as any).required && !respuestas[p.id]) {
        return p.label
      }
    }
    return null
  }

  const siguiente = () => {
    const error = validarPaso(pasoActual)
    if (error) {
      alert(`Por favor responde: "${error}"`)
      return
    }
    if (pasoActual < SECCIONES.length - 1) setPasoActual(pasoActual + 1)
  }

  const enviarIntake = async () => {
    const error = validarPaso(pasoActual)
    if (error) {
      alert(`Por favor responde: "${error}"`)
      return
    }

    setEnviando(true)
    try {
      const res = await fetch('/api/evaluacion-inicial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: child.id,
          parent_id: profile?.id,
          respuestas,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)

      setEvaluacion(data.evaluacion)

      // Inmediatamente disparar análisis IA
      setAnalizando(true)
      const r2 = await fetch('/api/evaluacion-inicial/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: data.evaluacion.id }),
      })
      const d2 = await r2.json()
      if (!d2.ok) {
        // mostrar igual el estado "analizando" — el admin puede reintentar
        console.warn('[intake] análisis falló:', d2.error)
      }
      await cargar()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setEnviando(false)
      setAnalizando(false)
    }
  }

  const seleccionarServicio = async () => {
    if (!servicioElegido) {
      alert('Elige uno de los servicios disponibles.')
      return
    }
    setEnviandoSeleccion(true)
    try {
      const res = await fetch('/api/evaluacion-inicial/seleccionar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluacion_id: evaluacion.id,
          servicio_id: servicioElegido,
          mensaje_al_especialista: mensajeEspecialista,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      await cargar()
    } catch (e: any) {
      alert('Error: ' + e.message)
    } finally {
      setEnviandoSeleccion(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────
  if (!child) {
    return (
      <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
        Selecciona un hijo/a para iniciar el flujo de evaluación.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    )
  }

  const estado = evaluacion?.estado || 'pendiente_intake'

  // ═══ ESTADO: pendiente_intake (mostrar formulario) ════════════════════
  if (estado === 'pendiente_intake' || !evaluacion) {
    const seccion = SECCIONES[pasoActual]
    const progreso = ((pasoActual + 1) / SECCIONES.length) * 100

    return (
      <div className="max-w-3xl mx-auto pb-12">
        {/* Hero */}
        <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
          <div className="flex items-center gap-3 mb-2">
            <ClipboardCheck size={28} />
            <h1 className="text-2xl font-black">Evaluación Inicial</h1>
          </div>
          <p className="text-white/90 text-sm">
            Esta ficha nos ayuda a entender mejor a <strong>{child.name}</strong> y recomendarte la evaluación más adecuada.
            Toma unos 8-10 minutos. Puedes regresar después si necesitas.
          </p>
        </div>

        {/* Progreso */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
            <span>Paso {pasoActual + 1} de {SECCIONES.length}</span>
            <span>{Math.round(progreso)}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${progreso}%` }} />
          </div>
        </div>

        {/* Sección */}
        <div className="rounded-2xl p-6 shadow-lg border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{seccion.icono}</span>
            <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{seccion.titulo}</h2>
          </div>
          {seccion.descripcion && (
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{seccion.descripcion}</p>
          )}

          <div className="space-y-5">
            {seccion.preguntas.map(p => (
              <div key={p.id}>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {p.label}
                  {(p as any).required && <span className="text-red-500 ml-1">*</span>}
                </label>

                {p.type === 'text' && (
                  <input
                    type="text"
                    value={respuestas[p.id] || ''}
                    placeholder={(p as any).placeholder}
                    onChange={e => setCampo(p.id, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                    style={{ background: 'var(--input-bg, var(--muted-bg))', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  />
                )}

                {p.type === 'number' && (
                  <input
                    type="number"
                    value={respuestas[p.id] || ''}
                    onChange={e => setCampo(p.id, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  />
                )}

                {p.type === 'date' && (
                  <input
                    type="date"
                    value={respuestas[p.id] || ''}
                    onChange={e => setCampo(p.id, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  />
                )}

                {p.type === 'textarea' && (
                  <textarea
                    value={respuestas[p.id] || ''}
                    placeholder={(p as any).placeholder}
                    onChange={e => setCampo(p.id, e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  />
                )}

                {p.type === 'select' && (
                  <select
                    value={respuestas[p.id] || ''}
                    onChange={e => setCampo(p.id, e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">— Selecciona —</option>
                    {(p as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}

                {p.type === 'radio' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(p as any).options.map((o: string) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setCampo(p.id, o)}
                        className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${
                          respuestas[p.id] === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'hover:border-indigo-300'
                        }`}
                        style={
                          respuestas[p.id] === o
                            ? {}
                            : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }
                        }
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                )}

                {p.type === 'checkbox' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(p as any).options.map((o: string) => {
                      const checked = Array.isArray(respuestas[p.id]) && respuestas[p.id].includes(o)
                      return (
                        <button
                          key={o}
                          type="button"
                          onClick={() => toggleCheck(p.id, o)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${
                            checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'hover:border-indigo-300'
                          }`}
                          style={checked ? {} : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400'}`}>
                            {checked && <CheckCircle2 size={12} className="text-white" />}
                          </div>
                          {o}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Navegación */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: 'var(--card-border)' }}>
            <button
              onClick={() => setPasoActual(p => Math.max(0, p - 1))}
              disabled={pasoActual === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-30"
              style={{ color: 'var(--text-secondary)' }}
            >
              <ChevronLeft size={18} /> Anterior
            </button>

            {pasoActual < SECCIONES.length - 1 ? (
              <button
                onClick={siguiente}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:scale-105 transition-transform"
              >
                Siguiente <ChevronRight size={18} />
              </button>
            ) : (
              <button
                onClick={enviarIntake}
                disabled={enviando || analizando}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
              >
                {enviando || analizando ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    {analizando ? 'Analizando con IA…' : 'Enviando…'}
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Enviar y analizar
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ═══ ESTADO: analizando ════════════════════════════════════════════════
  if (estado === 'analizando') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white mb-6 animate-pulse">
          <Brain size={48} />
        </div>
        <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
          Analizando la información…
        </h2>
        <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
          Nuestra IA clínica está estudiando las respuestas y armando una recomendación personalizada.
          Esto puede tomar unos segundos. Si tarda más, vuelve en un momento.
        </p>
        <button
          onClick={cargar}
          className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-2 mx-auto"
        >
          <Loader2 className="animate-spin" size={18} /> Verificar de nuevo
        </button>
      </div>
    )
  }

  // ═══ ESTADO: recomendado / servicios_listos ════════════════════════════
  if (estado === 'recomendado' || estado === 'servicios_listos') {
    const rec = evaluacion.recomendacion
    const areas = evaluacion.recomendacion_areas || {}
    const RecIcon = rec === 'neuropsicologica' ? Brain : Heart
    const recLabel = rec === 'psicologica' ? 'Evaluación Psicológica Emocional'
                    : rec === 'neuropsicologica' ? 'Evaluación Neuropsicológica'
                    : 'Evaluación Integral'

    return (
      <div className="max-w-3xl mx-auto pb-12">
        {/* Recomendación */}
        <div className="rounded-3xl p-6 mb-6 text-white shadow-xl"
          style={{ background: rec === 'psicologica' ? 'linear-gradient(135deg,#ec4899,#f43f5e)' : 'linear-gradient(135deg,#6366f1,#3b82f6)' }}>
          <div className="flex items-center gap-3 mb-2">
            <RecIcon size={28} />
            <span className="text-xs font-bold uppercase tracking-widest opacity-80">Recomendación clínica</span>
          </div>
          <h1 className="text-2xl font-black mb-3">{recLabel}</h1>
          <p className="text-white/90 leading-relaxed">{evaluacion.recomendacion_resumen}</p>
        </div>

        {/* Razonamiento */}
        {evaluacion.recomendacion_razon && (
          <div className="rounded-2xl p-6 mb-6 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
            <h3 className="text-sm font-black uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <FileText size={16} /> ¿Por qué esta recomendación?
            </h3>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
              {evaluacion.recomendacion_razon}
            </div>
          </div>
        )}

        {/* Áreas y señales */}
        {(areas.areas_a_evaluar?.length || areas.señales_detectadas?.length) && (
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {areas.areas_a_evaluar?.length > 0 && (
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                <h4 className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-primary)' }}>Áreas a evaluar</h4>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {areas.areas_a_evaluar.map((a: string, i: number) => (
                    <li key={i} className="flex items-start gap-2"><span className="text-indigo-500 font-bold">·</span> {a}</li>
                  ))}
                </ul>
              </div>
            )}
            {areas.señales_detectadas?.length > 0 && (
              <div className="rounded-2xl p-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                <h4 className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-primary)' }}>Señales detectadas</h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {areas.señales_detectadas.map((s: any, i: number) => (
                    <li key={i}>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 mr-1">{s.categoria}</span>
                      {s.descripcion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Servicios disponibles */}
        {servicios.length === 0 ? (
          <div className="rounded-2xl p-6 border-2 border-dashed flex items-start gap-3"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
            <Clock size={20} className="text-indigo-500 mt-0.5" />
            <div>
              <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Servicios siendo configurados</p>
              <p className="text-sm">
                Nuestro equipo está preparando los servicios disponibles para tu caso. Te avisaremos en cuanto estén listos.
              </p>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-black mb-3" style={{ color: 'var(--text-primary)' }}>Servicios disponibles</h3>
            <div className="space-y-3 mb-6">
              {servicios.map(s => (
                <button
                  key={s.id}
                  onClick={() => setServicioElegido(s.id)}
                  className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                    servicioElegido === s.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'hover:border-indigo-300'
                  }`}
                  style={{ background: 'var(--card)', borderColor: servicioElegido === s.id ? '#6366f1' : 'var(--card-border)' }}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h4 className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>{s.nombre}</h4>
                      {s.duracion && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>⏱ {s.duracion}</p>}
                    </div>
                    {s.precio && (
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-black text-indigo-600">{Number(s.precio).toFixed(0)}</p>
                        <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{s.moneda || 'PEN'}</p>
                      </div>
                    )}
                  </div>
                  {s.descripcion && (
                    <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{s.descripcion}</p>
                  )}
                  {s.por_que && (
                    <div className="rounded-lg p-3 text-xs mb-3" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
                      <strong className="text-indigo-600">¿Por qué para tu caso?</strong> {s.por_que}
                    </div>
                  )}
                  {Array.isArray(s.incluye) && s.incluye.length > 0 && (
                    <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
                      {s.incluye.map((i: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-500" /> {i}</li>
                      ))}
                    </ul>
                  )}
                </button>
              ))}
            </div>

            {servicioElegido && (
              <div className="rounded-2xl p-5 mb-4 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Mensaje al especialista (opcional)
                </label>
                <textarea
                  value={mensajeEspecialista}
                  onChange={e => setMensajeEspecialista(e.target.value)}
                  placeholder="Algún horario preferido, dudas, comentarios…"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            <button
              onClick={seleccionarServicio}
              disabled={!servicioElegido || enviandoSeleccion}
              className="w-full px-6 py-4 rounded-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl hover:scale-[1.01] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {enviandoSeleccion ? (
                <><Loader2 className="animate-spin" size={20} /> Enviando…</>
              ) : (
                <><Send size={20} /> Confirmar selección y enviar al especialista</>
              )}
            </button>
          </>
        )}
      </div>
    )
  }

  // ═══ ESTADO: seleccionado / completado ═════════════════════════════════
  if (estado === 'seleccionado' || estado === 'completado') {
    const servicio = servicios.find(s => s.id === evaluacion.servicio_seleccionado_id)

    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-8 text-center shadow-xl border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 text-white mb-5">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
            ¡Información enviada al especialista!
          </h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            Tu selección ha sido registrada. <strong>En breve se comunicarán contigo</strong> para coordinar la primera cita.
          </p>

          {servicio && (
            <div className="rounded-2xl p-5 mb-6 text-left" style={{ background: 'var(--muted-bg)' }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Servicio elegido</p>
              <p className="text-lg font-black mb-1" style={{ color: 'var(--text-primary)' }}>{servicio.nombre}</p>
              {servicio.duracion && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{servicio.duracion}</p>}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setVerDocumento(true)}
              className="px-5 py-3 rounded-xl font-bold bg-indigo-600 text-white flex items-center gap-2 justify-center"
            >
              <FileText size={18} /> Ver documento completo
            </button>
            <a
              href="https://wa.me/51991070734"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl font-bold border-2 flex items-center gap-2 justify-center"
              style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
            >
              💬 Contactar al centro
            </a>
          </div>
        </div>

        {/* Modal documento */}
        {verDocumento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setVerDocumento(false)}>
            <div className="max-w-3xl w-full max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
                <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <FileText size={18} /> Documento de evaluación
                </h3>
                <button onClick={() => setVerDocumento(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X size={18} />
                </button>
              </div>
              <pre className="overflow-y-auto p-5 text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>
                {evaluacion.documento_md || 'Documento no disponible'}
              </pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
