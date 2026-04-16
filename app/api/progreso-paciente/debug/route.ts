import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const childId = new URL(request.url).searchParams.get('child_id')
  if (!childId) return NextResponse.json({ error: 'child_id requerido' })

  // Query 1: con filtro child_id (como hace la API)
  const { data: conFiltro } = await supabaseAdmin
    .from('registro_aba')
    .select('id, fecha_sesion, child_id')
    .eq('child_id', childId)
    .limit(10)

  // Query 2: SIN filtro — ver todas las sesiones y sus child_id reales
  const { data: sinFiltro } = await supabaseAdmin
    .from('registro_aba')
    .select('id, fecha_sesion, child_id')
    .order('fecha_sesion', { ascending: false })
    .limit(20)

  // Query 3: sesiones con child_id NULL
  const { data: sinChildId } = await supabaseAdmin
    .from('registro_aba')
    .select('id, fecha_sesion, child_id')
    .is('child_id', null)
    .limit(10)

  // Query 4: children table
  const { data: children } = await supabaseAdmin
    .from('children')
    .select('id, name')
    .limit(20)

  return NextResponse.json({
    child_id_buscado: childId,
    sesiones_con_ese_child_id: conFiltro?.length || 0,
    todas_las_sesiones_recientes: sinFiltro?.map((s:any) => ({
      id: s.id,
      fecha: s.fecha_sesion,
      child_id: s.child_id,
      mismo_child: s.child_id === childId,
    })),
    sesiones_sin_child_id: sinChildId?.length || 0,
    todos_los_children: children?.map((c:any) => ({ id: c.id, name: c.name })),
  })
}
