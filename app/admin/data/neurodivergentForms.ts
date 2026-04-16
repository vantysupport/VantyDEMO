// ==============================================================================
// FORMULARIOS CLÍNICOS ABA — Jugando Aprendo
// Organizados por categoría diagnóstica con análisis IA
// ==============================================================================

export type FormCategory = 'tdah' | 'tea' | 'conductual' | 'sensorial' | 'habilidades' | 'familia' | 'seguimiento'

export interface FormDefinition {
  id: string
  title: string
  subtitle: string
  category: FormCategory
  icon: string
  color: string
  targetRole: 'admin' | 'parent' | 'both'
  estimatedMinutes: number
  description: string
  tags: string[]
  sections: FormSection[]
}

export interface FormSection {
  title: string
  description?: string
  questions: FormQuestion[]
}

export interface FormQuestion {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'scale' | 'number' | 'date' | 'time' | 'boolean' | 'frequency'
  placeholder?: string
  options?: string[]
  min?: number
  max?: number
  required?: boolean
  helpText?: string
}

// ─── CATEGORÍAS CON METADATA ───────────────────────────────────────────────
export const FORM_CATEGORIES = {
  tdah: {
    label: 'TDAH',
    fullLabel: 'Trastorno por Déficit de Atención e Hiperactividad',
    color: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    icon: '⚡',
  },
  tea: {
    label: 'TEA',
    fullLabel: 'Trastorno del Espectro Autista',
    color: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: '🧩',
  },
  conductual: {
    label: 'Conductual',
    fullLabel: 'Análisis y Modificación de Conducta',
    color: 'from-red-500 to-rose-500',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: '📊',
  },
  sensorial: {
    label: 'Sensorial',
    fullLabel: 'Procesamiento e Integración Sensorial',
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    icon: '🌀',
  },
  habilidades: {
    label: 'Habilidades',
    fullLabel: 'Habilidades Sociales, Comunicación y Lenguaje',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: '🤝',
  },
  familia: {
    label: 'Familia',
    fullLabel: 'Formularios para Padres y Familia',
    color: 'from-pink-500 to-rose-400',
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    icon: '🏠',
  },
  seguimiento: {
    label: 'Seguimiento',
    fullLabel: 'Seguimiento Clínico y Progreso',
    color: 'from-cyan-500 to-sky-500',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-700',
    icon: '📈',
  },
}

const FREQ_OPTIONS = ['Nunca', 'Raramente (1-2 veces/mes)', 'A veces (1-2 veces/semana)', 'Frecuentemente (3-4 veces/semana)', 'Casi siempre (diario)', 'Siempre (varias veces al día)']
const INTENSITY_OPTIONS = ['No aplica', 'Leve - casi no afecta', 'Moderado - afecta parcialmente', 'Intenso - afecta mucho', 'Muy intenso - incapacitante']
const CONCERN_OPTIONS = ['Sin preocupación', 'Leve preocupación', 'Preocupación moderada', 'Preocupación significativa', 'Preocupación grave']

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORÍA: TDAH
// ═══════════════════════════════════════════════════════════════════════════════

