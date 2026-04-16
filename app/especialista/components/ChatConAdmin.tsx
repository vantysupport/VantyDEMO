'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'
import {
  Send, Loader2, MessageCircle, CheckCheck, Check,
  Search, RefreshCw, Users, Paperclip, Mic,
  MicOff, X, FileText, Play, Pause, Square,
  Reply, Copy, Forward, Pin, Star, Flag, Trash2,
  MoreVertical, Camera, Smile, Shield
} from 'lucide-react'

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Contacto {
  id: string
  full_name: string
  specialty: string | null
  role: string
  unread: number
  lastMessage: string | null
  lastTime: string | null
  avatar_url?: string | null
}

interface Mensaje {
  id: string
  content: string
  sender_id: string
  recipient_id: string
  sender_role: string
  sender_name: string
  created_at: string
  read_at: string | null
  message_type?: 'text' | 'file' | 'audio'
  file_url?: string | null
  file_name?: string | null
  file_type?: string | null
  reaction?: string | null
  is_pinned?: boolean
  is_starred?: boolean
}

interface ContextMenu { msgId: string; x: number; y: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })
}
function formatFecha(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTiempo(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}
function roleLabel(role: string) {
  const map: Record<string, string> = { jefe: 'Director(a)', admin: 'Administrador', especialista: 'Especialista', terapeuta: 'Terapeuta' }
  return map[role] || role
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, avatarUrl, size = 'md', online = false }: { name: string; avatarUrl?: string | null; size?: 'sm' | 'md' | 'lg'; online?: boolean }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
  return (
    <div className="relative flex-shrink-0">
      {avatarUrl
        ? <img src={avatarUrl} alt={name} className={`${sz} rounded-full object-cover ring-2 ring-white shadow-sm`} />
        : <div className={`${sz} bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-black shadow-sm`}>{name.charAt(0).toUpperCase()}</div>
      }
      {online && <span className={`absolute bottom-0 right-0 ${dot} bg-emerald-400 rounded-full ring-2 ring-white`} />}
    </div>
  )
}

