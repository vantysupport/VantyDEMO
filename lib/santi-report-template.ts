// lib/santi-report-template.ts
//
// Plantilla profesional SANTI v3 — supera el estilo CentralReach.
//
// NUEVAS CARACTERÍSTICAS v3:
//   1. portadaInstitucional()   — portada completa con logo SANTI, datos del
//      paciente, especialista y fecha de emisión. Ocupa la primera página.
//   2. firmaEspecialista()      — bloque de firma con nombre, credenciales,
//      número de colegiatura y línea de firma manuscrita simulada.
//   3. graficoProgresoBarra()   — barras de progreso horizontales incrustadas
//      directamente en el .docx (sin dependencias externas).
//   4. selloQRVerificacion()    — cuadro de verificación con código de
//      documento único y URL de validación (se integra en el pie o al final).
//
// Sin emojis · Sin gradientes · Lenguaje clínico-formal peruano.

import {
  Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  HeadingLevel, PageNumber, PageBreak, Footer, Header, VerticalAlign,
  VerticalMergeType, TabStopType, TabStopPosition,
} from 'docx'
import QRCode from 'qrcode'

// ─── Generador de QR como PNG buffer ──────────────────────────────────────────
//   Usa la librería `qrcode` para generar un QR REAL (no placeholder).
//   Retorna un Buffer PNG que docx-js puede insertar como ImageRun.
async function generarQRBuffer(data: string, size = 128): Promise<Buffer> {
  return await QRCode.toBuffer(data, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0F172A', light: '#FFFFFF' },
  })
}

// ─── Paleta institucional ────────────────────────────────────────────────────
export const COLOR = {
  azulDark:    '1E3A8A',   // encabezados de sección, logo
  azulMed:     '2563EB',   // acentos, viñetas
  azulLight:   'DBEAFE',   // fondo celdas de datos pares
  azulPortada: '0F172A',   // fondo oscuro portada
  grisOscuro:  '0F172A',   // casi negro
  grisMed:     '334155',   // texto general
  grisClaro:   'F8FAFC',   // fondo alterno tabla
  grisLinea:   'CBD5E1',   // línea de firma
  borde:       'CBD5E1',   // bordes de tabla
  verde:       '15803D',   // Logrado
  verdeBg:     'DCFCE7',
  amarillo:    'B45309',   // Casi logrado
  amarilloBg:  'FEF3C7',
  azulEn:      '1D4ED8',   // En proceso
  azulEnBg:    'DBEAFE',
  grisNo:      '6B7280',   // No iniciado
  grisNoBg:    'F3F4F6',
  rojo:        'DC2626',
  rojoBg:      'FEE2E2',
  blanco:      'FFFFFF',
  acento:      '4F46E5',   // violeta institucional (portada)
} as const

export const FONT      = 'Calibri'
export const TELEFONO  = '991 070 734'
export const EMAIL_SANTI = 'info@santiterapias.com'
export const DISCLAIMER = 'Este documento clínico no reemplaza un certificado médico-legal · Carece de valor médico-legal sin la firma del especialista'

const BD  = { style: BorderStyle.SINGLE, size: 4, color: COLOR.borde } as const
export const BDR  = { top: BD, bottom: BD, left: BD, right: BD } as const
const NBDR_RAW = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const
export const NBDR = { top: NBDR_RAW, bottom: NBDR_RAW, left: NBDR_RAW, right: NBDR_RAW } as const

// ─────────────────────────────────────────────────────────────────────────────
// 1. PORTADA INSTITUCIONAL COMPLETA
// ─────────────────────────────────────────────────────────────────────────────
//
// Uso:
//   const portada = portadaInstitucional({
//     tipoInforme: 'INFORME DE SESIÓN ABA',
//     nombrePaciente: 'Santiago García',
//     edadPaciente: '7 años',
//     diagnostico: 'TEA — Nivel 2 de soporte',
//     especialista: 'Lic. María Fernández',
//     credenciales: 'BCBA · Colegiatura Nº 01234',
//     fechaEmision: '23 de mayo de 2026',
//     periodoEval: 'Mayo 2026',  // opcional
//     codigoDoc: 'SANTI-2026-0042',  // opcional, para el QR
//   })
//   // portada es Paragraph[]  — insertar al inicio de sections[]
//
export interface PortadaOptions {
  tipoInforme:    string
  nombrePaciente: string
  edadPaciente?:  string
  diagnostico?:   string
  especialista?:  string
  credenciales?:  string
  fechaEmision?:  string
  periodoEval?:   string
  codigoDoc?:     string
}

