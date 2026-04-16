import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    // Check if user exists
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email)
      .single()

    if (!users) {
      // Don't reveal if user exists - security best practice
      return NextResponse.json({ success: true, message: 'Si el correo existe, recibirás instrucciones.' })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jugandoaprendo.vercel.app'

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
    })

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      message: 'Se enviaron instrucciones de recuperación a tu correo.' 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
