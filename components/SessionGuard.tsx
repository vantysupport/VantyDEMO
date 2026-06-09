'use client'
// components/SessionGuard.tsx
// Sesión única — vigilante MÍNIMO y a prueba de fallos.
//  • Solo hace fetch a /api/session/* + sendBeacon. NO usa supabase.rpc.
//  • Nunca llama a Supabase dentro de onAuthStateChange (evita el deadlock
//    del lock de auth que antes congelaba la app).
//  • Ante cualquier error, FALLA ABIERTO: jamás bloquea ni cuelga la navegación.

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { claimSession, heartbeatSession, releaseViaBeacon } from '@/lib/session-lock'

const HEARTBEAT_MS = 20000

export default function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const kicked = useRef(false)

  useEffect(() => {
    const isAuthPage = pathname === '/' || pathname === '/login'
    let interval: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    const kick = async () => {
      if (kicked.current || cancelled) return
      kicked.current = true
      releaseViaBeacon()
      try { await supabase.auth.signOut() } catch { /* noop */ }
      router.replace('/login?session=taken')
    }

    const start = async () => {
      // claimSession ya verifica la sesión internamente (con timeout) y guarda
      // el userId para el heartbeat. Cubre login normal, OAuth, refresco y nav.
      const claim = await claimSession()
      if (cancelled) return
      if (claim === 'in_use') { await kick(); return }
      if (claim !== 'claimed') return // 'error' (sin sesión o blip) => no enforcar

      interval = setInterval(async () => {
        const stillOwner = await heartbeatSession()
        if (!stillOwner) await kick()
      }, HEARTBEAT_MS)
    }

    if (!isAuthPage) start()

    // Liberar al cerrar sesión: SOLO sendBeacon (no toca supabase) → seguro
    // ejecutarlo dentro del callback de onAuthStateChange.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') releaseViaBeacon()
    })

    // Liberar al cerrar/ocultar la pestaña.
    const onHide = () => { releaseViaBeacon() }
    window.addEventListener('pagehide', onHide)

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
      sub.subscription.unsubscribe()
      window.removeEventListener('pagehide', onHide)
    }
  }, [pathname, router])

  return null
}
