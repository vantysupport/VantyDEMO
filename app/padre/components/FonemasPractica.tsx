'use client'
// app/padre/components/FonemasPractica.tsx
// "Fonemas" — actividad interactiva para que el niño/familia practique en casa.
// Tarjeta grande con el fonema, una palabra/imagen de ejemplo y AUDIO (voz del
// navegador, Web Speech API en español). El niño escucha y repite. Cada fonema
// puede marcarse como "logrado" (se guarda por niño en localStorage).

import { useState, useEffect, useRef } from 'react'
import {
  Volume2, Mic, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles,
  Video, Smile, X,
} from 'lucide-react'

// De una URL de YouTube saca la URL de embed; si no es YouTube, devuelve null.
function ytEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=1&rel=0` : null
}

export type Fonema = { id: string; letra: string; ejemplo: string; emoji: string; code: string; silabas: string; tip: string }

// Inventario fonético del español (vocales + consonantes frecuentes en terapia
// de articulación). `silabas` es lo que se pronuncia al "escuchar el fonema".
// `code` = codepoint Unicode → archivo de OpenMoji ({code}.svg). `emoji` queda
// como respaldo si la imagen no carga. Se eligen ejemplos con ícono nítido.
export const FONEMAS: Fonema[] = [
  { id: 'a',  letra: 'A a', ejemplo: 'Abeja',     emoji: '🐝', code: '1F41D', silabas: 'aaa', tip: 'Boca bien abierta' },
  { id: 'e',  letra: 'E e', ejemplo: 'Elefante',  emoji: '🐘', code: '1F418', silabas: 'eee', tip: 'Sonríe un poquito' },
  { id: 'i',  letra: 'I i', ejemplo: 'Iguana',    emoji: '🦎', code: '1F98E', silabas: 'iii', tip: 'Labios estirados' },
  { id: 'o',  letra: 'O o', ejemplo: 'Oso',       emoji: '🐻', code: '1F43B', silabas: 'ooo', tip: 'Boca redonda' },
  { id: 'u',  letra: 'U u', ejemplo: 'Uvas',      emoji: '🍇', code: '1F347', silabas: 'uuu', tip: 'Labios hacia adelante' },
  { id: 'm',  letra: 'M m', ejemplo: 'Mono',      emoji: '🐵', code: '1F435', silabas: 'ma, me, mi, mo, mu',  tip: 'Labios juntos, mmm' },
  { id: 'p',  letra: 'P p', ejemplo: 'Pato',      emoji: '🦆', code: '1F986', silabas: 'pa, pe, pi, po, pu',  tip: 'Explota el aire con los labios' },
  { id: 'b',  letra: 'B b', ejemplo: 'Ballena',   emoji: '🐳', code: '1F433', silabas: 'ba, be, bi, bo, bu',  tip: 'Labios juntos con voz' },
  { id: 't',  letra: 'T t', ejemplo: 'Tortuga',   emoji: '🐢', code: '1F422', silabas: 'ta, te, ti, to, tu',  tip: 'Lengua detrás de los dientes' },
  { id: 'd',  letra: 'D d', ejemplo: 'Dado',      emoji: '🎲', code: '1F3B2', silabas: 'da, de, di, do, du',  tip: 'Lengua en los dientes, con voz' },
  { id: 'n',  letra: 'N n', ejemplo: 'Naranja',   emoji: '🍊', code: '1F34A', silabas: 'na, ne, ni, no, nu',  tip: 'El aire sale por la nariz' },
  { id: 'ñ',  letra: 'Ñ ñ', ejemplo: 'Niño',      emoji: '🧒', code: '1F9D2', silabas: 'ña, ñe, ñi, ño, ñu',  tip: 'Lengua arriba, nasal' },
  { id: 'k',  letra: 'C/K', ejemplo: 'Casa',      emoji: '🏠', code: '1F3E0', silabas: 'ca, que, qui, co, cu', tip: 'Sonido atrás de la boca' },
  { id: 'g',  letra: 'G g', ejemplo: 'Gato',      emoji: '🐱', code: '1F431', silabas: 'ga, gue, gui, go, gu', tip: 'Atrás de la boca, con voz' },
  { id: 'f',  letra: 'F f', ejemplo: 'Foca',      emoji: '🦭', code: '1F9AD', silabas: 'fa, fe, fi, fo, fu',  tip: 'Dientes sobre el labio, fff' },
  { id: 's',  letra: 'S s', ejemplo: 'Serpiente', emoji: '🐍', code: '1F40D', silabas: 'sa, se, si, so, su',  tip: 'Como una serpiente, sss' },
  { id: 'j',  letra: 'J j', ejemplo: 'Jirafa',    emoji: '🦒', code: '1F992', silabas: 'ja, je, ji, jo, ju',  tip: 'Aire fuerte de la garganta' },
  { id: 'l',  letra: 'L l', ejemplo: 'Luna',      emoji: '🌙', code: '1F319', silabas: 'la, le, li, lo, lu',  tip: 'Lengua arriba, a los lados' },
  { id: 'r',  letra: 'R r', ejemplo: 'Pera',      emoji: '🍐', code: '1F350', silabas: 'ra, re, ri, ro, ru',  tip: 'Un golpecito de lengua' },
  { id: 'rr', letra: 'RR',  ejemplo: 'Perro',     emoji: '🐶', code: '1F436', silabas: 'rra, rre, rri, rro, rru', tip: 'Lengua vibra, rrr' },
  { id: 'ch', letra: 'CH',  ejemplo: 'Chancho',   emoji: '🐷', code: '1F437', silabas: 'cha, che, chi, cho, chu', tip: 'Como un estornudo suave' },
  { id: 'll', letra: 'LL',  ejemplo: 'Llave',     emoji: '🔑', code: '1F511', silabas: 'lla, lle, lli, llo, llu', tip: 'Lengua ancha arriba' },
  { id: 'y',  letra: 'Y y', ejemplo: 'Yoyo',      emoji: '🪀', code: '1FA80', silabas: 'ya, ye, yi, yo, yu',  tip: 'Parecido a la LL' },
]

// OpenMoji (CC BY-SA 4.0) — ilustraciones tipo sticker servidas por CDN.
export const OPENMOJI_BASE = 'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.0.0/color/svg'

export function FonemaImg({ code, emoji, size }: { code: string; emoji: string; size: number }) {
  const [err, setErr] = useState(false)
  if (err) return <span style={{ fontSize: Math.round(size * 0.86), lineHeight: 1 }} aria-hidden>{emoji}</span>
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${OPENMOJI_BASE}/${code}.svg`}
      alt={emoji}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      onError={() => setErr(true)}
      style={{ objectFit: 'contain', display: 'block' }}
    />
  )
}