export function portadaInstitucional(opts: PortadaOptions): (Paragraph | Table)[] {
  const fecha = opts.fechaEmision ?? new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  // Línea decorativa superior (barra azul ancha)
  const lineaTop = new Paragraph({
    spacing: { before: 0, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 30, color: COLOR.azulMed, space: 0 } },
    children: [new TextRun({ text: ' ', size: 10, font: FONT })],
  })

  // Logo / nombre institución
  const logoLinea = new Paragraph({
    spacing: { before: 480, after: 80 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'NEUROPSICOLOGÍA Y TERAPIAS ', bold: true, size: 36, font: FONT, color: COLOR.azulDark }),
      new TextRun({ text: 'SANTI', bold: true, size: 36, font: FONT, color: COLOR.acento }),
    ],
  })

  const subLogoLinea = new Paragraph({
    spacing: { before: 0, after: 0 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'Centro Especializado en Neurodesarrollo Infantil', size: 20, font: FONT, color: COLOR.grisMed, italics: true }),
    ],
  })

  // Separador
  const separadorTop = new Paragraph({
    spacing: { before: 240, after: 240 },
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.borde, space: 0 } },
    children: [new TextRun({ text: '', font: FONT })],
  })

  // Tipo de informe (título principal centrado grande)
  const tituloInforme = new Paragraph({
    spacing: { before: 360, after: 120 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: opts.tipoInforme.toUpperCase(), bold: true, size: 52, font: FONT, color: COLOR.azulDark }),
    ],
  })

  // Subtítulo / período
  const subtituloLineas: Paragraph[] = opts.periodoEval ? [
    new Paragraph({
      spacing: { before: 0, after: 480 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Período: ${opts.periodoEval}`, size: 22, font: FONT, color: COLOR.grisMed }),
      ],
    }),
  ] : [new Paragraph({ spacing: { before: 0, after: 480 }, children: [new TextRun({ text: '' })] })]

  // Tabla central con datos del paciente y del especialista
  const tablaPortada = new Table({
    width: { size: 7920, type: WidthType.DXA },
    columnWidths: [3960, 3960],
    rows: [
      // ── Encabezado columnas ──
      new TableRow({ children: [
        new TableCell({
          borders: NBDR,
          shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 80, left: 200, right: 200 },
          children: [new Paragraph({ children: [new TextRun({ text: 'DATOS DEL PACIENTE', bold: true, size: 17, font: FONT, color: COLOR.blanco })] })],
        }),
        new TableCell({
          borders: NBDR,
          shading: { fill: COLOR.acento, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 80, left: 200, right: 200 },
          children: [new Paragraph({ children: [new TextRun({ text: 'PROFESIONAL RESPONSABLE', bold: true, size: 17, font: FONT, color: COLOR.blanco })] })],
        }),
      ]}),
      // ── Filas de datos ──
      new TableRow({ children: [
        new TableCell({
          borders: NBDR,
          shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 60, left: 200, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Paciente', size: 16, font: FONT, color: '64748B' })] }),
            new Paragraph({ children: [new TextRun({ text: opts.nombrePaciente, bold: true, size: 22, font: FONT, color: COLOR.azulDark })] }),
          ],
        }),
        new TableCell({
          borders: NBDR,
          shading: { fill: 'F5F3FF', type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 60, left: 200, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Especialista', size: 16, font: FONT, color: '64748B' })] }),
            new Paragraph({ children: [new TextRun({ text: opts.especialista ?? 'Equipo Clínico SANTI', bold: true, size: 22, font: FONT, color: COLOR.acento })] }),
          ],
        }),
      ]}),
      new TableRow({ children: [
        new TableCell({
          borders: NBDR,
          shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 200, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Edad', size: 16, font: FONT, color: '64748B' })] }),
            new Paragraph({ children: [new TextRun({ text: opts.edadPaciente ?? '—', size: 20, font: FONT, color: COLOR.grisMed })] }),
          ],
        }),
        new TableCell({
          borders: NBDR,
          shading: { fill: 'F5F3FF', type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 60, left: 200, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Credenciales', size: 16, font: FONT, color: '64748B' })] }),
            new Paragraph({ children: [new TextRun({ text: opts.credenciales ?? 'Terapeuta Clínico', size: 20, font: FONT, color: COLOR.grisMed })] }),
          ],
        }),
      ]}),
      new TableRow({ children: [
        new TableCell({
          borders: NBDR,
          shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 140, left: 200, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Diagnóstico', size: 16, font: FONT, color: '64748B' })] }),
            new Paragraph({ children: [new TextRun({ text: opts.diagnostico ?? '—', size: 20, font: FONT, color: COLOR.grisMed })] }),
          ],
        }),
        new TableCell({
          borders: NBDR,
          shading: { fill: 'F5F3FF', type: ShadingType.CLEAR },
          margins: { top: 60, bottom: 140, left: 200, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Fecha de emisión', size: 16, font: FONT, color: '64748B' })] }),
            new Paragraph({ children: [new TextRun({ text: fecha, size: 20, font: FONT, color: COLOR.grisMed })] }),
          ],
        }),
      ]}),
    ],
  })

  // Código de documento y confidencialidad
  const codigoLinea = opts.codigoDoc ? new Paragraph({
    spacing: { before: 200, after: 60 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: `Código de documento: `, size: 16, font: FONT, color: '94A3B8' }),
      new TextRun({ text: opts.codigoDoc, bold: true, size: 16, font: FONT, color: COLOR.grisMed }),
    ],
  }) : new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: '' })] })

  const confLinea = new Paragraph({
    spacing: { before: 0, after: 0 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'DOCUMENTO CONFIDENCIAL — Uso exclusivo del destinatario', size: 15, font: FONT, color: 'BE123C', bold: true }),
    ],
  })

  // Salto de página al terminar la portada (solo PageBreak — sin break:1 + pageBreakBefore
  // que generaban una página vacía intermedia)
  const salto = new Paragraph({
    children: [new PageBreak()],
  })

  return [
    lineaTop,
    logoLinea,
    subLogoLinea,
    separadorTop,
    tituloInforme,
    ...subtituloLineas,
    tablaPortada,
    codigoLinea,
    confLinea,
    salto,
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FIRMA DEL ESPECIALISTA CON CREDENCIALES
// ─────────────────────────────────────────────────────────────────────────────
//
// Uso:
//   sections.push(...firmaEspecialista({
//     nombre: 'Lic. María Fernández',
//     titulo: 'Psicóloga Clínica / BCBA',
//     colegiatura: 'C.Ps.P. Nº 01234',
//     especialidad: 'Neuropsicología Infantil y Análisis de Conducta Aplicado',
//     fecha: '23 de mayo de 2026',
//     centroNombre: 'Neuropsicología y Terapias SANTI',
//   }))
//
export interface FirmaOptions {
  nombre?:       string
  titulo?:       string
  colegiatura?:  string
  especialidad?: string
  fecha?:        string
  centroNombre?: string
  coEspecialista?: { nombre: string; titulo: string; colegiatura?: string }
}

export function firmaEspecialista(opts: FirmaOptions = {}): (Paragraph | Table)[] {
  const fecha = opts.fecha ?? new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const nombre = opts.nombre ?? 'Equipo Clínico'
  const titulo = opts.titulo ?? 'Terapeuta Clínico'
  const colegiatura = opts.colegiatura ?? ''
  const especialidad = opts.especialidad ?? 'Neuropsicología y Terapias'
  const centro = opts.centroNombre ?? 'Neuropsicología y Terapias SANTI'

  const out: (Paragraph | Table)[] = []

  // Separador superior
  out.push(new Paragraph({
    spacing: { before: 600, after: 160 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: COLOR.azulMed, space: 6 } },
    children: [new TextRun({ text: '  FIRMA Y CERTIFICACIÓN DEL ESPECIALISTA', bold: true, size: 18, font: FONT, color: COLOR.azulDark })],
  }))

  // Si hay co-especialista, tabla de dos columnas; si no, una sola columna centrada
  const hayCoEsp = !!opts.coEspecialista

  const celdaFirma = (n: string, t: string, col?: string, esp?: string) => new TableCell({
    borders: NBDR,
    margins: { top: 0, bottom: 0, left: 200, right: 200 },
    children: [
      // Línea de firma (guion largo simulado como borde inferior de párrafo)
      new Paragraph({
        spacing: { before: 200, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.grisLinea, space: 4 } },
        children: [new TextRun({ text: ' ', size: 44, font: FONT })],  // espacio para firma manuscrita
      }),
      new Paragraph({
        spacing: { before: 80, after: 20 },
        children: [new TextRun({ text: n, bold: true, size: 20, font: FONT, color: col ?? COLOR.azulDark })],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: t, size: 18, font: FONT, color: COLOR.grisMed })],
      }),
      ...(esp ? [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: esp, size: 16, font: FONT, color: '64748B', italics: true })],
      })] : []),
    ],
  })

  if (hayCoEsp) {
    out.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [new TableRow({ children: [
        celdaFirma(nombre, `${titulo}${colegiatura ? '  ·  ' + colegiatura : ''}`, COLOR.azulDark, especialidad),
        celdaFirma(opts.coEspecialista!.nombre, `${opts.coEspecialista!.titulo}${opts.coEspecialista!.colegiatura ? '  ·  ' + opts.coEspecialista!.colegiatura : ''}`),
      ]})],
    }))
  } else {
    out.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [new TableRow({ children: [
        celdaFirma(nombre, `${titulo}${colegiatura ? '  ·  ' + colegiatura : ''}`, COLOR.azulDark, especialidad),
        new TableCell({
          borders: NBDR,
          margins: { top: 0, bottom: 0, left: 200, right: 200 },
          children: [
            new Paragraph({
              spacing: { before: 200, after: 0 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLOR.grisLinea, space: 4 } },
              children: [new TextRun({ text: ' ', size: 44, font: FONT })],
            }),
            new Paragraph({
              spacing: { before: 80, after: 20 },
              children: [new TextRun({ text: 'Sello / Firma del Centro', size: 18, font: FONT, color: '94A3B8', italics: true })],
            }),
            new Paragraph({
              spacing: { before: 0, after: 0 },
              children: [new TextRun({ text: centro, size: 17, font: FONT, color: '94A3B8' })],
            }),
          ],
        }),
      ]})],
    }))
  }

  out.push(new Paragraph({
    spacing: { before: 120, after: 0 },
    children: [
      new TextRun({ text: `Emitido en: Lima, Perú  ·  Fecha: ${fecha}  ·  ${TELEFONO}  ·  ${EMAIL_SANTI}`, size: 15, font: FONT, color: '94A3B8', italics: true }),
    ],
  }))

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GRÁFICAS DE PROGRESO INCRUSTADAS EN EL .DOCX
// ─────────────────────────────────────────────────────────────────────────────
//
// Dos variantes:
//   A) graficoProgresoBarra()  — barras horizontales con color semántico
//   B) graficoCurvaLineal()    — curva de tendencia con puntos de sesión
//
// Uso A:
//   sections.push(...graficoProgresoBarra('Progreso por área', [
//     { label: 'Comunicación funcional', valor: 82 },
//     { label: 'Habilidades sociales',   valor: 65 },
//     { label: 'Autoregulación',         valor: 48 },
//   ]))
//
// Uso B:
//   sections.push(...graficoCurvaLineal('Evolución de sesiones', [75, 80, 72, 85, 90]))
//
export interface DatoGrafico { label: string; valor: number }

export function graficoProgresoBarra(titulo: string, datos: DatoGrafico[], opciones?: { mostrarMeta?: boolean; metaPct?: number }): (Paragraph | Table)[] {
  const COLS = 30   // número de celdas de barra por fila
  const metaPct = opciones?.metaPct ?? 80

  const colorBarra = (v: number) => v >= 80 ? '15803D' : v >= 60 ? '2563EB' : v >= 40 ? 'D97706' : 'DC2626'
  const colorFondo = (v: number) => v >= 80 ? 'F0FDF4' : v >= 60 ? 'EFF6FF' : v >= 40 ? 'FFFBEB' : 'FFF1F2'

  const hRow = new TableRow({ children: [
    new TableCell({ borders: NBDR, shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 160, right: 80 }, width: { size: 2800, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text: titulo, bold: true, size: 18, font: FONT, color: COLOR.blanco })] })] }),
    new TableCell({ borders: NBDR, shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 60, right: 60 }, width: { size: 720, type: WidthType.DXA },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Logro', bold: true, size: 17, font: FONT, color: COLOR.blanco })] })] }),
    ...Array.from({ length: COLS }, (_, i) => new TableCell({
      borders: NBDR, width: { size: 187, type: WidthType.DXA },
      shading: { fill: i === Math.round((metaPct / 100) * COLS) - 1 && opciones?.mostrarMeta ? 'FEF08A' : COLOR.azulDark, type: ShadingType.CLEAR },
      children: [new Paragraph({ children: i === Math.round((metaPct / 100) * COLS) - 1 && opciones?.mostrarMeta
        ? [new TextRun({ text: '▼', size: 10, font: FONT, color: 'CA8A04' })]
        : [] })],
    })),
  ]})

  const dataRows = datos.map((d, i) => {
    const pct = Math.min(100, Math.max(0, Math.round(d.valor)))
    const filled = Math.round((pct / 100) * COLS)
    const barColor = colorBarra(pct)
    const bgRow = i % 2 === 0 ? 'F8FAFC' : COLOR.blanco
    const valBg = colorFondo(pct)

    return new TableRow({ children: [
      new TableCell({ borders: NBDR, shading: { fill: bgRow, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 160, right: 80 }, width: { size: 2800, type: WidthType.DXA },
        children: [new Paragraph({ children: [new TextRun({ text: d.label, size: 17, font: FONT, color: COLOR.grisMed })] })] }),
      new TableCell({ borders: NBDR, shading: { fill: valBg, type: ShadingType.CLEAR }, margins: { top: 80, bottom: 80, left: 60, right: 60 }, width: { size: 720, type: WidthType.DXA },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pct}%`, bold: true, size: 19, font: FONT, color: barColor })] })] }),
      ...Array.from({ length: COLS }, (_, ci) => new TableCell({
        borders: NBDR,
        shading: { fill: ci < filled ? barColor : bgRow, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [] })],
      })),
    ]})
  })

  // Leyenda de color si mostrarMeta
  const leyenda = opciones?.mostrarMeta ? [new Paragraph({
    spacing: { before: 40, after: 0 },
    children: [
      new TextRun({ text: `  Meta: ${metaPct}%  `, size: 15, font: FONT, color: 'CA8A04', bold: true }),
      new TextRun({ text: '  ■ Logrado (≥80%)  ', size: 15, font: FONT, color: '15803D' }),
      new TextRun({ text: '  ■ En proceso (≥60%)  ', size: 15, font: FONT, color: '2563EB' }),
      new TextRun({ text: '  ■ En desarrollo (≥40%)  ', size: 15, font: FONT, color: 'D97706' }),
      new TextRun({ text: '  ■ Inicial (<40%)  ', size: 15, font: FONT, color: 'DC2626' }),
    ],
  })] : []

  return [
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2800, 720, ...Array(COLS).fill(187)],
      rows: [hRow, ...dataRows],
    }),
    ...leyenda,
  ]
}

