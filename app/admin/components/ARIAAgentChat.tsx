'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Send, Loader2, User, Brain, BookOpen, Trash2, Volume2, VolumeX
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fuentes?: string[]
}

// Divide un texto en segmentos cortos por frases, agrupando hasta ~180 caracteres.
// El primer segmento se mantiene corto para que la voz empiece a sonar cuanto antes.
function splitEnFrases(text: string, maxLen = 180): string[] {
  const limpio = text.replace(/\s+/g, ' ').trim()
  if (!limpio) return []
  const frases = limpio.match(/[^.!?¿¡\n]+[.!?]*/g) || [limpio]
  const chunks: string[] = []
  let actual = ''
  for (const f of frases) {
    const frase = f.trim()
    if (!frase) continue
    // El primer chunk se cierra antes (más corto) para arrancar rápido
    const limite = chunks.length === 0 ? Math.min(maxLen, 90) : maxLen
    if (actual && (actual.length + frase.length + 1) > limite) {
      chunks.push(actual.trim())
      actual = frase
    } else {
      actual = actual ? `${actual} ${frase}` : frase
    }
  }
  if (actual.trim()) chunks.push(actual.trim())
  return chunks.length > 0 ? chunks : [limpio]
}

interface ARIAAgentChatProps {
  userId: string
  childId?: string
  childName?: string
  contexto?: string
  compact?: boolean
}

