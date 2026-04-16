// app/api/generate-report/route.ts
// ============================================================================
// API: Generador de Reportes Clínicos Profesionales
// Nivel neuropsicólogo especializado — formato DOCX estructurado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getLangInstruction, getDocLabels } from '@/lib/lang'
import { buildAIContext } from '@/lib/ai-context-builder'

// ── Helper: parseo robusto de nivel_logro → número 0-100 ─────────────────────
function parseNivelLogroReport(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Math.min(100, Math.max(0, Math.round(val)))
  const s = String(val).trim()
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const num = s.match(/(\d+)/)
  if (num) return Math.min(100, Math.max(0, parseInt(num[1])))
  const lower = s.toLowerCase()
  if (lower.includes('completamente') || lower.includes('independiente') || lower.includes('dominado')) return 90
  if (lower.includes('mayormente') || lower.includes('alto') || lower.includes('excelente')) return 75
  if (lower.includes('parcialmente') || lower.includes('medio') || lower.includes('proceso')) return 50
  if (lower.includes('mínimo') || lower.includes('bajo') || lower.includes('emergente')) return 20
  if (lower.includes('no logrado') || lower.includes('sin respuesta')) return 5
  return null
}

// ── Tipos de reporte y sus configuraciones ──────────────────────────────────
const REPORTE_CONFIG: Record<string, {
  titulo: string
  subtitulo: string
  secciones: string[]
  instrucciones: string
}> = {
  aba: {
    titulo: 'INFORME DE SESIÓN — INTERVENCIÓN ABA',
    subtitulo: 'Análisis de Conducta Aplicado',
    secciones: [
      'DATOS DE IDENTIFICACIÓN',
      'OBJETIVO(S) DE LA SESIÓN',
      'DESCRIPCIÓN DEL PROCEDIMIENTO',
      'REGISTRO DE CONDUCTAS OBSERVADAS',
      'ANÁLISIS CLÍNICO',
      'NIVEL DE LOGRO Y CRITERIO DE DOMINIO',
      'RECOMENDACIONES PARA LA PRÓXIMA SESIÓN',
      'RECOMENDACIONES PARA EL HOGAR',
    ],
    instrucciones: `Eres un analista de conducta certificado (BCBA) con especialidad en TEA y TDAH.
Genera el informe de sesión ABA con lenguaje técnico pero comprensible.
Incluye: descripción conductual precisa, análisis funcional breve, nivel de logro con porcentaje exacto, técnicas ABA utilizadas (reforzamiento, moldeamiento, encadenamiento, etc.), 
análisis de la curva de aprendizaje y recomendaciones basadas en evidencia.
Usa terminología del DSM-5-TR y principios de Malott/Cooper/Heron.`,
  },

  anamnesis: {
    titulo: 'HISTORIA CLÍNICA NEUROPSICOLÓGICA',
    subtitulo: 'Evaluación Inicial — Anamnesis Completa',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN Y REFERENCIA',
      'II. MOTIVO DE CONSULTA',
      'III. HISTORIA DEL DESARROLLO',
      'IV. ANTECEDENTES MÉDICOS Y FAMILIARES',
      'V. ÁREA COGNITIVA Y ACADÉMICA',
      'VI. ÁREA COMUNICATIVA Y LENGUAJE',
      'VII. ÁREA SOCIAL Y CONDUCTUAL',
      'VIII. ÁREA SENSORIOMOTORA',
      'IX. DINÁMICA FAMILIAR Y ENTORNO',
      'X. IMPRESIÓN DIAGNÓSTICA PRELIMINAR',
      'XI. PLAN DE INTERVENCIÓN PROPUESTO',
    ],
    instrucciones: `Eres una neuropsicóloga infantil con especialidad en TEA, TDAH y trastornos del neurodesarrollo.
Redacta una historia clínica completa con rigor científico. 
Usa los criterios del DSM-5-TR para la impresión diagnóstica.
El lenguaje debe ser clínico y profesional, adecuado para derivación médica o informe judicial.
Estructura clara con cada sección bien delimitada. Incluye fortalezas del paciente, no solo dificultades.`,
  },

  entorno_hogar: {
    titulo: 'INFORME DE EVALUACIÓN DEL ENTORNO FAMILIAR',
    subtitulo: 'Evaluación Funcional del Contexto Hogar',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. OBJETIVOS DE LA EVALUACIÓN',
      'III. ESTRUCTURA Y DINÁMICA FAMILIAR',
      'IV. ENTORNO FÍSICO Y ESTIMULACIÓN',
      'V. RUTINAS Y ORGANIZACIÓN DIARIA',
      'VI. MANEJO CONDUCTUAL EN CASA',
      'VII. PARTICIPACIÓN EN TAREAS TERAPÉUTICAS',
      'VIII. FORTALEZAS Y RECURSOS FAMILIARES',
      'IX. ÁREAS DE MEJORA',
      'X. RECOMENDACIONES PARA LA FAMILIA',
    ],
    instrucciones: `Eres una terapeuta familiar y neuropsicóloga especializada en neurodesarrollo.
Redacta un informe del entorno del hogar con enfoque sistémico y orientado a fortalezas.
Incluye análisis del entorno físico, rutinas, estrategias de manejo conductual y calidad del vínculo.
Las recomendaciones deben ser prácticas, específicas y basadas en evidencia ABA/EIBI.`,
  },

  brief2: {
    titulo: 'INFORME DE EVALUACIÓN — BRIEF-2',
    subtitulo: 'Behavior Rating Inventory of Executive Function, 2nd Edition',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. INSTRUMENTOS UTILIZADOS',
      'IV. RESULTADOS POR ÍNDICE Y ESCALA',
      'V. PERFIL DE FUNCIONES EJECUTIVAS',
      'VI. ANÁLISIS CLÍNICO DE RESULTADOS',
      'VII. IMPLICANCIAS FUNCIONALES',
      'VIII. DIAGNÓSTICO DIFERENCIAL',
      'IX. RECOMENDACIONES',
    ],
    instrucciones: `Eres neuropsicóloga especializada en evaluación de funciones ejecutivas.
Genera un informe profesional del BRIEF-2. Explica cada índice (BRI, ERI, CRI, GEC) con puntajes T y percentiles.
Describe las implicancias en el funcionamiento cotidiano y académico.
Conecta los resultados con el diagnóstico de base (TEA, TDAH, etc.) según el DSM-5-TR.
Incluye recomendaciones diferenciadas para el hogar, el colegio y la terapia.`,
  },

  ados2: {
    titulo: 'INFORME DE EVALUACIÓN — ADOS-2',
    subtitulo: 'Autism Diagnostic Observation Schedule, 2nd Edition',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. MÓDULO APLICADO Y JUSTIFICACIÓN',
      'IV. CONDUCTA DURANTE LA EVALUACIÓN',
      'V. RESULTADOS POR DOMINIO',
      'VI. PUNTUACIÓN TOTAL Y CLASIFICACIÓN',
      'VII. ANÁLISIS CLÍNICO',
      'VIII. CONSIDERACIONES DIAGNÓSTICAS (DSM-5-TR)',
      'IX. FORTALEZAS OBSERVADAS',
      'X. RECOMENDACIONES',
    ],
    instrucciones: `Eres neuropsicóloga certificada en la administración e interpretación del ADOS-2.
Redacta un informe diagnóstico completo. Detalla el módulo utilizado, los algoritmos aplicados,
los puntajes de comunicación social y conductas restringidas/repetitivas.
Incluye nivel de funcionamiento, fortalezas y perfiles clínicos.
Usa criterios A y B del TEA según DSM-5-TR. El lenguaje debe soportar derivación interdisciplinaria.`,
  },

  vineland3: {
    titulo: 'INFORME DE EVALUACIÓN — VINELAND-3',
    subtitulo: 'Vineland Adaptive Behavior Scales, Third Edition',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. DESCRIPCIÓN DEL INSTRUMENTO',
      'IV. RESULTADOS POR DOMINIO',
      'V. COMPOSITE DE CONDUCTA ADAPTATIVA (ABC)',
      'VI. NIVEL DE FUNCIONAMIENTO ADAPTATIVO',
      'VII. ANÁLISIS CLÍNICO',
      'VIII. IMPLICANCIAS EN LA VIDA DIARIA',
      'IX. RECOMENDACIONES',
    ],
    instrucciones: `Eres neuropsicóloga especializada en evaluación de conducta adaptativa.
Redacta el informe Vineland-3 con puntajes estándar, percentiles y niveles adaptativos por dominio
(Comunicación, Vida Diaria, Socialización, Habilidades Motoras).
Conecta los resultados con el diagnóstico y el funcionamiento real del niño.
Incluye fortalezas adaptativas y áreas de desarrollo prioritario para la intervención.`,
  },

  wiscv: {
    titulo: 'INFORME DE EVALUACIÓN COGNITIVA — WISC-V',
    subtitulo: 'Wechsler Intelligence Scale for Children, Fifth Edition',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. DESCRIPCIÓN DEL INSTRUMENTO',
      'IV. OBSERVACIONES CONDUCTUALES DURANTE LA EVALUACIÓN',
      'V. RESULTADOS: ÍNDICES PRIMARIOS',
      'VI. RESULTADOS: ÍNDICES COMPLEMENTARIOS',
      'VII. COEFICIENTE INTELECTUAL TOTAL (CIT)',
      'VIII. ANÁLISIS DEL PERFIL COGNITIVO',
      'IX. FORTALEZAS Y DEBILIDADES NEUROCOGNITIVAS',
      'X. DIAGNÓSTICO DIFERENCIAL',
      'XI. RECOMENDACIONES',
    ],
    instrucciones: `Eres neuropsicóloga especializada en evaluación cognitiva infantil.
Genera un informe WISC-V completo con todos los índices: ICV, IVP, IRT, IMT, IFE y CIT.
Incluye puntajes escalares, puntajes compuestos, percentiles y clasificaciones descriptivas.
Analiza el perfil de fortalezas y debilidades intraindividuales. 
Conecta el perfil cognitivo con las necesidades educativas y terapéuticas del niño.
Usa lenguaje accesible para padres en las conclusiones, pero técnico en el cuerpo del informe.`,
  },

  basc3: {
    titulo: 'INFORME DE EVALUACIÓN CONDUCTUAL Y EMOCIONAL — BASC-3',
    subtitulo: 'Behavior Assessment System for Children, Third Edition',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. FUENTES DE INFORMACIÓN',
      'IV. ESCALAS DE EXTERNALIZACIÓN',
      'V. ESCALAS DE INTERNALIZACIÓN',
      'VI. ÍNDICE DE SÍNTOMAS COMPORTAMENTALES (BSI)',
      'VII. ESCALAS ADAPTATIVAS',
      'VIII. ÍNDICES DE VALIDEZ',
      'IX. ANÁLISIS CLÍNICO INTEGRADO',
      'X. IMPLICANCIAS DIAGNÓSTICAS',
      'XI. RECOMENDACIONES DIFERENCIADAS',
    ],
    instrucciones: `Eres neuropsicóloga especializada en evaluación conductual y emocional infantil.
Redacta el informe BASC-3 con puntajes T por escala, categorías clínicas y descripción funcional.
Analiza el perfil de escalas de externalización (hiperactividad, agresividad, conducta disruptiva),
internalización (ansiedad, depresión, somatización) y escalas adaptativas.
Conecta los resultados con el diagnóstico de base y las necesidades de intervención.
Diferencia recomendaciones para hogar, colegio y clínica.`,
  },

  // ── Formularios NeuroForma ────────────────────────────────────────────────
  screening_tdah: {
    titulo: 'INFORME DE SCREENING — TDAH (Conners Adaptado)',
    subtitulo: 'Evaluación de síntomas de inatención e hiperactividad',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. SÍNTOMAS DE INATENCIÓN',
      'IV. SÍNTOMAS DE HIPERACTIVIDAD E IMPULSIVIDAD',
      'V. RESULTADOS DEL SCREENING',
      'VI. IMPACTO FUNCIONAL',
      'VII. ORIENTACIÓN DIAGNÓSTICA Y PRÓXIMOS PASOS',
    ],
    instrucciones: `Eres neuropsicólogo infantil especializado en TDAH. Analiza los resultados del screening Conners adaptado.
Usa criterios del DSM-5-TR para TDAH (presentación inatenta, hiperactiva-impulsiva o combinada).
Incluye intensidad de síntomas, áreas de impacto (académico, social, hogar) y recomendaciones de derivación.
Lenguaje técnico pero accesible para padres y médicos derivantes.`,
  },

  conducta_casa_tdah: {
    titulo: 'INFORME — CONDUCTA EN CASA (TDAH)',
    subtitulo: 'Informe parental de conductas en el entorno doméstico',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. SÍNTOMAS OBSERVADOS EN EL HOGAR',
      'III. RUTINAS Y ESTRUCTURA DIARIA',
      'IV. MANEJO PARENTAL ACTUAL',
      'V. ANÁLISIS CLÍNICO',
      'VI. RECOMENDACIONES PARA EL HOGAR',
    ],
    instrucciones: `Eres terapeuta ABA y psicólogo infantil especializado en TDAH.
Analiza el reporte de los padres sobre conductas en el hogar. Identifica patrones, factores ambientales y estrategias de manejo.
Sugiere modificaciones ambientales y estrategias conductuales basadas en evidencia para el hogar.
Lenguaje empático y práctico para las familias.`,
  },

  screening_tea: {
    titulo: 'INFORME DE SCREENING — TEA (M-CHAT-R/F Adaptado)',
    subtitulo: 'Detección temprana del espectro autista',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. MOTIVO DE EVALUACIÓN',
      'III. INDICADORES DE COMUNICACIÓN SOCIAL',
      'IV. INDICADORES DE CONDUCTAS RESTRINGIDAS Y REPETITIVAS',
      'V. RESULTADO DEL SCREENING',
      'VI. NIVEL DE RIESGO Y RECOMENDACIONES',
      'VII. PRÓXIMOS PASOS',
    ],
    instrucciones: `Eres neuropsicólogo especializado en TEA y diagnóstico temprano.
Analiza los resultados del M-CHAT-R/F adaptado. Clasifica el nivel de riesgo (bajo, medio, alto).
Usa criterios del DSM-5-TR para TEA (dominios A y B). Indica si se requiere evaluación diagnóstica completa.
Lenguaje claro para padres, con enfoque en la importancia de la detección temprana.`,
  },

  conducta_casa_tea: {
    titulo: 'INFORME — MI HIJO EN CASA (TEA)',
    subtitulo: 'Reporte familiar del día a día en el hogar',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. RUTINAS Y ESTRUCTURA DIARIA',
      'III. COMUNICACIÓN Y SOCIALIZACIÓN EN CASA',
      'IV. CONDUCTAS REPETITIVAS Y SENSORIALIDAD',
      'V. FORTALEZAS OBSERVADAS',
      'VI. ANÁLISIS CLÍNICO',
      'VII. ESTRATEGIAS RECOMENDADAS PARA EL HOGAR',
    ],
    instrucciones: `Eres terapeuta ABA y psicólogo infantil especializado en TEA.
Analiza el reporte parental del funcionamiento diario. Identifica fortalezas, rutinas efectivas y áreas de desafío.
Proporciona estrategias concretas y visuales basadas en ABA y EIBI para implementar en casa.
Lenguaje cálido y empático, orientado a empoderar a la familia.`,
  },

  perfil_sensorial: {
    titulo: 'INFORME DE PERFIL SENSORIAL',
    subtitulo: 'Evaluación de integración sensorial (Dunn adaptado)',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. DESCRIPCIÓN DEL INSTRUMENTO',
      'III. PERFIL POR SISTEMA SENSORIAL',
      'IV. PATRONES DE PROCESAMIENTO',
      'V. IMPACTO EN EL FUNCIONAMIENTO DIARIO',
      'VI. RECOMENDACIONES DE INTEGRACIÓN SENSORIAL',
    ],
    instrucciones: `Eres terapeuta ocupacional y neuropsicólogo especializado en procesamiento sensorial (Modelo de Dunn).
Analiza el perfil sensorial: sistemas táctil, propioceptivo, vestibular, auditivo, visual, gustativo/olfativo.
Identifica patrones (registro bajo, sensibilidad, evitación, búsqueda sensorial).
Proporciona recomendaciones de integración sensorial para el hogar, colegio y terapia.`,
  },

  habilidades_sociales: {
    titulo: 'INFORME DE EVALUACIÓN DE HABILIDADES SOCIALES',
    subtitulo: 'Inventario de competencias sociales y comunicativas',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. COMUNICACIÓN VERBAL Y NO VERBAL',
      'III. INTERACCIÓN CON PARES',
      'IV. HABILIDADES DE JUEGO',
      'V. REGULACIÓN EMOCIONAL Y SOCIAL',
      'VI. FORTALEZAS SOCIALES',
      'VII. OBJETIVOS Y RECOMENDACIONES',
    ],
    instrucciones: `Eres psicólogo infantil y especialista en habilidades sociales y TEA/TDAH.
Analiza las competencias sociales del niño. Identifica fortalezas y áreas de desarrollo.
Usa marco de referencia de comunicación social del DSM-5-TR.
Proporciona objetivos concretos y técnicas para el entrenamiento en habilidades sociales.`,
  },

  informe_padres_general: {
    titulo: 'INFORME SEMANAL DE PROGRESO',
    subtitulo: 'Reporte parental — ¿Cómo está mi hijo esta semana?',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. CONDUCTA Y ESTADO EMOCIONAL',
      'III. PROGRESO EN OBJETIVOS TERAPÉUTICOS',
      'IV. SITUACIONES DESTACADAS DE LA SEMANA',
      'V. ANÁLISIS CLÍNICO',
      'VI. RECOMENDACIONES PARA LA PRÓXIMA SEMANA',
    ],
    instrucciones: `Eres terapeuta ABA y psicólogo infantil. Analiza el reporte semanal de los padres.
Conecta las observaciones parentales con los objetivos terapéuticos en curso.
Identifica avances, retrocesos y situaciones que requieren atención clínica.
Proporciona retroalimentación práctica y motivadora para la familia.`,
  },

  historia_familiar: {
    titulo: 'HISTORIA FAMILIAR Y DEL DESARROLLO',
    subtitulo: 'Anamnesis familiar — Formulario inicial',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN FAMILIAR',
      'II. HISTORIA DEL DESARROLLO',
      'III. ANTECEDENTES MÉDICOS Y FAMILIARES',
      'IV. DINÁMICA FAMILIAR',
      'V. RECURSOS Y FORTALEZAS FAMILIARES',
      'VI. IMPRESIÓN INICIAL',
      'VII. PLAN DE INTERVENCIÓN PROPUESTO',
    ],
    instrucciones: `Eres psicólogo clínico infantil y terapeuta familiar.
Analiza la historia familiar y del desarrollo con enfoque sistémico.
Identifica factores de riesgo y protectores, dinámica familiar, recursos disponibles.
Elabora una impresión inicial clínica y propuesta de intervención con enfoque en fortalezas.`,
  },

  fba: {
    titulo: 'EVALUACIÓN FUNCIONAL DE CONDUCTA (FBA)',
    subtitulo: 'Análisis de la función de conductas problemáticas',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. DEFINICIÓN OPERACIONAL DE LA CONDUCTA',
      'III. RECOPILACIÓN DE DATOS (ABC)',
      'IV. HIPÓTESIS FUNCIONAL',
      'V. FACTORES AMBIENTALES',
      'VI. ANÁLISIS FUNCIONAL',
      'VII. IMPLICACIONES PARA LA INTERVENCIÓN',
    ],
    instrucciones: `Eres BCBA (Board Certified Behavior Analyst) con especialidad en análisis funcional.
Redacta una FBA completa con rigor científico. Incluye definición operacional, datos ABC, hipótesis funcionales.
Identifica la función de la conducta (atención, acceso a tangibles, escape, automáticas).
Usa terminología ABA estándar (Cooper, Heron y Heward). El informe debe fundamentar el BIP.`,
  },

  bip: {
    titulo: 'PLAN DE INTERVENCIÓN CONDUCTUAL (BIP)',
    subtitulo: 'Diseño de intervención basado en análisis funcional',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. RESUMEN DE LA FBA',
      'III. CONDUCTAS OBJETIVO',
      'IV. ESTRATEGIAS ANTECEDENTES',
      'V. ESTRATEGIAS DE ENSEÑANZA DE CONDUCTAS ALTERNATIVAS',
      'VI. ESTRATEGIAS DE CONSECUENCIAS',
      'VII. PROTOCOLO DE CRISIS',
      'VIII. PLAN DE GENERALIZACIÓN',
      'IX. MONITOREO Y EVALUACIÓN',
    ],
    instrucciones: `Eres BCBA especializado en diseño de planes de intervención conductual.
Diseña un BIP completo basado en análisis funcional. Incluye estrategias antecedentes, de enseñanza y consecuentes.
Especifica conductas de reemplazo (CRF), programas de reforzamiento diferencial y protocolos de crisis.
El plan debe ser implementable por terapeutas, padres y docentes con instrucciones claras.`,
  },

  iep: {
    titulo: 'PLAN DE INTERVENCIÓN INDIVIDUAL (PII/IEP)',
    subtitulo: 'Objetivos funcionales anuales con métricas de progreso',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. NIVELES DE DESEMPEÑO ACTUAL',
      'III. OBJETIVOS ANUALES',
      'IV. SERVICIOS Y APOYOS',
      'V. ADAPTACIONES Y MODIFICACIONES',
      'VI. CRITERIOS DE EVALUACIÓN',
      'VII. PARTICIPACIÓN EN ENTORNOS INCLUSIVOS',
    ],
    instrucciones: `Eres especialista en educación especial y terapeuta ABA.
Redacta un PII/IEP completo con objetivos SMART (específicos, medibles, alcanzables, relevantes, temporales).
Incluye niveles actuales de desempeño, objetivos funcionales por área, criterios de dominio y métodos de evaluación.
Lenguaje técnico-educativo. Cada objetivo debe incluir condición, conducta y criterio.`,
  },

  lenguaje_verbal: {
    titulo: 'EVALUACIÓN DE CONDUCTA VERBAL (VB-MAPP Adaptado)',
    subtitulo: 'Perfil de habilidades de lenguaje y comunicación',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. DESCRIPCIÓN DEL INSTRUMENTO',
      'III. OPERANTES VERBALES EVALUADOS',
      'IV. RESULTADOS POR MILESTONE',
      'V. BARRERAS AL APRENDIZAJE',
      'VI. PERFIL DE COMUNICACIÓN',
      'VII. OBJETIVOS Y PLAN DE INTERVENCIÓN',
    ],
    instrucciones: `Eres especialista en conducta verbal y comunicación aumentativa/alternativa (CAA).
Analiza el perfil VB-MAPP. Evalúa operantes verbales: mando, tacto, ecoico, intraverbal, oyente, lector/escritor.
Identifica el nivel (1-3), barreras al aprendizaje y necesidades de CAA.
Usa terminología de Skinner (Verbal Behavior) y recomienda objetivos priorizados por función comunicativa.`,
  },

  informe_mensual_prog: {
    titulo: 'INFORME DE PROGRESO MENSUAL',
    subtitulo: 'Reporte clínico de avances — Mes en curso',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. RESUMEN EJECUTIVO DEL MES',
      'III. PROGRESO POR PROGRAMA',
      'IV. INDICADORES CONDUCTUALES',
      'V. ANÁLISIS DE TENDENCIAS',
      'VI. AJUSTES AL PLAN',
      'VII. OBJETIVOS PARA EL PRÓXIMO MES',
    ],
    instrucciones: `Eres supervisor ABA (BCBA) redactando el informe mensual de progreso.
Sintetiza los avances, dificultades y tendencias del mes. Compara con objetivos planteados.
Analiza datos de forma objetiva (porcentajes, criterios de dominio, curvas de aprendizaje).
Propón ajustes al plan de intervención basados en evidencia. Tono profesional para padres y supervisores.`,
  },

  habilidades_adaptativas: {
    titulo: 'EVALUACIÓN DE HABILIDADES ADAPTATIVAS',
    subtitulo: 'Funcionamiento en vida diaria y autonomía',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. AUTOCUIDADO Y VIDA DIARIA',
      'III. COMUNICACIÓN FUNCIONAL',
      'IV. HABILIDADES DOMÉSTICAS',
      'V. HABILIDADES COMUNITARIAS',
      'VI. SALUD Y SEGURIDAD',
      'VII. ANÁLISIS Y RECOMENDACIONES',
    ],
    instrucciones: `Eres neuropsicólogo y terapeuta ocupacional especializado en habilidades adaptativas.
Evalúa el funcionamiento adaptativo en todas las áreas de la vida diaria.
Usa marco de referencia de conducta adaptativa del DSM-5-TR y Vineland-3.
Identifica fortalezas, necesidades de apoyo y objetivos prioritarios para la autonomía.`,
  },

  sensorial_avanzado: {
    titulo: 'PERFIL SENSORIAL AVANZADO',
    subtitulo: 'Evaluación detallada de procesamiento sensorial (Dunn adaptado)',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. SISTEMAS SENSORIALES — ANÁLISIS DETALLADO',
      'III. PATRONES DE MODULACIÓN',
      'IV. IMPACTO EN APRENDIZAJE Y CONDUCTA',
      'V. IMPACTO EN ACTIVIDADES DE VIDA DIARIA',
      'VI. DIETA SENSORIAL RECOMENDADA',
      'VII. ADAPTACIONES AMBIENTALES',
    ],
    instrucciones: `Eres terapeuta ocupacional certificado en integración sensorial y neuropsicólogo.
Analiza el perfil sensorial avanzado de todos los sistemas. Identifica hiposensibilidad, hipersensibilidad y disfunciones.
Diseña una dieta sensorial personalizada con actividades de regulación para hogar, colegio y terapia.
Incluye adaptaciones ambientales específicas y estrategias de calma y activación.`,
  },

  abc_avanzado: {
    titulo: 'REGISTRO ABC AVANZADO + ANÁLISIS FUNCIONAL',
    subtitulo: 'Antecedente → Conducta → Consecuencia con análisis funcional',
    secciones: [
      'I. DATOS DE IDENTIFICACIÓN',
      'II. DEFINICIÓN OPERACIONAL DE LA CONDUCTA',
      'III. ANÁLISIS DE ANTECEDENTES',
      'IV. ANÁLISIS DE LA CONDUCTA',
      'V. ANÁLISIS DE CONSECUENCIAS',
      'VI. HIPÓTESIS FUNCIONAL',
      'VII. RECOMENDACIONES DE INTERVENCIÓN',
    ],
    instrucciones: `Eres BCBA especializado en análisis funcional de conducta.
Analiza el registro ABC avanzado con rigor metodológico. Identifica patrones en antecedentes y consecuentes.
Formula hipótesis funcionales (atención, acceso, escape, automáticas) con justificación en los datos.
Proporciona recomendaciones de intervención directamente derivadas del análisis funcional.`,
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTituloArchivo(tipo: string, nombreNino: string): string {
  const fecha = new Date().toLocaleDateString('es-PE', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).replace(/\//g, '-')
  const nombre = nombreNino.replace(/\s+/g, '_').toUpperCase()
  const tipoUpper = tipo.toUpperCase()
  return `REPORTE_${tipoUpper}_${nombre}_${fecha}.docx`
}

function formatearFechaHoy(): string {
  return new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })
}

