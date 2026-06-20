'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'

import { useState, use, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { claimSession } from '@/lib/session-lock'
import { Mail, Lock, User, Loader2, Eye, EyeOff, AlertCircle, MessageCircle, ArrowRight, ShieldCheck } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ mode?: string; session?: string }>
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

  // ── Aviso si fue expulsado por sesión única ──
  useEffect(() => {
    if (searchParams.session === 'taken') {
      setErrorMessage('Un usuario está usando este perfil ahora. Solo se permite una sesión activa por cuenta.')
    }
  }, [searchParams.session])

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

        // ── Sesión única (con timeout interno; si falla, deja entrar igual) ──
        const claim = await claimSession()
        if (claim === 'in_use') {
          setErrorMessage('Un usuario está usando este perfil ahora. Solo se permite una sesión activa por cuenta.')
          setIsLoading(false)
          // scope:'local' => cierra SOLO esta sesión (la que se bloquea), NO la
          // sesión activa del otro dispositivo (global la mataría a TODAS).
          supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          return
        }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single()
        const adminRoles = ['admin', 'jefe', 'especialista']
        const dest = profile?.role === 'programador'
          ? '/control'
          : adminRoles.includes(profile?.role) ? '/admin' : '/padre'
        router.push(dest)
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
          background: #eef5fb;
          overflow-x: hidden;
        }
        .lp-left {
          display: none;
          width: 50%;
          position: relative;
          background:
            radial-gradient(120% 90% at 18% 12%, #15466e 0%, rgba(21,70,110,0) 55%),
            linear-gradient(164deg, #07182a 0%, #0c2c47 50%, #114a73 100%);
          overflow: hidden;
          padding: 60px 64px;
          flex-direction: column;
          justify-content: center;
        }
        @media(min-width: 900px){ .lp-left { display: flex; } }
        /* Viñeta sutil para profundidad premium */
        .lp-left::after {
          content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 2;
          box-shadow: inset 0 0 180px 40px rgba(3,12,22,.55);
        }
        /* Textura de grano fino — rompe la planitud digital (look premium) */
        .lp-grain {
          position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: .045;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 180px 180px;
        }
        .lp-orb { position: absolute; border-radius: 50%; filter: blur(100px); animation: orbFloat 20s ease-in-out infinite; }
        .lp-orb-1 { width: 440px; height: 440px; background: #0284c7; opacity: .28; top: -150px; left: -110px; }
        .lp-orb-2 { width: 340px; height: 340px; background: #0ea5e9; opacity: .18; bottom: -60px; right: -80px; animation-delay: 6s; }
        .lp-orb-3 { width: 240px; height: 240px; background: #38bdf8; opacity: .12; bottom: 220px; left: 40px; animation-delay: 10s; }
        @keyframes orbFloat {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(34px,-26px) scale(1.08); }
          66%  { transform: translate(-18px,22px) scale(0.96); }
          100% { transform: translate(0,0) scale(1); }
        }

        @keyframes heroIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .lp-hero-anim { opacity: 0; animation: heroIn .8s cubic-bezier(.22,1,.36,1) forwards; }
        .lp-line { display: block; opacity: 0; animation: heroIn .85s cubic-bezier(.22,1,.36,1) forwards; }

        /* Brillo ambiental que recorre el panel — muy sutil, da sensación premium */
        .lp-left::before {
          content: ''; position: absolute; inset: -20%; z-index: 1; pointer-events: none;
          background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.05) 48%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.05) 52%, transparent 62%);
          background-size: 220% 220%;
          animation: sheen 12s ease-in-out infinite;
        }
        @keyframes sheen { 0% { background-position: 130% 0; } 55%, 100% { background-position: -30% 0; } }

        /* Lema con flujo de color continuo (acento de marca) */
        .lp-accent-line {
          background: linear-gradient(90deg,#f472b6,#fbbf24,#38bdf8,#a3e635,#f472b6);
          background-size: 200% 100%;
          animation: rainbowShift 7s linear infinite;
        }
        @keyframes rainbowShift { to { background-position: -200% 0; } }

        /* Destello periódico del botón principal (CTA premium) */
        .lp-btn { position: relative; overflow: hidden; }
        .lp-btn::after {
          content: ''; position: absolute; top: 0; bottom: 0; left: -70%; width: 45%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent);
          transform: skewX(-20deg); pointer-events: none;
          animation: btnShine 5.5s ease-in-out infinite;
        }
        @keyframes btnShine { 0% { left: -70%; } 32%, 100% { left: 130%; } }

        @media (prefers-reduced-motion: reduce) {
          .lp-orb, .lp-hero-anim, .lp-line { animation: none !important; opacity: 1 !important; transform: none !important; }
          .lp-left::before, .lp-accent-line, .lp-btn::after { animation: none !important; }
          .lp-left::before { opacity: 0; }
        }
        .lp-right {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 28px 20px 40px; position: relative; overflow: hidden;
          background:
            radial-gradient(100% 80% at 100% 0%, rgba(2,132,199,.06) 0%, rgba(2,132,199,0) 55%),
            #fbfdff;
        }
        .lp-form-box { width: 100%; max-width: 408px; position: relative; z-index: 2; }
        .lp-field { position: relative; margin-bottom: 12px; }
        .lp-field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 7px; }
        .lp-field input { width: 100%; padding: 15px 16px 15px 46px; background: #fff; border: 1.5px solid #e7e6f0; border-radius: 14px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #111827; outline: none; transition: border-color .2s, box-shadow .2s; box-shadow: 0 1px 2px rgba(30,27,75,.04); }
        .lp-field input::placeholder { color: #b6b6c6; }
        .lp-field input:hover { border-color: #d6d4e6; }
        .lp-field input:focus { border-color: #0284c7; box-shadow: 0 0 0 4px rgba(2,132,199,.14); }
        .lp-field .lp-icon { position: absolute; left: 15px; bottom: 16px; color: #9ca3af; pointer-events: none; }
        .lp-field .lp-eye { position: absolute; right: 14px; bottom: 15px; color: #9ca3af; cursor: pointer; background: none; border: none; padding: 0; transition: color .2s; display: flex; }
        .lp-field .lp-eye:hover { color: #0284c7; }
        .lp-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, #0369a1 0%, #0284c7 55%, #0ea5e9 100%); color: #fff; border: none; border-radius: 14px; font-size: 15.5px; font-weight: 700; letter-spacing: .01em; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: transform .15s ease, box-shadow .25s ease, filter .2s; box-shadow: 0 10px 28px rgba(3,105,161,.34); margin-top: 8px; }
        .lp-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 16px 36px rgba(3,105,161,.42); }
        .lp-btn:active:not(:disabled) { transform: translateY(0); }
        .lp-btn:disabled { opacity: .6; cursor: not-allowed; }
        .lp-error { display: flex; align-items: center; gap: 10px; background: #fef2f2; border: 1.5px solid #fca5a5; color: #dc2626; border-radius: 12px; padding: 12px 16px; font-size: 13px; margin-bottom: 14px; }
        .lp-sep { display: flex; align-items: center; gap: 12px; margin: 28px 0 20px; color: #9ca3af; font-size: 12px; }
        .lp-sep::before, .lp-sep::after { content: ''; flex: 1; height: 1px; background: #e5e7eb; }
        .lp-forgot { background: #eff8ff; border: 1.5px solid #bae0fd; border-radius: 13px; padding: 15px 17px; margin-bottom: 14px; }
        .lp-forgot p { font-size: 13px; color: #075985; line-height: 1.6; margin-bottom: 11px; }
        .lp-forgot a { display: flex; align-items: center; justify-content: center; gap: 8px; background: #16a34a; color: #fff; border-radius: 10px; padding: 11px 16px; font-size: 13px; font-weight: 700; text-decoration: none; transition: background .2s; }
        .lp-forgot a:hover { background: #15803d; }
        .lp-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(2,132,199,.08); border: 1px solid rgba(2,132,199,.18); color: #0369a1; border-radius: 99px; padding: 6px 14px; font-size: 12px; font-weight: 600; margin-bottom: 18px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media(min-width:900px) { .mobile-logo { display: none !important; } }
        /* Neutralizar reglas globales de móvil dentro del login */
        .login-root button, .login-root a { min-height: unset !important; min-width: unset !important; }
        .login-root .lp-btn { min-height: 50px !important; width: 100% !important; }
        .login-root .lp-oauth-btn { min-height: 48px !important; }
        .login-root input { font-size: 16px; } /* evita zoom en iOS */
      `}</style>

      <div className="login-root" style={{ background: '#eef5fb', colorScheme: 'light' }}>

        {/* LEFT */}
        <div className="lp-left">
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />
          <div className="lp-grain" />

          {/* Logo arriba a la izquierda (fijo) */}
          <div style={{ position: 'absolute', zIndex: 10, top: 56, left: 64, display: 'flex', alignItems: 'center', gap: 15 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Image src="/images/logo.png" alt="Logo Vanty ABA" width={40} height={40} style={{ objectFit: 'contain' }} />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 16.5, lineHeight: 1.2, letterSpacing: '-0.01em' }}>Vanty ABA</p>
              <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 12, marginTop: 2 }}>{t('auth.centroTerapeutico')}</p>
            </div>
          </div>

          {/* Contenido central — minimalista, mucho aire */}
          <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 540 }}>
            <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 'clamp(46px, 4.2vw, 66px)', lineHeight: 1.0, letterSpacing: '-0.035em', marginBottom: 26 }}>
              <span className="lp-line" style={{ animationDelay: '.05s' }}>Tu hijo merece</span>
              <span className="lp-line" style={{ animationDelay: '.2s', color: '#7dd3fc' }}>lo mejor.</span>
            </h2>
            <p className="lp-hero-anim" style={{ color: 'rgba(255,255,255,.62)', fontSize: 17, lineHeight: 1.7, maxWidth: 400, animationDelay: '.38s' }}>
              Acompañamiento clínico ABA con inteligencia artificial, para seguir de cerca cada paso de su desarrollo.
            </p>

            {/* Lema de marca con acento arcoíris animado */}
            <div className="lp-hero-anim" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 56, animationDelay: '.52s' }}>
              <span className="lp-accent-line" style={{ width: 40, height: 3, borderRadius: 99 }} />
              <span style={{ color: 'rgba(255,255,255,.78)', fontSize: 16, fontStyle: 'italic', letterSpacing: '0.01em' }}>Todos somos diferentes</span>
            </div>
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
                <p style={{ fontWeight: 800, color: '#0c4a6e', fontSize: 14, lineHeight: 1.2, margin: 0 }}>Vanty ABA</p>
                <p style={{ color: '#6b7280', fontSize: 11, margin: 0 }}>Centro Terapéutico</p>
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
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 14, padding: 0, fontFamily: 'inherit', display: 'block' }}>
                  ¿Olvidaste tu contraseña?
                </button>
              )}

              {showForgotInfo && (
                <div className="lp-forgot">
                  <p>Comunícate con <strong>Vanty ABA</strong> {t('auth.restablecen')}</p>
                  <a href="https://wa.me/51994196916?text=Hola,%20olvidé%20mi%20contraseña." target="_blank" rel="noopener noreferrer">
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

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>{isSignUp ? '¿Ya tienes cuenta? ' : '¿Primera vez? '}</span>
              <button onClick={() => { setIsSignUp(!isSignUp); setErrorMessage(''); setShowForgotInfo(false) }}
                style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
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
