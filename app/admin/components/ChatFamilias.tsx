'use client'
// app/admin/components/ChatFamilias.tsx
// Chat familias con soporte completo: texto, imágenes, documentos y audio

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle, Send, Loader2, Search, Users, CheckCheck, Check,
  ChevronLeft, Paperclip, Mic, Image, FileText, X,
  Play, Pause, Download, StopCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Msg {
  id: string; content: string; sender_id: string; sender_role: string
  sender_name: string; sender_avatar?: string | null; read_by: string[]; created_at: string
  message_type?: 'text' | 'image' | 'audio' | 'document'
  file_url?: string; file_name?: string; file_size?: number
}
interface Family {
  child_id: string; child_name: string; lastMsg: string
  lastTime: string; unread: number; lastSender: string
}
interface Props { profile?: any; userId?: string; userName?: string; isDark?: boolean }

const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  jefe:         { label: 'Dirección',   color: '#0284c7', bg: '#f0f9ff' },
  admin:        { label: 'Admin',       color: '#0284c7', bg: '#eff6ff' },
  especialista: { label: 'Terapeuta',   color: '#059669', bg: '#f0fdf4' },
  terapeuta:    { label: 'Terapeuta',   color: '#059669', bg: '#f0fdf4' },
  secretaria:   { label: 'Secretaría',  color: '#d97706', bg: '#fffbeb' },
  padre:        { label: 'Familia',     color: '#64748b', bg: '#f8fafc' },
}

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}
function isNewDay(curr: string, prev?: string) {
  if (!prev) return true
  return new Date(curr).toDateString() !== new Date(prev).toDateString()
}
function formatDuration(sec: number) {
  return `${Math.floor(sec/60).toString().padStart(2,'0')}:${Math.floor(sec%60).toString().padStart(2,'0')}`
}
function formatFileSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}
function getFileIcon(name?: string) {
  const ext = name?.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return '📄'
  if (['doc','docx'].includes(ext)) return '📝'
  if (['xls','xlsx'].includes(ext)) return '📊'
  if (['zip','rar'].includes(ext)) return '🗜️'
  return '📎'
}

function DayDivider({ date }: { date: string }) {
  const d = new Date(date)
  const label = d.toDateString() === new Date().toDateString() ? 'Hoy'
    : d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--card-border,#e5e7eb)' }}/>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap',
        padding: '3px 12px', background: 'var(--card,#fff)', border: '1px solid var(--card-border,#e5e7eb)', borderRadius: 20 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--card-border,#e5e7eb)' }}/>
    </div>
  )
}

function AudioPlayer({ url, isMe }: { url: string; isMe: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onT = () => setCurrent(a.currentTime)
    const onL = () => setDuration(a.duration)
    const onE = () => { setPlaying(false); setCurrent(0) }
    a.addEventListener('timeupdate', onT); a.addEventListener('loadedmetadata', onL); a.addEventListener('ended', onE)
    return () => { a.removeEventListener('timeupdate', onT); a.removeEventListener('loadedmetadata', onL); a.removeEventListener('ended', onE) }
  }, [])
  const toggle = () => {
    const a = audioRef.current; if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { a.play(); setPlaying(true) }
  }
  const progress = duration ? (current / duration) * 100 : 0
  const fill   = isMe ? '#fff' : '#0284c7'
  const track  = isMe ? 'rgba(255,255,255,0.25)' : '#e2e8f0'
  const btnBg  = isMe ? 'rgba(255,255,255,0.2)' : '#eff6ff'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none',
        background: btnBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: isMe ? '#fff' : '#0284c7' }}>
        {playing ? <Pause size={16}/> : <Play size={16}/>}
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, background: track, borderRadius: 4, cursor: 'pointer', marginBottom: 6 }}
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); if (audioRef.current) audioRef.current.currentTime = ((e.clientX-r.left)/r.width)*duration }}>
          <div style={{ width: `${progress}%`, height: '100%', background: fill, borderRadius: 4 }}/>
        </div>
        <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 18, marginBottom: 4 }}>
          {[4,6,10,8,14,12,16,10,8,12,16,14,10,8,6,10,14,12,8,16,10,8,12,14,8,10,6,4].map((h,i) => (
            <div key={i} style={{ width: 2, height: h, borderRadius: 2, background: (i/28)*100<progress ? fill : track }}/>
          ))}
        </div>
        <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)' }}>
          {formatDuration(playing ? current : (duration || 0))}
        </span>
      </div>
    </div>
  )
}

