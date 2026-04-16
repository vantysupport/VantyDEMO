// lib/telegram.ts
// Sistema de notificaciones Telegram para Vanty
// 100% GRATIS, sin límites prácticos, sin registro de empresa
//
// ══════════════════════════════════════════════════════════════
// SETUP (3 minutos):
//
//  1. Abrir Telegram → buscar @BotFather → /newbot
//     → Nombre del bot: "Vanty Jugando Aprendo"
//     → Username: vanty_jugandoaprendo_bot (o el que quieras)
//     → BotFather te da el TOKEN → guardarlo
//
//  2. Crear un grupo en Telegram "Vanty Alertas"
//     → Agregar el bot al grupo
//     → Enviar cualquier mensaje en el grupo
//     → Abrir en navegador:
//        https://api.telegram.org/bot<TOKEN>/getUpdates
//     → Copiar el "id" de "chat" (número negativo, ej: -1001234567890)
//
//  3. En Vercel → Settings → Environment Variables:
//     TELEGRAM_BOT_TOKEN = 7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//     TELEGRAM_CHAT_ID   = -1001234567890
//
// ══════════════════════════════════════════════════════════════

export type NotifTipo =
  | 'cita_confirmada' | 'cita_cancelada'
  | 'formulario_nuevo' | 'informe_nuevo'
  | 'alerta_clinica'  | 'mensaje_terapeuta'
  | 'recurso_nuevo'   | 'custom'

export type NotifLocale = 'es'

export interface TelegramNotif {
  tipo: NotifTipo
  vars?: Record<string, string>
  locale?: NotifLocale
  chatId?: string
}

// ── Templates en español ──────────────────────────────────────────────────────
export function telegramTemplate(
  tipo: NotifTipo,
  vars: Record<string, string> = {},
  locale: NotifLocale = 'es'
): string {
  const v = vars
  const centro = process.env.CENTRO_NOMBRE || 'Jugando Aprendo'

  const T: Record<NotifTipo, string> = {
    cita_confirmada:   `✅ *Cita confirmada*\n📅 ${v.fecha} a las ${v.hora}\n👤 Paciente: ${v.paciente}\n📍 ${v.tipo || 'Presencial'}\n\n_${centro} · Vanty_`,
    cita_cancelada:    `❌ *Cita cancelada*\n📅 ${v.fecha} a las ${v.hora}\n👤 Paciente: ${v.paciente}\n\nContactar recepción para reagendar.\n_${centro} · Vanty_`,
    formulario_nuevo:  `📋 *Formulario subido*\nTipo: ${v.tipo}\nPaciente: ${v.paciente}${v.especialista ? `\nEspecialista: ${v.especialista}` : ''}\n\nRevisar en portal 👆\n_${centro} · Vanty_`,
    informe_nuevo:     `📊 *Nuevo informe disponible*\nPaciente: ${v.paciente}${v.periodo ? `\nPeríodo: ${v.periodo}` : ''}\n\nVer en Vanty 👆\n_${centro}_`,
    alerta_clinica:    `⚠️ *Alerta clínica*\nPaciente: ${v.paciente}\n${v.descripcion}\n\nRevisar Análisis Predictivo 🤖\n_${centro} · Vanty_`,
    mensaje_terapeuta: `💬 *Mensaje del terapeuta*\n👤 ${v.terapeuta}\n\n"${v.preview}"\n\nResponder en Vanty 👆\n_${centro}_`,
    recurso_nuevo:     `📚 *Nuevo recurso disponible*\n${v.titulo}${v.descripcion ? `\n${v.descripcion}` : ''}\n\nBiblioteca 📖\n_${centro} · Vanty_`,
    custom:            v.mensaje || '',
  }

  return T[tipo] ?? v.mensaje ?? ''
}

// ── Envío a Telegram ──────────────────────────────────────────────────────────
export async function sendTelegram(notif: TelegramNotif): Promise<boolean> {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = notif.chatId || process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.log('[Telegram] No configurado — omitido:', notif.tipo)
    return false
  }

  const text = telegramTemplate(notif.tipo, notif.vars || {}, notif.locale || 'es')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_notification: false,
      }),
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('[Telegram] Error:', err)
      return false
    }

    console.log('[Telegram] ✅ Enviado:', notif.tipo)
    return true
  } catch (e) {
    console.error('[Telegram] Error (no crítico):', e)
    return false
  }
}

// ── Broadcast a múltiples chats ───────────────────────────────────────────────
export async function broadcastTelegram(
  chatIds: string[],
  tipo: NotifTipo,
  vars: Record<string, string>,
  locale: NotifLocale = 'es'
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    chatIds.map(chatId => sendTelegram({ chatId, tipo, vars, locale }))
  )
  const sent   = results.filter(r => r.status === 'fulfilled' && (r as any).value).length
  const failed = results.length - sent
  return { sent, failed }
}

// ── Helper rápido ─────────────────────────────────────────────────────────────
export async function notifyAdmin(
  tipo: NotifTipo,
  vars: Record<string, string>,
  locale: NotifLocale = 'es'
): Promise<void> {
  sendTelegram({ tipo, vars, locale }).catch(() => {})
}
