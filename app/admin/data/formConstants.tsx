'use client'

import { useI18n } from '@/lib/i18n-context'

// ==============================================================================
// ARCHIVO: app/admin/data/formConstants.tsx
// Datos de configuración para todos los formularios de evaluación
// ==============================================================================

import {
  Brain, Activity, Target, Heart, TrendingUp, Zap, Award, BookOpen,
  Home, MessageCircle, Calendar, Eye, Users, Sparkles
} from 'lucide-react'

export const FORM_TABLE_MAPPING = {
  'brief2': 'evaluacion_brief2',
  'ados2': 'evaluacion_ados2',
  'vineland3': 'evaluacion_vineland3',
  'wiscv': 'evaluacion_wiscv',
  'basc3': 'evaluacion_basc3'
}

export const EVALUATION_COLORS = {
  'brief2': {
    primary: 'from-indigo-500 to-indigo-600',
    light: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    hover: 'hover:border-indigo-400'
  },
  'ados2': {
    primary: 'from-teal-500 to-teal-600',
    light: 'bg-teal-50 text-teal-700 border-teal-200',
    hover: 'hover:border-teal-400'
  },
  'vineland3': {
    primary: 'from-emerald-500 to-emerald-600',
    light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hover: 'hover:border-emerald-400'
  },
  'wiscv': {
    primary: 'from-violet-500 to-violet-600',
    light: 'bg-violet-50 text-violet-700 border-violet-200',
    hover: 'hover:border-violet-400'
  },
  'basc3': {
    primary: 'from-rose-500 to-rose-600',
    light: 'bg-rose-50 text-rose-700 border-rose-200',
    hover: 'hover:border-rose-400'
  }
}

export const ANAMNESIS_DATA = [
  {
    title: "1. Datos de Filiación",
    questions: [
      { id: "informante", label: "Nombre del informante", type: "text", placeholder: "Nombre completo" },
      { id: "parentesco", label: "Parentesco con el niño", type: "select", options: ["Madre", "Padre", "Abuelo/a", "Tutor", "Otro"] },
      { id: "vive_con", label: "¿Con quién vive el niño?", type: "text", placeholder: "Ej: Padres y hermanos" },
      { id: "escolaridad", label: "Escolaridad actual", type: "select", options: ["No escolarizado", "Nido/Inicial", "Primaria", "CEBE"] },
    ]
  },
  {
    title: "2. Motivo de Consulta",
    questions: [
      { id: "motivo_principal", label: "Motivo principal de la consulta", type: "textarea", placeholder: "Describe el problema o preocupación principal..." },
      { id: "derivado_por", label: "¿Quién lo deriva?", type: "select", options: ["Iniciativa propia", "Institución Educativa", "Médico Pediatra", "Psicólogo", "Otro"] },
      { id: "expectativas", label: "¿Qué espera lograr con la terapia?", type: "textarea", placeholder: "Objetivos de los padres..." },
    ]
  },
  {
    title: "3. Historia Prenatal (Embarazo y Parto)",
    questions: [
      { id: "tipo_embarazo", label: "¿El embarazo fue planificado?", type: "radio", options: ["Sí", "No"] },
      { id: "complicaciones_emb", label: "¿Hubo complicaciones en el embarazo?", type: "textarea", placeholder: "Amenazas de aborto, infecciones, caídas, estrés fuerte..." },
      { id: "tipo_parto", label: "Tipo de parto", type: "select", options: ["Natural", "Cesárea de emergencia", "Cesárea programada"] },
      { id: "llanto", label: "¿Lloró al nacer?", type: "radio", options: ["Sí", "No", "No sabe"] },
      { id: "incubadora", label: "¿Requirió incubadora?", type: "radio", options: ["Sí", "No"] },
    ]
  },
  {
    title: "4. Historia Médica",
    questions: [
      { id: "enfermedades", label: "¿Ha tenido enfermedades graves?", type: "textarea", placeholder: "Convulsiones, fiebres altas, otitis, alergias..." },
      { id: "examenes", label: "¿Tiene exámenes previos?", type: "select", options: ["Ninguno", "Audición", "Visión", "Neurológico", "Genético", "Varios"] },
      { id: "medicacion", label: "¿Toma alguna medicación actual?", type: "text", placeholder: "Nombre y dosis..." },
    ]
  },
  {
    title: "5. Desarrollo Psicomotor",
    questions: [
      { id: "sosten_cefalico", label: "Edad de sostén cefálico (sostener cabeza)", type: "text", placeholder: "Ej: 3 meses" },
      { id: "gateo", label: "Edad de gateo", type: "text", placeholder: "Ej: 8 meses" },
      { id: "marcha", label: "Edad de marcha (caminar solo)", type: "text", placeholder: "Ej: 1 año 2 meses" },
      { id: "caidas", label: "¿Se cae con frecuencia?", type: "radio", options: ["Sí", "No"] },
      { id: "motricidad_fina", label: "Motricidad fina (pinza, agarre)", type: "select", options: ["Adecuada", "Dificultad para agarrar", "Torpeza manual"] },
    ]
  },
  {
    title: "6. Desarrollo del Lenguaje",
    questions: [
      { id: "primeras_palabras", label: "Edad de primeras palabras", type: "text", placeholder: "Ej: 1 año" },
      { id: "intencion_comunicativa", label: "¿Tiene intención comunicativa?", type: "radio", options: ["Sí", "No", "A veces"] },
      { id: "comprension", label: "Nivel de comprensión", type: "select", options: ["Entiende todo", "Entiende órdenes simples", "No parece entender", "Ignora su nombre"] },
      { id: "frases", label: "¿Estructura frases?", type: "radio", options: ["Sí (sujeto+verbo)", "Solo palabras sueltas", "No habla"] },
    ]
  },
  {
    title: "7. Alimentación y Sueño",
    questions: [
      { id: "apetito", label: "Apetito", type: "select", options: ["Bueno", "Selectivo/Melindroso", "Voraz", "Poco apetito"] },
      { id: "masticacion", label: "¿Mastica bien los sólidos?", type: "radio", options: ["Sí", "No, se atora", "Solo come papillas"] },
      { id: "sueno_calidad", label: "Calidad del sueño", type: "select", options: ["Duerme toda la noche", "Despertares frecuentes", "Dificultad para conciliar", "Pesadillas"] },
      { id: "duerme_con", label: "¿Con quién duerme?", type: "text", placeholder: "Solo, padres, hermanos..." },
    ]
  },
  {
    title: "8. Autonomía e Higiene",
    questions: [
      { id: "control_esfinteres", label: "Control de esfínteres (baño)", type: "select", options: ["Controla día y noche", "Solo día", "Avisar", "Usa pañal"] },
      { id: "vestido", label: "Vestimenta", type: "select", options: ["Se viste solo", "Ayuda parcial", "Dependiente total"] },
      { id: "aseo", label: "Aseo personal (lavado manos/dientes)", type: "select", options: ["Independiente", "Necesita ayuda", "Se resiste"] },
    ]
  },
  {
    title: "9. Área Emocional y Social",
    questions: [
      { id: "contacto_visual", label: "Contacto visual", type: "select", options: ["Sostenido", "Fugaz", "Nulo/Evita"] },
      { id: "juego", label: "Tipo de juego", type: "select", options: ["Simbólico (imaginación)", "Funcional (carritos)", "Repetitivo/Alinear", "Sensorial"] },
      { id: "rabietas", label: "¿Presenta rabietas frecuentes?", type: "radio", options: ["Sí, diarias", "Ocasionales", "Rara vez"] },
      { id: "pares", label: "Relación con otros niños", type: "select", options: ["Juega e interactúa", "Observa sin jugar", "Ignora/Aisla", "Agrede"] },
    ]
  },
  {
    title: "10. OBSERVACIONES DEL TERAPEUTA",
    questions: [
      { id: "apariencia", label: "Apariencia física y aliño:", type: "textarea", placeholder: "Descripción física..." },
      { id: "actitud_evaluacion", label: "Actitud ante la evaluación:", type: "radio", options: ["Colaborador", "Inhibido", "Oposicionista"] },
      { id: "contacto_visual_obs", label: "Contacto visual (Observación):", type: "radio", options: ["Adecuado", "Fugaz", "Ausente"] },
      { id: "notas_adicionales", label: "Notas Adicionales:", type: "textarea", placeholder: "Observaciones finales..." },
    ]
  }
]