// Construir datos del reporte en texto estructurado para la IA
function construirDatosTexto(reportData: any, tipo: string): string {
  if (!reportData) return 'Sin datos adicionales.'

  const lineas: string[] = []

  // Recorrer los datos de forma genérica
  function aplanarObjeto(obj: any, prefijo = '', nivel = 0): void {
    if (nivel > 3) return
    for (const [clave, valor] of Object.entries(obj || {})) {
      if (valor === null || valor === undefined || valor === '') continue
      const nombreClave = clave
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()

      if (typeof valor === 'object' && !Array.isArray(valor)) {
        lineas.push(`${prefijo}${nombreClave.toUpperCase()}:`)
        aplanarObjeto(valor, prefijo + '  ', nivel + 1)
      } else if (Array.isArray(valor)) {
        if (valor.length > 0) {
          lineas.push(`${prefijo}${nombreClave}: ${valor.join(', ')}`)
        }
      } else {
        lineas.push(`${prefijo}${nombreClave}: ${valor}`)
      }
    }
  }

  aplanarObjeto(reportData)
  return lineas.join('\n')
}

// ── Generar contenido del reporte con IA ─────────────────────────────────────
async function generarContenidoReporte(
  tipo: string,
  childName: string,
  childAge: number | undefined,
  reportData: any,
  contextoClinico: string
, userLocale = 'es'): Promise<string> {
  const config = REPORTE_CONFIG[tipo] || REPORTE_CONFIG.aba
  const datosTexto = construirDatosTexto(reportData, tipo)
  const edadTexto = childAge ? `${childAge} años` : 'edad no especificada'
  const fechaHoy = formatearFechaHoy()

  const systemPrompt = `${config.instrucciones}

REGLAS DE FORMATO DEL INFORME:
- Redacta el informe completo en español clínico peruano
- Cada sección debe iniciar exactamente con su número romano y nombre: "I. NOMBRE DE SECCIÓN"
- Usa párrafos completos con texto fluido. NO uses bullets excesivos en el cuerpo narrativo
- Para listas de recomendaciones usa guiones: "- recomendación"
- Para resaltar términos importantes usa **negrita** (doble asterisco)
- NO uses ### ni ## ni # para títulos — usa los números romanos indicados
- NO uses bloques de código ni triple backtick
- El tono es profesional, empático y orientado a fortalezas
- Incluye siempre el nombre del paciente en las secciones narrativas
- Las conclusiones deben ser accionables y específicas
- Extensión mínima: 700 palabras para mantener profundidad clínica
- Fecha del informe: ${fechaHoy}

SECCIONES A DESARROLLAR (usar exactamente este formato para los títulos):
${config.secciones.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`

  const userPrompt = `Genera el informe completo para:

PACIENTE: ${childName}
EDAD: ${edadTexto}
TIPO DE EVALUACIÓN: ${config.titulo}
FECHA: ${fechaHoy}

DATOS DE LA EVALUACIÓN/SESIÓN:
${datosTexto}

HISTORIAL CLÍNICO PREVIO:
${contextoClinico || 'Sin historial previo disponible.'}

Redacta el informe completo con TODAS las secciones indicadas. Usa EXACTAMENTE el formato de título de sección:
"I. NOMBRE DE LA SECCIÓN" (número romano + punto + espacio + nombre en mayúsculas).
Sé específico con los datos proporcionados. Si algún dato no está disponible, indica "Pendiente de evaluación".
El informe debe poder entregarse directamente a padres, médicos o colegios sin edición adicional.
Usa **negrita** para resaltar diagnósticos, puntajes clave y conclusiones importantes.`

  const contenido = await callGroqSimple(systemPrompt + getLangInstruction(userLocale),userPrompt, {
    model: GROQ_MODELS.SMART,
    temperature: 0.25, // Baja temperatura para mayor precisión clínica
    maxTokens: 3000,
  })

  return contenido
}