// Gráfica de curva lineal (puntos de sesión representados con bloques ASCII)
export function graficoCurvaLineal(titulo: string, valores: number[], etiquetas?: string[]): (Paragraph | Table)[] {
  if (valores.length === 0) return []

  const FILAS = 8     // filas de la cuadrícula
  const COLS  = Math.min(valores.length, 20)
  const vals  = valores.slice(-COLS)
  const labels = etiquetas ? etiquetas.slice(-COLS) : vals.map((_, i) => `S${i + 1}`)
  const max   = 100
  const min   = 0

  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  const tendencia = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : 0
  const tendenciaTexto = tendencia > 5 ? 'Tendencia ascendente' : tendencia < -5 ? 'Tendencia descendente' : 'Tendencia estable'
  const tendenciaColor = tendencia > 5 ? COLOR.verde : tendencia < -5 ? COLOR.rojo : COLOR.azulEn

  const colWidth = Math.floor(7920 / COLS)
  const labelColW = 480

  const filaEje = (fi: number): TableRow => {
    const pctLabel = String(Math.round(max - (fi / FILAS) * max)).padStart(3, ' ') + '%'
    return new TableRow({ children: [
      new TableCell({
        borders: NBDR,
        width: { size: labelColW, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 80, right: 40 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fi % 2 === 0 ? pctLabel : '', size: 13, font: 'Courier New', color: '94A3B8' })] })],
      }),
      ...vals.map((v, ci) => {
        const umbralAlto = max - (fi / FILAS) * max
        const umbralBajo = max - ((fi + 1) / FILAS) * max
        // FIX: la fila superior (fi=0) incluye el máximo (100%), si no un valor
        // de exactamente 100 no se pintaba en ninguna fila y el gráfico salía vacío.
        const enEstaFila = fi === 0 ? (v >= umbralBajo && v <= umbralAlto) : (v >= umbralBajo && v < umbralAlto)
        const barColor = colorBarra(v)
        return new TableCell({
          borders: NBDR,
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: enEstaFila ? barColor : 'F8FAFC', type: ShadingType.CLEAR },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
            new TextRun({ text: enEstaFila ? '●' : ' ', size: 11, font: FONT, color: enEstaFila ? COLOR.blanco : 'F8FAFC' }),
          ]})],
        })
      }),
    ]})
  }

  function colorBarra(v: number) { return v >= 80 ? '15803D' : v >= 60 ? '2563EB' : v >= 40 ? 'D97706' : 'DC2626' }

  // Fila de etiquetas de sesión
  const filaEtiquetas = new TableRow({ children: [
    new TableCell({ borders: NBDR, width: { size: labelColW, type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
    ...labels.map(l => new TableCell({
      borders: NBDR,
      width: { size: colWidth, type: WidthType.DXA },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: l, size: 11, font: FONT, color: COLOR.grisMed })] })],
    })),
  ]})

  return [
    new Paragraph({
      spacing: { before: 280, after: 80 },
      children: [new TextRun({ text: titulo, bold: true, size: 20, font: FONT, color: COLOR.azulDark })],
    }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [labelColW, ...Array(COLS).fill(colWidth)],
      rows: [
        ...Array.from({ length: FILAS }, (_, fi) => filaEje(fi)),
        filaEtiquetas,
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({ text: `Promedio: ${avg}%  ·  `, size: 16, font: FONT, color: COLOR.grisMed }),
        new TextRun({ text: tendenciaTexto, bold: true, size: 16, font: FONT, color: tendenciaColor }),
        new TextRun({ text: `  (${tendencia >= 0 ? '+' : ''}${Math.round(tendencia)}% vs inicio)`, size: 16, font: FONT, color: COLOR.grisMed }),
      ],
    }),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. SELLO DE VERIFICACIÓN CON CÓDIGO QR (representación textual)
