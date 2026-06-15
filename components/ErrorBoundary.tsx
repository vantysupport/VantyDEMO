'use client'
// components/ErrorBoundary.tsx
// Atrapa errores de renderizado de React. A los usuarios SOLO les muestra un
// mensaje genérico de soporte (nunca el detalle técnico). El error real se
// registra en /api/control para que solo el programador lo vea.

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { logClientError } from '@/lib/control'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logClientError(
      error?.message || 'Error de renderizado',
      `${error?.stack || ''}\n--- componentStack ---\n${info?.componentStack || ''}`,
      'react-boundary',
    )
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc', fontFamily: 'var(--font-sans, system-ui)' }}>
        <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20, padding: '32px 28px', boxShadow: '0 12px 40px rgba(15,23,42,.08)' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <AlertTriangle size={28} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>La web está presentando inconvenientes</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
            Estamos trabajando para solucionarlo. Por favor, comuníquese con soporte.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); if (typeof location !== 'undefined') location.reload() }}
            style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: '#0284c7', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }
}
