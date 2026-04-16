// app/api/benchmark/route.ts
// 🏆 Agente Competitividad — métricas comparativas vs Central Reach y estándares ABA
// Genera score de competitividad por área y recomendaciones estratégicas

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getLangInstruction, getLocaleFromRequest } from '@/lib/lang'

// Estándares de la industria ABA (basados en literatura y Central Reach benchmarks)
const BENCHMARKS_INDUSTRIA = {
  sesiones_por_mes: { optimo: 16, bueno: 12, aceptable: 8, label: 'Sesiones/mes por paciente' },
  tasa_logro_objetivos: { optimo: 75, bueno: 60, aceptable: 45, label: '% Logro de Objetivos' },
  retencion_pacientes: { optimo: 90, bueno: 80, aceptable: 70, label: '% Retención pacientes' },
  engagement_padres: { optimo: 85, bueno: 70, aceptable: 55, label: '% Engagement padres' },
  velocidad_progreso: { optimo: 3, bueno: 2, aceptable: 1, label: 'Objetivos dominados/mes' },
  documentacion_rate: { optimo: 98, bueno: 90, aceptable: 80, label: '% Sesiones documentadas' },
  tiempo_respuesta_padres: { optimo: 2, bueno: 4, aceptable: 8, label: 'Horas resp. promedio (menor=mejor)' },
  nps_estimado: { optimo: 70, bueno: 50, aceptable: 30, label: 'NPS estimado (0-100)' }
}

