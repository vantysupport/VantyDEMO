'use client'

// 🔐 Página de configuración obligatoria de 2FA para roles críticos (admin/jefe)
// El middleware redirige acá si el role requiere MFA y aún no lo configuró.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Shield, Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw } from 'lucide-react'

export default function MFARequiredPage() {
  const router = useRouter()
  const [step, setStep] = useState<'intro' | 'enroll' | 'verify' | 'done'>('intro')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)   // SVG/data URL del QR
  const [secret, setSecret] = useState<string | null>(null)   // código manual
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  // Cargar perfil para confirmar role
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
    })()
  }, [router])

  const iniciarEnroll = async () => {
    setBusy(true); setError(null)
    try {
      // Verificar si ya existe un factor pendiente y limpiarlo
      const { data: factors } = await supabase.auth.mfa.listFactors()
      for (const f of factors?.totp || []) {
        if ((f.status as string) === 'unverified') {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Vanty ABA ${new Date().toLocaleDateString('es-PE')}`,
      })
      if (error) throw error
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setStep('enroll')
    } catch (e: any) {
      setError(e?.message || 'Error iniciando configuración 2FA')
    } finally { setBusy(false) }
  }

  const verificarCodigo = async () => {
    if (!factorId || !verifyCode.trim()) return
    setBusy(true); setError(null)
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId, challengeId: challengeData.id, code: verifyCode.trim(),
      })
      if (verifyError) throw verifyError

      // Marcar en profiles que ya enrolló 2FA
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('profiles').update({ mfa_enrolled_at: new Date().toISOString() }).eq('id', user.id)
      }

      setStep('done')
      setTimeout(() => {
        const dest = profile?.role === 'jefe' || profile?.role === 'admin' ? '/admin' : '/login'
        router.push(dest)
      }, 1800)
    } catch (e: any) {
      setError(e?.message || 'Código incorrecto. Probá con el código actual de tu app autenticadora.')
    } finally { setBusy(false) }
  }

  const copiar = (txt: string) => {
    navigator.clipboard?.writeText(txt)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
      <div className="max-w-md w-full rounded-3xl bg-white shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
            <Shield size={26} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Autenticación de 2 factores</h1>
            <p className="text-xs text-slate-500">Requerido para tu rol ({profile?.role || '…'})</p>
          </div>
        </div>

        {step === 'intro' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              Por la sensibilidad de los datos que manejas (información clínica de menores),
              tu cuenta debe usar <strong>autenticación de 2 factores</strong> antes de continuar.
            </p>
            <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 text-xs space-y-2">
              <p className="font-bold text-indigo-900">Necesitarás una app autenticadora:</p>
              <ul className="text-indigo-700 list-disc pl-4 space-y-1">
                <li>Google Authenticator</li>
                <li>Microsoft Authenticator</li>
                <li>Authy</li>
                <li>1Password</li>
              </ul>
            </div>
            {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</p>}
            <button onClick={iniciarEnroll} disabled={busy}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <><Loader2 size={16} className="animate-spin"/> Generando código…</> : <>Configurar 2FA ahora</>}
            </button>
          </div>
        )}

        {step === 'enroll' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              <strong>1.</strong> Abrí tu app autenticadora y escaneá este código QR:
            </p>
            {qrCode && (
              <div className="bg-white p-4 rounded-xl border-2 border-slate-200 flex justify-center">
                {/* Supabase devuelve el QR como SVG inline o data URL */}
                {qrCode.startsWith('data:') ? (
                  <img src={qrCode} alt="QR de 2FA" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48" dangerouslySetInnerHTML={{ __html: qrCode }} />
                )}
              </div>
            )}
            {secret && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs">
                <p className="text-slate-500 mb-1">¿No podés escanear? Introducí este código manualmente:</p>
                <div className="flex items-center gap-2 font-mono font-bold text-slate-800 text-sm">
                  <span className="flex-1 break-all">{secret}</span>
                  <button onClick={() => copiar(secret)} className="p-1 rounded hover:bg-slate-200" title="Copiar">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}
            <div>
              <p className="text-sm text-slate-700 mb-2">
                <strong>2.</strong> Ingresá el código de 6 dígitos que muestra la app:
              </p>
              <input type="text" inputMode="numeric" maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 outline-none focus:border-indigo-500 text-center font-mono text-2xl tracking-widest" />
            </div>
            {error && <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12}/> {error}</p>}
            <div className="flex gap-2">
              <button onClick={() => setStep('intro')} disabled={busy}
                className="px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-sm disabled:opacity-50">
                <RefreshCw size={14} className="inline mr-1" /> Regenerar
              </button>
              <button onClick={verificarCodigo} disabled={busy || verifyCode.length !== 6}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <><Loader2 size={16} className="animate-spin"/> Verificando…</> : 'Verificar y activar'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">2FA activado</h2>
            <p className="text-sm text-slate-600">Redirigiendo a tu panel…</p>
          </div>
        )}
      </div>
    </div>
  )
}
