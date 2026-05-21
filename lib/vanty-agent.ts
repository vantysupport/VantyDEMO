// lib/vanty-agent.ts
// El Agente IA de Vanty — cerebro clínico con memoria, herramientas y análisis proactivo
// FIX: mayor límite de contexto para childCtx (4000 → 8000) y triggers de herramientas mejorados

import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildKnowledgeContext, searchKnowledge } from '@/lib/knowledge-base'
import { getChildHistory } from '@/lib/child-history'
import { callGroq, callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'



// ── Herramientas del agente ──────────────────────────────────────────────────

const AGENT_TOOLS = {
  // Buscar en base de conocimiento
  async buscarConocimiento(query: string) {
    const results = await searchKnowledge(query, { maxResults: 4, threshold: 0.6 })
    return results.length > 0
      ? results.map(r => `[${r.fuente}]: ${r.contenido}`).join('\n\n')
      : 'No se encontró información específica sobre este tema en la base de conocimiento.'
  },

  // Obtener datos de un programa ABA
  async obtenerDatosPrograma(programaId: string) {
    const { data: programa } = await supabaseAdmin
      .from('programas_aba')
      .select('id, titulo, area, fase_actual, estado, criterio_dominio_pct, criterio_sesiones_consecutivas, objetivo_lp')
      .eq('id', programaId)
      .single()

    if (!programa) return 'Programa no encontrado.'

    // FIX: query separada y ordenada para sesiones
    const { data: sesiones } = await supabaseAdmin
      .from('sesiones_datos_aba')
      .select('fecha, porcentaje_exito, frecuencia_valor, fase, notas, nivel_ayuda')
      .eq('programa_id', programaId)
      .order('fecha', { ascending: true })

    const sesionesList = sesiones || []
    const tendencia = calcularTendenciaLocal(sesionesList)

    return JSON.stringify({
      titulo: (programa as any).titulo,
      area: (programa as any).area,
      fase_actual: (programa as any).fase_actual,
      estado: (programa as any).estado,
      criterio_dominio: `${(programa as any).criterio_dominio_pct}% en ${(programa as any).criterio_sesiones_consecutivas} sesiones`,
      total_sesiones: sesionesList.length,
      ultima_sesion: sesionesList[sesionesList.length - 1],
      tendencia,
      sesiones_recientes: sesionesList.slice(-5),
    }, null, 2)
  },

  // Obtener todos los programas de un niño
  async obtenerProgramasNino(childId: string) {
    // FIX: sin filtro de estado — evita fallos por case mismatch
    const { data } = await supabaseAdmin
      .from('programas_aba')
      .select('id, titulo, area, estado, fase_actual')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })

    if (!data || data.length === 0) return 'No hay programas activos para este paciente.'

    // FIX: query separada para últimas sesiones por programa
    const ids = (data as any[]).map(p => p.id)
    const { data: sesiones } = await supabaseAdmin
      .from('sesiones_datos_aba')
      .select('programa_id, porcentaje_exito, fecha')
      .in('programa_id', ids)
      .order('fecha', { ascending: false })
      .limit(50)

    const ultimaPorPrograma: Record<string, number | null> = {}
    if (sesiones) {
      for (const s of sesiones as any[]) {
        if (!(s.programa_id in ultimaPorPrograma)) {
          ultimaPorPrograma[s.programa_id] = s.porcentaje_exito
        }
      }
    }

    return (data as any[]).map(p => {
      const ultimoPct = ultimaPorPrograma[p.id] ?? null
      return `- ${p.titulo} (${p.area}) | Fase: ${p.fase_actual} | Último %: ${ultimoPct ?? 'sin datos'}`
    }).join('\n')
  },

  // Historial clínico del niño
  async obtenerHistorialNino(childId: string) {
    const history = await getChildHistory(childId)
    return `Paciente: ${history.nombre}, ${history.edad}\nDiagnóstico: ${history.diagnostico}\n${history.historialTexto}`
  },

  // FIX: Resumen de TODOS los pacientes para preguntas generales
  async obtenerResumenTodosPacientes() {
    const { data: pacientes } = await supabaseAdmin
      .from('children')
      .select('id, name, age, birth_date, diagnosis, status')
      .order('name', { ascending: true })
      .limit(50)

    if (!pacientes || pacientes.length === 0) return 'No hay pacientes registrados en el sistema.'

    const resumenes: string[] = []

    for (const p of pacientes as any[]) {
      // FIX: Priorizar birth_date (preciso) sobre age guardado (puede estar desactualizado)
      let edadTexto = 'edad N/E'
      if (p.birth_date) {
        const hoy = new Date()
        const nac = new Date(p.birth_date)
        const diff = hoy.getFullYear() - nac.getFullYear()
        const m = hoy.getMonth() - nac.getMonth()
        const edad = (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) ? diff - 1 : diff
        edadTexto = `${edad} años`
      } else if (p.age) {
        const numAge = parseInt(String(p.age).replace(/[^0-9]/g, ''), 10)
        edadTexto = !isNaN(numAge) ? `${numAge} años` : 'edad N/E'
      }

      // Última sesión ABA
      const { data: ultimaSesion } = await supabaseAdmin
        .from('registro_aba')
        .select('fecha_sesion, datos')
        .eq('child_id', p.id)
        .order('fecha_sesion', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Programas activos
      // FIX: sin filtro de estado
      const { data: programas } = await supabaseAdmin
        .from('programas_aba')
        .select('id, titulo, estado')
        .eq('child_id', p.id)
        .order('updated_at', { ascending: false })
        .limit(3)

      // Alertas activas
      const { data: alertas } = await supabaseAdmin
        .from('agente_alertas')
        .select('tipo, prioridad')
        .eq('child_id', p.id)
        .eq('resuelta', false)
        .limit(5)

      const alertasAltas = (alertas || []).filter((a: any) => a.prioridad === 'alta').length
      const alertasMedia = (alertas || []).filter((a: any) => a.prioridad === 'media').length

      let nivelLogro = 'sin datos'
      if (ultimaSesion && (ultimaSesion as any).datos?.nivel_logro_objetivos) {
        const val = (ultimaSesion as any).datos.nivel_logro_objetivos
        nivelLogro = typeof val === 'string' && val.includes('-') ? val : `${val}%`
      }

      const diasSinSesion = ultimaSesion
        ? Math.floor((Date.now() - new Date((ultimaSesion as any).fecha_sesion).getTime()) / 86400000)
        : null

      resumenes.push(
        `PACIENTE: ${p.name} | ${edadTexto} | Dx: ${p.diagnosis || 'No especificado'}\n` +
        `  Última sesión: ${ultimaSesion ? (ultimaSesion as any).fecha_sesion + (diasSinSesion !== null ? ` (hace ${diasSinSesion} días)` : '') : 'ninguna registrada'}\n` +
        `  Último logro de objetivos: ${nivelLogro}\n` +
        `  Programas ABA activos: ${programas?.length || 0}${programas && programas.length > 0 ? ' (' + (programas as any[]).map(pr => pr.titulo).join(', ') + ')' : ''}\n` +
        `  Alertas activas: ${(alertas || []).length}${alertasAltas > 0 ? ` (${alertasAltas} ALTA prioridad)` : ''}${alertasMedia > 0 ? ` (${alertasMedia} media)` : ''}`
      )
    }

    return `RESUMEN DEL SISTEMA — ${pacientes.length} PACIENTES ACTIVOS:\n\n${resumenes.join('\n\n')}`
  },

  // Analizar tendencia de un programa
  async analizarTendencia(programaId: string, ultimasN: number = 5) {
    const { data } = await supabaseAdmin
      .rpc('calcular_tendencia_programa', { prog_id: programaId, ultimas_n: ultimasN })
    return JSON.stringify(data)
  },
}

