'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Sparkles, Heart, ShoppingBag, Mic, MicOff, Volume2, VolumeX, RefreshCw, StopCircle } from 'lucide-react'

// ── Tipos para Web Speech API ─────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ── Hook de Text-to-Speech ────────────────────────────────────────────────────
function useTextToSpeech() {
  const { t, locale } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return
    // Cancelar cualquier voz en curso
    window.speechSynthesis.cancel()
    // Limpiar markdown básico para mejor lectura
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/💙|📊|🏠|💬|❌|⚠️|✅|🎯|📋|💡|🤖|💜/g, '')
      .replace(/\n{2,}/g, '. ')
      .trim()
    const utter = new SpeechSynthesisUtterance(clean)
    utter.lang = toBCP47(locale)
    utter.rate = 1.05
    utter.pitch = 1.1
    utter.volume = 0.95
    // Preferir voz en español si está disponible
    const voices = window.speechSynthesis.getVoices()
    const langPrefix = 'es'
    const esVoice = voices.find(v => v.lang.startsWith(langPrefix) && v.localService) ||
                    voices.find(v => v.lang.startsWith(langPrefix))
    if (esVoice) utter.voice = esVoice
    utter.onstart = () => setSpeaking(true)
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    utteranceRef.current = utter
    window.speechSynthesis.speak(utter)
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (speaking) window.speechSynthesis.cancel()
    setVoiceEnabled(v => !v)
  }, [speaking])

  return { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice }
}

// ── Hook de Speech-to-Text ────────────────────────────────────────────────────
function useSpeechToText(onResult: (text: string) => void) {
  const { t, locale } = useI18n()

  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSupported(true)
      const rec = new SpeechRecognition()
      rec.lang = toBCP47(locale)
      rec.continuous = false
      rec.interimResults = false
      rec.maxAlternatives = 1
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript
        onResult(transcript)
      }
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recognitionRef.current = rec
    }
  }, [onResult])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return
    setListening(true)
    recognitionRef.current.start()
  }, [listening])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    recognitionRef.current.stop()
    setListening(false)
  }, [])

  return { listening, supported, startListening, stopListening }
}

// ── Detección emocional ───────────────────────────────────────────────────────
const EMOTIONAL_KEYWORDS = [
  'cansado','cansada','agotado','agotada','frustrado','frustrada',
  'triste','llorar','lloro','no sé qué hacer','no avanza','no mejora',
  'sin esperanza','desesperado','desesperada','culpa','culpable',
  'difícil','no puedo','rendirme','solo','sola','nadie entiende',
  'necesito ayuda','estoy mal','me siento mal','deprimido','deprimida',
  'preocupado','preocupada','angustiado','angustiada','miedo',
]

function detectsEmotion(t: string) {

  const l = t.toLowerCase()
  return EMOTIONAL_KEYWORDS.some(kw => l.includes(kw))
}

function getEmotionalPrefix(text: string): string {
  const { t } = useI18n()

  const l = text.toLowerCase()
  if (l.includes('cansad') || l.includes('agotad'))
    return '💙 Entiendo que estás cansado/a, y eso es completamente válido. Acompañar a un hijo en este proceso requiere muchísima energía.\n\n'
  if (l.includes('culpa'))
    return '💙 No hay culpa aquí. Eres un papá/mamá que busca lo mejor para su hijo/a — eso ya dice todo de ti.\n\n'
  if (l.includes('no avanza') || l.includes('no mejora'))
    return '💙 El progreso en terapia ABA no siempre es lineal, pero sí real. Hay avances que se acumulan aunque no los veamos cada día.\n\n'
  if (l.includes('solo') || l.includes('sola') || l.includes('nadie entiende'))
    return '💙 No estás solo/a. Todo el equipo de Neuropsicología y Terapias SANTI está aquí para acompañarte — a ti y a tu familia.\n\n'
  return '💙 Escucho cómo te sientes, y es completamente válido. Estoy aquí.\n\n'
}

