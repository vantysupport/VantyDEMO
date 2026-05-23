// app/api/evaluacion-inicial/recomendar-terapias/route.ts
//
// La IA lee:
//   • Intake del padre
//   • 2ª anamnesis específica
//   • Recomendación clínica previa (psicológica / neuropsicológica)
//   • CATÁLOGO ACTIVO de terapias (lo que admin configuró)
//
// Devuelve un subconjunto del catálogo (2-4 terapias) priorizado, con
// un razonamiento corto y específico para esta familia.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroq, GROQ_MODELS } from '@/lib/groq-client'
import { buildClinicalContext } from '@/lib/ai-context-builder'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const SYSTEM_PROMPT = `Eres una neuropsicóloga clínica senior de SANTI (Perú). Vas a recomendar las terapias más adecuadas para un caso, eligiendo SOLO de la lista de terapias DISPONIBLES en nuestro centro (no inventes terapias que no estén en la lista).

CRITERIOS:
- Prioriza máximo 4 terapias (idealmente 2-3).
- Que tengan justificación clínica clara basada en los síntomas/hallazgos del intake y la 2ª anamnesis.
- Ordena por prioridad: la primera es la MÁS relevante para iniciar.
- Si una terapia no encaja claramente, NO la incluyas (mejor pocas y precisas).

DEBES responder ÚNICAMENTE con un JSON válido (sin markdown, sin \`\`\`) con este esquema EXACTO:

{
  "terapias_ids": ["uuid1", "uuid2", "..."],
  "razonamiento_por_terapia": [
    { "terapia_id": "uuid1", "por_que": "Texto CORTO (1-2 frases) dirigido al padre, en lenguaje sencillo, explicando por qué esta terapia ayudaría a SU HIJO específicamente (cita lo que mencionó)." }
  ],
  "razonamiento_general": "Párrafo corto (2-3 frases) que resume al padre por qué este combo de terapias es la mejor ruta para su caso. Lenguaje cálido, sin tecnicismos."
}`

function fmtRespuestas(obj: any): string {
  return Object.entries(obj || {})
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '—')
      return `- **${label}:** ${val}`
    })
    .join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id } = await req.json()
    if (!evaluacion_id) return NextResponse.json({ error: 'evaluacion_id requerido' }, { status: 400 })

    // 1. Cargar evaluación + paciente + catálogo activo
    const { data: eval_, error: e1 } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('*')
      .eq('id', evaluacion_id)
      .maybeSingle()
    if (e1) throw e1
    if (!eval_) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, name, birth_date, diagnosis')
      .eq('id', eval_.child_id)
      .maybeSingle()
    if (!child) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    const { data: catalogo } = await supabaseAdmin
      .from('terapias_catalogo')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true })

    if (!catalogo || catalogo.length === 0) {
      return NextResponse.json({
        error: 'El catálogo de terapias está vacío. Configura terapias en Admin → Recursos Adicionales → Catálogo Terapias.',
      }, { status: 400 })
    }

    // 2. Construir prompt
    const edad = child.birth_date
      ? Math.floor((Date.now() - new Date(child.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : 'desconocida'

    const recLabel = eval_.recomendacion === 'psicologica' ? 'Evaluación Psicológica Emocional'
                  : eval_.recomendacion === 'neuropsicologica' ? 'Evaluación Neuropsicológica'
                  : eval_.recomendacion === 'ambas' ? 'Evaluación Integral' : '—'

    const terapiasTxt = catalogo
      .map((t: any) => `### ID: ${t.id}
**Nombre:** ${t.nombre}
**Categoría:** ${t.categoria || '—'}
**Descripción:** ${t.descripcion || '—'}
**Para qué ayuda:** ${t.por_que || '—'}
**Modalidad:** ${t.modalidad}
**Duración:** ${t.duracion || '—'}`)
      .join('\n\n')

    // Cerebro IA: protocolos clínicos relevantes
    const queryKB = `${(child as any).diagnosis || ''} ${recLabel} terapia indicaciones objetivos ABLLS AFLS habilidades funcionales`
    const knowledgeCtx = await buildClinicalContext(queryKB, 8).catch(() => '')

    const userPrompt = `# CASO

**Paciente:** ${child.name}, ${edad} años
**Diagnóstico previo:** ${child.diagnosis || 'Ninguno'}
**Evaluación recomendada (paso anterior):** ${recLabel}
**Razonamiento clínico previo:**
${eval_.recomendacion_razon || '—'}

# RESPUESTAS DEL INTAKE
${fmtRespuestas(eval_.respuestas_intake)}

# RESPUESTAS DE LA 2ª ANAMNESIS
${fmtRespuestas(eval_.anamnesis_especifica)}

---

# CATÁLOGO DE TERAPIAS DISPONIBLES EN SANTI

${terapiasTxt}

---

${knowledgeCtx ? `\n# 📚 PROTOCOLOS Y GUÍAS CLÍNICAS DE REFERENCIA (Cerebro IA SANTI)\n${knowledgeCtx}\n` : ''}

Elige las 2-4 terapias del catálogo más adecuadas para este caso y devuelve el JSON solicitado. Usa los IDs EXACTOS de la lista de arriba. Si los protocolos clínicos arriba son relevantes para el caso (ABLLS-R, AFLS, etc.), úsalos para fundamentar tu razonamiento con criterios profesionales específicos.`

    // 3. Llamar al LLM
    const raw = await callGroq(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 1500 }
    )

    // 4. Parsear
    let parsed: any
    try {
      const clean = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
      const match = clean.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : clean)
    } catch {
      console.error('[recomendar-terapias] no se pudo parsear:', raw)
      return NextResponse.json({ error: 'IA devolvió formato inválido', raw: raw.slice(0, 400) }, { status: 502 })
    }

    // Validar IDs contra el catálogo
    const idsValidos = new Set((catalogo || []).map((t: any) => t.id))
    const terapiasIds = (parsed.terapias_ids || []).filter((id: string) => idsValidos.has(id))

    if (terapiasIds.length === 0) {
      return NextResponse.json({
        error: 'La IA no pudo seleccionar terapias válidas',
        parsed,
      }, { status: 502 })
    }

    // Componer razonamiento legible
    const porTerapia = parsed.razonamiento_por_terapia || []
    const razonamientoFmt = porTerapia
      .map((p: any) => {
        const t = catalogo.find((c: any) => c.id === p.terapia_id)
        if (!t) return ''
        return `**${t.nombre}:** ${p.por_que}`
      })
      .filter(Boolean)
      .join('\n\n')

    const razonamientoFinal = [
      parsed.razonamiento_general,
      razonamientoFmt,
    ].filter(Boolean).join('\n\n---\n\n')

    // 5. Guardar
    const ahora = new Date().toISOString()
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        terapias_recomendadas: terapiasIds,
        terapias_recomendadas_razon: razonamientoFinal,
        terapias_recomendadas_en: ahora,
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select()
      .single()
    if (upErr) throw upErr

    return NextResponse.json({
      ok: true,
      evaluacion: updated,
      terapias_ids: terapiasIds,
      razonamiento: razonamientoFinal,
    })
  } catch (e: any) {
    console.error('[recomendar-terapias]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
