'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// El tema puede ser:
//   · 'light'  → forzado a claro
//   · 'dark'   → forzado a oscuro
//   · 'system' → sigue automáticamente al sistema operativo (default)
type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: ThemeMode               // El modo configurado por el usuario
  resolved: 'light' | 'dark'     // El modo efectivo aplicado (siempre concreto)
  toggleTheme: () => void        // Ciclo: light → dark → system → light...
  setTheme: (m: ThemeMode) => void
  isDark: boolean                // Atajo: resolved === 'dark'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolved: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: false,
})

const STORAGE_KEY = 'app-theme'

function isLoginPage(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname
  return path === '/login' || path === '/'
}

function applyDarkClass(isDark: boolean) {
  if (typeof document === 'undefined') return
  if (isLoginPage()) {
    document.documentElement.classList.remove('dark')
    return
  }
  document.documentElement.classList.toggle('dark', isDark)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Iniciamos en 'system' por defecto. Si hay un valor válido en localStorage,
  // se aplica en el efecto de hidratación.
  const [theme, setThemeState] = useState<ThemeMode>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')

  // ── Hidratar el theme desde localStorage al montar ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored)
      }
    } catch { /* localStorage puede no estar disponible */ }
  }, [])

  // ── Calcular el modo resuelto y aplicar la clase, reaccionando a cambios del OS ──
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const compute = () => {
      const wantsDark = theme === 'dark' || (theme === 'system' && mq.matches)
      setResolved(wantsDark ? 'dark' : 'light')
      applyDarkClass(wantsDark)
    }

    compute()

    // Solo escuchamos cambios del sistema cuando estamos en modo 'system'.
    // En 'light' o 'dark' forzados, ignoramos al OS.
    if (theme === 'system') {
      const handler = () => compute()
      // addEventListener moderna; algunos browsers viejos requieren addListener
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handler)
        return () => mq.removeEventListener('change', handler)
      } else if (typeof (mq as any).addListener === 'function') {
        (mq as any).addListener(handler)
        return () => (mq as any).removeListener(handler)
      }
    }
  }, [theme])

  // ── Reaplicar al navegar entre rutas (login vs no-login) ──
  useEffect(() => {
    const handleRouteChange = () => applyDarkClass(resolved === 'dark')
    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [resolved])

  const setTheme = useCallback((next: ThemeMode) => {
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    // Ciclo: light → dark → light... (solo dos estados, sin "system")
    setThemeState(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(STORAGE_KEY, next) } catch {}
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolved, toggleTheme, setTheme, isDark: resolved === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

// ─── Botón de toggle con 2 estados: claro / oscuro ──────────────────────────
export function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme, isDark } = useTheme()

  const tooltipMap: Record<ThemeMode, string> = {
    light:  'Modo claro · Click para oscuro',
    dark:   'Modo oscuro · Click para claro',
    system: 'Modo claro · Click para oscuro',
  }

  return (
    <button
      onClick={toggleTheme}
      title={tooltipMap[theme]}
      aria-label={tooltipMap[theme]}
      className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200
        ${isDark
          ? 'bg-slate-700 hover:bg-slate-600 text-yellow-400'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
        } ${className}`}
    >
      {isDark ? (
        // Sol (estás en oscuro, click va a claro)
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        // Luna (estás en claro, click iría a oscuro)
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  )
}

export default ThemeProvider
