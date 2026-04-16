'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Loader2, User, Brain, BookOpen
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fuentes?: string[]
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
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [sugerencias] = useState([
    childId ? `¿Cómo va el progreso general de ${childName || 'este paciente'}?` : '¿Cuáles son los mejores reforzadores para TEA no verbal?',
    '¿Cómo aplicar extinción de escape en sesión?',
    childId ? `¿Qué programas recomiendas para ${childName || 'este paciente'}?` : '¿Cómo manejar un dilema ético en terapia?',
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Reset conversacion when patient changes so ARIA loads fresh context
    setConversacionId(null)
    setMessages([{
      role: 'assistant',
      content: childId
        ? `¡Hola! 👋 Soy **ARIA**. Estoy revisando el expediente de **${childName || 'tu paciente'}** y tengo acceso a todo su historial, programas ABA, objetivos terapéuticos y evaluaciones previas.\n\n¿En qué te puedo ayudar hoy?`
        : `¡Hola! 👋 Soy **ARIA**, tu asistente clínica.\n\nEstoy entrenada en ABA, neuropsicología y educación especial.\n\n¿En qué puedo ayudarte hoy? 🧠`,
      timestamp: new Date().toISOString(),
    }])
  }, [childId, childName])

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
  }, [input, loading, childId, userId, conversacionId, contexto])

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
              <h3 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                ARIA — Asistente Clínico IA
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide"
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
          <p className="text-[10px] font-black uppercase tracking-widest mb-2 mt-3" style={{ color: 'var(--text-muted)' }}>
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

      {/* Input */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{
          background: 'var(--card)',
          borderTop: '1px solid var(--card-border)',
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
