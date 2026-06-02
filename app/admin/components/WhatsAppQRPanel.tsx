'use client'

import { useI18n } from '@/lib/i18n-context'
// Panel para conectar WhatsApp Business escaneando QR
// Aparece en Admin → Configuración

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle, Wifi, WifiOff, Smartphone } from 'lucide-react'

type Status = 'loading' | 'connected' | 'qr' | 'waiting' | 'error' | 'unconfigured'

export default function WhatsAppQRPanel() {
  const { t } = useI18n()
  const [status, setStatus]     = useState<Status>('loading')
  const [qr, setQr]             = useState<string | null>(null)
  const [polling, setPolling]   = useState(false)
  const [error, setError]       = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setShowConfirm(false)
    try {
      await fetch('/api/whatsapp-service/disconnect', { method: 'POST' })
      setStatus('loading')
      setTimeout(checkStatus, 3000)
    } catch {
      setError('No se pudo desconectar')
    } finally {
      setDisconnecting(false)
    }
  }

  const checkStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/whatsapp-service/status')
      const data = await res.json()

      if (data.unconfigured) { setStatus('unconfigured'); return }
      if (data.connected)    { setStatus('connected'); setQr(null); return }

      // No conectado → pedir QR
      const qrRes  = await fetch('/api/whatsapp-service/qr')
      const qrData = await qrRes.json()

      if (qrData.qr)      { setStatus('qr'); setQr(qrData.qr) }
      else if (qrData.waiting) { setStatus('waiting'); setQr(null) }
    } catch (e: any) {
      setStatus('error')
      setError(e.message)
    }
  }, [])

  // Poll cada 5s cuando está esperando QR o conectando
  useEffect(() => {
    checkStatus()
    const interval = setInterval(() => {
      if (status === 'waiting' || status === 'loading') checkStatus()
    }, 5000)
    return () => clearInterval(interval)
  }, [status, checkStatus])

  // Poll para detectar cuando se escanea el QR
  useEffect(() => {
    if (status !== 'qr') return
    const interval = setInterval(checkStatus, 4000)
    return () => clearInterval(interval)
  }, [status, checkStatus])

  return (
    <div className="space-y-6 max-w-lg">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <span className="text-xl">📱</span>
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            WhatsApp Business
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Conectá el número oficial del centro para notificar a los padres
          </p>
        </div>
      </div>

      {/* Estado: sin configurar */}
      {status === 'unconfigured' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <p className="text-sm font-bold text-amber-800">⚙️ Microservicio no configurado</p>
          <p className="text-xs text-amber-700">
            Para activar WhatsApp directo a los padres, necesitás deployar el microservicio en Railway y agregar las variables de entorno.
          </p>
          <div className="space-y-2">
            {[
              { label: 'WSP_SERVICE_URL', desc: 'URL de tu servicio en Railway' },
              { label: 'WSP_SERVICE_SECRET', desc: 'Clave secreta del servicio' },
            ].map(v => (
              <div key={v.label} className="bg-white rounded-lg p-3 border border-amber-100">
                <code className="text-xs font-mono font-bold text-amber-800">{v.label}</code>
                <p className="text-[10px] text-amber-600 mt-0.5">{v.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-600">
            Mientras tanto, CallMeBot sigue funcionando para notificaciones al admin.
          </p>
        </div>
      )}

      {/* Estado: conectado */}
      {status === 'connected' && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle size={22} className="text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800 text-sm">WhatsApp conectado ✅</p>
              <p className="text-xs text-green-600 mt-0.5">
                Las notificaciones llegarán directo al WhatsApp de cada padre
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {[t('notificaciones.nuevaCita'),t('notificaciones.informeDisponible'),t('notificaciones.formularioActualizado'),t('notificaciones.mensajeNuevo')].map(t => (
              <p key={t} className="text-xs text-green-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0"/>
                {t}
              </p>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={checkStatus}
              className="flex items-center gap-2 text-xs text-green-600 hover:text-green-800 transition-colors"
            >
              <RefreshCw size={12}/> Verificar conexión
            </button>
            <span className="text-green-300">|</span>
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                <WifiOff size={12}/> Desconectar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">¿Seguro?</span>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50 font-bold"
                >
                  {disconnecting ? '...' : 'Sí, desconectar'}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado: QR listo para escanear */}
      {status === 'qr' && qr && (
        <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
          <div className="flex items-center gap-2">
            <Smartphone size={18} className="text-sky-500"/>
            <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Escaneá este QR con WhatsApp Business
            </p>
          </div>

          {/* QR Image */}
          <div className="flex justify-center">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR WhatsApp" className="w-56 h-56" />
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-600">{t('ui.comoEscanear')}</p>
            {[
              'Abrí WhatsApp Business en tu celular',
              'Tocá los 3 puntos → Dispositivos vinculados',
              'Tocá "Vincular un dispositivo"',
              'Escaneá este QR',
            ].map((step, i) => (
              <p key={i} className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-sky-100 text-sky-600 text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
                {step}
              </p>
            ))}
          </div>

          <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
            El QR expira en 60 segundos. Actualizando automáticamente...
          </p>
        </div>
      )}

      {/* Estado: generando QR */}
      {(status === 'waiting' || status === 'loading') && (
        <div className="rounded-xl border p-8 flex flex-col items-center gap-3" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"/>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {status === 'loading' ? 'Conectando con el servicio...' : 'Generando QR...'}
          </p>
        </div>
      )}

      {/* Estado: error */}
      {status === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-bold text-red-700">{t('ui.errorConexion')}</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={checkStatus}
            className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-800"
          >
            <RefreshCw size={12}/> Reintentar
          </button>
        </div>
      )}

    </div>
  )
}
