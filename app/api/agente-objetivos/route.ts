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

    // Sugerencia de protocolo según edad/diagnóstico
    const edadNum = Number(edad)
    let protocoloSugerido = 'ABLLS-R'
    if (!isNaN(edadNum)) {
      if (edadNum < 4) protocoloSugerido = 'VB-MAPP'  // 0-48 meses
      else if (edadNum <= 12) protocoloSugerido = 'ABLLS-R'  // hasta 12 años
      else protocoloSugerido = 'AFLS'  // adolescentes/adultos: habilidades funcionales
    }

    const protocolosGuia = `MARCO DE TRABAJO OBLIGATORIO (no inventes objetivos genéricos):

📘 VB-MAPP (Verbal Behavior Milestones Assessment and Placement Program):
   - 16 áreas operantes verbales: Mand, Tact, Echoic, Listener Responding, Visual Performance, etc.
   - Niveles: 0-18m / 18-30m / 30-48m
   - Usar para: niños 0-48 meses, especialmente con foco en conducta verbal.

📗 ABLLS-R (Assessment of Basic Language and Learning Skills - Revised):
   - 25 áreas (A-Z): A=Cooperación, B=Petición/Mand, C=Identificación visual, D=Imitación motora,
     F=Repertorio receptivo, G=Mando, H=Tacto, K=Conversación, L=Habilidades sociales, etc.
   - Cada ítem tiene código (ej: B12, H21, K6) y criterio observable.
   - Usar para: niños 2-12 años con TEA/TDAH/dificultades cognitivas.

📕 AFLS (Assessment of Functional Living Skills):
   - 6 módulos: Basic Living, Home, Community, School, Vocational, Independent Living.
   - Usar para: adolescentes/adultos o niños mayores con foco en autonomía funcional.

PROTOCOLO RECOMENDADO PARA ESTE CASO (basado en edad/diagnóstico): ${protocoloSugerido}
Podés combinar con otros si corresponde clínicamente.

🚫 PROHIBIDO devolver objetivos genéricos como "Mejorar la atención" o "Desarrollar la comunicación".
✅ OBLIGATORIO citar:
   - Protocolo de origen (VB-MAPP / ABLLS-R / AFLS)
   - Código exacto del ítem cuando aplique (ej: "ABLLS-R B12", "VB-MAPP Mand Nivel 2", "AFLS Basic 3.4")
   - Conducta operacionalizada (qué se ve, en qué contexto, bajo qué SD)
   - Criterio de dominio numérico (ej: 80% en 3 sesiones consecutivas con 2 terapeutas distintos)
   - Procedimiento de enseñanza específico (DTT, NET, ITT, BST, video modeling, errorless teaching, etc.)`

    if (accion === 'evaluar_dominio') {
      promptBase = `${protocolosGuia}

TAREA: Evaluar si los siguientes programas están listos para avanzar de fase o cerrar por dominio, según los estándares de ABLLS-R / VB-MAPP / AFLS.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

PROGRAMAS ACTIVOS:
${resumenProgramas.map(p => `- "${p.titulo}" (${p.area}): ${p.pct_dominio}% dominado (${p.dominados}/${p.total} objetivos), fase: ${p.fase}, criterio: ${p.criterio}%`).join('\n')}

ÚLTIMAS SESIONES:
${resumenSesiones.map(s => `- ${s.fecha}: objetivo="${s.objetivo}", logro=${s.logro}`).join('\n')}

Para cada programa, indica:
1. ESTADO: listo_para_avanzar / mantener / necesita_ajuste
2. ACCIÓN: qué hacer específicamente (avanzar al siguiente ítem del protocolo, cerrar el programa, ajustar criterio, agregar generalización con 2do terapeuta, etc.)
3. JUSTIFICACIÓN: 1 oración clínica que cite el protocolo (ej: "Cumple criterio ABLLS-R B12; corresponde avanzar a B13 (petición con 2 palabras)")
4. SIGUIENTE PASO: objetivo concreto del siguiente nivel del protocolo, con código exacto

Responde en JSON con array "evaluaciones": [{programa, protocolo_referencia, codigo_item, estado, accion, justificacion, siguiente_paso}]
SOLO JSON, sin markdown.`

    } else if (accion === 'ajustar') {
      promptBase = `${protocolosGuia}

TAREA: Ajustar los objetivos terapéuticos actuales aplicando técnicas ABA fundamentadas en ABLLS-R / VB-MAPP / AFLS.

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

PATRONES PROBLEMÁTICOS DETECTADOS:
${patronesUrgentes.map((p: any) => `- [${p.tipo}] ${p.area}: ${p.descripcion}`).join('\n') || 'Ninguno detectado'}

PROGRAMAS ACTIVOS:
${resumenProgramas.map(p => `- "${p.titulo}" (${p.area}): fase ${p.fase}, ${p.pct_dominio}% dominio`).join('\n')}

Genera ajustes específicos para cada área problemática. Para cada ajuste:
1. PROTOCOLO_REFERENCIA: VB-MAPP / ABLLS-R / AFLS + código del ítem
2. QUÉ AJUSTAR: el objetivo o estrategia exacta a modificar
3. CÓMO AJUSTAR: técnica ABA específica del protocolo (ej: "aplicar errorless teaching con prompt graduado de física total → física parcial → gestual → independiente", "fragmentar B12 en 3 sub-pasos siguiendo task analysis", "introducir contraprueba con 2do terapeuta")
4. META 4 SEMANAS: resultado observable y medible

Responde en JSON: {"ajustes": [{area, protocolo_referencia, codigo_item, que_ajustar, como_ajustar, meta_4_semanas}]}
SOLO JSON.`

    } else {
      // accion === 'generar' (default)
      promptBase = `${protocolosGuia}

TAREA: Generar 3-5 nuevos objetivos terapéuticos fundamentados en ABLLS-R / VB-MAPP / AFLS, apropiados para el nivel actual del paciente (zona de desarrollo próximo).

PACIENTE: ${nombre} | Edad: ${edad} | Diagnóstico: ${diagnostico}

HABILIDADES ACTUALMENTE EN TRABAJO:
${resumenProgramas.map(p => `- ${p.area}: "${p.titulo}" (fase ${p.fase}, ${p.pct_dominio}% dominio)`).join('\n')}

AVANCES RECIENTES (últimas sesiones):
${resumenSesiones.map(s => `- ${s.avances}`).filter(Boolean).join('\n') || 'Sin avances registrados'}

PATRONES DETECTADOS:
${patrones.slice(0, 3).map((p: any) => `- [${p.tipo}] ${p.area}: ${p.descripcion}`).join('\n') || 'Sin patrones problemáticos'}

Para CADA objetivo nuevo devolvé:
- titulo: conducta operacionalizada (ej: "Petición de 5 ítems preferidos usando 2 palabras")
- protocolo_referencia: "ABLLS-R" / "VB-MAPP" / "AFLS"
- codigo_item: código exacto del protocolo (ej: "B12", "Mand Nivel 2", "Basic Living 3.4") — NUNCA dejes vacío este campo
- area: dominio funcional (Conducta Verbal / Habilidades académicas / Autonomía / Habilidades sociales / etc.)
- descripcion: SD + R + consecuencia operacionalizadas
- criterio_dominio: numérico observable (ej: "80% en 3 sesiones consecutivas con 2 terapeutas distintos en 2 entornos diferentes")
- metodologia: técnica de enseñanza específica (DTT / NET / ITT / video modeling / BST / cadenas de tareas con prompt graduado / etc.)
- justificacion_clinica: 1-2 oraciones citando el protocolo + el progreso actual
- prioridad: "alta" | "media" | "baja"

🚫 NUNCA devuelvas títulos genéricos como "Mejorar atención" o "Desarrollar lenguaje". Tiene que estar anclado a un ítem específico del protocolo.

Responde en JSON: {"objetivos_sugeridos": [{titulo, protocolo_referencia, codigo_item, area, descripcion, criterio_dominio, metodologia, justificacion_clinica, prioridad}]}
SOLO JSON.`
    }


    // ━━━ CEREBRO IA: buscar contenido específico de los protocolos ABA ━━━
    let _cerebroCtx = ''
    try {
      // Querys orientadas a los 3 protocolos + las áreas activas del paciente
      const areasPaciente = [...new Set(resumenProgramas.map(p => p.area).filter(Boolean))].join(' ')
      const _query = `ABLLS-R VB-MAPP AFLS ${protocoloSugerido} ítems criterios dominio ${areasPaciente} ${diagnostico}`
      const _kb = await buildAIContext(undefined, undefined, undefined, _query)
      _cerebroCtx = _kb.knowledgeContext
    } catch { /* Cerebro IA no disponible */ }
    // ━━━ FIN CEREBRO IA ━━━

    const promptConCerebro = _cerebroCtx
      ? `${promptBase}\n\n📚 CONTENIDO DE LOS PROTOCOLOS (Cerebro IA — usá esto como fuente de verdad para los códigos y criterios):\n${_cerebroCtx}`
      : promptBase

    const sistemaPrompt = `Eres un psicólogo conductual certificado BCBA especializado en diseño de programas ABA para niños con TEA y TDAH.

TU CONOCIMIENTO BASE:
- ABLLS-R (Partington, 2006): 25 áreas A-Z, ~544 ítems con códigos específicos.
- VB-MAPP (Sundberg, 2008): 16 áreas operantes verbales, 3 niveles (0-18m, 18-30m, 30-48m).
- AFLS (Partington & Mueller, 2012): 6 módulos de habilidades funcionales para la vida.

REGLAS NO NEGOCIABLES:
1. NUNCA generes objetivos genéricos. Siempre cita protocolo + código del ítem.
2. Si no estás seguro del código exacto, usá uno PLAUSIBLE del protocolo correcto y marcalo claramente.
3. Operacionalizá cada conducta con SD (antecedente), R (respuesta esperada), criterio numérico.
4. Métodos de enseñanza deben ser técnicas ABA reconocidas (DTT, NET, ITT, errorless, prompt fading, etc.).
5. Si el Cerebro IA tiene contenido de los protocolos, USALO como fuente prioritaria para los códigos.
6. Respondés SIEMPRE con JSON válido sin texto adicional.`

    const respuestaRaw = await callGroqSimple(sistemaPrompt,
      promptConCerebro,
      { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 2000 }
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
