// lib/log-server-error.ts — registra un error del lado SERVIDOR (rutas /api,
// llamadas a APIs externas como Grok/Gemini/ElevenLabs, errores de base, etc.)
// en error_logs. Solo lo verá el programador en /control. Nunca lanza.

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function logServerError(message: string, detail = '', source = 'server'): Promise<void> {
  try {
    await supabaseAdmin.from('error_logs').insert({
      message: String(message || 'Error del servidor').slice(0, 500),
      detail: String(detail || '').slice(0, 4000),
      source: String(source || 'server').slice(0, 100),
    })
  } catch { /* el logging nunca debe romper la petición */ }
}