// ─────────────────────────────────────────────────────────────────────────────
//
// Como docx no puede incrustar imágenes dinámicas de QR sin librerías externas,
// este sello genera un cuadro verificable con código único y URL de validación.
// El QR visual real se puede agregar si se pasa `qrImageBase64`.
//
// Uso:
//   sections.push(...selloQRVerificacion({
//     codigoDoc: 'SANTI-2026-0042',
//     urlValidacion: 'https://santiterapias.com/verificar/SANTI-2026-0042',
//     fechaEmision: '23 de mayo de 2026',
//     especialista: 'Lic. María Fernández',
//   }))
//
export interface SelloQROptions {
  codigoDoc:      string
  urlValidacion?: string
  fechaEmision?:  string
  especialista?:  string
}

// ─── Versión SÍNCRONA (deprecated, placeholder visual) ───────────────────────
//   Mantengo por retrocompatibilidad pero el ideal es usar `selloQRVerificacionAsync`
export function selloQRVerificacion(opts: SelloQROptions): (Paragraph | Table)[] {
  const fecha = opts.fechaEmision ?? new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const url = opts.urlValidacion ?? `https://santiterapias.com/verificar/${opts.codigoDoc}`

  return [
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1440, 7920],
      rows: [new TableRow({ children: [
        // "QR" visual placeholder (cuadro punteado con instrucción)
        new TableCell({
          borders: { top: BD, bottom: BD, left: BD, right: BD },
          shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '□□□□', size: 24, font: 'Courier New', color: COLOR.azulDark })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '□ QR □', size: 24, font: 'Courier New', color: COLOR.azulDark })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '□□□□', size: 24, font: 'Courier New', color: COLOR.azulDark })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [new TextRun({ text: 'Escanear', size: 13, font: FONT, color: '64748B', italics: true })] }),
          ],
        }),
        // Información de verificación
        new TableCell({
          borders: { top: BD, bottom: BD, left: BD, right: BD },
          shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 160 },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'DOCUMENTO VERIFICABLE — NEUROPSICOLOGÍA Y TERAPIAS SANTI', bold: true, size: 17, font: FONT, color: COLOR.azulDark })] }),
            new Paragraph({ spacing: { before: 80 }, children: [
              new TextRun({ text: 'Código de documento:  ', size: 16, font: FONT, color: COLOR.grisMed }),
              new TextRun({ text: opts.codigoDoc, bold: true, size: 16, font: 'Courier New', color: COLOR.acento }),
            ]}),
            new Paragraph({ spacing: { before: 40 }, children: [
              new TextRun({ text: 'Emitido:  ', size: 16, font: FONT, color: COLOR.grisMed }),
              new TextRun({ text: fecha, size: 16, font: FONT, color: COLOR.grisMed }),
              ...(opts.especialista ? [
                new TextRun({ text: '   Responsable:  ', size: 16, font: FONT, color: COLOR.grisMed }),
                new TextRun({ text: opts.especialista, size: 16, font: FONT, color: COLOR.grisMed }),
              ] : []),
            ]}),
            new Paragraph({ spacing: { before: 40 }, children: [
              new TextRun({ text: 'Verificar en:  ', size: 16, font: FONT, color: COLOR.grisMed }),
              new TextRun({ text: url, size: 15, font: FONT, color: COLOR.azulMed, italics: true }),
            ]}),
            new Paragraph({ spacing: { before: 60 }, children: [
              new TextRun({ text: 'Este documento fue generado digitalmente. La validez legal queda condicionada a la firma manuscrita o digital del profesional indicado.', size: 14, font: FONT, color: '94A3B8', italics: true }),
            ]}),
          ],
        }),
      ]})],
    }),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES EXISTENTES — sin cambios (retrocompatibilidad total)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Header institucional ─────────────────────────────────────────────────────