export const ABA_DATA = [
  {
    title: "1. Información de la Sesión",
    icon: <Calendar size={20}/>,
    questions: [
      { id: "fecha_sesion", label: "Fecha de la sesión", type: "date", required: true },
      { id: "duracion_minutos", label: "Duración (minutos)", type: "number", placeholder: "45", min: 15, max: 120 },
      { id: "tipo_sesion", label: "Tipo de sesión", type: "select", options: ["Individual", "Grupal", "Domiciliaria", "Virtual"], required: true },
      { id: "objetivo_principal", label: "Objetivo principal de la sesión", type: "textarea", placeholder: "Describe el objetivo terapéutico...", required: true },
    ]
  },
  {
    title: "2. Registro ABC (Análisis Conductual)",
    icon: <Activity size={20}/>,
    questions: [
      { id: "antecedente", label: "Antecedente (A)", type: "textarea", placeholder: "¿Qué sucedió ANTES de la conducta? Contexto, actividad, personas presentes..." },
      { id: "conducta", label: "Conducta Observada (B)", type: "textarea", placeholder: "Describe EXACTAMENTE qué hizo el niño (observable y medible)...", required: true },
      { id: "consecuencia", label: "Consecuencia (C)", type: "textarea", placeholder: "¿Qué pasó DESPUÉS? Respuesta del terapeuta, del entorno..." },
      { id: "funcion_estimada", label: "Función estimada de la conducta", type: "select", options: ["Acceso a Tangible", "Atención Social", "Escape/Evitación", "Sensorial/Automático", "Múltiple"] },
    ]
  },
  {
    title: "3. Métricas de Desempeño",
    icon: <TrendingUp size={20}/>,
    questions: [
      { id: "nivel_atencion", label: "Nivel de atención sostenida", type: "range", min: 1, max: 5, labels: ["Muy disperso", "Disperso", "Moderado", "Bueno", "Excelente"] },
      { id: "respuesta_instrucciones", label: "Respuesta a instrucciones", type: "range", min: 1, max: 5, labels: ["Nula", "Mínima", "Parcial", "Buena", "Inmediata"] },
      { id: "iniciativa_comunicativa", label: "Iniciativa comunicativa", type: "range", min: 1, max: 5, labels: ["Nula", "Muy baja", "Baja", "Moderada", "Alta"] },
      { id: "tolerancia_frustracion", label: "Tolerancia a la frustración", type: "range", min: 1, max: 5, labels: ["Muy baja", "Baja", "Moderada", "Buena", "Excelente"] },
      { id: "interaccion_social", label: "Calidad de interacción social", type: "range", min: 1, max: 5, labels: ["Evitativa", "Mínima", "Funcional", "Buena", "Espontánea"] },
    ]
  },
  {
    title: "4. Habilidades Trabajadas",
    icon: <Target size={20}/>,
    questions: [
      { id: "habilidades_objetivo", label: "Habilidades específicas trabajadas", type: "multiselect", options: [
        "Contacto visual", "Imitación motora", "Seguimiento de instrucciones",
        "Comunicación funcional", "Juego simbólico", "Habilidades sociales",
        "Autorregulación emocional", "Motricidad fina", "Motricidad gruesa",
        "Atención conjunta", "Espera de turnos", "Flexibilidad cognitiva"
      ]},
      { id: "nivel_logro_objetivos", label: "Nivel de logro de objetivos", type: "select", options: [
        "No logrado (0-25%)", "Parcialmente logrado (26-50%)",
        "Mayormente logrado (51-75%)", "Completamente logrado (76-100%)"
      ]},
      { id: "ayudas_utilizadas", label: "Nivel de ayudas proporcionadas", type: "select", options: [
        "Independiente (sin ayuda)", "Ayuda gestual", "Ayuda verbal",
        "Modelado", "Guía física parcial", "Guía física total"
      ]},
    ]
  },
  {
    title: "5. Intervenciones y Estrategias",
    icon: <Zap size={20}/>,
    questions: [
      { id: "tecnicas_aplicadas", label: "Técnicas ABA aplicadas", type: "multiselect", options: [
        "Reforzamiento positivo", "Extinción", "Moldeamiento",
        "Encadenamiento", "Análisis de tareas", "Tiempo fuera",
        "Economía de fichas", "Contrato conductual", "Entrenamiento en comunicación funcional"
      ]},
      { id: "reforzadores_efectivos", label: "Reforzadores más efectivos", type: "textarea", placeholder: "Lista los reforzadores que funcionaron mejor hoy..." },
      { id: "conductas_desafiantes", label: "Conductas desafiantes presentadas", type: "textarea", placeholder: "Describe frecuencia e intensidad..." },
      { id: "estrategias_manejo", label: "Estrategias de manejo utilizadas", type: "textarea", placeholder: "Cómo se abordaron las conductas desafiantes..." },
    ]
  },
  {
    title: "6. Progreso y Evolución",
    icon: <Award size={20}/>,
    hasIA: true,
    questions: [
      { id: "avances_observados", label: "Avances observados en esta sesión", type: "textarea", placeholder: "Logros específicos, mejoras respecto a sesiones anteriores...", aiGenerated: true },
      { id: "areas_dificultad", label: "Áreas de dificultad persistente", type: "textarea", placeholder: "Aspectos que requieren más trabajo...", aiGenerated: true },
      { id: "patron_aprendizaje", label: "Patrón de aprendizaje observado", type: "select", options: [
        "Aprendizaje rápido y generalización", "Aprendizaje gradual",
        "Requiere repetición intensiva", "Dificultad para generalizar",
        "Aprendizaje inconsistente"
      ], aiGenerated: true },
    ]
  },
  {
    title: "7. Observaciones Clínicas (Interno)",
    icon: <BookOpen size={20}/>,
    hasIA: true,
    questions: [
      { id: "observaciones_tecnicas", label: "Notas técnicas para el equipo", type: "textarea", placeholder: "Análisis profesional, hipótesis clínicas, ajustes necesarios...", aiGenerated: true },
      { id: "alertas_clinicas", label: "Alertas o banderas rojas", type: "textarea", placeholder: "Señales de preocupación, regresiones, cambios significativos...", aiGenerated: true },
      { id: "recomendaciones_equipo", label: "Recomendaciones para el equipo", type: "textarea", placeholder: "Sugerencias para siguientes sesiones, derivaciones necesarias...", aiGenerated: true },
      { id: "coordinacion_familia", label: "Necesidad de coordinación con familia", type: "radio", options: ["Urgente", "Necesaria", "Rutinaria", "No necesaria"], aiGenerated: true },
    ]
  },
  {
    title: "8. Tarea para Casa",
    icon: <Home size={20}/>,
    hasIA: true,
    questions: [
      { id: "actividad_casa", label: "Actividad sugerida para practicar en casa", type: "textarea", placeholder: "Descripción detallada de la actividad, materiales necesarios, frecuencia...", aiGenerated: true },
      { id: "instrucciones_padres", label: "Instrucciones específicas para los padres", type: "textarea", placeholder: "Pasos claros, qué hacer y qué evitar...", aiGenerated: true },
      { id: "objetivo_tarea", label: "Objetivo de la tarea", type: "text", placeholder: "¿Qué habilidad refuerza esta actividad?", aiGenerated: true },
    ]
  },
  {
    title: "9. Comunicación con la Familia (VISIBLE PARA PADRES)",
    icon: <MessageCircle size={20}/>,
    hasIA: true,
    questions: [
      { id: "mensaje_padres", label: "Mensaje para WhatsApp/Informe", type: "textarea", placeholder: "Este mensaje será visible para los padres. Usa lenguaje positivo y claro...", aiGenerated: true },
      { id: "destacar_positivo", label: "Logros para destacar a los padres", type: "textarea", placeholder: "Aspectos positivos que los padres deben saber...", aiGenerated: true },
      { id: "proximos_pasos", label: "Próximos pasos (para compartir)", type: "textarea", placeholder: "Qué viene en las siguientes sesiones...", aiGenerated: true },
    ]
  },
  {
    title: "10. Análisis y Planificación",
    icon: <Brain size={20}/>,
    hasIA: true,
    questions: [
      { id: "efectividad_sesion", label: "Efectividad global de la sesión", type: "range", min: 1, max: 5, labels: ["Muy baja", "Baja", "Moderada", "Alta", "Muy alta"], aiGenerated: true },
      { id: "ajustes_proxima_sesion", label: "Ajustes para la próxima sesión", type: "textarea", placeholder: "Qué modificar, qué mantener, nuevas estrategias a probar...", aiGenerated: true },
      { id: "necesidades_materiales", label: "Materiales o recursos necesarios", type: "text", placeholder: "Qué se necesita conseguir para próximas sesiones...", aiGenerated: true },
    ]
  }
]

