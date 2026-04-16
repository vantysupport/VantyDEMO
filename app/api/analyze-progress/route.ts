import { NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(req: Request) {
  try {
    // 1. Validación de entrada
    const body = await req.json()
    const userLocale = body.locale || req.headers.get('x-locale') || 'es';
    const { childId } = body;

    if (!childId) {
      return NextResponse.json({ error: "Falta el ID del paciente (childId)" }, { status: 400 });
    }


    // 2. Obtener sesiones con FECHA
    const { data: sessions, error: dbError } = await supabase
      .from('registro_aba')
      .select('fecha_sesion, datos') 
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(10);

    if (dbError) throw new Error(dbError.message);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ error: "No hay sesiones suficientes para analizar." });
    }

    // 3. Configurar Gemini con la nueva librería
    // 4. Prompt Estructurado
    const prompt = `
      Eres un analista clínico experto en terapia ABA.
      CONTEXTO: ${JSON.stringify(sessions)}
      TAREA: Calcula progreso (0-100) en: verbal, emocional, social.
      Responde SOLAMENTE este JSON exacto:
      { "verbal": number, "emocional": number, "social": number }`;

    // 5. Generar Análisis - Se asegura que el modelo sea un string fijo

    // ━━━ CEREBRO IA: buscar conocimiento clínico relevante ━━━

    let _cerebroCtx = ''

    try {

      const _query = 'progreso ABA análisis avance habilidades'

      const _kb = await buildAIContext(undefined, undefined, undefined, _query)

      _cerebroCtx = _kb.knowledgeContext

    } catch { /* Cerebro IA no disponible */ }

    // ━━━ FIN CEREBRO IA ━━━

    const response = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo. Fundamenta tus respuestas con los libros del Cerebro IA cuando estén disponibles.',
        prompt as string,
        { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 2000 }
      );

    // 6. Obtener y parsear el texto de la respuesta con validación
    const responseText = response || "{}";
    const data = JSON.parse(responseText);

    // 7. Guardar resultados en Supabase
    const { error: updateError } = await supabase
      .from('children')
      .update({
        progress_verbal: data.verbal || 0,
        progress_emotional: data.emocional || 0,
        progress_social: data.social || 0
      })
      .eq('id', childId);

    if (updateError) {
      console.error("Error actualizando DB:", updateError);
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Error en API Progress:", error);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}