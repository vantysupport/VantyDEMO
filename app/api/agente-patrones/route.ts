// app/api/agente-patrones/route.ts
// 🧠 CAPA 1 — Sub-agente: Detector de Patrones ABA por Niño
// Analiza el historial de sesiones y detecta patrones de aprendizaje,
// estancamientos, regresiones y consistencia de conductas

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface PatronDetectado {
  tipo: 'regresion' | 'estancamiento' | 'aceleracion' | 'inconsistencia' | 'dominio'
  area: string
  descripcion: string
  confianza: number          // 0-100
  sesiones_involucradas: number
  valor_actual: number       // 0-100
  valor_anterior: number     // 0-100
  semanas_detectado: number
  accion_sugerida: string
}

function parseLogro(val: any): number | null {
  if (val == null || val === "") return null
  if (typeof val === "number") return Math.min(100, Math.max(0, Math.round(val)))
  const s = String(val).trim()
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const num = s.match(/(\d+)/)
  if (num) return Math.min(100, Math.max(0, parseInt(num[1])))
  const lower = s.toLowerCase()
  if (lower.includes("completamente") || lower.includes("dominado")) return 90
  if (lower.includes("mayormente") || lower.includes("alto")) return 75
  if (lower.includes("parcialmente") || lower.includes("medio") || lower.includes("proceso")) return 50
  if (lower.includes("mínimo") || lower.includes("bajo") || lower.includes("emergente")) return 20
  if (lower.includes("no logrado")) return 5
  return null
}

