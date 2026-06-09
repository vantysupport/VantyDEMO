// lib/session-lock.ts
// Sesión única — lado cliente. SOLO usa fetch a /api/session/* y sendBeacon.
// NO llama a supabase.rpc ni hace trabajo dentro de onAuthStateChange, para no
// tocar el lock de autenticación de supabase-js (lo que antes causaba deadlock).

import { supabase } from '@/lib/supabase'

const KEY = 'santi-device-session-id'

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

async function getToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export type ClaimResult = 'claimed' | 'in_use' | 'error'

// Reclama la sesión. 'in_use' = otra persona la tiene activa.
// 'error' (red / sin token) => el llamador FALLA ABIERTO (no bloquea).
export async function claimSession(): Promise<ClaimResult> {
  try {
    const token = await getToken()
    if (!token) return 'error'
    const res = await fetch('/api/session/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId: getDeviceSessionId() }),
    })
    if (!res.ok) return 'error'
    const json = await res.json()
    return json.claimed ? 'claimed' : 'in_use'
  } catch {
    return 'error'
  }
}

// Heartbeat. Devuelve true si sigo siendo dueño (ante error => true, no expulsar).
export async function heartbeatSession(): Promise<boolean> {
  try {
    const token = await getToken()
    if (!token) return true
    const res = await fetch('/api/session/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId: getDeviceSessionId() }),
    })
    if (!res.ok) return true
    const json = await res.json()
    return json.owner !== false
  } catch {
    return true
  }
}

// Libera la sesión por sendBeacon (fiable en unload, NO toca supabase-js).
export function releaseViaBeacon(): void {
  try {
    const sid = getDeviceSessionId()
    if (sid && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ sessionId: sid })], { type: 'application/json' })
      navigator.sendBeacon('/api/session/release', blob)
    }
  } catch { /* noop */ }
}
