'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useRef, useCallback } from 'react'
import ProgresoGraficas from '@/components/graficos/ProgresoGraficas'
import {
  Activity, Brain, CheckCircle2, ChevronDown, ChevronRight, Clock, Download, Eye, FileCheck, FileDown, FileText, History, Home, Loader2, MessageCircle, RefreshCw, Send, ShieldAlert, Sparkles, Target, User, Users, X, Zap, Mic, MicOff, Volume2, VolumeX, StopCircle, BarChart3
} from 'lucide-react'

// ── Tipos Web Speech API ──────────────────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

// ── Hook Text-to-Speech con ElevenLabs (Ivanna) ──────────────────────────────
function useTextToSpeech() {
  const { t, locale } = useI18n()
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)  // Desactivado por defecto para evitar audio inesperado
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text.trim()) return

    abortRef.current?.abort()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }

    abortRef.current = new AbortController()
    setSpeaking(true)

    try {
      const res = await fetch('/api/elevenlabs-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ text, locale: localStorage.getItem('vanty_locale') || 'es' }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url) }
      audio.play()
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('ElevenLabs TTS falló, usando fallback del navegador')
        if ('speechSynthesis' in window) {
          const clean = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n{2,}/g, '. ').trim().slice(0, 4000)
          const utter = new SpeechSynthesisUtterance(clean)
          utter.lang = toBCP47(locale); utter.rate = 1.05
          utter.onend = () => setSpeaking(false)
          utter.onerror = () => setSpeaking(false)
          window.speechSynthesis.speak(utter)
        } else { setSpeaking(false) }
      } else { setSpeaking(false) }
    }
  }, [voiceEnabled])

  const stopSpeaking = useCallback(() => {
    abortRef.current?.abort()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const toggleVoice = useCallback(() => {
    if (speaking) {
      abortRef.current?.abort()
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = '' }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
    setVoiceEnabled(v => !v)
  }, [speaking])

  return { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice }
}

// ── Hook Speech-to-Text ───────────────────────────────────────────────────────
function useSpeechToText(onResult: (text: string) => void) {
  const { t, locale } = useI18n()
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) {
      setSupported(true)
      const rec = new SR()
      rec.lang = toBCP47(locale)
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = (e: any) => onResult(e.results[0][0].transcript)
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      recognitionRef.current = rec
    }
  }, [onResult])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || listening) return
    setListening(true)
    recognitionRef.current.start()
  }, [listening])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  return { listening, supported, startListening, stopListening }
}
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import ReportGenerator from '@/components/ReportGenerator'

