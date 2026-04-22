export const maxDuration = 60;

// ==============================================================================
// API: ANÁLISIS IA PARA EVALUACIONES PROFESIONALES (VERSIÓN CORREGIDA)
// Ruta: /api/analyze-professional-evaluation/route.ts
// ==============================================================================

import { NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder';

// Definimos interfaces para tipado básico
interface EvaluationRequest {
  evaluationType: 'brief2' | 'ados2' | 'vineland3' | 'wiscv' | 'basc3' | 'abllsr';
  responses: any;
  childName: string;
  childAge: number;
  childId?: string;
}


// Helper: reintentar con backoff exponencial ante rate limit


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(req: Request) {
  try {
    const body: EvaluationRequest = await req.json();
    const { evaluationType, responses, childName, childAge, childId } = body;


    // Contexto completo: RAG + historial + instrucciones del centro
    const evalQuery = `${evaluationType} evaluación clínica ${childName || ''}`
    const ctx = await buildAIContext(childId, childName, childAge ? String(childAge) : undefined, evalQuery)
    const nombreNino = ctx.childName
    const edadNino = ctx.childAge ? Number(ctx.childAge) || childAge : childAge
    const historialTexto = ctx.fullContext  // includes RAG + centro + child history

    // 2. Inicialización
    let analysisResult: any = {};

    // 3. Router de Evaluaciones
    switch (evaluationType) {
      case 'brief2':
        analysisResult = await analyzeBRIEF2(responses, nombreNino, edadNino, historialTexto);
        break;
      case 'ados2':
        analysisResult = await analyzeADOS2(responses, nombreNino, edadNino, historialTexto);
        break;
      case 'vineland3':
        analysisResult = await analyzeVineland3(responses, nombreNino, edadNino, historialTexto);
        break;
      case 'wiscv':
        analysisResult = await analyzeWISCV(responses, nombreNino, edadNino, historialTexto);
        break;
      case 'basc3':
        analysisResult = await analyzeBASC3(responses, nombreNino, edadNino, historialTexto);
        break;
      case 'abllsr':
        analysisResult = await analyzeABLLSR(responses, nombreNino, edadNino, historialTexto);
        break;
      default:
        return NextResponse.json({ error: `Tipo de evaluación no soportado: ${evaluationType}` }, { status: 400 });
    }

    return NextResponse.json(analysisResult);

  } catch (error: any) {
    console.error("❌ Error en el análisis de IA:", error);
    const isQuota = error.message === 'CUOTA_AGOTADA' || error.message?.includes('429')
    return NextResponse.json({ 
      error: isQuota 
        ? 'Cuota de IA agotada. Por favor espera unos minutos e intenta nuevamente.' 
        : (error.message || "Error desconocido procesando la evaluación clínica.")
    }, { status: isQuota ? 429 : 500 });
  }
}

// ============================================================================
// FUNCIÓN AUXILIAR PARA PARSEAR JSON DE GEMINI (VERSIÓN MEJORADA)
// ============================================================================
function parseGeminiJSON(text: string | undefined, context: string = "respuesta"): any {
  // Validación inicial
  if (!text) {
    console.error(`❌ ${context}: La IA no devolvió texto`);
    throw new Error("La IA no generó una respuesta. Por favor intenta de nuevo.");
  }

  console.log(`📝 ${context} - Texto recibido (primeros 200 caracteres):`, text.substring(0, 200));

  try {
    // 1. Intentar parsear directo
    return JSON.parse(text);
  } catch (e) {
    // 2. Limpiar markdown y caracteres extra
    let cleaned = text.trim();
    
    // Remover bloques de código markdown
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    
    // Remover posible texto antes del JSON
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error(`❌ ${context}: No se encontraron llaves de JSON en el texto`);
      console.error("Texto completo recibido:", text);
      throw new Error("La IA no generó un JSON válido. La respuesta no contiene un objeto JSON.");
    }
    
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    
    console.log(`🔧 ${context} - JSON limpiado (primeros 200 caracteres):`, cleaned.substring(0, 200));
    
    // 3. Intentar parsear de nuevo
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error(`❌ ${context}: Error al parsear JSON después de limpiar`);
      console.error("JSON limpiado completo:", cleaned);
      console.error("Error:", e2);
      throw new Error("La IA generó un formato incorrecto. Por favor intenta de nuevo o contacta soporte.");
    }
  }
}

