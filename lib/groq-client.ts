// lib/groq-client.ts
// Cliente Groq — con fallback automático entre modelos cuando se agota el límite diario

import { logServerError } from '@/lib/log-server-error'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Cadena de fallback: si el modelo principal falla por rate limit,
// se prueba automáticamente el siguiente en la lista.
export const GROQ_MODELS = {
  SMART: 'llama-3.3-70b-versatile',   // reportes, análisis clínicos
  FAST:  'llama-3.1-8b-instant',      // chats rápidos
  LONG:  'llama-3.3-70b-versatile',   // contexto largo
  // Modelo "compound" de Groq: agente con BÚSQUEDA WEB + ejecución de código integrados.
  // Útil cuando la pregunta requiere info actualizada (research reciente, news, datos en vivo).
  // Cuesta lo mismo que un modelo normal en el plan free pero tarda un poco más.
  WEB:   'groq/compound-mini',
}

// Orden de fallback cuando se alcanza el límite de tokens/día o el contexto es muy grande
// Modelos ordenados por TPM (tokens-per-minute) DESCENDENTE — los grandes primero
// para que el contexto largo no choque con límites de modelos chicos.
// Solo modelos activos en producción (mayo 2026)
const FALLBACK_CHAIN = [
  'llama-3.3-70b-versatile',   // 12000 TPM · mejor calidad — modelo principal
  'openai/gpt-oss-120b',       // alto TPM · máxima capacidad de contexto
  'openai/gpt-oss-20b',        // medio · GPT-OSS ligero
  'llama-3.1-8b-instant',      // 6000 TPM · último recurso (puede fallar con contexto grande)
]

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Info de un 429 — distingue límite por minuto (se resuelve solo en segundos) de límite diario. */
type RateLimitInfo = {
  rateLimited: true
  model: string
  rawMessage: string
  /** true = TPM/RPM (por minuto, se resuelve rápido) · false = TPD/RPD (diario, se resetea a medianoche UTC) */
  isPerMinute: boolean
  /** segundos de espera reportados por Groq, si los incluyó */
  retryAfterSeconds: number | null
}

function parseRateLimitInfo(model: string, rawMessage: string, retryAfterHeader: string | null): RateLimitInfo {
  const isPerMinute = /\b(TPM|RPM)\b/i.test(rawMessage)

  // Groq suele incluir algo como "Please try again in 6m11.52s" — lo parseamos a segundos.
  let retryAfterSeconds: number | null = retryAfterHeader ? Number(retryAfterHeader) : null
  if (retryAfterSeconds === null || Number.isNaN(retryAfterSeconds)) {
    const match = rawMessage.match(/try again in\s+(?:([\d.]+)m)?(?:([\d.]+)s)?/i)
    if (match) {
      const mins = match[1] ? parseFloat(match[1]) : 0
      const secs = match[2] ? parseFloat(match[2]) : 0
      if (mins || secs) retryAfterSeconds = Math.ceil(mins * 60 + secs)
    }
  }

  return { rateLimited: true, model, rawMessage, isPerMinute, retryAfterSeconds }
}

// Intentar un modelo específico — retorna { text } si funcionó, o RateLimitInfo si hubo 429/413
// (para registrar y probar el siguiente modelo). Lanza solo en errores NO recuperables.
async function tryModel(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  temperature: number,
  maxTokens: number,
): Promise<{ text: string } | RateLimitInfo> {
  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: false }),
    })

    if (res.status === 429) {
      const err = await res.json().catch(() => ({}))
      const rawMsg: string = err?.error?.message || ''
      const info = parseRateLimitInfo(model, rawMsg, res.headers.get('retry-after'))
      console.warn(`[Groq] Rate limit en ${model}: ${rawMsg || '429'}`)
      return info
    }

    // 413 = Request too large — el modelo no acepta el tamaño del contexto.
    //       Probamos con el siguiente (puede tener más TPM o contexto).
    if (res.status === 413) {
      const err = await res.json().catch(() => ({}))
      const rawMsg: string = err?.error?.message || '413'
      console.warn(`[Groq] Payload too large en ${model}: ${rawMsg}`)
      return { rateLimited: true, model, rawMessage: rawMsg, isPerMinute: false, retryAfterSeconds: null }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(`Groq error ${res.status} (${model}): ${err?.error?.message || res.statusText}`)
    }

    const data = await res.json()
    return { text: data.choices?.[0]?.message?.content || '' }
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('413') || msg.includes('too large')) {
      return { rateLimited: true, model, rawMessage: msg, isPerMinute: /\b(TPM|RPM)\b/i.test(msg), retryAfterSeconds: null }
    }
    throw err
  }
}