export function headerInstitucional(tipoInforme: string): Header {
  return new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.azulMed, space: 6 } },
        spacing: { after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: 'NEUROPSICOLOGÍA Y TERAPIAS SANTI', bold: true, size: 18, font: FONT, color: COLOR.azulDark }),
          new TextRun({ text: `\t${tipoInforme}`, size: 17, font: FONT, color: COLOR.grisMed }),
        ],
      }),
    ],
  })
}

// ─── Pie de página oficial ───────────────────────────────────────────────────
export function piePaginaOficial(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.borde, space: 4 } },
        spacing: { before: 40 },
        children: [
          new TextRun({ text: `${DISCLAIMER}  ·  Equipo Clínico SANTI  ·  ${TELEFONO}  ·  Pág. `, size: 15, font: FONT, color: '94A3B8', italics: true }),
          new TextRun({ children: [PageNumber.CURRENT], size: 15, font: FONT, color: '94A3B8' }),
          new TextRun({ text: ' / ', size: 15, font: FONT, color: '94A3B8' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, font: FONT, color: '94A3B8' }),
        ],
      }),
    ],
  })
}

// ─── Título principal del documento ──────────────────────────────────────────
export function tituloPrincipal(tipoInforme: string, iniciales: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 0, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: tipoInforme.toUpperCase(), bold: true, size: 40, font: FONT, color: COLOR.azulDark })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Alumno(a): ', size: 22, font: FONT, color: COLOR.grisMed }),
        new TextRun({ text: iniciales, bold: true, size: 22, font: FONT, color: COLOR.azulDark }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 320 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.azulMed, space: 0 } },
      children: [new TextRun({ text: '' })],
    }),
  ]
}

// ─── Título de sección (fondo azul institucional, texto blanco) ──────────────
export function tituloSeccion(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR },
    children: [new TextRun({ text: `  ${texto.toUpperCase()}`, bold: true, size: 22, font: FONT, color: COLOR.blanco })],
  })
}

// ─── Subsección label + prosa ─────────────────────────────────────────────────
export function subseccion(label: string, prosa: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 19, font: FONT, color: COLOR.azulDark }),
      new TextRun({ text: prosa, size: 19, font: FONT, color: COLOR.grisMed }),
    ],
  })
}

// ─── Párrafo de prosa ─────────────────────────────────────────────────────────
export function parrafo(texto: string, color: string = COLOR.grisMed): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text: texto, size: 19, font: FONT, color })],
  })
}