// ============================================================================
// 1. LÓGICA BRIEF-2 (Funciones Ejecutivas)
// ============================================================================
async function analyzeBRIEF2(responses: any, childName: string, childAge: number, historialTexto: string = "") {
  // Cálculos matemáticos precisos
  const inhibicionScore = sumItems(responses, 'inhibe_', 6);
  const flexibilidadScore = sumItems(responses, 'flex_', 6);
  const emocionalScore = sumItems(responses, 'emocional_', 5);
  const memoriaScore = sumItems(responses, 'memoria_', 5);
  const planificacionScore = sumItems(responses, 'plan_', 5);

  const totalScore = inhibicionScore + flexibilidadScore + emocionalScore + memoriaScore + planificacionScore;
  const maxScore = 81; // 27 items * 3
  const percentScore = (totalScore / maxScore) * 100;

  // Determinar nivel de riesgo clínico
  let nivelRiesgo = '';
  if (percentScore < 40) nivelRiesgo = 'SIN RIESGO CLÍNICO (Funcionamiento Ejecutivo Adecuado)';
  else if (percentScore < 60) nivelRiesgo = 'RIESGO LEVE (Dificultades Específicas)';
  else if (percentScore < 80) nivelRiesgo = 'RIESGO MODERADO (Disfunción Ejecutiva Significativa)';
  else nivelRiesgo = 'RIESGO SEVERO (Disfunción Ejecutiva Global)';

  const prompt = `
    ACTÚA COMO: Neuropsicólogo clínico infantil con especialización en Funciones Ejecutivas.
    TAREA: Redactar un informe clínico detallado basado en la prueba BRIEF-2.

    DATOS DEL PACIENTE:
    - Nombre: ${childName}
    - Edad: ${childAge} años
    ${historialTexto}
    
    RESULTADOS CUANTITATIVOS:
    1. Inhibición: ${inhibicionScore}/18 (${getDescriptor(inhibicionScore, 18)})
    2. Flexibilidad Cognitiva: ${flexibilidadScore}/18 (${getDescriptor(flexibilidadScore, 18)})
    3. Control Emocional: ${emocionalScore}/15 (${getDescriptor(emocionalScore, 15)})
    4. Memoria de Trabajo: ${memoriaScore}/15 (${getDescriptor(memoriaScore, 15)})
    5. Planificación/Organización: ${planificacionScore}/15 (${getDescriptor(planificacionScore, 15)})
    
    GLOBAL: ${percentScore.toFixed(1)}% -> ${nivelRiesgo}

    OBSERVACIONES CUALITATIVAS (Notas del evaluador):
    ${responses.inhibe_notas ? `• Inhibición: ${responses.inhibe_notas}` : ''}
    ${responses.flex_notas ? `• Flexibilidad: ${responses.flex_notas}` : ''}
    ${responses.emocional_notas ? `• Emocional: ${responses.emocional_notas}` : ''}

    INSTRUCCIONES CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido, sin texto adicional antes o después
    2. NO uses bloques de código markdown (\`\`\`json)
    3. Las claves deben ser exactamente estas (sin variación):

    {
      "analisis_ia": "Escribe 2-3 párrafos densos. Primero analiza el perfil global y el índice de regulación conductual (inhibición/emocional). Luego analiza el índice de metacognición (memoria/planificación). Usa lenguaje clínico profesional pero comprensible.",
      "recomendaciones_ia": "Lista de 4 a 6 recomendaciones prácticas y específicas para escuela y casa. Cada recomendación en una línea separada con guión. Enfócate en las áreas con mayor puntaje de déficit.",
      "informe_padres": "Un resumen de 150-200 palabras dirigido a los padres, usando tono empático, sin jerga médica compleja, explicando qué significan estos desafíos en la vida diaria del niño y cómo pueden apoyar."
    }
  `;

  const result = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 });

  if (!result) throw new Error("La IA no generó respuesta"); const parsed = parseGeminiJSON(result, "análisis");

  return {
    ...parsed,
    metricas: {
      inhibicion: inhibicionScore,
      flexibilidad: flexibilidadScore,
      emocional: emocionalScore,
      memoria: memoriaScore,
      planificacion: planificacionScore,
      total: totalScore,
      porcentaje: percentScore,
      nivel_riesgo: nivelRiesgo
    }
  };
}