export const ENTORNO_HOGAR_DATA = [
  {
    title: "1. Información General de la Visita",
    questions: [
      { id: "fecha_visita", label: "Fecha de la visita domiciliaria", type: "date" },
      { id: "duracion_visita", label: "Duración aproximada", type: "text", placeholder: "Ej: 1 hora 30 min" },
      { id: "personas_presentes", label: "¿Quiénes estuvieron presentes?", type: "textarea", placeholder: "Madre, padre, hermanos, abuelos..." },
    ]
  },
  {
    title: "2. Estructura y Condiciones del Hogar",
    questions: [
      { id: "tipo_vivienda", label: "Tipo de vivienda", type: "select", options: ["Casa independiente", "Departamento", "Cuarto alquilado", "Vivienda compartida", "Otro"] },
      { id: "num_habitaciones", label: "Número de habitaciones", type: "text", placeholder: "Ej: 2 dormitorios" },
      { id: "espacio_juego", label: "¿Existe espacio dedicado para juego/terapia?", type: "radio", options: ["Sí, espacio amplio", "Espacio reducido", "No hay espacio específico"] },
      { id: "condiciones_higiene", label: "Condiciones generales de higiene", type: "select", options: ["Excelente", "Buena", "Regular", "Necesita mejoras"] },
      { id: "iluminacion_ventilacion", label: "Iluminación y ventilación", type: "select", options: ["Adecuada", "Insuficiente", "Excesiva"] },
    ]
  },
  {
    title: "3. Recursos y Materiales Disponibles",
    questions: [
      { id: "juguetes_disponibles", label: "Juguetes y materiales educativos", type: "textarea", placeholder: "Lista los juguetes, libros, materiales sensoriales disponibles..." },
      { id: "acceso_tecnologia", label: "Acceso a tecnología (tablet, TV, computadora)", type: "radio", options: ["Sí, con supervisión", "Sí, sin límites", "No tiene acceso"] },
      { id: "tiempo_pantalla", label: "Tiempo diario frente a pantallas", type: "text", placeholder: "Ej: 2 horas" },
    ]
  },
  {
    title: "4. Rutinas y Estructura Familiar",
    questions: [
      { id: "rutina_diaria", label: "Descripción de la rutina diaria del niño", type: "textarea", placeholder: "Hora de despertar, comidas, siestas, actividades..." },
      { id: "consistencia_rutinas", label: "¿Las rutinas son consistentes?", type: "radio", options: ["Sí, muy estructuradas", "Parcialmente", "No, son variables"] },
      { id: "hora_dormir", label: "Horario habitual de dormir", type: "text", placeholder: "Ej: 8:30 PM" },
      { id: "actividades_familia", label: "Actividades que realiza la familia junta", type: "textarea", placeholder: "Comidas, paseos, juegos..." },
    ]
  },
  {
    title: "5. Dinámica Familiar y Relaciones",
    questions: [
      { id: "interaccion_padres", label: "Calidad de interacción padres-niño observada", type: "select", options: ["Muy positiva y cálida", "Funcional", "Tensa o conflictiva", "Distante"] },
      { id: "estilo_crianza", label: "Estilo de crianza predominante", type: "select", options: ["Autoritativo (límites + afecto)", "Permisivo", "Autoritario", "Negligente", "Mixto"] },
      { id: "manejo_conductas", label: "¿Cómo manejan las conductas desafiantes?", type: "textarea", placeholder: "Estrategias que usan los padres..." },
      { id: "apoyo_red_familiar", label: "Red de apoyo familiar/social", type: "textarea", placeholder: "Abuelos, tíos, vecinos, amigos que ayudan..." },
    ]
  },
  {
    title: "6. Alimentación y Hábitos de Salud",
    questions: [
      { id: "tipo_alimentacion", label: "Tipo de alimentación del niño", type: "textarea", placeholder: "Describe dieta típica, preferencias, rechazos..." },
      { id: "quien_prepara_comida", label: "¿Quién prepara las comidas?", type: "text", placeholder: "Ej: Madre principalmente" },
      { id: "come_familia", label: "¿Come junto a la familia?", type: "radio", options: ["Sí, siempre", "A veces", "No, come solo"] },
    ]
  },
  {
    title: "7. Observaciones del Comportamiento en Casa",
    questions: [
      { id: "comportamiento_observado", label: "Comportamiento del niño durante la visita", type: "textarea", placeholder: "Actividad, estado de ánimo, interacción con familiares..." },
      { id: "diferencias_consultorio", label: "¿Diferencias con el comportamiento en consultorio?", type: "textarea", placeholder: "Conductas que aparecen solo en casa o solo en terapia..." },
      { id: "estimulacion_sensorial", label: "Estímulos sensoriales del entorno (ruido, luz, texturas)", type: "textarea", placeholder: "TV encendida, música, mascotas, olores..." },
    ]
  },
  {
    title: "8. Barreras y Facilitadores para la Terapia",
    questions: [
      { id: "barreras_identificadas", label: "Barreras para implementar estrategias en casa", type: "textarea", placeholder: "Falta de tiempo, espacios reducidos, resistencia familiar..." },
      { id: "facilitadores", label: "Facilitadores y fortalezas del entorno", type: "textarea", placeholder: "Compromiso de padres, buenos recursos, rutinas claras..." },
      { id: "disposicion_cambio", label: "Disposición de la familia para realizar cambios", type: "radio", options: ["Muy motivados", "Moderadamente dispuestos", "Resistentes", "Ambivalentes"] },
    ]
  },
  {
    title: "9. Recomendaciones Específicas para el Hogar",
    questions: [
      { id: "recomendaciones_espacio", label: "Recomendaciones sobre el espacio físico", type: "textarea", placeholder: "Adaptar rincón sensorial, reducir distractores..." },
      { id: "recomendaciones_rutinas", label: "Ajustes sugeridos en rutinas", type: "textarea", placeholder: "Horarios de sueño, estructura de comidas..." },
      { id: "actividades_casa", label: "Actividades terapéuticas sugeridas para realizar en casa", type: "textarea", placeholder: "Ejercicios de motricidad, juegos de imitación..." },
    ]
  },
  {
    title: "10. Análisis e Impresión General (IA Asistida)",
    hasIA: true,
    questions: [
      { id: "impresion_general", label: "Impresión General del Entorno", type: "textarea", placeholder: "Resumen de la visita y evaluación global..." },
      { id: "mensaje_padres_entorno", label: "Mensaje para los Padres (Generado por IA)", type: "textarea", placeholder: "Este campo puede ser generado por IA...", aiGenerated: true },
      { id: "seguimiento_requerido", label: "¿Requiere seguimiento o nueva visita?", type: "radio", options: ["Sí, en 1 mes", "Sí, en 3 meses", "No necesario por ahora"] },
    ]
  }
]

