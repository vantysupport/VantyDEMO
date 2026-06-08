// lib/session-lock.ts
// Cliente de "sesión única": una cuenta solo puede estar activa en un
// dispositivo a la vez. Se apoya en las funciones RPC de supabase/session-lock.sql.

import { supabase } from '@/lib/supabase'

const KEY = 'santi-device-session-id'
export const STALE_SECONDS = 90

// Identificador estable por navegador/dispositivo (no por persona).
export function getDeviceSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(KEY, id)
  }
  return id
}

export type ClaimResult = 'claimed' | 'in_use' | 'error'

// Intenta tomar la sesión. 'in_use' = otra persona la tiene activa.
// 'error' (RPC no instalada / red) => el llamador debe FALLAR ABIERTO (no bloquear).
export async function claimSession(): Promise<ClaimResult> {
  try {
    const sid = getDeviceSessionId()
    const { data, error } = await supabase.rpc('claim_session', {
      p_session_id: sid,
      p_stale_seconds: STALE_SECONDS,
    })
    if (error) return 'error'
    if (data === 'claimed') return 'claimed'
    if (data === 'in_use') return 'in_use'
    return 'error'
  } catch {
    return 'error'
  }
}

// Mantiene viva la sesión. Devuelve true si sigo siendo dueño.
// Ante un fallo de red devolvemos true para no expulsar por un hipo de conexión.
export async function heartbeatSession(): Promise<boolean> {
  try {
    const sid = getDeviceSessionId()
    const { data, error } = await supabase.rpc('heartbeat_session', { p_session_id: sid })
    if (error) return true
    return data === true
  } catch {
    return true
  }
}

// Libera la sesión (al cerrar sesión o cerrar la pestaña).
export async function releaseSession(): Promise<void> {
  try {
    const sid = getDeviceSessionId()
    await supabase.rpc('release_session', { p_session_id: sid })
  } catch { /* best-effort */ }
}
