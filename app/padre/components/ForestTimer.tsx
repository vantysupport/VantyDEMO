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
    <div className="eng-card ft-root">
      <style>{`
        .ft-root{ border-radius:24px; overflow:hidden; position:relative;
          background:linear-gradient(180deg,#bae6fd 0%,#e0f2fe 46%,#dcfce7 100%);
          border:1.5px solid var(--c-border-light); box-shadow:0 10px 36px rgba(2,132,199,.14); }
        .dark .ft-root{ background:linear-gradient(180deg,#0c2c47 0%,#0d2a3d 55%,#0f2e22 100%); border-color:#21262d; }
        .ft-inner{ position:relative; z-index:1; padding:20px 18px 22px; display:flex; flex-direction:column; align-items:center; }
        .ft-sun{ position:absolute; top:16px; right:20px; width:44px; height:44px; border-radius:50%;
          background:radial-gradient(circle at 38% 38%, #fef9c3, #fde047 65%, #facc15);
          box-shadow:0 0 28px rgba(250,204,21,.55); animation:ftSun 6s ease-in-out infinite; }
        .ft-cloud{ position:absolute; top:30px; left:-60px; width:64px; height:20px; border-radius:20px;
          background:rgba(255,255,255,.85); box-shadow:18px -8px 0 -2px rgba(255,255,255,.85), 34px 0 0 -4px rgba(255,255,255,.8);
          animation:ftCloud 36s linear infinite; opacity:.9; }
        .dark .ft-cloud{ background:rgba(255,255,255,.16); box-shadow:18px -8px 0 -2px rgba(255,255,255,.16), 34px 0 0 -4px rgba(255,255,255,.14); }
        .ft-stage{ position:relative; width:min(64vw,250px); height:min(64vw,250px); margin:6px auto 2px; }
        .ft-ring{ position:absolute; inset:0; transform:rotate(-90deg); pointer-events:none; }
        .ft-tree{ position:absolute; inset:13%; filter:drop-shadow(0 7px 9px rgba(20,83,45,.22)); }
        .ft-pop{ animation:ftTreePop .7s cubic-bezier(.34,1.56,.64,1) both; }
        .ft-sway{ animation:ftSwayK 5.5s ease-in-out infinite; transform-origin:100px 178px; }
        .ft-breathe{ animation:ftBreatheK 4.5s ease-in-out infinite; transform-origin:100px 84px; }
        .ft-leaf{ animation:ftFall 3.5s ease-out 1 both; }
        .ft-time{ font-family:var(--font-display,inherit); font-weight:800; font-size:clamp(30px,8vw,40px);
          letter-spacing:1px; color:var(--c-text-primary); font-variant-numeric:tabular-nums; line-height:1; margin-top:10px; }
        .ft-sub{ font-size:12px; color:var(--c-text-muted); margin-top:4px; font-weight:600; }
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
        .ft-hint{ font-size:10px; font-weight:700; color:var(--c-text-placeholder); margin:6px 0 0; letter-spacing:.5px; }
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
        @keyframes ftCloud{ from{ transform:translateX(0) } to{ transform:translateX(calc(100vw + 140px)) } }
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
        @media(min-width:640px){ .ft-inner{ padding:24px } }
      `}</style>

      <div className="ft-sun" />
      <div className="ft-cloud" />

      <div className="ft-inner">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(22,163,74,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trees size={16} color="#16a34a" />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: 'var(--c-text-primary)' }}>Modo Bosque</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--c-text-muted)' }}>Planta un árbol mientras practican juntos</p>
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
