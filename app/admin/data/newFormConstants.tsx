// ==============================================================================
// NUEVOS FORMULARIOS CLÍNICOS PROFESIONALES
// Objetivo IEP, Nota de Sesión, Informe Mensual, Registro Conductual
// ==============================================================================

export const FORM_TABLE_MAPPING_NEW: Record<string, string> = {
  'objetivo_iep': 'evaluacion_objetivos_iep',
  'nota_sesion': 'registro_nota_sesion',
  'informe_mensual': 'informe_mensual_progreso',
  'registro_conductual': 'registro_conductual_abc',
}

// ─── FORMULARIO 1: OBJETIVO IEP (Programa de Educación Individualizado) ──────
export const OBJETIVO_IEP_DATA = [
  {
    title: '1. Identificación del Objetivo',
    questions: [
      { id: 'dominio', label: 'Dominio de Intervención', type: 'select', options: ['Comunicación y Lenguaje', 'Habilidades Sociales', 'Conducta Adaptativa', 'Habilidades Académicas', 'Autonomía y Vida Diaria', 'Motricidad Fina', 'Motricidad Gruesa', 'Regulación Emocional', 'Habilidades de Juego'] },
      { id: 'objetivo_largo_plazo', label: 'Meta Anual (Largo Plazo)', type: 'textarea', placeholder: 'Ej: El niño aumentará su vocabulario funcional para comunicar necesidades básicas...' },
      { id: 'objetivo_corto_plazo', label: 'Objetivo a Corto Plazo (trimestral)', type: 'textarea', placeholder: 'Ej: El niño nombrará 10 objetos del hogar al 80% de las oportunidades en 3 sesiones consecutivas...' },
      { id: 'nivel_actual', label: 'Nivel de Desempeño Actual (Línea Base)', type: 'textarea', placeholder: 'Describe el rendimiento actual del paciente en esta habilidad...' },
    ]
  },
  {
    title: '2. Criterios de Evaluación y Estrategias',
    questions: [
      { id: 'criterio_dominio', label: 'Criterio de Dominio', type: 'text', placeholder: 'Ej: 80% de ensayos correctos en 3 sesiones consecutivas' },
      { id: 'metodo_ensenanza', label: 'Método de Enseñanza Principal', type: 'select', options: ['DTT (Discrete Trial Training)', 'NET (Natural Environment Training)', 'PECS', 'Modelado', 'Encadenamiento hacia atrás', 'Encadenamiento hacia adelante', 'Incidental Teaching', 'PRT (Pivotal Response Training)'] },
      { id: 'tipo_ayuda', label: 'Tipo de Ayuda (Prompt) Inicial', type: 'select', options: ['Sin ayuda', 'Gestual', 'Verbal parcial', 'Verbal completo', 'Físico parcial', 'Físico completo', 'Visual/Pictograma'] },
      { id: 'materiales', label: 'Materiales y Recursos Necesarios', type: 'textarea', placeholder: 'Lista los materiales específicos para trabajar este objetivo...' },
    ]
  },
  {
    title: '3. Generalización y Mantenimiento',
    questions: [
      { id: 'escenarios_generalizacion', label: 'Escenarios para Generalización', type: 'multiselect', options: ['Hogar', 'Colegio', 'Parque/exterior', 'Supermercado', 'Con otros adultos', 'Con pares', 'Diferentes materiales', 'Diferentes momentos del día'] },
      { id: 'estrategia_generalizacion', label: 'Plan de Generalización', type: 'textarea', placeholder: 'Describe cómo se promoverá la generalización al hogar y comunidad...' },
      { id: 'fecha_inicio_objetivo', label: 'Fecha de Inicio', type: 'date' },
      { id: 'fecha_revision', label: 'Fecha de Revisión Programada', type: 'date' },
      { id: 'responsable', label: 'Terapeuta Responsable', type: 'text', placeholder: 'Nombre del terapeuta' },
    ]
  }
]

