'use client'
// app/padre/components/ForestTimer.tsx
// "Modo Bosque" — temporizador de práctica inspirado en Forest (forestapp.cc):
// fondo plano verde, plato de tierra con la planta creciendo por ETAPAS,
// especies de árbol seleccionables, "Mi bosque" con todo lo plantado y
// estadísticas de práctica. Todo SVG flat + CSS puro, datos en localStorage.

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
// PLANTA SVG — estilo Forest: flat, dos tonos, crece por etapas (0..3)
// ══════════════════════════════════════════════════════════════════════════════

// Triángulo de pino en dos tonos (facetado)
function PineTier({ cy, half, h }: { cy: number; half: number; h: number }) {
  return (
    <>
      <path d={`M60 ${cy - h} L${60 - half} ${cy} L60 ${cy} Z`} fill="#7ac555" />
      <path d={`M60 ${cy - h} L60 ${cy} L${60 + half} ${cy} Z`} fill="#48a55c" />
    </>
  )
}

// Copa redonda en dos tonos
function Canopy({ cx, cy, r, light, dark }: { cx: number; cy: number; r: number; light: string; dark: string }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={light} />
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 0 ${cx + r} ${cy} Z`} fill={dark} opacity=".55" />
    </>
  )
}

function Trunk({ y, h, w = 3.4 }: { y: number; h: number; w?: number }) {
  return <rect x={60 - w / 2} y={y} width={w} height={h} rx={w / 2} fill="#8a5a3b" />
}

// Brote y arbolito jóvenes (compartidos por todas las especies)
function StageSprout() {
  return (
    <g>
      <rect x="58.8" y="60" width="2.4" height="15" rx="1.2" fill="#48a55c" />
      <path d="M60 63 C54 61 50 57 48.5 51 C55 52.5 59 56.5 60 61.5 Z" fill="#7ac555" />
      <path d="M60 66 C66 64 70 60 71.5 54 C65 55.5 61 59.5 60 64.5 Z" fill="#48a55c" />
    </g>
  )
}
function StageSapling() {
  return (
    <g>
      <rect x="58.7" y="48" width="2.6" height="27" rx="1.3" fill="#7e5233" />
      <path d="M60 54 C53 52 48.5 48 47 41.5 C54 43 58.6 47.4 60 52.5 Z" fill="#7ac555" />
      <path d="M60 58 C67 56 71.5 52 73 45.5 C66 47 61.4 51.4 60 56.5 Z" fill="#48a55c" />
      <path d="M60 50 C56 45 55 40.5 56 35 C60 38.5 61.5 43.5 60.8 48.5 Z" fill="#5cb567" />
    </g>
  )
}

function PlantStage({ sp, stage, done }: { sp: Species; stage: number; done: boolean }) {
  if (stage === 0) return <StageSprout />
  if (stage === 1) return <StageSapling />

  if (sp === 'pino') {
    if (stage === 2) return (
      <g>
        <Trunk y={62} h={13} />
        <PineTier cy={64} half={15} h={17} />
        <PineTier cy={52} half={11.5} h={13} />
      </g>
    )
    return (
      <g>
        <Trunk y={64} h={11} />
        <PineTier cy={66} half={19} h={19} />
        <PineTier cy={54} half={15} h={15} />
        <PineTier cy={43.5} half={11} h={12.5} />
      </g>
    )
  }

  const palette = sp === 'cerezo'
    ? { light: '#f6a8c8', dark: '#ec84b2', fruit: '#fff1f5' }
    : sp === 'roble'
      ? { light: '#86c45d', dark: '#55a052', fruit: '#fbbf24' }
      : { light: '#7ac555', dark: '#48a55c', fruit: '#ef4444' } // manzano

  if (stage === 2) return (
    <g>
      <Trunk y={56} h={19} />
      <Canopy cx={60} cy={47} r={14} light={palette.light} dark={palette.dark} />
      <Canopy cx={49} cy={53} r={9.5} light={palette.light} dark={palette.dark} />
      <Canopy cx={71} cy={53} r={9.5} light={palette.light} dark={palette.dark} />
    </g>
  )

  const W = sp === 'roble' ? 1.18 : 1
  return (
    <g>
      <Trunk y={58} h={17} w={4} />
      <Canopy cx={60 - 14 * W} cy={52} r={11.5 * W} light={palette.light} dark={palette.dark} />
      <Canopy cx={60 + 14 * W} cy={52} r={11.5 * W} light={palette.light} dark={palette.dark} />
      <Canopy cx={60} cy={40} r={14.5 * W} light={palette.light} dark={palette.dark} />
      <Canopy cx={60} cy={51} r={13 * W} light={palette.light} dark={palette.dark} />
      {done && ([[49, 47], [71, 47], [60, 36], [54, 55], [66, 55]] as [number, number][]).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={2.6} fill={palette.fruit} />
          {sp === 'cerezo' && <circle cx={x} cy={y} r={1} fill="#f9a8d4" />}
        </g>
      ))}
    </g>
  )
}

// Árbol marchito (sesión abandonada) — para "Mi bosque"
function Withered() {
  return (
    <g stroke="#9b8a78" strokeWidth="2.6" strokeLinecap="round" fill="none">
      <path d="M60 75 L60 46" />
      <path d="M60 62 L49 51" />
      <path d="M60 56 L70 47" />
      <path d="M60 68 L52 63" />
    </g>
  )
}

// Plato Forest: círculo crema + montículo de tierra + planta
function Plate({ sp, stage, done, alive, withered = false, idle = false }: {
  sp: Species; stage: number; done: boolean; alive: boolean; withered?: boolean; idle?: boolean
}) {
  const clipId = `ftPlate${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
      <defs>
        <clipPath id={clipId}><circle cx="60" cy="61" r="54" /></clipPath>
      </defs>
      <circle cx="60" cy="61" r="54" fill="#FBF3D4" />
      <g clipPath={`url(#${clipId})`}>
        <path d="M2 84 Q60 63 118 84 L118 126 L2 126 Z" fill="#8a5a3b" />
        <path d="M2 84 Q60 63 118 84" stroke="#74452b" strokeWidth="3.4" fill="none" opacity=".55" />
      </g>
      <g key={withered ? 'w' : `${sp}-${stage}-${done ? 1 : 0}`}
        className={`ft-stagein ${alive ? 'ft-sway' : ''}`}>
        {withered ? <Withered /> : idle && stage === 0
          ? <ellipse cx="60" cy="72" rx="4" ry="3" fill="#74452b" /> /* semilla */
          : <PlantStage sp={sp} stage={stage} done={done} />}
      </g>
    </svg>
  )
}

