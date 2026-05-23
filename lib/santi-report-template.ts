// lib/santi-report-template.ts
//
// Plantilla profesional SANTI v2 — supera el estilo CentralReach.
// Diseño clínico de nivel neuropsicólogo: cabecera institucional, tabla de
// datos con franjas alternas, títulos con fondo azul sólido, tabla de logros
// con badges de color semántico, pie de página paginado.
// Sin emojis · Sin gradientes púrpura · Lenguaje clínico-formal peruano.

import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  HeadingLevel, PageNumber, Footer, Header, VerticalAlign,
  VerticalMergeType, TabStopType, TabStopPosition,
} from 'docx'

// ─── Paleta institucional ────────────────────────────────────────────────────
export const COLOR = {
  azulDark:    '1E3A8A',   // encabezados de sección, logo
  azulMed:     '2563EB',   // acentos, viñetas
  azulLight:   'DBEAFE',   // fondo celdas de datos pares
  grisOscuro:  '0F172A',   // casi negro
  grisMed:     '334155',   // texto general
  grisClaro:   'F8FAFC',   // fondo alterno tabla
  borde:       'CBD5E1',   // bordes de tabla
  verde:       '15803D',   // Logrado
  verdeBg:     'DCFCE7',
  amarillo:    'B45309',   // Casi logrado
  amarilloBg:  'FEF3C7',
  azulEn:      '1D4ED8',   // En proceso
  azulEnBg:    'DBEAFE',
  grisNo:      '6B7280',   // No iniciado
  grisNoBg:    'F3F4F6',
  blanco:      'FFFFFF',
} as const

export const FONT      = 'Calibri'
export const TELEFONO  = '991 070 734'
export const DISCLAIMER = 'Este documento carece de valor médico-legal'

const BD  = { style: BorderStyle.SINGLE, size: 4, color: COLOR.borde } as const
export const BDR = { top: BD, bottom: BD, left: BD, right: BD } as const

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
      children: [
        new TextRun({ text: tipoInforme.toUpperCase(), bold: true, size: 40, font: FONT, color: COLOR.azulDark }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Alumno(a): ', size: 22, font: FONT, color: COLOR.grisMed }),
        new TextRun({ text: iniciales, bold: true, size: 22, font: FONT, color: COLOR.azulDark }),
      ],
    }),
    // Línea decorativa de cierre de portada
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
    children: [
      new TextRun({ text: `  ${texto.toUpperCase()}`, bold: true, size: 22, font: FONT, color: COLOR.blanco }),
    ],
  })
}

// ─── Subsección label + prosa ─────────────────────────────────────────────────
export function subseccion(label: string, prosa: string): Paragraph {
  return new Paragraph({
    spacing: { before: 140, after: 60 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({ text: label + ': ', bold: true, size: 19, font: FONT, color: COLOR.grisOscuro }),
      new TextRun({ text: prosa, size: 19, font: FONT, color: COLOR.grisMed }),
    ],
  })
}

// ─── Párrafo justificado ──────────────────────────────────────────────────────
export function parrafo(texto: string): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: texto, size: 19, font: FONT, color: COLOR.grisMed })],
  })
}

// ─── Lista con guiones ────────────────────────────────────────────────────────
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
// Franjas alternas blanco / azul muy claro · etiquetas en azul oscuro
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
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 18, font: FONT, color: COLOR.azulDark })],
          })],
        }),
        new TableCell({
          borders: BDR,
          width: { size: 6400, type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? COLOR.blanco : COLOR.grisClaro, type: ShadingType.CLEAR },
          margins: { top: 100, bottom: 100, left: 180, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: valor || '—', size: 18, font: FONT, color: COLOR.grisMed })],
          })],
        }),
      ],
    })),
  })
}

// ─── Tabla Habilidades y Logros ───────────────────────────────────────────────
export type EstadoLogro = 'logrado' | 'casi_logrado' | 'en_proceso' | 'no_iniciado'

export type HabilidadFila = {
  area?:       string   // se mergea verticalmente cuando es la misma
  subarea?:    string   // ídem
  objetivo:    string   // objetivo o texto del SET cuando es fila SET
  set?:        string   // si existe, esta fila es un SET row (se muestra en lugar de objetivo)
  estado:      EstadoLogro
  porcentaje?: number
}

