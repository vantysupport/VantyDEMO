'use client'
// Idioma fijo: Español
export default function LocaleSelector({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold"
      style={{ borderColor: 'var(--card-border)', background: 'var(--card)', color: 'var(--text-secondary)' }}>
      🇵🇪 ES
    </div>
  )
}
