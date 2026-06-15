// lib/aria-rate-limit.ts — Rate limiting de ARIA (IA de padres).
// Configurable desde /control (app_settings.aria_limits). A prueba de fallos:
// si algo falla, NO bloquea (fail open) para no dejar sin IA por un error.

import { supabaseAdmin } from '@/lib/supabase-admin'

export type AriaRateResult = { allowed: boolean; message?: string; retryAfterMinutes?: number }

export async function checkAriaRateLimit(key: string): Promise<AriaRateResult> {
  try {
    if (!key) return { allowed: true }

    const { data: s } = await supabaseAdmin
      .from('app_settings').select('aria_limits').eq('id', 1).maybeSingle()
    const lim = ((s as { aria_limits?: Record<string, unknown> } | null)?.aria_limits || {}) as Record<string, unknown>

    const enabled = !!lim.enabled
    const maxMessages = Math.floor(Number(lim.maxMessages) || 0)
    const windowHours = Math.max(1, Math.floor(Number(lim.windowHours) || 5))
    // Desactivado o sin tope → sin límite.
    if (!enabled || maxMessages <= 0) return { allowed: true }

    const now = Date.now()
    const windowMs = windowHours * 3600_000

    const { data: row } = await supabaseAdmin
      .from('aria_usage').select('count, window_start').eq('rl_key', key).maybeSingle()
    let count = Number((row as { count?: number } | null)?.count || 0)
    const ws = (row as { window_start?: string } | null)?.window_start
    let windowStart = ws ? new Date(ws).getTime() : 0

    // Ventana expirada (o inexistente) → reiniciar.
    if (!windowStart || now - windowStart >= windowMs) {
      windowStart = now
      count = 0
    }

    if (count >= maxMessages) {
      const retryMs = windowMs - (now - windowStart)
      const retryAfterMinutes = Math.max(1, Math.ceil(retryMs / 60000))
      const h = Math.floor(retryAfterMinutes / 60), m = retryAfterMinutes % 60
      const tiempo = h > 0 ? `${h} h ${m} min` : `${m} min`
      return {
        allowed: false,
        retryAfterMinutes,
        message: `Has alcanzado el límite de consultas a ARIA (${maxMessages} cada ${windowHours} h). Podrás volver a preguntar en ${tiempo}. Para más, contacta al centro.`,
      }
    }

    // Registrar el consumo de este mensaje.
    await supabaseAdmin.from('aria_usage').upsert({
      rl_key: key,
      count: count + 1,
      window_start: new Date(windowStart).toISOString(),
      updated_at: new Date(now).toISOString(),
    }, { onConflict: 'rl_key' })

    return { allowed: true }
  } catch {
    return { allowed: true } // fail open
  }
}
