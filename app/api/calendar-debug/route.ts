import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, google_calendar_token, google_calendar_email, google_calendar_refresh_token, microsoft_calendar_token, microsoft_calendar_email')
    .eq('id', userId).single()

  const { data: apts, error: aptsErr } = await supabaseAdmin
    .from('appointments')
    .select('id, appointment_date, appointment_time, status, google_calendar_event_id, created_by')
    .order('appointment_date', { ascending: false }).limit(5)

  const { data: agenda, error: agendaErr } = await supabaseAdmin
    .from('agenda_sesiones')
    .select('id, fecha, hora_inicio, tipo')
    .order('fecha', { ascending: false }).limit(5)

  let tokenTest: any = null
  if (profile?.google_calendar_token) {
    const testRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary',
      { headers: { Authorization: `Bearer ${profile.google_calendar_token}` } })
    const body = testRes.ok ? null : await testRes.text()
    tokenTest = { status: testRes.status, ok: testRes.ok, error: body }
  }

  return NextResponse.json({
    profile: {
      id: profile?.id, email: profile?.email, role: profile?.role,
      google_connected: !!profile?.google_calendar_token,
      google_email: profile?.google_calendar_email,
      google_has_refresh: !!profile?.google_calendar_refresh_token,
      microsoft_connected: !!profile?.microsoft_calendar_token,
      microsoft_email: profile?.microsoft_calendar_email,
    },
    token_test: tokenTest,
    appointments: { count: apts?.length, error: aptsErr?.message, sample: apts?.slice(0,2) },
    agenda_sesiones: { count: agenda?.length, error: agendaErr?.message },
    env: {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CALENDAR_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      MS_CLIENT_ID: !!process.env.MICROSOFT_CALENDAR_CLIENT_ID,
      MS_CLIENT_SECRET: !!process.env.MICROSOFT_CALENDAR_CLIENT_SECRET,
      APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    }
  })
}
