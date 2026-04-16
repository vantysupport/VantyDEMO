'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, Users, Calendar, Loader2, Bell, RefreshCw, Clock, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface Cita {
  id: string
  appointment_date?: string
  appointment_time?: string
  child_name: string
  parent_id: string
}

interface Familia {
  id: string
  nombre: string
  email: string
  phone: string
  pacientes: string[]
  citas: number
}

function MiniKPI({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: color }} />
      <div className="flex items-center gap-3 pl-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon size={15} style={{ color }} />
        </div>
        <div>
          <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
        </div>
      </div>
    </div>
  )
}

function getChild(a: any): { name: string; parent_id: string } {
  const ch = Array.isArray(a.children) ? a.children[0] : a.children
  return { name: ch?.name || '', parent_id: ch?.parent_id || '' }
}

export default function SecretariaComunicacion({ profile }: { profile: any }) {
  const toast = useToast()
  const [tab, setTab]           = useState<'recordatorios' | 'familias' | 'masivo'>('recordatorios')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState<string | null>(null)
  const [citasHoy, setCitasHoy] = useState<Cita[]>([])
  const [citasSem, setCitasSem] = useState<Cita[]>([])
  const [familias, setFamilias] = useState<Familia[]>([])
  const [mensaje, setMensaje]   = useState('')
  const [canal, setCanal]       = useState('whatsapp')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const hoy = new Date().toISOString().split('T')[0]
      const d   = new Date(); const dow = d.getDay()
      const lun = new Date(d); lun.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
      const dom = new Date(lun); dom.setDate(lun.getDate() + 6)

      const [{ data: hoyRaw }, { data: semRaw }, { data: padres }] = await Promise.all([
        supabase.from('appointments').select('id, appointment_time, children(name, parent_id)').eq('appointment_date', hoy).order('appointment_time'),
        supabase.from('appointments').select('id, appointment_date, appointment_time, children(name, parent_id)').gte('appointment_date', lun.toISOString().split('T')[0]).lte('appointment_date', dom.toISOString().split('T')[0]).order('appointment_date').order('appointment_time'),
        supabase.from('profiles').select('id, full_name, email, phone').eq('role', 'padre'),
      ])

      const toCita = (a: any, date?: string): Cita => {
        const ch = getChild(a)
        return { id: a.id, appointment_date: date || a.appointment_date, appointment_time: a.appointment_time, child_name: ch.name, parent_id: ch.parent_id }
      }

      const hoyList = (hoyRaw || []).map(a => toCita(a))
      const semList = (semRaw  || []).map(a => toCita(a))
      setCitasHoy(hoyList)
      setCitasSem(semList)

      const famMap: Record<string, Familia> = {}
      ;(padres || []).forEach(p => { famMap[p.id] = { id: p.id, nombre: p.full_name || 'Padre/Tutor', email: p.email || '', phone: p.phone || '', pacientes: [], citas: 0 } })
      semList.forEach(c => {
        if (c.parent_id && famMap[c.parent_id]) {
          if (c.child_name && !famMap[c.parent_id].pacientes.includes(c.child_name)) famMap[c.parent_id].pacientes.push(c.child_name)
          famMap[c.parent_id].citas++
        }
      })
      setFamilias(Object.values(famMap).filter(f => f.citas > 0))
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const notify = async (parentId: string, childName: string, time?: string, type = 'reminder', msg?: string) => {
    try {
      const res = await fetch('/api/whatsapp-service/notify-parent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, childName, date: new Date().toISOString().split('T')[0], time, type, message: msg }),
      })
      return res.ok
    } catch { return false }
  }

  const sendReminder = async (c: Cita) => {
    if (!c.parent_id) { toast.error('El paciente no tiene tutor vinculado'); return }
    setSending(c.id)
    const ok = await notify(c.parent_id, c.child_name, c.appointment_time)
    toast[ok ? 'success' : 'warning'](`${ok ? 'Recordatorio enviado' : 'Registrado (sin WhatsApp)'} — ${c.child_name}`)
    setSending(null)
  }

  const sendAll = async () => {
    if (!citasHoy.length) return
    setSending('all'); let ok = 0
    for (const c of citasHoy) { if (!c.parent_id) continue; if (await notify(c.parent_id, c.child_name, c.appointment_time)) ok++ }
    toast.success(`${ok}/${citasHoy.length} recordatorios enviados`)
    setSending(null)
  }

  const sendSchedule = async (fam: Familia) => {
    if (!fam.phone && !fam.email) { toast.error('La familia no tiene contacto registrado'); return }
    setSending(fam.id)
    const detalle = citasSem.filter(c => c.parent_id === fam.id).map(c => {
      const d = new Date((c.appointment_date || '') + 'T12:00:00')
      return `${d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' })} ${c.appointment_time?.slice(0,5)} — ${c.child_name}`
    }).join('\n')
    const ok = await notify(fam.id, fam.pacientes.join(', '), undefined, 'schedule', `Cronograma:\n${detalle}`)
    toast[ok ? 'success' : 'warning'](`${ok ? 'Cronograma enviado' : 'Registrado (sin WhatsApp)'} — ${fam.nombre}`)
    setSending(null)
  }

  const sendMasivo = async () => {
    if (!mensaje.trim()) { toast.error('Escribe un mensaje'); return }
    if (!familias.length) { toast.error('No hay familias con citas'); return }
    setSending('masivo'); let ok = 0
    for (const fam of familias) {
      const msg = mensaje.replace('{nombre}', fam.pacientes[0] || '').replace('{tutor}', fam.nombre)
      if (await notify(fam.id, fam.pacientes.join(', '), undefined, 'custom', msg)) ok++
    }
    toast.success(`Enviado a ${ok}/${familias.length} familias`)
    setMensaje(''); setSending(null)
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none bg-[var(--muted-bg)] border-[var(--card-border)] text-[var(--text-primary)] focus:border-blue-500"

  return (
    <div className="space-y-5">
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #3a68a0, #8b5cf6, #10b981)' }} />
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Comunicación con familias</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Recordatorios, cronogramas y mensajes a padres/tutores</p>
          </div>
          <button onClick={cargar} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)', background: 'var(--muted-bg)' }}><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MiniKPI icon={Calendar} label="Citas hoy"          value={citasHoy.length} color="#3b82f6" />
        <MiniKPI icon={Users}    label="Citas esta semana"  value={citasSem.length}  color="#8b5cf6" />
        <MiniKPI icon={Bell}     label="Familias activas"   value={familias.length}  color="#10b981" />
      </div>

      <div className="flex rounded-2xl p-1.5 border gap-1.5" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
        {[{ id: 'recordatorios', label: 'Recordatorios de hoy' }, { id: 'familias', label: 'Cronograma semanal' }, { id: 'masivo', label: 'Mensaje masivo' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className="flex-1 py-3 rounded-xl text-xs font-black transition-all"
            style={{ background: tab === t.id ? 'var(--card)' : 'transparent', color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)', border: tab === t.id ? '1px solid var(--card-border)' : '1px solid transparent', boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'recordatorios' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{citasHoy.length > 0 ? `${citasHoy.length} citas · ${new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Sin citas para hoy'}</p>
            {citasHoy.length > 0 && <button onClick={sendAll} disabled={!!sending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{sending === 'all' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar a todos</button>}
          </div>
          {loading ? <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
          : citasHoy.length === 0 ? <div className="rounded-xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}><Calendar size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="font-black text-sm" style={{ color: 'var(--text-muted)' }}>Sin citas para hoy</p></div>
          : citasHoy.map(c => (
            <div key={c.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(59,130,246,0.1)' }}><Clock size={17} style={{ color: '#3b82f6' }} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{c.child_name || 'Paciente'}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.appointment_time?.slice(0,5) || '—'} · <span style={{ color: c.parent_id ? '#10b981' : '#ef4444' }}>{c.parent_id ? 'Tutor vinculado' : 'Sin tutor'}</span></p>
              </div>
              {c.parent_id ? <button onClick={() => sendReminder(c)} disabled={sending === c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 disabled:opacity-50" style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>{sending === c.id ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />} Recordatorio</button>
              : <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>Sin tutor</span>}
            </div>
          ))}
        </div>
      )}

      {tab === 'familias' && (
        <div className="space-y-3">
          <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Envía el cronograma de la semana a cada familia</p>
          {loading ? <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
          : familias.length === 0 ? <div className="rounded-xl p-10 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}><Users size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} /><p className="font-black text-sm" style={{ color: 'var(--text-muted)' }}>Sin familias con citas esta semana</p></div>
          : familias.map(fam => (
            <div key={fam.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-white text-sm" style={{ background: '#8b5cf6' }}>{fam.nombre.charAt(0).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{fam.nombre}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fam.pacientes.join(', ')} · {fam.citas} sesión{fam.citas !== 1 ? 'es' : ''}{fam.phone ? ` · ${fam.phone}` : ''}</p>
              </div>
              <button onClick={() => sendSchedule(fam)} disabled={sending === fam.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: '#8b5cf6' }}>{sending === fam.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Cronograma</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'masivo' && (
        <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <div>
            <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>Mensaje a todas las familias activas</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Se enviará a {familias.length} familia{familias.length !== 1 ? 's' : ''} con citas esta semana</p>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-muted)' }}>Mensaje</label>
            <textarea rows={5} value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Estimada familia, les comunicamos que..." className={`${inputCls} resize-none`} />
          </div>
          <div>
            <p className="text-[10px] font-bold mb-2" style={{ color: 'var(--text-muted)' }}>Variables:</p>
            <div className="flex gap-2">
              {['{nombre}', '{tutor}'].map(v => <button key={v} onClick={() => setMensaje(m => m + v)} className="text-xs px-2.5 py-1.5 rounded-lg font-mono font-bold hover:opacity-80" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>{v}</button>)}
            </div>
          </div>
          <div className="flex items-center gap-4 pt-2" style={{ borderTop: '1px solid var(--card-border)' }}>
            <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Canal:</label>
            {['whatsapp', 'email'].map(c => <label key={c} className="flex items-center gap-1.5 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}><input type="radio" name="canal" value={c} checked={canal === c} onChange={() => setCanal(c)} /> {c.charAt(0).toUpperCase() + c.slice(1)}</label>)}
            <button onClick={sendMasivo} disabled={!!sending || !mensaje.trim() || !familias.length} className="ml-auto flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all">
              {sending === 'masivo' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending === 'masivo' ? 'Enviando...' : `Enviar a ${familias.length} familias`}
            </button>
          </div>
          {!familias.length && <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}><AlertCircle size={14} style={{ color: '#f59e0b' }} /><p className="text-xs font-medium" style={{ color: '#b45309' }}>No hay familias con citas esta semana</p></div>}
        </div>
      )}
    </div>
  )
}
