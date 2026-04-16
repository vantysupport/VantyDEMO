'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { createTranslator, type Locale, DEFAULT_LOCALE, LOCALES } from './i18n'
import ES from '../messages/es.json'

const MESSAGES: Record<Locale, Record<string, any>> = { es: ES }

export type T = (key: string, vars?: Record<string, string>) => string
interface I18nCtx { t: T; locale: Locale; changeLocale: (l: Locale) => void }

const I18nContext = createContext<I18nCtx>({
  t: createTranslator(ES),
  locale: 'es',
  changeLocale: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    // Idioma fijo: español
    localStorage.setItem('vanty_locale', 'es')
  }, [])

  const changeLocale = useCallback((_loc: Locale) => {
    // Idioma fijo: no se cambia
  }, [])

  // useMemo: solo recalcula t cuando locale cambia
  const t = useMemo(() => createTranslator(MESSAGES[locale]), [locale])

  const value = useMemo(() => ({ t, locale, changeLocale }), [t, locale, changeLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }
