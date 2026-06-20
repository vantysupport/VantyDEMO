// app/api/pagos/recibo-paquete/route.ts
// Genera un recibo PDF agrupando múltiples pagos (paquete de sesiones)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtShort(iso: string) {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`
}
function fmtMoney(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function padNum(n: number) { return String(n).padStart(4, '0') }

async function getCenterInfo() {
  try {
    const { data } = await supabase.from('centro_instrucciones').select('*').limit(1).single()
    if (data) return { nombre: data.nombre_centro || 'Vanty ABA', ruc: data.ruc || '', direccion: data.direccion || '', telefono: data.telefono || '', email: data.email || '' }
  } catch {}
  return { nombre: process.env.NEXT_PUBLIC_APP_NAME || 'Vanty ABA', ruc: '', direccion: '', telefono: '', email: '' }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ids     = searchParams.get('ids')?.split(',').filter(Boolean) || []
  const childId = searchParams.get('child_id')
  const month   = searchParams.get('month') // YYYY-M (optional, for month filter)

  if (ids.length === 0 && !childId) {
    return NextResponse.json({ error: 'Falta ids o child_id' }, { status: 400 })
  }

  try {
    let query = supabase
      .from('payments')
      .select('*, children(id, name, parent_id, profiles:parent_id(full_name, email, phone))')
      .order('paid_at', { ascending: true })
      .order('created_at', { ascending: true })

    if (ids.length > 0) {
      query = query.in('id', ids)
    } else if (childId) {
      query = query.eq('child_id', childId)
      if (month) {
        const [y, m] = month.split('-').map(Number)
        const start  = `${y}-${String(m).padStart(2,'0')}-01`
        const end    = new Date(y, m, 0)
        query = query.gte('created_at', start).lte('created_at', end.toISOString().split('T')[0] + 'T23:59:59')
      }
    }

    const { data: payments, error } = await query
    if (error || !payments?.length) return NextResponse.json({ error: 'Sin pagos encontrados' }, { status: 404 })

    const center        = await getCenterInfo()
    const child         = payments[0].children
    const parentProfile = (child as any)?.profiles

    const total     = payments.reduce((a, p) => a + Number(p.amount), 0)
    const paid      = payments.filter(p => p.status === 'paid')
    const pending   = payments.filter(p => p.status === 'pending')
    const totalPaid = paid.reduce((a, p) => a + Number(p.amount), 0)
    const totalPend = pending.reduce((a, p) => a + Number(p.amount), 0)

    const { count } = await supabase.from('payments').select('*', { count: 'exact', head: true })
      .eq('child_id', child?.id).lte('created_at', payments[0].created_at)

    const reciboNum = `PKG-${new Date(payments[0].created_at).getFullYear()}-${padNum(count || 1)}`
    const logoUrl   = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/images/logo.png` : null

    const STATUS: Record<string, { label: string; color: string; bg: string }> = {
      paid:      { label: 'Pagado',    color: '#059669', bg: '#dcfce7' },
      pending:   { label: 'Pendiente', color: '#b45309', bg: '#fef9c3' },
      partial:   { label: 'Parcial',   color: '#1d4ed8', bg: '#dbeafe' },
      cancelled: { label: 'Cancelado', color: '#dc2626', bg: '#fee2e2' },
      refunded:  { label: 'Devuelto',  color: '#7c3aed', bg: '#ede9fe' },
    }

    const firstDate = payments[0].paid_at || payments[0].created_at
    const lastDate  = payments[payments.length - 1].paid_at || payments[payments.length - 1].created_at

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo Paquete ${reciboNum}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#eef2f7;display:flex;flex-direction:column;align-items:center;padding:32px 16px}
    .w{width:100%;max-width:720px}
    .doc{background:#fff;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)}

    .hdr{padding:28px 40px 24px;border-bottom:3px solid #1e3a5f;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
    .hl{display:flex;align-items:flex-start;gap:14px}
    .logo{width:56px;height:56px;border-radius:10px;background:#f1f5f9;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .logo img{width:100%;height:100%;object-fit:contain}
    .cn{font-size:20px;font-weight:900;color:#0f172a;line-height:1}
    .cs{font-size:11px;color:#6b7280;margin-top:3px}
    .ci{margin-top:8px;display:flex;flex-direction:column;gap:2px}
    .ci span{font-size:11px;color:#374151}
    .ruc{font-size:13px;font-weight:800;color:#1e3a5f}
    .hr{text-align:right;flex-shrink:0}
    .rl{font-size:9px;font-weight:700;letter-spacing:2px;color:#9ca3af;text-transform:uppercase}
    .rn{font-size:24px;font-weight:900;color:#1e3a5f;line-height:1.1;margin-top:4px}
    .rd{font-size:11px;color:#6b7280;margin-top:6px}

    .sbar{padding:10px 40px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e5e7eb;background:#eff6ff}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800}
    .badge::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0}
    .sinfo{font-size:11px;color:#6b7280}

    .body{padding:28px 40px}
    .st{font-size:9px;font-weight:800;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;margin-top:24px}
    .st:first-child{margin-top:0}

    .cg{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:4px}
    .ci2 label{font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px}
    .ci2 p{font-size:13px;font-weight:600;color:#111827}

    table{width:100%;border-collapse:collapse}
    thead tr{background:#f8fafc;border-bottom:2px solid #e5e7eb}
    thead th{font-size:9px;font-weight:800;letter-spacing:1.5px;color:#9ca3af;text-transform:uppercase;padding:10px 12px;text-align:left}
    th.ac,td.ac{text-align:center}
    th.ar,td.ar{text-align:right;white-space:nowrap}
    tbody tr{border-bottom:1px solid #f1f5f9}
    tbody tr:last-child{border-bottom:none}
    tbody td{padding:9px 12px;font-size:12.5px;color:#374151;vertical-align:middle}
    td.ar{font-weight:700}
    .db{display:inline-block;background:rgba(59,130,246,0.1);color:#2563eb;font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px}
    .sdot{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:999px}

    .sumbox{margin-top:20px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
    .srow{display:flex;justify-content:space-between;align-items:center;padding:11px 20px;border-bottom:1px solid #f1f5f9}
    .srow:last-child{border-bottom:none;background:#f0fdf4;border-top:2px solid #86efac}
    .slbl{font-size:12px;color:#374151}
    .sval{font-size:13px;font-weight:700}
    .stlbl{font-size:13px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.5px}
    .stval{font-size:28px;font-weight:900;color:#059669}

    .foot{border-top:1px solid #e5e7eb;background:#f8fafc;padding:18px 40px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
    .fl{font-size:11px;color:#6b7280;line-height:1.9}
    .fl strong{color:#374151;font-weight:700}
    .fr{font-size:10px;color:#9ca3af;text-align:right;line-height:1.9;flex-shrink:0}

    .actions{margin-top:16px;display:flex;gap:8px;justify-content:center}
    .bp{background:#1e3a5f;color:#fff;border:none;padding:11px 28px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
    .bc{background:#f1f5f9;color:#374151;border:none;padding:11px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}

    @media print{
      html,body{margin:0;padding:0;background:white}
      .w{max-width:100%}
      .doc{box-shadow:none}
      .actions{display:none}
    }
  </style>
</head>
<body>
<div class="w">
<div class="doc">

  <div class="hdr">
    <div class="hl">
      <div class="logo">
        ${logoUrl ? `<img src="${logoUrl}" alt="logo" onerror="this.style.display='none'"/>` : `<span style="font-size:20px;font-weight:900;color:#1e3a5f">JA</span>`}
      </div>
      <div>
        <p class="cn">${center.nombre}</p>
        <p class="cs">Centro de Terapias ABA</p>
        <div class="ci">
          ${center.ruc       ? `<span class="ruc">RUC: ${center.ruc}</span>` : ''}
          ${center.direccion ? `<span>${center.direccion}</span>` : ''}
          ${center.telefono  ? `<span>Tel. ${center.telefono}</span>` : ''}
          ${center.email     ? `<span>${center.email}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="hr">
      <p class="rl">Recibo de Paquete</p>
      <p class="rn">#${reciboNum}</p>
      <p class="rd">Emitido el ${fmtDate(new Date().toISOString())}</p>
    </div>
  </div>

  <div class="sbar">
    <span class="badge" style="background:#dbeafe;color:#1d4ed8">${payments.length} sesiones · ${fmtShort(firstDate)} — ${fmtShort(lastDate)}</span>
    <span class="sinfo">${paid.length} pagadas · ${pending.length} pendientes</span>
  </div>

  <div class="body">

    <p class="st">Datos del cliente</p>
    <div class="cg">
      <div class="ci2"><label>Paciente</label><p>${child?.name || '—'}</p></div>
      <div class="ci2"><label>Responsable / Tutor</label><p>${parentProfile?.full_name || '—'}</p></div>
      ${parentProfile?.phone ? `<div class="ci2"><label>Teléfono</label><p>${parentProfile.phone}</p></div>` : ''}
      ${parentProfile?.email ? `<div class="ci2"><label>Correo</label><p style="font-weight:400;color:#374151">${parentProfile.email}</p></div>` : ''}
    </div>

    <p class="st">Detalle de sesiones (${payments.length} en total)</p>
    <table>
      <thead>
        <tr>
          <th style="width:8%">Día</th>
          <th style="width:13%">Fecha</th>
          <th style="width:35%">Concepto</th>
          <th class="ac" style="width:14%">Método</th>
          <th class="ac" style="width:12%">Estado</th>
          <th class="ar" style="width:18%">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${payments.map(p => {
          const d   = new Date(p.paid_at || p.created_at)
          const day = DAYS_ES[d.getDay()]
          const st  = STATUS[p.status] || { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
          const concept = (p.concept || '—').replace(/ \(\d+\/\d+\)$/, '')
          return `<tr>
            <td><span class="db">${day}</span></td>
            <td style="font-size:12px;color:#6b7280;font-family:monospace">${fmtShort(p.paid_at || p.created_at)}</td>
            <td style="font-size:12.5px;color:#111827;font-weight:600">${concept}</td>
            <td class="ac" style="font-size:12px;color:#374151;text-transform:capitalize">${p.payment_method}</td>
            <td class="ac"><span class="sdot" style="background:${st.bg};color:${st.color}">${st.label}</span></td>
            <td class="ar">${fmtMoney(Number(p.amount))}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>

    <div class="sumbox">
      <div class="srow">
        <span class="slbl">Sesiones pagadas (${paid.length})</span>
        <span class="sval" style="color:#059669">${fmtMoney(totalPaid)}</span>
      </div>
      ${pending.length > 0 ? `
      <div class="srow">
        <span class="slbl">Sesiones pendientes (${pending.length})</span>
        <span class="sval" style="color:#b45309">${fmtMoney(totalPend)}</span>
      </div>` : ''}
      <div class="srow">
        <span class="stlbl">Total del paquete</span>
        <span class="stval">${fmtMoney(total)}</span>
      </div>
    </div>

  </div>

  <div class="foot">
    <div class="fl">
      <strong>${center.nombre}</strong>
      ${center.ruc ? `RUC: ${center.ruc}` : 'Centro de Terapias ABA'}
      ${center.direccion ? `<br/>${center.direccion}` : ''}
      <br/>Este documento es un recibo interno de pago.
    </div>
    <div class="fr">
      Recibo N.° ${reciboNum}<br/>
      ${new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' })}<br/>
      No válido como comprobante SUNAT
    </div>
  </div>

</div>
<div class="actions">
  <button class="bp" onclick="window.print()">Imprimir / Guardar PDF</button>
  <button class="bc" onclick="window.close()">Cerrar</button>
</div>
</div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
    })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