export const BRIEF2_DATA = [
  {
    title: "1. Información de la Evaluación",
    icon: <Brain size={20}/>,
    questions: [
      { id: "fecha_evaluacion", label: "Fecha de evaluación", type: "date", required: true },
      { id: "evaluador", label: "Nombre del evaluador", type: "text", required: true },
      { id: "informante", label: "Informante", type: "select", options: ["Madre", "Padre", "Ambos padres", "Maestro/a", "Terapeuta", "Otro"] },
      { id: "edad_evaluado", label: "Edad del niño (años)", type: "number", min: 2, max: 18 },
      { id: "motivo_evaluacion", label: "Motivo de la evaluación", type: "textarea", placeholder: "Por qué se realiza esta evaluación..." },
    ]
  },
  {
    title: "2. Índice de Inhibición",
    description: "Capacidad para resistir impulsos y detener comportamiento en el momento apropiado",
    icon: <Activity size={20}/>,
    questions: [
      { id: "inhibe_1", label: "Tiene problemas para esperar su turno", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "inhibe_2", label: "Actúa de manera más salvaje o ruidosa que otros niños", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "inhibe_3", label: "Interrumpe conversaciones de otros", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "inhibe_4", label: "Reacciona de manera exagerada ante pequeños problemas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "inhibe_5", label: "Tiene problemas para controlar sus emociones", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "inhibe_6", label: "Tiene arrebatos de ira desproporcionados", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "inhibe_notas", label: "Observaciones sobre inhibición", type: "textarea", placeholder: "Ejemplos específicos, contextos donde mejora/empeora..." },
    ]
  },
  {
    title: "3. Índice de Flexibilidad Cognitiva",
    description: "Capacidad para cambiar de actividad, revisar planes y adaptarse a nuevas situaciones",
    icon: <Target size={20}/>,
    questions: [
      { id: "flex_1", label: "Se resiste a cambios de rutina, comida, lugares", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "flex_2", label: "Se altera por situaciones inesperadas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "flex_3", label: "Persiste en la misma respuesta aunque no funcione", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "flex_4", label: "Tiene problemas aceptando diferentes formas de resolver problemas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "flex_5", label: "Se queda atascado en un tema o actividad", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "flex_6", label: "Le cuesta pasar de una actividad a otra", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "flex_notas", label: "Observaciones sobre flexibilidad", type: "textarea", placeholder: "Situaciones de rigidez, estrategias que funcionan..." },
    ]
  },
  {
    title: "4. Control Emocional",
    description: "Capacidad para modular respuestas emocionales apropiadamente",
    icon: <Heart size={20}/>,
    questions: [
      { id: "emocional_1", label: "Tiene estallidos emocionales por razones mínimas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "emocional_2", label: "Las pequeñas cosas provocan grandes reacciones", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "emocional_3", label: "Cambia de humor rápidamente", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "emocional_4", label: "Se altera fácilmente", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "emocional_5", label: "Reacciona más emocionalmente que otros niños de su edad", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "emocional_notas", label: "Observaciones sobre control emocional", type: "textarea", placeholder: "Desencadenantes, duración de episodios, recuperación..." },
    ]
  },
  {
    title: "5. Memoria de Trabajo",
    description: "Capacidad para mantener información en la mente para completar una tarea",
    icon: <Brain size={20}/>,
    questions: [
      { id: "memoria_1", label: "Olvida lo que debía hacer", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "memoria_2", label: "Tiene problemas recordando instrucciones", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "memoria_3", label: "Pierde el hilo de lo que está haciendo", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "memoria_4", label: "Tiene problemas recordando lo que acaba de escuchar", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "memoria_5", label: "Necesita que le repitan las cosas varias veces", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "memoria_notas", label: "Observaciones sobre memoria", type: "textarea", placeholder: "Estrategias de compensación, apoyos visuales..." },
    ]
  },
  {
    title: "6. Planificación y Organización",
    description: "Capacidad para manejar tareas presentes y futuras",
    icon: <Target size={20}/>,
    questions: [
      { id: "plan_1", label: "No planifica con anticipación las tareas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "plan_2", label: "Tiene problemas para organizar actividades", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "plan_3", label: "Subestima el tiempo necesario para completar tareas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "plan_4", label: "Deja las cosas desordenadas", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "plan_5", label: "Tiene problemas para priorizar actividades", type: "range", min: 1, max: 3, labels: ["Nunca", "A veces", "Con frecuencia"] },
      { id: "plan_notas", label: "Observaciones sobre planificación", type: "textarea", placeholder: "Estrategias compensatorias..." },
    ]
  },
  {
    title: "7. Análisis y Conclusiones (IA)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "analisis_ia", label: "Análisis Integral IA", type: "textarea", placeholder: "Análisis completo generado por IA...", aiGenerated: true },
      { id: "recomendaciones_ia", label: "Recomendaciones Terapéuticas", type: "textarea", placeholder: "Recomendaciones específicas...", aiGenerated: true },
      { id: "informe_padres", label: "Informe para Padres", type: "textarea", placeholder: "Informe comprensible para la familia...", aiGenerated: true },
    ]
  }
]

export const ADOS2_DATA = [
  {
    title: "1. Datos de la Evaluación",
    icon: <Eye size={20}/>,
    questions: [
      { id: "fecha_eval", label: "Fecha de evaluación", type: "date", required: true },
      { id: "modulo_aplicado", label: "Módulo aplicado", type: "select", options: ["Módulo 1 (Sin lenguaje)", "Módulo 2 (Frases)", "Módulo 3 (Fluente)", "Módulo 4 (Adolescente/Adulto)"] },
      { id: "duracion_eval", label: "Duración de la evaluación (minutos)", type: "number", min: 30, max: 90 },
      { id: "evaluador_certificado", label: "Evaluador certificado ADOS-2", type: "text" },
    ]
  },
  {
    title: "2. Comunicación Social",
    description: "Evaluación de habilidades comunicativas y sociales",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "contacto_visual", label: "Contacto visual durante la interacción social", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "expresiones_faciales", label: "Expresiones faciales dirigidas a otros", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "integracion_mirada", label: "Integración de mirada y otras conductas sociales", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "sonrisa_social", label: "Sonrisa social compartida", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "comunicacion_afectiva", label: "Rango de comunicación afectiva", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "atencion_conjunta", label: "Respuesta a atención conjunta", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "inicio_atencion", label: "Iniciativa de atención conjunta", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "notas_comunicacion", label: "Observaciones comunicación", type: "textarea" },
    ]
  },
  {
    title: "3. Interacción Social Recíproca",
    description: "Calidad de las interacciones sociales bidireccionales",
    icon: <Users size={20}/>,
    questions: [
      { id: "busqueda_compartir", label: "Búsqueda de compartir experiencias", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "ofrecimiento_consuelo", label: "Ofrecimiento de consuelo", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "respuesta_nombre", label: "Respuesta al nombre", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "reciprocidad_social", label: "Calidad de reciprocidad social", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "interes_otros", label: "Interés en otros niños", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "notas_interaccion", label: "Observaciones interacción", type: "textarea" },
    ]
  },
  {
    title: "4. Juego e Imaginación",
    description: "Evaluación de juego simbólico y creatividad",
    icon: <Activity size={20}/>,
    questions: [
      { id: "juego_funcional", label: "Juego funcional con objetos", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "juego_imaginativo", label: "Juego imaginativo/creativo", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "juego_imitativo", label: "Juego imitativo social", type: "range", min: 0, max: 3, labels: ["Apropiado", "Leve", "Marcado", "Ausente"] },
      { id: "notas_juego", label: "Observaciones sobre juego", type: "textarea" },
    ]
  },
  {
    title: "5. Conductas Restringidas y Repetitivas",
    description: "Patrones de comportamiento estereotipados",
    icon: <Target size={20}/>,
    questions: [
      { id: "estereotipias_motoras", label: "Estereotipias motoras", type: "range", min: 0, max: 2, labels: ["Ausente", "Presente", "Frecuente"] },
      { id: "manipulacion_objetos", label: "Uso repetitivo de objetos", type: "range", min: 0, max: 2, labels: ["Ausente", "Presente", "Frecuente"] },
      { id: "intereses_restringidos", label: "Intereses restringidos intensos", type: "range", min: 0, max: 2, labels: ["Ausente", "Presente", "Frecuente"] },
      { id: "rituales_compulsiones", label: "Rituales o compulsiones", type: "range", min: 0, max: 2, labels: ["Ausente", "Presente", "Frecuente"] },
      { id: "sensibilidad_sensorial", label: "Sensibilidad sensorial inusual", type: "range", min: 0, max: 2, labels: ["Ausente", "Presente", "Frecuente"] },
      { id: "notas_conductas", label: "Observaciones conductas", type: "textarea" },
    ]
  },
  {
    title: "6. Análisis Diagnóstico (IA)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "puntuacion_total", label: "Puntuación total calculada", type: "number", readonly: true },
      { id: "nivel_severidad", label: "Nivel de severidad", type: "text", readonly: true },
      { id: "analisis_diagnostico_ia", label: "Análisis Diagnóstico IA", type: "textarea", aiGenerated: true },
      { id: "recomendaciones_intervencion", label: "Recomendaciones de Intervención", type: "textarea", aiGenerated: true },
      { id: "informe_familia_ados", label: "Informe para Familia", type: "textarea", aiGenerated: true },
    ]
  }
]

