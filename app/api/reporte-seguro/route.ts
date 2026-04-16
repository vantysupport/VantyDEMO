// app/api/reporte-seguro/route.ts
// 📊 CAPA 2 — Reporte para Seguros / IMSS / IEES / Seguro Privado
// Genera reporte técnico-legal en formato reconocido por aseguradoras
// Incluye: diagnósticos CIE-10/DSM-5, justificación médica, progreso cuantificado,
// plan de tratamiento, pronóstico y firmas profesionales

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'

// Mapeo diagnóstico → código CIE-10
const CIE10_MAP: Record<string, { codigo: string; descripcion: string }> = {
  'TEA': { codigo: 'F84.0', descripcion: 'Autismo infantil' },
  'Autismo': { codigo: 'F84.0', descripcion: 'Autismo infantil' },
  'Trastorno del Espectro Autista': { codigo: 'F84.0', descripcion: 'Trastorno del espectro autista' },
  'TDAH': { codigo: 'F90.0', descripcion: 'Trastorno de la actividad y de la atención' },
  'Síndrome de Down': { codigo: 'Q90', descripcion: 'Síndrome de Down' },
  'Retraso del desarrollo': { codigo: 'F89', descripcion: 'Trastorno del desarrollo psicológico sin especificación' },
  'Discapacidad intelectual': { codigo: 'F79', descripcion: 'Retraso mental sin especificación' },
  'Parálisis cerebral': { codigo: 'G80', descripcion: 'Parálisis cerebral' },
  'Trastorno del lenguaje': { codigo: 'F80', descripcion: 'Trastornos específicos del desarrollo del habla y del lenguaje' },
}

function getCIE10(diagnostico: string): { codigo: string; descripcion: string } {
  for (const [key, val] of Object.entries(CIE10_MAP)) {
    if (diagnostico.toLowerCase().includes(key.toLowerCase())) return val
  }
  return { codigo: 'F84.9', descripcion: 'Trastorno generalizado del desarrollo sin especificación' }
}

