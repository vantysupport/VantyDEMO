'use client'
import React from 'react'

import { useState, useEffect, useRef } from 'react'
import {
  User, Lock, Palette, Shield, Eye, EyeOff,
  Save, Loader2, CheckCircle, Camera, Mail, Phone,
  Globe, LogOut, AlertTriangle, HardDrive, Database, RefreshCw,
  Crown, ArrowUpRight,
} from 'lucide-react'
import { useTheme } from '@/components/ThemeContext'
import { supabase } from '@/lib/supabase'
import { releaseSessionNow } from '@/lib/session-lock'
import { useToast } from '@/components/Toast'
import { GestorPlantillas } from './PlantillasClinicas'

// ── Card genérica ─────────────────────────────────────────────────────────────
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
          <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{title}</h3>
          {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ── Separador de sección ──────────────────────────────────────────────────────
function SectionTitle({ label }: { label: string }) {
  const { isDark } = useTheme()
  return (
    <p className={`text-[10px] font-bold pt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
      {label}
    </p>
  )
}

// ── Input estilizado ──────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { isDark } = useTheme()
  return (
    <div>
      <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</label>
      {children}
    </div>
  )
}

function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const { isDark } = useTheme()
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all border-2 ${
        isDark
          ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder-slate-600 focus:border-sky-500'
          : 'bg-slate-50 border-transparent text-slate-800 placeholder-slate-400 focus:border-sky-400 focus:bg-white shadow-sm'
      } ${className}`}
    />
  )
}

// ── Sección: Mi Perfil ────────────────────────────────────────────────────────
function SeccionPerfil({ onAvatarUpdate }: { onAvatarUpdate?: (url: string) => void }) {
  const { isDark } = useTheme()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: '' })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setForm({
        full_name: profile?.full_name || '',
        email: user.email || '',
        phone: profile?.phone || '',
        role: profile?.role || '',
      })
      setAvatarUrl(profile?.avatar_url || null)
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { error } = await supabase.from('profiles').update({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (error) throw error
      toast.success('Perfil actualizado correctamente')
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const ROLE_LABEL: Record<string, string> = {
    jefe: '👑 Jefe / Owner',
    admin: '🛡️ Administrador',
    especialista: '🩺 Especialista',
    terapeuta: '💚 Terapeuta',
  }

  const initial = form.full_name?.charAt(0)?.toUpperCase() || '?'

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-sky-600" />
    </div>
  )

  return (
    <div className="space-y-4">
      <SectionTitle label="Mi Perfil" />

      {/* Avatar & nombre */}
      <Card title="Foto y Nombre" subtitle="Tu identidad en el sistema" icon={User} iconColor="bg-gradient-to-br from-sky-500 to-sky-600">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-6 text-center sm:text-left">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-2xl object-cover ring-4 ring-sky-100" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center ring-4 ring-sky-100">
                <span className="text-2xl font-bold text-white">{initial}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) { toast.error('No estás logueado'); return }

                // 1. Subir vía endpoint server-side (auto-crea bucket, valida tipo, etc.)
                const fd = new FormData()
                fd.append('file', file)
                fd.append('folder', `avatars/${user.id}`)
                // ✅ FIX: el servidor actualiza avatar_url con supabaseAdmin,
                // evitando el fallo silencioso de RLS del cliente browser
                fd.append('updateProfileId', user.id)
                const upRes = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
                const upData = await upRes.json()
                if (!upRes.ok || !upData.url) {
                  throw new Error(upData.error || 'No se pudo subir la imagen')
                }

                // 3. Actualizar UI con cache-buster para forzar refresh
                const finalUrl = `${upData.url}?t=${Date.now()}`
                setAvatarUrl(finalUrl)
                onAvatarUpdate?.(finalUrl)
                toast.success('Foto actualizada')
              } catch (err: any) {
                console.error('[avatar-upload]', err)
                toast.error(err?.message || 'Error al actualizar la foto')
              } finally {
                // Limpiar el input para permitir re-subir la misma imagen
                if (fileRef.current) fileRef.current.value = ''
              }
            }} />
          </div>
          <div>
            <p className={`font-bold text-lg ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{form.full_name || 'Sin nombre'}</p>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{form.email}</p>
            {form.role && (
              <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${isDark ? 'bg-sky-900/30 text-sky-300' : 'bg-sky-50 text-sky-700'}`}>
                {ROLE_LABEL[form.role] || form.role}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nombre completo">
            <Input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Ej: María García"
            />
          </Field>
          <Field label="Teléfono">
            <Input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Ej: +51 987 654 321"
            />
          </Field>
        </div>
      </Card>

      {/* Email (info) */}
      <Card title="Correo Electrónico" subtitle="Tu email de acceso al sistema" icon={Mail} iconColor="bg-gradient-to-br from-slate-500 to-slate-700">
        <div className={`flex items-center gap-3 p-4 rounded-xl border-2 ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-slate-50 border-transparent'}`}>
          <Mail size={16} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
          <span className={`text-sm font-medium flex-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{form.email}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>No editable</span>
        </div>
        <p className={`text-xs mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          El correo es tu identificador de acceso. Para cambiarlo contacta al administrador del sistema.
        </p>
      </Card>

      {/* Guardar perfil */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-sky-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-sky-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </div>
  )
}

