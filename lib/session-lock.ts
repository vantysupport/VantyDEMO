// lib/session-lock.ts
// Cliente de "sesión única": una cuenta solo puede estar activa en un
// dispositivo a la vez. Se apoya en las funciones RPC de supabase/session-lock.sql.

import { supabase } from '@/lib/supabase'

const KEY = 'santi-device-session-id'
// Ventana de respaldo si una pestaña se cierra sin avisar. Se mantiene baja
// porque el heartbeat refresca cada 10s y el cierre de pestaña libera por beacon.
export const STALE_SECONDS = 30

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
// 'error' (RPC no instalada / red / timeout) => el llamador debe FALLAR ABIERTO.
// Tiene un timeout propio para que NUNCA cuelgue el login si la RPC se traba.
export async function claimSession(): Promise<ClaimResult> {
  const sid = getDeviceSessionId()

  const rpc: Promise<ClaimResult> = Promise.resolve(
    supabase.rpc('claim_session', { p_session_id: sid, p_stale_seconds: STALE_SECONDS })
  )
    .then(({ data, error }: any) => {
      if (error) return 'error' as ClaimResult
      if (data === 'claimed') return 'claimed' as ClaimResult
      if (data === 'in_use') return 'in_use' as ClaimResult
      return 'error' as ClaimResult
    })
    .catch(() => 'error' as ClaimResult)

  const timeout = new Promise<ClaimResult>(resolve => setTimeout(() => resolve('error'), 8000))

  return Promise.race([rpc, timeout])
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
