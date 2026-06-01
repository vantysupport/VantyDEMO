// app/api/agente-prediccion/route.ts
// 🧠 Agente Predicción IA — predice progreso por PROGRAMA y NIVEL DE OBJETIVO específico
// Criterio de logro: ≥90% en 2 sesiones consecutivas por nivel de objetivo = LOGRADO

export const maxDuration = 60 // Vercel: hasta 60s para planes Pro (evitar timeout en análisis IA)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'

function calcularTendencia(valores: number[]): { slope: number; r2: number } {
  if (valores.length < 2) return { slope: 0, r2: 0 }
  const n = valores.length
  const x = valores.map((_, i) => i)
  const sumX = x.reduce((a, b) => a + b, 0)
  const sumY = valores.reduce((a, b) => a + b, 0)
  const sumXY = x.reduce((a, xi, i) => a + xi * valores[i], 0)
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0)
  const denom = n * sumX2 - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const meanY = sumY / n
  const ssTot = valores.reduce((a, y) => a + (y - meanY) ** 2, 0)
  const ssRes = valores.reduce((a, y, i) => a + (y - (meanY + slope * (i - (n - 1) / 2))) ** 2, 0)
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, r2 }
}

function calcularMediana(valores: number[]): number {
  if (valores.length === 0) return 0
  const sorted = [...valores].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function calcularMedia(valores: number[]): number {
  if (valores.length === 0) return 0
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

// Verificar criterio de logro: 90% en 2 sesiones consecutivas
function verificarCriterioLogro(porcentajes: number[], criterio = 90): { logrado: boolean; sesionesConsecutivas: number } {
  let consecutivas = 0
  let maxConsecutivas = 0
  for (const p of porcentajes) {
    if (p >= criterio) {
      consecutivas++
      maxConsecutivas = Math.max(maxConsecutivas, consecutivas)
    } else {
      consecutivas = 0
    }
  }
  return { logrado: maxConsecutivas >= 2, sesionesConsecutivas: maxConsecutivas }
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { childId, childName } = await req.json()
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    // Cargar TODOS los programas del paciente sin filtrar por estado
    // (el filtro de estado varía por implementación — filtramos en código)
    // Usamos * para descubrir las columnas reales disponibles
    const { data: todosProgramas, error: errProg } = await supabaseAdmin
      .from('programas_aba')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: true })

    // Log columnas disponibles para diagnóstico
    if (todosProgramas && todosProgramas.length > 0) {
      console.log('✅ programas_aba columnas disponibles:', Object.keys(todosProgramas[0]))
    }
    console.log('🔍 programas_aba query:', { childId, total: todosProgramas?.length, error: errProg?.message })

    // Filtrar en código: excluir solo los explícitamente archivados/dados de alta
    const ESTADOS_EXCLUIDOS = ['archivado', 'alta', 'dado_de_alta', 'inactivo', 'cancelado']
    const programas = (todosProgramas || []).filter((p: any) => {
      if (ESTADOS_EXCLUIDOS.includes(p.estado?.toLowerCase())) return false
      return true // incluir activo, intervencion, en_progreso, linea_base, dominado, null, etc.
    })

    if (programas.length === 0) {
      return NextResponse.json({
        programas_analizados: 0,
        analisis_por_programa: [],
        resumen_general: null,
        _debug_total_encontrados: todosProgramas?.length || 0,
        _debug_columnas: todosProgramas?.[0] ? Object.keys(todosProgramas[0]) : [],
        _debug_error_supabase: errProg?.message || null,
        mensaje: todosProgramas && todosProgramas.length > 0
          ? `Se encontraron ${todosProgramas.length} programa(s). Estados: ${todosProgramas.map((p: any) => p.estado).join(', ')}`
          : errProg
          ? `Error al consultar programas: ${errProg.message}`
          : 'No hay programas ABA registrados para este paciente.',
      })
    }

    const analisis_por_programa = []

    // ── Cargar TODAS las sesiones de todos los programas de una sola vez ──
    // Usamos .in('programa_id', allProgIds) EXACTAMENTE igual que lo hace stats/route.ts
    // Antes se hacía .eq() dentro del loop por programa, lo que podía dar 0 resultados
    // por diferencias sutiles en cómo Supabase maneja eq vs in para UUIDs.
    const allProgIds = programas.map((p: any) => p.id)
    const { data: todasLasSesiones, error: errSesiones } = allProgIds.length
      ? await supabaseAdmin
          .from('sesiones_datos_aba')
          .select('fecha, created_at, programa_id, porcentaje_exito, fase, set_nombre, oportunidades_totales, respuestas_correctas, notas')
          .in('programa_id', allProgIds)
          .order('created_at', { ascending: true })
      : { data: [] as any[], error: null }

    console.log('🔍 sesiones_datos_aba bulk query:', {
      progIds: allProgIds,
      totalFilas: todasLasSesiones?.length ?? 0,
      error: errSesiones?.message ?? null,
    })

    // Agrupar sesiones por programa_id para lookup rápido en el loop
    const sesionesPorPrograma: Record<string, any[]> = {}
    for (const s of (todasLasSesiones || [])) {
      const pid = s.programa_id
      if (!sesionesPorPrograma[pid]) sesionesPorPrograma[pid] = []
      // Normalizar fecha y porcentaje
      let pct: number | null = null
      if (s.porcentaje_exito != null) {
        pct = Number(s.porcentaje_exito)
      } else if (s.oportunidades_totales > 0) {
        pct = Math.round((Number(s.respuestas_correctas) / Number(s.oportunidades_totales)) * 100)
      }
      const fechaNorm = s.fecha || s.created_at || null
      sesionesPorPrograma[pid].push({ ...s, fecha: fechaNorm, porcentaje_exito: pct !== null ? pct : 50, _sin_dato_real: pct === null })
    }

    for (const prog of programas) {
      const progNombre = prog.titulo || (prog as any).nombre || 'Sin nombre'
      const progObjetivo = (prog as any).objetivo || (prog as any).descripcion || (prog as any).area || ''

      // Sesiones del programa: del bulk query agrupado (misma fuente que stats API)
      let sesiones: any[] | null = (sesionesPorPrograma[prog.id] || []).filter((s: any) => s.fecha != null)

      if (sesiones.length === 0) {
        // Fallback: buscar en registro_aba por child_id y mapear datos
        const { data: s2 } = await supabaseAdmin
          .from('registro_aba')
          .select('fecha_sesion, datos')
          .eq('child_id', childId)
          .order('fecha_sesion', { ascending: true })
          .limit(30)
        if (s2 && s2.length > 0) {
          // Convertir formato registro_aba al formato esperado
          // BUG FIX #2: NO filtrar sesiones con porcentaje_exito null — usar 50 como default
          // para que las sesiones cuenten en total_sesiones aunque no tengan % explícito.
          sesiones = s2.map((s: any) => {
            let pct: number | null = null
            if (s.datos?.nivel_logro_objetivos != null) {
              const raw = parseFloat(String(s.datos.nivel_logro_objetivos))
              pct = Math.round(raw * (typeof s.datos.nivel_logro_objetivos === 'number' && s.datos.nivel_logro_objetivos <= 5 ? 20 : 1))
            } else if (s.datos?.porcentaje_exito != null) {
              pct = Number(s.datos.porcentaje_exito)
            } else if (s.datos?.porcentaje_logro != null) {
              pct = Number(s.datos.porcentaje_logro)
            }
            return {
              fecha: s.fecha_sesion,
              // Si no hay dato de % usar 50 (promedio neutro) en vez de null para no descartar la sesión
              porcentaje_exito: pct !== null ? pct : 50,
              _sin_dato_real: pct === null, // flag para posible diagnóstico
              fase: s.datos?.fase_actual || null,
              set_nombre: s.datos?.set_nombre || null,
              oportunidades_totales: s.datos?.oportunidades_totales || null,
              respuestas_correctas: s.datos?.respuestas_correctas || null,
              notas: s.datos?.observaciones_generales || s.datos?.notas || null,
            }
          })
          // Solo descartar si no tiene fecha válida (no por falta de porcentaje)
          sesiones = sesiones.filter((s: any) => !!s.fecha)
        }
      }

      if (!sesiones || sesiones.length === 0) {
        analisis_por_programa.push({
          programa_id: prog.id,
          nombre: progNombre,
          objetivo: progObjetivo,
          fase_actual: prog.fase_actual,
          criterio_dominio: prog.criterio_dominio_pct || 90,
          total_sesiones: 0,
          ultimo_porcentaje: null,
          media: null,
          mediana: null,
          tendencia: null,
          criterio_logrado: false,
          sets: [],
          mensaje: 'Sin sesiones registradas',
        })
        continue
      }

      const porcentajes = sesiones.map(s => s.porcentaje_exito || 0)
      const ultimoPct = porcentajes[porcentajes.length - 1]
      const media = calcularMedia(porcentajes)
      const mediana = calcularMediana(porcentajes)
      const criterio = prog.criterio_dominio_pct || 90

      // Agrupar por SET y mantener orden temporal
      const setsMap: Record<string, number[]> = {}
      const setsOrden: string[] = []
      for (const s of sesiones) {
        const setKey = s.set_nombre || s.fase || 'Set 1'
        if (!setsMap[setKey]) { setsMap[setKey] = []; setsOrden.push(setKey) }
        setsMap[setKey].push(s.porcentaje_exito || 0)
      }

      // FIX clínico CRÍTICO: la "tendencia" del programa se calcula sobre el
      // set ACTIVO (el último), no combinando todos los sets. Cuando un niño
      // pasa de Set 2 (90%) a Set 3 (20%) eso NO es regresión — es un nivel
      // nuevo. Mezclar sets producía "Tendencia negativa ⚠️" engañosa.
      const setActivoNombre = setsOrden[setsOrden.length - 1] || null
      const porcentajesSetActivo = setActivoNombre ? setsMap[setActivoNombre] : porcentajes
      const tendencia = calcularTendencia(porcentajesSetActivo)
      const ultimoPctSet = porcentajesSetActivo[porcentajesSetActivo.length - 1] || 0
      const { logrado, sesionesConsecutivas } = verificarCriterioLogro(porcentajesSetActivo, criterio)

      const sets = setsOrden.map(nombre => {
        const pcts = setsMap[nombre]
        const { logrado: setLogrado, sesionesConsecutivas: cons } = verificarCriterioLogro(pcts, criterio)
        return {
          nombre,
          sesiones: pcts.length,
          ultimo_pct: pcts[pcts.length - 1],
          media: Math.round(calcularMedia(pcts)),
          mediana: Math.round(calcularMediana(pcts)),
          criterio_logrado: setLogrado,
          sesiones_consecutivas_sobre_criterio: cons,
          estado: setLogrado ? 'LOGRADO ✅' : pcts[pcts.length - 1] >= criterio ? 'En criterio (seguir monitoreando)' : 'En progreso',
        }
      })

      analisis_por_programa.push({
        programa_id: prog.id,
        nombre: progNombre,
        objetivo: progObjetivo,
        fase_actual: prog.fase_actual,
        criterio_dominio: criterio,
        total_sesiones: sesiones.length,
        set_activo: setActivoNombre,
        ultimo_porcentaje: Math.round(ultimoPct),
        media: Math.round(media),
        mediana: Math.round(mediana),
        tendencia_slope: Math.round(tendencia.slope * 10) / 10,
        tendencia_descripcion: tendencia.slope > 1
          ? `Progreso positivo en ${setActivoNombre || 'set activo'}`
          : tendencia.slope < -1
            ? `Tendencia negativa dentro de ${setActivoNombre || 'set activo'} ⚠️`
            : `Estable dentro de ${setActivoNombre || 'set activo'}`,
        tendencia_scope: setActivoNombre || 'sin sets',   // explicita el alcance del análisis
        criterio_logrado: logrado,
        sesiones_consecutivas_sobre_criterio: sesionesConsecutivas,
        estado_general: logrado ? 'LOGRADO ✅' : ultimoPctSet >= criterio ? 'En criterio — verificar 2 sesiones consecutivas' : ultimoPctSet >= criterio * 0.7 ? 'Cerca del criterio' : 'En progreso',
        sets,
      })
    }

    // Contexto para análisis IA
    let cerebroCtx = ''
    try {
      const kb = await buildAIContext(undefined, undefined, undefined, 'análisis ABA progreso criterio logro sets')
      cerebroCtx = kb.knowledgeContext
    } catch { /* fallback */ }

    const resumenParaIA = analisis_por_programa.map(p => ({
      programa: p.nombre,
      objetivo: p.objetivo || (p as any).objetivo_lp || '',
      sesiones: p.total_sesiones,
      ultimo_pct: p.ultimo_porcentaje,
      media: p.media,
      mediana: p.mediana,
      tendencia: p.tendencia_descripcion,
      criterio: p.criterio_dominio,
      logrado: p.criterio_logrado,
      sets: p.sets?.map(s => `${s.nombre}: ${s.ultimo_pct}% (media: ${s.media}%, ${s.criterio_logrado ? 'LOGRADO' : 'en progreso'})`).join(' | '),
    }))

    // BUG FIX #2: contar también registro_aba para tener un total consistente con otras vistas
    const { data: registroAbaCount } = await supabaseAdmin
      .from('registro_aba')
      .select('id')
      .eq('child_id', childId)
    const totalRegistroAba = registroAbaCount?.length || 0
    const totalSesionesAnalizadas = Math.max(
      analisis_por_programa.reduce((a, p) => a + p.total_sesiones, 0),
      totalRegistroAba
    )
    const progConSesiones = analisis_por_programa.filter(p => p.total_sesiones > 0)
    const progSinSesiones = analisis_por_programa.filter(p => p.total_sesiones === 0)

    const sesionesParaUpsert = totalSesionesAnalizadas

    const prompt = `Eres una neuropsicóloga clínica con especialización en Análisis Aplicado de la Conducta (ABA), certificada BCBA-D con 15 años de experiencia clínica. Redactas informes de supervisión clínica de alto nivel para terapeutas ABA y equipos multidisciplinarios. Tu lenguaje es técnico, preciso y fundamentado en evidencia (Cooper, Heron & Heward; JABA; Skinner).

PACIENTE: ${childName}
SESIONES TOTALES ANALIZADAS: ${totalSesionesAnalizadas}
PROGRAMAS CON DATOS: ${progConSesiones.length} | SIN DATOS AÚN: ${progSinSesiones.length}
CRITERIO DE DOMINIO: ≥${analisis_por_programa[0]?.criterio_dominio || 90}% en 2 sesiones consecutivas (criterio de transferencia de control de estímulos)

═══ PRINCIPIO CLÍNICO FUNDAMENTAL ═══
Cada SET dentro de un programa ABA es un nivel/objetivo independiente con su propia
línea base. Cuando un niño cumple criterio en un Set y se avanza al siguiente Set
(mayor dificultad), es ESPERABLE que comience con un porcentaje bajo (ej: pasar
de 90% en Set 2 a 20% en Set 3). Eso NO constituye regresión clínica — es transición
normal a un nivel más exigente. Los datos a continuación reportan la TENDENCIA
SOLO DENTRO del set activo de cada programa, no combinada entre sets. Bajo ninguna
circunstancia interpretes el inicio bajo de un nuevo set como deterioro del paciente.

DATOS CLÍNICOS POR PROGRAMA:
${resumenParaIA.map(p => [
  `━━ ${p.programa.toUpperCase()} ━━`,
  `  Área: ${p.objetivo || 'no especificada'} | Sesiones: ${p.sesiones} | Fase: ${p.tendencia || '—'}`,
  `  Último registro: ${p.ultimo_pct != null ? p.ultimo_pct + '%' : 'sin datos'} | Media: ${p.media != null ? p.media + '%' : '—'} | Mediana: ${p.mediana != null ? p.mediana + '%' : '—'}`,
  `  Criterio de dominio: ${p.logrado ? '✓ ALCANZADO' : 'EN PROGRESO'}`,
  p.sets ? `  Sets/niveles: ${p.sets}` : '',
].filter(Boolean).join('\n')).join('\n\n')}

Genera un INFORME DE SUPERVISIÓN CLÍNICA ABA con exactamente este formato:

**EVALUACIÓN DEL ESTADO CLÍNICO ACTUAL**
[3-4 oraciones. Descripción objetiva del estado general del proceso terapéutico fundamentado en los datos. Menciona tendencias observables, nivel de adherencia al programa y calidad del registro de datos. Usa terminología como: tasa de respuesta, discriminación de estímulos, control instruccional, línea base, criterio de dominio.]

**ANÁLISIS POR PROGRAMA DE INTERVENCIÓN**
[Para cada programa con datos: analiza la curva de aprendizaje, variabilidad entre sesiones, si hay estancamiento o aceleración, e indica si el criterio de transferencia está próximo. Para programas sin sesiones: señala la necesidad crítica de iniciar el registro sistemático de datos.]

**HIPÓTESIS CLÍNICA Y VARIABLES EN JUEGO**
[2-3 oraciones. Plantea hipótesis sobre los factores que pueden estar afectando el progreso: variables motivacionales, calidad del antecedente, eficacia del consecuente, generalización, fatiga de reforzadores, etc.]

**INDICACIONES TERAPÉUTICAS PRIORITARIAS**
1. [Indicación clínica específica con fundamento en principios ABA — incluye qué, cómo y cuándo implementar]
2. [Indicación clínica específica con fundamento en principios ABA]
3. [Indicación clínica específica con fundamento en principios ABA]

**CRITERIOS DE AVANCE Y MONITOREO**
[Especifica qué indicadores deben observarse en las próximas 2-4 semanas para determinar si el plan es efectivo o requiere ajuste. Menciona umbrales de decisión clínica.]

**RESUMEN PARA FAMILIA**
[3-4 oraciones en lenguaje simple y cálido, dirigido a los padres. Sin jerga técnica, sin siglas. Explica cómo va el niño/a en terapia, destaca algo positivo y menciona qué pueden esperar próximamente. Escribe como si hablaras directamente con la familia.]

Redacta en tercera persona institucional. Sin tuteos. Sin clichés motivacionales. Máximo 500 palabras.`

    let resumen_general: string | null = null
    try {
      resumen_general = await callGroqSimple(
        'Eres neuropsicóloga clínica BCBA-D con especialización en ABA. Redactas informes clínicos de supervisión de alto nivel. Lenguaje técnico, preciso, fundamentado en evidencia científica. Nunca usas frases motivacionales vagas. Siempre específico y accionable.',
        prompt + (cerebroCtx ? '\n\n━━━ CONTEXTO CLÍNICO ADICIONAL ━━━\n' + cerebroCtx : ''),
        { model: GROQ_MODELS.SMART, temperature: 0.25, maxTokens: 1000 }
      )
    } catch (err) {
      console.error('Error Groq predicción por SET:', err)
    }

    let upsertErr: string | null = null
    let prediccion_30d_out: string | null = null
    // Guardar en predicciones_ia (resumen general)
    try {
      // Confianza: escala logarítmica (piso 20%, techo 92%)
      // 1 sesión→~20%, 5→~40%, 10→~55%, 20→~70%, 40→~85%, 50+→~92%
      const totalSes = analisis_por_programa.reduce((a, p) => a + p.total_sesiones, 0)
      const confianza = totalSes === 0
        ? 0
        : Math.round(Math.min(92, 20 + (Math.log(totalSes + 1) / Math.log(55)) * 72))

      // areas_fortaleza: logrados primero; si no hay, programas con tendencia positiva
      const logradosList = analisis_por_programa.filter(p => p.criterio_logrado).map(p => p.nombre)
      const positivosList = analisis_por_programa
        .filter(p => !p.criterio_logrado && (p.tendencia_slope ?? 0) > 1 && p.total_sesiones > 0)
        .map(p => p.nombre)
      const areas_fortaleza = logradosList.length > 0 ? logradosList : positivosList

      // areas_riesgo: tendencia negativa o media baja con >=3 sesiones
      const areas_riesgo = analisis_por_programa
        .filter(p => (p.tendencia_slope ?? 0) < -1 || (p.media != null && p.media < 50 && p.total_sesiones >= 3))
        .map(p => p.nombre)

      // prediccion_30d: extraer sección "RESUMEN PARA FAMILIA" del análisis principal — sin segundo llamado a Groq
      let prediccion_30d: string | null = null
      if (resumen_general) {
        const matchFamilia = resumen_general.match(/\*\*RESUMEN PARA FAMILIA\*\*\s*\n+([\s\S]+?)(?=\n\n\*\*|$)/i)
        if (matchFamilia) {
          prediccion_30d = matchFamilia[1].replace(/\*\*(.*?)\*\*/g, '$1').trim()
        } else {
          const bloques = resumen_general.split(/\n\n+/).map((b: string) => b.trim()).filter((b: string) => b && !/^\*\*[^*]+\*\*$/.test(b))
          prediccion_30d = (bloques[0] ?? '').replace(/\*\*(.*?)\*\*/g, '$1').trim() || null
        }
      }

      const { error: upsertError } = await supabaseAdmin.from('predicciones_ia').upsert({
        child_id: childId,
        fecha_prediccion: new Date().toISOString().split('T')[0],
        confianza,
        areas_riesgo,
        areas_fortaleza,
        analisis_ia: resumen_general,
        sesiones_analizadas: totalSesionesAnalizadas,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'child_id' })
      if (upsertError) console.error('❌ upsert predicciones_ia error:', upsertError)
      prediccion_30d_out = prediccion_30d
      upsertErr = upsertError?.message ?? null
    } catch (e: any) { upsertErr = e.message }

    return NextResponse.json({
      programas_analizados: analisis_por_programa.length,
      analisis_por_programa,
      resumen_general,
      total_sesiones_unificado: totalSesionesAnalizadas,
      criterio_nota: '≥90% en 2 sesiones consecutivas por nivel de objetivo = LOGRADO',
      _debug: {
        bulk_sesiones_encontradas: todasLasSesiones?.length ?? 0,
        bulk_error: errSesiones?.message ?? null,
        prog_ids_usados: allProgIds,
        sesiones_por_programa: Object.fromEntries(
          Object.entries(sesionesPorPrograma).map(([k, v]) => [k, (v as any[]).length])
        ),
        total_sesiones_analizadas: totalSesionesAnalizadas,
        upsert_error: upsertErr,
        prediccion_30d_length: prediccion_30d_out?.length ?? 0,
        analisis_ia_length: resumen_general?.length ?? 0,
      },
    })

  } catch (e: any) {
    console.error('❌ Error agente predicción:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  try {
    let query = supabaseAdmin
      .from('predicciones_ia')
      .select('*, children(name, diagnosis)')
      .order('updated_at', { ascending: false })
    if (childId) query = query.eq('child_id', childId)
    const { data } = await query.limit(50)
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
