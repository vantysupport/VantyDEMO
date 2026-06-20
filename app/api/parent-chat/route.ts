// app/api/parent-chat/route.ts
// Chat IA exclusivo para padres - respuestas en lenguaje accesible
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroq, callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildParentChatContext } from '@/lib/ai-context-builder'
import { checkAriaRateLimit } from '@/lib/aria-rate-limit'

// Forzar ejecución dinámica — el contexto del paciente cambia constantemente
// (sesiones registradas, alertas nuevas, fichas, etc.) y no debe cachearse.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// FIX: calcular edad en años desde birth_date cuando age no está disponible
function calcularEdad(birthDate: string | null | undefined, ageFallback: number | null | undefined): string {
  if (birthDate) {
    const hoy = new Date()
    const nacimiento = new Date(birthDate)
    const diff = hoy.getFullYear() - nacimiento.getFullYear()
    const m = hoy.getMonth() - nacimiento.getMonth()
    const edad = (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) ? diff - 1 : diff
    if (edad >= 0 && edad < 120) return `${edad} años`
  }
  if (ageFallback != null && !isNaN(Number(ageFallback))) return `${ageFallback} años`
  return 'edad no registrada'
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // FIX: aceptar AMBOS formatos de campo:
    // - Frontend padre usa: { question, childId, childName }
    // - Otros clientes usan: { mensaje, childId, parentUserId }
    const mensaje      = body.question || body.mensaje
    const childId      = body.childId
    const parentUserId = body.parentUserId || null   // opcional — no bloquear si no viene
    const childName    = body.childName || null

    if (!mensaje || !childId) {
      return NextResponse.json({ error: 'Faltan campos requeridos: mensaje y childId' }, { status: 400 })
    }

    // Rate limiting de ARIA (configurable por el programador en /control).
    // Clave por familia: parentUserId si viene, si no el childId.
    const rl = await checkAriaRateLimit(String(parentUserId || childId))
    if (!rl.allowed) {
      // El frontend muestra data.text como respuesta de ARIA → ahí va el aviso.
      return NextResponse.json(
        { text: rl.message, error: rl.message, rateLimited: true, retryAfterMinutes: rl.retryAfterMinutes },
        { status: 429 },
      )
    }

    // Verificar acceso del padre solo si se provee parentUserId
    let nombrePadre = 'Familia'
    if (parentUserId) {
      const { data: acceso } = await supabaseAdmin
        .from('parent_accounts')
        .select('id, nombre')
        .eq('user_id', parentUserId)
        .eq('child_id', childId)
        .maybeSingle()   // maybeSingle en vez de single — no lanza error si no encuentra

      if (acceso) nombrePadre = (acceso as any).nombre || 'Familia'
      // No bloqueamos si no hay acceso registrado — el padre puede venir de sesión directa
    }

    // Cargar historial del chat (últimas 10 conversaciones)
    const historialQuery = supabaseAdmin
      .from('chat_padres')
      .select('rol, mensaje')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (parentUserId) historialQuery.eq('parent_user_id', parentUserId)
    const { data: historial } = await historialQuery
    const historialOrdenado = (historial || []).reverse()

    // Cargar contexto FILTRADO del paciente (solo info apta para padres)
    const contexto = await cargarContextoPadre(childId)
    if ((contexto as any)._debug) {
      console.log('[parent-chat] contexto cargado:', (contexto as any)._debug)
    }

    // Guardar mensaje (solo si hay parentUserId para no generar basura)
    if (parentUserId) {
      try {
        await supabaseAdmin.from('chat_padres').insert({
          child_id: childId,
          parent_user_id: parentUserId,
          rol: 'user',
          mensaje
        })
      } catch {} // no bloquear si falla el guardado
    }

    // Generar respuesta IA
    const respuesta = await generarRespuestaPadre(mensaje, contexto, historialOrdenado, nombrePadre, req.headers.get('x-locale') || 'es')

    // Guardar respuesta
    if (parentUserId) {
      try {
        await supabaseAdmin.from('chat_padres').insert({
          child_id: childId,
          parent_user_id: parentUserId,
          rol: 'assistant',
          mensaje: respuesta
        })
      } catch {}
    }

    // FIX: responder con AMBOS campos para compatibilidad con los dos frontends.
    // _debug expone qué cargó el contexto — útil cuando ARIA dice "no hay programas"
    // pero la UI sí los muestra. Mirar en DevTools → Network → respuesta del POST.
    return NextResponse.json({
      respuesta,
      text: respuesta,
      _debug: (contexto as any)?._debug || null,
    })
  } catch (e: any) {
    console.error('❌ Error en parent-chat:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId      = searchParams.get('child_id')
  const parentUserId = searchParams.get('parent_user_id')

  try {
    const { data } = await supabaseAdmin
      .from('chat_padres')
      .select('id, rol, mensaje, created_at')
      .eq('child_id', childId!)
      .eq('parent_user_id', parentUserId!)
      .order('created_at', { ascending: true })
      .limit(50)

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── CONTEXTO COMPLETO PARA PADRES ───────────────────────────
// ARIA del padre carga ABSOLUTAMENTE TODOS los datos del niño:
//  · Datos básicos + diagnóstico
//  · Programas ABA con sets y campos clínicos
//  · Sesiones de datos ABA (las últimas 12)
//  · Sesiones legacy (registro_aba)
//  · Tareas del hogar
//  · Citas próximas y pasadas
//  · Evaluaciones profesionales (BRIEF-2, ADOS-2, Vineland-3, WISC-V, BASC-3)
//  · Formularios respondidos
//  · Anamnesis
//  · Plan de Practicar en Casa generado por IA (engagement_planes)
//  · Fichas clínicas (actas de sesión, visitas, etc.)
//  · Predicciones y patrones detectados
//  · Alertas activas (logros + atención)
//  · Checkins de bienestar del padre
//  · Mensajes del terapeuta a la familia
async function cargarContextoPadre(childId: string) {
  // 1. IDs de programas — base para varias queries dependientes
  const { data: programaIdsRaw } = await supabaseAdmin
    .from('programas_aba')
    .select('id')
    .eq('child_id', childId)
  const programaIds = (programaIdsRaw || []).map((p: any) => p.id)
  const hoy = new Date().toISOString().split('T')[0]
  const semanaNum = (() => {
    const d = new Date()
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  })()
  const anioActual = new Date().getFullYear()

  // 2. Cargar TODO en paralelo. Capturamos `error` de programas para diagnóstico
  //    porque su fallo silencioso causaba que ARIA dijera "no hay programas activos".
  const [
    { data: child },
    { data: sesionesLegacy },
    { data: sesionesAba },
    { data: tareasPendientes },
    { data: programas, error: errProgramas },
    { data: proximaCitaAgenda },
    { data: proximaCitaAppt },
    { data: citasPasadas },
    { data: anamnesis },
    { data: formResponses },
    { data: engagementPlan },
    { data: fichasClinicas },
    { data: prediccion },
    { data: patrones },
    { data: alertas },
    { data: wellbeingCheckins },
    { data: practicaCasa },
  ] = await Promise.all([
    supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis')
      .eq('id', childId)
      .maybeSingle(),

    // Sesiones legacy (registro_aba) — incluye notas del terapeuta y mensajes a la familia
    supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos, ai_analysis')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(5),

    // Sesiones reales (sesiones_datos_aba) — las últimas 12 con todo el detalle
    programaIds.length > 0
      ? supabaseAdmin
          .from('sesiones_datos_aba')
          .select('programa_id, fecha, fase, set, porcentaje_exito, oportunidades_totales, respuestas_correctas, nivel_ayuda, notas')
          .in('programa_id', programaIds)
          .order('fecha', { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] as any[] }),

    // Tareas del hogar (activas y completadas para que ARIA sepa lo que ya hicieron)
    supabaseAdmin
      .from('tareas_hogar')
      .select('titulo, completada, fecha_asignada, instrucciones, fecha_limite')
      .eq('child_id', childId)
      .eq('activa', true)
      .order('fecha_asignada', { ascending: false })
      .limit(10),

    // Programas ABA — usar la MISMA query que /api/programas-aba (que sí funciona).
    // FIX 1: NO filtrar por estado (PostgREST trata NULL != 'x' como NULL/falsy).
    // FIX 2: Usar select('*') con objetivos_cp(*) — el select restrictivo o el join
    //         tipado anterior fallaban silenciosamente dentro de Promise.all.
    // FIX 3: Sin limit para no perder programas si hay más de 15.
    supabaseAdmin
      .from('programas_aba')
      .select(`*, objetivos_cp(*)`)
      .eq('child_id', childId)
      .order('created_at', { ascending: false }),

    // Próxima cita (agenda_sesiones)
    supabaseAdmin
      .from('agenda_sesiones')
      .select('fecha, hora_inicio, tipo')
      .eq('child_id', childId)
      .gte('fecha', hoy)
      .in('estado', ['programada', 'confirmada'])
      .order('fecha', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // Próxima cita (appointments)
    supabaseAdmin
      .from('appointments')
      .select('appointment_date, appointment_time, service_type')
      .eq('child_id', childId)
      .gte('appointment_date', hoy)
      .not('status', 'in', '(cancelled,completed,realizada,completada,done)')
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // Historial de citas pasadas — para que ARIA pueda decir "el martes pasado vino..."
    supabaseAdmin
      .from('appointments')
      .select('appointment_date, appointment_time, service_type, status')
      .eq('child_id', childId)
      .lt('appointment_date', hoy)
      .in('status', ['completed', 'completada', 'realizada'])
      .order('appointment_date', { ascending: false })
      .limit(8),

    // Anamnesis (historia clínica inicial)
    supabaseAdmin
      .from('anamnesis_completa')
      .select('fecha_creacion, datos')
      .eq('child_id', childId)
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Formularios respondidos (con análisis IA)
    supabaseAdmin
      .from('form_responses')
      .select('form_type, form_title, created_at, ai_analysis')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(8),

    // Plan de Practicar en Casa generado por IA
    supabaseAdmin
      .from('engagement_planes')
      .select('semana, anio, actividades, mensaje_motivacional, completadas_pct, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Fichas clínicas (actas de sesión, visitas, historia clínica)
    supabaseAdmin
      .from('clinical_template_responses')
      .select('id, created_at, filler_name, filler_role, responses, notes, clinical_templates(name, category)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(8),

    // Predicción IA del progreso
    supabaseAdmin
      .from('predicciones_ia')
      .select('analisis_ia, prediccion_30d, sesiones_analizadas, fecha_analisis')
      .eq('child_id', childId)
      .maybeSingle(),

    // Patrones detectados
    supabaseAdmin
      .from('patrones_detectados')
      .select('patrones, analisis_ia, sesiones_analizadas, fecha_analisis')
      .eq('child_id', childId)
      .maybeSingle(),

    // Alertas activas (logros + atención)
    supabaseAdmin
      .from('agente_alertas')
      .select('tipo, titulo, descripcion, mensaje, prioridad, created_at')
      .eq('child_id', childId)
      .eq('resuelta', false)
      .order('created_at', { ascending: false })
      .limit(10),

    // Checkins de bienestar del padre
    supabaseAdmin
      .from('parent_wellbeing_checkins')
      .select('mood, nota, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(3),

    // Práctica en casa registrada por el padre (tabla puede no existir aún → fallback vacío)
    (async () => {
      try {
        const res = await supabaseAdmin
          .from('practica_casa_registros')
          .select('fecha, set_practicado, observaciones')
          .eq('child_id', childId)
          .order('fecha', { ascending: false })
          .limit(7)
        return res
      } catch {
        return { data: [] as any[] }
      }
    })(),
  ])

  // 2b. Documentos del paciente VISIBLES PARA EL PADRE (texto ya extraído)
  //     Solo trae los que el equipo clínico marcó como compartibles con la familia.
  const { data: documentosVisibles } = await supabaseAdmin
    .from('patient_documents')
    .select('file_name, category, description, extracted_text, created_at')
    .eq('child_id', childId)
    .eq('visible_to_parent', true)
    .eq('extraction_status', 'done')
    .not('extracted_text', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8)

  // 3. Cargar evaluaciones profesionales en paralelo (no fallar si alguna tabla no existe)
  const evalTablas = [
    { table: 'evaluacion_brief2',    label: 'BRIEF-2 (Funciones Ejecutivas)' },
    { table: 'evaluacion_ados2',     label: 'ADOS-2 (TEA)' },
    { table: 'evaluacion_vineland3', label: 'Vineland-3 (Conducta Adaptativa)' },
    { table: 'evaluacion_wiscv',     label: 'WISC-V (Cognitivo)' },
    { table: 'evaluacion_basc3',     label: 'BASC-3 (Conducta)' },
  ]
  const evaluacionesPro: { label: string; fecha: string; resumen: string }[] = []
  await Promise.all(evalTablas.map(async ({ table, label }) => {
    try {
      const { data } = await supabaseAdmin
        .from(table)
        .select('created_at, ai_analysis')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data && (data as any).ai_analysis) {
        evaluacionesPro.push({
          label,
          fecha: ((data as any).created_at || '').slice(0, 10),
          resumen: String((data as any).ai_analysis).slice(0, 400),
        })
      }
    } catch { /* tabla puede no existir */ }
  }))

  // Filtrar archivados en JS (después del fetch para incluir programas con estado null)
  // Si la query de programas falló, lo dejamos visible en logs para diagnóstico
  if (errProgramas) {
    console.error('[parent-chat] Error cargando programas_aba:', errProgramas.message, errProgramas)
  }
  const programasActivos = (programas || []).filter((p: any) => p.estado !== 'archivado')
  console.log('[parent-chat] Programas para child', childId, '→', {
    raw_length: (programas || []).length,
    activos_length: programasActivos.length,
    error: errProgramas?.message || null,
    titulos: (programas || []).map((p: any) => ({ id: p.id, titulo: p.titulo, estado: p.estado })),
  })

  // ── Mapa programa_id → título ──
  // Si el programa fue archivado o no se encuentra, intentamos sacar el título
  // desde sesiones_datos_aba (no tiene ese campo) — fallback "programa".
  // También hacemos lookup por todos los programas (no solo activos) para que
  // sesiones de programas viejos sigan teniendo título correcto.
  const progIdToTitulo: Record<string, string> = {}
  for (const p of (programas || []) as any[]) {
    if (p.id && p.titulo) progIdToTitulo[p.id] = p.titulo
  }

  // ── Resumen de sesiones reales (sesiones_datos_aba) ──
  const resumenSesionesAba = (sesionesAba || []).map((s: any, i: number) => {
    const pct = s.porcentaje_exito ?? (s.oportunidades_totales > 0
      ? Math.round((Number(s.respuestas_correctas) / Number(s.oportunidades_totales)) * 100)
      : null)
    const logro = pct == null ? 'sin medición'
      : pct >= 80 ? 'excelente'
      : pct >= 60 ? 'muy bien'
      : pct >= 40 ? 'en progreso'
      : 'necesita apoyo'
    const partes = [
      `Sesión ${i + 1} (${s.fecha}) — Programa "${progIdToTitulo[s.programa_id] || 'programa'}"${s.set ? ` · ${s.set}` : ''}: ${logro}${pct != null ? ` (${pct}%)` : ''}`,
      s.fase ? `Fase: ${s.fase === 'linea_base' ? 'línea base' : s.fase}` : '',
      s.notas ? `Notas de la terapeuta: ${s.notas}` : '',
    ].filter(Boolean)
    return partes.join(' | ')
  }).join('\n')

  // ── Resumen de sesiones legacy (registro_aba) ──
  const resumenSesionesLegacy = (sesionesLegacy || []).map((s: any, i: number) => {
    const d = s.datos || {}
    const nivelLogro = String(d.nivel_logro_objetivos || '')
    const logro = (nivelLogro.includes('76') || nivelLogro.includes('Completamente') || Number(nivelLogro) >= 76) ? 'excelente'
      : (nivelLogro.includes('51') || nivelLogro.includes('Mayormente') || Number(nivelLogro) >= 51) ? 'muy bien'
      : (nivelLogro.includes('26') || nivelLogro.includes('Parcialmente') || Number(nivelLogro) >= 26) ? 'en progreso'
      : 'necesita apoyo'

    const partes = [
      `Sesión ${i + 1} (${s.fecha_sesion}): Trabajó en "${d.objetivo_principal || 'objetivos del día'}". Resultado: ${logro}.`,
      d.avances_observados ? `Avances: ${d.avances_observados}` : '',
      d.habilidades_objetivo ? `Habilidades trabajadas: ${Array.isArray(d.habilidades_objetivo) ? d.habilidades_objetivo.join(', ') : d.habilidades_objetivo}` : '',
      d.reforzadores_efectivos ? `Lo que más lo motivó en sesión: ${d.reforzadores_efectivos}` : '',
      d.tarea_casa ? `TAREA PARA CASA (indicada por la terapeuta): ${d.tarea_casa}` : '',
      d.mensaje_familia ? `MENSAJE DE LA TERAPEUTA A LA FAMILIA: ${d.mensaje_familia}` : '',
    ].filter(Boolean)

    return partes.join(' | ')
  }).join('\n')

  const resumenSesiones = [resumenSesionesAba, resumenSesionesLegacy]
    .filter(Boolean)
    .join('\n')
    || 'Sin sesiones recientes registradas'

  // ── Programas ABA con instrucciones completas (combinando programa + set activo) ──
  // Usamos programasActivos (que excluye archivados pero incluye los con estado null)
  const programasTexto = programasActivos.length > 0
    ? (programasActivos as any[]).map((p: any) => {
        // Set activo: el primero no dominado del programa
        const sets = (p.objetivos_cp || [])
          .sort((a: any, b: any) => (a.numero_set || 0) - (b.numero_set || 0))
        const setActivo = sets.find((o: any) => o.estado === 'en_progreso')
          || sets.find((o: any) => o.estado !== 'dominado')
          || sets[0] || null

        // Prioridad: campo del set activo → campo del programa
        const sd          = setActivo?.sd_estimulo      || p.sd_estimulo
        const materiales  = setActivo?.materiales       || p.materiales
        // En el admin la "Ayudas" se guarda en el campo `reforzadores` del set
        const ayudas      = setActivo?.reforzadores     || p.ayudas
        const correccion  = setActivo?.correction_errores
        const generaliz   = setActivo?.generalizacion
        const reforzProg  = p.reforzadores
        const instrCasa   = p.instrucciones_casa

        const pasos = sets
          .filter((o: any) => o.estado !== 'dominado')
          .slice(0, 5)
          .map((o: any) => `  · Set ${o.numero_set ?? '?'}${o.estado === 'en_progreso' ? ' [EN CURSO]' : ''}: ${o.descripcion || '(sin descripción)'}`)
          .join('\n')

        return [
          `\n📌 PROGRAMA: "${p.titulo}" | Área: ${p.area || 'general'} | Fase: ${p.fase_actual || 'inicial'} | Criterio: ${p.criterio_dominio_pct || 90}%`,
          sd          ? `  🗣️ Cómo dar la instrucción (Sd): ${sd}`                : '',
          ayudas      ? `  ✋ Ayudas / Prompts: ${ayudas}`                          : '',
          reforzProg  ? `  ⭐ Reforzadores del programa: ${reforzProg}`             : '',
          materiales  ? `  🧩 Materiales necesarios: ${materiales}`                : '',
          correccion  ? `  🔄 Si se equivoca, cómo corregir: ${correccion}`        : '',
          generaliz   ? `  🏠 Generalización en casa: ${generaliz}`                : '',
          instrCasa   ? `  📋 Instrucciones extra: ${instrCasa}`                   : '',
          pasos       ? `  📊 Sets actuales:\n${pasos}`                            : '',
        ].filter(Boolean).join('\n')
      }).join('\n')
    : 'Sin programas ABA activos actualmente'

  // ── Tareas del hogar ──
  const tareasTexto = (tareasPendientes || []).map((t: any) => {
    const instr = t.instrucciones || ''
    return `- "${t.titulo}" (${t.completada ? 'COMPLETADA ✅' : 'PENDIENTE ⏳'})\n  Instrucciones: ${instr || 'Ver con la terapeuta'}`
  }).join('\n') || 'Sin tareas asignadas actualmente'

  // ── Próxima cita (combinar agenda_sesiones + appointments) ──
  let proximaCitaTexto = 'Sin próxima cita programada'
  if (proximaCitaAppt) {
    const a: any = proximaCitaAppt
    proximaCitaTexto = `Próxima cita: ${a.appointment_date} a las ${a.appointment_time?.slice(0, 5)}${a.service_type ? ` (${a.service_type})` : ''}`
  } else if (proximaCitaAgenda) {
    const a: any = proximaCitaAgenda
    proximaCitaTexto = `Próxima cita: ${a.fecha} a las ${a.hora_inicio?.slice(0, 5)}${a.tipo ? ` (${a.tipo})` : ''}`
  }

  // ── Historial de citas pasadas ──
  const citasPasadasTexto = (citasPasadas || []).length > 0
    ? (citasPasadas as any[]).map(c =>
        `  · ${c.appointment_date} ${c.appointment_time?.slice(0, 5) || ''} — ${c.service_type || 'Sesión'}`
      ).join('\n')
    : 'Sin historial de citas previas'

  // ── Anamnesis ──
  const anamnesisTexto = anamnesis && (anamnesis as any).datos
    ? `Anamnesis (${(anamnesis as any).fecha_creacion?.slice(0, 10)}): ${JSON.stringify((anamnesis as any).datos).slice(0, 800)}`
    : 'Sin anamnesis registrada'

  // ── Formularios respondidos ──
  const formsTexto = (formResponses || []).length > 0
    ? (formResponses as any[])
        .filter(f => f.ai_analysis)
        .slice(0, 5)
        .map(f => `  · ${f.form_title} (${f.created_at?.slice(0, 10)}): ${String(f.ai_analysis).slice(0, 220)}`)
        .join('\n')
    : 'Sin formularios respondidos'

  // ── Evaluaciones profesionales ──
  const evaluacionesProTexto = evaluacionesPro.length > 0
    ? evaluacionesPro.map(e => `  · ${e.label} (${e.fecha}): ${e.resumen}`).join('\n')
    : 'Sin evaluaciones profesionales registradas'

  // ── Plan de Practicar en Casa generado por IA ──
  const engagementTexto = engagementPlan
    ? (() => {
        const p: any = engagementPlan
        const acts = Array.isArray(p.actividades) ? p.actividades.slice(0, 5) : []
        const actTxt = acts.map((a: any, i: number) =>
          `  ${i + 1}. ${a.titulo || 'Actividad'} (${a.duracion_minutos || 15}min, ${a.dificultad || 'media'})${a.completada ? ' ✅' : ''}: ${a.descripcion || ''}`
        ).join('\n')
        return `Plan semanal de actividades (semana ${p.semana}/${p.anio}, ${p.completadas_pct || 0}% completado):
${p.mensaje_motivacional ? `Mensaje: ${p.mensaje_motivacional}` : ''}
Actividades:
${actTxt}`
      })()
    : 'Sin plan de Practicar en Casa generado todavía'

  // ── Fichas clínicas (Actas de Sesión, visitas, etc.) ──
  const fichasTexto = (fichasClinicas || []).length > 0
    ? (fichasClinicas as any[]).slice(0, 5).map(f => {
        const fName = f.clinical_templates?.name || 'Ficha clínica'
        const fecha = (f.created_at || '').slice(0, 10)
        const responsable = f.filler_name ? `${f.filler_name}${f.filler_role ? ` (${f.filler_role})` : ''}` : 'profesional'
        // Concatenar respuestas claves
        const resumen = Object.values(f.responses || {})
          .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
          .slice(0, 3)
          .map((v: any) => String(v).slice(0, 200))
          .join(' | ')
        return `  · ${fecha} — ${fName} por ${responsable}: ${resumen || '(sin contenido textual)'}${f.notes ? ` | Notas: ${String(f.notes).slice(0, 150)}` : ''}`
      }).join('\n')
    : 'Sin fichas clínicas registradas'

  // ── Documentos compartidos con la familia ──
  //   Solo los que el equipo marcó visible_to_parent=true y cuyo texto fue extraído.
  //   Tope global: 8000 chars repartidos entre los docs (para no inflar tokens).
  const documentosTexto = (() => {
    const docs = (documentosVisibles || []) as any[]
    if (docs.length === 0) return 'Sin documentos compartidos por el equipo'
    const MAX_TOTAL = 8000
    const MAX_POR_DOC = Math.min(2000, Math.floor(MAX_TOTAL / docs.length))
    const bloques: string[] = []
    let total = 0
    for (const d of docs) {
      if (total >= MAX_TOTAL) break
      const texto = String(d.extracted_text || '').trim()
      if (!texto) continue
      const limite = Math.min(MAX_POR_DOC, MAX_TOTAL - total)
      const frag = texto.length > limite ? texto.slice(0, limite) + ' […]' : texto
      const fecha = d.created_at ? new Date(d.created_at).toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' }) : ''
      const cat = d.category ? ` · ${d.category}` : ''
      const desc = d.description ? ` — ${d.description}` : ''
      bloques.push(`📄 ${d.file_name} (${fecha}${cat})${desc}\n${frag}`)
      total += frag.length
    }
    return bloques.length > 0 ? bloques.join('\n\n---\n\n') : 'Sin documentos compartidos por el equipo'
  })()

  // ── Predicción IA ──
  const prediccionTexto = prediccion && (prediccion as any).analisis_ia
    ? `Análisis IA del progreso (${(prediccion as any).sesiones_analizadas || 0} sesiones analizadas):
${String((prediccion as any).analisis_ia).slice(0, 600)}
${(prediccion as any).prediccion_30d ? `\nPredicción a 30 días: ${String((prediccion as any).prediccion_30d).slice(0, 400)}` : ''}`
    : 'Sin análisis predictivo disponible'

  // ── Patrones detectados ──
  const patronesTexto = patrones && (patrones as any).analisis_ia
    ? `Patrones detectados: ${String((patrones as any).analisis_ia).slice(0, 500)}`
    : 'Sin patrones detectados aún'

  // ── Alertas activas ──
  const alertasTexto = (alertas || []).length > 0
    ? (alertas as any[]).slice(0, 6).map(a => {
        const tipoStr = String(a.tipo || '')
        const esLogro = tipoStr.startsWith('logro_') || tipoStr === 'criterio_alcanzado'
        const icon = esLogro ? '🎉' : (a.prioridad === 'alta' || a.prioridad === 1) ? '⚠️' : 'ℹ️'
        return `  ${icon} ${a.titulo || a.tipo}: ${(a.descripcion || a.mensaje || '').slice(0, 200)}`
      }).join('\n')
    : 'Sin alertas activas en este momento'

  // ── Bienestar del padre ──
  const wellbeingTexto = (wellbeingCheckins || []).length > 0
    ? (wellbeingCheckins as any[]).map(w => {
        const moodLabel = w.mood === 'bien' ? '😊 Bien' : w.mood === 'regular' ? '😐 Regular' : '😔 Difícil'
        return `  · ${(w.created_at || '').slice(0, 10)}: ${moodLabel}${w.nota ? ` — "${String(w.nota).slice(0, 200)}"` : ''}`
      }).join('\n')
    : 'Sin chequeos de bienestar registrados'

  // ── Práctica en casa registrada por el padre ──
  const practicaCasaTexto = (practicaCasa || []).length > 0
    ? (practicaCasa as any[]).map(p =>
        `  · ${p.fecha}${p.set_practicado ? ` (Set ${p.set_practicado})` : ''}${p.observaciones ? `: ${String(p.observaciones).slice(0, 200)}` : ''}`
      ).join('\n')
    : 'Sin registros de práctica en casa todavía'

  const edadTexto = calcularEdad((child as any)?.birth_date, (child as any)?.age)

  return {
    nombre: (child as any)?.name || 'tu hijo/a',
    edad: edadTexto,
    diagnostico: (child as any)?.diagnosis || 'En evaluación',
    resumenSesiones,
    proximaCita: proximaCitaTexto,
    citasPasadas: citasPasadasTexto,
    anamnesis: anamnesisTexto,
    formsRespondidos: formsTexto,
    evaluacionesProfesionales: evaluacionesProTexto,
    engagement: engagementTexto,
    fichasClinicas: fichasTexto,
    documentos: documentosTexto,
    prediccion: prediccionTexto,
    patrones: patronesTexto,
    alertas: alertasTexto,
    bienestarPadre: wellbeingTexto,
    practicaCasa: practicaCasaTexto,
    tareas: tareasTexto,
    programas: programasTexto,
    tieneTareasActivas: ((tareasPendientes || []).filter((t: any) => !t.completada).length || 0) > 0,
    _debug: {
      sesiones_legacy: (sesionesLegacy || []).length,
      sesiones_aba: (sesionesAba || []).length,
      programas_encontrados: (programas || []).length,
      tareas: (tareasPendientes || []).length,
      evaluaciones_pro: evaluacionesPro.length,
      programas_activos: programasActivos.length,
      programas_archivados: (programas || []).length - programasActivos.length,
      forms: (formResponses || []).length,
      citas_pasadas: (citasPasadas || []).length,
      fichas: (fichasClinicas || []).length,
      alertas: (alertas || []).length,
      tiene_anamnesis: !!anamnesis,
      tiene_engagement: !!engagementPlan,
      tiene_prediccion: !!prediccion,
      tiene_patrones: !!patrones,
      wellbeing_checkins: (wellbeingCheckins || []).length,
      practica_casa: (practicaCasa || []).length,
    },
  }
}

// ─── GENERAR RESPUESTA PARA PADRE ────────────────────────────
async function generarRespuestaPadre(
  mensaje: string,
  contexto: any,
  historial: any[],
  nombrePadre: string,
  locale = 'es'
): Promise<string> {
  // 🧠 Buscar en Cerebro IA (libros clínicos) contexto relevante para la pregunta
  const knowledgeCtx = await buildParentChatContext(mensaje, '')

  const userLocale = locale
  const localeNamesPC: Record<string,string> = { es:'español', en:'English', pt:'português', fr:'français', de:'Deutsch', it:'italiano' }
  const langNote = userLocale !== 'es' ? `\n\n[RESPONDE SIEMPRE EN: ${localeNamesPC[userLocale] || 'español'}. No uses español si el idioma es diferente.]` : ''
  const systemPrompt = `Eres ARIA, el asistente virtual del Centro Vanty ABA para familias.
Eres cálida, paciente, positiva y muy accesible. Conoces en detalle el caso de ${contexto.nombre}.
Tenés acceso a TODOS los datos del expediente del niño — usalos siempre que correspondan.

━━━ INFORMACIÓN DEL PACIENTE ━━━
Nombre: ${contexto.nombre} | Edad: ${contexto.edad} | Diagnóstico: ${contexto.diagnostico}
${contexto.proximaCita}

━━━ ANAMNESIS / HISTORIA CLÍNICA INICIAL ━━━
${contexto.anamnesis}

━━━ PROGRAMAS ABA ACTIVOS (con instrucciones completas para casa) ━━━
${contexto.programas}

━━━ ÚLTIMAS SESIONES ABA ━━━
${contexto.resumenSesiones}

━━━ TAREAS PARA EL HOGAR ━━━
${contexto.tareas}

━━━ PLAN SEMANAL DE PRACTICAR EN CASA (generado por IA) ━━━
${contexto.engagement}

━━━ REGISTROS DE PRÁCTICA EN CASA (lo que el padre ya hizo) ━━━
${contexto.practicaCasa}

━━━ EVALUACIONES PROFESIONALES ━━━
${contexto.evaluacionesProfesionales}

━━━ FORMULARIOS RESPONDIDOS (con análisis) ━━━
${contexto.formsRespondidos}

━━━ FICHAS CLÍNICAS (actas de sesión, visitas, etc.) ━━━
${contexto.fichasClinicas}

━━━ DOCUMENTOS COMPARTIDOS CON LA FAMILIA ━━━
(Estos son archivos que el equipo subió al expediente y marcó como visibles para los padres — informes, certificados, etc. El texto fue extraído automáticamente.)
${contexto.documentos}

━━━ HISTORIAL DE CITAS PASADAS ━━━
${contexto.citasPasadas}

━━━ ANÁLISIS PREDICTIVO DEL PROGRESO ━━━
${contexto.prediccion}

━━━ PATRONES DETECTADOS POR IA ━━━
${contexto.patrones}

━━━ ALERTAS ACTIVAS (logros, atenciones) ━━━
${contexto.alertas}

━━━ BIENESTAR DEL PADRE (chequeos mensuales) ━━━
${contexto.bienestarPadre}

━━━ REGLAS DE COMPORTAMIENTO ━━━
1. LENGUAJE: Usa lenguaje SIMPLE, CÁLIDO y sin términos técnicos. Convierte conceptos clínicos a palabras de todos los días.
   - "SD" → "la instrucción que le das"
   - "reforzador" → "lo que más lo motiva o le gusta"
   - "ensayo discreto" → "practicar paso a paso"
   - "criterio de dominio" → "cuando ya lo hace bien solo"
   - "línea base" → "punto de partida antes de empezar a trabajar el objetivo"

2. **USA SIEMPRE los datos del contexto**. NUNCA digas "no tengo esa información" si está disponible arriba. Si ves un dato relevante, citalo.

2b. **SI LA PREGUNTA NO ES DEL PACIENTE — USÁ TU CONOCIMIENTO GENERAL**. Tenés formación clínica amplia integrada (sobre TEA, TDAH, ABA, desarrollo infantil, regulación emocional, crianza, conducta, etc.). Cuando un padre pregunte cosas conceptuales tipo:
   - "¿Qué es el TEA?"
   - "¿Por qué le cuesta dormir a mi hijo/a con autismo?"
   - "¿Qué hago si tiene una rabieta en público?"
   - "¿Es normal que repita palabras?"

   Respondé directamente con información útil y precisa en lenguaje sencillo y cálido. NO digas "consultá con el equipo" para esquivar — primero respondé con info concreta, y AL FINAL podés sugerir hablar con la terapeuta para profundizar. Tu rol es informar y acompañar, no solo derivar.

3. CÓMO RESPONDER SEGÚN EL TIPO DE PREGUNTA:
   - "¿Cómo puedo practicar X en casa?" → Da pasos CONCRETOS usando sd_estimulo, materiales, reforzadores del programa específico.
   - "¿Qué tarea dejó la terapeuta?" → Usa las tareas del hogar y los mensajes de las sesiones.
   - "¿Cómo le fue?" → Usa el resumen de sesiones con datos reales, mencionando porcentajes y avances.
   - "¿Cómo va el progreso?" o "¿Está mejorando?" → Usa el ANÁLISIS PREDICTIVO, PATRONES DETECTADOS y % de sesiones recientes.
   - "¿Qué evaluaciones le hicieron?" → Resumí las EVALUACIONES PROFESIONALES (BRIEF-2, ADOS-2, etc.) en lenguaje simple.
   - "¿En qué está trabajando?" → Lista los programas activos con sus objetivos.
   - "¿Hay logros?" → Buscá en ALERTAS las que empiezan con 🎉 (logros).
   - "¿Qué hicieron la sesión pasada?" → Usá HISTORIAL DE CITAS + ÚLTIMAS SESIONES + FICHAS CLÍNICAS.
   - "¿Qué dice el informe/documento de…?" o cualquier mención a un archivo → Usá DOCUMENTOS COMPARTIDOS. **CRUCIAL: traducí el contenido técnico a lenguaje de mamá/papá**:
       · Diagnósticos → frasealos con calma y esperanza ("se identificaron rasgos de…" en lugar de "presenta criterios diagnósticos de…")
       · Términos clínicos → palabras cotidianas (ej: "indicadores de neurodiversidad" → "señales de que su mente trabaja diferente")
       · Recomendaciones → conviértelas en pasos concretos para casa
       · NUNCA pegues párrafos textuales del documento clínico — siempre RESUMÍ y EXPLICÁ con tus palabras
       · Si el doc tiene cifras o puntuaciones técnicas (T-scores, percentiles), explicá qué significan ("está dentro del rango promedio" / "por encima de lo esperado")
       · Sé honesta pero esperanzadora — cada hallazgo es información valiosa para ayudar mejor a su hijo/a.
   - Si el padre menciona algo difícil sobre él/ella → reconocé sus chequeos de bienestar pasados, sé empático/a.

4. ESTRUCTURA para preguntas de práctica en casa:
   ✅ Qué necesitas (materiales)
   ✅ Cómo empezar (instrucción exacta)
   ✅ Qué hacer si lo hace bien (reforzador)
   ✅ Qué hacer si se equivoca (corrección)
   ✅ Cuánto practicar (tiempo/frecuencia sugerida)

5. POSITIVO pero HONESTO. Celebra avances (mencioná las alertas tipo logro), reconocé los retos.
6. Trata a la familia por su nombre: ${nombrePadre}.
7. Si hay tareas del hogar pendientes, explica CON DETALLE cómo hacerlas usando los campos del programa correspondiente.
8. Cuando una pregunta requiera cambiar el programa o tomar decisiones clínicas, indicá amablemente que eso lo decide la terapeuta.
9. NUNCA inventes datos. Si un campo está vacío en el contexto, decí "todavía no tengo registro de eso" en vez de inventar.
10. ARIA complementa al terapeuta, nunca lo reemplaza.
${knowledgeCtx ? `
━━━ CONOCIMIENTO CLÍNICO DE RESPALDO (Cerebro IA) ━━━
${knowledgeCtx}
Usa este conocimiento para enriquecer tus respuestas, siempre en lenguaje simple para padres.
━━━ FIN ━━━` : ''}`

  // Build chat messages for Groq
  const groqMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...historial.map(h => ({
      role: h.rol as 'user' | 'assistant',
      content: h.mensaje,
    })),
    { role: 'user' as const, content: mensaje },
  ]

  try {
    const respuesta = await callGroq(groqMessages, {
      model: GROQ_MODELS.SMART,
      temperature: 0.5,
      maxTokens: 1200,
    })

    if (respuesta && respuesta.trim().length > 10) return respuesta

    // FIX: Fallback a callGroqSimple si callGroq falla o retorna vacío
    const fallback = await callGroqSimple(systemPrompt, mensaje, {
      model: GROQ_MODELS.SMART,
      temperature: 0.5,
      maxTokens: 1200,
    })

    return fallback || generarRespuestaFallback(contexto, mensaje)
  } catch (err: any) {
    console.error('Error Groq en parent-chat:', err.message)
    return generarRespuestaFallback(contexto, mensaje)
  }
}

// FIX: respuesta de fallback con datos reales cuando la IA falla
function generarRespuestaFallback(contexto: any, mensaje: string): string {
  const msgLower = mensaje.toLowerCase()
  if (msgLower.includes('tarea') || msgLower.includes('actividad') || msgLower.includes('casa')) {
    return contexto.tieneTareasActivas
      ? `Hola! ${contexto.nombre} tiene actividades pendientes para realizar en casa. Puedes verlas en la sección "Tareas" de la app. La constancia en casa hace una gran diferencia en su progreso. 💪`
      : `Actualmente ${contexto.nombre} no tiene actividades pendientes asignadas. ¡Sigue así, han hecho un gran trabajo! Tu terapeuta asignará nuevas actividades pronto.`
  }
  if (msgLower.includes('cita') || msgLower.includes('sesion') || msgLower.includes('sesión')) {
    return `${contexto.proximaCita}. Si necesitas cambiar la cita, puedes hacerlo desde la sección Agenda de la app o contactar directamente al centro.`
  }
  return `Gracias por tu mensaje sobre ${contexto.nombre}. En este momento tengo dificultades técnicas para responder. Por favor, intenta nuevamente en unos minutos o contacta directamente al terapeuta del centro.`
}
