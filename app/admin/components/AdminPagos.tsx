'use client'
// El admin/jefe usa el mismo módulo de pagos que secretaria
// (acceso completo a registros, dashboard y tarifas)
import SecretariaPagos from '@/app/secretaria/components/SecretariaPagos'

export default function AdminPagos({ profile }: { profile: any }) {
  return <SecretariaPagos profile={profile} />
}