// ============================================================================
// 2. LÓGICA ADOS-2 (Diagnóstico Autismo)
// ============================================================================
async function analyzeADOS2(responses: any, childName: string, childAge: number, historialTexto: string = "") {
  // Agrupación por dominios ADOS-2
  const comunicacionScore = sumItems(responses, '', ['contacto_visual', 'expresiones_faciales', 'integracion_mirada', 'sonrisa_social', 'comunicacion_afectiva', 'atencion_conjunta', 'inicio_atencion']);
  const interaccionScore = sumItems(responses, '', ['busqueda_compartir', 'ofrecimiento_consuelo', 'respuesta_nombre', 'reciprocidad_social', 'interes_otros']);
  const juegoScore = sumItems(responses, '', ['juego_funcional', 'juego_imaginativo', 'juego_imitativo']);
  const conductasScore = sumItems(responses, '', ['estereotipias_motoras', 'manipulacion_objetos', 'intereses_restringidos', 'rituales_compulsiones', 'sensibilidad_sensorial']);

  // Algoritmo simplificado de clasificación ADOS
  const totalScore = comunicacionScore + interaccionScore; 
  let severidad = '';
  let clasificacionClinica = '';

  if (totalScore <= 7) {
    severidad = 'NO TEA';
    clasificacionClinica = 'Puntaje por debajo del umbral clínico para Espectro Autista.';
  } else if (totalScore <= 10) {
    severidad = 'TEA LEVE';
    clasificacionClinica = 'Clasificación: Autismo (Nivel de soporte 1 sugerido).';
  } else if (totalScore <= 15) {
    severidad = 'TEA MODERADO';
    clasificacionClinica = 'Clasificación: Autismo (Nivel de soporte 2 sugerido).';
  } else {
    severidad = 'TEA SEVERO';
    clasificacionClinica = 'Clasificación: Autismo (Nivel de soporte 3 sugerido).';
  }

  const prompt = `
    ⚠️ INSTRUCCIÓN CRÍTICA: Responde ÚNICAMENTE con un objeto JSON válido. NO agregues texto antes o después. NO uses bloques de código markdown.

    ACTÚA COMO: Especialista certificado en ADOS-2 y diagnóstico diferencial de TEA.
    TAREA: Generar interpretación diagnóstica en formato JSON.

    PACIENTE: ${childName}, ${childAge} años.
    ${historialTexto}

    PERFIL DE PUNTUACIONES:
    - Afecto Social (Comunicación + Interacción): ${totalScore} puntos.
    - Comportamiento Restringido y Repetitivo: ${conductasScore} puntos.
    
    DESGLOSE:
    1. Comunicación: ${comunicacionScore} (Déficits en comunicación no verbal y verbal).
    2. Interacción Social: ${interaccionScore} (Reciprocidad socioemocional).
    3. Juego e Imaginación: ${juegoScore} (Simbolización y creatividad).
    4. Conductas Repetitivas: ${conductasScore} (Estereotipias, rigidez sensorial).

    CLASIFICACIÓN: ${severidad} - ${clasificacionClinica}

    INSTRUCCIONES CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido, sin texto adicional
    2. NO uses bloques de código markdown
    3. Las claves deben ser exactamente estas:

    {
      "analisis_diagnostico_ia": "Análisis clínico de 2-3 párrafos explicando el perfil de afecto social, las conductas repetitivas observadas y cómo se relaciona con los criterios DSM-5 para TEA. Menciona la severidad estimada.",
      "recomendaciones_intervencion": "Lista de 5-7 recomendaciones terapéuticas específicas (ABA, terapia de lenguaje, habilidades sociales, integración sensorial) separadas por líneas con guión.",
      "informe_familia_ados": "Resumen de 150-200 palabras para la familia explicando en lenguaje sencillo qué significa el diagnóstico, qué apoyos necesita el niño y un mensaje de esperanza sobre el desarrollo con intervención temprana."
    }
  `;

  const result = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 });

  if (!result) throw new Error("La IA no generó respuesta"); const parsed = parseGeminiJSON(result, "análisis");

  return {
    ...parsed,
    metricas: {
      comunicacion: comunicacionScore,
      interaccion: interaccionScore,
      juego: juegoScore,
      conductas_repetitivas: conductasScore,
      afecto_social: totalScore,
      severidad,
      clasificacion: clasificacionClinica
    }
  };
}