export const VINELAND3_DATA = [
  {
    title: "1. Información General",
    icon: <Users size={20}/>,
    questions: [
      { id: "fecha_eval_vineland", label: "Fecha de evaluación", type: "date", required: true },
      { id: "informante_vineland", label: "Informante", type: "select", options: ["Madre", "Padre", "Ambos", "Cuidador primario", "Maestro"] },
      { id: "forma_aplicacion", label: "Forma de aplicación", type: "select", options: ["Entrevista semi-estructurada", "Formulario para padres", "Formulario para maestros"] },
    ]
  },
  {
    title: "2. Dominio de Comunicación",
    description: "Habilidades receptivas, expresivas y escritas",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "com_receptiva", label: "¿Entiende cuando se le dice 'no'?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "com_sigue_instrucciones", label: "¿Sigue instrucciones simples?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "com_entiende_2pasos", label: "¿Sigue instrucciones de 2 pasos?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "com_expresiva_palabras", label: "¿Usa palabras para pedir cosas?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "com_frases_completas", label: "¿Usa frases completas de 4+ palabras?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "com_cuenta_experiencias", label: "¿Cuenta experiencias con detalle?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "com_escrita", label: "¿Escribe su nombre?", type: "radio", options: ["Usualmente", "A veces", "Nunca", "N/A"] },
      { id: "com_notas", label: "Observaciones comunicación", type: "textarea" },
    ]
  },
  {
    title: "3. Dominio de Vida Diaria",
    description: "Autonomía personal, doméstica y comunitaria",
    icon: <Home size={20}/>,
    questions: [
      { id: "vida_come_solo", label: "¿Come solo con cuchara/tenedor?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "vida_bebe_vaso", label: "¿Bebe de un vaso sin derramar?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "vida_lava_manos", label: "¿Se lava las manos solo?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "vida_viste_superior", label: "¿Se pone ropa superior solo?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "vida_bano", label: "¿Usa el baño independientemente?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "vida_tareas_casa", label: "¿Ayuda en tareas domésticas simples?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "vida_dinero", label: "¿Entiende el concepto de dinero?", type: "radio", options: ["Usualmente", "A veces", "Nunca", "N/A"] },
      { id: "vida_notas", label: "Observaciones vida diaria", type: "textarea" },
    ]
  },
  {
    title: "4. Dominio de Socialización",
    description: "Relaciones interpersonales, juego y manejo emocional",
    icon: <Heart size={20}/>,
    questions: [
      { id: "soc_sonrie_familiar", label: "¿Sonríe a personas familiares?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "soc_muestra_afecto", label: "¿Muestra afecto a cuidadores?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "soc_juega_otros", label: "¿Juega interactivamente con otros niños?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "soc_comparte", label: "¿Comparte juguetes espontáneamente?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "soc_respeta_turnos", label: "¿Respeta turnos en juegos?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "soc_empatia", label: "¿Muestra preocupación por otros?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "soc_amistad", label: "¿Tiene amigos cercanos?", type: "radio", options: ["Usualmente", "A veces", "Nunca", "N/A"] },
      { id: "soc_notas", label: "Observaciones socialización", type: "textarea" },
    ]
  },
  {
    title: "5. Dominio de Habilidades Motoras",
    description: "Motricidad gruesa y fina",
    icon: <Activity size={20}/>,
    questions: [
      { id: "motor_camina", label: "¿Camina sin ayuda?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "motor_corre", label: "¿Corre coordinadamente?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "motor_salta", label: "¿Salta con ambos pies?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "motor_pelota", label: "¿Atrapa una pelota?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "motor_pinza", label: "¿Usa pinza digital (pulgar-índice)?", type: "radio", options: ["Usualmente", "A veces", "Nunca"] },
      { id: "motor_dibuja", label: "¿Dibuja formas reconocibles?", type: "radio", options: ["Usualmente", "A veces", "Nunca", "N/A"] },
      { id: "motor_notas", label: "Observaciones motoras", type: "textarea" },
    ]
  },
  {
    title: "6. Análisis de Conducta Adaptativa (IA)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "puntuacion_comunicacion", label: "Puntuación Comunicación", type: "number", readonly: true },
      { id: "puntuacion_vida_diaria", label: "Puntuación Vida Diaria", type: "number", readonly: true },
      { id: "puntuacion_socializacion", label: "Puntuación Socialización", type: "number", readonly: true },
      { id: "indice_conducta_adaptativa", label: "Índice Global de Conducta Adaptativa", type: "number", readonly: true },
      { id: "analisis_vineland_ia", label: "Análisis Integral IA", type: "textarea", aiGenerated: true },
      { id: "areas_fortaleza", label: "Áreas de Fortaleza", type: "textarea", aiGenerated: true },
      { id: "areas_prioridad", label: "Áreas Prioritarias de Intervención", type: "textarea", aiGenerated: true },
      { id: "informe_padres_vineland", label: "Informe para Padres", type: "textarea", aiGenerated: true },
    ]
  }
]

