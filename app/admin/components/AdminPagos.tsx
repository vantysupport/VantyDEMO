'use client'
// El admin/jefe usa el mismo módulo de pagos que secretaria
// (acceso completo a registros, dashboard y tarifas)
import SecretariaPagos from '@/app/secretaria/components/SecretariaPagos'

export default function AdminPagos({ profile, enabledTabs }: { profile: any; enabledTabs?: Record<string, boolean> }) {
  return <SecretariaPagos profile={profile} enabledTabs={enabledTabs} />
}