// ─── AvatarUpload ─────────────────────────────────────────────────────────────
function AvatarUpload({ userId, currentUrl, name, onUpdate }: { userId: string; currentUrl?: string | null; name: string; onUpdate: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${userId}.${ext}`
      const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId)
      onUpdate(publicUrl)
    } catch (err) { console.error(err) }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = '' }
  }
  return (
    <div className="relative group cursor-pointer" onClick={() => inputRef.current?.click()}>
      <Avatar name={name} avatarUrl={currentUrl} size="lg" />
      <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploading ? <Loader2 size={14} className="animate-spin text-white" /> : <Camera size={14} className="text-white" />}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function MessageContextMenu({ menu, esMio, onClose, onReply, onCopy, onReact, onForward, onPin, onStar, onReport, onDelete }: {
  menu: ContextMenu; esMio: boolean; onClose: () => void; onReply: () => void; onCopy: () => void
  onReact: (emoji: string) => void; onForward: () => void; onPin: () => void; onStar: () => void; onReport: () => void; onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])
  const style: React.CSSProperties = { position: 'fixed', top: menu.y, left: menu.x, zIndex: 9999 }
  return (
    <div ref={ref} style={style} className="animate-in fade-in zoom-in-95 duration-100">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 px-3 py-2 mb-1.5 flex items-center gap-1">
        {REACTION_EMOJIS.map(emoji => (
          <button key={emoji} onClick={() => { onReact(emoji); onClose() }} className="text-xl hover:scale-125 transition-transform active:scale-90 p-0.5">{emoji}</button>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden min-w-[180px]">
        {[
          { icon: Reply, label: 'Responder', action: onReply },
          { icon: Copy, label: 'Copiar', action: onCopy },
          { icon: Smile, label: 'Reaccionar', action: () => {} },
          { icon: Forward, label: 'Reenviar', action: onForward },
          { icon: Pin, label: 'Fijar', action: onPin },
          { icon: Star, label: 'Destacar', action: onStar },
        ].map(({ icon: Icon, label, action }) => (
          <button key={label} onClick={() => { action(); onClose() }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-slate-700 text-sm transition-colors">
            <Icon size={15} className="text-slate-500" />{label}
          </button>
        ))}
        <div className="h-px bg-slate-100" />
        {esMio
          ? <button onClick={() => { onDelete(); onClose() }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 text-red-500 text-sm transition-colors"><Trash2 size={15} /> Eliminar</button>
          : <button onClick={() => { onReport(); onClose() }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-orange-500 text-sm transition-colors"><Flag size={15} /> Reportar</button>
        }
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ChatConAdmin({
  userId,
  userName,
  userAvatarUrl,
  onAvatarUpdate,
}: {
  userId: string
  userName: string
  userAvatarUrl?: string | null
  onAvatarUpdate?: (url: string) => void
}) {
  const toast = useToast()
  const { isDark } = useTheme()

  const [contactos, setContactos] = useState<Contacto[]>([])
  const [seleccionado, setSeleccionado] = useState<Contacto | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [loadingContactos, setLoadingContactos] = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const [grabando, setGrabando] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [reproduciendo, setReproduciendo] = useState<string | null>(null)
  const [tiempoGrabacion, setTiempoGrabacion] = useState(0)

  const [myAvatar, setMyAvatar] = useState<string | null | undefined>(userAvatarUrl)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const [contextMsgId, setContextMsgId] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<Mensaje | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({})

  const scrollAbajo = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [])

  // ── Cargar contactos (admins + jefes + otros especialistas) ──────────────
  const cargarContactos = useCallback(async () => {
    try {
      const { data: perfiles } = await supabase
        .from('profiles')
        .select('id, full_name, specialty, role, avatar_url')
        .in('role', ['jefe', 'admin', 'especialista', 'terapeuta'])
        .neq('id', userId)
        .order('full_name')
      if (!perfiles) return

      const conInfo = await Promise.all(
        perfiles.map(async (p) => {
          const { data: msgs } = await supabase
            .from('chat_especialista_admin')
            .select('content, created_at, read_at, sender_id, message_type')
            .or(
              `and(sender_id.eq.${userId},recipient_id.eq.${p.id}),and(sender_id.eq.${p.id},recipient_id.eq.${userId})`
            )
            .order('created_at', { ascending: false })
            .limit(1)
          const { count } = await supabase
            .from('chat_especialista_admin')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', p.id)
            .eq('recipient_id', userId)
            .is('read_at', null)
          const last = msgs?.[0]
          let preview = last?.content || null
          if (last?.message_type === 'file') preview = '📎 Archivo'
          if (last?.message_type === 'audio') preview = '🎤 Nota de voz'
          return { ...p, unread: count || 0, lastMessage: preview, lastTime: last?.created_at || null }
        })
      )
      conInfo.sort((a, b) => {
        if (b.unread !== a.unread) return b.unread - a.unread
        if (a.lastTime && b.lastTime) return new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime()
        return 0
      })
      setContactos(conInfo)
    } catch {
      toast.error('Error al cargar contactos')
    } finally {
      setLoadingContactos(false)
    }
  }, [userId])

  // ── Cargar mensajes de la conversación seleccionada ───────────────────────
  const cargarMensajes = useCallback(async (contactoId: string) => {
    setLoadingMsg(true)
    try {
      const { data, error } = await supabase
        .from('chat_especialista_admin')
        .select('*')
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${contactoId}),and(sender_id.eq.${contactoId},recipient_id.eq.${userId})`
        )
        .order('created_at', { ascending: true })
      if (error) throw error
      setMensajes(data || [])
      scrollAbajo()
      const noLeidos = (data || []).filter((m: Mensaje) => m.sender_id === contactoId && !m.read_at)
      if (noLeidos.length > 0) {
        await supabase.from('chat_especialista_admin').update({ read_at: new Date().toISOString() }).in('id', noLeidos.map((m: Mensaje) => m.id))
        setContactos(prev => prev.map(c => c.id === contactoId ? { ...c, unread: 0 } : c))
      }
    } catch {
      toast.error('Error al cargar mensajes')
    } finally {
      setLoadingMsg(false)
    }
  }, [userId, scrollAbajo])

  useEffect(() => { cargarContactos() }, [cargarContactos])

  useEffect(() => {
    if (!seleccionado) return
    cargarMensajes(seleccionado.id)
    const channel = supabase
      .channel(`esp_chat_${userId}_${seleccionado.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_especialista_admin' }, (payload) => {
        const nuevo = payload.new as Mensaje
        const esEstaConv = (nuevo.sender_id === userId && nuevo.recipient_id === seleccionado.id) ||
                           (nuevo.sender_id === seleccionado.id && nuevo.recipient_id === userId)
        if (!esEstaConv) return
        setMensajes(prev => prev.find(m => m.id === nuevo.id) ? prev : [...prev, nuevo])
        scrollAbajo()
        if (nuevo.sender_id !== userId) {
          supabase.from('chat_especialista_admin').update({ read_at: new Date().toISOString() }).eq('id', nuevo.id).then(() => {})
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [seleccionado, cargarMensajes, userId, scrollAbajo])

  useEffect(() => { scrollAbajo() }, [mensajes, scrollAbajo])

  // ── Enviar texto ──────────────────────────────────────────────────────────
  const enviar = async () => {
    const contenido = texto.trim()
    if (!contenido || enviando || !seleccionado) return
    setEnviando(true); setTexto(''); setReplyTo(null)
    try {
      const { error } = await supabase.from('chat_especialista_admin').insert({
        content: replyTo ? `↩ ${replyTo.sender_name}: "${replyTo.content.slice(0, 60)}"\n\n${contenido}` : contenido,
        sender_id: userId, sender_role: 'especialista', sender_name: userName,
        recipient_id: seleccionado.id, message_type: 'text', read_at: null,
      })
      if (error) throw error
    } catch { toast.error('Error al enviar'); setTexto(contenido) }
    finally { setEnviando(false); textareaRef.current?.focus() }
  }

  // ── Archivo ───────────────────────────────────────────────────────────────
  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !seleccionado) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB'); return }
    setSubiendo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `chat/${userId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
      const isImage = file.type.startsWith('image/')
      const { error } = await supabase.from('chat_especialista_admin').insert({
        content: isImage ? '📷 Imagen' : `📎 ${file.name}`,
        sender_id: userId, sender_role: 'especialista', sender_name: userName,
        recipient_id: seleccionado.id, message_type: 'file',
        file_url: publicUrl, file_name: file.name, file_type: file.type, read_at: null,
      })
      if (error) throw new Error(error.message)
      toast.success('Archivo enviado')
    } catch (err) { toast.error(`Error al subir: ${err instanceof Error ? err.message : 'Error'}`) }
    finally { setSubiendo(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  // ── Grabación ─────────────────────────────────────────────────────────────
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr; audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start(); setGrabando(true); setTiempoGrabacion(0)
      timerRef.current = setInterval(() => setTiempoGrabacion(t => t + 1), 1000)
    } catch { toast.error('No se pudo acceder al micrófono') }
  }
  const detenerGrabacion = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    setGrabando(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }
  // En móvil usamos tap-toggle en lugar de press-and-hold
  const handleMicTouch = (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (grabando) {
      detenerGrabacion()
    } else {
      iniciarGrabacion()
    }
  }
  const cancelarAudio = () => { setAudioBlob(null); setAudioUrl(null); setTiempoGrabacion(0) }
  const enviarAudio = async () => {
    if (!audioBlob || !seleccionado) return
    setSubiendo(true)
    try {
      const audioName = `audio_${Date.now()}.webm`
      const path = `chat/${userId}/${audioName}`
      const { error: upErr } = await supabase.storage.from('chat-files').upload(path, audioBlob, { contentType: 'audio/webm', upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
      const { error } = await supabase.from('chat_especialista_admin').insert({
        content: '🎤 Nota de voz', sender_id: userId, sender_role: 'especialista', sender_name: userName,
        recipient_id: seleccionado.id, message_type: 'audio',
        file_url: publicUrl, file_name: audioName, file_type: 'audio/webm', read_at: null,
      })
      if (error) throw new Error(error.message)
      cancelarAudio(); toast.success('Audio enviado')
    } catch (err) { toast.error(`Error al enviar audio: ${err instanceof Error ? err.message : 'Error'}`) }
    finally { setSubiendo(false) }
  }
  const toggleAudio = (id: string, url: string) => {
    if (reproduciendo === id) { audioRefs.current[id]?.pause(); setReproduciendo(null) }
    else {
      Object.values(audioRefs.current).forEach(a => a.pause())
      if (!audioRefs.current[id]) { const audio = new Audio(url); audio.onended = () => setReproduciendo(null); audioRefs.current[id] = audio }
      audioRefs.current[id].play(); setReproduciendo(id)
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  const openContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 220)
    const y = Math.min(e.clientY, window.innerHeight - 320)
    setContextMenu({ msgId, x, y }); setContextMsgId(msgId)
  }
  const handleReaction = async (msgId: string, emoji: string) => {
    await supabase.from('chat_especialista_admin').update({ reaction: emoji }).eq('id', msgId)
    setMensajes(prev => prev.map(m => m.id === msgId ? { ...m, reaction: emoji } : m))
  }
  const handleDelete = async (msgId: string) => {
    await supabase.from('chat_especialista_admin').delete().eq('id', msgId)
    setMensajes(prev => prev.filter(m => m.id !== msgId))
  }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  // ── Filtrar y agrupar ─────────────────────────────────────────────────────
  const filtrados = contactos.filter(c =>
    c.full_name.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.specialty || '').toLowerCase().includes(busqueda.toLowerCase())
  )
  // Separar admins y especialistas
  const admins = filtrados.filter(c => ['jefe', 'admin'].includes(c.role))
  const especialistas = filtrados.filter(c => ['especialista', 'terapeuta'].includes(c.role))

  const mensajesAgrupados = mensajes.reduce<{ fecha: string; msgs: Mensaje[] }[]>((acc, msg) => {
    const fecha = formatFecha(msg.created_at)
    const ultimo = acc[acc.length - 1]
    if (ultimo && ultimo.fecha === fecha) ultimo.msgs.push(msg)
    else acc.push({ fecha, msgs: [msg] })
    return acc
  }, [])

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <>
      {contextMenu && contextMsgId && (() => {
        const msg = mensajes.find(m => m.id === contextMsgId)
        if (!msg) return null
        return (
          <MessageContextMenu
            menu={contextMenu} esMio={msg.sender_id === userId}
            onClose={() => setContextMenu(null)}
            onReply={() => { setReplyTo(msg); setContextMenu(null); textareaRef.current?.focus() }}
            onCopy={() => { navigator.clipboard.writeText(msg.content); toast.success('Copiado') }}
            onReact={(emoji) => handleReaction(msg.id, emoji)}
            onForward={() => toast.info('Reenviar próximamente')}
            onPin={() => toast.info('Fijar próximamente')}
            onStar={() => toast.info('Destacar próximamente')}
            onReport={() => toast.info('Reportado')}
            onDelete={() => handleDelete(msg.id)}
          />
        )
      })()}

      <div className={`flex h-full overflow-hidden rounded-2xl border shadow-sm ${isDark ? 'border-[#21262d] bg-[#161b22]' : 'border-slate-100 bg-white'}`}>

        {/* ── Panel izquierdo: contactos ── */}
        <div className={`w-72 flex-shrink-0 flex flex-col border-r ${isDark ? 'border-[#21262d] bg-[#0d1117]' : 'border-slate-100 bg-slate-50/50'}`}>

          {/* Header */}
          <div className={`px-4 pt-4 pb-3 border-b ${isDark ? 'border-[#21262d] bg-[#161b22]' : 'border-slate-100 bg-white'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <AvatarUpload
                  userId={userId} currentUrl={myAvatar} name={userName}
                  onUpdate={(url) => { setMyAvatar(url); onAvatarUpdate?.(url) }}
                />
                <div>
                  <p className="text-xs font-black text-slate-800 leading-tight">{userName}</p>
                  <p className="text-[10px] text-slate-400">Toca la foto para cambiarla</p>
                </div>
              </div>
              <button onClick={cargarContactos} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <RefreshCw size={13} />
              </button>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className={`w-full pl-8 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm ${isDark ? 'bg-[#0d1117] border border-[#30363d] text-slate-300 placeholder:text-slate-600' : 'bg-white border border-slate-200 text-slate-700'}`}
              />
            </div>
          </div>

          {/* Lista contactos */}
          <div className="flex-1 overflow-y-auto">
            {loadingContactos ? (
              <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin text-blue-400" /></div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-10 px-4"><p className="text-xs text-slate-400">Sin contactos</p></div>
            ) : (
              <>
                {/* Admins */}
                {admins.length > 0 && (
                  <>
                    <div className={`px-4 py-2 flex items-center gap-1.5 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100/70'}`}>
                      <Shield size={11} className="text-blue-500" />
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Administración</p>
                    </div>
                    {admins.map(c => <ContactoItem key={c.id} c={c} seleccionado={seleccionado} onClick={() => setSeleccionado(c)} />)}
                  </>
                )}
                {/* Especialistas */}
                {especialistas.length > 0 && (
                  <>
                    <div className={`px-4 py-2 flex items-center gap-1.5 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100/70'}`}>
                      <Users size={11} className="text-violet-500" />
                      <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Especialistas</p>
                    </div>
                    {especialistas.map(c => <ContactoItem key={c.id} c={c} seleccionado={seleccionado} onClick={() => setSeleccionado(c)} />)}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Panel derecho: chat ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {!seleccionado ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-8 bg-gradient-to-br from-slate-50 to-blue-50/30">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100">
                <MessageCircle size={40} className="text-blue-200" />
              </div>
              <div>
                <p className="text-slate-700 font-black text-base">Selecciona un contacto</p>
                <p className="text-slate-400 text-sm mt-1">Elige un contacto de la lista para ver su conversación</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header conversación */}
              <div className={`px-5 py-3.5 border-b flex items-center gap-3 shadow-sm ${isDark ? 'border-[#21262d] bg-[#161b22]' : 'border-slate-100 bg-white'}`}>
                <Avatar name={seleccionado.full_name} avatarUrl={seleccionado.avatar_url} size="md" online />
                <div className="flex-1">
                  <p className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{seleccionado.full_name}</p>
                  <p className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" />
                    {seleccionado.specialty || roleLabel(seleccionado.role)}
                  </p>
                </div>
                <button className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                  <MoreVertical size={16} />
                </button>
              </div>

              {/* Banner reply */}
              {replyTo && (
                <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-start gap-2">
                  <Reply size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-blue-600">{replyTo.sender_name}</p>
                    <p className="text-[11px] text-slate-600 truncate">{replyTo.content.slice(0, 80)}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="p-1 rounded-lg hover:bg-blue-100 text-blue-400"><X size={12} /></button>
                </div>
              )}

              {/* Área mensajes */}
              <div className="flex-1 overflow-y-auto px-4 py-4 pr-6" style={{ background: isDark ? '#0d1117' : 'radial-gradient(ellipse at 20% 50%, rgba(239,246,255,0.6) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(238,242,255,0.4) 0%, transparent 60%), #f8fafc' }}>
                {loadingMsg ? (
                  <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-blue-400" /></div>
                ) : mensajes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                      <MessageCircle size={24} className="text-blue-300" />
                    </div>
                    <p className="text-slate-400 text-sm">Aún no hay mensajes. ¡Empezá la conversación!</p>
                  </div>
                ) : (
                  mensajesAgrupados.map((grupo) => (
                    <div key={grupo.fecha}>
                      <div className="flex items-center gap-3 my-4">
                        <div className={`flex-1 h-px ${isDark ? 'bg-[#30363d]' : 'bg-slate-200/70'}`} />
                        <span className={`text-[10px] font-bold px-3 py-1 rounded-full shadow-sm border ${isDark ? 'text-slate-400 bg-[#161b22] border-[#21262d]' : 'text-slate-500 bg-white border-slate-100'}`}>{grupo.fecha}</span>
                        <div className={`flex-1 h-px ${isDark ? 'bg-[#30363d]' : 'bg-slate-200/70'}`} />
                      </div>
                      <div className="space-y-0.5">
                        {grupo.msgs.map((msg, idx) => {
                          const esMio = msg.sender_id === userId
                          const siguiente = grupo.msgs[idx + 1]
                          const mismoEmisor = siguiente?.sender_id === msg.sender_id
                          return (
                            <div key={msg.id} className={`flex items-end gap-2 ${esMio ? 'flex-row-reverse pr-1' : 'flex-row'} ${mismoEmisor ? 'mb-0.5' : 'mb-3'}`}
                              onContextMenu={(e) => openContextMenu(e, msg.id)}>
                              {/* Avatar */}
                              {!esMio && (
                                <div className={`flex-shrink-0 ${mismoEmisor ? 'opacity-0 pointer-events-none' : ''}`}>
                                  <Avatar name={seleccionado.full_name} avatarUrl={seleccionado.avatar_url} size="sm" />
                                </div>
                              )}
                              <div className={`flex flex-col ${esMio ? 'items-end' : 'items-start'} max-w-[72%]`}>
                                {!esMio && !mismoEmisor && (
                                  <p className="text-[10px] font-black text-slate-500 mb-1 ml-1">{msg.sender_name}</p>
                                )}
                                {/* Archivo */}
                                {msg.message_type === 'file' && msg.file_url && (
                                  msg.file_type?.startsWith('image/') ? (
                                    <img src={msg.file_url} alt={msg.file_name || 'imagen'} className="max-w-[240px] rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(msg.file_url!, '_blank')} />
                                  ) : (
                                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm border ${esMio ? 'bg-blue-600 border-blue-500 text-white' : isDark ? 'bg-[#1c2128] border-[#21262d] text-slate-200' : 'bg-white border-slate-100 text-slate-700'}`}>
                                      <FileText size={18} className={esMio ? 'text-blue-200' : 'text-slate-400'} />
                                      <div>
                                        <p className="text-xs font-bold truncate max-w-[150px]">{msg.file_name}</p>
                                        <p className={`text-[10px] ${esMio ? 'text-blue-200' : 'text-slate-400'}`}>Toca para abrir</p>
                                      </div>
                                    </a>
                                  )
                                )}
                                {/* Audio */}
                                {msg.message_type === 'audio' && msg.file_url && (
                                  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-sm min-w-[180px] ${esMio ? 'bg-blue-600 text-white' : 'bg-white border border-slate-100'}`}>
                                    <button onClick={() => toggleAudio(msg.id, msg.file_url!)}
                                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${esMio ? 'bg-blue-500 hover:bg-blue-400' : 'bg-blue-100 hover:bg-blue-200'}`}>
                                      {reproduciendo === msg.id
                                        ? <Pause size={15} className={esMio ? 'text-white' : 'text-blue-600'} />
                                        : <Play size={15} className={esMio ? 'text-white' : 'text-blue-600'} />}
                                    </button>
                                    <div className="flex-1">
                                      <div className={`h-1.5 rounded-full ${esMio ? 'bg-blue-400' : 'bg-slate-200'}`}>
                                        <div className={`h-full rounded-full transition-all ${esMio ? 'bg-white/60' : 'bg-blue-400'}`} style={{ width: reproduciendo === msg.id ? '60%' : '0%' }} />
                                      </div>
                                      <p className={`text-[10px] mt-1 ${esMio ? 'text-blue-200' : 'text-slate-400'}`}>Nota de voz</p>
                                    </div>
                                  </div>
                                )}
                                {/* Texto */}
                                {(!msg.message_type || msg.message_type === 'text') && (
                                  <div className="relative">
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${esMio ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-sm'}`}>
                                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                    </div>
                                    {msg.reaction && (
                                      <span className="absolute -bottom-2 -right-1 text-base bg-white rounded-full shadow-sm px-1 border border-slate-100">{msg.reaction}</span>
                                    )}
                                  </div>
                                )}
                                {/* Hora */}
                                <div className={`flex items-center gap-1 mt-1.5 ${esMio ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <span className="text-[10px] text-slate-400">{formatHora(msg.created_at)}</span>
                                  {esMio && (msg.read_at
                                    ? <CheckCheck size={11} className="text-blue-400" />
                                    : <Check size={11} className="text-slate-300" />)}
                                </div>
                              </div>
                              {/* Avatar propio */}
                              {esMio && (
                                <div className={`flex-shrink-0 ${mismoEmisor ? 'opacity-0 pointer-events-none' : ''}`}>
                                  <Avatar name={userName} avatarUrl={myAvatar} size="sm" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Preview audio */}
              {audioUrl && !grabando && (
                <div className="bg-blue-50 border-t border-blue-100 px-4 py-3 flex items-center gap-3">
                  <Mic size={16} className="text-blue-500 flex-shrink-0" />
                  <audio src={audioUrl} controls className="flex-1 h-8" style={{ minWidth: 0 }} />
                  <button onClick={cancelarAudio} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-400 flex-shrink-0"><X size={14} /></button>
                  <button onClick={enviarAudio} disabled={subiendo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
                    {subiendo ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Enviar
                  </button>
                </div>
              )}

              {/* Barra grabando */}
              {grabando && (
                <div className="bg-red-50 border-t border-red-100 px-4 py-3 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                  <span className="text-sm font-bold text-red-600 flex-1">Grabando... {formatTiempo(tiempoGrabacion)}</span>
                  <button onClick={detenerGrabacion} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600">
                    <Square size={12} /> Detener
                  </button>
                </div>
              )}

              {/* Input */}
              <div className={`border-t px-4 py-3 ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-100'}`}>
                <div className="flex items-end gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={subiendo || grabando}
                    className="w-9 h-9 flex-shrink-0 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors disabled:opacity-40">
                    {subiendo ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleArchivo} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" />
                  <div className={`flex-1 border rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all ${isDark ? 'bg-[#1c2128] border-[#30363d]' : 'bg-slate-50 border-slate-200'}`}>
                    <textarea ref={textareaRef} value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder={`Escribe a ${seleccionado.full_name.split(' ')[0]}…`}
                      rows={1} disabled={grabando}
                      className="w-full bg-transparent text-sm text-slate-800 resize-none focus:outline-none placeholder:text-slate-400 max-h-32 disabled:opacity-50"
                      style={{ lineHeight: '1.5' }} />
                  </div>
                  <button onMouseDown={iniciarGrabacion} onMouseUp={detenerGrabacion} onTouchStart={handleMicTouch}
                    disabled={subiendo || !!audioUrl}
                    className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all disabled:opacity-40 ${grabando ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                    title={grabando ? 'Toca para detener' : 'Mantén (PC) o toca (móvil) para grabar'}>
                    {grabando ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  {texto.trim() && (
                    <button onClick={enviar} disabled={enviando}
                      className="w-9 h-9 flex-shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white flex items-center justify-center transition-all shadow-sm shadow-blue-200">
                      {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
                  Shift+Enter nueva línea · Mantén 🎤 para grabar · Clic derecho en mensaje para más opciones
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Sub-componente para item de contacto ─────────────────────────────────────
function ContactoItem({ c, seleccionado, onClick }: { c: Contacto; seleccionado: Contacto | null; onClick: () => void }) {
  const { isDark } = useTheme()
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b transition-colors relative
        ${isDark ? 'border-[#21262d]' : 'border-slate-100/70'}
        ${seleccionado?.id === c.id
          ? isDark ? 'bg-blue-900/25 border-l-[3px] border-l-blue-500' : 'bg-blue-50 border-l-[3px] border-l-blue-500'
          : isDark ? 'hover:bg-[#21262d]' : 'hover:bg-white/80'
        }`}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar name={c.full_name} avatarUrl={c.avatar_url} size="sm" />
          {c.unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
              {c.unread > 9 ? '9+' : c.unread}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${c.unread > 0 ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{c.full_name}</p>
          <p className={`text-[10px] truncate mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{c.specialty || roleLabel(c.role)}</p>
          {c.lastMessage && (
            <p className={`text-[10px] truncate mt-0.5 ${c.unread > 0 ? (isDark ? 'text-slate-300 font-semibold' : 'text-slate-600 font-semibold') : (isDark ? 'text-slate-600' : 'text-slate-400')}`}>{c.lastMessage}</p>
          )}
        </div>
        {c.lastTime && <span className={`text-[9px] flex-shrink-0 mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{new Date(c.lastTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
      </div>
    </button>
  )
}