function MsgContent({ msg, isMe }: { msg: Msg; isMe: boolean }) {
  if (msg.message_type === 'image' && msg.file_url) return (
    <div>
      <img src={msg.file_url} alt="imagen"
        style={{ width: '100%', maxWidth: 220, borderRadius: 10, display: 'block', cursor: 'pointer' }}
        onClick={() => window.open(msg.file_url, '_blank')} />
      {msg.content && msg.content !== '📷 Imagen' && (
        <p style={{ margin: '6px 2px 0', fontSize: 13, whiteSpace: 'pre-wrap', color: isMe ? '#fff' : 'var(--text-primary)' }}>{msg.content}</p>
      )}
    </div>
  )
  if (msg.message_type === 'audio' && msg.file_url) return <AudioPlayer url={msg.file_url} isMe={isMe} />
  if (msg.message_type === 'document' && msg.file_url) return (
    <a href={msg.file_url} target="_blank" rel="noreferrer" download={msg.file_name}
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none',
        background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--muted-bg,#f8fafc)',
        border: isMe ? 'none' : '1px solid var(--card-border,#e2e8f0)',
        borderRadius: 12, padding: '10px 14px', minWidth: 190 }}>
      <span style={{ fontSize: 28 }}>{getFileIcon(msg.file_name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isMe ? '#fff' : 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
          {msg.file_name || 'Documento'}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: isMe ? 'rgba(255,255,255,.65)' : 'var(--text-muted)' }}>
          {formatFileSize(msg.file_size)} · Toca para abrir
        </p>
      </div>
      <Download size={14} color={isMe ? 'rgba(255,255,255,.75)' : 'var(--text-muted,#94a3b8)'}/>
    </a>
  )
  return <p style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6 }}>{msg.content}</p>
}

