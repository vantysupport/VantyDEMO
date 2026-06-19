// lib/edge-tts.ts
//
// Síntesis de voz GRATUITA usando el servicio neuronal de Microsoft Edge
// (las mismas voces que usa el "Leer en voz alta" de Edge / Narrador).
// No requiere API key. El audio se genera al momento y NO se almacena.
//
// Implementa el protocolo WebSocket de speech.platform.bing.com, incluyendo
// el token anti-abuso Sec-MS-GEC que Microsoft añadió en 2024.

import crypto from 'crypto'
import WebSocket from 'ws'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
// Debe corresponder a una versión de Chromium/Edge razonablemente reciente; si
// Microsoft empieza a rechazar (HTTP 403), basta con subir este número (y el de
// User-Agent). Configurable por env por si hace falta actualizarlo sin redeploy.
const SEC_MS_GEC_VERSION = process.env.EDGE_TTS_VERSION || '1-138.0.3351.65'
const CHROMIUM_MAJOR     = (SEC_MS_GEC_VERSION.match(/^1-(\d+)/)?.[1]) || '138'
const WSS_BASE = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'

// Token rotativo (cambia cada 5 minutos) — SHA256 de los "ticks" de Windows + el token de cliente.
// IMPORTANTE: se usa aritmética float64 (igual que el cliente oficial). A esta magnitud
// el float pierde precisión en los últimos dígitos, y el servidor valida contra ESE valor;
// usar enteros exactos (BigInt) produce un token distinto y el servidor responde 403.
function generateSecMsGec(): string {
  let ticks = Date.now() / 1000   // segundos UNIX (float, con fracción)
  ticks += 11644473600            // segundos entre 1601-01-01 y 1970-01-01
  ticks -= ticks % 300            // redondear hacia abajo al bloque de 5 minutos
  ticks *= 1e7                    // a intervalos de 100 ns (float)
  return crypto
    .createHash('sha256')
    .update(ticks.toFixed(0) + TRUSTED_CLIENT_TOKEN, 'ascii')
    .digest('hex')
    .toUpperCase()
}

function dateToString(): string {
  const d = new Date()
  const days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export type EdgeTTSOptions = {
  voice?: string   // p. ej. 'es-PE-CamilaNeural'
  lang?: string    // p. ej. 'es-PE' (si se omite, se deriva de la voz)
  rate?: string    // p. ej. '+0%', '-10%'
  pitch?: string   // p. ej. '+0Hz'
  volume?: string  // p. ej. '+0%'
}

/**
 * Genera audio MP3 a partir de texto. Devuelve un Buffer (audio/mpeg).
 * Nada se persiste: el buffer se construye en memoria y se descarta tras enviarlo.
 */
export async function synthesizeEdgeTTS(text: string, opts: EdgeTTSOptions = {}): Promise<Buffer> {
  const voice  = opts.voice || 'es-PE-CamilaNeural'
  const lang   = opts.lang || voice.split('-').slice(0, 2).join('-') || 'es-PE'
  const rate   = opts.rate   || '+0%'
  const pitch  = opts.pitch  || '+0Hz'
  const volume = opts.volume || '+0%'

  const url =
    `${WSS_BASE}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${generateSecMsGec()}` +
    `&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

  return new Promise<Buffer>((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: {
        'Pragma':          'no-cache',
        'Cache-Control':   'no-cache',
        'Origin':          'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          `(KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
      },
    })

    const chunks: Buffer[] = []
    let done = false

    const timeout = setTimeout(() => finish(new Error('Edge TTS timeout')), 20000)

    const finish = (err?: Error) => {
      if (done) return
      done = true
      clearTimeout(timeout)
      try { ws.close() } catch { /* noop */ }
      if (err) reject(err)
      else resolve(Buffer.concat(chunks))
    }

    ws.on('open', () => {
      const date = dateToString()

      // 1) Configuración de salida (MP3 mono 24 kHz)
      ws.send(
        `X-Timestamp:${date}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":` +
        `{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
        `"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
      )

      // 2) SSML con la voz, idioma y prosodia
      const requestId = crypto.randomUUID().replace(/-/g, '')
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'>` +
        `<voice name='${voice}'>` +
        `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>${escapeXml(text)}</prosody>` +
        `</voice></speak>`
      ws.send(
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${date}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml
      )
    })

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Frame binario: [uint16 BE = longitud de cabecera][cabecera][audio]
        if (data.length < 2) return
        const headerLen = data.readUInt16BE(0)
        if (data.length > headerLen + 2) chunks.push(data.subarray(headerLen + 2))
      } else {
        // Frame de texto: el servidor avisa "turn.end" cuando terminó el audio
        if (data.toString('utf8').includes('Path:turn.end')) finish()
      }
    })

    ws.on('error', e => finish(e instanceof Error ? e : new Error(String(e))))
    ws.on('close', () => finish())
  })
}
