'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Send, Sparkles, Heart, ShoppingBag, Mic, MicOff, Volume2, VolumeX, RefreshCw, StopCircle } from 'lucide-react'

// ── Tipos para Web Speech API ─────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ── Hook de Text-to-Speech con ElevenLabs (Ivanna) ───────────────────────────
function useTextToSpeech() {
  const { t, locale } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return

    // Cancelar cualquier audio en curso
    abortRef.current?.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    abortRef.current = new AbortController()
    setSpeaking(true)

    try {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale || 'es' },
        body: JSON.stringify({ text, locale: localStorage.getItem('vanty_locale') || 'es' }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setSpeaking(false)
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('ElevenLabs TTS falló, usando voz del navegador como fallback')
        // Fallback al TTS del navegador si ElevenLabs falla
        if ('speechSynthesis' in window) {
          const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n{2,}/g, '. ').trim().slice(0, 4000)
          const utter = new SpeechSynthesisUtterance(clean)
          utter.lang = toBCP47(locale)
          utter.rate = 1.05
          utter.onend = () => setSpeaking(false)
          utter.onerror = () => setSpeaking(false)
          window.speechSynthesis.speak(utter)
        } else {
          setSpeaking(false)
        }
      } else {
        setSpeaking(false)
      }
    }
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    abortRef.current?.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (speaking) {
      abortRef.current?.abort()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
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
      <line x1="40" y1="6" x2="40" y2="16" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
      <circle cx="40" cy="4" r="4" fill="#818cf8"/>
      {/* Cabeza */}
      <rect x="16" y="16" width="48" height="36" rx="12" fill="url(#robotHead)"/>
      {/* Ojos */}
      <circle cx="29" cy="32" r="7" fill="white"/>
      <circle cx="51" cy="32" r="7" fill="white"/>
      <circle cx="31" cy="32" r="3.5" fill="#4f46e5" style={animated ? { animation: 'eyeGlow 1.8s ease-in-out infinite' } : {}}/>
      <circle cx="53" cy="32" r="3.5" fill="#4f46e5" style={animated ? { animation: 'eyeGlow 1.8s ease-in-out infinite .2s' } : {}}/>
      <circle cx="32" cy="31" r="1.2" fill="white"/>
      <circle cx="54" cy="31" r="1.2" fill="white"/>
      {/* Boca */}
      <rect x="26" y="42" width="28" height="5" rx="2.5" fill="white" opacity=".6"/>
      <rect x="29" y="43" width="6" height="3" rx="1.5" fill="#818cf8"/>
      <rect x="37" y="43" width="6" height="3" rx="1.5" fill="#818cf8"/>
      {/* Cuello */}
      <rect x="34" y="52" width="12" height="6" rx="3" fill="#6366f1"/>
      {/* Cuerpo */}
      <rect x="20" y="58" width="40" height="20" rx="8" fill="url(#robotBody)"/>
      {/* Pecho indicador */}
      <circle cx="40" cy="68" r="5" fill="url(#chestLight)" style={animated ? { animation: 'chestPulse 1.5s ease-in-out infinite' } : {}}/>
      {/* Gradientes */}
      <defs>
        <linearGradient id="robotHead" x1="16" y1="16" x2="64" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1"/>
          <stop offset="1" stopColor="#4f46e5"/>
        </linearGradient>
        <linearGradient id="robotBody" x1="20" y1="58" x2="60" y2="78" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818cf8"/>
          <stop offset="1" stopColor="#6366f1"/>
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
// ── Simple markdown renderer ─────────────────────────────────────────────────
function renderMarkdown(text: string) {
  if (!text) return null
  const lines = text.split('\n')
  const elements: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Empty line
    if (!line.trim()) { elements.push(<div key={i} className="h-2"/>); i++; continue }
    // H3 ### 
    if (line.startsWith('### ')) {
      elements.push(<p key={i} className="font-black text-sm mt-3 mb-1" style={{ color: "var(--c-text-primary)" }}>{parseInline(line.slice(4))}</p>); i++; continue
    }
    // Bold line **text** alone
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<p key={i} className="font-black text-sm mt-2 mb-0.5" style={{ color: "var(--c-text-primary)" }}>{line.slice(2, -2)}</p>); i++; continue
    }
    // Bullet
    if (line.startsWith('- ') || line.startsWith('• ')) {
      elements.push(
        <div key={i} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: "var(--c-text-secondary)" }}>
          <span className="text-indigo-400 font-black mt-0.5 flex-shrink-0">·</span>
          <span>{parseInline(line.slice(2))}</span>
        </div>
      ); i++; continue
    }
    // Numbered list
    const numMatch = line.match(/^(\d+)\. (.+)/)
    if (numMatch) {
      elements.push(
        <div key={i} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: "var(--c-text-secondary)" }}>
          <span className="text-indigo-500 font-black text-xs mt-0.5 flex-shrink-0 w-4">{numMatch[1]}.</span>
          <span>{parseInline(numMatch[2])}</span>
        </div>
      ); i++; continue
    }
    // Regular paragraph
    elements.push(<p key={i} className="text-sm leading-relaxed" style={{ color: "var(--c-text-secondary)" }}>{parseInline(line)}</p>)
    i++
  }
  return <div className="flex flex-col gap-1">{elements}</div>
}

