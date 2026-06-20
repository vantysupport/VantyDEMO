'use client'
// Pantalla mostrada cuando un CENTRO DEMO está apagado o vencido.
// El proxy redirige aquí; aquí cerramos su sesión para que no quede a medias.

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Clock, PowerOff } from 'lucide-react'

export default function DemoFinalizadaPage() {
  return (
    <Suspense fallback={null}>
      <DemoFinalizada />
    </Suspense>
  )
}

function DemoFinalizada() {
  const params = useSearchParams()
  const router = useRouter()
  const reason = params.get('reason') === 'expired' ? 'expired' : 'disabled'
  const [done, setDone] = useState(false)

  useEffect(() => {
    (async () => {
      try { await supabase.auth.signOut() } catch { /* noop */ }
      setDone(true)
    })()
  }, [])

  const expired = reason === 'expired'

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d1117] px-5">
      <div className="max-w-md w-full text-center rounded-2xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
        <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-5
          ${expired ? 'bg-amber-500/10 border border-amber-400/20' : 'bg-rose-500/10 border border-rose-400/20'}`}>
          {expired
            ? <Clock size={26} className="text-amber-400" />
            : <PowerOff size={26} className="text-rose-400" />}
        </div>

        <h1 className="text-xl font-black text-white">
          {expired ? 'Tu demo finalizó' : 'Acceso de demo suspendido'}
        </h1>

        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          {expired
            ? 'El periodo de prueba de este centro llegó a su fin. Si deseás continuar usando la plataforma, contactá al administrador para reactivar o ampliar tu acceso.'
            : 'El acceso de demo de este centro fue desactivado temporalmente. Si creés que es un error, contactá al administrador.'}
        </p>

        <button
          onClick={() => router.replace('/login')}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-sky-600 hover:bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition-colors"
        >
          Volver al inicio
        </button>

        {!done && <p className="mt-4 text-[11px] text-slate-600">Cerrando sesión…</p>}
      </div>
    </div>
  )
}
