import { NextRequest, NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext, parseAIJson } from '@/lib/ai-context-builder';

// ============================================================================
// INTERFACES (Tipado fuerte para seguridad)
// ============================================================================
interface HomeEnvironmentRequest {
  [key: string]: any; // Permitir cualquier campo del formulario
}

interface AnalysisResponse {
  impresion_general: string;
  mensaje_padres_entorno: string;
  recomendaciones_espacio?: string;
  recomendaciones_rutinas?: string;
  actividades_sugeridas?: string;
}

// ============================================================================
// FUNCIÓN AUXILIAR PARA PARSEAR JSON DE GEMINI
// ============================================================================
function parseGeminiJSON(text: string): any {
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
    
    // Remover texto antes/después del JSON
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }
    
    // 3. Intentar parsear de nuevo
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("❌ No se pudo parsear el JSON:", text);
      throw new Error("La IA no generó un JSON válido. Por favor intenta de nuevo.");
    }
  }
}

// ============================================================================
// HANDLER PRINCIPAL
// ============================================================================

// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(request: NextRequest) {
  try {

    // 2. Parseo del Body (aceptamos todos los campos)
    const body: HomeEnvironmentRequest = await request.json();
    
    console.log('📝 Datos recibidos en API de entorno:', body);

    // Extraer campos específicos si existen
    const {
      fecha_visita,
      duracion_visita,
      personas_presentes,
      tipo_vivienda,
      num_habitaciones,
      espacio_juego,
      condiciones_higiene,
      iluminacion_ventilacion,
      juguetes_disponibles,
      acceso_tecnologia,
      tiempo_pantalla,
      rutina_diaria,
      consistencia_rutinas,
      hora_dormir,
      actividades_familia,
      interaccion_padres,
      estilo_crianza,
      manejo_conductas,
      apoyo_red_familiar,
      tipo_alimentacion,
      quien_prepara_comida,
      come_familia,
      comportamiento_observado,
      diferencias_consultorio,
      estimulacion_sensorial,
      barreras_identificadas,
      facilitadores,
      disposicion_cambio,
      recomendaciones_espacio,
      recomendaciones_rutinas,
      actividades_casa
    } = body;

    // Cargar contexto completo: RAG + historial + centro
    const childId = body.childId || ''
    const homeQuery = `entorno hogar familia ABA ambiente terapéutico ${comportamiento_observado || ''}`
    const ctx = await buildAIContext(childId, body.childName, body.childAge ? String(body.childAge) : undefined, homeQuery)
    const nombreNino = ctx.childName
    const historialTexto = ctx.fullContext  // RAG + centro + historial

    // Validación mínima
    const hasMinimalData = comportamiento_observado || barreras_identificadas || rutina_diaria || interaccion_padres;
    
    if (!hasMinimalData) {
      return NextResponse.json(
        { error: 'Se requiere información sobre el comportamiento, barreras, rutina o interacción familiar para realizar el análisis.' },
        { status: 400 }
      );
    }

    // 3. Construcción del Prompt Enriquecido
    const contextParts = [];
    
    contextParts.push(`
      ACTÚA COMO: Terapeuta Senior especializado en Análisis Conductual Aplicado (ABA) y Desarrollo Infantil.
      TAREA: Evaluar el entorno del hogar de ${nombreNino} y generar un reporte de intervención amigable para los padres.
      ${historialTexto}
    `);

    // Información de la visita
    if (fecha_visita || duracion_visita || personas_presentes) {
      contextParts.push(`
      INFORMACIÓN DE LA VISITA:
      ${fecha_visita ? `- Fecha: ${fecha_visita}` : ''}
      ${duracion_visita ? `- Duración: ${duracion_visita}` : ''}
      ${personas_presentes ? `- Presentes: ${personas_presentes}` : ''}
      `);
    }

    // Estructura del hogar
    if (tipo_vivienda || num_habitaciones || espacio_juego) {
      contextParts.push(`
      ESTRUCTURA DEL HOGAR:
      ${tipo_vivienda ? `- Tipo de vivienda: ${tipo_vivienda}` : ''}
      ${num_habitaciones ? `- Habitaciones: ${num_habitaciones}` : ''}
      ${espacio_juego ? `- Espacio para juego/terapia: ${espacio_juego}` : ''}
      ${condiciones_higiene ? `- Higiene: ${condiciones_higiene}` : ''}
      ${iluminacion_ventilacion ? `- Iluminación/Ventilación: ${iluminacion_ventilacion}` : ''}
      `);
    }

    // Recursos disponibles
    if (juguetes_disponibles || acceso_tecnologia) {
      contextParts.push(`
      RECURSOS DISPONIBLES:
      ${juguetes_disponibles ? `- Juguetes/Materiales: ${juguetes_disponibles}` : ''}
      ${acceso_tecnologia ? `- Tecnología: ${acceso_tecnologia}` : ''}
      ${tiempo_pantalla ? `- Tiempo de pantalla: ${tiempo_pantalla}` : ''}
      `);
    }

    // Rutinas
    if (rutina_diaria || consistencia_rutinas) {
      contextParts.push(`
      RUTINAS Y ESTRUCTURA:
      ${rutina_diaria ? `- Rutina diaria: ${rutina_diaria}` : ''}
      ${consistencia_rutinas ? `- Consistencia: ${consistencia_rutinas}` : ''}
      ${hora_dormir ? `- Hora de dormir: ${hora_dormir}` : ''}
      ${actividades_familia ? `- Actividades familiares: ${actividades_familia}` : ''}
      `);
    }

    // Dinámica familiar
    if (interaccion_padres || estilo_crianza) {
      contextParts.push(`
      DINÁMICA FAMILIAR:
      ${interaccion_padres ? `- Interacción padres-niño: ${interaccion_padres}` : ''}
      ${estilo_crianza ? `- Estilo de crianza: ${estilo_crianza}` : ''}
      ${manejo_conductas ? `- Manejo de conductas: ${manejo_conductas}` : ''}
      ${apoyo_red_familiar ? `- Red de apoyo: ${apoyo_red_familiar}` : ''}
      `);
    }

    // Alimentación
    if (tipo_alimentacion || come_familia) {
      contextParts.push(`
      ALIMENTACIÓN:
      ${tipo_alimentacion ? `- Tipo de alimentación: ${tipo_alimentacion}` : ''}
      ${quien_prepara_comida ? `- Quién prepara: ${quien_prepara_comida}` : ''}
      ${come_familia ? `- Come con familia: ${come_familia}` : ''}
      `);
    }

    // Observaciones del comportamiento
    if (comportamiento_observado || diferencias_consultorio) {
      contextParts.push(`
      COMPORTAMIENTO OBSERVADO:
      ${comportamiento_observado ? `- Durante la visita: ${comportamiento_observado}` : ''}
      ${diferencias_consultorio ? `- Diferencias con consultorio: ${diferencias_consultorio}` : ''}
      ${estimulacion_sensorial ? `- Estímulos sensoriales: ${estimulacion_sensorial}` : ''}
      `);
    }

    // Barreras y facilitadores
    if (barreras_identificadas || facilitadores) {
      contextParts.push(`
      ANÁLISIS DEL ENTORNO:
      ${barreras_identificadas ? `- Barreras identificadas: ${barreras_identificadas}` : ''}
      ${facilitadores ? `- Facilitadores/Fortalezas: ${facilitadores}` : ''}
      ${disposicion_cambio ? `- Disposición al cambio: ${disposicion_cambio}` : ''}
      `);
    }

    const fullContext = contextParts.join('\n') + `

      INSTRUCCIONES CRÍTICAS:
      1. Responde SOLO con un objeto JSON válido, sin texto adicional antes o después
      2. NO uses bloques de código markdown (\`\`\`json)
      3. El mensaje para padres debe ser POSITIVO, EMPÁTICO y MOTIVADOR
      4. Las recomendaciones deben ser PRÁCTICAS y ECONÓMICAS
      5. Las claves del JSON deben ser EXACTAMENTE estas:

      {
        "impresion_general": "Resumen clínico de 2-3 párrafos evaluando cómo el entorno físico y la dinámica familiar están impactando el desarrollo del niño. Identifica patrones clave y aspectos positivos.",
        "mensaje_padres_entorno": "Mensaje directo para WhatsApp de 3-5 líneas. TONO: Cálido, empático, motivador. CONTENIDO: Agradece la visita, destaca UNA fortaleza observada y menciona que trabajarán juntos en mejoras.",
        "recomendaciones_espacio": "Lista de 4-5 cambios físicos concretos y económicos para el hogar, separados por líneas con guión. Ejemplo: '- Reducir estímulos visuales en la zona de tareas'",
        "recomendaciones_rutinas": "Lista de 4-5 ajustes a horarios o hábitos diarios para mejorar la regulación, separados por líneas con guión.",
        "actividades_sugeridas": "Lista de 3-5 actividades breves que los padres pueden realizar en la rutina diaria, separadas por líneas con guión."
      }

      IMPORTANTE: El "mensaje_padres_entorno" es el campo MÁS IMPORTANTE. Debe ser un mensaje completo y positivo.
    `;

    console.log('🤖 Enviando contexto a Gemini para análisis de entorno...');

    // 4. Inicialización de Gemini
    // 5. Ejecución del Modelo
    const response = await callGroqSimple(
        'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.',
        fullContext,
        { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 2000 }
      );

    console.log('✅ Respuesta recibida de Gemini');
    
    // Verificar que la respuesta tenga texto
    const responseText = response;
    if (!responseText) {
      throw new Error("La IA no generó una respuesta válida");
    }
    
    console.log('📄 Texto raw:', responseText);

    // 6. Parsear Respuesta
    const analysisData = parseGeminiJSON(responseText);
    
    console.log('✅ JSON parseado exitosamente:', analysisData);

    // 7. Validación de Estructura de Salida
    if (!analysisData.impresion_general || !analysisData.mensaje_padres_entorno) {
      console.warn('⚠️ Respuesta de IA incompleta, usando valores por defecto');
      analysisData.impresion_general = analysisData.impresion_general || "El entorno del hogar muestra condiciones adecuadas para el desarrollo del niño.";
      analysisData.mensaje_padres_entorno = analysisData.mensaje_padres_entorno || "Gracias por recibirnos en su hogar. Trabajaremos juntos para optimizar el entorno de desarrollo.";
    }

    // 8. Retorno Exitoso
    return NextResponse.json({
      impresion_general: analysisData.impresion_general,
      mensaje_padres_entorno: analysisData.mensaje_padres_entorno,
      mensaje_padres: analysisData.mensaje_padres_entorno,  // alias for compatibility
      recomendaciones_espacio: analysisData.recomendaciones_espacio || "",
      recomendaciones_rutinas: analysisData.recomendaciones_rutinas || "",
      actividades_sugeridas: analysisData.actividades_sugeridas || "",
      actividades_casa: analysisData.actividades_sugeridas || "",  // alias matching form field id
    });

  } catch (error: any) {
    console.error('❌ Error completo en generate-home-environment-report:', error);
    
    // Manejo diferenciado de errores
    if (error.message?.includes('429') || error.message?.includes('Quota')) {
        return NextResponse.json({ error: 'El servicio de IA está saturado. Intente en unos minutos.' }, { status: 429 });
    }
    
    return NextResponse.json(
      { error: 'Error interno procesando el análisis del hogar.', details: error.message },
      { status: 500 }
    );
  }
}