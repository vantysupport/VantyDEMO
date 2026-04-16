// app/api/google-calendar/callback/route.ts
// Handles Google OAuth callback, saves tokens to Supabase
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CALENDAR_CLIENT_ID     || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || ''
const REDIRECT_URI         = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  : 'http://localhost:3000/api/google-calendar/callback'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code      = searchParams.get('code')
  const stateRaw  = searchParams.get('state') || ''
  const error     = searchParams.get('error')

  // state puede ser "userId:role" (nuevo) o solo "userId" (legacy)
  const [userId, stateRole] = stateRaw.includes(':')
    ? stateRaw.split(':')
    : [stateRaw, null]

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Determinar destino de error basado en el role del state
  const errorDest = stateRole === 'padre' ? '/padre' : '/admin'

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}${errorDest}?gcal=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${appUrl}${errorDest}?gcal=error`)
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token } = tokens

    // Get user's Google email
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const googleProfile = profileRes.ok ? await profileRes.json() : {}
    const googleEmail = googleProfile.email || null

    // Save tokens to Supabase profiles table
    const { error: updateError, data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .update({
        google_calendar_token:         access_token,
        google_calendar_refresh_token: refresh_token || null,
        google_calendar_email:         googleEmail,
      })
      .eq('id', userId)
      .select('role')
      .single()

    if (updateError) {
      console.error('Supabase update error:', updateError)
      return NextResponse.redirect(`${appUrl}${errorDest}?gcal=error`)
    }

    // Redirect to correct panel based on role (state tiene prioridad sobre DB)
    const role = stateRole || updatedProfile?.role || 'admin'
    const destination = role === 'padre' ? '/padre' : '/admin'
    return NextResponse.redirect(`${appUrl}${destination}?gcal=connected&email=${encodeURIComponent(googleEmail || '')}`)
  } catch (e: any) {
    console.error('Google Calendar callback error:', e)
    return NextResponse.redirect(`${appUrl}${errorDest}?gcal=error`)
  }
}