function lsKey(childId: string) { return `fonemas_logrados_${childId}` }
function loadLogrados(childId: string): string[] {
  try { return JSON.parse(localStorage.getItem(lsKey(childId)) || '[]') } catch { return [] }
}
function saveLogrados(childId: string, ids: string[]) {
  try { localStorage.setItem(lsKey(childId), JSON.stringify(ids)) } catch { /* noop */ }
}

// Caché de audio por texto (persiste mientras la pestaña esté abierta) para no
// regenerar el mismo fonema en ElevenLabs cada vez que se repite.
const audioCache = new Map<string, string>()

// Silabea una palabra en español (aproximación buena para palabras comunes):
// 1 consonante entre vocales → va con la vocal siguiente; 2+ se separan salvo
// grupos inseparables (bl, br, pl, tr, ch, ll, rr…). Los diptongos no se parten.
const INSEPARABLES = new Set([
  'bl', 'br', 'cl', 'cr', 'dl', 'dr', 'fl', 'fr', 'gl', 'gr',
  'kl', 'kr', 'pl', 'pr', 'tl', 'tr', 'ch', 'll', 'rr',
])
function silabear(palabra: string): string[] {
  const chars = [...(palabra || '').toLowerCase().normalize('NFC')]
  const n = chars.length
  const V = 'aeiouáéíóúü'
  const isV = (c: string | undefined) => !!c && V.includes(c)
  const isStrong = (c: string) => 'aeoáéó'.includes(c)
  const isAccWeak = (c: string) => 'íúü'.includes(c)
  const cuts = new Set<number>([0])
  let i = 0
  while (i < n) {
    if (!isV(chars[i])) { i++; continue }
    let j = i + 1
    while (isV(chars[j])) {
      const a = chars[j - 1], b = chars[j]
      const hiato = (isStrong(a) && isStrong(b)) || isAccWeak(a) || isAccWeak(b)
      if (hiato) cuts.add(j)
      j++
    }
    let k = j
    while (k < n && !isV(chars[k])) k++
    if (k >= n) break
    const cons = chars.slice(j, k)
    const c = cons.length
    let cutAt = -1
    if (c === 1) cutAt = j
    else if (c === 2) cutAt = INSEPARABLES.has(cons.join('')) ? j : j + 1
    else if (c === 3) cutAt = INSEPARABLES.has(cons.slice(1).join('')) ? j + 1 : j + 2
    else if (c >= 4) cutAt = j + 2
    if (cutAt >= 0) cuts.add(cutAt)
    i = k
  }
  const orden = [...cuts].filter(x => x < n).sort((a, b) => a - b)
  const sil: string[] = []
  for (let s = 0; s < orden.length; s++) {
    const ini = orden[s]
    const fin = s + 1 < orden.length ? orden[s + 1] : n
    const t = chars.slice(ini, fin).join('')
    if (t) sil.push(t)
  }
  return sil.length ? sil : [palabra]
}

