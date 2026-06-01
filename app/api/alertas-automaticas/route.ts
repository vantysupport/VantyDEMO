// app/api/alertas-automaticas/route.ts
// Motor de alertas proactivas - ejecutar como cron semanal
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getLangInstruction } from '@/lib/lang'

// ─── GET: ejecutar análisis proactivo de todos los pacientes ──
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cronSecret = searchParams.get('secret')

  // Proteger endpoint del cron
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const resultados = await ejecutarMotorAlertas()
    return NextResponse.json(resultados)
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── POST: analizar paciente específico ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const { child_id } = await req.json()
    const alertas = await analizarPaciente(child_id)
    return NextResponse.json({ alertas })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── MOTOR PRINCIPAL ─────────────────────────────────────────
async function ejecutarMotorAlertas() {
  const hoy = new Date().toISOString().split('T')[0]
  const resultados = { analizados: 0, alertasGeneradas: 0, errores: 0 }

  // Obtener todos los pacientes activos
  const { data: pacientes } = await supabaseAdmin
    .from('children')
    .select('id, name, diagnosis')

  if (!pacientes) return resultados

  for (const paciente of pacientes) {
    try {
      const alertas = await analizarPaciente(paciente.id)
      resultados.analizados++
      resultados.alertasGeneradas += alertas.length
    } catch (err) {
      console.error('Error analizando paciente:', paciente.id, err)
      resultados.errores++
    }
  }

  return resultados
}