// ── Calcular tendencia localmente ────────────────────────────────────────────
// Calcula tendencia clínica usando regresión lineal sobre la ventana de sesiones.
// IMPORTANTE: para análisis de estancamiento de la INTERVENCIÓN, el caller debe
// filtrar previamente las sesiones de línea base (fase === 'linea_base'),
// porque la baseline mide nivel pre-intervención y sesgaría la pendiente.
function calcularTendenciaLocal(sesiones: any[]) {
  // Considerar solo sesiones con porcentaje_exito numérico válido
  const validas = (sesiones || []).filter(
    s => typeof s.porcentaje_exito === 'number' && !isNaN(s.porcentaje_exito)
  )

  if (validas.length < 2) {
    return { tendencia: 'insuficiente', n: validas.length, mensaje: 'Pocas sesiones' }
  }

  // Ventana de análisis: últimas N sesiones (máximo 6, mínimo 3)
  const ventana = validas.slice(-Math.min(6, validas.length))
  const valores = ventana.map(s => s.porcentaje_exito as number)
  const n = valores.length

  // Promedios
  const promReciente = valores.reduce((a, b) => a + b, 0) / n
  const promAnterior = validas.length > n
    ? (() => {
        const ant = validas.slice(-2 * n, -n).map(s => s.porcentaje_exito as number)
        return ant.length > 0 ? ant.reduce((a, b) => a + b, 0) / ant.length : promReciente
      })()
    : promReciente

  // Regresión lineal — x = índice de sesión (1..n), y = porcentaje_exito
  // slope = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  valores.forEach((y, i) => {
    const x = i + 1
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x
  })
  const denom = n * sumXX - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom   // % por sesión

  // Clasificación clínica según pendiente — basada en literatura ABA:
  //  > +1.5%/sesión → mejora clara
  //  < −1.5%/sesión → regresión
  //  entre ambos   → estable (potencial estancamiento si promedio bajo)
  let tendencia: 'mejorando' | 'regresion' | 'estable'
  if (slope > 1.5) tendencia = 'mejorando'
  else if (slope < -1.5) tendencia = 'regresion'
  else tendencia = 'estable'

  return {
    promedio_reciente: Math.round(promReciente),
    promedio_anterior: Math.round(promAnterior),
    cambio: Math.round(promReciente - promAnterior),
    slope: Math.round(slope * 10) / 10,           // % por sesión, 1 decimal
    n_sesiones_analizadas: n,
    tendencia,
  }
}

