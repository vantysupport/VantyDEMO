// lib/session-lock.ts
// Sesión única — lado cliente, a prueba de cuelgues.
//  • TODAS las llamadas tienen timeout: si algo tarda, FALLA ABIERTO (no bloquea).
//  • El heartbeat NO usa supabase-js (fetch puro con userId+sessionId guardados),
//    para no tocar el lock de auth que antes causaba deadlock.
//  • El claim (seguro) sí usa el token, pero solo en login/montaje y acotado.

import { supabase } from '@/lib/supabase'

const KEY = 'santi-device-session-id'
const UKEY = 'santi-device-user-id'
let cachedId = ''

export function getDeviceSessionId(): string {
  if (typeof window === 'undefined') return cachedId
  let id = localStorage.getItem(KEY) || cachedId
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  try { localStorage.setItem(KEY, id) } catch {}
  cachedId = id
  return id
}

function getStoredUserId(): string {
  try { return localStorage.getItem(UKEY) || '' } catch { return '' }
}
function setStoredUserId(uid: string): void {
  try { localStorage.setItem(UKEY, uid) } catch {}
}

// fetch con timeout: si se pasa del tiempo, aborta y lanza (el llamador captura).
async function fetchT(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// Obtiene token + userId con timeout (getSession puede, en teoría, tardar).
async function getSessionInfo(): Promise<{ token: string; userId: string } | null> {
  try {
    const p = supabase.auth.getSession()
    const timeout = new Promise<null>(res => setTimeout(() => res(null), 3000))
    const result: any = await Promise.race([p, timeout])
    const session = result?.data?.session
    if (!session) return null
    return { token: session.access_token, userId: session.user.id }
  } catch {
    return null
  }
}

export type ClaimResult = 'claimed' | 'in_use' | 'error'

// Reclama la sesión (seguro, por token). 'error' => FALLA ABIERTO.
export async function claimSession(): Promise<ClaimResult> {
  try {
    const info = await getSessionInfo()
    if (!info) return 'error'
    setStoredUserId(info.userId)
    const res = await fetchT('/api/session/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${info.token}` },
      body: JSON.stringify({ sessionId: getDeviceSessionId() }),
    }, 3500)
    if (!res.ok) return 'error'
    const json = await res.json()
    return json.claimed ? 'claimed' : 'in_use'
  } catch {
    return 'error'
  }
}

// Heartbeat SIN supabase-js: fetch puro con userId+sessionId. true = sigo dueño.
export async function heartbeatSession(): Promise<boolean> {
  try {
    const userId = getStoredUserId()
    const sessionId = getDeviceSessionId()
    if (!userId || !sessionId) return true
    const res = await fetchT('/api/session/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, sessionId }),
    }, 3500)
    if (!res.ok) return true
    const json = await res.json()
    return json.owner !== false
  } catch {
    return true
  }
}

// Libera ESPERANDO la confirmación del servidor (úsalo en el botón de logout,
// antes del signOut/redirect, para garantizar que quede libre al instante).
export async function releaseSessionNow(): Promise<void> {
  const sid = getDeviceSessionId()
  if (!sid) return
  try {
    await fetchT('/api/session/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: sid }),
    }, 2500)
  } catch {
    // si el await falla, intentamos por beacon como respaldo
    releaseViaBeacon()
  }
}

// Libera de inmediato (doble vía, sin tocar supabase-js). Para pagehide/SIGNED_OUT.
export function releaseViaBeacon(): void {
  const sid = getDeviceSessionId()
  if (!sid) return
  const payload = JSON.stringify({ sessionId: sid })
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/session/release', new Blob([payload], { type: 'application/json' }))
    }
  } catch {}
  try {
    fetch('/api/session/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {}
}
