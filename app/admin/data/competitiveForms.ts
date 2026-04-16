// app/admin/data/competitiveForms.ts
// Formularios de nivel competitivo - Thread Learning / Central Reach level
// Basados en: DSM-5-TR, Principios de Conducta (Malott), IBAO Guidelines, LuTr

import { FormDefinition, FormSection } from './neurodivergentForms'

const FREQ = ['Nunca', 'Raramente (1-2/mes)', 'A veces (1-2/semana)', 'Frecuentemente (3-4/semana)', 'Casi siempre (diario)', 'Siempre (varias veces/día)']
const INTENSITY = ['No aplica', 'Leve', 'Moderado', 'Intenso', 'Muy intenso / incapacitante']
const CONCERN = ['Sin preocupación', 'Leve', 'Moderada', 'Significativa', 'Grave']
const NIVEL_INDEPENDENCIA = ['No realiza / Total dependencia', 'Con ayuda física total', 'Con ayuda física parcial', 'Con modelado', 'Con ayuda verbal', 'Con señal o gesto', 'Independiente con errores', 'Independiente']

// ═══════════════════════════════════════════════════════════════════════════
// 1. EVALUACIÓN FUNCIONAL DE CONDUCTA (FBA)
// Herramienta más importante en ABA - Thread Learning la tiene, nosotros también
// ═══════════════════════════════════════════════════════════════════════════
export const EVALUACION_FUNCIONAL_CONDUCTA: FormDefinition = {
  id: 'fba',
  title: 'Evaluación Funcional de Conducta (FBA)',
  subtitle: 'Análisis de la función de conductas problemáticas',
  category: 'conductual',
  icon: '🔍',
  color: 'from-red-600 to-rose-700',
  targetRole: 'admin',
  estimatedMinutes: 35,
  description: 'Identifica la función de conductas desafiantes para diseñar intervenciones basadas en evidencia (Malott, Cap. 18-22)',
  tags: ['FBA', 'Función', 'Conducta', 'ABA', 'Intervención'],
  sections: [
    {
      title: '🎯 Identificación de la Conducta Objetivo',
      description: 'Define la conducta de forma operacional (observable y medible)',
      questions: [
        { id: 'conducta_objetivo', label: 'Descripción operacional de la conducta', type: 'textarea', required: true, placeholder: 'Describe exactamente qué hace el niño: movimientos específicos, vocalizaciones, duración aproximada. Ej: "Se tira al piso, patea con ambas piernas y grita con voz alta durante 2-10 minutos"', helpText: 'Una buena definición operacional describe TOPOGRAFÍA (cómo se ve), no intenciones' },
        { id: 'frecuencia_conducta', label: '¿Con qué frecuencia ocurre la conducta?', type: 'select', options: FREQ, required: true },
        { id: 'duracion_episodio', label: 'Duración típica de cada episodio', type: 'select', options: ['Segundos (menos de 1 min)', '1-5 minutos', '5-15 minutos', '15-30 minutos', 'Más de 30 minutos', 'Variable'] },
        { id: 'intensidad_conducta', label: 'Intensidad típica de la conducta', type: 'select', options: INTENSITY },
        { id: 'conductas_asociadas', label: '¿Hay otras conductas que ocurren junto con ésta?', type: 'textarea', placeholder: 'Ej: Antes de tirar objetos, cierra los puños y aprieta los dientes...' },
        { id: 'riesgo_dano', label: '¿Representa riesgo de daño físico?', type: 'select', options: ['No', 'Riesgo para sí mismo (autolesión)', 'Riesgo para otros', 'Riesgo para objetos / ambiente', 'Múltiples riesgos'] },
      ]
    },
    {
      title: '🌡️ Antecedentes (A del ABC)',
      description: '¿Qué sucede ANTES de la conducta? Contexto, triggers, condiciones',
      questions: [
        { id: 'contextos_ocurrencia', label: '¿En qué contextos/ambientes ocurre más?', type: 'multiselect', options: ['Sala de terapia', 'Casa', 'Escuela/aula', 'Lugares públicos', 'Transiciones', 'Hora de comida', 'Hora de dormir', 'Todos los contextos'] },
        { id: 'contextos_no_ocurrencia', label: '¿En qué contextos casi NUNCA ocurre?', type: 'multiselect', options: ['Jugando libremente', 'Con actividad preferida', 'Con persona específica', 'En silencio', 'En actividades 1:1', 'Después de ejercicio', 'Por la mañana', 'Por la tarde'] },
        { id: 'triggers_inmediatos', label: '¿Cuáles son los desencadenantes (triggers) más comunes?', type: 'multiselect', options: ['Instrucción o demanda', 'Transición entre actividades', 'Se acaba algo que le gusta', 'Otra persona recibe atención', 'Cambio en la rutina', 'Estimulación sensorial', 'Espera o demora', 'Interacción social no deseada', 'Tarea difícil', 'Frustración ante error'] },
        { id: 'condiciones_motivacionales', label: 'Operaciones motivacionales: ¿qué condiciones aumentan la probabilidad?', type: 'multiselect', options: ['Fatiga o sueño', 'Hambre', 'Dolor o malestar físico', 'Medicación (cambio o ausencia)', 'Estrés ambiental (ruido, luz)', 'Privación de reforzador preferido', 'Cambio en agenda o rutina', 'Interacción negativa previa'] },
        { id: 'sd_conducta', label: '¿Existe algún Sd (estímulo discriminativo) específico que casi siempre precede la conducta?', type: 'textarea', placeholder: 'Ej: Cuando el terapeuta saca el libro de trabajo, cuando dice "es hora de..."' },
        { id: 'tiempo_antes', label: '¿Cuánto tiempo transcurre entre el trigger y la conducta?', type: 'select', options: ['Inmediata (segundos)', '1-5 minutos', '5-15 minutos', 'Más de 15 minutos', 'Variable / sin patrón claro'] },
      ]
    },
    {
      title: '⚡ Consecuencias (C del ABC)',
      description: '¿Qué ocurre DESPUÉS de la conducta? ¿Qué la mantiene?',
      questions: [
        { id: 'consecuencias_tipicas', label: '¿Qué sucede después de la conducta?', type: 'multiselect', options: ['Se termina la tarea/actividad (escape/evitación)', 'Recibe atención (positiva o negativa)', 'Obtiene objeto o actividad deseada', 'Lo ignoran completamente', 'Se le da tiempo fuera', 'Se redirige a otra actividad', 'Recibe corrección verbal', 'Nada cambia / sin consecuencia consistente'] },
        { id: 'quien_responde', label: '¿Quién responde a la conducta habitualmente?', type: 'multiselect', options: ['Terapeuta ABA', 'Madre/Padre', 'Maestro/a', 'Hermanos/as', 'Varios / inconsistente'] },
        { id: 'consistencia_consecuencias', label: '¿Las consecuencias son consistentes entre cuidadores?', type: 'select', options: ['Sí - todos responden igual', 'Parcialmente - algunos sí, otros no', 'No - cada persona responde diferente', 'No se sabe'] },
        { id: 'efecto_conducta', label: '¿La conducta logra lo que parece buscar?', type: 'select', options: ['Sí - generalmente logra el objetivo', 'A veces - resultados inconsistentes', 'Raramente - casi nunca funciona', 'No - nunca logra nada aparente'] },
      ]
    },
    {
      title: '🧪 Hipótesis Funcional',
      description: 'Con base en A-B-C, ¿cuál es la función mantenedora de la conducta?',
      questions: [
        { id: 'hipotesis_funcion_primaria', label: 'Hipótesis de función primaria', type: 'select', required: true, options: ['Reforzamiento positivo - Atención social (obtener atención)', 'Reforzamiento positivo - Tangible (obtener objeto/actividad)', 'Reforzamiento negativo - Escape de demanda/tarea', 'Reforzamiento negativo - Escape sensorial / evitación', 'Reforzamiento automático - Estimulación sensorial (autoestimulación)', 'Reforzamiento automático - Reducción de malestar interno', 'Función mixta (combinación de las anteriores)', 'Función desconocida - se requiere más evaluación'] },
        { id: 'hipotesis_funcion_secundaria', label: '¿Existe una función secundaria?', type: 'select', options: ['No', 'Reforzamiento positivo - Atención', 'Reforzamiento positivo - Tangible', 'Reforzamiento negativo - Escape', 'Reforzamiento automático'] },
        { id: 'evidencia_hipotesis', label: 'Evidencia que apoya esta hipótesis', type: 'textarea', placeholder: 'Describe los patrones observados que llevan a esta conclusión funcional...', required: true },
        { id: 'confirmacion_metodo', label: 'Método de confirmación de hipótesis', type: 'select', options: ['Análisis descriptivo (ABC naturalistic)', 'Análisis funcional análogo (experimental)', 'Entrevista funcional (FAST/MAS)', 'Combinación de métodos', 'Pendiente de verificación'] },
        { id: 'declaracion_funcion', label: 'Declaración funcional completa', type: 'textarea', required: true, placeholder: 'En presencia de [Antecedente], [Nombre] exhibe [Conducta], y como resultado obtiene/escapa de [Consecuencia], lo que aumenta la probabilidad futura de la conducta.' },
      ]
    },
    {
      title: '💪 Conductas Alternativas y Habilidades Prerrequisito',
      questions: [
        { id: 'conducta_alternativa_funcion', label: '¿Existe una conducta alternativa que cumpla la misma función de forma apropiada?', type: 'textarea', placeholder: 'Ej: Puede pedir ayuda verbalmente, puede usar tarjeta "descanso", puede señalar lo que quiere...' },
        { id: 'habilidades_prerrequisito', label: '¿Qué habilidades necesita desarrollar para usar la conducta alternativa?', type: 'multiselect', options: ['Comunicación funcional (pedir, rechazar, comentar)', 'Tolerancia a la demora', 'Autorregulación emocional', 'Seguimiento de instrucciones', 'Transición entre actividades', 'Tolerancia a frustración', 'Habilidades cognitivas específicas'] },
        { id: 'nivel_comunicacion_actual', label: 'Nivel de comunicación funcional actual del niño', type: 'select', options: ['Pre-verbal / sin comunicación intencional', 'Comunicación gestual / señalamiento', 'Comunicación con pictogramas / PECS', 'Palabras aisladas (1-2 palabras)', 'Frases simples (2-3 palabras)', 'Oraciones completas', 'Comunicación verbal funcional compleja'] },
        { id: 'observaciones_fba', label: 'Observaciones adicionales del evaluador', type: 'textarea', placeholder: 'Patrones adicionales, factores contextuales importantes, impresión clínica general...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PLAN DE INTERVENCIÓN CONDUCTUAL (BIP)
// ═══════════════════════════════════════════════════════════════════════════
export const PLAN_INTERVENCION_CONDUCTUAL: FormDefinition = {
  id: 'bip',
  title: 'Plan de Intervención Conductual (BIP)',
  subtitle: 'Diseño de intervención basado en FBA',
  category: 'conductual',
  icon: '📋',
  color: 'from-blue-600 to-indigo-700',
  targetRole: 'admin',
  estimatedMinutes: 40,
  description: 'Plan estructurado de intervención para conductas desafiantes, basado en la función identificada en el FBA',
  tags: ['BIP', 'Intervención', 'Plan', 'ABA', 'Reducción'],
  sections: [
    {
      title: '📌 Conducta Objetivo y Función',
      questions: [
        { id: 'conducta_bip', label: 'Conducta objetivo (definición operacional)', type: 'textarea', required: true, placeholder: 'Copia o resume la definición operacional del FBA' },
        { id: 'funcion_bip', label: 'Función identificada (del FBA)', type: 'select', required: true, options: ['Atención social', 'Tangible (objeto/actividad)', 'Escape de demanda', 'Escape sensorial', 'Estimulación automática', 'Reducción de malestar', 'Mixta'] },
        { id: 'meta_reduccion', label: 'Meta de reducción', type: 'textarea', required: true, placeholder: 'Ej: Reducir la conducta de rabietas de una frecuencia de 5/día a 1/día en un período de 8 semanas, con criterio de mantenimiento de 1 mes' },
      ]
    },
    {
      title: '🛡️ Estrategias Antecedentes (Prevención)',
      description: 'Modificaciones al ambiente ANTES de que ocurra la conducta',
      questions: [
        { id: 'modificaciones_ambiente', label: '¿Qué cambios al ambiente físico se implementarán?', type: 'multiselect', options: ['Reducir estímulos distractores', 'Zona de trabajo estructurada', 'Señales visuales (agenda, temporizador)', 'Acceso anticipado al reforzador', 'Asiento preferencial', 'Espacio de descanso disponible', 'Materiales organizados visualmente'] },
        { id: 'first_then', label: '¿Se usará First-Then (Primero-Luego)?', type: 'select', options: ['Sí - pictogramas', 'Sí - verbal', 'Sí - pizarra/tablero', 'No aplica'] },
        { id: 'aviso_previo', label: '¿Se dará aviso previo antes de transiciones?', type: 'select', options: ['Sí - 5 minutos de anticipación', 'Sí - verbal + timer', 'Sí - señal visual', 'Depende del contexto', 'No aplica'] },
        { id: 'demandas_graduadas', label: '¿Se ajustará la dificultad de las demandas?', type: 'textarea', placeholder: 'Ej: Iniciar con tareas de alta probabilidad antes de tareas difíciles (high-p sequence)' },
        { id: 'om_estrategias', label: 'Estrategias para operaciones motivacionales', type: 'textarea', placeholder: 'Ej: Asegurar descanso previo, ofrecer snack antes de sesiones exigentes, permitir acceso libre a reforzador antes de trabajo...' },
      ]
    },
    {
      title: '🗣️ Estrategias de Reemplazo (Enseñanza)',
      description: 'Enseñar una conducta alternativa que cumpla la misma función',
      questions: [
        { id: 'conducta_reemplazo', label: 'Conducta de reemplazo a enseñar', type: 'textarea', required: true, placeholder: 'Ej: Enseñar a pedir "descanso" con tarjeta PECS o palabra, que tenga la misma función de escape que la rabieta' },
        { id: 'metodo_ensenanza', label: 'Método de enseñanza de la conducta de reemplazo', type: 'multiselect', options: ['Ensayo discreto (DTT)', 'Enseñanza en ambiente natural (NET)', 'PECS (Sistema de comunicación por intercambio)', 'MAND training (entrenamiento de mando)', 'Modelado + imitación', 'Video modeling', 'Role-play'] },
        { id: 'prompt_strategy', label: 'Estrategia de ayuda (prompting)', type: 'select', options: ['Most-to-least (de más a menos ayuda)', 'Least-to-most (de menos a más ayuda)', 'Prompt de posición', 'Modelado', 'Prompt verbal + físico simultáneo'] },
        { id: 'reforzamiento_reemplazo', label: '¿Qué reforzador se usará para la conducta de reemplazo?', type: 'textarea', required: true, placeholder: 'El MISMO reforzador que mantiene la conducta problemática debe ser accesible vía conducta apropiada' },
      ]
    },
    {
      title: '📉 Estrategias Consecuentes para Conducta Problemática',
      description: 'Qué hacer DESPUÉS de que ocurre la conducta (basado en extinción + DRA/DRO)',
      questions: [
        { id: 'procedimiento_extincion', label: 'Procedimiento de extinción', type: 'textarea', required: true, placeholder: 'Basado en la función: si es escape → no quitar la demanda, si es atención → retirar atención, si es tangible → no dar objeto...' },
        { id: 'dra_dro', label: '¿Se usará DRA, DRO o DRI?', type: 'select', options: ['DRA - Reforzamiento diferencial de conducta alternativa', 'DRO - Reforzamiento de ausencia de conducta', 'DRI - Reforzamiento de conducta incompatible', 'Combinación DRA + DRO', 'No aplica en esta fase'] },
        { id: 'safety_response', label: 'Si hay riesgo de daño, ¿cómo se procede?', type: 'textarea', placeholder: 'Protocolo de seguridad: qué personas intervienen, cómo, cuándo se detiene la sesión...' },
        { id: 'crisis_plan', label: '¿Existe plan de crisis documentado?', type: 'select', options: ['Sí - adjunto en expediente', 'Sí - en elaboración', 'No requerido', 'Pendiente'] },
      ]
    },
    {
      title: '📊 Monitoreo y Criterio de Éxito',
      questions: [
        { id: 'metodo_medicion', label: 'Método de medición de la conducta', type: 'select', required: true, options: ['Frecuencia (conteo de ocurrencias)', 'Duración (tiempo total)', 'Latencia (tiempo hasta inicio)', 'Tasa (ocurrencias por tiempo)', 'Intervalo parcial', 'Intervalo completo', 'Momentary time sampling'] },
        { id: 'criterio_exito_bip', label: 'Criterio de éxito del BIP', type: 'textarea', required: true, placeholder: 'Ej: Reducir de 5 rabietas/día a 1 o menos/día en 3 semanas consecutivas, con mantenimiento de 4 semanas' },
        { id: 'revision_bip', label: '¿Cada cuánto se revisará el plan?', type: 'select', options: ['Cada semana', 'Cada 2 semanas', 'Cada mes', 'Cada 6 semanas', 'Al alcanzar criterio parcial'] },
        { id: 'responsables_bip', label: '¿Quiénes implementarán el plan?', type: 'multiselect', options: ['Terapeuta ABA principal', 'Terapeuta de soporte', 'Padres en casa', 'Maestro en escuela', 'Todos los adultos significativos'] },
        { id: 'capacitacion_requerida', label: '¿Se requiere capacitación a padres/maestros?', type: 'select', options: ['Sí - capacitación formal programada', 'Sí - seguimiento de modelo', 'Parcial - refuerzo de estrategias', 'No - ya conocen el plan', 'Pendiente de evaluación'] },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. OBJETIVOS IEP / PLAN DE INTERVENCIÓN INDIVIDUAL
// ═══════════════════════════════════════════════════════════════════════════
export const OBJETIVOS_IEP: FormDefinition = {
  id: 'iep',
  title: 'Plan de Intervención Individual (IEP/PII)',
  subtitle: 'Objetivos funcionales anuales con métricas de progreso',
  category: 'seguimiento',
  icon: '🗺️',
  color: 'from-indigo-600 to-violet-700',
  targetRole: 'admin',
  estimatedMinutes: 45,
  description: 'Documento maestro de objetivos terapéuticos anuales con criterios de dominio medibles, según estándares IBAO',
  tags: ['IEP', 'Objetivos', 'Plan', 'Anual', 'Metas'],
  sections: [
    {
      title: '📊 Nivel de Desempeño Actual (Present Levels)',
      description: 'Línea base: dónde está el niño HOY en cada área',
      questions: [
        { id: 'nivel_comunicacion', label: 'Comunicación y Lenguaje - nivel actual', type: 'textarea', required: true, placeholder: 'Ej: Utiliza 50 palabras aproximadas, combina 2 palabras ocasionalmente, comprende instrucciones de 1 paso consistentemente...' },
        { id: 'nivel_social', label: 'Habilidades Sociales - nivel actual', type: 'textarea', placeholder: 'Ej: Juego paralelo con pares, responde a nombre 80% en ambiente 1:1, iniciación social ausente...' },
        { id: 'nivel_autonomia', label: 'Autonomía y Vida Diaria - nivel actual', type: 'textarea', placeholder: 'Ej: Come solo con cuchara con supervisión, requiere asistencia parcial en vestido, control de esfínteres en proceso...' },
        { id: 'nivel_cognitivo', label: 'Habilidades Cognitivas y Académicas - nivel actual', type: 'textarea', placeholder: 'Ej: Matching de colores y formas básicas, secuencia de 3 imágenes, conteo 1-5 con apoyo...' },
        { id: 'nivel_conductual', label: 'Conducta y Regulación Emocional - nivel actual', type: 'textarea', placeholder: 'Ej: 3-5 rabietas/semana, duración 5-15 min, función escape, conductas de autoestimulación 40% del tiempo...' },
        { id: 'fortalezas_principales', label: 'Fortalezas y áreas de motivación', type: 'textarea', required: true, placeholder: 'Ej: Alta motivación por vehículos y música, excelente memoria visual, buen seguimiento de rutinas predecibles...' },
      ]
    },
    {
      title: '🎯 Área 1: Comunicación y Lenguaje',
      questions: [
        { id: 'obj_com_1_lp', label: 'Objetivo anual de comunicación', type: 'textarea', placeholder: 'Al final del año, [Nombre] podrá... [conducta] en [condiciones] con [criterio de dominio]' },
        { id: 'obj_com_1_cp1', label: 'Objetivo a corto plazo 1 (trimestre 1)', type: 'textarea', placeholder: 'Objetivo medible para los primeros 3 meses...' },
        { id: 'obj_com_1_cp2', label: 'Objetivo a corto plazo 2 (trimestre 2)', type: 'textarea', placeholder: '' },
        { id: 'obj_com_metodo', label: 'Estrategias de intervención en comunicación', type: 'multiselect', options: ['MAND training (verbal behavior)', 'PECS (Phase I-VI)', 'AAC / Dispositivo de comunicación', 'Terapia de lenguaje ABA', 'Incidental teaching', 'PRT (Pivotal Response Training)'] },
      ]
    },
    {
      title: '🎯 Área 2: Conducta y Regulación',
      questions: [
        { id: 'obj_cond_1_lp', label: 'Objetivo anual de conducta/regulación', type: 'textarea', placeholder: '' },
        { id: 'obj_cond_1_cp1', label: 'Objetivo a corto plazo 1', type: 'textarea', placeholder: '' },
        { id: 'obj_cond_estrategia', label: 'Estrategia conductual principal', type: 'select', options: ['DRA (Reforzamiento diferencial de alternativa)', 'DRO (Reforzamiento de ausencia)', 'Economía de fichas', 'Extinción planificada', 'Costo de respuesta', 'Enseñanza de regulación emocional', 'Social Stories', 'Power Cards'] },
      ]
    },
    {
      title: '🎯 Área 3: Habilidades Sociales',
      questions: [
        { id: 'obj_social_lp', label: 'Objetivo anual de habilidades sociales', type: 'textarea', placeholder: '' },
        { id: 'obj_social_cp1', label: 'Objetivo a corto plazo 1', type: 'textarea', placeholder: '' },
        { id: 'obj_social_metodo', label: 'Estrategias', type: 'multiselect', options: ['Social Skills Groups', 'Peer-mediated intervention', 'Video modeling', 'Social Stories', 'PEERS curriculum', 'Role play estructurado'] },
      ]
    },
    {
      title: '🎯 Área 4: Autonomía y Vida Diaria',
      questions: [
        { id: 'obj_autonomia_lp', label: 'Objetivo anual de autonomía', type: 'textarea', placeholder: '' },
        { id: 'obj_autonomia_cp1', label: 'Objetivo a corto plazo 1', type: 'textarea', placeholder: '' },
        { id: 'obj_autonomia_metodo', label: 'Estrategias', type: 'multiselect', options: ['Task analysis (análisis de tarea)', 'Chaining (encadenamiento hacia adelante)', 'Backward chaining (encadenamiento hacia atrás)', 'Video prompting', 'Guías visuales / pictogramas', 'Horarios estructurados'] },
      ]
    },
    {
      title: '📋 Servicios y Equipo',
      questions: [
        { id: 'horas_aba_semana', label: 'Horas semanales de terapia ABA', type: 'select', options: ['5-10 horas', '10-15 horas', '15-20 horas', '20-25 horas', '25-30 horas', 'Más de 30 horas'] },
        { id: 'servicios_adicionales', label: 'Servicios adicionales', type: 'multiselect', options: ['Terapia de lenguaje', 'Terapia ocupacional', 'Fisioterapia', 'Apoyo escolar', 'Grupos de habilidades sociales', 'Psicoterapia', 'Apoyo a padres'] },
        { id: 'equipo_intervencion', label: 'Miembros del equipo de intervención', type: 'multiselect', options: ['Analista de conducta (IBA)', 'Terapeuta de conducta (IBT)', 'Terapeuta de lenguaje', 'Terapeuta ocupacional', 'Maestro de educación especial', 'Psicólogo', 'Padres / cuidadores'] },
        { id: 'revision_iep', label: 'Próxima revisión del IEP', type: 'select', options: ['En 3 meses', 'En 6 meses', 'En 1 año', 'Según progreso clínico'] },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. EVALUACIÓN DE LENGUAJE Y COMUNICACIÓN (VB-MAPP / Verbal Behavior)
// ═══════════════════════════════════════════════════════════════════════════
export const EVALUACION_LENGUAJE_VERBAL: FormDefinition = {
  id: 'lenguaje_verbal',
  title: 'Evaluación de Conducta Verbal (VB-MAPP adaptado)',
  subtitle: 'Perfil de habilidades de lenguaje y comunicación',
  category: 'habilidades',
  icon: '🗣️',
  color: 'from-teal-500 to-cyan-600',
  targetRole: 'admin',
  estimatedMinutes: 30,
  description: 'Evalúa las operantes verbales (mando, tácto, ecoico, intraverbal) para diseñar programas de comunicación ABA',
  tags: ['Lenguaje', 'VB-MAPP', 'Verbal Behavior', 'Comunicación', 'Mando'],
  sections: [
    {
      title: '🎤 Mando (Solicitudes / Requests)',
      description: 'Capacidad de pedir lo que necesita o desea',
      questions: [
        { id: 'mando_nivel', label: 'Nivel de mando actual', type: 'select', required: true, options: NIVEL_INDEPENDENCIA },
        { id: 'mando_modalidad', label: 'Modalidad principal de solicitud', type: 'select', options: ['No tiene solicitudes funcionales', 'Llanto / vocalizaciones no dirigidas', 'Jalar la mano / guiar físicamente', 'Señalamiento', 'Alcance + contacto ocular', 'Pictogramas / PECS', 'Signos / LSP', 'Palabras aisladas (1 palabra)', 'Frases (2+ palabras)', 'Oraciones completas'] },
        { id: 'mando_variedad', label: '¿Cuántas solicitudes diferentes hace aprox.?', type: 'select', options: ['0-5 tipos de solicitudes', '5-20 tipos', '20-50 tipos', '50-100 tipos', 'Más de 100 tipos / ilimitadas'] },
        { id: 'mando_contexto', label: '¿En qué contextos hace solicitudes?', type: 'multiselect', options: ['Solo con personas muy conocidas', 'Con cualquier adulto familiar', 'En sesión de terapia', 'En casa', 'En escuela', 'En público', 'En todos los contextos'] },
        { id: 'mando_espontaneo', label: '¿Hace solicitudes espontáneas (sin prompt)?', type: 'select', options: ['Nunca espontáneo - requiere prompt', 'Ocasionalmente espontáneo', 'Frecuentemente espontáneo', 'Casi siempre espontáneo'] },
      ]
    },
    {
      title: '👁️ Tácto (Nombrar / Labeling)',
      description: 'Capacidad de nombrar o etiquetar lo que ve, escucha, toca',
      questions: [
        { id: 'tacto_objetos', label: 'Nombra objetos (táctos de objetos)', type: 'select', options: ['0 objetos', '1-10 objetos', '10-50 objetos', '50-100 objetos', '100-200 objetos', 'Más de 200 objetos'] },
        { id: 'tacto_acciones', label: 'Nombra acciones (verbos)', type: 'select', options: ['Ninguna', '1-10 acciones', '10-50 acciones', 'Más de 50 acciones'] },
        { id: 'tacto_atributos', label: 'Nombra atributos (colores, tamaños, formas)', type: 'multiselect', options: ['Colores básicos (3+)', 'Formas básicas', 'Tamaños (grande/pequeño)', 'Texturas', 'Emociones básicas en fotos', 'Partes del cuerpo (10+)', 'Animales (10+)', 'Alimentos (10+)'] },
        { id: 'tacto_funcion', label: 'Nombra por función o característica', type: 'select', options: ['No nombra por función', 'Lo hace con prompt', 'Lo hace espontáneamente con algunos', 'Lo hace espontáneamente con muchos'] },
      ]
    },
    {
      title: '👂 Oyente / Comprensión',
      description: 'Qué entiende y sigue',
      questions: [
        { id: 'comprension_instrucciones', label: 'Nivel de instrucciones que sigue', type: 'select', required: true, options: ['No sigue instrucciones verbales', 'Instrucciones de 1 paso con gestos', 'Instrucciones de 1 paso solo verbales', 'Instrucciones de 2 pasos', 'Instrucciones de 3+ pasos', 'Instrucciones complejas / condicionales'] },
        { id: 'comprension_vocabulario', label: 'Discrimina vocabulario (apunta a..., toca...)', type: 'select', options: ['0-10 palabras', '10-50 palabras', '50-100 palabras', '100-200 palabras', 'Más de 200 palabras'] },
        { id: 'comprension_grupo', label: 'Sigue instrucciones en grupo (no solo 1:1)', type: 'select', options: ['Solo en 1:1 (no en grupo)', 'Con su nombre mencionado', 'En grupo pequeño (3-5 personas)', 'En grupo grande (clase)'] },
      ]
    },
    {
      title: '🔄 Intraverbal y Conversación',
      description: 'Conversación, preguntas, completar frases',
      questions: [
        { id: 'intraverbal_nivel', label: 'Nivel de respuesta intraverbal', type: 'select', options: ['No responde a preguntas verbales', 'Responde a "¿Cómo te llamas?"', 'Responde ¿qué? y ¿quién? sobre objetos', 'Completa frases conocidas ("Sol, luna y...")', 'Responde preguntas sobre actividades', 'Conversación bidireccional básica (3-5 turnos)', 'Conversación sostenida con temas variados'] },
        { id: 'ecoico', label: 'Ecoico: ¿Repite palabras al ser pedido?', type: 'select', options: ['No imita sonidos ni palabras', 'Imita vocales aisladas', 'Imita consonantes + vocales (CV)', 'Imita palabras de 1 sílaba', 'Imita palabras de 2 sílabas', 'Imita palabras de 3+ sílabas', 'Imita oraciones cortas'] },
        { id: 'juego_simbolico', label: 'Juego simbólico / imaginativo', type: 'select', options: ['No hay juego simbólico', 'Juego funcional (objetos con función real)', 'Juego simbólico simple (hace "como si")', 'Juego simbólico elaborado', 'Juego sociodramático con pares'] },
      ]
    },
    {
      title: '📋 Resumen y Recomendaciones',
      questions: [
        { id: 'nivel_vb_global', label: 'Nivel global de desarrollo verbal (VB-MAPP adaptado)', type: 'select', required: true, options: ['Nivel 1 (0-18 meses equiv.) - prerrequisitos y primeras palabras', 'Nivel 2 (18-30 meses equiv.) - expansión de vocabulario', 'Nivel 3 (30-48 meses equiv.) - conversación básica', 'Por encima de nivel 3 - habilidades lingüísticas funcionales'] },
        { id: 'barreras_lenguaje', label: 'Principales barreras para el aprendizaje del lenguaje', type: 'multiselect', options: ['Déficit motivacional / escasa motivación', 'Conductas de interferencia (autoestimulación)', 'Déficit sensorial (auditivo)', 'Dificultades motoras del habla (apraxia)', 'Escasa imitación motora (prerrequisito)', 'Falta de contacto visual', 'Rigidez / inflexibilidad'] },
        { id: 'prioridad_intervencion_lenguaje', label: 'Área prioritaria de intervención en lenguaje', type: 'select', required: true, options: ['MAND training (enseñar a pedir)', 'Ecoico (imitación vocal)', 'Tácto (nombrar)', 'Oyente (comprensión)', 'Intraverbal (conversación)', 'Todas por igual', 'Evaluación adicional necesaria'] },
        { id: 'observaciones_lenguaje', label: 'Observaciones del evaluador', type: 'textarea', placeholder: 'Notas adicionales sobre el perfil de comunicación, factores contextuales, recomendaciones específicas...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. INFORME DE PROGRESO MENSUAL (para padres y supervisores)
// ═══════════════════════════════════════════════════════════════════════════
export const INFORME_PROGRESO_MENSUAL: FormDefinition = {
  id: 'informe_mensual_prog',
  title: 'Informe de Progreso Mensual',
  subtitle: 'Reporte clínico de avances para padres y supervisor',
  category: 'seguimiento',
  icon: '📈',
  color: 'from-emerald-500 to-teal-600',
  targetRole: 'admin',
  estimatedMinutes: 20,
  description: 'Informe mensual de progreso con datos objetivos, análisis clínico y comunicación a familias',
  tags: ['Mensual', 'Progreso', 'Informe', 'Reporte', 'Familia'],
  sections: [
    {
      title: '📊 Progreso en Programas ABA',
      questions: [
        { id: 'programas_en_progreso', label: 'Programas trabajados este mes', type: 'textarea', required: true, placeholder: 'Lista los programas, el % de éxito inicial y final del mes, y el estado actual...' },
        { id: 'programas_dominados', label: '¿Algún programa alcanzó criterio de dominio?', type: 'textarea', placeholder: 'Nombre del programa y fecha de dominio...' },
        { id: 'programas_nuevos', label: '¿Se iniciaron programas nuevos?', type: 'textarea', placeholder: 'Programa nuevo + justificación clínica...' },
        { id: 'tendencia_general', label: 'Tendencia general de progreso del mes', type: 'select', required: true, options: ['Progreso consistente en todos los programas', 'Progreso en la mayoría de programas', 'Progreso mixto (algunos avanzan, otros no)', 'Estancamiento general', 'Regresión en algunos programas', 'Regresión significativa'] },
      ]
    },
    {
      title: '🧠 Conducta y Regulación',
      questions: [
        { id: 'conductas_desafiantes_mes', label: 'Conductas desafiantes este mes', type: 'textarea', placeholder: 'Frecuencia, intensidad, cambios respecto al mes anterior...' },
        { id: 'estrategias_efectivas', label: 'Estrategias que fueron efectivas', type: 'textarea', placeholder: 'Qué funcionó bien para manejar conductas o promover el aprendizaje...' },
        { id: 'ajustes_realizados', label: 'Ajustes realizados a los programas o estrategias', type: 'textarea', placeholder: 'Cambios de reforzadores, modificaciones de procedimientos, cambios de fase...' },
      ]
    },
    {
      title: '🏠 Generalización y Colaboración Familiar',
      questions: [
        { id: 'generalizacion', label: '¿Ha generalizado habilidades fuera de la sesión?', type: 'textarea', placeholder: 'En casa, escuela, comunidad... qué habilidades aplicó de forma espontánea...' },
        { id: 'participacion_familia', label: 'Participación y adherencia de la familia', type: 'select', options: ['Excelente - implementan estrategias consistentemente', 'Buena - la mayoría del tiempo', 'Regular - necesita más apoyo y seguimiento', 'Difícil - barreras significativas', 'Sin datos disponibles'] },
        { id: 'necesidades_familia', label: '¿Qué necesita la familia este mes?', type: 'multiselect', options: ['Capacitación en nuevas estrategias', 'Apoyo emocional y psicoeducación', 'Coordinación con escuela', 'Ajuste de actividades en casa', 'Reunión de seguimiento', 'Sin necesidades urgentes'] },
      ]
    },
    {
      title: '🗺️ Plan para el Próximo Mes',
      questions: [
        { id: 'objetivos_proximo_mes', label: 'Objetivos para el próximo mes', type: 'textarea', required: true, placeholder: 'Qué se espera lograr, qué programas se priorizarán...' },
        { id: 'ajustes_plan', label: '¿Se modificará el plan de intervención?', type: 'select', options: ['No - se continúa según IEP', 'Sí - ajuste menor de estrategias', 'Sí - nuevo programa(s) a agregar', 'Sí - revisión mayor del IEP requerida', 'Consulta a supervisor/equipo necesaria'] },
        { id: 'recomendaciones_padres', label: 'Recomendaciones específicas para padres este mes', type: 'textarea', required: true, placeholder: 'Actividades concretas, estrategias a practicar, qué observar y registrar...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. EVALUACIÓN DE HABILIDADES ADAPTATIVAS (complementa Vineland)
// ═══════════════════════════════════════════════════════════════════════════
export const HABILIDADES_ADAPTATIVAS: FormDefinition = {
  id: 'habilidades_adaptativas',
  title: 'Evaluación de Habilidades Adaptativas',
  subtitle: 'Funcionamiento en vida diaria y autonomía',
  category: 'habilidades',
  icon: '🌟',
  color: 'from-amber-500 to-yellow-600',
  targetRole: 'admin',
  estimatedMinutes: 25,
  description: 'Evalúa habilidades de vida diaria, autocuidado y funcionamiento adaptativo (complementa Vineland-3)',
  tags: ['Adaptativo', 'Autonomía', 'Vida diaria', 'Autocuidado', 'DSM-5'],
  sections: [
    {
      title: '🍽️ Alimentación',
      questions: [
        { id: 'come_solo', label: 'Come de forma independiente', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'uso_utensilios', label: 'Uso de utensilios (cuchara, tenedor)', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'variedad_alimentos', label: 'Variedad en la dieta', type: 'select', options: ['Muy restringida (1-5 alimentos)', 'Restringida (5-15 alimentos)', 'Moderada (15-30 alimentos)', 'Amplia (sin restricciones significativas)'] },
        { id: 'conductas_alimentacion', label: 'Conductas problemáticas en alimentación', type: 'multiselect', options: ['Ninguna', 'Rechazo de texturas', 'Rechazo de colores/presentación', 'Conductas de escupir', 'Masticación problemática', 'Arcadas / náuseas', 'Comer solo alimentos de marca específica'] },
      ]
    },
    {
      title: '🚿 Higiene y Autocuidado',
      questions: [
        { id: 'control_esfinteres', label: 'Control de esfínteres', type: 'select', options: ['Sin control (pañal)', 'En entrenamiento - accidentes frecuentes', 'Parcial - mayoría del tiempo seco', 'Controlado con recordatorios', 'Control independiente diurno', 'Control independiente diurno y nocturno'] },
        { id: 'lavado_manos', label: 'Lavado de manos', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'cepillado_dientes', label: 'Cepillado de dientes', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'bano', label: 'Baño / ducha', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'vestido', label: 'Vestirse / desvestirse', type: 'select', options: NIVEL_INDEPENDENCIA },
        { id: 'calzado', label: 'Ponerse y quitarse calzado', type: 'select', options: NIVEL_INDEPENDENCIA },
      ]
    },
    {
      title: '🏠 Hogar y Comunidad',
      questions: [
        { id: 'desplazamiento_casa', label: 'Se desplaza seguro dentro de casa', type: 'select', options: ['Requiere supervisión constante', 'Supervisión cercana', 'Supervisión a distancia', 'Independiente en casa'] },
        { id: 'seguridad_hogar', label: '¿Comprende normas básicas de seguridad?', type: 'multiselect', options: ['No abre puertas/ventanas peligrosas', 'No toca enchufes/cables', 'No sube a superficies altas sin supervisión', 'Entiende "caliente" y "peligro"', 'Ninguna de las anteriores'] },
        { id: 'uso_comunidad', label: '¿Puede ir a lugares de la comunidad?', type: 'select', options: ['No tolera salidas a la comunidad', 'Tolera salidas cortas con apoyo', 'Tolera actividades en comunidad con supervisión', 'Participación activa en comunidad con adulto', 'Desplazamiento parcialmente autónomo'] },
        { id: 'manejo_dinero', label: 'Manejo básico de dinero/transacciones', type: 'select', options: ['No aplica por edad', 'No hay comprensión del dinero', 'Reconoce monedas/billetes', 'Transacciones simples con apoyo', 'Transacciones autónomas simples'] },
      ]
    },
    {
      title: '💤 Sueño y Rutinas',
      questions: [
        { id: 'patron_sueno', label: 'Patrón de sueño', type: 'select', options: ['Sin problemas de sueño', 'Dificultad para iniciar sueño', 'Despertares nocturnos frecuentes', 'Muy temprano (antes de 5am)', 'Horario irregular', 'Requiere adulto para dormirse'] },
        { id: 'horas_sueno', label: 'Horas de sueño por noche (aprox)', type: 'select', options: ['Menos de 7 horas', '7-8 horas', '8-9 horas', '9-10 horas', '10-11 horas', 'Más de 11 horas'] },
        { id: 'seguimiento_rutinas', label: '¿Sigue rutinas estructuradas?', type: 'select', options: ['No sigue rutinas / muy disruptivo con cambios', 'Sigue rutinas con estructura muy rígida', 'Sigue rutinas con algunos apoyos visuales', 'Sigue rutinas con recordatorios verbales', 'Sigue rutinas de forma independiente'] },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. EVALUACIÓN DE PERFIL SENSORIAL AVANZADO (para TEA/TPS)
// ═══════════════════════════════════════════════════════════════════════════
export const PERFIL_SENSORIAL_AVANZADO: FormDefinition = {
  id: 'sensorial_avanzado',
  title: 'Perfil Sensorial Avanzado (Dunn adaptado)',
  subtitle: 'Evaluación detallada de procesamiento sensorial',
  category: 'sensorial',
  icon: '🌀',
  color: 'from-violet-600 to-purple-700',
  targetRole: 'admin',
  estimatedMinutes: 25,
  description: 'Evaluación completa de los 8 sistemas sensoriales con perfil de procesamiento según modelo de Dunn (1997)',
  tags: ['Sensorial', 'SPD', 'Dunn', 'TEA', 'Integración sensorial'],
  sections: [
    {
      title: '👀 Procesamiento Visual',
      questions: [
        { id: 'vis_sensible', label: '¿Le molestan luces brillantes o espacios muy iluminados?', type: 'frequency', options: FREQ },
        { id: 'vis_busca', label: '¿Observa intensamente objetos que se mueven o giran?', type: 'frequency', options: FREQ },
        { id: 'vis_distracto', label: '¿Se distrae visualmente con movimientos en el ambiente?', type: 'frequency', options: FREQ },
        { id: 'vis_perder', label: '¿Pierde su lugar al leer o seguir texto?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '👂 Procesamiento Auditivo',
      questions: [
        { id: 'aud_ruidos', label: '¿Se angustia o protege los oídos ante ruidos cotidianos (secador, licuadora)?', type: 'frequency', options: FREQ },
        { id: 'aud_busca', label: '¿Busca activamente sonidos fuertes o los produce?', type: 'frequency', options: FREQ },
        { id: 'aud_no_responde', label: '¿Parece no escuchar cuando se le habla directamente?', type: 'frequency', options: FREQ },
        { id: 'aud_ambiente', label: '¿Tiene dificultad en ambientes con mucho ruido de fondo?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '✋ Procesamiento Táctil',
      questions: [
        { id: 'tac_texturas', label: '¿Evita texturas específicas en ropa, alimentos o superficies?', type: 'frequency', options: FREQ },
        { id: 'tac_contacto', label: '¿Se angustia con el contacto físico inesperado?', type: 'frequency', options: FREQ },
        { id: 'tac_busca', label: '¿Busca activamente experiencias táctiles (toca todo, se mancha)?', type: 'frequency', options: FREQ },
        { id: 'tac_temperatura', label: '¿Muestra indiferencia al frío, calor o dolor?', type: 'frequency', options: FREQ },
        { id: 'tac_higiene', label: '¿Resistencia al corte de uñas, peinado o lavado de cabello?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '🏃 Procesamiento Propioceptivo y Vestibular',
      questions: [
        { id: 'prop_busca', label: '¿Busca presión profunda (abrazos fuertes, aplastarse contra objetos)?', type: 'frequency', options: FREQ },
        { id: 'prop_fuerza', label: '¿Usa fuerza excesiva al agarrar objetos o personas?', type: 'frequency', options: FREQ },
        { id: 'vest_movimiento', label: '¿Busca activamente movimiento (columpios, girar, rebotar)?', type: 'frequency', options: FREQ },
        { id: 'vest_mareo', label: '¿Se marea fácilmente con movimientos normales?', type: 'frequency', options: FREQ },
        { id: 'vest_evita', label: '¿Evita actividades que requieran dejar los pies del suelo?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '👃 Olfato y Gusto (Interoceptivos)',
      questions: [
        { id: 'olfato_sensible', label: '¿Reacciona fuertemente a olores que otros no notan?', type: 'frequency', options: FREQ },
        { id: 'gusto_restriccion', label: '¿Tiene restricciones alimentarias basadas en sabor/textura?', type: 'frequency', options: FREQ },
        { id: 'interocepcion', label: '¿Tiene dificultad para identificar sensaciones internas (hambre, sed, necesidad de ir al baño)?', type: 'frequency', options: FREQ },
      ]
    },
    {
      title: '📊 Impacto Funcional',
      questions: [
        { id: 'impacto_aprendizaje', label: 'Impacto en el aprendizaje y atención', type: 'select', options: CONCERN },
        { id: 'impacto_social_sens', label: 'Impacto en interacciones sociales', type: 'select', options: CONCERN },
        { id: 'impacto_avd', label: 'Impacto en actividades de vida diaria', type: 'select', options: CONCERN },
        { id: 'patron_sensorial', label: 'Patrón sensorial predominante', type: 'select', required: true, options: ['Registro bajo (hiposensibilidad general)', 'Buscador sensorial (seeker)', 'Sensibilidad sensorial (hipersensibilidad)', 'Evitador sensorial', 'Perfil mixto', 'Sin patrón claro - variado'] },
        { id: 'recomendaciones_ot', label: 'Recomendaciones para terapia ocupacional / estrategias sensoriales', type: 'textarea', placeholder: 'Qué tipo de dieta sensorial, adaptaciones de ambiente, estrategias de autorregulación...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. REGISTRO DE CONDUCTA ABC MEJORADO (con análisis de función integrado)
// ═══════════════════════════════════════════════════════════════════════════
export const REGISTRO_ABC_AVANZADO: FormDefinition = {
  id: 'abc_avanzado',
  title: 'Registro ABC Avanzado + Función',
  subtitle: 'Antecedente → Conducta → Consecuencia con análisis funcional',
  category: 'conductual',
  icon: '📊',
  color: 'from-orange-500 to-amber-600',
  targetRole: 'admin',
  estimatedMinutes: 10,
  description: 'Registro observacional ABC con análisis de función integrado para recolección sistemática de datos conductuales',
  tags: ['ABC', 'Registro', 'Función', 'Observación', 'Datos'],
  sections: [
    {
      title: '🕐 Contexto del Episodio',
      questions: [
        { id: 'fecha_abc', label: 'Fecha y hora aproximada', type: 'text', placeholder: 'Ej: 15 marzo, 10:30am' },
        { id: 'lugar', label: 'Lugar', type: 'select', options: ['Sala de terapia', 'Casa - sala', 'Casa - comedor', 'Casa - cuarto', 'Escuela - aula', 'Escuela - recreo', 'Comunidad / externo', 'Otro'] },
        { id: 'actividad_en_curso', label: 'Actividad en curso', type: 'text', placeholder: 'Ej: trabajo en mesa, tiempo libre, almuerzo, transición...' },
        { id: 'personas_presentes', label: 'Personas presentes', type: 'multiselect', options: ['Solo con terapeuta', 'Con madre/padre', 'Con hermanos', 'Con pares/compañeros', 'En grupo', 'Solo'] },
      ]
    },
    {
      title: 'A — Antecedente',
      questions: [
        { id: 'antecedente_especifico', label: '¿Qué ocurrió justo antes de la conducta?', type: 'textarea', required: true, placeholder: 'Describe en detalle qué ocurrió en los 1-2 minutos antes de la conducta...' },
        { id: 'tipo_antecedente', label: 'Tipo de antecedente', type: 'select', options: ['Instrucción o demanda directa', 'Fin de actividad preferida', 'Transición', 'Atención dirigida a otra persona', 'Espera o demora', 'Estimulación sensorial', 'Interacción social iniciada por par', 'Sin antecedente claro / conducta espontánea'] },
      ]
    },
    {
      title: 'B — Conducta',
      questions: [
        { id: 'conducta_observada', label: 'Descripción operacional de la conducta', type: 'textarea', required: true, placeholder: 'Describe exactamente qué hizo el niño: topografía, duración aproximada, intensidad...' },
        { id: 'duracion_episodio_abc', label: 'Duración del episodio', type: 'select', options: ['Segundos', '1-5 minutos', '5-15 minutos', '15-30 minutos', 'Más de 30 minutos'] },
        { id: 'intensidad_episodio', label: 'Intensidad', type: 'select', options: INTENSITY },
      ]
    },
    {
      title: 'C — Consecuencia',
      questions: [
        { id: 'consecuencia_inmediata', label: '¿Qué ocurrió inmediatamente después?', type: 'textarea', required: true, placeholder: 'Describe exactamente la respuesta del adulto y el resultado para el niño...' },
        { id: 'tipo_consecuencia', label: 'Tipo de consecuencia', type: 'select', options: ['Se retiró la demanda / escape concedido', 'Se dio atención al niño (aunque negativa)', 'Se le dio lo que pedía (tangible)', 'Fue ignorado / sin consecuencia social', 'Tiempo fuera', 'Redirección', 'Corrección verbal', 'Restricción física', 'Consecuencia inconsistente'] },
        { id: 'funcion_hipotesis_abc', label: 'Hipótesis de función (este episodio)', type: 'select', required: true, options: ['Atención social', 'Tangible (objeto/actividad)', 'Escape de demanda', 'Estimulación automática', 'Múltiple', 'Desconocida'] },
        { id: 'notas_abc', label: 'Notas adicionales del observador', type: 'textarea', placeholder: 'Factores contextuales, operaciones motivacionales observadas, variaciones respecto a episodios anteriores...' },
      ]
    }
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTACIONES
// ═══════════════════════════════════════════════════════════════════════════
export const COMPETITIVE_FORMS: FormDefinition[] = [
  EVALUACION_FUNCIONAL_CONDUCTA,
  PLAN_INTERVENCION_CONDUCTUAL,
  OBJETIVOS_IEP,
  EVALUACION_LENGUAJE_VERBAL,
  INFORME_PROGRESO_MENSUAL,
  HABILIDADES_ADAPTATIVAS,
  PERFIL_SENSORIAL_AVANZADO,
  REGISTRO_ABC_AVANZADO,
]
