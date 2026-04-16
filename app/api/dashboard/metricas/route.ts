// app/api/dashboard/metricas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') || '7d' // 7d | 30d | 90d
  const hoy = new Date().toISOString().split('T')[0]

  // Calcular rango de fechas
  const diasAtras = periodo === '30d' ? 30 : periodo === '90d' ? 90 : 7
  const fechaInicio = new Date()
  fechaInicio.setDate(fechaInicio.getDate() - diasAtras)
  const fechaInicioStr = fechaInicio.toISOString().split('T')[0]

  try {
    // ── SESIONES HOY ─────────────────────────────────────────
    const { data: sesionesHoy } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('id, estado, hora_inicio, hora_fin, tipo')
      .eq('fecha', hoy)

    const totalHoy       = sesionesHoy?.length || 0
    const realizadasHoy  = sesionesHoy?.filter(s => s.estado === 'realizada').length || 0
    const canceladasHoy  = sesionesHoy?.filter(s => s.estado === 'cancelada').length || 0
    const programadasHoy = sesionesHoy?.filter(s => s.estado === 'programada' || s.estado === 'confirmada').length || 0

    // ── PACIENTES ────────────────────────────────────────────
    const { count: totalPacientes } = await supabaseAdmin
      .from('children')
      .select('*', { count: 'exact', head: true })

    // Pacientes nuevos este mes
    const inicioMes = new Date()
    inicioMes.setDate(1)
    const { count: pacientesNuevosMes } = await supabaseAdmin
      .from('children')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', inicioMes.toISOString())

    // ── ALERTAS ──────────────────────────────────────────────
    const { data: alertas } = await supabaseAdmin
      .from('agente_alertas')
      .select('id, prioridad, tipo, created_at')
      .eq('resuelta', false)
      .order('prioridad', { ascending: true })
      .limit(100)

    const alertasUrgentes = alertas?.filter(a => a.prioridad === 1).length || 0
    const alertasTotal    = alertas?.length || 0

    // ── SESIONES DEL PERIODO ──────────────────────────────────
    const { data: sesionesPeriodo } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('fecha, estado')
      .gte('fecha', fechaInicioStr)
      .lte('fecha', hoy)

    // Agrupar por fecha para gráfico
    const porFecha: Record<string, { total: number; realizadas: number; canceladas: number }> = {}
    sesionesPeriodo?.forEach(s => {
      if (!porFecha[s.fecha]) porFecha[s.fecha] = { total: 0, realizadas: 0, canceladas: 0 }
      porFecha[s.fecha].total++
      if (s.estado === 'realizada')  porFecha[s.fecha].realizadas++
      if (s.estado === 'cancelada')  porFecha[s.fecha].canceladas++
    })
    const graficaSesiones = Object.entries(porFecha).map(([fecha, data]) => ({ fecha, ...data }))

    // ── TAREAS HOGAR ─────────────────────────────────────────
    const { data: tareas } = await supabaseAdmin
      .from('tareas_hogar')
      .select('id, completada, fecha_asignada')
      .eq('activa', true)
      .gte('fecha_asignada', fechaInicioStr)

    const tareasTotal       = tareas?.length || 0
    const tareasCompletadas = tareas?.filter(t => t.completada).length || 0
    const tareasCompletitudPct = tareasTotal > 0 ? Math.round((tareasCompletadas / tareasTotal) * 100) : 0

    // ── FORMULARIOS PENDIENTES ────────────────────────────────
    const { count: formPendientes } = await supabaseAdmin
      .from('parent_forms')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // ── PROGRESO PROMEDIO PACIENTES ───────────────────────────
    const { data: ultimasSesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('datos')
      .gte('fecha_sesion', fechaInicioStr)
      .limit(50)

    let sumaLogro = 0
    let countLogro = 0
    ultimasSesiones?.forEach(s => {
      const logro = s.datos?.nivel_logro_objetivos
      if (logro) {
        const valor = logro.includes('76') || logro.includes('Completamente') ? 90
          : logro.includes('51') || logro.includes('Mayormente') ? 70
          : logro.includes('26') || logro.includes('Parcialmente') ? 50 : 25
        sumaLogro += valor
        countLogro++
      }
    })
    const progresoPromedio = countLogro > 0 ? Math.round(sumaLogro / countLogro) : 0

    // ── PRÓXIMAS SESIONES ─────────────────────────────────────
    const { data: proximasSesiones } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('*, children(name, diagnosis)')
      .gte('fecha', hoy)
      .in('estado', ['programada', 'confirmada'])
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .limit(5)

    // ── ALERTAS RECIENTES DETALLADAS ──────────────────────────
    const { data: alertasRecientes } = await supabaseAdmin
      .from('agente_alertas')
      .select('*, children(name)')
      .eq('resuelta', false)
      .order('prioridad', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(5)

    // ── TERAPEUTAS CON CARGA HOY ──────────────────────────────
    const { data: terapeutasCarga } = await supabaseAdmin
      .from('agenda_sesiones')
      .select('terapeuta_id, estado')
      .eq('fecha', hoy)

    const cargaTerapeutas: Record<string, { total: number; realizadas: number }> = {}
    terapeutasCarga?.forEach(s => {
      if (!cargaTerapeutas[s.terapeuta_id]) cargaTerapeutas[s.terapeuta_id] = { total: 0, realizadas: 0 }
      cargaTerapeutas[s.terapeuta_id].total++
      if (s.estado === 'realizada') cargaTerapeutas[s.terapeuta_id].realizadas++
    })

    // ── INGRESOS DEL MES ──────────────────────────────────────
    const { data: ingresosMes } = await supabaseAdmin
      .from('facturas')
      .select('monto, estado')
      .gte('fecha_emision', inicioMes.toISOString().split('T')[0])
      .eq('estado', 'pagado')

    const totalIngresosMes = ingresosMes?.reduce((acc, f) => acc + Number(f.monto), 0) || 0
    const facturasPendientes = await supabaseAdmin
      .from('facturas')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'pendiente')

    return NextResponse.json({
      // Resumen del día
      hoy: {
        fecha: hoy,
        sesiones: { total: totalHoy, realizadas: realizadasHoy, canceladas: canceladasHoy, programadas: programadasHoy },
        tasaAsistencia: totalHoy > 0 ? Math.round(((realizadasHoy + programadasHoy) / totalHoy) * 100) : 100
      },
      // Pacientes
      pacientes: {
        total: totalPacientes || 0,
        nuevosMes: pacientesNuevosMes || 0,
        progresoPromedio
      },
      // Alertas
      alertas: {
        total: alertasTotal,
        urgentes: alertasUrgentes,
        recientes: alertasRecientes
      },
      // Tareas
      tareas: {
        total: tareasTotal,
        completadas: tareasCompletadas,
        completitudPct: tareasCompletitudPct,
        formPendientes: formPendientes || 0
      },
      // Financiero
      financiero: {
        ingresosMes: totalIngresosMes,
        facturasPendientes: facturasPendientes.count || 0
      },
      // Para gráficos
      graficas: {
        sesionesXFecha: graficaSesiones,
        cargaTerapeutas: Object.entries(cargaTerapeutas).map(([id, data]) => ({ terapeutaId: id, ...data }))
      },
      // Próximas citas
      proximasSesiones: proximasSesiones || []
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
