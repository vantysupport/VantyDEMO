'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

/**
 * =====================================================================
 * EVALUACIONES UNIFICADAS - Centro Clínico ABA
 * Fusiona Evaluaciones Clínicas (BRIEF2, ADOS2, WISC-V...) +
 * NeuroFormas (TDAH, TEA, Sensorial, Habilidades, Casa)
 * Con IA Gemini, envío a padres, análisis clínico profesional
 * =====================================================================
 */

import { useState, useEffect } from 'react'
import {
  Brain, Send, ChevronRight, ChevronLeft, CheckCircle2, X, Loader2,
  Sparkles, FileText, Plus, Eye, Clock, AlertTriangle, Search,
  Zap, MessageCircle, BarChart3, RefreshCw, BookOpen, Target, Heart,
  Activity, Star, ChevronDown, ChevronUp, Save, ClipboardList,
  Filter, Users, TrendingUp, Shield, Stethoscope, Home, Baby,
  CalendarDays, Lock, Unlock, Download
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  ALL_FORMS, FORM_CATEGORIES, type FormDefinition, type FormCategory
} from '../data/neurodivergentForms'
import {
  ANAMNESIS_DATA, ABA_DATA, ENTORNO_HOGAR_DATA, BRIEF2_DATA,
  ADOS2_DATA, VINELAND3_DATA, WISCV_DATA, BASC3_DATA, ABLLS_R_DATA
} from '../data/formConstants'
import { calcularEdadNumerica } from '../utils/helpers'

// ─── CATEGORÍAS ORDENADAS POR ÁREA CLÍNICA ──────────────────────────────────
const UNIFIED_CATEGORIES = [
  { id: 'all',        label: 'Todas las plantillas', icon: '🗂️', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'conductual', label: 'ABA / Sesión',          icon: '🎯', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'familia',    label: 'Familia / Hogar',       icon: '🏠', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'clinico',    label: 'Historia Clínica',      icon: '📋', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'tea',        label: 'TEA / Diagnóstico',     icon: '🧩', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'tdah',       label: 'TDAH',                  icon: '⚡', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'habilidades',label: 'Conducta Adaptativa',   icon: '🌟', color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'cognitivo',  label: 'Cognitivo / CI',        icon: '🧠', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'sensorial',  label: 'Sensorial',             icon: '🌀', color: 'bg-teal-50 text-teal-700 border-teal-200' },
]

// ─── PLANTILLAS CLÍNICAS (simplificadas según feedback clínico) ────────────────
// Solo se mantienen las plantillas que SÍ se ejecutan en la plataforma.
// Las pruebas estandarizadas (ADOS-2, WISC, etc.) corren en sus propias plataformas;
// aquí solo se registran sus resultados.
const CLINICAL_FORMS = [
  // ── ÁREA ABA (Core del sistema) ──────────────────────────────────────────
  {
    id: 'aba', title: 'Sesión ABA', subtitle: 'Registro de sesión conductual',
    category: 'conductual', icon: '🎯', tags: ['ABA', 'Sesión', 'Conductual'],
    color: 'from-orange-500 to-red-600', estimatedMinutes: 15, targetRole: 'admin',
    description: 'Registro estructurado de sesión de Análisis Conductual Aplicado',
    formKey: 'aba', area: 'ABA'
  },
  {
    id: 'entorno_hogar', title: 'Entorno en el Hogar', subtitle: 'Observación del ambiente familiar',
    category: 'familia', icon: '🏠', tags: ['Hogar', 'Familia', 'Ambiente'],
    color: 'from-pink-500 to-rose-600', estimatedMinutes: 20, targetRole: 'both',
    description: 'Análisis del entorno familiar y su impacto en el desarrollo del niño',
    formKey: 'entorno_hogar', area: 'ABA'
  },
  // ── ÁREA CLÍNICA (Historia y datos del paciente) ──────────────────────────
  {
    id: 'anamnesis', title: 'Historia Clínica', subtitle: 'Datos relevantes del cliente y contexto familiar',
    category: 'clinico', icon: '📋', tags: ['Historia', 'Inicial', 'Completo'],
    color: 'from-slate-600 to-slate-800', estimatedMinutes: 30, targetRole: 'admin',
    description: 'Historia clínica completa del paciente, antecedentes familiares y desarrollo temprano',
    formKey: 'anamnesis', area: 'Clínico'
  },
  // ── ÁREA RESULTADOS (Registro de pruebas externas) ────────────────────────
  {
    id: 'ados2', title: 'ADOS-2', subtitle: 'Registro de resultados diagnósticos',
    category: 'tea', icon: '🔬', tags: ['TEA', 'ADOS', 'Diagnóstico'],
    color: 'from-sky-600 to-sky-700', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial ADOS-2. Aquí solo registrá los resultados y puntuaciones.',
    formKey: 'ados2', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'vineland3', title: 'Vineland-3', subtitle: 'Registro de conducta adaptativa',
    category: 'habilidades', icon: '🌟', tags: ['Adaptativo', 'Vineland', 'Funcional'],
    color: 'from-green-500 to-emerald-600', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial Vineland-3. Aquí solo registrá puntuaciones compuestas y perfil.',
    formKey: 'vineland3', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'wiscv', title: 'WISC-V', subtitle: 'Registro de inteligencia (6-16 años)',
    category: 'cognitivo', icon: '📊', tags: ['CI', 'Inteligencia', 'WISC'],
    color: 'from-blue-600 to-cyan-600', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial WISC-V. Aquí solo registrá IQ y percentiles.',
    formKey: 'wiscv', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'basc3', title: 'BASC-3', subtitle: 'Registro de evaluación conductual',
    category: 'conductual', icon: '📈', tags: ['Conductual', 'BASC', 'Emocional'],
    color: 'from-amber-500 to-orange-600', estimatedMinutes: 10, targetRole: 'admin',
    description: '⚠️ Corre en plataforma oficial BASC-3. Aquí solo registrá T-scores y escalas.',
    formKey: 'basc3', area: 'Resultados', externalPlatform: true
  },
  {
    id: 'abllsr', title: 'ABLLS-R', subtitle: 'Evaluación de habilidades básicas del lenguaje y aprendizaje',
    category: 'habilidades', icon: '📚', tags: ['ABA', 'Lenguaje', 'Habilidades', 'TEA'],
    color: 'from-teal-500 to-cyan-600', estimatedMinutes: 45, targetRole: 'admin',
    description: 'Assessment of Basic Language and Learning Skills - Revised. Evalúa habilidades de cooperación, lenguaje receptivo/expresivo, socialización, academia y AVD.',
    formKey: 'abllsr', area: 'Resultados', externalPlatform: false
  },
]

