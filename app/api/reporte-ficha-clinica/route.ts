// app/api/reporte-ficha-clinica/route.ts
// Genera un .docx profesional a partir de una ficha clínica completada

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Footer, PageNumber,
} from 'docx'
import {
  selloQRVerificacionAsync, piePaginaOficial,
  generarCodigoDocumento, generarIniciales, DOC_PAGE_PROPS,
} from '@/lib/santi-report-template'
import { registrarDocumentoEmitido } from '@/lib/registrar-documento'

// ── Estilos ───────────────────────────────────────────────────────────────────
const BD   = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
const BDR  = { top: BD, bottom: BD, left: BD, right: BD }
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NBDR = { top: NONE, bottom: NONE, left: NONE, right: NONE }

function seccionHeader(icono: string, text: string, color = '4F46E5') {
  return new Paragraph({
    spacing: { before: 320, after: 80 },
    shading: { fill: 'EEF2FF', type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 16, color, space: 8 } },
    children: [
      new TextRun({ text: `${icono}  `, size: 26, font: 'Arial' }),
      new TextRun({ text, bold: true, size: 24, font: 'Arial', color: '1E293B' }),
    ],
  })
}

function fila(label: string, value: string | null | undefined, shade = false) {
  const val = value?.trim() || '—'
  return new TableRow({
    children: [
      new TableCell({
        borders: BDR,
        width: { size: 3200, type: WidthType.DXA },
        shading: { fill: shade ? 'EEF2FF' : 'F8FAFC', type: ShadingType.CLEAR },
        margins: { top: 90, bottom: 90, left: 140, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: '475569' })] })],
      }),
      new TableCell({
        borders: BDR,
        width: { size: 6160, type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 19, font: 'Arial', color: '1E293B' })] })],
      }),
    ],
  })
}

function filaLarga(label: string, value: string | null | undefined, shade = false): TableRow[] {
  const val = value?.trim() || '—'
  return [
    new TableRow({
      children: [new TableCell({
        borders: BDR, columnSpan: 2,
        shading: { fill: shade ? 'E0E7FF' : 'F1F5F9', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 40, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: '4F46E5' })] })],
      })],
    }),
    new TableRow({
      children: [new TableCell({
        borders: BDR, columnSpan: 2,
        margins: { top: 80, bottom: 100, left: 140, right: 140 },
        children: val.split('\n').map(line =>
          new Paragraph({ children: [new TextRun({ text: line || ' ', size: 19, font: 'Arial', color: '1E293B' })] })
        ),
      })],
    }),
  ]
}

function tabla(filas: TableRow[]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3200, 6160],
    rows: filas,
  })
}

