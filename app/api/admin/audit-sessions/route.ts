// app/api/admin/audit-sessions/route.ts
// Endpoint diagnóstico: dado un child_id, muestra TODOS los registros en
// las tablas que pueden contar como "sesión" en stats. Sirve para localizar
// y limpiar registros fantasma cuando el conteo no coincide con lo agendado.
//
// GET  /api/admin/audit-sessions?child_id=XXX     → lista todos los registros
// POST /api/admin/audit-sessions { id, table }    → elimina un registro específico

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TABLAS_PERMITIDAS_DELETE = new Set([
  'appointments',
  'agenda_sesiones',
  'aba_sessions_v2',
  'registro_aba',
])

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')

  if (!childId) {
    return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
  }

  try {
    // Nombre del niño para el reporte
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, parent_id')
      .eq('id', childId)
      .maybeSingle()

    const [
      { data: appts },
      { data: agenda },
      { data: v2 },
      { data: legacy },
      { data: dataAba },
    ] = await Promise.all([
      supabaseAdmin
        .from('appointments')
        .select('id, appointment_date, appointment_time, status, service_type, created_at')
        .eq('child_id', childId)
        .order('appointment_date', { ascending: false }),

      supabaseAdmin
        .from('agenda_sesiones')
        .select('id, fecha, hora_inicio, hora_fin, estado, tipo, created_at')
        .eq('child_id', childId)
        .order('fecha', { ascending: false }),

      supabaseAdmin
        .from('aba_sessions_v2')
        .select('id, duration_minutes, created_at')
        .eq('child_id', childId)
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('registro_aba')
        .select('id, fecha_sesion, created_at')
        .eq('child_id', childId)
        .order('fecha_sesion', { ascending: false }),

      // Esta NO cuenta como sesión real pero la incluimos como referencia
      supabaseAdmin
        .from('sesiones_datos_aba')
        .select('id, programa_id, fecha, fase, set, porcentaje_exito, created_at')
        .in(
          'programa_id',
          (await supabaseAdmin.from('programas_aba').select('id').eq('child_id', childId)).data?.map((p: any) => p.id) || []
        )
        .order('fecha', { ascending: false }),
    ])

    // Resumen — cuántas filas tiene cada fuente
    const resumen = {
      child_id: childId,
      child_name: (child as any)?.name || 'Desconocido',
      appointments: { count: (appts || []).length, completados: (appts || []).filter((a: any) => ['completed','completada','realizada'].includes(a.status)).length },
      agenda_sesiones: { count: (agenda || []).length, realizadas: (agenda || []).filter((a: any) => ['realizada','completada','completed'].includes(a.estado)).length },
      aba_sessions_v2: { count: (v2 || []).length },
      registro_aba_legacy: { count: (legacy || []).length },
      sesiones_datos_aba_informativo: { count: (dataAba || []).length },
    }

    return NextResponse.json({
      resumen,
      detalle: {
        appointments: appts || [],
        agenda_sesiones: agenda || [],
        aba_sessions_v2: v2 || [],
        registro_aba: legacy || [],
        sesiones_datos_aba: dataAba || [],
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, table } = await req.json()

    if (!id || !table) {
      return NextResponse.json({ error: 'id y table requeridos' }, { status: 400 })
    }

    if (!TABLAS_PERMITIDAS_DELETE.has(table)) {
      return NextResponse.json({ error: `Tabla no permitida. Solo: ${[...TABLAS_PERMITIDAS_DELETE].join(', ')}` }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ ok: true, deleted: { id, table } })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
