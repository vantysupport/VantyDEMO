'use client'

// Panel para configurar la disponibilidad del centro y generar links de reserva
// que se envían a los padres. Se abre como modal desde la Agenda.

import { useState, useEffect } from 'react'
import {
  X, Clock, Plus, Trash2, Loader2, Link2, Copy, CheckCircle2,
  Settings, CalendarClock, Power, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const DIAS = [
  { k: '1', label: 'Lunes' }, { k: '2', label: 'Martes' }, { k: '3', label: 'Miércoles' },
  { k: '4', label: 'Jueves' }, { k: '5', label: 'Viernes' }, { k: '6', label: 'Sábado' }, { k: '0', label: 'Domingo' },
]

type Props = {
  ninos: any[]
  especialistas: any[]
  onClose: () => void
}

export default function ReservasOnlinePanel({ ninos, especialistas, onClose }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<'config' | 'links'>('config')

  // ── Config ──
  const [cfg, setCfg] = useState<any>(null)
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [savingCfg, setSavingCfg] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  // ── Links ──
  const [links, setLinks] = useState<any[]>([])
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [creando, setCreando] = useState(false)
  const [form, setForm] = useState({
    child_id: '', specialist_id: '', max_slots: 1, plan_type: 'individual',
    service_type: 'Terapia ABA', modalidad: 'presencial', expires_in_days: 14,
  })
  const [copiado, setCopiado] = useState<string | null>(null)

  useEffect(() => { cargarConfig(); cargarLinks() }, [])

  const cargarConfig = async () => {
    setLoadingCfg(true)
    try {
      const r = await fetch('/api/booking/config').then(r => r.json())
      setCfg(r.config || defaultCfg())
    } catch { setCfg(defaultCfg()) }
    finally { setLoadingCfg(false) }
  }
  const defaultCfg = () => ({
    session_duration_min: 45, slot_step_min: 60, max_advance_days: 30,
    closed_dates: [],
    working_hours: Object.fromEntries(DIAS.map(d => [d.k, { activo: ['1','2','3','4','5'].includes(d.k), bloques: ['1','2','3','4','5'].includes(d.k) ? [{ inicio: '09:00', fin: '13:00' }, { inicio: '15:00', fin: '19:00' }] : [] }])),
  })

  const cargarLinks = async () => {
    setLoadingLinks(true)
    try {
      const r = await fetch('/api/booking/links').then(r => r.json())
      setLinks(r.links || [])
    } catch {} finally { setLoadingLinks(false) }
  }

  const guardarConfig = async () => {
    setSavingCfg(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const r = await fetch('/api/booking/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cfg, updated_by: user?.id }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      toast.success('Disponibilidad guardada')
      setCfg(d.config)
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSavingCfg(false) }
  }

  const crearLink = async () => {
    setCreando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const r = await fetch('/api/booking/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, created_by: user?.id }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      toast.success('Link generado')
      cargarLinks()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setCreando(false) }
  }

  const toggleLink = async (id: string, active: boolean) => {
    await fetch('/api/booking/links', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !active }),
    })
    cargarLinks()
  }

  const urlDe = (token: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/reservar/${token}`
  const copiar = (token: string) => {
    navigator.clipboard?.writeText(urlDe(token))
    setCopiado(token)
    setTimeout(() => setCopiado(null), 1800)
  }

  // Helpers config
  const setDiaActivo = (k: string, activo: boolean) =>
    setCfg((c: any) => ({ ...c, working_hours: { ...c.working_hours, [k]: { ...(c.working_hours[k] || { bloques: [] }), activo } } }))
  const addBloque = (k: string) =>
    setCfg((c: any) => ({ ...c, working_hours: { ...c.working_hours, [k]: { ...c.working_hours[k], bloques: [...(c.working_hours[k]?.bloques || []), { inicio: '09:00', fin: '13:00' }] } } }))
  const setBloque = (k: string, i: number, campo: 'inicio' | 'fin', val: string) =>
    setCfg((c: any) => {
      const bloques = [...(c.working_hours[k]?.bloques || [])]
      bloques[i] = { ...bloques[i], [campo]: val }
      return { ...c, working_hours: { ...c.working_hours, [k]: { ...c.working_hours[k], bloques } } }
    })
  const delBloque = (k: string, i: number) =>
    setCfg((c: any) => ({ ...c, working_hours: { ...c.working_hours, [k]: { ...c.working_hours[k], bloques: (c.working_hours[k]?.bloques || []).filter((_: any, idx: number) => idx !== i) } } }))
  // Marca/desmarca un día como cerrado (toggle)
  const toggleClosed = (d: string) =>
    setCfg((c: any) => {
      const set = new Set<string>(c.closed_dates || [])
      if (set.has(d)) set.delete(d); else set.add(d)
      return { ...c, closed_dates: [...set].sort() }
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ background: 'var(--card)', maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--card-border)' }}>
          <h2 className="font-black text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <CalendarClock size={20} className="text-indigo-500" /> Reservas online
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b" style={{ borderColor: 'var(--card-border)' }}>
          {[{ id: 'config', label: 'Disponibilidad', icon: Settings }, { id: 'links', label: 'Generar links', icon: Link2 }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.id ? 'bg-indigo-600 text-white' : ''}`}
              style={tab === t.id ? {} : { color: 'var(--text-muted)' }}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5 flex-1">
          {/* ─── TAB CONFIG ─── */}
          {tab === 'config' && (
            loadingCfg || !cfg ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-500" /></div> : (
              <div className="space-y-5">
                {/* Parámetros generales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Campo label="Duración de cada sesión (min)">
                    <input type="number" value={cfg.session_duration_min} onChange={e => setCfg((c: any) => ({ ...c, session_duration_min: Number(e.target.value) }))} className={inp} />
                  </Campo>
                  <Campo label="Cada cuánto empieza un turno (min)">
                    <input type="number" value={cfg.slot_step_min} onChange={e => setCfg((c: any) => ({ ...c, slot_step_min: Number(e.target.value) }))} className={inp} />
                  </Campo>
                  <Campo label="Permitir reservar hasta (días)">
                    <input type="number" value={cfg.max_advance_days} onChange={e => setCfg((c: any) => ({ ...c, max_advance_days: Number(e.target.value) }))} className={inp} />
                  </Campo>
                </div>
                <div className="rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
                  💡 <strong>"Cada cuánto empieza un turno"</strong>: si una sesión dura 45 min y ponés 60, los turnos salen a las 9:00, 10:00, 11:00… (uno por hora, con descanso).
                  Si ponés 45, salen seguidos: 9:00, 9:45, 10:30… &nbsp;·&nbsp; Para abrir <strong>sábados o domingos</strong>, tildá el día abajo y agregale un bloque horario.
                </div>

                {/* Horario por día */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Horario de atención</p>
                  <div className="space-y-2">
                    {DIAS.map(d => {
                      const dia = cfg.working_hours[d.k] || { activo: false, bloques: [] }
                      return (
                        <div key={d.k} className="rounded-xl border p-3" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                              <input type="checkbox" checked={!!dia.activo} onChange={e => setDiaActivo(d.k, e.target.checked)} />
                              {d.label}
                            </label>
                            {dia.activo && (
                              <button onClick={() => addBloque(d.k)} className="text-xs font-bold text-indigo-500 flex items-center gap-1"><Plus size={12} /> bloque</button>
                            )}
                          </div>
                          {dia.activo && (
                            <div className="space-y-1.5">
                              {(dia.bloques || []).length === 0 && <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin horario — agregá un bloque</p>}
                              {(dia.bloques || []).map((b: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                  <input type="time" value={b.inicio} onChange={e => setBloque(d.k, i, 'inicio', e.target.value)} className={inpSm} />
                                  <span style={{ color: 'var(--text-muted)' }}>a</span>
                                  <input type="time" value={b.fin} onChange={e => setBloque(d.k, i, 'fin', e.target.value)} className={inpSm} />
                                  <button onClick={() => delBloque(d.k, i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Días cerrados — calendario navegable por mes */}
                <div>
                  <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Días cerrados (feriados / vacaciones)</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Tocá los días que el centro estará cerrado. Podés marcar varios y cambiar de mes con las flechas.</p>
                  <CalendarioDiasCerrados
                    mes={calMonth}
                    onCambiarMes={setCalMonth}
                    cerrados={cfg.closed_dates || []}
                    onToggle={toggleClosed}
                  />
                  {(cfg.closed_dates || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {[...(cfg.closed_dates || [])].sort().map((d: string) => (
                        <span key={d} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>
                          {d} <button onClick={() => toggleClosed(d)}><X size={11} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={guardarConfig} disabled={savingCfg}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingCfg ? <><Loader2 size={16} className="animate-spin" /> Guardando…</> : <><CheckCircle2 size={16} /> Guardar disponibilidad</>}
                </button>
              </div>
            )
          )}

          {/* ─── TAB LINKS ─── */}
          {tab === 'links' && (
            <div className="space-y-5">
              {/* Crear link */}
              <div className="rounded-xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
                <p className="text-sm font-black mb-3" style={{ color: 'var(--text-primary)' }}>Nuevo link de reserva</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Campo label="Paciente (opcional)">
                    <select value={form.child_id} onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))} className={inp}>
                      <option value="">El padre elige su hijo</option>
                      {ninos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Especialista (opcional)">
                    <select value={form.specialist_id} onChange={e => setForm(f => ({ ...f, specialist_id: e.target.value }))} className={inp}>
                      <option value="">Sin especialista fijo</option>
                      {especialistas.map(e => <option key={e.id} value={e.id}>{e.full_name || e.email}</option>)}
                    </select>
                  </Campo>
                  <Campo label="¿Cuántas citas puede separar?">
                    <select value={form.max_slots} onChange={e => setForm(f => ({ ...f, max_slots: Number(e.target.value) }))} className={inp}>
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => <option key={n} value={n}>{n} cita{n > 1 ? 's' : ''}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Tipo de plan">
                    <select value={form.plan_type} onChange={e => setForm(f => ({ ...f, plan_type: e.target.value }))} className={inp}>
                      <option value="individual">Individual</option>
                      <option value="paquete">Paquete</option>
                      <option value="evaluación">Evaluación</option>
                    </select>
                  </Campo>
                  <Campo label="Servicio">
                    <input value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))} className={inp} />
                  </Campo>
                  <Campo label="Vence en (días)">
                    <input type="number" value={form.expires_in_days} onChange={e => setForm(f => ({ ...f, expires_in_days: Number(e.target.value) }))} className={inp} />
                  </Campo>
                </div>
                <button onClick={crearLink} disabled={creando}
                  className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  {creando ? <><Loader2 size={16} className="animate-spin" /> Generando…</> : <><Link2 size={16} /> Generar link</>}
                </button>
              </div>

              {/* Lista de links */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Links generados</p>
                {loadingLinks ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-indigo-500" /></div> : (
                  <div className="space-y-2">
                    {links.length === 0 && <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>Aún no generaste links.</p>}
                    {links.map(l => {
                      const agotado = l.slots_used >= l.max_slots
                      const vencido = l.expires_at && new Date(l.expires_at) < new Date()
                      const childName = ninos.find(n => n.id === l.child_id)?.name
                      return (
                        <div key={l.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)', opacity: l.active && !agotado && !vencido ? 1 : 0.55 }}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-sm">
                              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                {l.service_type} · {l.plan_type} · {l.slots_used}/{l.max_slots} citas
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {childName ? `${childName} · ` : 'Padre elige hijo · '}
                                {agotado ? 'Completado' : vencido ? 'Vencido' : !l.active ? 'Desactivado' : 'Activo'}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => copiar(l.token)} title="Copiar link"
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5">
                                {copiado === l.token ? <><CheckCircle2 size={13} /> Copiado</> : <><Copy size={13} /> Copiar link</>}
                              </button>
                              <button onClick={() => toggleLink(l.id, l.active)} title={l.active ? 'Desactivar' : 'Activar'}
                                className="p-1.5 rounded-lg" style={{ color: l.active ? '#dc2626' : '#16a34a', background: 'var(--card)' }}>
                                <Power size={14} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] mt-1.5 font-mono truncate" style={{ color: 'var(--text-muted)' }}>{urlDe(l.token)}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const inp = 'w-full px-3 py-2 rounded-lg border outline-none text-sm focus:border-indigo-500'
const inpSm = 'px-2 py-1.5 rounded-lg border outline-none text-sm focus:border-indigo-500'

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

// Calendario mensual para marcar varios días cerrados
function CalendarioDiasCerrados({ mes, onCambiarMes, cerrados, onToggle }: {
  mes: Date
  onCambiarMes: (d: Date) => void
  cerrados: string[]
  onToggle: (fecha: string) => void
}) {
  const year = mes.getFullYear()
  const month = mes.getMonth()
  const primerDia = new Date(year, month, 1)
  const offset = (primerDia.getDay() + 6) % 7 // lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const hoyStr = new Date().toISOString().slice(0, 10)
  const cerradosSet = new Set(cerrados)
  const nombreMes = mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]

  const fechaDe = (dia: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onCambiarMes(new Date(year, month - 1, 1))}
          className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-secondary)' }}><ChevronLeft size={16} /></button>
        <p className="text-sm font-black capitalize" style={{ color: 'var(--text-primary)' }}>{nombreMes}</p>
        <button onClick={() => onCambiarMes(new Date(year, month + 1, 1))}
          className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-secondary)' }}><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="text-[10px] font-black" style={{ color: 'var(--text-muted)' }}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const fecha = fechaDe(dia)
          const cerrado = cerradosSet.has(fecha)
          const pasado = fecha < hoyStr
          return (
            <button key={i} disabled={pasado}
              onClick={() => onToggle(fecha)}
              className={`aspect-square rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                cerrado ? 'bg-red-500 text-white' : 'hover:bg-indigo-100'
              }`}
              style={cerrado ? {} : { background: 'var(--card)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' }}
              title={cerrado ? 'Cerrado — tocá para abrir' : 'Abierto — tocá para cerrar'}>
              {dia}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] mt-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
        <span className="inline-block w-3 h-3 rounded bg-red-500" /> = cerrado
      </p>
    </div>
  )
}
