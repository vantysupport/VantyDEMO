// app/api/reporte-anamnesis/route.ts
// Genera un .docx profesional de la Historia Clínica (Anamnesis) de un paciente

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, Footer, PageNumber,
} from 'docx'

// ── Estilos base ──────────────────────────────────────────────────────────────
const BD   = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' }
const BDR  = { top: BD, bottom: BD, left: BD, right: BD }
const NBDR = { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } }

function titulo(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 60 },
    children: [new TextRun({ text, bold: true, size: 52, font: 'Arial', color: '4C1D95' })],
  })
}

function subtitulo(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 300 },
    children: [new TextRun({ text, size: 24, font: 'Arial', color: '7C3AED', italics: true })],
  })
}

function seccionHeader(icono: string, text: string, bgColor: string) {
  return new Paragraph({
    spacing: { before: 320, after: 80 },
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 16, color: '5B21B6', space: 8 } },
    children: [
      new TextRun({ text: `${icono}  `, size: 28, font: 'Arial' }),
      new TextRun({ text, bold: true, size: 26, font: 'Arial', color: '1E293B' }),
    ],
  })
}

// Fila normal (label + valor en dos columnas)
function fila(label: string, value: string | null | undefined, shade = false) {
  const val = value && value.trim() ? value.trim() : '—'
  return new TableRow({
    children: [
      new TableCell({
        borders: BDR,
        width: { size: 3400, type: WidthType.DXA },
        shading: { fill: shade ? 'F5F3FF' : 'F8FAFC', type: ShadingType.CLEAR },
        margins: { top: 90, bottom: 90, left: 140, right: 100 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: '475569' })] })],
      }),
      new TableCell({
        borders: BDR,
        width: { size: 5960, type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 19, font: 'Arial', color: '1E293B' })] })],
      }),
    ],
  })
}

// Fila de texto largo (label arriba, valor abajo, ancho completo)
function filaLarga(label: string, value: string | null | undefined, shade = false) {
  const val = value && value.trim() ? value.trim() : '—'
  return [
    new TableRow({
      children: [new TableCell({
        borders: BDR, columnSpan: 2,
        shading: { fill: shade ? 'EDE9FE' : 'F1F5F9', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 40, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: '5B21B6' })] })],
      })],
    }),
    new TableRow({
      children: [new TableCell({
        borders: BDR, columnSpan: 2,
        margins: { top: 80, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: val, size: 19, font: 'Arial', color: '1E293B' })] })],
      })],
    }),
  ]
}

function tabla(filas: TableRow[]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3400, 5960],
    rows: filas,
  })
}

