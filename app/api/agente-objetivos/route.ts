// app/api/agente-objetivos/route.ts
// 🧠 CAPA 1 — Sub-agente: Generador de Objetivos Adaptativos
// Analiza el progreso actual y genera/ajusta objetivos terapéuticos automáticamente
// basándose en el nivel de dominio, patrones detectados y mejores prácticas ABA

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json()
    const userLocale = rawBody.locale || req.headers.get('x-locale') || 'es'
    const { childId, childName, accion = 'generar' } = rawBody
    // accion: 'generar' | 'ajustar' | 'evaluar_dominio'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    // Cargar datos del paciente
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis')
      .eq('id', childId)
      .single()

    // Programas ABA activos con sus objetivos
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('id, titulo, area, fase_actual, estado, criterio_dominio_pct, objetivos_cp(id, nombre, estado, numero_set)')
      .eq('child_id', childId)
      .not('estado', 'in', '("archivado","alta","dado_de_alta","inactivo","cancelado")')
      .order('created_at', { ascending: false })
      .limit(10)

    // Últimas 8 sesiones para contexto
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(8)

    // Patrones detectados recientes
    const { data: patronesData } = await supabaseAdmin
      .from('patrones_detectados')
      .select('patrones, analisis_ia')
      .eq('child_id', childId)
      .single()

    const nombre = (child as any)?.name || childName || 'Paciente'
    const diagnostico = (child as any)?.diagnosis || 'No especificado'
    const edad = (child as any)?.age || 'N/A'

    // Calcular tasa de dominio por programa
    const resumenProgramas = programas?.map(p => {
      const objetivos = (p as any).objetivos_cp || []
      const total = objetivos.length
      // Lógica en cascada: mismo criterio que padre/stats
      // Nivel 1: estado === 'dominado' en el set individual
      // Nivel 2: el programa completo está dominado → todos sus sets son logrados
      const progDominado = p.estado === 'dominado'
      const dominados = progDominado
        ? total
        : objetivos.filter((o: any) => o.estado === 'dominado').length
      return {
        titulo: p.titulo,
        area: p.area,
        fase: p.fase_actual,
        estado: p.estado,
        pct_dominio: total > 0 ? Math.round((dominados / total) * 100) : (progDominado ? 100 : 0),
        dominados,
        total,
        criterio: p.criterio_dominio_pct || 80
      }
    }) || []

    // Resumen sesiones recientes
    const resumenSesiones = sesiones?.slice(0, 5).map(s => ({
      fecha: s.fecha_sesion,
      objetivo: s.datos?.objetivo_principal || 'N/A',
      logro: s.datos?.nivel_logro_objetivos || 'N/A',
      habilidades: s.datos?.habilidades_objetivo || [],
      avances: s.datos?.avances_observados || ''
    })) || []

    const patrones = (patronesData as any)?.patrones || []
    const patronesUrgentes = patrones.filter((p: any) =>
      p.tipo === 'estancamiento' || p.tipo === 'regresion'
    )

    // Prompt según acción
    let promptBase = ''

    if (accion === 'evaluar_dominio') {
      promptBase = `Evalúa si los siguientes programas ABA están listos para avanzar de fase o cerrar por dominio.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

PROGRAMAS ACTIVOS:
${resumenProgramas.map(p => `- "${p.titulo}" (${p.area}): ${p.pct_dominio}% dominado (${p.dominados}/${p.total} objetivos), fase: ${p.fase}, criterio: ${p.criterio}%`).join('\n')}

ÚLTIMAS SESIONES:
${resumenSesiones.map(s => `- ${s.fecha}: objetivo="${s.objetivo}", logro=${s.logro}`).join('\n')}

Para cada programa, indica:
1. ESTADO: listo_para_avanzar / mantener / necesita_ajuste
2. ACCIÓN: qué hacer específicamente (avanzar fase, cerrar, ajustar criterio)
3. JUSTIFICACIÓN: 1 oración clínica
4. SIGUIENTE PASO: objetivo concreto del siguiente nivel

Responde en JSON con array "evaluaciones": [{programa, estado, accion, justificacion, siguiente_paso}]
SOLO JSON, sin markdown.`

    } else if (accion === 'ajustar') {
      promptBase = `Ajusta los objetivos terapéuticos actuales basándote en los patrones detectados.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

PATRONES PROBLEMÁTICOS DETECTADOS:
${patronesUrgentes.map((p: any) => `- [${p.tipo}] ${p.area}: ${p.descripcion}`).join('\n') || 'Ninguno detectado'}

PROGRAMAS ACTIVOS:
${resumenProgramas.map(p => `- "${p.titulo}" (${p.area}): fase ${p.fase}, ${p.pct_dominio}% dominio`).join('\n')}

Genera ajustes específicos para cada área problemática:
1. QUÉ AJUSTAR: el objetivo o estrategia exacta a modificar
2. CÓMO AJUSTAR: instrucción técnica ABA (aumentar/reducir ayudas, cambiar reforzador, dividir objetivo)
3. META A 4 SEMANAS: resultado esperado tras el ajuste

Responde en JSON: {"ajustes": [{area, que_ajustar, como_ajustar, meta_4_semanas}]}
SOLO JSON.`

    } else {
      // accion === 'generar' (default)
      promptBase = `Genera nuevos objetivos terapéuticos ABA adaptados al nivel actual del paciente.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

HABILIDADES ACTUALMENTE EN TRABAJO:
${resumenProgramas.map(p => `- ${p.area}: "${p.titulo}" (fase ${p.fase}, ${p.pct_dominio}% dominio)`).join('\n')}

AVANCES RECIENTES (últimas sesiones):
${resumenSesiones.map(s => `- ${s.avances}`).filter(Boolean).join('\n') || 'Sin avances registrados'}

PATRONES DETECTADOS:
${patrones.slice(0, 3).map((p: any) => `- [${p.tipo}] ${p.area}: ${p.descripcion}`).join('\n') || 'Sin patrones problemáticos'}

Genera 3-5 objetivos nuevos o de siguiente nivel apropiados para este paciente:
- Basados en el perfil ABA actual (zona de desarrollo proximal)
- Ordenados de menor a mayor complejidad
- Con criterio de dominio específico y metodología

Responde en JSON: {"objetivos_sugeridos": [{titulo, area, descripcion, criterio_dominio, metodologia, justificacion_clinica, prioridad: "alta"|"media"|"baja"}]}
SOLO JSON.`
    }


    // ━━━ CEREBRO IA: buscar conocimiento clínico relevante ━━━


    let _cerebroCtx = ''


    try {


      const _query = 'objetivos ABA habilidades metas conducta'


      const _kb = await buildAIContext(undefined, undefined, undefined, _query)


      _cerebroCtx = _kb.knowledgeContext


    } catch { /* Cerebro IA no disponible */ }


    // ━━━ FIN CEREBRO IA ━━━


    const respuestaRaw = await callGroqSimple('Eres un psicólogo conductual certificado BCBA especializado en diseño de programas ABA para niños con TEA y TDAH. Siempre respondes con JSON válido y sin texto adicional. Fundamenta tus respuestas con los libros del Cerebro IA cuando estén disponibles.',
      promptBase,
      { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 1500 }
    )

    // Parsear JSON de la respuesta
    let resultado: any = null
    try {
      const clean = respuestaRaw.replace(/```json\n?|\n?```/g, '').trim()
      resultado = JSON.parse(clean)
    } catch {
      // Si no parsea, devolver texto
      resultado = { texto_libre: respuestaRaw }
    }

    // Guardar sugerencias en Supabase
    try {
      await supabaseAdmin.from('objetivos_adaptativos').insert({
        child_id: childId,
        accion,
        resultado,
        programas_analizados: resumenProgramas.length,
        created_at: new Date().toISOString()
      })
    } catch { /* no bloquear */ }

    return NextResponse.json({
      accion,
      paciente: nombre,
      resultado,
      programas_analizados: resumenProgramas.length,
      patrones_considerados: patronesUrgentes.length,
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('❌ Error agente-objetivos:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
  try {
    const { data } = await supabaseAdmin
      .from('objetivos_adaptativos')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(20)
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