// ─── FORMULARIO 2: NOTA DE SESIÓN CLÍNICA ─────────────────────────────────────
export const NOTA_SESION_DATA = [
  {
    title: '1. Datos de la Sesión',
    questions: [
      { id: 'numero_sesion', label: 'Número de Sesión', type: 'number', placeholder: 'Ej: 42' },
      { id: 'duracion_minutos', label: 'Duración (minutos)', type: 'number', placeholder: '45' },
      { id: 'tipo_sesion', label: 'Modalidad', type: 'select', options: ['Presencial - Centro', 'Presencial - Domicilio', 'Presencial - Escuela', 'Semipresencial', 'Remota/Virtual'] },
      { id: 'estado_animo_inicio', label: 'Estado del Paciente al Inicio', type: 'select', options: ['Tranquilo y colaborador', 'Levemente ansioso', 'Irritable', 'Cansado/somnoliento', 'Muy activo/hiperestimulado', 'Con llanto', 'Resistente', 'Alegre y motivado'] },
    ]
  },
  {
    title: '2. Objetivos Trabajados y Rendimiento',
    questions: [
      { id: 'objetivos_sesion', label: 'Objetivos IEP Trabajados', type: 'textarea', placeholder: 'Lista los objetivos abordados en esta sesión...' },
      { id: 'porcentaje_correcto', label: '% Promedio de Respuestas Correctas', type: 'number', placeholder: 'Ej: 75' },
      { id: 'programas_trabajados', label: 'Programas / Actividades Realizadas', type: 'textarea', placeholder: 'Describe las actividades, juegos y programas realizados durante la sesión...' },
      { id: 'reforzadores_efectivos', label: 'Reforzadores Más Efectivos Hoy', type: 'text', placeholder: 'Ej: Pompas de jabón, elogios verbales, tablet 2 min' },
    ]
  },
  {
    title: '3. Conductas y Observaciones Clínicas',
    questions: [
      { id: 'conductas_problema', label: '¿Se presentaron conductas problema?', type: 'select', options: ['No', 'Sí - leve (no interfirió)', 'Sí - moderado (interfirió parcialmente)', 'Sí - severo (interrumpió la sesión)'] },
      { id: 'descripcion_conductas', label: 'Descripción de Conductas (si aplica)', type: 'textarea', placeholder: 'Describe topografía, frecuencia, duración e intensidad...' },
      { id: 'estrategia_manejo', label: 'Estrategia de Manejo Utilizada', type: 'textarea', placeholder: 'Describe cómo se manejó la conducta...' },
      { id: 'observaciones_generales', label: 'Observaciones Clínicas Generales', type: 'textarea', placeholder: 'Observaciones del terapeuta sobre el estado clínico, nuevas habilidades, regresiones, etc.' },
    ]
  },
  {
    title: '4. Recomendaciones y Plan',
    questions: [
      { id: 'tarea_casa', label: 'Actividades para Casa', type: 'textarea', placeholder: 'Actividades específicas que los padres deben practicar esta semana...' },
      { id: 'ajuste_programa', label: '¿Se requieren ajustes al programa?', type: 'select', options: ['No, continuar igual', 'Aumentar dificultad', 'Reducir exigencia', 'Cambiar reforzador', 'Revisar método de enseñanza', 'Consultar con supervisor'] },
      { id: 'plan_proxima_sesion', label: 'Plan para Próxima Sesión', type: 'textarea', placeholder: 'Objetivos prioritarios y estrategias para la siguiente sesión...' },
      { id: 'comunicar_padres', label: '¿Mensaje para los Padres?', type: 'textarea', placeholder: 'Logros o información importante para comunicar a la familia...' },
    ]
  }
]

