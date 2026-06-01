// app/api/padre/stats/route.ts
// Endpoint que usa service_role para leer objetivos_cp y sesiones_datos_aba
// sin restricciones RLS — el cliente padre (anon key) no tiene acceso directo.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')

  if (!childId) {
    return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
  }

  try {
    // 0. Datos del niño — incluye `sessions_before_platform` para sumar al conteo
    const { data: childRow } = await supabaseAdmin
      .from('children')
      .select('sessions_before_platform')
      .eq('id', childId)
      .maybeSingle()
    const sesionesPrevias = Number((childRow as any)?.sessions_before_platform || 0)

    // 1. Programas ABA con objetivos_cp anidados (usando service_role)
    const { data: programas, error: errProg } = await supabaseAdmin
      .from('programas_aba')
      .select('id, titulo, area, estado, criterio_dominio_pct, objetivos_cp(id, descripcion, estado, numero_set)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })

    if (errProg) {
      console.error('[padre/stats] Error programas_aba:', errProg.message)
      // No fallar — devolver stats básicas vacías en lugar de 500
      return NextResponse.json({
        ok: true, totalSesiones: 0, totalGoals: 0, goalsAchieved: 0,
        masteryRate: 0, hoursTotal: 0, level: 'Inicial', programas: [],
        _debug: { error_programas: errProg.message }
      })
    }

    const progIds = (programas || []).map((p: any) => p.id)

    // 2. Sesiones por programa (sesiones_datos_aba — fuente del admin / Hub IA)
    const { data: sesionesRaw } = progIds.length
      ? await supabaseAdmin
          .from('sesiones_datos_aba')
          .select('id, programa_id, fecha, porcentaje_exito, objetivo_cp_id, oportunidades_totales, respuestas_correctas')
          .in('programa_id', progIds)
          .order('fecha', { ascending: true })
      : { data: [] as any[] }
    // Normalizar porcentaje_exito: calcularlo desde respuestas/oportunidades si está null
    const sesionesPrograma = (sesionesRaw || []).map((s: any) => ({
      ...s,
      porcentaje_exito: s.porcentaje_exito != null
        ? s.porcentaje_exito
        : (s.oportunidades_totales > 0
            ? Math.round((Number(s.respuestas_correctas) / Number(s.oportunidades_totales)) * 100)
            : null)
    }))

    // 3. Sesiones registro_aba (fuente legacy)
    const { data: registroAba } = await supabaseAdmin
      .from('registro_aba')
      .select('id, fecha_sesion')
      .eq('child_id', childId)

    // 4. Sesiones aba_sessions_v2
    const { data: sessionsV2 } = await supabaseAdmin
      .from('aba_sessions_v2')
      .select('id, duration_minutes')
      .eq('child_id', childId)

    // 5. Sesiones desde agenda_sesiones (estado realizada/completada)
    const { data: agendaSesiones } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('id, hora_inicio, hora_fin')
      .eq('child_id', childId)
      .in('estado', ['realizada', 'completada', 'completed'])

    // 6. Citas completadas desde appointments
    const { data: appointmentsCompleted } = await supabaseAdmin
      .from('appointments')
      .select('id')
      .eq('child_id', childId)
      .in('status', ['completed', 'realizada', 'completada'])

    // ── Calcular objetivos ─────────────────────────────────────
    const allObjetivos = (programas || []).flatMap((p: any) => p.objetivos_cp || [])
    const totalGoals = allObjetivos.length

    // Estrategia de dominio en cascada:
    //
    // NIVEL 1 — El set tiene estado === 'dominado' en objetivos_cp
    // NIVEL 2 — El programa padre tiene estado === 'dominado' (especialista marcó
    //           el programa completo via cambiar_fase, sin actualizar cada set)
    // NIVEL 3 — Las últimas 2+ sesiones de sesiones_datos_aba para ese set
    //           superan el criterio_dominio_pct del programa (≥80% por defecto)

    const criterioPorPrograma: Record<string, number> = {}
    for (const p of (programas || [])) {
      criterioPorPrograma[p.id] = (p as any).criterio_dominio_pct ?? 80
    }

    // mapa: objetivo_cp_id → lista de porcentajes ordenados cronológicamente
    const sesionesPorSet: Record<string, number[]> = {}
    for (const s of (sesionesPrograma || []) as any[]) {
      if (!s.objetivo_cp_id) continue
      if (!sesionesPorSet[s.objetivo_cp_id]) sesionesPorSet[s.objetivo_cp_id] = []
      sesionesPorSet[s.objetivo_cp_id].push(s.porcentaje_exito)
    }

    const programasDominados = new Set(
      (programas || []).filter((p: any) => p.estado === 'dominado').map((p: any) => p.id)
    )

    const programaPorObjetivo: Record<string, string> = {}
    for (const p of (programas || []) as any[]) {
      for (const o of (p.objetivos_cp || [])) {
        programaPorObjetivo[o.id] = p.id
      }
    }

    let goalsAchieved = 0
    for (const obj of allObjetivos) {
      const progId = programaPorObjetivo[obj.id]

      // Nivel 1
      if (obj.estado === 'dominado') { goalsAchieved++; continue }

      // Nivel 2
      if (progId && programasDominados.has(progId)) { goalsAchieved++; continue }

      // Nivel 3
      const criterio = criterioPorPrograma[progId] ?? 80
      const sesiones = sesionesPorSet[obj.id] || []
      if (sesiones.length >= 2 && sesiones.slice(-2).every((pct: number) => pct >= criterio)) {
        goalsAchieved++
        continue
      }
    }

    // Masteryrate: si no hay sets pero hay programas, usar proporción de programas dominados
    let masteryRate = 0
    if (totalGoals > 0) {
      masteryRate = Math.round((goalsAchieved / totalGoals) * 100)
    } else {
      const totalProg = (programas || []).length
      const domProg = (programas || []).filter((p: any) => p.estado === 'dominado').length
      masteryRate = totalProg > 0 ? Math.round((domProg / totalProg) * 100) : 0
    }

    // ── Conteo de sesiones REALES de terapia ──────────────────
    // IMPORTANTE: hay dos conceptos distintos que antes se mezclaban:
    //  1. Sesiones REALES de terapia → agenda_sesiones / appointments completados / aba_sessions_v2
    //  2. Registros de DATOS ABA → filas en sesiones_datos_aba (puede haber varias por sesión real,
    //     una por cada programa trabajado en la misma sesión)
    //
    // El stat "Sesiones" del dashboard del padre debe reflejar SESIONES REALES, no registros.
    // De lo contrario un centro con 4 programas y 1 sesión real puede mostrar "4 sesiones".

    const sesionesDesdeRegistro      = registroAba?.length || 0          // legacy — NO se cuenta
    const sesionesDesdeAgenda        = agendaSesiones?.length || 0
    const sesionesDesdeAppointments  = appointmentsCompleted?.length || 0
    const sesionesDesdeV2            = sessionsV2?.length || 0
    const sesionesDesdePrograma      = sesionesPrograma?.length || 0     // registros de datos, no sesiones

    // Total = MAX entre las fuentes ACTUALES de citas/sesiones:
    //  - appointments (módulo Agenda actual del admin)
    //  - agenda_sesiones (sesiones formales registradas)
    //  - aba_sessions_v2 (registro de sesión ABA nueva versión)
    //
    // EXCLUIMOS `registro_aba` (tabla legacy del sistema viejo). Esa tabla puede
    // contener filas de pruebas antiguas que ya no representan citas reales y
    // genera "sesiones fantasma" en el portal del padre. Si se necesita rescatar
    // datos históricos de ahí, se hace una migración explícita a las tablas nuevas.
    // Sesiones reales registradas en la plataforma
    const sesionesEnPlataforma = Math.max(
      sesionesDesdeAgenda,
      sesionesDesdeAppointments,
      sesionesDesdeV2
    )
    // Total mostrado al padre = previas históricas (configuradas en admin) + las reales en plataforma
    const totalSesiones = sesionesPrevias + sesionesEnPlataforma

    // ── Horas totales — SOLO de fuentes reales con duración medible ──
    // Si no hay ninguna sesión real registrada, las horas son 0 (no extrapolar
    // desde registros de datos, eso producía "4.5h sin sesiones" engañosas).
    const minutosAgenda = (agendaSesiones || []).reduce((sum: number, s: any) => {
      if (s.hora_inicio && s.hora_fin) {
        const [h1, m1] = s.hora_inicio.split(':').map(Number)
        const [h2, m2] = s.hora_fin.split(':').map(Number)
        return sum + Math.max(0, (h2 * 60 + m2) - (h1 * 60 + m1))
      }
      return sum + 45
    }, 0)

    const minutosV2 = (sessionsV2 || []).reduce(
      (s: number, x: any) => s + (x.duration_minutes || 45), 0
    )

    // Si hay appointments completados pero no tienen duración, estimar 45 min cada uno
    const minutosAppts = sesionesDesdeAppointments * 45

    // Tomar el mayor de las fuentes reales (no se acumulan porque pueden solaparse)
    const totalMinutes = Math.max(minutosV2, minutosAgenda, minutosAppts)
    const hoursTotal = Math.round((totalMinutes / 60) * 10) / 10

    // ── Nivel basado en sesiones ──────────────────────────────
    let level = 'Inicial'
    if (totalSesiones >= 50) level = 'Avanzado'
    else if (totalSesiones >= 20) level = 'Intermedio'
    else if (totalSesiones >= 5) level = 'Básico'

    // ── Programas simplificados para UI ──────────────────────
    const programasUI = (programas || []).map((p: any) => ({
      id: p.id,
      nombre: p.titulo,
      area: p.area,
      estado: p.estado,
    }))

    return NextResponse.json({
      ok: true,
      totalSesiones,                                    // Previas + en-plataforma (visible al padre)
      sesionesPrevias,                                  // Configuradas manualmente por el admin
      sesionesEnPlataforma,                             // Detectadas desde appointments/agenda
      registrosDatos: sesionesDesdePrograma,            // Registros de datos ABA (informativo)
      totalGoals,
      goalsAchieved,
      masteryRate,
      hoursTotal,
      level,
      programas: programasUI,
      _debug: {
        child_id_recibido: childId,
        programas_encontrados: (programas || []).length,
        prog_ids: progIds,
        sesiones_previas_manuales: sesionesPrevias,
        registro_aba: sesionesDesdeRegistro,
        aba_sessions_v2: sesionesDesdeV2,
        sesiones_datos_aba_filas_total: sesionesPrograma?.length ?? 0,
        agenda_sesiones: sesionesDesdeAgenda,
        appointments_completed: sesionesDesdeAppointments,
        total_sesiones_final: totalSesiones,
        total_objetivos: totalGoals,
        dominados_n1_estado: allObjetivos.filter((o: any) => o.estado === 'dominado').length,
        dominados_n2_prog: [...programasDominados].length,
        dominados_final: goalsAchieved,
      },
    })
  } catch (e: any) {
    console.error('[padre/stats] Error inesperado:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