function estadoTexto(f: HabilidadFila): string {
  const pct = f.porcentaje != null ? ` (${f.porcentaje}%)` : ''
  switch (f.estado) {
    case 'logrado':      return 'Logrado' + pct
    case 'casi_logrado': return 'Casi logrado' + pct
    case 'en_proceso':   return 'En proceso' + pct
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
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: texto, bold: true, size: 17, font: FONT, color: COLOR.blanco })],
    })],
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
          children: [new TextRun({
            text: texto || '',
            bold: opts.bold,
            size: opts.size || 16,
            font: FONT,
            color: opts.color || COLOR.grisMed,
          })],
        })],
  })

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1560, 1960, 4040, 1800],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          hCell('ÁREA', 1560),
          hCell('SUBÁREA', 1960),
          hCell('OBJETIVO / SET', 4040),
          hCell('ESTADO', 1800),
        ],
      }),
      ...filas.map(f => {
        const isSet       = !f.subarea || f.subarea.trim() === ''
        const areaMerge   = f.area?.trim() ? 'restart' : 'continue'
        const subMerge    = isSet ? 'continue' : 'restart'
        const ec          = estadoColor(f.estado)
        return new TableRow({
          children: [
            dCell(f.area || '', 1560, { bold: true, size: 15, color: COLOR.azulDark, merge: areaMerge as any }),
            dCell(f.subarea || '', 1960, { size: 15, merge: subMerge as any }),
            dCell(isSet ? (f.set || '') : f.objetivo, 4040, { size: 15 }),
            dCell(estadoTexto(f), 1800, { align: AlignmentType.CENTER, bold: true, size: 15, color: ec.text, bg: ec.bg }),
          ],
        })
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
    new Paragraph({
      spacing: { before: 280, after: 100 },
      children: [new TextRun({ text: 'Glosario de términos', bold: true, italics: true, size: 19, font: FONT, color: COLOR.grisMed })],
    }),
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
export type RecomendacionesBloque = {
  menor?:   string[]
  familia?: string[]
  escuela?: string[]
}

export function recomendaciones(rec: RecomendacionesBloque): Paragraph[] {
  const out: Paragraph[] = [tituloSeccion('Recomendaciones')]
  const subLabel = (txt: string) => new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: txt, bold: true, size: 20, font: FONT, color: COLOR.azulDark })],
  })
  if (rec.menor?.length)   { out.push(subLabel('Para el menor / la menor'));   out.push(...items(rec.menor)) }
  if (rec.familia?.length) { out.push(subLabel('Para la familia'));              out.push(...items(rec.familia)) }
  if (rec.escuela?.length) { out.push(subLabel('Para la escuela / centro educativo')); out.push(...items(rec.escuela)) }
  return out
}

// ─── Bloque de firma final ────────────────────────────────────────────────────
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

// ─── Tabla de subpruebas (SoRo — evaluaciones psicométricas) ─────────────────
export type SubpruebaFila = {
  subprueba: string; evalua?: string
  puntDirecta?: string | number; centil?: string | number; nivel: string
}

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
      new TableRow({ children: [hCell('SUBPRUEBA',2400),hCell('¿QUÉ EVALÚA?',3600),hCell('PUNT. DIRECTA',1200),hCell('CENTIL',1000),hCell('NIVEL',1160)] }),
      ...filas.map(f => new TableRow({ children: [
        new TableCell({ borders:BDR,width:{size:2400,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:f.subprueba,bold:true,size:17,font:FONT,color:COLOR.azulDark})]})] }),
        new TableCell({ borders:BDR,width:{size:3600,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:f.evalua||'',size:16,font:FONT,color:COLOR.grisMed})]})] }),
        new TableCell({ borders:BDR,width:{size:1200,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:String(f.puntDirecta??'—'),size:17,font:FONT,color:COLOR.grisMed})]})] }),
        new TableCell({ borders:BDR,width:{size:1000,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:String(f.centil??'—'),size:17,font:FONT,color:COLOR.grisMed})]})] }),
        new TableCell({ borders:BDR,width:{size:1160,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:f.nivel,bold:true,size:16,font:FONT,color:nivelColor(f.nivel)})]})] }),
      ]})),
    ],
  })
}

// ─── Tabla criterios DSM-5 (SoRo) ────────────────────────────────────────────
export type CriterioFila = { criterio: string; presentacion: string; cumple: boolean }

export function tablaCriteriosDSM(filas: CriterioFila[]): Table {
  const hCell = (t:string,w:number) => new TableCell({borders:BDR,width:{size:w,type:WidthType.DXA},shading:{fill:COLOR.azulDark,type:ShadingType.CLEAR},margins:{top:100,bottom:100,left:120,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:t,bold:true,size:17,font:FONT,color:COLOR.blanco})]})]})
  return new Table({
    width:{size:9360,type:WidthType.DXA},columnWidths:[3400,4500,1460],
    rows:[
      new TableRow({children:[hCell('CRITERIO',3400),hCell('¿QUÉ SE PRESENTA?',4500),hCell('CUMPLIMIENTO',1460)]}),
      ...filas.map(f=>new TableRow({children:[
        new TableCell({borders:BDR,width:{size:3400,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:f.criterio,size:17,font:FONT,color:COLOR.grisMed})]})] }),
        new TableCell({borders:BDR,width:{size:4500,type:WidthType.DXA},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:f.presentacion||'—',size:17,font:FONT,color:COLOR.grisMed})]})] }),
        new TableCell({borders:BDR,width:{size:1460,type:WidthType.DXA},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:f.cumple?'✓ Cumple':'— No cumple',bold:true,size:17,font:FONT,color:f.cumple?COLOR.verde:'94A3B8'})]})] }),
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
