import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET /api/admin/children — lista todos los pacientes usando service role (bypassa RLS)
export async function GET() {
  try {
    // Try full select first
    let { data, error } = await supabaseAdmin
      .from('children')
      .select('id, name, diagnosis, age, birth_date, parent_id, created_at')
      .order('name')

    // If error due to missing columns, fallback to minimal select
    if (error) {
      const fallback = await supabaseAdmin
        .from('children')
        .select('id, name, parent_id')
        .order('name')
      if (fallback.error) throw fallback.error
      data = fallback.data as any[]
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, data: [] }, { status: 200 })
  }
}

// PATCH /api/admin/children — actualiza parent_id + sincroniza parent_accounts
export async function PATCH(req: NextRequest) {
  try {
    const { childId, parentId } = await req.json()
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    // 1. Actualizar parent_id en children
    const { error } = await supabaseAdmin
      .from('children')
      .update({ parent_id: parentId ?? null })
      .eq('id', childId)
    if (error) throw error

    // 2. Sincronizar parent_accounts automáticamente
    if (parentId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('full_name, phone, email')
        .eq('id', parentId)
        .maybeSingle()

      await supabaseAdmin
        .from('parent_accounts')
        .upsert({
          user_id:         parentId,
          child_id:        childId,
          nombre:          (profile as any)?.full_name || 'Padre/Tutor',
          telefono:        (profile as any)?.phone || null,
          email:           (profile as any)?.email || null,
          parentesco:      'padre',
          whatsapp_activo: !!((profile as any)?.phone),
          notif_citas:     true,
          notif_reportes:  true,
          notif_tareas:    true,
        }, { onConflict: 'user_id,child_id', ignoreDuplicates: false })
    } else {
      await supabaseAdmin
        .from('parent_accounts')
        .delete()
        .eq('child_id', childId)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
