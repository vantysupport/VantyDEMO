// app/api/pagos/reporte-mensual/route.ts
// Genera un reporte mensual profesional en Excel con múltiples hojas

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import ExcelJS from 'exceljs'
import { requireRole, STAFF_ROLES } from '@/lib/require-staff'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pagado', pending: 'Pendiente', partial: 'Parcial',
  cancelled: 'Cancelado', refunded: 'Devuelto',
}
const STATUS_COLORS: Record<string, { fill: string; font: string }> = {
  paid:      { fill: 'FFD1FAE5', font: 'FF065F46' },
  pending:   { fill: 'FFFEF3C7', font: 'FF92400E' },
  partial:   { fill: 'FFDBEAFE', font: 'FF1E40AF' },
  cancelled: { fill: 'FFFEE2E2', font: 'FF991B1B' },
  refunded:  { fill: 'FFEDE9FE', font: 'FF5B21B6' },
}

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  navy:      'FF1E3A5F',
  navyLight: 'FF2563EB',
  white:     'FFFFFFFF',
  green:     'FF059669',
  greenBg:   'FFD1FAE5',
  amber:     'FFB45309',
  amberBg:   'FFFEF3C7',
  red:       'FFDC2626',
  redBg:     'FFFEE2E2',
  gray1:     'FFF8FAFC',
  gray2:     'FFF1F5F9',
  gray3:     'FFE2E8F0',
  gray4:     'FF94A3B8',
  dark:      'FF111827',
  mid:       'FF374151',
  light:     'FF6B7280',
}

// ── Helper: styled cell ───────────────────────────────────────────────────────
function cell(ws: ExcelJS.Worksheet, addr: string, value: any, opts: {
  bold?: boolean; size?: number; color?: string; bg?: string;
  align?: 'left'|'center'|'right'; italic?: boolean; border?: boolean; numFmt?: string; wrap?: boolean
} = {}) {
  const c = ws.getCell(addr)
  c.value = value
  c.font = {
    name: 'Calibri', size: opts.size || 10,
    bold: opts.bold, italic: opts.italic,
    color: { argb: opts.color || C.dark },
  }
  if (opts.bg) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.bg } }
  if (opts.align) c.alignment = { horizontal: opts.align, vertical: 'middle', wrapText: opts.wrap }
  if (opts.numFmt) c.numFmt = opts.numFmt
  if (opts.border) {
    const brd = { style: 'thin' as const, color: { argb: C.gray3 } }
    c.border = { top: brd, bottom: brd, left: brd, right: brd }
  }
  return c
}

function hdr(ws: ExcelJS.Worksheet, addr: string, value: string, cols = 1) {
  const c = ws.getCell(addr)
  c.value = value
  c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
  c.alignment = { horizontal: 'center', vertical: 'middle' }
  c.border = { bottom: { style: 'medium', color: { argb: C.navyLight } } }
  return c
}

function sectionTitle(ws: ExcelJS.Worksheet, row: number, cols: string, title: string) {
  const c = ws.getCell(`A${row}`)
  c.value = title
  c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.navy } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gray2 } }
  c.alignment = { vertical: 'middle' }
  ws.getRow(row).height = 22
  // Just style A, merge is done via col param
  return c
}

