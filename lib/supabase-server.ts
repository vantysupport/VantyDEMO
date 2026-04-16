// ============================================================================
// SUPABASE SERVER CLIENT - lib/supabase-server.ts
// ============================================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
// 1. ELIMINAMOS O COMENTAMOS EL IMPORT QUE FALLA
// import type { Database } from '@/types/supabase'

export async function createClient() {
  const cookieStore = await cookies()

  // 2. CAMBIAMOS <Database> POR <any>
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignorar error en Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignorar error en Server Components
          }
        },
      },
    }
  )
}

// Helper para verificar sesión en Server Components
export async function getSession() {
  const supabase = await createClient()
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error || !session) {
    return null
  }
  
  return session
}

// Helper para obtener perfil del usuario autenticado
export async function getProfile() {
  const session = await getSession()
  if (!session) return null
  
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()
  
  if (error) {
    console.error('Error fetching profile:', error)
    return null
  }
  
  return profile
}

// Helper para verificar si el usuario es admin/jefe/especialista
export async function isAdmin() {
  const profile = await getProfile()
  return profile?.role === 'jefe' || profile?.role === 'admin' || profile?.role === 'especialista'
}

// Helper para verificar si el usuario es padre
export async function isParent() {
  const profile = await getProfile()
  return profile?.role === 'padre'
}
