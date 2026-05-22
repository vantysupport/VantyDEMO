// app/api/agente/refrescar-alertas/route.ts
// Endpoint rápido (sin IA) que regenera alertas de programas ABA para uno o todos los niños.
// Lo invoca el dashboard al cargar para mantener los logros y alertas siempre frescos.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AlertaGenerada {
  child_id: string
  tipo: string
  titulo: string
  mensaje: string
  programa_id?: string
  prioridad: string
}

// Pendiente por regresión lineal — % por sesión
function slopeLineal(ys: number[]): number {
  const n = ys.length
  if (n < 2) return 0
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  ys.forEach((y, i) => {
    const x = i + 1
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x
  })
  const denom = n * sumXX - sumX * sumX
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
}

function calcularTendencia(sesiones: any[]) {
  const validas = (sesiones || []).filter(
    s => typeof s.porcentaje_exito === 'number' && !isNaN(s.porcentaje_exito)
  )
  if (validas.length < 2) {
    return { tendencia: 'insuficiente' as const, n: validas.length }
  }
  const ventana = validas.slice(-Math.min(6, validas.length))
  const valores = ventana.map(s => s.porcentaje_exito as number)
  const n = valores.length
  const promReciente = valores.reduce((a, b) => a + b, 0) / n
  const promAnterior = validas.length > n
    ? (() => {
        const ant = validas.slice(-2 * n, -n).map(s => s.porcentaje_exito as number)
        return ant.length > 0 ? ant.reduce((a, b) => a + b, 0) / ant.length : promReciente
      })()
    : promReciente
  const slope = Math.round(slopeLineal(valores) * 10) / 10
  let tendencia: 'mejorando' | 'regresion' | 'estable'
  if (slope > 1.5) tendencia = 'mejorando'
  else if (slope < -1.5) tendencia = 'regresion'
  else tendencia = 'estable'
  return {
    promedio_reciente: Math.round(promReciente),
    promedio_anterior: Math.round(promAnterior),
    cambio: Math.round(promReciente - promAnterior),
    slope,
    n_sesiones_analizadas: n,
    tendencia,
  }
}

// Helper: slug seguro para usar como sufijo de tipo de alerta (sets pueden tener
// nombres como "Set 1", "Conjunto A", etc.)
function slugSet(setName: string): string {
  return setName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'main'
}

