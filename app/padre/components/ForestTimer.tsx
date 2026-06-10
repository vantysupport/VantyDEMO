'use client'
// app/padre/components/ForestTimer.tsx
// Cronómetro de práctica estilo "Forest": un arbolito crece mientras dura la
// sesión de práctica en casa. Si se completa el tiempo, el árbol se planta y
// se suma al bosque de la familia (persistido en localStorage por niño).

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

// ── Árbol SVG que crece con g (0 → 1) ─────────────────────────────────────────
// Todo el árbol es UNA pieza que crece desde el suelo (origen en la base), así
// la copa siempre queda unida al tronco — nunca flota desconectada.
function Tree({ g, done }: { g: number; done: boolean }) {
  const s = 0.1 + 0.9 * g  // escala uniforme: brote diminuto → árbol completo
  return (
    <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden>
      {/* suelo */}
      <ellipse cx="100" cy="178" rx="58" ry="8" fill="#86efac" opacity=".5" />
      <ellipse cx="100" cy="178" rx="34" ry="5" fill="#22c55e" opacity=".28" />

      <g style={{ transform: `scale(${s})`, transformOrigin: '100px 178px', transition: 'transform 1s linear' }}>
        {/* tronco */}
        <path d="M95 178 C96 151, 94 131, 98 105 L102 105 C106 131, 104 151, 105 178 Z" fill="#9c6a40" />
        <path d="M100 178 C100 150, 100 122, 100 106" stroke="#82562f" strokeWidth="1.4" opacity=".45" fill="none" />
        {/* ramas */}
        <path d="M99 135 C91 127, 85 124, 81 117" stroke="#9c6a40" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M101 125 C109 118, 115 114, 120 107" stroke="#9c6a40" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* copa */}
        <circle cx="74" cy="99" r="27" fill="#22c55e" />
        <circle cx="126" cy="99" r="27" fill="#22c55e" />
        <circle cx="100" cy="65" r="33" fill="#34d399" />
        <circle cx="82" cy="83" r="26" fill="#4ade80" />
        <circle cx="118" cy="83" r="26" fill="#4ade80" />
        <circle cx="100" cy="91" r="28" fill="#34d399" />
        {/* brillos */}
        <ellipse cx="88" cy="61" rx="9" ry="7" fill="#bbf7d0" opacity=".7" />
        <circle cx="112" cy="73" r="5" fill="#bbf7d0" opacity=".5" />
        {/* flores al completar */}
        <g style={{ opacity: done ? 1 : 0, transition: 'opacity .8s ease .2s' }}>
          {[[76, 89], [100, 57], [124, 89], [88, 73], [114, 97], [100, 83]].map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="4.5" fill="#fda4af" />
              <circle cx={x} cy={y} r="1.8" fill="#fff1f2" />
            </g>
          ))}
        </g>
      </g>
    </svg>
  )
}

export default function ForestTimer({ childId }: { childId: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  // Duración editable: se guarda como texto para permitir borrar/escribir libre
  const [durStr, setDurStr] = useState('10')
  const durMin = Math.min(180, Math.max(0, parseInt(durStr || '0', 10) || 0))
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
    if (durMin < 1) return
    const t = durMin * 60
    setTotal(t); setRemaining(t)
    endsAtRef.current = Date.now() + t * 1000
    setPhase('running')
  }
  const pause = () => { setPhase('paused') }
  const resume = () => { endsAtRef.current = Date.now() + remaining * 1000; setPhase('running') }
  const reset = () => { setPhase('idle'); setRemaining(durMin * 60); setTotal(durMin * 60) }

  const g = phase === 'idle' ? 0 : phase === 'done' ? 1 : Math.min(1, Math.max(0, 1 - remaining / total))
  const R = 118
  const C = 2 * Math.PI * R

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
        .ft-ring{ position:absolute; inset:0; transform:rotate(-90deg); }
        .ft-tree{ position:absolute; inset:13%; }
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
        .ft-mininput{ width:64px; text-align:center; border:none; outline:none; background:transparent;
          font-family:var(--font-display,inherit); font-weight:800; font-size:22px; color:var(--c-text-primary);
          font-variant-numeric:tabular-nums; -moz-appearance:textfield; appearance:textfield; }
        .ft-mininput::-webkit-outer-spin-button,.ft-mininput::-webkit-inner-spin-button{ -webkit-appearance:none; margin:0; }
        .ft-minlabel{ font-size:13px; font-weight:700; color:var(--c-text-muted); margin-right:2px; }
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
          <svg className="ft-ring" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r={R} fill="none" stroke="var(--c-border)" strokeWidth="7" opacity=".5" />
            <circle cx="130" cy="130" r={R} fill="none" stroke="url(#ftGrad)" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - g)}
              style={{ transition: 'stroke-dashoffset 1s linear' }} />
            <defs>
              <linearGradient id="ftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>
          <div className="ft-tree"><Tree g={g} done={phase === 'done'} /></div>
        </div>

        {/* Tiempo */}
        <div className="ft-time">{phase === 'idle' ? fmt(durMin * 60) : fmt(remaining)}</div>
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
                <button key={m} className={`ft-chip ${durMin === m ? 'on' : ''}`}
                  onClick={() => { setDurStr(String(m)); setRemaining(m * 60); setTotal(m * 60) }}>
                  {m} min
                </button>
              ))}
            </div>
            {/* Duración personalizada — editable */}
            <div className="ft-stepper">
              <button className="ft-step" aria-label="Menos minutos"
                onClick={() => { const v = Math.max(1, durMin - 1); setDurStr(String(v)) }}>
                <Minus size={16} />
              </button>
              <input
                className="ft-mininput"
                type="number" inputMode="numeric" min={1} max={180}
                value={durStr}
                onChange={e => setDurStr(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                onBlur={() => { if (durMin < 1) setDurStr('1') }}
                aria-label="Minutos de práctica"
              />
              <span className="ft-minlabel">min</span>
              <button className="ft-step" aria-label="Más minutos"
                onClick={() => { const v = Math.min(180, durMin + 1); setDurStr(String(v)) }}>
                <Plus size={16} />
              </button>
            </div>
          </>
        )}

        {/* Celebración */}
        {phase === 'done' && (
          <div className="ft-done"><Sparkles size={16} /> ¡Árbol plantado en su bosque!</div>
        )}

        {/* Controles */}
        <div className="ft-actions">
          {phase === 'idle' && (
            <button className="ft-btn go" onClick={start} disabled={durMin < 1}
              style={durMin < 1 ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
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
