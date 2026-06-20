import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Estado de demo del usuario autenticado (para el aviso "Te quedan X días").
// Devuelve { is_demo, days_left, expires_at, center_name } o is_demo:false.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ is_demo: false })

    const { data } = await supabase
      .from('profiles')
      .select('is_demo, demo_active, demo_expires_at, center_name')
      .eq('id', user.id)
      .maybeSingle()

    const p = data as {
      is_demo?: boolean; demo_active?: boolean; demo_expires_at?: string; center_name?: string
    } | null

    if (!p?.is_demo) return NextResponse.json({ is_demo: false })

    const expiresAt = p.demo_expires_at ? new Date(p.demo_expires_at).getTime() : null
    const msLeft = expiresAt ? expiresAt - Date.now() : null
    const days_left = msLeft != null ? Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000))) : null

    return NextResponse.json({
      is_demo: true,
      active: p.demo_active !== false,
      days_left,
      expires_at: p.demo_expires_at || null,
      center_name: p.center_name || null,
    })
  } catch {
    return NextResponse.json({ is_demo: false })
  }
}