async function generarAlertasParaNiño(childId: string): Promise<AlertaGenerada[]> {
  const alertas: AlertaGenerada[] = []

  // FIX clínico: traer también los objetivos_cp (sets) para conocer su estado
  // (pendiente / en_progreso / dominado). Esto permite:
  //  1. Analizar SOLO los sets no-dominados (no perder tiempo con sets cerrados)
  //  2. Marcar el programa como logrado SOLO cuando TODOS sus sets están dominados
  const { data: programas } = await supabaseAdmin
    .from('programas_aba')
    .select(`
      id, titulo, criterio_dominio_pct, criterio_sesiones_consecutivas, estado,
      objetivos_cp ( id, numero_set, descripcion, estado )
    `)
    .eq('child_id', childId)

  if (!programas || programas.length === 0) return alertas

  const programaIds = (programas as any[]).map(p => p.id)
  const { data: todasSesiones } = await supabaseAdmin
    .from('sesiones_datos_aba')
    .select('programa_id, fecha, porcentaje_exito, fase, set')
    .in('programa_id', programaIds)
    .order('fecha', { ascending: true })

  const sesionesPorPrograma: Record<string, any[]> = {}
  for (const s of (todasSesiones || []) as any[]) {
    if (!sesionesPorPrograma[s.programa_id]) sesionesPorPrograma[s.programa_id] = []
    sesionesPorPrograma[s.programa_id].push(s)
  }

  for (const prog of programas as any[]) {
    const sesionesAll = sesionesPorPrograma[prog.id] || []
    const sesionesIntervencion = sesionesAll.filter((s: any) => s.fase !== 'linea_base')
    const criterio = prog.criterio_dominio_pct || 90
    const nConsecutivas = Number(prog.criterio_sesiones_consecutivas) || 2

    // ── Mapa nombre-de-set → estado del set ──
    // Sets se identifican en sesiones_datos_aba.set como "Set 1", "Set 2", etc.
    // En objetivos_cp tienen numero_set. Hacemos matching por la convención común.
    const setsDefinidos: { nombre: string; estado: string }[] = (prog.objetivos_cp || [])
      .map((o: any) => ({
        nombre: o.numero_set ? `Set ${o.numero_set}` : (o.descripcion || '').slice(0, 20),
        estado: o.estado || 'pendiente',
      }))
    const setEstadoMap: Record<string, string> = {}
    for (const s of setsDefinidos) setEstadoMap[s.nombre] = s.estado

    // ── Agrupar sesiones por set ──
    const sesionesPorSet: Record<string, any[]> = {}
    for (const s of sesionesIntervencion) {
      const setKey = s.set || '__sin_set__'
      if (!sesionesPorSet[setKey]) sesionesPorSet[setKey] = []
      sesionesPorSet[setKey].push(s)
    }

    // ── Analizar CADA set no-dominado con sesiones (sets en paralelo) ──
    // Los terapeutas pueden trabajar varios sets a la vez, así que iteramos todos
    // los que estén activos (no dominados) y tengan datos.
    const setsParaAnalizar = Object.keys(sesionesPorSet).filter(setKey => {
      const estadoSet = setEstadoMap[setKey] || 'en_progreso'  // si no está en objetivos_cp, asumir activo
      return estadoSet !== 'dominado' && sesionesPorSet[setKey].length >= 1
    })

    for (const setNombre of setsParaAnalizar) {
      const sesionesSet = sesionesPorSet[setNombre]
      const etiquetaSet = setNombre !== '__sin_set__' ? ` (${setNombre})` : ''
      const setSlug = slugSet(setNombre)

      const tendencia = sesionesSet.length >= 2
        ? calcularTendencia(sesionesSet)
        : { tendencia: 'insuficiente' as const, slope: 0, promedio_reciente: 0, promedio_anterior: 0, cambio: 0, n_sesiones_analizadas: 0, n: sesionesSet.length }
      const slope = tendencia.slope ?? 0
      const nAnalizadas = tendencia.n_sesiones_analizadas ?? sesionesSet.length

      // ── LOGROS POSITIVOS por set ──
      const criterioAlcanzado =
        sesionesSet.length >= nConsecutivas &&
        sesionesSet.slice(-nConsecutivas).every((s: any) => (s.porcentaje_exito ?? 0) >= criterio)

      if (criterioAlcanzado) {
        const ultimas = sesionesSet.slice(-nConsecutivas)
        const promUlt = Math.round(ultimas.reduce((a: number, s: any) => a + s.porcentaje_exito, 0) / ultimas.length)
        alertas.push({
          child_id: childId,
          tipo: `logro_dominio_${prog.id}_${setSlug}`,
          titulo: `🎯 Criterio alcanzado en "${prog.titulo}"${etiquetaSet}`,
          mensaje: `${nConsecutivas} sesiones consecutivas cumpliendo criterio de ${criterio}% (promedio ${promUlt}%)${etiquetaSet}. Considera marcar el set como dominado y continuar con los demás.`,
          prioridad: 'baja',
          programa_id: prog.id,
        })
      }
      else if (
        nConsecutivas >= 2 &&
        sesionesSet.length >= nConsecutivas - 1 &&
        sesionesSet.slice(-(nConsecutivas - 1)).every((s: any) => (s.porcentaje_exito ?? 0) >= criterio)
      ) {
        const ultima = sesionesSet[sesionesSet.length - 1]
        alertas.push({
          child_id: childId,
          tipo: `logro_cerca_dominio_${prog.id}_${setSlug}`,
          titulo: `⚡ Falta 1 sesión para dominar "${prog.titulo}"${etiquetaSet}`,
          mensaje: `Última sesión al ${ultima?.porcentaje_exito}% cumpliendo criterio (${criterio}%)${etiquetaSet}. Una sesión más en el criterio confirma el dominio del set.`,
          prioridad: 'baja',
          programa_id: prog.id,
        })
      }
      else if (
        sesionesSet.length >= 5 &&
        slope >= 5 &&
        (tendencia.promedio_reciente || 0) >= 60
      ) {
        alertas.push({
          child_id: childId,
          tipo: `logro_progreso_${prog.id}_${setSlug}`,
          titulo: `📈 Progreso consistente en "${prog.titulo}"${etiquetaSet}`,
          mensaje: `Tendencia ascendente clara dentro del set${etiquetaSet}: +${slope}% por sesión, promedio ${tendencia.promedio_reciente}% sobre las últimas ${nAnalizadas} sesiones. Buen avance hacia el criterio de ${criterio}%.`,
          prioridad: 'baja',
          programa_id: prog.id,
        })
      }

      // ── REGRESIÓN dentro del set ──
      if (
        sesionesSet.length >= 2 &&
        tendencia.tendencia === 'regresion' &&
        (tendencia.cambio || 0) < -10
      ) {
        alertas.push({
          child_id: childId,
          tipo: `regresion_${prog.id}_${setSlug}`,
          titulo: `Regresión en "${prog.titulo}"${etiquetaSet}`,
          mensaje: `Dentro del set${etiquetaSet}, el % bajó ${Math.abs(tendencia.cambio || 0)} puntos (${tendencia.promedio_anterior}% → ${tendencia.promedio_reciente}%, pendiente ${slope}%/sesión). Revisar antecedentes y reforzadores.`,
          prioridad: 'alta',
          programa_id: prog.id,
        })
      }

      // ── ESTANCAMIENTO dentro del set ──
      if (
        !criterioAlcanzado &&
        sesionesSet.length >= 5 &&
        tendencia.tendencia === 'estable' &&
        (tendencia.promedio_reciente || 0) < Math.min(70, criterio - 10)
      ) {
        alertas.push({
          child_id: childId,
          tipo: `estancamiento_${prog.id}_${setSlug}`,
          titulo: `Estancamiento en "${prog.titulo}"${etiquetaSet}`,
          mensaje: `${sesionesSet.length} sesiones en el set${etiquetaSet} sin mejora estadística (pendiente ${slope >= 0 ? '+' : ''}${slope}%/sesión, promedio ${tendencia.promedio_reciente}%, criterio ${criterio}%). Considera revisar procedimiento o nivel de ayuda.`,
          prioridad: 'media',
          programa_id: prog.id,
        })
      }
    }

    // ── PROGRAMA LOGRADO COMPLETO: TODOS los sets dominados ──
    // Solo emite la alerta de "programa logrado" si:
    //  · el programa tiene al menos 1 set definido
    //  · TODOS los sets están en estado 'dominado'
    // No depende de las sesiones, depende del estado manual del set en objetivos_cp.
    const totalSets = setsDefinidos.length
    const setsDominados = setsDefinidos.filter(s => s.estado === 'dominado').length
    if (totalSets > 0 && totalSets === setsDominados) {
      alertas.push({
        child_id: childId,
        tipo: `logro_programa_${prog.id}`,
        titulo: `🏆 Programa dominado: "${prog.titulo}"`,
        mensaje: `Los ${totalSets} sets del programa están marcados como dominados. Considera pasar el programa a mantenimiento o cerrarlo y continuar con uno nuevo.`,
        prioridad: 'baja',
        programa_id: prog.id,
      })
    }

    // ── SIN SESIÓN reciente (a nivel programa, no por set) ──
    const ultimaFecha = sesionesAll[sesionesAll.length - 1]?.fecha
    if (ultimaFecha) {
      const diasSinSesion = Math.floor((Date.now() - new Date(ultimaFecha).getTime()) / 86400000)
      if (diasSinSesion >= 7) {
        alertas.push({
          child_id: childId,
          tipo: `sin_sesion_${prog.id}`,
          titulo: `Sin sesión hace ${diasSinSesion} días — "${prog.titulo}"`,
          mensaje: `El programa no ha tenido sesiones en ${diasSinSesion} días. Verificar si hay ausencia del paciente o cambio de prioridades.`,
          prioridad: diasSinSesion >= 14 ? 'alta' : 'baja',
          programa_id: prog.id,
        })
      }
    }
  }

  return alertas
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const childId: string | undefined = body?.child_id

    // Lista de niños a procesar: uno específico o todos
    let childIds: string[] = []
    if (childId) {
      childIds = [childId]
    } else {
      const { data: children } = await supabaseAdmin.from('children').select('id')
      childIds = (children || []).map((c: any) => c.id)
    }

    let totalAlertas = 0
    let totalAlertasResueltas = 0

    for (const cid of childIds) {
      // 1. Calcular las alertas que aplican actualmente
      const nuevasAlertas = await generarAlertasParaNiño(cid)
      const tiposActuales = new Set(nuevasAlertas.map(a => a.tipo))

      // 2. Resolver alertas pre-existentes (de programa) que YA NO aplican
      //    Esto cubre el caso: programa estaba estancado → ahora mejoró → cerrar la alerta vieja
      const { data: existentes } = await supabaseAdmin
        .from('agente_alertas')
        .select('id, tipo')
        .eq('child_id', cid)
        .eq('resuelta', false)

      // Resolver:
      //  (a) alertas legacy sin suffix de programa
      //  (b) alertas con suffix de programa (o programa+set) que ya no aplican
      //      Esto incluye: regresion_<prog>, regresion_<prog>_<set>, logro_dominio_<prog>_<set>, etc.
      //      Cuando un set se marca como dominado o se agrega un set nuevo, las alertas viejas
      //      del set anterior (o de la combinación anterior) desaparecen del set tiposActuales
      //      y deben resolverse automáticamente.
      const aResolver = (existentes || [])
        .filter((e: any) => {
          const t = String(e.tipo || '')
          // Legacy sin suffix → siempre resolver
          const esLegacy = ['sin_sesion', 'regresion', 'estancamiento', 'criterio_alcanzado'].includes(t)
          if (esLegacy) return true
          // Cualquier alerta con prefijo de regla — resolver si ya no está en tiposActuales
          const esDeRegla = /^(logro_|regresion_|estancamiento_|sin_sesion_)/.test(t)
          return esDeRegla && !tiposActuales.has(t)
        })
        .map((e: any) => e.id)

      if (aResolver.length > 0) {
        await supabaseAdmin
          .from('agente_alertas')
          .update({ resuelta: true })
          .in('id', aResolver)
        totalAlertasResueltas += aResolver.length
      }

      // 3. Upsert de las alertas nuevas (no duplica si ya existe la misma tipo+child)
      if (nuevasAlertas.length > 0) {
        for (const alerta of nuevasAlertas) {
          const { data: yaExiste } = await supabaseAdmin
            .from('agente_alertas')
            .select('id')
            .eq('child_id', alerta.child_id)
            .eq('tipo', alerta.tipo)
            .eq('resuelta', false)
            .maybeSingle()
          if (!yaExiste) {
            await supabaseAdmin.from('agente_alertas').insert({ ...alerta, resuelta: false })
            totalAlertas++
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      pacientes_procesados: childIds.length,
      alertas_creadas: totalAlertas,
      alertas_resueltas: totalAlertasResueltas,
    })
  } catch (error: any) {
    console.error('[refrescar-alertas] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
