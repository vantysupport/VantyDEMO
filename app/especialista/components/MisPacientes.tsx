'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback } from 'react'
import {
  Search, ChevronRight, Baby, Loader2, Eye, FileText, Activity,
  AlertCircle, X, Brain, Heart, Home, ClipboardList, BarChart3,
  Calendar, User, Phone, Mail, ChevronDown, ChevronUp,
  BookOpen, CheckCircle2, Download, Sparkles, Stethoscope, Target, MessageSquare,
  TrendingUp, Lightbulb, Shield, Star, Zap, ArrowRight, RefreshCw, Clock,
  Plus, Link2, UserPlus, FolderOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import ProgramasABAView from '@/app/admin/components/ProgramasABAView'
import EvaluacionesUnificadas from '@/app/admin/components/EvaluacionesUnificadas'
import AIReportView from '@/app/admin/components/AIReportView'
import DocumentosView from '@/app/admin/components/DocumentosView'
import { RellenarFicha, GestorPlantillas } from '@/app/admin/components/PlantillasClinicas'
import { useTheme } from '@/components/ThemeContext'

function calcularEdad(fecha: string) {
  if (!fecha) return 'N/D'
  const hoy = new Date(), nac = new Date(fecha)
  const anos = hoy.getFullYear() - nac.getFullYear()
  return `${hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate()) ? anos - 1 : anos} años`
}

function formatDate(d: string) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return d }
}

const AVATAR_COLORS = [
  'from-cyan-500 to-sky-600', 'from-emerald-500 to-cyan-500',
  'from-amber-500 to-red-500', 'from-sky-500 to-pink-500',
  'from-sky-500 to-cyan-500', 'from-emerald-500 to-amber-500',
]

const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  'Sesión ABA':          { bg: 'bg-sky-50',    text: 'text-sky-700',    border: 'border-sky-200',    icon: Target },
  'Anamnesis':           { bg: 'bg-sky-50',  text: 'text-sky-700',  border: 'border-sky-200',  icon: ClipboardList },
  'Visita Domiciliaria': { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: Home },
  'BRIEF-2':             { bg: 'bg-sky-50',  text: 'text-sky-700',  border: 'border-sky-200',  icon: Brain },
  'ADOS-2':              { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    icon: Stethoscope },
  'Vineland-3':          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  'WISC-V':              { bg: 'bg-sky-50',  text: 'text-sky-700',  border: 'border-sky-200',  icon: BarChart3 },
  'BASC-3':              { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    icon: Heart },
  'Formulario padre':    { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  icon: MessageSquare },
  'default':             { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   icon: FileText },
}
function getTypeCfg(type: string) { return TYPE_CONFIG[type] || TYPE_CONFIG['default'] }


function Field({ label, value }: { label: string; value: any; key?: any }) {
  const { t, locale } = useI18n()

  if (value === null || value === undefined || value === '') return null
  const display = Array.isArray(value) ? value.join(', ') : String(value)
  if (!display || display === 'undefined' || display === 'null') return null
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{display}</p>
    </div>
  )
}

