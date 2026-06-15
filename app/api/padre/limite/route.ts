import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Verifica si el padre que llama está DENTRO del límite de cuentas de padres
// (definido por el programador en /control → Límites). El orden es por fecha de
// creación: los primeros N entran, el resto queda bloqueado para registrarse.
// A prueba de fallos: ante cualquier error NO bloquea (allowed:true).

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ allowed: true })

    const { data: u } = await supabaseAdmin.auth.getUser(token)
    const uid = u?.user?.id
    if (!uid) return NextResponse.json({ allowed: true })

    const { data: me } = await supabaseAdmin
      .from('profiles').select('role, created_at').eq('id', uid).maybeSingle()
    const role = (me as { role?: string } | null)?.role
    // Solo se limita a los padres; cualquier otro rol pasa.
    if (role !== 'padre') return NextResponse.json({ allowed: true })

    const { data: s } = await supabaseAdmin
      .from('app_settings').select('limits').eq('id', 1).maybeSingle()
    const limit = Math.floor(Number((s as { limits?: Record<string, number> } | null)?.limits?.padre || 0))
    if (limit <= 0) return NextResponse.json({ allowed: true, limit: 0 })

    const myCreated = (me as { created_at?: string } | null)?.created_at

    if (myCreated) {
      // Cuántos padres se crearon ANTES que yo (tienen prioridad por orden).
      const { count } = await supabaseAdmin
        .from('profiles').select('id', { count: 'exact', head: true })
        .eq('role', 'padre').lt('created_at', myCreated)
      const before = count || 0
      return NextResponse.json({ allowed: before < limit, limit, rank: before + 1 })
    }

    // Respaldo (sin created_at): cuántos OTROS padres existen.
    const { count } = await supabaseAdmin
      .from('profiles').select('id', { count: 'exact', head: true })
      .eq('role', 'padre').neq('id', uid)
    return NextResponse.json({ allowed: (count || 0) < limit, limit })
  } catch {
    return NextResponse.json({ allowed: true }) // fail open
  }
}