// ============================================================================
// 3. LÓGICA VINELAND-3 (Conducta Adaptativa)
// ============================================================================
async function analyzeVineland3(responses: any, childName: string, childAge: number, historialTexto: string = "") {
  // ── Claves reales del formulario VINELAND3_DATA en formConstants.tsx ──
  // Comunicación: 7 ítems × 2 pts = 14 pts máx
  const comunicacionScore = calculateVinelandScore(responses, [
    'com_receptiva', 'com_sigue_instrucciones', 'com_entiende_2pasos',
    'com_expresiva_palabras', 'com_frases_completas', 'com_cuenta_experiencias', 'com_escrita'
  ]);
  // Vida Diaria: 7 ítems × 2 pts = 14 pts máx
  const vidaDiariaScore = calculateVinelandScore(responses, [
    'vida_come_solo', 'vida_bebe_vaso', 'vida_lava_manos',
    'vida_viste_superior', 'vida_bano', 'vida_tareas_casa', 'vida_dinero'
  ]);
  // Socialización: 7 ítems × 2 pts = 14 pts máx
  const socializacionScore = calculateVinelandScore(responses, [
    'soc_sonrie_familiar', 'soc_muestra_afecto', 'soc_juega_otros',
    'soc_comparte', 'soc_respeta_turnos', 'soc_empatia', 'soc_amistad'
  ]);
  // Motoras: 6 ítems × 2 pts = 12 pts máx
  const motorScore = calculateVinelandScore(responses, [
    'motor_camina', 'motor_corre', 'motor_salta',
    'motor_pelota', 'motor_pinza', 'motor_dibuja'
  ]);

  const maxCom  = 14; const maxVida = 14; const maxSoc = 14; const maxMot = 12;
  const maxTotal = maxCom + maxVida + maxSoc + maxMot; // 54

  const indiceGlobal = comunicacionScore + vidaDiariaScore + socializacionScore + motorScore;
  const percentGlobal = (indiceGlobal / maxTotal) * 100;

  const pctCom  = (comunicacionScore / maxCom)  * 100;
  const pctVida = (vidaDiariaScore   / maxVida)  * 100;
  const pctSoc  = (socializacionScore / maxSoc)  * 100;
  const pctMot  = (motorScore        / maxMot)   * 100;

  let nivelAdaptativo = '';
  if (percentGlobal >= 75) nivelAdaptativo = 'Alto';
  else if (percentGlobal >= 50) nivelAdaptativo = 'Moderado';
  else if (percentGlobal >= 25) nivelAdaptativo = 'Bajo';
  else nivelAdaptativo = 'Muy Bajo';

  const prompt = `
    ACTÚA COMO: Psicólogo evaluador especializado en desarrollo adaptativo.
    TAREA: Interpretación de la escala Vineland-3.

    PACIENTE: ${childName}, ${childAge} años.
    ${historialTexto}

    PERFIL DE DOMINIOS (puntuación obtenida / máximo posible — porcentaje):
    1. Comunicación:          ${comunicacionScore}/${maxCom}  (${pctCom.toFixed(1)}%) — Expresión receptiva, expresiva y escrita.
    2. Vida Diaria:           ${vidaDiariaScore}/${maxVida}  (${pctVida.toFixed(1)}%) — Autocuidado, tareas domésticas y comunidad.
    3. Socialización:         ${socializacionScore}/${maxSoc}  (${pctSoc.toFixed(1)}%) — Relaciones, juego y manejo emocional.
    4. Habilidades Motoras:   ${motorScore}/${maxMot}  (${pctMot.toFixed(1)}%) — Motricidad fina y gruesa.

    ÍNDICE GLOBAL DE COMPORTAMIENTO ADAPTATIVO: ${indiceGlobal}/${maxTotal} (${percentGlobal.toFixed(1)}%) — Nivel ${nivelAdaptativo}

    INSTRUCCIONES CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido
    2. NO uses bloques de código markdown
    3. Las claves deben ser exactamente estas:

    {
      "analisis_vineland_ia": "Análisis de 2-3 párrafos sobre el perfil adaptativo global. ¿Cuál es el dominio más fuerte y cuál el más débil? ¿Cómo esto afecta la autonomía del niño en casa y escuela?",
      "areas_fortaleza": "Lista de 3-4 fortalezas específicas identificadas en los dominios evaluados, separadas por líneas con guión.",
      "areas_prioridad": "Lista de 3-5 áreas prioritarias para intervención, ordenadas por importancia, separadas por líneas con guión.",
      "informe_padres_vineland": "Resumen de 150-200 palabras explicando a los padres qué son las conductas adaptativas, dónde está su hijo en comparación con otros de su edad, y cómo pueden fomentar mayor independencia en casa."
    }
  `;

  const result = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 });

  if (!result) throw new Error("La IA no generó respuesta"); const parsed = parseGeminiJSON(result, "análisis");

  return {
    ...parsed,
    metricas: {
      comunicacion:  comunicacionScore,
      vida_diaria:   vidaDiariaScore,
      socializacion: socializacionScore,
      motor:         motorScore,
      indice_global: indiceGlobal,
      max_total:     maxTotal,
      porcentaje:    percentGlobal,
      nivel:         nivelAdaptativo
    }
  };
}

