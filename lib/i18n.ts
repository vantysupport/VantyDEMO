export type Locale = 'es'
export const LOCALES: Locale[] = ['es']
export const DEFAULT_LOCALE: Locale = 'es'

/** Maps app locale to BCP-47 tag for Intl APIs */
export function toBCP47(locale: Locale): string {
  return 'es-PE'
}

export function createTranslator(messages: Record<string, any>) {
  return function t(key: string, vars?: Record<string, string>): string {
    const parts = key.split('.')
    let val: any = messages
    for (const p of parts) { val = val?.[p]; if (val === undefined) break }
    if (typeof val !== 'string') return key
    if (!vars) return val
    return val.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
  }
}