// ── Robot SVG mascota ─────────────────────────────────────────────────────────
function RobotAvatar({ size = 36, animated = false }: { size?: number; animated?: boolean }) {
  const { t } = useI18n()

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={animated ? { animation: 'robotBob 2s ease-in-out infinite' } : {}}>
      {/* Antena */}
      <line x1="40" y1="6" x2="40" y2="16" stroke="#0284c7" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="40" cy="4" r="4" fill="#38bdf8"/>
      {/* Cabeza */}
      <rect x="16" y="16" width="48" height="36" rx="12" fill="url(#robotHead)"/>
      {/* Ojos */}
      <circle cx="29" cy="32" r="7" fill="white"/>
      <circle cx="51" cy="32" r="7" fill="white"/>
      <circle cx="31" cy="32" r="3.5" fill="#0369a1" style={animated ? { animation: 'eyeGlow 1.8s ease-in-out infinite' } : {}}/>
      <circle cx="53" cy="32" r="3.5" fill="#0369a1" style={animated ? { animation: 'eyeGlow 1.8s ease-in-out infinite .2s' } : {}}/>
      <circle cx="32" cy="31" r="1.2" fill="white"/>
      <circle cx="54" cy="31" r="1.2" fill="white"/>
      {/* Boca */}
      <rect x="26" y="42" width="28" height="5" rx="2.5" fill="white" opacity=".6"/>
      <rect x="29" y="43" width="6" height="3" rx="1.5" fill="#38bdf8"/>
      <rect x="37" y="43" width="6" height="3" rx="1.5" fill="#38bdf8"/>
      {/* Cuello */}
      <rect x="34" y="52" width="12" height="6" rx="3" fill="#0284c7"/>
      {/* Cuerpo */}
      <rect x="20" y="58" width="40" height="20" rx="8" fill="url(#robotBody)"/>
      {/* Pecho indicador */}
      <circle cx="40" cy="68" r="5" fill="url(#chestLight)" style={animated ? { animation: 'chestPulse 1.5s ease-in-out infinite' } : {}}/>
      {/* Gradientes */}
      <defs>
        <linearGradient id="robotHead" x1="16" y1="16" x2="64" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0284c7"/>
          <stop offset="1" stopColor="#0369a1"/>
        </linearGradient>
        <linearGradient id="robotBody" x1="20" y1="58" x2="60" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38bdf8"/>
          <stop offset="1" stopColor="#0284c7"/>
        </linearGradient>
        <radialGradient id="chestLight" cx="50%" cy="50%" r="50%">
          <stop stopColor="#a5f3fc"/>
          <stop offset="1" stopColor="#38bdf8"/>
        </radialGradient>
      </defs>
    </svg>
  )
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────
function MessageBubble({ m, onNavigateToStore }: { m: any; onNavigateToStore?: () => void }) {
  const { t } = useI18n()

  const isUser = m.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[78%] px-5 py-3.5 rounded-3xl rounded-br-lg text-sm font-medium leading-relaxed text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg,#0369a1,#0284c7)', boxShadow: '0 4px 18px rgba(79,70,229,.35)' }}>
          {m.text}
        </div>
      </div>
    )
  }

  if (m.type === 'wellbeing') {
    const { t } = useI18n()
    return (
      <div className="flex gap-3 mb-4 items-start">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#fce7f3,#e0f2fe)' }}>
          <Heart size={15} className="text-pink-600" />
        </div>
        <div className="max-w-[82%] rounded-3xl rounded-tl-lg overflow-hidden shadow-sm border border-pink-100"
          style={{ background: 'linear-gradient(135deg,#fdf2f8,#faf5ff)' }}>
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-bold text-pink-500 uppercase tracking-widest mb-2">{t('ui.checkBienestar')}</p>
            <p className="text-sm text-slate-700 font-medium leading-relaxed">
              ¿Cómo te has sentido tú esta semana acompañando el proceso de tu hijo/a?
            </p>
          </div>
          <div className="px-4 pb-4 flex flex-col gap-2">
            {['😊 Bien, con energía', '😐 Regular, algo cansado/a', '😔 Difícil, necesito apoyo'].map(opt => (
              <button key={opt}
                className="text-left px-4 py-3 text-sm font-semibold text-slate-700 rounded-2xl border-2 border-sky-100 transition-all hover:border-sky-400 hover:bg-sky-50 bg-white">
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4 items-start">
      {/* Avatar del robot */}
      <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md"
        style={{ background: 'linear-gradient(135deg,#eef2ff,#dbeafe)', padding: 4 }}>
        <RobotAvatar size={28} />
      </div>

      <div className="max-w-[82%] flex flex-col gap-2">
        {/* Burbuja principal */}
        <div className={`rounded-3xl rounded-tl-lg px-5 py-4 shadow-sm text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-100
          ${m.type === 'emotional'
            ? 'border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-900/40 dark:to-sky-900/40 dark:border-blue-700'
            : 'bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600'
          }`}
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          {m.type === 'emotional' && (
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-100">
              <Heart size={13} className="text-blue-500 fill-blue-500" />
              <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">{t('ui.from_therapist')}</span>
            </div>
          )}
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>

        {/* Tarjeta producto sugerido */}
        {m.producto && (
          <div className="rounded-2xl overflow-hidden border-2 border-amber-200 shadow-md"
            style={{ background: 'linear-gradient(135deg,#fffbeb,#fef9c3)', animation: 'fadeUp .4s ease .15s both' }}>
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <ShoppingBag size={14} className="text-white" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">{t('ui.disponibleTienda')}</span>
            </div>
            <div className="flex gap-3 p-4 items-center">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-amber-100 flex items-center justify-center text-3xl border border-amber-200">
                {m.producto.imagen_url
                  ? <img src={m.producto.imagen_url} alt="" className="w-full h-full object-cover" />
                  : (m.producto.tipo === 'digital' ? '📄' : '📦')
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-amber-900 text-sm leading-tight mb-1">{m.producto.nombre}</p>
                {(m.producto.razon || m.producto.descripcion) && (
                  <p className="text-xs text-amber-700 leading-relaxed mb-2 line-clamp-2">
                    💡 {m.producto.razon || m.producto.descripcion}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-amber-600">S/ {Number(m.producto.precio_soles).toFixed(2)}</span>
                  <button onClick={onNavigateToStore}
                    className="px-3.5 py-1.5 text-xs font-bold text-white rounded-xl transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 3px 10px rgba(217,119,6,.35)' }}>
                    Ver en tienda →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Indicador de escritura ────────────────────────────────────────────────────
function TypingIndicator() {
  const { t, locale } = useI18n()
  return (
    <div className="flex gap-3 mb-4 items-center">
      <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center shadow-md"
        style={{ background: 'linear-gradient(135deg,#eef2ff,#dbeafe)', padding: 4 }}>
        <RobotAvatar size={28} animated />
      </div>
      <div className="bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-3xl rounded-tl-lg px-5 py-3.5 shadow-sm flex items-center gap-1.5">
        {[0, .2, .4].map(d => (
          <div key={d} className="w-2 h-2 rounded-full bg-sky-400"
            style={{ animation: `typingDot 1.2s ease-in-out infinite`, animationDelay: `${d}s` }} />
        ))}
        <span className="text-xs text-slate-400 font-medium ml-2">{t('common.analizando')}</span>
      </div>
    </div>
  )
}

// ── Pantalla de bienvenida ────────────────────────────────────────────────────
function WelcomeScreen({ childName, onQuickSend }: { childName: string; onQuickSend: (q: string) => void }) {
  const { t } = useI18n()

  const quick = [
    { icon: '📋', text: '¿Cómo le fue en la última sesión?', color: '#eef2ff', border: '#c7d2fe' },
    { icon: '🏠', text: 'Dame consejos para casa', color: '#f0fdf4', border: '#bbf7d0' },
    { icon: '🎯', text: '¿Qué objetivos está trabajando?', color: '#fff7ed', border: '#fed7aa' },
    { icon: '💙', text: 'Necesito apoyo emocional', color: '#fdf2f8', border: '#f9a8d4' },
  ]
  return (
    <div className="flex flex-col items-center px-6 py-8 text-center" style={{ animation: 'fadeUp .5s ease' }}>
      {/* Robot grande animado */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full blur-2xl opacity-30 scale-110"
          style={{ background: 'radial-gradient(circle,#38bdf8,#7dd3fc)', animation: 'pulse 2s ease-in-out infinite' }} />
        <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(135deg,#eef2ff,#dbeafe)', animation: 'robotBob 2.5s ease-in-out infinite' }}>
          <RobotAvatar size={72} animated />
        </div>
        {/* Brillo orbital */}
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full flex items-center justify-center shadow-md">
          <Sparkles size={12} className="text-white" />
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-1">
        ¡Hola! Soy <span style={{ color: '#0284c7' }}>ARIA</span> 🤖
      </h3>
      <p className="text-sm text-slate-500 font-medium mb-1">
        Tu asistente clínico de Neuropsicología y Terapias SANTI
      </p>
      <p className="text-xs text-slate-400 mb-6 leading-relaxed max-w-xs">
        {t('aria.revisadoHistorial')} <strong className="text-slate-600">{childName || 'tu hijo/a'}</strong> y estoy lista para ayudarte en lo que necesites.
      </p>

      {/* Capacidades */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-sm mb-6">
        {[
          { icon: '📊', label: 'Explico reportes' },
          { icon: '🏠', label: 'Actividades en casa' },
          { icon: '💬', label: 'Respondo dudas' },
          { icon: '💙', label: 'Apoyo emocional' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl px-3 py-2.5 shadow-sm">
            <span className="text-base">{icon}</span>
            <span className="text-xs font-semibold text-slate-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Preguntas rápidas */}
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('aria.dondeEmpezamos')}</p>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {quick.map(({ icon, text, color, border }) => (
          <button key={text} onClick={() => onQuickSend(text)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[.98] group"
            style={{ background: color, borderColor: border }}>
            <span className="text-lg shrink-0">{icon}</span>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-sky-700 transition-colors">{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
function ChatInterface({ childId, childName, onNavigateToStore }: any) {
  const { t, locale } = useI18n()
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [wellbeingShown, setWellbeingShown] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Voz ──
  const { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice } = useTextToSpeech()

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput(transcript)
    // Auto-enviar después de un breve delay para que el usuario vea el texto
    setTimeout(() => {
      sendText(transcript)
    }, 600)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { listening, supported: micSupported, startListening, stopListening } = useSpeechToText(handleVoiceResult)

  // Reset al cambiar de niño
  useEffect(() => {
    setMessages([])
    setShowWelcome(true)
    setWellbeingShown(false)
    stopSpeaking()
  }, [childId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const sendText = async (txt: string) => {
    const { t } = useI18n()
    if (!txt.trim() || typing) return

    setShowWelcome(false)
    setInput('')
    stopSpeaking()

    if (!childId) {
      const errMsg = '⚠️ Cargando perfil del paciente, intenta de nuevo en un momento.'
      setMessages(p => [...p, { role: 'user', text: txt }, { role: 'ai', text: errMsg }])
      speak(errMsg)
      return
    }

    const isEmotional = detectsEmotion(txt)
    setMessages(p => [...p, { role: 'user', text: txt }])
    setTyping(true)

    let emotionalPrefix = ''
    if (isEmotional) {
      emotionalPrefix = getEmotionalPrefix(txt)
      await new Promise(r => setTimeout(r, 700))
      const tempMsg = emotionalPrefix + 'Déjame revisar el historial clínico para darte información más precisa...'
      setMessages(p => [...p, { role: 'ai', text: tempMsg, type: 'emotional' }])
      await new Promise(r => setTimeout(r, 900))
    }

    try {
      const res = await fetch('/api/parent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale || 'es' },
        body: JSON.stringify({
          question: isEmotional
            ? `${txt}\n\n[INSTRUCCIÓN: El padre/madre experimenta carga emocional. Valida primero con calidez genuina antes de información clínica.]`
            : txt,
          childId,
          childName,
        }),
      })
      const data = await res.json()
      const aiResponse = data.text || 'Lo siento, no pude procesar tu pregunta.'
      const productoSugerido = data.producto_sugerido_info || null
      const finalText = isEmotional ? emotionalPrefix + aiResponse : aiResponse

      if (isEmotional) {
        setMessages(p => {
          const copy = [...p]
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].type === 'emotional') {
              copy[i] = { role: 'ai', text: finalText, type: 'emotional', producto: productoSugerido }
              break
            }
          }
          return copy
        })
      } else {
        setMessages(p => [...p, { role: 'ai', text: aiResponse, producto: productoSugerido }])
      }

      // Leer respuesta en voz
      speak(aiResponse)

      // Wellbeing check
      const userCount = messages.filter(m => m.role === 'user').length
      if (userCount >= 2 && !wellbeingShown) {
        setWellbeingShown(true)
        setTimeout(() => {
          setMessages(p => [...p, { role: 'ai', text: '', type: 'wellbeing' }])
        }, 2200)
      }
    } catch {
      const errMsg = '❌ Problema de conexión. Intenta nuevamente.'
      setMessages(p => [...p, { role: 'ai', text: errMsg }])
      speak(errMsg)
    } finally {
      setTyping(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const send = (customText?: string) => sendText(customText || input)

  const handleReset = () => {
    setMessages([])
    setShowWelcome(true)
    setWellbeingShown(false)
    stopSpeaking()
  }

  const handleMicClick = () => {
    if (listening) {
      stopListening()
    } else {
      stopSpeaking()
      startListening()
    }
  }

  return (
    <>
      <style>{`
        @keyframes robotBob {
          0%,100% { transform: translateY(0) }
          50% { transform: translateY(-5px) }
        }
        @keyframes eyeGlow {
          0%,100% { opacity:1 }
          50% { opacity:.5 }
        }
        @keyframes chestPulse {
          0%,100% { opacity:1; transform: scale(1) }
          50% { opacity:.6; transform: scale(.85) }
        }
        @keyframes typingDot {
          0%,60%,100% { transform: translateY(0) }
          30% { transform: translateY(-6px) }
        }
        @keyframes fadeUp {
          from { opacity:0; transform: translateY(12px) }
          to   { opacity:1; transform: translateY(0) }
        }
        @keyframes pulse {
          0%,100% { opacity:.3 }
          50% { opacity:.6 }
        }
        @keyframes micPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.5) }
          50% { box-shadow: 0 0 0 10px rgba(239,68,68,0) }
        }
        @keyframes speakerPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,.4) }
          50% { box-shadow: 0 0 0 8px rgba(99,102,241,0) }
        }
      `}</style>

      <div className="flex flex-col h-full" style={{ background: 'linear-gradient(160deg, #f8f9ff 0%, #f0f0ff 50%, #f8f9ff 100%)' }}>

        {/* ── Header ── */}
        <div className="shrink-0 px-5 py-4 flex items-center gap-3 border-b border-slate-100"
          style={{ background: 'rgba(255,255,255,.85)', backdropFilter: 'blur(12px)' }}>
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1)', padding: 6 }}>
            <RobotAvatar size={30} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-800 text-base">ARIA</p>
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                En línea
              </span>
              {speaking && (
                <span className="flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full"
                  style={{ animation: 'fadeUp .2s ease' }}>
                  <Volume2 size={10} />
                  Hablando...
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium truncate">
              Asistente clínico IA · {childName ? `Historial de ${childName}` : 'Neuropsicología y Terapias SANTI'}
            </p>
          </div>
          {/* Botón silenciar voz */}
          <button onClick={toggleVoice} title={voiceEnabled ? 'Silenciar respuestas de voz' : 'Activar respuestas de voz'}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-all"
            style={{ color: voiceEnabled ? '#0284c7' : '#94a3b8' }}>
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={handleReset}
            className="p-2.5 rounded-xl hover:bg-slate-100 transition-all text-slate-400 hover:text-slate-600">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* ── Banner de micrófono activo ── */}
        {listening && (
          <div className="shrink-0 mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '2px solid #fca5a5', animation: 'fadeUp .2s ease' }}>
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shrink-0"
              style={{ animation: 'micPulse 1.2s ease-in-out infinite' }}>
              <Mic size={14} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-700">Escuchando...</p>
              <p className="text-xs text-red-500 font-medium">{t('aria.hablaAhora')}</p>
            </div>
            <button onClick={stopListening}
              className="p-1.5 rounded-xl bg-red-100 hover:bg-red-200 transition-all">
              <StopCircle size={16} className="text-red-600" />
            </button>
          </div>
        )}

        {/* ── Área de mensajes ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#e2e8f0 transparent' }}>

          {showWelcome && messages.length === 0 ? (
            <WelcomeScreen childName={childName} onQuickSend={send} />
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} style={{ animation: 'fadeUp .3s ease' }}>
                  <MessageBubble m={m} onNavigateToStore={onNavigateToStore} />
                </div>
              ))}
              {typing && <TypingIndicator />}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* ── Preguntas rápidas (visible cuando hay mensajes) ── */}
        {!showWelcome && messages.length > 0 && !typing && (
          <div className="shrink-0 px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {[t('aria.pregSugerida_sesion'), t('aria.pregSugerida_casa'), t('aria.pregSugerida_objetivos'), t('aria.pregSugerida_apoyo')].map((q, i) => {
                const texts = ['¿Cómo le fue en la última sesión?', 'Dame consejos para actividades en casa', '¿Qué objetivos está trabajando?', 'Necesito apoyo emocional']
                return (
                  <button key={i} onClick={() => send(texts[i])}
                    className="shrink-0 px-3.5 py-2 bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-600 hover:text-sky-700 rounded-2xl text-xs font-semibold transition-all whitespace-nowrap shadow-sm">
                    {q}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Input con voz ── */}
        <div className="shrink-0 p-4 border-t border-slate-100"
          style={{ background: 'rgba(255,255,255,.9)', backdropFilter: 'blur(12px)' }}>
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={listening ? '🎤 Escuchando...' : childName ? `Pregúntame sobre ${childName}...` : 'Escribe tu pregunta...'}
                disabled={typing || listening}
                className="w-full text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition-all"
                style={{
                  background: listening ? '#fef2f2' : '#f1f5f9',
                  border: `2px solid ${listening ? '#fca5a5' : 'transparent'}`,
                  borderRadius: 24,
                  padding: '14px 20px',
                  fontFamily: 'inherit',
                }}
                onFocus={e => {
                  if (!listening) {
                    e.target.style.background = '#fff'
                    e.target.style.borderColor = '#0284c7'
                    e.target.style.boxShadow = '0 0 0 4px rgba(99,102,241,.1)'
                  }
                }}
                onBlur={e => {
                  if (!listening) {
                    e.target.style.background = '#f1f5f9'
                    e.target.style.borderColor = 'transparent'
                    e.target.style.boxShadow = 'none'
                  }
                }}
              />
            </div>

            {/* Botón micrófono */}
            {micSupported && (
              <button
                onClick={handleMicClick}
                disabled={typing}
                title={listening ? 'Detener grabación' : 'Hablar con ARIA'}
                className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 hover:scale-105 active:scale-95"
                style={{
                  background: listening
                    ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                    : 'linear-gradient(135deg,#f1f5f9,#e2e8f0)',
                  boxShadow: listening
                    ? '0 4px 18px rgba(239,68,68,.45)'
                    : '0 2px 8px rgba(0,0,0,.08)',
                  animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none',
                }}>
                {listening
                  ? <MicOff size={18} className="text-white" />
                  : <Mic size={18} className="text-slate-500" />
                }
              </button>
            )}

            {/* Botón detener voz / enviar */}
            {speaking ? (
              <button
                onClick={stopSpeaking}
                title={t('aria.detenerVoz')}
                className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg,#0284c7,#0284c7)',
                  boxShadow: '0 4px 18px rgba(99,102,241,.45)',
                  animation: 'speakerPulse 1.5s ease-in-out infinite',
                }}>
                <StopCircle size={18} className="text-white" />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={typing || !input.trim() || listening}
                className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#0284c7,#0284c7)', boxShadow: '0 4px 18px rgba(99,102,241,.45)' }}>
                <Send size={18} className="text-white" style={{ transform: 'translateX(1px)' }} />
              </button>
            )}
          </div>

          {/* Hint de voz */}
          {micSupported && (
            <p className="text-center text-[10px] text-slate-400 mt-2 font-medium">
              {listening ? '🔴 Grabando · Habla claro cerca del micrófono' : '🎤 Toca el micrófono para hablar · ⌨️ O escribe tu mensaje'}
            </p>
          )}
          <p className="text-center text-[10px] text-slate-300 mt-1 font-medium">
            ARIA puede cometer errores · Consulta siempre con tu terapeuta
          </p>
        </div>
      </div>
    </>
  )
}

export default ChatInterface
