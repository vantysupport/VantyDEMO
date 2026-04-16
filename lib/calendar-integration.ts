// lib/calendar-integration.ts
// Integración con Google Calendar y Microsoft Calendar (Outlook)
// Se activa automáticamente según el provider con que inició sesión el padre

import { createClient } from '@supabase/supabase-js'

export type CalendarProvider = 'google' | 'microsoft' | 'none'

/** Detectar qué calendario tiene el usuario según su sesión OAuth */
export async function detectCalendarProvider(userId: string): Promise<CalendarProvider> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data } = await sb.auth.getSession()
  const provider = data.session?.user?.app_metadata?.provider
  if (provider === 'google') return 'google'
  if (provider === 'azure') return 'microsoft'
  return 'none'
}

/** Enviar recordatorio de cita al Google Calendar del usuario */
export async function addGoogleCalendarEvent(params: {
  accessToken: string
  title: string
  description: string
  startDateTime: string   // ISO 8601
  endDateTime: string     // ISO 8601
  attendeeEmail?: string
}): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const body = {
      summary: params.title,
      description: params.description,
      start: { dateTime: params.startDateTime, timeZone: 'America/Lima' },
      end:   { dateTime: params.endDateTime,   timeZone: 'America/Lima' },
      reminders: { useDefault: false, overrides: [
        { method: 'popup',  minutes: 60 },
        { method: 'email',  minutes: 1440 },
      ]},
      ...(params.attendeeEmail ? {
        attendees: [{ email: params.attendeeEmail }],
      } : {}),
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const err = await res.json()
      return { ok: false, error: err.error?.message || 'Error Google Calendar' }
    }

    const data = await res.json()
    return { ok: true, eventId: data.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/** Enviar recordatorio al Microsoft Calendar (Outlook) */
export async function addMicrosoftCalendarEvent(params: {
  accessToken: string
  title: string
  description: string
  startDateTime: string
  endDateTime: string
  attendeeEmail?: string
}): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const body: any = {
      subject: params.title,
      body: { contentType: 'HTML', content: params.description },
      start: { dateTime: params.startDateTime, timeZone: 'SA Pacific Standard Time' },
      end:   { dateTime: params.endDateTime,   timeZone: 'SA Pacific Standard Time' },
      isReminderOn: true,
      reminderMinutesBeforeStart: 60,
    }
    if (params.attendeeEmail) {
      body.attendees = [{ emailAddress: { address: params.attendeeEmail }, type: 'required' }]
    }

    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      return { ok: false, error: err.error?.message || 'Error Microsoft Calendar' }
    }

    const data = await res.json()
    return { ok: true, eventId: data.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/** Helper unificado — detecta el provider y agrega el evento al calendario correcto */
export async function addCalendarReminder(params: {
  userId: string
  accessToken: string
  provider: CalendarProvider
  citaId: string
  pacienteNombre: string
  terapeutaNombre: string
  fecha: string   // YYYY-MM-DD
  hora: string    // HH:MM
  duracionMin?: number
}): Promise<void> {
  const start = `${params.fecha}T${params.hora}:00`
  const durMin = params.duracionMin ?? 60
  const endH = new Date(new Date(`${params.fecha}T${params.hora}`).getTime() + durMin * 60000)
  const end = endH.toISOString().replace('Z', '')

  const title = `🧩 Sesión ABA — ${params.pacienteNombre}`
  const desc  = `Sesión de terapia con ${params.terapeutaNombre}.<br/>Centro: Jugando Aprendo`

  if (params.provider === 'google') {
    await addGoogleCalendarEvent({ accessToken: params.accessToken, title, description: desc, startDateTime: start, endDateTime: end })
  } else if (params.provider === 'microsoft') {
    await addMicrosoftCalendarEvent({ accessToken: params.accessToken, title, description: desc, startDateTime: start, endDateTime: end })
  }
}
