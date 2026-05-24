// app/api/agente-sugerencias/route.ts
// 🏆 CAPA 4 — Alertas Proactivas al Terapeuta
// "Este objetivo lleva 6 semanas sin avance — considera ajustar"
// Corre automáticamente y genera sugerencias antes de que el terapeuta las pida

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'

interface Sugerencia {
  tipo: 'objetivo_estancado' | 'cambio_fase' | 'reforzador' | 'conducta_desafiante' | 'logro_celebrar' | 'carga_sesiones'
  prioridad: 'alta' | 'media' | 'baja'
  titulo: string
  descripcion: string
  accion_concreta: string
  child_id: string
  child_name: string
  semanas_detectado: number
  dato_clave: string
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

async function analizarPaciente(childId: string, childName: string): Promise<Sugerencia[]> {
  const sugerencias: Sugerencia[] = []

  const hace8semanas = new Date(); hace8semanas.setDate(hace8semanas.getDate() - 56)
  const hace4semanas = new Date(); hace4semanas.setDate(hace4semanas.getDate() - 28)
  const fechaCorte8 = hace8semanas.toISOString().split('T')[0]
  const fechaCorte4 = hace4semanas.toISOString().split('T')[0]

  // FIX: leemos AMBAS fuentes (registro_aba clásico + sesiones_datos_aba modernas)
  // FIX: objetivos_cp tiene campo `descripcion`, no `nombre` → antes la query fallaba silenciosa
  // FIX: filtramos estados archivados localmente (más robusto que .not('estado','in',...))
  const [sesionesRes, programasRes, sesProgRes] = await Promise.all([
    supabaseAdmin.from('registro_aba').select('fecha_sesion, datos')
      .eq('child_id', childId)
      .gte('fecha_sesion', fechaCorte8)
      .order('fecha_sesion', { ascending: true }),
    supabaseAdmin.from('programas_aba')
      .select('id, titulo, area, fase_actual, estado, criterio_dominio_pct, criterio_sesiones_consecutivas, objetivos_cp(id, descripcion, estado, numero_set)')
      .eq('child_id', childId),
    supabaseAdmin.from('sesiones_datos_aba')
      .select('programa_id, fecha, porcentaje_exito, set')
      .eq('child_id', childId)
      .gte('fecha', fechaCorte8)
      .order('fecha', { ascending: true }),
  ])

  const sesiones = sesionesRes.data || []
  const programasRaw = (programasRes.data || []) as any[]
  const programas = programasRaw.filter((p: any) =>
    !['archivado', 'alta', 'dado_de_alta', 'inactivo', 'cancelado'].includes(String(p.estado || '').toLowerCase())
  )
  const sesProg = sesProgRes.data || []

  // ── REGLA 1: Objetivo estancado > 4 semanas (basado en registro_aba) ─────
  const sesiones4sem = sesiones.filter(s => s.fecha_sesion >= fechaCorte4)
  if (sesiones4sem.length >= 4) {
    const logros4sem = sesiones4sem.map(s => parseLogro(s.datos?.nivel_logro_objetivos)).filter((v): v is number => v !== null)
    if (logros4sem.length > 0) {
      const prom4sem = logros4sem.reduce((a, b) => a + b, 0) / logros4sem.length
      const max4sem = Math.max(...logros4sem)
      const min4sem = Math.min(...logros4sem)

      if (prom4sem < 60 && (max4sem - min4sem) < 10) {
        const objetivoActual = sesiones4sem[sesiones4sem.length - 1]?.datos?.objetivo_principal || 'objetivo actual'
        sugerencias.push({
          tipo: 'objetivo_estancado',
          prioridad: 'alta',
          titulo: `${childName}: Objetivo sin avance por 4+ semanas`,
          descripcion: `"${objetivoActual}" muestra estancamiento. Promedio de logro: ${Math.round(prom4sem)}% con variación mínima (${Math.round(min4sem)}-${Math.round(max4sem)}%).`,
          accion_concreta: 'Considera dividir el objetivo en pasos más pequeños, cambiar el reforzador o revisar si hay factores ambientales nuevos.',
          child_id: childId,
          child_name: childName,
          semanas_detectado: 4,
          dato_clave: `Logro promedio: ${Math.round(prom4sem)}%`
        })
      }
    }
  }

  // ── REGLA 2: Programas que ALCANZAN criterio (avisar al especialista) ────
  // Usa la MISMA lógica del UI: últimas N sesiones consecutivas >= criterio OR todos los sets dominados
  for (const prog of programas) {
    const objetivos = (prog as any).objetivos_cp || []
    const crit = Number(prog.criterio_dominio_pct) || 90
    const critSes = Number(prog.criterio_sesiones_consecutivas) || 2

    // a) ¿Todos los sets marcados manualmente como dominado?
    const todosSetsDominados = objetivos.length > 0 && objetivos.every((o: any) => o.estado === 'dominado')

    // b) ¿Las últimas N sesiones del programa están todas >= criterio?
    const sesEsteProg = sesProg.filter((s: any) => s.programa_id === prog.id)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    let cumplePorSesiones = false
    if (sesEsteProg.length >= critSes) {
      const ultimas = sesEsteProg.slice(-critSes)
      cumplePorSesiones = ultimas.every((s: any) => (Number(s.porcentaje_exito) || 0) >= crit)
    }

    // Si cumple criterio y NO está ya marcado como 'dominado' formalmente, avisar
    const yaCerrado = ['dominado', 'logrado', 'criterio_alcanzado'].includes(String(prog.estado || '').toLowerCase())
    if (!yaCerrado && (todosSetsDominados || cumplePorSesiones)) {
      const dominados = objetivos.filter((o: any) => o.estado === 'dominado').length
      const total = objetivos.length
      const razon = todosSetsDominados
        ? `Todos los sets (${dominados}/${total}) marcados como dominados`
        : `Últimas ${critSes} sesiones ≥ ${crit}% (criterio automático)`
      sugerencias.push({
        tipo: 'cambio_fase',
        prioridad: 'media',
        titulo: `${childName}: "${prog.titulo}" listo para avanzar`,
        descripcion: `${razon}. Programa actualmente en fase "${prog.fase_actual || '—'}".`,
        accion_concreta: `Marcá el programa como "Criterio alcanzado" o avanzá a generalización con 2do terapeuta / entorno distinto.`,
        child_id: childId,
        child_name: childName,
        semanas_detectado: 0,
        dato_clave: todosSetsDominados ? `${dominados}/${total} sets dominados` : `Últimas ${critSes} sesiones ≥ ${crit}%`
      })
    }
  }

  // ── REGLA 2b: REGRESIÓN dentro del SET ACTIVO (no entre sets distintos) ──
  // Si comparáramos sesiones de set 1 vs set 2, un cambio normal de set (donde el
  // siguiente empieza más bajo por ser más difícil) se vería como "regresión" falsa.
  // Por eso evaluamos SOLO las sesiones del set activo (el más reciente).
  for (const prog of programas) {
    const sesEsteProg = sesProg.filter((s: any) => s.programa_id === prog.id)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    if (sesEsteProg.length < 4) continue

    // Identificar el SET ACTIVO = el último set con sesiones registradas
    const setsConSes = Array.from(new Set(sesEsteProg.map((s: any) => s.set ?? '__none__')))
    const setActivo = setsConSes[setsConSes.length - 1] ?? '__none__'
    const sesSetActivo = sesEsteProg.filter((s: any) => (s.set ?? '__none__') === setActivo)

    // Necesitamos al menos 4 sesiones DEL SET ACTIVO para comparar 2 mitades
    if (sesSetActivo.length < 4) continue
    const pcts = sesSetActivo.map((s: any) => Number(s.porcentaje_exito) || 0).filter((v: number) => v > 0)
    if (pcts.length < 4) continue

    const mitad = Math.floor(pcts.length / 2)
    const promViejo = pcts.slice(0, mitad).reduce((a, b) => a + b, 0) / mitad
    const promReciente = pcts.slice(-mitad).reduce((a, b) => a + b, 0) / mitad
    const delta = Math.round(promReciente - promViejo)
    if (delta <= -15) {
      const setLabel = setActivo === '__none__' ? '' : ` (Set ${setActivo})`
      sugerencias.push({
        tipo: 'objetivo_estancado',
        prioridad: 'alta',
        titulo: `${childName}: Regresión en "${prog.titulo}"${setLabel}`,
        descripcion: `Caída de ${Math.round(promViejo)}% → ${Math.round(promReciente)}% (${delta}%) dentro del set activo${setLabel}. Comparado con las primeras sesiones del mismo set.`,
        accion_concreta: 'Revisar reforzadores, SD y posibles factores ambientales del set actual. Considerá volver a la fase de adquisición o reforzar prompts antes de continuar.',
        child_id: childId,
        child_name: childName,
        semanas_detectado: 4,
        dato_clave: `${Math.round(promViejo)}% → ${Math.round(promReciente)}% en set activo`
      })
    }
  }

  // ── REGLA 3: Conductas desafiantes frecuentes ────────────────────────────
  const sesionesConConducas = sesiones.filter(s => s.datos?.conductas_desafiantes && String(s.datos.conductas_desafiantes).length > 5)
  if (sesionesConConducas.length >= 3 && sesiones.length > 0) {
    const pct = Math.round((sesionesConConducas.length / sesiones.length) * 100)
    sugerencias.push({
      tipo: 'conducta_desafiante',
      prioridad: pct > 50 ? 'alta' : 'media',
      titulo: `${childName}: Conductas desafiantes en ${pct}% de las sesiones`,
      descripcion: `Se registraron conductas desafiantes en ${sesionesConConducas.length} de ${sesiones.length} sesiones recientes.`,
      accion_concreta: 'Revisar análisis funcional ABC. Considerar reunión de equipo o consulta con comportamentalista senior.',
      child_id: childId,
      child_name: childName,
      semanas_detectado: Math.ceil(sesiones.length / 2),
      dato_clave: `${pct}% sesiones con conductas`
    })
  }

  // ── REGLA 4: Progreso excelente — logros por programa (sesiones_datos_aba) ─
  for (const prog of programas) {
    const yaCerrado = ['dominado', 'logrado', 'criterio_alcanzado'].includes(String(prog.estado || '').toLowerCase())
    if (yaCerrado) {
      sugerencias.push({
        tipo: 'logro_celebrar',
        prioridad: 'baja',
        titulo: `${childName}: ${prog.titulo} consolidado`,
        descripcion: `Este programa ya alcanzó el criterio de dominio en ${prog.area || 'su área'}.`,
        accion_concreta: 'Compartí este logro con la familia. Considerá iniciar generalización en nuevos entornos o subir complejidad.',
        child_id: childId,
        child_name: childName,
        semanas_detectado: 0,
        dato_clave: 'Criterio alcanzado',
      })
    }
  }

  // ── REGLA 5: Pocas sesiones recientes (baja frecuencia) ─────────────────
  // Usa sesiones_datos_aba que es la fuente activa
  const fechasUltimas4 = new Set(sesProg.filter((s: any) => s.fecha && s.fecha >= fechaCorte4).map((s: any) => s.fecha))
  const sesionesUltimas4 = fechasUltimas4.size
  const fechasTotalesSet = new Set(sesProg.map((s: any) => s.fecha).filter(Boolean))
  if (fechasTotalesSet.size > 4 && sesionesUltimas4 < 4) {
    sugerencias.push({
      tipo: 'carga_sesiones',
      prioridad: 'media',
      titulo: `${childName}: Baja frecuencia de sesiones`,
      descripcion: `Solo ${sesionesUltimas4} sesión${sesionesUltimas4 === 1 ? '' : 'es'} en las últimas 4 semanas. La frecuencia recomendada es 2-4/semana.`,
      accion_concreta: 'Revisar agenda con la familia. Alta frecuencia en fase inicial es crítica para el progreso.',
      child_id: childId,
      child_name: childName,
      semanas_detectado: 4,
      dato_clave: `${sesionesUltimas4} sesiones/4 semanas`
    })
  }

  return sugerencias
}

// ── GET: Generar sugerencias de todos los pacientes (para dashboard) ──────────

// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userLocale = searchParams.get('locale') || req.headers.get('x-locale') || 'es'
  const childId = searchParams.get('child_id')
  const soloGuardadas = searchParams.get('guardadas') === 'true'

