import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { notifyAsync, sendWspToParent, buildParentMessage } from '@/lib/notifications'

// GET: List forms assigned to parents (optionally filter by parent_id or status)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parentId = searchParams.get('parent_id')
    const childId = searchParams.get('child_id')
    const status = searchParams.get('status')

    let query = supabaseAdmin
      .from('parent_forms')
      .select('*, profiles!parent_forms_parent_id_fkey(full_name, email), children!parent_forms_child_id_fkey(name)')
      .order('created_at', { ascending: false })

    if (parentId) query = query.eq('parent_id', parentId)
    if (childId) query = query.eq('child_id', childId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Admin sends a form to a parent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { parent_id, child_id, form_type, form_title, form_description, message_to_parent, deadline } = body

    const { data, error } = await supabaseAdmin
      .from('parent_forms')
      .insert([{
        parent_id,
        child_id,
        form_type,
        form_title,
        form_description,
        message_to_parent,
        deadline,
        status: 'pending',
        created_at: new Date().toISOString(),
      }])
      .select()

    if (error) throw error

    // Also create a notification for the parent (best-effort)
    if (parent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: parent_id,
          title: '📋 Nuevo formulario para completar',
          message: `${form_title} - ${message_to_parent || 'Por favor completa este formulario.'}`,
          type: 'form_request',
          is_read: false,
          created_at: new Date().toISOString(),
        }])
      } catch (_e) { /* best-effort */ }
    }

    // WhatsApp al admin del centro — formulario subido/enviado
    notifyAsync({
      tipo: 'formulario_nuevo',
      vars: {
        tipo: form_title || form_type || 'Formulario',
        paciente: child_id || '',
        especialista: '',
      },
    })

    // WhatsApp directo al padre — nuevo formulario para completar
    if (parent_id) {
      try {
        const { data: pProf } = await supabaseAdmin
          .from('profiles').select('phone, wsp_notif, full_name').eq('id', parent_id).maybeSingle()
        if ((pProf as any)?.phone && (pProf as any)?.wsp_notif !== false) {
          // Obtener nombre del paciente
          let pName = child_id || 'su hijo/a'
          if (child_id) {
            const { data: ch } = await supabaseAdmin.from('children').select('name').eq('id', child_id).maybeSingle()
            if ((ch as any)?.name) pName = (ch as any).name
          }
          const msg = buildParentMessage('formulario_nuevo', { tipo: form_title || form_type || 'Formulario', paciente: pName })
          sendWspToParent((pProf as any).phone, msg).catch(() => {})
        }
      } catch { /* silencioso */ }
    }


    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH: Update form status or save responses
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, responses, completed_at } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (responses) updateData.responses = responses
    if (completed_at) updateData.completed_at = completed_at

    const { data, error } = await supabaseAdmin
      .from('parent_forms')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    const { error } = await supabaseAdmin.from('parent_forms').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
