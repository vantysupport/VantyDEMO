'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Video, PhoneOff, Loader2, Wifi, AlertTriangle, Clock } from 'lucide-react'

interface VideoCallModalProps {
  roomUrl: string
  sessionId: string
  participantName: string
  appointmentId?: string
  onClose: () => void
}

const SESSION_SECS = 45 * 60
const WARNING_SECS  =  5 * 60

export default function VideoCallModal({
  roomUrl, sessionId, participantName, appointmentId, onClose
}: VideoCallModalProps) {

  const startRef   = useRef<number>(Date.now())
  const autoEndRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endingRef  = useRef(false)

  const [connStatus, setConnStatus] = useState<'connecting' | 'connected'>('connecting')
  const [elapsed,    setElapsed]    = useState(0)
  const [saving,     setSaving]     = useState(false)
  const [showWarn,   setShowWarn]   = useState(false)

  const remaining = Math.max(0, SESSION_SECS - elapsed)

  useEffect(() => {
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      setElapsed(secs)
      if (SESSION_SECS - secs <= WARNING_SECS) setShowWarn(true)
    }, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    autoEndRef.current = setTimeout(() => handleEnd(true), SESSION_SECS * 1000)
    return () => { if (autoEndRef.current) clearTimeout(autoEndRef.current) }
  }, []) // eslint-disable-line

  useEffect(() => {
    const t = setTimeout(() => setConnStatus('connected'), 3000)
    return () => clearTimeout(t)
  }, [])

  const fmt = (s: number) =>
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  const handleEnd = useCallback(async (_auto = false) => {
    if (endingRef.current) return
    endingRef.current = true
    if (autoEndRef.current) clearTimeout(autoEndRef.current)
    setSaving(true)
    try {
      const mins = (Date.now() - startRef.current) / 60000
      await fetch('/api/video-call', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, duration_minutes: mins }),
      })
      if (appointmentId) {
        await fetch('/api/admin/appointments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: appointmentId, status: 'completed' }),
        })
      }
    } catch (e) {
      console.error('Error al finalizar sesión:', e)
    } finally {
      setSaving(false)
      onClose()
    }
  }, [sessionId, appointmentId, onClose])

  const isLastMin = remaining <= 60
  const callUrl   = `${roomUrl}#userInfo.displayName="${encodeURIComponent(participantName)}"&config.defaultLanguage="es"&config.prejoinPageEnabled=false`

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#0a0a0f' }}>

      <div className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background:'rgba(255,255,255,0.04)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-sm"
            style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>JA</div>
          <div>
            <p className="text-white font-bold text-sm">Jugando Aprendo · Videollamada</p>
            <p className="text-xs font-medium" style={{ color:'rgba(255,255,255,0.4)' }}>{participantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connStatus === 'connected' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: isLastMin ? 'rgba(239,68,68,0.2)' : showWarn ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${isLastMin ? 'rgba(239,68,68,0.45)' : showWarn ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.1)'}`,
              }}>
              <Clock size={12} className={isLastMin ? 'text-red-400 animate-pulse' : showWarn ? 'text-yellow-400' : 'text-slate-400'} />
              <span className={`font-mono font-bold text-sm ${isLastMin ? 'text-red-300' : showWarn ? 'text-yellow-300' : 'text-white'}`}>
                {fmt(elapsed)}
              </span>
              <span className="text-[10px] font-bold" style={{ color:'rgba(255,255,255,0.3)' }}>/ 45:00</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{
              background: connStatus==='connected' ? 'rgba(34,197,94,0.15)' : 'rgba(251,191,36,0.15)',
              border: `1px solid ${connStatus==='connected' ? 'rgba(34,197,94,0.3)' : 'rgba(251,191,36,0.3)'}`
            }}>
            {connStatus==='connecting'
              ? <Loader2 size={12} className="animate-spin text-yellow-400"/>
              : <Wifi size={12} className="text-green-400"/>}
            <span className="text-xs font-bold" style={{ color: connStatus==='connected' ? '#4ade80' : '#fbbf24' }}>
              {connStatus==='connecting' ? 'Conectando...' : 'En línea'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl transition-all hover:scale-105"
            style={{ background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)' }}>
            <X size={16}/>
          </button>
        </div>
      </div>

      {showWarn && connStatus==='connected' && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-2 px-4"
          style={{
            background: isLastMin ? 'rgba(239,68,68,0.22)' : 'rgba(251,191,36,0.13)',
            borderBottom: `1px solid ${isLastMin ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.3)'}`,
          }}>
          <AlertTriangle size={14} className={isLastMin ? 'text-red-400 animate-pulse' : 'text-yellow-400'}/>
          <p className={`text-xs font-bold ${isLastMin ? 'text-red-300' : 'text-yellow-300'}`}>
            {isLastMin
              ? `⚠️ La sesión finaliza en ${fmt(remaining)} — se guardará automáticamente`
              : `Tiempo restante: ${fmt(remaining)}. La cita se marcará como completada al terminar.`}
          </p>
        </div>
      )}

      <div className="flex-1 relative">
        {connStatus==='connecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10"
            style={{ background:'#0a0a0f' }}>
            <div className="relative">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                <Video size={32} className="text-white"/>
              </div>
              <div className="absolute inset-0 rounded-full animate-ping opacity-20"
                style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}/>
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Iniciando videollamada...</p>
              <p className="text-sm mt-1" style={{ color:'rgba(255,255,255,0.4)' }}>
                Permite el acceso a cámara y micrófono cuando el navegador lo solicite
              </p>
            </div>
            <div className="flex gap-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-indigo-500"
                  style={{ animation:'bounce 1s ease-in-out infinite', animationDelay:`${i*0.15}s` }}/>
              ))}
            </div>
          </div>
        )}
        <iframe src={callUrl}
          allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
          className="w-full h-full border-0"
          style={{ display: connStatus==='connecting' ? 'none' : 'block' }}
          onLoad={() => setConnStatus('connected')}
          title="Videollamada Jugando Aprendo"
        />
      </div>

      <div className="shrink-0 flex items-center justify-center gap-4 py-4"
        style={{ background:'rgba(255,255,255,0.03)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs mr-2" style={{ color:'rgba(255,255,255,0.3)' }}>
          Controles de cámara y micrófono dentro de la llamada
        </p>
        <button onClick={() => handleEnd(false)} disabled={saving}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
          style={{ background:'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow:'0 4px 20px rgba(239,68,68,0.4)' }}>
          {saving
            ? <><Loader2 size={18} className="animate-spin"/> Guardando...</>
            : <><PhoneOff size={18}/> Finalizar llamada</>}
        </button>
      </div>
    </div>
  )
}