function espacio() {
  return new Paragraph({ spacing: { before: 0, after: 160 }, children: [] })
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { responseId } = await req.json()
    if (!responseId) return NextResponse.json({ error: 'responseId requerido' }, { status: 400 })

    // Fetch response + template + child
    const { data: resp, error } = await supabaseAdmin
      .from('clinical_template_responses')
      .select(`
        *,
        clinical_templates ( name, description, category, fields ),
        children ( name, age, diagnosis, birth_date )
      `)
      .eq('id', responseId)
      .single()

    if (error || !resp) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })

    const template   = (resp as any).clinical_templates || {}
    const child      = (resp as any).children || {}
    const responses  = resp.responses || {}
    const fields     = template.fields || []

    const nombrePaciente = child.name || 'Paciente'
    const edad           = child.age ? `${child.age} años` : '—'
    const diagnostico    = child.diagnosis || 'En evaluación'
    const fillerName     = resp.filler_name || '—'
    const fillerRole     = resp.filler_role || '—'
    const fechaFicha     = new Date(resp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const hoyISO         = new Date().toISOString().slice(0, 10)
    const nombrePlantilla = template.name || 'Ficha Clínica'
    const fileName       = `${nombrePlantilla.replace(/\s+/g, '_')}_${nombrePaciente.replace(/\s+/g, '_')}_${hoyISO}.docx`

    // Separar campos cortos y campos largos (textarea)
    const camposCortos  = fields.filter((f: any) => !['textarea'].includes(f.type))
    const camposLargos  = fields.filter((f: any) => f.type === 'textarea')

    const rowsCortos: TableRow[] = camposCortos.map((f: any, i: number) =>
      fila(f.label, String(responses[f.id] ?? '—'), i % 2 === 0)
    )

    const rowsLargos: TableRow[] = camposLargos.flatMap((f: any, i: number) =>
      filaLarga(f.label, String(responses[f.id] ?? ''), i % 2 === 0)
    )

    // ── QR + footer institucional ──
    const fechaActual = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const codigoDoc = generarCodigoDocumento((resp as any).child_id || nombrePaciente, 'ficha')
    const sellosVerif = await selloQRVerificacionAsync({
      codigoDoc,
      fechaEmision: fechaActual,
      especialista: (resp as any).filler_name || 'Equipo Clínico Vanty ABA',
    })

    const doc = new Document({
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [{
        properties: DOC_PAGE_PROPS,
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `Vanty ABA · Vanty ABA  ·  ${nombrePlantilla} — ${nombrePaciente}  ·  `, size: 16, font: 'Arial', color: '9CA3AF' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '9CA3AF' }),
              ],
            })],
          }),
        },
        children: [
          // ── ENCABEZADO ──────────────────────────────────────────────────────
          new Paragraph({
            spacing: { before: 0, after: 20 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: '4F46E5', space: 8 } },
            children: [
              new TextRun({ text: 'NEUROPSICOLOGÍA Y TERAPIAS Vanty ABA', bold: true, size: 36, font: 'Arial', color: '4C1D95' }),
              new TextRun({ text: '  ·  Centro Especializado en Neurodesarrollo', size: 20, font: 'Arial', color: '9CA3AF' }),
            ],
          }),
          new Paragraph({ spacing: { before: 180, after: 0 }, children: [new TextRun({ text: nombrePlantilla, bold: true, size: 48, font: 'Arial', color: '1E293B' })] }),
          new Paragraph({
            spacing: { before: 0, after: 300 },
            children: [new TextRun({ text: template.description || 'Ficha clínica del centro', size: 22, font: 'Arial', color: '6366F1', italics: true })],
          }),

          // ── DATOS GENERALES ──────────────────────────────────────────────────
          tabla([
            new TableRow({
              children: [
                new TableCell({
                  borders: BDR, columnSpan: 2,
                  shading: { fill: '4F46E5', type: ShadingType.CLEAR },
                  margins: { top: 100, bottom: 100, left: 140, right: 140 },
                  children: [new Paragraph({ children: [new TextRun({ text: 'DATOS DEL PACIENTE', bold: true, size: 20, font: 'Arial', color: 'FFFFFF' })] })],
                }),
              ],
            }),
            fila('Paciente', nombrePaciente, false),
            fila('Edad', edad, true),
            fila('Diagnóstico', diagnostico, false),
            fila('Fecha de la ficha', fechaFicha, true),
            fila('Completada por', `${fillerName} (${fillerRole})`, false),
          ]),

          espacio(),

          // ── CAMPOS CORTOS ────────────────────────────────────────────────────
          ...(rowsCortos.length > 0 ? [
            seccionHeader('📋', 'Información Clínica'),
            tabla(rowsCortos),
            espacio(),
          ] : []),

          // ── CAMPOS LARGOS ────────────────────────────────────────────────────
          ...(rowsLargos.length > 0 ? [
            seccionHeader('📝', 'Detalle Clínico'),
            tabla(rowsLargos),
            espacio(),
          ] : []),

          // ── OBSERVACIONES ADICIONALES ────────────────────────────────────────
          ...(resp.notes ? [
            seccionHeader('💬', 'Observaciones del Clínico', '059669'),
            tabla(filaLarga('Notas adicionales', resp.notes)),
            espacio(),
          ] : []),

          // ── FIRMA ────────────────────────────────────────────────────────────
          espacio(),
          // ── SELLO QR DE VERIFICACIÓN ──
          new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }),
          ...sellosVerif,

          new Paragraph({
            spacing: { before: 320, after: 0 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0', space: 8 } },
            children: [],
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: NBDR,
                    margins: { top: 200, bottom: 80, left: 0, right: 200 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: '_'.repeat(40), size: 20, font: 'Arial', color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: fillerName, bold: true, size: 19, font: 'Arial', color: '1E293B' })] }),
                      new Paragraph({ children: [new TextRun({ text: fillerRole, size: 18, font: 'Arial', color: '64748B' })] }),
                    ],
                  }),
                  new TableCell({
                    borders: NBDR,
                    margins: { top: 200, bottom: 80, left: 200, right: 0 },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: '_'.repeat(40), size: 20, font: 'Arial', color: '64748B' })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Fecha: ' + fechaFicha, size: 19, font: 'Arial', color: '1E293B' })] }),
                      new Paragraph({ children: [new TextRun({ text: 'Sello del centro', size: 18, font: 'Arial', color: '64748B' })] }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }],
    })

    // Registrar el documento emitido para verificación pública vía QR
    await registrarDocumentoEmitido({
      codigoDoc,
      childId: (resp as any).child_id,
      tipo: 'ficha_clinica',
      pacienteNombre: nombrePaciente,
      pacienteIniciales: generarIniciales(nombrePaciente),
      especialista: (resp as any).filler_name || 'Equipo Clínico Vanty ABA',
      fileName,
      metadata: { plantilla: nombrePlantilla },
    })

    const buffer = await Packer.toBuffer(doc)
    const uint8  = new Uint8Array(buffer)

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (err: any) {
    console.error('Error generando ficha Word:', err)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : err.message || 'Error interno' }, { status: 500 })
  }
}
