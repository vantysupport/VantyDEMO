'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, MoreVertical, Plus } from 'lucide-react'

export default function PWAInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled]     = useState(false)
  const [platform, setPlatform]           = useState<'android' | 'ios' | 'desktop' | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [installing, setInstalling]       = useState(false)
  const [dismissed, setDismissed]         = useState(false)

  useEffect(() => {
    // Detectar si ya está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true) {
      setIsInstalled(true)
      return
    }

    // Detectar si ya fue descartado en esta sesión
    if (sessionStorage.getItem('pwa_install_dismissed')) {
      setDismissed(true)
      return
    }

    // Detectar plataforma
    const ua = navigator.userAgent.toLowerCase()
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)

    if (isIOS) setPlatform('ios')
    else if (isAndroid) setPlatform('android')
    else setPlatform('desktop')

    // Android/Desktop Chrome: capturar el evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Detectar si se instaló
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowInstructions(true)
      return
    }

    if (installPrompt) {
      setInstalling(true)
      try {
        installPrompt.prompt()
        const { outcome } = await installPrompt.userChoice
        if (outcome === 'accepted') setIsInstalled(true)
      } finally {
        setInstalling(false)
        setInstallPrompt(null)
      }
      return
    }

    // Fallback — mostrar instrucciones manuales
    setShowInstructions(true)
  }

  const dismiss = () => {
    sessionStorage.setItem('pwa_install_dismissed', '1')
    setDismissed(true)
    setShowInstructions(false)
  }

  // No mostrar si ya instalada, descartada, o no en mobile
  if (isInstalled || dismissed || !platform || platform === 'desktop') return null
  // No mostrar si no hay prompt de Android disponible Y no es iOS
  if (platform === 'android' && !installPrompt) return null

  return (
    <>
      {/* ── BANNER DE INSTALACIÓN ── */}
      {!showInstructions && (
        <div
          className="fixed bottom-20 left-3 right-3 z-50 flex items-center gap-3 p-3 rounded-2xl shadow-xl border"
          style={{
            background: 'linear-gradient(135deg, #5B3FC8, #7c3aed)',
            borderColor: 'rgba(255,255,255,0.15)',
            animation: 'slide-up 0.4s ease-out',
          }}>
          {/* Ícono */}
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-white"/>
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Instalar Vanty</p>
            <p className="text-white/75 text-xs mt-0.5">
              {platform === 'ios' ? 'Añadir a pantalla de inicio' : 'Instalar como app'}
            </p>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="px-3 py-1.5 bg-white text-violet-700 rounded-lg text-xs font-black hover:bg-white/90 transition-all">
              {installing ? '...' : 'Instalar'}
            </button>
            <button onClick={dismiss} className="p-1.5 text-white/60 hover:text-white transition-colors">
              <X size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL INSTRUCCIONES iOS ── */}
      {showInstructions && platform === 'ios' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={dismiss}>
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            style={{ animation: 'slide-up 0.3s ease-out' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <div>
                  <p className="font-black text-slate-800">Instalar Vanty</p>
                  <p className="text-xs text-slate-500">en iPhone / iPad</p>
                </div>
              </div>
              <button onClick={dismiss} className="p-2 text-slate-400 hover:text-slate-600">
                <X size={18}/>
              </button>
            </div>

            {/* Pasos */}
            <div className="space-y-4">
              <Step n={1} icon={<Share size={18} className="text-blue-500"/>}>
                Toca el ícono de <strong>Compartir</strong>
                <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 rounded-md ml-1">
                  <Share size={12} className="text-white"/>
                </span>
                {' '}en la barra de Safari
              </Step>

              <Step n={2} icon={<Plus size={18} className="text-slate-600"/>}>
                Baja y toca <strong>"Añadir a pantalla de inicio"</strong>
              </Step>

              <Step n={3} icon={<span className="text-lg">✅</span>}>
                Toca <strong>"Añadir"</strong> — Vanty aparecerá en tu pantalla de inicio
              </Step>
            </div>

            {/* Nota */}
            <p className="text-xs text-slate-400 text-center mt-5 leading-relaxed">
              Solo funciona desde <strong>Safari</strong>. Chrome e otros navegadores no permiten instalar apps en iPhone.
            </p>

            <button
              onClick={dismiss}
              className="w-full mt-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-bold text-sm">
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL INSTRUCCIONES Android fallback ── */}
      {showInstructions && platform === 'android' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
          onClick={dismiss}>
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            style={{ animation: 'slide-up 0.3s ease-out' }}
            onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between mb-5">
              <p className="font-black text-slate-800">Instalar en Android</p>
              <button onClick={dismiss} className="p-2 text-slate-400"><X size={18}/></button>
            </div>

            <div className="space-y-4">
              <Step n={1} icon={<MoreVertical size={18} className="text-slate-600"/>}>
                Toca el menú <strong>⋮</strong> (tres puntos) en Chrome
              </Step>
              <Step n={2} icon={<Plus size={18} className="text-slate-600"/>}>
                Toca <strong>"Instalar app"</strong> o <strong>"Añadir a pantalla de inicio"</strong>
              </Step>
              <Step n={3} icon={<span className="text-lg">✅</span>}>
                Toca <strong>"Instalar"</strong> para confirmar
              </Step>
            </div>

            <button onClick={dismiss}
              className="w-full mt-5 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-bold text-sm">
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex items-start gap-2 flex-1">
        <span className="flex-shrink-0 mt-0.5">{icon}</span>
        <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
