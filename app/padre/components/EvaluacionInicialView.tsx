'use client'

// Flujo de Evaluación Inicial — vista del PADRE.
// Estados visibles: intake → analizando → recomendación amigable + confirmación
//   → 2ª anamnesis → catálogo de terapias → esperando → respuesta del especialista.
//
// ⚠️ El padre NUNCA ve documentos clínicos internos, ni razonamiento técnico.

import { useEffect, useState } from 'react'
import {
  ClipboardCheck, Sparkles, Loader2, CheckCircle2, Brain, Heart,
  ChevronRight, ChevronLeft, Send, Clock, X, MessageCircle, Image as ImageIcon,
  ThumbsUp, AlertCircle, Star,
} from 'lucide-react'

type Props = { child: any; profile: any }

type Pregunta =
  | { id: string; type: 'text' | 'textarea' | 'number'; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: 'select' | 'radio'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'checkbox'; label: string; options: string[] }
  | { id: string; type: 'date'; label: string; required?: boolean }

type Seccion = { titulo: string; descripcion?: string; icono: string; preguntas: Pregunta[] }

// ─── Primera ficha: INTAKE (sin cambios) ───────────────────────────────
const SECCIONES_INTAKE: Seccion[] = [
  {
    titulo: 'Motivo de consulta', icono: '💬',
    descripcion: 'Cuéntanos en tus palabras qué te trae al centro.',
    preguntas: [
      { id: 'motivo_principal', type: 'textarea', label: '¿Cuál es el motivo principal por el que buscas evaluación?', required: true },
      { id: 'desde_cuando', type: 'text', label: '¿Desde cuándo notas estas dificultades?', placeholder: 'Ej: hace 6 meses…', required: true },
      { id: 'quien_deriva', type: 'select', label: '¿Quién sugirió la evaluación?', options: ['Iniciativa propia', 'Colegio / docente', 'Pediatra / médico', 'Familiar', 'Otro profesional'], required: true },
    ],
  },
  {
    titulo: 'Desarrollo y antecedentes', icono: '👶',
    preguntas: [
      { id: 'embarazo', type: 'radio', label: 'El embarazo fue:', options: ['Normal', 'Con complicaciones', 'No lo sé'] },
      { id: 'tipo_parto', type: 'radio', label: 'Tipo de parto:', options: ['Natural', 'Cesárea programada', 'Cesárea de emergencia', 'No lo sé'] },
      { id: 'prematuro', type: 'radio', label: '¿Fue prematuro/a?', options: ['No', 'Sí, leve (35-37 sem)', 'Sí, moderado (32-34 sem)', 'Sí, severo (<32 sem)'] },
      { id: 'caminar_edad', type: 'text', label: '¿A qué edad caminó solo/a?', placeholder: 'Ej: 12 meses' },
      { id: 'primeras_palabras', type: 'text', label: '¿A qué edad dijo sus primeras palabras?', placeholder: 'Ej: 14 meses' },
      { id: 'antecedentes_medicos', type: 'checkbox', label: 'Marca si presentó alguno:', options: ['Convulsiones', 'Meningitis o encefalitis', 'Golpes fuertes en la cabeza', 'Hospitalizaciones', 'Cirugías', 'Problemas auditivos', 'Problemas visuales', 'Ninguno'] },
    ],
  },
  {
    titulo: 'Área cognitiva y aprendizaje', icono: '🧠',
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
    titulo: 'Área socioemocional', icono: '❤️',
    preguntas: [
      { id: 'estado_animo', type: 'checkbox', label: 'Marca lo que observas frecuentemente:', options: ['Tristeza', 'Ansiedad / preocupación', 'Miedos intensos', 'Irritabilidad o enojo', 'Llanto frecuente', 'Cambios bruscos de humor', 'Está bien la mayoría del tiempo'] },
      { id: 'regulacion', type: 'radio', label: '¿Le cuesta calmarse cuando se frustra?', options: ['No', 'A veces', 'Frecuentemente'] },
      { id: 'vinculos', type: 'radio', label: 'Cómo se relaciona con otros niños:', options: ['Bien, hace amigos fácilmente', 'Le cuesta un poco', 'Se aísla / prefiere estar solo/a', 'Tiene conflictos frecuentes'] },
      { id: 'evento_estresante', type: 'textarea', label: '¿Ha vivido algún evento significativo recientemente?' },
      { id: 'conductas_repetitivas', type: 'radio', label: '¿Movimientos o conductas repetitivas, intereses muy fijos o le incomodan los cambios?', options: ['No', 'Un poco', 'Sí, claramente'] },
    ],
  },
  {
    titulo: 'Familia y entorno', icono: '🏠',
    preguntas: [
      { id: 'con_quien_vive', type: 'text', label: '¿Con quién vive?', placeholder: 'Ej: papá, mamá, dos hermanas…' },
      { id: 'dinamica_familiar', type: 'textarea', label: 'Cómo describirías la dinámica familiar actual:' },
      { id: 'antecedentes_familiares', type: 'checkbox', label: '¿Hay antecedentes familiares?', options: ['TDAH', 'TEA / autismo', 'Dificultades de aprendizaje', 'Depresión / ansiedad', 'Epilepsia / convulsiones', 'Otros trastornos del desarrollo', 'Ninguno'] },
    ],
  },
  {
    titulo: 'Expectativas', icono: '✨',
    preguntas: [
      { id: 'expectativas', type: 'textarea', label: '¿Qué esperas obtener de esta evaluación?', required: true },
      { id: 'observaciones', type: 'textarea', label: '¿Algo más que quieras compartir con el equipo?' },
    ],
  },
]