function ProgressRing({ progress }: { progress: number }) {
  const R = 118
  const C = 2 * Math.PI * R
  const p = Math.min(1, Math.max(0, progress))
  return (
    <svg className="ft-ring" viewBox="0 0 260 260" aria-hidden>
      <circle cx="130" cy="130" r={R} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="6" />
      <circle cx="130" cy="130" r={R} fill="none" stroke="#FBF3D4" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - p)}
        style={{ transition: 'stroke-dashoffset 1s linear' }} />
      {p > 0 && p < 1 && (
        <circle cx={130 + R * Math.cos(2 * Math.PI * p - Math.PI / 2)}
          cy={130 + R * Math.sin(2 * Math.PI * p - Math.PI / 2)}
          r="7" fill="#FBF3D4" style={{ transition: 'all 1s linear' }} />
      )}
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
  const stage = phase === 'done' ? 3 : g < 0.22 ? 0 : g < 0.5 ? 1 : g < 0.82 ? 2 : 3

  const phrase = phase === 'idle' ? '¡Planten un árbol mientras practican!'
    : phase === 'paused' ? 'El arbolito espera…'
    : phase === 'done' ? '¡Lo lograron! 🌟'
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

        /* tabs internas */
        .ft-tabs{ display:flex; gap:4px; background:rgba(0,0,0,.14); border-radius:14px; padding:4px; width:100%; max-width:380px; }
        .ft-tab{ flex:1; display:flex; align-items:center; justify-content:center; gap:6px; padding:8px 6px;
          border:none; border-radius:11px; background:transparent; color:rgba(255,255,255,.7);
          font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; }
        .ft-tab.on{ background:#FBF3D4; color:#2f6b53; box-shadow:0 2px 8px rgba(0,0,0,.18); }

        .ft-phrase{ font-size:13px; font-weight:600; color:rgba(255,255,255,.92); margin:16px 0 2px; text-align:center; }

        .ft-stage{ position:relative; width:min(58vw,228px); height:min(58vw,228px); margin:10px auto 4px; }
        .ft-ring{ position:absolute; inset:-14px; transform:rotate(0deg); pointer-events:none; }
        .ft-plate{ position:absolute; inset:0; filter:drop-shadow(0 8px 14px rgba(0,0,0,.18)); }
        .ft-pop{ animation:ftPop .7s cubic-bezier(.34,1.56,.64,1) both; }
        .ft-stagein{ animation:ftStageIn .55s cubic-bezier(.34,1.56,.64,1) both; transform-origin:60px 74px; }
        .ft-sway{ animation:ftSway 5s ease-in-out infinite; transform-origin:60px 74px; }

        .ft-time{ font-family:var(--font-display,inherit); font-weight:700; font-size:clamp(34px,9vw,46px);
          letter-spacing:2px; color:#fff; font-variant-numeric:tabular-nums; line-height:1; margin-top:12px; }
        .ft-sub{ font-size:11.5px; color:rgba(255,255,255,.65); margin-top:5px; font-weight:600; }

        /* especies */
        .ft-species{ display:flex; gap:10px; margin-top:14px; }
        .ft-sp{ width:54px; border:none; background:transparent; cursor:pointer; font-family:inherit;
          display:flex; flex-direction:column; align-items:center; gap:4px; padding:0; }
        .ft-sp-plate{ width:46px; height:46px; border-radius:50%; padding:2px; transition:all .2s;
          border:2.5px solid transparent; }
        .ft-sp.on .ft-sp-plate{ border-color:#FBF3D4; transform:scale(1.08); }
        .ft-sp span{ font-size:10px; font-weight:700; color:rgba(255,255,255,.75); }
        .ft-sp.on span{ color:#FBF3D4; }

        /* duraciones */
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

        /* botones */
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

        /* Mi bosque */
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

        /* Estadísticas */
        .ft-kpis{ display:grid; grid-template-columns:repeat(2,1fr); gap:10px; width:100%; margin-top:14px; }
        @media(min-width:480px){ .ft-kpis{ grid-template-columns:repeat(4,1fr) } }
        .ft-kpi{ background:rgba(0,0,0,.14); border-radius:16px; padding:12px 10px; text-align:center; }
        .ft-kpi p{ margin:0 }
        .ft-kpi .v{ font-family:var(--font-display,inherit); font-weight:800; font-size:20px; color:#FBF3D4; }
        .ft-kpi .l{ font-size:10px; font-weight:700; color:rgba(255,255,255,.6); margin-top:3px; }
        .ft-chart{ width:100%; background:rgba(0,0,0,.14); border-radius:16px; padding:14px 14px 8px; margin-top:12px; }
        .ft-chart h4{ margin:0 0 10px; font-size:11px; font-weight:800; color:rgba(255,255,255,.7); letter-spacing:.4px; }

        @keyframes ftPop{ 0%{ transform:scale(.86) } 55%{ transform:scale(1.06) } 80%{ transform:scale(.985) } 100%{ transform:scale(1) } }
        @keyframes ftStageIn{ 0%{ transform:scale(.5); opacity:0 } 60%{ transform:scale(1.08); opacity:1 } 100%{ transform:scale(1) } }
        @keyframes ftSway{ 0%,100%{ transform:rotate(-1.4deg) } 50%{ transform:rotate(1.4deg) } }
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

            <div className="ft-stage">
              <ProgressRing progress={g} />
              <div className={`ft-plate ${phase === 'done' ? 'ft-pop' : ''}`}>
                <Plate sp={species} stage={stage} done={phase === 'done'}
                  alive={phase === 'running'} idle={phase === 'idle'} />
              </div>
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