// ─── Lista con items ──────────────────────────────────────────────────────────
export function items(textos: string[]): Paragraph[] {
  return textos.filter(t => t?.trim()).map(t =>
    new Paragraph({
      spacing: { before: 40, after: 40 },
      indent: { left: 400, hanging: 220 },
      children: [
        new TextRun({ text: '–  ', size: 19, font: FONT, color: COLOR.azulMed, bold: true }),
        new TextRun({ text: t, size: 19, font: FONT, color: COLOR.grisMed }),
      ],
    })
  )
}

// ─── Tabla Datos Generales ────────────────────────────────────────────────────
export function tablaDatosGenerales(filas: [string, string][]): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2960, 6400],
    rows: filas.map(([label, valor], i) => new TableRow({
      children: [
        new TableCell({
          borders: BDR,
          width: { size: 2960, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? 'EFF6FF' : COLOR.grisClaro, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 180, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: FONT, color: COLOR.azulDark })] })],
        }),
        new TableCell({
          borders: BDR,
          width: { size: 6400, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? COLOR.blanco : COLOR.grisClaro, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 180, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: valor || '—', size: 18, font: FONT, color: COLOR.grisMed })] })],
        }),
      ],
    })),
  })
}

// ─── Tabla Habilidades y Logros ───────────────────────────────────────────────
export type EstadoLogro = 'logrado' | 'casi_logrado' | 'en_proceso' | 'no_iniciado'

export type HabilidadFila = {
  area?:           string
  subarea?:        string
  /** Texto del criterio/objetivo — si está presente junto a `set`, se muestra encima del SET en la misma celda */
  objetivo?:       string
  /** Texto del SET. Si está presente, esta fila es una fila de SET */
  set?:            string
  estado:          EstadoLogro
}

function estadoTexto(f: HabilidadFila): string {
  switch (f.estado) {
    case 'logrado':      return 'Criterio alcanzado'
    case 'casi_logrado': return 'En proceso'
    case 'en_proceso':   return 'En proceso'
    case 'no_iniciado':  return 'No iniciado'
    default:             return ''
  }
}

function estadoColor(e: EstadoLogro): { text: string; bg: string } {
  switch (e) {
    case 'logrado':      return { text: COLOR.verde,    bg: COLOR.verdeBg }
    case 'casi_logrado': return { text: COLOR.amarillo, bg: COLOR.amarilloBg }
    case 'en_proceso':   return { text: COLOR.azulEn,   bg: COLOR.azulEnBg }
    case 'no_iniciado':  return { text: COLOR.grisNo,   bg: COLOR.grisNoBg }
  }
}

export function tablaHabilidades(filas: HabilidadFila[]): Table {
  const hCell = (texto: string, width: number) => new TableCell({
    borders: BDR,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 140, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: texto, bold: true, size: 17, font: FONT, color: COLOR.blanco })] })],
  })

  const dCell = (
    texto: string, width: number,
    opts: { bold?: boolean; align?: typeof AlignmentType[keyof typeof AlignmentType]; color?: string; bg?: string; merge?: 'restart' | 'continue'; size?: number } = {}
  ) => new TableCell({
    borders: BDR,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 140, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR } : undefined,
    verticalMerge: opts.merge === 'restart'
      ? VerticalMergeType.RESTART
      : opts.merge === 'continue'
        ? VerticalMergeType.CONTINUE
        : undefined,
    children: opts.merge === 'continue'
      ? [new Paragraph({ children: [] })]
      : [new Paragraph({
          alignment: opts.align || AlignmentType.LEFT,
          children: [new TextRun({ text: texto || '', bold: opts.bold, size: opts.size || 16, font: FONT, color: opts.color || COLOR.grisMed })],
        })],
  })

  // Celda de OBJETIVO/SET: puede tener objetivo + set combinados en la misma celda
  const objetivoSetCell = (f: HabilidadFila) => {
    const isSet = !!f.set
    const paragraphs: Paragraph[] = []

    if (f.objetivo?.trim()) {
      paragraphs.push(new Paragraph({
        spacing: { before: 0, after: isSet ? 80 : 0 },
        children: [new TextRun({ text: f.objetivo, size: 15, font: FONT, color: COLOR.grisMed, italics: true })],
      }))
    }

    if (isSet) {
      paragraphs.push(new Paragraph({
        spacing: { before: f.objetivo?.trim() ? 40 : 0, after: 0 },
        children: [new TextRun({ text: f.set!, bold: true, size: 15, font: FONT, color: COLOR.azulDark })],
      }))
    }

    if (paragraphs.length === 0) paragraphs.push(new Paragraph({ children: [] }))

    return new TableCell({
      borders: BDR,
      width: { size: 4040, type: WidthType.DXA },
      margins: { top: 90, bottom: 90, left: 140, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: paragraphs,
    })
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1560, 1960, 4040, 1800],
    rows: [
      new TableRow({ tableHeader: true, children: [hCell('ÁREA', 1560), hCell('SUBÁREA', 1960), hCell('OBJETIVO / SET', 4040), hCell('ESTADO', 1800)] }),
      ...filas.map(f => {
        const isSet     = !!f.set
        const hasSubarea = !!(f.subarea?.trim())
        const areaMerge = f.area?.trim() ? 'restart' : 'continue'
        const subMerge  = hasSubarea ? 'restart' : 'continue'
        const ec        = estadoColor(f.estado)
        return new TableRow({ children: [
          dCell(f.area || '', 1560, { bold: true, size: 15, color: COLOR.azulDark, merge: areaMerge as any }),
          dCell(f.subarea || '', 1960, { size: 15, merge: subMerge as any }),
          objetivoSetCell(f),
          // Solo las filas SET muestran el badge de estado; filas de solo objetivo quedan vacías
          isSet
            ? dCell(estadoTexto(f), 1800, { align: AlignmentType.CENTER, bold: true, size: 15, color: ec.text, bg: ec.bg })
            : dCell('', 1800, {}),
        ]})
      }),
    ],
  })
}