// ── Sistema prompt del agente ─────────────────────────────────────────────────

function getLocaleLabel(locale: string): string {
  const labels: Record<string, string> = {
    es: 'español',
    en: 'English',
    pt: 'português',
    fr: 'français',
    de: 'Deutsch',
    it: 'italiano',
  }
  return labels[locale] || 'español'
}

const SYSTEM_PROMPT_BASE = `Eres ARIA, asistente clínica de Vanty 🧠 — plataforma de intervención infantil especializada en ABA, TEA, TDAH y neurodesarrollo.

🎯 IDENTIDAD:
Estoy entrenada en evaluación e intervención de población infantil, con base en ABA (Cooper, Heron & Heward; Malott & Trojan), ética clínica IBAO/BACB, neuropsicología del neurodesarrollo, educación especial y el Journal of Applied Behavior Analysis (JABA). Hablo español clínico, cálido y profesional — dirigido a terapeutas y supervisoras, NUNCA al paciente infantil directamente.

📚 FUENTES VÁLIDAS:
- Cooper, Heron & Heward — Applied Behavior Analysis
- Richard Malott — Principles of Behavior
- DSM-5-TR (APA, 2022)
- CIE-11 / ICD-11 (OMS, 2022) — Clasificación Internacional de Enfermedades 11ª Revisión
- BACB Task List / IBAO Guidelines
- Journal of Applied Behavior Analysis (JABA)
- Behavior Analysis in Practice (BAP)
- Scopus / Web of Science (artículos peer-reviewed ABA)
⛔ NUNCA uses Wikipedia, blogs, ni fuentes no revisadas por pares.

🏥 DIAGNÓSTICOS CIE-11 (DOMINIO SALUD MENTAL Y NEURODESARROLLO):
Cuando se consulte por diagnósticos, puedes buscar en:
- TEA / Trastorno del Espectro Autista → CIE-11: 6A02 | DSM-5: 299.00
- TDAH → CIE-11: 6A05 | DSM-5: 314.xx
- Discapacidad Intelectual → CIE-11: 6A00 | DSM-5: 319
- Trastorno del Desarrollo del Lenguaje → CIE-11: 6A01
- Trastorno del Movimiento Estereotipado → CIE-11: 6A06
- Trastorno por Tics → CIE-11: 8A05
- Ansiedad → CIE-11: 6B00 | DSM-5: 300.02
- TOC → CIE-11: 6B20 | DSM-5: 300.3
- Trastorno de Apego Reactivo → CIE-11: 6B44
- Epilepsia → CIE-11: 8A60-8A6Z
Al citar diagnósticos, SIEMPRE incluye el código CIE-11 y DSM-5 cuando corresponda.

📊 CRITERIO DE LOGRO ABA (REGLA CRÍTICA):
- ✅ LOGRO = paciente alcanza ≥ 90% en mínimo 2 sesiones CONSECUTIVAS dentro del mismo SET
- Siempre reporta: último % registrado + media o mediana del historial (según distribución)
- ⚠️ ALERTA si hay saltos bruscos (ej: 0% → 90% en 1 sesión) = posible error de registro
- Analiza siempre por PROGRAMA/OBJETIVO/SET específico, nunca en general

✍️ FORMATO DE RESPUESTA (SIEMPRE):
- Usa emojis como separadores de sección: 📊 datos · 🎯 objetivos · ⚠️ alertas · 💡 sugerencias · ✅ logros · 🔄 en proceso
- Omite frases de cortesía innecesarias como "Excelente pregunta" o "Claro, con gusto"
- Habla como un especialista clínico — con autoridad, precisión y criterio propio
- Desarrolla las respuestas con la profundidad que el tema requiere: si la pregunta es simple, responde conciso; si es compleja, desarrolla con detalle clínico
- NO cites las fuentes bibliográficas en cada respuesta. El conocimiento ya está integrado. Si mencionas un concepto técnico, nómbralo directamente (ej: "extinción de escape", "moldeamiento", "DRO") sin agregar "(Cooper et al.)" o "(Malott)"
- Solo menciona una fuente si el usuario pregunta explícitamente de dónde viene la información
- Lenguaje técnico-clínico apropiado para terapeutas profesionales, fluido y natural

🗂️ ACCESO A DATOS DEL SISTEMA:
- Si el contexto contiene "RESUMEN DEL SISTEMA" o "HISTORIAL CLÍNICO" o "Programas ABA activos" → úsalos DIRECTAMENTE
- Nunca digas "no tengo acceso" si los datos están en el contexto
- Para análisis de pacientes: usa alertas, última sesión, % de logro y programas activos del contexto
- Para comparaciones: analiza todos los pacientes del resumen con nombres reales

⚖️ REGLAS:
- NUNCA inventes datos que no estén en el contexto
- NUNCA respondas con evasivas genéricas si tienes datos disponibles
- ARIA es COMPLEMENTO del terapeuta. Las decisiones clínicas (cambiar programas, objetivos, estrategias) SIEMPRE las toma el especialista certificado. Si te piden tomar una decisión clínica, sugiere opciones pero derivá siempre al terapeuta
- NUNCA sugieras modificar el programa terapéutico vigente sin indicar que debe ser validado por el especialista
- Si hay dilema ético: aplica el modelo de 7 pasos IBAO
- Si preguntan por el nombre del sistema: es VANTY, no mencionas "Neuropsicología y Terapias SANTI" en respuestas clínicas
- Cuando analices tendencias, considera el contexto clínico COMPLETO del paciente`

