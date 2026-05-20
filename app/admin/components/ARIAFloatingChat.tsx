'use client'
import React from 'react'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, X, Send, Loader2, User, BookOpen, Minus, Maximize2, Minimize2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fuentes?: string[]
}

export default function ARIAFloatingChat({ userId, childId, childName }: { userId: string; childId?: string; childName?: string }) {
  const { t, locale } = useI18n()
  const [open, setOpen]         = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const STORAGE_KEY = `aria_messages_${userId}${childId ? '_' + childId : ''}`
  const CONV_KEY = `aria_conv_${userId}${childId ? '_' + childId : ''}`

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [unread, setUnread]     = useState(0)
  const [conversacionId, setConversacionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return sessionStorage.getItem(CONV_KEY) } catch { return null }
  })
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // Persistir mensajes en sessionStorage cada vez que cambian
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
  }, [messages, STORAGE_KEY])

  // Persistir conversacionId
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (conversacionId) sessionStorage.setItem(CONV_KEY, conversacionId)
      else sessionStorage.removeItem(CONV_KEY)
    } catch {}
  }, [conversacionId, CONV_KEY])

  // Mensaje de bienvenida — solo si no hay mensajes guardados
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null
      const hasSaved = saved && JSON.parse(saved).length > 0
      if (!hasSaved) {
        setMessages([{
          role: 'assistant',
          content: childId && childName
            ? `¡Hola! 👋 Soy **ARIA**. Estoy revisando el expediente de **${childName}** y tengo acceso a todo su historial, programas ABA y evaluaciones.\n\n¿En qué te puedo ayudar?`
            : '¡Hola! 👋 Soy **ARIA**, tu asistente clínica. \n\nEstoy entrenada en ABA, neuropsicología y educación especial.\n\n¿En qué puedo ayudarte hoy? 🧠',
          timestamp: new Date().toISOString(),
        }])
        setConversacionId(null)
      }
    } catch {
      setMessages([{
        role: 'assistant',
        content: '¡Hola! 👋 Soy **ARIA**, tu asistente clínica. ¿En qué puedo ayudarte hoy? 🧠',
        timestamp: new Date().toISOString(),
      }])
    }
  }, [childId, childName])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setMinimized(false)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, minimized])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])

    try {
      const res = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({
          mensaje: msg,
          userId,
          childId: childId || undefined,
          conversacionId,
          contexto: childId ? 'paciente' : 'general',
          locale,
        }),
      })
      const data = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: data.response || data.mensaje || 'No pude procesar tu consulta.',
        timestamp: new Date().toISOString(),
        fuentes: data.fuentes,
      }
      setMessages(prev => [...prev, reply])
      if (data.conversacionId) setConversacionId(data.conversacionId)
      if (!open || minimized) setUnread(n => n + 1)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Hubo un error al conectar con ARIA. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, userId, conversacionId, locale, open, minimized])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatContent = (text: string) =>
    text.split('\n').map((line, i, arr) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          {i < arr.length - 1 && <br />}
        </span>
      )
    })

  return (
    <>
      {/* ── Panel flotante ── */}
      {open && (
        <div
          className={`fixed z-50 flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all duration-300
            ${expanded
              ? 'bottom-0 right-0 md:bottom-4 md:right-4 rounded-2xl'
              : 'bottom-20 md:bottom-6 right-4 md:right-6'}
            ${minimized ? 'h-14' : expanded ? 'h-[92vh] md:h-[85vh]' : 'h-[520px] md:h-[580px]'}`}
          style={{
            width: expanded ? 'min(720px, calc(100vw - 32px))' : 'min(360px, calc(100vw - 32px))',
            background: 'var(--card)',
            border: '1px solid var(--card-border)',
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center gap-3 flex-shrink-0 cursor-pointer"
            onClick={() => setMinimized(m => !m)}>
            <div className="w-8 h-8 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Brain size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-sm leading-tight">ARIA</p>
              <p className="text-violet-200 text-[10px]">Asistente Clínico IA</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <button onClick={e => { e.stopPropagation(); setMinimized(m => !m) }}
                className="p-1 hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white">
                <Minus size={14} />
              </button>
              <button onClick={e => { e.stopPropagation(); setExpanded(x => !x); setMinimized(false) }}
                className="p-1 hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
                title={expanded ? 'Reducir' : 'Ampliar'}>
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button onClick={e => { e.stopPropagation(); setOpen(false); setExpanded(false) }}
                className="p-1 hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white">
                <X size={14} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: 'var(--background)' }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(139,92,246,0.15)' }}>
                      {msg.role === 'user'
                        ? <User size={12} className="text-indigo-500" />
                        : <Brain size={12} className="text-violet-500" />}
                    </div>
                    <div className={`max-w-[80%] flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="rounded-2xl px-3 py-2 text-xs leading-relaxed"
                        style={msg.role === 'user'
                          ? { background: '#6d28d9', color: '#fff', borderRadius: '1rem 0.25rem 1rem 1rem' }
                          : { background: 'var(--muted-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '0.25rem 1rem 1rem 1rem' }
                        }>
                        {formatContent(msg.content)}
                      </div>
                      {msg.fuentes && msg.fuentes.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {msg.fuentes.map((f, j) => (
                            <span key={j} className="text-[9px] px-1.5 py-0.5 bg-violet-500/20 text-violet-400 rounded-full border border-violet-500/30 font-bold flex items-center gap-1">
                              <BookOpen size={7} /> {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center bg-violet-500/20">
                      <Brain size={12} className="text-violet-500" />
                    </div>
                    <div className="rounded-2xl px-3 py-2 flex items-center gap-2"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                      <Loader2 size={12} className="animate-spin text-violet-500" />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>ARIA está pensando...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Sugerencias */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 pt-2 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--background)' }}>
                  {[
                    '¿Mejores reforzadores para TEA?',
                    '¿Cómo aplicar extinción de escape?',
                    '¿Cómo manejar una rabieta?',
                  ].map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:border-violet-400 hover:text-violet-500 text-left"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 flex-shrink-0" style={{ background: 'var(--card)', borderTop: '1px solid var(--card-border)' }}>
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Pregúntale a ARIA..."
                    className="flex-1 p-2.5 rounded-2xl text-xs resize-none outline-none transition-all leading-relaxed max-h-24 focus:ring-2 focus:ring-violet-400"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1.5px solid var(--input-border)',
                      color: 'var(--text-primary)',
                      minHeight: '38px',
                    }}
                  />
                  <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                    className="w-9 h-9 bg-violet-600 text-white rounded-xl flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition-all shrink-0">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Botón flotante ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95
          ${open ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'}`}
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        title="Abrir ARIA"
      >
        <Brain size={26} className="text-white" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
            {unread}
          </span>
        )}
      </button>
    </>
  )
}