export const WISCV_DATA = [
  {
    title: "1. Información de la Evaluación",
    icon: <Brain size={20}/>,
    questions: [
      { id: "fecha_eval_wisc", label: "Fecha de evaluación", type: "date", required: true },
      { id: "evaluador_wisc", label: "Psicólogo evaluador", type: "text", required: true },
      { id: "edad_cronologica", label: "Edad cronológica (años, meses)", type: "text", placeholder: "Ej: 7 años, 3 meses" },
      { id: "motivo_eval_cognitiva", label: "Motivo de evaluación", type: "textarea" },
    ]
  },
  {
    title: "2. Índice de Comprensión Verbal (ICV)",
    description: "Razonamiento verbal, formación de conceptos",
    icon: <MessageCircle size={20}/>,
    questions: [
      { id: "icv_semejanzas", label: "Semejanzas - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "icv_vocabulario", label: "Vocabulario - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "icv_informacion", label: "Información - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "icv_comprension", label: "Comprensión - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "icv_total", label: "ICV Total", type: "number", readonly: true },
      { id: "icv_percentil", label: "Percentil ICV", type: "number", readonly: true },
      { id: "icv_notas", label: "Observaciones ICV", type: "textarea" },
    ]
  },
  {
    title: "3. Índice Visoespacial (IVE)",
    description: "Razonamiento espacial y visual",
    icon: <Eye size={20}/>,
    questions: [
      { id: "ive_cubos", label: "Cubos - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "ive_puzles", label: "Puzles visuales - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "ive_total", label: "IVE Total", type: "number", readonly: true },
      { id: "ive_percentil", label: "Percentil IVE", type: "number", readonly: true },
      { id: "ive_notas", label: "Observaciones IVE", type: "textarea" },
    ]
  },
  {
    title: "4. Índice de Razonamiento Fluido (IRF)",
    description: "Razonamiento lógico y solución de problemas",
    icon: <Target size={20}/>,
    questions: [
      { id: "irf_matrices", label: "Matrices - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "irf_balanzas", label: "Balanzas - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "irf_aritmetica", label: "Aritmética - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "irf_total", label: "IRF Total", type: "number", readonly: true },
      { id: "irf_percentil", label: "Percentil IRF", type: "number", readonly: true },
      { id: "irf_notas", label: "Observaciones IRF", type: "textarea" },
    ]
  },
  {
    title: "5. Índice de Memoria de Trabajo (IMT)",
    description: "Memoria auditiva a corto plazo",
    icon: <Brain size={20}/>,
    questions: [
      { id: "imt_digitos", label: "Dígitos - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "imt_imagenes", label: "Span de imágenes - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "imt_total", label: "IMT Total", type: "number", readonly: true },
      { id: "imt_percentil", label: "Percentil IMT", type: "number", readonly: true },
      { id: "imt_notas", label: "Observaciones IMT", type: "textarea" },
    ]
  },
  {
    title: "6. Índice de Velocidad de Procesamiento (IVP)",
    description: "Velocidad y precisión perceptiva",
    icon: <Activity size={20}/>,
    questions: [
      { id: "ivp_claves", label: "Claves - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "ivp_busqueda", label: "Búsqueda de símbolos - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "ivp_cancelacion", label: "Cancelación - Puntuación escalar", type: "number", min: 1, max: 19 },
      { id: "ivp_total", label: "IVP Total", type: "number", readonly: true },
      { id: "ivp_percentil", label: "Percentil IVP", type: "number", readonly: true },
      { id: "ivp_notas", label: "Observaciones IVP", type: "textarea" },
    ]
  },
  {
    title: "7. Análisis Cognitivo Integral (IA)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "ci_total", label: "CI Total (Escala Completa)", type: "number", min: 40, max: 160, readonly: true },
      { id: "ci_percentil", label: "Percentil CI Total", type: "number", readonly: true },
      { id: "clasificacion_ci", label: "Clasificación Descriptiva", type: "text", readonly: true },
      { id: "perfil_cognitivo_ia", label: "Análisis del Perfil Cognitivo", type: "textarea", aiGenerated: true },
      { id: "fortalezas_debilidades", label: "Fortalezas y Debilidades", type: "textarea", aiGenerated: true },
      { id: "implicaciones_educativas", label: "Implicaciones Educativas", type: "textarea", aiGenerated: true },
      { id: "recomendaciones_cognitivas", label: "Recomendaciones Específicas", type: "textarea", aiGenerated: true },
      { id: "informe_padres_wisc", label: "Informe para Padres", type: "textarea", aiGenerated: true },
    ]
  }
]

