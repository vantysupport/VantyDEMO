// app/api/microsoft-calendar/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MS_CLIENT_ID     = process.env.MICROSOFT_CALENDAR_CLIENT_ID     || ''
const MS_CLIENT_SECRET = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || ''
const MS_TENANT        = process.env.MICROSOFT_TENANT_ID || '3e32a281-36d9-4099-8105-e9460f1ab7a7'
const REDIRECT_URI     = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/microsoft-calendar/callback`
  : 'http://localhost:3000/api/microsoft-calendar/callback'

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
  const errorDest = stateRole === 'padre' ? '/padre' : '/admin'

  if (error || !code || !userId) {
    return NextResponse.redirect(`${appUrl}${errorDest}?mscal=error`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     MS_CLIENT_ID,
          client_secret: MS_CLIENT_SECRET,
          code,
          redirect_uri:  REDIRECT_URI,
          grant_type:    'authorization_code',
          scope:         'Calendars.ReadWrite offline_access openid profile email',
        }),
      }
    )

    if (!tokenRes.ok) {
      console.error('MS token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(`${appUrl}${errorDest}?mscal=error`)
    }

    const tokens = await tokenRes.json()
    const { access_token, refresh_token } = tokens

    // Get Microsoft user email
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const msProfile = profileRes.ok ? await profileRes.json() : {}
    const msEmail = msProfile.mail || msProfile.userPrincipalName || null

    // Save to Supabase
    const { data: updatedProfile } = await supabaseAdmin
      .from('profiles')
      .update({
        microsoft_calendar_token:         access_token,
        microsoft_calendar_refresh_token: refresh_token || null,
        microsoft_calendar_email:         msEmail,
      })
      .eq('id', userId)
      .select('role')
      .single()

    const role = stateRole || updatedProfile?.role || 'admin'
    const destination = role === 'padre' ? '/padre' : '/admin'
    return NextResponse.redirect(
      `${appUrl}${destination}?mscal=connected&email=${encodeURIComponent(msEmail || '')}`
    )
  } catch (e: any) {
    console.error('Microsoft Calendar callback error:', e)
    return NextResponse.redirect(`${appUrl}${errorDest}?mscal=error`)
  }
}
