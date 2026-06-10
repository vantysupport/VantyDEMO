'use client'
// app/padre/components/ForestTimer.tsx
// "Modo Bosque" — temporizador de práctica inspirado en Forest (forestapp.cc).
// Plato de tierra + planta creciendo por etapas (con crecimiento continuo
// dentro de cada etapa), especies seleccionables, Mi bosque y Estadísticas.
// El anillo de progreso vive DENTRO del mismo SVG del plato → siempre
// perfectamente concéntrico. Copas dibujadas como silueta unificada con
// sombra de borde inferior (estilo flat Forest), sin cortes duros.

import { useState, useEffect, useRef, useId } from 'react'
import {
  Play, Pause, X, RotateCcw, Minus, Plus,
  Trees, Sprout, BarChart3, Flame, Clock, Sparkles,
} from 'lucide-react'

type Phase = 'idle' | 'running' | 'paused' | 'done'
type Species = 'pino' | 'manzano' | 'cerezo' | 'roble'
type LogItem = { t: number; dur: number; sp: Species; ok: boolean }

const DURACIONES = [5, 10, 15, 20, 30]

const SPECIES: { id: Species; label: string }[] = [
  { id: 'pino',    label: 'Pino' },
  { id: 'manzano', label: 'Manzano' },
  { id: 'cerezo',  label: 'Cerezo' },
  { id: 'roble',   label: 'Roble' },
]