// ============================================================================
// 4. LÓGICA WISC-V (Inteligencia / Cognitivo)
// ============================================================================
async function analyzeWISCV(responses: any, childName: string, childAge: number, historialTexto: string = "") {
  // Suma de escalares
  const icv = sumScalars(responses, ['icv_semejanzas', 'icv_vocabulario', 'icv_informacion', 'icv_comprension']);
  const ive = sumScalars(responses, ['ive_cubos', 'ive_puzles']);
  const irf = sumScalars(responses, ['irf_matrices', 'irf_balanzas', 'irf_aritmetica']);
  const imt = sumScalars(responses, ['imt_digitos', 'imt_imagenes']);
  const ivp = sumScalars(responses, ['ivp_claves', 'ivp_busqueda', 'ivp_cancelacion']);

  // Aproximación de CI Total
  const sumaPonderada = icv + ive + irf + imt + ivp;
  const ciTotal = Math.round(100 + ((sumaPonderada - 50) * 1.5));
  
  let clasificacion = '';
  if (ciTotal >= 130) clasificacion = 'Muy Superior';
  else if (ciTotal >= 120) clasificacion = 'Superior';
  else if (ciTotal >= 110) clasificacion = 'Promedio Alto';
  else if (ciTotal >= 90) clasificacion = 'Promedio';
  else if (ciTotal >= 80) clasificacion = 'Promedio Bajo';
  else if (ciTotal >= 70) clasificacion = 'Limítrofe';
  else clasificacion = 'Discapacidad Intelectual';

  const prompt = `
    ACTÚA COMO: Neuropsicólogo clínico experto en evaluación cognitiva (WISC-V).
    TAREA: Perfil Cognitivo.

    PACIENTE: ${childName}, ${childAge} años.
    ${historialTexto}
    
    PERFIL DE ÍNDICES:
    - Comprensión Verbal (ICV): ${icv} (Razonamiento verbal, formación de conceptos).
    - Visoespacial (IVE): ${ive} (Procesamiento espacial, integración visomotora).
    - Razonamiento Fluido (IRF): ${irf} (Resolución de problemas novedosos).
    - Memoria de Trabajo (IMT): ${imt} (Atención, concentración, manipulación mental).
    - Velocidad de Procesamiento (IVP): ${ivp} (Rapidez mental y grafomotora).

    COEFICIENTE INTELECTUAL TOTAL (Estimado): ${ciTotal} - Categoría: ${clasificacion}

    INSTRUCCIONES CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido
    2. NO uses bloques de código markdown
    3. Las claves deben ser exactamente estas:

    {
      "perfil_cognitivo_ia": "Explica en 2-3 párrafos cómo procesa la información el niño. ¿Es mejor verbalmente o visualmente? ¿Su memoria de trabajo limita su inteligencia fluida? Analiza las discrepancias entre índices y qué significan para el aprendizaje.",
      "fortalezas_debilidades": "Sección clara dividida en FORTALEZAS (2-3 puntos) y DEBILIDADES (2-3 puntos) cognitivas, separadas por líneas con guión.",
      "implicaciones_educativas": "Lista de 4-6 estrategias pedagógicas para el aula (Ej. Tiempo extra, material visual, instrucciones cortas), separadas por líneas con guión.",
      "recomendaciones_cognitivas": "Lista de 4-5 ejercicios de estimulación cognitiva recomendados, separadas por líneas con guión.",
      "informe_padres_wisc": "Explicación de 150-200 palabras sencilla del CI y cómo apoyar el aprendizaje en casa, con un tono positivo y empoderador."
    }
  `;

  const result = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 });

  if (!result) throw new Error("La IA no generó respuesta"); const parsed = parseGeminiJSON(result, "análisis");

  // Convertir puntuaciones escalares a percentiles (escala 1-19, media=10)
  function scaledToPercentile(s: number): number {
    const table: Record<number, number> = {1:0,2:1,3:1,4:2,5:5,6:9,7:16,8:25,9:37,10:50,11:63,12:75,13:84,14:91,15:95,16:98,17:99,18:99,19:99};
    return table[Math.min(19, Math.max(1, Math.round(s)))] ?? 50;
  }
  function ciToPercentile(ci: number): number {
    if (ci >= 130) return 98; if (ci >= 125) return 95; if (ci >= 120) return 91;
    if (ci >= 115) return 84; if (ci >= 110) return 75; if (ci >= 105) return 63;
    if (ci >= 100) return 50; if (ci >= 95) return 37;  if (ci >= 90) return 25;
    if (ci >= 85) return 16;  if (ci >= 80) return 9;   if (ci >= 75) return 5;
    if (ci >= 70) return 2;   return 1;
  }

  return {
    ...parsed,
    ci_total: ciTotal,
    clasificacion_ci: clasificacion,
    metricas: {
      icv, ive, irf, imt, ivp, ci_total: ciTotal, clasificacion,
      icv_percentil: scaledToPercentile(icv),
      ive_percentil: scaledToPercentile(ive),
      irf_percentil: scaledToPercentile(irf),
      imt_percentil: scaledToPercentile(imt),
      ivp_percentil: scaledToPercentile(ivp),
      ci_percentil: ciToPercentile(ciTotal),
    }
  };
}

