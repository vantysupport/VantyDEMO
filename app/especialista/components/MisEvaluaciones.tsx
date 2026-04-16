'use client'

import { useI18n } from '@/lib/i18n-context'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Clock, CheckCircle2, XCircle, ChevronDown,
  ChevronUp, Loader2, Send, AlertTriangle, X, Baby
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const STATUS: Record<string, any> = {
  pending_approval: { label: 'En revisión', color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: Clock },
  approved:         { label: 'Aprobado',    color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',icon: CheckCircle2 },
  rejected:         { label: 'Rechazado',   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: XCircle },
}

const TIPOS = [
  { id: 'conducta', label: 'Conducta',      desc: 'Análisis ABC',          color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'progreso', label: 'Progreso',       desc: 'Avance terapéutico',    color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'sesion',   label: 'Nota de sesión', desc: 'Registro clínico',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'familia',  label: 'Para familia',   desc: 'Guías para el hogar',   color: 'bg-amber-50 text-amber-700 border-amber-200' },
]

const TEMPLATES: Record<string, any> = {
  conducta: {
    titulo: 'Análisis de conducta - [Nombre]',
    contenido: 'Antecedente: [Describir qué ocurrió antes]\n\nConducta: [Describir exactamente la conducta, duración e intensidad]\n\nConsecuencia: [Qué ocurrió después]',
    observaciones: 'La conducta ocurrió [X] veces. El niño mostró [describir estado emocional].',
    recomendaciones: '1. [Estrategia para casa]\n2. [Reforzadores recomendados]\n3. [Situaciones a evitar]',
  },
  progreso: {
    titulo: 'Reporte de progreso - [Nombre] - [Mes]',
    contenido: 'Objetivo trabajado: [Nombre]\n\nLogros esta semana:\n- [Logro 1]\n- [Logro 2]\n\nNivel de dominio: [X]%',
    observaciones: 'El niño mostró [descripción]. Se observó mayor respuesta a [estímulo].',
    recomendaciones: 'Para casa:\n1. [Actividad 1]\n2. [Actividad 2]',
  },
  sesion: {
    titulo: 'Nota de sesión - [Nombre] - [Fecha]',
    contenido: 'Duración: [X] minutos\n\nActividades:\n1. [Actividad 1] - [resultado]\n2. [Actividad 2] - [resultado]\n\nRespuesta: [descripción]',
    observaciones: 'Llegó a la sesión [estado]. Durante la sesión [momentos clave].',
    recomendaciones: 'Para la próxima sesión: [actividades/temas]',
  },
  familia: {
    titulo: 'Guía para la familia - [Nombre]',
    contenido: 'Estimadas familias,\n\nEsta semana trabajamos en [objetivo]. Actividades en casa:\n\n🌟 Actividad 1: [Descripción]\n🌟 Actividad 2: [Descripción]',
    observaciones: 'Practiquen al menos [X] veces por día.',
    recomendaciones: 'Si notan algo diferente en casa, comuníquenlo en la próxima sesión.',
  },
}

export default function MisEvaluaciones({ userId }: { userId: string }) {
  const toast = useToast()
  const { t } = useI18n()
  const [evaluaciones, setEvaluaciones] = useState<any[]>([])
  const [ninos, setNinos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'all' | 'pending_approval' | 'approved' | 'rejected'>('all')
  const [form, setForm] = useState({ child_id: '', tipo: 'conducta', titulo: '', contenido: '', observaciones: '', recomendaciones: '' })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [evalRes, ninosRes] = await Promise.all([
        supabase.from('specialist_submissions').select('*, children(name)').eq('specialist_id', userId).order('created_at', { ascending: false }),
        supabase.from('children').select('id, name').eq('is_active', true).order('name')
      ])
      setEvaluaciones(evalRes.data || [])
      setNinos(ninosRes.data || [])
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [userId])

  useEffect(() => { cargar() }, [cargar])

  const enviar = async () => {
    if (!form.child_id || !form.titulo || !form.contenido) { toast.error('Completa los campos requeridos'); return }
    setEnviando(true)
    try {
      const { error } = await supabase.from('specialist_submissions').insert({ specialist_id: userId, ...form, status: 'pending_approval' })
      if (error) throw error
      toast.success('¡Enviado para aprobación!')
      setMostrarForm(false)
      setForm({ child_id: '', tipo: 'conducta', titulo: '', contenido: '', observaciones: '', recomendaciones: '' })
      cargar()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setEnviando(false) }
  }

  const filtradas = filtro === 'all' ? evaluaciones : evaluaciones.filter(e => e.status === filtro)
  const counts = {
    all: evaluaciones.length,
    pending_approval: evaluaciones.filter(e => e.status === 'pending_approval').length,
    approved: evaluaciones.filter(e => e.status === 'approved').length,
    rejected: evaluaciones.filter(e => e.status === 'rejected').length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">{t('nav.misevaluaciones')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('ui.require_approval')}</p>
        </div>
        <button onClick={() => setMostrarForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-sm shadow-blue-200 transition-all flex-shrink-0">
          <Plus size={16} /> {t('especialista.nueva2')}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending_approval', 'approved', 'rejected'] as const).map(f => {
          const isActive = filtro === f
          const cfg = f !== 'all' ? STATUS[f] : null
          return (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all
                ${isActive
                  ? (cfg ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'bg-blue-600 text-white border-blue-600')
                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                }`}>
              {f === 'all' ? 'Todas' : STATUS[f].label}
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black
                ${isActive ? 'bg-white/30' : 'bg-slate-100 text-slate-500'}`}>
                {counts[f]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center shadow-sm">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-semibold">{t('ui.no_evals')}</p>
          <button onClick={() => setMostrarForm(true)} className="mt-3 text-xs font-bold text-blue-600 hover:underline">
            Crear nueva →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(ev => {
            const cfg = STATUS[ev.status] || STATUS.pending_approval
            const Icon = cfg.icon
            const abierto = expandido === ev.id
            const tipo = TIPOS.find(t => t.id === ev.tipo)
            return (
              <div key={ev.id}
                className={`bg-white rounded-2xl border overflow-hidden transition-all shadow-sm
                  ${abierto ? 'border-slate-300' : 'border-slate-200'}`}>
                <div className="p-5 flex items-start gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 border ${cfg.bg} ${cfg.border}`}>
                    <Icon size={15} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{ev.titulo}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400">{ev.children?.name}</span>
                          {tipo && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tipo.color}`}>{tipo.label}</span>
                          )}
                          <span className="text-xs text-slate-300">
                            {new Date(ev.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {ev.admin_comment && (
                      <div className={`mt-3 px-4 py-3 rounded-xl text-xs border-l-4 ${ev.status === 'rejected' ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-wide mb-1 ${ev.status === 'rejected' ? 'text-red-600' : 'text-blue-500'}`}>
                          {ev.status === 'rejected' ? '🚨 Motivo del rechazo — por favor corrígelo' : '💬 Comentario del jefe'}
                        </p>
                        <p className="text-slate-700 leading-relaxed">{ev.admin_comment}</p>
                        {ev.status === 'rejected' && (
                          <button
                            onClick={() => {
                              setForm({ child_id: ev.child_id, tipo: ev.tipo, titulo: `[CORREGIDO] ${ev.titulo}`, contenido: ev.contenido, observaciones: ev.observaciones || '', recomendaciones: ev.recomendaciones || '' })
                              setMostrarForm(true)
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-black text-red-700 bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-all"
                          >
                            ✏️ Crear versión corregida
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExpandido(abierto ? null : ev.id)}
                    className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-50 flex-shrink-0 transition-colors">
                    {abierto ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
                {abierto && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-5 space-y-4">
                    <ExpandedSection title={t('ui.content')} content={ev.contenido} />
                    {ev.observaciones && <ExpandedSection title={t('ui.observations')} content={ev.observaciones} />}
                    {ev.recomendaciones && <ExpandedSection title={t('ui.recommendations')} content={ev.recomendaciones} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Nueva Evaluación */}
      {mostrarForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200">
            <div className="sticky top-0 bg-white px-6 py-5 flex items-center justify-between border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-800 text-lg">{t('evaluaciones.nuevo')}</h3>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full mt-1.5">
                  <Clock size={10} /> {t('evaluaciones.pendienteAprobacion')}
                </span>
              </div>
              <button onClick={() => setMostrarForm(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Tipo + botón de plantilla */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{t('especialista.tipoEval')} *</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {TIPOS.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${form.tipo === t.id ? `${t.color} border-current` : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <p className="text-xs font-black">{t.label}</p>
                      <p className="text-[10px] opacity-70">{t.desc}</p>
                    </button>
                  ))}
                </div>
                {TEMPLATES[form.tipo] && (
                  <button
                    type="button"
                    onClick={() => {
                      const tpl = TEMPLATES[form.tipo]
                      setForm(f => ({ ...f, titulo: tpl.titulo, contenido: tpl.contenido, observaciones: tpl.observaciones, recomendaciones: tpl.recomendaciones }))
                    }}
                    className="w-full py-2.5 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                  >
                    ✨ Usar plantilla de {TIPOS.find(t => t.id === form.tipo)?.label}
                  </button>
                )}
              </div>

              {/* Paciente */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{t('evaluaciones.pacienteStar')}</label>
                <select value={form.child_id} onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">{t('ui.select_option')}</option>
                  {ninos.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{t('especialista.tipoStar')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                      className={`text-left p-3 rounded-xl border-2 transition-all
                        ${form.tipo === t.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                      <p className={`text-sm font-bold ${form.tipo === t.id ? 'text-blue-700' : 'text-slate-700'}`}>{t.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{t('especialista.tituloEval')}</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  {...{placeholder: t('ui.eval_title')}}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Contenido */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Contenido *</label>
                <textarea value={form.contenido} onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
                  rows={5} placeholder={t('ui.clinical_findings_placeholder')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Observaciones <span className="text-slate-300 normal-case font-normal">(opcional)</span>
                </label>
                <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                  rows={3} placeholder={t('ui.additional_notes_placeholder')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              {/* Recomendaciones */}
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  Recomendaciones <span className="text-slate-300 normal-case font-normal">(opcional)</span>
                </label>
                <textarea value={form.recomendaciones} onChange={e => setForm(f => ({ ...f, recomendaciones: e.target.value }))}
                  rows={3} placeholder={t('ui.strategies_placeholder')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setMostrarForm(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200">
                  Cancelar
                </button>
                <button onClick={enviar} disabled={enviando}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50 transition-all shadow-sm">
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {enviando ? 'Enviando...' : 'Enviar para aprobación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ExpandedSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</p>
      <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  )
}