// ── Persistencia ──────────────────────────────────────────────────────────────
function lsLog(childId: string) { return `forest_log_${childId}` }
function lsSpecies(childId: string) { return `forest_species_${childId}` }
function loadLog(childId: string): LogItem[] {
  try { return JSON.parse(localStorage.getItem(lsLog(childId)) || '[]') } catch { return [] }
}
function saveLog(childId: string, log: LogItem[]) {
  try { localStorage.setItem(lsLog(childId), JSON.stringify(log.slice(-500))) } catch { /* noop */ }
}
function dayKey(t: number) { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

function fmt(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ══════════════════════════════════════════════════════════════════════════════
// ÁRBOLES — flat estilo Forest. Coordenadas locales: base de la planta en (60, 80)
// Copa = grupo de círculos que se funden en UNA silueta; la sombra es la misma
// silueta desplazada hacia abajo, por detrás (nunca un corte recto encima).
// ══════════════════════════════════════════════════════════════════════════════

// Copa "nube" — path simétrico de tres lóbulos con sombra inferior desplazada.
// (x,y) = centro de la base; W = semiancho; H = alto total.
function CanopyCloud({ x, y, w, h, light, dark }: {
  x: number; y: number; w: number; h: number; light: string; dark: string
}) {
  const W = w, H = h
  const d = `M ${x - W} ${y}
    C ${x - W} ${y - H * .45}, ${x - W * .55} ${y - H * .62}, ${x - W * .38} ${y - H * .6}
    C ${x - W * .34} ${y - H * .98}, ${x + W * .34} ${y - H * .98}, ${x + W * .38} ${y - H * .6}
    C ${x + W * .55} ${y - H * .62}, ${x + W} ${y - H * .45}, ${x + W} ${y}
    Q ${x} ${y + H * .14} ${x - W} ${y} Z`
  return (
    <>
      <path d={d} fill={dark} transform="translate(0 3)" />
      <path d={d} fill={light} />
    </>
  )
}

function Trunk({ y, h, w = 4, color = '#8a5a3b' }: { y: number; h: number; w?: number; color?: string }) {
  return (
    <g>
      <rect x={60 - w / 2} y={y} width={w} height={h} rx={w / 2} fill={color} />
      {/* veta de luz central — volumen sutil */}
      <rect x={60 - w / 4} y={y + 2} width={w / 2} height={Math.max(2, h - 4)} rx={1} fill="rgba(255,255,255,0.15)" />
    </g>
  )
}

// Etapa 0 — brote
function StageSprout() {
  return (
    <g>
      <path d="M60 66 L60 80" stroke="#4d9b46" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 69 C54 67, 50 63, 49 58 C55 59.5, 59 63, 60 67.5 Z" fill="#6fbf4f" />
      <path d="M60 72 C66 70, 70 66, 71 61 C65 62.5, 61 66, 60 70.5 Z" fill="#4d9b46" />
    </g>
  )
}

// Etapa 1 — arbolito joven
function StageSapling() {
  return (
    <g>
      <Trunk y={58} h={22} w={3} color="#7e5233" />
      <CanopyCloud x={60} y={56} w={11} h={17} light="#6fbf4f" dark="#4d9b46" />
    </g>
  )
}

function PlantStage({ sp, stage, done }: { sp: Species; stage: number; done: boolean }) {
  if (stage === 0) return <StageSprout />
  if (stage === 1) return <StageSapling />

  // ── PINO — capas con lados curvos (acículas), dos tonos ──
  if (sp === 'pino') {
    const Tier = ({ y, w, h }: { y: number; w: number; h: number }) => (
      <>
        <path d={`M60 ${y - h} Q${60 - w} ${y - h * .5} ${60 - w * .8} ${y} L60 ${y} Z`} fill="#67aa4f" />
        <path d={`M60 ${y - h} Q${60 + w} ${y - h * .5} ${60 + w * .8} ${y} L60 ${y} Z`} fill="#3f7f46" />
      </>
    )
    if (stage === 2) return (
      <g>
        <Trunk y={68} h={12} w={3.6} color="#5a3b2c" />
        <Tier y={70} w={16} h={17} />
        <Tier y={58} w={12} h={14} />
      </g>
    )
    return (
      <g>
        <Trunk y={70} h={10} w={4} color="#5a3b2c" />
        <Tier y={72} w={20} h={19} />
        <Tier y={60} w={16} h={16} />
        <Tier y={49} w={12} h={14} />
      </g>
    )
  }

  // ── Especies de copa nube ──
  const cfg = sp === 'cerezo'
    ? { light: '#f3a7c3', dark: '#de7ea6', trunk: '#7a5230' }
    : sp === 'roble'
      ? { light: '#8aba5f', dark: '#5d8f43', trunk: '#6b472c' }
      : { light: '#7bcb63', dark: '#54a046', trunk: '#7a5230' } // manzano

  if (stage === 2) return (
    <g>
      <Trunk y={56} h={24} w={3.8} color={cfg.trunk} />
      <CanopyCloud x={60} y={54} w={17} h={24} light={cfg.light} dark={cfg.dark} />
      {sp === 'cerezo' && <Blossoms pts={[[54, 46], [66, 46], [60, 39]]} />}
    </g>
  )

  if (sp === 'cerezo') return (
    <g>
      <Trunk y={54} h={26} w={3.8} color={cfg.trunk} />
      <CanopyCloud x={60} y={52} w={22} h={30} light={cfg.light} dark={cfg.dark} />
      <Blossoms pts={[[48, 44], [72, 44], [60, 30], [55, 50], [65, 50]]} />
    </g>
  )

  if (sp === 'roble') return (
    <g>
      <Trunk y={52} h={28} w={4.8} color={cfg.trunk} />
      <CanopyCloud x={60} y={50} w={26} h={32} light={cfg.light} dark={cfg.dark} />
      {done && (
        <g>
          {([[53, 46], [67, 45], [60, 50]] as [number, number][]).map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="2" ry="2.6" fill="#d28c3a" />
          ))}
        </g>
      )}
    </g>
  )

  // manzano
  return (
    <g>
      <Trunk y={54} h={26} w={4.2} color={cfg.trunk} />
      <CanopyCloud x={60} y={52} w={23} h={30} light={cfg.light} dark={cfg.dark} />
      {done && (
        <g>
          {([[51, 44], [69, 44], [60, 32], [56, 49], [65, 49]] as [number, number][]).map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="2.8" fill="#ea4c4c" />
              <circle cx={x - 1} cy={y - 1} r=".9" fill="#fca5a5" />
            </g>
          ))}
        </g>
      )}
    </g>
  )
}

