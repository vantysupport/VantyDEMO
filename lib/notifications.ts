// lib/notifications.ts
// Canal único de notificaciones: WhatsApp via microservicio Baileys
// Variables: WSP_SERVICE_URL, WSP_SERVICE_SECRET

import { sendWhatsApp, wspTemplate, notifyParent as wspNotifyParent, type WspTipo } from './whatsapp'
import { supabaseAdmin } from './supabase-admin'

export type NotifTipo = WspTipo
export type NotifLocale = 'es'

export interface Notif {
  tipo: NotifTipo
  vars?: Record<string, string>
  locale?: NotifLocale
}

// ── Obtener número de admin del centro ───────────────────────────────────────
async function getAdminPhone(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('phone')
      .in('role', ['admin', 'jefe'])
      .not('phone', 'is', null)
      .limit(1)
      .maybeSingle()
    return (data as any)?.phone ?? null
  } catch {
    return null
  }
}

// ── Estado del servicio ───────────────────────────────────────────────────────
export function getNotifStatus() {
  const configured = !!(process.env.WSP_SERVICE_URL && process.env.WSP_SERVICE_SECRET)
  return {
    channel: configured ? 'baileys' : 'none',
    configured,
    label: configured ? '✅ WhatsApp (Baileys)' : '❌ Sin configurar',
  }
}

// ── Notificar al admin del centro (fire-and-forget) ───────────────────────────
export function notifyAsync(notif: Notif): Promise<boolean> {
  return notify(notif).catch(() => false)
}

export async function notify(notif: Notif): Promise<boolean> {
  const adminPhone = await getAdminPhone()
  if (!adminPhone) {
    console.log('[Notify] Sin número de admin configurado')
    return false
  }
  const message = wspTemplate(notif.tipo, notif.vars ?? {})
  return sendWhatsApp(adminPhone, message)
}

// ── Notificar directo a un padre ──────────────────────────────────────────────
export async function notifyParentDirect(
  parentPhone: string | null | undefined,
  tipo: NotifTipo,
  vars: Record<string, string> = {}
): Promise<void> {
  if (!parentPhone) {
    await notifyAsync({ tipo, vars })
    return
  }
  await wspNotifyParent(parentPhone, tipo, vars)
}

// ── Helper: enviar WhatsApp a un padre + notificar al admin ──────────────────
export async function sendWspToParent(
  parentPhone: string,
  message: string
): Promise<boolean> {
  return sendWhatsApp(parentPhone, message)
}

// ── Helper: construir mensaje para un padre ───────────────────────────────────
export function buildParentMessage(
  tipo: NotifTipo,
  vars: Record<string, string> = {}
): string {
  return wspTemplate(tipo, vars)
}
