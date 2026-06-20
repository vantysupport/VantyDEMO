'use client'
// Aviso flotante "Te quedan X días" para cuentas de centro DEMO.
// No muestra nada si la cuenta no es demo. Se monta en el panel admin.

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

type DemoStatus = {
  is_demo: boolean
  days_left?: number | null
  center_name?: string | null
}

export default function DemoBanner() {
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/demo-status', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive) setStatus(j) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (hidden || !status?.is_demo) return null

  const days = status.days_left ?? null
  const tone =
    days != null && days <= 1 ? 'from-rose-600 to-rose-500'
    : days != null && days <= 3 ? 'from-amber-600 to-amber-500'
    : 'from-sky-600 to-indigo-600'

  const label =
    days == null ? 'Modo demostración'
    : days <= 0 ? 'Tu demo finaliza hoy'
    : days === 1 ? 'Te queda 1 día de demo'
    : `Te quedan ${days} días de demo`

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto">
      <div className={`flex items-center gap-2.5 rounded-full bg-gradient-to-r ${tone} text-white pl-4 pr-3 py-2 shadow-xl ring-1 ring-white/20`}>
        <Clock size={15} className="opacity-90" />
        <span className="text-[13px] font-bold whitespace-nowrap">{label}</span>
        {status.center_name && (
          <span className="text-[11px] font-semibold opacity-80 hidden sm:inline">· {status.center_name}</span>
        )}
        <button
          onClick={() => setHidden(true)}
          className="ml-1 text-white/70 hover:text-white text-lg leading-none px-1"
          aria-label="Ocultar"
        >
          ×
        </button>
      </div>
    </div>
  )
}