// ─── FORMULARIO 3: INFORME MENSUAL DE PROGRESO ────────────────────────────────
export const INFORME_MENSUAL_DATA = [
  {
    title: '1. Resumen del Período',
    questions: [
      { id: 'mes_evaluado', label: 'Mes Evaluado', type: 'select', options: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] },
      { id: 'total_sesiones', label: 'Total de Sesiones Realizadas', type: 'number', placeholder: 'Ej: 8' },
      { id: 'sesiones_faltadas', label: 'Sesiones No Realizadas', type: 'number', placeholder: 'Ej: 1' },
      { id: 'horas_terapia', label: 'Horas de Terapia Directa', type: 'number', placeholder: 'Ej: 6' },
      { id: 'resumen_periodo', label: 'Resumen General del Mes', type: 'textarea', placeholder: 'Descripción breve del desempeño general del paciente durante el mes...' },
    ]
  },
  {
    title: '2. Avance por Dominio',
    questions: [
      { id: 'avance_comunicacion', label: 'Comunicación y Lenguaje', type: 'select', options: ['Sin avance / Regresión', 'Avance mínimo (<20%)', 'Avance moderado (20-50%)', 'Avance significativo (50-80%)', 'Objetivo logrado (>80%)', 'No trabajado este mes'] },
      { id: 'avance_social', label: 'Habilidades Sociales', type: 'select', options: ['Sin avance / Regresión', 'Avance mínimo (<20%)', 'Avance moderado (20-50%)', 'Avance significativo (50-80%)', 'Objetivo logrado (>80%)', 'No trabajado este mes'] },
      { id: 'avance_conducta', label: 'Conducta Adaptativa', type: 'select', options: ['Sin avance / Regresión', 'Avance mínimo (<20%)', 'Avance moderado (20-50%)', 'Avance significativo (50-80%)', 'Objetivo logrado (>80%)', 'No trabajado este mes'] },
      { id: 'avance_autonomia', label: 'Autonomía y Vida Diaria', type: 'select', options: ['Sin avance / Regresión', 'Avance mínimo (<20%)', 'Avance moderado (20-50%)', 'Avance significativo (50-80%)', 'Objetivo logrado (>80%)', 'No trabajado este mes'] },
      { id: 'avance_academico', label: 'Habilidades Académicas / Pre-académicas', type: 'select', options: ['Sin avance / Regresión', 'Avance mínimo (<20%)', 'Avance moderado (20-50%)', 'Avance significativo (50-80%)', 'Objetivo logrado (>80%)', 'No trabajado este mes'] },
    ]
  },
  {
    title: '3. Objetivos Logrados y Nuevos',
    questions: [
      { id: 'objetivos_logrados', label: 'Objetivos Dominados Este Mes', type: 'textarea', placeholder: 'Lista los objetivos que alcanzaron criterio de dominio...' },
      { id: 'objetivos_nuevos', label: 'Nuevos Objetivos Incorporados', type: 'textarea', placeholder: 'Nuevos objetivos que se comenzaron a trabajar...' },
      { id: 'conductas_preocupacion', label: 'Conductas de Preocupación', type: 'textarea', placeholder: 'Conductas problema que persisten o emergieron este mes...' },
    ]
  },
  {
    title: '4. Recomendaciones y Plan Próximo Mes',
    questions: [
      { id: 'recomendaciones_familia', label: 'Recomendaciones para la Familia', type: 'textarea', placeholder: 'Estrategias específicas para implementar en casa...' },
      { id: 'plan_proximo_mes', label: 'Objetivos Prioritarios Próximo Mes', type: 'textarea', placeholder: 'Describe el enfoque terapéutico del siguiente período...' },
      { id: 'coordinacion_escuela', label: '¿Requiere Coordinación con Escuela?', type: 'select', options: ['No', 'Sí - enviar informe', 'Sí - reunión recomendada', 'Sí - visita de observación', 'Ya coordinado'] },
      { id: 'necesita_reevaluacion', label: '¿Se Recomienda Reevaluación?', type: 'select', options: ['No en este momento', 'Sí - en 1 mes', 'Sí - en 3 meses', 'Sí - urgente'] },
    ]
  }
]

