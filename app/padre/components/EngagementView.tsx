'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Brain, CheckCircle, Circle, Clock, ChevronDown,
  Sparkles, Heart, Target, Loader2, RefreshCw, TrendingUp, Trophy,
  Zap, Star, MessageCircle, Users, Pin, ClipboardList
} from 'lucide-react'
import { useTheme } from '@/components/ThemeContext'

interface Actividad {
  titulo: string; descripcion: string; duracion_minutos: number
  dificultad: 'facil'|'media'|'alta'; area: string
  materiales_necesarios: string[]; por_que_importa: string
  dias_recomendados: string[]; completada?: boolean
}
interface Plan {
  id?: string; semana: string; mensaje_motivacional: string
  actividades: Actividad[]; child_name: string; completadas_pct?: number
}

const AREA_CFG: Record<string,{bg:string;text:string;border:string;Icon:any;grad:string}> = {
  comunicacion: { bg:'var(--c-stat-blue)',   text:'#0284c7', border:'var(--c-border)', Icon:MessageCircle, grad:'linear-gradient(135deg,#0284c7,#0369a1)' },
  conducta:     { bg:'rgba(249,115,22,0.1)', text:'#f97316', border:'var(--c-border)', Icon:Zap, grad:'linear-gradient(135deg,#f97316,#c2410c)' },
  habilidades:  { bg:'var(--c-stat-purple)', text:'#0ea5e9', border:'var(--c-border)', Icon:Brain, grad:'linear-gradient(135deg,#0ea5e9,#0369a1)' },
  socializacion:{ bg:'var(--c-stat-green)',  text:'#10b981', border:'var(--c-border)', Icon:Users, grad:'linear-gradient(135deg,#22c55e,#15803d)' },
  autonomia:    { bg:'var(--c-stat-amber)',   text:'#f59e0b', border:'var(--c-border)', Icon:Star, grad:'linear-gradient(135deg,#eab308,#b45309)' },
}
const AREA_DEFAULT = { bg:'var(--c-surface)', text:'var(--c-text-muted)', border:'var(--c-border)', Icon:Pin, grad:'linear-gradient(135deg,#94a3b8,#64748b)' }

const DIFF_CFG: Record<string,{label:string;color:string;bg:string;dot:string}> = {
  facil: { label:'Fácil',   color:'#16a34a', bg:'var(--c-stat-green)', dot:'#4ade80' },
  media: { label:'Media',   color:'#d97706', bg:'var(--c-stat-amber)', dot:'#fbbf24' },
  alta:  { label:'Difícil', color:'#dc2626', bg:'rgba(239,68,68,0.1)', dot:'#f87171' },
}
const DIFF_DEFAULT = { label:'Normal', color:'var(--c-text-muted)', bg:'var(--c-surface)', dot:'var(--c-text-placeholder)' }

// Clave de localStorage para guardar estado de completadas por plan
function lsKey(childId: string, planId: string|null) {
  return `engagement_done_${childId}_${planId||'current'}`
}

