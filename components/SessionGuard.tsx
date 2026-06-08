'use client'
// components/SessionGuard.tsx
// Vigila la "sesión única" en todas las pantallas autenticadas:
//  • Al montar (cualquier vía de login: contraseña, OAuth, refresh) RECLAMA la sesión.
//    Si otra persona la tiene activa → cierra sesión y manda a /login?session=taken.
//  • Heartbeat periódico para mantenerla viva.
//  • Si pierde la titularidad (otra sesión la tomó tras quedar inactiva) → expulsa.
//  • Libera la sesión al cerrar sesión o cerrar la pestaña.

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { claimSession, heartbeatSession, releaseSession } from '@/lib/session-lock'

const HEARTBEAT_MS = 30000

export default function SessionGuard() {
  const router = useRouter()
  const pathname = usePathname()
  const kicked = useRef(false)

  useEffect(() => {
    // En las páginas de login no aplicamos el candado.
    const isAuthPage = pathname === '/' || pathname === '/login'
    let interval: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    const kick = async () => {
      if (kicked.current || cancelled) return
      kicked.current = true
      await releaseSession().catch(() => {})
      await supabase.auth.signOut().catch(() => {})
      router.replace('/login?session=taken')
    }

    const start = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || cancelled) return

      // Reclamo inicial — cubre login por OAuth, refresh y navegación directa.
      const claim = await claimSession()
      if (claim === 'in_use') { await kick(); return }

      // Heartbeat continuo.
      interval = setInterval(async () => {
        const stillOwner = await heartbeatSession()
        if (!stillOwner) await kick()
      }, HEARTBEAT_MS)
    }

    if (!isAuthPage) start()

    // Liberar al cerrar sesión (cualquier botón de logout dispara SIGNED_OUT).
    // IMPORTANTE: NO llamar a Supabase dentro del callback de onAuthStateChange
    // (corre dentro del lock de auth y provoca deadlock que congela todas las
    // consultas). Se difiere con setTimeout(0) para ejecutarse fuera del lock.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setTimeout(() => { releaseSession().catch(() => {}) }, 0)
      }
    })

    // Best-effort al cerrar/ocultar la pestaña (la red puede cancelarlo; el
    // umbral de inactividad del servidor es la red de seguridad real).
    const onHide = () => { releaseSession() }
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