export const SCREENING_TDAH: FormDefinition = {
  id: 'screening_tdah',
  title: 'Screening TDAH (Conners Adaptado)',
  subtitle: 'Evaluación de síntomas de inatención e hiperactividad',
  category: 'tdah',
  icon: '⚡',
  color: 'from-orange-500 to-amber-500',
  targetRole: 'admin',
  estimatedMinutes: 20,
  description: 'Evaluación basada en criterios DSM-5 y escala Conners para identificar y cuantificar síntomas de TDAH.',
  tags: ['TDAH', 'Inatención', 'Hiperactividad', 'Impulsividad', 'DSM-5'],
  sections: [
    {
      title: '1. Síntomas de Inatención',
      description: 'Evalúa la frecuencia de cada comportamiento en los últimos 6 meses',
      questions: [
        { id: 'inat_detalles', label: 'No presta atención a los detalles o comete errores por descuido', type: 'frequency', options: FREQ_OPTIONS, required: true },
        { id: 'inat_atencion', label: 'Tiene dificultad para mantener la atención en tareas o juegos', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_escucha', label: 'Parece no escuchar cuando se le habla directamente', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_instrucciones', label: 'No sigue instrucciones y no termina tareas escolares o del hogar', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_organizar', label: 'Tiene dificultad para organizar tareas y actividades', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_esfuerzo', label: 'Evita tareas que requieren esfuerzo mental sostenido', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_objetos', label: 'Pierde objetos necesarios (juguetes, lápices, libros)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_distraido', label: 'Se distrae fácilmente con estímulos externos', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'inat_olvidadizo', label: 'Olvidadizo en las actividades diarias', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '2. Síntomas de Hiperactividad-Impulsividad',
      questions: [
        { id: 'hiper_manos', label: 'Mueve en exceso manos o pies, o se retuerce en el asiento', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_asiento', label: 'Se levanta del asiento cuando debería permanecer sentado', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_corretea', label: 'Corretea o trepa en situaciones inapropiadas', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_juego', label: 'Tiene dificultad para jugar o realizar actividades tranquilas', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_motor', label: 'Actúa como si tuviera un motor, siempre en movimiento', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_habla', label: 'Habla en exceso', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_responde', label: 'Responde antes de que terminen la pregunta', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_turno', label: 'Tiene dificultad para esperar su turno', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hiper_interrumpe', label: 'Interrumpe o irrumpe en conversaciones o juegos', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '3. Impacto Funcional',
      questions: [
        { id: 'impacto_escuela', label: 'Impacto en rendimiento escolar', type: 'select', options: CONCERN_OPTIONS },
        { id: 'impacto_social', label: 'Impacto en relaciones con compañeros', type: 'select', options: CONCERN_OPTIONS },
        { id: 'impacto_familia', label: 'Impacto en dinámica familiar', type: 'select', options: CONCERN_OPTIONS },
        { id: 'inicio_sintomas', label: 'Edad de inicio de síntomas (aproximada)', type: 'number', placeholder: 'Ej: 4', helpText: 'DSM-5 requiere síntomas antes de los 12 años' },
        { id: 'duracion_sintomas', label: 'Duración de los síntomas', type: 'select', options: ['Menos de 6 meses', '6-12 meses', '1-2 años', 'Más de 2 años'] },
        { id: 'contextos', label: '¿En qué contextos se presentan?', type: 'multiselect', options: ['Casa', 'Escuela/Colegio', 'Con otros niños', 'En lugares públicos', 'En todos los contextos'] },
        { id: 'evaluacion_previa', label: '¿Ha tenido evaluación o diagnóstico previo?', type: 'select', options: ['No', 'Sí - sin diagnóstico formal', 'Sí - diagnóstico de TDAH Inatento', 'Sí - diagnóstico de TDAH Hiperactivo-Impulsivo', 'Sí - diagnóstico de TDAH Combinado'] },
        { id: 'medicacion', label: '¿Recibe medicación actualmente?', type: 'select', options: ['No', 'Sí - Metilfenidato', 'Sí - Atomoxetina', 'Sí - otro estimulante', 'Desconoce'] },
        { id: 'observaciones_tdah', label: 'Observaciones Adicionales del Evaluador', type: 'textarea', placeholder: 'Notas clínicas sobre el comportamiento durante la evaluación...' },
      ]
    }
  ]
}

export const CONDUCTA_CASA_TDAH: FormDefinition = {
  id: 'conducta_casa_tdah',
  title: 'Conducta en Casa - TDAH',
  subtitle: 'Informe de los padres sobre conductas en el hogar',
  category: 'tdah',
  icon: '🏠',
  color: 'from-amber-500 to-yellow-500',
  targetRole: 'parent',
  estimatedMinutes: 15,
  description: 'Formulario para que los padres reporten la conducta de su hijo en el hogar.',
  tags: ['TDAH', 'Casa', 'Padres', 'Rutinas'],
  sections: [
    {
      title: '1. Rutinas Diarias',
      description: 'Cuéntenos sobre las rutinas de su hijo en casa',
      questions: [
        { id: 'rutina_manana', label: '¿Cómo es la rutina de la mañana (levantarse, desayunar, prepararse)?', type: 'select', options: ['Sin dificultades', 'Dificultades leves (necesita recordatorios)', 'Dificultades moderadas (requiere ayuda constante)', 'Muy difícil (causa conflicto diario)'] },
        { id: 'tarea_escolar', label: '¿Cómo realiza las tareas escolares en casa?', type: 'select', options: ['Las hace solo sin problemas', 'Necesita supervisión', 'Requiere apoyo constante', 'Es una batalla diaria', 'No las hace'] },
        { id: 'tiempo_tarea', label: '¿Cuánto tiempo tarda en hacer la tarea normalmente?', type: 'select', options: ['Menos de 30 minutos', '30-60 minutos', '1-2 horas', 'Más de 2 horas', 'No termina'] },
        { id: 'hora_dormir', label: '¿Cómo es la hora de dormir?', type: 'select', options: ['Sin problemas', 'Tarda en dormirse', 'Se levanta repetidamente', 'Muy difícil - gran resistencia', 'Muy poco sueño'] },
      ]
    },
    {
      title: '2. Comportamiento en el Hogar',
      questions: [
        { id: 'obedece_instrucciones', label: '¿Obedece las instrucciones a la primera?', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'rabietas', label: '¿Tiene rabietas o explosiones emocionales?', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hermanos', label: '¿Cómo se lleva con hermanos u otros niños en casa?', type: 'select', options: ['Muy bien', 'Bien con algunos conflictos normales', 'Muchos conflictos', 'Conflictos muy frecuentes e intensos', 'No tiene hermanos'] },
        { id: 'actividades_preferidas', label: '¿En qué actividades se concentra bien?', type: 'textarea', placeholder: 'Ej: videojuegos, dibujo, LEGO, ver videos...' },
        { id: 'estres_familiar', label: '¿Cuánto estrés genera su conducta en la familia?', type: 'select', options: INTENSITY_OPTIONS },
      ]
    },
    {
      title: '3. Estrategias que Usan los Padres',
      questions: [
        { id: 'estrategias_funcionan', label: '¿Qué estrategias les funcionan?', type: 'textarea', placeholder: 'Describe qué cosas ayudan a manejar su conducta...' },
        { id: 'estrategias_no_funcionan', label: '¿Qué estrategias NO les funcionan?', type: 'textarea', placeholder: 'Describe qué cosas no ayudan o empeoran la situación...' },
        { id: 'ayuda_necesaria', label: '¿En qué aspecto necesitan más ayuda como familia?', type: 'textarea', placeholder: 'Cuéntenos cómo podemos apoyarlos mejor...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORÍA: TEA / AUTISMO
// ═══════════════════════════════════════════════════════════════════════════════

export const SCREENING_TEA: FormDefinition = {
  id: 'screening_tea',
  title: 'Screening TEA (M-CHAT-R/F Adaptado)',
  subtitle: 'Detección temprana del espectro autista',
  category: 'tea',
  icon: '🧩',
  color: 'from-blue-500 to-indigo-500',
  targetRole: 'admin',
  estimatedMinutes: 25,
  description: 'Basado en el M-CHAT-R/F y criterios DSM-5 para TEA. Evalúa comunicación social, patrones repetitivos y sensorialidad.',
  tags: ['TEA', 'Autismo', 'Comunicación Social', 'Screening'],
  sections: [
    {
      title: '1. Comunicación Social y Lenguaje',
      description: 'Evalúa habilidades de comunicación e interacción social',
      questions: [
        { id: 'tea_contacto_visual', label: 'Contacto visual con personas conocidas', type: 'select', options: ['Normal/consistente', 'Reducido pero presente', 'Escaso', 'Ausente'] },
        { id: 'tea_sonrisa_social', label: 'Sonrisa social (responde a sonrisas de otros)', type: 'select', options: ['Presente y consistente', 'Presente a veces', 'Raramente', 'Ausente'] },
        { id: 'tea_señalar', label: 'Señalar para compartir interés (proto-declarativo)', type: 'select', options: ['Presente', 'A veces', 'Raramente', 'Ausente'] },
        { id: 'tea_nombre', label: 'Responde cuando se le llama por su nombre', type: 'select', options: ['Siempre/casi siempre', 'A veces', 'Raramente', 'Nunca'] },
        { id: 'tea_atencion_conjunta', label: 'Atención conjunta (mirar donde mira el adulto)', type: 'select', options: ['Presente', 'A veces', 'Raramente', 'Ausente'] },
        { id: 'tea_mostrar_objetos', label: 'Muestra objetos para enseñárselos a otros', type: 'select', options: ['Sí, habitualmente', 'A veces', 'Raramente', 'No'] },
        { id: 'tea_juego_imitativo', label: 'Imita acciones de otras personas', type: 'select', options: ['Sí, espontáneamente', 'Cuando se le pide', 'Raramente', 'No imita'] },
        { id: 'tea_juego_simbolico', label: 'Juego simbólico (hace como si...)', type: 'select', options: ['Presente y variado', 'Juego funcional simple', 'Muy limitado', 'Ausente'] },
        { id: 'tea_interes_ninos', label: 'Interés por jugar con otros niños', type: 'select', options: ['Busca activamente', 'Lo acepta cuando se ofrece', 'Prefiere jugar solo', 'Evita activamente'] },
        { id: 'tea_lenguaje_edad', label: 'Nivel de lenguaje para su edad', type: 'select', options: ['Dentro de rango normal', 'Leve retraso', 'Retraso moderado', 'Retraso significativo', 'Sin lenguaje oral'] },
      ]
    },
    {
      title: '2. Patrones Repetitivos y Restringidos',
      questions: [
        { id: 'tea_estereotipias', label: 'Movimientos repetitivos (aleteo, balanceo, girar)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_rituales', label: 'Rituales o rutinas inflexibles', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_alineacion', label: 'Alinea o ordena objetos de forma repetitiva', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_intereses_restringidos', label: 'Intereses muy intensos y restringidos', type: 'select', options: ['No', 'Leve', 'Moderado (interfiere algunas veces)', 'Intenso (interfiere frecuentemente)'] },
        { id: 'tea_cambios', label: 'Resistencia a cambios en rutinas o entorno', type: 'select', options: INTENSITY_OPTIONS },
        { id: 'tea_uso_objetos', label: 'Uso inusual o poco funcional de objetos', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '3. Procesamiento Sensorial',
      questions: [
        { id: 'tea_hipersensibilidad_auditiva', label: 'Hipersensibilidad a sonidos (tapas oídos, se angustia)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_hipersensibilidad_tactil', label: 'Hipersensibilidad táctil (no tolera ciertas texturas/ropa)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_busqueda_sensorial', label: 'Búsqueda sensorial (huele objetos, se rasca, lame)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tea_selectividad_comida', label: 'Selectividad alimentaria extrema', type: 'select', options: ['No / Normal', 'Leve (pocas restricciones)', 'Moderada (afecta nutrición)', 'Severa (muy pocos alimentos)'] },
      ]
    },
    {
      title: '4. Historia y Contexto',
      questions: [
        { id: 'tea_edad_primeras_preocupaciones', label: 'Edad cuando se notaron las primeras preocupaciones', type: 'text', placeholder: 'Ej: 18 meses, 2 años...' },
        { id: 'tea_regresion', label: '¿Hubo pérdida de habilidades previamente adquiridas?', type: 'select', options: ['No', 'Sí - lenguaje', 'Sí - habilidades sociales', 'Sí - ambas', 'No está claro'] },
        { id: 'tea_diagnostico_previo', label: '¿Tiene diagnóstico previo?', type: 'select', options: ['No', 'TEA nivel 1 (antes Asperger)', 'TEA nivel 2', 'TEA nivel 3', 'TEA sin especificar', 'Otro TGD'] },
        { id: 'tea_nivel_funcionamiento', label: 'Nivel de funcionamiento general estimado', type: 'select', options: ['Alto - vida independiente posible', 'Medio - requiere algún apoyo', 'Bajo - requiere apoyo significativo', 'Muy bajo - requiere apoyo total'] },
        { id: 'tea_antecedentes_familiares', label: '¿Antecedentes familiares de TEA, TDAH u otro?', type: 'textarea', placeholder: 'Describe si hay familiares con diagnóstico similar...' },
        { id: 'tea_observaciones', label: 'Observaciones Clínicas del Evaluador', type: 'textarea', placeholder: 'Notas sobre comportamiento durante la sesión, impresión diagnóstica...' },
      ]
    }
  ]
}

export const CONDUCTA_CASA_TEA: FormDefinition = {
  id: 'conducta_casa_tea',
  title: 'Mi hijo en casa - TEA',
  subtitle: 'Formulario para padres sobre el día a día',
  category: 'tea',
  icon: '🏡',
  color: 'from-blue-400 to-cyan-500',
  targetRole: 'parent',
  estimatedMinutes: 20,
  description: 'Cuéntenos cómo es su hijo en casa. Esta información nos ayuda a personalizar mejor la terapia.',
  tags: ['TEA', 'Casa', 'Padres', 'Comunicación'],
  sections: [
    {
      title: '1. Comunicación en Casa',
      description: 'Cuéntenos sobre la comunicación de su hijo',
      questions: [
        { id: 'como_comunica', label: '¿Cómo se comunica su hijo principalmente?', type: 'multiselect', options: ['Palabras sueltas', 'Frases cortas', 'Oraciones completas', 'Gestos y señas', 'Pictogramas/PECS', 'Tablet/comunicador', 'Señalando objetos', 'Llevando al adulto', 'Llanto o vocalizaciones'] },
        { id: 'palabras_funcionales', label: '¿Cuántas palabras funcionales usa aproximadamente?', type: 'select', options: ['No usa palabras', '1-10 palabras', '11-50 palabras', '51-100 palabras', 'Más de 100 palabras'] },
        { id: 'pide_cosas', label: '¿Pide cosas que quiere?', type: 'select', options: ['Sí, claramente con palabras', 'Sí, con gestos/señalando', 'Lo intenta pero con dificultad', 'Raramente lo intenta', 'No pide - toma las cosas directamente'] },
        { id: 'comprende', label: '¿Comprende lo que le decís?', type: 'select', options: ['Comprende bien instrucciones complejas', 'Comprende instrucciones simples (1-2 pasos)', 'Comprende solo palabras sueltas', 'Comprende muy poco'] },
      ]
    },
    {
      title: '2. Rutinas y Vida Diaria',
      questions: [
        { id: 'rutinas_importancia', label: '¿Qué tan importante son las rutinas para su hijo?', type: 'select', options: ['No le afectan los cambios', 'Prefiere rutinas pero tolera cambios', 'Necesita rutinas, se altera con cambios', 'Las rutinas son esenciales, cualquier cambio genera crisis'] },
        { id: 'higiene', label: '¿Cómo es la higiene personal (baño, dientes, etc.)?', type: 'select', options: ['Sin dificultades', 'Necesita recordatorios', 'Requiere apoyo físico', 'Es muy difícil / resistencia intensa'] },
        { id: 'alimentacion', label: '¿Cómo es la alimentación?', type: 'textarea', placeholder: 'Describe qué alimentos acepta, texturas que rechaza, horarios, etc.' },
        { id: 'sueño', label: '¿Cómo es el sueño?', type: 'select', options: ['Duerme bien', 'Dificultad para iniciar el sueño', 'Se despierta frecuentemente', 'Muy poco sueño total', 'Patrones de sueño muy alterados'] },
      ]
    },
    {
      title: '3. Lo que nos Alegra y nos Preocupa',
      description: 'Comparte libremente - toda información es valiosa',
      questions: [
        { id: 'fortalezas_hijo', label: '¿Cuáles son las fortalezas y talentos de su hijo?', type: 'textarea', placeholder: 'Lo que hace bien, lo que le encanta, sus habilidades especiales...' },
        { id: 'mayor_preocupacion', label: '¿Cuál es su mayor preocupación actualmente?', type: 'textarea', placeholder: 'Cuéntenos qué le preocupa más como padre/madre...' },
        { id: 'sueños_familia', label: '¿Qué sueñan para el futuro de su hijo?', type: 'textarea', placeholder: 'Sus expectativas y esperanzas para el futuro...' },
        { id: 'apoyo_familia', label: '¿Qué apoyo reciben como familia?', type: 'multiselect', options: ['Apoyo de pareja', 'Apoyo de abuelos', 'Apoyo de otros padres con hijos similares', 'Grupo de apoyo', 'Psicólogo/terapeuta para la familia', 'Ninguno actualmente'] },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORÍA: SENSORIAL
// ═══════════════════════════════════════════════════════════════════════════════

export const PERFIL_SENSORIAL: FormDefinition = {
  id: 'perfil_sensorial',
  title: 'Perfil de Procesamiento Sensorial',
  subtitle: 'Evaluación de integración sensorial (Dunn adaptado)',
  category: 'sensorial',
  icon: '🌀',
  color: 'from-violet-500 to-purple-500',
  targetRole: 'admin',
  estimatedMinutes: 20,
  description: 'Evalúa cómo procesa cada sistema sensorial: hiper/hiposensibilidad, búsqueda sensorial y evitación.',
  tags: ['Sensorial', 'Integración Sensorial', 'Procesamiento', 'Ocupacional'],
  sections: [
    {
      title: '1. Sistema Auditivo',
      questions: [
        { id: 'aud_tapas', label: 'Se tapa los oídos ante sonidos cotidianos', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_ruido_fondo', label: 'Se distrae con ruidos de fondo que otros ignoran', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_volumen', label: 'Habla muy alto o muy bajo sin darse cuenta', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_busqueda', label: 'Busca sonidos o hace ruidos repetitivamente', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'aud_multisensorial', label: 'Dificultad para procesar habla con ruido de fondo', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '2. Sistema Táctil',
      questions: [
        { id: 'tac_rechazo', label: 'Rechaza ser tocado (abrazos, caricias)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_ropa', label: 'Sensibilidad a texturas de ropa (etiquetas, costuras)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_manos', label: 'Evita mantenerse con manos sucias o mojadas', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_busqueda', label: 'Toca todo lo que encuentra, busca presión física', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_temperatura', label: 'Indiferente al frío, calor o dolor', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'tac_temperatura2', label: 'Hiper-reactivo al dolor o temperatura', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '3. Sistema Visual y Olfativo',
      questions: [
        { id: 'vis_luces', label: 'Hipersensible a luces brillantes (los cierra, llora)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'vis_lineas', label: 'Mira objetos de costado o de cerca', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'olf_olores', label: 'Hipersensible a olores (se aleja, gesto de asco)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'olf_huele', label: 'Huele objetos o personas de forma inusual', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'gust_selectivo', label: 'Selectividad por texturas/sabores de alimentos', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '4. Sistema Propioceptivo y Vestibular',
      questions: [
        { id: 'vest_mareo', label: 'Se marea fácilmente (columpios, autos)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'vest_busca', label: 'Busca girar, columpiarse, moverse en exceso', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_torpeza', label: 'Torpeza, choca con objetos/personas frecuentemente', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_fuerza', label: 'Usa demasiada fuerza (rompe cosas sin querer)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_presion', label: 'Busca presión profunda (pesos, apretones, chalecos)', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'prop_postura', label: 'Postura pobre, se recuesta sobre todo', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '5. Impacto en Funcionamiento',
      questions: [
        { id: 'sens_participa_actividades', label: '¿Evita actividades por razones sensoriales?', type: 'multiselect', options: ['Deportes de contacto', 'Arte/manualidades', 'Música/conciertos', 'Comer en restaurantes', 'Lugares públicos concurridos', 'Centros comerciales', 'Transporte público', 'Ninguna'] },
        { id: 'sens_melts', label: '¿Tiene "colapsos" o sobrecarga sensorial?', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'sens_duracion_colapso', label: 'Duración típica de una sobrecarga sensorial', type: 'select', options: ['No tiene colapsos', 'Menos de 5 minutos', '5-15 minutos', '15-30 minutos', 'Más de 30 minutos'] },
        { id: 'sens_regulacion', label: '¿Qué ayuda a regularse?', type: 'textarea', placeholder: 'Describe qué estrategias regulan los episodios de sobrecarga...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORÍA: HABILIDADES SOCIALES
// ═══════════════════════════════════════════════════════════════════════════════

export const HABILIDADES_SOCIALES: FormDefinition = {
  id: 'habilidades_sociales',
  title: 'Evaluación de Habilidades Sociales',
  subtitle: 'Inventario de competencias sociales y comunicativas',
  category: 'habilidades',
  icon: '🤝',
  color: 'from-emerald-500 to-teal-500',
  targetRole: 'admin',
  estimatedMinutes: 20,
  description: 'Evalúa habilidades pragmáticas, resolución de conflictos, reconocimiento emocional y competencias sociales.',
  tags: ['Habilidades Sociales', 'Pragmática', 'Emociones', 'Comunicación'],
  sections: [
    {
      title: '1. Inicio y Mantenimiento de Interacciones',
      questions: [
        { id: 'hs_inicia', label: 'Inicia conversaciones o juegos con pares', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_saluda', label: 'Saluda y despide apropiadamente', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_mantiene', label: 'Mantiene el tema de conversación', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_turno', label: 'Respeta el turno de habla', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'hs_contexto', label: 'Adapta el lenguaje al contexto e interlocutor', type: 'select', options: ['Sí, adecuadamente', 'A veces', 'Raramente', 'No lo hace'] },
        { id: 'hs_espacio_personal', label: 'Respeta el espacio personal de otros', type: 'frequency', options: FREQ_OPTIONS },
      ]
    },
    {
      title: '2. Reconocimiento y Expresión Emocional',
      questions: [
        { id: 'em_reconoce_caras', label: 'Reconoce emociones en rostros de otros', type: 'select', options: ['Correctamente la mayoría', 'Solo emociones básicas (feliz/triste)', 'Con mucha dificultad', 'No las reconoce'] },
        { id: 'em_expresa', label: 'Expresa sus propias emociones adecuadamente', type: 'select', options: ['Sí, de forma apropiada', 'Las expresa pero de forma intensa', 'Dificultad para expresarlas', 'Casi no las expresa'] },
        { id: 'em_empatia', label: 'Muestra empatía cuando otros están tristes o heridos', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'em_regula', label: 'Regula sus emociones sin escalar la conducta', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'em_estrategias', label: '¿Qué estrategias de regulación emocional usa?', type: 'textarea', placeholder: 'Respira, pide ayuda, se aleja, tiene objeto regulador...' },
      ]
    },
    {
      title: '3. Resolución de Conflictos y Juego',
      questions: [
        { id: 'conf_comparte', label: 'Comparte juguetes y materiales', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'conf_resuelve', label: 'Resuelve conflictos sin agresión', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'conf_pide_disculpas', label: 'Pide disculpas cuando hace algo mal', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'juego_tipo', label: 'Tipo de juego predominante', type: 'select', options: ['Solitario', 'Paralelo (junto a otros pero sin interactuar)', 'Asociativo (interacciona brevemente)', 'Cooperativo (juego en equipo con reglas)'] },
        { id: 'juego_reglas', label: 'Acepta y sigue las reglas de juegos', type: 'frequency', options: FREQ_OPTIONS },
        { id: 'juego_perder', label: 'Tolera perder o que no salga como quiere', type: 'select', options: INTENSITY_OPTIONS },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORÍA: FAMILIA (para que llenen los padres)
// ═══════════════════════════════════════════════════════════════════════════════

export const INFORME_PADRES_GENERAL: FormDefinition = {
  id: 'informe_padres_general',
  title: '¿Cómo está mi hijo esta semana?',
  subtitle: 'Reporte semanal de los padres',
  category: 'familia',
  icon: '💌',
  color: 'from-pink-500 to-rose-400',
  targetRole: 'parent',
  estimatedMinutes: 10,
  description: 'Comparte con el equipo terapéutico cómo estuvo tu hijo durante la semana.',
  tags: ['Padres', 'Seguimiento', 'Semanal', 'Casa'],
  sections: [
    {
      title: '¿Cómo estuvo la semana?',
      description: 'Toda información es valiosa para nosotros 💙',
      questions: [
        { id: 'semana_general', label: '¿Cómo calificarías la semana en general?', type: 'select', options: ['⭐ Muy difícil', '⭐⭐ Difícil', '⭐⭐⭐ Normal', '⭐⭐⭐⭐ Buena', '⭐⭐⭐⭐⭐ Excelente'] },
        { id: 'logro_semana', label: '¿Hubo algún logro o cosa positiva esta semana?', type: 'textarea', placeholder: 'Cuéntanos algo bueno que pasó, aunque sea pequeño 😊' },
        { id: 'dificultad_semana', label: '¿Hubo alguna dificultad o situación difícil?', type: 'textarea', placeholder: 'Describe lo que fue difícil esta semana...' },
        { id: 'practica_casa', label: '¿Practicaron las estrategias recomendadas?', type: 'select', options: ['Sí, todos los días', 'La mayoría de días', 'Algunos días', 'Casi no pudimos', 'No pudimos / no recordamos'] },
        { id: 'dudas', label: '¿Tienen alguna duda o pregunta para el terapeuta?', type: 'textarea', placeholder: 'Escribe tus preguntas aquí y las respondemos en la próxima sesión...' },
        { id: 'estado_animo_hijo', label: '¿Cómo estuvo el estado de ánimo de tu hijo?', type: 'select', options: ['Muy alegre y tranquilo', 'Bien en general', 'Variable', 'Más irritable de lo habitual', 'Muy difícil'] },
        { id: 'sueño_semana', label: '¿Cómo fue el sueño esta semana?', type: 'select', options: ['Muy bien', 'Bien', 'Regular', 'Mal', 'Muy mal'] },
        { id: 'mensaje_terapeuta', label: '¿Algo más que quieras contarle al terapeuta?', type: 'textarea', placeholder: 'Cualquier cosa que consideres importante...' },
      ]
    }
  ]
}

export const HISTORIA_FAMILIAR: FormDefinition = {
  id: 'historia_familiar',
  title: 'Historia Familiar y del Desarrollo',
  subtitle: 'Formulario inicial para conocer a su familia',
  category: 'familia',
  icon: '👨‍👩‍👧',
  color: 'from-rose-500 to-pink-500',
  targetRole: 'parent',
  estimatedMinutes: 30,
  description: 'Formulario inicial para conocer el contexto familiar y la historia de desarrollo de su hijo.',
  tags: ['Historia Clínica', 'Desarrollo', 'Familia', 'Inicial'],
  sections: [
    {
      title: '1. Familia y Entorno',
      questions: [
        { id: 'fam_composicion', label: '¿Con quiénes vive el niño?', type: 'multiselect', options: ['Padre', 'Madre', 'Hermanos', 'Abuelos', 'Otros familiares', 'Solo con un progenitor'] },
        { id: 'fam_hermanos_cuantos', label: '¿Cuántos hermanos tiene?', type: 'select', options: ['Ninguno (hijo único)', '1 hermano/a', '2 hermanos/as', '3 o más hermanos/as'] },
        { id: 'fam_idioma', label: '¿Qué idioma(s) se hablan en casa?', type: 'text', placeholder: 'Ej: Español, también hablan quechua...' },
        { id: 'fam_situacion', label: '¿Cómo es la situación familiar actualmente?', type: 'select', options: ['Estable y sin eventos significativos', 'Cambio reciente (mudanza, trabajo)', 'Separación o divorcio reciente', 'Pérdida familiar reciente', 'Situación económica difícil', 'Otro cambio importante'] },
      ]
    },
    {
      title: '2. Embarazo y Nacimiento',
      questions: [
        { id: 'emb_complicaciones', label: '¿Hubo complicaciones durante el embarazo?', type: 'textarea', placeholder: 'Infecciones, medicamentos, estrés, otros...' },
        { id: 'emb_semanas', label: '¿A cuántas semanas nació?', type: 'select', options: ['Prematuro extremo (<28 sem)', 'Gran prematuro (28-32 sem)', 'Prematuro tardío (33-36 sem)', 'A término (37-42 sem)', 'Post-término (>42 sem)'] },
        { id: 'nac_peso', label: '¿Cuánto pesó al nacer?', type: 'text', placeholder: 'Ej: 3.200 kg' },
        { id: 'nac_complicaciones', label: '¿Hubo complicaciones al nacer?', type: 'textarea', placeholder: 'UCIN, oxígeno, ictericia, otros...' },
      ]
    },
    {
      title: '3. Hitos del Desarrollo',
      questions: [
        { id: 'hito_sonrisa', label: '¿A qué edad dio la primera sonrisa social?', type: 'text', placeholder: 'Ej: 2 meses' },
        { id: 'hito_sento', label: '¿A qué edad se sentó solo?', type: 'text', placeholder: 'Ej: 6 meses' },
        { id: 'hito_camino', label: '¿A qué edad caminó solo?', type: 'text', placeholder: 'Ej: 12-14 meses' },
        { id: 'hito_palabras', label: '¿A qué edad dijo sus primeras palabras?', type: 'text', placeholder: 'Ej: 12 meses' },
        { id: 'hito_frases', label: '¿A qué edad combinó dos palabras?', type: 'text', placeholder: 'Ej: 24 meses' },
        { id: 'hito_control', label: '¿A qué edad controló esfínteres?', type: 'select', options: ['Antes de los 2 años', '2-3 años', '3-4 años', 'Después de los 4 años', 'Aún no controla'] },
        { id: 'hito_preocupaciones', label: '¿En qué momento se empezaron a preocupar?', type: 'textarea', placeholder: 'Describe cuándo y qué notaron...' },
      ]
    },
    {
      title: '4. Salud y Antecedentes Médicos',
      questions: [
        { id: 'med_enfermedades', label: '¿Ha tenido enfermedades importantes?', type: 'textarea', placeholder: 'Hospitalizaciones, cirugías, enfermedades crónicas...' },
        { id: 'med_medicacion', label: '¿Toma algún medicamento actualmente?', type: 'textarea', placeholder: 'Nombre, dosis, para qué...' },
        { id: 'med_alergias', label: '¿Tiene alergias?', type: 'text', placeholder: 'Alimentos, medicamentos, otros...' },
        { id: 'med_audiologia', label: '¿Se ha evaluado la audición?', type: 'select', options: ['Sí - audición normal', 'Sí - pérdida auditiva leve', 'Sí - pérdida auditiva moderada/severa', 'No se ha evaluado'] },
        { id: 'med_oftalmologia', label: '¿Se ha evaluado la visión?', type: 'select', options: ['Sí - visión normal', 'Sí - usa lentes', 'No se ha evaluado'] },
        { id: 'med_antecedentes_familia', label: '¿Antecedentes familiares relevantes?', type: 'textarea', placeholder: 'TEA, TDAH, discapacidad intelectual, problemas de lenguaje en familia...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// ÍNDICE COMPLETO DE TODOS LOS FORMULARIOS
// ═══════════════════════════════════════════════════════════════════════════════
// Importar formularios competitivos
import {
  EVALUACION_FUNCIONAL_CONDUCTA,
  PLAN_INTERVENCION_CONDUCTUAL,
  OBJETIVOS_IEP,
  EVALUACION_LENGUAJE_VERBAL,
  INFORME_PROGRESO_MENSUAL,
  HABILIDADES_ADAPTATIVAS,
  PERFIL_SENSORIAL_AVANZADO,
  REGISTRO_ABC_AVANZADO,
} from './competitiveForms'

export const ALL_FORMS: FormDefinition[] = [
  // Formularios base
  SCREENING_TDAH,
  CONDUCTA_CASA_TDAH,
  SCREENING_TEA,
  CONDUCTA_CASA_TEA,
  PERFIL_SENSORIAL,
  HABILIDADES_SOCIALES,
  INFORME_PADRES_GENERAL,
  HISTORIA_FAMILIAR,
  // Formularios competitivos (nivel Thread Learning / Central Reach)
  EVALUACION_FUNCIONAL_CONDUCTA,
  PLAN_INTERVENCION_CONDUCTUAL,
  OBJETIVOS_IEP,
  EVALUACION_LENGUAJE_VERBAL,
  INFORME_PROGRESO_MENSUAL,
  HABILIDADES_ADAPTATIVAS,
  PERFIL_SENSORIAL_AVANZADO,
  REGISTRO_ABC_AVANZADO,
]

export const FORMS_BY_CATEGORY = {
  tdah: ALL_FORMS.filter(f => f.category === 'tdah'),
  tea: ALL_FORMS.filter(f => f.category === 'tea'),
  conductual: ALL_FORMS.filter(f => f.category === 'conductual'),
  sensorial: ALL_FORMS.filter(f => f.category === 'sensorial'),
  habilidades: ALL_FORMS.filter(f => f.category === 'habilidades'),
  familia: ALL_FORMS.filter(f => f.category === 'familia'),
  seguimiento: ALL_FORMS.filter(f => f.category === 'seguimiento'),
}

export const PARENT_FORMS = ALL_FORMS.filter(f => f.targetRole === 'parent' || f.targetRole === 'both')
export const ADMIN_FORMS = ALL_FORMS.filter(f => f.targetRole === 'admin' || f.targetRole === 'both')