function Bloque({ title, icon: Icon, color, children }: any) {
  const { t } = useI18n()

  const hasChildren = Array.isArray(children) ? children.some(Boolean) : !!children
  if (!hasChildren) return null
  return (
    <div className="bg-white dark:bg-[#161b22] rounded-xl border border-slate-200 dark:border-[#21262d] overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-3 ${color || 'bg-slate-50'} border-b border-slate-100`}>
        {Icon && <Icon size={13} className="text-slate-600" />}
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{title}</p>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function AIBlock({ analysis }: { analysis: any }) {
  const { t } = useI18n()

  if (!analysis) return null
  const fields = [
    { k: 'analisis_clinico', l: 'Análisis Clínico' },
    { k: 'analisis_ia', l: 'Análisis IA' },
    { k: 'analisis_vineland_ia', l: 'Análisis Adaptativo' },
    { k: 'analisis_diagnostico_ia', l: 'Análisis Diagnóstico' },
    { k: 'analisis_basc_ia', l: 'Análisis Conductual' },
    { k: 'perfil_cognitivo_ia', l: 'Perfil Cognitivo' },
    { k: 'nivel_alerta', l: 'Nivel de Alerta' },
    { k: 'nivel_severidad', l: 'Nivel de Severidad' },
    { k: 'indicadores_clave', l: 'Indicadores Clave' },
    { k: 'areas_fortaleza', l: 'Áreas de Fortaleza' },
    { k: 'areas_trabajo', l: 'Áreas a Trabajar' },
    { k: 'areas_prioridad', l: 'Áreas Prioritarias' },
    { k: 'recomendaciones', l: 'Recomendaciones' },
    { k: 'recomendaciones_ia', l: 'Recomendaciones Terapéuticas' },
    { k: 'recomendaciones_intervencion', l: 'Plan de Intervención' },
    { k: 'implicaciones_educativas', l: 'Implicaciones Educativas' },
    { k: 'plan_intervencion_conductual', l: 'Plan Conductual' },
    { k: 'fortalezas_conductuales', l: 'Fortalezas Conductuales' },
    { k: 'areas_preocupacion', l: 'Áreas de Preocupación' },
    { k: 'mensaje_padres', l: 'Mensaje a Padres' },
    { k: 'informe_padres', l: 'Informe a Padres' },
  ]
  const visible = fields.filter(({ k }) => analysis[k])
  if (!visible.length) return null
  return (
    <div className="bg-gradient-to-br from-sky-50 dark:from-sky-950/40 to-sky-50 dark:to-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-sky-100">
        <Sparkles size={13} className="text-sky-600" />
        <p className="text-xs font-bold text-sky-700">{t('especialista.analisisDeIA')}</p>
      </div>
      <div className="p-4 space-y-3">
        {visible.map(({ k, l }) => {
          const val = analysis[k]
          const txt = Array.isArray(val) ? `• ${val.join('\n• ')}` : String(val)
          return (
            <div key={k}>
              <p className="text-[10px] font-bold text-sky-500 mb-1">{l}</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{txt}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WordBtn({ report }: { report: any }) {
  const { t } = useI18n()

  const dl = () => {
    const blob = new Blob([Uint8Array.from(atob(report.file_data), c => c.charCodeAt(0))],
      { type: report.mime_type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: report.nombre_archivo || 'reporte.docx' })
    a.click(); URL.revokeObjectURL(a.href)
  }
  return (
    <button onClick={dl} className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
      <Download size={13} /> {t('pacientes.descargarReporte')}
    </button>
  )
}

function ABADetail({ r }: { r: any }) {
  const { t } = useI18n()
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()

  const descargarReporteWord = async () => {
    if (!r.id) { toast.error('No se encontró el ID del registro'); return }
    setDownloading(true)
    try {
      const res = await fetch('/api/reporte-sesion-aba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registroId: r.id }),
      })
      if (!res.ok) throw new Error('Error al generar el reporte')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `Sesion_ABA_${new Date().toISOString().slice(0,10)}.docx`,
      })
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Reporte Word descargado')
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  const d = r.datos || r
  return (
    <div className="space-y-3">
      <Bloque title={t('ui.session')} icon={Calendar} color="bg-sky-50">
        <Field label="Objetivo principal" value={d.objetivo_principal} />
        <Field label={t("pacientes.tipoSesion")} value={d.tipo_sesion} />
        <Field label={t("ui.duracion")} value={d.duracion_minutos ? `${d.duracion_minutos} min` : null} />
      </Bloque>
      <Bloque title={t('ui.abc_record')} icon={Activity} color="bg-sky-50">
        <Field label="Antecedente (A)" value={d.antecedente} />
        <Field label="Conducta (B)" value={d.conducta} />
        <Field label="Consecuencia (C)" value={d.consecuencia} />
        <Field label={t("ui.funcionEstimada")} value={d.funcion_estimada} />
      </Bloque>
      <Bloque title={t('ui.performance')} icon={BarChart3} color="bg-sky-50">
        <Field label={t("ui.atencion")} value={d.nivel_atencion} />
        <Field label="Respuesta a instrucciones" value={d.respuesta_instrucciones} />
        <Field label={t("ui.toleranciaFrustrac")} value={d.tolerancia_frustracion} />
        <Field label={t("ui.interaccionSocial")} value={d.interaccion_social} />
        <Field label={t("ui.nivelLogro")} value={d.nivel_logro_objetivos} />
      </Bloque>
      <Bloque title={t('ui.observations')} icon={ClipboardList} color="bg-sky-50">
        <div className="col-span-2"><Field label={t("ui.clinicas")} value={d.observaciones_clinicas} /></div>
        <Field label={t("ui.tareaParaCasa")} value={d.tarea_casa} />
        <div className="col-span-2"><Field label={t("pacientes.mensajeFamilia")} value={d.mensaje_familia} /></div>
      </Bloque>
      <AIBlock analysis={r.ai_analysis} />
      <button
        onClick={descargarReporteWord}
        disabled={downloading}
        className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
      >
        <Download size={13} />
        {downloading ? 'Generando reporte...' : 'Descargar Reporte Word'}
      </button>
    </div>
  )
}

function AnamnesisDetail({ r }: { r: any }) {
  const { t } = useI18n()
  const [downloading, setDownloading] = useState(false)
  const toast = useToast()

  const descargarReporteWord = async () => {
    if (!r.id) { toast.error('No se encontró el ID del registro'); return }
    setDownloading(true)
    try {
      const res = await fetch('/api/reporte-anamnesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registroId: r.id }),
      })
      if (!res.ok) throw new Error('Error al generar el reporte')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `Historia_Clinica_${new Date().toISOString().slice(0,10)}.docx`,
      })
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Historia Clínica descargada')
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setDownloading(false)
    }
  }

  const d = r.datos || r
  return (
    <div className="space-y-3">
      <Bloque title={t('ui.general_data')} icon={User} color="bg-sky-50">
        <Field label="Informante" value={d.informante} />
        <Field label="Parentesco" value={d.parentesco} />
        <Field label={t("ui.viveCon")} value={d.vive_con} />
        <Field label="Escolaridad" value={d.escolaridad} />
      </Bloque>
      <Bloque title={t('ui.reason_consult')} icon={AlertCircle} color="bg-sky-50">
        <div className="col-span-2"><Field label="Motivo principal" value={d.motivo_principal} /></div>
        <Field label="Derivado por" value={d.derivado_por} />
        <div className="col-span-2"><Field label="Expectativas" value={d.expectativas} /></div>
      </Bloque>
      <Bloque title={t('ui.prenatal_history')} icon={Heart} color="bg-sky-50">
        <Field label={t("ui.tipoEmbarazo")} value={d.tipo_embarazo} />
        <Field label={t("ui.tipoParto")} value={d.tipo_parto} />
        <Field label="Complicaciones" value={d.complicaciones_emb} />
        <Field label="Incubadora" value={d.incubadora} />
      </Bloque>
      <Bloque title={t('ui.language_dev')} icon={MessageSquare} color="bg-sky-50">
        <Field label="Primeras palabras" value={d.primeras_palabras} />
        <Field label="Frases" value={d.frases} />
        <Field label={t("ui.comprension")} value={d.comprension} />
        <Field label={t("ui.intencionComun")} value={d.intencion_comunicativa} />
      </Bloque>
      <Bloque title={t("ui.conductaSocial")} icon={Brain} color="bg-sky-50">
        <Field label="Contacto visual" value={d.contacto_visual} />
        <Field label={t("ui.tipoJuego")} value={d.juego} />
        <Field label="Rabietas" value={d.rabietas} />
        <Field label={t("ui.relacionPares")} value={d.pares} />
      </Bloque>
      <AIBlock analysis={r.ai_analysis} />
      <button
        onClick={descargarReporteWord}
        disabled={downloading}
        className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
      >
        <Download size={13} />
        {downloading ? 'Generando Historia Clínica...' : 'Descargar Historia Clínica (Word)'}
      </button>
    </div>
  )
}

function EntornoDetail({ r }: { r: any }) {
  const { t } = useI18n()
  const d = r.datos || r
  return (
    <div className="space-y-3">
      <Bloque title="Visita" icon={Home} color="bg-amber-50">
        <Field label="Personas presentes" value={d.personas_presentes} />
        <Field label={t("ui.tipoVivienda")} value={d.tipo_vivienda} />
        <div className="col-span-2"><Field label="Comportamiento observado" value={d.comportamiento_observado} /></div>
        <div className="col-span-2"><Field label={t("ui.difConsultorio")} value={d.diferencias_consultorio} /></div>
      </Bloque>
      <Bloque title={t("ui.analisisEntorno")} icon={ClipboardList} color="bg-amber-50">
        <div className="col-span-2"><Field label={t("ui.impresionGeneral")} value={d.impresion_general} /></div>
        <div className="col-span-2"><Field label="Barreras identificadas" value={d.barreras_identificadas} /></div>
      </Bloque>
      <Bloque title={t("ui.recomendacionesHogar")} icon={Home} color="bg-green-50">
        <div className="col-span-2"><Field label="Mensaje a padres" value={d.mensaje_padres_entorno} /></div>
        <div className="col-span-2"><Field label={t("especialista.activCasa")} value={d.actividades_casa || d.actividades_sugeridas} /></div>
        <Field label="Espacio físico" value={d.recomendaciones_espacio} />
        <Field label="Rutinas" value={d.recomendaciones_rutinas} />
      </Bloque>
      <AIBlock analysis={r.ai_analysis} />
    </div>
  )
}

function EvalDetail({ r, tipo }: { r: any; tipo: string }) {
  const d = r.respuestas || r.responses || r.datos || r
  const metricMap: Record<string, { l: string; k: string }[]> = {
    'BRIEF-2': [
      { k: 'inhibicion', l: 'Inhibición' }, { k: 'flexibilidad', l: 'Flexibilidad' },
      { k: 'emocional', l: 'Control Emocional' }, { k: 'memoria', l: 'Memoria de Trabajo' },
      { k: 'planificacion', l: 'Planificación' }, { k: 'total_brief', l: 'Total BRIEF-2' },
      { k: 'nivel_riesgo', l: 'Nivel de Riesgo' },
    ],
    'ADOS-2': [
      { k: 'comunicacion', l: 'Comunicación' }, { k: 'interaccion', l: 'Interacción Social' },
      { k: 'juego', l: 'Juego' }, { k: 'conductas_repetitivas', l: 'Conductas Repetitivas' },
      { k: 'puntuacion_total', l: 'Afecto Social Total' }, { k: 'nivel_severidad', l: 'Severidad' },
    ],
    'Vineland-3': [
      { k: 'puntuacion_comunicacion', l: 'Comunicación' }, { k: 'puntuacion_socializacion', l: 'Socialización' },
      { k: 'puntuacion_vida_diaria', l: 'Vida Diaria' }, { k: 'indice_conducta_adaptativa', l: 'Índice Global' },
    ],
    'WISC-V': [
      { k: 'icv_total', l: 'ICV' }, { k: 'icv_percentil', l: 'Percentil ICV' },
      { k: 'ive_total', l: 'IVE' }, { k: 'ive_percentil', l: 'Percentil IVE' },
      { k: 'irf_total', l: 'IRF' }, { k: 'irf_percentil', l: 'Percentil IRF' },
      { k: 'imt_total', l: 'IMT' }, { k: 'imt_percentil', l: 'Percentil IMT' },
      { k: 'ivp_total', l: 'IVP' }, { k: 'ivp_percentil', l: 'Percentil IVP' },
      { k: 'ci_total', l: 'CI Total' }, { k: 'ci_percentil', l: 'Percentil CI' },
      { k: 'clasificacion_ci', l: 'Clasificación' },
    ],
    'BASC-3': [
      { k: 'indice_sintomas_conductuales', l: 'Índice de Síntomas' },
      { k: 'perfil_riesgo', l: 'Perfil de Riesgo' },
    ],
  }
  const metrics = metricMap[tipo] || []
  const hasMetrics = metrics.some(({ k }) => d[k] !== undefined && d[k] !== null && d[k] !== '')
  return (
    <div className="space-y-3">
      {hasMetrics && (
        <Bloque title={`Puntuaciones ${tipo}`} icon={BarChart3}>
          {metrics.map(({ k, l }) => <Field key={k} label={l} value={d[k] ?? r[k]} />)}
        </Bloque>
      )}
      <AIBlock analysis={r.ai_analysis || (typeof r === 'object' ? r : null)} />
    </div>
  )
}

function GenericDetail({ r }: { r: any }) {
  const { t } = useI18n()
  const d = r.responses || r.datos || r
  const skip = new Set(['id','child_id','created_at','updated_at','ai_analysis','responses','datos','form_type','form_title'])
  const entries = Object.entries(d || {}).filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== '')
  return (
    <div className="space-y-3">
      {entries.length > 0 && (
        <Bloque title={t("pacientes.respuestasFormulario")} icon={FileText}>
          {entries.map(([k, v]) => (
            <Field key={k} label={k.replace(/_/g, ' ')}
              value={Array.isArray(v) ? (v as any[]).join(', ') : String(v)} />
          ))}
        </Bloque>
      )}
      <AIBlock analysis={r.ai_analysis} />
    </div>
  )
}

function RecordCard({ item }: { item: any; key?: any }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const cfg = getTypeCfg(item._type || 'default')
  const Icon = cfg.icon
  const hasFull = !!item._fullData

  const renderDetail = () => {
    if (item._type === 'Sesión ABA' || item._type === 'ABA Session') return <ABADetail r={item._fullData} />
    if (item._type === 'Anamnesis') return <AnamnesisDetail r={item._fullData} />
    if (item._type === 'Visita Domiciliaria') return <EntornoDetail r={item._fullData} />
    if (['BRIEF-2','ADOS-2','Vineland-3','WISC-V','BASC-3'].includes(item._type)) return <EvalDetail r={item._fullData} tipo={item._type} />
    return <GenericDetail r={item._fullData} />
  }

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${open ? 'border-slate-300 dark:border-slate-600 shadow-md' : 'border-slate-100 dark:border-[#21262d] hover:border-slate-200 dark:hover:border-[#30363d]'}`}>
      <button onClick={() => hasFull && setOpen(o => !o)}
        className={`w-full flex items-start gap-4 p-4 text-left transition-colors ${hasFull ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-[#1c2128]' : 'cursor-default'}`}>
        <div className={`w-9 h-9 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
          <Icon size={15} className={cfg.text} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
              {item._type || 'Registro'}
            </span>
            <span className="text-xs text-slate-400">{formatDate(item._date)}</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{item._content || '—'}</p>
        </div>
        {hasFull && (open
          ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0 mt-1" />
          : <ChevronDown size={16} className="text-slate-400 flex-shrink-0 mt-1" />)}
      </button>
      {open && item._fullData && (
        <div className="border-t border-slate-100 dark:border-[#21262d] bg-slate-50/60 dark:bg-[#1c2128]/60 px-4 py-4 space-y-4">
          {renderDetail()}
          {item._wordReport && <WordBtn report={item._wordReport} />}
        </div>
      )}
    </div>
  )
}

// ── AI Summary Tab ─────────────────────────────────────────────────────────────
function ResumenIA({ records, paciente }: { records: any[]; paciente: any }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [error, setError] = useState('')
  const toast = useToast()

  const generarResumen = async () => {
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/patient-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          childName: paciente.name,
          childAge: calcularEdad(paciente.birth_date),
          diagnosis: paciente.diagnosis,
          records: records.map(r => ({
            _type: r._type,
            _date: r._date,
            datos: r._fullData?.datos || null,
            ai_analysis: r._fullData?.ai_analysis || null,
          }))
        })
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error)
      setSummary(data.summary)
    } catch (e: any) {
      setError(e.message || 'Error generando resumen')
      toast.error('Error: ' + (e.message || 'Error generando resumen'))
    } finally {
      setLoading(false)
    }
  }

  const nivelColor: Record<string, string> = {
    excelente: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    bueno: 'text-sky-600 bg-sky-50 border-sky-200',
    moderado: 'text-amber-600 bg-amber-50 border-amber-200',
    requiere_atencion: 'text-rose-600 bg-rose-50 border-rose-200',
  }

  const prioridadColor: Record<string, string> = {
    alta: 'bg-rose-100 text-rose-700 border-rose-200',
    media: 'bg-amber-100 text-amber-700 border-amber-200',
    baja: 'bg-sky-100 text-sky-700 border-sky-200',
  }

  const catColor: Record<string, string> = {
    'ABA/Conductual': 'bg-sky-100 text-sky-700',
    'Cognitiva': 'bg-sky-100 text-sky-700',
    'Social': 'bg-teal-100 text-teal-700',
    'Comunicación': 'bg-sky-100 text-sky-700',
    'Familia': 'bg-orange-100 text-orange-700',
    'Escolar': 'bg-emerald-100 text-emerald-700',
  }

  if (!summary && !loading) {
    return (
      <div className="bg-gradient-to-br from-sky-50 dark:from-sky-950/40 to-sky-50 dark:to-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800 p-8 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Sparkles size={28} className="text-white" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">{t('especialista.resumenClinico')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
          Genera un análisis completo del paciente con perfil clínico, áreas prioritarias, plan de tratamiento personalizado y estrategias para el hogar.
        </p>
        {records.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">{t('pacientes.sinRegistros').split('para')[0]} resumen.</p>
        ) : (
          <button onClick={generarResumen}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-sky-700 text-white rounded-xl font-bold text-sm shadow-md transition-all">
            <Sparkles size={16} /> Generar resumen con IA
          </button>
        )}
        {error && <p className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-sky-50 dark:from-sky-950/40 to-sky-50 dark:to-sky-950/40 rounded-2xl border border-sky-200 dark:border-sky-800 p-12 text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Loader2 size={24} className="text-white animate-spin" />
        </div>
        <h3 className="font-bold text-slate-700 text-base mb-1">Analizando expediente completo...</h3>
        <p className="text-sm text-slate-400">La IA está procesando toda la información del paciente</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{t('especialista.resumenClinico2')}</p>
        </div>
        <button onClick={generarResumen}
          className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 px-3 py-1.5 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors">
          <RefreshCw size={11} /> Regenerar
        </button>
      </div>

      {summary.nivel_progreso_general && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${nivelColor[summary.nivel_progreso_general] || nivelColor.moderado}`}>
          <TrendingUp size={12} />
          Progreso general: {summary.nivel_progreso_general.replace('_', ' ')}
        </div>
      )}

      {summary.resumen_ejecutivo && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
          <p className="text-[10px] font-bold text-white/50 mb-2 flex items-center gap-1.5">
            <FileText size={10} /> Resumen ejecutivo
          </p>
          <p className="text-sm leading-relaxed text-white/90">{summary.resumen_ejecutivo}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {summary.perfil_fortalezas?.length > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-emerald-600 mb-3 flex items-center gap-1.5">
              <Star size={10} /> Fortalezas
            </p>
            <div className="space-y-2">
              {summary.perfil_fortalezas.map((f: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">{f}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {summary.perfil_desafios?.length > 0 && (
          <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-rose-600 mb-3 flex items-center gap-1.5">
              <AlertCircle size={10} /> Desafíos
            </p>
            <div className="space-y-2">
              {summary.perfil_desafios.map((f: string, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertCircle size={13} className="text-rose-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">{f}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {summary.areas_prioridad?.length > 0 && (
        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#21262d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-[#1c2128] border-b border-slate-100 dark:border-[#21262d]">
            <Target size={13} className="text-slate-600" />
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{t('especialista.areasPrioritarias')}</p>
          </div>
          <div className="p-4 space-y-3">
            {summary.areas_prioridad.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${prioridadColor[a.nivel] || prioridadColor.media}`}>
                  {a.nivel}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{a.area}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{a.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.recomendaciones_terapeuticas?.length > 0 && (
        <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-[#21262d] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-sky-50 border-b border-sky-100">
            <Lightbulb size={13} className="text-sky-600" />
            <p className="text-xs font-bold text-sky-700">{t('especialista.planTratamiento')}</p>
          </div>
          <div className="p-4 space-y-3">
            {summary.recomendaciones_terapeuticas.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#1c2128] rounded-xl">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0 mt-0.5 ${catColor[r.categoria] || 'bg-slate-200 text-slate-600'}`}>
                  {r.categoria}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{r.accion}</p>
                  {r.frecuencia && (
                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock size={10} /> {r.frecuencia}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.estrategias_casa?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-amber-700 mb-3 flex items-center gap-1.5">
            <Home size={10} /> Estrategias para los Padres en Casa
          </p>
          <div className="space-y-2">
            {summary.estrategias_casa.map((e: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <ArrowRight size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-900 leading-relaxed">{e}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.objetivos_proximas_sesiones?.length > 0 && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-sky-700 mb-3 flex items-center gap-1.5">
            <Zap size={10} /> Objetivos para Próximas Sesiones
          </p>
          <div className="space-y-2">
            {summary.objetivos_proximas_sesiones.map((o: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-lg bg-sky-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-sky-700">{i + 1}</span>
                </div>
                <p className="text-xs text-sky-900 leading-relaxed">{o}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.mensaje_equipo && (
        <div className="bg-gradient-to-br from-sky-50 dark:from-sky-950/30 to-sky-50 dark:to-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-2xl p-4">
          <p className="text-[10px] font-bold text-sky-600 mb-2 flex items-center gap-1.5">
            <Shield size={10} /> Mensaje al Equipo Terapéutico
          </p>
          <p className="text-sm text-sky-900 leading-relaxed italic">"{summary.mensaje_equipo}"</p>
        </div>
      )}
    </div>
  )
}


// ── Vista de información general del paciente (especialista) ──────────────────
function PatientInfoViewEspecialista({ paciente, onRefresh }: { paciente: any; onRefresh: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: paciente.name || '',
    birth_date: paciente.birth_date || '',
    diagnosis: paciente.diagnosis || '',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('children').update({
        name: form.name.trim(),
        birth_date: form.birth_date || null,
        diagnosis: form.diagnosis.trim() || null,
      }).eq('id', paciente.id)
      if (error) throw error
      toast.success('Paciente actualizado')
      setEditing(false)
      onRefresh()
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Datos del paciente</h3>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="text-xs font-bold text-sky-600 hover:text-sky-700 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 transition-colors">
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {[
            { key: 'name',       label: 'Nombre completo',     type: 'text', req: true },
            { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date', req: false },
            { key: 'diagnosis',  label: 'Diagnóstico',         type: 'text', req: false },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                {f.label}{f.req && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input type={f.type}
                value={(form as any)[f.key]}
                onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none border"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditing(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold border" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-sky-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-sky-700">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {[
            { label: 'Nombre', value: paciente.name },
            { label: 'Edad', value: calcularEdad(paciente.birth_date) },
            { label: 'Fecha de nacimiento', value: formatDate(paciente.birth_date) },
            { label: 'Diagnóstico', value: paciente.diagnosis || '—' },
            { label: 'Tutor / Padre', value: paciente.profiles?.full_name || '—' },
            { label: 'Email tutor', value: paciente.profiles?.email || '—' },
            { label: 'Teléfono tutor', value: paciente.profiles?.phone || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start gap-3 py-2.5 border-b" style={{ borderColor: 'var(--card-border)' }}>
              <span className="text-xs font-bold w-40 flex-shrink-0 pt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── FichasTabEspecialista — dos sub-tabs: gestionar + rellenar ─────────────────
function FichasTabEspecialista({ childId, childName }: { childId: string; childName: string }) {
  const { isDark } = useTheme()
  const toast = useToast()
  const [subTab, setSubTab] = useState<'plantillas' | 'rellenar'>('rellenar')

  const cc = {
    active:   isDark ? 'bg-[#161b22] text-slate-100 shadow border border-[#30363d]' : 'bg-white text-slate-800 shadow border border-slate-200',
    inactive: isDark ? 'text-slate-500 hover:text-slate-300 border border-transparent' : 'text-slate-400 hover:text-slate-600 border border-transparent',
    bar:      isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-200',
  }

  const handleSaved = async (responseId: string) => {
    try {
      const res = await fetch('/api/reporte-ficha-clinica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user!.id).maybeSingle()
      const fileName = `Ficha_${childName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.docx`
      const path = `${childId}/${Date.now()}_${fileName}`
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const { error: upErr } = await supabase.storage.from('patient-documents').upload(path, file, { upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('patient-documents').getPublicUrl(path)
      await supabase.from('patient_documents').insert({
        child_id:          childId,
        uploaded_by:       user!.id,
        uploader_role:     profile?.role || 'especialista',
        uploader_name:     profile?.full_name || 'Clínico',
        file_name:         fileName,
        file_url:          publicUrl,
        file_type:         'word',
        file_size:         blob.size,
        category:          'informe',
        description:       'Ficha clínica generada automáticamente',
        visible_to_parent: false,
      })
      toast.success('Word generado y guardado en Documentos del paciente')
    } catch (e: any) {
      console.error('Error auto-generando Word:', e)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tabs */}
      <div className={`flex-shrink-0 px-5 pt-4 pb-3 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
        <div className={`flex rounded-2xl p-1.5 gap-1.5 border ${cc.bar}`}>
          <button onClick={() => setSubTab('plantillas')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${subTab === 'plantillas' ? cc.active : cc.inactive}`}>
            ⚙️ Gestionar fichas
          </button>
          <button onClick={() => setSubTab('rellenar')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${subTab === 'rellenar' ? cc.active : cc.inactive}`}>
            📋 Fichas del paciente
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {subTab === 'plantillas' && <GestorPlantillas isDark={isDark} />}
        {subTab === 'rellenar' && <RellenarFicha childId={childId} childName={childName} isDark={isDark} onSaved={handleSaved} />}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function MisPacientes({ onPatientSelect }: { onPatientSelect?: (id: string | null, name: string | null) => void }) {
  const toast = useToast()
  const { t } = useI18n()
  const [ninos, setNinos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [registros, setRegistros] = useState<any[]>([])
  const [wordReports, setWordReports] = useState<any[]>([])
  const [loadingRegistros, setLoadingRegistros] = useState(false)
  const [activeTab, setActiveTab] = useState<'resumen'|'historial'|'evaluaciones'|'reportes'|'programas_aba'>('resumen')
  const [filterType, setFilterType] = useState('all')

  // ── Crear paciente ──
  const [showCrear, setShowCrear] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', birth_date: '', diagnosis: '' })

  // ── Vincular cuenta padre ──
  const [showVincular, setShowVincular] = useState(false)
  const [pacienteVincular, setPacienteVincular] = useState<any>(null)
  const [emailBusqueda, setEmailBusqueda] = useState('')
  const [parentEncontrado, setParentEncontrado] = useState<any>(null)
  const [buscandoPadre, setBuscandoPadre] = useState(false)
  const [vinculando, setVinculando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('children')
        .select('*, profiles!children_parent_id_fkey(full_name, email, phone)')
        .eq('is_active', true).order('name')
      setNinos(data || [])
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [])

  const handleCrear = async () => {
    if (!newForm.name.trim()) { toast.error('El nombre es requerido'); return }
    setSaving(true)
    try {
      const { data, error } = await supabase.from('children').insert({
        name: newForm.name.trim(),
        birth_date: newForm.birth_date || null,
        diagnosis: newForm.diagnosis.trim() || null,
        is_active: true,
      }).select().single()
      if (error) throw error
      toast.success('Paciente creado correctamente')
      setNewForm({ name: '', birth_date: '', diagnosis: '' })
      setShowCrear(false)
      await cargar()
      verPaciente(data)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const buscarPadre = async () => {
    if (!emailBusqueda.trim()) return
    setBuscandoPadre(true)
    setParentEncontrado(null)
    try {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, email, role')
        .ilike('email', emailBusqueda.trim())
        .maybeSingle()
      if (data) setParentEncontrado(data)
      else toast.error('No se encontró ningún usuario con ese email')
    } catch { toast.error('No se encontró ningún usuario con ese email') }
    finally { setBuscandoPadre(false) }
  }

  const handleVincular = async () => {
    if (!parentEncontrado || !pacienteVincular) return
    setVinculando(true)
    try {
      const { error } = await supabase.from('children')
        .update({ parent_id: parentEncontrado.id })
        .eq('id', pacienteVincular.id)
      if (error) throw error
      toast.success(`${pacienteVincular.name} vinculado a ${parentEncontrado.full_name || parentEncontrado.email}`)
      setShowVincular(false)
      setEmailBusqueda('')
      setParentEncontrado(null)
      setPacienteVincular(null)
      await cargar()
    } catch (e: any) { toast.error(e.message) }
    finally { setVinculando(false) }
  }

  const verPaciente = async (nino: any) => {
    setSeleccionado(nino)
    onPatientSelect?.(nino.id, nino.name)
    setRegistros([])
    setWordReports([])
    setActiveTab('resumen')
    setFilterType('all')
    setLoadingRegistros(true)
    try {
      const [abaR, formR, anamR, entornoR, brief2R, ados2R, vinR, wiscR, basc3R, wordR, pformR] = await Promise.all([
        supabase.from('registro_aba').select('*').eq('child_id', nino.id).order('fecha_sesion', { ascending: false }).limit(30),
        supabase.from('form_responses').select('*').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('anamnesis_completa').select('*').eq('child_id', nino.id).order('fecha_creacion', { ascending: false }).limit(1),
        supabase.from('registro_entorno_hogar').select('*').eq('child_id', nino.id).order('fecha_visita', { ascending: false }).limit(10),
        supabase.from('evaluacion_brief2').select('*').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('evaluacion_ados2').select('*').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('evaluacion_vineland3').select('*').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('evaluacion_wiscv').select('*').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('evaluacion_basc3').select('*').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('reportes_generados').select('id,titulo,tipo_reporte,nombre_archivo,file_data,mime_type,created_at').eq('child_id', nino.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('parent_forms').select('*').eq('child_id', nino.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(20),
      ])

      setWordReports(wordR.data || [])
      const words = wordR.data || []
      const findWord = (key: string) => words.find((w: any) => w.tipo_reporte === key || w.titulo?.toLowerCase().includes(key.toLowerCase())) || null
      const fromForm = (type: string) => (formR.data || []).find((r: any) => r.form_type === type) || null

      const combined: any[] = []

      ;(anamR.data || []).forEach((r: any) => combined.push({
        id: r.id, _type: 'Anamnesis', _date: r.fecha_creacion?.split('T')[0],
        _content: r.datos?.motivo_principal || 'Historia clínica inicial',
        _fullData: r, _wordReport: findWord('anamnesis'),
      }))

      ;(abaR.data || []).forEach((r: any) => combined.push({
        id: r.id, _type: 'Sesión ABA', _date: r.fecha_sesion,
        _content: r.datos?.objetivo_principal || r.datos?.conducta || 'Sesión ABA',
        _fullData: r, _wordReport: null,
      }))

      ;(entornoR.data || []).forEach((r: any) => combined.push({
        id: r.id, _type: 'Visita Domiciliaria', _date: r.fecha_visita?.split('T')[0],
        _content: r.datos?.impresion_general || 'Visita al hogar',
        _fullData: r, _wordReport: findWord('entorno_hogar'),
      }))

      const profEvals = [
        { r: brief2R.data || fromForm('brief2'), tipo: 'BRIEF-2', key: 'brief2' },
        { r: ados2R.data || fromForm('ados2'), tipo: 'ADOS-2', key: 'ados2' },
        { r: vinR.data || fromForm('vineland3'), tipo: 'Vineland-3', key: 'vineland3' },
        { r: wiscR.data || fromForm('wiscv'), tipo: 'WISC-V', key: 'wiscv' },
        { r: basc3R.data || fromForm('basc3'), tipo: 'BASC-3', key: 'basc3' },
      ]
      profEvals.forEach(({ r, tipo, key }) => {
        if (!r) return
        const d = r.respuestas || r.responses || r.datos || r
        const snippets: Record<string, string> = {
          'BRIEF-2': `Riesgo: ${d.nivel_riesgo || '—'}`,
          'ADOS-2': `Severidad: ${d.nivel_severidad || d.severidad || '—'}`,
          'Vineland-3': `Índice adaptativo: ${d.indice_conducta_adaptativa || '—'}`,
          'WISC-V': `CI Total: ${d.ci_total || '—'}`,
          'BASC-3': `Perfil: ${d.perfil_riesgo || '—'}`,
        }
        combined.push({
          id: r.id || key, _type: tipo, _date: r.created_at?.split('T')[0] || r.fecha_evaluacion,
          _content: snippets[tipo] || `Evaluación ${tipo} completada`,
          _fullData: r, _wordReport: findWord(key),
        })
      })

      const skipTypes = new Set(['brief2','ados2','vineland3','wiscv','basc3'])
      ;(formR.data || []).filter((r: any) => !skipTypes.has(r.form_type)).forEach((r: any) => combined.push({
        id: r.id, _type: r.form_title || r.form_type || 'Formulario',
        _date: r.created_at?.split('T')[0],
        _content: r.ai_analysis?.analisis_clinico?.slice?.(0, 120) || `Formulario ${r.form_title || r.form_type}`,
        _fullData: r, _wordReport: findWord(r.form_type || ''),
      }))

      ;(pformR.data || []).forEach((r: any) => combined.push({
        id: r.id, _type: 'Formulario padre', _date: r.completed_at?.split('T')[0],
        _content: r.form_title || 'Formulario completado por padre',
        _fullData: r, _wordReport: null,
      }))

      combined.sort((a, b) => (b._date || '').localeCompare(a._date || ''))
      setRegistros(combined)
    } catch (e: any) {
      toast.error('Error cargando expediente: ' + e.message)
    } finally { setLoadingRegistros(false) }
  }

  useEffect(() => { cargar() }, [cargar])

  const filtrados = ninos.filter(n =>
    n.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.diagnosis?.toLowerCase().includes(busqueda.toLowerCase())
  )

  if (seleccionado) {
    const TABS_DETAIL = [
      { id: 'info',         label: 'Información general', icon: User },
      { id: 'programas',    label: 'Programas ABA',       icon: Target },
      { id: 'evaluaciones', label: 'Evaluaciones',         icon: ClipboardList },
      { id: 'historial',    label: 'Historial & IA',      icon: Brain },
      { id: 'fichas',       label: 'Fichas',              icon: FileText },
      { id: 'documentos',   label: 'Documentos',          icon: FolderOpen },
    ] as const
    type DetailTab = typeof TABS_DETAIL[number]['id']
    const [detailTab, setDetailTab] = [activeTab as unknown as DetailTab, (v: DetailTab) => setActiveTab(v as any)]

    return (
      <div className="flex flex-col h-full" style={{ minHeight: '100%' }}>
        {/* Header paciente */}
        <div className="flex-shrink-0 border-b pb-0" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <button onClick={() => { setSeleccionado(null); setRegistros([]); onPatientSelect?.(null, null); setActiveTab('resumen' as any) }}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#21262d] transition-all flex-shrink-0">
              <ChevronRight size={18} className="rotate-180 text-slate-600" />
            </button>
            <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${AVATAR_COLORS[seleccionado.name?.charCodeAt(0) % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow`}>
              {seleccionado.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate dark:text-slate-100" style={{ color: 'var(--text-primary)' }}>{seleccionado.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {seleccionado.diagnosis && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300">
                    {seleccionado.diagnosis}
                  </span>
                )}
                <span className="text-xs text-slate-400 dark:text-slate-500">{calcularEdad(seleccionado.birth_date)}</span>
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: 'var(--card-border)' }}>
            {TABS_DETAIL.map(tb => (
              <button key={tb.id} onClick={() => setDetailTab(tb.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 font-bold border-b-2 transition-all min-w-0
                  ${detailTab === tb.id ? 'border-sky-500 text-sky-600' : 'border-transparent'}`}
                style={{ color: detailTab === tb.id ? undefined : 'var(--text-muted)' }}
                title={tb.label}>
                <tb.icon size={14} />
                <span className="text-[9px] truncate w-full text-center px-0.5">{
                  tb.id === 'info'         ? 'Info' :
                  tb.id === 'programas'    ? 'ABA' :
                  tb.id === 'evaluaciones' ? 'Eval.' :
                  'Hist.'
                }</span>
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {detailTab === 'info' && (
            <PatientInfoViewEspecialista paciente={seleccionado} onRefresh={async () => { await cargar(); const upd = ninos.find(n => n.id === seleccionado.id); if (upd) setSeleccionado(upd) }} />
          )}
          {detailTab === 'programas' && (
            <div style={{ padding: '20px 24px' }}>
              <ProgramasABAView childId={seleccionado.id} childName={seleccionado.name} />
            </div>
          )}
          {detailTab === 'evaluaciones' && (
            <div style={{ padding: '20px 24px' }}>
              <EvaluacionesUnificadas initialChildId={seleccionado.id} initialChildName={seleccionado.name} />
            </div>
          )}
          {detailTab === 'historial' && (
            <div style={{ padding: '20px 24px' }}>
              <AIReportView initialChildId={seleccionado.id} />
            </div>
          )}
          {detailTab === 'fichas' && (
            <FichasTabEspecialista
              childId={seleccionado.id}
              childName={seleccionado.name}
            />
          )}
          {detailTab === 'documentos' && (
            <div style={{ padding: '20px 24px' }}>
              <DocumentosView childId={seleccionado.id} childName={seleccionado.name} currentRole="especialista" />
            </div>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('nav.mispacientes')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Expedientes clínicos completos</p>
        </div>
        <button onClick={() => setShowCrear(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex-shrink-0">
          <Plus size={15} /> Nuevo paciente
        </button>
      </div>

      <div className="bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#21262d] flex items-center gap-3 px-4 py-3 shadow-sm">
        <Search size={15} className="text-slate-400" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o diagnóstico..."
          className="flex-1 text-sm text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder-slate-400 dark:placeholder-slate-600" />
        {busqueda && <button onClick={() => setBusqueda('')}><X size={14} className="text-slate-400 hover:text-slate-600" /></button>}
      </div>

      {!loading && (
        <p className="text-xs text-slate-500 font-semibold px-1">
          <span className="font-bold text-slate-800 dark:text-slate-100">{filtrados.length}</span> paciente{filtrados.length !== 1 ? 's' : ''}
          {busqueda && <span className="text-slate-400"> · "{busqueda}"</span>}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-sky-600" /></div>
      ) : (
        <div className="grid gap-2">
          {filtrados.map((n, idx) => (
            <div key={n.id} onClick={() => verPaciente(n)}
              className="bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#21262d] p-4 flex items-center gap-4 hover:border-sky-300 hover:shadow-sm transition-all cursor-pointer group shadow-sm">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow`}>
                {n.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{n.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{calcularEdad(n.birth_date)} · {n.diagnosis || 'Sin diagnóstico'}</p>
                <p className="text-xs text-slate-400 truncate">{n.profiles?.full_name || 'Sin tutor'}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-800 px-2 py-1 rounded-lg">
                  <Sparkles size={10} /> IA
                </div>
                <button onClick={e => { e.stopPropagation(); setPacienteVincular(n); setShowVincular(true) }}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
                  title="Vincular cuenta de padre/tutor">
                  <Link2 size={13} /> Vincular
                </button>
                <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-xl group-hover:bg-sky-100 transition-colors">
                  <BookOpen size={13} /> Expediente
                </div>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-[#161b22] rounded-2xl border border-slate-200 dark:border-[#21262d] shadow-sm">
              <Baby size={22} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm font-semibold">{t('common.sinResultados')}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Crear paciente ── */}
      {showCrear && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#161b22] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center">
                  <UserPlus size={18} className="text-sky-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nuevo paciente</h3>
              </div>
              <button onClick={() => setShowCrear(false)} className="p-2 rounded-xl hover:bg-slate-100">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'name',       label: 'Nombre completo',     type: 'text', placeholder: 'Ej: María García', req: true },
                { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date', placeholder: '',                 req: false },
                { key: 'diagnosis',  label: 'Diagnóstico',         type: 'text', placeholder: 'Ej: TEA Nivel 2', req: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold mb-1.5 text-slate-500">
                    {f.label}{f.req && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input type={f.type} placeholder={f.placeholder}
                    value={(newForm as any)[f.key]}
                    onChange={e => setNewForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none border border-slate-200 dark:border-[#30363d] bg-slate-50 dark:bg-[#0d1117] focus:border-sky-400 focus:bg-white dark:focus:bg-[#1c2128] transition-colors text-slate-800 dark:text-slate-200" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowCrear(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm border border-slate-200 dark:border-[#30363d] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1c2128]">
                Cancelar
              </button>
              <button onClick={handleCrear} disabled={saving || !newForm.name.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-sky-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-sky-700">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Crear paciente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Vincular cuenta padre ── */}
      {showVincular && pacienteVincular && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#161b22] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Link2 size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Vincular cuenta</h3>
                  <p className="text-xs text-slate-500">{pacienteVincular.name}</p>
                </div>
              </div>
              <button onClick={() => { setShowVincular(false); setEmailBusqueda(''); setParentEncontrado(null) }}
                className="p-2 rounded-xl hover:bg-slate-100">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-500">Busca la cuenta del padre/tutor por su email registrado en la plataforma.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email del padre/tutor..."
                value={emailBusqueda}
                onChange={e => { setEmailBusqueda(e.target.value); setParentEncontrado(null) }}
                onKeyDown={e => e.key === 'Enter' && buscarPadre()}
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border border-slate-200 bg-slate-50 focus:border-emerald-400 focus:bg-white dark:focus:bg-[#1c2128] transition-colors text-slate-800 dark:text-slate-200" />
              <button onClick={buscarPadre} disabled={buscandoPadre || !emailBusqueda.trim()}
                className="px-4 py-3 rounded-xl bg-slate-800 text-white font-bold text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-slate-700">
                {buscandoPadre ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Buscar
              </button>
            </div>
            {parentEncontrado && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-200 flex items-center justify-center font-bold text-emerald-700">
                  {parentEncontrado.full_name?.[0] || parentEncontrado.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{parentEncontrado.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-slate-500 truncate">{parentEncontrado.email}</p>
                </div>
                <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowVincular(false); setEmailBusqueda(''); setParentEncontrado(null) }}
                className="flex-1 py-3 rounded-xl font-bold text-sm border border-slate-200 dark:border-[#30363d] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1c2128]">
                Cancelar
              </button>
              <button onClick={handleVincular} disabled={!parentEncontrado || vinculando}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-emerald-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700">
                {vinculando ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                Vincular cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