function parseInline(text: string): ReactNode {
  // Handle **bold** inline
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? <strong key={i} className="font-black" style={{ color: "var(--c-text-primary)" }}>{p}</strong> : p
      )}
    </>
  )
}

function MessageBubble({ m, onNavigateToStore, onWellbeingAnswer }: { m: any; onNavigateToStore?: () => void; onWellbeingAnswer?: (opt: string) => void }) {
  const { t } = useI18n()

  const isUser = m.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[78%] px-5 py-3.5 rounded-3xl rounded-br-lg text-sm font-medium leading-relaxed text-white shadow-lg"
          style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 18px rgba(79,70,229,.35)' }}>
          {m.text}
        </div>
      </div>
    )
  }

  if (m.type === 'wellbeing') {
    return (
      <div className="flex gap-3 mb-4 items-start">
        <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#fce7f3,#ede9fe)' }}>
          <Heart size={15} className="text-pink-600" />
        </div>
        <div className="max-w-[82%] rounded-3xl rounded-tl-lg overflow-hidden shadow-sm border border-pink-100"
          style={{ background: 'var(--c-surface)' }}>
          <div className="px-5 pt-4 pb-2">
            <p className="text-xs font-black text-pink-500 uppercase tracking-widest mb-2">{t('ui.checkBienestar')}</p>
            <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--c-text-secondary)" }}>
              ¿Cómo te has sentido tú esta semana acompañando el proceso de tu hijo/a?
            </p>
          </div>
          <div className="px-4 pb-4 flex flex-col gap-2">
            {['😊 Bien, con energía', '😐 Regular, algo cansado/a', '😔 Difícil, necesito apoyo'].map(opt => (
              <button key={opt}
                onClick={() => onWellbeingAnswer?.(opt)}
                className="text-left px-4 py-3 text-sm font-semibold rounded-2xl border-2 transition-all w-full" style={{ background: "var(--c-surface)", borderColor: "var(--c-border)", color: "var(--c-text-primary)" }}>
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
        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', padding: 4 }}>
        <RobotAvatar size={28} />
      </div>

      <div className="max-w-[82%] flex flex-col gap-2">
        {/* Burbuja principal */}
        <div className={`rounded-3xl rounded-tl-lg px-5 py-4 shadow-sm text-sm font-medium leading-relaxed
          ${m.type === 'emotional'
            ? 'border-2 border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-slate-700 dark:text-slate-200'
            : 'text-slate-700 dark:text-slate-100'
          }`}
          style={{
            background: m.type === 'emotional' ? undefined : 'var(--c-card)',
            border: m.type === 'emotional' ? undefined : '1px solid var(--c-border)',
            boxShadow: '0 2px 16px rgba(0,0,0,.06)'
          }}>
          {m.type === 'emotional' && (
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-100 dark:border-blue-800/50">
              <Heart size={13} className="text-blue-500 dark:text-blue-400 fill-blue-500" />
              <span className="text-xs font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest">{t('ui.from_therapist')}</span>
            </div>
          )}
          {renderMarkdown(m.text)}
        </div>

        {/* Tarjeta producto sugerido */}
        {m.producto && (
          <div className="rounded-2xl overflow-hidden border-2 border-amber-200 shadow-md"
            style={{ background: 'var(--c-stat-amber)', animation: 'fadeUp .4s ease .15s both' }}>
            <div className="flex items-center gap-2 px-4 py-2.5"
              style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <ShoppingBag size={14} className="text-white" />
              <span className="text-xs font-black text-white uppercase tracking-wider">{t('ui.disponibleTienda')}</span>
            </div>
            <div className="flex gap-3 p-4 items-center">
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-amber-100 flex items-center justify-center text-3xl border border-amber-200">
                {m.producto.imagen_url
                  ? <img src={m.producto.imagen_url} alt="" className="w-full h-full object-cover" />
                  : (m.producto.tipo === 'digital' ? '📄' : '📦')
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-amber-900 text-sm leading-tight mb-1">{m.producto.nombre}</p>
                {(m.producto.razon || m.producto.descripcion) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mb-2 line-clamp-2">
                    💡 {m.producto.razon || m.producto.descripcion}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400">S/ {Number(m.producto.precio_soles).toFixed(2)}</span>
                  <button onClick={onNavigateToStore}
                    className="px-3.5 py-1.5 text-xs font-black text-white rounded-xl transition-all hover:scale-105 active:scale-95"
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
        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', padding: 4 }}>
        <RobotAvatar size={28} animated />
      </div>
      <div className="rounded-3xl rounded-tl-lg px-5 py-3.5 shadow-sm flex items-center gap-1.5" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
        {[0, .2, .4].map(d => (
          <div key={d} className="w-2 h-2 rounded-full bg-indigo-400 dark:bg-indigo-500"
            style={{ animation: `typingDot 1.2s ease-in-out infinite`, animationDelay: `${d}s` }} />
        ))}
        <span className="text-xs font-medium ml-2" style={{ color: "var(--c-text-muted)" }}>{t('common.analizando')}</span>
      </div>
    </div>
  )
}

// ── Pantalla de bienvenida ────────────────────────────────────────────────────
function WelcomeScreen({ childName, onQuickSend }: { childName: string; onQuickSend: (q: string) => void }) {
  const { t } = useI18n()

  const quick = [
    { icon: '📋', text: '¿Cómo le fue en la última sesión?', accent: '#6366f1' },
    { icon: '🏠', text: 'Dame consejos para casa',             accent: '#10b981' },
    { icon: '🎯', text: '¿Qué objetivos está trabajando?',    accent: '#f59e0b' },
    { icon: '💙', text: 'Necesito apoyo emocional',           accent: '#ec4899' },
  ]
  return (
    <div className="flex flex-col items-center justify-center px-5 py-8 text-center" style={{ animation: 'fadeUp .4s ease', flex: 1 }}>
      {/* Avatar compacto */}
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', padding: 8 }}>
        <RobotAvatar size={36} />
      </div>

      <h3 className="text-xl font-black mb-1" style={{ color: "var(--c-text-primary)" }}>
        Hola, soy <span className="text-indigo-600">ARIA</span>
      </h3>
      <p className="text-sm mb-1" style={{ color: "var(--c-text-muted)" }}>Asistente clínico de Neuropsicología y Terapias SANTI</p>
      <p className="text-xs mb-6 leading-relaxed max-w-[280px]" style={{ color: "var(--c-text-muted)" }}>
        He revisado el historial de <strong className="text-slate-600 dark:text-slate-300">{childName || 'tu hijo/a'}</strong>.
        Puedo explicarte sesiones, tareas para casa y mucho más.
      </p>

      {/* Quick actions — cleaner */}
      <div className="flex flex-col gap-2 w-full max-w-[320px]">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--c-text-muted)" }}>¿Por dónde empezamos?</p>
        {(quick as any[]).map(({ icon, text, accent }: any) => (
          <button key={text} onClick={() => onQuickSend(text)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all active:scale-[.98] relative overflow-hidden"
            style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
            <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:accent, borderRadius:'8px 0 0 8px' }}/>
            <span className="text-base shrink-0 ml-1">{icon}</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--c-text-primary)' }}>{text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
function ChatInterface({ childId, childName, onNavigateToStore, parentId }: any) {
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

  // ── Guardar respuesta de bienestar ─────────────────────────────────────────
  const handleWellbeingAnswer = useCallback(async (opt: string) => {
    if (parentId) {
      await supabase.from('parent_forms').insert([{
        parent_id: parentId,
        child_id: childId || null,
        form_type: 'wellbeing',
        form_title: opt,
        status: 'completed',
        responses: { answer: opt },
        created_at: new Date().toISOString(),
      }])
    }
    setMessages(p => [...p,
      { role: 'user', text: opt },
      { role: 'ai', text: '¡Gracias por compartir cómo te sientes! 💜 Tu bienestar también importa mucho para el progreso de tu hijo/a.' }
    ])
  }, [parentId, childId])

  const sendText = async (txt: string) => {
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
        /* Responsive chat */
        .chat-welcome-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media(min-width:640px){
          .chat-welcome-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media(max-width:360px){
          .chat-welcome-grid {
            grid-template-columns: 1fr;
          }
          .chat-input-area { padding: 10px 12px !important }
        }
      `}</style>

      <div className="flex flex-col" style={{ background: "var(--card)", height: "100%", minHeight: 0, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Header — clean, professional ── */}
        <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', padding: 5 }}>
            <RobotAvatar size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-black text-sm" style={{ color: "var(--c-text-primary)" }}>ARIA</p>
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                En línea
              </span>
              {speaking && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-1.5 py-0.5 rounded-full">
                  <Volume2 size={9} /> Hablando...
                </span>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: "var(--c-text-muted)" }}>
              {childName ? `Especializada en ${childName}` : 'Asistente clínico IA'}
            </p>
          </div>
          <button onClick={toggleVoice} title={voiceEnabled ? 'Silenciar' : 'Activar voz'}
            className="p-2 rounded-xl transition-all" style={{ background: "var(--muted-bg)", color: voiceEnabled ? '#6366f1' : 'var(--c-text-muted)' }}>
            {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button onClick={handleReset} title="Nueva conversación"
            className="p-2 rounded-xl transition-all" style={{ background: "var(--muted-bg)", color: "var(--c-text-muted)" }}>
            <RefreshCw size={15} />
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
              <p className="text-sm font-black text-red-700 dark:text-red-300">Escuchando...</p>
              <p className="text-xs text-red-500 font-medium">{t('aria.hablaAhora')}</p>
            </div>
            <button onClick={stopListening}
              className="p-1.5 rounded-xl bg-red-100 hover:bg-red-200 transition-all">
              <StopCircle size={16} className="text-red-600 dark:text-red-400" />
            </button>
          </div>
        )}

        {/* ── Área de mensajes ── */}
        <div className="" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--card-border) transparent", flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", background: "var(--background)" }}>

          {showWelcome && messages.length === 0 ? (
            <WelcomeScreen childName={childName} onQuickSend={send} />
          ) : (
            <>
              {messages.map((m, i) => (
                <div key={i} style={{ animation: 'fadeUp .3s ease' }}>
                  <MessageBubble m={m} onNavigateToStore={onNavigateToStore} onWellbeingAnswer={handleWellbeingAnswer} />
                </div>
              ))}
              {typing && <TypingIndicator />}
              <div ref={endRef} />
            </>
          )}
        </div>

        {/* ── Preguntas rápidas (visible cuando hay mensajes) ── */}
        {!showWelcome && messages.length > 0 && !typing && (
          <div className="shrink-0 px-3 pb-1 border-t" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <div className="flex gap-1.5 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
              {['📋 Última sesión', '🏠 Tips para casa', '🎯 Objetivos', '💙 Apoyo'].map((q, i) => {
                const texts = ['¿Cómo le fue en la última sesión?', 'Dame consejos para actividades en casa', '¿Qué objetivos está trabajando?', 'Necesito apoyo emocional']
                return (
                  <button key={i} onClick={() => send(texts[i])}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap" style={{ background: "var(--muted-bg)", border: "1px solid var(--card-border)", color: "var(--text-muted)" }}>
                    {q}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Input con voz ── */}
        <div className="shrink-0 px-3 py-3 border-t" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder={listening ? '🎤 Escuchando...' : childName ? `Pregúntame sobre ${childName}...` : 'Escribe tu pregunta...'}
                disabled={typing || listening}
                className="w-full text-sm font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none transition-all"
                style={{
                  background: listening ? '#fef2f2' : '#f8fafc',
                  border: `1.5px solid ${listening ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: 14,
                  padding: '11px 16px',
                  fontFamily: 'inherit',
                }}
                onFocus={e => {
                  if (!listening) {
                    e.target.style.background = 'var(--c-card)'
                    e.target.style.borderColor = '#6366f1'
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,.08)'
                  }
                }}
                onBlur={e => {
                  if (!listening) {
                    e.target.style.background = '#f8fafc'
                    e.target.style.borderColor = '#e2e8f0'
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
                  : <Mic size={18} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
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
                  background: 'linear-gradient(135deg,#6366f1,#7c3aed)',
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
                style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.45)' }}>
                <Send size={18} className="text-white" style={{ transform: 'translateX(1px)' }} />
              </button>
            )}
          </div>

          {listening && (
            <p className="text-center text-[10px] text-red-400 mt-1.5 font-medium">🔴 Grabando — habla cerca del micrófono</p>
          )}
          <p className="text-center text-[10px] text-slate-300 mt-1 font-medium">
            ARIA puede cometer errores · Consulta con tu terapeuta
          </p>
        </div>
      </div>
    </>
  )
}

export default ChatInterface
