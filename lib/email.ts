// lib/email.ts
// Envío de emails via Gmail SMTP + Nodemailer v8
// Variables requeridas: GMAIL_USER, GMAIL_PASS (contraseña de aplicación de 16 chars)

import { createTransport } from 'nodemailer'

const CENTRO = process.env.CENTRO_NOMBRE || 'Jugando Aprendo'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_PASS?.replace(/\s/g, '') // quita espacios de la app password
  if (!user || !pass) {
    console.log('[Email] GMAIL_USER / GMAIL_PASS no configurados — omitido')
    return null
  }
  // Nodemailer v8: usar SMTP directo, NO service:'gmail' (fue eliminado en v8)
  return createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  })
}

// ── Envío base ────────────────────────────────────────────────────────────────
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) return false
  try {
    await transporter.sendMail({
      from: `"${CENTRO}" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`[Email] ✅ Enviado → ${to}`)
    return true
  } catch (e) {
    console.error('[Email] Error enviando:', e)
    return false
  }
}

// ── Template HTML ─────────────────────────────────────────────────────────────
function wrapHTML(content: string): string {
  return `
  <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
    .card { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px;
            box-shadow: 0 2px 12px rgba(0,0,0,.08); overflow: hidden; }
    .header { background: linear-gradient(135deg,#7c3aed,#9333ea); padding: 28px 32px; }
    .header h1 { color: #fff; margin: 0; font-size: 20px; }
    .header p  { color: #ddd6fe; margin: 4px 0 0; font-size: 13px; }
    .body { padding: 28px 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .row { background: #f9fafb; border-radius: 10px; padding: 12px 16px; margin: 16px 0; }
    .row p { margin: 4px 0; }
    .row strong { color: #6d28d9; }
    .footer { padding: 16px 32px; background: #f9fafb; text-align: center;
              font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style></head><body>
  <div class="card">
    <div class="header">
      <h1>${CENTRO}</h1>
      <p>Sistema de citas — Vanty</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">Este es un mensaje automático. Por favor no respondas a este email.</div>
  </div></body></html>`
}

// ── Templates ─────────────────────────────────────────────────────────────────
interface CitaVars {
  paciente: string; fecha: string; hora: string
  servicio?: string; modalidad?: string; link?: string; secretaria?: string
}

export function buildEmailCita(accion: 'nueva' | 'actualizada' | 'cancelada', vars: CitaVars) {
  const { paciente, fecha, hora, servicio = 'Terapia', modalidad = 'Presencial', link } = vars
  const emojis  = { nueva: '📅', actualizada: '🔄', cancelada: '❌' }
  const titulos = {
    nueva:       `Nueva cita programada para ${paciente}`,
    actualizada: `Cita actualizada — ${paciente}`,
    cancelada:   `Cita cancelada — ${paciente}`,
  }
  const mensajes = {
    nueva:       `Se ha programado una nueva cita para <strong>${paciente}</strong>.`,
    actualizada: `Los datos de la cita de <strong>${paciente}</strong> han sido actualizados.`,
    cancelada:   `La cita de <strong>${paciente}</strong> ha sido cancelada. Contactá al centro para reprogramar.`,
  }
  const subject = `${emojis[accion]} ${titulos[accion]} — ${CENTRO}`
  const html = wrapHTML(`
    <p>${mensajes[accion]}</p>
    <div class="row">
      <p><strong>📅 Fecha:</strong> ${fecha}</p>
      <p><strong>🕐 Hora:</strong> ${hora}</p>
      <p><strong>🩺 Servicio:</strong> ${servicio}</p>
      <p><strong>📍 Modalidad:</strong> ${modalidad}</p>
      ${link ? `<p><strong>🔗 Videollamada:</strong> <a href="${link}">${link}</a></p>` : ''}
    </div>
    ${accion === 'cancelada'
      ? '<p style="color:#dc2626">Si tenés preguntas, contactá directamente con el centro.</p>'
      : '<p>Podés ver todos los detalles en tu portal <strong>Vanty</strong>.</p>'
    }
  `)
  return { subject, html }
}

export function buildEmailAdmin(accion: 'nueva' | 'actualizada' | 'cancelada', vars: CitaVars) {
  const { paciente, fecha, hora, servicio = 'Terapia', secretaria = 'Secretaria' } = vars
  const labels = {
    nueva: '✅ Nueva cita creada', actualizada: '🔄 Cita actualizada', cancelada: '❌ Cita cancelada',
  }
  const subject = `${labels[accion]} — ${paciente} | ${CENTRO}`
  const html = wrapHTML(`
    <p>La secretaria <strong>${secretaria}</strong> realizó una acción en la agenda:</p>
    <div class="row">
      <p><strong>Acción:</strong> ${labels[accion]}</p>
      <p><strong>Paciente:</strong> ${paciente}</p>
      <p><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Hora:</strong> ${hora}</p>
      <p><strong>Servicio:</strong> ${servicio}</p>
    </div>
    <p>Revisá los detalles en el panel de administración de <strong>Vanty</strong>.</p>
  `)
  return { subject, html }
}
