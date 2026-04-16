// app/api/whatsapp/route.ts
// Proxy al microservicio Baileys + estado del canal

import { NextRequest, NextResponse } from 'next/server'
import { notify, getNotifStatus, type NotifTipo } from '@/lib/notifications'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { tipo, vars, guardar = true, userId, childId } = body

    if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 })

    const sent = await notify({ tipo: tipo as NotifTipo, vars: vars || {} })

    if (guardar && userId) {
      const tipoLabels: Record<string, string> = {
        cita_confirmada:   'Nueva cita agendada',
        cita_cancelada:    'Cita cancelada',
        formulario_nuevo:  'Formulario subido',
        informe_nuevo:     'Informe disponible',
        alerta_clinica:    'Alerta clínica',
        mensaje_terapeuta: 'Mensaje del terapeuta',
        recurso_nuevo:     'Nuevo recurso',
      }
      await supabaseAdmin.from('notificaciones').insert({
        user_id:    userId,
        child_id:   childId || null,
        tipo,
        titulo:     tipoLabels[tipo] || tipo,
        leida:      false,
        created_at: new Date().toISOString(),
      }).maybeSingle()
    }

    return NextResponse.json({ ok: true, sent })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  const status = getNotifStatus()
  return NextResponse.json({
    ...status,
    setup: {
      variables: ['WSP_SERVICE_URL', 'WSP_SERVICE_SECRET'],
      descripcion: 'URL y clave secreta del microservicio Baileys en Railway/Render',
    },
  })
}