export default function ARIAAgentChat({
  userId, childId, childName, contexto = 'general', compact = false
}: ARIAAgentChatProps) {
  const { t, locale } = useI18n()

  // Keys por usuario + paciente — persisten entre cierres/aperturas
  const STORAGE_KEY = useMemo(
    () => `aria_agent_msgs_${userId}${childId ? '_' + childId : ''}`,
    [userId, childId]
  )
  const CONV_KEY = useMemo(
    () => `aria_agent_conv_${userId}${childId ? '_' + childId : ''}`,
    [userId, childId]
  )

  const welcomeMsg = useCallback((): Message => ({
    role: 'assistant',
    content: childId
      ? `¡Hola! 👋 Soy **ARIA**. Estoy revisando el expediente de **${childName || 'tu paciente'}** y tengo acceso a todo su historial, programas ABA, objetivos terapéuticos y evaluaciones previas.\n\n¿En qué te puedo ayudar hoy?`
      : `¡Hola! 👋 Soy **ARIA**, tu asistente clínica.\n\nEstoy entrenada en ABA, neuropsicología y educación especial.\n\n¿En qué puedo ayudarte hoy? 🧠`,
    timestamp: new Date().toISOString(),
  }), [childId, childName])

  // Estado inicial — restaura desde localStorage si existe
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(`aria_agent_msgs_${userId}${childId ? '_' + childId : ''}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {}
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(`aria_agent_conv_${userId}${childId ? '_' + childId : ''}`)
    } catch { return null }
  })
  const [sugerencias] = useState([
    childId ? `¿Cómo va el progreso general de ${childName || 'este paciente'}?` : '¿Cuáles son los mejores reforzadores para TEA no verbal?',
    '¿Cómo aplicar extinción de escape en sesión?',
    childId ? `¿Qué programas recomiendas para ${childName || 'este paciente'}?` : '¿Cómo manejar un dilema ético en terapia?',
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const prevKeyRef = useRef<string>(STORAGE_KEY)

  // ── Voz de ARIA (Edge TTS, con respaldo a la voz del navegador) ──
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [speaking, setSpeaking]         = useState(false)
  const audioRef        = useRef<HTMLAudioElement | null>(null)
  const speakTokenRef   = useRef(0)
  const voiceEnabledRef = useRef(voiceEnabled)
  useEffect(() => { voiceEnabledRef.current = voiceEnabled }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current++
    try { audioRef.current?.pause(); audioRef.current = null } catch {}
    try { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel() } catch {}
    setSpeaking(false)
  }, [])

  const speakBrowser = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { setSpeaking(false); return }
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'es-ES'; u.rate = 1; u.pitch = 1.05
      const es = window.speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('es'))
      if (es) u.voice = es
      u.onstart = () => setSpeaking(true)
      u.onend   = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(u)
    } catch { setSpeaking(false) }
  }, [])

  // Voz neuronal de ARIA — generada al momento, sin guardar nada.
  // Se divide el texto en frases y se reproduce la primera apenas está lista,
  // mientras se generan las siguientes en segundo plano (baja la latencia inicial).
  const speak = useCallback(async (text: string) => {
    const limpio = (text || '').trim()
    if (!limpio) return
    stopSpeaking()
    const myToken = ++speakTokenRef.current
    setSpeaking(true)

    const segmentos = splitEnFrases(limpio)

    const fetchAudio = async (seg: string): Promise<string> => {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: seg }),
      })
      if (!res.ok) throw new Error('tts')
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }

    const playUrl = (url: string) => new Promise<void>((resolve) => {
      const a = new Audio(url)
      audioRef.current = a
      a.onended = () => resolve()
      a.onerror = () => resolve()
      a.play().catch(() => resolve())
    })

    try {
      // Pipeline: mientras suena un segmento, ya se va pidiendo el siguiente
      let siguiente = fetchAudio(segmentos[0])
      for (let i = 0; i < segmentos.length; i++) {
        const url = await siguiente
        if (myToken !== speakTokenRef.current) { URL.revokeObjectURL(url); return }
        // prefetch del próximo segmento en paralelo a la reproducción del actual
        siguiente = i + 1 < segmentos.length
          ? fetchAudio(segmentos[i + 1]).catch(() => '')
          : Promise.resolve('')
        await playUrl(url)
        URL.revokeObjectURL(url)
        if (myToken !== speakTokenRef.current) return
      }
    } catch {
      if (myToken === speakTokenRef.current) speakBrowser(limpio)
    } finally {
      if (myToken === speakTokenRef.current) setSpeaking(false)
    }
  }, [stopSpeaking, speakBrowser])

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(v => { if (v) stopSpeaking(); return !v })
  }, [stopSpeaking])

  // Cortar la voz al desmontar
  useEffect(() => () => stopSpeaking(), [stopSpeaking])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persistir mensajes en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (messages.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {}
  }, [messages, STORAGE_KEY])

  // Persistir conversacionId
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (conversacionId) localStorage.setItem(CONV_KEY, conversacionId)
      else localStorage.removeItem(CONV_KEY)
    } catch {}
  }, [conversacionId, CONV_KEY])

  // Cambio de paciente → cargar el historial de ESE paciente desde localStorage
  // Solo se ejecuta cuando STORAGE_KEY cambia (no en el primer render)
  useEffect(() => {
    if (prevKeyRef.current === STORAGE_KEY) return
    prevKeyRef.current = STORAGE_KEY
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      const savedConv = localStorage.getItem(CONV_KEY)
      const parsed = saved ? JSON.parse(saved) : []
      setConversacionId(savedConv || null)
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed)
      } else {
        setMessages([welcomeMsg()])
      }
    } catch {
      setMessages([welcomeMsg()])
    }
  }, [STORAGE_KEY, CONV_KEY, welcomeMsg])

  // Mostrar bienvenida si el chat está completamente vacío al montar
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([welcomeMsg()])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Borrar historial — localStorage + Supabase + reset estado
  const clearHistory = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CONV_KEY)
      } catch {}
    }
    try {
      const params = new URLSearchParams({ user_id: userId })
      if (conversacionId) params.set('conversacion_id', conversacionId)
      await fetch(`/api/agente/chat?${params.toString()}`, { method: 'DELETE' })
    } catch {}
    setConversacionId(null)
    setMessages([welcomeMsg()])
  }, [STORAGE_KEY, CONV_KEY, userId, conversacionId, welcomeMsg])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    setInput('')
    setLoading(true)

    const userMessage: Message = {
      role: 'user',
      content: msg,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      const res = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale || 'es' },
        body: JSON.stringify({ mensaje: msg, childId, userId, conversacionId, contexto , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setConversacionId(data.conversacionId)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.respuesta,
        timestamp: new Date().toISOString(),
        fuentes: data.fuentesUsadas,
      }])
      if (voiceEnabledRef.current) speak(data.respuesta)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ocurrió un error al procesar tu consulta. Por favor intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, loading, childId, userId, conversacionId, contexto, locale, speak])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div
      className={`flex flex-col overflow-hidden ${compact ? 'rounded-2xl border h-full' : 'h-full'}`}
      style={compact ? {
        background: 'var(--card)',
        borderColor: 'var(--card-border)',
      } : { background: 'var(--card)' }}
    >
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <Brain size={15} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                ARIA — Asistente Clínico IA
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                  BETA
                </span>
              </h3>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {childId ? `Caso activo: ${childName || 'Paciente'}` : 'Asistente clínico especializado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>{t('common.activo')}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-5 space-y-4"
        style={{ background: 'var(--background)', minHeight: 0 }}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
              <Brain size={14} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2"
              style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
            >
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('aria.ariaPensando')}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias */}
      {messages.length <= 1 && (
        <div
          className="px-5 pb-4"
          style={{ background: 'var(--background)', borderTop: '1px solid var(--card-border)' }}
        >
          <p className="text-[10px] font-bold mb-2 mt-3" style={{ color: 'var(--text-muted)' }}>
            Preguntas sugeridas
          </p>
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-left leading-tight transition-all"
                style={{
                  background: 'var(--muted-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de acciones — borrar chat */}
      <div
        className="px-5 pt-2 pb-1 flex items-center justify-between flex-shrink-0"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--card-border)',
        }}
      >
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
          {messages.length > 1 ? `${messages.length - 1} mensaje${messages.length > 2 ? 's' : ''} guardado${messages.length > 2 ? 's' : ''}` : 'Conversación nueva'}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleVoice}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
            style={{
              background: voiceEnabled ? 'rgba(134,239,172,0.18)' : 'var(--muted-bg)',
              color: voiceEnabled ? '#16a34a' : 'var(--text-muted)',
              border: `1px solid ${voiceEnabled ? 'rgba(22,163,74,0.35)' : 'var(--card-border)'}`,
            }}
            title={voiceEnabled ? 'Desactivar voz de ARIA' : 'Activar voz de ARIA'}
          >
            {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {speaking ? 'Hablando…' : voiceEnabled ? 'Voz ON' : 'Voz OFF'}
          </button>
          <button
            onClick={() => { if (window.confirm('¿Borrar todo el historial de ARIA? Esta acción no se puede deshacer.')) clearHistory() }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all text-red-500 hover:text-white hover:bg-red-500 border border-red-500/30 hover:border-red-500"
            title="Borrar historial del chat"
          >
            <Trash2 size={12} />
            Borrar chat
          </button>
        </div>
      </div>

      {/* Input */}
      <div
        className="px-5 pt-2 pb-4 flex-shrink-0"
        style={{
          background: 'var(--card)',
        }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            {...{placeholder: t('ui.ask_aria')}}
            className="flex-1 p-3 rounded-xl text-sm resize-none outline-none transition-all leading-relaxed max-h-28"
            style={{
              background: 'var(--input-bg)',
              border: '1.5px solid var(--input-border)',
              color: 'var(--text-primary)',
              minHeight: '44px',
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-40" style={{ background: 'var(--text-primary)', color: 'var(--card)' }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message; key?: any }) {
  const { t, locale } = useI18n()
  const isUser = message.role === 'user'

  const formatContent = (text: string) => {
    return text.split('\n').map((line, i, arr) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          {i < arr.length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}
      >
        {isUser
          ? <User size={13} style={{ color: 'var(--text-secondary)' }} />
          : <Brain size={13} style={{ color: 'var(--text-secondary)' }} />
        }
      </div>
      <div className={`max-w-[82%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className="rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={isUser
            ? {
                background: 'var(--text-primary)',
                color: 'var(--card)',
                borderRadius: '0.75rem 0.2rem 0.75rem 0.75rem',
              }
            : {
                background: 'var(--card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--card-border)',
                borderRadius: '0.2rem 0.75rem 0.75rem 0.75rem',
              }
          }
        >
          {formatContent(message.content)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(message.timestamp).toLocaleTimeString(toBCP47(locale), { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.fuentes && message.fuentes.length > 0 && (
            <div className="flex gap-1">
              {message.fuentes.map((f, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1"
                  style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                  <BookOpen size={8} /> {f}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