function AIReportView({ onChildSelect, initialChildId }: { onChildSelect?: (child: {id: string, name: string} | null) => void; initialChildId?: string }) {
  const { t, locale } = useI18n()
  const [listaNinos, setListaNinos] = useState<any[]>([])
  const [selectedChild, setSelectedChild] = useState(initialChildId || '')
  const [historyData, setHistoryData] = useState<any>({ anamnesis: null, aba: [], entorno: [] })
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [reportesHistorial, setReportesHistorial] = useState<any[]>([])
  const [loadingReportes, setLoadingReportes] = useState(false)
  const [showReportPanel, setShowReportPanel] = useState(true)
  const [showAnamnesisReport, setShowAnamnesisReport] = useState(false)
  const [mobileTab, setMobileTab] = useState<'chat' | 'history' | 'reports' | 'graficas'>('chat')
  
  const [messages, setMessages] = useState<any[]>([
      { role: 'ai', text: 'Hola 👋. Selecciona un paciente para iniciar el análisis clínico.' }
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // ── Voz ──
  const { speak, stopSpeaking, speaking, voiceEnabled, toggleVoice } = useTextToSpeech()

  const handleVoiceResult = useCallback((transcript: string) => {
    setInput(transcript)
    setTimeout(() => sendMessageWithText(transcript), 600)
  }, []) // eslint-disable-line

  const { listening, supported: micSupported, startListening, stopListening } = useSpeechToText(handleVoiceResult)

  useEffect(() => {
    supabase.from('children').select('id, name').then(({ data }: { data: any[] | null }) => {
      if (data) {
        setListaNinos(data)
        if (initialChildId) {
          handleSelectChild(initialChildId)
        }
      }
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, typing])

  const handleSelectChild = async (childId: string) => {
    setSelectedChild(childId)
    const selectedNino = listaNinos.find(n => n.id === childId)
    if (onChildSelect && selectedNino) {
      onChildSelect({ id: childId, name: selectedNino.name })
    }
    setHistoryData({ anamnesis: null, aba: [], entorno: [] }) 
    
    setMessages([{ role: 'ai', text: 'Cargando historial del paciente...' }])
    
    console.log('🔍 Buscando datos para child_id:', childId)
    
    // Buscar anamnesis en anamnesis_completa (llenada por admin)
    const { data: anamnesisAdmin } = await supabase
      .from('anamnesis_completa')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si no hay, buscar en parent_forms (llenada por el padre)
    let anamnesisFromParent: any = null
    if (!anamnesisAdmin) {
      const { data: pf } = await supabase
        .from('parent_forms')
        .select('*')
        .eq('child_id', childId)
        .eq('status', 'completed')
        .in('form_type', ['anamnesis', 'historia_familiar', 'Historia Familiar y del Desarrollo'])
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (pf) {
        // Adaptar estructura para que sea compatible con el resto del código
        anamnesisFromParent = { datos: pf.responses, form_title: pf.form_title, created_at: pf.completed_at }
      }
    }

    const anamnesis = anamnesisAdmin || anamnesisFromParent
    console.log('📋 Anamnesis encontrada:', anamnesis ? (anamnesisAdmin ? 'admin' : 'padre') : 'No')
    
    const { data: aba, error: abaError } = await supabase
      .from('registro_aba')
      .select('*')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })

    if (abaError) console.error('❌ Error cargando sesiones ABA (registro_aba):', abaError)
    console.log('📊 Sesiones ABA legacy (registro_aba):', aba?.length || 0)

    // Sesiones de DATOS ABA — las que se registran al evaluar un programa específico.
    // Esta es la fuente actual del gráfico de "Progreso ABA — Líneas" del padre.
    // Antes este conteo solo miraba registro_aba (legacy) y siempre daba 0 aunque
    // hubiera datos en los programas, lo que generaba la inconsistencia mostrada.
    const { data: progIdsRaw } = await supabase
      .from('programas_aba')
      .select('id, titulo')
      .eq('child_id', childId)
    const progIds = (progIdsRaw || []).map((p: any) => p.id)
    const progTitulos: Record<string, string> = {}
    ;(progIdsRaw || []).forEach((p: any) => { progTitulos[p.id] = p.titulo })

    let sesionesDataAba: any[] = []
    if (progIds.length > 0) {
      const { data: sda } = await supabase
        .from('sesiones_datos_aba')
        .select('id, programa_id, fecha, fase, set, porcentaje_exito, oportunidades_totales, respuestas_correctas, notas')
        .in('programa_id', progIds)
        .order('fecha', { ascending: false })
      sesionesDataAba = (sda || []).map((s: any) => ({ ...s, _programaTitulo: progTitulos[s.programa_id] || 'Programa ABA' }))
    }
    console.log('📊 Sesiones de programas (sesiones_datos_aba):', sesionesDataAba.length)

    // Total visible al usuario = legacy + actuales
    const totalSesionesAba = (aba?.length || 0) + sesionesDataAba.length
    
    const { data: entorno, error: entornoError } = await supabase
      .from('registro_entorno_hogar')
      .select('*')
      .eq('child_id', childId)
      .order('fecha_visita', { ascending: false })
    
    if (entornoError) console.error('❌ Error cargando visitas hogar:', entornoError)
    console.log('🏠 Visitas hogar encontradas:', entorno?.length || 0)

    const { data: brief2 } = await supabase
    .from('evaluacion_brief2')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: ados2 } = await supabase
    .from('evaluacion_ados2')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: vineland3 } = await supabase
    .from('evaluacion_vineland3')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: wiscv } = await supabase
    .from('evaluacion_wiscv')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const { data: basc3 } = await supabase
    .from('evaluacion_basc3')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load all completed NeuroForms and form_responses
  const { data: formResponses } = await supabase
    .from('form_responses')
    .select('id, form_type, form_title, ai_analysis, responses, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(30)

  // Helper: extract professional eval from form_responses if dedicated table is empty
  const fromFormResponses = (type: string) =>
    (formResponses || []).find((r: any) => r.form_type === type) || null;

  // Formularios completados por los padres
  const { data: parentFormsCompleted } = await supabase
    .from('parent_forms')
    .select('id, form_type, form_title, responses, completed_at')
    .eq('child_id', childId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20)
     
  const resolvedBrief2   = brief2   || fromFormResponses('brief2');
  const resolvedAdos2    = ados2    || fromFormResponses('ados2');
  const resolvedVineland = vineland3 || fromFormResponses('vineland3');
  const resolvedWiscv    = wiscv    || fromFormResponses('wiscv');
  const resolvedBasc3    = basc3    || fromFormResponses('basc3');

  // Filter form_responses to exclude professional evals (already handled above)
  const filteredFormResponses = (formResponses || []).filter(
    (r: any) => !['brief2','ados2','vineland3','wiscv','basc3'].includes(r.form_type)
  );

  setHistoryData({
    anamnesis: anamnesis ? anamnesis.datos : null,
    aba: aba || [],
    sesionesDataAba: sesionesDataAba,             // registros nuevos por programa
    totalSesionesAba: totalSesionesAba,           // suma para badges
    entorno: entorno || [],
    brief2: resolvedBrief2,
    ados2: resolvedAdos2,
    vineland3: resolvedVineland,
    wiscv: resolvedWiscv,
    basc3: resolvedBasc3,
    parentForms: parentFormsCompleted || [],
  })
    
const nombre = listaNinos.find(n => n.id === childId)?.name || t('nav.pacientes').toLowerCase();
  const totalEvaluaciones = [resolvedBrief2, resolvedAdos2, resolvedVineland, resolvedWiscv, resolvedBasc3].filter(Boolean).length;
  const totalFormularios = (filteredFormResponses.length || 0) + (parentFormsCompleted?.length || 0)
  const parentFormsText = (parentFormsCompleted || []).length > 0
    ? `\n📨 **Formularios de Padres (${parentFormsCompleted!.length}):**\n${parentFormsCompleted!.slice(0,5).map((f: any) => `  • ${f.form_title || f.form_type} (${f.completed_at ? new Date(f.completed_at).toLocaleDateString(toBCP47(locale)) : 'Sin fecha'})`).join('\n')}`
    : '';
  
  // Añadir alertas si faltan datos críticos
  if (!anamnesis) {
    console.warn('⚠️ No se encontró anamnesis para este paciente')
  }
  if (!entorno || entorno.length === 0) {
    console.warn('⚠️ No se encontraron visitas domiciliarias para este paciente')
  }
      
     setMessages([{
    role: 'ai',
    text: `✅ Historial completo de **${nombre}** cargado.\n\n📊 **Evaluaciones Profesionales:** ${totalEvaluaciones}/5\n• ${resolvedBrief2 ? "✅" : "❌"} BRIEF-2\n• ${resolvedAdos2 ? "✅" : "❌"} ADOS-2\n• ${resolvedVineland ? "✅" : "❌"} Vineland-3\n• ${resolvedWiscv ? "✅" : "❌"} WISC-V\n• ${resolvedBasc3 ? "✅" : "❌"} BASC-3\n\n📋 **Sesiones ABA:** ${totalSesionesAba}${sesionesDataAba.length > 0 ? ` _(${sesionesDataAba.length} registros en programas)_` : ''}${(aba?.length || 0) > 0 && sesionesDataAba.length > 0 ? ` + ${aba?.length || 0} en registro legacy` : ''}\n🏠 **Visitas Hogar:** ${entorno?.length || 0}\n📝 **NeuroFormas / Formularios:** ${totalFormularios}${totalFormularios > 0 ? `\n${[...(filteredFormResponses), ...(parentFormsCompleted||[])].slice(0,8).map((f: any) => `  • ${f.form_title || f.form_type} (${new Date(f.completed_at || f.created_at).toLocaleDateString(toBCP47(locale))})`).join('\n')}` : ''}${!anamnesis ? '\n\n⚠️ Falta Anamnesis Inicial' : ''}${(!entorno || entorno.length === 0) ? '\n⚠️ Falta Visita Domiciliaria' : ''}\n\n¿Qué deseas analizar?`
  }])

    // Cargar todos los reportes Word del paciente
    setLoadingReportes(true)
    const { data: allReportes } = await supabase
      .from('reportes_generados')
      .select('id, tipo_reporte, titulo, nombre_archivo, fecha_generacion, tamano_bytes, generado_por')
      .eq('child_id', childId)
      .order('fecha_generacion', { ascending: false })
    setReportesHistorial(allReportes || [])
    setLoadingReportes(false)
}

  const sendMessageWithText = async (text: string) => {
    if (!text.trim()) return
    if (!selectedChild) { alert(t('ui.seleccionaPrimero')); return }
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    stopSpeaking()
    setTyping(true)
    try {
      const response = await fetch('/api/admin-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ question: text, childId: selectedChild , locale: localStorage.getItem('vanty_locale') || 'es' })
      })
      const data = await response.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.text }])
      speak(data.text)
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '❌ Error de conexión.' }])
    } finally {
      setTyping(false)
    }
  }

  const sendMessage = () => sendMessageWithText(input)

  const handleMicClick = () => {
    if (listening) { stopListening() }
    else { stopSpeaking(); startListening() }
  }

  const toggleCard = (id: string) => setExpandedCardId(expandedCardId === id ? null : id)

  return (
    <div className="flex flex-col gap-3 animate-fade-in-up">
      {/* Solo mostrar el selector si NO viene pre-seleccionado desde PatientsView */}
      {!initialChildId && (
        <div className="rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 flex-shrink-0" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
          <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg md:text-xl flex items-center gap-2 md:gap-3 shrink-0">
            <div className="p-2 bg-sky-50 rounded-xl">
              <Brain size={24} className="text-sky-600"/>
            </div>
            Analizador Inteligente
          </h3>
          <select
            className="p-3 md:p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl md:rounded-2xl outline-none font-bold text-slate-700 dark:text-slate-200 text-sm w-full md:w-[400px] focus:bg-white dark:focus:bg-slate-600 focus:ring-4 focus:ring-sky-50 focus:border-sky-500 transition-all"
            onChange={(e) => handleSelectChild(e.target.value)}
            value={selectedChild}
          >
            <option value="">🔍 Seleccionar Paciente...</option>
            {listaNinos.map(n => <option key={n.id} value={n.id}>👤 {n.name}</option>)}
          </select>
        </div>
      )}

      {selectedChild ? (
        <div className="flex flex-col gap-3">

          {/* ══ SECCIÓN 1: ASISTENTE IA (siempre visible, arriba) ══ */}
          <AccordionSection
            id="chat"
            title={t('ui.ai_assistant')}
            icon={<Sparkles size={17}/>}
            accent="#0284c7"
            badge={<span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>{speaking ? 'Hablando' : 'Activa'}</span>}
            defaultOpen={true}
          >
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
              <button onClick={toggleVoice} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: voiceEnabled ? 'rgba(134,239,172,0.15)' : 'var(--muted-bg)', color: voiceEnabled ? '#86efac' : 'var(--text-muted)', border: '1px solid var(--card-border)' }}>
                {voiceEnabled ? <Volume2 size={13}/> : <VolumeX size={13}/>}
                {voiceEnabled ? 'Voz ON' : 'Voz OFF'}
              </button>
            </div>

            {listening && (
              <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center shrink-0 animate-pulse">
                  <Mic size={11} className="text-white"/>
                </div>
                <p className="text-xs font-bold text-red-400 flex-1">Escuchando... habla ahora</p>
                <button onClick={stopListening} className="p-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.2)' }}>
                  <StopCircle size={13} className="text-red-400"/>
                </button>
              </div>
            )}

            <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: '360px', background: 'var(--background)' }} ref={chatContainerRef}>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                  <div className="max-w-[88%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm"
                    style={m.role === 'user'
                      ? { background: 'linear-gradient(135deg,#0284c7,#0369a1)', color: '#fff', borderRadius: '1.2rem 1.2rem 0.2rem 1.2rem' }
                      : { background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', borderRadius: '0.2rem 1.2rem 1.2rem 1.2rem' }
                    }>
                    {m.role === 'ai' ? (
                      <p className="font-medium whitespace-pre-wrap" dangerouslySetInnerHTML={{
                        // Escapamos primero (anti-XSS) y SOLO después aplicamos negritas/saltos seguros.
                        __html: m.text
                          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                          .replace(/\*\*(.*?)\*\*/g, '<b class="font-bold">$1</b>').replace(/\n/g, '<br/>')
                      }}/>
                    ) : m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="px-4 py-2.5 rounded-2xl flex items-center gap-2" style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                    <Loader2 className="animate-spin text-sky-500" size={14}/>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>{t('common.analizando')}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 flex gap-2 border-t" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
              <input
                className="flex-1 border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                style={{ background: listening ? 'rgba(239,68,68,0.05)' : 'var(--input-bg)', borderColor: listening ? '#fca5a5' : 'var(--input-border)', color: 'var(--text-primary)' }}
                placeholder={listening ? t('aria.escuchando') : t('aria.preguntaSobre')}
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !listening && sendMessage()}
                disabled={listening}
              />
              {micSupported && (
                <button onClick={handleMicClick} disabled={typing}
                  className="p-3 rounded-xl transition-all disabled:opacity-40"
                  style={{ background: listening ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--muted-bg)', boxShadow: listening ? '0 4px 14px rgba(239,68,68,.3)' : 'none' }}>
                  {listening ? <MicOff size={16} className="text-white"/> : <Mic size={16} style={{ color: 'var(--text-muted)' }}/>}
                </button>
              )}
              {speaking ? (
                <button onClick={stopSpeaking} className="p-3 rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1)' }}>
                  <StopCircle size={16}/>
                </button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim() || listening}
                  className="p-3 rounded-xl text-white transition-all disabled:opacity-40 hover:brightness-110"
                  style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1)', boxShadow: '0 4px 14px rgba(2,132,199,.3)' }}>
                  <Send size={16}/>
                </button>
              )}
            </div>
          </AccordionSection>

          {/* ══ SECCIÓN 2: REGISTRO CLÍNICO (cerrado por defecto) ══ */}
          <AccordionSection
            id="historial"
            title={t('ui.clinical_record')}
            icon={<History size={17}/>}
            accent="#f59e0b"
            badge={<span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>{(historyData.totalSesionesAba ?? historyData.aba.length) + historyData.entorno.length} registros</span>}
            defaultOpen={false}
          >
            <div className="p-4 space-y-3" style={{ background: 'var(--background)' }}>
              {historyData.entorno.map((visita: any) => {
                const isExpanded = expandedCardId === `entorno-${visita.id}`
                const d = visita.datos || {}
                return (
                  <div key={`entorno-${visita.id}`} className="rounded-2xl border-2 transition-all duration-200"
                    style={{ background: 'var(--card)', borderColor: isExpanded ? '#22c55e' : 'var(--card-border)' }}>
                    <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => toggleCard(`entorno-${visita.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center bg-green-600 text-white rounded-xl p-2.5 min-w-[56px] shadow">
                          <Home size={16}/>
                          <span className="text-[9px] font-bold uppercase opacity-80 mt-0.5">{t('ui.home_env')}</span>
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Visita Domiciliaria</p>
                          <span className="text-xs text-green-500 font-bold">{visita.fecha_visita}</span>
                        </div>
                      </div>
                      <ChevronDown size={18} className={`transition-transform ${isExpanded ? 'rotate-180 text-green-400' : ''}`} style={{ color: isExpanded ? undefined : 'var(--text-muted)' }}/>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t pt-3 animate-fade-in space-y-3" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
                        <DetailBox title={t('ui.people_present')} content={d.personas_presentes} icon={<Users size={13}/>} color="bg-sky-50 border-sky-200 text-sky-700" full/>
                        <DetailBox title={t('ui.behavior')} content={d.comportamiento_observado} icon={<Eye size={13}/>} color="bg-sky-50 border-sky-200 text-sky-700" full/>
                        <DetailBox title={t('ui.ai_impression')} content={d.impresion_general} icon={<Brain size={13}/>} color="bg-sky-50 border-sky-200 text-sky-700" full/>
                        <div className="grid grid-cols-2 gap-3">
                          <DetailBox title={t('ui.barriers')} content={d.barreras_identificadas} icon={<ShieldAlert size={13}/>} color="bg-red-50 border-red-200 text-red-700"/>
                          <DetailBox title={t('ui.facilitators')} content={d.facilitadores} icon={<CheckCircle2 size={13}/>} color="bg-emerald-50 border-emerald-200 text-emerald-700"/>
                        </div>
                        <DetailBox title="Mensaje Padres" content={d.mensaje_padres_entorno} icon={<MessageCircle size={13}/>} color="bg-emerald-50 border-emerald-200 text-emerald-700" full/>
                      </div>
                    )}
                  </div>
                )
              })}
              {historyData.aba.map((sesion: any) => {
                const isExpanded = expandedCardId === `aba-${sesion.id}`
                const d = sesion.datos || {}
                return (
                  <div key={`aba-${sesion.id}`} className="rounded-2xl border-2 transition-all duration-200"
                    style={{ background: 'var(--card)', borderColor: isExpanded ? '#0284c7' : 'var(--card-border)' }}>
                    <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => toggleCard(`aba-${sesion.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center bg-sky-700 text-white rounded-xl p-2.5 min-w-[56px] shadow">
                          <span className="text-[9px] font-bold uppercase opacity-60">{new Date(sesion.fecha_sesion).toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg font-bold leading-none">{new Date(sesion.fecha_sesion).getDate() + 1}</span>
                        </div>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{d.conducta || 'Sesión ABA'}</p>
                      </div>
                      <ChevronDown size={18} className={`transition-transform ${isExpanded ? 'rotate-180 text-sky-400' : ''}`} style={{ color: isExpanded ? undefined : 'var(--text-muted)' }}/>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t pt-3 animate-fade-in space-y-3" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
                        <DetailBox title="Objetivo" content={d.objetivo_principal} icon={<Target size={13}/>} color="bg-sky-50 border-sky-200 text-sky-700" full/>
                        <DetailBox title={t('ui.observations')} content={d.observaciones_tecnicas} icon={<Eye size={13}/>} color="bg-slate-50 border-slate-200 text-slate-700" full/>
                        <div className="grid grid-cols-2 gap-3">
                          <DetailBox title="ABC" content={d.antecedente} icon={<Activity size={13}/>} color="bg-sky-50 border-sky-200 text-sky-700"/>
                          <DetailBox title={t('ui.intervencion')} content={d.estrategias_manejo} icon={<Zap size={13}/>} color="bg-orange-50 border-orange-200 text-orange-700"/>
                        </div>
                        <div className="rounded-xl p-3 bg-amber-50 border border-amber-200">
                          <div className="flex items-center gap-2 mb-1.5">
                            <MessageCircle size={11} className="text-amber-600"/>
                            <span className="text-[10px] font-bold text-amber-700">{t('ui.mensajePadresLabel')}</span>
                            <span className="ml-auto text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">{t('ui.enBandeja')}</span>
                          </div>
                          <p className="text-xs text-amber-800 italic">"{d.mensaje_padres}"</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Sesiones registradas en programas ABA (sesiones_datos_aba) */}
              {(historyData.sesionesDataAba || []).map((ses: any) => {
                const isExpanded = expandedCardId === `sda-${ses.id}`
                const fechaObj = ses.fecha ? new Date(ses.fecha + 'T12:00:00') : null
                const pct = ses.porcentaje_exito ?? null
                const pctColor = pct == null ? '#94a3b8' : pct >= 90 ? '#10b981' : pct >= 70 ? '#0284c7' : pct >= 45 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={`sda-${ses.id}`} className="rounded-2xl border-2 transition-all duration-200"
                    style={{ background: 'var(--card)', borderColor: isExpanded ? '#0284c7' : 'var(--card-border)' }}>
                    <div className="p-4 cursor-pointer flex items-center justify-between" onClick={() => toggleCard(`sda-${ses.id}`)}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col items-center justify-center text-white rounded-xl p-2.5 min-w-[56px] shadow"
                          style={{ background: 'linear-gradient(135deg,#0284c7,#0369a1)' }}>
                          <span className="text-[9px] font-bold uppercase opacity-70">{fechaObj ? fechaObj.toLocaleString('default', { month: 'short' }) : '—'}</span>
                          <span className="text-lg font-bold leading-none">{fechaObj ? fechaObj.getDate() : '·'}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ses._programaTitulo}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {ses.set ? `Set ${ses.set} · ` : ''}{ses.fase || 'Sesión'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {pct != null && <span className="text-base font-extrabold tabular-nums" style={{ color: pctColor }}>{pct}%</span>}
                        <ChevronDown size={18} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: isExpanded ? '#0284c7' : 'var(--text-muted)' }}/>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t pt-3 animate-fade-in" style={{ borderColor: 'var(--card-border)', background: 'var(--muted-bg)' }}>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                            <p className="text-lg font-extrabold tabular-nums" style={{ color: pctColor }}>{pct ?? '—'}{pct != null ? '%' : ''}</p>
                            <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Éxito</p>
                          </div>
                          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                            <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{ses.respuestas_correctas ?? '—'}</p>
                            <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Correctas</p>
                          </div>
                          <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                            <p className="text-lg font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>{ses.oportunidades_totales ?? '—'}</p>
                            <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Oportunidades</p>
                          </div>
                        </div>
                        {ses.notas && (
                          <DetailBox title="Notas" content={ses.notas} icon={<MessageCircle size={13}/>} color="bg-sky-50 border-sky-200 text-sky-700" full/>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {(historyData.aba.length === 0 && historyData.entorno.length === 0 && (historyData.sesionesDataAba || []).length === 0) && (
                <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                  <History size={48} className="mx-auto mb-3 opacity-20"/>
                  <p className="font-bold text-sm">Sin registros</p>
                </div>
              )}
            </div>
          </AccordionSection>

          {/* ══ SECCIÓN 3: FICHA DE INGRESO (cerrado por defecto) ══ */}
          <AccordionSection
            id="anamnesis"
            title={t('ui.fichaIngreso')}
            icon={<FileText size={17}/>}
            accent="#0ea5e9"
            defaultOpen={false}
            badge={historyData.anamnesis && selectedChild ? (
              <button
                onClick={e => { e.stopPropagation(); setShowAnamnesisReport(true) }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-sm"
              >
                <FileText size={11}/> Generar reporte Word
              </button>
            ) : undefined}
          >
            <div className="p-4 space-y-2" style={{ background: 'var(--background)' }}>
              {historyData.anamnesis ? Object.entries(historyData.anamnesis).slice(0, 20).map(([key, value]: any) => (
                <div key={key} className="px-3 py-2.5 rounded-xl" style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <span className="text-[10px] font-bold uppercase block mb-0.5 tracking-wider" style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}</span>
                  <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{String(value)}</p>
                </div>
              )) : (
                <div className="py-12 text-center">
                  <FileText size={36} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }}/>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('ui.sinFichaIngreso')}</p>
                </div>
              )}
            </div>
          </AccordionSection>

          {/* ══ SECCIÓN 4: REPORTES WORD (cerrado por defecto) ══ */}
          <AccordionSection
            id="reportes"
            title="Reportes Word Generados"
            icon={<FileText size={17}/>}
            accent="#0891b2"
            badge={reportesHistorial.length > 0 ? <span className="text-xs bg-sky-600 text-white px-2 py-0.5 rounded-full font-bold">{reportesHistorial.length}</span> : undefined}
            defaultOpen={false}
          >
            <div className="p-4" style={{ background: 'var(--background)' }}>
              {loadingReportes ? (
                <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text-muted)' }}>
                  <Loader2 className="animate-spin" size={18}/><span className="text-xs font-bold">{t('common.cargando')}</span>
                </div>
              ) : reportesHistorial.length === 0 ? (
                <div className="py-10 text-center rounded-xl border-2 border-dashed" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                  <FileText size={32} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }}/>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Sin reportes generados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {reportesHistorial.map(rep => <ReporteHistorialCard key={rep.id} reporte={rep}/>)}
                </div>
              )}
            </div>
          </AccordionSection>

          {/* ══ SECCIÓN 5: GRÁFICAS ABA (cerrado por defecto) ══ */}
          <AccordionSection
            id="graficas"
            title={t('ui.graficasABA')}
            icon={<BarChart3 size={17}/>}
            accent="#10b981"
            defaultOpen={true}
          >
            <div className="p-4" style={{ background: 'var(--background)' }}>
              <ProgresoGraficas childId={selectedChild} modoParent={false} />
            </div>
          </AccordionSection>

        </div>
      ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 py-40">
              <Brain size={120} className="mb-8 text-slate-200"/>
              <p className="text-2xl font-bold uppercase tracking-[0.4em] text-slate-300">{t('ui.seleccionarPacienteOpc')}</p>
          </div>
      )}

      {/* ══ MODAL: REPORTE WORD ANAMNESIS ══ */}
      {showAnamnesisReport && selectedChild && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="w-full max-w-xl animate-fade-in-up">
            <ReportGenerator
              childId={selectedChild}
              childName={listaNinos.find(n => n.id === selectedChild)?.name || ''}
              evaluationType="anamnesis"
              evaluationData={historyData.anamnesis || {}}
              evaluationId={selectedChild}
              compact={false}
              onClose={() => setShowAnamnesisReport(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente acordeón reutilizable ──────────────────────────────────────────
function AccordionSection({ id, title, icon, badge, defaultOpen, accent = '#0284c7', children }: {
  id: string
  title: string
  icon: React.ReactNode
  badge?: React.ReactNode
  defaultOpen?: boolean
  accent?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: "var(--card)", border: "1px solid var(--card-border)", boxShadow: 'var(--shadow-sm)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 transition-all hover:opacity-90"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}18`, color: accent }}>
            {icon}
          </div>
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{title}</span>
          {badge}
        </div>
        <ChevronDown size={16} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
      </button>
      {open && <div className="border-t" style={{ borderColor: "var(--card-border)" }}>{children}</div>}
    </div>
  )
}


// ==============================================================================
// SUBCOMPONENTE: TARJETA DE REPORTE EN HISTORIAL
// ==============================================================================
const COLORES_REPORTE: Record<string, string> = {
  aba:           'from-sky-500 to-sky-600',
  anamnesis:     'from-sky-500 to-sky-600',
  entorno_hogar: 'from-green-500 to-green-600',
  brief2:        'from-sky-500 to-sky-600',
  ados2:         'from-teal-500 to-teal-600',
  vineland3:     'from-emerald-500 to-emerald-600',
  wiscv:         'from-sky-500 to-sky-600',
  basc3:         'from-rose-500 to-rose-600',
}

const BADGE_REPORTE: Record<string, string> = {
  aba:           'bg-sky-100 text-sky-700 border-sky-200',
  anamnesis:     'bg-sky-100 text-sky-700 border-sky-200',
  entorno_hogar: 'bg-green-100 text-green-700 border-green-200',
  brief2:        'bg-sky-100 text-sky-700 border-sky-200',
  ados2:         'bg-teal-100 text-teal-700 border-teal-200',
  vineland3:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  wiscv:         'bg-sky-100 text-sky-700 border-sky-200',
  basc3:         'bg-rose-100 text-rose-700 border-rose-200',
}

function ReporteHistorialCard({ reporte }: { reporte: any; key?: any }) {
  const { t, locale } = useI18n()
  const handleDownload = async () => {
    try {
      const { data, error } = await supabase
        .from('reportes_generados')
        .select('file_data, nombre_archivo')
        .eq('id', reporte.id)
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Reporte no encontrado')
      const byteChars = atob(data.file_data)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = data.nombre_archivo
      document.body.appendChild(a); a.click()
      URL.revokeObjectURL(url); document.body.removeChild(a)
    } catch {
      alert(t('ui.errorDescargar'))
    }
  }

  const gradiente = COLORES_REPORTE[reporte.tipo_reporte] || 'from-slate-500 to-slate-600'
  const badge     = BADGE_REPORTE[reporte.tipo_reporte]   || 'bg-slate-100 text-slate-600 border-slate-200'

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-200 group" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      {/* Barra superior con color del tipo */}
      <div className={`bg-gradient-to-r ${gradiente} p-4 flex items-center gap-3`}>
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <FileText size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-xs truncate">{reporte.titulo}</p>
          <p className="text-white/70 text-[10px] font-bold mt-0.5">
            {(reporte.tamano_bytes / 1024).toFixed(0)} KB
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2.5">
        <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
          {reporte.tipo_reporte}
        </span>

        <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
          <Clock size={10} />
          <span>
            {new Date(reporte.fecha_generacion).toLocaleDateString(toBCP47(locale), {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            })}
          </span>
        </div>

        {reporte.generado_por && (
          <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
            <User size={10} />
            <span>{reporte.generado_por}</span>
          </div>
        )}

        <button
          onClick={handleDownload}
          className={`w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r ${gradiente} text-white rounded-xl font-bold text-xs transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-95`}
        >
          <Download size={14} />
          Descargar .docx
        </button>
      </div>
    </div>
  )
}

function DetailBox({ title, content, icon, color, full }: any) {
    const safeContent = content ? String(content) : ""; 
    const isEmpty = safeContent === "" || safeContent === "undefined";
    const finalStyle = isEmpty ? "bg-slate-50 border-slate-200 text-slate-400" : color;

    return (
        <div className={`p-4 rounded-2xl border ${finalStyle} shadow-sm transition-all ${full ? 'w-full' : ''}`}>
            <p className={`font-bold uppercase mb-2 flex items-center gap-2 text-[10px] tracking-widest opacity-80`}>
              {icon} {title}
            </p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium" style={{ color: 'inherit' }}>
              {isEmpty ? "SIN REGISTRO" : safeContent}
            </p>
        </div>
    )
}


export default AIReportView
