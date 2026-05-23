// lib/santi-report-template.ts
//
// Plantilla profesional del Centro Neuropsicología y Terapias SANTI.
// Estilo basado en los modelos oficiales del centro (LuTr — Informe de Terapia,
// SoRo — Informe de Evaluación). Sin emojis, sin gradientes morados, lenguaje
// clínico-formal. Pie de página con disclaimer legal y teléfono.

import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  HeadingLevel, PageNumber, Footer, Header,
} from 'docx'

// ─── Constantes de estilo ─────────────────────────────────────────────────
const COLOR_TITULO = '1E3A8A'      // azul oscuro institucional
const COLOR_SECCION = '0F172A'     // casi negro para títulos de sección
const COLOR_SUBSECCION = '1E293B'  // gris muy oscuro para subsecciones
const COLOR_TEXTO = '111827'        // texto principal
const COLOR_TEXTO_SECUNDARIO = '475569'
const COLOR_BORDE = '94A3B8'       // gris medio para bordes de tablas
const COLOR_HEADER_TABLA = '1E3A8A' // header de tabla en azul oscuro

const TELEFONO_CENTRO = '991 070 734'
const DISCLAIMER = 'Este documento carece de valor médico-Legal'

const BD = { style: BorderStyle.SINGLE, size: 6, color: COLOR_BORDE }
const BDR = { top: BD, bottom: BD, left: BD, right: BD }

