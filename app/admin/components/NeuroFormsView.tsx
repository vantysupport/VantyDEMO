'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback } from 'react'
import {
  Brain, Send, ChevronRight, ChevronLeft, CheckCircle2, X, Loader2,
  Sparkles, Users, FileText, Plus, Eye, Clock, AlertTriangle,
  Filter, Search, Zap, MessageCircle, BarChart3, RefreshCw,
  BookOpen, Target, Heart, Activity, Star, ChevronDown, ChevronUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  ALL_FORMS, FORM_CATEGORIES, ADMIN_FORMS, PARENT_FORMS,
  type FormDefinition, type FormCategory
} from '../data/neurodivergentForms'

// ─── DYNAMIC FORM RENDERER ───────────────────────────────────────────────────
function DynamicFormQuestion({ question, value, onChange }: any) {
  const { t, locale } = useI18n()
  const freq = ['Nunca', 'Raramente', 'A veces', 'Frecuentemente', 'Casi siempre', 'Siempre']

  if (question.type === 'frequency') {
    return (
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">{question.label}</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {(question.options || freq).map((opt: string, i: number) => (
            <button key={opt} type="button"
              onClick={() => onChange(opt)}
              className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left ${value === opt ? 'bg-sky-600 text-white border-sky-600 shadow-lg' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (question.type === 'multiselect') {
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">{question.label}</p>
        <div className="flex flex-wrap gap-2">
          {(question.options || []).map((opt: string) => (
            <button key={opt} type="button"
              onClick={() => { const s = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]; onChange(s) }}
              className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all ${selected.includes(opt) ? 'bg-sky-600 text-white border-sky-600' : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }
  if (question.type === 'scale') {
    const scale = [1, 2, 3, 4, 5]
    return (
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">{question.label}</p>
        <div className="flex gap-3">
          {scale.map(n => (
            <button key={n} type="button" onClick={() => onChange(n)}
              className={`w-12 h-12 rounded-xl border-2 font-bold text-lg transition-all ${value === n ? 'bg-sky-600 text-white border-sky-600 shadow-lg scale-110' : 'bg-white border-slate-200 text-slate-500 hover:border-sky-300'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-400">Nunca/Leve</span>
          <span className="text-xs text-slate-400">Siempre/Severo</span>
        </div>
      </div>
    )
  }
  if (question.type === 'textarea') {
    return (
      <div>
        <label className="text-sm font-bold text-slate-700 block mb-2">{question.label}</label>
        {question.helpText && <p className="text-xs text-slate-400 mb-2">{question.helpText}</p>}
        <textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-sky-400 transition-all resize-none" />
      </div>
    )
  }
  if (question.type === 'select') {
    return (
      <div>
        <label className="text-sm font-bold text-slate-700 block mb-2">{question.label}</label>
        {question.helpText && <p className="text-xs text-slate-400 mb-2">{question.helpText}</p>}
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all">
          <option value="">{t('ui.select_option')}</option>
          {(question.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }
  if (question.type === 'boolean') {
    return (
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">{question.label}</p>
        <div className="flex gap-3">
          {['Sí', 'No'].map(opt => (
            <button key={opt} type="button" onClick={() => onChange(opt)}
              className={`px-8 py-3 rounded-xl border-2 font-bold transition-all ${value === opt ? (opt === 'Sí' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }
  // Default: text, number, date, time
  return (
    <div>
      <label className="text-sm font-bold text-slate-700 block mb-2">{question.label}</label>
      {question.helpText && <p className="text-xs text-slate-400 mb-2">{question.helpText}</p>}
      <input type={question.type === 'number' ? 'number' : question.type === 'date' ? 'date' : question.type === 'time' ? 'time' : 'text'}
        value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={question.placeholder}
        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all" />
    </div>
  )
}

// ─── AI ANALYSIS RESULT PANEL ─────────────────────────────────────────────────
function AIAnalysisPanel({ analysis, onClose, editableMessage, onEditMessage }: { analysis: any; onClose: () => void; editableMessage?: string; onEditMessage?: (v: string) => void }) {
  const { t } = useI18n()

  if (!analysis) return null
  const alertColors: Record<string, string> = {
    bajo: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    moderado: 'bg-amber-50 border-amber-200 text-amber-700',
    alto: 'bg-red-50 border-red-200 text-red-700',
  }
  const level = analysis.nivel_alerta || 'moderado'
  const msgValue = editableMessage !== undefined ? editableMessage : (analysis.mensaje_padres || '')

  return (
    <div className="bg-gradient-to-br from-sky-50 to-white rounded-3xl border-2 border-sky-100 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-100 rounded-xl"><Sparkles className="text-sky-600" size={22}/></div>
          <h3 className="font-bold text-slate-800 text-lg">{t('ui.analisisClinicoIA')}</h3>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-all"><X size={18}/></button>
      </div>

      {/* Alert level */}
      <div className={`px-4 py-3 rounded-xl border-2 font-bold text-sm flex items-center gap-2 ${alertColors[level]}`}>
        <AlertTriangle size={16}/>
        Nivel de Alerta Clínica: <span className="uppercase font-bold">{level}</span>
      </div>

      {/* Análisis */}
      {analysis.analisis_clinico && (
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('evaluaciones.analisisClin2')}</h4>
          <p className="text-sm text-slate-700 leading-relaxed bg-white rounded-xl p-4 border border-slate-100">{analysis.analisis_clinico}</p>
        </div>
      )}

      {/* Fortalezas y Áreas */}
      <div className="grid grid-cols-2 gap-4">
        {analysis.areas_fortaleza?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2">💪 Fortalezas</h4>
            <ul className="space-y-1">
              {analysis.areas_fortaleza.map((f: string, i: number) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-2 bg-emerald-50 rounded-lg p-2">
                  <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 flex-shrink-0"/> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.areas_trabajo?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">{t('evaluaciones.areasTrabajar2')}</h4>
            <ul className="space-y-1">
              {analysis.areas_trabajo.map((a: string, i: number) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-2 bg-orange-50 rounded-lg p-2">
                  <Target size={12} className="text-orange-500 mt-0.5 flex-shrink-0"/> {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recomendaciones */}
      {analysis.recomendaciones?.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-2">{t('evaluaciones.recomendaciones')}</h4>
          <ul className="space-y-2">
            {analysis.recomendaciones.map((r: string, i: number) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-3 bg-sky-50 rounded-xl p-3">
                <span className="w-6 h-6 bg-sky-600 text-white rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formularios recomendados */}
      {analysis.formularios_recomendados?.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-2">{t('evaluaciones.proxEvals2')}</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.formularios_recomendados.map((f: string, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-full text-xs font-bold">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje para padres - editable antes de guardar */}
      {(analysis.mensaje_padres || editableMessage !== undefined) && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border-2 border-amber-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
              <MessageCircle size={14} className="text-white"/>
            </div>
            <h4 className="font-bold text-amber-800">{t('ui.mensajePadres')}</h4>
            <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-300 uppercase">✏️ Editable</span>
          </div>
          {onEditMessage ? (
            <textarea
              rows={4}
              value={msgValue}
              onChange={e => onEditMessage(e.target.value)}
              className="w-full p-3 bg-white/80 border-2 border-amber-200 rounded-xl text-amber-800 text-sm leading-relaxed resize-none outline-none focus:border-amber-400 transition-all font-medium"
              {...{placeholder: t('ui.edit_message')}}
            />
          ) : (
            <p className="text-amber-700 text-sm leading-relaxed italic">&quot;{msgValue}&quot;</p>
          )}
          <p className="text-amber-600 text-xs font-semibold bg-amber-100 rounded-xl px-3 py-2 border border-amber-200 mt-2">
            {t('ui.approval_notice')}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── SEND FORM TO PARENT MODAL ────────────────────────────────────────────────
function SendFormModal({ form, children, onSend, onClose }: any) {
  const { t } = useI18n()
  const [childId, setChildId] = useState('')
  const [message, setMessage] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!childId) { alert('Selecciona un paciente'); return }
    setSending(true)
    await onSend({ childId, message, deadline })
    setSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><Send size={20} className="text-blue-600"/> Enviar Formulario</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20}/></button>
        </div>

        <div className="bg-sky-50 rounded-xl p-4 mb-6 border border-sky-100">
          <p className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-1">{t('evaluaciones.formularioEnviar')}</p>
          <p className="font-bold text-sky-800">{form.title}</p>
          <p className="text-xs text-sky-600 mt-0.5">{form.estimatedMinutes} min aprox.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">{t('evaluaciones.pacienteStar')}</label>
            <select value={childId} onChange={e => setChildId(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 transition-all">
              <option value="">{t('ui.select_patient_option')}</option>
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.age ? ` - ${c.age}` : ''}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">{t('evaluaciones.irABiblioteca')}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">{t('ui.mensajePadres2')}</label>
            <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
              {...{placeholder: t('ui.send_form_msg')}}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 transition-all resize-none"/>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">{t('ui.fechaLimite')}</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 transition-all"/>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-bold uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl border-2 border-slate-100 transition-all">{t('common.cancelar')}</button>
            <button onClick={handleSend} disabled={sending || !childId} className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
              {sending ? 'Enviando...' : 'Enviar Formulario'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function NeuroFormsView() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'respuestas'>('biblioteca')
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedForm, setSelectedForm] = useState<FormDefinition | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [selectedChild, setSelectedChild] = useState('')
  const [children, setChildren] = useState<any[]>([])
  const [parents, setParents] = useState<any[]>([])
  const [sentForms, setSentForms] = useState<any[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [sendFormModal, setSendFormModal] = useState<FormDefinition | null>(null)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  useEffect(() => {
    supabase.from('children').select('id, name, age, diagnosis').order('name').then(({ data }: { data: any[] | null }) => data && setChildren(data))
    supabase.from('profiles').select('id, full_name, email').eq('role', 'padre').then(({ data }: { data: any[] | null }) => data && setParents(data))
    loadSentForms()
  }, [])

  const loadSentForms = async () => {
    const res = await fetch('/api/admin/forms')
    const json = await res.json()
    if (!json.error) setSentForms(json.data || [])
  }

  const filteredForms = ALL_FORMS.filter(f => {
    const matchCat = activeCategory === 'all' || f.category === activeCategory
    const matchSearch = !searchTerm || f.title.toLowerCase().includes(searchTerm.toLowerCase()) || f.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchCat && matchSearch
  })

  const handleStartForm = (form: FormDefinition) => {
    const { t } = useI18n()

    setSelectedForm(form)
    setCurrentStep(0)
    setResponses({})
    setAiAnalysis(null)
  }

  const handleAnswer = (questionId: string, value: any) => {

    setResponses(prev => ({ ...prev, [questionId]: value }))
  }

  const handleAnalyzeWithAI = async () => {
    if (!selectedForm) return
    setIsAnalyzing(true)
    try {
      const child = children.find(c => c.id === selectedChild)
      const res = await fetch('/api/analyze-neurodivergent-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          formType: selectedForm.id,
          formData: responses,
          childName: child?.name || 'Paciente',
          childAge: child?.age || 'No especificado',
          diagnosis: child?.diagnosis || '',
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setAiAnalysis(json.analysis)
      setEditedMessage(json.analysis?.mensaje_padres || '')
      toast.success('✨ Análisis generado')
    } catch (err: any) {
      toast.error('Error en análisis: ' + err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveForm = async () => {
    if (!selectedForm || !selectedChild) { toast.error('Selecciona un paciente'); return }
    setIsSaving(true)
    try {
      const { data: savedRecord } = await supabase.from('form_responses').insert([{
        child_id: selectedChild,
        form_type: selectedForm.id,
        form_title: selectedForm.title,
        responses,
        ai_analysis: aiAnalysis,
        created_at: new Date().toISOString(),
      }]).select('id').single()

      // Queue AI message for admin approval (if analysis has a parent message)
      if (aiAnalysis?.mensaje_padres) {
        const { data: child } = await supabase.from('children').select('parent_id').eq('id', selectedChild).single()
        if ((child as any)?.parent_id) {
          await fetch('/api/admin/parent-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
            body: JSON.stringify({
              child_id: selectedChild,
              parent_id: (child as any).parent_id,
              source: 'neuroforma',
              source_title: selectedForm.title,
              ai_message: editedMessage || aiAnalysis.mensaje_padres,
              ai_analysis: aiAnalysis,
              session_data: { form_type: selectedForm.id, responses },
            }),
          }).catch(e => console.error('Error queueing message:', e))
        }
      }

      setSavedRecordId((savedRecord as any)?.id || null)
      setShowSuccessScreen(true)
      toast.success('✅ Formulario guardado correctamente')
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendForm = async (form: FormDefinition, { childId, message, deadline }: any) => {
    try {
      // Get parent_id from child record
      const { data: child } = await supabase.from('children').select('parent_id').eq('id', childId).maybeSingle()
      const parentId = (child as any)?.parent_id || null

      // Validar que el niño tenga un padre vinculado antes de enviar
      if (!parentId) {
        toast.error('❌ Este paciente no tiene un padre vinculado. Ve a Pacientes y vincula un padre primero.')
        return
      }

      const res = await fetch('/api/admin/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          parent_id: parentId,
          child_id: childId,
          form_type: form.id,
          form_title: form.title,
          form_description: form.description,
          message_to_parent: message,
          deadline,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(`📤 Formulario enviado correctamente`)
      loadSentForms()
    } catch (err: any) {
      toast.error('Error al enviar: ' + err.message)
    }
  }

  const currentSection = selectedForm?.sections[currentStep]
  const totalSteps = selectedForm?.sections.length || 0
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0
  const answeredCount = Object.keys(responses).length

  // ── SUCCESS SCREEN CON BOTÓN WORD ─────────────────────────────────────────
  if (showSuccessScreen && selectedForm) {
    const handleGenerateAndDownload = async () => {
      setIsGeneratingReport(true)
      try {
        const child = children.find((c: any) => c.id === selectedChild) as any
        const childName = child?.name || 'Paciente'
        const childAge = child?.birth_date
          ? Math.floor((Date.now() - new Date(child.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365))
          : undefined

        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({
            reportType: selectedForm.id,
            childName,
            childAge,
            reportData: { responses, ai_analysis: aiAnalysis },
            evaluationId: savedRecordId || '',
            formTitle: selectedForm.title,
          }),
        })
        const json = await res.json()
        if (!json.success || !json.fileData) throw new Error(json.error || 'Sin datos')

        await supabase.from('reportes_generados').insert([{
          child_id: selectedChild,
          tipo_reporte: selectedForm.id,
          titulo: selectedForm.title + ' - ' + (children.find((c: any) => c.id === selectedChild) as any)?.name,
          nombre_archivo: json.fileName,
          file_data: json.fileData,
          mime_type: json.mimeType,
          tamano_bytes: Math.round((json.fileData.length * 3) / 4),
          fecha_generacion: new Date().toISOString(),
          generado_por: 'IA + Psicólogo',
          source_id: savedRecordId,
        }])

        const byteChars = atob(json.fileData)
        const bytes = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
        const blob = new Blob([bytes], { type: json.mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = json.fileName
        document.body.appendChild(a); a.click()
        URL.revokeObjectURL(url); document.body.removeChild(a)

        toast.success('✅ Reporte Word descargado')
      } catch (err: any) {
        toast.error('Error generando reporte: ' + (err.message || 'Intenta de nuevo'))
      } finally {
        setIsGeneratingReport(false)
      }
    }

    const resetAll = () => {
      setShowSuccessScreen(false)
      setSelectedForm(null)
      setAiAnalysis(null)
      setResponses({})
      setSavedRecordId(null)
      setCurrentStep(0)
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ color: 'var(--text-primary)' }}>Formulario guardado</h2>
          <p className="text-slate-500 font-medium">{selectedForm.title}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <button
            onClick={handleGenerateAndDownload}
            disabled={isGeneratingReport}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white rounded-2xl font-bold text-sm shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {isGeneratingReport ? (
              <><Loader2 size={18} className="animate-spin" /> Generando reporte...</>
            ) : (
              <><FileText size={18} /> Generar y Descargar Reporte Word</>
            )}
          </button>
          <button
            onClick={resetAll}
            className="flex-1 flex items-center justify-center gap-2 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-sm transition-all"
          >
            <ChevronLeft size={18} /> Volver
          </button>
        </div>
        {aiAnalysis && (
          <p className="text-xs text-sky-600 font-bold flex items-center gap-1">
            <Sparkles size={12} /> Análisis IA disponible — se incluirá en el reporte
          </p>
        )}
      </div>
    )
  }

  // ── FORM FILL MODE ──────────────────────────────────────────────────────────
  if (selectedForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30 p-4 md:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <button onClick={() => setSelectedForm(null)} className="flex items-center gap-2 text-slate-500 hover:text-sky-600 font-bold transition-all group">
            <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform"/> Volver a Formularios
          </button>
          <div className="flex items-center gap-3">
            {/* Patient selector */}
            <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}
              className="p-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all">
              <option value="">{t('common.seleccionarPaciente')}</option>
              {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={handleSaveForm} disabled={isSaving || !selectedChild || answeredCount < 3}
              className="px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-40 flex items-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle2 size={16}/>}
              Guardar
            </button>
          </div>
        </div>

        {/* Form info + progress */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-6">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-2xl bg-gradient-to-br ${selectedForm.color} flex-shrink-0`}>
                <span className="text-2xl">{selectedForm.icon}</span>
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-slate-800 text-xl">{selectedForm.title}</h2>
                <p className="text-slate-500 text-sm mt-0.5">{selectedForm.subtitle}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {selectedForm.tags.slice(0, 3).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-sky-50 text-sky-600 text-xs font-bold rounded-full">{t}</span>
                  ))}
                  <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/>{selectedForm.estimatedMinutes} min</span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-400">
                <span>{t('common.seccion')} {currentStep + 1} {t('common.de')} {totalSteps}</span>
                <span>{Math.round(progress)}% {t('ui.porcentajeCompletado').replace('% ','')}</span>
              </div>
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}/>
              </div>
              <div className="flex gap-1.5">
                {selectedForm.sections.map((_, i) => (
                  <button key={i} onClick={() => setCurrentStep(i)}
                    className={`flex-1 h-1.5 rounded-full transition-all ${i < currentStep ? 'bg-sky-500' : i === currentStep ? 'bg-sky-500' : 'bg-slate-200'}`}/>
                ))}
              </div>
            </div>
          </div>

          {/* Current section */}
          {currentSection && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-6">
              <h3 className="font-bold text-slate-800 text-lg mb-1">{currentSection.title}</h3>
              {currentSection.description && <p className="text-slate-500 text-sm mb-6">{currentSection.description}</p>}
              <div className="space-y-7">
                {currentSection.questions.map(q => (
                  <DynamicFormQuestion key={q.id} question={q} value={responses[q.id]} onChange={(v: any) => handleAnswer(q.id, v)}/>
                ))}
              </div>
            </div>
          )}

          {/* Nav + AI */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button onClick={() => setCurrentStep(s => s - 1)} className="flex-1 py-4 border-2 border-slate-200 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                  <ChevronLeft size={16}/> Anterior
                </button>
              )}
              {currentStep < totalSteps - 1 ? (
                <button onClick={() => setCurrentStep(s => s + 1)} className="flex-[2] py-4 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 hover:from-sky-700">
                  Siguiente <ChevronRight size={16}/>
                </button>
              ) : (
                <button onClick={handleAnalyzeWithAI} disabled={isAnalyzing || answeredCount < 3}
                  className="flex-[2] py-4 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-sky-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:from-sky-700">
                  {isAnalyzing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                  {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
              )}
            </div>

            {/* AI Result */}
            {aiAnalysis && (
              <AIAnalysisPanel
                analysis={aiAnalysis}
                onClose={() => setAiAnalysis(null)}
                editableMessage={editedMessage}
                onEditMessage={setEditedMessage}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── LIBRARY MODE ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30 p-4 md:p-6 lg:p-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="font-bold text-2xl md:text-3xl text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-sky-100 rounded-2xl"><Brain className="text-sky-600" size={28}/></div>
            NeuroFormas Clínicas
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1 ml-1">
            Formularios especializados · Análisis IA en tiempo real · TDAH, TEA, Sensorial y más
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('biblioteca')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'biblioteca' ? 'bg-sky-600 text-white shadow-lg shadow-sky-200' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-sky-300'}`}>
            <BookOpen size={16} className="inline mr-2"/>Biblioteca
          </button>
          <button onClick={() => setActiveTab('respuestas')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all relative ${activeTab === 'respuestas' ? 'bg-sky-600 text-white shadow-lg shadow-sky-200' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-sky-300'}`}>
            <FileText size={16} className="inline mr-2"/>Enviados
            {sentForms.filter(f => f.status === 'completed').length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {sentForms.filter(f => f.status === 'completed').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'biblioteca' ? (
        <>
          {/* Search + Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
              <input type="text" {...{placeholder: t('ui.search_label')}} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all"/>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setActiveCategory('all')}
              className={`px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${activeCategory === 'all' ? 'bg-slate-800 text-white' : 'bg-white border-2 border-slate-200 text-slate-600 hover:border-slate-400'}`}>
              🗂️ <span className="hidden sm:inline">Todos </span>({ALL_FORMS.length})
            </button>
            {Object.entries(FORM_CATEGORIES).map(([key, cat]) => {
              const count = ALL_FORMS.filter(f => f.category === key).length
              if (count === 0) return null
              return (
                <button key={key} onClick={() => setActiveCategory(key)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all border-2 ${activeCategory === key ? `bg-gradient-to-r ${cat.color} text-white border-transparent shadow-lg` : `bg-white ${cat.border} ${cat.text} hover:bg-opacity-50`}`}>
                  {cat.icon} <span className="hidden sm:inline">{cat.label} </span><span className="sm:hidden">{cat.label.split(' ')[0]} </span>({count})
                </button>
              )
            })}
          </div>

          {/* Forms grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredForms.map(form => {
              const cat = FORM_CATEGORIES[form.category]
              return (
                <div key={form.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden group">
                  {/* Card header */}
                  <div className={`bg-gradient-to-br ${form.color} p-5 relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8"/>
                    <div className="flex items-start justify-between relative z-10">
                      <div>
                        <span className="text-3xl">{form.icon}</span>
                        <div className="mt-2">
                          <span className={`text-[9px] font-bold px-2 py-1 rounded-full bg-white/20 text-white uppercase tracking-widest`}>
                            {cat.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-white">
                        <p className="text-[10px] font-bold opacity-80 flex items-center gap-1 justify-end">
                          <Clock size={10}/>{form.estimatedMinutes} min
                        </p>
                        <p className="text-[9px] font-bold opacity-70 mt-1">
                          {form.targetRole === 'parent' ? '👨‍👩 Para padres' : form.targetRole === 'both' ? '🔄 Ambos' : '🩺 Clínico'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <h3 className="font-bold text-slate-800 text-base leading-tight mb-1 group-hover:text-sky-700 transition-colors">
                      {form.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mb-3">{form.subtitle}</p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-2">{form.description}</p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {form.tags.slice(0, 3).map(tag => (
                        <span key={tag} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.bg} ${cat.text} ${cat.border} border`}>{tag}</span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button onClick={() => handleStartForm(form)} className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all bg-gradient-to-r ${form.color} text-white shadow-md hover:shadow-lg hover:opacity-90 flex items-center justify-center gap-1.5`}>
                        <FileText size={14}/> Completar
                      </button>
                      {(form.targetRole === 'parent' || form.targetRole === 'both') && (
                        <button onClick={() => setSendFormModal(form)} className="px-3 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 hover:border-sky-400 hover:text-sky-600 transition-all" title="Enviar a padres">
                          <Send size={14}/>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        /* SENT FORMS TAB */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { label: 'Enviados', value: sentForms.length, color: 'text-sky-600' },
                { label: 'Pendientes', value: sentForms.filter(f => f.status === 'pending').length, color: 'text-amber-600' },
                { label: 'Completados', value: sentForms.filter(f => f.status === 'completed').length, color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs font-bold text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {sentForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 bg-slate-100 rounded-3xl mb-4"><Send size={40} className="text-slate-300"/></div>
              <p className="font-bold text-slate-400">{t('ui.no_forms_sent')}</p>
              <p className="text-xs text-slate-300 mt-1">{t('evaluaciones.irBiblioteca2')}</p>
            </div>
          ) : sentForms.map(sf => (
            <div key={sf.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-all" onClick={() => setExpandedResponse(expandedResponse === sf.id ? null : sf.id)}>
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${sf.status === 'completed' ? 'bg-emerald-500' : sf.status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-slate-800 text-sm truncate">{sf.form_title}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${sf.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {sf.status === 'completed' ? 'Completado' : 'Pendiente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Para: {sf.profiles?.full_name || sf.profiles?.email}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{new Date(sf.created_at).toLocaleDateString(toBCP47(locale))}</p>
                </div>
                {expandedResponse === sf.id ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
              </div>

              {expandedResponse === sf.id && sf.status === 'completed' && sf.responses && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t('ui.respuestasFormulario')}</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(sf.responses).map(([k, v]) => (
                      <div key={k} className="bg-white rounded-xl p-3 border border-slate-100">
                        <p className="text-xs font-bold text-slate-400">{k}</p>
                        <p className="text-sm font-medium text-slate-700 mt-0.5">{Array.isArray(v) ? (v as string[]).join(', ') : String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Send Form Modal */}
      {sendFormModal && (
        <SendFormModal
          form={sendFormModal}
          children={children}
          onSend={(data: any) => handleSendForm(sendFormModal, data)}
          onClose={() => setSendFormModal(null)}
        />
      )}
    </div>
  )
}