// ─── FORMULARIO 4: REGISTRO CONDUCTUAL ABC ────────────────────────────────────
export const REGISTRO_CONDUCTUAL_ABC_DATA = [
  {
    title: '1. Datos del Episodio',
    questions: [
      { id: 'hora_inicio', label: 'Hora de Inicio', type: 'time' },
      { id: 'hora_fin', label: 'Hora de Fin', type: 'time' },
      { id: 'duracion_estimada', label: 'Duración Estimada', type: 'select', options: ['Menos de 1 minuto', '1-5 minutos', '5-10 minutos', '10-30 minutos', 'Más de 30 minutos'] },
      { id: 'lugar', label: 'Lugar donde Ocurrió', type: 'select', options: ['Centro terapéutico', 'Hogar - sala', 'Hogar - habitación', 'Hogar - cocina', 'Colegio - aula', 'Colegio - recreo', 'Exterior/calle', 'Supermercado/tienda', 'Transporte', 'Otro lugar'] },
      { id: 'personas_presentes', label: 'Personas Presentes', type: 'multiselect', options: ['Terapeuta', 'Madre', 'Padre', 'Hermanos', 'Abuelos', 'Docente', 'Compañeros de clase', 'Personas desconocidas'] },
    ]
  },
  {
    title: '2. Antecedente (A) - ¿Qué pasó ANTES?',
    questions: [
      { id: 'actividad_previa', label: 'Actividad que se estaba realizando', type: 'text', placeholder: 'Ej: Trabajando en la mesa con fichas de colores' },
      { id: 'demanda_presentada', label: '¿Se presentó alguna demanda?', type: 'select', options: ['No', 'Sí - tarea académica', 'Sí - cambio de actividad', 'Sí - instrucción verbal', 'Sí - límite/negativa', 'Sí - espera/turno'] },
      { id: 'cambio_ambiente', label: '¿Hubo algún cambio en el ambiente?', type: 'select', options: ['No', 'Sí - ruido/sonido', 'Sí - persona nueva', 'Sí - cambio de lugar', 'Sí - cambio de rutina', 'Sí - estímulo visual'] },
      { id: 'estado_previo', label: 'Estado del Niño Previo al Episodio', type: 'select', options: ['Normal/neutro', 'Ya estaba irritable', 'Cansado', 'Con hambre/sed', 'Enfermo/malestar físico', 'Hiperestimulado', 'Acababa de perder un reforzador'] },
    ]
  },
  {
    title: '3. Conducta (B) - ¿Qué ocurrió EXACTAMENTE?',
    questions: [
      { id: 'topografia_conducta', label: 'Descripción Precisa de la Conducta', type: 'textarea', placeholder: 'Describe EXACTAMENTE lo que hizo el niño (sin interpretar): movimientos, vocalizaciones, acciones...' },
      { id: 'tipo_conducta', label: 'Categoría de la Conducta', type: 'multiselect', options: ['Agresión a personas', 'Autolesión', 'Destrucción de objetos', 'Escapar/huir', 'Llanto intenso', 'Gritos/vocalizaciones', 'Negativa/resistencia', 'Estereotipia', 'Rabieta', 'No cumplir instrucción'] },
      { id: 'intensidad', label: 'Intensidad del Episodio', type: 'select', options: ['1 - Muy leve', '2 - Leve', '3 - Moderado', '4 - Intenso', '5 - Muy intenso / Crisis'] },
      { id: 'frecuencia', label: 'Frecuencia en las últimas 2 semanas', type: 'select', options: ['Primera vez', '2-3 veces', '4-7 veces', '8-14 veces', 'Más de 14 veces (diario)'] },
    ]
  },
  {
    title: '4. Consecuencia (C) y Función Hipotética',
    questions: [
      { id: 'consecuencia_adulto', label: '¿Cómo Reaccionaron los Adultos?', type: 'multiselect', options: ['Redirigieron la actividad', 'Eliminaron la demanda', 'Dieron atención verbal', 'Dieron objeto preferido', 'Ignoraron', 'Contención física', 'Timeout/aislamiento', 'Realizaron la tarea por el niño'] },
      { id: 'resultado_conducta', label: '¿Qué Obtuvo el Niño con la Conducta?', type: 'select', options: ['Atención de adulto', 'Evitar/escapar tarea', 'Obtener objeto/comida', 'Estimulación sensorial', 'Control/poder', 'No está claro'] },
      { id: 'funcion_hipotetica', label: 'Función Hipotética de la Conducta', type: 'select', options: ['Acceso a tangibles', 'Acceso a atención', 'Escape/evitación', 'Sensorial/automática', 'Múltiples funciones', 'No determinado aún'] },
      { id: 'plan_intervencion', label: 'Plan de Intervención Sugerido', type: 'textarea', placeholder: 'Basado en el análisis funcional, describe estrategias de intervención...' },
    ]
  }
]