// ─── Encabezado del informe ──────────────────────────────────────────────
//   Título + "Alumno(a): [iniciales]"
export function encabezado(tipoInforme: string, iniciales: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 0, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: tipoInforme,
          bold: true,
          size: 36,         // 18pt
          font: 'Arial',
          color: COLOR_TITULO,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 400 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Alumno(a): ${iniciales}`,
          size: 24,
          font: 'Arial',
          color: COLOR_TEXTO_SECUNDARIO,
        }),
      ],
    }),
  ]
}

// ─── Título de sección principal (en mayúsculas, con regla inferior azul) ─
export function tituloSeccion(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_TITULO, space: 4 } },
    children: [
      new TextRun({
        text: texto.toUpperCase(),
        bold: true,
        size: 24,
        font: 'Arial',
        color: COLOR_SECCION,
      }),
    ],
  })
}

// ─── Subsección (negrita simple, sin línea) ──────────────────────────────
export function subseccion(label: string, prosa: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({
          text: label + ': ',
          bold: true,
          size: 20,
          font: 'Arial',
          color: COLOR_SUBSECCION,
        }),
        new TextRun({
          text: prosa,
          size: 20,
          font: 'Arial',
          color: COLOR_TEXTO,
        }),
      ],
    }),
  ]
}

// ─── Párrafo de texto normal ─────────────────────────────────────────────
export function parrafo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text: texto,
        size: 20,
        font: 'Arial',
        color: COLOR_TEXTO,
      }),
    ],
  })
}

// ─── Lista con guiones (no usar bullets puntos) ──────────────────────────
export function items(textos: string[]): Paragraph[] {
  return textos.filter(t => t && t.trim().length > 0).map(t =>
    new Paragraph({
      spacing: { before: 40, after: 40 },
      indent: { left: 360, hanging: 200 },
      children: [
        new TextRun({ text: '- ', size: 20, font: 'Arial', color: COLOR_TEXTO }),
        new TextRun({ text: t, size: 20, font: 'Arial', color: COLOR_TEXTO }),
      ],
    })
  )
}

// ─── Tabla de Datos Generales ────────────────────────────────────────────
//   Recibe pares [label, valor] y arma la tabla clásica de 2 columnas
export function tablaDatosGenerales(filas: [string, string][]): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3200, 6160],
    rows: filas.map(([label, valor]) => new TableRow({
      children: [
        new TableCell({
          borders: BDR,
          width: { size: 3200, type: WidthType.DXA },
          shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 150, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: label,
              bold: true,
              size: 19,
              font: 'Arial',
              color: COLOR_SUBSECCION,
            })],
          })],
        }),
        new TableCell({
          borders: BDR,
          width: { size: 6160, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 150, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({
              text: valor || '—',
              size: 19,
              font: 'Arial',
              color: COLOR_TEXTO,
            })],
          })],
        }),
      ],
    })),
  })
}

// ─── Tabla de Habilidades y Logros (estilo LuTr) ─────────────────────────
//   Columnas: ÁREA · SUBÁREA · OBJETIVO PROGRAMADO · LOGROS
export type HabilidadFila = {
  area?: string            // ej: "B. DESEMPEÑO VISUAL"
  subarea?: string         // ej: "B18. Clasificar por característica"
  objetivo: string         // ej: "Con un criterio de 90%..."
  set?: string             // ej: "B18. SET 1 - Independiente."
  estado: 'logrado' | 'en_proceso' | 'casi_logrado' | 'no_iniciado'
  porcentaje?: number
}

export function tablaHabilidades(filas: HabilidadFila[]): Table {
  const headerCell = (texto: string, width: number) => new TableCell({
    borders: BDR,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLOR_HEADER_TABLA, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 120, right: 80 },
    children: [new Paragraph({
      children: [new TextRun({
        text: texto,
        bold: true,
        size: 17,
        font: 'Arial',
        color: 'FFFFFF',
      })],
    })],
  })

  const dataCell = (texto: string, width: number, opts?: { bold?: boolean; align?: any; color?: string }) => new TableCell({
    borders: BDR,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 80, bottom: 80, left: 120, right: 80 },
    children: [new Paragraph({
      alignment: opts?.align,
      children: [new TextRun({
        text: texto || '',
        bold: opts?.bold,
        size: 16,
        font: 'Arial',
        color: opts?.color || COLOR_TEXTO,
      })],
    })],
  })

  const estadoLabel = (f: HabilidadFila): string => {
    const pct = f.porcentaje != null ? ` (${f.porcentaje}%)` : ''
    switch (f.estado) {
      case 'logrado':       return 'Logrado' + pct
      case 'casi_logrado':  return 'Casi logrado' + pct
      case 'en_proceso':    return 'En proceso' + pct
      case 'no_iniciado':   return 'No iniciado'
      default:              return ''
    }
  }
  const estadoColor = (f: HabilidadFila): string => {
    switch (f.estado) {
      case 'logrado':       return '15803D'
      case 'casi_logrado':  return 'B45309'
      case 'en_proceso':    return '1E40AF'
      case 'no_iniciado':   return '6B7280'
      default:              return COLOR_TEXTO
    }
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2200, 3760, 1600],
    rows: [
      new TableRow({
        children: [
          headerCell('ÁREA',                 1800),
          headerCell('SUBÁREA',              2200),
          headerCell('OBJETIVO PROGRAMADO',  3760),
          headerCell('LOGROS',               1600),
        ],
      }),
      ...filas.map(f => new TableRow({
        children: [
          dataCell(f.area || '',                       1800, { bold: true }),
          dataCell(f.subarea || '',                    2200),
          dataCell((f.set ? `${f.set}\n` : '') + f.objetivo, 3760),
          dataCell(estadoLabel(f),                     1600, {
            align: AlignmentType.CENTER,
            bold: true,
            color: estadoColor(f),
          }),
        ],
      })),
    ],
  })
}

// ─── Glosario fijo de niveles de ayuda ABLLS-R ───────────────────────────
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
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [new TextRun({
        text: 'Glosario',
        italics: true,
        bold: true,
        size: 18,
        font: 'Arial',
        color: COLOR_TEXTO_SECUNDARIO,
      })],
    }),
    ...lineas.map(l => new Paragraph({
      spacing: { before: 20, after: 20 },
      indent: { left: 280 },
      children: [
        new TextRun({ text: '· ', size: 17, font: 'Arial', color: COLOR_TEXTO_SECUNDARIO }),
        new TextRun({ text: l, size: 17, italics: true, font: 'Arial', color: COLOR_TEXTO_SECUNDARIO }),
      ],
    })),
  ]
}

// ─── Bloque de Recomendaciones (tripartito) ──────────────────────────────
export type RecomendacionesBloque = {
  menor?: string[]
  familia?: string[]
  escuela?: string[]
}

export function recomendaciones(rec: RecomendacionesBloque): (Paragraph | Table)[] {
  const partes: (Paragraph | Table)[] = []
  partes.push(tituloSeccion('Recomendaciones'))

  if (rec.menor && rec.menor.length > 0) {
    partes.push(new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [new TextRun({
        text: 'Para el menor',
        bold: true,
        size: 21,
        font: 'Arial',
        color: COLOR_SUBSECCION,
      })],
    }))
    partes.push(...items(rec.menor))
  }
  if (rec.familia && rec.familia.length > 0) {
    partes.push(new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [new TextRun({
        text: 'Para la familia',
        bold: true,
        size: 21,
        font: 'Arial',
        color: COLOR_SUBSECCION,
      })],
    }))
    partes.push(...items(rec.familia))
  }
  if (rec.escuela && rec.escuela.length > 0) {
    partes.push(new Paragraph({
      spacing: { before: 200, after: 60 },
      children: [new TextRun({
        text: 'Para la escuela',
        bold: true,
        size: 21,
        font: 'Arial',
        color: COLOR_SUBSECCION,
      })],
    }))
    partes.push(...items(rec.escuela))
  }
  return partes
}

// ─── Pie de página oficial ──────────────────────────────────────────────
export function piePaginaOficial(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDE, space: 4 } },
        spacing: { before: 60 },
        children: [
          new TextRun({
            text: DISCLAIMER + '    Página ',
            size: 16,
            font: 'Arial',
            color: COLOR_TEXTO_SECUNDARIO,
            italics: true,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 16,
            font: 'Arial',
            color: COLOR_TEXTO_SECUNDARIO,
            italics: true,
          }),
          new TextRun({
            text: '    ·    ' + TELEFONO_CENTRO,
            size: 16,
            font: 'Arial',
            color: COLOR_TEXTO_SECUNDARIO,
          }),
        ],
      }),
    ],
  })
}

// ─── Bloque de iniciales del paciente (LuTr, SoRo, etc.) ────────────────
//   Genera el código abreviado de 2-4 letras a partir del nombre completo
export function generarIniciales(nombreCompleto: string): string {
  if (!nombreCompleto) return ''
  const palabras = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return ''
  if (palabras.length === 1) return (palabras[0].slice(0, 4)).replace(/^./, c => c.toUpperCase())
  // 2 letras del primer apellido + 2 letras del primer nombre
  const [p1, p2] = palabras
  const cap = (s: string, n: number) =>
    s.charAt(0).toUpperCase() + s.slice(1, n).toLowerCase()
  return cap(p1, 2) + cap(p2, 2)
}

// ─── Configuración estándar del documento ───────────────────────────────
export const DOC_STYLES = {
  default: {
    document: { run: { font: 'Arial', size: 20 } },
  },
  paragraphStyles: [
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      run: { bold: true, size: 32, font: 'Arial', color: COLOR_TITULO },
      paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
    },
  ],
}

export const DOC_NUMBERING = {
  config: [{
    reference: 'bul',
    levels: [{
      level: 0,
      format: LevelFormat.BULLET,
      text: '-',
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 600, hanging: 300 } } },
    }],
  }],
}

export const DOC_PAGE_PROPS = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  },
}

// ─── Tabla de subpruebas (estilo SoRo — evaluaciones) ───────────────────
//   Columnas: SUBPRUEBA · ¿QUÉ EVALÚA? · PUNT. DIRECTA · CENTIL · NIVEL
export type SubpruebaFila = {
  subprueba: string
  evalua?: string
  puntDirecta?: string | number
  centil?: string | number
  nivel: string
}

export function tablaSubpruebas(filas: SubpruebaFila[]): Table {
  const headerCell = (texto: string, width: number) => new TableCell({
    borders: BDR,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLOR_HEADER_TABLA, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 120, right: 80 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: texto,
        bold: true,
        size: 17,
        font: 'Arial',
        color: 'FFFFFF',
      })],
    })],
  })

  const nivelColor = (n: string): string => {
    const low = n.toLowerCase()
    if (/(muy bajo|dificult)/.test(low)) return 'BE123C'
    if (/bajo/.test(low))                return 'B45309'
    if (/(promedio|normal)/.test(low))   return '15803D'
    if (/(alto)/.test(low))              return '1E40AF'
    return COLOR_TEXTO
  }

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 3600, 1300, 1100, 960],
    rows: [
      new TableRow({
        children: [
          headerCell('SUBPRUEBA',         2400),
          headerCell('¿QUÉ EVALÚA?',      3600),
          headerCell('PUNT. DIRECTA',     1300),
          headerCell('CENTIL',            1100),
          headerCell('NIVEL',             960),
        ],
      }),
      ...filas.map(f => new TableRow({
        children: [
          new TableCell({
            borders: BDR, width: { size: 2400, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            children: [new Paragraph({
              children: [new TextRun({ text: f.subprueba, bold: true, size: 17, font: 'Arial', color: COLOR_SUBSECCION })],
            })],
          }),
          new TableCell({
            borders: BDR, width: { size: 3600, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            children: [new Paragraph({
              children: [new TextRun({ text: f.evalua || '', size: 16, font: 'Arial', color: COLOR_TEXTO })],
            })],
          }),
          new TableCell({
            borders: BDR, width: { size: 1300, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(f.puntDirecta ?? '—'), size: 17, font: 'Arial', color: COLOR_TEXTO })],
            })],
          }),
          new TableCell({
            borders: BDR, width: { size: 1100, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: String(f.centil ?? '—'), size: 17, font: 'Arial', color: COLOR_TEXTO })],
            })],
          }),
          new TableCell({
            borders: BDR, width: { size: 960, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: f.nivel, bold: true, size: 16, font: 'Arial', color: nivelColor(f.nivel) })],
            })],
          }),
        ],
      })),
    ],
  })
}

// ─── Tabla de criterios diagnósticos (estilo SoRo — DSM-5) ──────────────
export type CriterioFila = {
  criterio: string  // ej: "A. Dificultades para aprender..."
  presentacion: string
  cumple: boolean
}

export function tablaCriteriosDSM(filas: CriterioFila[]): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3400, 4500, 1460],
    rows: [
      new TableRow({
        children: ['CRITERIO', '¿QUÉ SE PRESENTA?', 'CUMPLIMIENTO'].map((h, i) => new TableCell({
          borders: BDR,
          width: { size: [3400, 4500, 1460][i], type: WidthType.DXA },
          shading: { fill: COLOR_HEADER_TABLA, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 120, right: 80 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: h, bold: true, size: 17, font: 'Arial', color: 'FFFFFF' })],
          })],
        })),
      }),
      ...filas.map(f => new TableRow({
        children: [
          new TableCell({
            borders: BDR, width: { size: 3400, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            children: [new Paragraph({
              children: [new TextRun({ text: f.criterio, size: 17, font: 'Arial', color: COLOR_TEXTO })],
            })],
          }),
          new TableCell({
            borders: BDR, width: { size: 4500, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 80 },
            children: [new Paragraph({
              children: [new TextRun({ text: f.presentacion || '—', size: 17, font: 'Arial', color: COLOR_TEXTO })],
            })],
          }),
          new TableCell({
            borders: BDR, width: { size: 1460, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                text: f.cumple ? '✓ Cumple' : '— No cumple',
                bold: true,
                size: 17,
                font: 'Arial',
                color: f.cumple ? '15803D' : '94A3B8',
              })],
            })],
          }),
        ],
      })),
    ],
  })
}