// ── Generar DOCX en base64 ───────────────────────────────────────────────────
async function generarDocx(
  tipo: string,
  childName: string,
  childAge: number | undefined,
  contenidoReporte: string,
  locale = 'es'
): Promise<string> {
  const config = REPORTE_CONFIG[tipo] || REPORTE_CONFIG.aba
  const fechaHoy = formatearFechaHoy()
  const labels = getDocLabels('es')

  // Importar docx dinámicamente
  const docx = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    BorderStyle, TableRow, TableCell, Table, WidthType, ShadingType,
    PageBreak, Header, Footer, PageNumber, NumberFormat, ExternalHyperlink } = docx

  // ── Estilos de colores clínicos ──
  const COLOR_PRIMARIO   = '1B3A6B'  // Azul marino profesional
  const COLOR_SECUNDARIO = '2E86AB'  // Azul medio
  const COLOR_ACENTO     = '0D7377'  // Verde teal
  const COLOR_GRIS       = '6B7280'  // Gris texto
  const COLOR_FONDO      = 'EEF2FF'  // Fondo sección

  // ── Parsear el contenido generado por IA ──
  const lineas = contenidoReporte.split('\n').filter(l => l.trim())

  const children: any[] = []

  // ── PORTADA ──────────────────────────────────────────────────────────────
  // Logo/Cabecera institucional
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '▮ VANTY',
          bold: true,
          size: 28,
          color: COLOR_PRIMARIO,
          font: 'Calibri',
        }),
        new TextRun({
          text: '  |  Centro de Neuropsicología Infantil',
          size: 20,
          color: COLOR_GRIS,
          font: 'Calibri',
        }),
      ],
      spacing: { after: 200 },
    }),
    // Línea divisoria
    new Paragraph({
      border: { bottom: { style: BorderStyle.THICK, size: 6, color: COLOR_PRIMARIO } },
      spacing: { after: 400 },
    }),
    // Título principal
    new Paragraph({
      children: [
        new TextRun({
          text: config.titulo,
          bold: true,
          size: 40,
          color: COLOR_PRIMARIO,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: config.subtitulo,
          size: 24,
          color: COLOR_SECUNDARIO,
          italics: true,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    }),
    // Datos del paciente en tabla
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top:    { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left:   { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right:  { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: COLOR_FONDO },
              children: [new Paragraph({
                children: [new TextRun({ text: labels.patient, bold: true, size: 18, color: COLOR_PRIMARIO, font: 'Calibri' })],
              })],
              width: { size: 30, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: childName, bold: true, size: 20, font: 'Calibri' })],
              })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: COLOR_FONDO },
              children: [new Paragraph({
                children: [new TextRun({ text: labels.age, bold: true, size: 18, color: COLOR_PRIMARIO, font: 'Calibri' })],
              })],
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: childAge ? `${childAge} ${labels.ageUnit}` : labels.notSpecified, size: 18, font: 'Calibri' })],
              })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: COLOR_FONDO },
              children: [new Paragraph({
                children: [new TextRun({ text: labels.reportDate, bold: true, size: 18, color: COLOR_PRIMARIO, font: 'Calibri' })],
              })],
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: fechaHoy, size: 18, font: 'Calibri' })],
              })],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: COLOR_FONDO },
              children: [new Paragraph({
                children: [new TextRun({ text: labels.evaluationType, bold: true, size: 18, color: COLOR_PRIMARIO, font: 'Calibri' })],
              })],
            }),
            new TableCell({
              children: [new Paragraph({
                children: [new TextRun({ text: config.subtitulo, size: 18, font: 'Calibri' })],
              })],
            }),
          ],
        }),
      ],
    }),
    // Salto de página tras portada
    new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } })
  )

  // ── PARSER INLINE: convierte **negrita** e *cursiva* en TextRun array ───────
  function parseInline(text: string, baseSize = 20, baseColor = '374151'): any[] {
    const runs: any[] = []
    // Eliminar markdown restante que no queremos mostrar (###, ##, #)
    const clean = text.replace(/^#{1,6}\s*/, '').trim()
    const regex = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_/g
    let last = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(clean)) !== null) {
      if (match.index > last) {
        runs.push(new TextRun({ text: clean.slice(last, match.index), size: baseSize, font: 'Calibri', color: baseColor }))
      }
      if (match[1]) {
        // ***bold+italic***
        runs.push(new TextRun({ text: match[1], bold: true, italics: true, size: baseSize, font: 'Calibri', color: baseColor }))
      } else if (match[2]) {
        // **bold**
        runs.push(new TextRun({ text: match[2], bold: true, size: baseSize, font: 'Calibri', color: baseColor }))
      } else if (match[3] || match[4]) {
        // *italic* or _italic_
        runs.push(new TextRun({ text: match[3] || match[4], italics: true, size: baseSize, font: 'Calibri', color: baseColor }))
      }
      last = match.index + match[0].length
    }
    if (last < clean.length) {
      runs.push(new TextRun({ text: clean.slice(last), size: baseSize, font: 'Calibri', color: baseColor }))
    }
    return runs.length > 0 ? runs : [new TextRun({ text: clean, size: baseSize, font: 'Calibri', color: baseColor })]
  }

  // ── CUERPO DEL REPORTE ───────────────────────────────────────────────────
  for (const linea of lineas) {
    const trimmed = linea.trim()
    if (!trimmed) {
      children.push(new Paragraph({ spacing: { after: 80 } }))
      continue
    }

    // ── 1. Títulos markdown: ###, ##, # → encabezado de sección
    const mdHeading = trimmed.match(/^(#{1,6})\s+(.+)/)
    // ── 2. Encabezados clásicos tipo "I. NOMBRE", "1. NOMBRE", "SECCIÓN: X"
    const esSeccionNumerada =
      /^(I{1,3}V?|VI{0,3}|IX|X{1,3}|[0-9]+)\.\s+[A-ZÁÉÍÓÚÑ\*]/.test(trimmed) ||
      /^SECCIÓN\s*[:.]?\s*\d*\s*[-.]?\s*[A-ZÁÉÍÓÚÑ]/i.test(trimmed) ||
      /^[IVX]+\.\s+[A-ZÁÉÍÓÚÑ\*]/.test(trimmed)
    // ── 3. Línea en MAYÚSCULAS completa (no muy larga) → subtítulo
    const esTodoMayusculas = trimmed === trimmed.toUpperCase() && trimmed.length > 4 && trimmed.length < 120 && /[A-ZÁÉÍÓÚÑ]{3,}/.test(trimmed) && !trimmed.match(/^\d/)

    if (mdHeading || esSeccionNumerada) {
      const rawText = mdHeading ? mdHeading[2] : trimmed
      // Limpiar posibles ** del texto del título
      const cleanTitle = rawText.replace(/\*\*/g, '').trim().toUpperCase()
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: cleanTitle, bold: true, size: 24, color: COLOR_PRIMARIO, font: 'Calibri' }),
          ],
          heading: HeadingLevel.HEADING_2,
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: COLOR_SECUNDARIO } },
          spacing: { before: 480, after: 200 },
        })
      )
    } else if (esTodoMayusculas && !trimmed.startsWith('•') && !trimmed.startsWith('-')) {
      // Sub-encabezado en mayúsculas
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed.replace(/\*\*/g, ''), bold: true, size: 22, color: COLOR_ACENTO, font: 'Calibri' })],
          spacing: { before: 300, after: 120 },
        })
      )
    } else if (trimmed.startsWith('•') || trimmed.startsWith('–') || (trimmed.startsWith('-') && !trimmed.startsWith('---'))) {
      // Bullet list
      const bulletText = trimmed.replace(/^[•\-–]\s*/, '')
      children.push(
        new Paragraph({
          children: parseInline(bulletText),
          bullet: { level: 0 },
          spacing: { after: 100 },
        })
      )
    } else if (trimmed.match(/^\d+\.\s+\S/) && trimmed.length < 300 && !esSeccionNumerada) {
      // Lista numerada (línea corta que empieza con "1. texto")
      children.push(
        new Paragraph({
          children: parseInline(trimmed),
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { after: 100 },
        })
      )
    } else if (trimmed.endsWith(':') && trimmed.length < 100 && !trimmed.includes('**')) {
      // Sub-label (ej: "Recomendaciones:")
      children.push(
        new Paragraph({
          children: [new TextRun({ text: trimmed, bold: true, size: 21, color: COLOR_ACENTO, font: 'Calibri' })],
          spacing: { before: 240, after: 100 },
        })
      )
    } else if (trimmed.startsWith('---') || trimmed.startsWith('___')) {
      // Separador horizontal → línea
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD' } },
          spacing: { before: 160, after: 160 },
        })
      )
    } else {
      // Párrafo de texto normal — con soporte **bold** inline
      children.push(
        new Paragraph({
          children: parseInline(trimmed),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160 },
        })
      )
    }
  }

  // ── PIE DEL DOCUMENTO ────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 800 }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: COLOR_PRIMARIO } } }),
    new Paragraph({
      children: [
        new TextRun({
          text: labels.footer,
          size: 16,
          italics: true,
          color: COLOR_GRIS,
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `_________________________________\n${childName} — ${fechaHoy}`,
          size: 18,
          font: 'Calibri',
          color: COLOR_PRIMARIO,
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  )

  // ── Crear documento ──────────────────────────────────────────────────────
  const doc = new Document({
    creator: 'Vanty — Plataforma de Neuropsicología Infantil',
    title: `${config.titulo} — ${childName}`,
    description: `Informe clínico generado por Vanty. Paciente: ${childName}. Fecha: ${fechaHoy}`,
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: NumberFormat.DECIMAL,
          text: '%1.',
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `VANTY — ${config.titulo.substring(0, 60)}`,
                  size: 16,
                  color: COLOR_GRIS,
                  font: 'Calibri',
                }),
                new TextRun({
                  text: `\t${childName}`,
                  size: 16,
                  bold: true,
                  color: COLOR_GRIS,
                  font: 'Calibri',
                }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  children: [
                    labels.generated,
                    PageNumber.CURRENT,
                    labels.of,
                    PageNumber.TOTAL_PAGES,
                  ],
                  size: 16,
                  color: COLOR_GRIS,
                  font: 'Calibri',
                }),
              ],
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' } },
            }),
          ],
        }),
      },
      children,
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer).toString('base64')
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userLocale = body.locale || request.headers.get('x-locale') || 'es'
    const {
      reportType,
      childName,
      childAge,
      reportData,
      evaluationId,
    } = body

    if (!reportType || !childName) {
      return NextResponse.json(
        { error: 'reportType y childName son requeridos' },
        { status: 400 }
      )
    }

    if (!REPORTE_CONFIG[reportType]) {
      // Fallback: usar config genérica ABA en vez de bloquear con error 400
      console.warn(`[generate-report] Tipo desconocido: "${reportType}" — usando fallback 'aba'`)
    }

    // 1. Obtener childId desde múltiples fuentes posibles
    const childId = reportData?.child_id || reportData?.childId || body.childId

    // 2. Obtener contexto clínico completo del niño desde la BD
    let contextoClinico = ''
    let datosEnriquecidos = { ...reportData }

    try {
      if (childId) {
        const ctx = await buildAIContext(childId, childName, childAge?.toString(), reportType)
        contextoClinico = ctx.historialTexto

        // Enriquecer con datos reales de sesiones ABA
        const { data: sesionesRecientes } = await supabaseAdmin
          .from('registro_aba')
          .select('fecha_sesion, datos, ai_analysis')
          .eq('child_id', childId)
          .order('fecha_sesion', { ascending: false })
          .limit(10)

        if (sesionesRecientes && sesionesRecientes.length > 0) {
          // Calcular promedio de logro real usando el parser robusto
          const logros = (sesionesRecientes as any[]).map(s => {
            const d = s.datos || {}
            const ai = s.ai_analysis || {}
            return parseNivelLogroReport(
              d.nivel_logro_objetivos ?? d.porcentaje_logro ?? d.logro_objetivos ??
              d.porcentaje_exito ?? ai.nivel_logro_objetivos ?? ai.porcentaje_logro
            )
          }).filter((v): v is number => v !== null)

          const promedioLogro = logros.length > 0
            ? Math.round(logros.reduce((a, b) => a + b, 0) / logros.length)
            : 0

          datosEnriquecidos = {
            ...datosEnriquecidos,
            promedio_logro_real: promedioLogro,
            total_sesiones: sesionesRecientes.length,
            ultima_sesion: (sesionesRecientes[0] as any).fecha_sesion,
            logros_historicos: logros,
          }
        }

        // Enriquecer con programas activos
        const { data: programas } = await supabaseAdmin
          .from('programas_aba')
          .select('titulo, area, fase_actual, criterio_dominio_pct, sesiones_datos_aba(porcentaje_exito, fecha)')
          .eq('child_id', childId)
          .eq('estado', 'activo')
          .limit(8)

        if (programas && programas.length > 0) {
          datosEnriquecidos.programas_activos = (programas as any[]).map(p => {
            const sesiones = p.sesiones_datos_aba || []
            const promSesiones = sesiones.length > 0
              ? Math.round(sesiones.reduce((a: number, s: any) => a + (s.porcentaje_exito || 0), 0) / sesiones.length)
              : null
            return {
              titulo: p.titulo,
              area: p.area,
              fase: p.fase_actual,
              criterio_dominio: p.criterio_dominio_pct,
              promedio_sesiones: promSesiones,
            }
          })
        }
      }
    } catch (err) {
      console.warn('No se pudo cargar contexto clínico:', err)
    }

    // 3. Generar contenido del reporte con IA
    const contenido = await generarContenidoReporte(
      reportType,
      childName,
      childAge,
      datosEnriquecidos,
      contextoClinico
    ,
      userLocale
    )

    if (!contenido || contenido.length < 100) {
      return NextResponse.json(
        { error: 'No se pudo generar el contenido del reporte. Intenta de nuevo.' },
        { status: 500 }
      )
    }

    // 4. Convertir a DOCX profesional
    const fileData = await generarDocx(reportType, childName, childAge, contenido, userLocale)
    const fileName = getTituloArchivo(reportType, childName)

    return NextResponse.json({
      success: true,
      fileData,
      fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      contenidoTexto: contenido, // Para debug o preview
    })

  } catch (error: any) {
    console.error('Error en /api/generate-report:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno al generar el reporte' },
      { status: 500 }
    )
  }
}
