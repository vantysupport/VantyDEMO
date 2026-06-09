// lib/session-lock.ts
// Sesión única — lado cliente. SOLO usa fetch a /api/session/* y sendBeacon.
// NO llama a supabase.rpc ni hace trabajo dentro de onAuthStateChange, para no
// tocar el lock de autenticación de supabase-js (lo que antes causaba deadlock).

import { supabase } from '@/lib/supabase'

const KEY = 'santi-device-session-id'
let cachedId = '' // copia en memoria, por si el localStorage se altera al salir

// Identificador estable por navegador/dispositivo (no por persona).
export function getDeviceSessionId(): string {
  if (typeof window === 'undefined') return cachedId
  let id = localStorage.getItem(KEY) || cachedId
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  try { localStorage.setItem(KEY, id) } catch { /* noop */ }
  cachedId = id
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

// Libera la sesión de inmediato. Doble vía para máxima fiabilidad:
//  1) sendBeacon (sobrevive al unload)  2) fetch keepalive (más confiable en logout
//  in-app sin recarga). Ninguna toca supabase-js.
export function releaseViaBeacon(): void {
  const sid = getDeviceSessionId()
  if (!sid) return
  const payload = JSON.stringify({ sessionId: sid })

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/session/release', new Blob([payload], { type: 'application/json' }))
    }
  } catch { /* noop */ }

  try {
    fetch('/api/session/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch { /* noop */ }
}
