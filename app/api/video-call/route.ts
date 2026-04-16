import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Jitsi Meet — 100% gratuito, sin cuenta, sin tarjeta
const JITSI_BASE = 'https://meet.jit.si'

// ── GET: uso del mes (sin params) · sesión activa por appointment_id (con param) ─
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const appointmentId = searchParams.get('appointment_id')

    // ── Consulta de sesión activa para un appointment específico (padre) ──
    if (appointmentId) {
      const { data, error } = await supabaseAdmin
        .from('video_sessions')
        .select('id, room_url, status, started_at')
        .eq('appointment_id', appointmentId)
        .in('status', ['waiting', 'active'])
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data) return NextResponse.json({ session: null })
      return NextResponse.json({ session: { sessionId: data.id, roomUrl: data.room_url, status: data.status } })
    }

    // ── Uso mensual (admin) ──
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { data, error } = await supabaseAdmin
      .from('video_sessions')
      .select('duration_minutes')
      .gte('started_at', monthStart)

    if (error) throw error
    const used = (data || []).reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
    const limit = 10000
    const remaining = Math.max(0, limit - used)
    const percentage = Math.round((used / limit) * 100)
    return NextResponse.json({ used, remaining, percentage, limit })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── POST: crear sala de videollamada con Jitsi (sin API externa) ──────────────
export async function POST(req: NextRequest) {
  try {
    const { appointment_id, child_id, initiated_by } = await req.json()

    // Generar nombre de sala único y legible
    const roomName = `JugandoAprendo-${appointment_id || Date.now()}`
    const roomUrl = `${JITSI_BASE}/${roomName}`

    // Guardar sesión en Supabase
    const { data: session, error: dbErr } = await supabaseAdmin
      .from('video_sessions')
      .insert({
        appointment_id,
        child_id,
        room_name: roomName,
        room_url: roomUrl,
        initiated_by,
        started_at: new Date().toISOString(),
        status: 'waiting',
        duration_minutes: 0,
      })
      .select()
      .single()

    if (dbErr) throw dbErr

    // Notificar al padre con la URL
    if (child_id) {
      const { data: child } = await supabaseAdmin
        .from('children')
        .select('parent_id')
        .eq('id', child_id)
        .single()

      if (child?.parent_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: child.parent_id,
          type: 'video_call',
          title: '📹 Videollamada lista',
          message: 'Tu terapeuta te está esperando en una videollamada. ¡Únete ahora!',
          metadata: {
            room_url: roomUrl,
            session_id: session.id,
            appointment_id,
          },
          is_read: false,
        })
      }
    }

    return NextResponse.json({
      room_url: roomUrl,
      room_name: roomName,
      session_id: session.id,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── PATCH: finalizar sesión y registrar duración ─────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { session_id, duration_minutes } = await req.json()

    await supabaseAdmin
      .from('video_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration_minutes: Math.ceil(duration_minutes || 0),
      })
      .eq('id', session_id)

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
