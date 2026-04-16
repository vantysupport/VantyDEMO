// app/api/facturacion/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  const estado  = searchParams.get('estado')
  const mes     = searchParams.get('mes') // YYYY-MM

  try {
    let query = supabaseAdmin
      .from('facturas')
      .select('*, children(name)')
      .order('fecha_emision', { ascending: false })

    if (childId) query = query.eq('child_id', childId)
    if (estado)  query = query.eq('estado', estado)
    if (mes)     query = query.gte('fecha_emision', mes + '-01').lte('fecha_emision', mes + '-31')

    const { data, error } = await query
    if (error) throw error

    // Calcular totales
    const totalPagado   = data?.filter(f => f.estado === 'pagado').reduce((acc, f) => acc + Number(f.monto), 0) || 0
    const totalPendiente = data?.filter(f => f.estado === 'pendiente').reduce((acc, f) => acc + Number(f.monto), 0) || 0

    return NextResponse.json({ data, resumen: { totalPagado, totalPendiente, totalFacturas: data?.length || 0 } })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'crear' || !action) {
      const { child_id, concepto, monto, moneda, fecha_vencimiento, sesiones_incluidas, notas } = body

      // Auto-generar número de factura
      const { count } = await supabaseAdmin.from('facturas').select('*', { count: 'exact', head: true })
      const numero = `JA-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

      const { data, error } = await supabaseAdmin
        .from('facturas')
        .insert({ child_id, numero, concepto, monto, moneda: moneda || 'PEN', fecha_vencimiento, sesiones_incluidas, notas, estado: 'pendiente' })
        .select('*, children(name)')
        .single()

      if (error) throw error

      // Notificar al padre
      await notificarFactura(child_id, data, 'nueva')
      return NextResponse.json({ data })
    }

    if (action === 'registrar_pago') {
      const { id, metodo_pago, fecha_pago } = body
      const { data, error } = await supabaseAdmin
        .from('facturas')
        .update({ estado: 'pagado', metodo_pago, fecha_pago: fecha_pago || new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .select('*, children(name, id)')
        .single()
      if (error) throw error

      await notificarFactura((data.children as any)?.id, data, 'pagado')
      return NextResponse.json({ data })
    }

    if (action === 'cancelar') {
      const { id } = body
      const { data, error } = await supabaseAdmin
        .from('facturas')
        .update({ estado: 'cancelado' })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ data })
    }

    return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

async function notificarFactura(childId: string, factura: any, tipo: string) {
  try {
    const { data: padres } = await supabaseAdmin.from('parent_accounts').select('user_id').eq('child_id', childId)
    if (!padres || padres.length === 0) return

    const mensajes: Record<string, any> = {
      nueva: {
        titulo: 'Nueva factura emitida',
        mensaje: `Se emitio la factura ${factura.numero} por S/ ${factura.monto} - ${factura.concepto}. Fecha de vencimiento: ${factura.fecha_vencimiento || 'Sin fecha'}.`
      },
      pagado: {
        titulo: 'Pago registrado - Gracias',
        mensaje: `Se registro el pago de la factura ${factura.numero} por S/ ${factura.monto}. Gracias!`
      }
    }

    const notif = mensajes[tipo] || mensajes.nueva
    const notifs = padres.map(p => ({
      user_id: p.user_id, child_id: childId,
      tipo: 'factura_' + tipo, titulo: notif.titulo, mensaje: notif.mensaje,
      prioridad: tipo === 'nueva' ? 2 : 3, canal: 'in_app',
      metadata: { factura_id: factura.id, numero: factura.numero }
    }))
    await supabaseAdmin.from('notificaciones').insert(notifs)
  } catch {}
}