function detectarPatrones(sesiones: any[]): PatronDetectado[] {
  const patrones: PatronDetectado[] = []
  if (sesiones.length < 3) return patrones

  const logros = sesiones.map(s => parseLogro(s.datos?.nivel_logro_objetivos)).filter((v): v is number => v !== null)
  const atenciones = sesiones.map(s => Number(s.datos?.nivel_atencion || 0)).filter(v => v > 0).map(v => (v / 5) * 100)
  const tolerancias = sesiones.map(s => Number(s.datos?.tolerancia_frustracion || 0)).filter(v => v > 0).map(v => (v / 5) * 100)
  const comunicacion = sesiones.map(s => Number(s.datos?.iniciativa_comunicativa || 0)).filter(v => v > 0).map(v => (v / 5) * 100)

  const analizarSerie = (valores: number[], nombre: string) => {
    // FIX: mínimo 2 valores válidos para poder detectar al menos tendencia básica
    if (valores.length < 2) return

    const recientes = valores.slice(-3)
    const anteriores = valores.slice(-6, -3)
    const promReciente = recientes.reduce((a, b) => a + b, 0) / recientes.length
    // FIX: cuando no hay sesiones anteriores (< 4 sesiones), comparar contra
    // el primer valor registrado en vez de promReciente (que causaba delta = 0)
    const promAnterior = anteriores.length > 0
      ? anteriores.reduce((a, b) => a + b, 0) / anteriores.length
      : valores[0]
    const delta = promReciente - promAnterior
    const ultimo = valores[valores.length - 1]
    const semanas = Math.ceil(valores.length / 2)

    // REGRESIÓN: bajó más de 15 puntos
    // FIX: eliminado "anteriores.length > 0" — ahora funciona con 2-3 sesiones
    // usando valores[0] como referencia base
    if (delta < -15) {
      patrones.push({
        tipo: 'regresion',
        area: nombre,
        descripcion: `${nombre} mostró una regresión de ${Math.abs(Math.round(delta))} puntos en las últimas ${recientes.length} sesiones`,
        confianza: Math.min(95, 60 + Math.abs(delta)),
        sesiones_involucradas: recientes.length,
        valor_actual: Math.round(promReciente),
        valor_anterior: Math.round(promAnterior),
        semanas_detectado: semanas,
        accion_sugerida: `Revisar factores ambientales y ajustar estrategias de reforzamiento en ${nombre.toLowerCase()}`
      })
    }

    // ESTANCAMIENTO: variación < 8 puntos por 3+ sesiones (FIX: bajado de 4 a 3)
    if (valores.length >= 3) {
      const ultimas = valores.slice(-3)
      const maxVal = Math.max(...ultimas)
      const minVal = Math.min(...ultimas)
      if (maxVal - minVal < 8 && promReciente < 70) {
        patrones.push({
          tipo: 'estancamiento',
          area: nombre,
          descripcion: `${nombre} lleva ${ultimas.length} sesiones sin avance significativo (rango: ${Math.round(minVal)}-${Math.round(maxVal)}%)`,
          confianza: 80,
          sesiones_involucradas: ultimas.length,
          valor_actual: Math.round(promReciente),
          valor_anterior: Math.round(promAnterior),
          semanas_detectado: semanas,
          accion_sugerida: `Considerar cambio de estrategia o ajuste del objetivo. Consultar con equipo clínico sobre desencadenantes`
        })
      }
    }

    // ACELERACIÓN: subió más de 20 puntos
    // FIX: eliminado "anteriores.length > 0" — ahora funciona con 2-3 sesiones
    if (delta > 20) {
      patrones.push({
        tipo: 'aceleracion',
        area: nombre,
        descripcion: `${nombre} mostró aceleración notable: +${Math.round(delta)} puntos en las últimas sesiones`,
        confianza: Math.min(95, 55 + delta),
        sesiones_involucradas: recientes.length,
        valor_actual: Math.round(promReciente),
        valor_anterior: Math.round(promAnterior),
        semanas_detectado: semanas,
        accion_sugerida: `Identificar qué estrategia está funcionando y replicarla en otras áreas`
      })
    }

    // DOMINIO: 3+ sesiones consecutivas >= 80% (sin cambios, ya funcionaba)
    if (valores.length >= 3 && valores.slice(-3).every(v => v >= 80)) {
      patrones.push({
        tipo: 'dominio',
        area: nombre,
        descripcion: `${nombre} ha alcanzado nivel de dominio (>80%) por ${recientes.length} sesiones consecutivas`,
        confianza: 90,
        sesiones_involucradas: recientes.length,
        valor_actual: Math.round(ultimo),
        valor_anterior: Math.round(promAnterior),
        semanas_detectado: semanas,
        accion_sugerida: `Considerar avanzar al siguiente objetivo o fase de generalización`
      })
    }

    // INCONSISTENCIA: alta varianza (std > 20)
    // FIX: bajado de 4 a 3 sesiones mínimas
    if (valores.length >= 3) {
      const mean = valores.reduce((a, b) => a + b, 0) / valores.length
      const std = Math.sqrt(valores.reduce((a, v) => a + (v - mean) ** 2, 0) / valores.length)
      if (std > 20) {
        patrones.push({
          tipo: 'inconsistencia',
          area: nombre,
          descripcion: `${nombre} muestra alta variabilidad entre sesiones (desv. estándar: ${Math.round(std)} pts)`,
          confianza: 75,
          sesiones_involucradas: valores.length,
          valor_actual: Math.round(ultimo),
          valor_anterior: Math.round(promAnterior),
          semanas_detectado: semanas,
          accion_sugerida: `Revisar consistencia en el ambiente terapéutico y factores contextuales (sueño, alimentación, rutinas)`
        })
      }
    }
  }

  analizarSerie(logros, 'Logro de Objetivos')
  analizarSerie(atenciones, 'Atención')
  analizarSerie(tolerancias, 'Tolerancia a la Frustración')
  analizarSerie(comunicacion, 'Comunicación')

  // Ordenar por confianza
  return patrones.sort((a, b) => b.confianza - a.confianza)
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { childId, childName, semanas = 16 } = body
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - semanas * 7)
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0]

    // Leer sesiones reales de programas ABA
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('id, titulo, area, criterio_dominio_pct, sesiones_datos_aba(fecha, porcentaje_exito, fase, set)')
      .eq('child_id', childId)

    // Analizar CADA programa individualmente para detectar patrones reales
    const sesiones: any[] = []
    const todosPatrones: PatronDetectado[] = []

    for (const prog of (programas || [])) {
      const sesionesProg = ((prog as any).sesiones_datos_aba || [])
        .filter((s: any) => s.fecha >= fechaInicioStr && s.porcentaje_exito != null)
        .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))

      for (const s of sesionesProg) {
        sesiones.push({
          fecha_sesion: s.fecha,
          programa: (prog as any).titulo,
          area: (prog as any).area,
          datos: {
            nivel_logro_objetivos: s.porcentaje_exito,
            nivel_atencion: null,
            tolerancia_frustracion: null,
            iniciativa_comunicativa: null,
            objetivo_principal: (prog as any).titulo,
            notas_sesion: ''
          }
        })
      }

      // Detectar patrones por programa individual (mínimo 2 sesiones)
      if (sesionesProg.length >= 2) {
        const valores = sesionesProg.map((s: any) => s.porcentaje_exito as number)
        const criterio = (prog as any).criterio_dominio_pct || 90
        const nombreProg = (prog as any).titulo || 'Programa'
        const recientes = valores.slice(-3)
        const anteriores = valores.slice(-6, -3)
        const promReciente = recientes.reduce((a: number, b: number) => a + b, 0) / recientes.length
        const promAnterior = anteriores.length > 0
          ? anteriores.reduce((a: number, b: number) => a + b, 0) / anteriores.length
          : valores[0]
        const delta = promReciente - promAnterior
        const ultimo = valores[valores.length - 1]
        const semanas_ = Math.ceil(valores.length / 2)

        // DOMINIO: últimas sesiones >= criterio
        if (valores.length >= 2 && valores.slice(-2).every((v: number) => v >= criterio)) {
          todosPatrones.push({
            tipo: 'dominio', area: nombreProg,
            descripcion: `"${nombreProg}" alcanzó criterio de dominio (≥${criterio}%) en las últimas ${Math.min(valores.length, 2)} sesiones`,
            confianza: 92, sesiones_involucradas: Math.min(valores.length, 2),
            valor_actual: Math.round(promReciente), valor_anterior: Math.round(promAnterior),
            semanas_detectado: semanas_,
            accion_sugerida: `Avanzar al siguiente objetivo o fase de generalización en "${nombreProg}"`
          })
        }
        // REGRESIÓN: bajó más de 15 puntos
        else if (delta < -15 && valores.length >= 2) {
          todosPatrones.push({
            tipo: 'regresion', area: nombreProg,
            descripcion: `"${nombreProg}" bajó ${Math.abs(Math.round(delta))} puntos (${Math.round(promAnterior)}% → ${Math.round(promReciente)}%)`,
            confianza: Math.min(95, 60 + Math.abs(delta)),
            sesiones_involucradas: recientes.length,
            valor_actual: Math.round(promReciente), valor_anterior: Math.round(promAnterior),
            semanas_detectado: semanas_,
            accion_sugerida: `Revisar reforzadores y antecedentes en "${nombreProg}". Posible necesidad de ajustar el SD o simplificar la tarea`
          })
        }
        // ACELERACIÓN: subió más de 20 puntos
        else if (delta > 20 && valores.length >= 2) {
          todosPatrones.push({
            tipo: 'aceleracion', area: nombreProg,
            descripcion: `"${nombreProg}" aceleró +${Math.round(delta)} puntos en las últimas sesiones`,
            confianza: Math.min(95, 55 + delta),
            sesiones_involucradas: recientes.length,
            valor_actual: Math.round(promReciente), valor_anterior: Math.round(promAnterior),
            semanas_detectado: semanas_,
            accion_sugerida: `Identificar qué está funcionando en "${nombreProg}" y replicar la estrategia`
          })
        }
        // ESTANCAMIENTO: sin avance en 3+ sesiones con promedio bajo
        else if (valores.length >= 3) {
          const ultimas3 = valores.slice(-3)
          const rango = Math.max(...ultimas3) - Math.min(...ultimas3)
          if (rango < 10 && promReciente < criterio) {
            todosPatrones.push({
              tipo: 'estancamiento', area: nombreProg,
              descripcion: `"${nombreProg}" lleva ${ultimas3.length} sesiones sin avance (${Math.round(Math.min(...ultimas3))}-${Math.round(Math.max(...ultimas3))}%, criterio: ${criterio}%)`,
              confianza: 80, sesiones_involucradas: ultimas3.length,
              valor_actual: Math.round(promReciente), valor_anterior: Math.round(promAnterior),
              semanas_detectado: semanas_,
              accion_sugerida: `Revisar estrategia de enseñanza en "${nombreProg}". Considerar cambio de método o ajuste de la dificultad`
            })
          }
        }

        // INCONSISTENCIA: alta varianza
        if (valores.length >= 3) {
          const mean = valores.reduce((a: number, b: number) => a + b, 0) / valores.length
          const std = Math.sqrt(valores.reduce((a: number, v: number) => a + (v - mean) ** 2, 0) / valores.length)
          if (std > 20) {
            todosPatrones.push({
              tipo: 'inconsistencia', area: nombreProg,
              descripcion: `"${nombreProg}" muestra alta variabilidad (desv. estándar: ${Math.round(std)} pts, rango: ${Math.round(Math.min(...valores))}-${Math.round(Math.max(...valores))}%)`,
              confianza: 75, sesiones_involucradas: valores.length,
              valor_actual: Math.round(ultimo), valor_anterior: Math.round(promAnterior),
              semanas_detectado: semanas_,
              accion_sugerida: `Revisar consistencia ambiental y de terapeuta en "${nombreProg}". Verificar factores contextuales (sueño, rutina)`
            })
          }
        }
      }
    }

    sesiones.sort((a, b) => a.fecha_sesion.localeCompare(b.fecha_sesion))

    const patrones = todosPatrones.sort((a, b) => b.confianza - a.confianza)

    if (sesiones.length < 2) {
      return NextResponse.json({
        patrones: [],
        resumen: 'Insuficientes sesiones para detectar patrones (mínimo 2 por programa).',
        sesiones_analizadas: sesiones.length,
        analisis_ia: null
      })
    }

    // Análisis IA de los patrones detectados
    
    // ━━━ CEREBRO IA ━━━
    let _cerebroCtx = ''
    try {
      const _kb = await buildAIContext(undefined, undefined, undefined, 'patrones conducta ABA TEA análisis')
      _cerebroCtx = _kb.knowledgeContext
    } catch { /* fallback */ }
    // ━━━ FIN CEREBRO IA ━━━
    let analisis_ia: string | null = null
    if (patrones.length > 0) {
      try {
        analisis_ia = await callGroqSimple(
          `Eres un neuropsicólogo clínico certificado BCBA con especialización en Análisis de Conducta Aplicado (ABA) para niños y adolescentes neurodivergentes (TEA, TDAH, TDL, discapacidad intelectual).
Tu rol es redactar informes clínicos rigurosos, fundamentados en evidencia científica, con el nivel de detalle y profundidad que esperaría un equipo interdisciplinario (psicólogo, terapeuta ocupacional, fonoaudiólogo, pediatra).
Fundamenta tus análisis en la literatura ABA contemporánea: Cooper, Heron & Heward (ABA, 3ra ed.), Skinner, Lovaas, Sundberg & Partington (ABLLS), y guías de práctica clínica del BACB.
Escribe en español clínico profesional. Usa terminología técnica precisa pero comprensible.`,
          `═══════════════════════════════════════════════════
EXPEDIENTE CLÍNICO — ANÁLISIS DE PATRONES ABA
═══════════════════════════════════════════════════
PACIENTE: ${childName || 'Paciente'}
PERÍODO DE EVALUACIÓN: Últimas ${semanas} semanas
TOTAL SESIONES ANALIZADAS: ${sesiones.length}

─── PATRONES CONDUCTUALES DETECTADOS ───────────────
${patrones.map(p => `▸ [${p.tipo.toUpperCase()}] ${p.area}
   Descripción: ${p.descripcion}
   Confianza estadística: ${p.confianza}%
   Valor anterior: ${p.valor_anterior}% → Valor actual: ${p.valor_actual}%
   Sesiones involucradas: ${p.sesiones_involucradas}`).join('\n\n')}

─── HISTORIAL DE SESIONES RECIENTES ────────────────
${sesiones.slice(-8).map((s, i) => `Sesión ${sesiones.length - (sesiones.slice(-8).length - 1 - i)} (${s.fecha_sesion}):
  • Logro de objetivos: ${s.datos?.nivel_logro_objetivos ?? 'N/D'}
  • Nivel de atención: ${s.datos?.nivel_atencion ?? 'N/D'}/5
  • Tolerancia frustración: ${s.datos?.tolerancia_frustracion ?? 'N/D'}/5
  • Iniciativa comunicativa: ${s.datos?.iniciativa_comunicativa ?? 'N/D'}/5
  • Objetivo trabajado: "${s.datos?.objetivo_principal || 'N/D'}"
  • Notas clínicas: "${s.datos?.notas_sesion || s.datos?.observaciones || 'Sin notas'}"`).join('\n\n')}

─── BASE DE CONOCIMIENTO CLÍNICO ───────────────────
${_cerebroCtx || 'No disponible'}

═══════════════════════════════════════════════════
INSTRUCCIONES PARA EL INFORME:
Redacta un informe clínico neuropsicológico completo y profesional con las siguientes secciones. Cada sección debe tener al menos 3-5 oraciones con profundidad clínica real. NO uses viñetas simples, redacta en prosa técnica fluida.

**INTERPRETACIÓN CLÍNICA**
Analiza el significado conjunto de todos los patrones detectados. Describe qué revelan sobre el perfil neuropsicológico del paciente, su etapa de desarrollo conductual, y cómo interactúan entre sí los distintos patrones. Contextualiza dentro del diagnóstico conocido.

**HIPÓTESIS CLÍNICA**
Formula 2-3 hipótesis explicativas sobre las causas subyacentes de los patrones problemáticos. Considera factores antecedentes (setting events, motivating operations), variables ambientales, desarrollo neurológico, y posibles funciones de la conducta según el modelo ABC.

**ANÁLISIS FUNCIONAL PRELIMINAR**
Describe la función probable de las conductas observadas (refuerzo positivo, negativo, automático, control atencional). Señala qué variables de control podrían estar manteniendo el estancamiento o la regresión.

**INDICACIONES TERAPÉUTICAS PRIORITARIAS**
Detalla al menos 3 intervenciones concretas y fundamentadas para esta semana y el próximo mes. Especifica procedimientos ABA (DTT, NET, PRT, incidental teaching, moldeamiento, encadenamiento, etc.) según corresponda. Incluye recomendaciones para el equipo y para la familia.

**PRONÓSTICO Y CRITERIOS DE AVANCE**
Proyecta el curso esperado del tratamiento en las próximas 4-8 semanas si se implementan las intervenciones sugeridas. Define indicadores medibles de progreso. Señala señales de alarma que requerirían revisión del plan.

**SEÑALES POSITIVAS Y FORTALEZAS**
Identifica recursos conductuales y habilidades del paciente que son activos terapéuticos. Describe cómo aprovechar estas fortalezas en el plan de intervención.`,
          { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 2000 }
        )
      } catch (err) {
        console.error('Error Groq patrones:', err)
      }
    }

    // Guardar en Supabase
    try {
      await supabaseAdmin.from('patrones_detectados').upsert({
        child_id: childId,
        fecha_analisis: new Date().toISOString().split('T')[0],
        patrones,
        sesiones_analizadas: sesiones.length,
        analisis_ia,
        updated_at: new Date().toISOString()
      }, { onConflict: 'child_id' })
    } catch { /* no bloquear */ }

    const tiposUrgentes = patrones.filter(p => p.tipo === 'regresion' || p.tipo === 'estancamiento')

    return NextResponse.json({
      patrones,
      sesiones_analizadas: sesiones.length,
      patrones_urgentes: tiposUrgentes.length,
      resumen: patrones.length === 0
        ? `Sin patrones problemáticos detectados en ${sesiones.length} sesiones. Progreso estable.`
        : `${patrones.length} patrón(es) detectado(s): ${tiposUrgentes.length} requieren atención inmediata.`,
      analisis_ia
    })

  } catch (e: any) {
    console.error('❌ Error agente-patrones:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  try {
    let q = supabaseAdmin
      .from('patrones_detectados')
      .select('*, children(name)')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (childId) q = q.eq('child_id', childId)
    const { data } = await q
    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
