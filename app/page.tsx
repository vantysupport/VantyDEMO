import { redirect } from 'next/navigation'

// La página raíz redirige directamente al login.
// No hay landing page pública - los usuarios deben autenticarse.
export default function RootPage() {
  redirect('/login')
}