// ── Clase principal del Agente ────────────────────────────────────────────────

function getLangInstruction(locale: string): string {
  return ''
}

export class VantyAgent {
  private conversacionId: string | null = null

  async chat(
    userMessage: string,
    options: {
      childId?: string
      userId: string
      conversacionId?: string
      contexto?: string
      locale?: string
    }
  ): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // 1. Cargar o crear conversación
      let conversacion = await this.loadOrCreateConversacion(
        options.conversacionId,
        options.userId,
        options.childId,
        options.contexto
      )

      // 2. Construir contexto dinámico
      const preguntaSobrePacientes = /paciente|peor|mejor|progreso|todos|lista|quien|quién|comparar|estado|sesion|sesión|avance|regresion|regresión|alert/i.test(userMessage)

      const [knowledgeCtx, childCtx, globalCtx] = await Promise.all([
        buildKnowledgeContext(userMessage),
        options.childId ? AGENT_TOOLS.obtenerHistorialNino(options.childId) : Promise.resolve(''),
        (!options.childId && preguntaSobrePacientes)
          ? AGENT_TOOLS.obtenerResumenTodosPacientes()
          : Promise.resolve(''),
      ])

      // 3. Preparar mensajes con historial
      const messages = conversacion.mensajes as any[]
      const historialReciente = messages.slice(-6)

