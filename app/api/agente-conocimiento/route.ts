// app/api/agente-conocimiento/route.ts
// 🏆 CAPA 4 — Knowledge Base que APRENDE de todos los pacientes
// Extrae aprendizajes anonimizados de cada sesión, los almacena como
// conocimiento colectivo del centro y los usa para mejorar futuros tratamientos
// SIN violar privacidad (no guarda nombres, solo patrones clínicos)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'

// ── POST /api/agente-conocimiento?accion=aprender ────────────────────────────
// Procesa una sesión y extrae conocimiento anonimizado
async function aprenderDeSesion(sesionId: string, childId: string): Promise<any> {
  const { data: sesion } = await supabaseAdmin
    .from('registro_aba')
    .select('datos, fecha_sesion')
    .eq('id', sesionId)
    .single()

  const { data: child } = await supabaseAdmin
    .from('children')
    .select('age, diagnosis')
    .eq('id', childId)
    .single()

  if (!sesion) return null

  const d = sesion.datos
  const diagnostico = (child as any)?.diagnosis || 'TEA'
  const edad = (child as any)?.age || 'N/A'

  // Extraer conocimiento sin PII (Personally Identifiable Information)
  const prompt = `Eres un extractor de conocimiento clínico ABA. Analiza esta sesión y extrae aprendizajes ANONIMIZADOS y GENERALIZABLES.

DATOS DE SESIÓN (anonimizados):
- Diagnóstico general: ${diagnostico}
- Edad aproximada: ${edad} años
- Objetivo trabajado: ${d?.objetivo_principal || 'N/A'}
- Habilidades: ${JSON.stringify(d?.habilidades_objetivo || [])}
- Técnicas aplicadas: ${JSON.stringify(d?.tecnicas_aplicadas || [])}
- Reforzadores efectivos: ${d?.reforzadores_efectivos || 'N/A'}
- Conductas desafiantes: ${d?.conductas_desafiantes || 'Ninguna'}
- Estrategias de manejo: ${d?.estrategias_manejo || 'N/A'}
- Nivel de logro: ${d?.nivel_logro_objetivos || 'N/A'}
- Atención: ${d?.nivel_atencion}/5
- Avances: ${d?.avances_observados || 'N/A'}
- Alertas: ${d?.alertas_clinicas || 'Ninguna'}

Extrae exactamente esto en JSON (SIN nombres, SIN datos que identifiquen al paciente):
{
  "patron_efectivo": "qué funcionó bien y por qué (1-2 oraciones técnicas)",
  "patron_desafio": "qué fue difícil y la hipótesis clínica (1 oración, null si no hubo)",
  "tecnica_ganadora": "la técnica más efectiva de esta sesión (null si no clara)",
  "reforzador_tipo": "categoría del reforzador (social/tangible/actividad/mixto)",
  "area_intervencion": "el área principal trabajada",
  "perfil_paciente": "descripción del perfil SIN nombre: edad+diagnóstico+característica clave",
  "aprendizaje_transferible": "qué puede aprender otro terapeuta de esta sesión (1 oración)",
  "nivel_complejidad": "bajo/medio/alto",
  "tags": ["lista", "de", "tags", "clínicos"]
}
SOLO JSON, sin texto adicional.
`


  // ━━━ CEREBRO IA: buscar conocimiento clínico relevante ━━━


  let _cerebroCtx = ''


  try {


    const _query = 'conocimiento clínico ABA aprendizaje sesión'


    const _kb = await buildAIContext(undefined, undefined, undefined, _query)


    _cerebroCtx = _kb.knowledgeContext


  } catch { /* Cerebro IA no disponible */ }


  // ━━━ FIN CEREBRO IA ━━━


  const respuestaRaw = await callGroqSimple('Eres un extractor de conocimiento clínico ABA que genera aprendizajes anonimizados para bases de conocimiento terapéutico. Fundamenta tus respuestas con los libros del Cerebro IA cuando estén disponibles.',
    prompt,
    { model: GROQ_MODELS.FAST, temperature: 0.2, maxTokens: 600 }
  )

  let conocimiento: any = null
  try {
    const clean = respuestaRaw.replace(/```json\n?|\n?```/g, '').trim()
    conocimiento = JSON.parse(clean)
  } catch {
    return null
  }

  // Guardar en la KB anonimizada
  const { data: guardado } = await supabaseAdmin
    .from('conocimiento_clinico')
    .insert({
      area_intervencion: conocimiento.area_intervencion,
      patron_efectivo: conocimiento.patron_efectivo,
      patron_desafio: conocimiento.patron_desafio,
      tecnica_ganadora: conocimiento.tecnica_ganadora,
      reforzador_tipo: conocimiento.reforzador_tipo,
      perfil_paciente: conocimiento.perfil_paciente,
      aprendizaje_transferible: conocimiento.aprendizaje_transferible,
      nivel_complejidad: conocimiento.nivel_complejidad,
      tags: conocimiento.tags,
      votos_util: 0,
      sesion_fecha: sesion.fecha_sesion,
      created_at: new Date().toISOString()
    })
    .select('id')
    .single()

  return { conocimiento, id: (guardado as any)?.id }
}

