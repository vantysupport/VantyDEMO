// app/api/pagos/recibo-pdf/route.ts
// Genera un recibo de pago en PDF profesional usando jsPDF

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function padRecibo(n: number) { return String(n).padStart(4, '0') }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtCurrency(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Fetch center config ───────────────────────────────────────────────────────
async function getCenterInfo() {
  // Try to get from centro_instrucciones table first, fallback to env
  try {
    const { data } = await supabase.from('centro_instrucciones').select('*').limit(1).single()
    if (data) return {
      nombre: data.nombre_centro || process.env.NEXT_PUBLIC_APP_NAME || 'Neuropsicología y Terapias SANTI',
      ruc:    data.ruc || '',
      direccion: data.direccion || '',
      telefono:  data.telefono || '',
      email:     data.email || '',
    }
  } catch {}
  return {
    nombre:    process.env.NEXT_PUBLIC_APP_NAME || 'Neuropsicología y Terapias SANTI',
    ruc:       process.env.CENTER_RUC || '',
    direccion: process.env.CENTER_ADDRESS || '',
    telefono:  process.env.CENTER_PHONE || '',
    email:     process.env.CENTER_EMAIL || '',
  }
}

// ── PDF generation (pure JS, no jsPDF import needed server-side) ──────────────
// We generate an HTML template and return it as a self-printing page.
// The client will open this in a new tab and the browser handles PDF via print.
function generateReceiptHTML(payment: any, center: any, child: any, parentProfile: any, reciboNum: string) {
  const statusLabels: Record<string, string> = {
    paid: 'PAGADO', pending: 'PENDIENTE', partial: 'PARCIAL',
    cancelled: 'CANCELADO', refunded: 'DEVUELTO',
  }
  const statusColors: Record<string, string> = {
    paid: '#059669', pending: '#b45309', partial: '#1d4ed8',
    cancelled: '#dc2626', refunded: '#7c3aed',
  }
  const statusBg: Record<string, string> = {
    paid: '#dcfce7', pending: '#fef9c3', partial: '#dbeafe',
    cancelled: '#fee2e2', refunded: '#ede9fe',
  }

  const isPaid    = payment.status === 'paid'
  const statusLbl = statusLabels[payment.status] || payment.status.toUpperCase()
  const statusClr = statusColors[payment.status] || '#374151'
  const statusBgC = statusBg[payment.status]     || '#f3f4f6'
  const paidDate  = payment.paid_at ? fmtDate(payment.paid_at) : fmtDate(payment.created_at)
  const emitDate  = fmtDate(payment.created_at)

  const methodIcon: Record<string, string> = {
    yape: 'Yape', plin: 'Plin', efectivo: 'Efectivo',
    transferencia: 'Transferencia Bancaria', tarjeta: 'Tarjeta', otro: 'Otro',
  }

  // Logo URL — use public logo if exists
  const logoUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/images/logo.png`
    : null

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo ${reciboNum}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#eef2f7;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px}
    .wrapper{width:100%;max-width:700px}
    .doc{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.12)}

    /* ── TOP HEADER: empresa ── */
    .top{padding:32px 40px 24px;border-bottom:1px solid #e5e7eb;display:flex;align-items:flex-start;justify-content:space-between;gap:24px}
    .company{display:flex;align-items:center;gap:14px}
    .company-logo{width:54px;height:54px;border-radius:12px;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden}
    .company-logo img{width:100%;height:100%;object-fit:contain}
    .company-text h1{font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.5px}
    .company-text p{font-size:11px;color:#6b7280;margin-top:1px}
    .company-meta{margin-top:8px;display:flex;flex-direction:column;gap:3px}
    .company-meta span{font-size:11px;color:#374151}
    .company-meta .ruc{font-weight:800;color:#1e3a5f;font-size:13px}

    .recibo-info{text-align:right;flex-shrink:0}
    .recibo-info .tipo{font-size:10px;font-weight:700;letter-spacing:2px;color:#9ca3af;text-transform:uppercase}
    .recibo-info .num{font-size:28px;font-weight:900;color:#1e3a5f;line-height:1.1;margin-top:2px}
    .recibo-info .emitido{font-size:11px;color:#6b7280;margin-top:4px}

    /* ── STATUS STRIPE ── */
    .stripe{padding:10px 40px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #f1f5f9}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.5px}
    .badge::before{content:'';width:7px;height:7px;border-radius:50%;background:currentColor}
    .stripe-right{font-size:11px;color:#6b7280}

    /* ── BODY ── */
    .body{padding:32px 40px}

    /* Section title */
    .stitle{font-size:9px;font-weight:800;letter-spacing:2px;color:#9ca3af;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #f1f5f9;margin-bottom:14px}

    /* Grid info */
    .igrid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}
    .iitem label{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px}
    .iitem p{font-size:13px;font-weight:600;color:#111827}
    .iitem p.muted{color:#6b7280;font-weight:400}

    /* ── TABLE ── */
    .tbl{width:100%;border-collapse:collapse;margin-bottom:4px}
    .tbl thead{background:#f8fafc}
    .tbl thead th{font-size:9px;font-weight:800;letter-spacing:1.5px;color:#9ca3af;text-transform:uppercase;padding:10px 12px;text-align:left;border-bottom:2px solid #e5e7eb}
    .tbl thead th.r{text-align:right}
    .tbl thead th.c{text-align:center}
    .tbl tbody tr{border-bottom:1px solid #f1f5f9}
    .tbl tbody tr:last-child{border-bottom:none}
    .tbl tbody td{padding:14px 12px;font-size:13px;color:#374151;vertical-align:top}
    .tbl tbody td.r{text-align:right}
    .tbl tbody td.c{text-align:center}
    .tbl tbody td strong{color:#111827;display:block;font-weight:700;margin-bottom:2px}
    .tbl tbody td .sub{font-size:11px;color:#9ca3af}
    .tbl tbody td .amount{font-size:15px;font-weight:800;color:#059669}

    /* ── TOTAL BOX ── */
    .total-box{background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;margin:20px 0}
    .total-box .lbl{font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:1px}
    .total-box .val{font-size:32px;font-weight:900;color:#059669}

    /* ── PAYMENT INFO ── */
    .pay-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px}
    .pay-item label{font-size:9px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:6px}
    .pill{display:inline-flex;align-items:center;gap:6px;background:#f1f5f9;border-radius:8px;padding:7px 12px;font-size:12px;font-weight:700;color:#374151}
    .pay-item .date{font-size:14px;font-weight:700;color:#111827}

    /* ── CONFIRM BOX ── */
    .confirm{background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-top:20px}
    .confirm p{font-size:12px;color:#166534;font-weight:600}

    /* ── FOOTER ── */
    .footer{background:#f8fafc;border-top:1px solid #e5e7eb;padding:20px 40px;display:flex;align-items:center;justify-content:space-between}
    .footer-l{font-size:11px;color:#6b7280;line-height:1.8}
    .footer-l strong{color:#374151;display:block}
    .footer-r{font-size:10px;color:#9ca3af;text-align:right;line-height:1.8}

    /* Print button */
    .actions{margin-top:16px;display:flex;gap:8px;justify-content:center}
    .btn-print{background:#1e3a5f;color:white;border:none;padding:11px 28px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer}
    .btn-close{background:#f1f5f9;color:#374151;border:none;padding:11px 20px;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer}

    @media print{
      body{background:white;padding:0}
      .doc{box-shadow:none;border-radius:0;max-width:100%}
      .actions{display:none}
      .wrapper{max-width:100%}
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="doc">

      <!-- ── EMPRESA ─────────────────────────────── -->
      <div class="top">
        <div class="company">
          <div class="company-logo">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" onerror="this.style.display='none';this.parentElement.textContent='JA'"/>` : '🎯'}
          </div>
          <div class="company-text">
            <h1>${center.nombre}</h1>
            <p>Centro de Terapias ABA</p>
            <div class="company-meta">
              ${center.ruc ? `<span class="ruc">RUC: ${center.ruc}</span>` : ''}
              ${center.direccion ? `<span>${center.direccion}</span>` : ''}
              ${center.telefono ? `<span>Tel: ${center.telefono}</span>` : ''}
              ${center.email ? `<span>${center.email}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="recibo-info">
          <p class="tipo">Recibo de Pago</p>
          <p class="num">#${reciboNum}</p>
          <p class="emitido">Emitido: ${emitDate}</p>
        </div>
      </div>

      <!-- ── STATUS ─────────────────────────────── -->
      <div class="stripe" style="background:${statusBgC}30">
        <span class="badge" style="background:${statusBgC};color:${statusClr}">${statusLbl}</span>
        <span class="stripe-right">Fecha de pago: <strong>${paidDate}</strong></span>
      </div>

      <!-- ── BODY ──────────────────────────────── -->
      <div class="body">

        <!-- DATOS CLIENTE -->
        <p class="stitle">Datos del cliente</p>
        <div class="igrid">
          <div class="iitem">
            <label>Paciente</label>
            <p>${child?.name || '—'}</p>
          </div>
          <div class="iitem">
            <label>Responsable / Tutor</label>
            <p>${parentProfile?.full_name || '—'}</p>
          </div>
          ${parentProfile?.phone ? `<div class="iitem"><label>Teléfono</label><p>${parentProfile.phone}</p></div>` : ''}
          ${parentProfile?.email ? `<div class="iitem"><label>Correo</label><p class="muted">${parentProfile.email}</p></div>` : ''}
        </div>

        <!-- SERVICIOS -->
        <p class="stitle">Detalle de servicios</p>
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:55%">Descripción</th>
              <th class="c" style="width:12%">Cant.</th>
              <th class="r" style="width:15%">P. Unit.</th>
              <th class="r" style="width:18%">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${payment.concept}</strong>
                ${payment.notes ? `<span class="sub">${payment.notes}</span>` : ''}
              </td>
              <td class="c">1</td>
              <td class="r"><span class="amount">${fmtCurrency(Number(payment.amount))}</span></td>
              <td class="r"><span class="amount">${fmtCurrency(Number(payment.amount))}</span></td>
            </tr>
          </tbody>
        </table>

        <!-- TOTAL -->
        <div class="total-box">
          <div>
            <p class="lbl">Total</p>
            <p style="font-size:11px;color:#6b7280;margin-top:2px">Incluye todos los conceptos</p>
          </div>
          <p class="val">${fmtCurrency(Number(payment.amount))}</p>
        </div>

        <!-- MÉTODO DE PAGO -->
        <div class="pay-grid">
          <div class="pay-item">
            <label>Método de pago</label>
            <span class="pill">${methodIcon[payment.payment_method] || payment.payment_method}</span>
          </div>
          <div class="pay-item">
            <label>Fecha de pago</label>
            <p class="date">${paidDate}</p>
          </div>
        </div>

        ${isPaid ? `
        <div class="confirm">
          <span style="font-size:12px;font-weight:900;color:#059669;background:#dcfce7;padding:3px 8px;border-radius:4px;font-family:monospace">OK</span>
          <p>Pago recibido y confirmado. Gracias por confiar en ${center.nombre}.</p>
        </div>` : ''}

      </div>

      <!-- ── FOOTER ─────────────────────────────── -->
      <div class="footer">
        <div class="footer-l">
          <strong>${center.nombre}</strong>
          ${center.ruc ? `RUC: ${center.ruc}` : 'Centro de Terapias ABA'}
          ${center.direccion ? `<br/>${center.direccion}` : ''}
          <br/>Este documento es un recibo interno de pago.
        </div>
        <div class="footer-r">
          Recibo N° ${reciboNum}<br/>
          ${new Date().toLocaleDateString('es-PE')}<br/>
          <span style="color:#d1d5db">No válido como comprobante SUNAT</span>
        </div>
      </div>
    </div>

    <!-- Botones (no imprimen) -->
    <div class="actions">
      <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
      <button class="btn-close" onclick="window.close()">Cerrar</button>
    </div>
  </div>
</body>
</html>`
}


// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const paymentId = searchParams.get('id')

  if (!paymentId) {
    return NextResponse.json({ error: 'Falta el ID del pago' }, { status: 400 })
  }

  try {
    // 1. Fetch payment with child and parent profile
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        *,
        children (
          id, name, parent_id,
          profiles:parent_id ( full_name, email, phone )
        )
      `)
      .eq('id', paymentId)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    // 2. Count prior payments for this child to generate sequential receipt number
    const { count } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('child_id', payment.child_id)
      .lte('created_at', payment.created_at)

    const reciboNum = `${new Date(payment.created_at).getFullYear()}-${padRecibo(count || 1)}`

    // 3. Get center info
    const center = await getCenterInfo()

    // 4. Get child and parent info
    const child         = payment.children
    const parentProfile = (child as any)?.profiles

    // 5. Generate HTML receipt
    const html = generateReceiptHTML(payment, center, child, parentProfile, reciboNum)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (e: any) {
    console.error('Error generando recibo:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
