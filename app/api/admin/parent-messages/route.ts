import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendWspToParent, buildParentMessage } from '@/lib/notifications'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending_approval'

    const { data, error } = await supabaseAdmin
      .from('parent_message_approvals')
      .select(`
        *,
        children!parent_message_approvals_child_id_fkey(name, birth_date),
        profiles!parent_message_approvals_parent_id_fkey(full_name, email)
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { child_id, parent_id, source, source_title, ai_message, ai_analysis, session_data } = body

    const { data, error } = await supabaseAdmin
      .from('parent_message_approvals')
      .insert([{
        child_id, parent_id, source, source_title,
        ai_message,
        edited_message: ai_message,
        ai_analysis, session_data,
        status: 'pending_approval',
        created_at: new Date().toISOString(),
      }])
      .select()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, edited_message, action } = body

    if (action === 'approve') {
      const { data: record, error: fetchError } = await supabaseAdmin
        .from('parent_message_approvals')
        .select('*, children(name), profiles(full_name)')
        .eq('id', id)
        .single()

      if (fetchError || !record) throw new Error('Mensaje no encontrado')

      const messageToSend = edited_message || record.edited_message || record.ai_message
      const childName = (record as any).children?.name || 'su hijo/a'

      // Notify parent
      const formType = (record as any).session_data?.form_type || record.source || 'parent_form'
      await supabaseAdmin.from('notifications').insert([{
        user_id: record.parent_id,
        title: `📋 Mensaje sobre ${childName}`,
        message: messageToSend,
        type: 'parent_message',
        metadata: {
          source: record.source,
          source_title: record.source_title,
          child_id: record.child_id,
          ai_analysis: record.ai_analysis,
          form_type: formType,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      }])

      const { data, error } = await supabaseAdmin
        .from('parent_message_approvals')
        .update({ edited_message: messageToSend, status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id).select()

      if (error) throw error

      // 🔔 Send push notification to parent
      try {
        const childName = (record as any).children?.name || 'tu hijo/a'
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: record.parent_id,
            title: `📋 Mensaje sobre ${childName}`,
            body: messageToSend.length > 100 ? messageToSend.slice(0, 97) + '...' : messageToSend,
            url: '/padre',
          }),
        })
      } catch (pushErr) {
        // Non-critical — log but don't fail the approval
        console.error('Push notification error (non-critical):', pushErr)
      }

      // 📱 WhatsApp directo al padre cuando el admin aprueba el mensaje
      try {
        const { data: pProf } = await supabaseAdmin
          .from('profiles').select('phone, wsp_notif').eq('id', record.parent_id).maybeSingle()
        if ((pProf as any)?.phone && (pProf as any)?.wsp_notif !== false) {
          const terapeutaNombre = (record as any).profiles?.full_name || 'Tu terapeuta'
          const preview = messageToSend.length > 120 ? messageToSend.slice(0, 117) + '...' : messageToSend
          const msg = buildParentMessage('mensaje_terapeuta', {
            terapeuta: terapeutaNombre,
            preview,
          })
          sendWspToParent((pProf as any).phone, msg).catch(() => {})
        }
      } catch { /* silencioso */ }

      return NextResponse.json({ data })

    } else if (action === 'reject') {
      const { data, error } = await supabaseAdmin
        .from('parent_message_approvals')
        .update({ status: 'rejected', approved_at: new Date().toISOString() })
        .eq('id', id).select()
      if (error) throw error
      return NextResponse.json({ data })

    } else {
      const { data, error } = await supabaseAdmin
        .from('parent_message_approvals')
        .update({ edited_message })
        .eq('id', id).select()
      if (error) throw error
      return NextResponse.json({ data })
    }
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    const { error } = await supabaseAdmin.from('parent_message_approvals').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
