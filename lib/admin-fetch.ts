// lib/admin-fetch.ts — fetch del lado cliente que adjunta el token de sesión.
// Para llamar rutas /api/admin/* que ahora exigen rol de personal por token.

import { supabase } from '@/lib/supabase'

export async function adminFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = (await supabase.auth.getSession()).data.session?.access_token || ''
  return fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  })
}
