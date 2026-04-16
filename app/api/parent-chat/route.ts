// app/api/parent-chat/route.ts
// Chat IA exclusivo para padres - respuestas en lenguaje accesible
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroq, callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildParentChatContext } from '@/lib/ai-context-builder'

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

    // FIX: responder con AMBOS campos para compatibilidad con los dos frontends
    return NextResponse.json({ respuesta, text: respuesta })
  } catch (e: any) {
    console.error('❌ Error en parent-chat:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── CONTEXTO FILTRADO PARA PADRES ───────────────────────────
async function cargarContextoPadre(childId: string) {
  const [
    { data: child },
    { data: sesiones },
    { data: tareasPendientes },
    { data: programas },
    { data: proximaCita },
  ] = await Promise.all([
    supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis')
      .eq('id', childId)
      .single(),

    // Cargar sesiones con TODOS los campos relevantes para padres
    supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(5),

    // Tareas del hogar activas con instrucciones completas
    supabaseAdmin
      .from('tareas_hogar')
      .select('titulo, completada, fecha_asignada, instrucciones, fecha_limite')
      .eq('child_id', childId)
      .eq('activa', true)
      .order('fecha_asignada', { ascending: false })
      .limit(8),

    // Programas ABA con TODOS los campos de práctica
    supabaseAdmin
      .from('programas_aba')
      .select(`
        titulo, area, fase_actual, estado,
        objetivo_lp, sd_estimulo, generalizacion,
        reforzadores, materiales, correccion_error,
        notas_programa,
        objetivos_cp ( descripcion, estado, numero_set )
      `)
      .eq('child_id', childId)
      .eq('estado', 'activo')
      .order('created_at', { ascending: false })
      .limit(6),

    // Próxima cita
    supabaseAdmin
      .from('agenda_sesiones')
      .select('fecha, hora_inicio, tipo')
      .eq('child_id', childId)
      .gte('fecha', new Date().toISOString().split('T')[0])
      .in('estado', ['programada', 'confirmada'])
      .order('fecha', { ascending: true })
      .limit(1)
      .single(),
  ])

  // ── Resumen de sesiones — incluye tarea_casa y mensaje_familia ──────────────
  const resumenSesiones = sesiones?.map((s, i) => {
    const d = s.datos || {}
    const nivelLogro = String(d.nivel_logro_objetivos || '')
    const logro = (nivelLogro.includes('76') || nivelLogro.includes('Completamente') || Number(nivelLogro) >= 76) ? 'excelente'
      : (nivelLogro.includes('51') || nivelLogro.includes('Mayormente') || Number(nivelLogro) >= 51) ? 'muy bien'
      : (nivelLogro.includes('26') || nivelLogro.includes('Parcialmente') || Number(nivelLogro) >= 26) ? 'en progreso'
      : 'necesita apoyo'

    const partes = [
      `Sesión \${i + 1} (\${s.fecha_sesion}): Trabajó en "\${d.objetivo_principal || 'objetivos del día'}". Resultado: \${logro}.`,
      d.avances_observados ? `Avances: \${d.avances_observados}` : '',
      d.habilidades_objetivo ? `Habilidades trabajadas: \${Array.isArray(d.habilidades_objetivo) ? d.habilidades_objetivo.join(', ') : d.habilidades_objetivo}` : '',
      d.reforzadores_efectivos ? `Lo que más lo motivó en sesión: \${d.reforzadores_efectivos}` : '',
      // ← CRÍTICO: tarea que dejó la terapeuta para casa
      d.tarea_casa ? `TAREA PARA CASA (indicada por la terapeuta): \${d.tarea_casa}` : '',
      // ← CRÍTICO: mensaje directo de la terapeuta a la familia
      d.mensaje_familia ? `MENSAJE DE LA TERAPEUTA A LA FAMILIA: \${d.mensaje_familia}` : '',
    ].filter(Boolean)

    return partes.join(' | ')
  }).join('\n') || 'Sin sesiones recientes registradas'

  // ── Programas ABA con instrucciones completas para practicar en casa ─────────
  const programasTexto = programas && programas.length > 0
    ? programas.map((p: any) => {
        const pasos = (p.objetivos_cp || [])
          .sort((a: any, b: any) => (a.numero_set || 0) - (b.numero_set || 0))
          .filter((o: any) => o.estado !== 'dominado')
          .slice(0, 5)
          .map((o: any, i: number) => `  Paso \${i + 1}: \${o.descripcion}`)
          .join('\n')

        return [
          `\n📌 PROGRAMA: "\${p.titulo}" | Área: \${p.area} | Fase: \${p.fase_actual || 'inicial'}`,
          p.objetivo_lp        ? `  🎯 Objetivo: \${p.objetivo_lp}`                             : '',
          p.sd_estimulo        ? `  🗣️ Cómo dar la instrucción: \${p.sd_estimulo}`              : '',
          p.reforzadores       ? `  ⭐ Reforzadores/motivadores: \${p.reforzadores}`            : '',
          p.materiales         ? `  🧩 Materiales necesarios: \${p.materiales}`                 : '',
          p.correccion_error   ? `  🔄 Cómo corregir errores: \${p.correccion_error}`           : '',
          p.generalizacion     ? `  🏠 Para practicar en casa: \${p.generalizacion}`            : '',
          p.notas_programa     ? `  📝 Notas del programa: \${p.notas_programa}`               : '',
          pasos                ? `  📋 Pasos actuales a trabajar:\n\${pasos}`                  : '',
        ].filter(Boolean).join('\n')
      }).join('\n')
    : 'Sin programas ABA activos actualmente'

  // ── Tareas del hogar ──────────────────────────────────────────────────────────
  const tareasTexto = tareasPendientes?.map(t => {
    const instrCompletas = t.instrucciones || ''
    return `- "\${t.titulo}" (\${t.completada ? 'COMPLETADA ✅' : 'PENDIENTE ⏳'})\n  Instrucciones: \${instrCompletas || 'Ver con la terapeuta'}`
  }).join('\n') || 'Sin tareas asignadas actualmente'

  const proximaCitaTexto = proximaCita
    ? `Próxima cita: \${(proximaCita as any).fecha} a las \${(proximaCita as any).hora_inicio?.slice(0, 5)}`
    : 'Sin próxima cita programada'

  const edadTexto = calcularEdad((child as any)?.birth_date, (child as any)?.age)

  return {
    nombre: (child as any)?.name || 'tu hijo/a',
    edad: edadTexto,
    diagnostico: (child as any)?.diagnosis || 'En evaluación',
    resumenSesiones,
    proximaCita: proximaCitaTexto,
    tareas: tareasTexto,
    programas: programasTexto,
    tieneTareasActivas: (tareasPendientes?.filter((t: any) => !t.completada).length || 0) > 0
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
  const systemPrompt = `Eres ARIA, el asistente virtual del Centro Neuropsicología y Terapias SANTI para familias.
Eres cálida, paciente, positiva y muy accesible. Conoces en detalle el caso de ${contexto.nombre}.

━━━ INFORMACIÓN DEL PACIENTE ━━━
Nombre: ${contexto.nombre} | Edad: ${contexto.edad} | Diagnóstico: ${contexto.diagnostico}
${contexto.proximaCita}

━━━ PROGRAMAS ABA ACTIVOS (con instrucciones completas) ━━━
${contexto.programas}

━━━ ÚLTIMAS SESIONES (incluye tareas y mensajes de la terapeuta) ━━━
${contexto.resumenSesiones}

━━━ TAREAS PARA EL HOGAR ━━━
${contexto.tareas}

━━━ REGLAS DE COMPORTAMIENTO ━━━
1. LENGUAJE: Usa lenguaje SIMPLE, CÁLIDO y sin términos técnicos. Convierte conceptos clínicos a palabras de todos los días.
   - "SD" → "la instrucción que le das"
   - "reforzador" → "lo que más lo motiva o le gusta"
   - "ensayo discreto" → "practicar paso a paso"
   - "criterio de dominio" → "cuando ya lo hace bien solo"

2. USA SIEMPRE los datos del contexto. NUNCA digas "no tengo esa información" si está disponible arriba.

3. CÓMO RESPONDER SEGÚN EL TIPO DE PREGUNTA:
   - "¿Cómo puedo practicar X en casa?" → Da pasos CONCRETOS usando sd_estimulo, materiales, reforzadores y pasos del programa. Sé específico.
   - "¿Qué tarea dejó la terapeuta?" → Usa tarea_casa y mensaje_familia de las sesiones.
   - "¿Cómo le fue?" → Usa el resumen de sesiones con datos reales.
   - "¿En qué está trabajando?" → Explica los programas activos en lenguaje simple.
   - Preguntas generales → 2-4 oraciones concisas.
   - Preguntas de PRÁCTICA o CÓMO HACER algo → Responde con pasos claros y ejemplos (puedes usar más espacio).

4. ESTRUCTURA para preguntas de práctica en casa:
   ✅ Qué necesitas (materiales)
   ✅ Cómo empezar (instrucción exacta)
   ✅ Qué hacer si lo hace bien (reforzador)
   ✅ Qué hacer si se equivoca (corrección)
   ✅ Cuánto practicar (tiempo/frecuencia sugerida)

5. POSITIVO pero HONESTO. Celebra los avances, reconoce los retos.
6. Trata a la familia por su nombre: ${nombrePadre}.
7. Si hay tareas del hogar pendientes, explica CON DETALLE cómo hacerlas.
8. Cuando una pregunta requiera cambiar el programa o tomar decisiones clínicas, indica amablemente que eso lo decide la terapeuta.
9. ARIA complementa al terapeuta, nunca lo reemplaza.
${knowledgeCtx ? `
━━━ CONOCIMIENTO CLÍNICO DE RESPALDO (Cerebro IA) ━━━
${knowledgeCtx}
Usa este conocimiento para enriquecer tus respuestas sobre cómo practicar, siempre en lenguaje simple para padres.
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
