'use client'

import { toBCP47 } from '@/lib/i18n'
import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Bell, CheckCircle2, ChevronDown, ChevronUp,
  Star, Target, Home, BookOpen, Info,
  FileText, ClipboardList, Brain, Video, MessageCircle, RefreshCw
} from 'lucide-react'

interface Notification {
  id: string; title: string; message: string; type: string
  is_read: boolean; created_at: string
  metadata?: { source?: string; source_title?: string; child_id?: string; ai_analysis?: any }
}

// ── Source type config ──────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  session_report: { label: 'Reporte de sesión',    icon: <FileText size={14}/>,     color: '#0ea5e9', bg: 'var(--c-stat-purple)', border: 'var(--c-border)' },
  evaluacion:     { label: 'Evaluación clínica',   icon: <ClipboardList size={14}/>, color: '#0891b2', bg: 'var(--c-stat-blue)',   border: 'var(--c-border)' },
  parent_form:    { label: 'Formulario',            icon: <CheckCircle2 size={14}/>,  color: '#0284c7', bg: 'var(--c-stat-blue)',   border: 'var(--c-border)' },
  neuroforma:     { label: 'NeuroForma',            icon: <Brain size={14}/>,         color: '#0284c7', bg: 'var(--c-stat-purple)', border: 'var(--c-border)' },
  entorno_hogar:  { label: 'Entorno del hogar',     icon: <Home size={14}/>,          color: '#059669', bg: 'var(--c-stat-green)',  border: 'var(--c-border)' },
  parent_message: { label: 'Mensaje del terapeuta', icon: <MessageCircle size={14}/>, color: '#0ea5e9', bg: 'var(--c-stat-purple)', border: 'var(--c-border)' },
  video_call:     { label: 'Videollamada',          icon: <Video size={14}/>,         color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'var(--c-border)' },
}
const DEFAULT_TYPE = TYPE_CFG.parent_message

