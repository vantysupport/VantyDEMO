'use client'

import { useI18n } from '@/lib/i18n-context'

import { useState, useEffect } from 'react'
import {
  Search, ChevronLeft, X, Loader2,
  Send, Sparkles, CheckCircle2, FileText, Clock, Brain
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { ALL_FORMS } from '@/app/admin/data/neurodivergentForms'
import {
  ANAMNESIS_DATA, ABA_DATA, ENTORNO_HOGAR_DATA, BRIEF2_DATA,
  ADOS2_DATA, VINELAND3_DATA, WISCV_DATA, BASC3_DATA
} from '@/app/admin/data/formConstants'
import { calcularEdadNumerica } from '@/app/admin/utils/helpers'



// ─── FORMULARIOS CLÍNICOS PROFESIONALES ─────────────────────────────────────
const CLINICAL_FORMS: any[] = [
  { id: 'anamnesis',    formKey: 'anamnesis',    title: 'Historia Clínica',               subtitle: 'Datos relevantes del cliente y contexto familiar',    category: 'clinico',    icon: '📋', estimatedMinutes: 30, sections: ANAMNESIS_DATA,    targetRole: 'admin', description: 'Historia clínica completa del paciente, antecedentes familiares y desarrollo temprano', tags: ['Historia', 'Inicial', 'Completo'] },
  { id: 'aba',          formKey: 'aba',          title: 'Sesión ABA',                     subtitle: 'Registro de sesión conductual',                        category: 'conductual', icon: '🎯', estimatedMinutes: 15, sections: ABA_DATA,          targetRole: 'admin', description: 'Registro estructurado de sesión de Análisis Conductual Aplicado', tags: ['ABA', 'Sesión', 'Conductual'] },
  { id: 'entorno_hogar',formKey: 'entorno_hogar',title: 'Entorno en el Hogar',            subtitle: 'Observación del ambiente familiar',                    category: 'familia',    icon: '🏠', estimatedMinutes: 20, sections: ENTORNO_HOGAR_DATA, targetRole: 'both',  description: 'Análisis del entorno familiar y su impacto en el desarrollo del niño', tags: ['Hogar', 'Familia', 'Ambiente'] },
  { id: 'brief2',       formKey: 'brief2',       title: 'BRIEF-2',                        subtitle: 'Evaluación de Funciones Ejecutivas',                   category: 'cognitivo',  icon: '🧠', estimatedMinutes: 25, sections: BRIEF2_DATA,       targetRole: 'admin', description: 'Evaluación profesional estandarizada de funciones ejecutivas', tags: ['Ejecutivo', 'Cognitivo', 'BRIEF'], evalType: 'BRIEF2', externalPlatform: true },
  { id: 'ados2',        formKey: 'ados2',        title: 'ADOS-2',                         subtitle: 'Registro de resultados diagnósticos',                  category: 'tea',        icon: '🧩', estimatedMinutes: 10, sections: ADOS2_DATA,        targetRole: 'admin', description: 'Corre en plataforma oficial ADOS-2. Aquí solo registrá los resultados y puntuaciones.', tags: ['TEA', 'ADOS', 'Diagnóstico'], evalType: 'ADOS2', externalPlatform: true },
  { id: 'vineland3',    formKey: 'vineland3',    title: 'Vineland-3',                     subtitle: 'Registro de conducta adaptativa',                      category: 'habilidades',icon: '🤝', estimatedMinutes: 10, sections: VINELAND3_DATA,    targetRole: 'admin', description: 'Corre en plataforma oficial Vineland-3. Aquí solo registrá puntuaciones compuestas y perfil.', tags: ['Adaptativo', 'Vineland', 'Funcional'], evalType: 'VINELAND3', externalPlatform: true },
  { id: 'wiscv',        formKey: 'wiscv',        title: 'WISC-V',                         subtitle: 'Registro de inteligencia (6-16 años)',                 category: 'cognitivo',  icon: '📊', estimatedMinutes: 10, sections: WISCV_DATA,        targetRole: 'admin', description: 'Corre en plataforma oficial WISC-V. Aquí solo registrá IQ y percentiles.', tags: ['CI', 'Inteligencia', 'WISC'], evalType: 'WISCV', externalPlatform: true },
  { id: 'basc3',        formKey: 'basc3',        title: 'BASC-3',                         subtitle: 'Registro de evaluación conductual',                    category: 'conductual', icon: '📈', estimatedMinutes: 10, sections: BASC3_DATA,        targetRole: 'admin', description: 'Corre en plataforma oficial BASC-3. Aquí solo registrá T-scores y escalas.', tags: ['Conductual', 'BASC', 'Emocional'], evalType: 'BASC3', externalPlatform: true },
]

const ALL_SPECIALIST_FORMS = [
  ...CLINICAL_FORMS,
  ...ALL_FORMS.map(f => ({ ...f, formKey: f.id, isSoft: true })),
]

// ─── QUESTION RENDERER ───────────────────────────────────────────────────────
function QuestionField({ q, value, onChange }: any) {
  const { t } = useI18n()
  const base = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"

  if (q.type === 'select' || q.type === 'frequency') return (
    <div className="space-y-2">
      {(q.options || []).map((opt: string) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
            ${value === opt ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-sky-50'}`}>
          {opt}
        </button>
      ))}
    </div>
  )

  if (q.type === 'multiselect') {
    const sel: string[] = Array.isArray(value) ? value : []
    return (
      <div className="flex flex-wrap gap-2">
        {(q.options || []).map((opt: string) => {
          const on = sel.includes(opt)
          return (
            <button key={opt} type="button"
              onClick={() => onChange(on ? sel.filter((x: string) => x !== opt) : [...sel, opt])}
              className={`px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all
                ${on ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'scale') {
    const min = q.min || 1; const max = q.max || 5
    return (
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(n => (
          <button key={n} onClick={() => onChange(n)}
            className={`w-11 h-11 rounded-xl font-bold text-sm border-2 transition-all
              ${value === n ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
            {n}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === 'boolean' || (q.type === 'radio' && (q.options || []).length <= 3)) {
    const opts = q.options || ['Sí', 'No']
    return (
      <div className="flex gap-3 flex-wrap">
        {opts.map((v: string) => (
          <button key={v} onClick={() => onChange(v)}
            className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all
              ${value === v ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
            {v}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === 'radio') return (
    <div className="space-y-2">
      {(q.options || []).map((opt: string) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
            ${value === opt ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200 text-slate-700 hover:border-sky-300'}`}>
          {opt}
        </button>
      ))}
    </div>
  )

  if (q.type === 'textarea') return (
    <textarea value={value || ''} onChange={e => onChange(e.target.value)}
      rows={3} placeholder={q.placeholder || ''}
      className={`${base} resize-none`} />
  )

  if (q.aiGenerated) {
    const hasVal = value && String(value).trim().length > 0
    if (q.type === 'textarea') {
      return hasVal ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={4}
          className={`${base} bg-sky-50 border-sky-200 resize-none`} />
      ) : (
        <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 flex items-center gap-2">
          <Sparkles size={14} className="text-sky-400 flex-shrink-0" />
          <span>{t('evaluaciones.seCompletara')} <strong className="text-sky-600">{t('evaluaciones.analizarConIA2')}</strong></span>
        </div>
      )
    }
    return hasVal ? (
      <input type="text" value={value} onChange={e => onChange(e.target.value)} className={`${base} bg-sky-50 border-sky-200`} />
    ) : (
      <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 flex items-center gap-2">
        <Sparkles size={14} className="text-sky-400 flex-shrink-0" />
        <span>{t('evaluaciones.seCompletara2')} <strong className="text-sky-600">{t('evaluaciones.analizarConIA2')}</strong></span>
      </div>
    )
  }

  if (q.readonly) {
    const hasVal = value !== undefined && value !== null && String(value).trim().length > 0
    return hasVal ? (
      <div className="w-full px-4 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-800">
        {value}
      </div>
    ) : (
      <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        Se calculará automáticamente con la IA
      </div>
    )
  }

  return (
    <input type={q.type === 'number' ? 'number' : 'text'}
      value={value || ''} onChange={e => onChange(e.target.value)}
      placeholder={q.placeholder || ''}
      className={base} />
  )
}

// ─── FORM FILL VIEW ──────────────────────────────────────────────────────────
function FormFillView({ form, children, onBack, userId, toast }: any) {
  const { t } = useI18n()
  const [step, setStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [childId, setChildId] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [editedMsg, setEditedMsg] = useState('')
  const [editedActividades, setEditedActividades] = useState('')
  const [done, setDone] = useState(false)

  const sections = form.sections || []
  const total = sections.length
  const section = sections[step]
  const progress = total > 0 ? ((step + 1) / total) * 100 : 0
  const CAT_COLOR: Record<string, string> = { tdah: '#f59e0b', tea: '#0ea5e9', conductual: '#ef4444', sensorial: '#06b6d4', habilidades: '#10b981', familia: '#ec4899', seguimiento: '#64748b', clinico: '#0284c7', cognitivo: '#0284c7' }
  const accentColor = CAT_COLOR[(form as any).category] || '#0284c7'

  const answer = (id: string, val: any) => setResponses(p => ({ ...p, [id]: val }))

  const handleAnalyze = async () => {
    if (!childId) { toast.error('Selecciona un paciente'); return }
    setAnalyzing(true)
    try {
      const child = children.find((c: any) => c.id === childId)
      const childName = child?.name || 'Paciente'
      const childAge = child?.age || calcularEdadNumerica(child?.birth_date) || 'N/E'
      let res: Response

      if (form.isSoft) {
        res = await fetch('/api/analyze-neurodivergent-form', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({ formType: form.id, formData: responses, childName, childAge, childId, diagnosis: child?.diagnosis || '' , locale: localStorage.getItem('vanty_locale') || 'es' }),
        })
      } else if (form.evalType) {
        res = await fetch('/api/analyze-professional-evaluation', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({ evaluationType: form.evalType.toLowerCase(), childName, childAge, childId, responses , locale: localStorage.getItem('vanty_locale') || 'es' }),
        })
      } else if (form.formKey === 'entorno_hogar') {
        res = await fetch('/api/generate-home-environment-report', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({ ...responses, childName, childAge, childId , locale: localStorage.getItem('vanty_locale') || 'es' }),
        })
      } else {
        res = await fetch('/api/generate-session-report', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({ ...responses, childName, childAge, childId, formType: form.formKey , locale: localStorage.getItem('vanty_locale') || 'es' }),
        })
      }
      const json = await res!.json()
      if (!res!.ok || json.error) throw new Error(json.error || `Error ${res!.status}`)

      // analyze-professional-evaluation devuelve el objeto directo (sin wrapper .analysis)
      // analyze-neurodivergent-form devuelve { analysis: { ... } }
      const rawAnalysis = json.analysis && typeof json.analysis === 'object' ? json.analysis : json
      const analysis: any = { ...rawAnalysis }

      // Aplanar métricas Vineland al nivel raíz para rellenar campos readonly/aiGenerated
      if (rawAnalysis.metricas) {
        const m = rawAnalysis.metricas
        if (m.comunicacion !== undefined)    analysis.puntuacion_comunicacion     = m.comunicacion
        if (m.vida_diaria !== undefined)     analysis.puntuacion_vida_diaria      = m.vida_diaria
        if (m.socializacion !== undefined)   analysis.puntuacion_socializacion    = m.socializacion
        if (m.indice_global !== undefined)   analysis.indice_conducta_adaptativa  = m.indice_global
        if (m.ci_total !== undefined)        analysis.ci_total                    = m.ci_total
        if (m.clasificacion !== undefined)   analysis.clasificacion_ci            = m.clasificacion
        if (m.inhibicion !== undefined)      analysis.inhibicion                  = m.inhibicion
        if (m.total !== undefined)           analysis.total_brief                 = m.total
        if (m.severidad !== undefined)       analysis.nivel_severidad             = m.severidad
        if (m.afecto_social !== undefined)   analysis.puntuacion_total            = m.afecto_social
        if (m.indice_sintomas !== undefined) analysis.indice_sintomas_conductuales = m.indice_sintomas
      }

      // Mezclar con responses para que los campos aiGenerated/readonly muestren los valores
      setResponses(prev => ({ ...prev, ...analysis }))
      setAiAnalysis(analysis)
      setEditedMsg(
        analysis?.mensaje_padres ||
        analysis?.informe_padres_vineland ||
        analysis?.informe_padres_wisc ||
        analysis?.informe_padres_basc ||
        analysis?.informe_familia_ados ||
        analysis?.informe_padres || ''
      )
      setEditedActividades(analysis?.actividades_casa || analysis?.actividad_casa || '')
      toast.success('Análisis IA generado')
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setAnalyzing(false) }
  }

  const handleSave = async () => {
    if (!childId) { toast.error('Selecciona un paciente'); return }
    setSaving(true)
    try {
      const table = form.isSoft ? 'form_responses' :
        (form.formKey === 'anamnesis' ? 'anamnesis_completa' :
        form.formKey === 'aba' ? 'registro_aba' :
        form.formKey === 'entorno_hogar' ? 'registro_entorno_hogar' : 'form_responses')

      // Construir payload según columnas reales de cada tabla
      let payload: any
      if (table === 'registro_aba') {
        // Columnas reales: id, child_id, fecha_sesion, datos, creado_por, form_title
        payload = {
          child_id:     childId,
          form_title:   form.title,
          fecha_sesion: new Date().toISOString().split('T')[0],
          datos:        responses,
          creado_por:   userId,
        }
      } else if (table === 'registro_entorno_hogar') {
        payload = {
          child_id:    childId,
          form_title:  form.title,
          fecha_visita: new Date().toISOString(),
          datos:       responses,
          ai_analysis: aiAnalysis,
        }
      } else if (table === 'anamnesis_completa') {
        payload = {
          child_id:       childId,
          form_title:     form.title,
          fecha_creacion: new Date().toISOString(),
          datos:          responses,
          ai_analysis:    aiAnalysis,
        }
      } else {
        // form_responses (isSoft o fallback)
        payload = {
          child_id:   childId,
          form_type:  form.formKey || form.id,
          form_title: form.title,
          created_at: new Date().toISOString(),
          ai_analysis: aiAnalysis,
          responses,
        }
      }

      // Verificar error del insert para no continuar si falla
      const { error: insertError } = await supabase.from(table).insert([payload])
      if (insertError) throw insertError

      await supabase.from('specialist_submissions').insert([{
        specialist_id: userId, child_id: childId, tipo: 'sesion',
        titulo: `[${form.title}]`,
        contenido: Object.entries(responses).slice(0, 6).map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : v}`).join('\n'),
        observaciones: aiAnalysis?.analisis_clinico || aiAnalysis?.resumen_ejecutivo || '',
        recomendaciones: Array.isArray(aiAnalysis?.recomendaciones) ? (aiAnalysis.recomendaciones as string[]).join('\n') : (aiAnalysis?.recomendaciones || ''),
        status: 'approved',
      }])

      const msgToSend = editedMsg || aiAnalysis?.mensaje_padres
      const actividadToSend = editedActividades || aiAnalysis?.actividades_casa || aiAnalysis?.actividad_casa
      if (msgToSend) {
        const { data: childData } = await supabase.from('children').select('parent_id').eq('id', childId).single()
        if ((childData as any)?.parent_id) {
          await fetch('/api/admin/parent-messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
            body: JSON.stringify({ child_id: childId, parent_id: (childData as any).parent_id, source: form.isSoft ? 'neuroforma' : 'evaluacion', source_title: `Especialista: ${form.title}`, ai_message: msgToSend, actividades_casa: actividadToSend, ai_analysis: aiAnalysis, session_data: { form_type: form.formKey || form.id, responses, specialist_id: userId } , locale: localStorage.getItem('vanty_locale') || 'es' }),
          }).catch(() => {})
        }
      }
      setDone(true)
      toast.success('Formulario guardado correctamente')
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  if (done) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-5 py-16">
      <div className="w-20 h-20 bg-emerald-100 border-4 border-emerald-200 rounded-full flex items-center justify-center">
        <CheckCircle2 size={40} className="text-emerald-600" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">{t('evaluaciones.formularioEnviado')}</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
          El análisis fue guardado y está disponible en el expediente del paciente.
        </p>
      </div>
      <button onClick={onBack}
        className="px-8 py-3 bg-sky-600 hover:bg-sky-700 rounded-xl text-white font-bold text-sm transition-colors shadow-sm">
        ← Volver a formularios
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full pb-20 md:pb-6">
      {/* Top progress bar */}
      <div className="flex-shrink-0 border-b border-slate-200 bg-white shadow-sm z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-sky-600 font-bold transition-all text-sm group">
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-slate-400">
                Sección {step + 1} de {total}
              </p>
              <p className="text-xs font-bold text-sky-600">{Math.round(progress)}% completado</p>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

          {/* Color banner with patient selector — identical to admin */}
          <div className={`bg-gradient-to-r ${form.color || 'from-sky-600 to-cyan-600'} rounded-2xl p-5 text-white shadow-lg`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-white/70 text-xs font-bold mb-1">{form.icon} {(form.category || 'clínico').toUpperCase()}</p>
                <h2 className="font-bold text-xl">{form.title}</h2>
                <p className="text-white/80 text-sm mt-0.5">{form.subtitle}</p>
              </div>
              <select value={childId} onChange={e => setChildId(e.target.value)}
                className="bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:bg-white/30 transition-all min-w-[180px]">
                <option value="" className="text-slate-800">{t('ui.select_patient_option')}</option>
                {children.map((c: any) => (
                  <option key={c.id} value={c.id} className="text-slate-800">{c.name}{c.age ? ` · ${c.age} años` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section questions */}
          {section && (
            <div className="rounded-2xl shadow-sm overflow-hidden bg-white border border-slate-200">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">{section.title}</h3>
                {section.description && <p className="text-sm text-slate-500 mt-1">{section.description}</p>}
              </div>
              <div className="p-6 space-y-6">
                {(section.questions || []).map((q: any) => (
                  <div key={q.id} className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 leading-snug">
                      {q.label}{q.required && <span className="text-red-500"> *</span>}
                    </label>
                    {q.helpText && <p className="text-xs text-slate-400">{q.helpText}</p>}
                    <QuestionField q={q} value={responses[q.id]} onChange={(v: any) => answer(q.id, v)} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
              className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 bg-white text-slate-600 rounded-xl font-bold hover:border-sky-300 disabled:opacity-40 transition-all">
              <ChevronLeft size={18} /> Anterior
            </button>
            <div className="flex items-center gap-3">
              {(step === total - 1 || (form.formKey === 'aba' && step >= 5)) && (
                <button onClick={handleAnalyze} disabled={analyzing || !childId}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold disabled:opacity-40 transition-all shadow-lg shadow-sky-200 hover:opacity-90">
                  {analyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {analyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
              )}
              {step < total - 1 ? (
                <button onClick={() => setStep(s => s + 1)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-sky-200 hover:opacity-90">
                  Siguiente <ChevronLeft size={18} className="rotate-180" />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving || !childId}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-40 transition-all">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  Guardar
                </button>
              )}
            </div>
          </div>

          {/* AI Result */}
          {aiAnalysis && (() => {
        // Helper: convierte string con guiones/saltos o array → array limpio
        const toArr = (val: any): string[] => {
          if (!val) return []
          if (Array.isArray(val)) return val.filter(Boolean)
          if (typeof val === 'string') return val.split(/\n|;/).map((s: string) => s.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
          return []
        }
        const areasFortaleza  = toArr(aiAnalysis.areas_fortaleza)
        const recomendaciones = toArr(aiAnalysis.recomendaciones || aiAnalysis.recomendaciones_ia || aiAnalysis.plan_intervencion_conductual)
        const textoAnalisis   = aiAnalysis.resumen_ejecutivo || aiAnalysis.analisis_clinico || aiAnalysis.analisis_ia || aiAnalysis.analisis_vineland_ia || aiAnalysis.analisis_diagnostico_ia || aiAnalysis.analisis_basc_ia || aiAnalysis.perfil_cognitivo_ia || ''

        return (
        <div className="bg-white rounded-2xl border border-sky-200 p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
              <Brain size={16} className="text-sky-600" />
            </div>
            <h4 className="font-bold text-slate-800">{t('especialista.analisisIA2')}</h4>
            {aiAnalysis.nivel_alerta && (
              <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full border capitalize
                ${aiAnalysis.nivel_alerta === 'alto' ? 'bg-red-50 text-red-700 border-red-200' :
                  aiAnalysis.nivel_alerta === 'moderado' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                {aiAnalysis.nivel_alerta}
              </span>
            )}
          </div>

          {textoAnalisis ? (
            <p className="text-sm text-slate-600 leading-relaxed">{textoAnalisis}</p>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {areasFortaleza.length > 0 && (
              <div>
                <p className="text-xs font-bold text-emerald-600 mb-2">💪 Fortalezas</p>
                <ul className="space-y-1">
                  {areasFortaleza.map((f: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">• {f}</li>
                  ))}
                </ul>
              </div>
            )}
            {recomendaciones.length > 0 && (
              <div>
                <p className="text-xs font-bold text-sky-600 mb-2">💡 Recomendaciones</p>
                <ul className="space-y-1">
                  {recomendaciones.slice(0, 4).map((r: string, i: number) => (
                    <li key={i} className="text-xs text-slate-600 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">• {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {(aiAnalysis.mensaje_padres || editedMsg) && (
            <div className="space-y-4">
              {/* Sección 1: Mensaje al padre */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  💬 Mensaje al padre/madre (editable)
                </label>

                <textarea value={editedMsg} onChange={e => setEditedMsg(e.target.value)} rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
              </div>

              {/* Sección 2: Actividad para casa */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  🏠 Actividad para realizar en casa (editable)
                </label>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3 flex gap-2">
                  <span className="text-sky-600 flex-shrink-0 text-xs font-bold">1</span>
                  <p className="text-xs text-sky-700 leading-relaxed">
                    Una sola actividad basada en lo trabajado hoy en sesión.
                  </p>
                </div>
                <textarea
                  value={editedActividades || aiAnalysis?.actividades_casa || aiAnalysis?.actividad_casa || ''}
                  onChange={e => setEditedActividades(e.target.value)} rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-sky-200 bg-sky-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none" />
              </div>
            </div>
          )}

          {/* ── Producto sugerido por la IA ── */}
          {aiAnalysis.producto_sugerido_info && (
            <div className="rounded-2xl overflow-hidden border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50">
              <div className="bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <span className="text-xs font-bold text-white">{t('especialista.productoIA')}</span>
              </div>
              <div className="flex gap-4 p-4 items-start">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-amber-100 flex-shrink-0 flex items-center justify-center">
                  {aiAnalysis.producto_sugerido_info.imagen_url
                    ? <img src={aiAnalysis.producto_sugerido_info.imagen_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-2xl">{aiAnalysis.producto_sugerido_info.tipo === 'digital' ? '📄' : '📦'}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-amber-900 text-sm mb-1">{aiAnalysis.producto_sugerido_info.nombre}</p>
                  {aiAnalysis.producto_sugerido_info.razon && (
                    <p className="text-xs text-amber-800 leading-relaxed mb-2">💡 {aiAnalysis.producto_sugerido_info.razon}</p>
                  )}
                  <p className="text-lg font-bold text-amber-700">S/ {Number(aiAnalysis.producto_sugerido_info.precio_soles).toFixed(2)}</p>
                </div>
              </div>
              <div className="px-4 pb-3">
                <p className="text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                  💬 <strong>{t('common.atencion')}:</strong> {t('ui.specialist_note')}
                </p>
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm disabled:opacity-50 shadow-md transition-colors">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {saving ? 'Guardando...' : '✅ Guardar formulario'}
          </button>
        </div>
        )
      })()}
        </div>{/* end max-w-3xl */}
      </div>{/* end flex-1 overflow-y-auto */}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',        label: 'All' },
  { id: 'clinico',    label: '🏥 Clínico Pro' },
  { id: 'tea',        label: '🧩 TEA' },
  { id: 'tdah',       label: '⚡ TDAH' },
  { id: 'conductual', label: '🎯 Conductual' },
  { id: 'cognitivo',  label: '🧠 Cognitivo' },
  { id: 'sensorial',  label: '🌀 Sensorial' },
  { id: 'habilidades',label: '🤝 Habilidades' },
  { id: 'familia',    label: '🏠 Familia' },
]

export default function MisFormularios({ userId }: { userId: string }) {
  const { t } = useI18n()
  const toast = useToast()
  const [children, setChildren] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedForm, setSelectedForm] = useState<any>(null)

  useEffect(() => {
    supabase.from('children').select('id, name, age, birth_date, diagnosis')
      .eq('is_active', true).order('name')
      .then(({ data }: { data: any[] | null }) => setChildren(data || []))
  }, [])

  if (selectedForm) return (
    <FormFillView form={selectedForm} children={children} onBack={() => setSelectedForm(null)} userId={userId} toast={toast} />
  )

  const filtered = ALL_SPECIALIST_FORMS.filter((f: any) => {
    const cat = f.category || 'clinico'
    const matchTab = activeTab === 'all' || cat === activeTab
    const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || (f.subtitle || f.description || '').toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{t('especialista.formsClinicos')}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Todos los instrumentos de evaluación clínica
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 flex items-center gap-3 px-4 py-3 shadow-sm">
        <Search size={15} className="text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          {...{placeholder: t('ui.search_form')}}
          className="flex-1 text-sm text-slate-800 bg-transparent outline-none placeholder-slate-400" />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all
                ${isActive ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-600'}`}>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Forms grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center shadow-sm">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileText size={22} className="text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm font-semibold">{t('ui.no_forms')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((form: any) => {
            const isExternal = !!form.externalPlatform
            const isPro = !!form.formKey && !isExternal
            const isParent = form.targetRole === 'parent' || form.targetRole === 'both'
            return (
              <div key={form.id}
                className="rounded-xl overflow-hidden transition-all hover:shadow-md group bg-white"
                style={{ border: '1px solid #e2e8f0' }}>
                {/* Top accent bar */}
                <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${isExternal ? '#b07830' : isPro ? '#7a4a4a' : '#4a6eaa'}, transparent)` }} />
                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 bg-slate-100">
                        {form.icon || '📋'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm leading-tight truncate text-slate-800">{form.title}</h3>
                        <p className="text-[11px] truncate mt-0.5 text-slate-400">{form.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isParent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{ background: 'rgba(74,110,170,0.1)', color: '#4a6eaa', border: '1px solid rgba(74,110,170,0.2)' }}>
                          Padres
                        </span>
                      )}
                      {isExternal && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{ background: 'rgba(176,120,48,0.1)', color: '#b07830', border: '1px solid rgba(176,120,48,0.2)' }}>
                          Ext.
                        </span>
                      )}
                      {isPro && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                          style={{ background: 'rgba(122,74,74,0.1)', color: '#7a4a4a', border: '1px solid rgba(122,74,74,0.2)' }}>
                          PRO
                        </span>
                      )}
                    </div>
                  </div>

                  {/* External warning */}
                  {isExternal && (
                    <p className="text-xs leading-relaxed mb-3 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                      ⚠️ {form.description}
                    </p>
                  )}
                  {!isExternal && (
                    <p className="text-xs leading-relaxed mb-3 line-clamp-2 text-slate-500">{form.description}</p>
                  )}

                  {/* Tags + time */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {(form.tags || []).slice(0, 3).map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                        {tag}
                      </span>
                    ))}
                    {form.estimatedMinutes && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1 bg-slate-100 text-slate-500 border border-slate-200">
                        <Clock size={8} /> {form.estimatedMinutes}m
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedForm(form)}
                      className="flex-1 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 bg-slate-900 text-white hover:bg-slate-700">
                      <FileText size={12} /> Completar
                    </button>
                    {isParent && (
                      <button className="px-3 py-2.5 rounded-lg transition-all bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200"
                        title="Enviar a padres">
                        <Send size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
