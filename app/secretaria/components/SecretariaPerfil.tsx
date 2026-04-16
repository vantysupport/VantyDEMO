'use client'

import { useState, useEffect, useRef } from 'react'
import {
  User, Mail, Phone, Lock, LogOut, Shield,
  Eye, EyeOff, Save, Loader2, Camera,
  CheckCircle, AlertTriangle, Palette
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'

// ── Same Card system as ConfiguracionView ────────────────────────────────────
function Card({ title, subtitle, icon: Icon, iconColor, children }: {
  title: string; subtitle?: string; icon: any; iconColor: string; children: React.ReactNode
}) {
  const { isDark } = useTheme()
  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200/80 shadow-sm'}`}>
      <div className={`px-6 py-5 border-b flex items-center gap-4 ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
          <Icon size={18} className="text-white" />
        </div>
        <div>
          <h3 className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h3>
          {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function SectionTitle({ label }: { label: string }) {
  const { isDark } = useTheme()
  return <p className={`text-[10px] font-black uppercase tracking-widest pt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { isDark } = useTheme()
  return (
    <div>
      <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
      {children}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const { isDark } = useTheme()
  return (
    <input {...props}
      className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all border-2 ${
        isDark
          ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder-slate-600 focus:border-blue-500'
          : 'bg-slate-50 border-transparent text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white shadow-sm'
      } ${className}`}
    />
  )
}

// ── Sección Perfil ────────────────────────────────────────────────────────────
function SeccionPerfil({ profile, onUpdate, onAvatarUpdate }: { profile: any; onUpdate?: () => void; onAvatarUpdate?: (url: string) => void }) {
  const { isDark } = useTheme()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', phone: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    setForm({ full_name: profile?.full_name || '', phone: profile?.phone || '' })
    setAvatarUrl(profile?.avatar_url || null)
  }, [profile])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      await supabase.from('profiles').update({ full_name: form.full_name.trim(), phone: form.phone.trim(), updated_at: new Date().toISOString() }).eq('id', user.id)
      toast.success('Perfil actualizado')
      onUpdate?.()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const initial = form.full_name?.charAt(0)?.toUpperCase() || '?'

  return (
    <div className="space-y-4">
      <SectionTitle label="Mi Perfil" />

      <Card title="Foto y Nombre" subtitle="Tu identidad en el sistema" icon={User} iconColor="bg-gradient-to-br from-blue-500 to-indigo-600">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6 text-center sm:text-left">
          <div className="relative group cursor-pointer shrink-0" onClick={() => fileRef.current?.click()}>
            {avatarUrl
              ? <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover ring-4 ring-blue-100" />
              : <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center ring-4 ring-blue-100"><span className="text-2xl font-black text-white">{initial}</span></div>}
            <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return
              const { data: { user } } = await supabase.auth.getUser(); if (!user) return
              const path = `avatars/${user.id}.${file.name.split('.').pop()}`
              await supabase.storage.from('store-images').upload(path, file, { upsert: true })
              const url = supabase.storage.from('store-images').getPublicUrl(path).data.publicUrl
              await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id)
              setAvatarUrl(url); onAvatarUpdate?.(url); toast.success('Foto actualizada')
            }} />
          </div>
          <div>
            <p className={`font-black text-lg ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{form.full_name || 'Sin nombre'}</p>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{profile?.email}</p>
            <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${isDark ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
              🗂️ Secretaria
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre completo">
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Ej: María García" />
          </Field>
          <Field label="Teléfono">
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Ej: +51 987 654 321" />
          </Field>
        </div>
      </Card>

      <Card title="Correo Electrónico" subtitle="Tu email de acceso al sistema" icon={Mail} iconColor="bg-gradient-to-br from-slate-500 to-slate-700">
        <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-slate-50 border-transparent'}`}>
          <Mail size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <span className={`text-sm font-medium flex-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{profile?.email}</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>No editable</span>
        </div>
        <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Para cambiar el correo contacta al administrador del sistema.</p>
      </Card>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200/40 disabled:opacity-50 flex items-center justify-center gap-2 text-sm active:scale-[0.98]">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}

// ── Sección Seguridad ─────────────────────────────────────────────────────────
function SeccionSeguridad() {
  const { isDark } = useTheme()
  const toast = useToast()
  const [form, setForm] = useState({ nueva: '', confirmar: '' })
  const [show, setShow] = useState({ nueva: false, confirmar: false })
  const [saving, setSaving] = useState(false)

  const calcStrength = (pwd: string) => {
    let s = 0
    if (pwd.length >= 8) s++
    if (/[A-Z]/.test(pwd)) s++
    if (/[0-9]/.test(pwd)) s++
    if (/[^A-Za-z0-9]/.test(pwd)) s++
    return s
  }

  const handleChange = async () => {
    if (!form.nueva) { toast.error('Ingresa la nueva contraseña'); return }
    if (form.nueva.length < 8) { toast.error('Mínimo 8 caracteres'); return }
    if (form.nueva !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: form.nueva })
      if (error) throw error
      toast.success('¡Contraseña actualizada!')
      setForm({ nueva: '', confirmar: '' })
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const strengthColors = ['', 'bg-red-500', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-500']
  const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
  const s = calcStrength(form.nueva)

  return (
    <div className="space-y-4">
      <SectionTitle label="Seguridad" />
      <Card title="Cambiar Contraseña" subtitle="Mantén tu cuenta segura" icon={Lock} iconColor="bg-gradient-to-br from-violet-500 to-purple-600">
        <div className="space-y-4">
          <Field label="Nueva contraseña">
            <div className="relative">
              <Input type={show.nueva ? 'text' : 'password'} value={form.nueva} onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))} placeholder="Mínimo 8 caracteres" className="pr-11" />
              <button onClick={() => setShow(s => ({ ...s, nueva: !s.nueva }))} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg">
                {show.nueva ? <EyeOff size={16} className="text-slate-400" /> : <Eye size={16} className="text-slate-400" />}
              </button>
            </div>
            {form.nueva && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">{[1,2,3,4].map(i => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= s ? strengthColors[s] : isDark ? 'bg-[#30363d]' : 'bg-slate-200'}`} />)}</div>
                {s > 0 && <p className={`text-[11px] font-bold ${s <= 1 ? 'text-red-500' : s === 2 ? 'text-orange-500' : s === 3 ? 'text-amber-500' : 'text-emerald-500'}`}>{strengthLabels[s]}</p>}
              </div>
            )}
          </Field>
          <Field label="Confirmar contraseña">
            <div className="relative">
              <Input type={show.confirmar ? 'text' : 'password'} value={form.confirmar} onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} placeholder="Repite la contraseña" className="pr-11" />
              <button onClick={() => setShow(s => ({ ...s, confirmar: !s.confirmar }))} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg">
                {show.confirmar ? <EyeOff size={16} className="text-slate-400" /> : <Eye size={16} className="text-slate-400" />}
              </button>
            </div>
            {form.confirmar && form.nueva && (
              <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${form.nueva === form.confirmar ? 'text-emerald-500' : 'text-red-500'}`}>
                {form.nueva === form.confirmar ? <><CheckCircle size={12} /> Las contraseñas coinciden</> : <><AlertTriangle size={12} /> No coinciden</>}
              </div>
            )}
          </Field>
        </div>
      </Card>
      <button onClick={handleChange} disabled={saving || !form.nueva || form.nueva !== form.confirmar}
        className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-violet-200/40 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm active:scale-[0.98]">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        {saving ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </div>
  )
}

// ── Sección Apariencia ────────────────────────────────────────────────────────
function SeccionApariencia() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div className="space-y-4">
      <SectionTitle label="Apariencia" />
      <Card title="Tema de la Interfaz" subtitle="Personaliza cómo se ve el panel" icon={Palette} iconColor="bg-gradient-to-br from-indigo-500 to-blue-600">
        <div className="grid grid-cols-2 gap-3">
          {[{ id: 'light', label: 'Claro', emoji: '☀️', desc: 'Fondo blanco' }, { id: 'dark', label: 'Oscuro', emoji: '🌙', desc: 'Menos fatiga visual' }].map(t => {
            const isActive = (t.id === 'dark') === isDark
            return (
              <button key={t.id} onClick={() => { if (!isActive) toggleTheme() }}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5 ${isActive ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-100' : isDark ? 'border-[#30363d] hover:border-[#4a5568]' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <span className="text-3xl block mb-3">{t.emoji}</span>
                <p className={`font-black text-sm ${isActive ? 'text-blue-700' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.label}</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.desc}</p>
                {isActive && <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"><CheckCircle size={11} className="text-white" /></div>}
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ── Sección Cuenta ────────────────────────────────────────────────────────────
function SeccionCuenta({ profile }: { profile: any }) {
  const { isDark } = useTheme()
  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login' }

  return (
    <div className="space-y-4">
      <SectionTitle label="Cuenta" />
      <Card title="Información de Cuenta" subtitle="Detalles de tu acceso" icon={Shield} iconColor="bg-gradient-to-br from-slate-500 to-slate-700">
        <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
          <Mail size={15} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Email</p>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{profile?.email}</p>
          </div>
        </div>
        <div className={`mt-3 rounded-xl border p-3 ${isDark ? 'bg-blue-900/20 text-blue-300 border-blue-800/40' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
          <p className="text-xs font-black">🗂️ Secretaria</p>
        </div>
      </Card>
      <Card title="Cerrar Sesión" subtitle="Salir de tu cuenta" icon={LogOut} iconColor="bg-gradient-to-br from-orange-500 to-red-500">
        <p className={`text-sm mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Al cerrar sesión saldrás del panel y deberás ingresar nuevamente.</p>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-red-600 border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-all w-full justify-center active:scale-[0.98]">
          <LogOut size={15} /> Cerrar sesión
        </button>
      </Card>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SecretariaPerfil({ profile, onUpdate, onAvatarUpdate }: {
  profile: any; onUpdate?: () => void; onAvatarUpdate?: (url: string) => void
}) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-10">
      <SeccionPerfil profile={profile} onUpdate={onUpdate} onAvatarUpdate={onAvatarUpdate} />
      <SeccionSeguridad />
      <SeccionApariencia />
      <SeccionCuenta profile={profile} />
    </div>
  )
}
