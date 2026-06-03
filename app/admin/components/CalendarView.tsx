'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, User, Plus, X, Loader2,
  CheckCircle2, Trash2, Users, RefreshCw, Video, MapPin, Timer, Pencil, Check
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import VideoCallModal from '@/components/VideoCallModal'
import { supabase } from '@/lib/supabase'
import GoogleCalendarSync from './GoogleCalendarSync'
import MicrosoftCalendarSync from './MicrosoftCalendarSync'
import ReservasOnlinePanel from './ReservasOnlinePanel'
import { CalendarClock } from 'lucide-react'

// ── Cronómetro de 45 min por cita ──────────────────────────────────────────
function SessionTimer({ apt, onExpired }: { apt: any; onExpired: (id: string) => void }) {
  const { t } = useI18n()
  const [remaining, setRemaining] = useState<number | null>(null)
  const [phase, setPhase] = useState<'waiting' | 'active' | 'done'>('waiting')
  const calledRef = useRef(false)

  useEffect(() => {
    if (!apt.appointment_date || !apt.appointment_time) return
    const [h, m] = (apt.appointment_time as string).split(':').map(Number)
    const start = new Date(`${apt.appointment_date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
    const end = new Date(start.getTime() + 45 * 60 * 1000)

    const tick = () => {
      const now = new Date()
      const diffToStart = start.getTime() - now.getTime()
      const diffToEnd   = end.getTime()   - now.getTime()

      if (diffToStart > 0) {
        setPhase('waiting')
        setRemaining(null)
      } else if (diffToEnd > 0) {
        setPhase('active')
        setRemaining(Math.ceil(diffToEnd / 1000))
      } else {
        setPhase('done')
        setRemaining(0)
        if (!calledRef.current) {
          calledRef.current = true
          onExpired(apt.id)
        }
      }
    }

    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [apt.id, apt.appointment_date, apt.appointment_time, onExpired])

  if (phase === 'waiting' || phase === 'done') return null

  const mins = Math.floor((remaining ?? 0) / 60)
  const secs = (remaining ?? 0) % 60
  const pct  = ((remaining ?? 0) / (45 * 60)) * 100
  const urgent = (remaining ?? 0) <= 5 * 60   // últimos 5 min
  const warning = (remaining ?? 0) <= 10 * 60  // últimos 10 min

  return (
    <div className={`mt-2.5 rounded-xl px-3 py-2 border flex items-center gap-2.5 transition-all
      ${urgent  ? 'bg-red-50 border-red-200 animate-pulse' :
        warning ? 'bg-amber-50 border-amber-200' :
                  'bg-emerald-50 border-emerald-200'}`}>
      <Timer size={13} className={urgent ? 'text-red-500' : warning ? 'text-amber-500' : 'text-emerald-600'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[10px] font-bold
            ${urgent ? 'text-red-600' : warning ? 'text-amber-600' : 'text-emerald-700'}`}>
            {urgent ? '⚠️ Finalizando' : 'Sesión en curso'}
          </span>
          <span className={`text-xs font-bold tabular-nums
            ${urgent ? 'text-red-600' : warning ? 'text-amber-600' : 'text-emerald-700'}`}>
            {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
          </span>
        </div>
        {/* Barra de progreso */}
        <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000
              ${urgent ? 'bg-red-500' : warning ? 'bg-amber-400' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

const SERVICES = [
  'Terapia ABA','Evaluación Inicial','Seguimiento BRIEF-2','Evaluación ADOS-2',
  'Evaluación Vineland-3','Evaluación WISC-V','Evaluación BASC-3',
  'Sesión Familiar','Sesión de Orientación','Visita Domiciliaria',
]
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmada', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  pending:   { label: 'Pendiente',  color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200'   },
  cancelled: { label: 'Cancelada',  color: 'text-red-700',     bg: 'bg-red-50 border-red-200'       },
  completed: { label: 'Completada', color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200'     },
}

function MonthlyCalendarView() {
  const toast = useToast()
  const { t, locale } = useI18n()
  const [apts, setApts] = useState<any[]>([])
  const [ninos, setNinos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [show, setShow] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterEspecialista, setFilterEspecialista] = useState('todos')
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [tipoSesion, setTipoSesion] = useState<'individual'|'grupal'>('individual')
  const [modalidadCita, setModalidadCita] = useState<'presencial'|'virtual'>('presencial')
  const [newApt, setNewApt] = useState({ child_id:'', date:'', time:'09:00', service:'Terapia ABA', notes:'', group_name:'', status:'confirmed', specialist_id:'' })
  const [especialistas, setEspecialistas] = useState<any[]>([])
  const [recurrencia, setRecurrencia] = useState<'none'|'weekly'|'biweekly'>('none')
  const [showReservas, setShowReservas] = useState(false)

  useEffect(() => {
    supabase.from('profiles')
      .select('id, full_name, specialty, role')
      .in('role', ['especialista', 'terapeuta', 'admin', 'jefe'])
      .eq('is_active', true)
      .order('full_name')
      .then(({ data }) => setEspecialistas(data || []))
  }, [])
  const [recurrenciaSemanas, setRecurrenciaSemanas] = useState(4)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])

  // Video call
  const [videoSession, setVideoSession] = useState<{roomUrl:string;sessionId:string;appointmentId:string}|null>(null)
  const [startingCall, setStartingCall] = useState<string|null>(null)

  // Auto-elimina citas cuya sesión ya terminó (fecha+hora+45min en el pasado)
  const limpiarCitasVencidas = useCallback(async (citas: any[]) => {
    const ahora = new Date()
    const vencidas = citas.filter(a => {
      if (a.status === 'cancelled' || a.status === 'completed') return false
      if (!a.appointment_date || !a.appointment_time) return false
      const [h, m] = (a.appointment_time || '00:00').split(':').map(Number)
      const inicio = new Date(`${a.appointment_date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`)
      const fin = new Date(inicio.getTime() + 45 * 60 * 1000)
      return ahora > fin
    })
    for (const cita of vencidas) {
      try {
        await fetch('/api/admin/appointments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({ id: cita.id, status: 'completed' , locale: localStorage.getItem('vanty_locale') || 'es' }),
        })
      } catch {}
    }
    if (vencidas.length > 0) return true
    return false
  }, [])

  const cargarCitas = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/appointments')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const citas = json.data || []
      // Marcar como completadas las que ya pasaron 45 min
      const huboCambios = await limpiarCitasVencidas(citas)
      if (huboCambios) {
        // Recargar para obtener estados actualizados
        const res2 = await fetch('/api/admin/appointments')
        const json2 = await res2.json()
        setApts(json2.data || [])
      } else {
        setApts(citas)
      }
    } catch (err:any) { toast.error('Error: ' + err.message) }
    finally { setIsLoading(false) }
  }, [limpiarCitasVencidas])

  // Callback que llama el SessionTimer cuando el cronómetro llega a 0
  const handleExpired = useCallback(async (id: string) => {
    try {
      await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ id, status: 'completed' , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      setApts(prev => prev.map(a => a.id === id ? { ...a, status: 'completed' } : a))
      toast.success('Sesión finalizada · Cita movida al historial')
    } catch {
      cargarCitas()
    }
  }, [cargarCitas])

  useEffect(() => {
    cargarCitas()
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('children').select('id, name').order('name').then(({ data }: { data: any[] | null }) => { if (data) setNinos(data) })
    })
    // Auto-refresh cada minuto para detectar sesiones vencidas
    const interval = setInterval(() => { cargarCitas() }, 60 * 1000)
    return () => clearInterval(interval)
  }, [cargarCitas])

  // ── Edición inline de fecha/hora ──
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const iniciarEdicion = (a: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(a.id)
    setEditDate(a.appointment_date || '')
    setEditTime((a.appointment_time || '').slice(0, 5))
  }

  const cancelarEdicion = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(null)
    setEditDate('')
    setEditTime('')
  }

  const guardarEdicion = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editDate || !editTime) {
      toast.error('Fecha y hora son requeridas')
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch('/api/admin/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-locale': localStorage.getItem('vanty_locale') || 'es' },
        body: JSON.stringify({ id, appointment_date: editDate, appointment_time: editTime }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      // Update optimista local
      setApts(prev => prev.map(a => a.id === id
        ? { ...a, appointment_date: editDate, appointment_time: `${editTime}:00` }
        : a
      ))

      // Contar calendarios externos sincronizados
      const sync = json.calendarSync || {}
      const synced: string[] = []
      if (sync.google?.ok && sync.google?.updated) synced.push('Google')
      if (sync.microsoft?.ok && sync.microsoft?.updated) synced.push('Outlook')
      if (sync.parentGoogle?.ok && sync.parentGoogle?.updated) synced.push('Google padre')
      if (sync.parentMicrosoft?.ok && sync.parentMicrosoft?.updated) synced.push('Outlook padre')

      if (synced.length > 0) {
        toast.success(`Horario actualizado · Sincronizado en: ${synced.join(', ')}`)
      } else {
        toast.success('Horario actualizado')
      }
      cancelarEdicion()
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo actualizar')
    } finally {
      setSavingEdit(false)
    }
  }

  const eliminarCita = async (id:string, e:React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta cita?')) return
    try {
      const res = await fetch('/api/admin/appointments', { method:'DELETE', headers:{'Content-Type':'application/json', 'x-locale': localStorage.getItem('vanty_locale') || 'es'}, body: JSON.stringify({ id }) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success('Cita eliminada'); cargarCitas()
    } catch (err:any) { toast.error('Error: ' + err.message) }
  }

  const handleSave = async () => {
    if (tipoSesion==='individual' && !newApt.child_id) { toast.error('Selecciona un paciente'); return }
    if (tipoSesion==='grupal' && selectedParticipants.length===0) { toast.error('Selecciona participantes'); return }
    setIsSaving(true)
    try {
      // Obtener userId del admin para guardarlo en la cita (necesario para borrar del calendar)
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      const createdBy = currentSession?.user?.id || null

      let payload: any[]
      // Un solo specialist_id (el primero), nombres de todos concatenados en notes si hay varios
      const specialistIds = newApt.specialist_id ? newApt.specialist_id.split(',').filter(Boolean) : []
      const firstSpecialistId = specialistIds[0] || null
      const specialistNames = specialistIds.map(sid => especialistas.find(e=>e.id===sid)?.full_name).filter(Boolean).join(', ')
      const notasConEspecialistas = specialistIds.length > 1
        ? `[Especialistas: ${specialistNames}]${newApt.notes ? ' ' + newApt.notes : ''}`
        : newApt.notes
      const extra = { modalidad: modalidadCita, created_by: createdBy, specialist_id: firstSpecialistId }
      if (tipoSesion==='grupal') {
        payload = selectedParticipants.map(cid => ({ child_id:cid, appointment_date:newApt.date, appointment_time:newApt.time+':00', service_type:`${newApt.service} (Grupal: ${newApt.group_name||'Sin nombre'})`, is_group:true, group_name:newApt.group_name, notes:notasConEspecialistas, status:newApt.status, ...extra }))
      } else {
        payload = [{ child_id:newApt.child_id, appointment_date:newApt.date, appointment_time:newApt.time+':00', service_type:newApt.service, is_group:false, notes:notasConEspecialistas, status:newApt.status, ...extra }]
      }
      const res = await fetch('/api/admin/appointments', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      // ── Sync a Google Calendar y Microsoft Calendar ──────────────────────
      try {
        const { data: { session: calSession } } = await supabase.auth.getSession()
        if (calSession?.user?.id) {
          const savedApts = Array.isArray(json) ? json : (json.data || [])
          const firstApt  = savedApts[0]

          // FIX: usar el video_link que guardó el servidor en DB, no generar uno nuevo en el cliente
          // Esto garantiza que el link en el portal del padre y en el calendario sean el mismo
          const roomLink = modalidadCita === 'virtual'
            ? (firstApt?.video_link || firstApt?.videoLink || null)
            : null

          // Para sesión grupal, usar el primer participante para el sync del calendario del padre
          const childIdParaCalendario = tipoSesion === 'grupal'
            ? (selectedParticipants[0] || null)
            : newApt.child_id || null

          const aptData = {
            date:              newApt.date,
            time:              newApt.time,
            childId:           childIdParaCalendario,
            patientName:       tipoSesion === 'grupal'
              ? (newApt.group_name || 'Grupo')
              : ninos.find((n: any) => n.id === newApt.child_id)?.name || 'Paciente',
            serviceType:       newApt.service,
            notes:             newApt.notes,
            modality:          modalidadCita,
            groupName:         tipoSesion === 'grupal' ? (newApt.group_name || '') : null,
            sessionType:       tipoSesion,
            recurrencia:       recurrencia !== 'none' ? recurrencia : null,
            recurrenciaSemanas: recurrencia !== 'none' ? recurrenciaSemanas : null,
            videoLink:         roomLink,
          }

          // ── Sync calendarios ────────────────────────────────────────────
          // FIX: usar createdBy (el especialista/admin asignado) como userId para el sync,
          // NO calSession.user.id (que puede ser la secretaria sin calendario conectado)
          const syncUserId = createdBy || calSession.user.id

          const gcalStatus = await fetch(`/api/google-calendar?action=status&userId=${syncUserId}`)
          const gcalData   = await gcalStatus.json()
          const msStatus   = await fetch(`/api/microsoft-calendar?action=status&userId=${syncUserId}`)
          const msData     = await msStatus.json()

          // Avisar si ningún calendario está conectado para el especialista
          if (!gcalData.connected && !msData.connected) {
            toast.warning('El especialista no tiene Google ni Outlook Calendar conectado. La cita se guardó correctamente.')
          }

          // Construir lista de citas a sincronizar (una por participante en grupal)
          const aptsToSync = tipoSesion === 'grupal'
            ? savedApts.map((apt: any, i: number) => ({
                id:      apt.id,
                childId: selectedParticipants[i] || selectedParticipants[0] || null,
                name:    ninos.find((n: any) => n.id === selectedParticipants[i])?.name || aptData.patientName,
                // Cada cita grupal puede tener su propio video_link
                videoLink: apt.video_link || apt.videoLink || roomLink,
              }))
            : [{ id: firstApt?.id, childId: childIdParaCalendario, name: aptData.patientName, videoLink: roomLink }]

          let gcalSynced = 0
          let msSynced   = 0

          for (const aptSync of aptsToSync) {
            const syncData = {
              ...aptData,
              childId:    aptSync.childId,
              patientName: aptSync.name,
              videoLink:  aptSync.videoLink,
            }

            if (gcalData.connected) {
              const gcalRes = await fetch('/api/google-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action:        'sync-appointment',
                  userId:        syncUserId,
                  appointmentId: aptSync.id,
                  appointment:   syncData,
                }),
              })
              const gcalResult = await gcalRes.json()
              if (gcalResult.ok) gcalSynced++
              else console.error('[CalendarSync] GCal error:', gcalResult.error)
            }

            if (msData.connected) {
              const msRes = await fetch('/api/microsoft-calendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action:        'sync-appointment',
                  userId:        syncUserId,
                  appointmentId: aptSync.id,
                  appointment:   syncData,
                }),
              })
              const msResult = await msRes.json()
              if (msResult.ok) msSynced++
              else console.error('[CalendarSync] MS error:', msResult.error)
            }
          }

          if (gcalSynced > 0) toast.success(`${gcalSynced} cita${gcalSynced > 1 ? 's' : ''} añadida${gcalSynced > 1 ? 's' : ''} a Google Calendar`)
          if (msSynced > 0)   toast.success(`${msSynced} cita${msSynced > 1 ? 's' : ''} añadida${msSynced > 1 ? 's' : ''} a Outlook Calendar`)
        }
      } catch (calError) {
        console.error('Calendar sync error:', calError)
      }
      // Crear citas recurrentes si aplica
      if (recurrencia !== 'none' && newApt.date) {
        const diasSalto = recurrencia === 'weekly' ? 7 : 14
        const fechaBase = new Date(newApt.date + 'T12:00:00')
        const citasRecurrentes = []
        for (let i = 1; i < recurrenciaSemanas; i++) {
          const nextDate = new Date(fechaBase)
          nextDate.setDate(nextDate.getDate() + diasSalto * i)
          citasRecurrentes.push({
            child_id: newApt.child_id || null,
            date: nextDate.toISOString().split('T')[0],
            time: newApt.time,
            service: newApt.service,
            notes: newApt.notes || '',
            status: newApt.status,
            modalidad: modalidadCita,
            is_group: tipoSesion === 'grupal',
            group_name: newApt.group_name || null,
            participants: tipoSesion === 'grupal' ? selectedParticipants : null,
          })
        }
        if (citasRecurrentes.length > 0) {
          await supabase.from('appointments').insert(citasRecurrentes)
        }
        toast.success(`${recurrenciaSemanas} ${t('agenda.citasRecurrenciaMensaje').replace('{tipo}', recurrencia === 'weekly' ? t('agenda.semanales') : t('agenda.quincenales'))}`)
      } else {
        toast.success(`Cita ${modalidadCita} agendada`)
      }
      resetForm(); cargarCitas()
    } catch (err:any) { toast.error('Error: ' + err.message) }
    finally { setIsSaving(false) }
  }

  const handleStartVideoCall = async (apt: any) => {
    setStartingCall(apt.id)
    try {
      const res = await fetch('/api/video-call', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ appointment_id: apt.id, child_id: apt.child_id, initiated_by: 'admin' , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const data = await res.json()
      if (data.limitReached) { toast.error('Límite mensual de 10,000 min alcanzado. Se reinicia el próximo mes.'); return }
      if (data.error) throw new Error(data.error)
      setVideoSession({ roomUrl: data.room_url, sessionId: data.session_id, appointmentId: apt.id })
      toast.success('Sala creada · Padre notificado')
    } catch (err:any) { toast.error('Error: ' + err.message) }
    finally { setStartingCall(null) }
  }

  const resetForm = () => {
    setShow(false); setTipoSesion('individual'); setModalidadCita('presencial'); setRecurrencia('none'); setRecurrenciaSemanas(4)
    setNewApt({ child_id:'', date:new Date().toISOString().split('T')[0], time:'09:00', service:'Terapia ABA', notes:'', group_name:'', status:'confirmed', specialist_id:'' })
    setSelectedParticipants([])
  }

  const toggleParticipant = (id:string) => setSelectedParticipants(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id])
  useEffect(() => {
    const today = new Date()
    setCurrentMonth(today)
    setNewApt(prev => ({ ...prev, date: today.toISOString().split('T')[0] }))
  }, [])

  const getDaysInMonth = (d:Date) => ({ firstDay: new Date(d.getFullYear(),d.getMonth(),1).getDay(), daysInMonth: new Date(d.getFullYear(),d.getMonth()+1,0).getDate() })
  const { firstDay, daysInMonth } = currentMonth ? getDaysInMonth(currentMonth) : { firstDay: 0, daysInMonth: 31 }
  const monthYear = currentMonth ? currentMonth.toLocaleString(toBCP47(locale),{month:'long',year:'numeric'}) : ''
  const todayStr = new Date().toISOString().split('T')[0]
  const getAptsForDay = (day:number): any[] => {
    if (!currentMonth) return []
    const ds = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return apts.filter(a => a.appointment_date===ds)
  }
  const filteredApts = apts.filter(a => {
    const matchDate = !filterDate || a.appointment_date===filterDate
    const matchStatus = filterStatus==='todos' || (a.status||'confirmed')===filterStatus
    const matchEsp = filterEspecialista==='todos' || a.specialist_id===filterEspecialista
    return matchDate && matchStatus && matchEsp
  }).sort((a,b) => ((a.appointment_date||'')+(a.appointment_time||'')).localeCompare((b.appointment_date||'')+(b.appointment_time||'')))

  const todayApts = apts.filter(a => a.appointment_date===todayStr)
  const weekApts = apts.filter(a => {
    const d = new Date(a.appointment_date)
    const hoy = new Date()
    // Lunes de la semana actual
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
    lunes.setHours(0, 0, 0, 0)
    // Domingo de la semana actual
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    domingo.setHours(23, 59, 59, 999)
    return d >= lunes && d <= domingo
  })
  const virtualApts = apts.filter(a => a.modalidad==='virtual')

  return (
    <>
      {videoSession && (
        <VideoCallModal
          roomUrl={videoSession.roomUrl}
          sessionId={videoSession.sessionId}
          appointmentId={videoSession.appointmentId}
          participantName="Terapeuta – Neuropsicología y Terapias SANTI"
          onClose={() => { setVideoSession(null); cargarCitas() }}
        />
      )}

      {showReservas && (
        <ReservasOnlinePanel
          ninos={ninos}
          especialistas={especialistas}
          onClose={() => { setShowReservas(false); cargarCitas() }}
        />
      )}

      <div className="min-h-full overflow-y-auto px-5 pt-5 pb-8 animate-fade-in-up" style={{ background: "var(--background)" }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          {/* Título */}
          <div>
            <h2 className="font-bold text-2xl md:text-3xl tracking-tight flex items-center gap-3" style={{ color: "var(--text-primary)" }}>
              <div className="p-2.5 rounded-2xl flex-shrink-0" style={{ background: "rgba(37,99,235,0.15)" }}>
                <Calendar className="text-sky-500" size={28}/>
              </div>
              Agenda
            </h2>
            <p className="text-slate-400 text-sm font-medium mt-1 ml-1">
              {apts.length} citas · {todayApts.length} hoy · {virtualApts.length} virtuales
            </p>
          </div>

          {/* Controles — una sola fila */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <GoogleCalendarSync />
            <MicrosoftCalendarSync />
            <div className="w-px h-6 bg-slate-200 dark:bg-[#30363d] hidden sm:block" />
            <button
              onClick={() => setShowReservas(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm
                border-2 border-sky-500 text-sky-600 hover:bg-sky-50 transition-all whitespace-nowrap"
            >
              <CalendarClock size={16}/> Reservas online
            </button>
            <button
              onClick={() => setShow(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-white
                bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-sky-700
                shadow-lg shadow-sky-500/25 transition-all whitespace-nowrap"
            >
              <Plus size={16}/> {t('agenda.nuevaCita2')}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            {label:'Total',       value:apts.length,        color:'#0284c7', Icon:Calendar},
            {label:'Hoy',         value:todayApts.length,   color:'#10b981', Icon:Clock},
            {label:'Esta semana', value:weekApts.length,    color:'#06b6d4', Icon:Calendar},
            {label:'Virtuales',   value:virtualApts.length, color:'#0ea5e9', Icon:Video},
          ].map(({label,value,color,Icon}) => (
            <div key={label} className="group rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: `linear-gradient(157deg, ${color}0d 0%, var(--card) 46%)`, border: "1px solid var(--card-border)", boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `${color}1a`, color }}>
                  <Icon size={15}/>
                </div>
              </div>
              <p className="text-3xl font-extrabold tabular-nums tracking-tight" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Calendario */}
          <div className="xl:col-span-8 rounded-3xl shadow-sm overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: "var(--card-border)" }}>
              <button onClick={() => currentMonth && setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1))} className="p-2 rounded-xl hover:bg-slate-100"><ChevronLeft size={20}/></button>
              <h3 className="font-bold text-lg capitalize" style={{ color: "var(--text-primary)" }}>{monthYear}</h3>
              <button onClick={() => currentMonth && setCurrentMonth(new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1))} className="p-2 rounded-xl hover:bg-slate-100"><ChevronRight size={20}/></button>
            </div>
            <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--card-border)" }}>
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => <div key={d} className="py-3 text-center text-xs font-bold text-slate-400">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({length:firstDay}).map((_,i) => <div key={`e${i}`} className="min-h-[80px] border-b border-r border-slate-50 bg-slate-50/30"/>)}
              {Array.from({length:daysInMonth},(_,i)=>i+1).map(day => {
                if (!currentMonth) return null
                const dayApts = getAptsForDay(day)
                const ds = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                const isToday=ds===todayStr; const isPast=ds<todayStr
                return (
                  <div key={day} onClick={()=>{setNewApt(p=>({...p,date:ds}));setShow(true)}} className={`min-h-[80px] border-b border-r p-2 cursor-pointer transition-all group ${isToday?'ring-2 ring-inset ring-sky-500':''}`} style={{ borderColor: 'var(--card-border)', background: isToday ? 'rgba(37,99,235,0.08)' : isPast ? 'var(--muted-bg)' : 'var(--card)' }}>
                    <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1 ${isToday?'bg-sky-600 text-white':isPast?'text-slate-300':'text-slate-700 group-hover:bg-sky-100 group-hover:text-sky-700'}`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayApts.slice(0,2).map(apt => (
                        <div key={apt.id} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md truncate flex items-center gap-1 ${apt.modalidad==='virtual'?'bg-sky-100 text-sky-700':apt.is_group?'bg-sky-100 text-sky-700':'bg-sky-100 text-sky-700'}`}>
                          {apt.modalidad==='virtual' && <Video size={8}/>}
                          {apt.appointment_time?.slice(0,5)} {apt.children?.name||'?'}
                        </div>
                      ))}
                      {dayApts.length>2 && <div className="text-[9px] text-slate-400 font-bold pl-1">+{dayApts.length-2} más</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel derecho */}
          <div className="xl:col-span-4 space-y-4">

            {/* Filtros */}
            <div className="rounded-2xl p-5 shadow-sm space-y-3" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{t('ui.filters')}</p>
              <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="w-full p-3 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }}/>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="w-full p-3 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }}>
                <option value="todos">{t('ui.all_statuses')}</option>
                <option value="confirmed">{t('ui.confirmed_pl')}</option>
                <option value="pending">{t('ui.pending_pl')}</option>
                <option value="completed">{t('ui.completed_pl')}</option>
                <option value="cancelled">{t('ui.cancelled_pl')}</option>
              </select>
              <select value={filterEspecialista} onChange={e=>setFilterEspecialista(e.target.value)} className="w-full p-3 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }}>
                <option value="todos">Todos los especialistas</option>
                {especialistas.map(e=><option key={e.id} value={e.id}>{e.full_name}{e.specialty ? ` · ${e.specialty}` : ''}</option>)}
              </select>
              {(filterDate||filterStatus!=='todos'||filterEspecialista!=='todos') && <button onClick={()=>{setFilterDate('');setFilterStatus('todos');setFilterEspecialista('todos')}} className="text-xs text-sky-600 font-bold hover:underline">{t('ui.clear_filters')}</button>}
            </div>

            {/* Lista citas */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
              <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Citas ({filteredApts.length})</p>
              </div>
              <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-50">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-sky-400" size={28}/></div>
                ) : filteredApts.length===0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <div className="p-4 bg-slate-100 rounded-2xl mb-3"><Calendar size={32} className="text-slate-300"/></div>
                    <p className="font-bold text-slate-400 text-sm">{t('ui.no_appointments')}</p>
                  </div>
                ) : filteredApts.map(a => {
                  const sc = STATUS_CONFIG[a.status||'confirmed']||STATUS_CONFIG.confirmed
                  const isVirtual = a.modalidad==='virtual'
                  const isUpcoming = a.appointment_date>=todayStr && a.status!=='cancelled' && a.status!=='completed'
                  return (
                    <div key={a.id} className="p-4 transition-all group" style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>{sc.label}</span>
                            {isVirtual
                              ? <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200 uppercase flex items-center gap-0.5"><Video size={9}/> {t('agenda.virtual')}</span>
                              : <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200 uppercase flex items-center gap-0.5"><MapPin size={9}/> {t('agenda.presencial')}</span>
                            }
                            {a.is_group && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100 uppercase">Grupal</span>}
                          </div>
                          <p className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{a.children?.name||'Paciente'}</p>
                          <p className="text-xs font-medium mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{a.service_type}</p>
                          {a.specialist?.full_name && (
                            <p className="text-[11px] font-semibold mt-0.5 flex items-center gap-1 truncate" style={{ color: '#0284c7' }}>
                              <User size={10}/>
                              <span className="truncate">
                                {a.specialist.full_name}
                                {a.specialist.specialty && <span className="font-normal opacity-75"> · {a.specialist.specialty}</span>}
                              </span>
                            </p>
                          )}
                          {!a.specialist?.full_name && a.specialist_id && (
                            <p className="text-[11px] italic mt-0.5 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <User size={10}/> Especialista no encontrado
                            </p>
                          )}
                          {editingId === a.id ? (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Calendar size={11} style={{ color: 'var(--text-muted)' }} />
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={e => setEditDate(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="px-2 py-1 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-sky-400"
                                  style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)' }}
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                                <input
                                  type="time"
                                  value={editTime}
                                  onChange={e => setEditTime(e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  className="px-2 py-1 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-sky-400"
                                  style={{ background: 'var(--input-bg)', border: '1.5px solid var(--input-border)', color: 'var(--text-primary)' }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 mt-1.5 text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                              <span className="flex items-center gap-1"><Calendar size={11}/>{a.appointment_date}</span>
                              <span className="flex items-center gap-1"><Clock size={11}/>{a.appointment_time?.slice(0,5)}</span>
                            </div>
                          )}
                          {a.notes && <p className="text-[10px] text-slate-400 mt-1 italic truncate">{a.notes}</p>}

                          {/* Cronómetro 45 min */}
                          {isUpcoming && (
                            <SessionTimer apt={a} onExpired={handleExpired} />
                          )}

                          {/* Botón iniciar videollamada */}
                          {isVirtual && isUpcoming && (
                            <button
                              onClick={() => handleStartVideoCall(a)}
                              disabled={startingCall===a.id}
                              className="mt-2.5 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                              style={{background:'linear-gradient(135deg,#0284c7,#0ea5e9)',boxShadow:'0 3px 12px rgba(99,102,241,0.35)'}}
                            >
                              {startingCall===a.id
                                ? <><Loader2 size={12} className="animate-spin"/> Iniciando...</>
                                : <><Video size={12}/> Iniciar videollamada</>
                              }
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {editingId === a.id ? (
                            <>
                              <button
                                onClick={e => guardarEdicion(a.id, e)}
                                disabled={savingEdit}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all disabled:opacity-50"
                                title="Guardar"
                              >
                                {savingEdit ? <Loader2 size={14} className="animate-spin"/> : <Check size={14}/>}
                              </button>
                              <button
                                onClick={cancelarEdicion}
                                disabled={savingEdit}
                                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-all"
                                title="Cancelar"
                              >
                                <X size={14}/>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={e => iniciarEdicion(a, e)}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-slate-100 text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all"
                                title="Editar horario"
                              >
                                <Pencil size={14}/>
                              </button>
                              <button
                                onClick={e=>eliminarCita(a.id,e)}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                title="Eliminar"
                              >
                                <Trash2 size={14}/>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal Nueva Cita ── */}
        {show && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)" }}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl flex items-center gap-2" style={{ color: "var(--text-primary)" }}><Plus size={20} className="text-sky-600"/> {t('agenda.nuevaCita')}</h3>
                <button onClick={resetForm} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button>
              </div>

              <div className="space-y-5">
                {/* Tipo sesión */}
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('agenda.tipoSesion2')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['individual','grupal'] as const).map(tipo => (
                      <button key={tipo} onClick={()=>{setTipoSesion(tipo);setSelectedParticipants([]);setNewApt(p=>({...p,child_id:''}))}}
                        className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${tipoSesion===tipo?(tipo==='individual'?'bg-sky-600 text-white border-sky-600 shadow-lg shadow-sky-200':'bg-sky-600 text-white border-sky-600 shadow-lg shadow-sky-200'):'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {tipo==='individual'?<><User size={16}/> Individual</>:<><Users size={16}/> Grupal</>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modalidad */}
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('agenda.modalidad')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      {value:'presencial',icon:<MapPin size={16}/>,label:'Presencial',active:'bg-slate-800 text-white border-slate-800 shadow-lg shadow-slate-200'},
                      {value:'virtual',   icon:<Video size={16}/>, label:'Virtual 📹', active:'bg-sky-600 text-white border-sky-600 shadow-lg shadow-sky-200'},
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={()=>setModalidadCita(opt.value)}
                        className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all flex items-center justify-center gap-2 ${modalidadCita===opt.value?opt.active:'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                  {modalidadCita==='virtual' && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2.5 bg-sky-50 rounded-xl border border-sky-100">
                      <Video size={13} className="text-sky-500 shrink-0 mt-0.5"/>
                      <p className="text-xs text-sky-600 font-semibold leading-relaxed">Al iniciar la sesión se genera el link automáticamente y el padre recibe una notificación para unirse.</p>
                    </div>
                  )}
                </div>

                {/* Paciente / Grupo */}
                {tipoSesion==='individual' && (
                  <div>
                    <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('agenda.pacienteStar')}</label>
                    <select className="w-full p-4 rounded-xl text-sm font-bold outline-none focus:border-sky-500 transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }} onChange={e=>setNewApt(p=>({...p,child_id:e.target.value}))} value={newApt.child_id}>
                      <option value="">{t('ui.select_patient_option')}</option>
                      {ninos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                )}
                {tipoSesion==='grupal' && (
                  <>
                    <div>
                      <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('agenda.nombreGrupo')}</label>
                      <input type="text" placeholder="Ej: Grupo Habilidades Sociales A" className="w-full p-4 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }} value={newApt.group_name} onChange={e=>setNewApt(p=>({...p,group_name:e.target.value}))}/>
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>Participantes ({selectedParticipants.length})</label>
                      <div className="max-h-48 overflow-y-auto bg-slate-50 rounded-xl border-2 border-slate-200 p-3 space-y-2">
                        {ninos.map(n => (
                          <label key={n.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedParticipants.includes(n.id)?'bg-sky-600 text-white shadow-md':'bg-white hover:bg-sky-50 border border-slate-100'}`}>
                            <input type="checkbox" className="hidden" checked={selectedParticipants.includes(n.id)} onChange={()=>toggleParticipant(n.id)}/>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${selectedParticipants.includes(n.id)?'bg-white border-white':'border-slate-300'}`}>{selectedParticipants.includes(n.id)&&<CheckCircle2 size={14} className="text-sky-600"/>}</div>
                            <span className="font-bold text-sm">{n.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Servicio, fecha, hora, estado */}
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>Servicio</label>
                  <input type="text" className="w-full p-4 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }} value={newApt.service} onChange={e=>setNewApt(p=>({...p,service:e.target.value}))} placeholder="Ej: Terapia ABA, Evaluación..." />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>Especialista asignado <span style={{color:'var(--text-muted)',fontWeight:400,fontSize:10}}>(puedes elegir varios)</span></label>
                  <div className="flex flex-wrap gap-2 p-3 rounded-xl min-h-[52px]" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)" }}>
                    {newApt.specialist_id && newApt.specialist_id.split(',').filter(Boolean).map(sid => {
                      const esp = especialistas.find(e => e.id === sid)
                      return esp ? (
                        <span key={sid} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold" style={{background:'var(--primary)',color:'#fff'}}>
                          {esp.full_name.split(' ')[0]}
                          <button type="button" onClick={()=>setNewApt(p=>({...p,specialist_id:p.specialist_id.split(',').filter(id=>id!==sid).join(',')}))} className="ml-1 opacity-80 hover:opacity-100">×</button>
                        </span>
                      ) : null
                    })}
                    <select className="flex-1 min-w-[140px] text-sm font-bold outline-none bg-transparent" style={{color:'var(--text-primary)'}}
                      value="" onChange={e=>{
                        const v = e.target.value
                        if(!v) return
                        const current = newApt.specialist_id ? newApt.specialist_id.split(',').filter(Boolean) : []
                        if(!current.includes(v)) setNewApt(p=>({...p,specialist_id:[...current,v].join(',')}))
                      }}>
                      <option value="">+ Agregar especialista...</option>
                      {especialistas.filter(e=>!newApt.specialist_id?.split(',').includes(e.id)).map(e=><option key={e.id} value={e.id}>{e.full_name}{e.specialty ? ` · ${e.specialty}` : ''}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('agenda.fechaStar')}</label>
                    <input type="date" className="w-full p-4 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }} value={newApt.date} onChange={e=>setNewApt(p=>({...p,date:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('agenda.horaStar')}</label>
                    <input type="time" className="w-full p-4 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }} value={newApt.time} onChange={e=>setNewApt(p=>({...p,time:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>{t('common.estado')}</label>
                  <select className="w-full p-4 rounded-xl text-sm font-bold outline-none transition-all" style={{ background: "var(--input-bg)", border: "2px solid var(--input-border)", color: "var(--text-primary)" }} value={newApt.status} onChange={e=>setNewApt(p=>({...p,status:e.target.value}))}>
                    <option value="confirmed">{t('agenda.confirmada')}</option>
                    <option value="pending">{t('common.pendiente')}</option>
                    <option value="completed">{t('ui.completed_status')}</option>
                    <option value="cancelled">{t('agenda.cancelada')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-2" style={{ color: "var(--text-muted)" }}>Notas (opcional)</label>
                  <textarea rows={2} placeholder="Observaciones..." className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all resize-none" value={newApt.notes} onChange={e=>setNewApt(p=>({...p,notes:e.target.value}))}/>
                </div>

                {/* Recurrencia */}
                <div className="rounded-xl border-2 p-4" style={{ background: "var(--muted-bg)", borderColor: "var(--card-border)" }}>
                  <label className="text-xs font-bold block mb-3" style={{ color: "var(--text-muted)" }}>
                    🔄 Repetir cita
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {([
                      { value: 'none',      label: 'No repetir' },
                      { value: 'weekly',    label: t('agenda.semanal') },
                      { value: 'biweekly',  label: 'Quincenal' },
                    ] as const).map(opt => (
                      <button key={opt.value} onClick={() => setRecurrencia(opt.value)}
                        className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${recurrencia === opt.value ? 'border-sky-500 text-sky-600' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        style={{ background: recurrencia === opt.value ? 'rgba(37,99,235,0.08)' : 'var(--card)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {recurrencia !== 'none' && (
                    <div>
                      <label className="text-[11px] font-bold mb-1 block" style={{ color: "var(--text-muted)" }}>{t('agenda.cantRepeticiones')}</label>
                      <select value={recurrenciaSemanas} onChange={e => setRecurrenciaSemanas(Number(e.target.value))}
                        className="w-full p-3 rounded-xl text-sm font-bold outline-none border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                        {[2,3,4,6,8,12].map(n => <option key={n} value={n}>{n} citas ({recurrencia === 'weekly' ? `${n} semanas` : `${n*2} semanas`})</option>)}
                      </select>
                      <p className="text-[10px] mt-1.5 font-medium text-sky-500">
                        Se crearán {recurrenciaSemanas} citas {recurrencia === 'weekly' ? 'cada semana' : 'cada 2 semanas'} a partir de la fecha seleccionada.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={resetForm} className="flex-1 py-4 text-slate-400 font-bold uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl transition-all border-2 border-slate-100">{t('common.cancelar')}</button>
                  <button onClick={handleSave} disabled={isSaving}
                    className={`flex-[2] py-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-white ${modalidadCita==='virtual'?'bg-gradient-to-r from-sky-600 to-cyan-600 shadow-sky-200':tipoSesion==='grupal'?'bg-gradient-to-r from-sky-600 to-cyan-600 shadow-sky-200':'bg-gradient-to-r from-sky-600 to-cyan-600 shadow-sky-200'}`}>
                    {isSaving?<Loader2 size={18} className="animate-spin"/>:modalidadCita==='virtual'?<Video size={18}/>:<Plus size={18}/>}
                    {isSaving?'Guardando...':modalidadCita==='virtual'?'Agendar Virtual':tipoSesion==='grupal'?'Agendar Grupo':'Confirmar Cita'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
export default MonthlyCalendarView