// ─── Glosario ─────────────────────────────────────────────────────────────────
export function glosarioAyudas(): Paragraph[] {
  const lineas = [
    'Ayuda gestual (A.G.): señalar.',
    'Modelo ecoico total / parcial (MET / MEP): se le dice la palabra al menor de manera completa o parcial según el caso.',
    'Ayuda verbal (AV): se le da la instrucción repetidas veces para que ejecute la conducta correctamente.',
    'Ayuda física (AF): se acompaña con movimientos físicos para que ejecute la conducta correctamente.',
    'Independiente: el menor ejecuta la conducta sin ayuda.',
    'Las áreas con codificación por letras (A, B, C, D, …) corresponden al Assessment of Basic Language and Learning Skills, Revised (ABLLS-R).',
    'Un objetivo se considera Logrado cuando alcanza al menos 90% de éxito durante dos sesiones consecutivas.',
    'Los SETS son niveles de ayuda; a mayor SET, menor grado de ayuda, hasta llegar al nivel Independiente.',
  ]
  return [
    new Paragraph({ spacing: { before: 280, after: 100 }, children: [new TextRun({ text: 'Glosario de términos', bold: true, italics: true, size: 19, font: FONT, color: COLOR.grisMed })] }),
    ...lineas.map(l => new Paragraph({
      spacing: { before: 20, after: 20 },
      indent: { left: 300 },
      children: [
        new TextRun({ text: '· ', size: 17, font: FONT, color: COLOR.azulMed }),
        new TextRun({ text: l, size: 17, font: FONT, color: '64748B', italics: true }),
      ],
    })),
  ]
}

// ─── Bloque de Recomendaciones tripartito ─────────────────────────────────────
export type RecomendacionesBloque = { menor?: string[]; familia?: string[]; escuela?: string[] }

export function recomendaciones(rec: RecomendacionesBloque): Paragraph[] {
  const out: Paragraph[] = [tituloSeccion('Recomendaciones')]
  const subLabel = (txt: string) => new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: txt, bold: true, size: 20, font: FONT, color: COLOR.azulDark })],
  })
  if (rec.menor?.length)   { out.push(subLabel('Para el menor / la menor'));              out.push(...items(rec.menor)) }
  if (rec.familia?.length) { out.push(subLabel('Para la familia'));                         out.push(...items(rec.familia)) }
  if (rec.escuela?.length) { out.push(subLabel('Para la escuela / centro educativo'));      out.push(...items(rec.escuela)) }
  return out
}

// ─── Bloque de firma final (versión simple — mantenida por retrocompatibilidad) ──
export function firmaEquipo(): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 500, after: 60 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR.borde, space: 6 } },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Equipo Clínico', bold: true, size: 20, font: FONT, color: COLOR.azulDark })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI', size: 19, font: FONT, color: COLOR.grisMed })],
    }),
  ]
}

// ─── Tabla de subpruebas ──────────────────────────────────────────────────────
export type SubpruebaFila = { subprueba: string; evalua?: string; puntDirecta?: string | number; centil?: string | number; nivel: string }

export function tablaSubpruebas(filas: SubpruebaFila[]): Table {
  const nivelColor = (n: string) => {
    const l = n.toLowerCase()
    if (/(muy bajo|dificult)/.test(l)) return 'BE123C'
    if (/bajo/.test(l))                return COLOR.amarillo
    if (/(promedio|normal)/.test(l))   return COLOR.verde
    if (/alto/.test(l))                return COLOR.azulEn
    return COLOR.grisMed
  }
  const hCell = (t: string, w: number) => new TableCell({
    borders: BDR, width: { size: w, type: WidthType.DXA },
    shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 120, right: 80 },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 17, font: FONT, color: COLOR.blanco })] })],
  })
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 3600, 1200, 1000, 1160],
    rows: [
      new TableRow({ children: [hCell('SUBPRUEBA', 2400), hCell('¿QUÉ EVALÚA?', 3600), hCell('PUNT. DIRECTA', 1200), hCell('CENTIL', 1000), hCell('NIVEL', 1160)] }),
      ...filas.map(f => new TableRow({ children: [
        new TableCell({ borders: BDR, width: { size: 2400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: f.subprueba, bold: true, size: 17, font: FONT, color: COLOR.azulDark })] })] }),
        new TableCell({ borders: BDR, width: { size: 3600, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: f.evalua || '', size: 16, font: FONT, color: COLOR.grisMed })] })] }),
        new TableCell({ borders: BDR, width: { size: 1200, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(f.puntDirecta ?? '—'), size: 17, font: FONT, color: COLOR.grisMed })] })] }),
        new TableCell({ borders: BDR, width: { size: 1000, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(f.centil ?? '—'), size: 17, font: FONT, color: COLOR.grisMed })] })] }),
        new TableCell({ borders: BDR, width: { size: 1160, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.nivel, bold: true, size: 16, font: FONT, color: nivelColor(f.nivel) })] })] }),
      ]})),
    ],
  })
}

// ─── Tabla criterios DSM-5 ────────────────────────────────────────────────────
export type CriterioFila = { criterio: string; presentacion: string; cumple: boolean }

export function tablaCriteriosDSM(filas: CriterioFila[]): Table {
  const hCell = (t: string, w: number) => new TableCell({ borders: BDR, width: { size: w, type: WidthType.DXA }, shading: { fill: COLOR.azulDark, type: ShadingType.CLEAR }, margins: { top: 100, bottom: 100, left: 120, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, size: 17, font: FONT, color: COLOR.blanco })] })] })
  return new Table({
    width: { size: 9360, type: WidthType.DXA }, columnWidths: [3400, 4500, 1460],
    rows: [
      new TableRow({ children: [hCell('CRITERIO', 3400), hCell('¿QUÉ SE PRESENTA?', 4500), hCell('CUMPLIMIENTO', 1460)] }),
      ...filas.map(f => new TableRow({ children: [
        new TableCell({ borders: BDR, width: { size: 3400, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: f.criterio, size: 17, font: FONT, color: COLOR.grisMed })] })] }),
        new TableCell({ borders: BDR, width: { size: 4500, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: f.presentacion || '—', size: 17, font: FONT, color: COLOR.grisMed })] })] }),
        new TableCell({ borders: BDR, width: { size: 1460, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: f.cumple ? '✓ Cumple' : '— No cumple', bold: true, size: 17, font: FONT, color: f.cumple ? COLOR.verde : '94A3B8' })] })] }),
      ]})),
    ],
  })
}