// ── Sección: Contraseña ───────────────────────────────────────────────────────
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
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const strengthLabels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
  const strengthColors = ['', 'bg-red-500', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-500']
  const s = calcStrength(form.nueva)

  return (
    <div className="space-y-4">
      <SectionTitle label="Seguridad" />

      <Card title="Cambiar Contraseña" subtitle="Mantén tu cuenta segura con una contraseña fuerte" icon={Lock} iconColor="bg-gradient-to-br from-sky-500 to-sky-600">
        <div className="space-y-4">
          <Field label="Nueva contraseña">
            <div className="relative">
              <Input
                type={show.nueva ? 'text' : 'password'}
                value={form.nueva}
                onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className="pr-11"
              />
              <button onClick={() => setShow(s => ({ ...s, nueva: !s.nueva }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg">
                {show.nueva ? <EyeOff size={16} className="text-slate-400" /> : <Eye size={16} className="text-slate-400" />}
              </button>
            </div>
            {form.nueva && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= s ? strengthColors[s] : isDark ? 'bg-[#30363d]' : 'bg-slate-200'}`} />
                  ))}
                </div>
                {s > 0 && <p className={`text-[11px] font-bold ${s <= 1 ? 'text-red-500' : s === 2 ? 'text-orange-500' : s === 3 ? 'text-amber-500' : 'text-emerald-500'}`}>{strengthLabels[s]}</p>}
              </div>
            )}
          </Field>

          <Field label="Confirmar nueva contraseña">
            <div className="relative">
              <Input
                type={show.confirmar ? 'text' : 'password'}
                value={form.confirmar}
                onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
                placeholder="Repite la contraseña"
                className="pr-11"
              />
              <button onClick={() => setShow(s => ({ ...s, confirmar: !s.confirmar }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg">
                {show.confirmar ? <EyeOff size={16} className="text-slate-400" /> : <Eye size={16} className="text-slate-400" />}
              </button>
            </div>
            {form.confirmar && form.nueva && (
              <div className={`flex items-center gap-1.5 mt-2 text-xs font-bold ${form.nueva === form.confirmar ? 'text-emerald-500' : 'text-red-500'}`}>
                {form.nueva === form.confirmar
                  ? <><CheckCircle size={12} /> Las contraseñas coinciden</>
                  : <><AlertTriangle size={12} /> No coinciden</>}
              </div>
            )}
          </Field>
        </div>

        {/* Requisitos */}
        <div className={`mt-4 p-4 rounded-xl border ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-slate-50 border-slate-100'}`}>
          <p className={`text-[10px] font-bold mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Requisitos</p>
          {[
            { label: 'Mínimo 8 caracteres', ok: form.nueva.length >= 8 },
            { label: 'Al menos una mayúscula', ok: /[A-Z]/.test(form.nueva) },
            { label: 'Al menos un número', ok: /[0-9]/.test(form.nueva) },
            { label: 'Un carácter especial (!@#$…)', ok: /[^A-Za-z0-9]/.test(form.nueva) },
          ].map(r => (
            <div key={r.label} className="flex items-center gap-2 py-0.5">
              <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${r.ok ? 'bg-emerald-500' : isDark ? 'bg-[#21262d]' : 'bg-slate-200'}`}>
                {r.ok && <CheckCircle size={9} className="text-white" />}
              </div>
              <span className={`text-xs ${r.ok ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : isDark ? 'text-slate-500' : 'text-slate-400'}`}>{r.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <button
        onClick={handleChange}
        disabled={saving || !form.nueva || form.nueva !== form.confirmar}
        className="w-full py-4 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-sky-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-sky-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm active:scale-[0.98]"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        {saving ? 'Actualizando…' : 'Actualizar contraseña'}
      </button>
    </div>
  )
}

// ── Sección: Almacenamiento ───────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 MB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function StorageBar({ icon: Icon, label, used, cap, accent, unavailable }: {
  icon: any; label: string; used: number | null; cap: number; accent: string; unavailable?: boolean
}) {
  const { isDark } = useTheme()
  const pct = used != null && cap > 0 ? Math.min(100, (used / cap) * 100) : 0
  // Color del relleno según ocupación
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : accent
  const free = used != null ? Math.max(0, cap - used) : null

  return (
    <div className={`rounded-2xl border p-4 ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50/60 border-slate-100'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
          <Icon size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{label}</p>
          {unavailable ? (
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No disponible</p>
          ) : (
            <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
               style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="font-bold" style={{ color: barColor }}>{formatBytes(used || 0)}</span> de {formatBytes(cap)} usados
            </p>
          )}
        </div>
        {!unavailable && (
          <span className="text-sm font-extrabold shrink-0" style={{ color: barColor, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)' }}>
            {pct.toFixed(0)}%
          </span>
        )}
      </div>

      <div className={`h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-[#21262d]' : 'bg-slate-200'}`}>
        <div className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: unavailable ? '0%' : `${pct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)` }} />
      </div>

      {!unavailable && free != null && (
        <p className={`text-[11px] mt-2 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}
           style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatBytes(free)} disponibles
        </p>
      )}
    </div>
  )
}

function SeccionAlmacenamiento() {
  const { isDark } = useTheme()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No autenticado')
      const res = await fetch('/api/admin/storage-usage', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al cargar')
      setData(json)
    } catch (e: any) {
      setError(e.message || 'Error al cargar el uso')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <SectionTitle label="Almacenamiento" />

      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200/80 shadow-sm'}`}>
        <div className={`px-6 py-5 border-b flex items-center gap-4 ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br from-sky-500 to-cyan-600">
            <HardDrive size={18} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Espacio del Sistema</h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Uso de archivos y base de datos en Supabase</p>
          </div>
          <button onClick={load} disabled={loading}
            className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            title="Actualizar">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {loading && !data ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin text-sky-600" />
            </div>
          ) : error ? (
            <div className={`flex items-center gap-2 text-sm p-4 rounded-xl ${isDark ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-600'}`}>
              <AlertTriangle size={15} /> {error}
            </div>
          ) : data ? (
            <>
              <StorageBar icon={HardDrive} label="Archivos (Storage)" accent="#0284c7"
                used={data.storage?.used ?? 0} cap={data.storage?.cap ?? 0} />
              <StorageBar icon={Database} label="Base de datos" accent="#06b6d4"
                used={data.database?.used ?? null} cap={data.database?.cap ?? 0}
                unavailable={data.database?.used == null} />

              {data.database?.used == null && (
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Para mostrar el tamaño de la base de datos, crea la función <code className="font-mono text-[10px] px-1 py-0.5 rounded bg-slate-200/60 dark:bg-[#21262d]">get_db_size()</code> en Supabase (SQL Editor).
                </p>
              )}

              {/* Acciones de plan */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <a href={`https://wa.me/51924685557?text=${encodeURIComponent('Hola, deseo cambiarme a Pro')}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-sky-200/50 hover:-translate-y-0.5 active:scale-[0.98] bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700">
                  <Crown size={16} /> Cámbiate a Pro
                </a>
                <a href={`https://wa.me/51924685557?text=${encodeURIComponent('Hola, deseo aumentar mi espacio de almacenamiento')}`} target="_blank" rel="noopener noreferrer"
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 active:scale-[0.98] border-2 ${
                    isDark
                      ? 'border-[#30363d] text-slate-300 hover:border-sky-700 hover:bg-sky-900/20'
                      : 'border-slate-200 text-slate-700 hover:border-sky-300 hover:bg-sky-50'
                  }`}>
                  <ArrowUpRight size={16} /> Aumentar espacio
                </a>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Sección: Apariencia ───────────────────────────────────────────────────────
function SeccionApariencia() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <div className="space-y-4">
      <SectionTitle label="Apariencia" />

      <Card title="Tema de la Interfaz" subtitle="Personaliza cómo se ve el panel" icon={Palette} iconColor="bg-gradient-to-br from-sky-500 to-sky-600">
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'light', label: 'Claro', emoji: '☀️', desc: 'Fondo blanco y colores vivos' },
            { id: 'dark',  label: 'Oscuro', emoji: '🌙', desc: 'Fondo oscuro, menos fatiga visual' },
          ].map(t => {
            const isActive = (t.id === 'dark') === isDark
            return (
              <button key={t.id}
                onClick={() => { if (!isActive) toggleTheme() }}
                className={`relative p-5 rounded-2xl border-2 text-left transition-all hover:-translate-y-0.5 ${isActive
                  ? 'border-sky-500 bg-sky-50 shadow-md shadow-sky-100'
                  : isDark ? 'border-[#30363d] hover:border-[#4a5568]' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                <span className="text-3xl block mb-3">{t.emoji}</span>
                <p className={`font-bold text-sm ${isActive ? 'text-sky-700' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t.label}</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t.desc}</p>
                {isActive && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center">
                    <CheckCircle size={11} className="text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ── Sección: Cuenta ───────────────────────────────────────────────────────────
function SeccionCuenta() {
  const { isDark } = useTheme()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }: { data: { user: any } }) => {
      if (!user) return
      setEmail(user.email || '')
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(data?.role || '')
    })
  }, [])

  const handleLogout = async () => {
    await releaseSessionNow() // libera la sesión única ANTES de salir
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const ROLE_INFO: Record<string, { label: string; color: string; perms: string[] }> = {
    jefe:        { label: '👑 Jefe / Owner',   color: isDark ? 'bg-yellow-900/20 text-yellow-300 border-yellow-800/40' : 'bg-yellow-50 text-yellow-800 border-yellow-200', perms: ['Todo el sistema', 'Usuarios', 'Configuración', 'Tienda', 'Agenda'] },
    admin:       { label: '🛡️ Administrador', color: isDark ? 'bg-sky-900/20 text-sky-300 border-sky-800/40'       : 'bg-sky-50 text-sky-800 border-sky-200',         perms: ['Pacientes', 'Agenda', 'Recursos', 'Reportes', 'Análisis Predictivo'] },
    especialista:{ label: '🩺 Especialista',   color: isDark ? 'bg-sky-900/20 text-sky-300 border-sky-800/40': 'bg-sky-50 text-sky-800 border-sky-200',   perms: ['Pacientes asignados', 'Evaluaciones', 'Análisis Predictivo', 'Recursos'] },
    terapeuta:   { label: '💚 Terapeuta',       color: isDark ? 'bg-green-900/20 text-green-300 border-green-800/40'  : 'bg-green-50 text-green-800 border-green-200',       perms: ['Pacientes asignados', 'Evaluaciones', 'Recursos'] },
  }

  const info = ROLE_INFO[role]

  return (
    <div className="space-y-4">
      <SectionTitle label="Cuenta" />

      <Card title="Información de Cuenta" subtitle="Detalles de tu acceso al sistema" icon={Shield} iconColor="bg-gradient-to-br from-slate-500 to-slate-700">
        <div className="space-y-3">
          <div className={`flex items-center gap-3 p-4 rounded-xl ${isDark ? 'bg-[#0d1117]' : 'bg-slate-50'}`}>
            <Mail size={15} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
            <div>
              <p className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Email</p>
              <p className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{email}</p>
            </div>
          </div>
          {info && (
            <div className={`rounded-xl border p-4 ${info.color}`}>
              <p className="text-xs font-bold mb-2">{info.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {info.perms.map(p => (
                  <span key={p} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-white/10' : 'bg-white/60'}`}>{p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Sesión" subtitle="Administra tu sesión activa" icon={LogOut} iconColor="bg-gradient-to-br from-orange-500 to-red-500">
        <div className="space-y-3">
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Al cerrar sesión saldrás del panel y deberás ingresar nuevamente con tu email y contraseña.
          </p>
          <button onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-red-600 border-2 border-red-200 bg-red-50 hover:bg-red-100 transition-all w-full justify-center active:scale-[0.98]">
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </Card>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ConfiguracionView({ onAvatarUpdate }: { onAvatarUpdate?: (url: string) => void }) {
  const { isDark } = useTheme()
  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-10">
      <SeccionPerfil onAvatarUpdate={onAvatarUpdate} />
      <SeccionAlmacenamiento />
      <SeccionSeguridad />
      <SeccionApariencia />
      <SeccionCuenta />
    </div>
  )
}
