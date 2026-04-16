'use client'

// Reutiliza el CalendarView del admin — mismo diseño, mismas funcionalidades
import CalendarView from '@/app/admin/components/CalendarView'

export default function SecretariaAgenda({ profile }: { profile?: any }) {
  return <CalendarView />
}