// ─── ANÁLISIS POR PACIENTE ────────────────────────────────────
async function analizarPaciente(childId: string): Promise<any[]> {
  const hoy = new Date()
  const hoyStr = hoy.toISOString().split('T')[0]
  const alertasNuevas: any[] = []

  // ── REGLA 1: Sin sesión en más de 14 días ─────────────────
  const { data: ultimaSesion } = await supabaseAdmin
    .from('agenda_sesiones')
    .select('fecha, estado')
    .eq('child_id', childId)
    .eq('estado', 'realizada')
    .order('fecha', { ascending: false })
    .limit(1)
    .single()

  if (ultimaSesion) {
    const diasSinSesion = Math.floor((hoy.getTime() - new Date(ultimaSesion.fecha).getTime()) / (1000 * 60 * 60 * 24))
    if (diasSinSesion > 14) {
      await crearAlertaSiNoExiste({
        child_id: childId,
        tipo: 'ausencia_prolongada',
        titulo: `Sin sesion hace ${diasSinSesion} dias`,
        descripcion: `El paciente no tiene sesiones registradas en los ultimos ${diasSinSesion} dias. Verificar con la familia.`,
        prioridad: diasSinSesion > 30 ? 1 : 2,
        resuelta: false
      })
      alertasNuevas.push({ tipo: 'ausencia_prolongada', dias: diasSinSesion })
    }
  } else {
    // Nunca ha tenido sesión
    const { data: child } = await supabaseAdmin.from('children').select('created_at').eq('id', childId).single()
    if (child) {
      const diasDesdeCreacion = Math.floor((hoy.getTime() - new Date((child as any).created_at).getTime()) / (1000 * 60 * 60 * 24))
      if (diasDesdeCreacion > 7) {
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: 'sin_sesiones',
          titulo: 'Paciente sin sesiones registradas',
          descripcion: 'Este paciente esta registrado pero no tiene sesiones en el sistema. Programar primera sesion.',
          prioridad: 2,
          resuelta: false
        })
        alertasNuevas.push({ tipo: 'sin_sesiones' })
      }
    }
  }

  // ── REGLA 2: Estancamiento/regresión por programa ABA individual ───
  // Solo se analizan sesiones de INTERVENCIÓN (fase ≠ 'linea_base').
  // La línea base mide el nivel pre-tratamiento y no debe incluirse en el
  // análisis de progreso. Tendencia detectada por regresión lineal (slope).
  const { data: programasABA } = await supabaseAdmin
    .from('programas_aba')
    .select('id, titulo, criterio_dominio_pct, criterio_sesiones_consecutivas, sesiones_datos_aba(fecha, porcentaje_exito, fase, set)')
    .eq('child_id', childId)

  // Helper local — pendiente por regresión lineal
  const slopeLineal = (ys: number[]) => {
    const n = ys.length
    if (n < 2) return 0
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
    ys.forEach((y, i) => { const x = i + 1; sumX += x; sumY += y; sumXY += x * y; sumXX += x * x })
    const denom = n * sumXX - sumX * sumX
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  }

  const todasSesiones: { fecha: string; porcentaje_exito: number }[] = []
  for (const prog of (programasABA || [])) {
    const sesionesProg = ((prog as any).sesiones_datos_aba || [])
      .filter((s: any) => s.porcentaje_exito != null)
      .sort((a: any, b: any) => a.fecha.localeCompare(b.fecha))

    for (const s of sesionesProg) todasSesiones.push(s)

    // Excluir línea base
    const sesionesIntervencion = sesionesProg.filter((s: any) => s.fase !== 'linea_base')
    if (sesionesIntervencion.length < 2) continue

    // FIX clínico CRÍTICO: análisis dentro del SET activo, no cruzando sets.
    // Pasar de Set 2 (90%) a Set 3 (20%) es transición esperada, no regresión.
    const setsConSesiones = Array.from(new Set(sesionesIntervencion.map((s: any) => s.set ?? '__none__')))
    const setActivoA = setsConSesiones[setsConSesiones.length - 1] ?? '__none__'
    const sesionesSetActivoA = sesionesIntervencion.filter((s: any) => (s.set ?? '__none__') === setActivoA)
    const etiquetaSet = setActivoA && setActivoA !== '__none__' ? ` (${setActivoA})` : ''

    const criterio = (prog as any).criterio_dominio_pct || 90
    const nombre = (prog as any).titulo || 'Programa ABA'

    // Estancamiento: ≥5 sesiones DEL SET ACTIVO, pendiente plana, promedio bajo
    if (sesionesSetActivoA.length >= 5) {
      const ventana = sesionesSetActivoA.slice(-Math.min(6, sesionesSetActivoA.length))
      const valores = ventana.map((s: any) => s.porcentaje_exito as number)
      const prom = valores.reduce((a: number, b: number) => a + b, 0) / valores.length
      const slope = Math.round(slopeLineal(valores) * 10) / 10
      const esPlana = Math.abs(slope) <= 1.5
      const lejosDelCriterio = prom < Math.min(70, criterio - 10)
      if (esPlana && lejosDelCriterio) {
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: `estancamiento_${(prog as any).id}`,
          titulo: `Estancamiento en "${nombre}"${etiquetaSet}`,
          descripcion: `${sesionesSetActivoA.length} sesiones en el set${etiquetaSet} sin mejora estadística (pendiente ${slope >= 0 ? '+' : ''}${slope}%/sesión sobre las últimas ${valores.length}, promedio ${Math.round(prom)}%, criterio ${criterio}%). Revisar estrategia.`,
          prioridad: 1,
          resuelta: false
        })
        alertasNuevas.push({ tipo: `estancamiento_${(prog as any).id}` })
      }
    }

    // ── LOGRO: Dominio alcanzado en el set activo ──
    const nConsecutivas = Number((prog as any).criterio_sesiones_consecutivas) || 2
    if (sesionesSetActivoA.length >= nConsecutivas) {
      const ultimas = sesionesSetActivoA.slice(-nConsecutivas)
      const todasCumplen = ultimas.every((s: any) => s.porcentaje_exito >= criterio)
      if (todasCumplen) {
        const promUltimas = Math.round(ultimas.reduce((a: number, s: any) => a + s.porcentaje_exito, 0) / ultimas.length)
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: `logro_dominio_${(prog as any).id}`,
          titulo: `🎯 Criterio alcanzado: "${nombre}"${etiquetaSet}`,
          descripcion: `${nConsecutivas} sesiones consecutivas cumpliendo criterio de ${criterio}% (promedio ${promUltimas}%)${etiquetaSet}. Considera pasar a mantenimiento o avanzar al siguiente set.`,
          prioridad: 3,
          resuelta: false
        })
        alertasNuevas.push({ tipo: `logro_dominio_${(prog as any).id}` })
      }
    }

    // ── LOGRO: Progreso consistente dentro del set ──
    if (sesionesSetActivoA.length >= 5) {
      const ventana = sesionesSetActivoA.slice(-Math.min(6, sesionesSetActivoA.length))
      const valoresV = ventana.map((s: any) => s.porcentaje_exito as number)
      const promV = valoresV.reduce((a: number, b: number) => a + b, 0) / valoresV.length
      const slopeV = Math.round(slopeLineal(valoresV) * 10) / 10
      if (slopeV >= 5 && promV >= 60) {
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: `logro_progreso_${(prog as any).id}`,
          titulo: `📈 Progreso consistente en "${nombre}"${etiquetaSet}`,
          descripcion: `Tendencia ascendente clara dentro del set${etiquetaSet}: +${slopeV}% por sesión, promedio ${Math.round(promV)}% sobre las últimas ${valoresV.length} sesiones. Buen avance hacia el criterio de ${criterio}%.`,
          prioridad: 3,
          resuelta: false
        })
        alertasNuevas.push({ tipo: `logro_progreso_${(prog as any).id}` })
      }
    }

    // Regresión DENTRO del set activo: bajó más de 15 puntos vs ventana previa del mismo set
    if (sesionesSetActivoA.length >= 4) {
      const valores = sesionesSetActivoA.map((s: any) => s.porcentaje_exito as number)
      const recientes = valores.slice(-2)
      const anteriores = valores.slice(-4, -2)
      const promReciente = recientes.reduce((a: number, b: number) => a + b, 0) / recientes.length
      const promAnterior = anteriores.reduce((a: number, b: number) => a + b, 0) / anteriores.length
      if (promAnterior - promReciente > 15) {
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: `regresion_${(prog as any).id}`,
          titulo: `Regresión en "${nombre}"${etiquetaSet}`,
          descripcion: `Dentro del set${etiquetaSet}, "${nombre}" bajó ${Math.round(promAnterior - promReciente)} puntos (${Math.round(promAnterior)}% → ${Math.round(promReciente)}%). Revisar antecedentes y reforzadores.`,
          prioridad: 1,
          resuelta: false
        })
        alertasNuevas.push({ tipo: `regresion_${(prog as any).id}` })
      }
    }
  }
  const ultimasSesionesABA = [...todasSesiones].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)

  // ── REGLA 3: Evaluación neuropsicológica vencida (>6 meses) ─
  const EVALUACIONES = ['evaluacion_brief2', 'evaluacion_ados2', 'evaluacion_vineland3', 'evaluacion_wiscv', 'evaluacion_basc3']
  const haceSeisM = new Date()
  haceSeisM.setMonth(haceSeisM.getMonth() - 6)

  for (const tabla of EVALUACIONES) {
    try {
      const { data: eval_ } = await supabaseAdmin
        .from(tabla)
        .select('created_at')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!eval_) {
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: `evaluacion_pendiente_${tabla}`,
          titulo: `Evaluacion ${tabla.replace('evaluacion_', '').toUpperCase()} pendiente`,
          descripcion: `El paciente no tiene la evaluacion ${tabla.replace('evaluacion_', '').toUpperCase()} registrada en el sistema.`,
          prioridad: 2,
          resuelta: false
        })
        alertasNuevas.push({ tipo: `evaluacion_pendiente_${tabla}` })
      } else if (new Date((eval_ as any).created_at) < haceSeisM) {
        const mesesDesde = Math.floor((hoy.getTime() - new Date((eval_ as any).created_at).getTime()) / (1000 * 60 * 60 * 24 * 30))
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: `evaluacion_vencida_${tabla}`,
          titulo: `Evaluacion ${tabla.replace('evaluacion_', '').toUpperCase()} vencida (${mesesDesde} meses)`,
          descripcion: `La ultima evaluacion ${tabla.replace('evaluacion_', '').toUpperCase()} tiene ${mesesDesde} meses. Se recomienda actualizar.`,
          prioridad: 2,
          resuelta: false
        })
        alertasNuevas.push({ tipo: `evaluacion_vencida_${tabla}`, meses: mesesDesde })
      }
    } catch { /* tabla sin registros - ok */ }
  }

  // ── REGLA 4: Tarea sin respuesta >7 días ─────────────────
  const hace7dias = new Date()
  hace7dias.setDate(hace7dias.getDate() - 7)

  const { data: tareasSinRespuesta } = await supabaseAdmin
    .from('tareas_hogar')
    .select('id, titulo, fecha_asignada')
    .eq('child_id', childId)
    .eq('completada', false)
    .eq('activa', true)
    .lte('fecha_asignada', hace7dias.toISOString().split('T')[0])

  if (tareasSinRespuesta && tareasSinRespuesta.length > 0) {
    await crearAlertaSiNoExiste({
      child_id: childId,
      tipo: 'tareas_sin_respuesta',
      titulo: `${tareasSinRespuesta.length} tarea(s) sin respuesta de la familia`,
      descripcion: `La familia no ha respondido ${tareasSinRespuesta.length} tarea(s) terapeutica(s) en mas de 7 dias. Hacer seguimiento.`,
      prioridad: 2,
      resuelta: false
    })
    alertasNuevas.push({ tipo: 'tareas_sin_respuesta', cantidad: tareasSinRespuesta.length })
  }

  // ── REGLA 5: Análisis IA de tendencia (si hay suficientes datos) ─
  if (ultimasSesionesABA.length >= 5) {
    try {
      const sesionesParaIA = ultimasSesionesABA.map(s => ({ fecha_sesion: s.fecha, datos: { nivel_logro_objetivos: s.porcentaje_exito, objetivo_principal: 'Programa ABA' } }))
      const alertaIA = await analizarTendenciaConIA(childId, sesionesParaIA)
      if (alertaIA) {
        await crearAlertaSiNoExiste({
          child_id: childId,
          tipo: 'analisis_ia_tendencia',
          titulo: 'Analisis IA: Patron detectado',
          descripcion: alertaIA,
          prioridad: 2,
          resuelta: false
        })
        alertasNuevas.push({ tipo: 'analisis_ia_tendencia' })
      }
    } catch { /* IA fallo - ok, continuar */ }
  }

  return alertasNuevas
}