// ============================================================================
// 5. LÓGICA BASC-3 (Conducta y Emociones)
// ============================================================================
async function analyzeBASC3(responses: any, childName: string, childAge: number, historialTexto: string = "") {
  // Parseo seguro de integers
  const toInt = (k: string) => parseInt(responses[k]) || 0;

  const hiperactividad = toInt('basc_hiperactividad');
  const agresion = toInt('basc_agresion');
  const problemasConducta = toInt('basc_problemas_conducta');
  const ansiedad = toInt('basc_ansiedad');
  const depresion = toInt('basc_depresion');
  const somatizacion = toInt('basc_somatizacion');
  
  const habilidadesSociales = toInt('basc_habilidades_sociales');
  const liderazgo = toInt('basc_liderazgo');
  const habilidadesEstudio = toInt('basc_habilidades_estudio');
  const adaptabilidad = toInt('basc_adaptabilidad');

  // Cálculos compuestos
  const externalizante = hiperactividad + agresion + problemasConducta;
  const internalizante = ansiedad + depresion + somatizacion;
  const adaptativo = habilidadesSociales + liderazgo + habilidadesEstudio + adaptabilidad;
  const indiceSintomas = externalizante + internalizante;
  
  let perfilRiesgo = '';
  if (indiceSintomas < 10) perfilRiesgo = 'Bajo (Sin significancia clínica)';
  else if (indiceSintomas < 20) perfilRiesgo = 'En Riesgo (Atención sugerida)';
  else perfilRiesgo = 'Clínicamente Significativo (Intervención necesaria)';

  const prompt = `
    ACTÚA COMO: Psicólogo Conductual Infantil.
    TAREA: Interpretación del sistema BASC-3.

    PACIENTE: ${childName}, ${childAge} años.
    ${historialTexto}

    DIMENSIONES CLÍNICAS (SÍNTOMAS):
    1. Externalizantes (Conducta visible): ${externalizante}/30
       - Hiperactividad: ${hiperactividad}, Agresión: ${agresion}, Problemas de Conducta: ${problemasConducta}.
    2. Internalizantes (Emocional): ${internalizante}/30
       - Ansiedad: ${ansiedad}, Depresión: ${depresion}, Somatización: ${somatizacion}.

    DIMENSIONES ADAPTATIVAS (RECURSOS):
    - Total Recursos: ${adaptativo}/40
    - Habilidades Sociales: ${habilidadesSociales}, Liderazgo: ${liderazgo}, Habilidades de Estudio: ${habilidadesEstudio}, Adaptabilidad: ${adaptabilidad}.

    PERFIL DE RIESGO GENERAL: ${perfilRiesgo}

    INSTRUCCIONES CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido
    2. NO uses bloques de código markdown
    3. Las claves deben ser exactamente estas:

    {
      "analisis_basc_ia": "Analiza en 2-3 párrafos la relación entre lo que el niño siente (internalizante) y cómo actúa (externalizante). ¿Tiene recursos adaptativos suficientes para enfrentar sus problemas? ¿La conducta externa puede ser una manifestación de malestar interno?",
      "areas_preocupacion": "Lista las escalas específicas que están elevadas y qué significan en la vida diaria del niño (3-5 puntos), separadas por líneas con guión.",
      "fortalezas_conductuales": "Identifica los factores protectores del niño (2-4 puntos), separadas por líneas con guión.",
      "plan_intervencion_conductual": "Plan de modificación de conducta y apoyo emocional (5-7 estrategias concretas), separadas por líneas con guión.",
      "informe_padres_basc": "Explicación de 150-200 palabras sobre el bienestar emocional del niño para los padres, con un tono comprensivo y esperanzador."
    }
  `;

  const result = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 });

  if (!result) throw new Error("La IA no generó respuesta"); const parsed = parseGeminiJSON(result, "análisis");

  return {
    ...parsed,
    metricas: {
      externalizante, internalizante, adaptativo, indice_sintomas: indiceSintomas, perfil_riesgo: perfilRiesgo
    }
  };
}