export const BASC3_DATA = [
  {
    title: "1. Información de la Evaluación",
    icon: <Activity size={20}/>,
    questions: [
      { id: "fecha_eval_basc", label: "Fecha de evaluación", type: "date", required: true },
      { id: "informante_basc", label: "Informante", type: "select", options: ["Padre", "Madre", "Ambos", "Maestro", "Autoevaluación"] },
      { id: "forma_basc", label: "Forma aplicada", type: "select", options: ["Preescolar (2-5 años)", "Niños (6-11 años)", "Adolescentes (12-21 años)"] },
    ]
  },
  {
    title: "2. Escalas Clínicas - Problemas Externalizantes",
    description: "Conductas dirigidas hacia el exterior",
    icon: <Activity size={20}/>,
    questions: [
      { id: "basc_hiperactividad", label: "Hiperactividad", type: "range", min: 1, max: 5, labels: ["Nunca", "Rara vez", "A veces", "Frecuente", "Muy frecuente"] },
      { id: "basc_agresion", label: "Agresión", type: "range", min: 1, max: 5, labels: ["Nunca", "Rara vez", "A veces", "Frecuente", "Muy frecuente"] },
      { id: "basc_problemas_conducta", label: "Problemas de conducta", type: "range", min: 1, max: 5, labels: ["Nunca", "Rara vez", "A veces", "Frecuente", "Muy frecuente"] },
      { id: "basc_notas_extern", label: "Observaciones externalizantes", type: "textarea" },
    ]
  },
  {
    title: "3. Escalas Clínicas - Problemas Internalizantes",
    description: "Conductas dirigidas hacia adentro",
    icon: <Heart size={20}/>,
    questions: [
      { id: "basc_ansiedad", label: "Ansiedad", type: "range", min: 1, max: 5, labels: ["Nunca", "Rara vez", "A veces", "Frecuente", "Muy frecuente"] },
      { id: "basc_depresion", label: "Depresión", type: "range", min: 1, max: 5, labels: ["Nunca", "Rara vez", "A veces", "Frecuente", "Muy frecuente"] },
      { id: "basc_somatizacion", label: "Somatización", type: "range", min: 1, max: 5, labels: ["Nunca", "Rara vez", "A veces", "Frecuente", "Muy frecuente"] },
      { id: "basc_notas_intern", label: "Observaciones internalizantes", type: "textarea" },
    ]
  },
  {
    title: "4. Escalas Adaptativas",
    description: "Habilidades positivas y adaptativas",
    icon: <Activity size={20}/>,
    questions: [
      { id: "basc_habilidades_sociales", label: "Habilidades sociales", type: "range", min: 1, max: 5, labels: ["Muy bajo", "Bajo", "Promedio", "Alto", "Muy alto"] },
      { id: "basc_liderazgo", label: "Liderazgo", type: "range", min: 1, max: 5, labels: ["Muy bajo", "Bajo", "Promedio", "Alto", "Muy alto"] },
      { id: "basc_habilidades_estudio", label: "Habilidades de estudio", type: "range", min: 1, max: 5, labels: ["Muy bajo", "Bajo", "Promedio", "Alto", "Muy alto"] },
      { id: "basc_adaptabilidad", label: "Adaptabilidad", type: "range", min: 1, max: 5, labels: ["Muy bajo", "Bajo", "Promedio", "Alto", "Muy alto"] },
      { id: "basc_notas_adapt", label: "Observaciones adaptativas", type: "textarea" },
    ]
  },
  {
    title: "5. Análisis Conductual Integral (IA)",
    icon: <Sparkles size={20}/>,
    hasIA: true,
    questions: [
      { id: "indice_sintomas_conductuales", label: "Índice de Síntomas Conductuales", type: "number", readonly: true },
      { id: "perfil_riesgo", label: "Perfil de Riesgo", type: "text", readonly: true },
      { id: "analisis_basc_ia", label: "Análisis Conductual IA", type: "textarea", aiGenerated: true },
      { id: "areas_preocupacion", label: "Áreas de Preocupación", type: "textarea", aiGenerated: true },
      { id: "fortalezas_conductuales", label: "Fortalezas Conductuales", type: "textarea", aiGenerated: true },
      { id: "plan_intervencion_conductual", label: "Plan de Intervención", type: "textarea", aiGenerated: true },
      { id: "informe_padres_basc", label: "Informe para Padres", type: "textarea", aiGenerated: true },
    ]
  }
]