// Merge NeuroForms from neurodivergentForms.ts + Clinical forms
const ALL_UNIFIED_FORMS = [
  ...CLINICAL_FORMS,
  ...ALL_FORMS.map((f: FormDefinition) => ({ ...f, formKey: null, isClinicalForm: true })),
]

// ─── QUESTION RENDERER ───────────────────────────────────────────────────────
function QuestionRenderer({ question, value, onChange }: any) {
  const { t } = useI18n()
  const freq = ['Nunca', 'Raramente', 'A veces', 'Frecuentemente', 'Casi siempre', 'Siempre']

  if (question.type === 'frequency' || question.type === 'radio') {
    const opts = question.options || freq
    return (
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">{question.label}</p>
        {question.helpText && <p className="text-xs text-slate-400 mb-2">{question.helpText}</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {opts.map((opt: string) => (
            <button key={opt} type="button" onClick={() => onChange(opt)}
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
        {question.helpText && <p className="text-xs text-slate-400 mb-2">{question.helpText}</p>}
        <div className="flex flex-wrap gap-2">
          {(question.options || []).map((opt: string) => (
            <button key={opt} type="button"
              onClick={() => {
                const s = selected.includes(opt) ? selected.filter(x => x !== opt) : [...selected, opt]
                onChange(s)
              }}
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
    const labels = question.scaleLabels || { min: 'Nunca/Leve', max: 'Siempre/Severo' }
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
          <span className="text-xs text-slate-400">{labels.min}</span>
          <span className="text-xs text-slate-400">{labels.max}</span>
        </div>
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
              className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${value === opt ? (opt === 'Sí' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-600 text-white border-slate-600') : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {opt}
            </button>
          ))}
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
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all">
          <option value="">{t('common.seleccionar')}</option>
          {(question.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    )
  }
  // Range (escala deslizante 1-5 o 1-3)
  if (question.type === 'range') {
    const min = question.min || 1
    const max = question.max || 5
    const val = Number(value) || min
    const labels = question.labels || []
    return (
      <div>
        <p className="text-sm font-bold text-slate-700 mb-3">{question.label}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">{labels[0] || min}</span>
            <span className="text-2xl font-bold text-sky-600">{val}</span>
            <span className="text-xs text-slate-400 font-bold">{labels[labels.length-1] || max}</span>
          </div>
          <input type="range" min={min} max={max} step={1} value={val}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-sky-600" />
          {labels.length > 0 && val >= min && (
            <p className="text-xs text-center font-bold text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg">
              {labels[val - min] || ''}
            </p>
          )}
        </div>
      </div>
    )
  }
  // Date
  if (question.type === 'date') {
    return (
      <div>
        <label className="text-sm font-bold text-slate-700 block mb-2">{question.label}</label>
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-sky-400 transition-all" />
      </div>
    )
  }
  // Campo generado por IA (aiGenerated: true) — solo lectura, muestra placeholder si vacío
  if (question.aiGenerated) {
    const hasValue = value && String(value).trim().length > 0
    if (question.type === 'textarea') {
      return (
        <div>
          <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
            <Sparkles size={13} className="text-sky-500" /> {question.label}
            <span className="text-[10px] font-bold text-sky-400 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 ml-1">{t('evaluaciones.generadoIA')}</span>
          </label>
          {hasValue ? (
            <textarea rows={4} value={value} onChange={e => onChange(e.target.value)}
              className="w-full p-4 bg-sky-50 border-2 border-sky-200 rounded-xl text-sm font-medium outline-none focus:border-sky-400 transition-all resize-none text-slate-700" />
          ) : (
            <div className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center gap-2 text-slate-400 text-sm">
              <Sparkles size={15} className="text-sky-300 flex-shrink-0" />
              <span>{t('evaluaciones.seCompletara')} <strong className="text-sky-500">{t('evaluaciones.analizarConIA2')}</strong></span>
            </div>
          )}
        </div>
      )
    }
    return (
      <div>
        <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-sky-500" /> {question.label}
          <span className="text-[10px] font-bold text-sky-400 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 ml-1">Generado por IA</span>
        </label>
        {hasValue ? (
          <input type="text" value={value} onChange={e => onChange(e.target.value)}
            className="w-full p-4 bg-sky-50 border-2 border-sky-200 rounded-xl text-sm font-medium outline-none focus:border-sky-400 transition-all" />
        ) : (
          <div className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex items-center gap-2 text-slate-400 text-sm">
            <Sparkles size={15} className="text-sky-300 flex-shrink-0" />
            <span>{t('evaluaciones.seCompletara2')} <strong className="text-sky-500">{t('evaluaciones.analizarConIA2')}</strong></span>
          </div>
        )}
      </div>
    )
  }

  // Campo de solo lectura (readonly: true) — calculado automáticamente
  if (question.readonly) {
    const hasValue = value !== undefined && value !== null && String(value).trim().length > 0
    return (
      <div>
        <label className="text-sm font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
          <Lock size={13} className="text-slate-400" /> {question.label}
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 ml-1">Auto-calculado</span>
        </label>
        {hasValue ? (
          <div className="w-full p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-sm font-bold text-emerald-800">
            {value}
          </div>
        ) : (
          <div className="w-full p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
            Se calculará con el análisis IA
          </div>
        )}
      </div>
    )
  }

  // Default: text / number input
  return (
    <div>
      <label className="text-sm font-bold text-slate-700 block mb-2">{question.label}</label>
      {question.helpText && <p className="text-xs text-slate-400 mb-2">{question.helpText}</p>}
      <input type={question.type === 'number' ? 'number' : 'text'}
        min={question.min} max={question.max}
        value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={question.placeholder}
        className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-sky-400 transition-all" />
    </div>
  )
}

// ─── HELPER: convierte string con guiones/saltos o array → array limpio ───────
function toArray(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') {
    return val
      .split(/\n|;/)
      .map((s: string) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

// ─── AI ANALYSIS DISPLAY ─────────────────────────────────────────────────────
function AIAnalysisPanel({ analysis, editableMessage, onEditMessage, editableActividades, onEditActividades }: { analysis: any; editableMessage?: string; onEditMessage?: (v: string) => void; editableActividades?: string; onEditActividades?: (v: string) => void }) {
  const { t } = useI18n()

  if (!analysis) return null
  const alertColors: Record<string, string> = {
    bajo: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    moderado: 'bg-amber-50 border-amber-200 text-amber-800',
    alto: 'bg-red-50 border-red-200 text-red-800',
  }
  const alertIcons: Record<string, string> = { bajo: '✅', moderado: '⚠️', alto: '🚨' }

  // Normalizar todos los campos que pueden venir como string o array
  const areasFortaleza    = toArray(analysis.areas_fortaleza)
  const areasTrabajo      = toArray(analysis.areas_trabajo)
  const recomendaciones   = toArray(analysis.recomendaciones)
  const indicadoresClave  = toArray(analysis.indicadores_clave)
  const formsRecomendados = toArray(analysis.formularios_recomendados)

  // Texto de análisis clínico — puede venir en distintas claves según el formulario
  const textoAnalisis =
    analysis.analisis_clinico ||
    analysis.analisis_ia ||
    analysis.analisis_vineland_ia ||
    analysis.analisis_diagnostico_ia ||
    analysis.analisis_basc_ia ||
    analysis.perfil_cognitivo_ia ||
    analysis.resumen_ejecutivo || ''

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <div className="w-8 h-8 bg-gradient-to-br from-sky-600 to-sky-700 rounded-xl flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <h3 className="font-bold text-slate-800" style={{ color: "var(--text-primary)" }}>{t('evaluaciones.analisisIA')}</h3>
      </div>

      {/* Alert level */}
      {analysis.nivel_alerta && (
        <div className={`px-4 py-3 rounded-xl border-2 font-bold text-sm flex items-center gap-2 ${alertColors[analysis.nivel_alerta] || alertColors.bajo}`}>
          <span className="text-lg">{alertIcons[analysis.nivel_alerta] || '✅'}</span>
          Nivel de alerta: <span className="uppercase">{analysis.nivel_alerta}</span>
        </div>
      )}

      {/* Clinical analysis */}
      {textoAnalisis ? (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <h4 className="text-xs font-bold text-slate-500 mb-2">{t('evaluaciones.analisisClinico')}</h4>
          <p className="text-sm text-slate-700 leading-relaxed">{textoAnalisis}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Strengths */}
        {areasFortaleza.length > 0 && (
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <h4 className="text-xs font-bold text-emerald-600 mb-2">💪 Fortalezas</h4>
            <ul className="space-y-1">
              {areasFortaleza.map((f: string, i: number) => (
                <li key={i} className="text-xs text-emerald-800 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* Work areas */}
        {areasTrabajo.length > 0 && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <h4 className="text-xs font-bold text-amber-600 mb-2">{t('evaluaciones.areasTrabajar')}</h4>
            <ul className="space-y-1">
              {areasTrabajo.map((f: string, i: number) => (
                <li key={i} className="text-xs text-amber-800 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {recomendaciones.length > 0 && (
        <div className="bg-sky-50 rounded-xl p-4 border border-sky-200">
          <h4 className="text-xs font-bold text-sky-600 mb-2">💡 Recomendaciones</h4>
          <ul className="space-y-1.5">
            {recomendaciones.map((r: string, i: number) => (
              <li key={i} className="text-xs text-sky-800 font-medium flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 bg-sky-500 rounded-full shrink-0 mt-1" />{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key indicators */}
      {indicadoresClave.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-500 mb-2">🔍 Indicadores Clave</h4>
          <div className="flex flex-wrap gap-2">
            {indicadoresClave.map((ind: string, i: number) => (
              <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200">{ind}</span>
            ))}
          </div>
        </div>
      )}

      {/* Next recommended forms */}
      {formsRecomendados.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-sky-600 mb-2">{t('evaluaciones.proxEvals')}</h4>
          <div className="flex flex-wrap gap-2">
            {formsRecomendados.map((f: string, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-full text-xs font-bold">{f}</span>
            ))}
          </div>
        </div>
      )}

      {/* Mensaje al padre/madre - editable */}
      {(analysis.mensaje_padres || editableMessage !== undefined) && (
        <div className="space-y-4">
          {/* Sección 1: Mensaje al padre */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border-2 border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center">
                <MessageCircle size={14} className="text-white"/>
              </div>
              <h4 className="font-bold text-amber-800">{t('ui.mensajePadres')}</h4>
              <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full border border-amber-300">✏️ Editable</span>
            </div>
            {onEditMessage ? (
              <textarea
                rows={4}
                value={editableMessage !== undefined ? editableMessage : (analysis.mensaje_padres || '')}
                onChange={e => onEditMessage(e.target.value)}
                className="w-full p-3 /80 border-2 border-amber-200 rounded-xl text-amber-800 text-sm leading-relaxed resize-none outline-none focus:border-amber-400 transition-all font-medium mb-2" style={{ background: "var(--card)" }}
                {...{placeholder: t('ui.edit_message')}}
              />
            ) : (
              <p className="text-amber-700 text-sm leading-relaxed mb-3 italic">&quot;{editableMessage || analysis.mensaje_padres}&quot;</p>
            )}
            <p className="text-amber-600 text-xs font-semibold bg-amber-100 rounded-xl px-3 py-2 border border-amber-200">
              {t('ui.approval_notice_parent')}
            </p>
          </div>

          {/* Sección 2: Actividad para casa */}
          {(analysis.actividades_casa || analysis.actividad_casa || editableActividades !== undefined) && (
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl p-5 border-2 border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs font-bold">🏠</span>
                </div>
                <h4 className="font-bold text-blue-800">{t('ui.home_activity')}</h4>
                <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full border border-blue-300">✏️ Editable</span>
              </div>
              {onEditActividades ? (
                <textarea
                  rows={5}
                  value={editableActividades !== undefined ? editableActividades : (analysis.actividades_casa || analysis.actividad_casa || '')}
                  onChange={e => onEditActividades(e.target.value)}
                  className="w-full p-3 /80 border-2 border-blue-200 rounded-xl text-blue-800 text-sm leading-relaxed resize-none outline-none focus:border-blue-400 transition-all font-medium" style={{ background: "var(--card)" }}
                  {...{placeholder: t('ui.home_activity_desc')}}
                />
              ) : (
                <p className="text-blue-700 text-sm leading-relaxed italic whitespace-pre-wrap">{editableActividades || analysis.actividades_casa || analysis.actividad_casa}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SEND FORM MODAL ─────────────────────────────────────────────────────────
// ==============================================================================
// COMPONENTE: TARJETA DE FORMULARIO EN HISTORIAL CON BOTÓN "GENERAR REPORTE"
// ==============================================================================
function HistorialFormCard({ sf, onReportGenerated }: { sf: any; onReportGenerated: () => void | Promise<void>; key?: any }) {
  const { t, locale } = useI18n()
  const [generating, setGenerating] = useState(false)
  const toast = useToast()

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      // Fetch the full responses from the DB (the list query only has metadata)
      const sourceTable = sf._source || 'form_responses'
      const isClinicalTable = ['anamnesis_completa', 'registro_aba', 'registro_entorno_hogar'].includes(sourceTable)
      const selectFields = isClinicalTable
        ? 'datos, ai_analysis, form_type, form_title'
        : 'responses, ai_analysis, form_type, form_title'
      const { data: fullRecord, error } = await supabase
        .from(sourceTable)
        .select(selectFields)
        .eq('id', sf.id)
        .maybeSingle()

      if (error) throw error

      const childName = (sf as any).children?.name || t('nav.pacientes')
      const reportData = {
        responses: fullRecord?.responses || fullRecord?.datos || {},
        ai_analysis: fullRecord?.ai_analysis,
      }
      // Mapear _source a form_type cuando la tabla clínica no tiene columna form_type
      const sourceToType: Record<string, string> = {
        registro_aba: 'aba',
        anamnesis_completa: 'anamnesis',
        registro_entorno_hogar: 'entorno_hogar',
      }
      const reportType = fullRecord?.form_type || sf.form_type ||
        sourceToType[sf._source || ''] || 'aba'
      const formTitle  = fullRecord?.form_title  || sf.form_title  || 'Formulario'

      // Call generate-report from browser (no serverless timeout issue)
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          reportType,
          childName,
          reportData,
          evaluationId: sf.id,
          formTitle,
        }),
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = await res.json()
      if (!json.success || !json.fileData) throw new Error(json.error || 'Sin datos')

      // Save to reportes_generados
      const { error: insertError } = await supabase.from('reportes_generados').insert([{
        child_id:         sf.child_id,
        tipo_reporte:     reportType,
        titulo:           `${formTitle} - ${childName}`,
        nombre_archivo:   json.fileName,
        file_data:        json.fileData,
        mime_type:        json.mimeType,
        tamano_bytes:     Math.round((json.fileData.length * 3) / 4),
        fecha_generacion: new Date().toISOString(),
        generado_por:     'IA + Psicólogo',
        source_id:        sf.id,
      }])
      if (insertError) {
        console.error('❌ Error guardando reporte en BD:', insertError)
        toast.error('Reporte descargado pero no se pudo guardar en historial: ' + insertError.message)
      }

      // Auto-download
      const byteChars = atob(json.fileData)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: json.mimeType })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = json.fileName
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)

      toast.success('✅ Reporte Word generado y descargado')
      onReportGenerated()
    } catch (err: any) {
      console.error('Error generando reporte:', err)
      toast.error('Error al generar reporte: ' + (err.message || 'Intenta de nuevo'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className=" rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all" style={{ background: "var(--card)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-slate-800 text-sm truncate" style={{ color: "var(--text-primary)" }}>
              {sf.form_title || sf.form_type || 'Formulario'}
            </p>
            {sf._source && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 whitespace-nowrap">
                {sf._source === 'anamnesis_completa' ? 'Anamnesis' :
                 sf._source === 'registro_aba' ? 'ABA' :
                 sf._source === 'registro_entorno_hogar' ? 'Hogar' : 'NeuroForma'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Baby size={10} /> {(sf as any).children?.name || t('nav.pacientes')} · {new Date(sf.created_at).toLocaleDateString(toBCP47(locale))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {sf.ai_analysis && (
            <span className="px-2 py-1 bg-sky-50 text-sky-600 rounded-full text-[10px] font-bold border border-sky-200 flex items-center gap-1">
              <Sparkles size={9} /> Con IA
            </span>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {generating ? (
              <><Loader2 size={12} className="animate-spin" /> {t('common.generando')}</>
            ) : (
              <><Download size={12} /> {t('reportes.generar')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function SendFormModal({ form, children, onSend, onClose }: any) {
  const { t } = useI18n()

  const [childId, setChildId] = useState('')
  const [message, setMessage] = useState('')
  const [deadline, setDeadline] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    if (!childId) { alert(t('ui.seleccionaPaciente2')); return }
    setSending(true)
    await onSend({ childId, message, deadline })
    setSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className=" rounded-3xl p-8 w-full max-w-md shadow-2xl" style={{ background: "var(--card)" }}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Send size={20} className="text-sky-600" /> {t('common.enviarPadres')}
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={20} /></button>
        </div>

        <div className="bg-sky-50 rounded-xl p-4 mb-6 border border-sky-100">
          <p className="text-xs font-bold text-sky-400 mb-1">{t('evaluaciones.titulo')}</p>
          <p className="font-bold text-sky-800">{form.title}</p>
          <p className="text-xs text-sky-600 mt-0.5">{form.estimatedMinutes} min aprox.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-2">{t('evaluaciones.pacienteStar')}</label>
            <select value={childId} onChange={e => setChildId(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all">
              <option value="">{t('ui.select_patient_option')}</option>
              {children.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.age ? ` (${c.age})` : ''}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">{t('evaluaciones.irABiblioteca')}</p>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-2">{t('evaluaciones.mensaje')}</label>
            <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
              {...{placeholder: t('ui.send_form_msg')}}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-2">{t('evaluaciones.fechaLimite2')}</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-sky-400 transition-all" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-4 text-slate-400 font-bold uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl border-2 border-slate-100 transition-all">{t('common.cancelar')}</button>
            <button onClick={handleSend} disabled={sending || !childId}
              className="flex-[2] py-4 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── FORM FILL VIEW ─────────────────────────────────────────────────────────
function FormFillView({ form, children, onBack, toast, initialChildId, initialChildName }: any) {
  const { t } = useI18n()

  const [currentStep, setCurrentStep] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [selectedChild, setSelectedChild] = useState(initialChildId || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [editedMessage, setEditedMessage] = useState('')
  const [editedActividades, setEditedActividades] = useState('')
  const [isClinicalForm] = useState(!!(form as any).isClinicalForm)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null)
  const [savedChildId, setSavedChildId] = useState<string>('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // Get sections based on form type
  const getSections = () => {

    if (isClinicalForm) return form.sections
    const formDataMap: Record<string, any> = {
      anamnesis: ANAMNESIS_DATA, aba: ABA_DATA, entorno_hogar: ENTORNO_HOGAR_DATA,
      brief2: BRIEF2_DATA, ados2: ADOS2_DATA, vineland3: VINELAND3_DATA,
      wiscv: WISCV_DATA, basc3: BASC3_DATA, abllsr: ABLLS_R_DATA
    }
    return formDataMap[form.formKey] || []
  }

  const sections = getSections()
  const totalSteps = sections.length
  const currentSection = sections[currentStep]
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0
  const answeredCount = Object.keys(responses).length

  const handleResponse = (id: string, value: any) => {
    setResponses(prev => ({ ...prev, [id]: value }))
  }

  const handleAnalyzeWithAI = async () => {
    if (isAnalyzing) return // Guard contra doble click
    setIsAnalyzing(true)
    try {
      const child = children.find((c: any) => c.id === selectedChild)

      if (isClinicalForm) {
        // NeuroForma - usa API específica
        const res = await fetch('/api/analyze-neurodivergent-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({
            formType: form.id,
            formData: responses,
            childName: child?.name || t('nav.pacientes'),
            childAge: child?.age || calcularEdadNumerica(child?.birth_date) || 'N/E',
            diagnosis: child?.diagnosis || '',
            childId: selectedChild,
          }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        const nfAnalysis = json.analysis || {}
        setResponses((prev: any) => ({ ...prev, ...nfAnalysis }))
        setAiAnalysis(nfAnalysis)
        setEditedMessage(nfAnalysis?.mensaje_padres || '')
        setEditedActividades(nfAnalysis?.actividades_casa || nfAnalysis?.actividad_casa || '')
      } else {
        const childName = child?.name || t('nav.pacientes')
        const childAge  = child?.age || calcularEdadNumerica(child?.birth_date) || 'N/E'
        const diagnosis = child?.diagnosis || ''

        let endpoint = '/api/analyze-neurodivergent-form'
        let payload: any = {
          formType:  form.formKey || form.id,
          formData:  responses,
          childName,
          childAge,
          diagnosis,
          childId: selectedChild,
        }

        if (form.formKey === 'entorno_hogar') {
          endpoint = '/api/generate-home-environment-report'
          payload = { ...responses, childName, childAge, diagnosis, childId: selectedChild }
        } else if (form.formKey === 'aba') {
          if (responses.antecedente && responses.conducta && responses.consecuencia) {
            endpoint = '/api/generate-session-report'
            payload = { ...responses, childName, childAge, childId: selectedChild }
          }
        } else if (['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3', 'abllsr'].includes(form.formKey)) {
          endpoint = '/api/analyze-professional-evaluation'
          payload = { evaluationType: form.formKey.toLowerCase(), childName, childAge, childId: selectedChild, responses }
        }

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok || json.error) throw new Error(json.error || `Error ${res.status}`)
        // analyze-professional-evaluation devuelve el objeto directo (sin .analysis wrapper)
        // analyze-neurodivergent-form devuelve { analysis: { ... } }
        const rawAnalysis = json.analysis && typeof json.analysis === 'object' ? json.analysis : json
        console.log('🔬 rawAnalysis keys:', Object.keys(rawAnalysis))
        // Aplanar metricas al nivel raíz para que los campos del formulario los muestren
        const analysis: any = { ...rawAnalysis }
        if (rawAnalysis.metricas) {
          const m = rawAnalysis.metricas
          if (m.comunicacion !== undefined)      analysis.puntuacion_comunicacion      = m.comunicacion
          if (m.socializacion !== undefined)     analysis.puntuacion_socializacion     = m.socializacion
          if (m.vida_diaria !== undefined)       analysis.puntuacion_vida_diaria        = m.vida_diaria
          if (m.indice_global !== undefined)     analysis.indice_conducta_adaptativa   = m.indice_global
          if (m.inhibicion !== undefined)        analysis.inhibicion                   = m.inhibicion
          if (m.flexibilidad !== undefined)      analysis.flexibilidad                 = m.flexibilidad
          if (m.total !== undefined)             analysis.total_brief                  = m.total
          if (m.ci_total !== undefined)          analysis.ci_total                     = m.ci_total
          if (m.clasificacion !== undefined)     analysis.clasificacion_ci             = m.clasificacion
          if (m.icv !== undefined)               analysis.icv_total                    = m.icv
          if (m.ive !== undefined)               analysis.ive_total                    = m.ive
          if (m.irf !== undefined)               analysis.irf_total                    = m.irf
          if (m.imt !== undefined)               analysis.imt_total                    = m.imt
          if (m.ivp !== undefined)               analysis.ivp_total                    = m.ivp
          if (m.icv_percentil !== undefined)     analysis.icv_percentil                = m.icv_percentil
          if (m.ive_percentil !== undefined)     analysis.ive_percentil                = m.ive_percentil
          if (m.irf_percentil !== undefined)     analysis.irf_percentil                = m.irf_percentil
          if (m.imt_percentil !== undefined)     analysis.imt_percentil                = m.imt_percentil
          if (m.ivp_percentil !== undefined)     analysis.ivp_percentil                = m.ivp_percentil
          if (m.ci_percentil !== undefined)      analysis.ci_percentil                 = m.ci_percentil
          if (m.indice_sintomas !== undefined)   analysis.indice_sintomas_conductuales = m.indice_sintomas
          if (m.perfil_riesgo !== undefined)     analysis.perfil_riesgo                = m.perfil_riesgo
          if (m.severidad !== undefined)         analysis.nivel_severidad              = m.severidad
          if (m.afecto_social !== undefined)     analysis.puntuacion_total             = m.afecto_social
        }
        // También mezclar con las respuestas del formulario para que aparezcan en los campos
        setResponses((prev: any) => ({ ...prev, ...analysis }))
        setAiAnalysis(analysis)
        setEditedMessage(analysis?.mensaje_padres || analysis?.informe_padres_vineland || analysis?.informe_padres_wisc || analysis?.informe_padres_basc || analysis?.informe_familia_ados || analysis?.informe_padres_entorno || analysis?.mensaje_padres_entorno || analysis?.informe_padres_ablls || analysis?.informe_padres || '')
        setEditedActividades(analysis?.actividades_casa || analysis?.actividad_casa || '')
      }
      toast.success('✨ Análisis IA generado')
    } catch (err: any) {
      const isQuota = err.message?.includes('Cuota') || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')
      toast.error(isQuota 
        ? '⏳ Cuota de IA agotada. Espera 1-2 minutos e intenta nuevamente.' 
        : 'Error en análisis: ' + err.message
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!selectedChild) { toast.error('Selecciona un paciente'); return }
    if (answeredCount < 2) { toast.error('Responde al menos 2 preguntas'); return }
    setIsSaving(true)
    try {
      const table = isClinicalForm ? 'form_responses' : (
        form.formKey === 'anamnesis' ? 'anamnesis_completa' :
        form.formKey === 'aba' ? 'registro_aba' :
        form.formKey === 'entorno_hogar' ? 'registro_entorno_hogar' : 'form_responses'
      )

      // Build insert payload — form_title may not exist in all clinical tables yet
      // The migration below adds it; until then we store it only in form_responses
      const now = new Date().toISOString()
      const insertPayload: any = { child_id: selectedChild }

      if (isClinicalForm) {
        // form_responses: tiene form_type, form_title, responses, ai_analysis, created_at
        insertPayload.form_type  = form.formKey || form.id
        insertPayload.form_title = form.title
        insertPayload.responses  = responses
        insertPayload.ai_analysis = aiAnalysis
        insertPayload.created_at  = now
      } else if (table === 'anamnesis_completa') {
        // anamnesis_completa: child_id, datos, fecha_creacion, form_title, creado_por
        insertPayload.datos          = responses
        insertPayload.fecha_creacion = now
        insertPayload.form_title     = form.title
      } else if (table === 'registro_aba') {
        // registro_aba: child_id, fecha_sesion, datos, form_title
        insertPayload.datos        = responses
        insertPayload.fecha_sesion = responses['fecha_sesion'] || now.split('T')[0]
        insertPayload.form_title   = form.title
      } else if (table === 'registro_entorno_hogar') {
        // registro_entorno_hogar: child_id, fecha_visita, datos, created_at, form_title
        insertPayload.datos        = responses
        insertPayload.fecha_visita = responses['fecha_visita'] || now
        insertPayload.created_at   = now
        insertPayload.form_title   = form.title
      } else {
        // form_responses fallback
        insertPayload.form_type   = form.formKey || form.id
        insertPayload.form_title  = form.title
        insertPayload.responses   = responses
        insertPayload.ai_analysis = aiAnalysis
        insertPayload.created_at  = now
      }

      const { data: savedRecord } = await supabase.from(table).insert([insertPayload]).select().single()

      // Guardado exitoso - mostrar pantalla de éxito con botón de reporte
      setSavedRecordId((savedRecord as any)?.id || null)
      setSavedChildId(selectedChild)
      setShowSuccessScreen(true)
      toast.success('✅ Formulario guardado correctamente')

      // Queue AI-generated parent message for admin approval (if it exists)
      if (aiAnalysis?.mensaje_padres) {
        const { data: child } = await supabase.from('children').select('parent_id').eq('id', selectedChild).single()
        if ((child as any)?.parent_id) {
          await fetch('/api/admin/parent-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
            body: JSON.stringify({
              child_id: selectedChild,
              parent_id: (child as any).parent_id,
              source: isClinicalForm ? 'neuroforma' : 'evaluacion',
              source_title: form.title,
              ai_message: editedMessage || aiAnalysis.mensaje_padres,
              actividades_casa: editedActividades || aiAnalysis.actividades_casa || aiAnalysis.actividad_casa,
              ai_analysis: aiAnalysis,
              session_data: { form_type: form.formKey || form.id, responses },
            }),
          }).catch(e => console.error('Error queueing message:', e))
        }
      }
      // No llamamos onBack() aquí - la pantalla de éxito permite al usuario descargar el reporte
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ── PANTALLA DE ÉXITO CON BOTÓN DE REPORTE ──────────────────────────────
  if (showSuccessScreen) {
    const handleGenerateAndDownload = async () => {
      setIsGeneratingReport(true)
      try {
        const child = children.find((c: any) => c.id === savedChildId) as any
        const childName = child?.name || 'Paciente'
        const childAge  = child?.age  || calcularEdadNumerica(child?.birth_date)
        const reportType = isClinicalForm ? (form.id || 'neuroforma') : (form.formKey || form.id)

        const res = await fetch('/api/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({
            reportType,
            childName,
            childAge,
            reportData: { responses, ai_analysis: aiAnalysis },
            evaluationId: savedRecordId || '',
            formTitle: form.title,
          }),
        })
        const json = await res.json()
        if (!json.success || !json.fileData) throw new Error(json.error || 'Sin datos')

        // Guardar en reportes_generados
        await supabase.from('reportes_generados').insert([{
          child_id:         savedChildId,
          tipo_reporte:     reportType,
          titulo:           `${form.title} - ${childName}`,
          nombre_archivo:   json.fileName,
          file_data:        json.fileData,
          mime_type:        json.mimeType,
          tamano_bytes:     Math.round((json.fileData.length * 3) / 4),
          fecha_generacion: new Date().toISOString(),
          generado_por:     'IA + Psicólogo',
          source_id:        savedRecordId,
        }])

        // Descargar automáticamente
        const byteChars = atob(json.fileData)
        const bytes = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
        const blob = new Blob([bytes], { type: json.mimeType })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
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

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2" style={{ color: "var(--text-primary)" }}>{t('evaluaciones.formGuardado')}</h2>
          <p className="text-slate-500 font-medium">{form.title}</p>
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
              <><Download size={18} /> Generar y Descargar Reporte Word</>
            )}
          </button>
          <button
            onClick={onBack}
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

  if (!currentSection) return null

  const questions = currentSection.questions || currentSection.items || []

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Header barra */}
      <div className="flex-shrink-0 border-b shadow-sm z-20" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-1.5 hover:text-sky-500 font-bold transition-all text-sm group" style={{ color: "var(--text-muted)" }}>
            <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Volver
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Sección {currentStep + 1} de {totalSteps}
              </p>
              <p className="text-xs font-bold text-sky-600">{Math.round(progress)}% completado</p>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted-bg)" }}>
              <div className="h-full bg-gradient-to-r from-sky-500 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto"><div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Form info card */}
        <div className={`bg-gradient-to-r ${form.color || 'from-sky-600 to-cyan-600'} rounded-2xl p-5 text-white shadow-lg`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-white/70 text-xs font-bold mb-1">{form.icon} {form.category?.toUpperCase()}</p>
              <h2 className="font-bold text-xl">{form.title}</h2>
              <p className="text-white/80 text-sm mt-0.5">{form.subtitle}</p>
            </div>
            {initialChildId ? (
              <div className="bg-white/20 backdrop-blur-sm border-2 border-white/30 rounded-xl px-4 py-2.5 text-sm font-bold text-white min-w-[180px] text-center">
                {initialChildName || children.find((c: any) => c.id === selectedChild)?.name || '—'}
              </div>
            ) : (
              <select value={selectedChild} onChange={e => setSelectedChild(e.target.value)}
                className="bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:bg-white/30 transition-all min-w-[180px]">
                <option value="" className="text-slate-800" style={{ color: "var(--text-primary)" }}>{t('evaluaciones.selecPac')}</option>
                {children.map((c: any) => <option key={c.id} value={c.id} className="text-slate-800" style={{ color: "var(--text-primary)" }}>{c.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Section */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}>
          <div className="px-6 py-4 border-b" style={{ background: "var(--muted-bg)", borderColor: "var(--card-border)" }}>
            <h3 className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>{currentSection.title || currentSection.section}</h3>
            {(currentSection.description || currentSection.subtitle) && (
              <p className="text-sm text-slate-500 mt-1">{currentSection.description || currentSection.subtitle}</p>
            )}
          </div>
          <div className="p-6 space-y-6">
            {questions.map((q: any) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                value={responses[q.id]}
                onChange={(val: any) => handleResponse(q.id, val)}
              />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => setCurrentStep(s => s - 1)} disabled={currentStep === 0}
            className="flex items-center gap-2 px-6 py-3  border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:border-sky-300 disabled:opacity-40 transition-all" style={{ background: "var(--card)" }}>
            <ChevronLeft size={18} /> Anterior
          </button>

          <div className="flex items-center gap-3">
            {/* Show AI button from page 6+ for ABA, or on last step for others */}
            {(currentStep === totalSteps - 1 || (form.formKey === 'aba' && currentStep >= 5)) && (
              <>
                <button onClick={handleAnalyzeWithAI} disabled={isAnalyzing || answeredCount < 3}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold disabled:opacity-40 transition-all shadow-lg shadow-sky-200 hover:opacity-90">
                  {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                  {isAnalyzing ? 'Analizando...' : 'Analizar con IA'}
                </button>
                {currentStep === totalSteps - 1 && (
                  <button onClick={handleSave} disabled={isSaving || !selectedChild}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-40 transition-all">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar
                  </button>
                )}
              </>
            )}
            {currentStep < totalSteps - 1 && (
              <>
                {currentStep === totalSteps - 1 && (
                  <button onClick={handleSave} disabled={isSaving || !selectedChild}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold disabled:opacity-40 transition-all">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Guardar
                  </button>
                )}
                <button onClick={() => setCurrentStep(s => s + 1)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-sky-200 hover:opacity-90">
                  Siguiente <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* AI Analysis */}
        {aiAnalysis && (
          <div className=" rounded-2xl shadow-sm border border-sky-100 p-6" style={{ background: "var(--card)" }}>
            <AIAnalysisPanel analysis={aiAnalysis} editableMessage={editedMessage} onEditMessage={setEditedMessage} editableActividades={editedActividades} onEditActividades={setEditedActividades} />
          </div>
        )}
      </div>
    </div></div>
  )
}

// ─── FORM CARD ───────────────────────────────────────────────────────────────
function FormCard({ form, onStart, onSend, catInfo }: any) {
  const { t } = useI18n()
  const isExternal = (form as any).externalPlatform
  const isPro = form.formKey
  const isParent = form.targetRole === 'parent' || form.targetRole === 'both'

  return (
    <div className="rounded-xl overflow-hidden transition-all hover:shadow-md group"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      {/* Top accent bar - thin, tasteful */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${isExternal ? '#b07830' : isPro ? '#7a4a4a' : '#4a6eaa'}, transparent)` }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background: 'var(--muted-bg)' }}>
              {form.icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{form.title}</h3>
              <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{form.subtitle}</p>
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
            {isPro && !isExternal && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold"
                style={{ background: 'rgba(122,74,74,0.1)', color: '#7a4a4a', border: '1px solid rgba(122,74,74,0.2)' }}>
                PRO
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{form.description}</p>

        {/* Tags + time */}
        <div className="flex flex-wrap gap-1 mb-4">
          {form.tags?.slice(0, 3).map((tag: string) => (
            <span key={tag} className="px-2 py-0.5 rounded text-[9px] font-semibold"
              style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
              {tag}
            </span>
          ))}
          <span className="px-2 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1"
            style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
            <Clock size={8} /> {form.estimatedMinutes}m
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => onStart(form)}
            className="flex-1 py-2.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5"
            style={{ background: 'var(--text-primary)', color: 'var(--card)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
            <FileText size={12} /> {t('evaluaciones.completar')}
          </button>
          {isParent && (
            <button onClick={() => onSend(form)}
              className="px-3 py-2.5 rounded-lg transition-all"
              style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}
              title="Enviar a padres">
              <Send size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function EvaluacionesUnificadas({ initialChildId, initialChildName }: { initialChildId?: string; initialChildName?: string } = {}) {
  const toast = useToast()
  const { t, locale } = useI18n()
  const [activeTab, setActiveTab] = useState<'biblioteca' | 'enviados' | 'historial'>('biblioteca')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedChild, setSelectedChild] = useState(initialChildId || '')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedForm, setSelectedForm] = useState<any>(null)
  const [children, setChildren] = useState<any[]>([])
  const [parents, setParents] = useState<any[]>([])
  const [sentForms, setSentForms] = useState<any[]>([])
  const [savedForms, setSavedForms] = useState<any[]>([])
  const [sendFormModal, setSendFormModal] = useState<any>(null)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // initialChildId ya se usa como valor inicial del estado
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [childrenRes, parentsRes, sentRes, formResponsesRes, anamnesisRes, abaRes, entornoRes] = await Promise.all([
      supabase.from('children').select('id, name, age, birth_date, diagnosis').order('name'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'padre'),
      supabase.from('parent_forms').select('*, profiles(full_name, email)').order('created_at', { ascending: false }),
      supabase.from('form_responses').select('id, form_type, form_title, ai_analysis, created_at, child_id, children(name)').order('created_at', { ascending: false }).limit(30),
      supabase.from('anamnesis_completa').select('id, form_title, created_at, child_id, children(name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('registro_aba').select('id, form_title, datos, child_id, fecha_sesion, children(name)').order('fecha_sesion', { ascending: false }).limit(10),
      supabase.from('registro_entorno_hogar').select('id, form_title, datos, child_id, fecha_visita, created_at, children(name)').order('fecha_visita', { ascending: false }).limit(10),
    ])
    if (childrenRes.data) setChildren(childrenRes.data)
    if (parentsRes.data) setParents(parentsRes.data)
    if (sentRes.data) setSentForms(sentRes.data)

    // Merge all saved form sources into one unified historial
    const allSaved = [
      ...(formResponsesRes.data || []),
      ...(anamnesisRes.data || []).map((r: any) => ({ ...r, _source: 'anamnesis_completa', form_title: r.form_title || 'Historia Clínica (Anamnesis)' })),
      ...(abaRes.data || []).map((r: any) => ({ ...r, _source: 'registro_aba', form_title: r.form_title || 'Sesión ABA' })),
      ...(entornoRes.data || []).map((r: any) => ({ ...r, _source: 'registro_entorno_hogar', form_title: r.form_title || 'Entorno del Hogar' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setSavedForms(allSaved)
    setLoading(false)
  }

  const handleSendForm = async (form: any, { childId, message, deadline }: any) => {
    try {
      // Derive parent_id from child record
      const { data: child } = await supabase.from('children').select('parent_id').eq('id', childId).maybeSingle()
      const parentId = (child as any)?.parent_id || null

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
      toast.success('📤 Formulario enviado')
      loadData()
    } catch (err: any) {
      toast.error('Error al enviar: ' + err.message)
    }
  }

  // Filter forms
  const filteredForms = ALL_UNIFIED_FORMS.filter(form => {
    if (activeCategory !== 'all' && form.category !== activeCategory) return false
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return form.title.toLowerCase().includes(term) ||
        form.subtitle.toLowerCase().includes(term) ||
        form.description.toLowerCase().includes(term) ||
        form.tags?.some((t: string) => t.toLowerCase().includes(term))
    }
    return true
  })

  // If filling a form
  if (selectedForm) {
    return <FormFillView form={selectedForm} children={children} onBack={() => setSelectedForm(null)} toast={toast} initialChildId={initialChildId} initialChildName={initialChildName} />
  }

  const stats = {
    total: ALL_UNIFIED_FORMS.length,
    neuro: ALL_FORMS.length,
    clinical: CLINICAL_FORMS.length,
    sent: sentForms.length,
    pending: sentForms.filter(f => f.status === 'pending').length,
    completed: sentForms.filter(f => f.status === 'completed').length,
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── HEADER STATS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Formularios',                      value: stats.total,     bar: '#5a6eaa' },
          { label: t('evaluaciones.enviados_stat'),    value: stats.sent,      bar: '#3a7aaa' },
          { label: 'Pendientes',                       value: stats.pending,   bar: '#9a7020' },
          { label: 'Completados',                      value: stats.completed, bar: '#3a8a60' },
        ].map(({ label, value, bar }) => (
          <div key={label} className="rounded-xl p-4 relative overflow-hidden"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: bar }} />
            <p className="text-3xl font-bold pl-2 leading-none mb-1" style={{ color: bar }}>{value}</p>
            <p className="text-[11px] font-semibold pl-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
        {[
          { key: 'biblioteca', label: t('evaluaciones.biblioteca'), count: stats.total },
          { key: 'enviados',   label: t('evaluaciones.enviados'),   count: stats.sent },
          { key: 'historial',  label: t('evaluaciones.historial'),  count: savedForms.length },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={activeTab === key
              ? { background: 'var(--card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { background: 'transparent', color: 'var(--text-muted)' }}>
            {label}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
              style={activeTab === key
                ? { background: 'var(--muted-bg)', color: 'var(--text-secondary)' }
                : { background: 'var(--card-border)', color: 'var(--text-muted)' }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── BIBLIOTECA TAB ── */}
      {activeTab === 'biblioteca' && (
        <div className="space-y-5">
          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder={t('ui.search_form')} value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none transition-all" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }} />
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 flex-wrap">
            {UNIFIED_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                style={activeCategory === cat.id
                  ? { background: 'var(--text-primary)', color: 'var(--card)', border: '1px solid transparent' }
                  : { background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                {cat.icon} {({all: t('evaluaciones.catTodas'), conductual: t('evaluaciones.catABA'), familia: t('evaluaciones.catFamilia'), clinico: t('evaluaciones.catClinico'), tea: t('evaluaciones.catTEA'), tdah: t('evaluaciones.catTDAH'), habilidades: t('evaluaciones.catAdaptativa'), cognitivo: t('evaluaciones.catCognitivo'), sensorial: t('evaluaciones.catSensorial')} as Record<string,string>)[cat.id] || cat.label}
              </button>
            ))}
          </div>

          {/* Forms grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredForms.map(form => (
              <FormCard
                key={form.id}
                form={form}
                onStart={(f: any) => setSelectedForm(f)}
                onSend={(f: any) => setSendFormModal(f)}
              />
            ))}
          </div>

          {filteredForms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-5 bg-slate-100 rounded-3xl mb-4">
                <Search size={40} className="text-slate-300" />
              </div>
              <p className="font-bold text-slate-400">No se encontraron formularios</p>
              <p className="text-xs text-slate-300 mt-1">{t('evaluaciones.otroBusqueda')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── ENVIADOS TAB ── */}
      {activeTab === 'enviados' && (
        <div className="space-y-3">
          {sentForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center  rounded-3xl border border-slate-100" style={{ background: "var(--card)" }}>
              <div className="p-5 bg-slate-100 rounded-3xl mb-4"><Send size={40} className="text-slate-300" /></div>
              <p className="font-bold text-slate-400">{t('ui.no_forms_sent')}</p>
              <p className="text-xs text-slate-300 mt-1">{t('evaluaciones.irBiblioteca2')}</p>
            </div>
          ) : sentForms.map(sf => (
            <div key={sf.id} className=" rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ background: "var(--card)" }}>
              <div className="flex items-center gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-all"
                onClick={() => setExpandedResponse(expandedResponse === sf.id ? null : sf.id)}>
                <div className={`w-3 h-3 rounded-full shrink-0 ${sf.status === 'completed' ? 'bg-emerald-500' : sf.status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm truncate" style={{ color: "var(--text-primary)" }}>{sf.form_title}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${sf.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {sf.status === 'completed' ? `✅ ${t('evaluaciones.completado')}` : `⏳ ${t('evaluaciones.pendiente')}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">Para: {sf.profiles?.full_name || sf.profiles?.email}</p>
                  <p className="text-xs text-slate-300 mt-0.5">{new Date(sf.created_at).toLocaleDateString(toBCP47(locale))}</p>
                </div>
                {expandedResponse === sf.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
              </div>
              {expandedResponse === sf.id && sf.status === 'completed' && sf.responses && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                  <h4 className="text-xs font-bold text-slate-400 mb-3">Respuestas</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(sf.responses).map(([k, v]) => (
                      <div key={k} className=" rounded-xl p-3 border border-slate-100" style={{ background: "var(--card)" }}>
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

      {/* ── HISTORIAL TAB ── */}
      {activeTab === 'historial' && (
        <div className="space-y-3">
          {savedForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center  rounded-3xl border border-slate-100" style={{ background: "var(--card)" }}>
              <div className="p-5 bg-slate-100 rounded-3xl mb-4"><ClipboardList size={40} className="text-slate-300" /></div>
              <p className="font-bold text-slate-400">Sin formularios guardados</p>
            </div>
          ) : savedForms.map(sf => (
            <HistorialFormCard
              key={`${sf._source || 'form_responses'}-${sf.id}`}
              sf={sf}
              onReportGenerated={loadData}
            />
          ))}
        </div>
      )}

      {/* Send modal */}
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
