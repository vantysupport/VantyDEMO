// app/api/reporte-padres/route.ts
// 📊 CAPA 2 — Reporte para Padres en lenguaje emocional y accesible
// Genera un reporte mensual completo para los padres:
// progreso real, logros celebrables, tareas, próxima cita, predicción
// Completamente en lenguaje simple, cálido y motivador

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync, sendWspToParent, buildParentMessage, notifyParentDirect } from '@/lib/notifications'
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
  if (lower.includes("completamente") || lower.includes("independiente") || lower.includes("dominado")) return 90
  if (lower.includes("mayormente") || lower.includes("alto") || lower.includes("excelente")) return 75
  if (lower.includes("parcialmente") || lower.includes("medio") || lower.includes("proceso")) return 50
  if (lower.includes("mínimo") || lower.includes("bajo") || lower.includes("emergente")) return 20
  if (lower.includes("no logrado") || lower.includes("sin respuesta")) return 5
  return null
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { childId, periodoSemanas = 4 } = await req.json()
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    const fechaInicio = new Date()
    fechaInicio.setDate(fechaInicio.getDate() - periodoSemanas * 7)
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0]
    const hoy = new Date().toISOString().split('T')[0]

    // 1. Datos del paciente
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

    // 3. Tareas para el hogar pendientes y completadas
    const { data: tareas } = await supabaseAdmin
      .from('tareas_hogar')
      .select('titulo, completada, instrucciones, fecha_asignada, fecha_limite')
      .eq('child_id', childId)
      .eq('activa', true)
      .order('fecha_asignada', { ascending: false })
      .limit(8)

    // 4. Próxima cita
    const { data: proximaCita } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('fecha, hora_inicio, tipo, estado')
      .eq('child_id', childId)
      .gte('fecha', hoy)
      .in('estado', ['programada', 'confirmada'])
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle()

    // 5. Programas ABA activos (habilidades en trabajo)
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('titulo, area, fase_actual, objetivos_cp(nombre, estado)')
      .eq('child_id', childId)
      .eq('estado', 'activo')
      .limit(6)

    // 6. Predicción guardada
    const { data: prediccion } = await supabaseAdmin
      .from('predicciones_ia')
      .select('prediccion_30d, prediccion_90d, tendencia_slope, analisis_ia')
      .eq('child_id', childId)
      .maybeSingle()

    // ── Calcular métricas del período ─────────────────────────────────────────
    const totalSesiones = sesiones?.length || 0
    const logros = sesiones?.map(s => parseLogro(s.datos?.nivel_logro_objetivos)).filter((v): v is number => v !== null) || []
    const promedioLogro = logros.length > 0 ? Math.round(logros.reduce((a, b) => a + b, 0) / logros.length) : 0
    const promedioAtencion = sesiones ? Math.round(
      sesiones.map(s => Number(s.datos?.nivel_atencion || 0)).filter(v => v > 0)
        .reduce((a, b, _, arr) => a + b / arr.length, 0) * 20
    ) : 0

    const tareasCompletadas = tareas?.filter(t => t.completada).length || 0
    const tareasPendientes = tareas?.filter(t => !t.completada).length || 0

    // Logros destacables de las sesiones (avances_observados)
    const logrosDestacados = sesiones
      ?.map(s => s.datos?.avances_observados || s.datos?.destacar_positivo || '')
      .filter(Boolean)
      .slice(-3) || []

    // Habilidades nuevas trabajadas
    const habilidadesNuevas = sesiones
      ?.flatMap(s => Array.isArray(s.datos?.habilidades_objetivo) ? s.datos.habilidades_objetivo : [s.datos?.habilidades_objetivo].filter(Boolean))
      .filter(Boolean)
      .slice(-5) || []

    const nombrePaciente = (child as any)?.name || 'tu hijo/a'
    const diagnostico = (child as any)?.diagnosis || ''
    const edadAnios = (child as any)?.age

    // ── Generar reporte con IA ─────────────────────────────────────────────────
    const promptPadres = `Eres ARIA, el asistente de comunicación familiar del Centro Vanty ABA, gestionado a través de la plataforma Vanty ABA. Tu tarea es escribir un REPORTE MENSUAL PARA PADRES sobre el progreso de su hijo/a.

REGLAS CRÍTICAS:
- Lenguaje SIMPLE, CÁLIDO y POSITIVO. Los padres no son especialistas.
- CELEBRA cada avance, por pequeño que sea.
- Nunca uses jerga técnica (no digas ABA, BCBA, schedule de reforzamiento, etc.)
- Habla directamente a los padres usando SIEMPRE pasado perfecto: "Esta semana Juan ha logrado...", "ha demostrado...", "ha alcanzado..."
- NUNCA uses presente simple ni pasado simple para describir logros. SIEMPRE pasado perfecto compuesto.
- Máximo 450 palabras en el texto narrativo.
- Sé ESPECÍFICO con los datos que tienes, no genérico.

DATOS DEL PERÍODO (${periodoSemanas} semanas):
Paciente: ${nombrePaciente}${edadAnios ? `, ${edadAnios} años` : ''}${diagnostico ? ` — ${diagnostico}` : ''}
Sesiones realizadas: ${totalSesiones}
Promedio de logro en objetivos: ${promedioLogro}%
Nivel de atención promedio: ${promedioAtencion}%
Tareas completadas en casa: ${tareasCompletadas} de ${(tareasCompletadas + tareasPendientes)}

HABILIDADES QUE ESTÁ TRABAJANDO:
${programas?.map(p => `- ${p.titulo} (área: ${p.area})`).join('\n') || 'No registradas'}

AVANCES OBSERVADOS POR LOS TERAPEUTAS:
${logrosDestacados.join(' | ') || 'Ver sesiones registradas'}

HABILIDADES NUEVAS PRACTICADAS:
${habilidadesNuevas.slice(0, 5).join(', ') || 'Ver registro de sesiones'}

PREDICCIÓN:
${prediccion ? `Se proyecta que ${nombrePaciente} llegará a ${prediccion.prediccion_30d}% de logro en 30 días y ${prediccion.prediccion_90d}% en 3 meses.` : 'En análisis.'}

ESCRIBE EL REPORTE CON ESTAS SECCIONES (en texto continuo, no como lista):

1. SALUDO Y RESUMEN DEL MES — cómo estuvo el mes en general, en 2-3 oraciones
2. LOGROS CELEBRABLES — qué aprendió o mejoró este mes (menciona cosas específicas de los datos)
3. CÓMO ESTÁ PROGRESANDO — usa los porcentajes pero explícalos como "de cada 10 veces que pedimos X, ahora lo hace Y veces"
4. LO QUE ESTÁ PRACTICANDO EN TERAPIA — explica las áreas de trabajo en lenguaje de familia
5. ACTIVIDADES EN CASA — recordatorio cálido de las tareas
6. PRÓXIMOS PASOS — qué viene en las próximas semanas
7. MENSAJE MOTIVACIONAL — cierre cálido y esperanzador

Dirígete a los padres como "ustedes" o por "familia".`


    // ━━━ CEREBRO IA: buscar conocimiento clínico relevante ━━━


    let _cerebroCtx = ''


    try {


      const _query = 'reporte padres ABA progreso comunicación familia'


      const _kb = await buildAIContext(undefined, undefined, undefined, _query)


      _cerebroCtx = _kb.knowledgeContext


    } catch { /* Cerebro IA no disponible */ }


    // ━━━ FIN CEREBRO IA ━━━


    const textoReporte = await callGroqSimple(
      'Eres ARIA, asistente de comunicación familiar cálida y profesional de un centro terapéutico.',
      promptPadres,
      { model: GROQ_MODELS.SMART, temperature: 0.6, maxTokens: 1200 }
    )

    // ── Construir respuesta estructurada ──────────────────────────────────────
    const reporte = {
      paciente: {
        nombre: nombrePaciente,
        edad: edadAnios,
        diagnostico
      },
      periodo: {
        inicio: fechaInicioStr,
        fin: hoy,
        semanas: periodoSemanas
      },
      metricas: {
        sesiones_realizadas: totalSesiones,
        promedio_logro: promedioLogro,
        promedio_atencion: promedioAtencion,
        tareas_completadas: tareasCompletadas,
        tareas_pendientes: tareasPendientes,
        nivel_general: promedioLogro >= 75 ? 'Excelente' : promedioLogro >= 55 ? 'Muy bien' : promedioLogro >= 35 ? 'En progreso' : 'Necesita apoyo'
      },
      habilidades_trabajo: programas?.map(p => ({ area: p.area, titulo: p.titulo })) || [],
      tareas: tareas?.map(t => ({
        titulo: t.titulo,
        completada: t.completada,
        instrucciones: t.instrucciones?.slice(0, 150),
        fecha_limite: t.fecha_limite
      })) || [],
      proxima_cita: proximaCita ? {
        fecha: (proximaCita as any).fecha,
        hora: (proximaCita as any).hora_inicio?.slice(0, 5),
        tipo: (proximaCita as any).tipo
      } : null,
      prediccion: prediccion ? {
        logro_30d: (prediccion as any).prediccion_30d,
        logro_90d: (prediccion as any).prediccion_90d,
        tendencia: (prediccion as any).tendencia_slope > 0 ? 'positiva' : 'estable'
      } : null,
      texto_reporte: textoReporte,
      generado_en: new Date().toISOString()
    }

    // Guardar reporte
    try {
      await supabaseAdmin.from('reportes_padres').insert({
        child_id: childId,
        periodo_inicio: fechaInicioStr,
        periodo_fin: hoy,
        metricas: reporte.metricas,
        texto_reporte: textoReporte,
        created_at: new Date().toISOString()
      })
    } catch { /* no bloquear */ }

    // WhatsApp al admin — nuevo informe disponible
    const pName = (reporte as any)?.paciente_nombre || childId
    notifyAsync({
      tipo: 'informe_nuevo',
      vars: {
        paciente: pName,
        periodo: `${fechaInicioStr} → ${hoy}`,
      },
    })

    // WhatsApp directo al padre — informe listo
    try {
      const { data: pLink } = await supabaseAdmin
        .from('parent_accounts').select('user_id').eq('child_id', childId).maybeSingle()
      if (pLink?.user_id) {
        const { data: pProf } = await supabaseAdmin
          .from('profiles').select('phone, wsp_notif').eq('id', pLink.user_id).maybeSingle()
        if ((pProf as any)?.phone && (pProf as any)?.wsp_notif !== false) {
          const msg = buildParentMessage('informe_nuevo', { paciente: pName, periodo: `${fechaInicioStr} → ${hoy}` })
          sendWspToParent((pProf as any).phone, msg).catch(() => {})
        }
      }
    } catch { /* silencioso */ }

    return NextResponse.json(reporte)

  } catch (e: any) {
    console.error('❌ Error reporte-padres:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
