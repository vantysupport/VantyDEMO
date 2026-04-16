'use client'

// ==============================================================================
// COMPONENTE: GENERADOR Y GESTOR DE REPORTES PROFESIONALES
// Ubicación: components/ReportGenerator.tsx
// ==============================================================================

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  FileText, Download, Trash2, Loader2, FileDown, Eye,
  AlertCircle, Clock, CheckCircle2, Sparkles, RefreshCw,
  FileCheck, Calendar, User, Weight, X
} from 'lucide-react'

// ==============================================================================
// INTERFACES
// ==============================================================================

interface Reporte {
  id: string
  tipo_reporte: string
  titulo: string
  descripcion: string
  nombre_archivo: string
  fecha_generacion: string
  generado_por: string
  tamano_bytes: number
}

interface ReportGeneratorProps {
  childId: string
  childName: string
  childAge?: number
  evaluationType: 'aba' | 'anamnesis' | 'entorno_hogar' | 'brief2' | 'ados2' | 'vineland3' | 'wiscv' | 'basc3'
  evaluationData: any
  evaluationId: string
  onClose?: () => void
  /** Si es true, usa diseño compacto para modales pequeños */
  compact?: boolean
}

// ==============================================================================
// COLORES POR TIPO DE EVALUACIÓN
// ==============================================================================