async function getCenterInfo() {
  try {
    const { data } = await supabase.from('centro_instrucciones').select('*').limit(1).single()
    if (data) return { nombre: data.nombre_centro || 'Vanty ABA', ruc: data.ruc || '', direccion: data.direccion || '' }
  } catch {}
  return { nombre: 'Vanty ABA', ruc: '', direccion: '' }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, STAFF_ROLES)
  if (!auth.ok) return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const anio = Number(searchParams.get('anio') || new Date().getFullYear())
  const mes  = Number(searchParams.get('mes')  || new Date().getMonth() + 1) // 1-12

  // mes=0 means full year report
  const isFullYear = mes === 0
  const inicio = isFullYear
    ? `${anio}-01-01`
    : `${anio}-${String(mes).padStart(2,'0')}-01`
  const fin = isFullYear
    ? `${anio}-12-31`
    : new Date(anio, mes, 0).toISOString().split('T')[0] // last day of month

  try {
    let payQuery = supabase.from('payments')
      .select('*, children(name, id)')
      .gte('created_at', inicio)
      .lte('created_at', fin + 'T23:59:59')
      .order('paid_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1000)
    if (auth.tenantId) payQuery = payQuery.eq('tenant_id', auth.tenantId)  // 🔒 por centro
    const [{ data: pays }, center] = await Promise.all([payQuery, getCenterInfo()])

    const all   = pays || []
    const paid  = all.filter(p => p.status === 'paid')
    const pend  = all.filter(p => p.status === 'pending')
    const canc  = all.filter(p => p.status === 'cancelled')
    const sum   = (arr: any[]) => arr.reduce((a, p) => a + Number(p.amount), 0)

    const totalPaid = sum(paid)
    const totalPend = sum(pend)
    const totalCanc = sum(canc)
    const totalAll  = sum(all)
    const tasaCobro = all.length > 0 ? Math.round(paid.length / all.length * 100) : 0

    const mesLabel = isFullYear ? `Año ${anio}` : `${MESES[mes-1]} ${anio}`
    const emitDate = new Date().toLocaleDateString('es-PE', { day:'2-digit', month:'long', year:'numeric' })

    // Group by patient
    const byPatient: Record<string, { name: string; pays: any[]; total: number }> = {}
    all.forEach(p => {
      const id = p.child_id || 'sin'
      if (!byPatient[id]) byPatient[id] = { name: p.children?.name || 'Sin paciente', pays: [], total: 0 }
      byPatient[id].pays.push(p)
      byPatient[id].total += Number(p.amount)
    })
    const patients = Object.values(byPatient).sort((a, b) => b.total - a.total)

    // Group by concept/service
    const byService: Record<string, { count: number; total: number }> = {}
    paid.forEach(p => {
      const s = (p.concept || 'Otro').replace(/ \(\d+\/\d+\)$/, '')
      if (!byService[s]) byService[s] = { count: 0, total: 0 }
      byService[s].count++
      byService[s].total += Number(p.amount)
    })

    // Group by payment method
    const byMethod: Record<string, number> = {}
    paid.forEach(p => {
      const m = p.payment_method || 'otro'
      byMethod[m] = (byMethod[m] || 0) + Number(p.amount)
    })

    // ── BUILD WORKBOOK ────────────────────────────────────────────────────────
    const wb  = new ExcelJS.Workbook()
    wb.creator   = center.nombre
    wb.created   = new Date()
    wb.modified  = new Date()
    wb.properties.date1904 = false

    // ══════════════════════════════════════════════════════════════════════════
    // HOJA 1 — RESUMEN EJECUTIVO
    // ══════════════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet('Resumen', { properties: { tabColor: { argb: C.navy } } })
    ws1.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 } }

    ws1.columns = [
      { key: 'a', width: 28 },
      { key: 'b', width: 18 },
      { key: 'c', width: 18 },
      { key: 'd', width: 18 },
    ]

    // ── Banner ──
    ws1.mergeCells('A1:D1')
    const bannerCell = ws1.getCell('A1')
    bannerCell.value = center.nombre.toUpperCase()
    bannerCell.font  = { name: 'Calibri', size: 16, bold: true, color: { argb: C.white } }
    bannerCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
    bannerCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getRow(1).height = 36

    ws1.mergeCells('A2:D2')
    const subBanner = ws1.getCell('A2')
    subBanner.value = `Reporte Financiero Mensual — ${mesLabel}`
    subBanner.font  = { name: 'Calibri', size: 12, bold: true, color: { argb: C.white } }
    subBanner.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navyLight } }
    subBanner.alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getRow(2).height = 24

    ws1.mergeCells('A3:D3')
    const meta = ws1.getCell('A3')
    meta.value = `${center.ruc ? `RUC: ${center.ruc}   ·   ` : ''}Emitido el ${emitDate}   ·   ${center.direccion || 'Centro de Terapias ABA'}`
    meta.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: C.light } }
    meta.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.gray1 } }
    meta.alignment = { horizontal: 'center', vertical: 'middle' }
    ws1.getRow(3).height = 18
    ws1.addRow([])

    // ── KPIs ──
    ws1.mergeCells('A5:D5')
    sectionTitle(ws1, 5, 'A5:D5', '  INDICADORES CLAVE DEL MES')

    const kpiHeaders = ['Indicador', 'Importe', 'Cantidad', 'Detalle']
    ws1.getRow(6).values = kpiHeaders
    ws1.getRow(6).eachCell(c => {
      c.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    ws1.getRow(6).height = 20

    const kpiData = [
      ['Total Facturado',  totalAll,  all.length,  `${tasaCobro}% tasa de cobro`],
      ['Cobrado',          totalPaid, paid.length, `${MESES[mes-1]} ${anio}`],
      ['Pendiente',        totalPend, pend.length, 'Por cobrar'],
      ['Cancelado',        totalCanc, canc.length, 'No realizadas'],
    ]
    const kpiColors = [C.navy, C.green, C.amber, C.red]
    const kpiBgs    = ['FFEFF6FF', C.greenBg, C.amberBg, C.redBg]

    kpiData.forEach(([label, amount, count, detail], i) => {
      const r   = ws1.getRow(7 + i)
      r.values  = [label, amount, count, detail]
      r.height  = 22
      r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: kpiColors[i] } }
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiBgs[i] } }
      r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      r.getCell(2).numFmt = '"S/ "#,##0.00'
      r.getCell(2).font   = { name: 'Calibri', size: 11, bold: true, color: { argb: kpiColors[i] } }
      r.getCell(2).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiBgs[i] } }
      r.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(3).font   = { name: 'Calibri', size: 10, color: { argb: C.mid } }
      r.getCell(3).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiBgs[i] } }
      r.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(4).font   = { name: 'Calibri', size: 9, italic: true, color: { argb: C.light } }
      r.getCell(4).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpiBgs[i] } }
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      r.eachCell(c => {
        const brd = { style: 'thin' as const, color: { argb: C.gray3 } }
        c.border  = { bottom: brd }
      })
    })

    ws1.addRow([])

    // ── Por servicio ──
    const svcRow = 12
    ws1.mergeCells(`A${svcRow}:D${svcRow}`)
    sectionTitle(ws1, svcRow, `A${svcRow}:D${svcRow}`, '  INGRESOS POR SERVICIO')

    ws1.getRow(svcRow + 1).values = ['Servicio', 'Sesiones', 'Ingreso', '% del Total']
    ws1.getRow(svcRow + 1).eachCell(c => {
      c.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    ws1.getRow(svcRow + 1).height = 20

    Object.entries(byService).sort(([,a],[,b]) => b.total - a.total).forEach(([name, v], i) => {
      const rn  = svcRow + 2 + i
      const r   = ws1.getRow(rn)
      const pct = totalPaid > 0 ? v.total / totalPaid : 0
      r.values  = [name, v.count, v.total, pct]
      r.height  = 18
      const bg  = i % 2 === 0 ? C.white : C.gray1
      r.getCell(1).font  = { name: 'Calibri', size: 10, color: { argb: C.dark } }
      r.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      r.getCell(2).font  = { name: 'Calibri', size: 10, color: { argb: C.mid } }
      r.getCell(2).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(3).numFmt = '"S/ "#,##0.00'
      r.getCell(3).font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.green } }
      r.getCell(3).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(4).numFmt = '0.0%'
      r.getCell(4).font  = { name: 'Calibri', size: 10, color: { argb: C.light } }
      r.getCell(4).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
      r.getCell(4).value = pct
    })

    // ── Por método ──
    const methodStartRow = svcRow + 2 + Object.keys(byService).length + 2
    ws1.mergeCells(`A${methodStartRow}:D${methodStartRow}`)
    sectionTitle(ws1, methodStartRow, `A${methodStartRow}:D${methodStartRow}`, '  INGRESOS POR MÉTODO DE PAGO')

    ws1.getRow(methodStartRow + 1).values = ['Método', '', 'Ingreso', '% del Total']
    ws1.getRow(methodStartRow + 1).eachCell(c => {
      c.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    ws1.getRow(methodStartRow + 1).height = 20

    Object.entries(byMethod).sort(([,a],[,b]) => b - a).forEach(([method, amount], i) => {
      const rn  = methodStartRow + 2 + i
      const r   = ws1.getRow(rn)
      const pct = totalPaid > 0 ? amount / totalPaid : 0
      const label = method.charAt(0).toUpperCase() + method.slice(1)
      r.values  = [label, '', amount, pct]
      r.height  = 18
      const bg  = i % 2 === 0 ? C.white : C.gray1
      r.getCell(1).font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.dark } }
      r.getCell(1).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      r.getCell(3).numFmt = '"S/ "#,##0.00'
      r.getCell(3).font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.green } }
      r.getCell(3).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' }
      r.getCell(4).numFmt = '0.0%'
      r.getCell(4).value = pct
      r.getCell(4).font  = { name: 'Calibri', size: 10, color: { argb: C.light } }
      r.getCell(4).fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }
    })

    // ══════════════════════════════════════════════════════════════════════════
    // HOJA 2 — DETALLE DE TRANSACCIONES
    // ══════════════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet('Transacciones', { properties: { tabColor: { argb: 'FF2563EB' } } })
    ws2.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true }

    ws2.columns = [
      { key: 'fecha',    width: 14 },
      { key: 'dia',      width: 8 },
      { key: 'paciente', width: 24 },
      { key: 'concepto', width: 32 },
      { key: 'metodo',   width: 16 },
      { key: 'monto',    width: 14 },
      { key: 'estado',   width: 14 },
    ]

    ws2.mergeCells('A1:G1')
    const ws2Title = ws2.getCell('A1')
    ws2Title.value = `${center.nombre} — Transacciones de ${mesLabel}`
    ws2Title.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: C.white } }
    ws2Title.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
    ws2Title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws2.getRow(1).height = 30

    const ws2Headers = ['Fecha', 'Día', 'Paciente', 'Concepto', 'Método', 'Monto (S/)', 'Estado']
    ws2.getRow(2).values = ws2Headers
    ws2.getRow(2).height = 20
    ws2.getRow(2).eachCell(c => {
      c.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navyLight } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      c.border = { bottom: { style: 'medium', color: { argb: C.navy } } }
    })

    all.forEach((p, i) => {
      const d   = new Date(p.paid_at || p.created_at)
      const dateStr = d.toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' })
      const day = DAYS_ES[d.getDay()]
      const st  = STATUS_COLORS[p.status] || { fill: 'FFF3F4F6', font: 'FF374151' }
      const bg  = i % 2 === 0 ? C.white : C.gray1
      const concept = (p.concept || '—').replace(/ \(\d+\/\d+\)$/, '')

      const r   = ws2.getRow(3 + i)
      r.values  = [dateStr, day, p.children?.name || '—', concept, p.payment_method?.charAt(0).toUpperCase() + p.payment_method?.slice(1) || '—', Number(p.amount), STATUS_LABELS[p.status] || p.status]
      r.height  = 17

      r.eachCell((c, col) => {
        c.font = { name: 'Calibri', size: 10, color: { argb: C.dark } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        c.alignment = { vertical: 'middle', horizontal: col === 1 || col === 2 || col === 5 || col === 7 ? 'center' : col === 6 ? 'right' : 'left' }
        c.border = { bottom: { style: 'hair', color: { argb: C.gray3 } } }
      })

      r.getCell(6).numFmt = '"S/ "#,##0.00'
      r.getCell(6).font   = { name: 'Calibri', size: 10, bold: true, color: { argb: C.green } }
      r.getCell(7).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: st.fill } }
      r.getCell(7).font   = { name: 'Calibri', size: 9, bold: true, color: { argb: st.font } }
    })

    // Totals row
    const totalsRowIdx = 3 + all.length
    ws2.mergeCells(`A${totalsRowIdx}:E${totalsRowIdx}`)
    const totalsRow = ws2.getRow(totalsRowIdx)
    totalsRow.height = 22
    // Set merged cell A and then individual cells F and G
    const tCellA = totalsRow.getCell(1)
    tCellA.value = `TOTAL — ${all.length} registros`
    tCellA.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } }
    tCellA.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
    tCellA.alignment = { horizontal: 'center', vertical: 'middle' }
    const tCellF = totalsRow.getCell(6)
    tCellF.value = totalAll
    tCellF.numFmt = '"S/ "#,##0.00'
    tCellF.font  = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } }
    tCellF.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
    tCellF.alignment = { horizontal: 'right', vertical: 'middle' }
    const tCellG = totalsRow.getCell(7)
    tCellG.value = STATUS_LABELS['paid'] + `: S/ ${paid.reduce((a,p)=>a+Number(p.amount),0).toFixed(2)}`
    tCellG.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
    tCellG.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
    tCellG.alignment = { horizontal: 'center', vertical: 'middle' }

    // Auto filter
    ws2.autoFilter = { from: 'A2', to: `G${2 + all.length}` }

    // ══════════════════════════════════════════════════════════════════════════
    // HOJA 3 — RESUMEN POR PACIENTE
    // ══════════════════════════════════════════════════════════════════════════
    const ws3 = wb.addWorksheet('Por Paciente', { properties: { tabColor: { argb: 'FF059669' } } })
    ws3.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true }

    ws3.columns = [
      { key: 'paciente', width: 28 },
      { key: 'sesiones', width: 12 },
      { key: 'pagado',   width: 16 },
      { key: 'pendiente', width: 16 },
      { key: 'total',    width: 16 },
    ]

    ws3.mergeCells('A1:E1')
    const ws3Title = ws3.getCell('A1')
    ws3Title.value = `${center.nombre} — Resumen por Paciente · ${mesLabel}`
    ws3Title.font  = { name: 'Calibri', size: 13, bold: true, color: { argb: C.white } }
    ws3Title.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
    ws3Title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws3.getRow(1).height = 30

    ws3.getRow(2).values = ['Paciente', 'Sesiones', 'Cobrado', 'Pendiente', 'Total']
    ws3.getRow(2).height = 20
    ws3.getRow(2).eachCell(c => {
      c.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: C.white } }
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    patients.forEach((pt, i) => {
      const ptPaid = pt.pays.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.amount), 0)
      const ptPend = pt.pays.filter(p => p.status === 'pending').reduce((a, p) => a + Number(p.amount), 0)
      const bg     = i % 2 === 0 ? C.white : C.gray1
      const r      = ws3.getRow(3 + i)
      r.values     = [pt.name, pt.pays.length, ptPaid, ptPend, pt.total]
      r.height     = 18
      r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.dark } }
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
      r.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: C.mid } }
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }
      ;[3,4,5].forEach(col => {
        r.getCell(col).numFmt = '"S/ "#,##0.00'
        r.getCell(col).font   = { name: 'Calibri', size: 10, bold: col === 5, color: { argb: col === 3 ? C.green : col === 4 ? C.amber : C.dark } }
        r.getCell(col).fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        r.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' }
      })
      r.eachCell(c => { c.border = { bottom: { style: 'hair', color: { argb: C.gray3 } } } })
    })

    // Grand total
    const gt = ws3.getRow(3 + patients.length)
    gt.values = ['TOTAL GENERAL', all.length, totalPaid, totalPend, totalAll]
    gt.height  = 22
    gt.eachCell(c => {
      c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C.white } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.navy } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    ;[3,4,5].forEach(col => { gt.getCell(col).numFmt = '"S/ "#,##0.00'; gt.getCell(col).alignment = { horizontal: 'right', vertical: 'middle' } })

    // ── Generate buffer ────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte_financiero_${MESES[mes-1].toLowerCase()}_${anio}.xlsx"`,
      },
    })
  } catch (e: any) {
    console.error('Error generando reporte:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
