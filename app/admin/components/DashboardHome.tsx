'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
import { useState, useEffect, useCallback } from 'react'
import {
  Activity, Brain, Calendar, ChevronRight, Clock,
  FileText, Users, AlertTriangle, Sparkles,
  Bell, ArrowUpRight, MessageCircle, TrendingUp,
  CheckCircle2, AlertCircle, Zap, BarChart3,
  ClipboardList, Target, X, Trophy, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex items-end gap-1 h-10">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-sm transition-all"
            style={{ height: `${Math.max(2, (v / max) * 36)}px`, background: i === values.length - 1 ? color : `${color}55` }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Donut ────────────────────────────────────────────────────────────────────
function Donut({ value, total, color, size = 56 }: any) {
  const pct = total > 0 ? value / total : 0
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--muted-bg)" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-primary)" fontSize={size * 0.18} fontWeight="bold">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, bar, urgent, onClick }: any) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl p-5 relative overflow-hidden transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      style={{ background: 'var(--card)', border: urgent ? `1px solid ${bar}55` : '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      {/* glow sutil del color en la esquina (en vez de barra lateral genérica) */}
      <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{ background: bar, opacity: 0.08, filter: 'blur(8px)' }} />
      <div className="flex items-start justify-between mb-3 relative">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${bar}16` }}>
          <Icon size={16} style={{ color: bar }} />
        </div>
      </div>
      <p className="text-4xl font-bold leading-none mb-1 tabular-nums relative tracking-tight" style={{ color: urgent ? bar : 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs relative" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}

// ─── Alerta row ───────────────────────────────────────────────────────────────
function AlertaRow({ tipo, paciente, mensaje, prioridad, onClick, onDismiss }: any) {
  // Detecta alertas positivas (logros) por prefijo del tipo
  const tipoStr = String(tipo || '')
  const esLogro = tipoStr.startsWith('logro_') || tipoStr === 'criterio_alcanzado'

  // Normaliza prioridad — acepta números (1,2,3) y strings ('alta','media','baja')
  const prioridadNum = (() => {
    if (typeof prioridad === 'number') return prioridad
    const p = String(prioridad || '').toLowerCase()
    if (p === 'alta' || p === 'high' || p === 'urgent') return 1
    if (p === 'media' || p === 'medium') return 2
    if (p === 'baja' || p === 'low' || p === 'info') return 3
    return 2
  })()

  // Color de la barra: verde para logros, rojo/ámbar/azul para alertas negativas
  const bar = esLogro
    ? '#10b981'
    : prioridadNum === 1 ? '#ef4444' : prioridadNum === 2 ? '#f59e0b' : '#6366f1'

  // Etiqueta legible del tipo
  const tipoLabel = (() => {
    if (tipoStr.startsWith('logro_dominio')) return 'criterio alcanzado'
    if (tipoStr.startsWith('logro_cerca_dominio')) return 'falta 1 sesión'
    if (tipoStr.startsWith('logro_progreso')) return 'progreso consistente'
    if (tipoStr.startsWith('logro_criterio')) return 'criterio dominado'
    if (tipoStr === 'criterio_alcanzado') return 'criterio dominado'
    return tipoStr.replace(/_[0-9a-f-]{8,}$/i, '').replace(/_/g, ' ')
  })()

  return (
    <div
      className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all"
      style={{
        background: esLogro ? 'rgba(16,185,129,0.06)' : 'var(--muted-bg)',
        border: '1px solid var(--card-border)',
      }}>
      {esLogro ? (
        <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.15)' }}>
          <Trophy size={14} style={{ color: '#10b981' }} />
        </div>
      ) : (
        <div className="flex-shrink-0 w-2 h-2 rounded-full" style={{ background: bar }} />
      )}
      <button onClick={onClick} className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity">
        {tipo && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider"
              style={{ color: esLogro ? '#10b981' : 'var(--text-muted)' }}>
              {tipoLabel}
            </span>
          </div>
        )}
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{paciente || mensaje}</p>
        {paciente && mensaje && <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{mensaje}</p>}
      </button>
      <div className="flex items-center gap-1 flex-shrink-0">
        <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} onClick={onClick} className="cursor-pointer hover:opacity-70 transition-opacity" />
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss?.() }}
          title="Descartar alerta"
          className="flex items-center justify-center w-5 h-5 rounded-full hover:opacity-80 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.08)' }}>
          <X size={10} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  )
}

// ─── Cita row ─────────────────────────────────────────────────────────────────
function CitaRow({ cita }: any) {
  const fecha = new Date((cita.fecha || cita.appointment_date) + 'T00:00:00')
  const hoy = new Date().toISOString().split('T')[0]
  const esHoy = (cita.fecha || cita.appointment_date) === hoy
  const mes = fecha.toLocaleString('es', { month: 'short' }).toUpperCase()
  const dia = fecha.getDate()
  const nombre = cita.children?.name || cita.paciente || 'Paciente'
  const hora = cita.hora_inicio || cita.appointment_time
  const servicio = cita.service_type || cita.tipo || ''
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg transition-all"
      style={{ background: esHoy ? 'rgba(99,102,241,0.06)' : 'transparent', border: esHoy ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent' }}>
      <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: esHoy ? '#6366f1' : 'var(--muted-bg)', color: esHoy ? '#fff' : 'var(--text-secondary)' }}>
        <span className="text-[8px] font-bold leading-none">{mes}</span>
        <span className="text-sm font-bold leading-none">{dia}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{nombre}</p>
        <p className="text-[11px] flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          {hora && <><Clock size={9} /> {hora.slice(0, 5)}</>}
          {servicio && <span className="truncate"> · {servicio}</span>}
          {esHoy && <span className="font-bold flex-shrink-0" style={{ color: '#6366f1' }}> · Hoy</span>}
        </p>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function DashboardHome({ navigateTo, navigateToPatient }: { navigateTo: (view: string) => void; navigateToPatient?: (childId: string, tab?: string) => void }) {
  const { t, locale } = useI18n()

  // State
  const [metricas, setMetricas] = useState<any>(null)
  const [proximasCitas, setProximasCitas] = useState<any[]>([])
  const [alertasClinicas, setAlertasClinicas] = useState<any[]>([])
  const [actividadReciente, setActividadReciente] = useState<any[]>([])
  const [programasActivos, setProgramasActivos] = useState<any[]>([])
  const [totalProgramasAba, setTotalProgramasAba] = useState<number>(0)
  const [sesSemanales, setSesSemanales] = useState<number[]>([0,0,0,0,0,0,0])
  const [diasLabels, setDiasLabels] = useState<string[]>(['L','M','M','J','V','S','D'])
  const [sinSesion, setSinSesion] = useState<any[]>([])
  const [sesHoyCount, setSesHoyCount] = useState(0)
  const [horaActual, setHoraActual] = useState<Date | null>(null)
  const [diaStr, setDiaStr] = useState('')
  const [saludo, setSaludo] = useState('')
  const [loading, setLoading] = useState(true)

  // Clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setHoraActual(now)
      setSaludo(now.getHours() < 12 ? 'Buenos días' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches')
      setDiaStr(now.toLocaleDateString(toBCP47(locale), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    }
    update()
    const iv = setInterval(update, 1000)
    return () => clearInterval(iv)
  }, [locale])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // 0. Refrescar alertas para TODOS los pacientes (logros + alertas negativas).
      //    Esto detecta nuevos logros automáticamente y resuelve alertas que ya no aplican.
      //    No bloquea el render si falla.
      try {
        const refRes = await fetch('/api/agente/refrescar-alertas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          cache: 'no-store',
        })
        await refRes.json().catch(() => null)
      } catch {
        /* silencioso — no bloquea el render */
      }

      // 1. API de métricas (usa agenda_sesiones, agente_alertas, etc.)
      const resM = await fetch('/api/dashboard/metricas?periodo=7d', { cache: 'no-store' })
      const dataM = resM.ok ? await resM.json() : null
      setMetricas(dataM)

      // Próximas citas — fechas de hoy en adelante, no canceladas ni completadas.
      // No filtramos por hora del día: si una cita de hoy es de las 3pm y son las 5pm,
      // sigue siendo "del día de hoy" mientras no esté en estado terminal.
      const hoyStr = new Date().toISOString().split('T')[0]
      const estadosTerminados = ['cancelled', 'cancelada', 'completed', 'completada', 'done', 'realizada']
      const { data: citasDirectas } = await supabase
        .from('appointments')
        .select('*, children(name)')
        .gte('appointment_date', hoyStr)
        .not('status', 'in', `(${estadosTerminados.join(',')})`)
        .order('appointment_date').order('appointment_time')
        .limit(6)

      if (citasDirectas && citasDirectas.length > 0) {
        setProximasCitas(citasDirectas)
      } else if (dataM?.proximasSesiones?.length > 0) {
        // Fallback: agenda_sesiones via API métricas
        setProximasCitas(dataM.proximasSesiones)
      } else {
        setProximasCitas([])
      }

      // Sesiones hoy desde appointments
      const { data: aptsHoy } = await supabase
        .from('appointments')
        .select('id')
        .eq('appointment_date', hoyStr)
        .neq('status', 'cancelled')
      setSesHoyCount(aptsHoy?.length ?? dataM?.hoy?.sesiones?.total ?? 0)

      // (alertas se construyen al final junto con sin_sesion)

      // 2. Sesiones por día — usa appointments (misma fuente que el calendario)
      const labels: string[] = []
      const datesArr: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        labels.push(d.toLocaleDateString('es', { weekday: 'short' }).charAt(0).toUpperCase())
        datesArr.push(d.toISOString().split('T')[0])
      }
      setDiasLabels(labels)

      // Fuente primaria: appointments (misma tabla que el CalendarView)
      const { data: aptsSemanales } = await supabase
        .from('appointments')
        .select('appointment_date, status')
        .gte('appointment_date', datesArr[0])
        .lte('appointment_date', datesArr[6])
        .neq('status', 'cancelled')

      if (aptsSemanales && aptsSemanales.length > 0) {
        const map: Record<string, number> = {}
        datesArr.forEach(d => { map[d] = 0 })
        aptsSemanales.forEach((a: any) => { if (map[a.appointment_date] !== undefined) map[a.appointment_date]++ })
        setSesSemanales(Object.values(map))
      } else if (dataM?.graficas?.sesionesXFecha?.length > 0) {
        // Fallback: API métricas (agenda_sesiones)
        const map: Record<string, number> = {}
        datesArr.forEach(d => { map[d] = 0 })
        dataM.graficas.sesionesXFecha.forEach((s: any) => { if (map[s.fecha] !== undefined) map[s.fecha] = s.total })
        setSesSemanales(Object.values(map))
      } else {
        // Último fallback: registro_aba
        const { data: sesABA } = await supabase
          .from('registro_aba')
          .select('fecha_sesion')
          .gte('fecha_sesion', datesArr[0])
        const map: Record<string, number> = {}
        datesArr.forEach(d => { map[d] = 0 })
        ;(sesABA || []).forEach((s: any) => { if (map[s.fecha_sesion] !== undefined) map[s.fecha_sesion]++ })
        setSesSemanales(Object.values(map))
      }

      // 3. Children map — usa /api/admin/children (supabaseAdmin, bypassa RLS)
      // FIX: No usar supabase browser client aquí porque la RLS de children filtra
      // solo los pacientes del usuario autenticado, ocultando pacientes de otros especialistas.
      const childrenResp = await fetch('/api/admin/children')
      const childrenData = childrenResp.ok ? await childrenResp.json() : { data: [] }
      const todosNinos: any[] = childrenData.data || []
      const ninosMap: Record<string, string> = {}
      todosNinos.forEach((n: any) => { ninosMap[n.id] = n.name })

      // Programas ABA activos con último porcentaje
      const { data: progData } = await supabase
        .from('programas_aba')
        .select('id, titulo, child_id, estado, criterio_dominio_pct, fase_actual, sesiones_datos_aba(porcentaje_exito, fecha)')
        .eq('estado', 'activo')
        .order('updated_at', { ascending: false })

      // Contar total de programas ABA activos
      const { count: countProgramas } = await supabase
        .from('programas_aba')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'activo')
      setTotalProgramasAba(countProgramas || 0)

      if (progData && progData.length > 0) {
        const enriquecidos = progData.map((p: any) => {
          const seses = (p.sesiones_datos_aba || []).sort((a: any, b: any) => b.fecha?.localeCompare(a.fecha || '') || 0)
          const ultimoPct = seses[0]?.porcentaje_exito ?? null
          const nombre = ninosMap[p.child_id] || 'Paciente'
          return { id: p.id, child_id: p.child_id, titulo: p.titulo, nombre, ultimoPct, criterio: p.criterio_dominio_pct || 90, fase: p.fase_actual }
        })
        setProgramasActivos(enriquecidos)
      }

      // Actividad reciente — agenda_sesiones realizadas (primary) + registro_aba (fallback)
      const { data: sesAgenda } = await supabase
        .from('agenda_sesiones')
        .select('id, child_id, fecha, hora_inicio, estado, tipo, children(name)')
        .in('estado', ['realizada', 'completada', 'confirmada'])
        .order('fecha', { ascending: false })
        .limit(8)

      let actividadFinal: any[] = []
      if (sesAgenda && sesAgenda.length > 0) {
        actividadFinal = sesAgenda.map((s: any) => ({
          nombrePaciente: s.children?.name || ninosMap[s.child_id] || 'Paciente',
          objetivo: s.tipo || 'Sesión terapéutica',
          fecha_sesion: s.fecha,
        }))
      } else {
        // Fallback: registro_aba
        const { data: sesABA } = await supabase
          .from('registro_aba')
          .select('child_id, fecha_sesion, datos')
          .order('fecha_sesion', { ascending: false })
          .limit(8)
        actividadFinal = (sesABA || []).map((s: any) => ({
          nombrePaciente: ninosMap[s.child_id] || 'Paciente',
          objetivo: s.datos?.objetivo_principal || s.datos?.objetivo || 'Sesión ABA',
          fecha_sesion: s.fecha_sesion,
        }))
      }
      setActividadReciente(actividadFinal)

      // 4. Pacientes sin sesión — viene del API de métricas (supabaseAdmin, bypassa RLS)
      // FIX: antes se consultaban agenda_sesiones, registro_aba, etc. con el cliente browser
      // (sujeto a RLS), mostrando solo pacientes del usuario. Ahora viene del servidor.
      const pacientesSinSesion: any[] = dataM?.pacientesSinSesion || []
      setSinSesion(pacientesSinSesion)

      // ── Alertas: consolidar en UNA sola asignación ──────────────────────────────
      const dismissed: string[] = JSON.parse(localStorage.getItem('alertas_descartadas') || '[]')

      // Alertas de agente_alertas (regresiones, etc.) — filtrar ids descartadas en BD (ya vienen con resuelta=false)
      const alertasRawTodas = (dataM?.alertas?.recientes || [])
        .filter((a: any) => !dismissed.includes((a.tipo || '') + ':' + a.child_id))

      // Consolidar SIN SESIÓN duplicadas por paciente — mostramos solo la más urgente por niño.
      // Si Sophia tiene 4 programas sin sesión, vemos 1 sola entrada que dice "4 programas".
      const sinSesionPorNino = new Map<string, any[]>()
      const otrasAlertas: any[] = []
      for (const a of alertasRawTodas) {
        const t = String(a.tipo || '')
        const esSinSesion = t === 'sin_sesion' || t.startsWith('sin_sesion_')
        if (esSinSesion && a.child_id) {
          if (!sinSesionPorNino.has(a.child_id)) sinSesionPorNino.set(a.child_id, [])
          sinSesionPorNino.get(a.child_id)!.push(a)
        } else {
          otrasAlertas.push(a)
        }
      }
      const sinSesionConsolidadas = Array.from(sinSesionPorNino.values()).map((grupo: any[]) => {
        // Tomar la alerta de mayor prioridad como representante
        const rep = grupo.sort((x, y) => {
          const px = String(x.prioridad || '').toLowerCase()
          const py = String(y.prioridad || '').toLowerCase()
          const rank: Record<string, number> = { alta: 1, media: 2, baja: 3 }
          return (rank[px] || 2) - (rank[py] || 2)
        })[0]
        const mensaje = grupo.length > 1
          ? `${grupo.length} programas sin sesiones recientes. ${rep.descripcion || rep.mensaje || ''}`
          : (rep.descripcion || rep.mensaje || '')
        return { ...rep, descripcion: mensaje, mensaje, _grupo: grupo.length }
      })

      const alertasApi = [...otrasAlertas, ...sinSesionConsolidadas].map((a: any) => ({
        id: a.id,
        tipo: a.tipo,
        child_id: a.child_id,
        paciente: a.children?.name || 'Paciente',
        mensaje: a.descripcion || a.mensaje || '',
        prioridad: a.prioridad || 2,
      }))

      // Alertas sin_sesion — evitar duplicar pacientes ya en alertasApi
      const idsEnApi = new Set(alertasApi.map((a: any) => a.child_id))
      const alertasSinSesion = pacientesSinSesion
        .filter((n: any) => {
          const key = 'sin_sesion:' + n.id
          return !dismissed.includes(key) && !idsEnApi.has(n.id)
        })
        .map((n: any) => ({
          tipo: 'sin_sesion', child_id: n.id, paciente: n.name,
          mensaje: 'Sin sesión en los últimos 30 días.', prioridad: 2,
        }))

      // Ordenar: alertas negativas (prioridad 1, 2) primero, logros (prioridad 3) al final
      const todasAlertas = [...alertasApi, ...alertasSinSesion]
      const esLogro = (a: any) => {
        const t = String(a.tipo || '')
        return t.startsWith('logro_') || t === 'criterio_alcanzado'
      }
      const prioridadNum = (p: any): number => {
        if (typeof p === 'number') return p
        const s = String(p || '').toLowerCase()
        if (s === 'alta' || s === 'high' || s === 'urgent') return 1
        if (s === 'media' || s === 'medium') return 2
        if (s === 'baja' || s === 'low' || s === 'info') return 3
        return 2
      }
      todasAlertas.sort((a, b) => {
        const aLogro = esLogro(a) ? 1 : 0
        const bLogro = esLogro(b) ? 1 : 0
        if (aLogro !== bLogro) return aLogro - bLogro
        return prioridadNum(a.prioridad) - prioridadNum(b.prioridad)
      })
      setAlertasClinicas(todasAlertas)

    } catch (e) {
      console.error('Dashboard error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Refrescar al volver al tab — captura cambios hechos en otra ventana/dispositivo
  useEffect(() => {
    const onFocus = () => { cargar() }
    const onVisibility = () => { if (document.visibilityState === 'visible') cargar() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [cargar])

  // Derived stats
  const totalSesHoy = sesHoyCount || metricas?.hoy?.sesiones?.total || 0
  const realizadasHoy = metricas?.hoy?.sesiones?.realizadas ?? 0
  const totalPacientes = metricas?.pacientes?.total ?? 0
  const alertasUrgentes = metricas?.alertas?.urgentes ?? 0

  const dismissAlerta = useCallback(async (index: number) => {
    const alerta = alertasClinicas[index]
    setAlertasClinicas(prev => prev.filter((_, i) => i !== index))
    if (alerta?.id) {
      // Alerta de agente_alertas: marcar como resuelta en BD (persiste)
      await supabase.from('agente_alertas').update({ resuelta: true }).eq('id', alerta.id)
    } else if (alerta?.tipo && alerta?.child_id) {
      // Alerta sin ID (sin_sesion, etc.): guardar clave en localStorage
      const key = alerta.tipo + ':' + alerta.child_id
      const dismissed = JSON.parse(localStorage.getItem('alertas_descartadas') || '[]')
      if (!dismissed.includes(key)) {
        dismissed.push(key)
        localStorage.setItem('alertas_descartadas', JSON.stringify(dismissed))
      }
    }
  }, [alertasClinicas])
  const mensajesPendientes = metricas?.tareas?.formPendientes ?? 0
  const tasaAsistencia = metricas?.hoy?.tasaAsistencia ?? 0
  const totalSes7d = sesSemanales.reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">

      {/* ── HERO ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)' }} />
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs capitalize mb-0.5" style={{ color: 'var(--text-muted)' }}>{diaStr}</p>
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{saludo}, Directora 👋</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                {totalSesHoy} sesiones hoy
              </span>
              {sinSesion.length > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <AlertCircle size={10} className="inline mr-1" />{sinSesion.length} sin sesión (30d)
                </span>
              )}
              {alertasUrgentes > 0 && (
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                  {alertasUrgentes} alertas urgentes
                </span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-5xl font-bold tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {horaActual ? horaActual.toLocaleTimeString(toBCP47(locale), { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {horaActual?.getSeconds()}s
            </p>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KPI label="Pacientes" value={totalPacientes} sub="Total registrados" icon={Users} bar="#6366f1" onClick={() => navigateTo('ninos')} />
        <KPI label="Sesiones hoy" value={totalSesHoy} sub={`${realizadasHoy} realizadas`} icon={Calendar} bar="#10b981" onClick={() => navigateTo('agenda')} />
        <KPI label="Sin sesión 30d" value={sinSesion.length} sub="Requieren seguimiento" icon={AlertTriangle} bar="#f59e0b" urgent={sinSesion.length > 0} onClick={() => navigateTo('ninos')} />
        <KPI label="Programas ABA" value={totalProgramasAba} sub="Activos" icon={ClipboardList} bar="#8b5cf6" onClick={() => navigateTo('ninos')} />
      </div>

      {/* ── MÉTRICAS MEDIAS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">

        {/* Sesiones 7 días + Retención — combinados en fila */}
        <div className="rounded-2xl p-5 flex flex-col justify-between" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Sesiones — últimos 7 días</p>
            <span className="text-lg font-bold" style={{ color: '#6366f1' }}>{totalSes7d}</span>
          </div>
          <BarChart values={sesSemanales} labels={diasLabels} color="#6366f1" />
          <div className="mt-4 pt-4 border-t flex items-center gap-4" style={{ borderColor: 'var(--card-border)' }}>
            <Donut value={totalPacientes - sinSesion.length} total={totalPacientes} color="#10b981" size={56} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Retención activa</p>
              <p className="text-base font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                {totalPacientes - sinSesion.length}
                <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-muted)' }}>/ {totalPacientes}</span>
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>pacientes con sesión reciente</p>
            </div>
          </div>
        </div>

        {/* Programas ABA activos */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Programas ABA Activos</p>
            <button onClick={() => navigateTo('ninos')} className="text-[10px] font-semibold" style={{ color: '#6366f1' }}>Ver todos →</button>
          </div>
          {programasActivos.length > 0 ? (
            <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: '260px', scrollbarWidth: 'thin' }}>
              {programasActivos.map((p, i) => {
                const pct = p.ultimoPct ?? 0
                const color = pct >= p.criterio ? '#10b981' : pct >= 60 ? '#f59e0b' : '#6366f1'
                return (
                  <div
                    key={i}
                    className="cursor-pointer rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-black/5"
                    style={{ transition: 'background 0.15s' }}
                    onClick={() => {
                      if (p.child_id && navigateToPatient) {
                        navigateToPatient(p.child_id, 'programas')
                      } else {
                        navigateTo('ninos')
                      }
                    }}
                    title={`Ver programa de ${p.nombre}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{p.titulo}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{p.nombre}</p>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color }}>
                        {p.ultimoPct !== null ? `${p.ultimoPct}%` : '—'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center py-4">
              <Target size={20} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Sin programas activos</p>
              <button onClick={() => navigateTo('ninos')} className="text-xs font-bold mt-2" style={{ color: '#6366f1' }}>
                Crear programa →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PANEL INFERIOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Alertas clínicas */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-2">
              <Bell size={13} style={{ color: 'var(--text-muted)' }} />
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Alertas Clínicas</p>
            </div>
            {alertasClinicas.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                {alertasClinicas.length}
              </span>
            )}
          </div>
          <div className="p-3 space-y-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {alertasClinicas.length > 0
              ? alertasClinicas.map((a, i) => (
                  <AlertaRow key={i} {...a}
                    onClick={() => {
                      if (a.child_id && navigateToPatient) {
                        const tab = (a.tipo === 'regresion' || a.tipo?.startsWith('regresion')) ? 'programas' : undefined
                        navigateToPatient(a.child_id, tab)
                      } else navigateTo('ninos')
                    }}
                    onDismiss={() => dismissAlerta(i)}
                  />
                ))
              : (
                <div className="flex flex-col items-center py-10">
                  <CheckCircle2 size={24} style={{ color: '#10b981', opacity: 0.5 }} />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Sin alertas activas</p>
                </div>
              )
            }
          </div>
        </div>

        {/* Próximas citas */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-2">
              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
              <p className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Próximas Citas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => cargar()}
                disabled={loading}
                title="Refrescar datos"
                className="p-1 rounded-md hover:bg-[var(--muted-bg)] transition-colors disabled:opacity-40"
              >
                <RefreshCw size={11} style={{ color: 'var(--text-muted)' }} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={() => navigateTo('agenda')}
                className="text-[10px] font-semibold flex items-center gap-1"
                style={{ color: '#6366f1' }}>
                Ver agenda <ArrowUpRight size={10} />
              </button>
            </div>
          </div>
          <div className="p-3 overflow-y-auto" style={{ maxHeight: '320px' }}>
            {proximasCitas.length > 0
              ? proximasCitas.map((c, i) => <CitaRow key={i} cita={c} />)
              : (
                <div className="flex flex-col items-center py-12">
                  <Calendar size={24} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Sin citas agendadas</p>
                  <button onClick={() => navigateTo('agenda')} className="mt-3 text-xs font-bold" style={{ color: '#6366f1' }}>
                    Agendar ahora →
                  </button>
                </div>
              )
            }
          </div>
        </div>
      </div>



    </div>
  )
}