const TIPO_COLORES: Record<string, {
  badge: string
  icon: string
  glow: string
  border: string
  dot: string
}> = {
  aba:           { badge: 'bg-purple-100 text-purple-700 border-purple-200',  icon: 'from-purple-500 to-purple-600',  glow: 'shadow-purple-100',  border: 'border-purple-200',  dot: 'bg-purple-500'  },
  anamnesis:     { badge: 'bg-blue-100 text-blue-700 border-blue-200',        icon: 'from-blue-500 to-blue-600',      glow: 'shadow-blue-100',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  entorno_hogar: { badge: 'bg-green-100 text-green-700 border-green-200',     icon: 'from-green-500 to-green-600',    glow: 'shadow-green-100',   border: 'border-green-200',   dot: 'bg-green-500'   },
  brief2:        { badge: 'bg-indigo-100 text-indigo-700 border-indigo-200',  icon: 'from-indigo-500 to-indigo-600',  glow: 'shadow-indigo-100',  border: 'border-indigo-200',  dot: 'bg-indigo-500'  },
  ados2:         { badge: 'bg-teal-100 text-teal-700 border-teal-200',        icon: 'from-teal-500 to-teal-600',      glow: 'shadow-teal-100',    border: 'border-teal-200',    dot: 'bg-teal-500'    },
  vineland3:     { badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'from-emerald-500 to-emerald-600', glow: 'shadow-emerald-100', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  wiscv:         { badge: 'bg-violet-100 text-violet-700 border-violet-200',  icon: 'from-violet-500 to-violet-600',  glow: 'shadow-violet-100',  border: 'border-violet-200',  dot: 'bg-violet-500'  },
  basc3:         { badge: 'bg-rose-100 text-rose-700 border-rose-200',        icon: 'from-rose-500 to-rose-600',      glow: 'shadow-rose-100',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
}

// ==============================================================================
// COMPONENTE PRINCIPAL
// ==============================================================================

export default function ReportGenerator({
  childId,
  childName,
  childAge,
  evaluationType,
  evaluationData,
  evaluationId,
  onClose,
  compact = false,
}: ReportGeneratorProps) {

  const { t, locale } = useI18n()
  const [isGenerating, setIsGenerating]     = useState(false)
  const [reportes, setReportes]             = useState<Reporte[]>([])
  const [isLoadingReportes, setIsLoadingReportes] = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [justGenerated, setJustGenerated]   = useState<string | null>(null)  // id del último generado

  const colores = TIPO_COLORES[evaluationType] || TIPO_COLORES.aba

  useEffect(() => {
    loadReportes()
  }, [childId, evaluationType])

  // ─── Cargar reportes existentes ──────────────────────────────────────────
  const loadReportes = async () => {
    setIsLoadingReportes(true)
    try {
      const { data, error } = await supabase
        .from('reportes_generados')
        .select('id, tipo_reporte, titulo, descripcion, nombre_archivo, fecha_generacion, generado_por, tamano_bytes')
        .eq('child_id', childId)
        .eq('tipo_reporte', evaluationType)
        .order('fecha_generacion', { ascending: false })

      if (error) throw error
      setReportes(data || [])
    } catch (err: any) {
      console.error('Error cargando reportes:', err)
      setError('No se pudieron cargar los reportes existentes')
    } finally {
      setIsLoadingReportes(false)
    }
  }

  // ─── Generar nuevo reporte ────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // 1. Llamar a la API
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'x-locale': locale || 'es', 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: localStorage.getItem('vanty_locale') || 'es',
          reportType:   evaluationType,
          childName,
          childAge,
          childId,           // ← CRÍTICO: pasar childId explícito para enriquecer datos
          reportData:   { ...evaluationData, child_id: childId },
          evaluationId,
        }),
      })

      const result = await response.json()
      if (!response.ok || result.error) throw new Error(result.error || 'Error al generar el reporte')

      // 2. Guardar en Supabase
      const { data: savedReport, error: saveError } = await supabase
        .from('reportes_generados')
        .insert([{
          child_id:         childId,
          tipo_reporte:     evaluationType,
          evaluacion_id:    evaluationId,
          titulo:           getTituloReporte(evaluationType),
          descripcion:      `Reporte ${evaluationType.toUpperCase()} para ${childName}`,
          nombre_archivo:   result.fileName,
          file_data:        result.fileData,
          mime_type:        result.mimeType,
          tamano_bytes:     Math.round(result.fileData.length * 0.75),
          generado_por:     'Directora',
          fecha_generacion: new Date().toISOString(),
        }])
        .select('id')
        .single()

      if (saveError) throw saveError

      // 3. Marcar como recién generado y descargar
      setJustGenerated(savedReport?.id || null)
      downloadFile(result.fileData, result.fileName)

      // 4. Actualizar lista
      await loadReportes()

    } catch (err: any) {
      console.error('Error generando reporte:', err)
      setError(err.message || 'Error al generar el reporte. Inténtalo de nuevo.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ─── Descargar reporte existente ─────────────────────────────────────────
  const handleDownloadReport = async (reporte: Reporte) => {
    try {
      const { data, error } = await supabase
        .from('reportes_generados')
        .select('file_data')
        .eq('id', reporte.id)
        .single()

      if (error) throw error
      downloadFile(data.file_data, reporte.nombre_archivo)
    } catch (err: any) {
      console.error('Error descargando:', err)
      alert(t('ui.errorDescargar'))
    }
  }

  // ─── Función base para descargar blob ────────────────────────────────────
  const downloadFile = (base64Data: string, fileName: string) => {
    const byteChars   = atob(base64Data)
    const byteNumbers = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const url = URL.createObjectURL(blob)
    const a   = document.createElement('a')
    a.href    = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  // ─── Eliminar reporte ─────────────────────────────────────────────────────
  const handleDeleteReport = async (reporteId: string) => {
    if (!confirm('¿Eliminar este reporte permanentemente? Esta acción no se puede deshacer.')) return
    try {
      const { error } = await supabase
        .from('reportes_generados')
        .delete()
        .eq('id', reporteId)

      if (error) throw error
      if (justGenerated === reporteId) setJustGenerated(null)
      await loadReportes()
    } catch (err: any) {
      console.error('Error eliminando:', err)
      alert(t('ui.errorEliminar'))
    }
  }

  // ─── Formato fecha ────────────────────────────────────────────────────────
  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-PE', {
      year:    'numeric',
      month:   'short',
      day:     'numeric',
      hour:    '2-digit',
      minute:  '2-digit',
    })

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`bg-white ${compact ? 'rounded-2xl' : 'rounded-3xl md:rounded-[2.5rem]'} shadow-sm border border-slate-200 overflow-hidden`}>

      {/* ── ENCABEZADO ─────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white ${compact ? 'p-5' : 'p-6 md:p-8'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Icono con color del tipo */}
            <div className={`bg-gradient-to-br ${colores.icon} rounded-2xl ${compact ? 'w-12 h-12' : 'w-14 h-14'} flex items-center justify-center shadow-xl flex-shrink-0`}>
              <FileText size={compact ? 22 : 26} className="text-white" />
            </div>
            <div>
              <h2 className={`font-black ${compact ? 'text-base' : 'text-xl md:text-2xl'} tracking-tight`}>
                Reportes Profesionales
              </h2>
              <p className={`text-slate-400 ${compact ? 'text-xs' : 'text-sm'} font-medium mt-0.5`}>
                Genera y descarga en formato Word (.docx)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadReportes}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
              title="Actualizar lista"
            >
              <RefreshCw size={16} />
            </button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Tarjeta del paciente */}
        <div className={`mt-5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl ${compact ? 'p-4' : 'p-5'} flex items-center gap-4`}>
          <div className={`bg-gradient-to-br ${colores.icon} rounded-xl ${compact ? 'w-10 h-10' : 'w-12 h-12'} flex items-center justify-center font-black text-white text-lg flex-shrink-0 shadow-lg`}>
            {childName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-black ${compact ? 'text-sm' : 'text-base'} truncate`}>{childName}</p>
            {childAge && (
              <p className="text-slate-300 text-xs font-bold mt-0.5">{childAge} años</p>
            )}
          </div>
          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-wider whitespace-nowrap ${colores.badge}`}>
            {getTituloReporte(evaluationType)}
          </span>
        </div>
      </div>

      {/* ── CUERPO ─────────────────────────────────────────────────────── */}
      <div className={compact ? 'p-5 space-y-5' : 'p-6 md:p-8 space-y-6 md:space-y-8'}>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 font-black text-sm">{t('reportes.errorGenerar')}</p>
              <p className="text-red-600 text-xs mt-1">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── BOTÓN GENERAR ────────────────────────────────────────────── */}
        <div>
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className={`
              w-full relative overflow-hidden
              bg-gradient-to-r from-blue-600 to-blue-700
              hover:from-blue-500 hover:to-blue-600
              text-white font-black rounded-2xl
              transition-all duration-300
              flex items-center justify-center gap-3
              disabled:opacity-60 disabled:cursor-not-allowed
              shadow-xl shadow-blue-200
              hover:shadow-2xl hover:shadow-blue-300
              hover:-translate-y-0.5
              active:translate-y-0
              ${compact ? 'py-4 text-sm' : 'py-5 text-base md:text-lg'}
            `}
          >
            {/* Brillo animado */}
            {!isGenerating && (
              <span className="absolute inset-0 -translate-x-full hover:translate-x-full duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform" />
            )}
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={22} />
                <span>{t('reportes.generandoReporte')}</span>
              </>
            ) : (
              <>
                <FileDown size={22} />
                <span>{t('reportes.generarReporte')}</span>
                <Sparkles size={16} className="opacity-70" />
              </>
            )}
          </button>

          <p className="text-xs text-slate-400 text-center mt-3 font-medium">
            Se generará con formato profesional, portada y secciones completas · Se guardará automáticamente
          </p>
        </div>

        {/* Divisor */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-100" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reportes Guardados</span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>

        {/* ── LISTA DE REPORTES ────────────────────────────────────────── */}
        <div>
          {isLoadingReportes ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm font-bold">{t('common.cargandoReportes')}</p>
            </div>

          ) : reportes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <FileText size={28} className="text-slate-300" />
              </div>
              <p className="text-slate-500 font-black text-sm">Sin reportes generados</p>
              <p className="text-xs text-slate-400 mt-1.5 text-center max-w-xs px-4 font-medium">
                Genera tu primer reporte usando el botón de arriba. Quedará guardado aquí con fecha y hora.
              </p>
            </div>

          ) : (
            <div className={`space-y-3 ${compact ? 'max-h-72' : 'max-h-[420px]'} overflow-y-auto pr-1`}>
              {reportes.map((reporte) => {
                const esNuevo = justGenerated === reporte.id
                return (
                  <div
                    key={reporte.id}
                    className={`
                      group relative rounded-2xl border-2 transition-all duration-300 overflow-hidden
                      ${esNuevo
                        ? 'bg-gradient-to-r from-green-50 to-white border-green-300 shadow-lg shadow-green-100'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-300 hover:shadow-md'
                      }
                    `}
                  >
                    {/* Franja de color izquierda */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colores.icon} rounded-l-xl`} />

                    <div className={`pl-5 pr-4 ${compact ? 'py-4' : 'py-5'} flex items-start justify-between gap-3`}>
                      <div className="flex-1 min-w-0">
                        {/* Badge nuevo */}
                        {esNuevo && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle2 size={14} className="text-green-600" />
                            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">
                              Recién generado
                            </span>
                          </div>
                        )}

                        {/* Título */}
                        <div className="flex items-center gap-2 mb-2">
                          <FileCheck size={16} className="text-blue-500 flex-shrink-0" />
                          <h4 className={`font-black text-slate-800 truncate ${compact ? 'text-sm' : 'text-base'}`}>
                            {reporte.titulo}
                          </h4>
                        </div>

                        {/* Descripción */}
                        <p className="text-xs text-slate-500 font-medium mb-3 line-clamp-1">
                          {reporte.descripcion}
                        </p>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                            <Calendar size={11} />
                            <span>{formatFecha(reporte.fecha_generacion)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                            <Eye size={11} />
                            <span>{(reporte.tamano_bytes / 1024).toFixed(1)} KB</span>
                          </div>
                          {reporte.generado_por && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                              <User size={11} />
                              <span>{reporte.generado_por}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownloadReport(reporte)}
                          className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
                          title="Descargar .docx"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(reporte.id)}
                          className="p-2.5 bg-slate-100 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl transition-all"
                          title="Eliminar reporte"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Contador total */}
        {reportes.length > 0 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className={`w-2 h-2 rounded-full ${colores.dot}`} />
            <p className="text-xs text-slate-400 font-bold">
              {reportes.length} reporte{reportes.length !== 1 ? 's' : ''} guardado{reportes.length !== 1 ? 's' : ''} para este paciente y tipo de evaluación
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ==============================================================================
// HELPER
// ==============================================================================

export function getTituloReporte(tipo: string): string {
  const titulos: Record<string, string> = {
    aba:           'Reporte de Sesión ABA',
    anamnesis:     'Historia Clínica (Anamnesis)',
    entorno_hogar: 'Evaluación del Entorno del Hogar',
    brief2:        'Evaluación BRIEF-2 (Funciones Ejecutivas)',
    ados2:         'Evaluación ADOS-2 (Diagnóstico Autismo)',
    vineland3:     'Evaluación Vineland-3 (Conducta Adaptativa)',
    wiscv:         'Evaluación WISC-V (Cognitiva)',
    basc3:         'Evaluación BASC-3 (Conductual)',
  }
  return titulos[tipo] || tipo.toUpperCase()
}