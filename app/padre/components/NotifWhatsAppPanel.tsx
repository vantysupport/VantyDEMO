'use client'

import { useI18n } from '@/lib/i18n-context'
// Panel para que el padre configure su número WhatsApp y active notificaciones
// Aparece en Perfil del padre

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Props {
  profile: any
  onUpdated: (phone: string) => void
}

export default function NotifWhatsAppPanel({ profile, onUpdated }: Props) {
  const { t } = useI18n()
  const [phone, setPhone]     = useState(profile?.phone || '')
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')
  const [step, setStep]       = useState<'idle' | 'confirm'>(profile?.phone ? 'confirm' : 'idle')

  const hasPhone = !!profile?.phone

  const handleSave = async () => {
    if (!phone.trim()) { setError('Ingresá tu número'); return }
    // Validar formato básico con código país
    const clean = phone.replace(/\s/g, '')
    if (!clean.startsWith('+') || clean.length < 10) {
      setError('Incluí el código de país, ej: +51 924 807 183')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({ phone: clean, wsp_notif: true, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
      if (err) throw err
      setSaved(true)
      setStep('confirm')
      onUpdated(clean)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setSaving(true)
    try {
      await supabase
        .from('profiles')
        .update({ phone: null, wsp_notif: false })
        .eq('id', profile.id)
      setPhone('')
      setStep('idle')
      onUpdated('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white/80 backdrop-blur-sm overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center text-xl shrink-0">
          📱
        </div>
        <div>
          <p className="font-bold text-slate-800 text-sm">Notificaciones WhatsApp</p>
          <p className="text-xs text-slate-400">
            {step === 'confirm'
              ? <span className="text-green-600 font-semibold">✅ Activo — {profile?.phone}</span>
              : 'Recibí alertas de citas, informes y mensajes'}
          </p>
        </div>
        {step === 'confirm' && (
          <button
            onClick={() => setStep('idle')}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Cambiar
          </button>
        )}
      </div>

      {/* Estado activo */}
      {step === 'confirm' && (
        <div className="p-5 space-y-3">
          <div className="bg-green-50 rounded-2xl p-4 space-y-2">
            {[
              '📅 Nueva cita agendada',
              '❌ Cita cancelada o modificada',
              '📊 Informe de progreso disponible',
              '💬 Mensaje nuevo del terapeuta',
              '📋 Formulario para completar',
            ].map((item, i) => (
              <p key={i} className="text-xs text-green-700 font-medium flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                {item}
              </p>
            ))}
          </div>
          <button
            onClick={handleRemove}
            disabled={saving}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            {saving ? 'Quitando...' : 'Quitar notificaciones'}
          </button>
        </div>
      )}

      {/* Formulario de número */}
      {step === 'idle' && (
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Ingresá tu número de WhatsApp con el código de país para recibir alertas importantes del centro.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Número WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="+51 924 807 183"
              className="w-full p-4 bg-slate-50 rounded-2xl font-semibold outline-none border-2 border-transparent focus:bg-white focus:border-green-400 transition-all text-slate-800 placeholder:text-slate-300"
            />
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <p className="text-[10px] text-slate-400">
              Perú: +51 · Colombia: +57 · México: +52 · España: +34
            </p>
          </div>

          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-xs text-green-700 font-semibold text-center">
              ✅ Número guardado. Ya estás suscrito a las notificaciones.
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !phone.trim()}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' }}
          >
            {saving ? 'Guardando...' : '📱 Activar notificaciones WhatsApp'}
          </button>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Solo recibirás alertas del centro. Tu número no se comparte con terceros.
          </p>
        </div>
      )}
    </div>
  )
}