// ─── Segunda ficha: ANAMNESIS PSICOLÓGICA ──────────────────────────────
const SECCIONES_PSICO: Seccion[] = [
  {
    titulo: 'Historia emocional', icono: '💗',
    descripcion: 'Profundicemos en cómo se siente tu hijo/a.',
    preguntas: [
      { id: 'cuando_empezaron', type: 'textarea', label: '¿Cuándo notaste por primera vez los cambios emocionales?', required: true },
      { id: 'situaciones_dificiles', type: 'textarea', label: '¿Hay situaciones específicas que lo/la afectan más? (colegio, casa, familia, amigos)', required: true },
      { id: 'duerme', type: 'radio', label: '¿Cómo duerme?', options: ['Bien, descansa', 'Le cuesta dormir', 'Se despierta seguido', 'Pesadillas frecuentes'] },
      { id: 'apetito', type: 'radio', label: 'Apetito:', options: ['Normal', 'Aumentó', 'Disminuyó', 'Variable'] },
      { id: 'energia', type: 'radio', label: 'Nivel de energía:', options: ['Normal para su edad', 'Muy activo/a', 'Cansado/a / desganado/a', 'Variable'] },
    ],
  },
  {
    titulo: 'Vínculos y relaciones', icono: '🤝',
    preguntas: [
      { id: 'figura_apego', type: 'text', label: '¿Con quién se siente más cómodo/a o protegido/a?', placeholder: 'Ej: mamá, abuelita, papá…' },
      { id: 'amigos', type: 'radio', label: '¿Tiene amigos cercanos?', options: ['Sí, varios', 'Uno o dos', 'No realmente', 'No quiere tenerlos'] },
      { id: 'conflictos_escuela', type: 'textarea', label: '¿Ha tenido conflictos en el colegio? (bullying, peleas, aislamiento)' },
      { id: 'figuras_apoyo', type: 'textarea', label: '¿Quiénes son sus figuras de apoyo emocional?' },
    ],
  },
  {
    titulo: 'Conductas y reacciones', icono: '🌪️',
    preguntas: [
      { id: 'que_le_calma', type: 'textarea', label: 'Cuando está mal, ¿qué cosas le ayudan a calmarse?' },
      { id: 'expresa_emociones', type: 'radio', label: '¿Expresa sus emociones?', options: ['Sí, las habla', 'Las muestra con conducta', 'Se las guarda', 'Depende del momento'] },
      { id: 'autoestima', type: 'radio', label: '¿Cómo describirías su autoestima?', options: ['Alta y estable', 'Adecuada', 'Baja', 'Muy crítica de sí mismo/a'] },
      { id: 'pensamientos_dificiles', type: 'textarea', label: '¿Ha expresado pensamientos preocupantes? (no querer estar, hacerse daño, etc.) Tu honestidad nos ayuda a cuidarlo/a mejor.' },
    ],
  },
  {
    titulo: 'Contexto familiar actual', icono: '🏡',
    preguntas: [
      { id: 'cambios_recientes', type: 'checkbox', label: '¿Han habido cambios recientes?', options: ['Mudanza', 'Separación o divorcio', 'Nuevo hermano/a', 'Pérdida o duelo', 'Enfermedad familiar', 'Cambio de colegio', 'Ninguno'] },
      { id: 'rutina_casa', type: 'textarea', label: 'Cómo es la rutina en casa (horarios, dispositivos, actividades)' },
      { id: 'que_te_preocupa_mas', type: 'textarea', label: '¿Qué es lo que más te preocupa como padre/madre?', required: true },
    ],
  },
]

