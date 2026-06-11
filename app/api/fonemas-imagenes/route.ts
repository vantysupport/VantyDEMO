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
  const { data, error } = await supabaseAdmin
    .from('fonema_imagenes')
    .select('id, fonema_id, url, orden')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const imagenes: Record<string, { id: string; url: string }[]> = {}
  for (const row of (data || []) as { id: string; fonema_id: string; url: string }[]) {
    (imagenes[row.fonema_id] ||= []).push({ id: row.id, url: row.url })
  }
  return NextResponse.json({ imagenes })
}

export async function POST(req: NextRequest) {
  if (!(await requireStaff(req))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  let body: { action?: string; fonema_id?: string; url?: string; id?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  const action = body?.action

  if (action === 'agregar') {
    const fonema_id = String(body.fonema_id || '').trim()
    const url = String(body.url || '').trim()
    if (!fonema_id || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'Datos inválidos (la URL debe empezar con http:// o https://)' }, { status: 400 })
    }
    const { data, error } = await supabaseAdmin
      .from('fonema_imagenes')
      .insert({ fonema_id, url })
      .select('id, fonema_id, url')
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
