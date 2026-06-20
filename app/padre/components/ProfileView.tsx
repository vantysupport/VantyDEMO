'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import {
  ChevronRight, HelpCircle, Lock, LogOut, Mail, Phone, User,
  Check, Unlink, Loader2, CalendarDays, Shield, Star, Settings,
  Bell, MessageCircle, Heart, CheckCircle, AlertCircle, X, Camera
} from 'lucide-react'
import { InfoRow, HelpItem } from './shared'

function CalBtn({ label, icon, grad, profile, apiBase, paramKey, role='padre' }: any) {
  const toast = useToast()
  const [status, setStatus] = useState<'loading'|'connected'|'disconnected'>('loading')
  const [email, setEmail] = useState<string|null>(null)
  const [connecting, setConnecting] = useState(false)

  const check = async () => {
    if (!profile?.id) return
    try {
      const r = await fetch(`/api/${apiBase}?action=status&userId=${profile.id}`)
      const d = await r.json()
      setStatus(d.connected?'connected':'disconnected'); setEmail(d.email||null)
    } catch { setStatus('disconnected') }
  }
  useEffect(()=>{
    check()
    const p = new URLSearchParams(window.location.search)
    const v = p.get(paramKey)
    if (v==='connected') { toast.success(`${label} conectado.`); check(); window.history.replaceState({},'',window.location.pathname) }
    else if (v==='error') { toast.error(`Error al conectar ${label}`); window.history.replaceState({},'',window.location.pathname) }
  },[profile?.id])

  const connect = async () => {
    if (!profile?.id) return; setConnecting(true)
    try {
      const r = await fetch(`/api/${apiBase}?action=auth-url&userId=${profile.id}&role=${role}`)
      const d = await r.json(); if (d.url) window.location.href = d.url
    } catch { toast.error('Error iniciando conexión'); setConnecting(false) }
  }
  const disconnect = async () => {
    if (!profile?.id||!confirm(`¿Desconectar ${label}?`)) return
    await fetch(`/api/${apiBase}?action=disconnect&userId=${profile.id}`)
    setStatus('disconnected'); setEmail(null); toast.success(`${label} desconectado`)
  }

  if (status==='loading') return null
  return status==='connected' ? (
    <div style={{ display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderBottom:'1px solid var(--c-border)' }}>
      <div style={{ width:42,height:42,background:grad,borderRadius:13,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:18,boxShadow:'0 4px 12px rgba(0,0,0,.15)',flexShrink:0 }}>{icon}</div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ fontWeight:700,fontSize:14,color:'var(--c-text-primary)',margin:0 }}>{label}</p>
        <p style={{ fontSize:12,color:'#10b981',display:'flex',alignItems:'center',gap:4,margin:'2px 0 0' }}><Check size={11}/>Conectado · <span style={{ color:'var(--c-text-muted)' }}>{email}</span></p>
      </div>
      <button onClick={disconnect} style={{ fontSize:12,fontWeight:700,color:'#ef4444',background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,padding:'6px 12px',cursor:'pointer',flexShrink:0 }}>Quitar</button>
    </div>
  ) : (
    <button onClick={connect} disabled={connecting} style={{ width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 20px',borderBottom:'1px solid var(--c-border)',background:'none',border:'none',cursor:'pointer',transition:'background .15s',fontFamily:'inherit' }}
      onMouseEnter={e=>(e.currentTarget as any).style.background='var(--c-surface)'}
      onMouseLeave={e=>(e.currentTarget as any).style.background='transparent'}>
      <div style={{ width:42,height:42,background:`${grad.replace('linear-gradient(135deg,','').split(',')[0]}18`,borderRadius:13,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>
        {connecting?<Loader2 size={18} style={{ animation:'spin 1s linear infinite' }} color="var(--c-text-muted)"/>:icon}
      </div>
      <div style={{ textAlign:'left',flex:1,minWidth:0 }}>
        <p style={{ fontWeight:700,fontSize:14,color:'var(--c-text-primary)',margin:0 }}>{connecting?'Conectando...':label}</p>
        <p style={{ fontSize:12,color:'var(--c-text-muted)',margin:'2px 0 0' }}>Sincronizá tus citas automáticamente</p>
      </div>
      {!connecting&&<ChevronRight size={18} color="var(--c-text-muted)" style={{ flexShrink:0 }}/>}
    </button>
  )
}

function MenuItem({ icon, label, sub, onClick, danger=false, badge='' }: any) {
  return (
    <button onClick={onClick} style={{ width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 20px',background:'none',border:'none',borderBottom:'1px solid var(--c-border)',cursor:'pointer',transition:'background .15s',fontFamily:'inherit' }}
      onMouseEnter={e=>(e.currentTarget as any).style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--c-surface)'}
      onMouseLeave={e=>(e.currentTarget as any).style.background='transparent'}>
      <div style={{ width:42,height:42,borderRadius:13,background:danger?'rgba(239,68,68,0.10)':'var(--c-surface)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:'1px solid var(--c-border)' }}>{icon}</div>
      <div style={{ flex:1,textAlign:'left' }}>
        <p style={{ fontWeight:700,fontSize:14,color:danger?'#ef4444':'var(--c-text-primary)',margin:0 }}>{label}</p>
        {sub&&<p style={{ fontSize:12,color:'var(--c-text-muted)',margin:'2px 0 0' }}>{sub}</p>}
      </div>
      <div style={{ display:'flex',alignItems:'center',gap:6 }}>
        {badge&&<span style={{ background:'#0284c7',color:'#fff',fontSize:10,fontWeight:800,padding:'2px 8px',borderRadius:20 }}>{badge}</span>}
        {!danger&&<ChevronRight size={16} color="var(--c-text-muted)"/>}
      </div>
    </button>
  )
}

function WhatsAppSection({ profile, onUpdated }: { profile: any; onUpdated: (p: string) => void }) {
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(!profile?.phone)

  const handleSave = async () => {
    if (!phone.trim()) { setError('Ingresá tu número'); return }
    const clean = phone.replace(/\s/g, '')
    if (!clean.startsWith('+') || clean.length < 10) {
      setError('Incluí el código de país, ej: +51 XXX XXX XXX'); return
    }
    setSaving(true); setError('')
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ phone: clean, wsp_notif: true, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (err) throw err
      setSaved(true); setEditing(false); onUpdated(clean)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleRemove = async () => {
    if (!confirm('¿Desactivar notificaciones WhatsApp?')) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ phone: null, wsp_notif: false }).eq('id', profile.id)
      setPhone(''); setEditing(true); onUpdated('')
    } finally { setSaving(false) }
  }

  const hasPhone = !!profile?.phone && !editing

  return (
    <div style={{ background:'var(--c-card)', borderRadius:22, border:'1px solid var(--c-border)', overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,.04)' }}>
      <div style={{ padding:'14px 20px 10px' }}>
        <p style={{ fontSize:10,fontWeight:800,color:'var(--c-text-muted)',textTransform:'uppercase',letterSpacing:1,margin:0 }}>Notificaciones WhatsApp</p>
      </div>

      {hasPhone ? (
        <div style={{ padding:'12px 20px 16px' }}>
          {/* Estado activo */}
          <div style={{ display:'flex',alignItems:'center',gap:14,padding:'12px 14px',background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',borderRadius:16,border:'1.5px solid #86efac',marginBottom:12 }}>
            <div style={{ width:40,height:40,background:'linear-gradient(135deg,#22c55e,#16a34a)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0 }}>📱</div>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontWeight:800,fontSize:13,color:'#15803d',margin:0,display:'flex',alignItems:'center',gap:5 }}>
                <CheckCircle size={13}/> Activo
              </p>
              <p style={{ fontSize:12,color:'#16a34a',margin:'2px 0 0',fontWeight:600 }}>{profile?.phone}</p>
            </div>
            <div style={{ display:'flex',gap:6 }}>
              <button onClick={() => setEditing(true)} style={{ fontSize:11,fontWeight:700,color:'#0369a1',background:'var(--c-stat-purple)',border:'1px solid var(--c-border)',borderRadius:10,padding:'6px 10px',cursor:'pointer' }}>Cambiar</button>
              <button onClick={handleRemove} disabled={saving} style={{ fontSize:11,fontWeight:700,color:'#dc2626',background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,padding:'6px 10px',cursor:'pointer' }}>Quitar</button>
            </div>
          </div>
          {/* Qué recibirá */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6 }}>
            {['📅 Nueva cita agendada','❌ Cita cancelada','📊 Informe disponible','💬 Mensaje del terapeuta'].map(item => (
              <div key={item} style={{ fontSize:11,color:'var(--c-text-muted)',fontWeight:600,padding:'6px 10px',background:'var(--c-surface)',border:'1px solid var(--c-border)',borderRadius:10,display:'flex',alignItems:'center',gap:6 }}>
                {item}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ padding:'4px 20px 16px' }}>
          <p style={{ fontSize:12,color:'var(--c-text-muted)',lineHeight:1.5,margin:'0 0 12px' }}>
            Ingresá tu número con código de país para recibir alertas importantes.
          </p>
          <div style={{ display:'flex',gap:8,marginBottom:error?8:0 }}>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="+51 XXX XXX XXX"
              style={{ flex:1,padding:'11px 14px',borderRadius:14,border:`1.5px solid ${error?'#fca5a5':'var(--c-border)'}`,fontSize:13,fontWeight:600,color:'var(--c-text-primary)',outline:'none',fontFamily:'inherit',background:'var(--c-surface)' }}
              onKeyDown={e => e.key==='Enter' && handleSave()}
            />
            <button onClick={handleSave} disabled={saving} style={{ padding:'11px 18px',borderRadius:14,border:'none',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',fontWeight:700,fontSize:13,cursor:saving?'not-allowed':'pointer',flexShrink:0,display:'flex',alignItems:'center',gap:6,fontFamily:'inherit',boxShadow:'0 4px 12px rgba(34,197,94,.3)' }}>
              {saving ? <Loader2 size={14} style={{ animation:'spin 1s linear infinite' }}/> : <Check size={14}/>}
              {saving ? '' : 'Activar'}
            </button>
          </div>
          {error && <p style={{ fontSize:11,color:'#dc2626',margin:'4px 0 0',fontWeight:600 }}>{error}</p>}
          {saved && <p style={{ fontSize:11,color:'#16a34a',margin:'6px 0 0',fontWeight:700,display:'flex',alignItems:'center',gap:5 }}><CheckCircle size={11}/>¡Listo! Notificaciones activadas</p>}
          <p style={{ fontSize:10,color:'var(--c-text-muted)',margin:'8px 0 0' }}>Perú: +51 · Colombia: +57 · México: +52 · España: +34 · Tu número no se comparte con terceros.</p>
        </div>
      )}
    </div>
  )
}

function ProfileView({ profile, onLogout, onChangePass, onEditProfile, onPrivacy, onHelp, onPhoneUpdated }: any) {
  const { t } = useI18n()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const initial = profile?.full_name?.charAt(0)||'U'
  const name = profile?.full_name||'Usuario'
  const email = profile?.email||'—'
  const phone = profile?.phone

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile?.id) return
    setUploadingPhoto(true)
    try {
      // ✅ FIX: usar endpoint server-side para subir y guardar en DB
      // evita el fallo silencioso de RLS al usar el cliente browser
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('folder', `avatars/${profile.id}`)
        fd.append('updateProfileId', profile.id)
        const upRes = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
        const upData = await upRes.json()
        if (!upRes.ok || !upData.url) throw new Error(upData.error || 'No se pudo subir la imagen')
        const finalUrl = `${upData.url}?t=${Date.now()}`
        setAvatarUrl(finalUrl)
        toast.success('Foto actualizada ✅')
      } catch (err: any) {
        toast.error('Error: ' + (err.message || 'No se pudo subir la foto'))
      } finally { setUploadingPhoto(false) }
    } catch { toast.error('Error al leer el archivo'); setUploadingPhoto(false) }
  }

  return (
    <div className="flex flex-col gap-4 pb-10 w-full max-w-2xl mx-auto">
      <style>{`
        @keyframes pv-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .pv-card{animation:pv-in .3s ease both}
        .pv-card:nth-child(1){animation-delay:.04s}.pv-card:nth-child(2){animation-delay:.08s}
        .pv-card:nth-child(3){animation-delay:.12s}.pv-card:nth-child(4){animation-delay:.16s}
      `}</style>

      {/* ── HERO CARD ── */}
      <div className="pv-card relative rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0c2c47 0%,#0369a1 55%,#0ea5e9 100%)', minHeight: 180 }}>
        {/* Decorative circles */}
        <div style={{ position:'absolute',top:-40,right:-40,width:200,height:200,background:'rgba(255,255,255,.07)',borderRadius:'50%',pointerEvents:'none' }}/>
        <div style={{ position:'absolute',bottom:-30,left:20,width:120,height:120,background:'rgba(14,165,233,.28)',borderRadius:'50%',pointerEvents:'none' }}/>

        <div className="relative z-10 px-6 pt-8 pb-6 flex items-end gap-5">
          {/* Avatar upload */}
          <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileRef.current?.click()}>
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto" className="w-20 h-20 rounded-2xl object-cover shadow-xl" style={{ border:'3px solid rgba(255,255,255,.3)' }}/>
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-xl" style={{ background:'rgba(255,255,255,.2)', border:'3px solid rgba(255,255,255,.3)', backdropFilter:'blur(8px)' }}>
                  {initial}
                </div>
              )}
              {/* Overlay */}
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background:'rgba(0,0,0,.55)' }}>
                {uploadingPhoto
                  ? <Loader2 size={20} className="text-white animate-spin"/>
                  : <div className="flex flex-col items-center gap-1">
                      <Camera size={18} className="text-white"/>
                      <span className="text-white text-[9px] font-bold">Cambiar</span>
                    </div>
                }
              </div>
              {/* Camera badge */}
              {!uploadingPhoto && (
                <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-white dark:bg-[#0d1117] rounded-full flex items-center justify-center shadow-lg">
                  <Camera size={13} className="text-sky-600"/>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1">
            <h2 className="font-bold text-xl text-white leading-tight tracking-tight">{name}</h2>
            <p className="text-sm mt-1 flex items-center gap-1.5" style={{ color:'rgba(255,255,255,.65)' }}>
              <Mail size={12}/>{email}
            </p>
            {phone && (
              <p className="text-sm mt-0.5 flex items-center gap-1.5 font-semibold" style={{ color:'#6ee7b7' }}>
                <Phone size={12}/>{phone}
              </p>
            )}
            <p className="text-[10px] mt-2 font-bold" style={{ color:'rgba(255,255,255,.4)' }}>
              Portal Familias · Vanty ABA
            </p>
          </div>
        </div>

        {/* Tap to change photo hint */}
        <div className="relative z-10 px-6 py-2.5 flex items-center gap-2" style={{ background:'rgba(0,0,0,.2)', borderTop:'1px solid rgba(255,255,255,.1)' }}>
          <Camera size={12} style={{ color:'rgba(255,255,255,.5)', flexShrink:0 }}/>
          <p className="text-[11px] font-medium" style={{ color:'rgba(255,255,255,.5)' }}>
            {uploadingPhoto ? 'Subiendo foto...' : 'Toca la foto para cambiarla'}
          </p>
        </div>
      </div>

      {/* ── MI CUENTA ── */}
      <div className="pv-card bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-100 dark:border-[#21262d] shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div className="w-1 h-4 bg-sky-500 rounded-full"/>
          <p className="text-[10px] font-bold" style={{ color: "var(--c-text-muted)" }}>Mi cuenta</p>
        </div>
        <MenuItem icon={<User size={17} color="#0284c7"/>} label="Editar perfil" sub="Nombre y teléfono" onClick={onEditProfile}/>
        <MenuItem icon={<Lock size={17} color="#0284c7"/>} label="Cambiar contraseña" sub="Actualizar acceso" onClick={onChangePass}/>
        <MenuItem icon={<Shield size={17} color="#0ea5e9"/>} label="Privacidad y seguridad" sub="Gestión de datos" onClick={onPrivacy}/>
        <MenuItem icon={<HelpCircle size={17} color="#10b981"/>} label="Centro de ayuda" sub="Guías y soporte" onClick={onHelp}/>
      </div>

      {/* ── CALENDARIOS ── */}
      <div className="pv-card bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-100 dark:border-[#21262d] shadow-sm overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <div className="w-1 h-4 bg-sky-500 rounded-full"/>
          <p className="text-[10px] font-bold" style={{ color: "var(--c-text-muted)" }}>Calendarios vinculados</p>
        </div>
        <CalBtn label="Google Calendar" icon="📅" grad="linear-gradient(135deg,#4285f4,#1a73e8)" profile={profile} apiBase="google-calendar" paramKey="gcal"/>
        <CalBtn label="Outlook Calendar" icon={<svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>} grad="linear-gradient(135deg,#0078d4,#106ebe)" profile={profile} apiBase="microsoft-calendar" paramKey="mscal"/>
      </div>

      {/* ── WHATSAPP ── */}
      <div className="pv-card">
        <WhatsAppSection profile={profile} onUpdated={onPhoneUpdated || (()=>{})}/>
      </div>

      {/* ── CERRAR SESIÓN ── */}
      <div className="pv-card rounded-2xl overflow-hidden" style={{ background: "var(--c-card)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <MenuItem icon={<LogOut size={17} color="#ef4444"/>} label="Cerrar sesión" danger onClick={onLogout}/>
      </div>
    </div>
  )
}

export default ProfileView