// ─── Segunda ficha: ANAMNESIS NEUROPSICOLÓGICA ──────────────────────────
const SECCIONES_NEURO: Seccion[] = [
  {
    titulo: 'Historia prenatal y perinatal', icono: '🤰',
    descripcion: 'Detalles del embarazo y nacimiento.',
    preguntas: [
      { id: 'embarazo_complicaciones', type: 'textarea', label: 'Si hubo complicaciones en el embarazo, descríbelas:' },
      { id: 'medicamentos_embarazo', type: 'text', label: '¿Mamá tomó medicamentos durante el embarazo?', placeholder: 'Cuáles' },
      { id: 'peso_nacer', type: 'text', label: 'Peso al nacer:', placeholder: 'Ej: 3.2 kg' },
      { id: 'apgar', type: 'text', label: 'APGAR (si lo recuerdas):', placeholder: 'Ej: 9/9' },
      { id: 'oxigeno', type: 'radio', label: '¿Necesitó oxígeno o incubadora?', options: ['No', 'Sí, pocas horas', 'Sí, varios días', 'No lo sé'] },
    ],
  },
  {
    titulo: 'Desarrollo motor y del habla', icono: '🚶',
    preguntas: [
      { id: 'sostener_cabeza', type: 'text', label: '¿A qué edad sostuvo la cabeza?', placeholder: 'Meses' },
      { id: 'sentarse', type: 'text', label: '¿Sentarse solo/a?', placeholder: 'Meses' },
      { id: 'gatear', type: 'text', label: '¿Gatear?', placeholder: 'Meses' },
      { id: 'caminar', type: 'text', label: '¿Caminar solo/a?', placeholder: 'Meses' },
      { id: 'balbuceo', type: 'text', label: '¿Primeros balbuceos?', placeholder: 'Meses' },
      { id: 'primeras_palabras_detalle', type: 'text', label: '¿Primeras palabras?', placeholder: 'Meses' },
      { id: 'frases', type: 'text', label: '¿Primeras frases de 2-3 palabras?', placeholder: 'Meses' },
      { id: 'habla_actual', type: 'radio', label: '¿Cómo es el habla actualmente?', options: ['Clara y completa', 'Algunas palabras confusas', 'Habla poco para su edad', 'No habla aún'] },
    ],
  },
  {
    titulo: 'Historia médica relevante', icono: '🏥',
    preguntas: [
      { id: 'convulsiones', type: 'radio', label: '¿Ha tenido convulsiones?', options: ['No', 'Sí, una vez', 'Sí, varias veces'] },
      { id: 'detalle_convulsiones', type: 'textarea', label: 'Si tuvo convulsiones, descríbelas (cuándo, duración, frecuencia)' },
      { id: 'golpes_cabeza', type: 'radio', label: '¿Golpes fuertes en la cabeza?', options: ['No', 'Sí, sin pérdida de conciencia', 'Sí, con pérdida de conciencia'] },
      { id: 'enfermedades_graves', type: 'textarea', label: '¿Ha tenido enfermedades graves o cirugías? (meningitis, hospitalizaciones largas, etc.)' },
      { id: 'medicamentos_actuales', type: 'text', label: '¿Toma medicamentos actualmente?', placeholder: 'Cuáles y para qué' },
    ],
  },
  {
    titulo: 'Atención, memoria y aprendizaje', icono: '🎯',
    preguntas: [
      { id: 'mantiene_atencion', type: 'radio', label: '¿Cuánto tiempo mantiene la atención en una tarea?', options: ['Más de 30 min', '15-30 min', '5-15 min', 'Menos de 5 min'] },
      { id: 'se_distrae', type: 'radio', label: '¿Se distrae fácilmente con ruidos o estímulos?', options: ['No', 'A veces', 'Frecuentemente', 'Siempre'] },
      { id: 'sigue_instrucciones', type: 'radio', label: '¿Sigue instrucciones de varios pasos?', options: ['Sí, sin problema', 'Si son simples', 'Le cuesta', 'No las sigue'] },
      { id: 'olvida_recientes', type: 'radio', label: '¿Olvida cosas recientes (qué comió, qué hizo en clase)?', options: ['No', 'A veces', 'Frecuentemente'] },
      { id: 'aprende_facil', type: 'radio', label: '¿Le cuesta aprender cosas nuevas?', options: ['No, aprende rápido', 'Aprende a su ritmo', 'Le cuesta', 'Mucho'] },
    ],
  },
  {
    titulo: 'Escuela y socialización', icono: '🎒',
    preguntas: [
      { id: 'materias_dificiles', type: 'textarea', label: '¿Qué materias o áreas le cuestan más?' },
      { id: 'apoyo_escolar', type: 'radio', label: '¿Recibe apoyo escolar adicional?', options: ['No', 'Sí, en el colegio', 'Sí, particular', 'Sí, terapéutico'] },
      { id: 'juego_simbolico', type: 'radio', label: 'Cuando era más pequeño, ¿jugaba a imaginar (cocinitas, doctor, muñecos)?', options: ['Sí, mucho', 'Algo', 'Poco', 'No'] },
      { id: 'intereses_actuales', type: 'textarea', label: '¿Cuáles son sus intereses actuales? (juegos, temas favoritos)' },
    ],
  },
]