export default function EngagementView({ childId }: { childId: string }) {
  const { isDark } = useTheme()
  const { t } = useI18n()
  const [plan, setPlan] = useState<Plan|null>(null)
  const [planId, setPlanId] = useState<string|null>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [expanded, setExpanded] = useState<number|null>(null)
  const [completadas, setCompletadas] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState<number|null>(null)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>|null>(null)

  // Guardar en localStorage inmediatamente
  const saveLocal = (childId: string, pId: string|null, done: Set<number>) => {
    try {
      localStorage.setItem(lsKey(childId, pId), JSON.stringify([...done]))
    } catch {}
  }

  // Leer de localStorage
  const loadLocal = (childId: string, pId: string|null): Set<number> => {
    try {
      const raw = localStorage.getItem(lsKey(childId, pId))
      if (raw) return new Set(JSON.parse(raw) as number[])
    } catch {}
    return new Set()
  }

  const cargar = async () => {
    setLoading(true)
    // Reset al cambiar de niño — evita mostrar el plan del hijo anterior
    setPlan(null); setPlanId(null); setCompletadas(new Set()); setExpanded(null)
    try {
      const loc = typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale')||'es') : 'es'
      const r = await fetch(`/api/engagement-padres?child_id=${childId}&locale=${loc}`, { cache: 'no-store' })
      const j = await r.json()
      if (j.plan) {
        const planData = j.plan
        const pId = planData.id || planData.plan_id || planData._id || null
        setPlan(planData)
        setPlanId(pId)

        // Reconstruir completadas: primero desde el servidor, luego merge con localStorage
        const fromServer = new Set<number>()
        planData.actividades?.forEach((a: Actividad, i: number) => { if (a.completada) fromServer.add(i) })
        const fromLocal = loadLocal(childId, pId)

        // Unión: si cualquiera de los dos lo marca como hecho, está hecho
        const merged = new Set<number>([...fromServer, ...fromLocal])
        setCompletadas(merged)

        // Si el localStorage tiene más datos que el servidor, re-sincronizar
        if (fromLocal.size > fromServer.size && pId) {
          const updated = planData.actividades.map((a: Actividad, i: number) => ({ ...a, completada: merged.has(i) }))
          fetch('/api/engagement-padres', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-locale': loc },
            body: JSON.stringify({
              childId, accion: 'actualizar_completadas', planId: pId,
              actividades: updated,
              completadas_pct: Math.round(merged.size / (planData.actividades.length || 1) * 100)
            })
          }).catch(() => {})
        }
      }
      setHistorial(j.historial || [])
    } catch (e) { console.warn('Error cargando plan:', e) }
    setLoading(false)
  }

  const generar = async () => {
    setGenerando(true)
    try {
      const loc = typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale')||'es') : 'es'
      const r = await fetch('/api/engagement-padres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': loc },
        body: JSON.stringify({ childId, accion: 'generar_plan', locale: loc })
      })
      const j = await r.json()
      if (j.error || !j.plan?.id) throw new Error(j.error || 'El plan no se pudo guardar. Reintentá.')
      const pId = j.plan.id
      setPlan(j.plan); setPlanId(pId); setCompletadas(new Set()); setExpanded(null)
    } catch (e: any) { alert('Error: ' + e.message) }
    setGenerando(false)
  }

  const toggle = async (idx: number) => {
    if (!plan) return
    setSaving(idx)

    const next = new Set<number>(completadas)
    if (next.has(idx)) next.delete(idx); else next.add(idx)

    // 1. Actualizar UI inmediatamente
    setCompletadas(next)
    const updatedPlan = { ...plan, actividades: plan.actividades.map((a, i) => ({ ...a, completada: next.has(i) })) }
    setPlan(updatedPlan)

    // 2. Guardar en localStorage inmediatamente (garantía de persistencia local)
    const currentPlanId = planId || plan.id || (plan as any).plan_id || null
    saveLocal(childId, currentPlanId, next)

    // 3. Guardar en Supabase directamente (doble vía: API + Supabase directo)
    const completadas_pct = Math.round(next.size / (plan.actividades.length || 1) * 100)
    const loc = typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale')||'es') : 'es'

    // Vía API (principal)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/engagement-padres', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': loc },
          body: JSON.stringify({
            childId, accion: 'actualizar_completadas', planId: currentPlanId,
            actividades: updatedPlan.actividades, completadas_pct
          })
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (apiErr) {
        console.warn('API falló, intentando Supabase directo:', apiErr)
        // Vía Supabase directo como fallback
        if (currentPlanId) {
          try {
            await supabase.from('engagement_plans').update({
              actividades: updatedPlan.actividades,
              completadas_pct,
              updated_at: new Date().toISOString()
            }).eq('id', currentPlanId)
          } catch (sbErr) { console.warn('Supabase directo también falló:', sbErr) }
        }
      }
    }, 300)

    setTimeout(() => setSaving(null), 500)
  }

  useEffect(() => { if (childId) cargar() }, [childId])

  const pct = plan ? Math.round(completadas.size / (plan.actividades?.length || 1) * 100) : 0
  const all = plan?.actividades?.length || 0

  if (loading) return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 20px',gap:16 }}>
      <div style={{ width:56,height:56,borderRadius:'50%',background:'var(--c-stat-purple)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <Loader2 size={28} color="#0284c7" style={{ animation:'spin 1s linear infinite' }}/>
      </div>
      <p style={{ fontSize:13,color:'var(--c-text-placeholder)',fontWeight:600 }}>Cargando plan semanal...</p>
      <style>{`
  :root {
    --c-card: #ffffff;
    --c-surface: #f8fafc;
    --c-bg: #f1f5f9;
    --c-border: #e2e8f0;
    --c-border-light: #f1f5f9;
    --c-text-primary: #0f172a;
    --c-text-secondary: #374151;
    --c-text-muted: #64748b;
    --c-text-placeholder: #94a3b8;
  }
  .dark {
    --c-card: #161b22;
    --c-surface: #0d1117;
    --c-bg: #090d12;
    --c-border: #30363d;
    --c-border-light: #21262d;
    --c-text-primary: #f0f6fc;
    --c-text-secondary: #c9d1d9;
    --c-text-muted: #8b949e;
    --c-text-placeholder: #6e7681;
  }
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,paddingBottom:32,width:'100%' }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes checkPop{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
        .eng-card{animation:fadeUp .35s ease both}
        .eng-act{transition:all .15s;cursor:pointer;border:1.5px solid #f1f5f9}
        .eng-act:hover{box-shadow:0 6px 20px rgba(0,0,0,.08)!important;transform:translateY(-1px)}
        .eng-act:active{transform:scale(.99)}
        .eng-toggle{transition:all .2s}
        .eng-toggle:active{transform:scale(.9)}
        @media(min-width:640px){
          .eng-acts-grid{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:12px!important}
        }
        @media(min-width:1024px){
          .eng-acts-grid{grid-template-columns:repeat(3,1fr)!important}
        }
      `}</style>

      {/* HERO */}
      <div className="eng-card" style={{ background:'linear-gradient(135deg,#0369a1,#0284c7,#06b6d4)',borderRadius:24,padding:'22px 22px 18px',color:'#ffffff',boxShadow:'0 16px 50px rgba(2,132,199,.3)',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-20,right:-20,width:130,height:130,background:'rgba(255,255,255,.07)',borderRadius:'50%' }}/>
        <div style={{ position:'relative',zIndex:1 }}>
          <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:6 }}>
                <div style={{ width:28,height:28,background:'rgba(255,255,255,.2)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center' }}><Heart size={14}/></div>
                <span style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'rgba(255,255,255,.7)' }}>Actividades en casa</span>
              </div>
              <h1 style={{ fontSize:20,fontWeight:900,margin:'0 0 3px' }}>Plan semanal de {plan?.child_name||'tu hijo/a'}</h1>
              <p style={{ fontSize:12,color:'rgba(255,255,255,.6)',margin:0 }}>Actividades diseñadas con IA por tu especialista</p>
            </div>
            <button onClick={generar} disabled={generando} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(255,255,255,.18)',border:'1px solid rgba(255,255,255,.25)',color:'#ffffff',borderRadius:12,fontSize:12,fontWeight:700,cursor:generando?'not-allowed':'pointer',flexShrink:0,fontFamily:'inherit' }}>
              {generando ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }}/> : <RefreshCw size={13}/>}
              {generando ? 'Generando...' : 'Nuevo plan'}
            </button>
          </div>

          {plan && (
            <div style={{ marginTop:16 }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6 }}>
                <span style={{ fontSize:12,color:'rgba(255,255,255,.7)',fontWeight:600 }}>Progreso semanal</span>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <span style={{ fontSize:20,fontWeight:900 }}>{completadas.size}</span>
                  <span style={{ fontSize:13,color:'rgba(255,255,255,.55)' }}>/ {all}</span>
                  {pct===100 && <Trophy size={16} color="#fbbf24"/>}
                </div>
              </div>
              <div style={{ height:8,background:'rgba(255,255,255,.18)',borderRadius:20,overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,rgba(255,255,255,0.6),#fff)',borderRadius:20,transition:'width .6s cubic-bezier(.22,1,.36,1)' }}/>
              </div>
              <p style={{ fontSize:11,color:'rgba(255,255,255,.55)',margin:'5px 0 0',textAlign:'right' }}>{pct}% completado · {plan.semana}</p>
            </div>
          )}
        </div>
      </div>

      {!plan ? (
        <div className="eng-card" style={{ background:'var(--c-card)',borderRadius:24,border:'1.5px solid var(--c-border-light)',padding:'48px 24px',textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,.04)' }}>
          <div style={{ width:72,height:72,background:'var(--c-stat-purple)',borderRadius:20,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
            <Brain size={32} color="#0284c7"/>
          </div>
          <p style={{ fontWeight:800,fontSize:16,color:'var(--c-text-primary)',margin:'0 0 8px' }}>Sin plan esta semana</p>
          <p style={{ fontSize:13,color:'var(--c-text-placeholder)',lineHeight:1.6,maxWidth:280,margin:'0 auto 24px' }}>La IA generará actividades personalizadas basadas en el progreso terapéutico.</p>
          <button onClick={generar} disabled={generando} style={{ display:'inline-flex',alignItems:'center',gap:8,background:'linear-gradient(135deg,#0369a1,#0284c7)',color:'#ffffff',border:'none',padding:'13px 24px',borderRadius:16,fontSize:14,fontWeight:700,cursor:generando?'not-allowed':'pointer',boxShadow:'0 6px 20px rgba(2,132,199,.3)',fontFamily:'inherit' }}>
            <Sparkles size={16}/>{generando ? 'Generando...' : 'Generar actividades con IA'}
          </button>
        </div>
      ) : (
        <>
          {/* Mensaje motivacional */}
          <div className="eng-card" style={{ background:'var(--c-surface)',border:'1.5px solid var(--c-border)',borderRadius:16,padding:'12px 16px',display:'flex',alignItems:'flex-start',gap:10 }}>
            <Sparkles size={16} color="#0284c7" style={{ flexShrink:0,marginTop:2 }}/>
            <p style={{ fontSize:13,color:'var(--c-text-primary)',fontWeight:600,lineHeight:1.6,margin:0 }}>{plan.mensaje_motivacional}</p>
          </div>

          {/* Disclaimer */}
          <div className="eng-card" style={{ background:'var(--c-stat-blue)',border:'1.5px solid var(--c-border)',borderRadius:12,padding:'9px 14px',display:'flex',alignItems:'center',gap:8 }}>
            <ClipboardList size={15} color="#0284c7" style={{ flexShrink:0 }} />
            <p style={{ fontSize:12,color:'var(--c-text-muted)',margin:0,lineHeight:1.5 }}>Plan diseñado con IA. Consultá con el terapeuta ante cualquier duda.</p>
          </div>

          {/* ACTIVIDADES */}
          <div className="eng-acts-grid" style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {plan.actividades?.map((act, i) => {
              const done = completadas.has(i)
              const isSaving = saving === i
              const aCol = AREA_CFG[act.area] || AREA_DEFAULT
              const dCol = DIFF_CFG[act.dificultad] || DIFF_DEFAULT
              const open = expanded === i

              return (
                <div key={i} className="eng-act"
                  style={{ background: done ? 'rgba(16,185,129,0.1)' : 'var(--c-card)', borderRadius:20, overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,.04)', position:'relative', borderColor: done ? 'rgba(16,185,129,0.3)' : 'var(--c-border-light)', cursor:'default', ...(open ? { gridColumn:'1 / -1' } : {}) }}>

                  {/* Barra lateral de color por área */}
                  <div style={{ position:'absolute',left:0,top:0,bottom:0,width:4,background:aCol.grad,borderRadius:'20px 0 0 20px' }}/>

                  <div style={{ padding:'14px 14px 14px 20px' }}>
                    <div style={{ display:'flex',alignItems:'flex-start',gap:12 }}>
                      {/* Botón toggle - grande y táctil */}
                      <button className="eng-toggle"
                        onClick={e => { e.stopPropagation(); toggle(i) }}
                        disabled={isSaving}
                        title={done ? 'Marcar como pendiente' : 'Marcar como completada'}
                        style={{ flexShrink:0,width:42,height:42,borderRadius:13,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',background:done?'rgba(16,185,129,0.15)':isSaving?'var(--c-border-light)':'var(--c-surface)',boxShadow:done?'0 2px 8px rgba(16,185,129,.2)':'0 1px 3px rgba(0,0,0,.08)' }}>
                        {isSaving
                          ? <Loader2 size={20} color="var(--c-text-placeholder)" style={{ animation:'spin 1s linear infinite' }}/>
                          : done
                            ? <CheckCircle size={24} color="#10b981" style={{ animation:'checkPop .4s ease' }}/>
                            : <Circle size={24} color="#d1d5db"/>
                        }
                      </button>

                      <div style={{ flex:1,minWidth:0 }}>
                        <button onClick={() => setExpanded(open ? null : i)}
                          style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6,width:'100%',background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit',textAlign:'left' }}>
                          <p style={{ fontWeight:800,fontSize:14,color:done?'#10b981':'var(--c-text-primary)',margin:0,lineHeight:1.3,textDecoration:done?'line-through':'none',textDecorationColor:'#86efac' }}>
                            {act.titulo}
                          </p>
                          <div style={{ display:'flex',alignItems:'center',gap:6,flexShrink:0 }}>
                            {(() => { const AIcon = aCol.Icon; return <AIcon size={16} color={aCol.text} /> })()}
                            <ChevronDown size={14} color="var(--c-text-placeholder)" style={{ transition:'transform .2s',transform:open?'rotate(180deg)':'rotate(0)' }}/>
                          </div>
                        </button>
                        <div style={{ display:'flex',flexWrap:'wrap',gap:5,alignItems:'center' }}>
                          <span style={{ fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:aCol.bg,color:aCol.text,border:`1px solid ${aCol.border}` }}>{act.area}</span>
                          <span style={{ display:'flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:dCol.bg,color:dCol.color }}>
                            <div style={{ width:5,height:5,borderRadius:'50%',background:dCol.dot }}/>
                            {dCol.label}
                          </span>
                          <span style={{ fontSize:10,color:'var(--c-text-placeholder)',display:'flex',alignItems:'center',gap:3 }}>
                            <Clock size={10}/>{act.duracion_minutos} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel expandido */}
                  {open && (
                    <div style={{ padding:'0 18px 16px 20px',borderTop:'1px solid var(--c-border-light)' }} onClick={e => e.stopPropagation()}>
                      <p style={{ fontSize:13,color:'var(--c-text-muted)',lineHeight:1.7,margin:'14px 0 12px' }}>{act.descripcion}</p>

                      <div style={{ background:'var(--c-stat-purple)',borderRadius:14,padding:'12px 14px',marginBottom:10,border:'1px solid var(--c-border)' }}>
                        <p style={{ fontSize:11,fontWeight:800,color:'var(--c-text-muted)',margin:'0 0 5px',display:'flex',alignItems:'center',gap:5 }}>
                          <Target size={12}/>¿Por qué importa?
                        </p>
                        <p style={{ fontSize:12,color:'var(--c-text-secondary)',margin:0,lineHeight:1.6 }}>{act.por_que_importa}</p>
                      </div>

                      {act.materiales_necesarios?.length > 0 && (
                        <div style={{ marginBottom:10 }}>
                          <p style={{ fontSize:11,fontWeight:700,color:'var(--c-text-placeholder)',margin:'0 0 6px',display:'flex',alignItems:'center',gap:5 }}>
                            <Zap size={11}/>Materiales
                          </p>
                          <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                            {act.materiales_necesarios.map((m: string, j: number) => (
                              <span key={j} style={{ fontSize:11,background:'var(--c-card)',border:'1px solid var(--c-border)',color:'var(--c-text-muted)',padding:'4px 10px',borderRadius:20 }}>{m}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {act.dias_recomendados?.length > 0 && (
                        <div style={{ marginBottom:14 }}>
                          <p style={{ fontSize:11,fontWeight:700,color:'var(--c-text-placeholder)',margin:'0 0 6px',display:'flex',alignItems:'center',gap:5 }}>
                            <Star size={11}/>Días recomendados
                          </p>
                          <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                            {act.dias_recomendados.map((d: string, j: number) => (
                              <span key={j} style={{ fontSize:11,fontWeight:700,background:'var(--c-stat-blue)',color:'#0284c7',padding:'4px 10px',borderRadius:20,border:'1px solid var(--c-border)',textTransform:'capitalize' }}>{d}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botón de acción principal en panel expandido */}
                      <button onClick={e => { e.stopPropagation(); toggle(i) }}
                        style={{ width:'100%',padding:'11px',background:done?'var(--c-surface)':'linear-gradient(135deg,#0369a1,#0284c7)',color:done?'var(--c-text-muted)':'var(--c-card)',border:done?'1.5px solid var(--c-border)':'none',borderRadius:14,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'inherit',transition:'all .2s' }}>
                        {done
                          ? <><Circle size={15}/>Marcar como pendiente</>
                          : <><CheckCircle size={15}/>Marcar como completada</>
                        }
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Celebración */}
          {pct === 100 && all > 0 && (
            <div className="eng-card" style={{ background:'rgba(16,185,129,0.1)',border:'1.5px solid rgba(16,185,129,0.3)',borderRadius:22,padding:'20px 22px',display:'flex',alignItems:'center',gap:16,boxShadow:'0 8px 24px rgba(16,185,129,.1)' }}>
              <div style={{ width:52, height:52, borderRadius:16, background:'rgba(16,185,129,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#059669' }}><Trophy size={28} /></div>
              <div>
                <p style={{ fontWeight:900,fontSize:16,color:'var(--c-text-primary)',margin:'0 0 4px' }}>¡Semana completada!</p>
                <p style={{ fontSize:13,color:'var(--c-text-secondary)',lineHeight:1.5,margin:0 }}>Excelente trabajo acompañando a {plan.child_name||'tu hijo/a'} esta semana. 🌱</p>
              </div>
            </div>
          )}

          {/* Historial */}
          {historial.length > 1 && (
            <div className="eng-card" style={{ background:'var(--c-card)',borderRadius:20,border:'1.5px solid var(--c-border-light)',padding:'16px 18px',boxShadow:'0 4px 20px rgba(0,0,0,.04)' }}>
              <p style={{ fontSize:11,fontWeight:800,color:'var(--c-text-muted)',margin:'0 0 14px',display:'flex',alignItems:'center',gap:6,textTransform:'uppercase',letterSpacing:.5 }}>
                <TrendingUp size={13} color="#0284c7"/>Historial de semanas
              </p>
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {historial.slice(0, 5).map((h: any, i: number) => (
                  <div key={i} style={{ display:'flex',alignItems:'center',gap:12 }}>
                    <span style={{ fontSize:11,color:'var(--c-text-placeholder)',width:72,flexShrink:0,fontWeight:600 }}>Sem. {h.semana}</span>
                    <div style={{ flex:1,height:8,background:'var(--c-border-light)',borderRadius:20,overflow:'hidden' }}>
                      <div style={{ height:'100%',width:`${h.completadas_pct||0}%`,background:'linear-gradient(90deg,#0369a1,#0284c7)',borderRadius:20,transition:'width .8s ease' }}/>
                    </div>
                    <span style={{ fontSize:12,fontWeight:800,color:h.completadas_pct===100?'#16a34a':'#0284c7',width:38,textAlign:'right' }}>{h.completadas_pct||0}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