// ─── Helpers de utilidad ──────────────────────────────────────────────────────
export function generarIniciales(nombreCompleto: string): string {
  if (!nombreCompleto) return ''
  const palabras = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return ''
  if (palabras.length === 1) return palabras[0].slice(0, 4).replace(/^./, c => c.toUpperCase())
  const cap = (s: string, n: number) => s.charAt(0).toUpperCase() + s.slice(1, n).toLowerCase()
  return cap(palabras[0], 2) + cap(palabras[1], 2)
}

/** Genera un código de documento único reproducible dado un childId y fecha */
export function generarCodigoDocumento(childId: string, tipoReporte: string): string {
  const hoy = new Date()
  const año = hoy.getFullYear()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const tipo = tipoReporte.substring(0, 3).toUpperCase()
  const hash = Math.abs(childId.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % 9999
  return `SANTI-${año}${mes}-${tipo}-${String(hash).padStart(4, '0')}`
}

// ─── Configuración estándar de documento ─────────────────────────────────────
export const DOC_STYLES = {
  default: { document: { run: { font: FONT, size: 20 } } },
  paragraphStyles: [{
    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
    run: { bold: true, size: 32, font: FONT, color: COLOR.azulDark },
    paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
  }],
}

export const DOC_NUMBERING = {
  config: [{
    reference: 'bul',
    levels: [{ level: 0, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 600, hanging: 300 } } } }],
  }],
}

export const DOC_PAGE_PROPS = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1200, right: 1260, bottom: 1200, left: 1260 },
  },
}

// ─── Sello QR REAL con imagen embebida (versión async) ───────────────────────
//   Genera un QR PNG y lo inserta como ImageRun de docx. Se puede escanear con
//   cualquier app y abre la URL de verificación.
export async function selloQRVerificacionAsync(opts: SelloQROptions): Promise<(Paragraph | Table)[]> {
  const fecha = opts.fechaEmision ?? new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://centro-santi.vanty.xyz'
  const url = opts.urlValidacion ?? `${baseUrl}/verificar/${opts.codigoDoc}`

  // Generar QR como PNG buffer real
  let qrBuffer: Buffer
  try {
    qrBuffer = await generarQRBuffer(url, 200)
  } catch (e) {
    console.warn('[selloQRVerificacionAsync] QR generation failed, falling back to placeholder', e)
    return selloQRVerificacion(opts)
  }

  return [
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [1800, 7560],
      rows: [new TableRow({ children: [
        // QR REAL embebido
        new TableCell({
          borders: { top: BD, bottom: BD, left: BD, right: BD },
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({
                type: 'png',
                data: qrBuffer,
                transformation: { width: 110, height: 110 },
                altText: {
                  title: 'Código QR de verificación',
                  description: `Escanea para validar el documento ${opts.codigoDoc}`,
                  name: 'qr_verificacion',
                },
              } as any)],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60 },
              children: [new TextRun({
                text: 'Escanear para verificar',
                size: 13, font: FONT, color: '64748B', italics: true,
              })],
            }),
          ],
        }),
        // Información de verificación
        new TableCell({
          borders: { top: BD, bottom: BD, left: BD, right: BD },
          shading: { fill: 'EFF6FF', type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 200, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({ children: [new TextRun({
              text: 'DOCUMENTO VERIFICABLE — NEUROPSICOLOGÍA Y TERAPIAS SANTI',
              bold: true, size: 18, font: FONT, color: COLOR.azulDark,
            })] }),
            new Paragraph({ spacing: { before: 100 }, children: [
              new TextRun({ text: 'Código de documento:  ', size: 17, font: FONT, color: COLOR.grisMed }),
              new TextRun({ text: opts.codigoDoc, bold: true, size: 17, font: 'Courier New', color: COLOR.acento }),
            ]}),
            new Paragraph({ spacing: { before: 40 }, children: [
              new TextRun({ text: 'Emitido:  ', size: 17, font: FONT, color: COLOR.grisMed }),
              new TextRun({ text: fecha, size: 17, font: FONT, color: COLOR.grisMed }),
              ...(opts.especialista ? [
                new TextRun({ text: '   ·   Responsable:  ', size: 17, font: FONT, color: COLOR.grisMed }),
                new TextRun({ text: opts.especialista, bold: true, size: 17, font: FONT, color: COLOR.grisMed }),
              ] : []),
            ]}),
            new Paragraph({ spacing: { before: 40 }, children: [
              new TextRun({ text: 'Verificar en:  ', size: 16, font: FONT, color: COLOR.grisMed }),
              new TextRun({ text: url, size: 15, font: FONT, color: COLOR.azulMed, italics: true }),
            ]}),
            new Paragraph({ spacing: { before: 80 }, children: [
              new TextRun({
                text: 'Este documento fue generado digitalmente por el sistema SANTI. La autenticidad puede validarse escaneando el código QR o accediendo a la URL indicada. La validez legal queda condicionada a la firma manuscrita o digital del profesional responsable.',
                size: 14, font: FONT, color: '94A3B8', italics: true,
              }),
            ]}),
          ],
        }),
      ]})],
    }),
  ]
}

// ─── Helper: generar QR como ImageRun standalone ─────────────────────────────
//   Para casos donde quieras solo el QR sin todo el sello.
export async function qrComoImagen(url: string, sizeMM = 30): Promise<Paragraph> {
  const px = Math.round(sizeMM * 3.78)  // mm a px aprox (96 DPI)
  const buffer = await generarQRBuffer(url, 256)
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({
      type: 'png',
      data: buffer,
      transformation: { width: px, height: px },
      altText: { title: 'QR', description: url, name: 'qr' },
    } as any)],
  })
}