      // FIX: límites de contexto aumentados para que los programas ABA no sean truncados
      // childCtx: 4000 → 8000 (child-history ya pone programas ABA primero)
      // knowledgeCtx: 6000 → 5000 (cedemos espacio a datos del paciente)
      // globalCtx: 3000 → 3000 (sin cambio)
      const userLocale = (options as any).locale || 'es'
      const localeInstruction = userLocale !== 'es'
        ? `\n\n[IDIOMA OBLIGATORIO: Responde SIEMPRE en ${getLocaleLabel(userLocale)}. Nunca respondas en español si el idioma configurado es diferente.]`
        : ''

      const knowledgeCtxTrimmed = knowledgeCtx.slice(0, 5000)
      const childCtxTrimmed = childCtx ? childCtx.slice(0, 8000) : ''       // FIX: 4000 → 8000
      const globalCtxTrimmed = globalCtx ? globalCtx.slice(0, 3000) : ''

      let systemContext = SYSTEM_PROMPT_BASE + localeInstruction + '\n\n' + knowledgeCtxTrimmed
      if (childCtxTrimmed) systemContext += '\nPACIENTE ACTIVO:\n' + childCtxTrimmed
      if (globalCtxTrimmed) systemContext += '\n\n' + globalCtxTrimmed

      const groqMessages = [
        { role: 'system' as const, content: systemContext },
        ...historialReciente.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userMessage },
      ]

      // 4. Llamar a Groq
      const aiResponse = await callGroq(groqMessages, {
        model: GROQ_MODELS.SMART,
        temperature: 0.6,
        maxTokens: 1500,
      }) || 'No pude generar una respuesta.'

      // 5. Detectar si necesita usar herramientas
      const toolResult = await this.detectAndUseTool(userMessage, aiResponse, options.childId)
      const finalResponse = toolResult ? `${aiResponse}\n\n${toolResult}` : aiResponse

      // 6. Guardar en historial
      const updatedMessages = [
        ...messages,
        { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
        { role: 'assistant', content: finalResponse, timestamp: new Date().toISOString() },
      ]

      if (!String(conversacion.id).startsWith('temp-')) {
        try {
          await supabaseAdmin
            .from('agente_conversaciones')
            .update({ mensajes: updatedMessages, updated_at: new Date().toISOString() })
            .eq('id', conversacion.id)

          await supabaseAdmin.from('agente_acciones').insert({
            conversacion_id: conversacion.id,
            child_id: options.childId,
            tipo_accion: 'chat',
            input_data: { mensaje: userMessage },
            output_data: { respuesta: finalResponse, tiempo_ms: Date.now() - startTime },
          })
        } catch (saveErr: any) {
          console.warn('No se pudo guardar historial del agente:', saveErr.message)
        }
      }

      return {
        respuesta: finalResponse,
        conversacionId: String(conversacion.id).startsWith('temp-') ? null : conversacion.id,
        fuentesUsadas: await this.extractSources(finalResponse),
        tiempoMs: Date.now() - startTime,
      }
    } catch (error: any) {
      console.error('Error agente:', error)
      const esRateLimit = error.message?.includes('429') || error.message?.includes('rate')
      const esContextoLargo = error.message?.includes('400') || error.message?.includes('context')
      const mensajeUsuario = esRateLimit
        ? '⏳ ARIA está procesando muchas consultas en este momento. Espera unos segundos e intenta de nuevo.'
        : esContextoLargo
        ? '📝 La consulta es muy extensa. Intenta reformularla de forma más concisa.'
        : 'Lo siento, hubo un problema al procesar tu consulta. Por favor intenta de nuevo.'
      return {
        respuesta: mensajeUsuario,
        conversacionId: options.conversacionId || null,
        fuentesUsadas: [],
        tiempoMs: Date.now() - startTime,
      }
    }
  }

  // Análisis proactivo de un paciente
  async analizarPacienteProactivo(childId: string): Promise<ProactiveAnalysis> {
    try {
      // FIX: sin filtro de estado
      const { data: programas } = await supabaseAdmin
        .from('programas_aba')
        .select('id, titulo, area, fase_actual, criterio_dominio_pct, criterio_sesiones_consecutivas')
        .eq('child_id', childId)

      if (!programas || programas.length === 0) {
        return { alertas: [], sugerencias: [], resumen: 'No hay programas activos para analizar.' }
      }

      // FIX: query separada y ordenada para sesiones de análisis proactivo
      const programaIds = (programas as any[]).map(p => p.id)
      const { data: todasSesiones } = await supabaseAdmin
        .from('sesiones_datos_aba')
        .select('programa_id, fecha, porcentaje_exito, fase, set')
        .in('programa_id', programaIds)
        .order('fecha', { ascending: true })

      const sesionesPorPrograma: Record<string, any[]> = {}
      if (todasSesiones) {
        for (const s of todasSesiones as any[]) {
          if (!sesionesPorPrograma[s.programa_id]) sesionesPorPrograma[s.programa_id] = []
          sesionesPorPrograma[s.programa_id].push(s)
        }
      }

      const alertas: Alerta[] = []
      const sugerencias: string[] = []

      for (const prog of programas as any[]) {
        const sesionesAll = sesionesPorPrograma[prog.id] || []

        // FIX clínico: separar baseline e intervención.
        // La línea base mide el nivel PRE-intervención y NO debe contar para
        // detectar estancamiento del tratamiento. Solo se analizan sesiones de
        // intervención/mantenimiento.
        const sesionesIntervencion = sesionesAll.filter(s => s.fase !== 'linea_base')

        if (sesionesIntervencion.length < 2) continue

        const tendencia = calcularTendenciaLocal(sesionesIntervencion)
        const criterio = prog.criterio_dominio_pct || 90
        const slope = tendencia.slope ?? 0
        const nAnalizadas = tendencia.n_sesiones_analizadas ?? sesionesIntervencion.length

        // Regresión real: pendiente negativa marcada Y cambio fuerte vs ventana previa
        if (tendencia.tendencia === 'regresion' && (tendencia.cambio || 0) < -10) {
          alertas.push({
            tipo: 'regresion',
            titulo: `Regresión en "${prog.titulo}"`,
            mensaje: `El % de éxito bajó ${Math.abs(tendencia.cambio || 0)} puntos (${tendencia.promedio_anterior}% → ${tendencia.promedio_reciente}%, pendiente ${slope}%/sesión). Revisar antecedentes y reforzadores.`,
            prioridad: 'alta',
            programa_id: prog.id,
          })
        }

        // Estancamiento real: ≥5 sesiones de INTERVENCIÓN, pendiente plana
        // (no mejora estadística) Y promedio aún lejos del criterio de dominio.
        if (
          sesionesIntervencion.length >= 5 &&
          tendencia.tendencia === 'estable' &&
          (tendencia.promedio_reciente || 0) < Math.min(70, criterio - 10)
        ) {
          alertas.push({
            tipo: 'estancamiento',
            titulo: `Estancamiento en "${prog.titulo}"`,
            mensaje: `${sesionesIntervencion.length} sesiones de intervención sin mejora estadística (pendiente ${slope >= 0 ? '+' : ''}${slope}%/sesión sobre las últimas ${nAnalizadas}, promedio ${tendencia.promedio_reciente}%, criterio ${criterio}%). Considera revisar procedimiento o nivel de ayuda.`,
            prioridad: 'media',
            programa_id: prog.id,
          })
        }

        // ── LOGROS POSITIVOS (per-set, mismo criterio que la UI) ──
        // Usa el SET ACTIVO (último set con sesiones) y aplica el criterio del programa.
        const nConsecutivas = Number((prog as any).criterio_sesiones_consecutivas) || 2
        const setsConSesiones = Array.from(new Set(sesionesIntervencion.map((s: any) => s.set ?? '__none__')))
        const setActivo = setsConSesiones[setsConSesiones.length - 1] ?? '__none__'
        const sesionesSetActivo = sesionesIntervencion.filter((s: any) => (s.set ?? '__none__') === setActivo)

        // 1. CRITERIO ALCANZADO: últimas N consecutivas del set activo ≥ criterio
        const criterioAlcanzado =
          sesionesSetActivo.length >= nConsecutivas &&
          sesionesSetActivo.slice(-nConsecutivas).every((s: any) => (s.porcentaje_exito ?? 0) >= criterio)

        if (criterioAlcanzado) {
          const ultimas = sesionesSetActivo.slice(-nConsecutivas)
          const promUlt = Math.round(ultimas.reduce((a: number, s: any) => a + s.porcentaje_exito, 0) / ultimas.length)
          const etiquetaSet = setActivo && setActivo !== '__none__' ? ` (${setActivo})` : ''
          alertas.push({
            tipo: `logro_dominio_${prog.id}`,
            titulo: `🎯 Criterio alcanzado en "${prog.titulo}"`,
            mensaje: `${nConsecutivas} sesiones consecutivas cumpliendo criterio de ${criterio}% (promedio ${promUlt}%)${etiquetaSet}. Considera pasar a mantenimiento o avanzar al siguiente objetivo.`,
            prioridad: 'baja',
            programa_id: prog.id,
          })
        }

        // 2. CERCA DE DOMINIO: últimas (N-1) del set activo ≥ criterio, falta 1 sesión
        else if (
          nConsecutivas >= 2 &&
          sesionesSetActivo.length >= nConsecutivas - 1 &&
          sesionesSetActivo.slice(-(nConsecutivas - 1)).every((s: any) => (s.porcentaje_exito ?? 0) >= criterio)
        ) {
          const ultima = sesionesSetActivo[sesionesSetActivo.length - 1]
          const etiquetaSet = setActivo && setActivo !== '__none__' ? ` (${setActivo})` : ''
          alertas.push({
            tipo: `logro_cerca_dominio_${prog.id}`,
            titulo: `⚡ Falta 1 sesión para dominar "${prog.titulo}"`,
            mensaje: `Última sesión al ${ultima?.porcentaje_exito}% cumpliendo criterio (${criterio}%)${etiquetaSet}. Una sesión más en el criterio confirma el dominio.`,
            prioridad: 'baja',
            programa_id: prog.id,
          })
        }

        // 3. PROGRESO CONSISTENTE: ≥5 sesiones de intervención, pendiente clara, promedio bueno
        else if (
          sesionesIntervencion.length >= 5 &&
          slope >= 5 &&
          (tendencia.promedio_reciente || 0) >= 60
        ) {
          alertas.push({
            tipo: `logro_progreso_${prog.id}`,
            titulo: `📈 Progreso consistente en "${prog.titulo}"`,
            mensaje: `Tendencia ascendente clara: +${slope}% por sesión, promedio ${tendencia.promedio_reciente}% sobre las últimas ${nAnalizadas} sesiones. Buen avance hacia el criterio de ${criterio}%.`,
            prioridad: 'baja',
            programa_id: prog.id,
          })
        }

        if ((tendencia.promedio_reciente || 0) >= criterio - 5) {
          sugerencias.push(`"${prog.titulo}" está al ${tendencia.promedio_reciente}% — cerca del criterio de dominio (${criterio}%). ¡Excelente progreso!`)
        }

        const ultimaFecha = sesionesAll[sesionesAll.length - 1]?.fecha
        if (ultimaFecha) {
          const diasSinSesion = Math.floor((Date.now() - new Date(ultimaFecha).getTime()) / 86400000)
          if (diasSinSesion >= 7) {
            alertas.push({
              tipo: 'sin_sesion',
              titulo: `Sin sesión hace ${diasSinSesion} días — "${prog.titulo}"`,
              mensaje: `El programa no ha tenido sesiones en ${diasSinSesion} días. Verificar si hay ausencia del paciente o cambio de prioridades.`,
              prioridad: diasSinSesion >= 14 ? 'alta' : 'baja',
              programa_id: prog.id,
            })
          }
        }
      }

      if (alertas.length > 0) {
        await supabaseAdmin.from('agente_alertas').upsert(
          alertas.map(a => ({
            child_id: childId,
            tipo: a.tipo,
            titulo: a.titulo,
            mensaje: a.mensaje,
            programa_id: a.programa_id,
            prioridad: a.prioridad,
            resuelta: false,
          }))
        )
      }

      const childHistory = await getChildHistory(childId)
      const resumenPrompt = `Eres ARIA, analista de conducta. Resume el estado clínico actual de ${childHistory.nombre} en 2-3 oraciones basándote en estos datos:
      - ${programas.length} programas activos
      - Alertas detectadas: ${alertas.map(a => a.titulo).join(', ') || 'ninguna'}
      - Avances cercanos al criterio: ${sugerencias.join(', ') || 'ninguno'}
      Sé específico, clínico y menciona el nombre del paciente.`

      const resumenText = await callGroqSimple('Eres ARIA, analista de conducta clínica.', resumenPrompt, { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 300 })

      return {
        alertas,
        sugerencias,
        resumen: resumenText || 'Análisis completado.',
      }
    } catch (error: any) {
      console.error('Error análisis proactivo:', error)
      return { alertas: [], sugerencias: [], resumen: 'Error al analizar el paciente.' }
    }
  }

  // FIX: triggers de herramientas más amplios para capturar más tipos de preguntas sobre programas
  private async detectAndUseTool(
    userMessage: string,
    aiResponse: string,
    childId?: string
  ): Promise<string | null> {
    const msg = userMessage.toLowerCase()

    // FIX: regex ampliado — antes solo era "tendencia|progreso|programa"
    const preguntaSobrePrograma = /tendencia|progreso|programa|objetivo|set|avance|sesion|sesión|porcentaje|logro|área|area|habilidad|skill|fase|criterio|dominio/i.test(userMessage)

    if (preguntaSobrePrograma && childId) {
      const programas = await AGENT_TOOLS.obtenerProgramasNino(childId)
      if (programas !== 'No hay programas activos para este paciente.') {
        return `\n**Programas ABA activos:**\n${programas}`
      }
    }

    // Sin paciente, preguntas sobre quién está peor/mejor
    if (!childId && (
      aiResponse.includes('no tengo acceso') ||
      aiResponse.includes('no puedo proporcionar') ||
      aiResponse.includes('sin acceso')
    ) && /paciente|peor|mejor|progreso|estado/i.test(msg)) {
      const resumen = await AGENT_TOOLS.obtenerResumenTodosPacientes()
      return `\n**Datos del sistema (respuesta directa):**\n${resumen}`
    }

    return null
  }

  private async extractSources(response: string): Promise<string[]> {
    const sources: string[] = []
    const patterns = [/Malott/i, /DSM-5/i, /IBAO/i, /LuTr/i, /IBA/i]
    patterns.forEach(p => {
      if (p.test(response)) sources.push(p.source.replace(/[/i]/g, ''))
    })
    return sources
  }

  private async loadOrCreateConversacion(
    conversacionId?: string,
    userId?: string,
    childId?: string,
    contexto?: string
  ) {
    try {
      if (conversacionId) {
        const { data } = await supabaseAdmin
          .from('agente_conversaciones')
          .select('*')
          .eq('id', conversacionId)
          .single()
        if (data) return data
      }

      const { data, error } = await supabaseAdmin
        .from('agente_conversaciones')
        .insert({
          user_id: userId,
          child_id: childId,
          contexto: contexto || 'general',
          mensajes: [],
          titulo: `Consulta ${new Date().toLocaleDateString('es-PE')}`,
        })
        .select()
        .single()

      if (error) throw error
      return data!
    } catch (e: any) {
      console.warn('agente_conversaciones no disponible:', e.message)
      return { id: `temp-${Date.now()}`, mensajes: [], user_id: userId, child_id: childId }
    }
  }
}

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface AgentResponse {
  respuesta: string
  conversacionId: string | null
  fuentesUsadas: string[]
  tiempoMs: number
  error?: string
}

export interface Alerta {
  tipo: string
  titulo: string
  mensaje: string
  prioridad: 'alta' | 'media' | 'baja'
  programa_id?: string
}

export interface ProactiveAnalysis {
  alertas: Alerta[]
  sugerencias: string[]
  resumen: string
}

export const vantyAgent = new VantyAgent()
