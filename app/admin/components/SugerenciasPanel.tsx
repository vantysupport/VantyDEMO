'use client'

import { useI18n } from '@/lib/i18n-context'
// app/admin/components/SugerenciasPanel.tsx
// 🏆 CAPA 4 — Panel de sugerencias proactivas para terapeutas
// Se muestra en el Dashboard principal y en la vista del paciente

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Target,
  Brain, Zap, RefreshCw, ChevronDown, ChevronUp, X, Star,
  Clock, ArrowRight, Lightbulb, Trophy
} from 'lucide-react'

interface Sugerencia {
  id?: string
  tipo: string
  prioridad: 'alta' | 'media' | 'baja'
  titulo: string
  descripcion: string
  accion_concreta: string
  child_id: string
  child_name: string
  dato_clave: string
  semanas_detectado: number
  resuelta?: boolean
}

const TIPO_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  objetivo_estancado:  { icon: Clock,         color: 'text-red-600',    bg: 'bg-red-50 border-red-200',    label: 'Estancamiento' },
  cambio_fase:         { icon: TrendingUp,     color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',  label: 'Listo para avanzar' },
  reforzador:          { icon: Star,           color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',label: 'Reforzadores' },
  conducta_desafiante: { icon: AlertTriangle,  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Conductas' },
  logro_celebrar:      { icon: Trophy,         color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200', label: '¡Logro!' },
  carga_sesiones:      { icon: TrendingDown,   color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200', label: 'Frecuencia' },
}

const PRIORIDAD_CONFIG = {
  alta:  { label: '🔴 Urgente',  badge: 'bg-red-100 text-red-700' },
  media: { label: '🟡 Medio',    badge: 'bg-amber-100 text-amber-700' },
  baja:  { label: '🟢 Info',     badge: 'bg-emerald-100 text-emerald-700' },
}

function SugerenciaCard({ s, onResolver }: { s: Sugerencia; onResolver: (id: string) => void; key?: any }) {
  const { t, locale } = useI18n()
  const [expandido, setExpandido] = useState(false)
  const [resolviendo, setResolviendo] = useState(false)
  const cfg = TIPO_CONFIG[s.tipo] || TIPO_CONFIG.objetivo_estancado
  const prio = PRIORIDAD_CONFIG[s.prioridad]
  const Icon = cfg.icon

  const resolver = async () => {
    if (!s.id) return
    setResolviendo(true)
    try {
      await fetch('/api/agente-sugerencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ sugerenciaId: s.id, nota: 'Marcado como resuelto desde el panel', locale: typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' })
      })
      onResolver(s.id)
    } catch { /* */ }
    setResolviendo(false)
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${cfg.bg}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white border ${cfg.bg}`}>
            <Icon size={16} className={cfg.color} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prio.badge}`}>{prio.label}</span>
              <span className="text-[10px] font-bold text-slate-500">{cfg.label}</span>
              <span className="text-[10px] text-slate-400">· {s.child_name}</span>
            </div>
            <p className="font-bold text-sm text-slate-800 leading-snug">{s.titulo}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{s.descripcion}</p>

            {/* Dato clave */}
            <div className="mt-2 inline-flex items-center gap-1.5 bg-white/70 rounded-lg px-2.5 py-1">
              <Zap size={10} className={cfg.color} />
              <span className="text-xs font-bold text-slate-700">{s.dato_clave}</span>
            </div>
          </div>

          <button onClick={() => setExpandido(!expandido)}
            className="flex-shrink-0 p-1 hover:bg-white/50 rounded-lg transition-colors">
            {expandido ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
        </div>

        {/* Acción expandida */}
        {expandido && (
          <div className="mt-3 pt-3 border-t border-white/50">
            <div className="flex items-start gap-2 bg-white/60 rounded-xl p-3">
              <Lightbulb size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-bold text-slate-600 mb-1">{t('ui.recommended_action')}</p>
                <p className="text-xs text-slate-700 leading-relaxed">{s.accion_concreta}</p>
              </div>
            </div>
            {s.id && (
              <div className="flex gap-2 mt-3">
                <button onClick={resolver} disabled={resolviendo}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  {resolviendo
                    ? <span className="animate-spin">⏳</span>
                    : <><CheckCircle size={12} className="text-emerald-500" /> Marcar como resuelto</>
                  }
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SugerenciasPanel({ childId }: { childId?: string }) {
  const { t, locale } = useI18n()

  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'alta' | 'media' | 'baja'>('todas')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const url = `/api/agente-sugerencias${childId ? `?child_id=${childId}` : ''}`
      const res = await fetch(url)
      const data = await res.json()
      setSugerencias(data.sugerencias || [])
      setInsight(data.insight_global || null)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [childId])

  useEffect(() => { cargar() }, [cargar])

  const resolver = (id: string) => setSugerencias(prev => prev.filter(s => s.id !== id))

  const filtradas = sugerencias.filter(s => filtro === 'todas' || s.prioridad === filtro)
  const urgentes = sugerencias.filter(s => s.prioridad === 'alta').length

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
            <Brain size={15} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Sugerencias Proactivas</h3>
            <p className="text-[11px] text-slate-400">
              {sugerencias.length} sugerencia{sugerencias.length !== 1 ? 's' : ''}
              {urgentes > 0 && <span className="text-red-600 font-bold ml-1">· {urgentes} urgente{urgentes !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>
        <button onClick={cargar}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
          title="Actualizar">
          <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Insight global */}
      {insight && (
        <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 rounded-xl flex gap-2">
          <Lightbulb size={14} className="text-sky-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-sky-800 leading-relaxed">{insight}</p>
        </div>
      )}

      {/* Filtros */}
      {sugerencias.length > 3 && (
        <div className="flex gap-1.5 px-4 pt-3">
          {(['todas', 'alta', 'media', 'baja'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize transition-colors ${
                filtro === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {f === 'todas' ? `Todas (${sugerencias.length})` :
               f === 'alta' ? `🔴 ${sugerencias.filter(s=>s.prioridad==='alta').length}` :
               f === 'media' ? `🟡 ${sugerencias.filter(s=>s.prioridad==='media').length}` :
               `🟢 ${sugerencias.filter(s=>s.prioridad==='baja').length}`}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
        {loading && (
          <div className="py-8 text-center">
            <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Analizando pacientes...</p>
          </div>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="py-8 text-center">
            <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-600">{t('ui.all_good')}</p>
            <p className="text-xs text-slate-400 mt-1">{t('ui.no_suggestions')}</p>
          </div>
        )}

        {filtradas.map((s, i) => (
          <SugerenciaCard key={s.id || i} s={s} onResolver={resolver} />
        ))}
      </div>
    </div>
  )
}
