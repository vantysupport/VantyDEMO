// lib/require-staff.ts — Verifica por token que quien llama tenga un rol permitido.
// Se usa en rutas /api/admin/* para que no se puedan llamar sin ser personal.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const STAFF_ROLES = ['jefe', 'admin', 'especialista', 'terapeuta', 'secretaria', 'programador']

export async function requireRole(
  req: NextRequest,
  allowed: string[],
): Promise<{ ok: boolean; reason: string; role?: string }> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return { ok: false, reason: 'sin token' }
  const { data: u, error } = await supabaseAdmin.auth.getUser(token)
  const uid = u?.user?.id
  if (error || !uid) return { ok: false, reason: 'sesión inválida o expirada' }
  const { data: prof } = await supabaseAdmin.from('profiles').select('role').eq('id', uid).maybeSingle()
  const role = (prof as { role?: string } | null)?.role
  if (!role || !allowed.includes(role)) return { ok: false, reason: 'requiere personal del centro' }
  return { ok: true, reason: '', role }
}