function Blossoms({ pts }: { pts: [number, number][] }) {
  return (
    <g>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="2.8" fill="#fff5f9" />
          <circle cx={x} cy={y} r="1.2" fill="#f58bb2" />
        </g>
      ))}
    </g>
  )
}

// Árbol marchito (sesión abandonada)
function Withered() {
  return (
    <g stroke="#9b8a78" strokeWidth="2.8" strokeLinecap="round" fill="none">
      <path d="M60 80 L60 50" />
      <path d="M60 66 L48 54" />
      <path d="M60 59 L71 49" />
      <path d="M60 73 L51 67" />
      <path d="M48 54 L44 53" /><path d="M71 49 L75 47" />
    </g>
  )
}

// ── Plato Forest: anillo + círculo crema + tierra + planta — TODO en un SVG ──
function Plate({ sp, stage, done, alive, withered = false, progress, growScale = 1 }: {
  sp: Species; stage: number; done: boolean; alive: boolean
  withered?: boolean; progress?: number; growScale?: number
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const showRing = progress !== undefined
  const p = Math.min(1, Math.max(0, progress ?? 0))
  const R = 64, CX = 70, CY = 70
  const C = 2 * Math.PI * R
  const knobA = 2 * Math.PI * p - Math.PI / 2
  // Solo el plato principal (con anillo) hace crossfade de las 4 etapas;
  // los platos mini (selector / Mi bosque) renderizan una sola etapa.
  const stagesToRender = showRing ? [0, 1, 2, 3] : [stage]
  return (
    <svg viewBox="0 0 140 140" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }} aria-hidden>
      <defs>
        <clipPath id={`clip${uid}`}><circle cx="60" cy="60" r="54" /></clipPath>
        <radialGradient id={`plate${uid}`} cx="50%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#FCF6DD" />
          <stop offset="100%" stopColor="#F1E3BC" />
        </radialGradient>
        <filter id={`knob${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity=".25" />
        </filter>
        <filter id={`pshadow${uid}`} x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2" floodColor="#3a2a1a" floodOpacity=".2" />
        </filter>
      </defs>
      {showRing && (
        <>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="5" />
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#FBF3D4" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - p)}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ transition: 'stroke-dashoffset 1s linear' }} />
          {p > 0 && p < 1 && (
            <circle cx={CX + R * Math.cos(knobA)} cy={CY + R * Math.sin(knobA)} r="6" fill="#FBF3D4"
              filter={`url(#knob${uid})`}
              style={{ transition: 'cx 1s linear, cy 1s linear' }} />
          )}
        </>
      )}
      {/* plato + tierra + planta (coordenadas locales desplazadas al centro) */}
      <g transform="translate(10 10)">
        <circle cx="60" cy="60" r="54" fill={`url(#plate${uid})`} />
        <g clipPath={`url(#clip${uid})`}>
          <path d="M0 90 Q60 74 120 90 L120 130 L0 130 Z" fill="#8a5a3b" />
          <path d="M0 90 Q60 74 120 90" stroke="#6f4528" strokeWidth="3" fill="none" opacity=".5" />
          {/* textura de la tierra */}
          <path d="M8 98 Q60 86 112 98" stroke="#6f4528" strokeWidth="2" fill="none" opacity=".35" />
          <path d="M16 105 Q60 95 104 105" stroke="#6f4528" strokeWidth="1.5" fill="none" opacity=".25" />
        </g>
        {/* crecimiento continuo (escala global) — la planta NUNCA se desmonta:
            las etapas se funden con crossfade de opacidad */}
        <g style={{ transform: `scale(${growScale})`, transformBox: 'fill-box' as any, transformOrigin: '50% 100%', transition: 'transform 1s linear' }}>
          <g className={alive ? 'ft-sway' : undefined} filter={`url(#pshadow${uid})`}>
            {withered ? <Withered /> : stagesToRender.map(s => (
              <g key={s} style={{ opacity: s === stage ? 1 : 0, transition: 'opacity .45s ease' }}>
                <PlantStage sp={sp} stage={s} done={done && s === stage} />
              </g>
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function ForestTimer({ childId }: { childId: string }) {
  const [view, setView] = useState<'plantar' | 'bosque' | 'stats'>('plantar')
  const [phase, setPhase] = useState<Phase>('idle')
  const [species, setSpecies] = useState<Species>('pino')

  const [durStr, setDurStr] = useState('10')
  const durMin = Math.min(180, Math.max(0, parseInt(durStr || '0', 10) || 0))
  const [secStr, setSecStr] = useState('00')
  const durSec = Math.min(59, Math.max(0, parseInt(secStr || '0', 10) || 0))
  const totalSecs = durMin * 60 + durSec

  const [remaining, setRemaining] = useState(600)
  const [total, setTotal] = useState(600)
  const [log, setLog] = useState<LogItem[]>([])
  const [bosqueFiltro, setBosqueFiltro] = useState<'hoy' | 'semana' | 'todo'>('todo')
  const endsAtRef = useRef(0)

  useEffect(() => {
    setLog(loadLog(childId))
    try {
      const sp = localStorage.getItem(lsSpecies(childId)) as Species | null
      if (sp && SPECIES.some(s => s.id === sp)) setSpecies(sp)
    } catch { /* noop */ }
  }, [childId])

  const addLog = (item: LogItem) => {
    setLog(prev => { const next = [...prev, item]; saveLog(childId, next); return next })
  }
  const pickSpecies = (sp: Species) => {
    setSpecies(sp)
    try { localStorage.setItem(lsSpecies(childId), sp) } catch { /* noop */ }
  }

  // Tick con timestamps (exacto aunque el teléfono se bloquee)
  useEffect(() => {
    if (phase !== 'running') return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setPhase('done')
        addLog({ t: Date.now(), dur: total, sp: species, ok: true })
        try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]) } catch { /* noop */ }
      }
    }, 500)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, childId, species, total])

  const start = () => {
    if (totalSecs < 1) return
    setTotal(totalSecs); setRemaining(totalSecs)
    endsAtRef.current = Date.now() + totalSecs * 1000
    setPhase('running')
  }
  const pause = () => setPhase('paused')
  const resume = () => { endsAtRef.current = Date.now() + remaining * 1000; setPhase('running') }
  const giveUp = () => {
    const elapsed = total - remaining
    if (elapsed >= 30) addLog({ t: Date.now(), dur: elapsed, sp: species, ok: false })
    setPhase('idle'); setRemaining(totalSecs); setTotal(totalSecs)
  }
  const reset = () => { setPhase('idle'); setRemaining(totalSecs); setTotal(totalSecs) }

  const g = phase === 'idle' ? 0 : phase === 'done' ? 1 : Math.min(1, Math.max(0, 1 - remaining / total))

  // Etapas (crossfade) + escala GLOBAL monotónica: la planta solo crece,
  // nunca encoge al cruzar un umbral.
  const stage = phase === 'idle' ? 3 : phase === 'done' ? 3 : g < .22 ? 0 : g < .5 ? 1 : g < .82 ? 2 : 3
  const growScale = phase === 'idle' || phase === 'done' ? 1 : 0.55 + 0.45 * g

  const phrase = phase === 'idle' ? '¡Planten un árbol mientras practican!'
    : phase === 'paused' ? 'El arbolito espera…'
    : phase === 'done' ? '¡Lo lograron!'
    : g < 0.3 ? '¡Acaban de plantar la semilla!'
    : g < 0.65 ? 'El arbolito confía en ustedes'
    : '¡Ya casi! No se rindan'

  // ── Datos para Mi Bosque / Estadísticas ──
  const now = Date.now()
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const filtered = [...log].reverse().filter(it =>
    bosqueFiltro === 'todo' ? true :
    bosqueFiltro === 'hoy' ? it.t >= startOfDay.getTime() :
    it.t >= now - 7 * 86400_000)

  const oks = log.filter(l => l.ok)
  const totalMin = Math.round(oks.reduce((a, l) => a + l.dur, 0) / 60)
  const exito = log.length ? Math.round((oks.length / log.length) * 100) : 0
  const streak = (() => {
    const days = new Set(oks.map(l => dayKey(l.t)))
    let n = 0; const d = new Date()
    while (days.has(dayKey(d.getTime()))) { n++; d.setDate(d.getDate() - 1) }
    return n
  })()
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    const end = d.getTime() + 86400_000
    const mins = Math.round(oks.filter(l => l.t >= d.getTime() && l.t < end).reduce((a, l) => a + l.dur, 0) / 60)
    return { label: 'DLMXJVS'[d.getDay()], mins, today: i === 6 }
  })
  const maxBar = Math.max(10, ...last7.map(b => b.mins))

  return (
    <div className="eng-card ft-root">
      <style>{`
        .ft-root{ border-radius:24px; overflow:hidden; position:relative;
          width:100%; max-width:620px; margin-left:auto; margin-right:auto;
          background:linear-gradient(180deg,#57a98c 0%,#4c9a7e 100%);
          box-shadow:0 14px 40px rgba(45,106,79,.28); }
        .ft-inner{ position:relative; padding:18px 18px 26px; display:flex; flex-direction:column; align-items:center; }
        @media(min-width:640px){ .ft-inner{ padding:22px 24px 30px } }

        .ft-tabs{ display:flex; gap:4px; background:rgba(0,0,0,.14); border-radius:14px; padding:4px; width:100%; max-width:380px; }
        .ft-tab{ flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 6px;
          border:none; border-radius:11px; background:transparent; color:rgba(255,255,255,.7);
          font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; }
        .ft-tab.on{ background:#FBF3D4; color:#2f6b53; box-shadow:0 2px 8px rgba(0,0,0,.18); }

        .ft-phrase{ font-size:13px; font-weight:600; color:rgba(255,255,255,.92); margin:16px 0 0; text-align:center; }

        .ft-stage{ width:min(60vw,236px); height:min(60vw,236px); margin:14px auto 0; }
        .ft-pop{ animation:ftPop .7s cubic-bezier(.34,1.56,.64,1) both; }
        .ft-sway{ animation:ftSway 5s ease-in-out infinite; transform-box:fill-box; transform-origin:50% 100%; }

        .ft-time{ font-family:var(--font-display,inherit); font-weight:700; font-size:clamp(34px,9vw,46px);
          letter-spacing:2px; color:#fff; font-variant-numeric:tabular-nums; line-height:1; margin-top:14px; }
        .ft-sub{ font-size:11.5px; color:rgba(255,255,255,.65); margin-top:5px; font-weight:600; }

        .ft-species{ display:flex; gap:12px; margin-top:14px; }
        .ft-sp{ width:56px; border:none; background:transparent; cursor:pointer; font-family:inherit;
          display:flex; flex-direction:column; align-items:center; gap:4px; padding:0; }
        .ft-sp-plate{ width:48px; height:48px; border-radius:50%; transition:all .2s;
          border:2.5px solid transparent; }
        .ft-sp.on .ft-sp-plate{ border-color:#FBF3D4; transform:scale(1.08); }
        .ft-sp span{ font-size:10px; font-weight:700; color:rgba(255,255,255,.75); }
        .ft-sp.on span{ color:#FBF3D4; }

        .ft-chips{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:14px; }
        .ft-chip{ padding:7px 14px; border-radius:13px; font-size:12.5px; font-weight:700; cursor:pointer;
          border:1.5px solid rgba(255,255,255,.35); background:rgba(255,255,255,.1); color:#fff;
          font-family:inherit; transition:all .15s; }
        .ft-chip.on{ background:#FBF3D4; color:#2f6b53; border-color:transparent; }
        .ft-stepper{ display:flex; align-items:center; gap:8px; margin-top:12px;
          background:rgba(0,0,0,.14); border-radius:14px; padding:5px 7px; }
        .ft-step{ width:36px; height:36px; border-radius:11px; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          background:rgba(255,255,255,.16); color:#fff; transition:transform .15s; }
        .ft-step:active{ transform:scale(.9); }
        .ft-numin{ width:44px; text-align:center; border:none; outline:none; background:transparent;
          font-family:var(--font-display,inherit); font-weight:700; font-size:22px; color:#fff;
          font-variant-numeric:tabular-nums; border-radius:8px; padding:2px 0; }
        .ft-numin:focus{ background:rgba(255,255,255,.14); }
        .ft-colon{ font-weight:700; font-size:22px; color:rgba(255,255,255,.6); }
        .ft-hint{ font-size:9.5px; font-weight:700; color:rgba(255,255,255,.45); margin:6px 0 0; letter-spacing:.6px; text-transform:uppercase; }

        .ft-actions{ display:flex; gap:10px; margin-top:16px; width:100%; max-width:320px; }
        .ft-btn{ flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 16px;
          border-radius:15px; font-size:14px; font-weight:800; cursor:pointer; border:none; font-family:inherit;
          transition:transform .15s, opacity .15s; }
        .ft-btn:active{ transform:scale(.97); }
        .ft-btn.go{ background:#FBF3D4; color:#2f6b53; box-shadow:0 6px 18px rgba(0,0,0,.18); }
        .ft-btn.ghost{ background:transparent; color:#fff; border:1.5px solid rgba(255,255,255,.45); }

        .ft-done{ display:flex; align-items:center; gap:8px; margin-top:12px; padding:9px 16px; border-radius:14px;
          background:#FBF3D4; color:#2f6b53; font-weight:800; font-size:13.5px;
          animation:ftPop .5s cubic-bezier(.34,1.56,.64,1) both; }

        .ft-filters{ display:flex; gap:6px; margin:14px 0 4px; }
        .ft-filter{ padding:6px 13px; border-radius:11px; font-size:11.5px; font-weight:700; cursor:pointer;
          border:none; background:rgba(255,255,255,.12); color:rgba(255,255,255,.8); font-family:inherit; }
        .ft-filter.on{ background:#FBF3D4; color:#2f6b53; }
        .ft-grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(64px,1fr)); gap:10px;
          width:100%; margin-top:12px; }
        .ft-cell{ display:flex; flex-direction:column; align-items:center; gap:3px; }
        .ft-cell-plate{ width:100%; aspect-ratio:1; }
        .ft-cell span{ font-size:9px; font-weight:600; color:rgba(255,255,255,.55); }
        .ft-empty{ text-align:center; padding:28px 16px; color:rgba(255,255,255,.75); font-size:13px; font-weight:600; }

        .ft-kpis{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; width:100%; margin-top:14px; }
        @media(min-width:480px){ .ft-kpis{ grid-template-columns:repeat(4,1fr) } }
        .ft-kpi{ background:rgba(0,0,0,.14); border-radius:16px; padding:12px 10px; text-align:center; }
        .ft-kpi p{ margin:0 }
        .ft-kpi .v{ font-family:var(--font-display,inherit); font-weight:800; font-size:20px; color:#FBF3D4; }
        .ft-kpi .l{ font-size:10px; font-weight:700; color:rgba(255,255,255,.6); margin-top:3px; }
        .ft-chart{ width:100%; background:rgba(0,0,0,.14); border-radius:16px; padding:14px 14px 8px; margin-top:12px; }
        .ft-chart h4{ margin:0 0 10px; font-size:11px; font-weight:800; color:rgba(255,255,255,.7); letter-spacing:.4px; }

        @keyframes ftPop{ 0%{ transform:scale(.86) } 55%{ transform:scale(1.06) } 80%{ transform:scale(.985) } 100%{ transform:scale(1) } }
        @keyframes ftSway{ 0%,100%{ transform:rotate(-1.3deg) } 50%{ transform:rotate(1.3deg) } }
      `}</style>

      <div className="ft-inner">
        {/* Tabs internas */}
        <div className="ft-tabs">
          <button className={`ft-tab ${view === 'plantar' ? 'on' : ''}`} onClick={() => setView('plantar')}>
            <Sprout size={13} /> Plantar
          </button>
          <button className={`ft-tab ${view === 'bosque' ? 'on' : ''}`} onClick={() => setView('bosque')}>
            <Trees size={13} /> Mi bosque
          </button>
          <button className={`ft-tab ${view === 'stats' ? 'on' : ''}`} onClick={() => setView('stats')}>
            <BarChart3 size={13} /> Estadísticas
          </button>
        </div>

        {/* ══ PLANTAR ══ */}
        {view === 'plantar' && (
          <>
            <p className="ft-phrase">{phrase}</p>

            <div className={`ft-stage ${phase === 'done' ? 'ft-pop' : ''}`}>
              <Plate sp={species} stage={stage} done={phase === 'done'}
                alive={phase === 'running'} progress={g} growScale={growScale} />
            </div>

            <div className="ft-time">{phase === 'idle' ? fmt(totalSecs) : fmt(remaining)}</div>
            {phase === 'running' && <p className="ft-sub">Si se rinden, el arbolito se marchitará</p>}
            {phase === 'idle' && <p className="ft-sub">Elige árbol y tiempo de práctica</p>}

            {/* Especies */}
            {phase === 'idle' && (
              <div className="ft-species">
                {SPECIES.map(s => (
                  <button key={s.id} className={`ft-sp ${species === s.id ? 'on' : ''}`} onClick={() => pickSpecies(s.id)}>
                    <div className="ft-sp-plate">
                      <Plate sp={s.id} stage={3} done={false} alive={false} />
                    </div>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Duración */}
            {phase === 'idle' && (
              <>
                <div className="ft-chips">
                  {DURACIONES.map(m => (
                    <button key={m} className={`ft-chip ${durMin === m && durSec === 0 ? 'on' : ''}`}
                      onClick={() => { setDurStr(String(m)); setSecStr('00'); setRemaining(m * 60); setTotal(m * 60) }}>
                      {m} min
                    </button>
                  ))}
                </div>
                <div className="ft-stepper">
                  <button className="ft-step" aria-label="Restar 10 segundos"
                    onClick={() => { const t = Math.max(5, totalSecs - 10); setDurStr(String(Math.floor(t / 60))); setSecStr(String(t % 60).padStart(2, '0')) }}>
                    <Minus size={15} />
                  </button>
                  <input className="ft-numin" type="text" inputMode="numeric" value={durStr}
                    onChange={e => setDurStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    onFocus={e => e.target.select()} aria-label="Minutos" />
                  <span className="ft-colon">:</span>
                  <input className="ft-numin" type="text" inputMode="numeric" value={secStr}
                    onChange={e => setSecStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                    onFocus={e => e.target.select()}
                    onBlur={() => setSecStr(String(durSec).padStart(2, '0'))} aria-label="Segundos" />
                  <button className="ft-step" aria-label="Sumar 10 segundos"
                    onClick={() => { const t = Math.min(10800, totalSecs + 10); setDurStr(String(Math.floor(t / 60))); setSecStr(String(t % 60).padStart(2, '0')) }}>
                    <Plus size={15} />
                  </button>
                </div>
                <p className="ft-hint">minutos : segundos</p>
              </>
            )}

            {phase === 'done' && (
              <div className="ft-done"><Sparkles size={15} /> ¡{SPECIES.find(s => s.id === species)?.label} plantado en su bosque!</div>
            )}

            <div className="ft-actions">
              {phase === 'idle' && (
                <button className="ft-btn go" onClick={start} disabled={totalSecs < 1}
                  style={totalSecs < 1 ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
                  <Play size={16} /> Plantar
                </button>
              )}
              {phase === 'running' && (
                <>
                  <button className="ft-btn ghost" onClick={pause}><Pause size={15} /> Pausa</button>
                  <button className="ft-btn ghost" onClick={giveUp}><X size={15} /> Rendirse</button>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <button className="ft-btn go" onClick={resume}><Play size={15} /> Continuar</button>
                  <button className="ft-btn ghost" onClick={giveUp}><X size={15} /> Rendirse</button>
                </>
              )}
              {phase === 'done' && (
                <button className="ft-btn go" onClick={reset}><RotateCcw size={15} /> Plantar otro</button>
              )}
            </div>
          </>
        )}

        {/* ══ MI BOSQUE ══ */}
        {view === 'bosque' && (
          <>
            <div className="ft-filters">
              {(['hoy', 'semana', 'todo'] as const).map(f => (
                <button key={f} className={`ft-filter ${bosqueFiltro === f ? 'on' : ''}`} onClick={() => setBosqueFiltro(f)}>
                  {f === 'hoy' ? 'Hoy' : f === 'semana' ? '7 días' : 'Todo'}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="ft-empty">
                Aún no hay árboles aquí.<br />¡Planten el primero practicando juntos! 🌱
              </div>
            ) : (
              <div className="ft-grid">
                {filtered.map((it, i) => (
                  <div key={`${it.t}-${i}`} className="ft-cell" title={`${Math.round(it.dur / 60)} min · ${new Date(it.t).toLocaleDateString('es-PE')}`}>
                    <div className="ft-cell-plate">
                      <Plate sp={it.sp} stage={3} done={it.ok} alive={false} withered={!it.ok} />
                    </div>
                    <span>{Math.max(1, Math.round(it.dur / 60))}m</span>
                  </div>
                ))}
              </div>
            )}
            <p className="ft-sub" style={{ marginTop: 14 }}>
              {oks.length} plantado{oks.length !== 1 ? 's' : ''} · {log.length - oks.length} marchito{log.length - oks.length !== 1 ? 's' : ''}
            </p>
          </>
        )}

        {/* ══ ESTADÍSTICAS ══ */}
        {view === 'stats' && (
          <>
            <div className="ft-kpis">
              <div className="ft-kpi"><p className="v">{totalMin}</p><p className="l"><Clock size={9} style={{ display: 'inline', verticalAlign: '-1px' }} /> MIN DE PRÁCTICA</p></div>
              <div className="ft-kpi"><p className="v">{oks.length}</p><p className="l"><Trees size={9} style={{ display: 'inline', verticalAlign: '-1px' }} /> ÁRBOLES</p></div>
              <div className="ft-kpi"><p className="v">{streak}</p><p className="l"><Flame size={9} style={{ display: 'inline', verticalAlign: '-1px' }} /> RACHA DÍAS</p></div>
              <div className="ft-kpi"><p className="v">{exito}%</p><p className="l">ÉXITO</p></div>
            </div>

            <div className="ft-chart">
              <h4>MINUTOS · ÚLTIMOS 7 DÍAS</h4>
              <svg viewBox="0 0 280 96" style={{ width: '100%', display: 'block' }}>
                {last7.map((b, i) => {
                  const h = Math.max(3, (b.mins / maxBar) * 64)
                  const x = 10 + i * 38
                  return (
                    <g key={i}>
                      <rect x={x} y={74 - h} width="24" height={h} rx="5"
                        fill={b.today ? '#FBF3D4' : 'rgba(255,255,255,.38)'} />
                      {b.mins > 0 && (
                        <text x={x + 12} y={68 - h} textAnchor="middle" fontSize="9" fontWeight="700"
                          fill="rgba(255,255,255,.85)">{b.mins}</text>
                      )}
                      <text x={x + 12} y={89} textAnchor="middle" fontSize="9" fontWeight="700"
                        fill={b.today ? '#FBF3D4' : 'rgba(255,255,255,.5)'}>{b.label}</text>
                    </g>
                  )
                })}
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
