'use client'
// app/padre/components/FonemasPractica.tsx
// "Fonemas" — actividad interactiva para que el niño/familia practique en casa.
// Tarjeta grande con el fonema, una palabra/imagen de ejemplo y AUDIO (voz del
// navegador, Web Speech API en español). El niño escucha y repite. Cada fonema
// puede marcarse como "logrado" (se guarda por niño en localStorage).

import { useState, useEffect, useRef } from 'react'
import {
  Volume2, Mic, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles,
} from 'lucide-react'

type Fonema = { id: string; letra: string; ejemplo: string; emoji: string; silabas: string; tip: string }

// Inventario fonético del español (vocales + consonantes frecuentes en terapia
// de articulación). `silabas` es lo que se pronuncia al "escuchar el fonema".
const FONEMAS: Fonema[] = [
  { id: 'a',  letra: 'A a', ejemplo: 'Araña',    emoji: '🕷️', silabas: 'aaa',                 tip: 'Boca bien abierta' },
  { id: 'e',  letra: 'E e', ejemplo: 'Elefante', emoji: '🐘', silabas: 'eee',                 tip: 'Sonríe un poquito' },
  { id: 'i',  letra: 'I i', ejemplo: 'Iglú',     emoji: '🧊', silabas: 'iii',                 tip: 'Labios estirados' },
  { id: 'o',  letra: 'O o', ejemplo: 'Oso',      emoji: '🐻', silabas: 'ooo',                 tip: 'Boca redonda' },
  { id: 'u',  letra: 'U u', ejemplo: 'Uvas',     emoji: '🍇', silabas: 'uuu',                 tip: 'Labios hacia adelante' },
  { id: 'm',  letra: 'M m', ejemplo: 'Mamá',     emoji: '👩', silabas: 'ma, me, mi, mo, mu',  tip: 'Labios juntos, mmm' },
  { id: 'p',  letra: 'P p', ejemplo: 'Pelota',   emoji: '⚽', silabas: 'pa, pe, pi, po, pu',  tip: 'Explota el aire con los labios' },
  { id: 'b',  letra: 'B b', ejemplo: 'Barco',    emoji: '⛵', silabas: 'ba, be, bi, bo, bu',  tip: 'Labios juntos con voz' },
  { id: 't',  letra: 'T t', ejemplo: 'Taza',     emoji: '☕', silabas: 'ta, te, ti, to, tu',  tip: 'Lengua detrás de los dientes' },
  { id: 'd',  letra: 'D d', ejemplo: 'Dado',     emoji: '🎲', silabas: 'da, de, di, do, du',  tip: 'Lengua en los dientes, con voz' },
  { id: 'n',  letra: 'N n', ejemplo: 'Nube',     emoji: '☁️', silabas: 'na, ne, ni, no, nu',  tip: 'El aire sale por la nariz' },
  { id: 'ñ',  letra: 'Ñ ñ', ejemplo: 'Niño',     emoji: '🧒', silabas: 'ña, ñe, ñi, ño, ñu',  tip: 'Lengua arriba, nasal' },
  { id: 'k',  letra: 'C/K',  ejemplo: 'Casa',     emoji: '🏠', silabas: 'ca, que, qui, co, cu', tip: 'Sonido atrás de la boca' },
  { id: 'g',  letra: 'G g', ejemplo: 'Gato',     emoji: '🐱', silabas: 'ga, gue, gui, go, gu', tip: 'Atrás de la boca, con voz' },
  { id: 'f',  letra: 'F f', ejemplo: 'Foca',     emoji: '🦭', silabas: 'fa, fe, fi, fo, fu',  tip: 'Dientes sobre el labio, fff' },
  { id: 's',  letra: 'S s', ejemplo: 'Sol',      emoji: '☀️', silabas: 'sa, se, si, so, su',  tip: 'Como una serpiente, sss' },
  { id: 'j',  letra: 'J j', ejemplo: 'Jirafa',   emoji: '🦒', silabas: 'ja, je, ji, jo, ju',  tip: 'Aire fuerte de la garganta' },
  { id: 'l',  letra: 'L l', ejemplo: 'Luna',     emoji: '🌙', silabas: 'la, le, li, lo, lu',  tip: 'Lengua arriba, a los lados' },
  { id: 'r',  letra: 'R r', ejemplo: 'Pera',     emoji: '🍐', silabas: 'ra, re, ri, ro, ru',  tip: 'Un golpecito de lengua' },
  { id: 'rr', letra: 'RR',  ejemplo: 'Perro',    emoji: '🐶', silabas: 'rra, rre, rri, rro, rru', tip: 'Lengua vibra, rrr' },
  { id: 'ch', letra: 'CH',  ejemplo: 'Chancho',  emoji: '🐷', silabas: 'cha, che, chi, cho, chu', tip: 'Como un estornudo suave' },
  { id: 'll', letra: 'LL',  ejemplo: 'Llave',    emoji: '🔑', silabas: 'lla, lle, lli, llo, llu', tip: 'Lengua ancha arriba' },
  { id: 'y',  letra: 'Y y', ejemplo: 'Yoyo',     emoji: '🪀', silabas: 'ya, ye, yi, yo, yu',  tip: 'Parecido a la LL' },
]

