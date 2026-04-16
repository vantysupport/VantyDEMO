'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Check, Loader2, RefreshCw, CalendarDays } from 'lucide-react'

export default function GoogleCalendarSync() {
  const toast = useToast()
  const [status,     setStatus]     = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [userId,     setUserId]     = useState<string | null>(null)
  const [syncing,    setSyncing]    = useState(false)
  const [connecting, setConnecting] = useState(false)

  const checkStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      setUserId(session.user.id)
      const res  = await fetch(`/api/google-calendar?action=status&userId=${session.user.id}`)
      const data = await res.json()
      setStatus(data.connected ? 'connected' : 'disconnected')
    } catch { setStatus('disconnected') }
  }

  useEffect(() => {
    checkStatus()
    const params = new URLSearchParams(window.location.search)
    const gcal   = params.get('gcal')
    if (gcal === 'connected') {
      toast.success('✅ Google Calendar conectado')
      checkStatus()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (gcal === 'error') {
      toast.error('Error al conectar Google Calendar')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleConnect = async () => {
    if (!userId) return
    setConnecting(true)
    try {
      const res  = await fetch(`/api/google-calendar?action=auth-url&userId=${userId}`)
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { toast.error('Error iniciando conexión'); setConnecting(false) }
  }

  const handleDisconnect = async () => {
    if (!userId || !confirm('¿Desconectar Google Calendar?')) return
    await fetch(`/api/google-calendar?action=disconnect&userId=${userId}`)
    setStatus('disconnected')
    toast.success('Google Calendar desconectado')
  }

  const handleSync = async () => {
    if (!userId) return
    setSyncing(true)
    try {
      const res  = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all', userId }),
      })
      const data = await res.json()
      if (data.ok) toast.success(`✅ ${data.synced} cita${data.synced !== 1 ? 's' : ''} sincronizadas`)
      else toast.error(data.error || 'Error al sincronizar')
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSyncing(false) }
  }

  if (status === 'loading') return null

  if (status === 'disconnected') {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50
          dark:bg-[#21262d] dark:border-[#30363d] dark:text-slate-300 dark:hover:bg-[#30363d]
          text-slate-600 text-xs font-semibold transition-all disabled:opacity-50"
      >
        {connecting
          ? <Loader2 size={14} className="animate-spin text-blue-500" />
          : <CalendarDays size={14} className="text-slate-400" />
        }
        {connecting ? 'Conectando...' : 'Conectar Google'}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* Estado conectado */}
      <button
        onClick={handleDisconnect}
        title="Click para desconectar"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all
          bg-emerald-50 text-emerald-700 border border-emerald-200
          hover:bg-red-50 hover:text-red-600 hover:border-red-200
          dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800
          dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:hover:border-red-800"
      >
        <Check size={12} /> Google Calendar
      </button>
      {/* Sync */}
      <button
        onClick={handleSync}
        disabled={syncing}
        title="Sincronizar con Google Calendar"
        className="p-2 rounded-xl border transition-all disabled:opacity-50
          border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50
          dark:border-[#30363d] dark:text-slate-500 dark:hover:text-blue-400 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
      >
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      </button>
    </div>
  )
}