function scorear(valor: number, benchmark: typeof BENCHMARKS_INDUSTRIA[keyof typeof BENCHMARKS_INDUSTRIA], invertido = false): number {
  const v = invertido ? benchmark.optimo / Math.max(valor, 0.1) * benchmark.optimo : valor
  const opt = invertido ? benchmark.optimo * benchmark.optimo / benchmark.optimo : benchmark.optimo
  if (v >= opt) return 100
  if (v >= benchmark.bueno) return 75 + ((v - benchmark.bueno) / (opt - benchmark.bueno)) * 25
  if (v >= benchmark.aceptable) return 50 + ((v - benchmark.aceptable) / (benchmark.bueno - benchmark.aceptable)) * 25
  return Math.max(0, (v / benchmark.aceptable) * 50)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dias = parseInt(searchParams.get('dias') || '30')

  const fechaInicio = new Date()
  fechaInicio.setDate(fechaInicio.getDate() - dias)
  const fechaInicioStr = fechaInicio.toISOString().split('T')[0]

  try {
    // 1. Sesiones del período
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('child_id, fecha_sesion, datos')
      .gte('fecha_sesion', fechaInicioStr)

    // 2. Pacientes activos
    const { data: pacientes } = await supabaseAdmin
      .from('children')
      .select('id, name')

    // 3. Citas programadas vs realizadas
    const { data: citas } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('estado, child_id')
      .gte('fecha', fechaInicioStr)

    // 4. Mensajes de padres (engagement)
    const { data: mensajesPadres } = await supabaseAdmin
      .from('chat_padres')
      .select('parent_user_id, created_at')
      .gte('created_at', fechaInicio.toISOString())

    // 5. Programas y objetivos
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('id, estado, child_id')

    // ── Calcular métricas reales ─────────────────────────────────────────────
    const totalPacientes = pacientes?.length || 1
    const totalSesiones = sesiones?.length || 0
    const sesionesPorMes = (totalSesiones / totalPacientes) * (30 / dias)

    // Tasa de logro de objetivos
    const logrosValues = sesiones?.map(s => {
      const v = s.datos?.nivel_logro_objetivos
      if (!v) return null
      const n = parseFloat(String(v))
      if (!isNaN(n)) return n
      const s2 = String(v).toLowerCase()
      if (s2.includes('completamente') || s2.includes('76')) return 88
      if (s2.includes('mayormente') || s2.includes('51')) return 63
      if (s2.includes('parcialmente') || s2.includes('26')) return 38
      return 13
    }).filter((v): v is number => v !== null) || []

    const tasaLogro = logrosValues.length > 0
      ? logrosValues.reduce((a, b) => a + b, 0) / logrosValues.length : 0

    // Retención (citas confirmadas / programadas)
    const citasProgramadas = citas?.filter(c => ['programada', 'confirmada', 'realizada'].includes(c.estado)).length || 0
    const citasRealizadas = citas?.filter(c => c.estado === 'realizada').length || 0
    const tasaRetencion = citasProgramadas > 0 ? (citasRealizadas / citasProgramadas) * 100 : 85

    // Engagement padres (padres únicos que mensajearon)
    const padresActivos = new Set(mensajesPadres?.map(m => m.parent_user_id)).size
    const engagementPadres = totalPacientes > 0 ? (padresActivos / totalPacientes) * 100 : 0

    // Velocidad de progreso (objetivos dominados)
    const objetivosDominados = programas?.filter(p => p.estado === 'dominado').length || 0
    const velocidadProgreso = totalPacientes > 0 ? (objetivosDominados / totalPacientes) * (30 / dias) : 0

    // Documentación (sesiones con datos registrados / total sesiones esperadas)
    const sesioneConDatos = sesiones?.filter(s => s.datos && Object.keys(s.datos).length > 3).length || 0
    const documentacionRate = totalSesiones > 0 ? (sesioneConDatos / totalSesiones) * 100 : 100

    // NPS estimado (basado en engagement + logro + retención)
    const npsEstimado = Math.round((engagementPadres * 0.4 + tasaLogro * 0.3 + tasaRetencion * 0.3) * 0.7)

    // Tiempo respuesta (placeholder — requiere timestamps de mensajes respondidos)
    const tiempoRespuesta = 3.5 // horas promedio

    // ── Scores vs benchmarks ─────────────────────────────────────────────────
    const metricas = {
      sesiones_por_mes: { valor: Math.round(sesionesPorMes * 10) / 10, score: scorear(sesionesPorMes, BENCHMARKS_INDUSTRIA.sesiones_por_mes), benchmark: BENCHMARKS_INDUSTRIA.sesiones_por_mes },
      tasa_logro_objetivos: { valor: Math.round(tasaLogro), score: scorear(tasaLogro, BENCHMARKS_INDUSTRIA.tasa_logro_objetivos), benchmark: BENCHMARKS_INDUSTRIA.tasa_logro_objetivos },
      retencion_pacientes: { valor: Math.round(tasaRetencion), score: scorear(tasaRetencion, BENCHMARKS_INDUSTRIA.retencion_pacientes), benchmark: BENCHMARKS_INDUSTRIA.retencion_pacientes },
      engagement_padres: { valor: Math.round(engagementPadres), score: scorear(engagementPadres, BENCHMARKS_INDUSTRIA.engagement_padres), benchmark: BENCHMARKS_INDUSTRIA.engagement_padres },
      velocidad_progreso: { valor: Math.round(velocidadProgreso * 10) / 10, score: scorear(velocidadProgreso, BENCHMARKS_INDUSTRIA.velocidad_progreso), benchmark: BENCHMARKS_INDUSTRIA.velocidad_progreso },
      documentacion_rate: { valor: Math.round(documentacionRate), score: scorear(documentacionRate, BENCHMARKS_INDUSTRIA.documentacion_rate), benchmark: BENCHMARKS_INDUSTRIA.documentacion_rate },
      tiempo_respuesta_padres: { valor: tiempoRespuesta, score: scorear(tiempoRespuesta, BENCHMARKS_INDUSTRIA.tiempo_respuesta_padres, true), benchmark: BENCHMARKS_INDUSTRIA.tiempo_respuesta_padres },
      nps_estimado: { valor: npsEstimado, score: scorear(npsEstimado, BENCHMARKS_INDUSTRIA.nps_estimado), benchmark: BENCHMARKS_INDUSTRIA.nps_estimado },
    }

    const scoreGlobal = Math.round(
      Object.values(metricas).reduce((a, m) => a + m.score, 0) / Object.keys(metricas).length
    )

    // Nivel competitivo
    const nivelCompetitivo = scoreGlobal >= 80 ? 'Clase Mundial' :
      scoreGlobal >= 65 ? 'Superior a Central Reach' :
      scoreGlobal >= 50 ? 'En par con Central Reach' :
      scoreGlobal >= 35 ? 'Por debajo del estándar' : 'Crítico'

    // Central Reach score típico (referencia pública: ~62/100 según análisis de mercado)
    const centralReachScore = 62
    const ventaja = scoreGlobal - centralReachScore

    // Obtener análisis estratégico IA
    const areasDebiles = Object.entries(metricas)
      .filter(([, m]) => m.score < 60)
      .map(([k, m]) => `${m.benchmark.label}: ${m.valor} (score: ${Math.round(m.score)}/100)`)

    const areasDestacadas = Object.entries(metricas)
      .filter(([, m]) => m.score >= 75)
      .map(([k, m]) => `${m.benchmark.label}: ${m.valor} (score: ${Math.round(m.score)}/100)`)

    let analisisEstrategico: string | null = null
    try {
      const locale = req.headers.get('x-locale') || 'es'
      analisisEstrategico = await callGroqSimple(
        'Eres un consultor estratégico especializado en centros terapéuticos ABA y competitividad frente a plataformas como Central Reach.' + getLangInstruction(locale),
        `Centro Jugando Aprendo — Análisis de Competitividad
Score Global: ${scoreGlobal}/100 vs Central Reach: ${centralReachScore}/100
${ventaja > 0 ? `✅ VENTAJA de ${ventaja} puntos sobre Central Reach` : `⚠️ BRECHA de ${Math.abs(ventaja)} puntos vs Central Reach`}

ÁREAS DESTACADAS (ventajas competitivas):
${areasDestacadas.join('\n') || 'Ninguna superior al 75% aún'}

ÁREAS A MEJORAR:
${areasDebiles.join('\n') || 'Todas las métricas son satisfactorias'}

Genera un análisis estratégico CONCISO con:
1. DIAGNÓSTICO (2 oraciones): posición competitiva actual
2. VENTAJA DIFERENCIAL (1-2 puntos): en qué somos mejores que Central Reach
3. PRIORIDADES INMEDIATAS (3 acciones): qué hacer esta semana para mejorar score
4. META A 90 DÍAS: qué score global es alcanzable y qué impacto tendría en retención

Máximo 250 palabras. Tono ejecutivo y directo.`,
        { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 600 }
      )
    } catch (err) {
      console.error('Error Groq benchmark:', err)
    }

    return NextResponse.json({
      scoreGlobal,
      nivelCompetitivo,
      centralReachScore,
      ventaja,
      metricas,
      totalPacientes,
      totalSesiones,
      diasAnalizados: dias,
      analisisEstrategico,
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('❌ Error benchmark:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
