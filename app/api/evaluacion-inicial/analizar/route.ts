// app/api/evaluacion-inicial/analizar/route.ts
//
// Recibe el id de una evaluación inicial con `respuestas_intake` cargado,
// llama a un LLM clínico y guarda la recomendación (psicológica /
// neuropsicológica / ambas) + razonamiento detallado.
//
// El prompt está alineado con las dos anamnesis oficiales de Vanty ABA:
//  • Anamnesis Psicológica Emocional   → motivos socioemocionales/conductuales
//  • Anamnesis Neuropsicológica        → atención, memoria, lenguaje,
//                                        aprendizaje, indicadores neurodiversidad

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroq, GROQ_MODELS } from '@/lib/groq-client'
import { buildClinicalContext } from '@/lib/ai-context-builder'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres una neuropsicóloga clínica senior de Vanty ABA (Vanty ABA, Perú). Tu rol es analizar la ficha inicial (intake) que llenó un padre/madre sobre su hijo/a y recomendar entre:

1. **Evaluación Psicológica Emocional** — cuando el motivo principal son dificultades emocionales, conductuales o sociales (ansiedad, tristeza, irritabilidad, problemas vinculares, miedos, conflictos en casa o colegio, autoestima, regulación emocional, eventos vitales estresantes). Permite diseñar estrategias de acompañamiento y bienestar emocional.

2. **Evaluación Neuropsicológica** — cuando hay indicadores de neurodiversidad, dificultades cognitivas o de aprendizaje (atención sostenida/dividida, memoria, lenguaje expresivo/comprensivo, lectoescritura, cálculo, funciones ejecutivas, rendimiento escolar bajo, sospecha de TDAH/TEA/Dificultades Específicas del Aprendizaje, antecedentes médicos relevantes como prematuridad/convulsiones/golpes en la cabeza/retraso del desarrollo motor o del habla).

3. **Ambas** — solo cuando el caso muestra señales fuertes en los DOS frentes y conviene una mirada integral. Sé prudente: la mayoría de casos se resuelven con una sola.

Criterios clínicos clave:
- Hitos del desarrollo retrasados (gateo, marcha, palabras, frases) → neuropsicológica
- Historia médica perinatal complicada, convulsiones, traumas craneales → neuropsicológica
- Bajo rendimiento escolar, problemas de atención/concentración → neuropsicológica
- Conductas repetitivas, dificultad social, intereses restringidos → neuropsicológica
- Tristeza persistente, ansiedad, miedos, llanto frecuente → psicológica
- Cambios conductuales tras un evento (mudanza, separación, duelo, bullying) → psicológica
- Problemas de regulación emocional, berrinches a edad inapropiada → psicológica
- Conflictos familiares marcados, dificultad para vincularse → psicológica

