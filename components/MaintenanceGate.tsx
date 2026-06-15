'use client'
// components/MaintenanceGate.tsx
//  • Modo mantenimiento: si está activo, todos MENOS el rol 'programador' ven un
//    mensaje de soporte (no la app). El programador y las rutas de auth/control
//    nunca se bloquean (para poder entrar y desactivarlo).
//  • Captura global de errores no controlados (window.error / unhandledrejection)
//    y los registra — solo el programador los verá en /control.
// A prueba de fallos: ante cualquier problema NO bloquea (la app sigue).

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getControlStatus, logClientError } from '@/lib/control'

const AUTH_ROUTES = ['/', '/login', '/control']

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [blocked, setBlocked] = useState(false)
  const [msg, setMsg] = useState('')

  // Captura global de errores → registro (a prueba de fallos).
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      logClientError(e?.message || 'window.error', e?.error?.stack || `${e?.filename || ''}:${e?.lineno || ''}`, 'window')
    }
    const onRej = (e: PromiseRejectionEvent) => {
      const r = e?.reason as { message?: string; stack?: string } | undefined
      logClientError(r?.message || 'unhandledrejection', r?.stack || String(e?.reason ?? ''), 'promise')
    }
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const check = async () => {
      if (AUTH_ROUTES.includes(pathname) || pathname.startsWith('/auth')) { setBlocked(false); return }
      const status = await getControlStatus()
      if (!alive) return
      if (!status.maintenance) { setBlocked(false); return }
      // Mantenimiento ON: el programador pasa; los demás ven el mensaje.
      let role = ''
      try {
        const { data } = await supabase.auth.getSession()
        const uid = data.session?.user?.id
        if (uid) {
          const { data: p } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
          role = (p as { role?: string } | null)?.role || ''
        }
      } catch { /* noop */ }
      if (!alive) return
      setMsg(status.maintenance_msg || '')
      setBlocked(role !== 'programador')
    }
    check()
    return () => { alive = false }
  }, [pathname])

  if (!blocked) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', fontFamily: 'var(--font-sans, system-ui)' }}>
      <div style={{ maxWidth: 440, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '34px 28px', boxShadow: '0 12px 40px rgba(15,23,42,.08)' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <AlertTriangle size={28} />
        </div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>La web está presentando inconvenientes</h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.55 }}>
          {msg || 'Estamos realizando mejoras. Por favor, comuníquese con soporte e intente más tarde.'}
        </p>
      </div>
    </div>
  )
}
