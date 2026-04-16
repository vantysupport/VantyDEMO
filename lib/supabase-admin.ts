// ARCHIVO: lib/supabase-admin.ts (NUEVO)
import { createClient } from '@supabase/supabase-js'

// Cliente admin (SOLO para usar en server actions o api routes)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)