// ── FIX: Helper universal para parsear nivel_logro_objetivos ─────────────────
function parseLogro(val: any): number | null {
  if (val == null || val === '') return null
  if (typeof val === 'number') return Math.min(100, Math.max(0, Math.round(val)))
  const s = String(val).trim()
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const num = s.match(/(\d+)/)
  if (num) return Math.min(100, Math.max(0, parseInt(num[1])))
  const lower = s.toLowerCase()
  if (lower.includes('completamente') || lower.includes('independiente') || lower.includes('dominado')) return 90
  if (lower.includes('mayormente') || lower.includes('alto') || lower.includes('excelente')) return 75
  if (lower.includes('parcialmente') || lower.includes('medio') || lower.includes('proceso')) return 50
  if (lower.includes('mínimo') || lower.includes('bajo') || lower.includes('emergente') || lower.includes('inicial')) return 20
  if (lower.includes('no logrado') || lower.includes('sin respuesta')) return 5
  return null
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { childId, terapeuta = 'Terapeuta del Centro', periodoMeses = 3 } = await req.json()
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    const hoy = new Date()
    const fechaInicio = new Date(hoy)
    fechaInicio.setMonth(fechaInicio.getMonth() - periodoMeses)
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
    const fechaHoyStr = hoy.toISOString().split('T')[0]

    // 1. Paciente
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis')
      .eq('id', childId)
      .single()

    // 2. Sesiones del período
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .gte('fecha_sesion', fechaInicioStr)
      .order('fecha_sesion', { ascending: true })

    // 3. Programas ABA y objetivos
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('titulo, area, fase_actual, estado, criterio_dominio_pct, objetivos_cp(nombre, estado)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(15)

    // 4. Evaluaciones aplicadas
    const { data: evaluaciones } = await supabaseAdmin
      .from('evaluaciones')
      .select('tipo, fecha, datos, evaluador')
      .eq('child_id', childId)
      .order('fecha', { ascending: false })
      .limit(5)

    // 5. Alertas clínicas
    const { data: alertas } = await supabaseAdmin
      .from('agente_alertas')
      .select('tipo, titulo, prioridad')
      .eq('child_id', childId)
      .eq('resuelta', false)
      .order('prioridad', { ascending: true })
      .limit(5)

    // ── Calcular métricas ─────────────────────────────────────────────────────
    const nombre = (child as any)?.name || 'Paciente'
    const diagnostico = (child as any)?.diagnosis || 'Trastorno del Espectro Autista'
    const cie10 = getCIE10(diagnostico)

    const totalSesiones = sesiones?.length || 0
    const logros = sesiones?.map(s => 
      parseLogro((s as any).datos?.nivel_logro_objetivos) ??
      parseLogro((s as any).datos?.porcentaje_logro) ??
      parseLogro((s as any).datos?.logro_objetivos) ??
      parseLogro((s as any).datos?.porcentaje_exito)
    ).filter((v): v is number => v !== null) || []
    const promedioLogro = logros.length > 0 ? Math.round(logros.reduce((a, b) => a + b, 0) / logros.length) : 0

    // Frecuencia semanal de sesiones
    const semanasTotales = periodoMeses * 4.3
    const frecuenciaSemanal = totalSesiones > 0 ? (totalSesiones / semanasTotales).toFixed(1) : '0'

    // Objetivos por estado
    const todosObjetivos = programas?.flatMap(p => (p as any).objetivos_cp || []) || []
    const objDominados = todosObjetivos.filter((o: any) => o.estado === 'dominado').length
    const objActivos = todosObjetivos.filter((o: any) => o.estado === 'activo' || o.estado === 'intervencion').length
    const tasaDominio = todosObjetivos.length > 0 ? Math.round((objDominados / todosObjetivos.length) * 100) : 0

    // Tendencia (primer vs último tercio)
    const tercio = Math.floor(logros.length / 3)
    const promedioInicial = tercio > 0 ? logros.slice(0, tercio).reduce((a, b) => a + b, 0) / tercio : promedioLogro
    const promedioFinal = tercio > 0 ? logros.slice(-tercio).reduce((a, b) => a + b, 0) / tercio : promedioLogro
    const tendencia = promedioFinal - promedioInicial

    // ── Generar texto clínico-legal con IA ────────────────────────────────────
    const promptSeguro = `Eres un psicólogo clínico redactando un INFORME TÉCNICO OFICIAL para una aseguradora de salud / IMSS. El informe debe cumplir con estándares de documentación clínica para justificación de tratamiento continuado.

DATOS DEL CASO:
Paciente: ${nombre}
Diagnóstico Principal: ${diagnostico} (CIE-10: ${cie10.codigo} - ${cie10.descripcion})
Período del informe: ${fechaInicioStr} al ${fechaHoyStr} (${periodoMeses} meses)
Sesiones realizadas: ${totalSesiones} (frecuencia: ${frecuenciaSemanal} sesiones/semana)
Promedio de logro terapéutico: ${promedioLogro}%
Objetivos dominados: ${objDominados} de ${todosObjetivos.length} trabajados (${tasaDominio}%)
Tendencia: ${tendencia >= 0 ? `Mejora de +${Math.round(tendencia)} puntos` : `Variación de ${Math.round(tendencia)} puntos`}

PROGRAMAS ACTIVOS:
${programas?.filter(p => p.estado === 'activo').map(p => `- ${p.area}: "${p.titulo}" (fase: ${p.fase_actual})`).join('\n') || 'No registrados'}

EVALUACIONES APLICADAS:
${evaluaciones?.map(e => `- ${e.tipo} (${e.fecha})`).join('\n') || 'Ver expediente clínico'}

Genera las siguientes secciones en lenguaje técnico-legal formal:

## JUSTIFICACIÓN MÉDICA DE CONTINUIDAD DE TRATAMIENTO
2-3 párrafos que justifiquen por qué el tratamiento debe continuar, con evidencia cuantificada.

## DESCRIPCIÓN DEL TRATAMIENTO
Descripción técnica de las intervenciones ABA aplicadas (técnicas, modalidad, intensidad).

## EVOLUCIÓN Y PRONÓSTICO
Análisis objetivo del progreso con datos específicos. Pronóstico clínico a 6 meses.

## PLAN DE TRATAMIENTO PROPUESTO
Objetivos clínicos para el siguiente período (${periodoMeses} meses), con métricas esperadas.

## CRITERIOS DE ALTA
Indicadores clínicos específicos bajo los cuales se podría dar alta o reducir intensidad.

Usa terminología DSM-5 y CIE-10. Tono objetivo, formal y basado en evidencia. No uses primera persona.`

    const textoInforme = await callGroqSimple(
      'Eres un psicólogo clínico certificado redactando informes técnicos para aseguradoras de salud.',
      promptSeguro,
      { model: GROQ_MODELS.SMART, temperature: 0.2, maxTokens: 1800 }
    )

    const reporte = {
      tipo: 'INFORME_SEGURO_CONTINUIDAD',
      numero_referencia: `JA-${childId.slice(0, 8).toUpperCase()}-${hoy.getFullYear()}${String(hoy.getMonth()+1).padStart(2,'0')}`,
      centro: 'Centro Jugando Aprendo',
      paciente: {
        nombre,
        diagnostico,
        cie10: cie10.codigo,
        descripcion_cie10: cie10.descripcion,
      },
      periodo: {
        inicio: fechaInicioStr,
        fin: fechaHoyStr,
        meses: periodoMeses
      },
      estadisticas: {
        total_sesiones: totalSesiones,
        frecuencia_semanal: parseFloat(frecuenciaSemanal),
        promedio_logro_pct: promedioLogro,
        objetivos_dominados: objDominados,
        objetivos_activos: objActivos,
        tasa_dominio_pct: tasaDominio,
        tendencia_puntos: Math.round(tendencia),
        alertas_activas: alertas?.length || 0
      },
      programas_activos: programas?.filter(p => p.estado === 'activo').map(p => ({
        area: p.area,
        titulo: p.titulo,
        fase: p.fase_actual
      })) || [],
      evaluaciones_aplicadas: evaluaciones?.map(e => ({ tipo: e.tipo, fecha: e.fecha })) || [],
      texto_informe: textoInforme,
      terapeuta_responsable: terapeuta,
      fecha_emision: fechaHoyStr,
      valido_hasta: new Date(hoy.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }

    try {
      await supabaseAdmin.from('reportes_seguros').insert({
        child_id: childId,
        numero_referencia: reporte.numero_referencia,
        periodo_inicio: fechaInicioStr,
        periodo_fin: fechaHoyStr,
        estadisticas: reporte.estadisticas,
        texto_informe: textoInforme,
        created_at: new Date().toISOString()
      })
    } catch { /* no bloquear */ }

    return NextResponse.json(reporte)

  } catch (e: any) {
    console.error('❌ Error reporte-seguro:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
