import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Repositorio de imágenes de fonemas.
//  • GET  → mapa { fonema_id: [{id,url}] } (lo leen las familias; va detrás del login).
//  • POST → acciones 'agregar' / 'eliminar' (solo personal del centro, por token).
// Usa service_role (bypassa RLS). Ver supabase/fonema-imagenes.sql.

const STAFF = ['jefe', 'admin', 'especialista', 'terapeuta']

async function requireStaff(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (!uid) return false
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', uid).single()
  const role = (profile as { role?: string } | null)?.role ?? ''
  return STAFF.includes(role)
}

export async function GET() {
  // Imágenes (galería por fonema). Tolerante si la tabla aún no existe.
  const imagenes: Record<string, { id: string; url: string; label: string }[]> = {}
  const { data, error } = await supabaseAdmin
    .from('fonema_imagenes')
    .select('id, fonema_id, url, label, orden')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (!error) {
    for (const row of (data || []) as { id: string; fonema_id: string; url: string; label: string | null }[]) {
      (imagenes[row.fonema_id] ||= []).push({ id: row.id, url: row.url, label: row.label || '' })
    }
  }

  // Ayuda (boca + video) por fonema. Tolerante si la tabla aún no existe.
  const ayuda: Record<string, { boca_url: string | null; video_url: string | null }> = {}
  const { data: aData, error: aErr } = await supabaseAdmin
    .from('fonema_ayuda')
    .select('fonema_id, boca_url, video_url')
  if (!aErr) {
    for (const row of (aData || []) as { fonema_id: string; boca_url: string | null; video_url: string | null }[]) {
      ayuda[row.fonema_id] = { boca_url: row.boca_url, video_url: row.video_url }
    }
  }

  return NextResponse.json({ imagenes, ayuda })
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  let body: { action?: string; fonema_id?: string; url?: string; label?: string; id?: string; boca_url?: string; video_url?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const action = body?.action

  if (action === 'set_ayuda') {
    const fonema_id = String(body.fonema_id || '').trim()
    if (!fonema_id) return NextResponse.json({ error: 'fonema_id requerido' }, { status: 400 })
    const boca_url = String(body.boca_url || '').trim()
    const video_url = String(body.video_url || '').trim()
    if (boca_url && !/^https?:\/\//i.test(boca_url)) return NextResponse.json({ error: 'La URL de la boca debe empezar con http' }, { status: 400 })
    if (video_url && !/^https?:\/\//i.test(video_url)) return NextResponse.json({ error: 'La URL del video debe empezar con http' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('fonema_ayuda')
      .upsert({ fonema_id, boca_url: boca_url || null, video_url: video_url || null, updated_at: new Date().toISOString() }, { onConflict: 'fonema_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'agregar') {
    const fonema_id = String(body.fonema_id || '').trim()
    const url = String(body.url || '').trim()
    const label = String(body.label || '').trim().slice(0, 60)
    if (!fonema_id || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Datos inválidos (la URL debe empezar con http:// o https://)' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('fonema_imagenes')
      .insert({ fonema_id, url, label: label || null })
      .select('id, fonema_id, url, label')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, row: data })
  }

  if (action === 'eliminar') {
    const id = String(body.id || '').trim()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
    const { error } = await supabaseAdmin.from('fonema_imagenes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
}