// ─── HELPER: Crear alerta sin duplicar ────────────────────────
async function crearAlertaSiNoExiste(alerta: any) {
  // Verificar si ya existe alerta del mismo tipo no resuelta
  const hace3dias = new Date()
  hace3dias.setDate(hace3dias.getDate() - 3)

  const { data: existente } = await supabaseAdmin
    .from('agente_alertas')
    .select('id')
    .eq('child_id', alerta.child_id)
    .eq('tipo', alerta.tipo)
    .eq('resuelta', false)
    .gte('created_at', hace3dias.toISOString())
    .single()

  if (!existente) {
    await supabaseAdmin.from('agente_alertas').insert(alerta)
  }
}

// ─── ANÁLISIS IA DE TENDENCIA ─────────────────────────────────
async function analizarTendenciaConIA(childId: string, sesiones: any[]): Promise<string | null> {
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, diagnosis')
    .eq('id', childId)
    .single()

  const resumenSesiones = sesiones.map((s, i) => ({
    numero: i + 1,
    fecha: s.fecha_sesion,
    objetivo: s.datos?.objetivo_principal,
    atencion: s.datos?.nivel_atencion,
    logro: s.datos?.nivel_logro_objetivos,
    conducta: s.datos?.conducta
  }))

  const prompt = `Analiza estas ultimas ${sesiones.length} sesiones ABA del paciente ${(child as any)?.name} (${(child as any)?.diagnosis}):

${JSON.stringify(resumenSesiones, null, 2)}

Detecta si hay algun patron preocupante que el equipo terapeutico deba atender. 
Si ves algo importante, responde en 1-2 oraciones concretas.
Si todo va bien, responde exactamente: "SIN_ALERTA"
No uses markdown.`

  const locale = 'es' // alertas internas siempre en español
  const response = await callGroqSimple(
    'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.' + getLangInstruction(locale),
    prompt,
    { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 500 }
  )

  const texto = response?.trim()
  if (!texto || texto === 'SIN_ALERTA' || texto.includes('SIN_ALERTA')) return null
  return texto
}