export default function ChatFamilias({ profile, userId: _userId, userName: _userName, isDark: _isDark }: Props) {
  const [families, setFamilies]       = useState<Family[]>([])
  const [selected, setSelected]       = useState<Family | null>(null)
  const [messages, setMessages]       = useState<Msg[]>([])
  const [input, setInput]             = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [sending, setSending]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [search, setSearch]           = useState('')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [showAttach, setShowAttach]   = useState(false)
  const [recording, setRecording]     = useState(false)
  const [recSeconds, setRecSeconds]   = useState(0)

  const fileInputRef    = useRef<HTMLInputElement>(null)
  const imageInputRef   = useRef<HTMLInputElement>(null)
  const mediaRecRef     = useRef<MediaRecorder | null>(null)
  const audioChunksRef  = useRef<Blob[]>([])
  const recTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef       = useRef<HTMLDivElement>(null)
  const channelRef      = useRef<any>(null)
  const inputRef        = useRef<HTMLTextAreaElement>(null)

  const userId   = _userId   || profile?.id        || ''
  const userName = _userName || profile?.full_name  || profile?.name || 'Equipo'
  const userRole = profile?.role || 'admin'
  const isDark   = _isDark ?? false

  const bg          = isDark ? '#0d1117'  : 'var(--card,#fff)'
  const borderColor = isDark ? '#21262d'  : 'var(--card-border,#e2e8f0)'
  const mutedBg     = isDark ? '#161b22'  : 'var(--muted-bg,#f8fafc)'
  const textPrimary = isDark ? '#e6edf3'  : 'var(--text-primary,#0f172a)'
  const textMuted   = isDark ? '#7d8590'  : 'var(--text-muted,#94a3b8)'

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const loadFamilies = useCallback(async () => {
    setLoadingList(true)
    try {
      const { data } = await supabase
        .from('chat_familias')
        .select('child_id, content, message_type, sender_name, sender_id, sender_role, read_by, created_at, children(name)')
        .order('created_at', { ascending: false }).limit(300)
      if (!data) return
      const map: Record<string, any> = {}
      data.forEach((m: any) => {
        if (!map[m.child_id]) {
          let preview = m.content
          if (m.message_type === 'image')    preview = '📷 Imagen'
          if (m.message_type === 'audio')    preview = '🎤 Audio'
          if (m.message_type === 'document') preview = '📎 Documento'
          map[m.child_id] = { child_id: m.child_id, child_name: (m.children as any)?.name || 'Familia',
            lastMsg: preview, lastTime: m.created_at, lastSender: m.sender_name, unread: 0 }
        }
        if (m.sender_role === 'padre' && !m.read_by?.includes(userId)) map[m.child_id].unread++
      })
      const { data: children } = await supabase.from('children').select('id, name').eq('is_active', true).order('name')
      children?.forEach((c: any) => { if (!map[c.id]) map[c.id] = { child_id: c.id, child_name: c.name, lastMsg: '', lastTime: '', lastSender: '', unread: 0 } })
      setFamilies(Object.values(map).sort((a: any, b: any) => b.unread !== a.unread ? b.unread - a.unread : b.lastTime.localeCompare(a.lastTime)))
    } finally { setLoadingList(false) }
  }, [userId])

  useEffect(() => { loadFamilies() }, [loadFamilies])
  useEffect(() => {
    const ch = supabase.channel('cf_list_v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias' }, () => loadFamilies())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadFamilies])

  const loadMessages = useCallback(async (childId: string) => {
    setLoadingMsgs(true)
    try {
      const res = await fetch(`/api/chat-familias?child_id=${childId}&user_id=${userId}`)
      const json = await res.json()
      if (json.data) { setMessages(json.data); scrollToBottom() }
      await fetch('/api/chat-familias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: childId, user_id: userId }) })
      setFamilies(prev => prev.map(f => f.child_id === childId ? { ...f, unread: 0 } : f))
    } finally { setLoadingMsgs(false) }
  }, [userId, scrollToBottom])

  const selectFamily = (f: Family) => {
    setSelected(f); setMessages([]); setMobileShowChat(true)
    setAttachedFile(null); setShowAttach(false)
    loadMessages(f.child_id)
  }

  useEffect(() => {
    if (!selected) return
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel(`cf_msgs_v3_${selected.child_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_familias',
        filter: `child_id=eq.${selected.child_id}` }, (payload) => {
          const m = payload.new as Msg
          setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
          scrollToBottom()
          if (m.sender_id !== userId) {
            fetch('/api/chat-familias', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ child_id: selected.child_id, user_id: userId }) }).catch(() => {})
            setFamilies(prev => prev.map(f => f.child_id === selected.child_id
              ? { ...f, unread: 0, lastMsg: m.content, lastTime: m.created_at, lastSender: m.sender_name } : f))
          }
        }).subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [selected, userId, scrollToBottom])

  const uploadFile = async (file: File) => {
    const fd = new FormData(); fd.append('file', file); fd.append('child_id', selected!.child_id)
    const res = await fetch('/api/chat-familias/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Error al subir')
    return { url: json.url as string, fileName: json.fileName as string, fileSize: json.fileSize as number }
  }

  const sendMessage = async (opts?: { text?: string; type?: string; fileUrl?: string; fileName?: string; fileSize?: number }) => {
    const text = opts?.text ?? input.trim()
    if (!text && !attachedFile && !opts?.fileUrl) return
    if (sending || !selected) return
    setSending(true); const prevInput = input; setInput('')
    try {
      let fileUrl = opts?.fileUrl, fileName = opts?.fileName, fileSize = opts?.fileSize, msgType = opts?.type || 'text'
      if (attachedFile && !fileUrl) {
        setUploading(true)
        const up = await uploadFile(attachedFile); setUploading(false)
        fileUrl = up.url; fileName = up.fileName; fileSize = up.fileSize
        msgType = attachedFile.type.startsWith('image/') ? 'image' : 'document'
        setAttachedFile(null)
      }
      const content = text || (msgType==='image' ? '📷 Imagen' : msgType==='audio' ? '🎤 Mensaje de voz' : '📎 Documento')
      const res = await fetch('/api/chat-familias', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: selected.child_id, content, sender_id: userId, sender_role: userRole,
          sender_name: userName, message_type: msgType, file_url: fileUrl||null, file_name: fileName||null, file_size: fileSize||null }) })
      const json = await res.json().catch(() => null)
      // Optimistic update — no depender solo del realtime
      if (json?.data) {
        const newMsg = json.data as Msg
        setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      }
      scrollToBottom()
    } catch { setInput(prevInput) }
    finally { setSending(false); setUploading(false); inputRef.current?.focus() }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(100); mediaRecRef.current = mr
      setRecording(true); setRecSeconds(0)
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000)
    } catch { alert('No se pudo acceder al micrófono. Verifica los permisos del navegador.') }
  }

  const stopRecording = async (cancel = false) => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null }
    setRecording(false); setRecSeconds(0)
    const mr = mediaRecRef.current; if (!mr) return
    mr.stream.getTracks().forEach(t => t.stop())
    if (cancel) { mr.stop(); audioChunksRef.current = []; return }
    await new Promise<void>(resolve => { mr.onstop = () => resolve(); mr.stop() })
    if (!audioChunksRef.current.length) return
    const mimeType = mr.mimeType || 'audio/webm'
    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    const ext  = mimeType.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `voz_${Date.now()}.${ext}`, { type: mimeType })
    setUploading(true); setSending(true)
    try {
      const up = await uploadFile(file)
      const res = await fetch('/api/chat-familias', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ child_id: selected!.child_id, content: '🎤 Mensaje de voz', sender_id: userId,
          sender_role: userRole, sender_name: userName, message_type: 'audio',
          file_url: up.url, file_name: up.fileName, file_size: up.fileSize }) })
      const json = await res.json().catch(() => null)
      if (json?.data) {
        const newMsg = json.data as Msg
        setMessages(prev => prev.find(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
      }
      scrollToBottom()
    } catch { } finally { setUploading(false); setSending(false) }
  }

  const handleMicTouch = (e: React.TouchEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (recording) stopRecording(false); else startRecording()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) { setAttachedFile(file); setShowAttach(false) }
    e.target.value = ''
  }

  const filtered = families.filter(f => f.child_name.toLowerCase().includes(search.toLowerCase()))
  const canSend  = !!(input.trim() || attachedFile)

  return (
    <div style={{ display: 'flex', height: '100%', background: bg, borderRadius: 20,
      border: `1px solid ${borderColor}`, overflow: 'hidden' }}>

      {/* LISTA */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${borderColor}`, flexDirection: 'column' }}
        className={`${mobileShowChat ? 'hidden' : 'flex'} lg:flex`}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${borderColor}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Users size={16} style={{ color: textMuted }}/>
            <p style={{ fontWeight: 800, fontSize: 13, color: textPrimary, margin: 0 }}>Familias</p>
            {families.some(f => f.unread > 0) && (
              <span style={{ marginLeft: 'auto', background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                {families.filter(f => f.unread > 0).length} sin leer
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: mutedBg, borderRadius: 10, padding: '7px 10px', border: `1px solid ${borderColor}` }}>
            <Search size={13} style={{ color: textMuted, flexShrink: 0 }}/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar familia..."
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: textPrimary }}/>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 size={18} style={{ color: textMuted, animation: 'cf3spin 1s linear infinite' }}/>
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 12, color: textMuted, padding: 20 }}>Sin familias</p>
          ) : filtered.map(f => (
            <button key={f.child_id} onClick={() => selectFamily(f)}
              style={{ width: '100%', textAlign: 'left', padding: '11px 16px',
                background: selected?.child_id === f.child_id ? (isDark ? '#1c2128' : '#f0f9ff') : 'transparent',
                border: 'none', borderBottom: `1px solid ${borderColor}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#0284c7', flexShrink: 0,
                border: f.unread > 0 ? '2px solid #0284c7' : '2px solid transparent' }}>
                {f.child_name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontWeight: f.unread > 0 ? 800 : 600, fontSize: 13, color: textPrimary, margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.child_name}</p>
                  {f.lastTime && <span style={{ fontSize: 10, color: textMuted, flexShrink: 0, marginLeft: 4 }}>{formatTime(f.lastTime)}</span>}
                </div>
                {f.lastMsg && <p style={{ fontSize: 11, color: f.unread > 0 ? textPrimary : textMuted, margin: '1px 0 0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: f.unread > 0 ? 600 : 400 }}>
                  {f.lastSender ? `${f.lastSender.split(' ')[0]}: ` : ''}{f.lastMsg}
                </p>}
              </div>
              {f.unread > 0 && <span style={{ background: '#0284c7', color: '#fff', fontSize: 10, fontWeight: 800,
                width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {f.unread > 9 ? '9+' : f.unread}
              </span>}
            </button>
          ))}
        </div>
      </div>

      {/* CHAT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{ width: 60, height: 60, background: mutedBg, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={28} style={{ color: textMuted }}/>
            </div>
            <p style={{ fontWeight: 700, fontSize: 14, color: textPrimary, margin: 0 }}>Selecciona una familia</p>
            <p style={{ fontSize: 12, color: textMuted, margin: 0 }}>Elige una familia de la lista para ver su chat</p>
          </div>
        ) : (<>
          {/* Header */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: bg }}>
            <button onClick={() => { setMobileShowChat(false); setSelected(null) }} className="lg:hidden"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: textMuted, display: 'flex' }}>
              <ChevronLeft size={20}/>
            </button>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#0284c7', flexShrink: 0 }}>
              {selected.child_name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: textPrimary, margin: 0 }}>Familia de {selected.child_name}</p>
              <p style={{ fontSize: 11, color: textMuted, margin: '1px 0 0' }}>Chat privado · Padre + Admin + Terapeutas</p>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 2, background: mutedBg }}>
            {loadingMsgs ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Loader2 size={20} style={{ color: textMuted, animation: 'cf3spin 1s linear infinite' }}/>
              </div>
            ) : messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
                <MessageCircle size={28} style={{ color: textMuted }}/>
                <p style={{ fontSize: 13, color: textMuted, margin: 0 }}>Sin mensajes aún. ¡Inicia la conversación!</p>
              </div>
            ) : messages.map((msg, i) => {
              const isMe    = msg.sender_id === userId
              const cfg     = ROLE_CFG[msg.sender_role] || ROLE_CFG.admin
              const showDay = isNewDay(msg.created_at, messages[i-1]?.created_at)
              const isRead  = msg.read_by?.length > 1
              const isMedia = msg.message_type === 'image'
              return (
                <div key={msg.id}>
                  {showDay && <DayDivider date={msg.created_at}/>}
                  {!isMe && (i===0 || messages[i-1]?.sender_id !== msg.sender_id) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, marginTop: 8, paddingLeft: 42 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{msg.sender_name}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, background: cfg.bg, color: cfg.color,
                        padding: '1px 7px', borderRadius: 20, border: `1px solid ${cfg.color}25` }}>{cfg.label}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 2 }}>
                    {!isMe && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        border: `2px solid ${cfg.color}40`, background: cfg.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 2 }}>
                        {msg.sender_avatar
                          ? <img src={msg.sender_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color }}>{msg.sender_name?.[0]?.toUpperCase()||'?'}</span>}
                      </div>
                    )}
                    <div style={{ maxWidth: isMedia ? 250 : '68%', padding: isMedia ? '5px 5px 0' : '9px 13px',
                      borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMe ? 'linear-gradient(135deg,#0284c7,#0369a1)' : (isDark ? '#1c2128' : '#fff'),
                      color: isMe ? '#fff' : textPrimary,
                      border: isMe ? 'none' : `1px solid ${borderColor}`,
                      boxShadow: isMe ? '0 2px 10px rgba(37,99,235,.2)' : '0 1px 3px rgba(0,0,0,.05)',
                      overflow: 'hidden' }}>
                      <MsgContent msg={msg} isMe={isMe}/>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                        marginTop: 4, padding: isMedia ? '0 6px 4px' : '0' }}>
                        <span style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,.7)' : textMuted }}>
                          {formatTime(msg.created_at)}
                        </span>
                        {isMe && (isRead
                          ? <CheckCheck size={11} style={{ color: '#93c5fd' }}/>
                          : <Check size={11} style={{ color: 'rgba(255,255,255,.6)' }}/>
                        )}
                      </div>
                    </div>
                    {isMe && (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                        border: '2px solid rgba(37,99,235,.3)', background: '#eff6ff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 2 }}>
                        {msg.sender_avatar
                          ? <img src={msg.sender_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : <span style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>{msg.sender_name?.[0]?.toUpperCase()||'?'}</span>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </div>

          {/* INPUT AREA */}
          <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${borderColor}`, flexShrink: 0, background: bg }}>

            {/* File preview */}
            {attachedFile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: isDark ? '#1c2128' : '#f0f9ff',
                border: `1.5px solid ${isDark ? '#30363d' : '#bae6fd'}`, borderRadius: 12, marginBottom: 8 }}>
                {attachedFile.type.startsWith('image/') ? (
                  <img src={URL.createObjectURL(attachedFile)} alt=""
                    style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}/>
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: isDark ? '#21262d' : '#e0f2fe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {getFileIcon(attachedFile.name)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: textPrimary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachedFile.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: textMuted }}>{formatFileSize(attachedFile.size)}</p>
                </div>
                <button onClick={() => setAttachedFile(null)}
                  style={{ border: 'none', background: '#fee2e2', borderRadius: '50%', width: 24, height: 24,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <X size={12} color="#ef4444"/>
                </button>
              </div>
            )}

            {/* Recording bar */}
            {recording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                background: isDark ? '#1a0a0a' : '#fff5f5',
                border: `1.5px solid ${isDark ? '#7f1d1d' : '#fecaca'}`, borderRadius: 12, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', animation: 'cf3pulse 1s ease-in-out infinite' }}/>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Grabando</span>
                <span style={{ fontSize: 13, color: '#ef4444', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {formatDuration(recSeconds)}
                </span>
                <button onClick={() => stopRecording(true)}
                  style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: textMuted }}>
                  Cancelar
                </button>
              </div>
            )}

            {/* Attach menu */}
            {showAttach && !recording && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button onClick={() => { imageInputRef.current?.click(); setShowAttach(false) }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 0',
                    background: isDark ? '#1c2128' : '#eff6ff', border: `1.5px solid ${isDark ? '#30363d' : '#bfdbfe'}`,
                    borderRadius: 14, cursor: 'pointer', flex: 1 }}>
                  <Image size={22} color="#0284c7"/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7' }}>Imagen</span>
                </button>
                <button onClick={() => { fileInputRef.current?.click(); setShowAttach(false) }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 0',
                    background: isDark ? '#0d1e17' : '#f0fdf4', border: `1.5px solid ${isDark ? '#14532d' : '#bbf7d0'}`,
                    borderRadius: 14, cursor: 'pointer', flex: 1 }}>
                  <FileText size={22} color="#059669"/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>Documento</span>
                </button>
              </div>
            )}

            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              {!recording && (
                <button onClick={() => setShowAttach(v => !v)} disabled={sending || uploading} title="Adjuntar"
                  style={{ width: 36, height: 36, borderRadius: 11, border: 'none', flexShrink: 0,
                    background: showAttach ? '#0284c7' : (isDark ? '#21262d' : '#f1f5f9'),
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .2s', opacity: (sending||uploading) ? .5 : 1 }}>
                  {showAttach ? <X size={15} color="#fff"/> : <Paperclip size={15} color={textMuted}/>}
                </button>
              )}
              {!recording && (
                <div style={{ flex: 1, background: isDark ? '#21262d' : '#f8fafc', borderRadius: 18,
                  padding: '8px 8px 8px 14px', border: `1.5px solid ${borderColor}` }}>
                  <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Responder a la familia de ${selected.child_name}...`}
                    rows={1} disabled={sending}
                    style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none',
                      fontSize: 13, color: textPrimary, resize: 'none', maxHeight: 100,
                      lineHeight: 1.5, fontFamily: 'inherit' }}
                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight,100)+'px' }}
                  />
                </div>
              )}
              {recording ? (
                <button onClick={() => stopRecording(false)}
                  style={{ width: 36, height: 36, borderRadius: 11, border: 'none', flexShrink: 0,
                    background: 'linear-gradient(135deg,#ef4444,#dc2626)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'cf3glow 1.2s ease-in-out infinite' }}>
                  <StopCircle size={16} color="#fff"/>
                </button>
              ) : canSend ? (
                <button onClick={() => sendMessage()} disabled={sending || uploading}
                  style={{ width: 36, height: 36, borderRadius: 11, border: 'none', flexShrink: 0,
                    background: 'linear-gradient(135deg,#0284c7,#0369a1)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(37,99,235,.35)' }}>
                  {(sending||uploading)
                    ? <Loader2 size={15} color="#fff" style={{ animation: 'cf3spin 1s linear infinite' }}/>
                    : <Send size={15} color="#fff"/>}
                </button>
              ) : (
                <button
                  onMouseDown={startRecording}
                  onMouseUp={() => stopRecording(false)}
                  onTouchStart={handleMicTouch}
                  disabled={sending || uploading}
                  title="Mantén (PC) o toca (móvil) para grabar"
                  style={{ width: 36, height: 36, borderRadius: 11, border: 'none', flexShrink: 0,
                    background: 'linear-gradient(135deg,#0284c7,#0369a1)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(37,99,235,.3)', opacity: (sending||uploading) ? .5 : 1 }}>
                  <Mic size={15} color="#fff"/>
                </button>
              )}
            </div>

            <p style={{ fontSize: 10, color: textMuted, textAlign: 'center', margin: '6px 0 0' }}>
              {recording ? 'Suelta/toca para enviar · Cancelar para descartar'
                : canSend ? 'Enter para enviar · Shift+Enter para nueva línea'
                : '🎤 Mantén/toca para grabar · 📎 Adjuntar archivos'}
            </p>
          </div>
        </>)}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange}/>
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt,.csv" style={{ display: 'none' }} onChange={handleFileChange}/>

      <style>{`
        @keyframes cf3spin  { from{transform:rotate(0)}   to{transform:rotate(360deg)} }
        @keyframes cf3pulse { 0%,100%{opacity:1}          50%{opacity:.3} }
        @keyframes cf3glow  { 0%,100%{box-shadow:0 2px 10px rgba(239,68,68,.4)} 50%{box-shadow:0 2px 20px rgba(239,68,68,.7)} }
      `}</style>
    </div>
  )
}
