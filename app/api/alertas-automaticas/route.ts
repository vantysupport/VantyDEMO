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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── POST: analizar paciente específico ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const { child_id } = await req.json()
    const alertas = await analizarPaciente(child_id)
    return NextResponse.json({ alertas })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
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

  // ── REGLA 2: Estancamiento en objetivos ABA ───────────────
  const { data: ultimasSesionesABA } = await supabaseAdmin
    .from('registro_aba')
    .select('fecha_sesion, datos')
    .eq('child_id', childId)
    .order('fecha_sesion', { ascending: false })
    .limit(5)

  if (ultimasSesionesABA && ultimasSesionesABA.length >= 3) {
    const logros = ultimasSesionesABA.map(s => {
      const logro = s.datos?.nivel_logro_objetivos || ''
      return logro.includes('76') || logro.includes('Completamente') ? 'alto'
        : logro.includes('51') || logro.includes('Mayormente') ? 'medio'
        : 'bajo'
    })

    const ultimasTres = logros.slice(0, 3)
    if (ultimasTres.every(l => l === 'bajo')) {
      await crearAlertaSiNoExiste({
        child_id: childId,
        tipo: 'estancamiento_objetivos',
        titulo: 'Posible estancamiento en objetivos',
        descripcion: 'El paciente ha mostrado logros bajos en las ultimas 3 sesiones consecutivas. Revisar y ajustar el programa ABA.',
        prioridad: 1,
        resuelta: false
      })
      alertasNuevas.push({ tipo: 'estancamiento_objetivos' })
    }
  }

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
  if (ultimasSesionesABA && ultimasSesionesABA.length >= 5) {
    try {
      const alertaIA = await analizarTendenciaConIA(childId, ultimasSesionesABA)
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