// ── POST /api/agente-conocimiento?accion=consultar ───────────────────────────
// Consulta conocimiento relevante para una situación clínica específica
async function consultarConocimiento(consulta: string, area?: string, diagnostico?: string): Promise<any> {
  // Buscar en KB por área o tags (búsqueda simple sin embeddings)
  let query = supabaseAdmin
    .from('conocimiento_clinico')
    .select('*')
    .order('votos_util', { ascending: false })
    .limit(20)

  if (area) query = query.ilike('area_intervencion', `%${area}%`)

  const { data: entradas } = await query

  if (!entradas || entradas.length === 0) {
    return { respuesta: 'No hay suficiente conocimiento acumulado aún. Registra más sesiones para que el sistema aprenda.', entradas: [] }
  }

  // Usar IA para seleccionar y sintetizar las más relevantes
  const contexto = entradas.slice(0, 8).map((e, i) =>
    `[${i+1}] Área: ${e.area_intervencion} | Perfil: ${e.perfil_paciente}
Técnica ganadora: ${e.tecnica_ganadora || 'N/A'}
Lo que funcionó: ${e.patron_efectivo}
Aprendizaje: ${e.aprendizaje_transferible}
Tags: ${e.tags?.join(', ')}`
  ).join('\n\n')

  const respuesta = await callGroqSimple(
    'Eres un supervisor clínico ABA que usa el conocimiento acumulado del centro para dar recomendaciones a terapeutas.',
    `CONSULTA DEL TERAPEUTA: "${consulta}"
${area ? `Área de interés: ${area}` : ''}
${diagnostico ? `Diagnóstico del paciente: ${diagnostico}` : ''}

CONOCIMIENTO ACUMULADO DEL CENTRO (anonimizado):
${contexto}

Basándote en el conocimiento real del centro, responde la consulta del terapeuta con:
1. LAS 2-3 TÉCNICAS MÁS RELEVANTES para esta situación (con evidencia del centro)
2. QUÉ HA FUNCIONADO en casos similares según nuestros datos
3. UNA ADVERTENCIA si hay patrones de desafío conocidos
4. RECOMENDACIÓN CONCRETA para implementar hoy

Tono: colega experto, directo, práctico. Máximo 250 palabras.`,
    { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 600 }
  )

  return {
    respuesta,
    entradas_usadas: entradas.length,
    entradas: entradas.slice(0, 5)
  }
}

// ── GET: Estadísticas de la Knowledge Base ───────────────────────────────────

// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accion = searchParams.get('accion') || 'estadisticas'

  try {
    if (accion === 'estadisticas') {
      const { data: entradas, count } = await supabaseAdmin
        .from('conocimiento_clinico')
        .select('area_intervencion, tecnica_ganadora, reforzador_tipo, nivel_complejidad', { count: 'exact' })
        .limit(500)

      const areas: Record<string, number> = {}
      const tecnicas: Record<string, number> = {}
      const reforzadores: Record<string, number> = {}

      entradas?.forEach(e => {
        if (e.area_intervencion) areas[e.area_intervencion] = (areas[e.area_intervencion] || 0) + 1
        if (e.tecnica_ganadora) tecnicas[e.tecnica_ganadora] = (tecnicas[e.tecnica_ganadora] || 0) + 1
        if (e.reforzador_tipo) reforzadores[e.reforzador_tipo] = (reforzadores[e.reforzador_tipo] || 0) + 1
      })

      const topTecnicas = Object.entries(tecnicas)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, n]) => ({ tecnica: t, usos: n }))

      return NextResponse.json({
        total_aprendizajes: count || 0,
        areas_cubiertas: Object.keys(areas).length,
        top_tecnicas: topTecnicas,
        distribucion_areas: areas,
        distribucion_reforzadores: reforzadores,
        mensaje: count && count > 10
          ? `El centro tiene ${count} aprendizajes clínicos acumulados de sus sesiones.`
          : 'La base de conocimiento está creciendo. Registra más sesiones para potenciar el aprendizaje colectivo.'
      })
    }

    return NextResponse.json({ error: 'accion no reconocida' }, { status: 400 })

  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const accion = searchParams.get('accion') || 'consultar'

  try {
    const body = await req.json()
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'

    if (accion === 'aprender') {
      const { sesionId, childId } = body
      if (!sesionId || !childId) return NextResponse.json({ error: 'sesionId y childId requeridos' }, { status: 400 })
      const resultado = await aprenderDeSesion(sesionId, childId)
      return NextResponse.json({ ok: !!resultado, resultado })
    }

    if (accion === 'consultar') {
      const { consulta, area, diagnostico } = body
      if (!consulta) return NextResponse.json({ error: 'consulta requerida' }, { status: 400 })
      const resultado = await consultarConocimiento(consulta, area, diagnostico)
      return NextResponse.json(resultado)
    }

    if (accion === 'votar') {
      const { entradaId, util } = body
      const { data: entrada } = await supabaseAdmin.from('conocimiento_clinico').select('votos_util').eq('id', entradaId).single()
      const votos = ((entrada as any)?.votos_util || 0) + (util ? 1 : -1)
      await supabaseAdmin.from('conocimiento_clinico').update({ votos_util: Math.max(0, votos) }).eq('id', entradaId)
      return NextResponse.json({ ok: true, votos_util: Math.max(0, votos) })
    }

    return NextResponse.json({ error: 'accion no reconocida' }, { status: 400 })

  } catch (e: any) {
    console.error('❌ Error agente-conocimiento:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
