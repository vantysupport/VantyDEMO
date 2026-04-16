/**
 * Vanty WhatsApp Microservice — ES Module version
 * Variables requeridas en Railway:
 *   WSP_SERVICE_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import express from 'express'
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  proto,
} from '@whiskeysockets/baileys'
import QRCode from 'qrcode'
import pino from 'pino'

const PORT   = process.env.PORT || 3000
const SECRET = process.env.WSP_SERVICE_SECRET || 'dev-secret'
const SB_URL = process.env.SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SB_URL || !SB_KEY) console.error('FALTAN SUPABASE_URL o SUPABASE_SERVICE_KEY')

let sock           = null
let qrBase64       = null
let isConnected    = false
let connectedPhone = null
let reconnecting   = false

const logger = pino({ level: 'silent' })

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function sbGet(key) {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/wsp_sessions?key=eq.${encodeURIComponent(key)}&select=value`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    )
    const rows = await res.json()
    return rows?.[0]?.value ?? null
  } catch { return null }
}

async function sbSet(key, value) {
  try {
    await fetch(`${SB_URL}/rest/v1/wsp_sessions`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key, value }),
    })
  } catch (e) { console.error('[SB] Error guardando:', e.message) }
}

async function sbDel(key) {
  try {
    await fetch(
      `${SB_URL}/rest/v1/wsp_sessions?key=eq.${encodeURIComponent(key)}`,
      { method: 'DELETE', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    )
  } catch {}
}

async function sbDelAll() {
  try {
    await fetch(`${SB_URL}/rest/v1/wsp_sessions`, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    })
  } catch {}
}

// ── Auth state en Supabase ────────────────────────────────────────────────────
async function useSupabaseAuthState() {
  const credsRaw = await sbGet('creds')
  const creds = credsRaw ? JSON.parse(credsRaw, BufferJSON.reviver) : initAuthCreds()

  const readData   = async (key) => { const r = await sbGet(key); return r ? JSON.parse(r, BufferJSON.reviver) : null }
  const writeData  = async (key, data) => sbSet(key, JSON.stringify(data, BufferJSON.replacer))
  const removeData = async (key) => sbDel(key)

  const state = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data = {}
        await Promise.all(ids.map(async (id) => {
          let value = await readData(`${type}-${id}`)
          if (type === 'app-state-sync-key' && value)
            value = proto.Message.AppStateSyncKeyData.fromObject(value)
          data[id] = value
        }))
        return data
      },
      set: async (data) => {
        const tasks = []
        for (const category of Object.keys(data))
          for (const id of Object.keys(data[category])) {
            const value = data[category][id]
            tasks.push(value ? writeData(`${category}-${id}`, value) : removeData(`${category}-${id}`))
          }
        await Promise.all(tasks)
      },
    },
  }

  const saveCreds = async () => writeData('creds', state.creds)
  return { state, saveCreds }
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────
async function startWhatsApp() {
  if (reconnecting) return
  reconnecting = true

  try {
    console.log('[WA] Iniciando...')
    const { state, saveCreds } = await useSupabaseAuthState()
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version, logger, auth: state,
      printQRInTerminal: false,
      browser: ['Vanty', 'Chrome', '120.0.0'],
      connectTimeoutMs: 30_000,
      keepAliveIntervalMs: 25_000,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log('[WA] QR generado')
        isConnected = false
        qrBase64 = await QRCode.toDataURL(qr)
      }

      if (connection === 'open') {
        console.log('[WA] Conectado!')
        isConnected = true; qrBase64 = null; reconnecting = false
        try { connectedPhone = (sock.user?.id || '').split(':')[0].split('@')[0] } catch {}
      }

      if (connection === 'close') {
        isConnected = false; connectedPhone = null; reconnecting = false
        const code = lastDisconnect?.error?.output?.statusCode
        if (code === DisconnectReason.loggedOut) {
          console.log('[WA] Deslogueado — limpiando sesion...')
          await sbDelAll()
          setTimeout(startWhatsApp, 2000)
          return
        }
        console.log(`[WA] Desconectado (${code}) — reconectando...`)
        setTimeout(startWhatsApp, 4000)
      }
    })

  } catch (err) {
    console.error('[WA] Error:', err.message)
    reconnecting = false
    setTimeout(startWhatsApp, 5000)
  }
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express()
app.use(express.json())

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/health') return next()
  if (req.headers['x-service-secret'] !== SECRET)
    return res.status(401).json({ error: 'No autorizado' })
  next()
})

app.get('/',       (_, res) => res.json({ status: 'ok', service: 'vanty-whatsapp' }))
app.get('/health', (_, res) => res.json({ status: 'ok' }))
app.get('/status', (_, res) => res.json({ connected: isConnected, phone: connectedPhone }))

app.get('/qr', (_, res) => {
  if (isConnected) return res.json({ connected: true })
  if (qrBase64)   return res.json({ qr: qrBase64 })
  res.json({ waiting: true })
})

app.post('/send', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ error: 'to y message requeridos' })
  if (!isConnected || !sock) return res.status(503).json({ error: 'WhatsApp no conectado' })
  try {
    const number = to.replace(/[^0-9]/g, '')
    await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message })
    console.log(`[WA] Enviado a ${number}`)
    res.json({ success: true, to: number })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/disconnect', async (_, res) => {
  try {
    if (sock) sock.logout()
    await sbDelAll()
    isConnected = false; qrBase64 = null; connectedPhone = null
    res.json({ success: true })
    setTimeout(startWhatsApp, 2000)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.listen(PORT, () => {
  console.log(`[Server] Puerto ${PORT}`)
  startWhatsApp()
})
