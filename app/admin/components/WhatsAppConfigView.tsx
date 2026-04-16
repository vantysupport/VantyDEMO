'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'
// Panel de configuración de notificaciones — WhatsApp
import { useState, useEffect } from 'react'
import { Bell, CheckCircle, XCircle, ExternalLink, Copy, Send, MessageCircle } from 'lucide-react'
import WhatsAppQRPanel from './WhatsAppQRPanel'

export default function WhatsAppConfigView() {
  const { t, locale } = useI18n()
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [tab, setTab] = useState<'baileys'>('baileys')

  useEffect(() => {
    fetch('/api/whatsapp').then(r => r.json()).then(d => { setStatus(d); setLoading(false) })
  }, [])

  const sendTest = async () => {
    setSending(true)
    setTestResult(null)
    try {
      const statusRes = await fetch('/api/whatsapp-service/status')
      const statusData = await statusRes.json()
      if (!statusData.connected) {
        setTestResult({ ok: false, msg: '❌ WhatsApp no está conectado. Escaneá el QR primero.' })
        return
      }
      // Obtener número del admin desde su perfil
      const profileRes = await fetch('/api/admin/profile')
      const profileData = await profileRes.json()
      const adminPhone = profileData?.phone
      if (!adminPhone) {
        setTestResult({ ok: false, msg: '❌ Agregá tu número de teléfono en Mi Perfil primero.' })
        return
      }
      const res = await fetch('/api/whatsapp-service/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: adminPhone,
          message: `🧪 *Test Vanty* — ${new Date().toLocaleTimeString()} ✅\nLas notificaciones están funcionando correctamente.`,
        }),
      })
      const d = await res.json()
      setTestResult({
        ok: d.ok,
        msg: d.ok
          ? '✅ Mensaje enviado correctamente'
          : `❌ ${d.error || 'No se pudo enviar.'}`,
      })
    } catch {
      setTestResult({ ok: false, msg: '❌ Error de conexión con el servicio.' })
    } finally { setSending(false) }
  }

  const copy = (t: string) => navigator.clipboard.writeText(t)

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" />
    </div>
  )

  const configured = status?.configured
  const channel    = status?.channel

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
          <Bell size={20} className="text-violet-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Notificaciones externas
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Alertas en tiempo real cuando ocurre algo importante en la plataforma
          </p>
        </div>
      </div>

      {/* Estado actual */}
      <div className={`rounded-xl p-4 border flex items-center gap-3 ${
        configured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        {configured
          ? <CheckCircle size={18} className="text-green-600 shrink-0" />
          : <XCircle size={18} className="text-amber-600 shrink-0" />
        }
        <div className="flex-1">
          <p className={`text-sm font-bold ${configured ? 'text-green-800' : 'text-amber-800'}`}>
            Canal activo: {status?.label || 'Sin configurar'}
          </p>
          {!configured && (
            <p className="text-xs text-amber-700 mt-0.5">
              Seguí los pasos de abajo para conectar WhatsApp.
            </p>
          )}
        </div>
        {configured && (
          <button
            onClick={sendTest}
            disabled={sending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-green-300 text-green-700 hover:bg-green-50 transition-all disabled:opacity-50"
          >
            <Send size={12} />
            {sending ? 'Enviando...' : 'Probar'}
          </button>
        )}
      </div>

      {testResult && (
        <p className={`text-xs font-semibold px-4 py-2 rounded-lg ${
          testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>{testResult.msg}</p>
      )}

      {/* Tabs — solo WhatsApp */}
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--card-border)' }}>
        {([
          { id: 'baileys', label: '💬 WhatsApp Business', badge: '' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-2.5 px-1 text-sm font-bold flex items-center gap-1.5 border-b-2 transition-all ${
              tab === t.id
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BAILEYS QR ── */}
      {tab === 'baileys' && <WhatsAppQRPanel />}

      {/* Triggers activos */}
      <div className="rounded-xl border p-5" style={{ borderColor: 'var(--card-border)', background: 'var(--card)' }}>
        <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{t('ui.queDisparaNotif')}</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '📅', label: 'Cita agendada',      active: true },
            { icon: '❌', label: 'Cita cancelada',     active: true },
            { icon: '📋', label: 'Formulario subido',  active: true },
            { icon: '📊', label: 'Informe generado',   active: true },
            { icon: '⚠️', label: 'Alerta clínica IA',  active: false },
            { icon: '💬', label: 'Mensaje terapeuta',  active: false },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm">{item.icon}</span>
              <span className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                item.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-400'
              }`}>{item.active ? t('common.activo2') : t('common.pronto')}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