function espacio() {
  return new Paragraph({ spacing: { before: 0, after: 120 }, children: [] })
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { registroId } = await req.json()
    if (!registroId) return NextResponse.json({ error: 'registroId requerido' }, { status: 400 })

    const { data: registro, error } = await supabaseAdmin
      .from('anamnesis_completa')
      .select('*, children(name, age, diagnosis, birth_date)')
      .eq('id', registroId)
      .single()

    if (error || !registro) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

    const d = registro.datos || {}
    const child = (registro as any).children || {}
    const nombrePaciente = child.name || 'Paciente'
    const nombreCorto = nombrePaciente.split(' ')[0]
    const edad = child.age || '—'
    const diagnostico = child.diagnosis || '—'
    const fechaDoc = registro.fecha_creacion
      ? new Date(registro.fecha_creacion).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    const hoyISO = new Date().toISOString().slice(0, 10)
    const fileName = `Historia_Clinica_${nombrePaciente.replace(/\s+/g, '_')}_${hoyISO}.docx`

    const doc = new Document({
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [{
        properties: {
          page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `Neuropsicología y Terapias SANTI  ·  Historia Clínica — ${nombrePaciente}  ·  `, size: 16, font: 'Arial', color: '9CA3AF' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '9CA3AF' }),
              ],
            })],
          }),
        },
        children: [

          // ── PORTADA ────────────────────────────────────────────────────────
          new Paragraph({
            spacing: { before: 0, after: 20 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: '5B21B6', space: 8 } },
            children: [
              new TextRun({ text: 'NEUROPSICOLOGÍA Y TERAPIAS SANTI', bold: true, size: 36, font: 'Arial', color: '4C1D95' }),
              new TextRun({ text: '  ·  Centro Especializado en Neurodesarrollo', size: 20, font: 'Arial', color: '9CA3AF' }),
            ],
          }),
          new Paragraph({ spacing: { before: 180, after: 0 }, children: [new TextRun({ text: 'Historia Clínica', bold: true, size: 48, font: 'Arial', color: '1E293B' })] }),
          subtitulo('Anamnesis · Evaluación Integral del Desarrollo'),

          // Ficha resumen
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [2200, 2800, 2200, 2160],
            rows: [
              new TableRow({ children: [
                new TableCell({ borders: NBDR, shading: { fill: '4C1D95', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 160, right: 100 }, columnSpan: 2,
                  children: [
                    new Paragraph({ children: [new TextRun({ text: nombrePaciente, bold: true, size: 32, font: 'Arial', color: 'FFFFFF' })] }),
                    new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: diagnostico, size: 20, font: 'Arial', color: 'C4B5FD' })] }),
                  ],
                }),
                new TableCell({ borders: NBDR, shading: { fill: 'EDE9FE', type: ShadingType.CLEAR }, margins: { top: 120, bottom: 120, left: 120, right: 120 }, columnSpan: 2,
                  children: [
                    new Paragraph({ children: [new TextRun({ text: `Edad: ${edad} años`, size: 20, font: 'Arial', color: '4C1D95' })] }),
                    new Paragraph({ spacing: { before: 30 }, children: [new TextRun({ text: `Fecha: ${fechaDoc}`, size: 19, font: 'Arial', color: '6D28D9' })] }),
                    new Paragraph({ spacing: { before: 30 }, children: [new TextRun({ text: `Emitido: ${hoy}`, size: 18, font: 'Arial', color: '9CA3AF' })] }),
                  ],
                }),
              ]}),
            ],
          }),
          espacio(),

          // ── 1. DATOS DE FILIACIÓN ──────────────────────────────────────────
          seccionHeader('👤', '1. Datos de Filiación', 'F5F3FF'),
          tabla([
            fila('Informante', d.informante, false),
            fila('Parentesco', d.parentesco, true),
            fila('¿Con quién vive?', d.vive_con, false),
            fila('Escolaridad actual', d.escolaridad, true),
          ]),
          espacio(),

          // ── 2. MOTIVO DE CONSULTA ──────────────────────────────────────────
          seccionHeader('🔍', '2. Motivo de Consulta', 'FFF7ED'),
          tabla([
            ...filaLarga('Motivo principal de consulta', d.motivo_principal, false),
            fila('Derivado por', d.derivado_por, true),
            ...filaLarga('Expectativas de la familia', d.expectativas, false),
          ]),
          espacio(),

          // ── 3. HISTORIA PRENATAL ───────────────────────────────────────────
          seccionHeader('🤰', '3. Historia Prenatal (Embarazo y Parto)', 'ECFDF5'),
          tabla([
            fila('¿Embarazo planificado?', d.tipo_embarazo, false),
            ...filaLarga('Complicaciones durante el embarazo', d.complicaciones_emb, true),
            fila('Tipo de parto', d.tipo_parto, false),
            fila('¿Lloró al nacer?', d.llanto, true),
            fila('¿Requirió incubadora?', d.incubadora, false),
          ]),
          espacio(),

          // ── 4. HISTORIA MÉDICA ─────────────────────────────────────────────
          seccionHeader('🏥', '4. Historia Médica', 'EFF6FF'),
          tabla([
            ...filaLarga('Enfermedades graves', d.enfermedades, false),
            fila('Exámenes previos', d.examenes, true),
            fila('Medicación actual', d.medicacion, false),
          ]),
          espacio(),

          // ── 5. DESARROLLO PSICOMOTOR ───────────────────────────────────────
          seccionHeader('🏃', '5. Desarrollo Psicomotor', 'FFF7ED'),
          tabla([
            fila('Sostén cefálico (sostener cabeza)', d.sosten_cefalico, false),
            fila('Edad de gateo', d.gateo, true),
            fila('Edad de marcha (caminar solo)', d.marcha, false),
            fila('¿Se cae con frecuencia?', d.caidas, true),
            fila('Motricidad fina', d.motricidad_fina, false),
          ]),
          espacio(),

          // ── 6. DESARROLLO DEL LENGUAJE ─────────────────────────────────────
          seccionHeader('💬', '6. Desarrollo del Lenguaje', 'F0FDF4'),
          tabla([
            fila('Primeras palabras', d.primeras_palabras, false),
            fila('¿Tiene intención comunicativa?', d.intencion_comunicativa, true),
            fila('Nivel de comprensión', d.comprension, false),
            fila('¿Estructura frases?', d.frases, true),
          ]),
          espacio(),

          // ── 7. ALIMENTACIÓN Y SUEÑO ───────────────────────────────────────
          seccionHeader('🍽️', '7. Alimentación y Sueño', 'FFF1F2'),
          tabla([
            fila('Apetito', d.apetito, false),
            fila('¿Mastica bien sólidos?', d.masticacion, true),
            fila('Calidad del sueño', d.sueno_calidad, false),
            fila('¿Con quién duerme?', d.duerme_con, true),
          ]),
          espacio(),

          // ── 8. AUTONOMÍA E HIGIENE ─────────────────────────────────────────
          seccionHeader('🛁', '8. Autonomía e Higiene', 'F5F3FF'),
          tabla([
            fila('Control de esfínteres', d.control_esfinteres, false),
            fila('Vestimenta', d.vestido, true),
            fila('Aseo personal', d.aseo, false),
          ]),
          espacio(),

          // ── 9. ÁREA EMOCIONAL Y SOCIAL ─────────────────────────────────────
          seccionHeader('🤝', '9. Área Emocional y Social', 'EFF6FF'),
          tabla([
            fila('Contacto visual', d.contacto_visual, false),
            fila('Tipo de juego', d.juego, true),
            fila('¿Presenta rabietas frecuentes?', d.rabietas, false),
            fila('Relación con otros niños', d.pares, true),
          ]),
          espacio(),

          // ── 10. OBSERVACIONES DEL TERAPEUTA ───────────────────────────────
          seccionHeader('📋', '10. Observaciones del Terapeuta', 'F0FDF4'),
          tabla([
            ...filaLarga('Apariencia física y aliño', d.apariencia, false),
            fila('Actitud ante la evaluación', d.actitud_evaluacion, true),
            fila('Contacto visual (observación)', d.contacto_visual_obs, false),
            ...filaLarga('Notas adicionales', d.notas_adicionales, false),
          ]),
          espacio(),

          // ── CIERRE ─────────────────────────────────────────────────────────
          new Paragraph({
            spacing: { before: 500 },
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 8 } },
            children: [
              new TextRun({ text: 'Terapeuta responsable: ', bold: true, size: 19, font: 'Arial', color: '4C1D95' }),
              new TextRun({ text: '_'.repeat(40), size: 19, font: 'Arial', color: '9CA3AF' }),
            ],
          }),
          new Paragraph({
            spacing: { before: 60, after: 0 },
            children: [new TextRun({ text: `Neuropsicología y Terapias SANTI  ·  ${hoy}  ·  Documento clínico confidencial`, size: 16, font: 'Arial', color: '94A3B8' })],
          }),
        ],
      }],
    })

    const buffer = await Packer.toBuffer(doc)
    const uint8 = new Uint8Array(buffer)

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(uint8.byteLength),
      },
    })
  } catch (e: any) {
    console.error('Error reporte-anamnesis:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
