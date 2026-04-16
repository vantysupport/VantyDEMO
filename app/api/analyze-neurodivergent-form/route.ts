// app/api/analyze-neurodivergent-form/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildAIContext, parseAIJson } from '@/lib/ai-context-builder'

const FORM_LABELS: Record<string, string> = {
  screening_tdah: 'Screening TDAH (Conners)',
  screening_tea: 'Screening TEA (M-CHAT/CAST)',
  conducta_casa_tdah: 'Conducta en Casa – TDAH',
  conducta_casa_tea: 'Conducta en Casa – TEA',
  perfil_sensorial: 'Perfil Sensorial',
  sensorial_avanzado: 'Perfil Sensorial Avanzado (Dunn)',
  habilidades_sociales: 'Habilidades Sociales',
  informe_padres_general: 'Informe General a Padres',
  historia_familiar: 'Historia Familiar',
  fba: 'Evaluación Funcional de Conducta (FBA)',
  bip: 'Plan de Intervención Conductual (BIP)',
  iep: 'Plan de Intervención Individual (IEP)',
  lenguaje_verbal: 'Evaluación Conducta Verbal (VB-MAPP)',
  informe_mensual_prog: 'Informe de Progreso Mensual',
  habilidades_adaptativas: 'Habilidades Adaptativas',
  abc_avanzado: 'Registro ABC Avanzado',
}

function getSpecializedInstructions(formType: string): string {
  const map: Record<string, string> = {
    fba: 'Analiza la función mantenedora según Malott: reforzamiento positivo (atención, tangible), negativo (escape/evitación), automático. Evalúa coherencia antecedente-consecuencia. Señala si se necesita análisis funcional análogo para confirmar hipótesis.',
    bip: 'Verifica coherencia función-intervención: el reforzador del BIP debe ser el MISMO que mantiene la conducta problemática. Cita IBAO Guideline 1.3 sobre intervención mínimamente invasiva. Señala trampas de reforzamiento accidental.',
    iep: 'Objetivos deben ser SMART con criterio de dominio cuantificable. Prioriza por impacto funcional en vida diaria. Verifica que horas de servicio sean acordes con nivel de soporte DSM-5.',
    lenguaje_verbal: 'Analiza perfil de operantes verbales (Sundberg): mando, tácto, ecoico, intraverbal, oyente. El déficit de mando es prioridad absoluta en VB. Sugiere jerarquía de intervención.',
    screening_tdah: 'Aplica criterios DSM-5-TR para TDAH: ≥6 síntomas en inatención Y/O hiperactividad, en ≥2 contextos, inicio antes de 12 años, impacto funcional. Distingue presentación e identifica diagnósticos diferenciales.',
    screening_tea: 'Aplica criterios DSM-5-TR para TEA: déficits en comunicación social (A1-A3) + ≥2 patrones restrictivos/repetitivos (B1-B4). Indica si se requiere ADOS-2 para confirmación y nivel de soporte.',
    abc_avanzado: 'La función requiere PATRONES repetidos, no un solo episodio. Analiza consistencia A-B-C para hipótesis funcional. Si es episodio único, indica que se necesitan más datos.',
    informe_mensual_prog: 'Evalúa tendencias: ¿hay generalización real o solo desempeño en sesión? ¿El ritmo de progreso es adecuado? ¿Hay meseta que requiera cambio de estrategia, reforzadores o criterio de dominio?',
    sensorial_avanzado: 'Aplica modelo de Dunn (1997): 4 cuadrantes (umbral neurológico × estrategia conductual). Sugiere dieta sensorial específica y adaptaciones de ambiente para el perfil identificado.',
    habilidades_adaptativas: 'Evalúa funcionamiento en vida diaria vs. nivel esperado para la edad. Identifica brechas funcionales prioritarias. Considera si déficits son consistentes con diagnóstico DSM-5 (criterio C para DI y TEA).',
  }
  return map[formType] || 'Analiza clínicamente los datos basándote en evidencia ABA y el contexto del paciente.'
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userLocale = body.locale || request.headers.get('x-locale') || 'es'
    const { formType, formData, childName, childAge, diagnosis, sessionContext, childId } = body


    const searchQuery = `${FORM_LABELS[formType] || formType} ${diagnosis || ''} evaluación ABA`
    const ctx = await buildAIContext(childId, childName, childAge ? String(childAge) : undefined, searchQuery)

    const prompt = `Eres un neuropsicólogo clínico y analista de conducta certificado (IBA) con 15+ años de experiencia.

INSTRUCCIONES ESPECIALIZADAS: ${getSpecializedInstructions(formType)}

CONTEXTO CLÍNICO:
${ctx.fullContext}

PACIENTE: ${ctx.childName}, ${ctx.childAge}
DIAGNÓSTICO: ${ctx.diagnosis || diagnosis || 'En evaluación'}
FORMULARIO: ${FORM_LABELS[formType] || formType}
${sessionContext ? `CONTEXTO EXTRA: ${sessionContext}` : ''}

DATOS DEL FORMULARIO:
${JSON.stringify(formData, null, 2)}

INSTRUCCIÓN: Si hay historial previo, menciona cambios vs. evaluaciones anteriores. Si la base de conocimiento tiene información relevante, cítala. El mensaje a padres usa el nombre "${ctx.childName}" y menciona algo concreto de sus respuestas.

Responde SOLO con JSON:
{
  "analisis_clinico": "análisis técnico detallado (3-5 párrafos)",
  "indicadores_clave": ["indicador con dato específico"],
  "nivel_alerta": "bajo|moderado|alto",
  "areas_fortaleza": ["fortaleza específica del paciente"],
  "areas_trabajo": ["área prioritaria con justificación"],
  "recomendaciones": ["recomendación accionable específica"],
  "mensaje_padres": "3-4 oraciones cálidas sin jerga técnica, con nombre del niño y dato específico",
  "formularios_recomendados": ["siguiente formulario recomendado"],
  "fuentes_clinicas": ["fuente citada si aplica"]
}`

    const rawText = await callGroqSimple('Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.', prompt, { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 2500 })
    const parsedResult = parseAIJson(rawText, {
      analisis_clinico: rawText,
      mensaje_padres: `El análisis de ${ctx.childName} está completo.`,
      nivel_alerta: 'bajo',
    })

    if (body.formId) {
      try {
        await supabaseAdmin.from('form_ai_analyses').insert([{
          form_id: body.formId,
          form_type: formType,
          child_name: ctx.childName,
          analysis: parsedResult,
          created_at: new Date().toISOString(),
        }])
      } catch (_) {}
    }

    return NextResponse.json({ success: true, analysis: parsedResult })
  } catch (error: any) {
    const isQuota = error.message === 'CUOTA_AGOTADA'
    return NextResponse.json({
      error: isQuota ? 'Cuota de IA agotada. Espera unos minutos.' : error.message,
    }, { status: isQuota ? 429 : 500 })
  }
}