export default function FonemasPractica({ childId }: { childId: string }) {
  const [idx, setIdx] = useState(0)
  const [logrados, setLogrados] = useState<Set<string>>(new Set())
  const [hablando, setHablando] = useState(false)
  const [customImgs, setCustomImgs] = useState<Record<string, { id: string; url: string; label?: string }[]>>({})
  const [galIdx, setGalIdx] = useState(0)
  const [ayuda, setAyuda] = useState<Record<string, { boca_url?: string | null; video_url?: string | null }>>({})
  const [modal, setModal] = useState<{ type: 'img' | 'video'; url: string } | null>(null)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tokenRef = useRef(0)
  const ttsOk = typeof window !== 'undefined' && 'speechSynthesis' in window

  const f = FONEMAS[idx]

  useEffect(() => {
    // Cargamos tras el montaje (no en el render) para evitar mismatch de hidratación SSR.
    setLogrados(new Set(loadLogrados(childId)))
  }, [childId])

  // Cargar imágenes propias (repositorio del admin) — galería por fonema.
  useEffect(() => {
    let alive = true
    fetch('/api/fonemas-imagenes')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!alive || !j) return
        if (j.imagenes) setCustomImgs(j.imagenes)
        if (j.ayuda) setAyuda(j.ayuda)
      })
      .catch(() => { /* sin imágenes propias → se usa OpenMoji */ })
    return () => { alive = false }
  }, [])

  // Cargar voces (algunos navegadores las entregan async)
  useEffect(() => {
    if (!ttsOk) return
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      try { window.speechSynthesis.cancel() } catch { /* noop */ }
      try { audioRef.current?.pause() } catch { /* noop */ }
    }
  }, [ttsOk])

  const stopAudio = () => {
    try { audioRef.current?.pause() } catch { /* noop */ }
    try { if (ttsOk) window.speechSynthesis.cancel() } catch { /* noop */ }
    setHablando(false)
  }

  const playUrl = (url: string) => {
    const a = new Audio(url)
    audioRef.current = a
    a.onplay = () => setHablando(true)
    a.onended = () => setHablando(false)
    a.onerror = () => setHablando(false)
    a.play().catch(() => setHablando(false))
  }

  // Respaldo: voz del navegador (si ElevenLabs falla o no hay conexión).
  // Prefiere voces de mayor calidad (Google / natural) sobre la robótica por defecto.
  const speakWebSpeech = (texto: string) => {
    if (!ttsOk) { setHablando(false); return }
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto)
      u.lang = 'es-ES'; u.rate = 0.9; u.pitch = 1.05
      const es = voicesRef.current.filter(v => v.lang?.toLowerCase().startsWith('es'))
      const v = es.find(v => /google|natural|premium|enhanced/i.test(v.name)) || es[0]
      if (v) u.voice = v
      u.onstart = () => setHablando(true)
      u.onend = () => setHablando(false)
      u.onerror = () => setHablando(false)
      window.speechSynthesis.speak(u)
    } catch { setHablando(false) }
  }

  // Voz natural (ElevenLabs) con caché por sesión; respaldo a voz del navegador.
  const speak = async (texto: string) => {
    stopAudio()
    const myToken = ++tokenRef.current
    setHablando(true)
    const cached = audioCache.get(texto)
    if (cached) { if (myToken === tokenRef.current) playUrl(cached); return }
    try {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto, language: 'es' }),
      })
      if (!res.ok) throw new Error('tts')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      audioCache.set(texto, url)
      if (myToken === tokenRef.current) playUrl(url)
    } catch {
      if (myToken === tokenRef.current) speakWebSpeech(texto)
    }
  }

  const go = (d: number) => {
    setIdx(i => (i + d + FONEMAS.length) % FONEMAS.length)
    setGalIdx(0)
    setModal(null)
    stopAudio()
  }

  const toggleLogrado = (id: string) => {
    setLogrados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      saveLogrados(childId, [...next])
      return next
    })
  }

  const esLogrado = logrados.has(f.id)
  const customs = customImgs[f.id] || []
  const hasCustom = customs.length > 0
  const galPos = hasCustom ? ((galIdx % customs.length) + customs.length) % customs.length : 0
  const curImg = hasCustom ? customs[galPos] : null
  // La palabra y el audio siguen la ETIQUETA de la imagen actual; si no tiene
  // etiqueta (o no hay imagen propia), se usa el ejemplo por defecto del fonema.
  const currentWord = (curImg?.label && curImg.label.trim()) ? curImg.label.trim() : f.ejemplo
  const isVowel = ['a', 'e', 'i', 'o', 'u'].includes(f.id)
  // En vocales anclamos el idioma con una palabra española antes del sonido,
  // así "aaa/eee" no se pronuncia en inglés.
  const fonemaText = isVowel ? `${currentWord}. ${f.silabas}` : f.silabas
  // Cada sílaba es un botón. En vocales anclamos con la palabra; en consonantes
  // repetimos la sílaba (mejor para practicar y para que el español suene bien).
  const silArr = f.silabas.split(',').map(s => s.trim()).filter(Boolean)
  const speakSilaba = (syl: string) => speak(syl)
  const cur = ayuda[f.id] || {}

  return (
    <div className="fon-root">
      <style>{`
        .fon-root{ width:100%; max-width:620px; margin:0 auto; display:flex; flex-direction:column; gap:14px; }
        .fon-head{ background:linear-gradient(135deg,#0369a1,#0284c7,#06b6d4); border-radius:20px; padding:16px 18px;
          color:#fff; box-shadow:0 12px 36px rgba(2,132,199,.28); display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .fon-head h2{ margin:0; font-size:17px; font-weight:900; display:flex; align-items:center; gap:8px; }
        .fon-head p{ margin:3px 0 0; font-size:11.5px; color:rgba(255,255,255,.72); font-weight:600; }
        .fon-prog{ text-align:right; }
        .fon-prog .v{ font-size:20px; font-weight:900; line-height:1; }
        .fon-prog .l{ font-size:10px; color:rgba(255,255,255,.7); font-weight:700; }

        .fon-card{ background:var(--c-surface,#fff); border:1.5px solid var(--c-border,#e2e8f0); border-radius:24px;
          padding:22px 18px 24px; box-shadow:0 10px 30px rgba(15,23,42,.06); text-align:center; position:relative; }
        .fon-emoji{ min-height:96px; display:flex; align-items:center; justify-content:center; margin:2px 0 8px; }
        .fon-photo{ max-height:150px; max-width:80%; border-radius:16px; object-fit:contain; cursor:pointer; box-shadow:0 6px 18px rgba(15,23,42,.12); }
        .fon-dots{ display:flex; gap:6px; justify-content:center; margin:-2px 0 6px; }
        .fon-dot{ width:8px; height:8px; border-radius:50%; background:#cbd5e1; cursor:pointer; transition:all .15s; }
        .fon-dot.on{ background:#0284c7; transform:scale(1.25); }
        .fon-letra{ font-family:var(--font-display,inherit); font-size:54px; font-weight:900; color:#0369a1; line-height:1; letter-spacing:1px; }
        .fon-word{ font-size:16px; font-weight:800; color:var(--c-text,#0f172a); margin-top:6px; }
        .fon-sil{ display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin-top:7px; }
        .fon-sil-chip{ font-family:inherit; font-size:14px; font-weight:800; color:#0284c7; background:#eff6ff;
          border:1.5px solid #bae6fd; border-radius:10px; padding:5px 12px; cursor:pointer; transition:all .12s; }
        .fon-sil-chip:hover{ background:#0284c7; color:#fff; border-color:#0284c7; }
        .fon-sil-chip:active{ transform:scale(.92); }
        .fon-tip{ font-size:12px; color:var(--c-text-muted,#64748b); margin-top:8px; display:inline-flex; align-items:center; gap:6px;
          background:var(--c-stat-purple,#f0f9ff); padding:6px 12px; border-radius:999px; }

        .fon-help{ display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:10px; }
        .fon-help-btn{ display:inline-flex; align-items:center; gap:6px; padding:7px 13px; border-radius:12px; cursor:pointer;
          font-family:inherit; font-size:12.5px; font-weight:800; border:1.5px solid #bae6fd; background:#f0f9ff; color:#0369a1; transition:all .15s; }
        .fon-help-btn:active{ transform:scale(.95); }
        .fon-help-btn.video{ background:#ecfeff; border-color:#a5f3fc; color:#0e7490; }

        .fon-modal{ position:fixed; inset:0; background:rgba(15,23,42,.62); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; }
        .fon-modal-box{ position:relative; background:#fff; border-radius:18px; overflow:hidden; max-width:560px; width:100%; box-shadow:0 24px 70px rgba(0,0,0,.45); }
        .fon-modal-x{ position:absolute; top:8px; right:8px; z-index:2; width:34px; height:34px; border-radius:50%; border:none;
          background:rgba(0,0,0,.55); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .fon-modal-img{ width:100%; max-height:72vh; object-fit:contain; display:block; background:#f1f5f9; }
        .fon-modal-video{ width:100%; aspect-ratio:16/9; display:block; border:none; background:#000; }

        .fon-btns{ display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap; }
        .fon-btn{ display:inline-flex; align-items:center; gap:8px; padding:12px 18px; border-radius:14px; border:none;
          font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; transition:transform .12s, box-shadow .15s; }
        .fon-btn:active{ transform:scale(.96); }
        .fon-btn.primary{ background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; box-shadow:0 8px 20px rgba(2,132,199,.32); }
        .fon-btn.soft{ background:#e0f2fe; color:#0369a1; }
        .fon-btn.silabas{ background:#cffafe; color:#0e7490; }
        .fon-btn.speaking{ animation:fonPulse 1s ease-in-out infinite; }

        .fon-logro{ display:inline-flex; align-items:center; gap:8px; margin-top:14px; padding:10px 18px; border-radius:14px;
          font-family:inherit; font-size:13.5px; font-weight:800; cursor:pointer; border:2px solid; transition:all .15s; }
        .fon-logro.off{ background:transparent; color:#0369a1; border-color:#bae6fd; }
        .fon-logro.on{ background:#dcfce7; color:#15803d; border-color:#86efac; }

        .fon-nav{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:16px; }
        .fon-arrow{ width:46px; height:46px; border-radius:14px; border:1.5px solid var(--c-border,#e2e8f0); background:var(--c-surface,#fff);
          color:#0369a1; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; }
        .fon-arrow:active{ transform:scale(.92); }
        .fon-count{ font-size:12px; font-weight:800; color:var(--c-text-muted,#64748b); }

        .fon-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(56px,1fr)); gap:8px; }
        .fon-chip{ position:relative; padding:10px 4px; border-radius:13px; border:1.5px solid var(--c-border,#e2e8f0);
          background:var(--c-surface,#fff); cursor:pointer; font-family:inherit; font-weight:900; font-size:15px; color:#334155;
          transition:all .15s; display:flex; flex-direction:column; align-items:center; gap:2px; }
        .fon-chip:active{ transform:scale(.94); }
        .fon-chip.on{ border-color:#0284c7; background:#e0f2fe; color:#0369a1; box-shadow:0 4px 12px rgba(2,132,199,.18); }
        .fon-chip .e{ height:24px; display:flex; align-items:center; justify-content:center; }
        .fon-chip .ok{ position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; background:#22c55e;
          color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,.2); }

        @keyframes fonPulse{ 0%,100%{ box-shadow:0 8px 20px rgba(2,132,199,.32) } 50%{ box-shadow:0 8px 30px rgba(14,165,233,.6) } }
      `}</style>

      {/* Encabezado */}
      <div className="fon-head">
        <div>
          <h2><Mic size={18} /> Practiquemos fonemas</h2>
          <p>Escuchen el sonido y repítanlo juntos en voz alta</p>
        </div>
        <div className="fon-prog">
          <p className="v">{logrados.size}/{FONEMAS.length}</p>
          <p className="l">LOGRADOS</p>
        </div>
      </div>

      {/* Tarjeta del fonema actual */}
      <div className="fon-card">
        <div className="fon-emoji">
          {hasCustom ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="fon-photo" src={curImg!.url} alt={f.ejemplo} draggable={false}
              onClick={() => { if (customs.length > 1) setGalIdx(i => i + 1) }} />
          ) : (
            <FonemaImg code={f.code} emoji={f.emoji} size={92} />
          )}
        </div>
        {hasCustom && customs.length > 1 && (
          <div className="fon-dots">
            {customs.map((_, i) => (
              <span key={i} className={`fon-dot ${i === galPos ? 'on' : ''}`} onClick={() => setGalIdx(i)} />
            ))}
          </div>
        )}
        <div className="fon-letra">{f.letra}</div>
        <div className="fon-word">{currentWord}</div>
        <div className="fon-sil">
          {silArr.map((syl, k) => (
            <button key={k} className="fon-sil-chip" onClick={() => speakSilaba(syl)} title={`Escuchar ${syl}`}>{syl}</button>
          ))}
        </div>
        <div className="fon-tip"><Sparkles size={13} /> {f.tip}</div>

        {(cur.boca_url || cur.video_url) && (
          <div className="fon-help">
            {cur.boca_url && (
              <button className="fon-help-btn" onClick={() => setModal({ type: 'img', url: cur.boca_url! })}>
                <Smile size={15} /> Ver la boca
              </button>
            )}
            {cur.video_url && (
              <button className="fon-help-btn video" onClick={() => setModal({ type: 'video', url: cur.video_url! })}>
                <Video size={15} /> Cómo se pronuncia
              </button>
            )}
          </div>
        )}

        <div className="fon-btns">
          <button className={`fon-btn primary ${hablando ? 'speaking' : ''}`} onClick={() => speak(fonemaText)}>
            <Volume2 size={17} /> Escuchar fonema
          </button>
          <button className="fon-btn soft" onClick={() => speak(currentWord)}>
            <Volume2 size={16} /> Escuchar palabra
          </button>
          <button className="fon-btn silabas" onClick={() => speak(silabear(currentWord).join(', '))}>
            <Volume2 size={16} /> Por sílabas
          </button>
        </div>

        <div>
          <button className={`fon-logro ${esLogrado ? 'on' : 'off'}`} onClick={() => toggleLogrado(f.id)}>
            <Check size={16} /> {esLogrado ? '¡Logrado!' : 'Marcar como logrado'}
          </button>
        </div>

        <div className="fon-nav">
          <button className="fon-arrow" aria-label="Anterior" onClick={() => go(-1)}><ChevronLeft size={20} /></button>
          <span className="fon-count">{idx + 1} de {FONEMAS.length}</span>
          <button className="fon-arrow" aria-label="Siguiente" onClick={() => go(1)}><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* Selector rápido de todos los fonemas */}
      <div className="fon-grid">
        {FONEMAS.map((x, i) => {
          const xc = customImgs[x.id] || []
          return (
            <button key={x.id} className={`fon-chip ${i === idx ? 'on' : ''}`} onClick={() => go(i - idx)} title={x.ejemplo}>
              {logrados.has(x.id) && <span className="ok"><Check size={11} /></span>}
              <span className="e">
                {xc[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={xc[0].url} alt="" width={24} height={24} style={{ objectFit: 'cover', borderRadius: 6 }} />
                ) : (
                  <FonemaImg code={x.code} emoji={x.emoji} size={24} />
                )}
              </span>
              {x.letra.split(' ')[0]}
            </button>
          )
        })}
      </div>

      {logrados.size > 0 && (
        <button
          onClick={() => { setLogrados(new Set()); saveLogrados(childId, []) }}
          style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', color: 'var(--c-text-muted,#64748b)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <RotateCcw size={13} /> Reiniciar progreso
        </button>
      )}

      {modal && (
        <div className="fon-modal" onClick={() => setModal(null)}>
          <div className="fon-modal-box" onClick={e => e.stopPropagation()}>
            <button className="fon-modal-x" onClick={() => setModal(null)} aria-label="Cerrar"><X size={18} /></button>
            {modal.type === 'img' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="fon-modal-img" src={modal.url} alt="Posición de la boca" />
            ) : ytEmbed(modal.url) ? (
              <iframe className="fon-modal-video" src={ytEmbed(modal.url)!} title="Cómo se pronuncia"
                allow="autoplay; encrypted-media; fullscreen" allowFullScreen />
            ) : (
              <video className="fon-modal-video" src={modal.url} controls autoPlay playsInline />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
