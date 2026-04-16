// app/api/chat-familias/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET — cargar mensajes con avatar de cada remitente
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  const userId  = searchParams.get('user_id')
  const limit   = Number(searchParams.get('limit') || 60)

  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })

  try {
    const { data, error } = await supabaseAdmin
      .from('chat_familias')
      .select('id, content, sender_id, sender_role, sender_name, read_by, message_type, file_url, file_name, file_size, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error

    const messages = data || []

    // Obtener avatares únicos desde profiles
    const senderIds = [...new Set(messages.map(m => m.sender_id))]
    if (senderIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, avatar_url')
        .in('id', senderIds)

      const avatarMap: Record<string, string | null> = {}
      profiles?.forEach(p => { avatarMap[p.id] = p.avatar_url })

      // Inyectar sender_avatar en cada mensaje
      messages.forEach(m => {
        (m as any).sender_avatar = avatarMap[m.sender_id] || null
      })
    }

    // Marcar como leídos en background
    if (userId && messages.length) {
      const toUpdate = messages.filter(m => !m.read_by?.includes(userId));
      (async () => {
        for (const m of toUpdate) {
          try {
            await supabaseAdmin
              .from('chat_familias')
              .update({ read_by: [...(m.read_by || []), userId] })
              .eq('id', m.id)
          } catch {}
        }
      })()
    }

    return NextResponse.json({ data: messages })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — enviar mensaje
export async function POST(req: NextRequest) {
  try {
    const { child_id, content, sender_id, sender_role, sender_name, message_type, file_url, file_name, file_size } = await req.json()

    if (!child_id || !content?.trim() || !sender_id || !sender_name) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('chat_familias')
      .insert({
        child_id,
        content:      content.trim(),
        sender_id,
        sender_role:  sender_role || 'padre',
        sender_name,
        message_type: message_type || 'text',
        file_url:     file_url  || null,
        file_name:    file_name || null,
        file_size:    file_size || null,
        read_by:      [sender_id],
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// PATCH — marcar mensajes como leídos
export async function PATCH(req: NextRequest) {
  try {
    const { child_id, user_id } = await req.json()
    if (!child_id || !user_id) return NextResponse.json({ ok: false })

    const { data: msgs } = await supabaseAdmin
      .from('chat_familias')
      .select('id, read_by')
      .eq('child_id', child_id)
      .not('sender_id', 'eq', user_id)

    const toUpdate = (msgs || []).filter(m => !m.read_by?.includes(user_id))

    for (const m of toUpdate) {
      await supabaseAdmin
        .from('chat_familias')
        .update({ read_by: [...(m.read_by || []), user_id] })
        .eq('id', m.id)
    }

    return NextResponse.json({ ok: true, marked: toUpdate.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
