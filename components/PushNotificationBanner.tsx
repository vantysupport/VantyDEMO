'use client'
import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect } from 'react'
import { Bell, BellOff, X, Smartphone } from 'lucide-react'
import { usePushNotifications } from '../lib/usePushNotifications'

interface Props {
  userId: string | null
}

export default function PushNotificationBanner({ userId }: Props) {
  const { permission, isSubscribed, isLoading, requestPermission, unsubscribe } = usePushNotifications(userId)
  const { t } = useI18n()
  const [dismissed, setDismissed] = useState(false)
  const [justEnabled, setJustEnabled] = useState(false)

  // Don't show if dismissed this session, already subscribed, or not supported
  useEffect(() => {
    const wasDismissed = localStorage.getItem('push-banner-dismissed')
    if (wasDismissed) setDismissed(true)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('push-banner-dismissed', '1')
    setDismissed(true)
  }

  const handleEnable = async () => {
    const success = await requestPermission()
    if (success) {
      setJustEnabled(true)
      setTimeout(() => setDismissed(true), 3000)
    }
  }

  // Don't render if not relevant
  if (dismissed) return null
  if (permission === 'unsupported') return null
  if (permission === 'denied') return null
  if (isSubscribed && !justEnabled) return null

  // Success state
  if (justEnabled) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 animate-in slide-in-from-bottom-4">
        <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Bell size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-black text-sm">{t('notificaciones.activadas')}</p>
            <p className="text-xs text-emerald-100 mt-0.5">{t('notificaciones.teAvisaremos')}</p>
          </div>
        </div>
      </div>
    )
  }

  // Prompt state
  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-violet-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-white" />
            <p className="text-xs font-black text-white uppercase tracking-widest">Notificaciones</p>
          </div>
          <button onClick={handleDismiss} className="text-white/70 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-violet-100 rounded-2xl flex items-center justify-center shrink-0">
              <Bell size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="font-black text-slate-800 text-sm">{t('notificaciones.activamos')}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Te avisaremos al instante cuando el terapeuta te envíe un mensaje sobre tu hijo/a — sin tener que abrir la app.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 text-xs font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all"
            >
              Ahora no
            </button>
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="flex-[2] py-2.5 text-xs font-black text-white rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Bell size={13} />
                  Activar notificaciones
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
