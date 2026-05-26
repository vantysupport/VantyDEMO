// lib/rate-limit.ts
// ════════════════════════════════════════════════════════════════════════════
// 🚦 Rate limiter dual: Upstash Redis (producción) + in-memory (dev/fallback)
//
// Si las variables UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN están
// configuradas, usa Upstash (compartido entre instancias serverless).
// Si no, cae a un Map en memoria del proceso (suficiente para dev / single instance).
//
// Configurá Upstash gratis en https://console.upstash.com (10K requests/día gratis).
// ════════════════════════════════════════════════════════════════════════════

type RateLimitResult = {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number // timestamp ms cuando se resetea
}

// ─── Backend en memoria (fallback) ─────────────────────────────────────────
const memoryStore = new Map<string, { count: number; resetAt: number }>()

// Limpieza periódica de entradas expiradas (cada 5 min)
let cleanupTimer: NodeJS.Timeout | null = null
if (typeof setInterval !== 'undefined' && !cleanupTimer) {
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, val] of memoryStore.entries()) {
      if (val.resetAt < now) memoryStore.delete(key)
    }
  }, 5 * 60 * 1000)
  // En dev / hot-reload no acumular timers
  if (typeof (cleanupTimer as any).unref === 'function') (cleanupTimer as any).unref()
}

async function memoryRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || entry.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs }
  }
  entry.count++
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

// ─── Backend Upstash Redis ─────────────────────────────────────────────────
async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const ttlSec = Math.ceil(windowMs / 1000)
    // INCR + EXPIRE NX en una sola llamada via pipeline
    const resp = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, ttlSec, 'NX'],
        ['PTTL', key],
      ]),
    })
    if (!resp.ok) return null
    const result = await resp.json() as Array<{ result: number | string }>
    const count = Number(result[0]?.result || 0)
    const pttl = Number(result[2]?.result || windowMs)
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + (pttl > 0 ? pttl : windowMs),
    }
  } catch {
    return null
  }
}

// ─── API pública ────────────────────────────────────────────────────────────
export type RateLimitConfig = {
  /** Identificador único del rate limit (ej: 'login', 'parent-chat'). */
  name: string
  /** Máximo de requests permitidos en la ventana. */
  limit: number
  /** Ventana de tiempo en milisegundos. */
  windowMs: number
}

/**
 * Comprueba si una IP/usuario está bajo rate limit.
 * @param identifier IP del cliente, user.id, o cualquier string único.
 * @param config configuración del límite.
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `rl:${config.name}:${identifier}`
  const upstash = await upstashRateLimit(key, config.limit, config.windowMs)
  if (upstash) return upstash
  return memoryRateLimit(key, config.limit, config.windowMs)
}

// Presets comunes para reutilizar
export const RATE_LIMITS = {
  // Login: 10 intentos cada 15 min (anti brute force)
  LOGIN:          { name: 'login',          limit: 10,   windowMs: 15 * 60 * 1000 },
  // Chat con ARIA / VADI: 60 mensajes por hora
  AI_CHAT:        { name: 'ai-chat',        limit: 60,   windowMs: 60 * 60 * 1000 },
  // Generación de reportes Word: 20 por hora (costoso)
  REPORT_GENERATION: { name: 'report-gen',  limit: 20,   windowMs: 60 * 60 * 1000 },
  // OCR de documentos: 30 por hora
  OCR:            { name: 'ocr',            limit: 30,   windowMs: 60 * 60 * 1000 },
  // API genérica: 300 por minuto
  API_GENERIC:    { name: 'api-generic',    limit: 300,  windowMs: 60 * 1000 },
  // Verificación pública de QR: 100 por hora por IP (anti-scraping)
  PUBLIC_VERIFY:  { name: 'public-verify',  limit: 100,  windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitConfig>

/**
 * Helper: extraer IP del request (Vercel/Next.js).
 */
export function getClientIP(req: Request | { headers: Headers | Record<string, string> }): string {
  const headers: any = (req as any).headers
  const get = (k: string): string | null => {
    if (headers instanceof Headers) return headers.get(k)
    return headers?.[k] || headers?.[k.toLowerCase()] || null
  }
  const xff = get('x-forwarded-for') || get('x-real-ip') || get('cf-connecting-ip')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}
