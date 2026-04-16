'use client'
import { useI18n } from '@/lib/i18n-context'
// components/portal-padres/ChatPadres.tsx
import { useState, useEffect, useRef } from 'react'

interface Mensaje {
  id?: string
  rol: 'user' | 'assistant'
  mensaje: string
  created_at?: string
}

interface ChatPadresProps {
  childId: string
  parentUserId: string
  childName: string
}

const SUGERENCIAS = [
  '¿Cómo va esta semana?',
  '¿Qué puedo practicar en casa?',
  '¿Qué fue lo mejor de la última sesión?',
  '¿Cuándo es la próxima cita?',
  '¿Qué tareas tenemos pendientes?',
]

export default function ChatPadres({ childId, parentUserId, childName }: ChatPadresProps) {
  const { t, locale } = useI18n()
  const [mensajes, setMensajes]   = useState<Mensaje[]>([])
  const [input, setInput]         = useState('')
  const [enviando, setEnviando]   = useState(false)
  const [cargando, setCargando]   = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cargarHistorial()
  }, [childId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function cargarHistorial() {
    try {
      const res = await fetch(`/api/parent-chat?child_id=${childId}&parent_user_id=${parentUserId}`)
      const data = await res.json()
      setMensajes(data.data || [])
    } catch {}
    finally { setCargando(false) }
  }

  async function enviarMensaje(texto?: string) {
    const msg = texto || input.trim()
    if (!msg || enviando) return

    setInput('')
    setEnviando(true)

    const msgUsuario: Mensaje = { rol: 'user', mensaje: msg }
    setMensajes(prev => [...prev, msgUsuario])

    try {
      const res = await fetch('/api/parent-chat', {
        method: 'POST',
        headers: { 'x-locale': locale || 'es', 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es', mensaje: msg, childId, parentUserId })
      })
      const data = await res.json()

      const msgAsistente: Mensaje = { rol: 'assistant', mensaje: data.respuesta || 'Disculpa, hubo un error. Intenta nuevamente.' }
      setMensajes(prev => [...prev, msgAsistente])
    } catch {
      setMensajes(prev => [...prev, { rol: 'assistant', mensaje: 'Hubo un problema de conexión. Por favor intenta de nuevo.' }])
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  return (
    <div className="flex flex-col" style={{ height: '500px' }}>

      {/* Encabezado */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="bg-white bg-opacity-20 rounded-full p-2">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <p className="font-semibold">Asistente Virtual</p>
            <p className="text-blue-100 text-xs">Jugando Aprendo • Siempre disponible</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-blue-100">{t('familias.enLinea')}</span>
          </div>
        </div>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
        {mensajes.length === 0 && (
          <div className="text-center py-6">
            <p className="text-3xl mb-3">💬</p>
            <p className="text-gray-600 font-medium text-sm">¡Hola! Soy el asistente de {childName}.</p>
            <p className="text-gray-400 text-xs mt-1">{t('familias.preguntarProgreso')}itas.</p>
          </div>
        )}

        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.rol === 'assistant' && (
              <div className="bg-blue-100 rounded-full w-7 h-7 flex items-center justify-center mr-2 mt-1 flex-shrink-0 text-sm">
                🤖
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.rol === 'user'
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-gray-100 text-gray-800 rounded-bl-md'
            }`}>
              {m.mensaje}
            </div>
          </div>
        ))}

        {enviando && (
          <div className="flex justify-start">
            <div className="bg-blue-100 rounded-full w-7 h-7 flex items-center justify-center mr-2 mt-1 text-sm">🤖</div>
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Sugerencias rápidas */}
      {mensajes.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGERENCIAS.map((s, i) => (
            <button key={i} onClick={() => enviarMensaje(s)}
              className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensaje()}
          placeholder={`Pregunta sobre ${childName}...`}
          disabled={enviando}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50"
        />
        <button
          onClick={() => enviarMensaje()}
          disabled={!input.trim() || enviando}
          className="bg-blue-600 text-white rounded-xl px-4 py-3 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
