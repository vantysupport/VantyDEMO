'use client'
// app/padre/components/ChatFamilias.tsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, MessageCircle, CheckCheck, Check, Users, Mic, MicOff, Paperclip, X, FileAudio, File as FileIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Msg {
  id: string; content: string; sender_id: string; sender_role: string
  sender_name: string; read_by: string[]; created_at: string
  sender_avatar?: string
  message_type?: 'text' | 'audio' | 'image' | 'document'
  file_url?: string; file_name?: string; file_size?: number
}
interface Props { childId: string; childName: string; profile: any }

const ROLE_CFG: Record<string, { label: string; color: string; bg: string; grad: string }> = {
  jefe:         { label: 'Director(a)',  color: '#0284c7', bg: '#f5f3ff', grad: 'linear-gradient(135deg,#0284c7,#0369a1)' },
  admin:        { label: 'Admin',        color: '#0284c7', bg: '#eff6ff', grad: 'linear-gradient(135deg,#0284c7,#0369a1)' },
  especialista: { label: 'Terapeuta ABA',color: '#059669', bg: '#f0fdf4', grad: 'linear-gradient(135deg,#059669,#047857)' },
  terapeuta:    { label: 'Terapeuta ABA',color: '#059669', bg: '#f0fdf4', grad: 'linear-gradient(135deg,#059669,#047857)' },
  secretaria:   { label: 'Secretaría',   color: '#d97706', bg: '#fffbeb', grad: 'linear-gradient(135deg,#d97706,#b45309)' },
  padre:        { label: 'Tú',           color: '#0284c7', bg: '#eff6ff', grad: 'linear-gradient(135deg,#0284c7,#0369a1)' },
}

function formatTime(iso: string) {
  const d = new Date(iso), now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}
function isNewDay(curr: string, prev?: string) {
  if (!prev) return true
  return new Date(curr).toDateString() !== new Date(prev).toDateString()
}

function DayDivider({ date }: { date: string }) {
  const d = new Date(date), now = new Date()
  const label = d.toDateString() === now.toDateString()
    ? 'Hoy'
    : d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--c-border)' }}/>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap',
        padding: '3px 12px', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 20 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#e5e7eb' }}/>
    </div>
  )
}

