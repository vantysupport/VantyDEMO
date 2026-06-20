// app/api/reporte-comparativo/route.ts
// 📊 CAPA 2 — Reporte Comparativo Inter-Sesiones + Predicción
// "En 3 meses logrará X si mantiene Y"
// Compara períodos, muestra evolución y genera predicción narrativa para padres

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'

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
  if (lower.includes("mayormente") || lower.includes("alto") || lower.includes("excelente")) return 75
  if (lower.includes("parcialmente") || lower.includes("medio") || lower.includes("proceso")) return 50
  if (lower.includes("mínimo") || lower.includes("bajo") || lower.includes("emergente")) return 20
  if (lower.includes("no logrado") || lower.includes("sin respuesta")) return 5
  return null
}

function calcularPendiente(valores: number[]): number {
  if (valores.length < 2) return 0
  const n = valores.length
  const sumX = (n * (n - 1)) / 2
  const sumY = valores.reduce((a, b) => a + b, 0)
  const sumXY = valores.reduce((a, v, i) => a + i * v, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { childId } = await req.json()
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    const hoy = new Date()

    // Definir 3 períodos: hace 3 meses, hace 6 meses, hace 9 meses
    const periodos = [
      { label: 'Últimas 4 semanas', desde: 4, hasta: 0 },
      { label: 'Hace 1-2 meses', desde: 8, hasta: 4 },
      { label: 'Hace 2-3 meses', desde: 12, hasta: 8 },
    ]

    const datosPeriodos = await Promise.all(periodos.map(async (p) => {
      const fechaDesde = new Date(hoy); fechaDesde.setDate(fechaDesde.getDate() - p.desde * 7)
      const fechaHasta = new Date(hoy); fechaHasta.setDate(fechaHasta.getDate() - p.hasta * 7)

      const { data: sesiones } = await supabaseAdmin
        .from('registro_aba')
        .select('fecha_sesion, datos')
        .eq('child_id', childId)
        .gte('fecha_sesion', fechaDesde.toISOString().split('T')[0])
        .lt('fecha_sesion', fechaHasta.toISOString().split('T')[0])
        .order('fecha_sesion', { ascending: true })

      const logs = (sesiones?.map(s => parseLogro(s.datos?.nivel_logro_objetivos)).filter((v): v is number => v !== null) || []) as number[]
      const atns = sesiones?.map(s => Number(s.datos?.nivel_atencion || 0) * 20).filter(v => v > 0) || []
      const tols = sesiones?.map(s => Number(s.datos?.tolerancia_frustracion || 0) * 20).filter(v => v > 0) || []
      const coms = sesiones?.map(s => Number(s.datos?.iniciativa_comunicativa || 0) * 20).filter(v => v > 0) || []

      const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

      return {
        label: p.label,
        sesiones: sesiones?.length || 0,
        logro: avg(logs),
        atencion: avg(atns),
        tolerancia: avg(tols),
        comunicacion: avg(coms),
        objetivos_trabajados: [...new Set(sesiones?.map(s => s.datos?.objetivo_principal).filter(Boolean))] as string[],
        avances: sesiones?.map(s => s.datos?.avances_observados).filter(Boolean).slice(-2) as string[],
      }
    }))

    // Datos completos para predicción (últimas 16 semanas)
    const fechaBase = new Date(hoy); fechaBase.setDate(fechaBase.getDate() - 112)
    const { data: todasSesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .gte('fecha_sesion', fechaBase.toISOString().split('T')[0])
      .order('fecha_sesion', { ascending: true })

    const todosLogros = (todasSesiones?.map(s => parseLogro(s.datos?.nivel_logro_objetivos)).filter((v): v is number => v !== null) || []) as number[]
    const pendiente = calcularPendiente(todosLogros)
    const ultimoLogro = todosLogros[todosLogros.length - 1] || 50

    // Predicciones
    const pred4semanas = Math.min(100, Math.max(0, Math.round(ultimoLogro + pendiente * 4)))
    const pred3meses   = Math.min(100, Math.max(0, Math.round(ultimoLogro + pendiente * 12)))
    const pred6meses   = Math.min(100, Math.max(0, Math.round(ultimoLogro + pendiente * 24)))

    // Datos paciente
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, diagnosis')
      .eq('id', childId)
      .single()

    const nombre = (child as any)?.name || 'el paciente'

    // Generar narrativa predictiva
    const promptPredictivo = `Eres ARIA, el asistente del Centro Vanty ABA. Escribe una narrativa PREDICTIVA y MOTIVADORA para los padres de ${nombre}.

EVOLUCIÓN COMPARATIVA (del más antiguo al más reciente):
${datosPeriodos.reverse().map(p => `${p.label}: logro=${p.logro ?? 'N/A'}%, atención=${p.atencion ?? 'N/A'}%, sesiones=${p.sesiones}`).join('\n')}

PROYECCIÓN ESTADÍSTICA:
- En 4 semanas: ${pred4semanas}% de logro estimado
- En 3 meses: ${pred3meses}% de logro estimado  
- En 6 meses: ${pred6meses}% de logro estimado
- Tendencia: ${pendiente > 0.5 ? 'Positiva (mejorando)' : pendiente < -0.5 ? 'Requiere atención' : 'Estable'}

Escribe en lenguaje SIMPLE y ESPERANZADOR (máx. 300 palabras):
1. CÓMO HA EVOLUCIONADO: comparar el primer período vs el más reciente en lenguaje de familia
2. QUÉ PASARÁ SI SEGUIMOS ASÍ: explicar la predicción de forma optimista pero realista
3. EL PAPEL DE LA FAMILIA: cómo las tareas en casa aceleran el progreso
4. META CONCRETA: "Si ${nombre} mantiene este ritmo, en 3 meses podrá..." (inventar algo específico y realista basado en los datos)

Usa frases como "Hemos notado que...", "Los datos nos muestran que...", "Estamos muy contentos de compartir..."
Nunca uses porcentajes directamente — tradúcelos: "${pred3meses}%" = "de cada 10 actividades, logrará ${Math.round(pred3meses/10)} bien"`


    // ━━━ CEREBRO IA: buscar conocimiento clínico relevante ━━━


    let _cerebroCtx = ''


    try {


      const _query = 'comparación progreso ABA evaluación neurodesarrollo'


      const _kb = await buildAIContext(undefined, undefined, undefined, _query)


      _cerebroCtx = _kb.knowledgeContext


    } catch { /* Cerebro IA no disponible */ }


    // ━━━ FIN CEREBRO IA ━━━


    const narrativa = await callGroqSimple(
      'Eres ARIA, asistente de comunicación familiar cálida del Centro Vanty ABA.',
      promptPredictivo,
      { model: GROQ_MODELS.SMART, temperature: 0.65, maxTokens: 700 }
    )

    // Calcular delta entre primer y último período
    const primero = datosPeriodos[0]
    const ultimo  = datosPeriodos[datosPeriodos.length - 1]
    const deltaLogro = (ultimo.logro ?? 0) - (primero.logro ?? 0)

    return NextResponse.json({
      paciente: nombre,
      periodos: datosPeriodos,
      prediccion: {
        logro_actual: ultimoLogro,
        en_4_semanas: pred4semanas,
        en_3_meses: pred3meses,
        en_6_meses: pred6meses,
        tendencia: pendiente > 0.5 ? 'positiva' : pendiente < -0.5 ? 'negativa' : 'estable',
        pendiente_por_sesion: Math.round(pendiente * 100) / 100
      },
      evolucion: {
        delta_logro: Math.round(deltaLogro),
        mejoro: deltaLogro > 5,
        sesiones_totales: datosPeriodos.reduce((a, p) => a + p.sesiones, 0)
      },
      narrativa_predictiva: narrativa,
      generado_en: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('❌ Error reporte-comparativo:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