function lsKey(childId: string) { return `fonemas_logrados_${childId}` }
function loadLogrados(childId: string): string[] {
  try { return JSON.parse(localStorage.getItem(lsKey(childId)) || '[]') } catch { return [] }
}
function saveLogrados(childId: string, ids: string[]) {
  try { localStorage.setItem(lsKey(childId), JSON.stringify(ids)) } catch { /* noop */ }
}

export default function FonemasPractica({ childId }: { childId: string }) {
  const [idx, setIdx] = useState(0)
  const [logrados, setLogrados] = useState<Set<string>>(new Set())
  const [hablando, setHablando] = useState(false)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const ttsOk = typeof window !== 'undefined' && 'speechSynthesis' in window

  const f = FONEMAS[idx]

  useEffect(() => {
    // Cargamos tras el montaje (no en el render) para evitar mismatch de hidratación SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLogrados(new Set(loadLogrados(childId)))
  }, [childId])

  // Cargar voces (algunos navegadores las entregan async)
  useEffect(() => {
    if (!ttsOk) return
    const load = () => { voicesRef.current = window.speechSynthesis.getVoices() }
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => { try { window.speechSynthesis.cancel() } catch { /* noop */ } }
  }, [ttsOk])

  const speak = (texto: string) => {
    if (!ttsOk) return
    try {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(texto)
      u.lang = 'es-ES'; u.rate = 0.82; u.pitch = 1.08
      const v = voicesRef.current.find(v => v.lang?.toLowerCase().startsWith('es'))
      if (v) u.voice = v
      u.onstart = () => setHablando(true)
      u.onend = () => setHablando(false)
      u.onerror = () => setHablando(false)
      window.speechSynthesis.speak(u)
    } catch { setHablando(false) }
  }

  const go = (d: number) => {
    setIdx(i => (i + d + FONEMAS.length) % FONEMAS.length)
    try { window.speechSynthesis.cancel() } catch { /* noop */ }
    setHablando(false)
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
        .fon-emoji{ font-size:78px; line-height:1; margin:2px 0 8px; }
        .fon-letra{ font-family:var(--font-display,inherit); font-size:54px; font-weight:900; color:#0369a1; line-height:1; letter-spacing:1px; }
        .fon-word{ font-size:16px; font-weight:800; color:var(--c-text,#0f172a); margin-top:6px; }
        .fon-sil{ font-size:13px; font-weight:700; color:#0284c7; margin-top:4px; letter-spacing:.5px; }
        .fon-tip{ font-size:12px; color:var(--c-text-muted,#64748b); margin-top:8px; display:inline-flex; align-items:center; gap:6px;
          background:var(--c-stat-purple,#f0f9ff); padding:6px 12px; border-radius:999px; }

        .fon-btns{ display:flex; gap:10px; justify-content:center; margin-top:16px; flex-wrap:wrap; }
        .fon-btn{ display:inline-flex; align-items:center; gap:8px; padding:12px 18px; border-radius:14px; border:none;
          font-family:inherit; font-size:14px; font-weight:800; cursor:pointer; transition:transform .12s, box-shadow .15s; }
        .fon-btn:active{ transform:scale(.96); }
        .fon-btn.primary{ background:linear-gradient(135deg,#0284c7,#0ea5e9); color:#fff; box-shadow:0 8px 20px rgba(2,132,199,.32); }
        .fon-btn.soft{ background:#e0f2fe; color:#0369a1; }
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
        .fon-chip .e{ font-size:16px; line-height:1; }
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
        <div className="fon-emoji" aria-hidden>{f.emoji}</div>
        <div className="fon-letra">{f.letra}</div>
        <div className="fon-word">{f.ejemplo}</div>
        <div className="fon-sil">{f.silabas}</div>
        <div className="fon-tip"><Sparkles size={13} /> {f.tip}</div>

        <div className="fon-btns">
          <button className={`fon-btn primary ${hablando ? 'speaking' : ''}`}
            onClick={() => speak(f.silabas)} disabled={!ttsOk}
            style={!ttsOk ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
            <Volume2 size={17} /> Escuchar fonema
          </button>
          <button className="fon-btn soft" onClick={() => speak(f.ejemplo)} disabled={!ttsOk}
            style={!ttsOk ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
            <Volume2 size={16} /> Escuchar palabra
          </button>
        </div>

        {!ttsOk && (
          <p style={{ fontSize: 11, color: 'var(--c-text-muted,#64748b)', marginTop: 8 }}>
            Tu navegador no soporta audio de voz. Lean las sílabas en voz alta.
          </p>
        )}

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
        {FONEMAS.map((x, i) => (
          <button key={x.id} className={`fon-chip ${i === idx ? 'on' : ''}`} onClick={() => go(i - idx)} title={x.ejemplo}>
            {logrados.has(x.id) && <span className="ok"><Check size={11} /></span>}
            <span className="e" aria-hidden>{x.emoji}</span>
            {x.letra.split(' ')[0]}
          </button>
        ))}
      </div>

      {logrados.size > 0 && (
        <button
          onClick={() => { setLogrados(new Set()); saveLogrados(childId, []) }}
          style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', color: 'var(--c-text-muted,#64748b)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <RotateCcw size={13} /> Reiniciar progreso
        </button>
      )}
    </div>
  )
}
