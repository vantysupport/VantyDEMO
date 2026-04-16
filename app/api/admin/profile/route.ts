import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('phone, full_name')
    .in('role', ['admin', 'jefe'])
    .not('phone', 'is', null)
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ phone: (data as any)?.phone ?? null })
}
