'use client'
import React from 'react'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Brain, X, Send, Loader2, User, BookOpen, Minus, Maximize2, Minimize2, HelpCircle, Stethoscope, Map, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fuentes?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
// GUÍA COMPLETA DE LA PLATAFORMA VANTY
// Este texto se inyecta como contexto cuando ARIA está en modo "soporte web"
// ─────────────────────────────────────────────────────────────────────────────
const VANTY_PLATFORM_GUIDE = `
Eres ARIA en modo Guía de Plataforma VANTY. Debes responder con instrucciones EXACTAS y VISUALES sobre cómo usar cada sección de VANTY. 
Usa emojis de navegación, explica paso a paso dónde hacer clic, y siempre menciona el nombre exacto del menú o botón.

=== ESTRUCTURA DE NAVEGACIÓN ===
La plataforma VANTY tiene un menú lateral (sidebar) a la izquierda con estas secciones principales:

📊 INICIO (Dashboard)
- Vista general con estadísticas del centro
- Muestra: pacientes activos, sesiones del día, alertas pendientes
- Cómo acceder: Clic en "Inicio" en el menú lateral izquierdo

📅 AGENDA
- Calendario de citas y sesiones
- Funciones: crear citas, ver disponibilidad, sincronizar con Google Calendar o Microsoft Calendar
- Cómo crear una cita: Agenda → clic en el día/hora deseada → llenar el formulario → Guardar
- Solo visible para roles: Jefe y Admin

👥 PACIENTES
- Lista completa de niños/pacientes registrados
- Desde aquí puedes: ver expediente, programas ABA, evaluaciones, historial
- Cómo agregar paciente: Pacientes → botón "+ Nuevo Paciente" (arriba a la derecha) → completar formulario
- Cómo buscar paciente: barra de búsqueda en la parte superior de la lista

⚡ HUB DE INTELIGENCIA
- Centro de IA y análisis avanzado
- Contiene: ARIA Agente, VADI, reportes con IA, gráficas ABA
- Cómo acceder a ARIA completa: Hub de Inteligencia → pestaña "ARIA"

🧠 CEREBRO / BASE DE CONOCIMIENTO
- Biblioteca de recursos clínicos
- Funciones: subir documentos, protocolos, materiales de entrenamiento
- Cómo subir un documento: Cerebro → botón "Subir documento" → seleccionar archivo

💰 PAGOS
- Gestión de pagos de familias
- Funciones: registrar pagos, ver historial, marcar como pagado/pendiente
- Cómo registrar un pago: Pagos → botón "+ Nuevo Pago" → seleccionar familia → ingresar monto y fecha → Guardar
- Solo visible para roles: Jefe y Admin

📈 REPORTES FINANCIEROS
- Reportes y estadísticas financieras del centro
- Funciones: ver ingresos por período, exportar reportes, gráficas financieras
- Cómo generar un reporte: Reportes Financieros → seleccionar rango de fechas → clic en "Generar Reporte"
- Solo visible para rol: Jefe

📚 RECURSOS ADICIONALES
- Biblioteca de materiales y tienda
- Pestañas: "Recursos" (materiales clínicos) y "Tienda" (productos)
- Visible para todos los roles

💬 CHAT EQUIPO
- Chat interno entre especialistas del centro
- Solo visible para rol: Jefe

=== SECCIÓN PACIENTES - DETALLE ===
Al abrir un paciente verás estas pestañas:
- "Perfil": datos personales, diagnóstico, contacto familiar
- "Programas ABA": objetivos terapéuticos activos, fases, registro de datos
- "Evaluaciones": formularios de evaluación (CARS, Vineland, etc.)
- "Documentos": archivos del expediente
- "ARIA": chat con IA contextualizado a ese paciente

Para EDITAR un paciente: Pacientes → clic en el paciente → botón "Editar" (ícono de lápiz)
Para ARCHIVAR un paciente: Pacientes → clic en el paciente → menú "..." → "Archivar"

=== PAGOS - DETALLE ===
Sección Pagos → botón "+ Nuevo Pago"
Campos requeridos:
- Familia/Paciente: seleccionar del desplegable
- Monto: ingresar cantidad numérica
- Fecha de pago: seleccionar del calendario
- Método de pago: efectivo, transferencia, tarjeta
- Concepto: descripción del pago (ej: "Sesiones abril 2025")
- Estado: Pagado / Pendiente / Parcial

Para VER historial de pagos de una familia: Pagos → buscar por nombre → ver columna de historial

=== AGENDA - DETALLE ===
Para CREAR una cita:
1. Ir a Agenda en el menú lateral
2. Clic en el día y hora deseada en el calendario
3. Se abre el formulario de cita:
   - Paciente: seleccionar del desplegable
   - Especialista: asignar terapeuta
   - Duración: 30min, 45min, 60min, etc.
   - Tipo: Sesión ABA, Evaluación, Consulta, etc.
   - Notas: observaciones opcionales
4. Clic en "Guardar"

Para SINCRONIZAR con Google Calendar: Agenda → botón "Sincronizar" → "Google Calendar" → autorizar acceso

=== EVALUACIONES ===
Acceso: Pacientes → seleccionar paciente → pestaña "Evaluaciones"
Tipos disponibles: CARS-2, Vineland-3, ABAS-3, NeuroForms personalizados
Para CREAR evaluación: botón "+ Nueva Evaluación" → seleccionar tipo → completar formulario → Guardar

=== PROGRAMAS ABA ===
Acceso: Pacientes → seleccionar paciente → pestaña "Programas ABA"
Funciones:
- Ver objetivos activos por área (comunicación, conducta, habilidades adaptativas)
- Registrar datos de sesión (+ / -)
- Ver gráficas de progreso
- Agregar nuevo objetivo: botón "+ Objetivo" → seleccionar plantilla → configurar criterio de maestría

=== IMPORTAR DATOS (CSV/Excel) ===
Menú lateral → "Importar CSV" (puede estar oculto, buscar en configuración)
O desde Dashboard: botón "Importar" en la sección de herramientas

=== CONFIGURACIÓN Y PERFIL ===
Menú lateral → "Mi Perfil" (ícono de persona)
- Cambiar nombre, foto, contraseña
- Configurar idioma (español/inglés)
- Preferencias de notificaciones

=== GESTIÓN DE USUARIOS ===
Menú lateral → sección "Usuarios" (solo Jefe/Admin)
Roles disponibles:
- Jefe: acceso completo a todo
- Admin: acceso a casi todo excepto Reportes Financieros
- Especialista: acceso a pacientes, evaluaciones, Hub
- Terapeuta: acceso básico a pacientes y agenda

Para AGREGAR usuario: Usuarios → "+ Nuevo Usuario" → completar datos → asignar rol → enviar invitación

=== WHATSAPP INTEGRACIÓN ===
Configuración → WhatsApp → escanear código QR con el teléfono del centro
Una vez conectado: mensajes automáticos a familias sobre citas y recordatorios

=== PREGUNTAS FRECUENTES ===
¿Cómo cambio el idioma? → Mi Perfil → selector de idioma (arriba del menú)
¿Cómo exporto datos? → cada sección tiene un botón "Exportar" (ícono de descarga)
¿Cómo veo los reportes de progreso? → Hub de Inteligencia → Gráficas ABA
¿Cómo contacto soporte técnico? → ícono de ayuda (?) en la esquina superior derecha

IMPORTANTE: Siempre da instrucciones PASO A PASO con el nombre exacto de los botones y menús. Si no sabes algo con certeza sobre la plataforma, dilo claramente en lugar de inventar pasos.
`