  try {
    // Si pide las guardadas, retornarlas directamente
    if (soloGuardadas) {
      let q = supabaseAdmin
        .from('sugerencias_terapeutas')
        .select('*, children(name)')
        .eq('resuelta', false)
        .order('prioridad_orden', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50)
      if (childId) q = q.eq('child_id', childId)
      const { data } = await q
      return NextResponse.json({ sugerencias: data || [] })
    }

    // Generar en tiempo real
    let queryPacientes = supabaseAdmin.from('children').select('id, name')
    if (childId) queryPacientes = queryPacientes.eq('id', childId)
    const { data: pacientes } = await queryPacientes.limit(30)

    if (!pacientes || pacientes.length === 0) {
      return NextResponse.json({ sugerencias: [], total: 0 })
    }

    // Analizar todos los pacientes en paralelo (máx 5 simultáneos)
    const BATCH = 5
    const todasSugerencias: Sugerencia[] = []

    for (let i = 0; i < pacientes.length; i += BATCH) {
      const batch = pacientes.slice(i, i + BATCH)
      const resultados = await Promise.all(
        batch.map(p => analizarPaciente(p.id, p.name).catch(err => {
          console.warn(`[agente-sugerencias] falló análisis de ${p.name}:`, err?.message || err)
          return []
        }))
      )
      todasSugerencias.push(...resultados.flat())
    }
    console.log(`[agente-sugerencias] ${todasSugerencias.length} alertas generadas para ${pacientes.length} pacientes`)

    // Ordenar: alta → media → baja, luego por tipo
    const orden = { alta: 0, media: 1, baja: 2 }
    todasSugerencias.sort((a, b) => orden[a.prioridad] - orden[b.prioridad])

    // Guardar en Supabase (upsert por child_id + tipo)
    for (const s of todasSugerencias) {
      try {
        await supabaseAdmin.from('sugerencias_terapeutas').upsert({
          child_id: s.child_id,
          tipo: s.tipo,
          prioridad: s.prioridad,
          prioridad_orden: orden[s.prioridad],
          titulo: s.titulo,
          descripcion: s.descripcion,
          accion_concreta: s.accion_concreta,
          dato_clave: s.dato_clave,
          semanas_detectado: s.semanas_detectado,
          resuelta: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'child_id,tipo' })
      } catch { /* no bloquear */ }
    }

    // Generar insight global con IA si hay muchas sugerencias
    
    // ━━━ CEREBRO IA ━━━
    let _cerebroCtx = ''
    try {
      const _kb = await buildAIContext(undefined, undefined, undefined, 'sugerencias estrategias ABA TEA intervención')
      _cerebroCtx = _kb.knowledgeContext
    } catch { /* fallback */ }
    // ━━━ FIN CEREBRO IA ━━━
    let insightGlobal: string | null = null
    const urgentes = todasSugerencias.filter(s => s.prioridad === 'alta')
    if (urgentes.length >= 2) {
      try {
        insightGlobal = await callGroqSimple(
          'Eres un supervisor clínico ABA analizando el estado del centro terapéutico. Fundamenta con libros clínicos del Cerebro IA.',
          `SUGERENCIAS URGENTES DETECTADAS EN EL CENTRO (${urgentes.length} de ${pacientes.length} pacientes):
${urgentes.slice(0, 5).map(s => `- ${s.titulo}: ${s.descripcion}`).join('\n')}

Genera un RESUMEN EJECUTIVO para la directora del centro (2-3 oraciones). Qué patrón global ves y cuál es la prioridad de acción de esta semana.

CONOCIMIENTO CLÍNICO (Cerebro IA): ${_cerebroCtx || 'No disponible'}`,
          { model: GROQ_MODELS.FAST, temperature: 0.3, maxTokens: 200 }
        )
      } catch { /* no bloquear */ }
    }

    return NextResponse.json({
      sugerencias: todasSugerencias,
      total: todasSugerencias.length,
      urgentes: urgentes.length,
      pacientes_analizados: pacientes.length,
      insight_global: insightGlobal,
      timestamp: new Date().toISOString()
    })

  } catch (e: any) {
    console.error('❌ Error agente-sugerencias:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST: Marcar sugerencia como resuelta ────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { sugerenciaId, nota } = await req.json()
    await supabaseAdmin.from('sugerencias_terapeutas').update({
      resuelta: true,
      nota_resolucion: nota || null,
      resuelta_at: new Date().toISOString()
    }).eq('id', sugerenciaId)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
