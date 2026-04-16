// lib/whatsapp.ts
// Sistema de notificaciones WhatsApp — Baileys (WhatsApp Web)
// El microservicio corre en Railway/Render, escaneas QR una vez y queda conectado.
// Variables requeridas: WSP_SERVICE_URL, WSP_SERVICE_SECRET

export type WspTipo =
  | 'cita_confirmada' | 'cita_cancelada' | 'sesion_iniciada'
  | 'formulario_nuevo' | 'informe_nuevo'
  | 'alerta_clinica'  | 'mensaje_terapeuta'
  | 'recurso_nuevo'   | 'custom'

export type WspLocale = 'es'

// ── Templates de mensajes ─────────────────────────────────────────────────────
export function wspTemplate(tipo: WspTipo, vars: Record<string, string> = {}): string {
  const v = vars
  const centro = process.env.CENTRO_NOMBRE || 'Jugando Aprendo'
  const T: Record<WspTipo, string> = {
    cita_confirmada:   `✅ *Cita confirmada — ${centro}*\n📅 ${v.fecha} a las ${v.hora}\n👤 Paciente: ${v.paciente}\n📍 ${v.tipo || 'Presencial'}${v.link ? `\n🔗 Videollamada: ${v.link}` : ''}\n\nVe los detalles en tu portal Vanty 💜`,
    cita_cancelada:    `❌ *Cita cancelada — ${centro}*\n📅 ${v.fecha} a las ${v.hora}\n👤 Paciente: ${v.paciente}\n\nLamentamos el inconveniente. Contactá a recepción para reagendar.\n_Vanty_ 💜`,
    sesion_iniciada:   `🟢 *¡Tu sesión está comenzando! — ${centro}*\n📅 ${v.fecha} a las ${v.hora}\n👤 Paciente: ${v.paciente}${v.link ? `\n\n🔗 *Únete ahora:*\n${v.link}` : ''}\n\n¡El terapeuta te está esperando! 💜\n_Vanty_`,
    formulario_nuevo:  `📋 *Nuevo formulario — ${centro}*\nTipo: ${v.tipo || 'Formulario'}\nPaciente: ${v.paciente}\n\nRevisalo en tu portal 👆\n_Vanty_ 💜`,
    informe_nuevo:     `📊 *Nuevo informe disponible — ${centro}*\nPaciente: ${v.paciente}${v.periodo ? `\nPeríodo: ${v.periodo}` : ''}\n\nYa podés verlo en Vanty 👆\n_${centro}_ 💜`,
    alerta_clinica:    `⚠️ *Alerta — ${centro}*\nPaciente: ${v.paciente}\n${v.descripcion || ''}\n_Vanty_ 💜`,
    mensaje_terapeuta: `💬 *Mensaje de tu terapeuta — ${centro}*\n👤 ${v.terapeuta || 'Tu terapeuta'}\n\n"${v.preview || ''}"\n\nRespondé en Vanty 👆\n_${centro}_ 💜`,
    recurso_nuevo:     `📚 *Nuevo recurso — ${centro}*\n${v.titulo || ''}${v.descripcion ? `\n${v.descripcion}` : ''}\n\nEncontralo en la Biblioteca 📖\n_Vanty_ 💜`,
    custom:            v.mensaje || '',
  }
  return T[tipo] ?? v.mensaje ?? ''
}

// ── Envío via microservicio Baileys ───────────────────────────────────────────
export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const url    = process.env.WSP_SERVICE_URL
  const secret = process.env.WSP_SERVICE_SECRET
  if (!url || !secret) {
    console.log('[WhatsApp] Microservicio no configurado — omitido')
    return false
  }
  try {
    const res = await fetch(`${url}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-service-secret': secret },
      body: JSON.stringify({ to: to.replace(/\s/g, ''), message }),
      signal: AbortSignal.timeout(8000),
    })
    const ok = res.ok
    console.log(`[WhatsApp] ${ok ? '✅' : '❌'} → ${to}`)
    return ok
  } catch (e) {
    console.error('[WhatsApp] Error:', e)
    return false
  }
}

// ── Enviar a un padre (fire-and-forget) ──────────────────────────────────────
export async function notifyParent(
  parentPhone: string | null | undefined,
  tipo: WspTipo,
  vars: Record<string, string> = {}
): Promise<void> {
  if (!parentPhone) return
  const message = wspTemplate(tipo, vars)
  sendWhatsApp(parentPhone, message).catch(() => {})
}

// ── Broadcast a múltiples padres ─────────────────────────────────────────────
export async function broadcastWhatsApp(
  phones: string[],
  tipo: WspTipo,
  vars: Record<string, string> = {}
): Promise<{ sent: number; failed: number }> {
  const message = wspTemplate(tipo, vars)
  const results = await Promise.allSettled(
    phones.map(phone => sendWhatsApp(phone, message))
  )
  const sent   = results.filter(r => r.status === 'fulfilled' && r.value).length
  const failed = results.length - sent
  return { sent, failed }
}
