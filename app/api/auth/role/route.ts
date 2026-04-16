import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid')
  if (!uid) return NextResponse.json({ role: 'padre' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .single()

  if (!profile) {
    // Nuevo usuario OAuth — crear perfil padre
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid)
    if (userData?.user) {
      await supabaseAdmin.from('profiles').insert([{
        id: uid,
        email: userData.user.email,
        full_name: userData.user.user_metadata?.full_name || userData.user.email?.split('@')[0] || 'Usuario',
        role: 'padre',
        is_active: true,
      }])
    }
    return NextResponse.json({ role: 'padre' })
  }

  return NextResponse.json({ role: profile.role })
}