function SenderAvatar({ name, role, avatarUrl }: { name: string; role: string; avatarUrl?: string }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.admin
  return avatarUrl ? (
    <img src={avatarUrl} alt={name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${cfg.color}30` }}/>
  ) : (
    <div style={{ width: 34, height: 34, borderRadius: '50%', background: cfg.grad,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}

export default function ChatFamilias({ childId, childName, profile }: Props) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecRef  = useRef<MediaRecorder | null>(null)
  const audioChunks  = useRef<Blob[]>([])
  const [recording, setRecording]     = useState(false)
  const [recordSecs, setRecordSecs]   = useState(0)
  const [audioBlob, setAudioBlob]     = useState<Blob | null>(null)
  const [attachFile, setAttachFile]   = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<any>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  const userId   = profile?.id || ''
  const userName = profile?.full_name || 'Familia'

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const loadMessages = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    try {
      const res  = await fetch(`/api/chat-familias?child_id=${childId}&user_id=${userId}`)
      const json = await res.json()
      if (json.data) { setMessages(json.data); scrollToBottom() }
    } finally { setLoading(false) }
  }, [childId, userId, scrollToBottom])

  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    const markRead = () => {
      if (!childId || !userId) return
      fetch('/api/chat-familias', { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, user_id: userId }) }).catch(() => {})
    }
    window.addEventListener('focus', markRead); markRead()
    return () => window.removeEventListener('focus', markRead)
  }, [childId, userId])

  useEffect(() => {
    if (!childId) return
    channelRef.current = supabase
      .channel(`chat_familias_${childId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias', filter: `child_id=eq.${childId}` },
        (payload) => {
          const newMsg = payload.new as Msg
          setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
          scrollToBottom()
          if (newMsg.sender_id !== userId)
            fetch('/api/chat-familias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ child_id: childId, user_id: userId }) }).catch(() => {})
        })
      .subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [childId, userId, scrollToBottom])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRecRef.current = mr
      audioChunks.current = []
      mr.ondataavailable = e => audioChunks.current.push(e.data)
      mr.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      setRecording(true)
      setRecordSecs(0)
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch { alert('No se pudo acceder al micrófono') }
  }

  const stopRecording = () => {
    mediaRecRef.current?.stop()
    setRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const cancelRecording = () => {
    mediaRecRef.current?.stop()
    setRecording(false)
    setAudioBlob(null)
    audioChunks.current = []
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const uploadAndSend = async (file: File | Blob, type: 'audio' | 'file', fileName?: string) => {
    setUploading(true)
    try {
      const ext  = type === 'audio' ? 'webm' : (fileName?.split('.').pop() || 'bin')
      const name = `${Date.now()}.${ext}`
      const path = `chat-familias/${childId}/${name}`
      const { error } = await supabase.storage.from('store-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('store-images').getPublicUrl(path)
      const url = data.publicUrl
      // Formato estructurado (message_type + file_url) para que todos los
      // paneles rendericen reproductor/imagen en vez de la URL cruda.
      const isImage = type === 'file' && /\.(png|jpe?g|gif|webp|avif)$/i.test(fileName || '')
      const msgType = type === 'audio' ? 'audio' : isImage ? 'image' : 'document'
      const content = type === 'audio' ? '🎤 Mensaje de voz' : isImage ? '📷 Imagen' : `📎 ${fileName || 'Documento'}`
      const res = await fetch('/api/chat-familias', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          child_id: childId, content, sender_id: userId, sender_role: 'padre', sender_name: userName,
          message_type: msgType, file_url: url, file_name: fileName || name, file_size: (file as any).size ?? null,
        }) })
      const json = await res.json().catch(() => null)
      if (json?.data) {
        const newMsg = json.data as Msg
        setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      }
      setAudioBlob(null); setAttachFile(null)
      scrollToBottom()
    } catch (e: any) { alert('Error al enviar: ' + e.message) }
    finally { setUploading(false) }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending || !childId) return
    setSending(true); setInput('')
    try {
      const res = await fetch('/api/chat-familias', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, content: text, sender_id: userId, sender_role: 'padre', sender_name: userName }) })
      const json = await res.json().catch(() => null)
      // Optimistic update — agregar al estado local sin esperar realtime (que puede no estar habilitado)
      if (json?.data) {
        const newMsg = json.data as Msg
        setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      }
      scrollToBottom()
    } finally { setSending(false); inputRef.current?.focus() }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-card)',
      overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--c-card)', flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#0284c7', flexShrink: 0, border: '2px solid #bfdbfe' }}>
          {childName?.[0]?.toUpperCase() || 'E'}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--c-text-primary)', margin: 0 }}>Equipo de {childName}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Users size={10} color="#94a3b8"/>
            <p style={{ fontSize: 11, color: 'var(--c-text-muted)', margin: 0 }}>Chat privado · Admin + Terapeutas</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', padding: '4px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669' }}>En línea</span>
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--c-surface)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Loader2 size={22} style={{ color: '#94a3b8', animation: 'cfspin 1s linear infinite' }}/>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, background: '#eff6ff', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #bfdbfe' }}>
              <MessageCircle size={26} color="#0284c7"/>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--c-text-primary)', margin: '0 0 6px' }}>¡Escríbenos!</p>
              <p style={{ fontSize: 12, color: 'var(--c-text-muted)', maxWidth: 240, margin: 0, lineHeight: 1.6 }}>
                Este chat es privado entre tu familia y el equipo del centro.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['📅 Consultar cita', '📊 Pedir reporte', '❓ Tengo una duda'].map(s => (
                <button key={s} onClick={() => setInput(s)}
                  style={{ padding: '7px 14px', background: 'var(--c-card)', border: '1.5px solid var(--c-border)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--c-text-secondary)', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isMe     = msg.sender_id === userId
              const cfg      = ROLE_CFG[msg.sender_role] || ROLE_CFG.admin
              const showDay  = isNewDay(msg.created_at, messages[i - 1]?.created_at)
              const isRead   = msg.read_by?.length > 1
              const showName = !isMe && (i === 0 || messages[i-1]?.sender_id !== msg.sender_id)
              const showAvatar = !isMe && (i === messages.length - 1 || messages[i+1]?.sender_id !== msg.sender_id)

              return (
                <div key={msg.id} style={{ marginBottom: 2 }}>
                  {showDay && <DayDivider date={msg.created_at}/>}

                  {/* Sender name + role */}
                  {showName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, marginTop: 10, paddingLeft: 46 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{msg.sender_name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, background: cfg.bg, color: cfg.color, padding: '1px 8px', borderRadius: 20, border: `1px solid ${cfg.color}40` }}>{cfg.label}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
                    {/* Avatar for received messages */}
                    {!isMe && (
                      showAvatar
                        ? <SenderAvatar name={msg.sender_name} role={msg.sender_role} avatarUrl={msg.sender_avatar}/>
                        : <div style={{ width: 34, flexShrink: 0 }}/>
                    )}

                    <div style={{
                      maxWidth: '68%', padding: '9px 13px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe ? 'linear-gradient(135deg,#0284c7,#0369a1)' : 'var(--c-card)',
                      color: isMe ? '#fff' : 'var(--c-text-primary)',
                      fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word',
                      border: isMe ? 'none' : '1px solid var(--c-border)',
                      boxShadow: isMe ? '0 2px 12px rgba(2,132,199,.25)' : '0 1px 4px rgba(0,0,0,.06)',
                    }}>
                      {msg.message_type === 'audio' && msg.file_url ? (
                        <audio controls src={msg.file_url} style={{ maxWidth:'210px', height:36 }}/>
                      ) : msg.message_type === 'image' && msg.file_url ? (
                        <img src={msg.file_url} alt={msg.file_name || 'imagen'}
                          style={{ width:'100%', maxWidth:220, borderRadius:10, display:'block', cursor:'pointer' }}
                          onClick={() => window.open(msg.file_url, '_blank')} />
                      ) : msg.message_type === 'document' && msg.file_url ? (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ color: isMe ? '#bfdbfe' : '#0284c7', fontSize:12, display:'flex', alignItems:'center', gap:6 }}><FileIcon size={13}/>{msg.file_name || 'Documento'}</a>
                      ) : msg.content.startsWith('🎤 [Audio] ') ? (
                        <audio controls src={msg.content.replace('🎤 [Audio] ','')} style={{ maxWidth:'200px', height:32 }}/>
                      ) : msg.content.startsWith('📎 [') ? (() => {
                        const m = msg.content.match(/^📎 \[(.+?)\] (.+)$/)
                        if (!m) return <p style={{ margin:0 }}>{msg.content}</p>
                        if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(m[2])) return (
                          <img src={m[2]} alt={m[1]}
                            style={{ width:'100%', maxWidth:220, borderRadius:10, display:'block', cursor:'pointer' }}
                            onClick={() => window.open(m[2], '_blank')} />
                        )
                        return <a href={m[2]} target="_blank" rel="noopener noreferrer" style={{ color: isMe ? '#bfdbfe' : '#0284c7', fontSize:12, display:'flex', alignItems:'center', gap:6 }}><FileIcon size={13}/>{m[1]}</a>
                      })() : (
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 10, opacity: isMe ? .7 : undefined, color: isMe ? '#fff' : 'var(--c-text-muted)' }}>{formatTime(msg.created_at)}</span>
                        {isMe && (isRead
                          ? <CheckCheck size={12} style={{ color: '#93c5fd' }}/>
                          : <Check size={12} style={{ color: 'rgba(255,255,255,.6)' }}/>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </>
        )}
      </div>

      {/* ── INPUT ── */}
      <input ref={fileInputRef} type="file" style={{ display:'none' }} accept="image/*,application/pdf,.doc,.docx,.txt"
        onChange={e => { const f = e.target.files?.[0]; if (f) setAttachFile(f); e.target.value = '' }}/>

      <div style={{ padding: '10px 14px 12px', borderTop: '1px solid var(--c-border)', background: 'var(--c-card)', flexShrink: 0 }}>

        {/* Preview: audio or file */}
        {(audioBlob || attachFile) && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', marginBottom:8, background:'var(--c-surface)', borderRadius:12, border:'1px solid var(--c-border)' }}>
            {audioBlob
              ? <><FileAudio size={16} color="#0284c7"/><span style={{ flex:1, fontSize:12, color:'var(--c-text-secondary)' }}>Audio listo para enviar</span></>
              : <><FileIcon size={16} color="#0284c7"/><span style={{ flex:1, fontSize:12, color:'var(--c-text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{attachFile?.name}</span></>
            }
            <button onClick={cancelRecording} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
              <X size={14} color="var(--c-text-muted)"/>
            </button>
          </div>
        )}

        {/* Recording indicator */}
        {recording && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', marginBottom:8, background:'rgba(239,68,68,0.1)', borderRadius:12, border:'1px solid rgba(239,68,68,0.25)' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', animation:'cfspin 1s ease infinite' }}/>
            <span style={{ flex:1, fontSize:12, fontWeight:700, color:'#ef4444' }}>Grabando... {recordSecs}s</span>
            <button onClick={stopRecording} style={{ fontSize:11, fontWeight:700, color:'#0284c7', background:'var(--c-card)', border:'1px solid var(--c-border)', borderRadius:8, padding:'4px 10px', cursor:'pointer' }}>
              Detener
            </button>
            <button onClick={cancelRecording} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
              <X size={14} color="var(--c-text-muted)"/>
            </button>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'flex-end', gap:6, background:'var(--c-surface)', borderRadius:18, padding:'8px 8px 8px 6px', border:'1.5px solid var(--c-border)' }}>
          {/* Attach file */}
          <button onClick={() => fileInputRef.current?.click()}
            style={{ width:34, height:34, borderRadius:10, border:'none', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:'var(--c-text-muted)' }}>
            <Paperclip size={17}/>
          </button>

          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje al equipo..." rows={1}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--c-text-primary)', resize:'none', maxHeight:100, lineHeight:1.5, fontFamily:'inherit', paddingTop:2 }}
            onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height='auto'; t.style.height=Math.min(t.scrollHeight,100)+'px' }}
          />

          {/* Mic button */}
          {!input.trim() && !audioBlob && !attachFile && (
            <button onClick={recording ? stopRecording : startRecording}
              style={{ width:34, height:34, borderRadius:10, border:'none', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
                background: recording ? 'rgba(239,68,68,0.15)' : 'transparent', color: recording ? '#ef4444' : 'var(--c-text-muted)' }}>
              {recording ? <MicOff size={17}/> : <Mic size={17}/>}
            </button>
          )}

          {/* Send button */}
          {(input.trim() || audioBlob || attachFile) && (
            <button
              onClick={() => {
                if (audioBlob) uploadAndSend(audioBlob, 'audio')
                else if (attachFile) uploadAndSend(attachFile, 'file', attachFile.name)
                else sendMessage()
              }}
              disabled={sending || uploading}
              style={{ width:36, height:36, borderRadius:12, border:'none', cursor:'pointer', flexShrink:0,
                background:'linear-gradient(135deg,#0284c7,#0369a1)', display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 2px 8px rgba(2,132,199,.3)' }}>
              {(sending || uploading)
                ? <Loader2 size={16} color="#fff" style={{ animation:'cfspin 1s linear infinite' }}/>
                : <Send size={16} color="#fff"/>
              }
            </button>
          )}
        </div>
        <p style={{ fontSize:10, color:'var(--c-text-muted)', textAlign:'center', margin:'5px 0 0' }}>
          Enter para enviar · Shift+Enter nueva línea · 🎤 mantén para grabar
        </p>
      </div>

      <style>{`@keyframes cfspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
