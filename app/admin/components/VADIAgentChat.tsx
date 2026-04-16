'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send, Loader2, Bot, User, Sparkles, BookOpen, Brain,
  MessageCircle, ChevronDown, X, Zap, AlertTriangle, Clock
} from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fuentes?: string[]
}

interface VADIAgentChatProps {
  userId: string
  childId?: string
  childName?: string
  contexto?: string
  compact?: boolean
}

export default function VADIAgentChat({
  userId, childId, childName, contexto = 'general', compact = false
}: VADIAgentChatProps) {
  const { t, locale } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversacionId, setConversacionId] = useState<string | null>(null)
  const [sugerencias] = useState([
    childId ? `¿Cómo va el progreso general de ${childName || 'este paciente'}?` : '¿Cuáles son los mejores reforzadores para TEA no verbal?',
    '¿Qué dice Malott sobre extinción de escape?',
    childId ? `¿Qué programas recomiendas para ${childName || 'este paciente'}?` : '¿Cómo aplico el modelo ético IBAO ante un dilema?',
    '¿Cuáles son los criterios DSM-5 para TEA nivel 2?',
  ])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mensaje de bienvenida
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: childId
        ? `¡Hola! Soy **VADI**, tu asistente clínico. Estoy revisando el expediente de **${childName || 'tu paciente'}** y tengo acceso a todo su historial, programas ABA y evaluaciones previas.\n\n¿En qué te puedo ayudar hoy? Puedo analizar tendencias de progreso, sugerirte estrategias clínicas, o responder dudas sobre el caso.`
        : `¡Hola! Soy **VADI**, el cerebro clínico de Vanty. Tengo acceso a todos los expedientes del sistema.\n\n¿Cómo puedo ayudarte hoy?`,
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
        body: JSON.stringify({
          mensaje: msg,
          childId,
          userId,
          conversacionId,
          contexto,
          locale: typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es',
        }),
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
    } catch (err: any) {
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
    <div className={`flex flex-col bg-white rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden ${compact ? 'h-[500px]' : 'h-[680px]'}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center">
          <Brain size={18} className="text-white" />
        </div>
        <div>
          <h3 className="font-black text-white text-sm flex items-center gap-2">
            VADI — Asistente Clínico IA
            <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[9px] font-black">BETA</span>
          </h3>
          <p className="text-violet-200 text-[10px]">
            {childId ? `Caso activo: ${childName || 'Paciente'}` : 'Asistente clínico especializado'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-white/70 text-[10px] font-bold">{t('common.activo')}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-2xl flex items-center justify-center shrink-0">
              <Brain size={14} className="text-violet-600" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-violet-500" />
              <span className="text-sm text-slate-500">{t('ui.vadiPensando')}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugerencias rápidas (solo si no hay conversación) */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">{t('ui.suggested_questions')}</p>
          <div className="flex flex-wrap gap-2">
            {sugerencias.slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => sendMessage(s)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-600 transition-all text-left leading-tight">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-100">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            {...{placeholder: t('ui.ask_vadi')}}
            className="flex-1 p-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm resize-none outline-none focus:border-violet-400 transition-all leading-relaxed max-h-28"
            style={{ minHeight: '44px' }}
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
            className="w-11 h-11 bg-violet-600 text-white rounded-2xl flex items-center justify-center hover:bg-violet-700 disabled:opacity-40 transition-all shrink-0">
            <Send size={16} />
          </button>
        </div>
        <p className="text-[10px] text-slate-300 mt-1.5 text-center">
          
        </p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message; key?: any }) {
  const { t, locale } = useI18n()
  const isUser = message.role === 'user'

  // Convertir **negrita** y saltos de línea
  const formatContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      )
    })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${
        isUser ? 'bg-indigo-100' : 'bg-violet-100'
      }`}>
        {isUser ? <User size={14} className="text-indigo-600" /> : <Brain size={14} className="text-violet-600" />}
      </div>
      <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-slate-100 text-slate-800 rounded-tl-sm'
        }`}>
          {formatContent(message.content)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-300">
            {new Date(message.timestamp).toLocaleTimeString(toBCP47(locale), { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.fuentes && message.fuentes.length > 0 && (
            <div className="flex gap-1">
              {message.fuentes.map((f, i) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded-full border border-violet-200 font-bold flex items-center gap-1">
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
