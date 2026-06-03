'use client'

// 📅 Página pública de reserva de citas.
// El padre abre el link → inicia sesión → elige sus horarios → confirma.
// Las citas creadas aparecen en la agenda de especialista/jefe/secretaria/padre.

import { useState, useEffect, use as usePromise } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Calendar, Clock, CheckCircle2, Loader2, AlertCircle, LogIn, CalendarCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

type Slot = { time: string; label: string }
type Dia = { fecha: string; label: string; slots: Slot[] }

export default function ReservarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params)

  const [session, setSession] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [children, setChildren] = useState<any[]>([])

  const [linkInfo, setLinkInfo] = useState<any>(null)
  const [dias, setDias] = useState<Dia[]>([])
  const [meta, setMeta] = useState<any>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [childId, setChildId] = useState<string>('')
  const [seleccion, setSeleccion] = useState<{ fecha: string; time: string; label: string }[]>([])
  const [confirmando, setConfirmando] = useState(false)
  const [exito, setExito] = useState<any[] | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [calMonth, setCalMonth] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })

  // Login inline
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  // ── Sesión ──
  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user) await cargarPerfil(session.user.id)
      setCheckingAuth(false)
    })()
  }, [])

  const cargarPerfil = async (uid: string) => {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile(p)
    // Cargar hijos del padre
    const { data: kids } = await supabase.from('children').select('id, name').eq('parent_id', uid).order('name')
    setChildren(kids || [])
  }

  // ── Cargar link + slots cuando hay sesión ──
  useEffect(() => {
    if (!session) return
    cargarTodo()
  }, [session])

  const cargarTodo = async () => {
    setLoadingSlots(true); setError(null)
    try {
      const [lr, sr] = await Promise.all([
        fetch(`/api/booking/links?token=${token}`).then(r => r.json()),
        fetch(`/api/booking/slots?token=${token}`).then(r => r.json()),
      ])
      if (lr.error) throw new Error(lr.error)
      if (sr.error) throw new Error(sr.error)
      setLinkInfo(lr)
      if (lr.link?.child_id) setChildId(lr.link.child_id)
      const ds = sr.dias || []
      setDias(ds)
      setMeta(sr)
      // Auto-seleccionar el primer día disponible y posicionar el calendario en su mes
      if (ds.length > 0) {
        setSelectedDate(ds[0].fecha)
        const [y, m] = ds[0].fecha.split('-').map(Number)
        setCalMonth(new Date(y, m - 1, 1))
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoggingIn(true); setLoginError(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      setSession(data.session)
      if (data.user) await cargarPerfil(data.user.id)
    } catch (err: any) {
      setLoginError(err?.message?.includes('Invalid') ? 'Correo o contraseña incorrectos' : err.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const toggleSlot = (fecha: string, time: string, label: string) => {
    setSeleccion(prev => {
      const exists = prev.find(s => s.fecha === fecha && s.time === time)
      if (exists) return prev.filter(s => !(s.fecha === fecha && s.time === time))
      const restantes = meta?.slotsRestantes ?? 1
      if (prev.length >= restantes) {
        // reemplaza el más antiguo si solo puede 1, si no avisa
        if (restantes === 1) return [{ fecha, time, label }]
        return prev // ya llegó al máximo
      }
      return [...prev, { fecha, time, label }]
    })
  }

  const confirmar = async () => {
    if (seleccion.length === 0) { setError('Elegí al menos un horario'); return }
    if (!childId && !linkInfo?.link?.child_id) { setError('Seleccioná el paciente'); return }
    setConfirmando(true); setError(null)
    try {
      const res = await fetch('/api/booking/reserve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          parentUserId: session?.user?.id,
          childId: childId || undefined,
          slots: seleccion.map(s => ({ fecha: s.fecha, time: s.time })),
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'No se pudo reservar')
      setExito(data.citas || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setConfirmando(false)
    }
  }

  // ─── Render ───
  if (checkingAuth) {
    return <Centro><Loader2 className="animate-spin text-indigo-500" size={32} /></Centro>
  }

  // No logueado → login inline
  if (!session) {
    return (
      <Centro>
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-3">
              <CalendarCheck size={26} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Reservá tu cita</h1>
            <p className="text-sm text-slate-500 mt-1">Iniciá sesión para elegir tu horario</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 outline-none focus:border-indigo-500 text-sm" />
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 outline-none focus:border-indigo-500 text-sm" />
            {loginError && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {loginError}</p>}
            <button type="submit" disabled={loggingIn}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loggingIn ? <><Loader2 size={16} className="animate-spin" /> Ingresando…</> : <><LogIn size={16} /> Iniciar sesión</>}
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-4">¿No tenés cuenta? Pedile el acceso al centro.</p>
        </div>
      </Centro>
    )
  }

  // Éxito
  if (exito) {
    return (
      <Centro>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={34} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">¡Cita{exito.length > 1 ? 's' : ''} reservada{exito.length > 1 ? 's' : ''}!</h1>
          <p className="text-sm text-slate-600 mb-5">Te esperamos. Tu{exito.length > 1 ? 's' : ''} cita{exito.length > 1 ? 's' : ''} ya aparece{exito.length > 1 ? 'n' : ''} en tu portal.</p>
          <div className="space-y-2 mb-6">
            {exito.map((c, i) => (
              <div key={i} className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm font-semibold text-emerald-800 flex items-center justify-center gap-2">
                <Calendar size={14} /> {c.appointment_date} · {String(c.appointment_time).slice(0, 5)}
              </div>
            ))}
          </div>
          <a href="/padre" className="inline-block px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm">Ir a mi portal</a>
        </div>
      </Centro>
    )
  }

  // Loading slots
  if (loadingSlots) {
    return <Centro><Loader2 className="animate-spin text-indigo-500" size={32} /></Centro>
  }

  // Error de link
  if (error && !linkInfo) {
    return (
      <Centro>
        <div className="text-center max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={26} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-1">No se puede reservar</h1>
          <p className="text-sm text-slate-600">{error}</p>
        </div>
      </Centro>
    )
  }

  const restantes = meta?.slotsRestantes ?? 1

  return (
    <div className="min-h-screen py-6 sm:py-10 px-3 sm:px-4" style={{ background: 'linear-gradient(135deg,#eef2ff,#faf5ff)' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="rounded-3xl p-6 mb-5 text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
          <div className="flex items-center gap-3 mb-2">
            <CalendarCheck size={26} />
            <h1 className="text-2xl font-bold">Reservá tu cita</h1>
          </div>
          <p className="text-white/90 text-sm">
            {meta?.serviceType || 'Terapia'}
            {linkInfo?.specialistName ? ` · con ${linkInfo.specialistName}` : ''}
            {meta?.planType ? ` · ${meta.planType}` : ''}
          </p>
          <p className="text-white/80 text-xs mt-1">
            Podés elegir {restantes} horario{restantes > 1 ? 's' : ''}{meta?.duracion ? ` · cada cita dura ${meta.duracion} min` : ''}
          </p>
        </div>

        {/* Selección de paciente (si el link no lo fijó) */}
        {!linkInfo?.link?.child_id && (
          <div className="rounded-2xl bg-white p-4 mb-4 shadow-sm border border-slate-100">
            <label className="text-xs font-bold text-slate-500 block mb-2">¿Para quién es la cita?</label>
            {children.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay pacientes vinculados a tu cuenta. Contactá al centro.</p>
            ) : (
              <select value={childId} onChange={e => setChildId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 outline-none focus:border-indigo-500 text-sm">
                <option value="">— Seleccioná —</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
        )}
        {linkInfo?.childName && (
          <div className="rounded-2xl bg-white p-4 mb-4 shadow-sm border border-slate-100 text-sm">
            <span className="text-slate-500">Paciente: </span>
            <span className="font-bold text-slate-800">{linkInfo.childName}</span>
          </div>
        )}

        {/* Calendario + horarios del día elegido */}
        {dias.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm border border-slate-100">
            <Clock size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No hay horarios disponibles por ahora. Contactá al centro.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-5 gap-4 items-start">
            {/* Calendario — ocupa más ancho en desktop */}
            <div className="md:col-span-3">
              <CalendarioReserva
                mes={calMonth}
                onCambiarMes={setCalMonth}
                disponibles={new Set(dias.map(d => d.fecha))}
                seleccionadas={new Set(seleccion.map(s => s.fecha))}
                diaActivo={selectedDate}
                onElegirDia={setSelectedDate}
              />
            </div>

            {/* Horarios del día elegido */}
            <div className="md:col-span-2 rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-100 md:sticky md:top-6">
              {(() => {
                const dia = dias.find(d => d.fecha === selectedDate)
                if (!dia) return <p className="text-sm text-slate-400 italic text-center py-10">Elegí un día disponible (en verde) para ver los horarios.</p>
                return (
                  <>
                    <p className="text-base font-bold text-slate-800 capitalize mb-3 flex items-center gap-2">
                      <Clock size={16} className="text-indigo-500" /> {dia.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto pr-1">
                      {dia.slots.map(slot => {
                        const sel = seleccion.some(s => s.fecha === dia.fecha && s.time === slot.time)
                        return (
                          <button key={slot.time} onClick={() => toggleSlot(dia.fecha, slot.time, slot.label)}
                            className={`px-3 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                              sel ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/40'
                            }`}>
                            {slot.label}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-4 flex items-center gap-1.5"><AlertCircle size={14} /> {error}</p>}

        {/* Barra de confirmación */}
        {seleccion.length > 0 && (
          <div className="sticky bottom-4 mt-5">
            <div className="rounded-2xl bg-white shadow-2xl border border-indigo-100 p-4 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-bold text-slate-800">{seleccion.length} horario{seleccion.length > 1 ? 's' : ''} elegido{seleccion.length > 1 ? 's' : ''}</p>
                <p className="text-xs text-slate-500 truncate">{seleccion.map(s => `${s.fecha.slice(5)} ${s.time}`).join(' · ')}</p>
              </div>
              <button onClick={confirmar} disabled={confirmando}
                className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50 shrink-0">
                {confirmando ? <><Loader2 size={16} className="animate-spin" /> Reservando…</> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg,#eef2ff,#faf5ff)' }}>
      <div className="bg-white rounded-3xl shadow-2xl p-8 flex items-center justify-center">{children}</div>
    </div>
  )
}

// Calendario mensual para elegir el día de la cita
function CalendarioReserva({ mes, onCambiarMes, disponibles, seleccionadas, diaActivo, onElegirDia }: {
  mes: Date
  onCambiarMes: (d: Date) => void
  disponibles: Set<string>
  seleccionadas: Set<string>
  diaActivo: string
  onElegirDia: (fecha: string) => void
}) {
  const year = mes.getFullYear()
  const month = mes.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // lunes = 0
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const nombreMes = mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const celdas: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => i + 1),
  ]
  const fechaDe = (dia: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  return (
    <div className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onCambiarMes(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={20} /></button>
        <p className="text-base sm:text-lg font-bold capitalize text-slate-800">{nombreMes}</p>
        <button onClick={() => onCambiarMes(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center mb-1.5">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <span key={i} className="text-[11px] sm:text-xs font-bold text-slate-400">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />
          const fecha = fechaDe(dia)
          const disp = disponibles.has(fecha)
          const activo = fecha === diaActivo
          const tieneSeleccion = seleccionadas.has(fecha)
          return (
            <button key={i} disabled={!disp}
              onClick={() => onElegirDia(fecha)}
              className={`aspect-square rounded-xl text-sm sm:text-base font-bold transition-all relative ${
                activo ? 'bg-indigo-600 text-white shadow-md scale-105'
                : disp ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:scale-105'
                : 'text-slate-300 cursor-not-allowed'
              }`}>
              {dia}
              {tieneSeleccion && !activo && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>
          )
        })}
      </div>
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-indigo-600" /> Elegido</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-indigo-500" /> Con cita marcada</span>
      </div>
    </div>
  )
}
