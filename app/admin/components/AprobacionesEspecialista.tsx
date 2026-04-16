'use client'

import { useI18n } from '@/lib/i18n-context'

import { useState, useEffect, useCallback } from 'react'
import {
  ShieldCheck, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  Loader2, Baby, FileText, RefreshCw, Stethoscope
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const TIPO_LABEL: Record<string, string> = {
  conducta: 'Evaluación de Conducta',
  progreso: 'Reporte de Progreso',
  sesion: 'Nota de Sesión',
  familia: 'Recomendaciones para Familia',
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending_approval: { label: 'Pendiente', color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b30', icon: Clock },
  approved:         { label: 'Aprobado',  color: '#10b981', bg: '#10b98115', border: '#10b98130', icon: CheckCircle },
  rejected:         { label: 'Rechazado', color: '#ef4444', bg: '#ef444415', border: '#ef444430', icon: XCircle },
}

interface Submission {
  id: string
  specialist_id: string
  child_id: string
  tipo: string
  titulo: string
  contenido: string
  observaciones?: string
  recomendaciones?: string
  status: 'pending_approval' | 'approved' | 'rejected'
  admin_comment?: string
  created_at: string
  children?: { name: string }
  profiles?: { full_name: string; specialty: string }
}

export default function AprobacionesEspecialista() {
  const toast = useToast()
  const { t } = useI18n()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'pending_approval' | 'approved' | 'rejected' | 'all'>('pending_approval')
  const [expandido, setExpandido] = useState<string | null>(null)
  const [comentarios, setComentarios] = useState<Record<string, string>>({})
  const [accionando, setAccionando] = useState<string | null>(null)
  const [autoAprobacion, setAutoAprobacion] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('specialist_submissions')
        .select('*, children(name), profiles!specialist_submissions_specialist_id_fkey(full_name, specialty)')
        .order('created_at', { ascending: false })
      if (filtro !== 'all') q = q.eq('status', filtro)
      const { data, error } = await q
      if (error) throw error
      // Auto-aprobar si está activado
      if (autoAprobacion && data) {
        const pendientes = data.filter(s => s.status === 'pending_approval')
        for (const s of pendientes) {
          await supabase.from('specialist_submissions').update({ status: 'approved', admin_comment: 'Auto-aprobado' }).eq('id', s.id)
        }
        if (pendientes.length > 0) {
          // Recargar
          const { data: data2 } = await supabase.from('specialist_submissions')
            .select('*, children(name), profiles!specialist_submissions_specialist_id_fkey(full_name, specialty)')
            .order('created_at', { ascending: false })
          setSubmissions(data2 || [])
          return
        }
      }
      setSubmissions(data || [])
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally { setLoading(false) }
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  const accion = async (id: string, tipo: 'approved' | 'rejected') => {
    setAccionando(id)
    try {
      const { error } = await supabase
        .from('specialist_submissions')
        .update({
          status: tipo,
          admin_comment: comentarios[id] || null,
          approved_at: tipo === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
      toast.success(tipo === 'approved' ? '✅ Evaluación aprobada' : '❌ Evaluación rechazada')
      setExpandido(null)
      cargar()
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally { setAccionando(null) }
  }

  const pendientesCount = submissions.filter(s => s.status === 'pending_approval').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div style={{ background: '#8b5cf620', color: '#8b5cf6' }}
            className="w-9 h-9 rounded-xl flex items-center justify-center">
            <Stethoscope size={18} />
          </div>
          <div>
            <h3 style={{ color: '#f1f5f9' }} className="font-black text-xl flex items-center gap-2">
              Evaluaciones de Especialistas
              {filtro === 'pending_approval' && pendientesCount > 0 && (
                <span style={{ background: '#f59e0b', color: '#fff' }}
                  className="text-xs font-black px-2 py-0.5 rounded-full">{pendientesCount}</span>
              )}
            </h3>
            <p style={{ color: '#475569' }} className="text-sm">{t('ui.require_approval')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Auto-aprobación */}
          <button onClick={() => setAutoAprobacion(v => !v)}
            style={{ 
              background: autoAprobacion ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${autoAprobacion ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: autoAprobacion ? '#10b981' : '#475569'
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all hover:opacity-80"
            title={t('ui.auto_approval_tooltip')}>
            <span className={`w-2 h-2 rounded-full ${autoAprobacion ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}/>
            Auto-aprobar {autoAprobacion ? 'ON' : 'OFF'}
          </button>
          <button onClick={cargar}
            style={{ color: '#475569', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['pending_approval', 'approved', 'rejected', 'all'] as const).map(f => {
          const isActive = filtro === f
          const cfg = f !== 'all' ? STATUS_CFG[f] : null
          return (
            <button key={f} onClick={() => setFiltro(f)}
              style={{
                background: isActive ? (cfg?.bg || '#06b6d415') : '#0d1a2d',
                border: `1px solid ${isActive ? (cfg?.border || '#06b6d430') : 'rgba(255,255,255,0.06)'}`,
                color: isActive ? (cfg?.color || '#06b6d4') : '#475569',
              }}
              className="text-xs font-bold px-3 py-1.5 rounded-full transition-all">
              {f === 'all' ? 'Todas' : STATUS_CFG[f].label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} style={{ color: '#8b5cf6' }} className="animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div style={{ background: '#0d1a2d', border: '1px solid rgba(255,255,255,0.05)' }}
          className="text-center py-16 rounded-2xl">
          <ShieldCheck size={40} style={{ color: '#334155' }} className="mx-auto mb-3" />
          <p style={{ color: '#475569' }} className="font-medium text-sm">
            {filtro === 'pending_approval' ? '¡Sin pendientes! Todo al día.' : 'Sin registros en este estado'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => {
            const cfg = STATUS_CFG[sub.status] || STATUS_CFG.pending_approval
            const Icon = cfg.icon
            const abierto = expandido === sub.id
            const esPendiente = sub.status === 'pending_approval'
            return (
              <div key={sub.id}
                style={{ background: '#0d1a2d', border: `1px solid ${abierto ? cfg.border : 'rgba(255,255,255,0.06)'}` }}
                className="rounded-2xl overflow-hidden transition-all">
                <div className="p-5 flex items-start gap-4">
                  <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={15} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p style={{ color: '#e2e8f0' }} className="font-semibold text-sm">{sub.titulo}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span style={{ color: '#475569' }} className="flex items-center gap-1 text-xs">
                            <Baby size={11} /> {sub.children?.name}
                          </span>
                          <span style={{ color: '#475569' }} className="flex items-center gap-1 text-xs">
                            <Stethoscope size={11} /> {(sub as any).profiles?.full_name}
                          </span>
                          <span style={{ color: '#334155' }} className="text-xs">{TIPO_LABEL[sub.tipo] || sub.tipo}</span>
                        </div>
                      </div>
                      <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0">
                        {cfg.label}
                      </span>
                    </div>
                    <p style={{ color: '#334155' }} className="text-xs mt-1">
                      {new Date(sub.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {sub.admin_comment && (
                      <div style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '3px solid #06b6d4' }}
                        className="mt-2 px-3 py-2 rounded-r-xl text-xs">
                        <span style={{ color: '#64748b' }} className="font-bold">Tu comentario:</span>
                        <span style={{ color: '#94a3b8' }}> {sub.admin_comment}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExpandido(abierto ? null : sub.id)}
                    style={{ color: '#475569', background: 'rgba(255,255,255,0.04)' }}
                    className="p-2 rounded-lg flex-shrink-0 hover:bg-white/10 transition-colors">
                    {abierto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>

                {abierto && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}
                    className="px-5 py-5 space-y-4">
                    <Section title={t('ui.content')} content={sub.contenido} />
                    {sub.observaciones && <Section title={t('ui.observations')} content={sub.observaciones} />}
                    {sub.recomendaciones && <Section title={t('ui.recommendations')} content={sub.recomendaciones} />}

                    {esPendiente && (
                      <div className="space-y-3 pt-2">
                        <div>
                          <label style={{ color: '#475569' }}
                            className="block text-xs font-bold uppercase tracking-widest mb-2">
                            Comentario para el especialista (opcional)
                          </label>
                          <textarea
                            value={comentarios[sub.id] || ''}
                            onChange={e => setComentarios(c => ({ ...c, [sub.id]: e.target.value }))}
                            rows={3}
                            placeholder={t('ui.approval_comment_placeholder')}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e2e8f0' }}
                            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none transition-all resize-none"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => accion(sub.id, 'rejected')}
                            disabled={!!accionando}
                            style={{ color: '#ef4444', border: '1px solid #ef444430', background: '#ef444408' }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                            {accionando === sub.id ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                            Rechazar
                          </button>
                          <button
                            onClick={() => accion(sub.id, 'approved')}
                            disabled={!!accionando}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 20px #10b98130' }}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-50 hover:brightness-110 transition-all">
                            {accionando === sub.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                            Aprobar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <p style={{ color: '#334155' }} className="text-[10px] font-black uppercase tracking-widest mb-2">{title}</p>
      <p style={{ color: '#94a3b8', lineHeight: 1.8 }} className="text-sm whitespace-pre-wrap">{content}</p>
    </div>
  )
}