DEBES responder ÚNICAMENTE con un JSON válido (sin markdown, sin \`\`\`) con este esquema EXACTO:

{
  "recomendacion": "psicologica" | "neuropsicologica" | "ambas",
  "mensaje_amigable_padre": "Mensaje CORTO (2-3 párrafos) dirigido DIRECTAMENTE al padre/madre en segunda persona ('Hola, hemos revisado lo que nos contaste sobre [hijo]…'). Lenguaje sencillo, cercano, SIN tecnicismos, SIN nombres de pruebas, SIN diagnósticos. Explica QUÉ tipo de evaluación recomendamos y POR QUÉ en términos cotidianos (ej: 'porque mencionaste que le cuesta concentrarse en clase'). Termina invitando a aceptar para continuar. NO menciones la palabra 'IA' ni 'algoritmo'.",
  "razonamiento_clinico": "[USO INTERNO - SOLO PARA EL ESPECIALISTA] Análisis detallado en markdown (3-6 párrafos) con observaciones técnicas, hipótesis diagnósticas, áreas a evaluar a profundidad. Tono profesional clínico.",
  "areas_a_evaluar": ["Área 1", "Área 2", "..."],
  "señales_detectadas": [
    { "categoria": "Desarrollo / Académica / Emocional / Social / Médica", "descripcion": "Texto corto" }
  ],
  "urgencia": "baja" | "media" | "alta"
}`

function buildUserPrompt(child: any, respuestas: any) {
  const edad = child.birth_date
    ? Math.floor((Date.now() - new Date(child.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 'desconocida'

  // Formatear respuestas de forma legible
  const respuestasTexto = Object.entries(respuestas || {})
    .map(([k, v]) => {
      const label = k
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '—')
      return `**${label}:** ${val}`
    })
    .join('\n')

  return `# Ficha Inicial — Paciente

**Nombre:** ${child.name || '—'}
**Edad:** ${edad} años
**Fecha nacimiento:** ${child.birth_date || '—'}
**Diagnóstico previo:** ${child.diagnosis || 'Ninguno reportado'}

# Respuestas del intake (llenado por el padre/madre)

${respuestasTexto}

---

Analiza este caso siguiendo el esquema JSON solicitado. Sé clínicamente riguroso y cita evidencia concreta del intake.`
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    // 1. Cargar evaluación + datos del paciente
    const { data: eval_, error: evalErr } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (evalErr) throw evalErr
    if (!eval_) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })
    if (!eval_.respuestas_intake) {
      return NextResponse.json({ error: 'El intake aún no está completado' }, { status: 400 })
    }

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, name, birth_date, diagnosis')
      .eq('id', eval_.child_id)
      .maybeSingle()
    if (!child) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // 2. Recuperar conocimiento clínico relevante del Cerebro IA
    //    (ABLLS-R, AFLS, guías clínicas, etc. — lo que el admin haya subido)
    const motivoConsulta = String(eval_.respuestas_intake?.motivo_principal || '')
    const queryConocimiento = `${motivoConsulta} ${(child as any).diagnosis || ''} indicadores TEA TDAH neurodesarrollo evaluación`
    const knowledgeCtx = await buildClinicalContext(queryConocimiento, 8).catch(() => '')

    // 3. Llamar al LLM
    const userPrompt = buildUserPrompt(child, eval_.respuestas_intake) +
      (knowledgeCtx ? `\n\n# 📚 CONOCIMIENTO CLÍNICO RELEVANTE (ABLLS-R, AFLS, protocolos)\n${knowledgeCtx}\n\nUsa estos protocolos y guías para fundamentar tu recomendación con criterios clínicos específicos.` : '')
    const raw = await callGroq(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { model: GROQ_MODELS.SMART, temperature: 0.35, maxTokens: 2200 }
    )

    // 3. Parsear JSON con tolerancia (a veces el modelo agrega ```json...```)
    let parsed: any
    try {
      const clean = raw
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/i, '')
        .trim()
      // intentar extraer el primer bloque {...}
      const match = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : clean)
    } catch (e) {
      console.error('[analizar] No se pudo parsear JSON:', raw)
      return NextResponse.json({
        error: 'La IA devolvió una respuesta no parseable. Intenta de nuevo.',
        raw: raw.slice(0, 500),
      }, { status: 502 })
    }

    const rec = String(parsed.recomendacion || '').toLowerCase()
    if (!['psicologica', 'neuropsicologica', 'ambas'].includes(rec)) {
      return NextResponse.json({ error: 'Recomendación inválida del modelo', parsed }, { status: 502 })
    }

    // 4. Guardar en la evaluación
    const ahora = new Date().toISOString()
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        recomendacion: rec,
        mensaje_amigable_padre: parsed.mensaje_amigable_padre || null,
        recomendacion_resumen: parsed.mensaje_amigable_padre || null,  // backward compat
        recomendacion_razon: parsed.razonamiento_clinico || null,
        recomendacion_areas: {
          areas_a_evaluar: parsed.areas_a_evaluar || [],
          señales_detectadas: parsed.señales_detectadas || [],
          urgencia: parsed.urgencia || 'media',
        },
        recomendacion_generada_en: ahora,
        recomendacion_modelo: GROQ_MODELS.SMART,
        estado: 'recomendado',
        updated_at: ahora,
      })
      .eq('id', id)
      .select()
      .single()
    if (upErr) throw upErr

    return NextResponse.json({ ok: true, evaluacion: updated, parsed })
  } catch (e: any) {
    console.error('[evaluacion-inicial][analizar]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
