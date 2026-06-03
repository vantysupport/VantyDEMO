'use client'
// app/padre/components/ProgramasABAView.tsx
// Vista para que los padres vean y practiquen los programas ABA en casa

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ChevronDown, ChevronUp, CheckCircle, Circle,
  BookOpen, Target, Clock, TrendingUp, Loader2,
  Star, Award, Calendar, BarChart2, Info,
  MessageCircle, Zap, Brain, Users, Activity, Languages, Pin, Lightbulb, Gift
} from 'lucide-react'

interface Programa {
  id: string
  titulo: string
  descripcion: string
  area: string
  fase_actual: string
  instrucciones_casa: string
  materiales: string
  sd_estimulo: string
  reforzadores: string
  ayudas: string
  criterio_dominio_pct: number
  estado: string
  objetivos_cp: {
    id: string
    nombre?: string
    descripcion?: string
    estado: string
    numero_set: number
    materiales?: string
    sd_estimulo?: string
    unidad_positiva?: string
    unidad_negativa?: string
    reforzadores?: string         // En la UI del admin se llama "Ayudas"
    correction_errores?: string
    generalizacion?: string
  }[]
  sesiones_datos_aba: { fecha: string; porcentaje_exito: number }[]
}

interface Props { childId: string; childName: string }

const AREA_CFG: Record<string, { color: string; bg: string; Icon: any }> = {
  'comunicacion':   { color: '#0284c7', bg: 'rgba(2,132,199,0.1)',    Icon: MessageCircle },
  'conducta':       { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   Icon: Zap },
  'habilidades':    { color: '#0891b2', bg: 'rgba(8,145,178,0.1)',    Icon: Brain },
  'socializacion':  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',   Icon: Users },
  'autonomia':      { color: '#db2777', bg: 'rgba(219,39,119,0.1)',   Icon: Star },
  'imitacion':      { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    Icon: Activity },
  'lenguaje':       { color: '#0284c7', bg: 'rgba(2,132,199,0.1)',    Icon: Languages },
}
const AREA_DEFAULT = { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', Icon: Pin }

const FASE_CFG: Record<string, { label: string; color: string }> = {
  'linea_base':   { label: 'Línea base',    color: '#64748b' },
  'intervencion': { label: 'Intervención',  color: '#0284c7' },
  'mantenimiento':{ label: 'Mantenimiento', color: '#10b981' },
  'dominado':     { label: 'Dominado ✓',    color: '#059669' },
}

function WeekTracker({ programaId, childId, objetivos }: { programaId: string; childId: string; objetivos?: { id: string; numero_set: number; descripcion?: string; nombre?: string }[] }) {
  const [practiced, setPracticed] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [showSetPicker, setShowSetPicker] = useState<string | null>(null) // fecha seleccionada para elegir set

  const DAYS = ['L','M','X','J','V','S','D']
  const today = new Date()
  const dow = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('programa_practica_casa')
        .select('fecha')
        .eq('programa_id', programaId)
        .eq('child_id', childId)
        .in('fecha', weekDates)
      if (data) setPracticed(new Set(data.map((r: any) => r.fecha)))
    }
    load()
  }, [programaId, childId])

  const toggle = async (fecha: string, objetivoId?: string) => {
    if (fecha > today.toISOString().split('T')[0]) return
    setSaving(true)
    setShowSetPicker(null)
    if (practiced.has(fecha)) {
      await supabase.from('programa_practica_casa').delete()
        .eq('programa_id', programaId).eq('child_id', childId).eq('fecha', fecha)
      setPracticed(prev => { const s = new Set(prev); s.delete(fecha); return s })
    } else {
      const record: any = { programa_id: programaId, child_id: childId, fecha }
      if (objetivoId) record.objetivo_id = objetivoId
      await supabase.from('programa_practica_casa').upsert(record)
      setPracticed(prev => new Set([...prev, fecha]))
    }
    setSaving(false)
  }

  const todayStr = today.toISOString().split('T')[0]
  const hasObjetos = objetivos && objetivos.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>
        Práctica esta semana — {practiced.size}/7 días
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        {weekDates.map((date, i) => {
          const done = practiced.has(date)
          const isToday = date === todayStr
          const isPast = date <= todayStr
          return (
            <button
              key={date}
              onClick={() => {
                if (!isPast || saving) return
                if (done) { toggle(date); return }
                if (hasObjetos) setShowSetPicker(date)
                else toggle(date)
              }}
              disabled={saving}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '6px 4px', borderRadius: 10, border: 'none',
                cursor: isPast ? 'pointer' : 'default',
                background: done ? 'rgba(16,185,129,0.15)' : isToday ? 'rgba(2,132,199,0.1)' : 'var(--c-surface)',
                transition: 'all .15s', opacity: isPast ? 1 : 0.4
              }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: isToday ? '#0284c7' : 'var(--c-text-muted)' }}>{DAYS[i]}</span>
              {done
                ? <CheckCircle size={18} color="#10b981" />
                : <Circle size={18} color={isToday ? '#0284c7' : 'var(--c-border)'} />
              }
            </button>
          )
        })}
      </div>

      {/* Set picker popup */}
      {showSetPicker && hasObjetos && (
        <div style={{ background: 'var(--c-card)', border: '1.5px solid var(--c-border)', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            ¿Qué set practicaste?
          </p>
          {objetivos!.map(obj => (
            <button key={obj.id} onClick={() => toggle(showSetPicker, obj.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--c-surface)', borderRadius: 10, border: '1.5px solid var(--c-border)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(2,132,199,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#0284c7' }}>{obj.numero_set}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-primary)' }}>{obj.descripcion || obj.nombre || `Set ${obj.numero_set}`}</span>
            </button>
          ))}
          <button onClick={() => toggle(showSetPicker)}
            style={{ padding: '8px', borderRadius: 10, border: '1px dashed var(--c-border)', background: 'transparent', color: 'var(--c-text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Marcar sin especificar set
          </button>
          <button onClick={() => setShowSetPicker(null)}
            style={{ padding: '6px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--c-text-muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}

function ProgramCard({ prog, childId }: { prog: Programa; childId: string }) {
  const [open, setOpen] = useState(false)
  const [expandedObj, setExpandedObj] = useState<string | null>(null)
  const area = AREA_CFG[prog.area?.toLowerCase()] || AREA_DEFAULT
  const fase = FASE_CFG[prog.fase_actual] || FASE_CFG.intervencion
  const isDone = prog.fase_actual === 'dominado' || prog.estado === 'dominado'

  // Last 3 sessions avg
  const lastSessions = (prog.sesiones_datos_aba || []).slice(0, 3)
  const avgPct = lastSessions.length > 0
    ? Math.round(lastSessions.reduce((s, r) => s + (r.porcentaje_exito || 0), 0) / lastSessions.length)
    : null

  return (
    <div style={{
      background: 'var(--c-card)', borderRadius: 20, overflow: 'hidden',
      border: `1px solid ${isDone ? 'rgba(16,185,129,0.3)' : 'var(--c-border)'}`,
      opacity: isDone ? 0.8 : 1
    }}>
      {/* Left accent */}
      <div style={{ height: 3, background: isDone ? '#10b981' : `linear-gradient(90deg, ${area.color}, ${area.color}88)` }} />

      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: area.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: area.color }}>
          {(() => { const AIcon = area.Icon; return <AIcon size={22} /> })()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--c-text-primary)', margin: 0, lineHeight: 1.3 }}>{prog.titulo}</p>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: area.bg, color: area.color }}>{prog.area}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: fase.color }}>{fase.label}</span>
            {avgPct !== null && (
              <span style={{ fontSize: 10, color: 'var(--c-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <BarChart2 size={10} /> {avgPct}% últimas sesiones
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {open ? <ChevronUp size={16} color="var(--c-text-muted)" /> : <ChevronDown size={16} color="var(--c-text-muted)" />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--c-border)' }}>
          {prog.descripcion && (
            <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.6, margin: '14px 0 12px' }}>{prog.descripcion}</p>
          )}

          {/* Instrucciones generales del programa (no del set) — solo si existen */}
          {(prog.instrucciones_casa || prog.reforzadores) && (
            <div style={{ background: 'var(--c-stat-blue)', border: '1px solid var(--c-border)', borderRadius: 14, padding: '12px 14px', marginTop: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: '#0284c7', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={13} /> Indicaciones generales del programa
              </p>
              {prog.instrucciones_casa && (
                <div style={{ marginBottom: prog.reforzadores ? 8 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Info size={12} /> Instrucciones</span>
                  <p style={{ fontSize: 12, color: 'var(--c-text-primary)', margin: '4px 0 0', lineHeight: 1.6 }}>{prog.instrucciones_casa}</p>
                </div>
              )}
              {prog.reforzadores && (
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Gift size={12} /> Reforzadores</span>
                  <p style={{ fontSize: 12, color: 'var(--c-text-primary)', margin: '4px 0 0', lineHeight: 1.6 }}>{prog.reforzadores}</p>
                </div>
              )}
            </div>
          )}

          {/* Sets / Objetivos actuales */}
          {prog.objetivos_cp && prog.objetivos_cp.filter(o => o.estado !== 'dominado').length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Target size={11} /> Qué está practicando ahora
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {prog.objetivos_cp.filter(o => o.estado !== 'dominado').map(obj => {
                  const isExpObj = expandedObj === obj.id
                  const hasDetail = !!(obj.descripcion || obj.nombre)
                  return (
                    <div key={obj.id} style={{ borderRadius: 12, overflow: 'hidden', border: `1.5px solid ${isExpObj ? area.color : 'var(--c-border)'}`, transition: 'border-color .2s' }}>
                      {/* Row — always clickable */}
                      <button
                        onClick={() => setExpandedObj(isExpObj ? null : obj.id)}
                        style={{
                          width: '100%', background: isExpObj ? area.bg : 'var(--c-surface)',
                          border: 'none', cursor: 'pointer', padding: '11px 12px',
                          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                          transition: 'background .2s', fontFamily: 'inherit'
                        }}>
                        {/* Number badge */}
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: isExpObj ? area.color : area.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .2s' }}>
                          <span style={{ fontSize: 10, fontWeight: 900, color: isExpObj ? '#fff' : area.color }}>{obj.numero_set || '•'}</span>
                        </div>
                        {/* Label */}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-primary)', flex: 1, lineHeight: 1.4, textAlign: 'left' }}>
                          {obj.descripcion || obj.nombre || `Set ${obj.numero_set}`}
                        </span>
                        {/* Status badge */}
                        {obj.estado === 'en_progreso' && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(2,132,199,0.12)', color: '#0284c7', flexShrink: 0, border: '1px solid rgba(2,132,199,0.2)' }}>EN CURSO</span>
                        )}
                        {/* Expand chevron */}
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', marginLeft: 4, color: 'var(--c-text-muted)', transform: isExpObj ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>
                          <ChevronDown size={15} />
                        </div>
                      </button>
                      {/* Expanded detail — incluye los campos clínicos del set */}
                      {isExpObj && (() => {
                        // Fallback al programa para SD/Materiales/Ayudas si el set no los tiene
                        const sd         = obj.sd_estimulo      || prog.sd_estimulo
                        const materiales = obj.materiales       || prog.materiales
                        // En el admin la "Ayudas" se guarda en el campo `reforzadores` del set
                        const ayudas     = obj.reforzadores     || prog.ayudas
                        const correccion = obj.correction_errores
                        const generaliz  = obj.generalizacion
                        const hayClinico = sd || materiales || ayudas || correccion || generaliz

                        const Field = ({ icon, label, value }: { icon: string; label: string; value?: string }) => {
                          if (!value) return null
                          return (
                            <div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: area.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{icon} {label}</span>
                              <p style={{ fontSize: 12, color: 'var(--c-text-primary)', margin: '4px 0 0', lineHeight: 1.6 }}>{value}</p>
                            </div>
                          )
                        }

                        return (
                          <div style={{ padding: '12px 14px 14px', background: 'var(--c-card)', borderTop: `1px solid ${area.color}30`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Objetivo */}
                            {hasDetail && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: area.bg, borderRadius: 10 }}>
                                <Target size={13} color={area.color} style={{ flexShrink: 0, marginTop: 2 }} />
                                <div>
                                  <p style={{ fontSize: 10, fontWeight: 700, color: area.color, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Objetivo</p>
                                  <p style={{ fontSize: 12, color: 'var(--c-text-primary)', margin: 0, lineHeight: 1.6 }}>{obj.descripcion || obj.nombre}</p>
                                </div>
                              </div>
                            )}

                            {/* Campos clínicos del set */}
                            {hayClinico && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)' }}>
                                <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--c-text-muted)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
                                  Cómo practicarlo en casa
                                </p>
                                <Field icon="📍" label="Qué decir o hacer (Sd)" value={sd} />
                                <Field icon="🤝" label="Ayudas / Prompts"        value={ayudas} />
                                <Field icon="🧸" label="Materiales"              value={materiales} />
                                <Field icon="✏️" label="Si se equivoca"          value={correccion} />
                                <Field icon="🌱" label="Generalización"          value={generaliz} />
                              </div>
                            )}

                            {!hayClinico && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(16,185,129,0.08)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.15)' }}>
                                <Lightbulb size={13} color="#059669" style={{ flexShrink: 0 }} />
                                <p style={{ fontSize: 11, color: '#065f46', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                                  El terapeuta aún no agregó detalles de este set. Consúltale en la próxima sesión.
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Weekly tracker */}
          {!isDone && (
            <div style={{ background: 'var(--c-surface)', borderRadius: 14, padding: '12px 14px', border: '1px solid var(--c-border)' }}>
              <WeekTracker
                programaId={prog.id}
                childId={childId}
                objetivos={prog.objetivos_cp?.filter(o => o.estado !== 'dominado')}
              />
            </div>
          )}

          {isDone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.2)' }}>
              <Award size={18} color="#10b981" />
              <div>
                <p style={{ fontWeight: 700, fontSize: 12, color: '#10b981', margin: 0 }}>¡Programa dominado!</p>
                <p style={{ fontSize: 11, color: 'var(--c-text-muted)', margin: 0 }}>Tu hijo/a alcanzó el criterio de dominio.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProgramasABAView({ childId, childName }: Props) {
  const [programas, setProgramas] = useState<Programa[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'activos' | 'todos'>('activos')

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/programas-aba?child_id=${childId}`)
      const json = await res.json()
      if (json.data) setProgramas(json.data)
    } finally { setLoading(false) }
  }, [childId])

  useEffect(() => { load() }, [load])

  const activos = programas.filter(p => 
    p.estado !== 'dominado' && 
    p.estado !== 'archivado' && 
    p.fase_actual !== 'dominado'
  )
  const filtered = filtro === 'activos' ? activos : programas.filter(p => p.estado !== 'archivado')
  const totalPracticadosSemana = 0 // Could be computed from WeekTracker data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingBottom: 16, borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <h2 style={{ fontWeight: 900, fontSize: 20, color: 'var(--c-text-primary)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'rgba(2,132,199,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} color="#0284c7" />
            </div>
            Programas ABA
          </h2>
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0, marginLeft: 44 }}>
            {activos.length} activos · {childName}
          </p>
        </div>
      </div>

      {/* Info card */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 16, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info size={16} color="#0284c7" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: 'var(--c-text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Estos son los programas que tu terapeuta trabaja con <strong style={{ color: 'var(--c-text-primary)' }}>{childName}</strong>. Practicarlos en casa refuerza el aprendizaje. Marca los días que lo practicaron para hacer seguimiento.
        </p>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['activos', 'todos'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            style={{ padding: '7px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all .15s',
              background: filtro === f ? '#0284c7' : 'var(--c-surface)',
              color: filtro === f ? '#fff' : 'var(--c-text-muted)' }}>
            {f === 'activos' ? `Activos (${activos.length})` : `Todos (${programas.length})`}
          </button>
        ))}
      </div>

      {/* Program list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={24} color="var(--c-text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ width: 60, height: 60, borderRadius: 20, background: 'var(--c-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <BookOpen size={28} color="var(--c-text-muted)" />
          </div>
          <p style={{ fontWeight: 700, color: 'var(--c-text-primary)', margin: '0 0 6px' }}>Sin programas activos</p>
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0 }}>Tu terapeuta aún no ha asignado programas ABA.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(p => <ProgramCard key={p.id} prog={p} childId={childId} />)}
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