// ─────────────────────────────────────────────────────────────────────────────

export default function ARIAFloatingChat({ userId, childId, childName }: { userId: string; childId?: string; childName?: string }) {
  const { t, locale } = useI18n()
  const [open, setOpen]           = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [expanded, setExpanded]   = useState(false)
  const [mode, setMode]           = useState<'clinico' | 'soporte'>('clinico')

  const STORAGE_KEY = `aria_messages_${userId}${childId ? '_' + childId : ''}`
  const CONV_KEY    = `aria_conv_${userId}${childId ? '_' + childId : ''}`

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [unread, setUnread]     = useState(0)
  const [conversacionId, setConversacionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(CONV_KEY) } catch { return null }
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Persistir mensajes en localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)) } catch {}
  }, [messages, STORAGE_KEY])

  // Persistir conversacionId
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (conversacionId) localStorage.setItem(CONV_KEY, conversacionId)
      else localStorage.removeItem(CONV_KEY)
    } catch {}
  }, [conversacionId, CONV_KEY])

  // Mensaje de bienvenida según modo
  const getWelcomeMessage = useCallback((currentMode: 'clinico' | 'soporte') => {
    if (currentMode === 'soporte') {
      return `¡Hola! 👋 Soy **ARIA** en modo **Guía de Plataforma**.\n\nPuedo ayudarte a navegar VANTY: cómo registrar pagos, crear citas, agregar pacientes, usar evaluaciones y mucho más.\n\n¿Sobre qué sección necesitas ayuda? 🗺️`
    }
    return childId && childName
      ? `¡Hola! 👋 Soy **ARIA**. Estoy revisando el expediente de **${childName}** y tengo acceso a todo su historial, programas ABA y evaluaciones.\n\n¿En qué te puedo ayudar?`
      : '¡Hola! 👋 Soy **ARIA**, tu asistente clínica. \n\nEstoy entrenada en ABA, neuropsicología y educación especial.\n\n¿En qué puedo ayudarte hoy? 🧠'
  }, [childId, childName])

  // Reset al cambiar de modo
  const handleModeChange = (newMode: 'clinico' | 'soporte') => {
    setMode(newMode)
    setConversacionId(null)
    setMessages([{
      role: 'assistant',
      content: getWelcomeMessage(newMode),
      timestamp: new Date().toISOString(),
    }])
  }

  // Borrar historial completo
  const clearHistory = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(CONV_KEY)
      } catch {}
    }
    setConversacionId(null)
    setMessages([{
      role: 'assistant',
      content: getWelcomeMessage(mode),
      timestamp: new Date().toISOString(),
    }])
  }, [mode, getWelcomeMessage, STORAGE_KEY, CONV_KEY])
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      const hasSaved = saved && JSON.parse(saved).length > 0
      if (!hasSaved) {
        setMessages([{
          role: 'assistant',
          content: getWelcomeMessage(mode),
          timestamp: new Date().toISOString(),
        }])
        setConversacionId(null)
      }
    } catch {
      setMessages([{
        role: 'assistant',
        content: getWelcomeMessage(mode),
        timestamp: new Date().toISOString(),
      }])
    }
  }, [childId, childName])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setMinimized(false)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  useEffect(() => {
    if (open && !minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, minimized])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])

    try {
      // En modo soporte, inyectamos la guía de plataforma como contexto adicional
      const mensajeConContexto = mode === 'soporte'
        ? `[CONTEXTO DE PLATAFORMA - USA ESTO PARA RESPONDER]\n${VANTY_PLATFORM_GUIDE}\n\n[PREGUNTA DEL USUARIO]\n${msg}`
        : msg

      const res = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({
          mensaje: mensajeConContexto,
          userId,
          childId: mode === 'clinico' ? (childId || undefined) : undefined,
          conversacionId,
          contexto: mode === 'soporte' ? 'soporte_web' : (childId ? 'paciente' : 'general'),
          locale,
        }),
      })
      const data = await res.json()
      const reply: Message = {
        role: 'assistant',
        content: data.response || data.respuesta || data.mensaje || 'No pude procesar tu consulta.',
        timestamp: new Date().toISOString(),
        fuentes: mode === 'soporte' ? ['Guía VANTY'] : data.fuentes,
      }
      setMessages(prev => [...prev, reply])
      if (data.conversacionId) setConversacionId(data.conversacionId)
      if (!open || minimized) setUnread(n => n + 1)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Hubo un error al conectar con ARIA. Intenta de nuevo.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, userId, conversacionId, locale, open, minimized, mode, childId])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Sugerencias según modo
  const sugerencias = mode === 'soporte'
    ? [
        '¿Cómo registro un pago?',
        '¿Cómo agrego un paciente nuevo?',
        '¿Cómo creo una cita en la agenda?',
        '¿Cómo genero un reporte financiero?',
      ]
    : [
        '¿Mejores reforzadores para TEA?',
        '¿Cómo aplicar extinción de escape?',
        '¿Cómo manejar una rabieta?',
      ]

  const formatContent = (text: string) =>
    text.split('\n').map((line, i, arr) => {
      const parts = line.split(/\*\*(.*?)\*\*/g)
      return (
        <span key={i}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
          {i < arr.length - 1 && <br />}
        </span>
      )
    })

  return (
    <>
      {/* ── Panel flotante ── */}
      {open && (
        <div
          className={`fixed z-50 flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all duration-300
            ${expanded
              ? 'bottom-0 right-0 md:bottom-4 md:right-4 rounded-2xl'
              : 'bottom-20 md:bottom-6 right-4 md:right-6'}
            ${minimized ? 'h-14' : expanded ? 'h-[92vh] md:h-[85vh]' : 'h-[560px] md:h-[600px]'}`}
          style={{
            width: expanded ? 'min(720px, calc(100vw - 32px))' : 'min(360px, calc(100vw - 32px))',
            background: 'var(--card)',
            border: '1px solid var(--card-border)',
          }}
        >
          {/* Header */}
          <div
            className={`px-3 py-2.5 flex items-center gap-2 flex-shrink-0 cursor-pointer transition-all duration-300
              ${mode === 'soporte'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600'}`}
            onClick={() => setMinimized(m => !m)}
          >
            <div className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              {mode === 'soporte'
                ? <Map size={14} className="text-white" />
                : <Brain size={14} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-black text-white text-sm leading-tight truncate">ARIA</p>
              <p className="text-white/70 text-[10px] truncate">
                {mode === 'soporte' ? 'Guía de Plataforma · VANTY' : 'Asistente Clínico IA'}
              </p>
            </div>
            {/* Botones de control — flex-shrink-0 para que nunca se corten */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse mr-1" />
              <button
                onClick={() => { if (window.confirm('¿Borrar todo el historial de ARIA?')) clearHistory() }}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
                title="Borrar historial"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={() => setMinimized(m => !m)}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
                title="Minimizar"
              >
                <Minus size={13} />
              </button>
              <button
                onClick={() => { setExpanded(x => !x); setMinimized(false) }}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
                title={expanded ? 'Reducir' : 'Ampliar'}
              >
                {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button
                onClick={() => { setOpen(false); setExpanded(false) }}
                className="w-7 h-7 flex items-center justify-center hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
                title="Cerrar"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* ── Toggle de modo ── */}
              <div
                className="flex gap-1 p-2 flex-shrink-0"
                style={{ background: 'var(--card)', borderBottom: '1px solid var(--card-border)' }}
              >
                <button
                  onClick={() => handleModeChange('clinico')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    mode === 'clinico'
                      ? 'bg-violet-600 text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--muted-bg)]'
                  }`}
                >
                  <Stethoscope size={11} />
                  Asistente Clínico
                </button>
                <button
                  onClick={() => handleModeChange('soporte')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    mode === 'soporte'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--muted-bg)]'
                  }`}
                >
                  <HelpCircle size={11} />
                  Guía de Plataforma
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: 'var(--background)' }}>
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : (mode === 'soporte' ? 'rgba(5,150,105,0.15)' : 'rgba(139,92,246,0.15)') }}>
                      {msg.role === 'user'
                        ? <User size={12} className="text-indigo-500" />
                        : mode === 'soporte'
                          ? <Map size={12} className="text-emerald-500" />
                          : <Brain size={12} className="text-violet-500" />}
                    </div>
                    <div className={`max-w-[80%] flex flex-col gap-0.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className="rounded-2xl px-3 py-2 text-xs leading-relaxed"
                        style={msg.role === 'user'
                          ? { background: '#6d28d9', color: '#fff', borderRadius: '1rem 0.25rem 1rem 1rem' }
                          : { background: 'var(--muted-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '0.25rem 1rem 1rem 1rem' }
                        }>
                        {formatContent(msg.content)}
                      </div>
                      {msg.fuentes && msg.fuentes.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {msg.fuentes.map((f, j) => (
                            <span key={j} className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
                              mode === 'soporte'
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-violet-500/20 text-violet-400 border-violet-500/30'
                            }`}>
                              <BookOpen size={7} /> {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2">
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${mode === 'soporte' ? 'bg-emerald-500/20' : 'bg-violet-500/20'}`}>
                      {mode === 'soporte'
                        ? <Map size={12} className="text-emerald-500" />
                        : <Brain size={12} className="text-violet-500" />}
                    </div>
                    <div className="rounded-2xl px-3 py-2 flex items-center gap-2"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)' }}>
                      <Loader2 size={12} className="animate-spin text-violet-500" />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>ARIA está pensando...</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Sugerencias */}
              {messages.length <= 1 && (
                <div className="px-3 pb-2 pt-2 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid var(--card-border)', background: 'var(--background)' }}>
                  {sugerencias.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all hover:border-violet-400 hover:text-violet-500 text-left"
                      style={{ background: 'var(--muted-bg)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-3 flex-shrink-0" style={{ background: 'var(--card)', borderTop: '1px solid var(--card-border)' }}>
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder={mode === 'soporte' ? '¿En qué sección necesitas ayuda?' : 'Pregúntale a ARIA sobre el caso, protocolos ABA, DSM-5...'}
                    className="flex-1 p-2.5 rounded-2xl text-xs resize-none outline-none transition-all leading-relaxed max-h-24 focus:ring-2 focus:ring-violet-400"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1.5px solid var(--input-border)',
                      color: 'var(--text-primary)',
                      minHeight: '38px',
                    }}
                  />
                  <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                    className={`w-9 h-9 text-white rounded-xl flex items-center justify-center disabled:opacity-40 transition-all shrink-0 ${
                      mode === 'soporte' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-violet-600 hover:bg-violet-700'
                    }`}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Botón flotante ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95
          ${open ? 'opacity-0 pointer-events-none scale-75' : 'opacity-100 scale-100'}`}
        style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
        title="Abrir ARIA"
      >
        <Brain size={26} className="text-white" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg">
            {unread}
          </span>
        )}
      </button>
    </>
  )
}
