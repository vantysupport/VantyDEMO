import { NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildAIContext } from '@/lib/ai-context-builder';


// Helper: reintentar con backoff exponencial ante rate limit


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const userLocale = body.locale || req.headers.get('x-locale') || 'es';

    // Compatibilidad con llamadas antiguas (solo ABC) y nuevas (formulario completo)
    const {
      // Sección 1: Información de la sesión
      fecha_sesion, duracion_minutos, tipo_sesion, objetivo_principal,
      // Sección 2: Registro ABC
      antecedente, conducta, consecuencia, funcion_estimada,
      // Sección 3: Métricas
      nivel_atencion, respuesta_instrucciones, iniciativa_comunicativa,
      tolerancia_frustracion, interaccion_social,
      // Sección 4: Habilidades
      habilidades_objetivo, nivel_logro_objetivos, ayudas_utilizadas,
      // Sección 5: Intervenciones
      tecnicas_aplicadas, reforzadores_efectivos, conductas_desafiantes, estrategias_manejo,
      // Paciente
      childName, childAge, childId,
    } = body;

    // ── Construir contexto completo con RAG + historial + centro ─────────────
    const sessionQuery = `sesión ABA ${tipo_sesion || ''} ${conducta || ''} ${funcion_estimada || ''} intervención conductual`
    const aiCtx = await buildAIContext(childId, childName, childAge ? String(childAge) : undefined, sessionQuery)
    const nombreNino = aiCtx.childName
    const edadNino = aiCtx.childAge

    if (!conducta && !antecedente) {
      return NextResponse.json({ error: "Faltan datos del registro ABA." }, { status: 400 });
    }

    // ── Traer productos activos de la tienda ──────────────────────────────────
    const { data: productos } = await supabaseAdmin
      .from('store_products')
      .select('id, nombre, descripcion, precio_soles, tipo, categoria, imagen_url')
      .eq('activo', true)
      .gt('stock', 0)
      .order('destacado', { ascending: false })
      .limit(12);

    const productosTexto = productos && productos.length > 0
      ? `\nPRODUCTOS EN NUESTRA TIENDA (sugiere UNO solo si realmente ayuda a la tarea en casa):\n` +
        productos.map((p, i) =>
          `${i + 1}. ID:"${p.id}" | "${p.nombre}" | S/${p.precio_soles} | ${p.tipo} | ${p.descripcion || ''}`
        ).join('\n')
      : '';

    // ── Prompt neuropsicológico profesional ──────────────────────────────────

    const context = `
ACTÚA COMO: Neuropsicólogo clínico infantil supervisor y analista de conducta (IBA) con 15+ años de experiencia.

CONTEXTO CLÍNICO COMPLETO (historial, protocolos del centro, conocimiento clínico):
${aiCtx.fullContext}

PACIENTE: ${nombreNino}, ${edadNino} años. ⚠️ IMPORTANTE: Usa EXACTAMENTE este nombre y esta edad — son datos reales del expediente.

DATOS DE LA SESIÓN:
━━━ SECCIÓN 1: INFORMACIÓN ━━━
- Fecha: ${fecha_sesion || 'N/E'}
- Duración: ${duracion_minutos || 'N/E'} minutos
- Tipo: ${tipo_sesion || 'N/E'}
- Objetivo principal: ${objetivo_principal || 'N/E'}

━━━ SECCIÓN 2: REGISTRO ABC ━━━
- Antecedente (A): ${antecedente || 'N/E'}
- Conducta (B): ${conducta || 'N/E'}
- Consecuencia (C): ${consecuencia || 'N/E'}
- Función estimada: ${funcion_estimada || 'N/E'}

━━━ SECCIÓN 3: MÉTRICAS (escala 1-5) ━━━
- Atención sostenida: ${nivel_atencion || 'N/E'}/5
- Respuesta a instrucciones: ${respuesta_instrucciones || 'N/E'}/5
- Iniciativa comunicativa: ${iniciativa_comunicativa || 'N/E'}/5
- Tolerancia a frustración: ${tolerancia_frustracion || 'N/E'}/5
- Interacción social: ${interaccion_social || 'N/E'}/5

━━━ SECCIÓN 4: HABILIDADES ━━━
- Habilidades trabajadas: ${Array.isArray(habilidades_objetivo) ? habilidades_objetivo.join(', ') : (habilidades_objetivo || 'N/E')}
- Nivel de logro: ${nivel_logro_objetivos || 'N/E'}
- Nivel de ayudas: ${ayudas_utilizadas || 'N/E'}

━━━ SECCIÓN 5: INTERVENCIONES ━━━
- Técnicas aplicadas: ${Array.isArray(tecnicas_aplicadas) ? tecnicas_aplicadas.join(', ') : (tecnicas_aplicadas || 'N/E')}
- Reforzadores efectivos: ${reforzadores_efectivos || 'N/E'}
- Conductas desafiantes: ${conductas_desafiantes || 'N/E'}
- Estrategias de manejo: ${estrategias_manejo || 'N/E'}
${productosTexto}

TAREA PRINCIPAL: Genera el análisis clínico completo Y el reporte profesional para los padres, EN DOS PARTES SEPARADAS.

REGLAS ESTRICTAS:
- "patron_aprendizaje" DEBE ser EXACTAMENTE uno de: "Aprendizaje rápido y generalización", "Aprendizaje gradual", "Requiere repetición intensiva", "Dificultad para generalizar", "Aprendizaje inconsistente"
- "coordinacion_familia" DEBE ser EXACTAMENTE uno de: "Urgente", "Necesaria", "Rutinaria", "No necesaria"
- "efectividad_sesion" DEBE ser número entero 1-5
- USA el historial previo para contextualizar: menciona si hay progreso, regresión o consistencia respecto a sesiones anteriores.

- "mensaje_padres": Mensaje SOLO emocional/informativo. 6-8 oraciones, SIN actividades en casa. Estructura:
  1. Saludo cálido usando el nombre real del niño/a
  2. Qué se trabajó hoy (lenguaje accesible, no técnico)
  3. 2-3 logros específicos observados HOY, comparando con historial si hay
  4. Una fortaleza destacada
  5. Un área que seguimos trabajando y por qué importa
  6. Qué reportar en la próxima sesión
  7. Mensaje motivador para la familia
  8. Firma "Con afecto y compromiso, Equipo Neuropsicología y Terapias SANTI"
  ⚠️ PROHIBIDO incluir actividades para casa aquí.

- "actividades_casa": UNA SOLA actividad terapéutica para el hogar, basada exactamente en lo trabajado HOY. Formato exacto:
  "Actividad: [Nombre descriptivo]
   Objetivo: [qué habilidad trabaja]
   Cómo hacerlo:
   1. [paso]
   2. [paso]
   3. [paso]
   Frecuencia: [X veces por semana, X-X minutos]
   Qué observar: [qué reportar en próxima sesión]"

- "destacar_positivo": exactamente 3-5 logros separados por " | "
- "instrucciones_padres": pasos numerados de la actividad en casa (mismo contenido que actividades_casa pero como lista)
- Para "producto_sugerido": ID exacto si aplica, si no null
- Usa el nombre real del niño. Sé ESPECÍFICO. NO generes texto genérico.

Responde SOLAMENTE con JSON válido (sin texto adicional, sin backticks, sin comentarios):
{
  "avances_observados": "descripción clínica detallada de avances observados en sesión",
  "areas_dificultad": "descripción clínica de áreas que requieren más intervención",
  "patron_aprendizaje": "Aprendizaje gradual",
  "observaciones_tecnicas": "notas técnicas relevantes para el equipo terapéutico",
  "alertas_clinicas": "alertas o banderas rojas identificadas, o Sin alertas clínicas significativas",
  "recomendaciones_equipo": "recomendaciones específicas para el equipo interdisciplinario",
  "coordinacion_familia": "Rutinaria",
  "actividad_casa": "Actividad: [nombre]\n Objetivo: [objetivo]\n Cómo hacerlo:\n 1. [paso]\n 2. [paso]\n 3. [paso]\n Frecuencia: [frecuencia]\n Qué observar: [observación]",
  "instrucciones_padres": "1. [paso]\n2. [paso]\n3. [paso]",
  "objetivo_tarea": "objetivo conductual y neuropsicológico de la actividad en casa",
  "mensaje_padres": "Estimados papás de [Nombre real],\n\n[6-8 oraciones cálidas e informativas SIN actividades para casa]\n\nCon afecto y compromiso,\nEquipo Neuropsicología y Terapias SANTI",
  "destacar_positivo": "Logro 1 | Logro 2 | Logro 3",
  "proximos_pasos": "En las próximas sesiones continuaremos...",
  "efectividad_sesion": 4,
  "ajustes_proxima_sesion": "ajustes técnicos para próxima sesión",
  "necesidades_materiales": "materiales necesarios para próximas sesiones",
  "observaciones_clinicas": "observaciones clínicas adicionales",
  "analisis_abc": "análisis funcional clínico ABC",
  "justificacion": "justificación clínica de las intervenciones",
  "mentoring_interno": "notas de supervisión interna",
  "actividad_realizada": "descripción de la actividad principal realizada en sesión",
  "red_flags": "NO",
  "barreras": "barreras identificadas para el aprendizaje",
  "tarea_hogar": "resumen ejecutivo de la tarea para el hogar",
  "producto_sugerido": null,
  "razon_sugerencia": null
}`;

    const response = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', context, { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 2000 })

    // Sanitizar JSON: eliminar caracteres de control que Groq a veces incluye
    const safeJson = (response || '{}')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // control chars
      .replace(/\n/g, '\\n')                            // literal newlines → \n
      .replace(/\r/g, '\\r')                            // literal CR → \r
      .replace(/\t/g, '\\t')                            // literal tab → \t
    let responseData: any = {}
    try {
      responseData = JSON.parse(safeJson)
    } catch {
      // Si falla, intentar extracción directa del bloque JSON
      const match = (response || '').match(/\{[\s\S]*\}/)
      if (match) {
        try { responseData = JSON.parse(match[0].replace(/[\x00-\x1F\x7F]/g, ' ')) }
        catch { responseData = { avances_observados: response || 'Error procesando respuesta' } }
      }
    }

    // Enriquecer con info completa del producto si la IA eligió uno
    if (responseData.producto_sugerido && productos) {
      const prod = productos.find((p: any) => p.id === responseData.producto_sugerido);
      if (prod) {
        responseData.producto_sugerido_info = {
          id: prod.id,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precio_soles: prod.precio_soles,
          tipo: prod.tipo,
          imagen_url: prod.imagen_url,
          razon: responseData.razon_sugerencia,
        };
      } else {
        responseData.producto_sugerido = null;
        responseData.producto_sugerido_info = null;
      }
    }

    // Asegurar que efectividad_sesion sea número entero válido (1-5)
    if (responseData.efectividad_sesion !== undefined) {
      const ef = parseInt(String(responseData.efectividad_sesion), 10);
      responseData.efectividad_sesion = isNaN(ef) ? 3 : Math.min(5, Math.max(1, ef));
    }

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Error Gemini session report:", error);
    return NextResponse.json({ error: "Error procesando el reporte: " + error.message }, { status: 500 });
  }
}
