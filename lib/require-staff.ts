// lib/require-staff.ts — Verifica por token que quien llama tenga un rol permitido.
// Se usa en rutas /api/admin/* para que no se puedan llamar sin ser personal.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export const STAFF_ROLES = ['jefe', 'admin', 'especialista', 'terapeuta', 'secretaria', 'programador']

export async function requireRole(
  req: NextRequest,
  allowed: string[],
): Promise<{ ok: boolean; reason: string; role?: string; uid?: string; tenantId?: string | null }> {
  // Acepta token Bearer (adminFetch) O la sesión por cookie (fetch normal).
  let uid: string | undefined
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (token) {
    const { data: u } = await supabaseAdmin.auth.getUser(token)
    uid = u?.user?.id
  }
  if (!uid) {
    try {
      const sb = await createClient()
      const { data } = await sb.auth.getUser()
      uid = data?.user?.id
    } catch { /* sin cookies */ }
  }
  if (!uid) return { ok: false, reason: 'no autenticado' }
  const { data: prof } = await supabaseAdmin.from('profiles').select('role, tenant_id').eq('id', uid).maybeSingle()
  const role = (prof as { role?: string } | null)?.role
  const tenantId = (prof as { tenant_id?: string | null } | null)?.tenant_id ?? null
  if (!role || !allowed.includes(role)) return { ok: false, reason: 'requiere personal del centro' }
  return { ok: true, reason: '', role, uid, tenantId }
}
