'use client'

import { useI18n } from '@/lib/i18n-context'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const { t } = useI18n()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Give Supabase time to process the OAuth tokens from the URL hash/params
        await new Promise(r => setTimeout(r, 800))

        let session = (await supabase.auth.getSession()).data.session

        // If no session, try manual code exchange
        if (!session) {
          const code = new URLSearchParams(window.location.search).get('code')
          if (code) {
            const { data } = await supabase.auth.exchangeCodeForSession(code)
            session = data.session
          }
        }

        // One more retry with longer wait
        if (!session) {
          await new Promise(r => setTimeout(r, 1500))
          session = (await supabase.auth.getSession()).data.session
        }

        if (!session) {
          router.replace('/login?error=no_session')
          return
        }

        const user = session.user
        const oauthName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.preferred_username ||
          null

        const { data: profile } = await supabase
          .from('profiles').select('role, full_name').eq('id', user.id).single()

        if (!profile) {
          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email || user.user_metadata?.email,
            full_name: oauthName || user.email?.split('@')[0] || 'Usuario',
            role: 'padre',
          })
          router.replace('/padre')
          return
        }

        if (!profile.full_name && oauthName) {
          await supabase.from('profiles').update({ full_name: oauthName }).eq('id', user.id)
        }

        const adminRoles = ['admin', 'jefe', 'especialista', 'terapeuta']
        if (adminRoles.includes(profile.role)) router.replace('/admin')
        else if (profile.role === 'secretaria') router.replace('/secretaria')
        else router.replace('/padre')

      } catch (e: any) {
        console.error('Callback error:', e.message)
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session) { router.replace('/padre'); return }
        } catch {}
        router.replace('/login?error=callback')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
      color: '#fff', fontFamily: 'system-ui, sans-serif', gap: 16
    }}>
      <div style={{
        width: 48, height: 48, border: '4px solid rgba(255,255,255,.2)',
        borderTop: '4px solid #fff', borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <p style={{ fontSize: 16, opacity: .8 }}>Iniciando sesión…</p>
    </div>
  )
}