/** Error tipado para que las rutas /api puedan mostrar al usuario un mensaje amable y simple,
 *  mientras el detalle técnico completo va al panel del programador (error_logs). */
export class GroqExhaustedError extends Error {
  /** true si TODOS los modelos chocaron con límite por minuto (se resuelve en breve) */
  isPerMinute: boolean
  /** segundos estimados hasta poder reintentar — null si es límite diario o desconocido */
  retryAfterSeconds: number | null
  constructor(isPerMinute: boolean, retryAfterSeconds: number | null, technicalMessage: string) {
    super(technicalMessage)
    this.name = 'GroqExhaustedError'
    this.isPerMinute = isPerMinute
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function callGroq(
  messages: GroqMessage[],
  options: {
    model?: string
    temperature?: number
    maxTokens?: number
    maxRetries?: number
  } = {}
): Promise<string> {
  const {
    model = GROQ_MODELS.SMART,
    temperature = 0.5,
    maxTokens = 2500,
  } = options

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    await logServerError('GROQ_API_KEY no configurada', 'Falta la variable de entorno GROQ_API_KEY', 'groq')
    throw new Error('GROQ_API_KEY no configurada')
  }

  // Construir cadena de fallback: modelo preferido primero, luego los alternativos
  const modelsToTry = [model, ...FALLBACK_CHAIN.filter(m => m !== model)]

  const rateLimitHits: RateLimitInfo[] = []

  for (const currentModel of modelsToTry) {
    let result: { text: string } | RateLimitInfo
    try {
      result = await tryModel(apiKey, currentModel, messages, temperature, maxTokens)
    } catch (err) {
      // Error NO recuperable (no es rate limit) → lo registramos para el programador y propagamos.
      await logServerError(`Groq error (${currentModel})`, (err as Error)?.stack || (err as Error)?.message || String(err), 'groq')
      throw err
    }
    if ('text' in result) {
      if (currentModel !== model) {
        console.info(`[Groq] Usando fallback: ${currentModel} (preferido: ${model})`)
      }
      return result.text
    }
    // Era rate limit / payload too large → registrar y probar el siguiente modelo
    rateLimitHits.push(result)
  }

  // Todos los modelos chocaron con límite. Determinar si es por-minuto (se resuelve solo)
  // o diario (se resetea a medianoche UTC) para dar el mensaje correcto al programador y al usuario.
  const allPerMinute = rateLimitHits.length > 0 && rateLimitHits.every(h => h.isPerMinute)
  const bestRetry = rateLimitHits.reduce<number | null>((min, h) => {
    if (h.retryAfterSeconds == null) return min
    if (min == null) return h.retryAfterSeconds
    return Math.min(min, h.retryAfterSeconds)
  }, null)

  const detail = rateLimitHits.map(h => `${h.model}: ${h.rawMessage || '(sin detalle)'}`).join('\n')
  const summary = allPerMinute
    ? `Groq: límite por minuto (TPM/RPM) alcanzado en todos los modelos${bestRetry ? ` — se libera en ~${bestRetry}s` : ''}`
    : 'Groq: límite diario (TPD/RPD) agotado en todos los modelos — se restablece a medianoche (hora UTC)'

  await logServerError(summary, detail, 'groq')

  throw new GroqExhaustedError(allPerMinute, bestRetry, summary)
}

// Helper para prompt simple (sistema + usuario)
export async function callGroqSimple(
  systemPrompt: string,
  userPrompt: string,
  options: Parameters<typeof callGroq>[1] = {}
): Promise<string> {
  return callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options
  )
}
