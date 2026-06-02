'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'

import { useState, use, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Mail, Lock, User, Loader2, Eye, EyeOff, AlertCircle, MessageCircle, ArrowRight, Puzzle, Sparkles, LineChart, HeartHandshake, ShieldCheck, TrendingUp } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ mode?: string }>
}

export default function LoginPage(props: PageProps) {
  const searchParams = use(props.searchParams)
  const router = useRouter()
  const { t } = useI18n()
  const [isSignUp, setIsSignUp] = useState(searchParams.mode === 'signup')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotInfo, setShowForgotInfo] = useState(false)

  // ── Forzar modo claro en login — sin importar el tema guardado ──
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  async function handleGoogleLogin() {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setErrorMessage('Error al conectar con Google. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  async function handleMicrosoftLogin() {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'email profile openid offline_access',
        },
      })
      if (error) throw error
    } catch (err: any) {
      setErrorMessage('Error al conectar con Microsoft. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrorMessage('')
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    try {
      if (isSignUp) {
        const { data: authData, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        if (error) throw error
        // Supabase a veces NO lanza error cuando el usuario ya existe — en su lugar devuelve identities: []
        if (!authData.user || (authData.user.identities && authData.user.identities.length === 0)) {
          setErrorMessage('Este correo ya está registrado. Usa "Iniciar sesión" o recupera tu contraseña.')
          setIsLoading(false)
          return
        }
        if (authData.user) await supabase.from('profiles').insert([{ id: authData.user.id, email, full_name: fullName, role: 'padre' }])
        router.push('/padre')
      } else {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
        const adminRoles = ['admin', 'jefe', 'especialista']
        router.push(adminRoles.includes(profile?.role) ? '/admin' : '/padre')
      }
    } catch (err: any) {
      const msg = err.message || ''
      const status = err.status || err.statusCode
      if (msg.includes('Invalid login credentials')) setErrorMessage('Correo o contraseña incorrectos.')
      else if (msg.includes('Email not confirmed')) setErrorMessage('Cuenta no confirmada. Contacta al administrador.')
      else if (msg.includes('User already registered') || msg.includes('already been registered') || msg.toLowerCase().includes('already exists') || status === 409) {
        setErrorMessage('Este correo ya está registrado. Usa "Iniciar sesión" o recupera tu contraseña.')
      }
      else if (msg.includes('Password should be at least')) setErrorMessage('La contraseña debe tener al menos 6 caracteres.')
      else if (msg.includes('rate limit') || msg.toLowerCase().includes('too many')) setErrorMessage('Demasiados intentos. Espera unos minutos e intenta de nuevo.')
      else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) setErrorMessage('Sin conexión al servidor. Verifica tu internet o intenta en unos minutos.')
      else setErrorMessage(msg || 'Error al procesar la solicitud. Intenta de nuevo.')
      setIsLoading(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .login-root {
          font-family: 'Plus Jakarta Sans', sans-serif;
          min-height: 100svh;
          display: flex;
          background: #f5f4fe;
          overflow-x: hidden;
        }
        .lp-left {
          display: none;
          width: 50%;
          position: relative;
          background:
            radial-gradient(120% 90% at 18% 12%, #29265c 0%, rgba(41,38,92,0) 55%),
            linear-gradient(164deg, #100e26 0%, #1a1740 50%, #2a2660 100%);
          overflow: hidden;
          padding: 60px 64px;
          flex-direction: column;
          justify-content: center;
        }
        @media(min-width: 900px){ .lp-left { display: flex; } }
        /* Viñeta sutil para profundidad premium */
        .lp-left::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
          box-shadow: inset 0 0 180px 40px rgba(8,6,24,.55);
        }
        /* Textura de grano fino — rompe la planitud digital (look premium) */
        .lp-grain {
          position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: .045;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px 180px;
        }
        .lp-orb { position: absolute; border-radius: 50%; filter: blur(100px); animation: orbFloat 20s ease-in-out infinite; }
        .lp-orb-1 { width: 440px; height: 440px; background: #4f46e5; opacity: .26; top: -150px; left: -110px; }
        .lp-orb-2 { width: 340px; height: 340px; background: #7c3aed; opacity: .18; bottom: -60px; right: -80px; animation-delay: 6s; }
        .lp-orb-3 { width: 240px; height: 240px; background: #38bdf8; opacity: .10; bottom: 220px; left: 40px; animation-delay: 10s; }
        @keyframes orbFloat {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(34px,-26px) scale(1.08); }
          66%  { transform: translate(-18px,22px) scale(0.96); }
          100% { transform: translate(0,0) scale(1); }
        }

        /* ── Entrada escalonada de las features ── */
        @keyframes featIn { from { opacity: 0; transform: translateX(-18px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes heroIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .lp-hero-anim { opacity: 0; animation: heroIn .7s cubic-bezier(.22,1,.36,1) forwards; }

        @media (prefers-reduced-motion: reduce) {
          .lp-orb, .lp-card, .lp-hero-anim { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
        .lp-card {
          background: transparent; border: 1px solid transparent;
          border-radius: 15px; padding: 13px 15px;
          display: flex; align-items: center; gap: 16px;
          transition: background .25s ease, border-color .25s ease, transform .25s ease;
          opacity: 0; animation: featIn .6s cubic-bezier(.22,1,.36,1) forwards;
        }
        .lp-card:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); transform: translateX(4px); }
        .lp-card:hover .lp-card-icon { background: rgba(165,180,252,.22); border-color: rgba(165,180,252,.32); }
        .lp-card-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.12); color: #c7d2fe; transition: background .25s ease, border-color .25s ease; }

        /* ── Layout 2 columnas: contenido + vista previa del producto ── */
        .lp-inner { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 40px; width: 100%; }
        .lp-content { flex: 0 1 440px; min-width: 0; }
        .lp-aside { flex: 0 0 260px; display: none; }
        @media (min-width: 1680px) { .lp-aside { display: block; } }

        /* Tarjeta de progreso (preview del producto) — llena el espacio y muestra valor real */
        .lp-preview {
          background: rgba(255,255,255,.98); border-radius: 22px; padding: 20px;
          box-shadow: 0 40px 80px -24px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05);
          animation: floatCard 8s ease-in-out infinite;
        }
        @keyframes floatCard { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-14px); } }
        .lp-pv-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .lp-pv-avatar { width: 42px; height: 42px; border-radius: 13px; background: linear-gradient(135deg,#6d28d9,#8b5cf6); color: #fff; font-weight: 800; font-size: 17px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .lp-pv-name { font-weight: 700; font-size: 14.5px; color: #111827; line-height: 1.2; }
        .lp-pv-sub { font-size: 12px; color: #6b7280; margin-top: 1px; }
        .lp-pv-trend { font-size: 12px; font-weight: 700; color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; }
        .lp-pv-chartwrap { background: #faf9fe; border: 1px solid #efedf8; border-radius: 14px; padding: 12px 12px 8px; margin-bottom: 14px; }
        .lp-pv-chart-label { font-size: 11px; color: #8b8a99; font-weight: 600; margin-bottom: 8px; }
        .lp-pv-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .lp-pv-stat { background: #f6f5fb; border-radius: 13px; padding: 11px 6px; text-align: center; }
        .lp-pv-num { font-weight: 800; font-size: 17px; color: #4c1d95; letter-spacing: -.02em; }
        .lp-pv-lbl { font-size: 10.5px; color: #6b7280; margin-top: 2px; }
        @media (prefers-reduced-motion: reduce) { .lp-preview { animation: none !important; } }
        .lp-right {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 28px 20px 40px; position: relative; overflow: hidden;
          background:
            radial-gradient(100% 80% at 100% 0%, rgba(99,102,241,.05) 0%, rgba(99,102,241,0) 55%),
            #fbfbfe;
        }
        .lp-form-box { width: 100%; max-width: 408px; position: relative; z-index: 2; }
        .lp-field { position: relative; margin-bottom: 12px; }
        .lp-field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 7px; }
        .lp-field input { width: 100%; padding: 15px 16px 15px 46px; background: #fff; border: 1.5px solid #e7e6f0; border-radius: 14px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #111827; outline: none; transition: border-color .2s, box-shadow .2s; box-shadow: 0 1px 2px rgba(30,27,75,.04); }
        .lp-field input::placeholder { color: #b6b6c6; }
        .lp-field input:hover { border-color: #d6d4e6; }
        .lp-field input:focus { border-color: #6d28d9; box-shadow: 0 0 0 4px rgba(109,40,217,.12); }
        .lp-field .lp-icon { position: absolute; left: 15px; bottom: 16px; color: #9ca3af; pointer-events: none; }
        .lp-field .lp-eye { position: absolute; right: 14px; bottom: 15px; color: #9ca3af; cursor: pointer; background: none; border: none; padding: 0; transition: color .2s; display: flex; }
        .lp-field .lp-eye:hover { color: #6d28d9; }
        .lp-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #5b21b6 0%, #6d28d9 55%, #7c3aed 100%); color: #fff; border: none; border-radius: 14px; font-size: 15.5px; font-weight: 700; letter-spacing: .01em; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform .15s ease, box-shadow .25s ease, filter .2s; box-shadow: 0 10px 28px rgba(91,33,182,.32); margin-top: 8px; }
        .lp-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 16px 36px rgba(91,33,182,.4); }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-btn:disabled { opacity: .6; cursor: not-allowed; }
        .lp-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1.5px solid #fca5a5; color: #dc2626; border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 14px; }
        .lp-sep { display: flex; align-items: center; gap: 12px; margin: 28px 0 20px; color: #9ca3af; font-size: 12px; }
        .lp-sep::before, .lp-sep::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
        .lp-forgot { background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 13px; padding: 15px 17px; margin-bottom: 14px; }
        .lp-forgot p { font-size: 13px; color: #3730a3; line-height: 1.6; margin-bottom: 11px; }
        .lp-forgot a { display: flex; align-items: center; justify-content: center; gap: 8px; background: #16a34a; color: #fff; border-radius: 10px; padding: 11px 16px; font-size: 13px; font-weight: 700; text-decoration: none; transition: background .2s; }
        .lp-forgot a:hover { background: #15803d; }
        .lp-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(109,40,217,.07); border: 1px solid rgba(109,40,217,.16); color: #6d28d9; border-radius: 99px; padding: 6px 14px; font-size: 12px; font-weight: 600; margin-bottom: 18px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media(min-width:900px) { .mobile-logo { display: none !important; } }
        /* Neutralizar reglas globales de móvil dentro del login */
        .login-root button, .login-root a { min-height: unset !important; min-width: unset !important; }
        .login-root .lp-btn { min-height: 50px !important; width: 100% !important; }
        .login-root .lp-oauth-btn { min-height: 48px !important; }
        .login-root input { font-size: 16px; } /* evita zoom en iOS */
      `}</style>

      <div className="login-root" style={{ background: '#f5f4fe', colorScheme: 'light' }}>

        {/* LEFT */}
        <div className="lp-left">
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />
          <div className="lp-grain" />

          <div className="lp-inner">
          <div className="lp-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 56 }}>
              <div style={{ width: 60, height: 60, borderRadius: 17, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Image src="/images/logo.png" alt="Logo SANTI" width={42} height={42} style={{ objectFit: 'contain' }} />
              </div>
              <div>
                <p style={{ color: '#fff', fontWeight: 800, fontSize: 19, lineHeight: 1.15, letterSpacing: '-0.01em' }}>Neuropsicología y Terapias SANTI</p>
                <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 12.5, marginTop: 2 }}>{t('auth.centroTerapeutico')}</p>
              </div>
            </div>

            <h2 className="lp-hero-anim" style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(40px, 3.6vw, 54px)', lineHeight: 1.04, letterSpacing: '-0.025em', marginBottom: 18, animationDelay: '.05s' }}>
              Tu hijo merece<br/><span style={{ color: '#a5b4fc' }}>lo mejor.</span>
            </h2>
            <p className="lp-hero-anim" style={{ color: 'rgba(255,255,255,.6)', fontSize: 15.5, lineHeight: 1.7, marginBottom: 46, maxWidth: 360, animationDelay: '.18s' }}>
              Plataforma de gestión clínica ABA potenciada con Inteligencia Artificial para el seguimiento real de tu hijo.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { Icon: Puzzle, title: 'Formularios TEA y TDAH', desc: 'BRIEF-2, ADOS-2, WISC-V y más' },
                { Icon: Sparkles, title: 'Análisis con IA Profesional', desc: 'Informes clínicos automáticos' },
                { Icon: LineChart, title: 'Progreso en tiempo real', desc: 'Gráficos y seguimiento visual' },
                { Icon: HeartHandshake, title: 'Portal para familias', desc: 'Citas, formularios y asistente IA' },
              ].map(({ Icon, title, desc }, i) => (
                <div key={title} className="lp-card" style={{ animationDelay: `${(0.35 + i * 0.12).toFixed(2)}s` }}>
                  <div className="lp-card-icon"><Icon size={22} strokeWidth={1.75} /></div>
                  <div>
                    <p style={{ color: '#fff', fontWeight: 600, fontSize: 15.5, marginBottom: 3, letterSpacing: '-0.01em' }}>{title}</p>
                    <p style={{ color: 'rgba(255,255,255,.58)', fontSize: 13 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vista previa del producto — llena el espacio y muestra el valor real */}
          <aside className="lp-aside" aria-hidden="true">
            <div className="lp-preview">
              <div className="lp-pv-head">
                <div className="lp-pv-avatar">M</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="lp-pv-name">Mateo G.</p>
                  <p className="lp-pv-sub">Programa de lenguaje</p>
                </div>
                <span className="lp-pv-trend"><TrendingUp size={12} /> +18%</span>
              </div>
              <div className="lp-pv-chartwrap">
                <div className="lp-pv-chart-label">Progreso · últimas 8 semanas</div>
                <svg viewBox="0 0 256 92" width="100%" height="64" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#7c3aed" stopOpacity="0.26" />
                      <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,66 L36,60 L73,62 L109,46 L146,50 L182,33 L219,26 L248,12 L256,12 L256,92 L0,92 Z" fill="url(#pvFill)" />
                  <path d="M0,66 L36,60 L73,62 L109,46 L146,50 L182,33 L219,26 L248,12" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="248" cy="12" r="4" fill="#fff" stroke="#7c3aed" strokeWidth="2.5" />
                </svg>
              </div>
              <div className="lp-pv-stats">
                <div className="lp-pv-stat"><div className="lp-pv-num">24</div><div className="lp-pv-lbl">Sesiones</div></div>
                <div className="lp-pv-stat"><div className="lp-pv-num">8/10</div><div className="lp-pv-lbl">Objetivos</div></div>
                <div className="lp-pv-stat"><div className="lp-pv-num">92%</div><div className="lp-pv-lbl">Dominio</div></div>
              </div>
            </div>
          </aside>
          </div>

          <div style={{ position: 'absolute', zIndex: 10, left: 64, right: 64, bottom: 36, borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 20 }}>
            <p style={{ color: 'rgba(255,255,255,.38)', fontSize: 12 }}>{t('auth.copyright')}</p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lp-right">
          <div className="lp-form-box">

            <div className="mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <Image src="/images/logo.png" alt="Logo" width={40} height={40} style={{ objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <p style={{ fontWeight: 800, color: '#1e1b4b', fontSize: 14, lineHeight: 1.2, margin: 0 }}>Neuropsicología y Terapias SANTI</p>
                <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>Centro Terapéutico · Pueblo Libre</p>
              </div>
            </div>

            <div className="lp-pill">
              <ShieldCheck size={13} strokeWidth={2.2} />
              {isSignUp ? 'Crea tu cuenta gratis' : 'Plataforma clínica protegida'}
            </div>

            <h1 style={{ fontSize: 'clamp(26px, 5vw, 33px)', fontWeight: 800, color: '#111827', marginBottom: 7, lineHeight: 1.12, letterSpacing: '-0.025em' }}>
              {isSignUp ? 'Bienvenido al equipo' : 'Ingresa a tu cuenta'}
            </h1>
            <p style={{ fontSize: 14.5, color: '#6b7280', marginBottom: 24 }}>
              {isSignUp ? 'Completa los datos para comenzar' : 'Continúa el seguimiento de tu hijo'}
            </p>

            <form onSubmit={handleSubmit}>
              {isSignUp && (
                <div className="lp-field">
                  <label>{t('auth.nombreCompleto2')}</label>
                  <User size={15} className="lp-icon" />
                  <input name="fullName" type="text" placeholder={t('auth.ejNombre')} required />
                </div>
              )}

              <div className="lp-field">
                <label>{t('auth.correoElectronico')}</label>
                <Mail size={15} className="lp-icon" />
                <input name="email" type="email" placeholder="tu@correo.com" required />
              </div>

              <div className="lp-field">
                <label>{t('auth.password')}</label>
                <Lock size={15} className="lp-icon" />
                <input name="password" type={showPassword ? 'text' : 'password'} placeholder={isSignUp ? 'Mínimo 6 caracteres' : '••••••••'} required minLength={6} style={{ paddingRight: 44 }} />
                <button type="button" className="lp-eye" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {!isSignUp && (
                <button type="button" onClick={() => setShowForgotInfo(!showForgotInfo)}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: 'inherit', display: 'block' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              {showForgotInfo && (
                <div className="lp-forgot">
                  <p>Comunícate con <strong>Neuropsicología y Terapias SANTI</strong> {t('auth.restablecen')}</p>
                  <a href="https://wa.me/51991070734?text=Hola,%20olvidé%20mi%20contraseña." target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={14} /> Contactar por WhatsApp
                  </a>
                </div>
              )}

              {errorMessage && (
                <div className="lp-error">
                  <AlertCircle size={15} style={{ flexShrink: 0 }} /> {errorMessage}
                </div>
              )}

              <button type="submit" className="lp-btn" disabled={isLoading}>
                {isLoading
                  ? <><Loader2 size={17} className="spin" /> {t('common.procesando')}</>
                  : <>{isSignUp ? 'Crear Cuenta' : 'Ingresar'} <ArrowRight size={15} /></>
                }
              </button>
            </form>

            <div className="lp-sep"><span>{t('auth.oContinua')}</span></div>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '13px 20px', borderRadius: 14, border: '1.5px solid #e7e6f0',
                background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10, transition: 'all .2s',
                boxShadow: '0 1px 2px rgba(30,27,75,.04)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6d28d9'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(109,40,217,.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e7e6f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(30,27,75,.04)' }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58z"/>
              </svg>
              Continuar con Google
            </button>

            {/* Microsoft OAuth */}
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, padding: '13px 20px', borderRadius: 14, border: '1.5px solid #e7e6f0',
                background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12, transition: 'all .2s',
                boxShadow: '0 1px 2px rgba(30,27,75,.04)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0078d4'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,120,212,.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e7e6f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(30,27,75,.04)' }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              Continuar con Microsoft
            </button>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>{isSignUp ? '¿Ya tienes cuenta? ' : '¿Primera vez? '}</span>
              <button onClick={() => { setIsSignUp(!isSignUp); setErrorMessage(''); setShowForgotInfo(false) }}
                style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {isSignUp ? 'Iniciar sesión' : 'Crear una cuenta'}
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Lock size={10} /> Acceso cifrado y protegido
            </p>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#d1d5db', marginTop: 8 }}>
              <a href="/privacidad" style={{ color: '#9ca3af', textDecoration: 'none' }}>{t('auth.politicaPriv')}</a>
              {' · '}
              <a href="/terminos" style={{ color: '#9ca3af', textDecoration: 'none' }}>{t('auth.terminosServ')}</a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
