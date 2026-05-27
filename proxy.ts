// 🔒 Proxy / Middleware global de seguridad SANTI
// ⚠️  Next.js 16+ con Turbopack: este archivo se llama proxy.ts (antes middleware.ts)
// ════════════════════════════════════════════════════════════════════════════
// Se ejecuta en EDGE antes de cualquier ruta y aplica 3 capas:
//   1. Auth: bloquea acceso a /admin, /secretaria, /padre, /especialista sin sesión
//   2. Role gates: cada panel solo es accesible a su rol
//   3. API protection: /api/* requiere sesión salvo rutas explícitamente públicas
//
// Las rutas estáticas (_next, favicon, imágenes, etc.) NO pasan por aquí.
// ════════════════════════════════════════════════════════════════════════════

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { rateLimit, RATE_LIMITS, getClientIP } from './lib/rate-limit'

// Rutas que NO requieren autenticación (públicas por diseño)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verificar',                  // verificación pública de documentos por QR
  '/auth/callback',
  '/landing',
  '/mfa-required',               // página de enrollment 2FA (requiere sesión pero salta los role checks)
]

// Endpoints API públicos (verificación, webhooks, etc.)
const PUBLIC_API_PATHS = [
  '/api/auth',                   // callbacks de auth
  '/api/health',                 // health check
  '/api/verificar-documento',    // verificación pública por QR
]

// Rutas por rol → si user.role === X, puede acceder a estas raíces
const ROLE_ROUTES: Record<string, string[]> = {
  jefe:          ['/admin'],
  admin:         ['/admin'],
  especialista:  ['/especialista', '/admin'], // los especialistas pueden ver /admin (mismo panel filtrado)
  terapeuta:     ['/admin'],
  secretaria:    ['/secretaria'],
  padre:         ['/padre'],
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  if (pathname.startsWith('/verificar/')) return true   // verificación con código
  if (pathname.startsWith('/auth/')) return true
  // Archivos estáticos / assets
  if (pathname.startsWith('/_next/')) return true
  if (pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?|ttf|map)$/i)) return true
  return false
}

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
}

// Mapeo de paths críticos → su preset de rate limit
function pickRateLimit(pathname: string): typeof RATE_LIMITS[keyof typeof RATE_LIMITS] | null {
  if (pathname === '/api/auth/signin' || pathname.startsWith('/api/auth/v1/token')) return RATE_LIMITS.LOGIN
  if (pathname.startsWith('/api/parent-chat')) return RATE_LIMITS.AI_CHAT
  if (pathname.startsWith('/api/admin-chat')) return RATE_LIMITS.AI_CHAT
  if (pathname.startsWith('/api/vanty-agent')) return RATE_LIMITS.AI_CHAT
  if (pathname.startsWith('/api/reporte-word')) return RATE_LIMITS.REPORT_GENERATION
  if (pathname.startsWith('/api/reporte-')) return RATE_LIMITS.REPORT_GENERATION
  if (pathname.startsWith('/api/knowledge/ocr')) return RATE_LIMITS.OCR
  if (pathname.startsWith('/verificar/')) return RATE_LIMITS.PUBLIC_VERIFY
  if (pathname.startsWith('/api/')) return RATE_LIMITS.API_GENERIC
  return null
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const res = NextResponse.next()

  // 0a. Rate limiting (corre ANTES que cualquier auth — para no gastar DB en bots)
  const rateConfig = pickRateLimit(pathname)
  if (rateConfig) {
    const ip = getClientIP(req as any)
    const r = await rateLimit(ip, rateConfig)
    res.headers.set('X-RateLimit-Limit', String(r.limit))
    res.headers.set('X-RateLimit-Remaining', String(r.remaining))
    res.headers.set('X-RateLimit-Reset', String(Math.floor(r.resetAt / 1000)))
    if (!r.allowed) {
      const retryAfter = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000))
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas solicitudes. Intentá nuevamente en unos minutos.', retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(r.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(r.resetAt / 1000)),
          },
        },
      )
    }
  }

  // 0b. Rutas explícitamente públicas → seguir sin tocar
  if (isPublicPath(pathname)) return res

  // 1. Crear cliente Supabase para leer la sesión desde cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', ...options })
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 2. Endpoints API
  if (pathname.startsWith('/api/')) {
    if (isPublicApiPath(pathname)) return res
    if (!user) {
      return NextResponse.json(
        { error: 'No autorizado. Iniciá sesión.' },
        { status: 401 },
      )
    }
    // Usuario autenticado → dejar pasar (el endpoint hace validaciones de role internamente)
    return res
  }

  // 3. Rutas de panel (admin, secretaria, padre, especialista)
  const protectedRoots = ['/admin', '/secretaria', '/padre', '/especialista']
  const isProtected = protectedRoots.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (!isProtected) return res

  // Sin sesión → al login con redirect-back
  if (!user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Validar role para esta ruta
  // Leemos el perfil completo (resiliente a columnas mfa_* que pueden no existir todavía)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  const role = (profile as any)?.role || 'padre'

  // 4a. 🔐 Forzar 2FA si el role lo requiere y el usuario aún no enroló
  //     (solo aplica si las columnas mfa_required / mfa_enrolled_at existen)
  const mfaRequired = (profile as any)?.mfa_required === true
  const mfaEnrolled = !!(profile as any)?.mfa_enrolled_at
  if (mfaRequired && !mfaEnrolled && pathname !== '/mfa-required') {
    return NextResponse.redirect(new URL('/mfa-required', req.url))
  }

  const allowedRoots = ROLE_ROUTES[role] || []
  const matchesRole = allowedRoots.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (!matchesRole) {
    // El usuario está logueado pero quiere entrar a un panel que no le corresponde.
    // Redirigir a SU panel propio en vez de tirar 403 (mejor UX).
    const homeForRole =
      role === 'jefe' || role === 'admin' || role === 'terapeuta' || role === 'especialista' ? '/admin'
      : role === 'secretaria' ? '/secretaria'
      : '/padre'
    return NextResponse.redirect(new URL(homeForRole, req.url))
  }

  return res
}

// Matcher: a qué rutas se aplica el middleware
// Excluye assets estáticos para no penalizar performance.
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (assets)
     * - _next/image (next image optimization)
     * - favicon.ico
     * - imágenes públicas en /public
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
  ],
}
