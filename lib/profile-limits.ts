// lib/profile-limits.ts — Bloqueo DURO de límites de perfiles (server-side).
// El límite lo define el programador en /control (app_settings.limits). Nadie
// puede pasarse del tope creando o cambiando rol, salvo que el programador lo
// amplíe. A prueba de fallos: si algo falla al leer, NO bloquea.

import { supabaseAdmin } from '@/lib/supabase-admin'

// Cualquier rol → su "clave de límite".
export function limitKeyForRole(role: string): string {
  if (role === 'jefe' || role === 'admin') return 'admin'
  if (role === 'especialista' || role === 'terapeuta') return 'especialista'
  return role // secretaria, padre, paciente
}

export async function profileLimitCheck(
  role: string,
  excludeUserId?: string,
  tenantId?: string | null,
): Promise<{ blocked: boolean; limit: number; current: number; key: string }> {
  const key = limitKeyForRole(role)
  try {
    const { data: s } = await supabaseAdmin
      .from('app_settings').select('limits').eq('id', 1).maybeSingle()
    const limit = Math.floor(Number((s as { limits?: Record<string, number> } | null)?.limits?.[key] || 0))
    if (limit <= 0) return { blocked: false, limit: 0, current: 0, key }

    // El cupo se cuenta DENTRO del centro (tenant). Si no hay tenant (legacy),
    // se cuenta global como antes.
    let query = supabaseAdmin.from('profiles').select('id, role')
    query = tenantId ? query.eq('tenant_id', tenantId) : query.is('tenant_id', null)
    const { data: profs } = await query
    let current = 0
    for (const p of (profs || []) as { id: string; role?: string }[]) {
      if (excludeUserId && p.id === excludeUserId) continue
      if (limitKeyForRole(p.role || '') === key) current++
    }
    return { blocked: current >= limit, limit, current, key }
  } catch {
    return { blocked: false, limit: 0, current: 0, key } // fail open
  }
}
