// app/api/programas-aba/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  const programaId = searchParams.get('id')

  try {
    if (programaId) {
      // Obtener programa con sus sets y sesiones
      const { data, error } = await supabaseAdmin
        .from('programas_aba')
        .select(`
          *,
          objetivos_cp(*),
          sesiones_datos_aba(*, objetivo_cp_id),
          cambios_fase_aba(*)
        `)
        .eq('id', programaId)
        .order('objetivos_cp.numero_set', { ascending: true })
        .order('sesiones_datos_aba.fecha', { ascending: true })
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    if (childId) {
      const { data, error } = await supabaseAdmin
        .from('programas_aba')
        .select(`
          *,
          objetivos_cp(*),
          sesiones_datos_aba(fecha, porcentaje_exito, frecuencia_valor, duracion_segundos, fase)
        `)
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Se requiere child_id o id' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'crear_programa') {
      const { programa, objetivos } = body
      const { data: prog, error } = await supabaseAdmin
        .from('programas_aba')
        .insert(programa)
        .select()
        .single()
      if (error) throw error

      // Insertar objetivos CP si vienen
      if (objetivos && objetivos.length > 0) {
        const objConId = objetivos.map((o: any, i: number) => ({
          ...o, programa_id: (prog as any).id, numero_set: i + 1,
        }))
        await supabaseAdmin.from('objetivos_cp').insert(objConId)
      }
      return NextResponse.json({ data: prog })
    }

    if (action === 'registrar_sesion') {
      const { sesion } = body
      // Calcular porcentaje_exito si no viene explícito pero hay oportunidades/respuestas
      const sesionConPct = { ...sesion }
      if (sesionConPct.porcentaje_exito == null && sesionConPct.oportunidades_totales > 0) {
        sesionConPct.porcentaje_exito = Math.round(
          (Number(sesionConPct.respuestas_correctas) / Number(sesionConPct.oportunidades_totales)) * 100
        )
      }
      const { data, error } = await supabaseAdmin
        .from('sesiones_datos_aba')
        .insert(sesionConPct)
        .select()
        .single()
      if (error) throw error

      // Verificar si se alcanzó el criterio de dominio
      await verificarCriterioDominio((sesion as any).programa_id)

      return NextResponse.json({ data })
    }

    if (action === 'actualizar_objetivo') {
      const { objetivo_id, estado } = body
      const ESTADOS_VALIDOS = ['pendiente', 'en_progreso', 'dominado']
      if (!objetivo_id || !ESTADOS_VALIDOS.includes(estado)) {
        return NextResponse.json({ error: 'objetivo_id y estado válido requeridos' }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('objetivos_cp')
        .update({ estado, ...(estado === 'dominado' ? { fecha_dominio: new Date().toISOString().split('T')[0] } : {}) })
        .eq('id', objetivo_id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    if (action === 'cambiar_fase') {
      const { programa_id, child_id, fase_nueva, motivo, fase_anterior } = body
      const [cambio] = await Promise.all([
        supabaseAdmin.from('cambios_fase_aba').insert({
          programa_id, child_id, fase_nueva, fase_anterior, motivo,
        }).select().single(),
        supabaseAdmin.from('programas_aba').update({
          fase_actual: fase_nueva,
          ...(fase_nueva === 'dominado' ? { estado: 'dominado', fecha_dominio: new Date().toISOString().split('T')[0] } : {}),
        }).eq('id', programa_id),
      ])

      // Si el programa pasa a dominado, marcar también todos sus sets (objetivos_cp)
      // Esto garantiza que el contador del Hub IA sea siempre correcto (nivel 1)
      if (fase_nueva === 'dominado') {
        await supabaseAdmin
          .from('objetivos_cp')
          .update({ estado: 'dominado' })
          .eq('programa_id', programa_id)
          .neq('estado', 'dominado') // evitar escrituras innecesarias
      }

      return NextResponse.json({ data: cambio.data })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body
    const { data, error } = await supabaseAdmin
      .from('programas_aba')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Verificar si se cumplió el criterio de dominio automáticamente
async function verificarCriterioDominio(programaId: string) {
  try {
    const { data: prog } = await supabaseAdmin
      .from('programas_aba')
      .select('criterio_dominio_pct, criterio_sesiones_consecutivas, fase_actual, titulo, child_id')
      .eq('id', programaId)
      .single()
    if (!prog || (prog as any).fase_actual !== 'intervencion') return

    const { data: sesionesRaw } = await supabaseAdmin
      .from('sesiones_datos_aba')
      .select('porcentaje_exito, oportunidades_totales, respuestas_correctas')
      .eq('programa_id', programaId)
      .order('fecha', { ascending: false })
      .limit((prog as any).criterio_sesiones_consecutivas)

    if (!sesionesRaw || sesionesRaw.length < (prog as any).criterio_sesiones_consecutivas) return

    // Normalizar porcentaje_exito
    const sesiones = (sesionesRaw as any[]).map(s => ({
      porcentaje_exito: s.porcentaje_exito != null
        ? s.porcentaje_exito
        : (s.oportunidades_totales > 0
            ? Math.round((Number(s.respuestas_correctas) / Number(s.oportunidades_totales)) * 100)
            : 0)
    }))

    const cumpleCriterio = sesiones.every(
      s => s.porcentaje_exito >= (prog as any).criterio_dominio_pct
    )

    if (cumpleCriterio) {
      // Crear alerta de dominio alcanzado
      await supabaseAdmin.from('agente_alertas').insert({
        child_id: (prog as any).child_id,
        programa_id: programaId,
        tipo: 'criterio_alcanzado',
        titulo: `✅ Criterio dominado: "${(prog as any).titulo}"`,
        mensaje: `Se alcanzó el criterio de ${(prog as any).criterio_dominio_pct}% en ${(prog as any).criterio_sesiones_consecutivas} sesiones consecutivas. Considera pasar a mantenimiento.`,
        prioridad: 'alta',
      })
    }
  } catch (e) { /* silencioso */ }
}
