'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useEffect, useState, useRef } from 'react'
import { supabase as supabaseClient } from '@/lib/supabase'
import {
  CalendarDays, Clock, CheckCircle, XCircle, RefreshCw,
  TrendingUp, Target, Activity, Award, ChevronRight,
  Sparkles, Baby, BarChart3, AlertCircle, Users, BookOpen, Lightbulb, Hand,
  Smile, Meh, Frown,
  Heart, Trophy, PartyPopper, X,
  MessageCircle, Brain
} from 'lucide-react'
import { useTheme } from '@/components/ThemeContext'

interface Props {
  child: any
  onChangeView: (view: string) => void
  refreshTrigger: number
  onCancelAppointment: (id: string, reschedule: boolean) => void
}

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function calcAge(birthDate: string) {
  if (!birthDate) return 0
  const today = new Date(), birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
  return age
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return { day: d, month: MONTHS_ES[m-1], monthFull: MONTHS_FULL[m-1], year: y }
}

function CountUp({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (target === 0) { setVal(0); return }
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])
  return <>{val}</>
}

function GoalCelebration({ childName, goalsAchieved, onClose }: { childName: string; goalsAchieved: number; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 6000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(10px)' }}>
      <div style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1,#0ea5e9)', borderRadius: 32, padding: '48px 40px', textAlign: 'center', maxWidth: 400, width: '90%', boxShadow: '0 0 80px rgba(79,70,229,.6)', position: 'relative', overflow: 'hidden', animation: 'celebIn .5s cubic-bezier(.175,.885,.32,1.275)' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', color: 'var(--c-card)', fontSize: 18 }}>×</button>
        <div style={{ width: 84, height: 84, margin: '0 auto 16px', borderRadius: 26, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Trophy size={44} /></div>
        <h2 style={{ fontWeight: 900, fontSize: 30, color: 'var(--c-card)', marginBottom: 8 }}>¡Gran logro!</h2>
        <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 16, lineHeight: 1.6, marginBottom: 24 }}>
          <strong style={{ color: '#fbbf24' }}>{childName}</strong> alcanzó <strong style={{ color: '#fbbf24' }}>{goalsAchieved} objetivo{goalsAchieved !== 1 ? 's' : ''}</strong> con dominio ≥80%.
        </p>
      </div>
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
@keyframes celebIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )
}