// ── Analysis detail card ────────────────────────────────────────────────────
function AnalysisCard({ analysis }: { analysis: any }) {
  if (!analysis) return null
  const { resumen_ejecutivo, areas_fortaleza, areas_trabajo, actividades_en_casa, recomendaciones } = analysis
  if (!resumen_ejecutivo && !areas_fortaleza?.length) return null
  return (
    <div className="flex flex-col gap-3 mt-4">
      {resumen_ejecutivo && (
        <div className="rounded-2xl p-4" style={{ background: "var(--c-stat-blue)", border: "1px solid var(--c-border)" }}>
          <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5 text-sky-500">
            <Info size={11}/> Resumen clínico
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{resumen_ejecutivo}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {areas_fortaleza?.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: "var(--c-stat-green)", border: "1px solid var(--c-border)" }}>
            <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5 text-emerald-500">
              <Star size={11}/> Fortalezas
            </p>
            <div className="flex flex-col gap-1.5">
              {areas_fortaleza.slice(0, 4).map((f: string, i: number) => (
                <div key={i} className="rounded-xl px-3 py-2 text-sm flex items-start gap-2" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}>
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>{f}
                </div>
              ))}
            </div>
          </div>
        )}
        {areas_trabajo?.length > 0 && (
          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-4">
            <p className="text-[10px] font-bold text-orange-600 mb-2 flex items-center gap-1.5">
              <Target size={11}/> En desarrollo
            </p>
            <div className="flex flex-col gap-1.5">
              {areas_trabajo.slice(0, 4).map((a: string, i: number) => (
                <div key={i} className="rounded-xl px-3 py-2 text-sm flex items-start gap-2" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}>
                  <span className="text-orange-500 font-bold shrink-0 mt-0.5">→</span>{a}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {actividades_en_casa?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--c-stat-blue)", border: "1px solid var(--c-border)" }}>
          <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5 text-sky-500">
            <Home size={11}/> Actividades para casa
          </p>
          <div className="flex flex-col gap-1.5">
            {actividades_en_casa.map((a: string, i: number) => (
              <div key={i} className="rounded-xl px-3 py-2 text-sm flex items-start gap-2.5" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}>
                <span className="w-5 h-5 bg-sky-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{a}
              </div>
            ))}
          </div>
        </div>
      )}
      {recomendaciones?.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "var(--c-stat-purple)", border: "1px solid var(--c-border)" }}>
          <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5 text-sky-500">
            <BookOpen size={11}/> Recomendaciones
          </p>
          <div className="flex flex-col gap-1.5">
            {recomendaciones.slice(0, 3).map((r: string, i: number) => (
              <div key={i} className="rounded-xl px-3 py-2 text-sm flex items-start gap-2" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-secondary)" }}>
                <span className="shrink-0 mt-0.5">💡</span>{r}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notification card ────────────────────────────────────────────────────────
function NotifCard({ noti, expanded, onToggle, locale }: { noti: Notification; expanded: boolean; onToggle: () => void; locale: string }) {
  const meta  = noti.metadata || {}
  const key   = meta.source || noti.type || 'parent_message'
  const cfg   = TYPE_CFG[key] || DEFAULT_TYPE
  const date  = new Date(noti.created_at).toLocaleDateString(toBCP47(locale as any), { dateStyle: 'medium' })
  const isNew = !noti.is_read

  return (
    <div className="rounded-2xl border overflow-hidden transition-shadow hover:shadow-sm" style={{ background: "var(--c-card)", borderColor: isNew ? "rgba(139,92,246,0.4)" : "var(--c-border)", animation: "nfadeUp .3s ease both" }}>

      {/* Card header — clickable */}
      <button onClick={onToggle} className="w-full text-left px-4 py-4 flex items-start gap-3 transition-colors" style={{ background: "var(--c-card)" }}>

        {/* Type icon */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
          {cfg.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-bold leading-tight" style={{ color: "var(--c-text-primary)" }}>
              {meta.source_title || noti.title || 'Notificación'}
            </p>
            {isNew && (
              <span className="text-[9px] font-bold bg-sky-600 text-white px-2 py-0.5 rounded-full">
                Nuevo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
            <span className="text-[10px]" style={{ color: "var(--c-text-muted)" }}>{date}</span>
          </div>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--c-text-muted)" }}>{noti.message}</p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-center gap-2 flex-shrink-0">
          {noti.is_read
            ? <CheckCircle2 size={14} className="text-emerald-400"/>
            : <div className="w-2.5 h-2.5 rounded-full bg-sky-500"/>
          }
          <div className="p-1 rounded-lg" style={{ background: "var(--c-surface)", color: "var(--c-text-muted)" }}>
            {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 py-4" style={{ borderTop: "1px solid var(--c-border)", background: "var(--c-surface)" }}>
          <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
            <p className="text-[10px] font-bold mb-2 flex items-center gap-1.5"
              style={{ color: cfg.color }}>
              {cfg.icon} {cfg.label}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--c-text-secondary)" }}>{noti.message}</p>
          </div>
          {meta.ai_analysis && <AnalysisCard analysis={meta.ai_analysis}/>}
        </div>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function MensajesView({ profile }: { profile: any }) {
  const { locale } = useI18n()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)
  const [expanded, setExpanded]           = useState<string | null>(null)

  const load = async () => {
    if (!profile?.id) return
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    if (data) {
      setNotifications(data)
      const unread = data.filter(n => !n.is_read).map(n => n.id)
      if (unread.length) await supabase.from('notifications').update({ is_read: true }).in('id', unread)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [profile?.id])

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="flex flex-col gap-5 pb-10 w-full">
      <style>{`
        @keyframes nspin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes nfadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--c-border)" }}>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5 tracking-tight" style={{ color: "var(--c-text-primary)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--c-stat-purple)", border: "1px solid var(--c-border)" }}>
              <Bell size={18} className="text-sky-600 dark:text-sky-400"/>
            </div>
            Notificaciones
          </h1>
          <p className="text-xs mt-1 ml-11" style={{ color: "var(--c-text-muted)" }}>
            Reportes, análisis y comunicados del centro · {notifications.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <span className="bg-sky-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              {unreadCount} nuevo{unreadCount !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={load} className="p-2 rounded-xl transition-colors" style={{ background: "var(--c-surface)", color: "var(--c-text-muted)" }}>
            <RefreshCw size={16}/>
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #e2e8f0', borderTop: '2.5px solid #0284c7', animation: 'nspin 1s linear infinite' }}/>
          <p className="text-sm" style={{ color: "var(--c-text-muted)" }}>Cargando notificaciones...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl p-12 text-center flex flex-col items-center gap-3" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--c-stat-purple)", border: "1px solid var(--c-border)" }}>
            <Bell size={24} className="text-sky-400"/>
          </div>
          <p className="font-bold text-slate-600 dark:text-slate-300">Sin notificaciones</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
            Aquí aparecerán los reportes de sesión, análisis y comunicados del equipo del centro.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {notifications.map(noti => (
            <NotifCard
              key={noti.id}
              noti={noti}
              expanded={expanded === noti.id}
              onToggle={() => setExpanded(expanded === noti.id ? null : noti.id)}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  )
}
