// lib/audit-log.ts
// ════════════════════════════════════════════════════════════════════════════
// 📋 Helper para registrar eventos en audit_log
//
// Uso desde un endpoint API:
//
//   import { logAuditEvent } from '@/lib/audit-log'
//
//   await logAuditEvent({
//     action: 'delete',
//     resource_type: 'evaluacion',
//     resource_id: evaluacion.id,
//     child_id: evaluacion.child_id,
//     description: `Evaluación inicial eliminada para ${childName}`,
//     userId: profile?.id,
//     userEmail: profile?.email,
//     userRole: profile?.role,
//     req,
//   })
//
// Es "best-effort": si falla la escritura, no rompe el flujo principal.
// ════════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { NextRequest } from 'next/server'

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout' | 'login_failed'
  | 'export' | 'view'
  | 'generate_report'
  | 'mfa_enroll' | 'mfa_verify' | 'mfa_disable'
  | 'password_change' | 'password_reset'
  | 'role_change' | 'permission_grant' | 'permission_revoke'
  | 'invalidate_document' | 'verify_document'
  | 'send_message'

export type AuditResourceType =
  | 'evaluacion' | 'paciente' | 'sesion_aba' | 'programa_aba' | 'objetivo'
  | 'documento' | 'ficha' | 'reporte'
  | 'usuario' | 'config' | 'terapia_catalogo'
  | 'pago' | 'cita' | 'chat'
  | 'mfa' | 'auth'

type AuditEntry = {
  action: AuditAction
  resource_type: AuditResourceType
  resource_id?: string | null
  child_id?: string | null
  description?: string
  metadata?: Record<string, any>

  // Usuario (uno o ambos)
  userId?: string | null
  userEmail?: string | null
  userRole?: string | null

  // Resultado
  success?: boolean
  errorMessage?: string

  // Request original (opcional, para extraer IP y UA)
  req?: NextRequest | Request | { headers: Headers | Record<string, string> } | null
}

function extractIp(req: any): string | null {
  if (!req) return null
  const headers: any = req.headers
  const get = (k: string): string | null => {
    if (headers instanceof Headers) return headers.get(k)
    return headers?.[k] || headers?.[k.toLowerCase()] || null
  }
  const xff = get('x-forwarded-for') || get('x-real-ip') || get('cf-connecting-ip')
  if (xff) return xff.split(',')[0].trim()
  return null
}

function extractUA(req: any): string | null {
  if (!req) return null
  const headers: any = req.headers
  if (headers instanceof Headers) return headers.get('user-agent')
  return headers?.['user-agent'] || null
}

/**
 * Registra un evento de auditoría. NO lanza excepciones (best-effort).
 */
export async function logAuditEvent(entry: AuditEntry): Promise<void> {
  try {
    const payload = {
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
      user_role: entry.userRole || null,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id || null,
      child_id: entry.child_id || null,
      description: entry.description || null,
      metadata: entry.metadata || {},
      ip_address: extractIp(entry.req),
      user_agent: extractUA(entry.req),
      success: entry.success ?? true,
      error_message: entry.errorMessage || null,
    }

    const { error } = await supabaseAdmin.from('audit_log').insert(payload)
    if (error) {
      console.warn('[audit-log] No se pudo escribir entrada:', error.message)
    }
  } catch (e: any) {
    // Nunca propagar — el audit log no debe romper el flujo principal
    console.warn('[audit-log] excepción:', e?.message || e)
  }
}

/**
 * Helper que envuelve una acción y la audita automáticamente.
 * Si la acción lanza error, registra success=false.
 */
export async function withAudit<T>(
  entry: Omit<AuditEntry, 'success' | 'errorMessage'>,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn()
    await logAuditEvent({ ...entry, success: true })
    return result
  } catch (err: any) {
    await logAuditEvent({ ...entry, success: false, errorMessage: err?.message || String(err) })
    throw err
  }
}