// ═════════════════════════════════════════════════════════════════════════
export default function EvaluacionInicialView({ child, profile }: Props) {
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [terapias, setTerapias] = useState<any[]>([])

  // Estado del wizard intake
  const [pasoIntake, setPasoIntake] = useState(0)
  const [respIntake, setRespIntake] = useState<Record<string, any>>({})
  const [enviandoIntake, setEnviandoIntake] = useState(false)
  const [analizando, setAnalizando] = useState(false)

  // Estado wizard anamnesis
  const [pasoAnamnesis, setPasoAnamnesis] = useState(0)
  const [respAnamnesis, setRespAnamnesis] = useState<Record<string, any>>({})
  const [enviandoAnamnesis, setEnviandoAnamnesis] = useState(false)

  // Estado selección de terapias
  const [terapiasElegidas, setTerapiasElegidas] = useState<string[]>([])
  const [mensajeEspecialista, setMensajeEspecialista] = useState('')
  const [enviandoSeleccion, setEnviandoSeleccion] = useState(false)

  // Estado confirmación recomendación
  const [confirmando, setConfirmando] = useState(false)
  const [showRechazoModal, setShowRechazoModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  useEffect(() => { if (child?.id) cargar() }, [child?.id])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/evaluacion-inicial?child_id=${child.id}`)
      const data = await res.json()
      if (data.ok) {
        setEvaluacion(data.evaluacion)
        if (data.evaluacion?.respuestas_intake) setRespIntake(data.evaluacion.respuestas_intake)
        if (data.evaluacion?.anamnesis_especifica) setRespAnamnesis(data.evaluacion.anamnesis_especifica)
        if (data.evaluacion?.terapias_seleccionadas) setTerapiasElegidas(data.evaluacion.terapias_seleccionadas)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const cargarTerapias = async () => {
    try {
      const res = await fetch('/api/terapias-catalogo')
      const data = await res.json()
      if (data.ok) setTerapias(data.terapias || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (evaluacion?.estado === 'anamnesis_completa' ||
        evaluacion?.estado === 'terapia_seleccionada' ||
        evaluacion?.estado === 'revisado' ||
        evaluacion?.estado === 'completado') {
      cargarTerapias()
    }
  }, [evaluacion?.estado])

  if (!child) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Selecciona un hijo/a.</div>
  }
  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
  }

  const estado = evaluacion?.estado || 'pendiente_intake'

  // ═══ FASE 1: INTAKE INICIAL ════════════════════════════════════════════
  if (estado === 'pendiente_intake' || !evaluacion) {
    return <WizardIntake
      child={child}
      profile={profile}
      seccionIdx={pasoIntake}
      setSeccionIdx={setPasoIntake}
      respuestas={respIntake}
      setRespuestas={setRespIntake}
      enviando={enviandoIntake}
      analizando={analizando}
      onEnviar={async () => {
        setEnviandoIntake(true)
        try {
          const res = await fetch('/api/evaluacion-inicial', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ child_id: child.id, parent_id: profile?.id, respuestas: respIntake }),
          })
          const d = await res.json()
          if (!d.ok) throw new Error(d.error)
          setAnalizando(true)
          await fetch('/api/evaluacion-inicial/analizar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: d.evaluacion.id }),
          })
          await cargar()
        } catch (e: any) { alert('Error: ' + e.message) }
        finally { setEnviandoIntake(false); setAnalizando(false) }
      }}
    />
  }

  // ═══ FASE 2: ANALIZANDO ════════════════════════════════════════════════
  if (estado === 'analizando') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white mb-6 animate-pulse">
          <Brain size={48} />
        </div>
        <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
          Estamos revisando tu información…
        </h2>
        <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
          Esto toma unos segundos. Si tarda más, vuelve en un momentito.
        </p>
        <button onClick={cargar} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-2 mx-auto">
          <Loader2 className="animate-spin" size={18} /> Verificar de nuevo
        </button>
      </div>
    )
  }

  // ═══ FASE 3: RECOMENDACIÓN + CONFIRMACIÓN ══════════════════════════════
  if (estado === 'recomendado') {
    const rec = evaluacion.recomendacion
    const mensaje = evaluacion.mensaje_amigable_padre || evaluacion.recomendacion_resumen ||
      'Hemos revisado tu información. Te sugerimos continuar con una evaluación para conocer mejor a tu hijo/a.'
    const RecIcon = rec === 'neuropsicologica' ? Brain : Heart
    const recTitulo = rec === 'psicologica' ? 'Evaluación Psicológica Emocional'
                    : rec === 'neuropsicologica' ? 'Evaluación Neuropsicológica'
                    : 'Evaluación Integral'
    const recColor = rec === 'psicologica' ? 'from-pink-500 to-rose-500' : 'from-indigo-500 to-blue-500'

    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className={`rounded-3xl p-6 mb-6 text-white shadow-xl bg-gradient-to-br ${recColor}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <RecIcon size={26} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Nuestra sugerencia para {child.name}</p>
              <h1 className="text-xl font-black">{recTitulo}</h1>
            </div>
          </div>
          <p className="text-white/95 leading-relaxed whitespace-pre-wrap">{mensaje}</p>
        </div>

        <div className="rounded-2xl p-5 mb-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <h3 className="font-black text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Star size={16} className="text-amber-500" /> ¿Qué sigue si aceptas?
          </h3>
          <ol className="space-y-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li className="flex gap-3"><span className="font-black text-indigo-600">1.</span> Completas una ficha un poco más detallada (5-7 minutos).</li>
            <li className="flex gap-3"><span className="font-black text-indigo-600">2.</span> Te mostramos las terapias que podrían ayudar a {child.name}.</li>
            <li className="flex gap-3"><span className="font-black text-indigo-600">3.</span> Eliges la que prefieras y nuestro equipo te contactará para coordinar.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              setConfirmando(true)
              try {
                const r = await fetch('/api/evaluacion-inicial/confirmar', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ evaluacion_id: evaluacion.id, acepta: true }),
                })
                const d = await r.json()
                if (!d.ok) throw new Error(d.error)
                await cargar()
              } catch (e: any) { alert('Error: ' + e.message) }
              finally { setConfirmando(false) }
            }}
            disabled={confirmando}
            className="flex-1 px-6 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl hover:scale-[1.01] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {confirmando ? <Loader2 className="animate-spin" size={20} /> : <ThumbsUp size={20} />}
            Estoy de acuerdo, continuar
          </button>
          <button
            onClick={() => setShowRechazoModal(true)}
            className="flex-1 sm:flex-initial px-6 py-4 rounded-2xl font-bold text-sm border-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            Tengo dudas
          </button>
        </div>

        {showRechazoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setShowRechazoModal(false)}>
            <div className="max-w-md w-full rounded-2xl shadow-2xl p-6" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
              <h3 className="font-black mb-2" style={{ color: 'var(--text-primary)' }}>Cuéntanos tus dudas</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Nuestro equipo te contactará por WhatsApp para conversar.
              </p>
              <textarea
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                rows={4}
                placeholder="¿Qué te genera dudas?"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none mb-4"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch('/api/evaluacion-inicial/confirmar', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ evaluacion_id: evaluacion.id, acepta: false, motivo_rechazo: motivoRechazo }),
                    })
                    setShowRechazoModal(false)
                    await cargar()
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-white font-bold"
                >Enviar</button>
                <button onClick={() => setShowRechazoModal(false)} className="px-4 py-2.5 rounded-lg border-2 font-bold"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══ FASE 4: 2ª ANAMNESIS ══════════════════════════════════════════════
  if (estado === 'confirmado') {
    const secciones = evaluacion.recomendacion === 'neuropsicologica' ? SECCIONES_NEURO : SECCIONES_PSICO
    return <WizardAnamnesis
      child={child}
      tipo={evaluacion.recomendacion}
      secciones={secciones}
      seccionIdx={pasoAnamnesis}
      setSeccionIdx={setPasoAnamnesis}
      respuestas={respAnamnesis}
      setRespuestas={setRespAnamnesis}
      enviando={enviandoAnamnesis}
      onEnviar={async () => {
        setEnviandoAnamnesis(true)
        try {
          const res = await fetch('/api/evaluacion-inicial/anamnesis', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evaluacion_id: evaluacion.id, respuestas: respAnamnesis }),
          })
          const d = await res.json()
          if (!d.ok) throw new Error(d.error)
          await cargar()
        } catch (e: any) { alert('Error: ' + e.message) }
        finally { setEnviandoAnamnesis(false) }
      }}
    />
  }

  // ═══ FASE 5: SELECCIÓN DE TERAPIAS ═════════════════════════════════════
  if (estado === 'anamnesis_completa') {
    return (
      <div className="max-w-4xl mx-auto pb-12">
        <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
          <h1 className="text-2xl font-black mb-2">🎉 ¡Casi terminamos!</h1>
          <p className="text-white/95">
            Estas son las terapias que ofrecemos en SANTI. Marca la(s) que te interese conocer más. El especialista te contactará con la propuesta personalizada.
          </p>
        </div>

        {terapias.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin mx-auto mb-3" size={32} />
            <p>Cargando terapias…</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {terapias.map(t => {
              const checked = terapiasElegidas.includes(t.id)
              return (
                <button
                  key={t.id}
                  onClick={() => setTerapiasElegidas(arr => arr.includes(t.id) ? arr.filter(x => x !== t.id) : [...arr, t.id])}
                  className={`text-left rounded-2xl border-2 overflow-hidden transition-all ${
                    checked ? 'border-indigo-500 ring-2 ring-indigo-200 scale-[1.01]' : 'hover:border-indigo-300'
                  }`}
                  style={{ background: 'var(--card)', borderColor: checked ? '#6366f1' : 'var(--card-border)' }}
                >
                  {t.imagen_url ? (
                    <img src={t.imagen_url} alt={t.nombre} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                      <ImageIcon size={36} className="text-indigo-300" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-black text-base flex-1" style={{ color: 'var(--text-primary)' }}>{t.nombre}</h4>
                      {checked && <CheckCircle2 size={20} className="text-indigo-600 shrink-0" />}
                    </div>
                    {t.categoria && (
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 mb-2">
                        {t.categoria}
                      </span>
                    )}
                    {t.descripcion && <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t.descripcion}</p>}
                    {t.por_que && (
                      <div className="rounded-lg p-2 text-xs mb-2" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
                        <strong className="text-indigo-600">¿Por qué?</strong> {t.por_que}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                      {t.duracion && <span>⏱ {t.duracion}</span>}
                      {t.precio && <span className="font-black text-indigo-600 text-sm">{Number(t.precio).toFixed(0)} {t.moneda || 'PEN'}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="rounded-2xl p-5 mb-4 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Mensaje al especialista (opcional)
          </label>
          <textarea
            value={mensajeEspecialista}
            onChange={e => setMensajeEspecialista(e.target.value)}
            rows={3}
            placeholder="Horarios preferidos, dudas, comentarios…"
            className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          />
        </div>

        <button
          onClick={async () => {
            if (terapiasElegidas.length === 0) { alert('Elige al menos una terapia'); return }
            setEnviandoSeleccion(true)
            try {
              const r = await fetch('/api/evaluacion-inicial/seleccionar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  evaluacion_id: evaluacion.id,
                  terapia_ids: terapiasElegidas,
                  mensaje_al_especialista: mensajeEspecialista,
                }),
              })
              const d = await r.json()
              if (!d.ok) throw new Error(d.error)
              await cargar()
            } catch (e: any) { alert('Error: ' + e.message) }
            finally { setEnviandoSeleccion(false) }
          }}
          disabled={terapiasElegidas.length === 0 || enviandoSeleccion}
          className="w-full px-6 py-4 rounded-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {enviandoSeleccion ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          Enviar al especialista ({terapiasElegidas.length} terapia{terapiasElegidas.length === 1 ? '' : 's'})
        </button>
      </div>
    )
  }

  // ═══ FASE 6: ESPERANDO RESPUESTA DEL ESPECIALISTA ══════════════════════
  if (estado === 'terapia_seleccionada') {
    const elegidas = terapias.filter(t => (evaluacion.terapias_seleccionadas || []).includes(t.id))
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-8 text-center shadow-xl border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-5 animate-pulse">
            <Clock size={40} />
          </div>
          <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
            Tu solicitud está en revisión
          </h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            Nuestro <strong>especialista está revisando tu caso</strong>. En cuanto tengamos una respuesta personalizada para {child.name}, te la enviaremos por aquí y por WhatsApp.
          </p>
          {elegidas.length > 0 && (
            <div className="rounded-2xl p-4 mb-6 text-left" style={{ background: 'var(--muted-bg)' }}>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Terapias que pediste conocer</p>
              <ul className="space-y-1">
                {elegidas.map(t => (
                  <li key={t.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 size={14} className="text-green-500" /> {t.nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold border-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            <MessageCircle size={18} /> Contactar al centro mientras tanto
          </a>
        </div>
      </div>
    )
  }

  // ═══ FASE 7: RESPUESTA DEL ESPECIALISTA ════════════════════════════════
  if (estado === 'revisado' || estado === 'completado') {
    const elegidas = terapias.filter(t => (evaluacion.terapias_seleccionadas || []).includes(t.id))
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-7 shadow-xl border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Respuesta del especialista</p>
              <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>Mensaje para {child.name}</h2>
            </div>
          </div>

          {evaluacion.respuesta_especialista ? (
            <div className="rounded-2xl p-5 mb-5 whitespace-pre-wrap leading-relaxed"
              style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--text-primary)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {evaluacion.respuesta_especialista}
            </div>
          ) : (
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>El especialista enviará su mensaje pronto.</p>
          )}

          {elegidas.length > 0 && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--muted-bg)' }}>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Terapias solicitadas</p>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                {elegidas.map(t => <li key={t.id}>· {t.nombre}</li>)}
              </ul>
            </div>
          )}

          <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-600 text-white font-bold">
            <MessageCircle size={18} /> Coordinar primera cita
          </a>
        </div>
      </div>
    )
  }

  // ═══ FASE: RECHAZADO ═══════════════════════════════════════════════════
  if (estado === 'rechazado') {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-7 text-center shadow-xl border-2 border-amber-300 bg-amber-50">
          <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-3 text-amber-900">Recibimos tus dudas</h2>
          <p className="text-amber-800 mb-5">
            Nuestro equipo se va a comunicar contigo para conversar sobre tu caso y resolver cualquier inquietud.
          </p>
          <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 text-white font-bold">
            <MessageCircle size={18} /> Contactar ahora
          </a>
        </div>
      </div>
    )
  }

  return null
}

// ═════════════════════════════════════════════════════════════════════════
// Componentes wizard reutilizables
// ═════════════════════════════════════════════════════════════════════════

function WizardIntake({ child, seccionIdx, setSeccionIdx, respuestas, setRespuestas, enviando, analizando, onEnviar }: any) {
  const seccion = SECCIONES_INTAKE[seccionIdx]
  const progreso = ((seccionIdx + 1) / SECCIONES_INTAKE.length) * 100

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck size={28} />
          <h1 className="text-2xl font-black">Evaluación Inicial</h1>
        </div>
        <p className="text-white/90 text-sm">
          Esta ficha nos ayuda a entender mejor a <strong>{child.name}</strong>. Toma unos 8-10 minutos.
        </p>
      </div>

      <BarraProgreso paso={seccionIdx + 1} total={SECCIONES_INTAKE.length} progreso={progreso} />

      <SeccionRender seccion={seccion} respuestas={respuestas} setRespuestas={setRespuestas} />

      <NavWizard
        idx={seccionIdx}
        total={SECCIONES_INTAKE.length}
        onPrev={() => setSeccionIdx(Math.max(0, seccionIdx - 1))}
        onNext={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          setSeccionIdx(seccionIdx + 1)
        }}
        onSubmit={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          onEnviar()
        }}
        enviando={enviando}
        textoEnviando={analizando ? 'Analizando…' : 'Enviando…'}
      />
    </div>
  )
}

function WizardAnamnesis({ child, tipo, secciones, seccionIdx, setSeccionIdx, respuestas, setRespuestas, enviando, onEnviar }: any) {
  const seccion = secciones[seccionIdx]
  const progreso = ((seccionIdx + 1) / secciones.length) * 100
  const titulo = tipo === 'neuropsicologica' ? 'Ficha Neuropsicológica' : 'Ficha Psicológica Emocional'

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: tipo === 'neuropsicologica' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#ec4899,#f43f5e)' }}>
        <h1 className="text-2xl font-black mb-1">{titulo}</h1>
        <p className="text-white/90 text-sm">
          Algunas preguntas más para entender mejor a <strong>{child.name}</strong>.
        </p>
      </div>

      <BarraProgreso paso={seccionIdx + 1} total={secciones.length} progreso={progreso} />
      <SeccionRender seccion={seccion} respuestas={respuestas} setRespuestas={setRespuestas} />
      <NavWizard
        idx={seccionIdx}
        total={secciones.length}
        onPrev={() => setSeccionIdx(Math.max(0, seccionIdx - 1))}
        onNext={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          setSeccionIdx(seccionIdx + 1)
        }}
        onSubmit={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          onEnviar()
        }}
        enviando={enviando}
        textoEnviando="Guardando…"
      />
    </div>
  )
}

