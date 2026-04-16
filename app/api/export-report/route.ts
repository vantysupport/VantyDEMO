// app/api/export-report/route.ts
// Genera un reporte HTML completo del paciente que el frontend convierte a PDF
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getChildHistory } from '@/lib/child-history'

export async function POST(req: NextRequest) {
  try {
    const { childId, analyticsData, locale } = await req.json()
    const userLocale = locale || req.headers.get('x-locale') || 'es'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    // Cargar datos completos del paciente
    const history = await getChildHistory(childId)

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis, status')
      .eq('id', childId)
      .single()

    // Programas ABA activos
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('titulo, area, estado, fase_actual, criterio_dominio_pct')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(10)

    // Últimas 5 sesiones ABA
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(5)

    // Alertas activas
    const { data: alertas } = await supabaseAdmin
      .from('agente_alertas')
      .select('tipo, titulo, mensaje, prioridad')
      .eq('child_id', childId)
      .eq('resuelta', false)
      .order('prioridad', { ascending: true })
      .limit(5)

    return NextResponse.json({
      success: true,
      paciente: {
        nombre: (child as any)?.name || history.nombre,
        edad: history.edad,
        diagnostico: (child as any)?.diagnosis || history.diagnostico,
        estado: (child as any)?.status || 'En tratamiento',
      },
      programas: programas || [],
      sesiones: sesiones || [],
      alertas: alertas || [],
      analytics: analyticsData,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
