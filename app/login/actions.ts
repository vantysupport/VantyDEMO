'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Crear cliente de Supabase para server actions
async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}

/**
 * Función de login con validación de contraseña
 */
export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validaciones básicas
  if (!email || !password) {
    return { error: 'Por favor completa todos los campos' }
  }

  // Intentar login con Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError) {
    console.error('Error en login:', authError)
    
    // Retornar mensajes amigables
    if (authError.message.includes('Invalid login credentials')) {
      return { error: 'Correo o contraseña incorrectos' }
    }
    if (authError.message.includes('Email not confirmed')) {
      return { error: 'Por favor confirma tu correo electrónico' }
    }
    
    return { error: authError.message }
  }

  // Verificar el rol del usuario en la tabla profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', authData.user.id)
    .single()

  if (profileError) {
    console.error('Error obteniendo perfil:', profileError)
  }

  // Revalidar y redirigir según el rol
  revalidatePath('/', 'layout')
  
  if (profile?.role === 'jefe' || profile?.role === 'admin' || profile?.role === 'especialista' || email === 'vantysupport@gmail.com') {
    redirect('/admin')
  } else if (profile?.role === 'secretaria') {
    redirect('/secretaria')
  } else {
    redirect('/padre')
  }
}

/**
 * Función de registro con creación de perfil
 */
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  // Validaciones
  if (!email || !password || !fullName) {
    return { error: 'Por favor completa todos los campos' }
  }

  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres' }
  }

  // Registrar usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      // Opcional: agregar confirmación de email
      // emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (authError) {
    console.error('Error en signup:', authError)
    
    if (authError.message.includes('User already registered')) {
      return { error: 'Este correo ya está registrado. Intenta iniciar sesión.' }
    }
    
    return { error: authError.message }
  }

  // Crear perfil en la tabla profiles
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          email: email,
          full_name: fullName,
          role: 'padre', // Por defecto es padre de familia
          created_at: new Date().toISOString(),
        },
      ])

    // Ignorar error si el perfil ya existe (código 23505)
    if (profileError && profileError.code !== '23505') {
      console.error('Error creando perfil:', profileError)
      return { error: 'Usuario creado pero hubo un error al crear el perfil' }
    }
  }

  revalidatePath('/', 'layout')
  redirect('/padre')
}

/**
 * Función de logout
 */
export async function logout() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Error en logout:', error)
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/login')
}

/**
 * Función para obtener el usuario actual
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Obtener el perfil completo
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    profile,
  }
}

/**
 * Función para verificar si el usuario es admin
 */
export async function isAdmin() {
  const user = await getCurrentUser()
  
  if (!user) return false
  
  return user.profile?.role === 'jefe' || 
         user.profile?.role === 'admin' || 
         user.profile?.role === 'especialista' ||
         user.profile?.role === 'secretaria' ||
         user.email === 'vantysupport@gmail.com'
}