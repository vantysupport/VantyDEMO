import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { requireRole, STAFF_ROLES } from '@/lib/require-staff'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  partial: 'Parcial',
  cancelled: 'Cancelado',
  refunded: 'Devuelto',
}

const STATUS_COLORS: Record<string, { fill: string; font: string }> = {
  paid:      { fill: 'FFD1FAE5', font: 'FF065F46' },
  pending:   { fill: 'FFFEF3C7', font: 'FF92400E' },
  partial:   { fill: 'FFDBEAFE', font: 'FF1E40AF' },
  cancelled: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  refunded:  { fill: 'FFEDE9FE', font: 'FF5B21B6' },
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, STAFF_ROLES)
  if (!auth.ok) return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const status = searchParams.get('status') || 'all'
  const search = searchParams.get('search') || ''

  let query = supabase
    .from('payments')
    .select('*, children(name)')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(500)

  if (auth.tenantId) query = query.eq('tenant_id', auth.tenantId)  // 🔒 por centro
  if (status !== 'all') query = query.eq('status', status)

  const { data: pays, error } = await query
  if (error) return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })

  const filtered = (pays || []).filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (p.children?.name || '').toLowerCase().includes(q) || p.concept.toLowerCase().includes(q)
  })

  // Build workbook
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Vanty ABA'
  wb.created = new Date()

  const ws = wb.addWorksheet('Pagos y Facturación', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
  })

  // Column widths
  ws.columns = [
    { key: 'paciente',  width: 28 },
    { key: 'concepto',  width: 30 },
    { key: 'monto',     width: 14 },
    { key: 'metodo',    width: 16 },
    { key: 'estado',    width: 14 },
    { key: 'fecha',     width: 14 },
  ]

  // ── Title row ──────────────────────────────────────────────────────────────
  ws.mergeCells('A1:F1')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'Pagos y Facturación — Vanty ABA'
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1e3a5f' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0f6ff' } }
  ws.getRow(1).height = 28

  // Subtitle
  ws.mergeCells('A2:F2')
  const sub = ws.getCell('A2')
  sub.value = `Exportado el ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })} · ${filtered.length} registros`
  sub.font = { size: 10, color: { argb: 'FF6b7280' } }
  sub.alignment = { horizontal: 'center' }
  ws.getRow(2).height = 18

  ws.addRow([]) // spacer

  // ── Header row ─────────────────────────────────────────────────────────────
  const headers = ['Paciente', 'Concepto', 'Monto (S/)', 'Método', 'Estado', 'Fecha']
  const headerRow = ws.addRow(headers)
  headerRow.height = 20
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF1D4ED8' } },
    }
  })

  // ── Data rows ──────────────────────────────────────────────────────────────
  filtered.forEach((p, idx) => {
    const st = STATUS_COLORS[p.status] || { fill: 'FFF3F4F6', font: 'FF374151' }
    const row = ws.addRow([
      p.children?.name || '—',
      p.concept,
      Number(p.amount),
      (p.payment_method || '').charAt(0).toUpperCase() + (p.payment_method || '').slice(1),
      STATUS_LABELS[p.status] || p.status,
      new Date(p.created_at).toLocaleDateString('es-PE'),
    ])
    row.height = 18

    // Alternating background
    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC'

    row.eachCell((cell, col) => {
      cell.font = { size: 10, color: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle', horizontal: col === 3 ? 'right' : col === 6 ? 'center' : 'left' }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
      }
    })

    // Amount in green
    const amountCell = row.getCell(3)
    amountCell.numFmt = '"S/ "#,##0.00'
    amountCell.font = { size: 10, bold: true, color: { argb: 'FF059669' } }

    // Status with color
    const statusCell = row.getCell(5)
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } }
    statusCell.font = { size: 10, bold: true, color: { argb: st.font } }
    statusCell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  // ── Summary rows ───────────────────────────────────────────────────────────
  ws.addRow([])
  const paid = filtered.filter(p => p.status === 'paid')
  const pending = filtered.filter(p => p.status === 'pending')
  const totalPaid = paid.reduce((a, p) => a + Number(p.amount), 0)
  const totalPending = pending.reduce((a, p) => a + Number(p.amount), 0)

  const summaryData = [
    ['Total Pagado', '', totalPaid, '', '', ''],
    ['Total Pendiente', '', totalPending, '', '', ''],
  ]
  summaryData.forEach(([label, , value]) => {
    const row = ws.addRow([label, '', value, '', '', ''])
    row.getCell(1).font = { bold: true, size: 10, color: { argb: 'FF374151' } }
    row.getCell(3).numFmt = '"S/ "#,##0.00'
    row.getCell(3).font = { bold: true, size: 11, color: { argb: 'FF059669' } }
    row.getCell(3).alignment = { horizontal: 'right' }
  })

  // Generate buffer
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="pagos_${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  })
}