// ============================================================================
// 6. LÓGICA ABLLS-R (Assessment of Basic Language and Learning Skills - Revised)
// ============================================================================
async function analyzeABLLSR(responses: any, childName: string, childAge: number, historialTexto: string = "") {
  const toScore = (k: string) => parseInt(responses[k]) || 0

  // Dominio: Cooperación y Reforzadores (5 ítems × 4 = 20 máx)
  const cooperacion = ['coop_sigue_instrucciones','coop_permanece_tarea','coop_acepta_reforzador','coop_tolerancia_frustracion','coop_transiciones'].reduce((s,k) => s + toScore(k), 0)
  
  // Dominio: Lenguaje Receptivo (6 ítems × 4 = 24 máx)
  const receptivo = ['rec_responde_nombre','rec_sigue_1paso','rec_sigue_2pasos','rec_identifica_objetos','rec_identifica_acciones','rec_conceptos_basicos'].reduce((s,k) => s + toScore(k), 0)
  
  // Dominio: Lenguaje Expresivo (5 ítems × 4 = 20 máx, ecolalia inversa)
  const expresivo = ['exp_solicita_objetos','exp_etiqueta_objetos','exp_responde_preguntas','exp_combina_palabras','exp_inicia_conversacion'].reduce((s,k) => s + toScore(k), 0)
  const ecolalia = toScore('exp_ecolalia') // 0=sin ecolalia (mejor), 4=predominante (peor)

  // Dominio: Socialización y Juego (5 ítems × 4 = 20 máx)
  const social = ['social_juego_solo','social_juego_paralelo','social_juego_cooperativo','social_imita_pares','social_busca_interaccion'].reduce((s,k) => s + toScore(k), 0)

  // Dominio: Académico (5 ítems × 4 = 20 máx)
  const academico = ['acad_discrimina_formas','acad_secuencia_numeros','acad_reconoce_letras','acad_escritura_nombre','acad_lectura_funcional'].reduce((s,k) => s + toScore(k), 0)

  // Dominio: AVD (4 ítems × 4 = 16 máx)
  const avd = ['avd_alimentacion','avd_bano','avd_vestido','avd_higiene'].reduce((s,k) => s + toScore(k), 0)

  const maxTotal = 20 + 24 + 20 + 20 + 20 + 16 // 120
  const totalScore = cooperacion + receptivo + expresivo + social + academico + avd
  const pctGlobal = Math.round((totalScore / maxTotal) * 100)

  const pctCoop = Math.round((cooperacion / 20) * 100)
  const pctRec  = Math.round((receptivo   / 24) * 100)
  const pctExp  = Math.round((expresivo   / 20) * 100)
  const pctSoc  = Math.round((social      / 20) * 100)
  const pctAcad = Math.round((academico   / 20) * 100)
  const pctAvd  = Math.round((avd         / 16) * 100)

  let nivelGlobal = ''
  if (pctGlobal >= 75) nivelGlobal = 'Habilidades Avanzadas'
  else if (pctGlobal >= 50) nivelGlobal = 'Habilidades en Desarrollo'
  else if (pctGlobal >= 25) nivelGlobal = 'Habilidades Emergentes'
  else nivelGlobal = 'Habilidades Iniciales — Requiere Apoyo Intensivo'

  const prompt = \`
    ACTÚA COMO: Especialista certificado en ABA y evaluación ABLLS-R con experiencia en TEA y trastornos del neurodesarrollo.
    TAREA: Generar un informe clínico completo basado en los resultados del ABLLS-R.

    PACIENTE: \${childName}, \${childAge} años.
    \${historialTexto}

    PERFIL DE DOMINIOS ABLLS-R:
    1. Cooperación y Reforzadores: \${cooperacion}/20 (\${pctCoop}%)
    2. Lenguaje Receptivo:         \${receptivo}/24 (\${pctRec}%)
    3. Lenguaje Expresivo:         \${expresivo}/20 (\${pctExp}%) — Ecolalia: \${ecolalia}/4
    4. Juego y Socialización:      \${social}/20 (\${pctSoc}%)
    5. Habilidades Académicas:     \${academico}/20 (\${pctAcad}%)
    6. Vida Diaria (AVD):          \${avd}/16 (\${pctAvd}%)

    PUNTAJE GLOBAL: \${totalScore}/\${maxTotal} (\${pctGlobal}%) → \${nivelGlobal}

    INSTRUCCIONES CRÍTICAS:
    1. Responde SOLO con un objeto JSON válido, sin texto adicional antes o después
    2. NO uses bloques de código markdown
    3. Las claves deben ser exactamente estas:

    {
      "analisis_ablls_ia": "Análisis clínico de 3-4 párrafos: (1) Perfil global de habilidades y nivel de funcionamiento. (2) Análisis del lenguaje receptivo vs expresivo y su impacto en la comunicación. (3) Habilidades sociales y de juego. (4) Fortalezas identificadas y áreas de mayor necesidad. Usa lenguaje clínico profesional.",
      "objetivos_prioritarios": "Lista de 6-8 objetivos ABA específicos y medibles priorizados según los dominios más bajos, en formato: 'Dominio — Objetivo: descripción conductual observable'. Ordenados de mayor a menor urgencia clínica.",
      "informe_padres_ablls": "Resumen de 180-220 palabras para los padres explicando qué evalúa el ABLLS-R, cómo está su hijo en cada área, y 3-4 estrategias concretas que pueden implementar en casa para apoyar el desarrollo del lenguaje y las habilidades de vida diaria. Tono empático y esperanzador."
    }
  \`

  const result = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2500 })

  if (!result) throw new Error("La IA no generó respuesta")
  const parsed = parseGeminiJSON(result, "análisis ABLLS-R")

  return {
    ...parsed,
    metricas: {
      cooperacion, receptivo, expresivo, social, academico, avd,
      total: totalScore, max_total: maxTotal, porcentaje: pctGlobal,
      nivel: nivelGlobal, ecolalia
    }
  }
}

// ============================================================================
// UTILIDADES Y AYUDANTES (Helpers)
// ============================================================================

function sumItems(responses: any, prefix: string, count: number | string[]): number {
  if (Array.isArray(count)) {
    return count.reduce((sum, key) => sum + (parseInt(responses[key]) || 0), 0);
  }
  let total = 0;
  for (let i = 1; i <= (count as number); i++) {
    total += parseInt(responses[`${prefix}${i}`]) || 0;
  }
  return total;
}

function sumScalars(responses: any, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (parseInt(responses[key]) || 0), 0);
}

function calculateVinelandScore(responses: any, keys: string[]): number {
  return keys.reduce((sum, key) => {
    const val = responses[key];
    if (val === 'Usualmente' || val === 'Siempre' || val === '2') return sum + 2;
    if (val === 'A veces' || val === '1') return sum + 1;
    return sum; 
  }, 0);
}

function getDescriptor(score: number, max: number): string {
  const percent = (score / max) * 100;
  if (percent < 33) return 'Bajo';
  if (percent < 66) return 'Medio';
  return 'Alto';
}