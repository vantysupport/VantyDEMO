'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays, Download, Send, Loader2, ChevronLeft, ChevronRight,
  Users, Clock, CheckCircle2, RefreshCw, Printer, Mail
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const DIAS_SEMANA = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const DIAS_ABREV  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_COLOR: Record<string, string> = {
  confirmed: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  pending:   'bg-amber-50 border-amber-200 text-amber-700',
  cancelled: 'bg-red-50 border-red-200 text-red-500 line-through',
  completed: 'bg-blue-50 border-blue-200 text-blue-700',
}

function getMondayOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

export default function SecretariaCronograma() {
  const toast = useToast()
  const [mode, setMode] = useState<'semana' | 'mes'>('semana')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [apts, setApts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const weekStart = getMondayOfWeek(referenceDate)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)

  const monthYear = { month: referenceDate.getMonth(), year: referenceDate.getFullYear() }

  const rangeStart = mode === 'semana' ? weekStart : new Date(monthYear.year, monthYear.month, 1)
  const rangeEnd   = mode === 'semana' ? weekEnd   : new Date(monthYear.year, monthYear.month + 1, 0)

  const fmtDate = (d: Date) => d.toISOString().split('T')[0]

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('appointments')
        .select('*, children(name, profiles!children_parent_id_fkey(full_name, email))')
        .gte('appointment_date', fmtDate(rangeStart))
        .lte('appointment_date', fmtDate(rangeEnd))
        .neq('status', 'cancelled')
        .order('appointment_date')
        .order('appointment_time')
      setApts(data || [])
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [rangeStart.toISOString(), rangeEnd.toISOString()])

  useEffect(() => { cargar() }, [cargar])

  const navigate = (dir: 1 | -1) => {
    const d = new Date(referenceDate)
    if (mode === 'semana') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setReferenceDate(d)
  }

  // Group by day
  const byDay: Record<string, any[]> = {}
  apts.forEach(a => {
    if (!byDay[a.appointment_date]) byDay[a.appointment_date] = []
    byDay[a.appointment_date].push(a)
  })

  // Sorted unique days in range
  const daysInRange: string[] = []
  if (mode === 'semana') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i)
      daysInRange.push(fmtDate(d))
    }
  } else {
    const daysInMonth = new Date(monthYear.year, monthYear.month + 1, 0).getDate()
    for (let i = 1; i <= daysInMonth; i++) {
      daysInRange.push(`${monthYear.year}-${String(monthYear.month + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`)
    }
  }

  const totalSessions = apts.filter(a => a.status !== 'cancelled').length
  const uniquePatients = [...new Set(apts.map(a => a.child_id))].length

  const handlePrint = () => window.print()



  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Cronograma de Sesiones</h2>
          <p className="text-sm text-slate-400 mt-0.5">Vista semanal y mensual de citas programadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-bold transition-colors">
            <Printer size={15} /> Imprimir
          </button>

        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            {(['semana','mes'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${mode === m ? 'bg-white shadow-sm text-violet-700' : 'text-slate-500 hover:text-slate-700'}`}>
                {m === 'semana' ? 'Semanal' : 'Mensual'}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600">
              <ChevronLeft size={18} />
            </button>
            <span className="font-black text-slate-800 min-w-[180px] text-center text-sm">
              {mode === 'semana'
                ? `${weekStart.getDate()} ${MESES[weekStart.getMonth()].slice(0,3)} — ${weekEnd.getDate()} ${MESES[weekEnd.getMonth()].slice(0,3)} ${weekEnd.getFullYear()}`
                : `${MESES[monthYear.month]} ${monthYear.year}`
              }
            </span>
            <button onClick={() => navigate(1)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600">
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setReferenceDate(new Date())} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">
              Hoy
            </button>
            <button onClick={cargar} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 font-bold text-slate-600">
              <CalendarDays size={15} className="text-violet-500" /> {totalSessions} sesiones
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-600">
              <Users size={15} className="text-violet-500" /> {uniquePatients} pacientes
            </span>
          </div>
        </div>
      </div>

      {/* Schedule grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-violet-400" />
        </div>
      ) : mode === 'semana' ? (
        /* WEEKLY VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-100">
            {daysInRange.map((dateStr, idx) => {
              const date = new Date(dateStr + 'T00:00:00')
              const isToday = dateStr === fmtDate(new Date())
              const count = byDay[dateStr]?.length || 0
              return (
                <div key={dateStr} className={`px-2 py-3 text-center border-r border-slate-100 last:border-0 ${isToday ? 'bg-violet-50' : ''}`}>
                  <p className={`text-[10px] font-black uppercase tracking-wide ${isToday ? 'text-violet-600' : 'text-slate-400'}`}>{DIAS_ABREV[idx]}</p>
                  <p className={`text-lg font-black ${isToday ? 'text-violet-700' : 'text-slate-700'}`}>{date.getDate()}</p>
                  {count > 0 && <span className="text-[9px] font-bold text-violet-500">{count} cita{count !== 1 ? 's' : ''}</span>}
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[300px]">
            {daysInRange.map(dateStr => {
              const dayApts = byDay[dateStr] || []
              const isToday = dateStr === fmtDate(new Date())
              return (
                <div key={dateStr} className={`p-2 space-y-1.5 ${isToday ? 'bg-violet-50/50' : ''}`}>
                  {dayApts.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-[10px] text-slate-200 text-center">—</p>
                    </div>
                  ) : dayApts.map(apt => (
                    <div key={apt.id} className={`rounded-lg px-2 py-1.5 border text-[10px] font-bold leading-tight ${STATUS_COLOR[apt.status] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <p className="truncate">{apt.children?.name}</p>
                      <p className="font-normal opacity-70 flex items-center gap-0.5">
                        <Clock size={8} /> {apt.appointment_time?.slice(0,5)}
                      </p>
                      {apt.service_type && <p className="font-normal opacity-60 truncate">{apt.service_type}</p>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* MONTHLY VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {daysInRange.filter(d => byDay[d]?.length > 0).length === 0 ? (
              <div className="py-16 text-center text-slate-300">
                <CalendarDays size={36} className="mx-auto mb-3" />
                <p className="font-semibold">No hay citas programadas para este mes</p>
              </div>
            ) : daysInRange.filter(d => byDay[d]?.length > 0).map(dateStr => {
              const date = new Date(dateStr + 'T00:00:00')
              const isToday = dateStr === fmtDate(new Date())
              const dayApts = byDay[dateStr] || []
              const dayOfWeek = date.getDay()
              return (
                <div key={dateStr} className={`flex gap-4 px-5 py-4 ${isToday ? 'bg-violet-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                  <div className={`w-12 flex-shrink-0 flex flex-col items-center justify-center rounded-xl py-2 ${isToday ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <span className="text-[9px] font-bold uppercase">{DIAS_ABREV[dayOfWeek === 0 ? 6 : dayOfWeek - 1]}</span>
                    <span className="text-lg font-black leading-none">{date.getDate()}</span>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {dayApts.map(apt => (
                      <div key={apt.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${STATUS_COLOR[apt.status] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <Clock size={10} /> {apt.appointment_time?.slice(0,5)}
                        <span className="font-black">{apt.children?.name}</span>
                        {apt.service_type && <span className="font-normal opacity-70">· {apt.service_type}</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex-shrink-0 text-xs font-bold text-slate-400 self-center">
                    {dayApts.length} sesión{dayApts.length !== 1 ? 'es' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {!loading && totalSessions > 0 && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-2xl p-5">
          <h3 className="font-black text-violet-800 mb-3 text-sm">Resumen del período</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total sesiones', value: totalSessions, icon: CalendarDays },
              { label: 'Pacientes únicos', value: uniquePatients, icon: Users },
              { label: 'Confirmadas', value: apts.filter(a => a.status === 'confirmed').length, icon: CheckCircle2 },
              { label: 'Pendientes', value: apts.filter(a => a.status === 'pending').length, icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="text-center">
                <Icon size={18} className="mx-auto mb-1 text-violet-500" />
                <p className="text-2xl font-black text-violet-800">{value}</p>
                <p className="text-xs font-medium text-violet-600">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
