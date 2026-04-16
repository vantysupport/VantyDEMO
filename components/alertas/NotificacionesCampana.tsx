'use client'
// components/alertas/NotificacionesCampana.tsx
import { useState, useEffect } from 'react'

export default function NotificacionesCampana({ userId }: { userId: string }) {
  const [notifs, setNotifs]     = useState<any[]>([])
  const [abierto, setAbierto]   = useState(false)
  const [noLeidas, setNoLeidas] = useState(0)

  useEffect(() => {
    cargarNotificaciones()
    const interval = setInterval(cargarNotificaciones, 30000)
    return () => clearInterval(interval)
  }, [userId])

  async function cargarNotificaciones() {
    try {
      const res  = await fetch(`/api/notificaciones?user_id=${userId}`)
      const data = await res.json()
      setNotifs(data.data || [])
      setNoLeidas(data.totalNoLeidas || 0)
    } catch {}
  }

  async function marcarLeida(id: string) {
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'marcar_leida', id })
    })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setNoLeidas(prev => Math.max(0, prev - 1))
  }

  async function marcarTodasLeidas() {
    await fetch('/api/notificaciones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'marcar_todas_leidas', userId })
    })
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
    setNoLeidas(0)
  }

  const iconoTipo: Record<string, string> = {
    cita_nueva:          '📅',
    cita_cancelada:      '❌',
    cita_recordatorio:   '🔔',
    alerta_clinica:      '🚨',
    tarea_nueva:         '📋',
    tarea_completada:    '✅',
    reporte_listo:       '📄',
    mensaje_nuevo:       '💬',
    factura_nueva:       '💰',
    factura_pagado:      '✅',
  }

  return (
    <div className="relative">
      <button onClick={() => setAbierto(!abierto)}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
          <path d="M5.85 3.5a.75.75 0 00-1.117-1 9.719 9.719 0 00-2.348 4.876.75.75 0 001.479.248A8.219 8.219 0 015.85 3.5zM19.267 2.5a.75.75 0 10-1.118 1 8.22 8.22 0 011.987 4.124.75.75 0 001.48-.248A9.72 9.72 0 0019.266 2.5z" />
          <path fillRule="evenodd" d="M12 2.25A6.75 6.75 0 005.25 9v.75a8.217 8.217 0 01-2.119 5.52.75.75 0 00.298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 107.48 0 24.583 24.583 0 004.83-1.244.75.75 0 00.298-1.205 8.217 8.217 0 01-2.118-5.52V9A6.75 6.75 0 0012 2.25zM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 004.496 0l.002.1a2.25 2.25 0 11-4.5 0z" clipRule="evenodd" />
        </svg>
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold text-gray-800">Notificaciones</h3>
              {noLeidas > 0 && (
                <button onClick={marcarTodasLeidas} className="text-xs text-blue-600 hover:underline">
                  Marcar todas leídas
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-2">🔔</p>
                  <p className="text-gray-400 text-sm">Sin notificaciones</p>
                </div>
              ) : notifs.map(n => (
                <div key={n.id}
                  onClick={() => !n.leida && marcarLeida(n.id)}
                  className={`flex gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 ${!n.leida ? 'bg-blue-50' : ''}`}>
                  <span className="text-lg flex-shrink-0 mt-0.5">{iconoTipo[n.tipo] || '📬'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium text-gray-800 ${!n.leida ? 'font-semibold' : ''}`}>{n.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.mensaje}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.leida && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
