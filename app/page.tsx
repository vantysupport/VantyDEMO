import { redirect } from 'next/navigation'

// La página raíz redirige directamente al login.
export default function RootPage() {
  redirect('/login')
}