function WellbeingSurvey({ childName, childId, parentId, onClose }: { childName: string; childId: string; parentId: string; onClose: () => void }) {
  const [answered, setAnswered] = useState(false)
  const [selectedMood, setSelectedMood] = useState<'bien' | 'regular' | 'dificil' | null>(null)
  const [nota, setNota] = useState('')
  const [saving, setSaving] = useState(false)
  const options: { Icon: any; label: string; mood: 'bien'|'regular'|'dificil'; color: string; bg: string; border: string }[] = [
    { Icon: Smile, label: 'Bien, con energía para seguir', mood: 'bien',    color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
    { Icon: Meh,   label: 'Regular, algo cansado/a',       mood: 'regular', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    { Icon: Frown, label: 'Difícil, necesito más apoyo',   mood: 'dificil', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  ]

  const persistir = async (mood: 'bien'|'regular'|'dificil', notaTexto?: string) => {
    if (!parentId || !childId) return
    setSaving(true)
    try {
      await fetch('/api/parent-wellbeing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: parentId, child_id: childId, mood, nota: notaTexto || null }),
      })
    } catch {/* silencioso — no romper la UX si falla */}
    finally { setSaving(false) }
  }

  const handleMoodClick = async (mood: 'bien'|'regular'|'dificil') => {
    setSelectedMood(mood)
    if (mood === 'dificil') {
      // No persistir aún — esperar a que escriba la nota opcional
      return
    }
    await persistir(mood)
    setAnswered(true)
    setTimeout(onClose, 3000)
  }

  const handleSubmitDificil = async () => {
    await persistir('dificil', nota.trim() || undefined)
    setAnswered(true)
    setTimeout(onClose, 3000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', padding: '0 16px 24px' }}>
      <div style={{ background: 'var(--c-card)', borderRadius: '28px 28px 20px 20px', padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 -30px 80px rgba(0,0,0,.15)', animation: 'slideUp .4s cubic-bezier(.175,.885,.32,1.275)' }}>
        {!answered ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42, height: 42, background: 'linear-gradient(135deg,#fce7f3,#ede9fe)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Heart size={18} color="#be185d" /></div>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: 0 }}>¿Cómo estás tú?</p>
                  <p style={{ fontSize: 11, color: 'var(--c-text-placeholder)', margin: 0 }}>Chequeo de bienestar mensual</p>
                </div>
              </div>
              <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>Acompañar a <strong>{childName || 'tu hijo/a'}</strong> es un trabajo importante. ¿Cómo te has sentido esta semana?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {options.map(opt => {
                const isSelected = selectedMood === opt.mood
                return (
                  <button
                    key={opt.label}
                    onClick={() => handleMoodClick(opt.mood)}
                    disabled={saving}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: opt.bg,
                      border: `${isSelected ? '3px' : '2px'} solid ${opt.border}`,
                      borderRadius: 14, fontSize: 14, fontWeight: 600,
                      color: opt.color, cursor: saving ? 'wait' : 'pointer',
                      textAlign: 'left', fontFamily: 'inherit',
                      opacity: saving && !isSelected ? 0.5 : 1,
                    }}
                  >
                    {(() => { const OIcon = opt.Icon; return <OIcon size={22} style={{ flexShrink: 0 }} /> })()} {opt.label}
                  </button>
                )
              })}
            </div>
            {selectedMood === 'dificil' && (
              <div style={{ marginTop: 16, animation: 'fadeIn .3s ease' }}>
                <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginBottom: 8 }}>
                  ¿Querés contarnos más? (opcional)
                </p>
                <textarea
                  value={nota}
                  onChange={e => setNota(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Cualquier cosa que quieras compartir con tu terapeuta — lo verá en privado."
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 12,
                    border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit',
                    resize: 'none', outline: 'none', background: 'var(--c-surface)',
                    color: 'var(--c-text-primary)',
                  }}
                />
                <button
                  onClick={handleSubmitDificil}
                  disabled={saving}
                  style={{
                    marginTop: 10, width: '100%', padding: '11px 16px', borderRadius: 12,
                    background: '#dc2626', color: 'white', border: 'none',
                    fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Enviando...' : 'Enviar a mi terapeuta'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 18, background: 'rgba(2,132,199,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}><Heart size={28} /></div>
            <h3 style={{ fontWeight: 800, fontSize: 18, color: 'var(--c-text-primary)', marginBottom: 8 }}>¡Gracias por compartir!</h3>
            <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>Tu terapeuta tomará esto en cuenta.</p>
          </div>
        )}
      </div>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )
}

export default function HomeViewInnovative({ child, onChangeView, refreshTrigger, onCancelAppointment }: Props) {
  const { isDark } = useTheme()
  const { t, locale } = useI18n()
  const supabase = supabaseClient
  const [nextAppt, setNextAppt] = useState<any>(null)
  const [stats, setStats] = useState({ sessions: 0, goalsAchieved: 0, hoursTotal: 0, level: 'Inicial', monthSessions: 0, masteryRate: 0, totalGoals: 0 })
  const [loading, setLoading] = useState(true)
  const [parentMessages, setParentMessages] = useState<any[]>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const [prevGoals, setPrevGoals] = useState(-1)
  const [showWellbeing, setShowWellbeing] = useState(false)
  const [prediccion, setPrediccion] = useState<any>(null)
  const [patrones, setPatrones] = useState<any>(null)
  const [programas, setProgramas] = useState<any[]>([])
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null)
  const [gcalBannerDismissed, setGcalBannerDismissed] = useState(false)
  const [pollingTimedOut, setPollingTimedOut] = useState(false)

  useEffect(() => {
    if (gcalBannerDismissed) return
    const dismissed = sessionStorage.getItem('gcal_banner_dismissed')
    if (dismissed) { setGcalBannerDismissed(true); return }
    const checkGcal = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user?.id) return
        const res = await fetch(`/api/google-calendar?action=status&userId=${session.user.id}`)
        const data = await res.json()
        setGcalConnected(!!data.connected)
      } catch { }
    }
    checkGcal()
  }, [gcalBannerDismissed])

  useEffect(() => { if (!child?.id) return; loadData() }, [child?.id, refreshTrigger])

  useEffect(() => {
    const key = `wellbeing_shown_${new Date().getFullYear()}_${new Date().getMonth()}`
    if (!localStorage.getItem(key) && child?.id) {
      const timer = setTimeout(() => { setShowWellbeing(true); localStorage.setItem(key, '1') }, 18000)
      return () => clearTimeout(timer)
    }
  }, [child?.id])

  const loadData = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const monthStart = today.slice(0,7) + '-01'

    // Próxima cita y mensajes — usan anon key normal (tienen RLS correcta)
    const [
      { data: appts },
      { data: monthSess },
      { data: msgs },
      { data: parentMsgs },
      { data: pred },
      { data: pats },
    ] = await Promise.all([
      supabase.from('appointments').select('*').eq('child_id', child.id).gte('appointment_date', today).neq('status', 'cancelled').neq('status', 'completed').order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true }).limit(1),
      supabase.from('appointments').select('id').eq('child_id', child.id).in('status', ['completed', 'realizada', 'completada']),
      // Skip notifications si el niño no tiene parent_id vinculado (evita 400 con user_id=eq.)
      child.parent_id
        ? supabase.from('notifications').select('*').eq('user_id', child.parent_id).eq('is_read', false).order('created_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] as any[] }),
      // parent_messages puede no existir en algunos ambientes — capturar el error
      supabase.from('parent_messages').select('*').eq('child_id', child.id).order('created_at', { ascending: false }).limit(5)
        .then((r: any) => r.error ? { data: [] } : r),
      // .maybeSingle() en vez de .single() — no es error que el niño no tenga
      // predicciones/patrones generados aún (genera 406 en consola innecesario)
      supabase.from('predicciones_ia').select('*').eq('child_id', child.id).maybeSingle(),
      supabase.from('patrones_detectados').select('*').eq('child_id', child.id).maybeSingle(),
    ])

    setNextAppt(appts?.[0] || null)
    setParentMessages([...(msgs || []), ...(parentMsgs || [])].slice(0, 5))
    if (pred) setPrediccion(pred)
    if (pats) setPatrones(pats)

    // ── Stats con service_role via API (evita restricciones RLS en objetivos_cp y sesiones_datos_aba)
    let apiStats: any = null
    try {
      const res = await fetch(`/api/padre/stats?child_id=${child.id}`, { cache: 'no-store' })
      if (res.ok) apiStats = await res.json()
    } catch (e) {
      console.warn('[HomeView] Error cargando stats via API:', e)
    }

    // Diagnóstico — muestra de qué tabla viene el conteo de sesiones (útil cuando aparece
    // un número que el padre no reconoce como real).
    if (apiStats?._debug) {
      const dbg = apiStats._debug
      console.log(
        `%c[stats:${child?.name || 'paciente'}]`,
        'background:#0284c7;color:#fff;padding:2px 6px;border-radius:4px;font-weight:bold',
        `\n  Total mostrado al padre: ${dbg.total_sesiones_final}`,
        `\n    · Previas (configurado en admin):  ${dbg.sesiones_previas_manuales || 0}`,
        `\n    · En plataforma:                   ${(dbg.total_sesiones_final || 0) - (dbg.sesiones_previas_manuales || 0)}`,
        `\n        ├─ appointments (completed):  ${dbg.appointments_completed}`,
        `\n        ├─ agenda_sesiones:           ${dbg.agenda_sesiones}`,
        `\n        └─ aba_sessions_v2:           ${dbg.aba_sessions_v2}`,
        `\n    · registro_aba (legacy):     ${dbg.registro_aba}  (IGNORADO — tabla obsoleta)`,
        `\n  Registros de datos ABA:        ${dbg.sesiones_datos_aba_filas_total}  (informativo, NO cuenta como sesión)`,
      )
    }

    const completedAppts = monthSess?.length || 0  // monthSess is now ALL completed appointments
    const totalSess = apiStats?.totalSesiones && apiStats.totalSesiones > 0
      ? apiStats.totalSesiones
      : completedAppts
    const achieved  = apiStats?.goalsAchieved  ?? 0
    const totalGoals = apiStats?.totalGoals    ?? 0
    const masteryRate = apiStats?.masteryRate  ?? 0
    // Horas: SIEMPRE del API (que ya filtra por fuentes reales). Si no hay sesiones
    // reales, hoursTotal = 0 — no extrapolar para no engañar al padre.
    const hoursTotal  = apiStats?.hoursTotal ?? 0
    let level = apiStats?.level ?? 'Inicial'
    // Calcular nivel localmente si la API falló
    if (!apiStats?.level || totalSess !== (apiStats?.totalSesiones ?? 0)) {
      if (totalSess >= 50) level = 'Avanzado'
      else if (totalSess >= 20) level = 'Intermedio'
      else if (totalSess >= 5) level = 'Básico'
      else level = 'Inicial'
    }

    if (apiStats?.programas?.length) setProgramas(
      apiStats.programas.filter((p: any) => 
        p.estado !== 'dominado' && p.fase_actual !== 'dominado'
      )
    )

    // Si hay sesiones reales, regenerar prediccion si está desactualizada
    const sesionesEnPrediccion = pred?.sesiones_analizadas ?? pred?.total_sesiones_unificado ?? 0
    const textoCorrupto = !pred?.analisis_ia ||
      (pred?.analisis_ia as string)?.includes('0 sesiones') ||
      (pred?.analisis_ia as string)?.includes('0 programas')

    if (totalSess > 0 && (sesionesEnPrediccion < totalSess || textoCorrupto)) {
      // Fire & forget — no esperamos respuesta (Vercel puede cortar la conexión antes)
      fetch('/api/agente-prediccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId: child.id, childName: child.name }),
      }).catch(() => {})

      // Polling: revisar Supabase cada 5s hasta que sesiones_analizadas se actualice (max 10 intentos = 50s)
      let intentos = 0
      const sessionesObjetivo = totalSess
      const poll = setInterval(async () => {
        intentos++
        const { data: fresh } = await supabase
          .from('predicciones_ia')
          .select('*')
          .eq('child_id', child.id)
          .maybeSingle()
        const fressSess = fresh?.sesiones_analizadas ?? fresh?.total_sesiones_unificado ?? 0
        const textoNuevo = fresh?.analisis_ia || fresh?.prediccion_30d || ''
        const textoListo = !!(textoNuevo) &&
          !textoNuevo.includes('0 sesiones') &&
          !textoNuevo.includes('0 programas')
        if (fresh && fressSess >= sessionesObjetivo && textoListo) {
          setPrediccion(fresh)
          clearInterval(poll)
        } else if (intentos >= 20) {
          // Timeout: mostrar lo que haya aunque no esté actualizado
          if (fresh) setPrediccion(fresh)
          setPollingTimedOut(true)
          clearInterval(poll)
        }
      }, 5000)
    }

    if (prevGoals !== -1 && achieved > prevGoals && achieved > 0) setShowCelebration(true)
    setPrevGoals(achieved)
    // monthSessions = this month's completed appointments
    const thisMonth = today.slice(0, 7)
    const monthCompletedCount = (monthSess || []).filter((a: any) => 
      (a.appointment_date || '').startsWith(thisMonth)
    ).length
    setStats({ sessions: totalSess, goalsAchieved: achieved, hoursTotal, level, monthSessions: monthCompletedCount, masteryRate, totalGoals })
    setLoading(false)
  }

  const age = child ? calcAge(child.birth_date) : 0
  const firstName = child?.name?.split(' ')[0] || 'tu hijo/a'

  const AREA_ICON: Record<string, { Icon: any; color: string }> = {
    comunicacion: { Icon: MessageCircle, color: '#0284c7' },
    conducta:     { Icon: Target,        color: '#e11d48' },
    cognitivo:    { Icon: Brain,         color: '#0891b2' },
    social:       { Icon: Users,         color: '#059669' },
    autonomia:    { Icon: Sparkles,      color: '#d97706' },
    academico:    { Icon: BookOpen,      color: '#0284c7' },
    sensorial:    { Icon: Hand,          color: '#db2777' },
    imitacion:    { Icon: Activity,      color: '#0ea5e9' },
    default:      { Icon: Lightbulb,     color: '#0284c7' },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, paddingBottom:24, width:'100%', boxSizing:'border-box' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{from{background-position:200% center}to{background-position:-200% center}}
        @keyframes progressIn{from{width:0}to{width:var(--w)}}
        .hv-card{animation:fadeUp .35s ease both}
        .hv-card:nth-child(1){animation-delay:.04s}.hv-card:nth-child(2){animation-delay:.08s}
        .hv-card:nth-child(3){animation-delay:.12s}.hv-card:nth-child(4){animation-delay:.16s}
        .hv-card:nth-child(5){animation-delay:.20s}.hv-card:nth-child(6){animation-delay:.24s}
        .hv-btn:hover{opacity:.85;transform:translateY(-1px)}
        .hv-btn{transition:all .2s ease}
        .hv-prog-bar{transition:width 1.1s cubic-bezier(.22,1,.36,1)}
        @media(min-width:768px){
          .hv-two-col{display:grid!important;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
        }
      `}</style>

      {showCelebration && <GoalCelebration childName={child?.name||'tu hijo/a'} goalsAchieved={stats.goalsAchieved} onClose={()=>setShowCelebration(false)}/>}
      {showWellbeing && child?.id && child?.parent_id && (
        <WellbeingSurvey
          childName={child.name}
          childId={child.id}
          parentId={child.parent_id}
          onClose={() => setShowWellbeing(false)}
        />
      )}

      {/* ── GOOGLE CALENDAR BANNER ── */}
      {gcalConnected===false && !gcalBannerDismissed && (
        <div className="hv-card" style={{ background:'linear-gradient(135deg,#0284c7,#0369a1)', borderRadius:18, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 4px 16px rgba(2,132,199,.25)' }}>
          <span style={{ fontSize:24, flexShrink:0 }}>📅</span>
          <div style={{ flex:1 }}>
            <p style={{ color:'#ffffff', fontWeight:700, fontSize:13, margin:0 }}>Recibe tus citas en Google Calendar</p>
            <p style={{ color:'rgba(255,255,255,.75)', fontSize:11, margin:'2px 0 0' }}>Conecta tu cuenta y las citas aparecerán automáticamente.</p>
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={()=>onChangeView('profile')} className="hv-btn" style={{ background:'var(--c-card)', color:'#0284c7', border:'none', borderRadius:10, padding:'7px 14px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Conectar</button>
            <button onClick={()=>{sessionStorage.setItem('gcal_banner_dismissed','1');setGcalBannerDismissed(true)}} style={{ background:'rgba(255,255,255,.2)', color:'#ffffff', border:'none', borderRadius:10, padding:'7px 10px', fontSize:13, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <div className="hv-card" style={{ borderRadius:24, overflow:'hidden', position:'relative', background:'linear-gradient(135deg,#0369a1 0%,#0369a1 50%,#0284c7 100%)', boxShadow:'0 12px 40px rgba(79,70,229,.3)' }}>
        {/* decorative circles */}
        <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, background:'rgba(255,255,255,.07)', borderRadius:'50%', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-40, left:-20, width:150, height:150, background:'rgba(255,255,255,.05)', borderRadius:'50%', pointerEvents:'none' }}/>

        <div style={{ position:'relative', zIndex:1, padding:'22px 22px 18px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <p style={{ color:'rgba(255,255,255,.65)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, margin:'0 0 4px' }}>Paciente activo</p>
              <h1 style={{ fontSize:24, fontWeight:900, color:'#ffffff', margin:'0 0 10px', letterSpacing:'-0.5px', lineHeight:1.15 }}>{child?.name || 'Sin seleccionar'}</h1>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                <span style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)', color:'#ffffff', fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,.2)' }}>{age} años</span>
                {child?.diagnosis && <span style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)', color:'#ffffff', fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,.2)' }}>{child.diagnosis}</span>}
                {/* Badge dinámico: completadas + próxima si existe */}
                {stats.sessions > 0 ? (
                  <span style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)', color:'#ffffff', fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,.2)' }}>
                    ✓ {stats.sessions} {stats.sessions === 1 ? 'sesión realizada' : 'sesiones realizadas'}
                  </span>
                ) : nextAppt ? (
                  <span style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)', color:'#ffffff', fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,.2)' }}>
                    📅 Empieza pronto
                  </span>
                ) : (
                  <span style={{ background:'rgba(255,255,255,.15)', backdropFilter:'blur(8px)', color:'rgba(255,255,255,.85)', fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid rgba(255,255,255,.2)' }}>
                    Aún sin sesiones
                  </span>
                )}
              </div>
            </div>
            <div style={{ position:'relative', flexShrink:0 }}>
              <div style={{ width:56, height:56, background:'rgba(255,255,255,.2)', backdropFilter:'blur(10px)', borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, color:'#ffffff', border:'2px solid rgba(255,255,255,.3)' }}>
                {child?.name?.[0]?.toUpperCase() || '?'}
              </div>
              {stats.sessions > 0 && <div style={{ position:'absolute', bottom:-2, right:-2, width:16, height:16, background:'#10b981', borderRadius:'50%', border:'2.5px solid #0369a1' }}/>}
            </div>
          </div>

          {/* Progress bar */}
          {stats.sessions > 0 && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ color:'rgba(255,255,255,.65)', fontSize:11, fontWeight:600 }}>Dominio de objetivos</span>
                <span style={{ color:'#ffffff', fontSize:11, fontWeight:800 }}>{stats.masteryRate}%</span>
              </div>
              <div style={{ height:6, background:'rgba(255,255,255,.2)', borderRadius:10, overflow:'hidden' }}>
                <div className="hv-prog-bar" style={{ height:'100%', width:`${stats.masteryRate}%`, background:'linear-gradient(90deg,#a5f3fc,#fff)', borderRadius:10 }}/>
              </div>
            </div>
          )}
        </div>

        {/* Quick access strip */}
        <div style={{ background:'rgba(0,0,0,.2)', borderTop:'1px solid rgba(255,255,255,.1)', padding:'10px 16px', display:'flex', gap:8, overflowX:'auto', WebkitOverflowScrolling:'touch' as any }}>
          {[
            { label:'💬 Preguntar a ARIA', view:'chat' },
            { label:'🏃 Actividades',      view:'engagement' },
            { label:'📅 Mis citas',        view:'miscitas' },
          ].map(({ label, view }) => (
            <button key={view} onClick={()=>onChangeView(view)} className="hv-btn"
              style={{ background:'rgba(255,255,255,.15)', color:'#ffffff', border:'1px solid rgba(255,255,255,.2)', borderRadius:10, padding:'6px 12px', fontSize:11, fontWeight:700, cursor:'pointer', backdropFilter:'blur(6px)', whiteSpace:'nowrap', flexShrink:0 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATS ROW ── */}
      <div className="hv-card" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
        {[
          { val: loading ? '…' : stats.sessions,                    label:'Sesiones',        sub: stats.monthSessions > 0 ? `+${stats.monthSessions} este mes` : (stats.sessions === 0 ? (nextAppt ? 'Próxima cita programada' : 'Aún ninguna realizada') : 'Realizadas hasta hoy'), color:'#0284c7' },
          { val: loading ? '…' : `${stats.goalsAchieved}/${stats.totalGoals||'?'}`, label:'Objetivos logrados', sub:'Con dominio ≥80%', color:'#059669' },
          { val: loading ? '…' : (stats.hoursTotal > 0 ? `${stats.hoursTotal}h` : '—'),             label:'Horas de terapia', sub: stats.hoursTotal > 0 ? `~${Math.round(stats.hoursTotal/Math.max(stats.sessions,1)*10)/10}h por sesión` : 'Cuando haya sesiones', color:'#0284c7' },
          { val: loading ? '…' : `${stats.masteryRate}%`,              label:'Dominio',          sub:'Promedio de objetivos', color:'#d97706' },
        ].map(({ val, label, sub, color }) => (
          <div key={label} style={{ background:'var(--c-card)', borderRadius:18, padding:'18px 16px', border:`1px solid var(--c-border)`, display:'flex', flexDirection:'column', gap:6, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, width:4, height:'100%', borderRadius:'18px 0 0 18px', background:color }}/>
            <div style={{ paddingLeft:10 }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--c-text-muted)', textTransform:'uppercase', letterSpacing:0.5, margin:'0 0 6px' }}>{label}</p>
              <p style={{ fontSize:26, fontWeight:900, color:'var(--c-text-primary)', margin:0, lineHeight:1, letterSpacing:'-0.5px' }}>{val}</p>
              <p style={{ fontSize:11, color:'var(--c-text-muted)', margin:'5px 0 0', lineHeight:1.4 }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── DOS COLUMNAS en tablet/desktop ── */}
      <div className="hv-two-col" style={{ display:'flex', flexDirection:'column', gap:16 }}>

        {/* COLUMNA IZQUIERDA */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* IA SUMMARY — simplified for parents */}
          {!loading && (prediccion || patrones) && (()=>{
            const sesionesEnPred = prediccion?.sesiones_analizadas ?? prediccion?.total_sesiones_unificado ?? 0
            const textoGuardado  = prediccion?.prediccion_30d || prediccion?.analisis_ia || ''
            const textoListo     = !!textoGuardado && !textoGuardado.includes('0 sesiones') && !textoGuardado.includes('0 programas')
            const desactualizado = !pollingTimedOut && stats.sessions > 0 && (sesionesEnPred < stats.sessions || !textoListo)
            const textoParaPadre = prediccion?.prediccion_30d ||
              (prediccion?.analisis_ia as string)?.split('\n\n')
                .find((b:string) => b.trim() && !/^\*\*[^*]+\*\*$/.test(b.trim()))
                ?.replace(/\*\*(.*?)\*\*/g, '$1').trim()

            return (
              <div className="hv-card" style={{ background:'var(--c-surface)', border:'1.5px solid var(--c-border)', borderRadius:22, padding:'18px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                  <div style={{ width:38, height:38, background:'linear-gradient(135deg,#0ea5e9,#0284c7)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Sparkles size={18} color="var(--c-card)"/>
                  </div>
                  <div>
                    <p style={{ color:'#0369a1', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, margin:0 }}>Resumen de ARIA</p>
                    <p style={{ color:'var(--c-text-primary)', fontSize:13, fontWeight:700, margin:0 }}>¿Cómo va {firstName}?</p>
                  </div>
                  {prediccion?.confianza > 0 && <span style={{ marginLeft:'auto', background:'var(--c-stat-blue)', color:'#0284c7', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, border:'1px solid var(--c-border)', flexShrink:0 }}>{prediccion.confianza}% confianza</span>}
                </div>
                <p style={{ color:'var(--c-text-primary)', fontSize:13, lineHeight:1.65, margin:0, fontStyle: desactualizado ? 'italic' : 'normal', opacity: desactualizado ? 0.7 : 1 }}>
                  {desactualizado ? `✨ Actualizando el resumen con las ${stats.sessions} sesiones...` : textoParaPadre || '✨ Preparando el resumen de progreso...'}
                </p>
                {prediccion?.areas_fortaleza?.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
                    {prediccion.areas_fortaleza.slice(0,3).map((a:string, i:number) => (
                      <span key={i} style={{ background:'rgba(5,150,105,.1)', color:'#065f46', fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, border:'1px solid rgba(5,150,105,.2)' }}>✦ {a}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* PRÓXIMA CITA */}
          <div className="hv-card" style={{ background:'var(--c-card)', borderRadius:22, border:'1.5px solid var(--c-border-light)', overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,.04)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 18px 12px', borderBottom:'1px solid var(--c-border-light)' }}>
              <CalendarDays size={15} color="#0284c7"/>
              <h2 style={{ fontWeight:800, fontSize:12, color:'var(--c-text-muted)', textTransform:'uppercase', letterSpacing:0.8, margin:0 }}>Próxima sesión</h2>
            </div>
            {loading ? (
              <div style={{ padding:'16px 18px' }}>
                <div style={{ height:56, background:'linear-gradient(90deg,#f8fafc,#f1f5f9,#f8fafc)', backgroundSize:'200%', borderRadius:14, animation:'shimmer 1.5s linear infinite' }}/>
              </div>
            ) : nextAppt ? (()=>{
              const d = formatDate(nextAppt.appointment_date)
              return (
                <div style={{ padding:'16px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ background:'linear-gradient(135deg,#0284c7,#0369a1)', color:'#ffffff', borderRadius:16, padding:'10px 14px', textAlign:'center', flexShrink:0, boxShadow:'0 6px 16px rgba(2,132,199,.28)' }}>
                      <div style={{ fontSize:26, fontWeight:900, lineHeight:1 }}>{d.day}</div>
                      <div style={{ fontSize:11, fontWeight:700, opacity:.8, marginTop:1, textTransform:'uppercase' }}>{d.month}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, marginBottom:5, ...(nextAppt.status==='confirmed' ? { background:'var(--c-stat-green)', color:'#16a34a', border:'1px solid var(--c-border)' } : { background:'var(--c-stat-amber)', color:'#d97706', border:'1px solid var(--c-border)' }) }}>
                        {nextAppt.status==='confirmed' ? <CheckCircle size={9}/> : <AlertCircle size={9}/>}
                        {nextAppt.status==='confirmed' ? 'Confirmada' : 'Pendiente de confirmar'}
                      </span>
                      <p style={{ fontWeight:800, fontSize:14, color:'var(--c-text-primary)', margin:'0 0 3px' }}>{nextAppt.service_type || 'Terapia ABA'}</p>
                      <p style={{ fontSize:12, color:'var(--c-text-muted)', margin:0, display:'flex', alignItems:'center', gap:4 }}><Clock size={11}/>{formatTime(nextAppt.appointment_time)}</p>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, marginTop:14, paddingTop:14, borderTop:'1px solid var(--c-border-light)' }}>
                    <button onClick={()=>onCancelAppointment(nextAppt.id,true)} className="hv-btn" style={{ flex:1, padding:'8px 10px', background:'var(--c-stat-purple)', color:'#0284c7', border:'1.5px solid var(--c-border)', borderRadius:12, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><RefreshCw size={12}/>Reprogramar</button>
                    <button onClick={()=>onCancelAppointment(nextAppt.id,false)} className="hv-btn" style={{ flex:1, padding:'8px 10px', background:'#fef2f2', color:'#dc2626', border:'1.5px solid #fecaca', borderRadius:12, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}><XCircle size={12}/>Cancelar</button>
                    <button onClick={()=>onChangeView('miscitas')} className="hv-btn" style={{ padding:'8px 12px', background:'var(--c-text-primary)', color:'#ffffff', border:'none', borderRadius:12, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>Ver todas<ChevronRight size={12}/></button>
                  </div>
                </div>
              )
            })() : (
              <div style={{ padding:'24px 18px', textAlign:'center' }}>
                <div style={{ width:56, height:56, background:'var(--c-stat-purple)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><CalendarDays size={24} color="#a78bfa"/></div>
                <p style={{ fontWeight:800, fontSize:14, color:'var(--c-text-primary)', margin:'0 0 6px' }}>Sin citas programadas</p>
                <p style={{ fontSize:12, color:'var(--c-text-placeholder)', lineHeight:1.6, margin:'0 auto 14px', maxWidth:260 }}>La constancia es clave. Contacta al centro para agendar la próxima cita.</p>
                <button onClick={()=>onChangeView('miscitas')} className="hv-btn" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'linear-gradient(135deg,#0284c7,#0369a1)', color:'#ffffff', border:'none', padding:'9px 18px', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 14px rgba(2,132,199,.3)' }}><CalendarDays size={14}/>Ver mis citas</button>
              </div>
            )}
          </div>

          {/* MENSAJES DEL TERAPEUTA */}
          {parentMessages.length > 0 && (
            <div className="hv-card" style={{ background:'var(--c-card)', borderRadius:22, border:'1.5px solid #ede9fe', overflow:'hidden', boxShadow:'0 2px 16px rgba(2,132,199,.06)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:'1px solid var(--c-border-light)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}><MessageCircle size={15} color="#0284c7"/><h2 style={{ fontWeight:800, fontSize:12, color:'var(--c-text-muted)', textTransform:'uppercase', letterSpacing:0.8, margin:0 }}>Mensajes del terapeuta</h2></div>
                <span style={{ background:'var(--c-stat-purple)', color:'#0284c7', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, border:'1px solid var(--c-border)' }}>{parentMessages.length} nuevo{parentMessages.length!==1?'s':''}</span>
              </div>
              {parentMessages.map((msg:any, idx:number) => (
                <div key={idx} style={{ padding:'12px 18px', borderBottom: idx < parentMessages.length-1 ? '1px solid #faf5ff' : 'none' }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--c-text-placeholder)', margin:'0 0 2px' }}>{msg.created_at ? new Date(msg.created_at).toLocaleDateString(toBCP47(locale),{dateStyle:'medium'}) : ''}</p>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--c-text-primary)', margin:'0 0 3px' }}>{msg.title || msg.subject || 'Mensaje del terapeuta'}</p>
                  <p style={{ fontSize:12, color:'var(--c-text-muted)', lineHeight:1.5, margin:0, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{msg.body || msg.message || msg.content || ''}</p>
                </div>
              ))}
              <div style={{ padding:'10px 14px' }}>
                <button onClick={()=>onChangeView('mensajes')} className="hv-btn" style={{ width:'100%', padding:'9px', background:'var(--c-stat-purple)', color:'#0284c7', border:'1.5px solid var(--c-border)', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}><MessageCircle size={13}/>Ver todos los mensajes</button>
              </div>
            </div>
          )}

        </div>{/* fin col izquierda */}

        {/* COLUMNA DERECHA */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* ¿EN QUÉ ESTÁ TRABAJANDO? */}
          {programas.length > 0 && (
            <div className="hv-card" style={{ background:'var(--c-card)', borderRadius:22, border:'1.5px solid var(--c-border-light)', overflow:'hidden', boxShadow:'0 2px 16px rgba(0,0,0,.04)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px 12px', borderBottom:'1px solid var(--c-border-light)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Target size={15} color="#0284c7"/>
                  <h2 style={{ fontWeight:700, fontSize:13, color:'var(--c-text-primary)', margin:0 }}>¿En qué está trabajando?</h2>
                </div>
                <span style={{ background:'var(--c-stat-blue)', color:'#0284c7', fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:20, border:'1px solid var(--c-border)' }}>{programas.length} activos</span>
              </div>
              <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                {programas.map((prog:any, i:number) => {
                  const ac = AREA_ICON[(prog.area||'').toLowerCase()] || AREA_ICON.default
                  const AIcon = ac.Icon
                  return (
                    <button
                      key={prog.id||i}
                      onClick={() => onChangeView('programas')}
                      title="Ver detalles del programa"
                      style={{
                        display:'flex', alignItems:'center', gap:12,
                        padding:'10px 12px',
                        background:'var(--c-surface)', borderRadius:14,
                        border:'1px solid var(--c-border-light)',
                        cursor:'pointer', textAlign:'left',
                        width:'100%', fontFamily:'inherit',
                        transition:'transform .12s, border-color .12s, background .12s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.borderColor = 'var(--c-accent, #0284c7)'
                        el.style.transform = 'translateY(-1px)'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLButtonElement
                        el.style.borderColor = 'var(--c-border-light)'
                        el.style.transform = 'translateY(0)'
                      }}
                    >
                      <div style={{ width:36, height:36, background:`${ac.color}18`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color: ac.color }}><AIcon size={18}/></div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:700, fontSize:13, color:'var(--c-text-primary)', margin:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{prog.nombre || prog.titulo || 'Programa'}</p>
                        {prog.area && <p style={{ fontSize:11, color:'var(--c-text-placeholder)', margin:'1px 0 0', textTransform:'capitalize' }}>{prog.area}</p>}
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:10, flexShrink:0, ...(prog.estado==='activo'?{background:'var(--c-stat-green)',color:'#16a34a'}:prog.estado==='completado'?{background:'var(--c-stat-purple)',color:'#0284c7'}:{background:'var(--c-stat-amber)',color:'#d97706'}) }}>{prog.estado||'activo'}</span>
                      <ChevronRight size={14} color="var(--c-text-placeholder)" style={{ flexShrink: 0 }}/>
                    </button>
                  )
                })}
              </div>
              <div style={{ padding:'10px 14px', paddingTop:4 }}>
                <button onClick={()=>onChangeView('chat')} className="hv-btn" style={{ width:'100%', padding:'9px', background:'var(--c-stat-blue)', color:'#0284c7', border:'1.5px solid var(--c-border)', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Sparkles size={13}/>Pregúntale a ARIA cómo practicarlos
                </button>
              </div>
            </div>
          )}

          {/* PROGRESO GENERAL */}
          <div className="hv-card" style={{ background:'var(--c-card)', borderRadius:22, border:'1.5px solid var(--c-border-light)', padding:'16px 18px', boxShadow:'0 2px 16px rgba(0,0,0,.04)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}><TrendingUp size={15} color="#0284c7"/><h3 style={{ fontWeight:800, fontSize:12, color:'var(--c-text-muted)', textTransform:'uppercase', letterSpacing:0.8, margin:0 }}>Progreso general</h3></div>
              {stats.goalsAchieved > 0 && <button onClick={()=>setShowCelebration(true)} className="hv-btn" style={{ display:'flex', alignItems:'center', gap:5, background:'var(--c-stat-amber)', color:'#d97706', border:'1.5px solid var(--c-border)', borderRadius:20, fontSize:10, fontWeight:700, padding:'4px 10px', cursor:'pointer' }}><Trophy size={11}/>Ver logro 🎉</button>}
            </div>

            {stats.sessions === 0 ? (
              <div style={{ textAlign:'center', padding:'16px 0' }}>
                <div style={{ width:52, height:52, background:'linear-gradient(135deg,#f8fafc,#f5f3ff)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}><BarChart3 size={24} color="#7dd3fc"/></div>
                <p style={{ fontWeight:700, fontSize:13, color:'var(--c-text-muted)', margin:'0 0 4px' }}>El progreso aparecerá aquí</p>
                <p style={{ fontSize:11, color:'var(--c-text-placeholder)', lineHeight:1.6, maxWidth:240, margin:'0 auto' }}>Después de las primeras sesiones verás los avances y objetivos logrados.</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { label:'Dominio de objetivos', value:stats.masteryRate, color:'#059669', track:'#dcfce7' },
                  { label:'Asistencia este mes',  value:Math.min(100,stats.monthSessions*25), color:'#0284c7', track:'var(--c-border)' },
                  { label:'Horas de terapia',     value:Math.min(100,Math.round(stats.hoursTotal/20*100)), color:'#0284c7', track:'#ede9fe' },
                ].map(({ label, value, color, track }) => (
                  <div key={label}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'var(--c-text-muted)' }}>{label}</span>
                      <span style={{ fontSize:12, fontWeight:800, color:'var(--c-text-primary)' }}>{value}%</span>
                    </div>
                    <div style={{ height:8, background:track, borderRadius:20, overflow:'hidden' }}>
                      <div className="hv-prog-bar" style={{ height:'100%', width:`${value}%`, background:color, borderRadius:20 }}/>
                    </div>
                  </div>
                ))}

                {stats.masteryRate >= 80 && (
                  <div style={{ background:'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'1.5px solid var(--c-border)', borderRadius:16, padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:10, marginTop:2 }}>
                    <PartyPopper size={18} color="#16a34a" style={{ flexShrink:0, marginTop:1 }}/>
                    <div>
                      <p style={{ fontWeight:800, fontSize:12, color:'#15803d', margin:'0 0 2px' }}>¡Rendimiento excepcional! 🎉</p>
                      <p style={{ fontSize:11, color:'#16a34a', lineHeight:1.5, margin:0 }}>{firstName} domina sus objetivos con {stats.masteryRate}% de éxito.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>{/* fin col derecha */}
      </div>
    </div>
  )
}
