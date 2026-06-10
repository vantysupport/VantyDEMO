'use client'
// app/padre/components/ForestTimer.tsx
// Cronómetro de práctica estilo "Forest": un arbolito crece mientras dura la
// sesión de práctica en casa. Si se completa el tiempo, el árbol se planta y
// se suma al bosque de la familia (persistido en localStorage por niño).
//
// Árbol: SVG por capas con degradados (volumen/profundidad), tronco iluminado
// desde el sol (arriba-derecha), manzanas con brillo radial, sombra difuminada
// en el suelo, balanceo "vivo" mientras corre, pop elástico + hojas cayendo al
// completar. Animaciones en CSS puro (sin dependencias).

import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, X, Trees, Sparkles, Minus, Plus } from 'lucide-react'

type Phase = 'idle' | 'running' | 'paused' | 'done'

const DURACIONES = [5, 10, 15, 20, 30] // minutos

function lsCount(childId: string) { return `forest_count_${childId}` }
function lsToday(childId: string) {
  const d = new Date()
  return `forest_today_${childId}_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function fmt(secs: number) {
  const m = Math.floor(secs / 60), s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Anillo de progreso (strokeDasharray/offset, progress 0 → 1) ───────────────
function ProgressRing({ progress }: { progress: number }) {
  const R = 118
  const C = 2 * Math.PI * R
  return (
    <svg className="ft-ring" viewBox="0 0 260 260" aria-hidden>
      <circle cx="130" cy="130" r={R} fill="none" stroke="var(--c-border, #e2e8f0)" strokeWidth="7" opacity=".5" />
      <circle cx="130" cy="130" r={R} fill="none" stroke="url(#ftRingGrad)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))}
        style={{ transition: 'stroke-dashoffset 1s linear' }} />
      <defs>
        <linearGradient id="ftRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Árbol SVG por capas que crece con g (0 → 1) ───────────────────────────────
// Una sola pieza anclada al suelo (la copa nunca se separa del tronco).
function Tree({ g, done, alive }: { g: number; done: boolean; alive: boolean }) {
  const s = 0.1 + 0.9 * g  // escala uniforme: brote diminuto → árbol completo
  const APPLES: [number, number][] = [[78, 96], [101, 57], [123, 93], [88, 72], [113, 104], [99, 85]]
  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
      <defs>
        {/* Tronco iluminado desde la derecha (el sol está arriba a la derecha) */}
        <linearGradient id="ftTrunk" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7c4f2a" />
          <stop offset=".55" stopColor="#9c6a40" />
          <stop offset="1" stopColor="#bd8c5a" />
        </linearGradient>
        {/* Follaje en 3 tonos con luz desplazada hacia arriba-derecha */}
        <radialGradient id="ftLeafBack" cx=".45" cy=".4" r=".8">
          <stop offset="0" stopColor="#16a34a" />
          <stop offset="1" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="ftLeafMid" cx=".58" cy=".34" r=".82">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id="ftLeafFront" cx=".64" cy=".3" r=".85">
          <stop offset="0" stopColor="#86efac" />
          <stop offset=".55" stopColor="#4ade80" />
          <stop offset="1" stopColor="#22c55e" />
        </radialGradient>
        {/* Manzana con brillo radial */}
        <radialGradient id="ftApple" cx=".62" cy=".3" r=".85">
          <stop offset="0" stopColor="#fecaca" />
          <stop offset=".38" stopColor="#f87171" />
          <stop offset="1" stopColor="#dc2626" />
        </radialGradient>
        {/* Césped con degradado suave que se difumina */}
        <radialGradient id="ftGround" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#4ade80" stopOpacity=".6" />
          <stop offset=".65" stopColor="#86efac" stopOpacity=".4" />
          <stop offset="1" stopColor="#86efac" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* base de césped + sombra difuminada del árbol (crece con él) */}
      <ellipse cx="100" cy="178" rx="62" ry="10" fill="url(#ftGround)" />
      <ellipse cx="100" cy="179" rx={18 + 30 * g} ry={3.5 + 1.5 * g} fill="#14532d"
        opacity={0.14 + 0.1 * g} style={{ filter: 'blur(2.5px)', transition: 'all 1s linear' }} />

      {/* árbol completo — crece desde la base */}
      <g style={{ transform: `scale(${s})`, transformOrigin: '100px 178px', transition: 'transform 1s linear' }}>
        <g className={alive || done ? 'ft-sway' : ''}>
          {/* tronco con luz lateral */}
          <path d="M95 178 C96 151, 94 131, 98 105 L102 105 C106 131, 104 151, 105 178 Z" fill="url(#ftTrunk)" />
          {/* sombra del tronco (lado opuesto al sol) */}
          <path d="M95 178 C96 151, 94 131, 98 105 L99.3 105 C97.6 131, 98.4 151, 97.8 178 Z" fill="#5e3c1d" opacity=".45" />
          {/* ramas */}
          <path d="M99 135 C91 127, 85 124, 81 117" stroke="#8a5a32" strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M101 125 C109 118, 115 114, 120 107" stroke="#a87a48" strokeWidth="4.5" strokeLinecap="round" fill="none" />

          {/* follaje en capas (profundidad semi-isométrica) + respiración */}
          <g className={alive || done ? 'ft-breathe' : ''}>
            {/* capa trasera (sombra) */}
            <circle cx="70" cy="102" r="26" fill="url(#ftLeafBack)" />
            <circle cx="130" cy="102" r="26" fill="url(#ftLeafBack)" />
            <circle cx="100" cy="61" r="30" fill="url(#ftLeafBack)" />
            {/* capa media */}
            <circle cx="80" cy="87" r="27" fill="url(#ftLeafMid)" />
            <circle cx="120" cy="87" r="27" fill="url(#ftLeafMid)" />
            <circle cx="100" cy="69" r="30" fill="url(#ftLeafMid)" />
            {/* capa frontal (luz, hacia el sol) */}
            <circle cx="104" cy="85" r="26" fill="url(#ftLeafFront)" />
            <circle cx="87" cy="77" r="20" fill="url(#ftLeafFront)" opacity=".92" />
            {/* brillo del sol sobre la copa */}
            <ellipse cx="117" cy="62" rx="12" ry="8" fill="#d9f99d" opacity=".5" />
            <circle cx="108" cy="52" r="4" fill="#ecfccb" opacity=".6" />

            {/* manzanas orgánicas (aparecen al completar) */}
            <g style={{ opacity: done ? 1 : 0, transition: 'opacity .8s ease .25s' }}>
              {APPLES.map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="4.6" fill="url(#ftApple)" />
                  <path d={`M${x} ${y - 4.2} q 1 -2.2 2.6 -3`} stroke="#7c4f2a" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                  <circle cx={x - 1.4} cy={y - 1.6} r="1.1" fill="#fff1f2" opacity=".85" />
                </g>
              ))}
            </g>
          </g>
        </g>
      </g>

      {/* hojas cayendo al completar */}
      {done && (
        <g>
          {[[74, 78, 0], [104, 64, 1.3], [126, 84, 2.4]].map(([x, y, d], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path className="ft-leaf" style={{ animationDelay: `${d}s` }}
                d="M0 0 C3 -4.5, 8.5 -4.5, 10.5 0 C8.5 4.5, 3 4.5, 0 0 Z" fill={i === 1 ? '#86efac' : '#4ade80'} />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

export default function ForestTimer({ childId }: { childId: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  // Duración editable: se guarda como texto para permitir borrar/escribir libre
  const [durStr, setDurStr] = useState('10')
  const durMin = Math.min(180, Math.max(0, parseInt(durStr || '0', 10) || 0))
  // Segundos editables (0–59)
  const [secStr, setSecStr] = useState('00')
  const durSec = Math.min(59, Math.max(0, parseInt(secStr || '0', 10) || 0))
  const totalSecs = durMin * 60 + durSec
  const [remaining, setRemaining] = useState(10 * 60)
  const [total, setTotal] = useState(10 * 60)
  const [bosque, setBosque] = useState(0)
  const [hoy, setHoy] = useState(0)
  const endsAtRef = useRef(0)

  // Día/noche según la hora real del dispositivo (noche: 18:00 → 06:00).
  // Se re-evalúa cada minuto para que el atardecer ocurra solo.
  const [isNight, setIsNight] = useState(false)
  useEffect(() => {
    const check = () => { const h = new Date().getHours(); setIsNight(h >= 18 || h < 6) }
    check()
    const iv = setInterval(check, 60_000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    try {
      setBosque(parseInt(localStorage.getItem(lsCount(childId)) || '0', 10) || 0)
      setHoy(parseInt(localStorage.getItem(lsToday(childId)) || '0', 10) || 0)
    } catch { /* noop */ }
  }, [childId])

  // Tick basado en timestamps — preciso aunque la pestaña se suspenda
  useEffect(() => {
    if (phase !== 'running') return
    const iv = setInterval(() => {
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setPhase('done')
        try {
          const nb = (parseInt(localStorage.getItem(lsCount(childId)) || '0', 10) || 0) + 1
          const nh = (parseInt(localStorage.getItem(lsToday(childId)) || '0', 10) || 0) + 1
          localStorage.setItem(lsCount(childId), String(nb))
          localStorage.setItem(lsToday(childId), String(nh))
          setBosque(nb); setHoy(nh)
        } catch { /* noop */ }
        try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]) } catch { /* noop */ }
      }
    }, 500)
    return () => clearInterval(iv)
  }, [phase, childId])

  const start = () => {
    if (totalSecs < 1) return
    const t = totalSecs
    setTotal(t); setRemaining(t)
    endsAtRef.current = Date.now() + t * 1000
    setPhase('running')
  }
  const pause = () => { setPhase('paused') }
  const resume = () => { endsAtRef.current = Date.now() + remaining * 1000; setPhase('running') }
  const reset = () => { setPhase('idle'); setRemaining(totalSecs); setTotal(totalSecs) }

  const g = phase === 'idle' ? 0 : phase === 'done' ? 1 : Math.min(1, Math.max(0, 1 - remaining / total))

  return (
    <div className={`eng-card ft-root ${isNight ? 'ft-n' : ''}`}>
      <style>{`
        .ft-root{ border-radius:24px; overflow:hidden; position:relative;
          --ft-ink:var(--c-text-primary); --ft-ink2:var(--c-text-muted);
          background:linear-gradient(180deg,#bae6fd 0%,#e0f2fe 46%,#dcfce7 100%);
          border:1.5px solid var(--c-border-light); box-shadow:0 10px 36px rgba(2,132,199,.14);
          transition:background 1.2s ease; }
        .ft-root.ft-n{ --ft-ink:#f1f5f9; --ft-ink2:#94a3b8;
          background:linear-gradient(180deg,#0b1f38 0%,#10283f 55%,#11301f 100%); border-color:#1e293b; }
        .ft-inner{ position:relative; z-index:1; padding:20px 18px 36px; display:flex; flex-direction:column; align-items:center; }
        .ft-sun-wrap{ position:absolute; top:10px; right:14px; width:64px; height:64px; z-index:0;
          filter:drop-shadow(0 0 16px rgba(250,204,21,.55)); animation:ftSun 6s ease-in-out infinite; }
        .ft-rays{ transform-origin:40px 40px; animation:ftRays 26s linear infinite; }
        .ft-n .ft-sun-wrap{ display:none; }
        /* visibilidad día / noche según la HORA REAL (clase .ft-n en el root) */
        .ft-day,.ft-night{ position:absolute; inset:0; pointer-events:none; z-index:0; }
        .ft-night{ display:none; }
        .ft-n .ft-night{ display:block; }
        .ft-n .ft-day{ display:none; }
        /* luna */
        .ft-moon-wrap{ position:absolute; top:10px; right:14px; width:64px; height:64px;
          filter:drop-shadow(0 0 18px rgba(226,232,240,.45)); animation:ftSun 7s ease-in-out infinite; }
        /* estrellas */
        .ft-stars{ position:absolute; top:0; left:0; width:100%; height:150px; }
        .ft-star{ animation:ftTwinkle 2.8s ease-in-out infinite; }
        /* pajaritos */
        .ft-bird{ position:absolute; width:26px; height:11px; left:-40px; animation:ftBird linear infinite; opacity:.8; }
        .ft-bird.b1{ top:54px; animation-duration:26s; animation-delay:-6s; }
        .ft-bird.b2{ top:86px; width:18px; animation-duration:34s; animation-delay:-20s; opacity:.6; }
        /* mariposa */
        .ft-butterfly{ position:absolute; bottom:76px; left:12%; width:22px; height:17px;
          animation:ftFlutter 11s ease-in-out infinite alternate; }
        .ft-wing{ transform-box:fill-box; animation:ftFlap .45s ease-in-out infinite alternate; }
        .ft-wing.wl{ transform-origin:right center; }
        .ft-wing.wr{ transform-origin:left center; animation-delay:.05s; }
        /* luciérnagas */
        .ft-fly{ position:absolute; width:5px; height:5px; border-radius:50%; background:#fef08a;
          box-shadow:0 0 9px 3px rgba(253,224,71,.6); animation:ftFly ease-in-out infinite; opacity:0; }
        .ft-fly.f1{ left:14%; bottom:48px; animation-duration:7s; }
        .ft-fly.f2{ left:32%; bottom:66px; animation-duration:9s; animation-delay:1.4s; }
        .ft-fly.f3{ left:58%; bottom:52px; animation-duration:8s; animation-delay:.6s; }
        .ft-fly.f4{ left:76%; bottom:72px; animation-duration:10s; animation-delay:2s; }
        .ft-fly.f5{ left:88%; bottom:44px; animation-duration:7.5s; animation-delay:3s; }
        .ft-cloud{ position:absolute; top:26px; left:-70px; width:64px; height:20px; border-radius:20px; --cs:1;
          background:rgba(255,255,255,.9); box-shadow:18px -8px 0 -2px rgba(255,255,255,.9), 34px 0 0 -4px rgba(255,255,255,.85);
          animation:ftCloud 38s linear infinite; }
        .ft-cloud.c2{ top:58px; --cs:.7; animation-duration:55s; animation-delay:-22s; opacity:.8; }
        .ft-cloud.c3{ top:12px; --cs:.5; animation-duration:47s; animation-delay:-36s; opacity:.65; }
        .ft-n .ft-cloud{ background:rgba(255,255,255,.14); box-shadow:18px -8px 0 -2px rgba(255,255,255,.14), 34px 0 0 -4px rgba(255,255,255,.12); }
        .ft-landscape{ position:absolute; left:0; right:0; bottom:0; width:100%; height:96px; pointer-events:none; z-index:0; transition:filter 1.2s ease; }
        .ft-n .ft-landscape{ filter:brightness(.5) saturate(.75); }
        .ft-grass{ transform-box:fill-box; transform-origin:50% 100%; animation:ftSway2 3.8s ease-in-out infinite; }
        .ft-flower{ transform-box:fill-box; transform-origin:50% 100%; animation:ftSway2 4.6s ease-in-out infinite; }
        .ft-stage{ position:relative; width:min(64vw,250px); height:min(64vw,250px); margin:6px auto 2px; }
        .ft-ring{ position:absolute; inset:0; transform:rotate(-90deg); pointer-events:none; }
        .ft-tree{ position:absolute; inset:13%; filter:drop-shadow(0 7px 9px rgba(20,83,45,.22)); }
        .ft-pop{ animation:ftTreePop .7s cubic-bezier(.34,1.56,.64,1) both; }
        .ft-sway{ animation:ftSwayK 5.5s ease-in-out infinite; transform-origin:100px 178px; }
        .ft-breathe{ animation:ftBreatheK 4.5s ease-in-out infinite; transform-origin:100px 84px; }
        .ft-leaf{ animation:ftFall 3.5s ease-out 1 both; }
        .ft-time{ font-family:var(--font-display,inherit); font-weight:800; font-size:clamp(30px,8vw,40px);
          letter-spacing:1px; color:var(--ft-ink); font-variant-numeric:tabular-nums; line-height:1; margin-top:10px; }
        .ft-sub{ font-size:12px; color:var(--ft-ink2); margin-top:4px; font-weight:600; }
        .ft-chips{ display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:14px; }
        .ft-chip{ padding:8px 15px; border-radius:14px; font-size:13px; font-weight:700; cursor:pointer;
          border:1.5px solid var(--c-border); background:var(--c-card); color:var(--c-text-secondary);
          font-family:inherit; transition:all .15s; }
        .ft-chip:active{ transform:scale(.94); }
        .ft-chip.on{ background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; border-color:transparent;
          box-shadow:0 6px 16px rgba(22,163,74,.35); }
        .ft-stepper{ display:flex; align-items:center; gap:10px; margin-top:12px;
          background:var(--c-card); border:1.5px solid var(--c-border); border-radius:16px; padding:6px 8px; }
        .ft-step{ width:38px; height:38px; border-radius:12px; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center; font-family:inherit;
          background:rgba(22,163,74,.12); color:#16a34a; transition:transform .15s; }
        .ft-step:active{ transform:scale(.9); }
        .ft-mmss{ display:flex; align-items:center; gap:2px; }
        .ft-numin{ width:46px; text-align:center; border:none; outline:none; background:transparent;
          font-family:var(--font-display,inherit); font-weight:800; font-size:24px; color:var(--c-text-primary);
          font-variant-numeric:tabular-nums; border-radius:8px; padding:2px 0; }
        .ft-numin:focus{ background:rgba(22,163,74,.1); }
        .ft-colon{ font-family:var(--font-display,inherit); font-weight:800; font-size:24px; color:var(--c-text-muted); }
        .ft-hint{ font-size:10px; font-weight:700; color:var(--ft-ink2); margin:6px 0 0; letter-spacing:.5px; opacity:.8; }
        .ft-actions{ display:flex; gap:10px; margin-top:16px; width:100%; max-width:340px; }
        .ft-btn{ flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:13px 16px;
          border-radius:16px; font-size:14px; font-weight:800; cursor:pointer; border:none; font-family:inherit;
          transition:transform .15s, box-shadow .15s; }
        .ft-btn:active{ transform:scale(.97); }
        .ft-btn.go{ background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; box-shadow:0 8px 22px rgba(22,163,74,.35); }
        .ft-btn.soft{ background:var(--c-card); color:var(--c-text-secondary); border:1.5px solid var(--c-border); }
        .ft-btn.warn{ background:rgba(239,68,68,.1); color:#dc2626; border:1.5px solid rgba(239,68,68,.25); }
        .ft-forest{ display:flex; align-items:center; gap:6px; margin-top:14px; font-size:12px; font-weight:700;
          color:var(--c-text-secondary); background:var(--c-card); border:1.5px solid var(--c-border);
          padding:7px 14px; border-radius:20px; }
        .ft-done{ display:flex; align-items:center; gap:8px; margin-top:12px; padding:10px 18px; border-radius:16px;
          background:linear-gradient(135deg,#16a34a,#15803d); color:#fff; font-weight:800; font-size:14px;
          box-shadow:0 8px 22px rgba(22,163,74,.35); animation:ftPop .5s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes ftSun{ 0%,100%{ transform:translateY(0) } 50%{ transform:translateY(-5px) } }
        @keyframes ftRays{ from{ transform:rotate(0deg) } to{ transform:rotate(360deg) } }
        @keyframes ftSway2{ 0%,100%{ transform:rotate(-4deg) } 50%{ transform:rotate(4deg) } }
        @keyframes ftCloud{ from{ transform:translateX(0) scale(var(--cs,1)) } to{ transform:translateX(calc(100vw + 160px)) scale(var(--cs,1)) } }
        @keyframes ftTwinkle{ 0%,100%{ opacity:.2 } 50%{ opacity:1 } }
        @keyframes ftBird{
          0%{ transform:translate(0,0) }
          25%{ transform:translate(calc(25vw + 45px),-9px) }
          50%{ transform:translate(calc(50vw + 90px),4px) }
          75%{ transform:translate(calc(75vw + 135px),-7px) }
          100%{ transform:translate(calc(100vw + 180px),0) }
        }
        @keyframes ftFlap{ from{ transform:scaleX(1) } to{ transform:scaleX(.4) } }
        @keyframes ftFlutter{
          0%{ transform:translate(0,0) rotate(8deg) }
          25%{ transform:translate(38px,-22px) rotate(-10deg) }
          50%{ transform:translate(74px,-4px) rotate(10deg) }
          75%{ transform:translate(46px,-30px) rotate(-8deg) }
          100%{ transform:translate(96px,-12px) rotate(8deg) }
        }
        @keyframes ftFly{
          0%,100%{ transform:translate(0,0); opacity:0 }
          15%{ opacity:.95 }
          50%{ transform:translate(-14px,-18px); opacity:.65 }
          70%{ opacity:1 }
          85%{ opacity:.2 }
        }
        @keyframes ftPop{ from{ transform:scale(.6); opacity:0 } to{ transform:scale(1); opacity:1 } }
        @keyframes ftTreePop{ 0%{ transform:scale(.88) } 55%{ transform:scale(1.07) } 80%{ transform:scale(.985) } 100%{ transform:scale(1) } }
        @keyframes ftSwayK{ 0%,100%{ transform:rotate(-1deg) } 50%{ transform:rotate(1.2deg) } }
        @keyframes ftBreatheK{ 0%,100%{ transform:scale(1) } 50%{ transform:scale(1.015) } }
        @keyframes ftFall{
          0%{ transform:translate(0,0) rotate(0deg); opacity:0 }
          10%{ opacity:.9 }
          50%{ transform:translate(-12px,46px) rotate(140deg); opacity:.8 }
          100%{ transform:translate(8px,98px) rotate(290deg); opacity:0 }
        }
        @media(min-width:640px){ .ft-inner{ padding:24px 24px 40px } }
      `}</style>

      {/* ── Cielo: sol con rayos + nubes con paralaje ── */}
      <div className="ft-sun-wrap" aria-hidden>
        <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%', display: 'block' }}>
          <g className="ft-rays" stroke="#fde047" strokeWidth="3.5" strokeLinecap="round" opacity=".85">
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i * Math.PI) / 4
              return <line key={i}
                x1={40 + Math.cos(a) * 22} y1={40 + Math.sin(a) * 22}
                x2={40 + Math.cos(a) * 30} y2={40 + Math.sin(a) * 30} />
            })}
          </g>
          <defs>
            <radialGradient id="ftSunCore" cx=".38" cy=".38" r=".8">
              <stop offset="0" stopColor="#fefce8" />
              <stop offset=".55" stopColor="#fde047" />
              <stop offset="1" stopColor="#facc15" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="40" r="17" fill="url(#ftSunCore)" />
          {/* carita feliz */}
          <circle cx="34.5" cy="37" r="1.6" fill="#b45309" opacity=".8" />
          <circle cx="45.5" cy="37" r="1.6" fill="#b45309" opacity=".8" />
          <path d="M34 43 Q40 47.5 46 43" stroke="#b45309" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".8" />
        </svg>
      </div>
      <div className="ft-cloud" />
      <div className="ft-cloud c2" />
      <div className="ft-cloud c3" />

      {/* ── DÍA: pajaritos cruzando + mariposa ── */}
      <div className="ft-day" aria-hidden>
        <svg className="ft-bird b1" viewBox="0 0 28 12">
          <path d="M1 9 Q7 1 14 8 Q21 1 27 9" stroke="#475569" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <svg className="ft-bird b2" viewBox="0 0 28 12">
          <path d="M1 9 Q7 1 14 8 Q21 1 27 9" stroke="#64748b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <div className="ft-butterfly">
          <svg viewBox="0 0 24 18" style={{ width: '100%', height: '100%', display: 'block' }}>
            <g className="ft-wing wl">
              <ellipse cx="8" cy="7" rx="6" ry="5" fill="#f0abfc" />
              <ellipse cx="8.5" cy="13" rx="4.5" ry="3.5" fill="#e879f9" />
            </g>
            <g className="ft-wing wr">
              <ellipse cx="16" cy="7" rx="6" ry="5" fill="#f0abfc" />
              <ellipse cx="15.5" cy="13" rx="4.5" ry="3.5" fill="#e879f9" />
            </g>
            <rect x="11.2" y="4" width="1.6" height="11" rx=".8" fill="#581c87" />
          </svg>
        </div>
      </div>

      {/* ── NOCHE: luna, estrellas y luciérnagas ── */}
      <div className="ft-night" aria-hidden>
        <div className="ft-moon-wrap">
          <svg viewBox="0 0 80 80" style={{ width: '100%', height: '100%', display: 'block' }}>
            <defs>
              <radialGradient id="ftMoonCore" cx=".4" cy=".38" r=".85">
                <stop offset="0" stopColor="#f8fafc" />
                <stop offset=".6" stopColor="#e2e8f0" />
                <stop offset="1" stopColor="#cbd5e1" />
              </radialGradient>
            </defs>
            <circle cx="40" cy="40" r="17" fill="url(#ftMoonCore)" />
            <circle cx="34" cy="36" r="3.4" fill="#94a3b8" opacity=".5" />
            <circle cx="46" cy="44" r="2.4" fill="#94a3b8" opacity=".4" />
            <circle cx="42" cy="31" r="1.6" fill="#94a3b8" opacity=".45" />
          </svg>
        </div>
        <svg className="ft-stars" viewBox="0 0 400 150" preserveAspectRatio="xMidYMin slice">
          {([[24, 28, 1.6, 0], [70, 14, 1.2, .8], [120, 42, 1.8, 1.6], [165, 18, 1.1, .4], [205, 34, 1.5, 2.2],
             [248, 12, 1.2, 1.1], [288, 40, 1.7, .2], [322, 22, 1.2, 1.9], [360, 36, 1.5, .7], [50, 58, 1.1, 2.6],
             [180, 64, 1.3, 1.4], [340, 60, 1.1, 3]] as [number, number, number, number][]).map(([x, y, r, d], i) => (
            <circle key={i} className="ft-star" cx={x} cy={y} r={r} fill="#e0f2fe"
              style={{ animationDelay: `${d}s` }} />
          ))}
        </svg>
        <div className="ft-fly f1" /><div className="ft-fly f2" /><div className="ft-fly f3" />
        <div className="ft-fly f4" /><div className="ft-fly f5" />
      </div>

      {/* ── Paisaje: colinas, pasto, arbusto, piedritas y flores ── */}
      <svg className="ft-landscape" viewBox="0 0 400 110" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <linearGradient id="ftHillBack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bbf7d0" />
            <stop offset="1" stopColor="#86efac" />
          </linearGradient>
          <linearGradient id="ftHillFront" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4ade80" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {/* colinas */}
        <path d="M0 62 Q90 34 190 54 T400 44 L400 110 L0 110 Z" fill="url(#ftHillBack)" />
        <path d="M0 84 Q110 56 230 78 T400 70 L400 110 L0 110 Z" fill="url(#ftHillFront)" />
        {/* arbusto */}
        <g transform="translate(348 74)">
          <circle cx="0" cy="0" r="9" fill="#16a34a" />
          <circle cx="10" cy="2" r="7" fill="#15803d" />
          <circle cx="-9" cy="3" r="6.5" fill="#22c55e" />
        </g>
        {/* piedritas */}
        <ellipse cx="58" cy="94" rx="6" ry="3.5" fill="#cbd5e1" />
        <ellipse cx="67" cy="96" rx="3.5" ry="2.2" fill="#94a3b8" />
        {/* matitas de pasto que se mecen */}
        {([[26, 90, 0], [110, 82, .6], [180, 88, .2], [256, 84, .9], [318, 90, .4]] as [number, number, number][]).map(([x, y, d], i) => (
          <g key={`g${i}`} transform={`translate(${x} ${y})`}>
            <g className="ft-grass" style={{ animationDelay: `${d}s` }}>
              <path d="M0 0 C-1 -5 -2.5 -8 -4.5 -11" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M0 0 C0 -6 0 -10 .5 -14" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M0 0 C1.5 -5 3 -8 5 -11" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </g>
          </g>
        ))}
        {/* florcitas */}
        {([[84, 88, '#f9a8d4', 0], [214, 92, '#fde047', .8], [296, 80, '#fda4af', .4], [150, 80, '#e9d5ff', 1.1]] as [number, number, string, number][]).map(([x, y, c, d], i) => (
          <g key={`f${i}`} transform={`translate(${x} ${y})`}>
            <g className="ft-flower" style={{ animationDelay: `${d}s` }}>
              <line x1="0" y1="0" x2="0" y2="-9" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" />
              {[0, 72, 144, 216, 288].map(ang => (
                <circle key={ang}
                  cx={Math.cos((ang * Math.PI) / 180) * 3}
                  cy={-9 + Math.sin((ang * Math.PI) / 180) * 3}
                  r="2.1" fill={c} />
              ))}
              <circle cx="0" cy="-9" r="1.6" fill="#fbbf24" />
            </g>
          </g>
        ))}
      </svg>

      <div className="ft-inner">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(22,163,74,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trees size={16} color="#16a34a" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: 'var(--ft-ink)' }}>Modo Bosque</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--ft-ink2)' }}>Planta un árbol mientras practican juntos</p>
          </div>
        </div>

        {/* Escena: anillo + árbol */}
        <div className="ft-stage">
          <ProgressRing progress={g} />
          <div className={`ft-tree ${phase === 'done' ? 'ft-pop' : ''}`}>
            <Tree g={g} done={phase === 'done'} alive={phase === 'running'} />
          </div>
        </div>

        {/* Tiempo */}
        <div className="ft-time">{phase === 'idle' ? fmt(totalSecs) : fmt(remaining)}</div>
        <p className="ft-sub">
          {phase === 'idle' && 'Elige cuánto tiempo practicarán'}
          {phase === 'running' && 'El arbolito está creciendo… ¡sigan así!'}
          {phase === 'paused' && 'En pausa — el arbolito espera'}
          {phase === 'done' && '¡Tiempo completado!'}
        </p>

        {/* Duraciones */}
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
            {/* Editor MM : SS — minutos y segundos editables */}
            <div className="ft-stepper">
              <button className="ft-step" aria-label="Restar 10 segundos"
                onClick={() => { const tot = Math.max(5, totalSecs - 10); setDurStr(String(Math.floor(tot / 60))); setSecStr(String(tot % 60).padStart(2, '0')) }}>
                <Minus size={16} />
              </button>
              <div className="ft-mmss">
                <input
                  className="ft-numin" type="text" inputMode="numeric" value={durStr}
                  onChange={e => setDurStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                  onFocus={e => e.target.select()}
                  onBlur={() => { if (durMin > 180) setDurStr('180') }}
                  aria-label="Minutos" />
                <span className="ft-colon">:</span>
                <input
                  className="ft-numin" type="text" inputMode="numeric" value={secStr}
                  onChange={e => setSecStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  onFocus={e => e.target.select()}
                  onBlur={() => setSecStr(String(durSec).padStart(2, '0'))}
                  aria-label="Segundos" />
              </div>
              <button className="ft-step" aria-label="Sumar 10 segundos"
                onClick={() => { const tot = Math.min(180 * 60, totalSecs + 10); setDurStr(String(Math.floor(tot / 60))); setSecStr(String(tot % 60).padStart(2, '0')) }}>
                <Plus size={16} />
              </button>
            </div>
            <p className="ft-hint">minutos : segundos</p>
          </>
        )}

        {/* Celebración */}
        {phase === 'done' && (
          <div className="ft-done"><Sparkles size={16} /> ¡Árbol plantado en su bosque!</div>
        )}

        {/* Controles */}
        <div className="ft-actions">
          {phase === 'idle' && (
            <button className="ft-btn go" onClick={start} disabled={totalSecs < 1}
              style={totalSecs < 1 ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
              <Play size={16} /> Plantar árbol
            </button>
          )}
          {phase === 'running' && (
            <>
              <button className="ft-btn soft" onClick={pause}><Pause size={15} /> Pausa</button>
              <button className="ft-btn warn" onClick={reset}><X size={15} /> Rendirse</button>
            </>
          )}
          {phase === 'paused' && (
            <>
              <button className="ft-btn go" onClick={resume}><Play size={15} /> Continuar</button>
              <button className="ft-btn warn" onClick={reset}><X size={15} /> Rendirse</button>
            </>
          )}
          {phase === 'done' && (
            <button className="ft-btn go" onClick={reset}><RotateCcw size={15} /> Plantar otro</button>
          )}
        </div>

        {/* Bosque acumulado */}
        <div className="ft-forest">
          <Trees size={14} color="#16a34a" />
          {bosque} árbol{bosque !== 1 ? 'es' : ''} en su bosque
          {hoy > 0 && <span style={{ color: '#16a34a' }}>· {hoy} hoy</span>}
        </div>
      </div>
    </div>
  )
}