function BarraProgreso({ paso, total, progreso }: { paso: number; total: number; progreso: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
        <span>Paso {paso} de {total}</span>
        <span>{Math.round(progreso)}%</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${progreso}%` }} />
      </div>
    </div>
  )
}

function NavWizard({ idx, total, onPrev, onNext, onSubmit, enviando, textoEnviando }: any) {
  const last = idx === total - 1
  return (
    <div className="flex items-center justify-between mt-6 pt-6 border-t" style={{ borderColor: 'var(--card-border)' }}>
      <button onClick={onPrev} disabled={idx === 0}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-30"
        style={{ color: 'var(--text-secondary)' }}>
        <ChevronLeft size={18} /> Anterior
      </button>
      {!last ? (
        <button onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
          Siguiente <ChevronRight size={18} />
        </button>
      ) : (
        <button onClick={onSubmit} disabled={enviando}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg disabled:opacity-50">
          {enviando ? <><Loader2 className="animate-spin" size={18} /> {textoEnviando}</> : <><Sparkles size={18} /> Enviar</>}
        </button>
      )}
    </div>
  )
}

function SeccionRender({ seccion, respuestas, setRespuestas }: any) {
  const setCampo = (id: string, v: any) => setRespuestas((r: any) => ({ ...r, [id]: v }))
  const toggleCheck = (id: string, o: string) => setRespuestas((r: any) => {
    const arr = Array.isArray(r[id]) ? r[id] : []
    return { ...r, [id]: arr.includes(o) ? arr.filter((x: string) => x !== o) : [...arr, o] }
  })

  return (
    <div className="rounded-2xl p-6 shadow-lg border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl">{seccion.icono}</span>
        <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{seccion.titulo}</h2>
      </div>
      {seccion.descripcion && <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{seccion.descripcion}</p>}

      <div className="space-y-5">
        {seccion.preguntas.map((p: Pregunta) => (
          <div key={p.id}>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {p.label}{(p as any).required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {(p.type === 'text' || p.type === 'number' || p.type === 'date') && (
              <input
                type={p.type === 'date' ? 'date' : p.type}
                value={respuestas[p.id] || ''}
                placeholder={(p as any).placeholder}
                onChange={e => setCampo(p.id, e.target.value)}
                className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
              />
            )}
            {p.type === 'textarea' && (
              <textarea value={respuestas[p.id] || ''} placeholder={(p as any).placeholder} onChange={e => setCampo(p.id, e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
            )}
            {p.type === 'select' && (
              <select value={respuestas[p.id] || ''} onChange={e => setCampo(p.id, e.target.value)}
                className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                <option value="">— Selecciona —</option>
                {(p as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {p.type === 'radio' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(p as any).options.map((o: string) => (
                  <button key={o} type="button" onClick={() => setCampo(p.id, o)}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${
                      respuestas[p.id] === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'hover:border-indigo-300'
                    }`}
                    style={respuestas[p.id] === o ? {} : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
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
                    <button key={o} type="button" onClick={() => toggleCheck(p.id, o)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${
                        checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'hover:border-indigo-300'
                      }`}
                      style={checked ? {} : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
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
    </div>
  )
}
