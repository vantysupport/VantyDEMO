// app/api/reporte-sesion-aba/route.ts
// Genera un reporte Word de sesión ABA a partir de un registroId
// Busca el registro en registro_aba, luego llama a generate-session-report

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildAIContext } from '@/lib/ai-context-builder'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel,
  PageNumber, Footer, Header, NumberFormat,
} from 'docx'
import {
  portadaInstitucional, selloQRVerificacionAsync, piePaginaOficial,
  generarCodigoDocumento, generarIniciales, DOC_PAGE_PROPS,
} from '@/lib/santi-report-template'
import { registrarDocumentoEmitido } from '@/lib/registrar-documento'

// ── Helpers de formato ────────────────────────────────────────────────────────
const BD = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const BDR = { top: BD, bottom: BD, left: BD, right: BD }

function parseNivel(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number' && !isNaN(val)) return Math.min(100, Math.max(0, Math.round(val)))
  const s = String(val).trim()
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const num = s.match(/(\d+)/)
  if (num) return Math.min(100, Math.max(0, parseInt(num[1])))
  const lower = s.toLowerCase()
  if (lower.includes('completamente') || lower.includes('dominado') || lower.includes('independiente')) return 90
  if (lower.includes('mayormente') || lower.includes('alto') || lower.includes('excelente')) return 75
  if (lower.includes('parcialmente') || lower.includes('medio') || lower.includes('proceso')) return 50
  if (lower.includes('mínimo') || lower.includes('bajo') || lower.includes('emergente')) return 20
  if (lower.includes('no logrado') || lower.includes('sin respuesta')) return 5
  return null
}

function escala5(val: any): string {
  if (!val) return 'N/E'
  const n = parseNivel(val)
  if (!n) return String(val)
  const pct = Math.round((n / 100) * 5)
  const stars = '★'.repeat(Math.min(5, pct)) + '☆'.repeat(Math.max(0, 5 - pct))
  return `${stars}  (${n}%)`
}

function h2(text: string) {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 4 } },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Arial', color: '1E293B' })],
  })
}
function pp(text: string) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, size: 20, font: 'Arial', color: '374151' })],
  })
}
function kv(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders: BDR,
        width: { size: 3200, type: WidthType.DXA },
        shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 140, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: '475569' })] })],
      }),
      new TableCell({
        borders: BDR,
        width: { size: 6160, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 140, right: 80 },
        children: [new Paragraph({ children: [new TextRun({ text: value || 'No registrado', size: 19, font: 'Arial', color: '1E293B' })] })],
      }),
    ],
  })
}

// ── Construir documento Word ──────────────────────────────────────────────────
async function buildDoc(d: any, childName: string, childAge: string, analisisIA: string): Promise<Buffer> {
  const hoy = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const nombreCorto = childName.split(' ')[0]

  const nivelLogro = parseNivel(d.nivel_logro_objetivos)
  const logroColor = nivelLogro && nivelLogro >= 75 ? '15803D' : nivelLogro && nivelLogro >= 50 ? 'B45309' : 'BE123C'
  const logroBg = nivelLogro && nivelLogro >= 75 ? 'DCFCE7' : nivelLogro && nivelLogro >= 50 ? 'FEF3C7' : 'FEE2E2'

  // Parsear análisis IA en párrafos
  const parrafosIA = analisisIA
    .split('\n')
    .filter(l => l.trim())
    .map(l => pp(l.replace(/^[*#\-–]+\s*/, '')))

  // Código de documento + QR de verificación
  const codigoDoc = generarCodigoDocumento(d.child_id || childName, 'sesion-aba')
  const sellosVerif = await selloQRVerificacionAsync({
    codigoDoc,
    fechaEmision: hoy,
    especialista: 'Equipo Clínico SANTI',
  })

  const children = [
    // ── PORTADA INSTITUCIONAL PROFESIONAL ──
    ...portadaInstitucional({
      tipoInforme: 'REGISTRO DE SESIÓN ABA',
      nombrePaciente: childName,
      edadPaciente: childAge ? `${childAge} años` : '—',
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'Centro Especializado en Neuropsicología y Terapias',
      fechaEmision: hoy,
      codigoDoc,
    }),
    // (la portada ya incluye su propio salto de página)

    // ── I. DATOS DE LA SESIÓN ─────────────────────────────────────────────────
    h2('I.  DATOS DE LA SESIÓN'),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3200, 6160],
      rows: [
        kv('Paciente', childName),
        kv('Edad', childAge ? `${childAge} años` : 'No registrada'),
        kv('Fecha de sesión', d.fecha_sesion
          ? new Date(d.fecha_sesion).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
          : hoy),
        kv('Duración', d.duracion_minutos ? `${d.duracion_minutos} minutos` : 'No registrada'),
        kv('Tipo de sesión', d.tipo_sesion || 'Individual'),
        kv('Objetivo principal', d.objetivo_principal || 'No registrado'),
      ],
    }),

    // ── II. REGISTRO ABC ──────────────────────────────────────────────────────
    h2('II.  REGISTRO ABC (Antecedente – Conducta – Consecuencia)'),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3200, 6160],
      rows: [
        kv('Antecedente (A)', d.antecedente || 'No registrado'),
        kv('Conducta (B)', d.conducta || 'No registrada'),
        kv('Consecuencia (C)', d.consecuencia || 'No registrada'),
        kv('Función estimada', d.funcion_estimada || 'No registrada'),
      ],
    }),

    // ── III. DESEMPEÑO ────────────────────────────────────────────────────────
    h2('III.  INDICADORES DE DESEMPEÑO'),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3200, 6160],
      rows: [
        kv('Nivel de atención sostenida', escala5(d.nivel_atencion)),
        kv('Respuesta a instrucciones', escala5(d.respuesta_instrucciones)),
        kv('Tolerancia a la frustración', escala5(d.tolerancia_frustracion)),
        kv('Interacción social', escala5(d.interaccion_social)),
        kv('Iniciativa comunicativa', escala5(d.iniciativa_comunicativa)),
      ],
    }),

    // ── IV. NIVEL DE LOGRO ────────────────────────────────────────────────────
    h2('IV.  NIVEL DE LOGRO DE OBJETIVOS'),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: { top: BD, bottom: BD, left: BD, right: BD },
              shading: { fill: logroBg, type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 200, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: nivelLogro ? `${nivelLogro}%` : d.nivel_logro_objetivos || 'N/E', bold: true, size: 80, font: 'Arial', color: logroColor })],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60 },
                  children: [new TextRun({ text: 'Nivel de logro', size: 22, font: 'Arial', color: '64748B', bold: true })],
                }),
              ],
            }),
            new TableCell({
              borders: { top: BD, bottom: BD, left: BD, right: BD },
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: '🎯  Habilidades trabajadas', size: 18, font: 'Arial', color: '475569' })] }),
                new Paragraph({ spacing: { before: 20, after: 60 }, children: [new TextRun({ text: Array.isArray(d.habilidades_objetivo) ? d.habilidades_objetivo.join(', ') : (d.habilidades_objetivo || 'No especificado'), bold: true, size: 19, font: 'Arial', color: '1E293B' })] }),
                new Paragraph({ spacing: { before: 0 }, children: [new TextRun({ text: '🔧  Nivel de ayudas', size: 18, font: 'Arial', color: '475569' })] }),
                new Paragraph({ spacing: { before: 20, after: 60 }, children: [new TextRun({ text: d.ayudas_utilizadas || 'No registrado', bold: true, size: 19, font: 'Arial', color: '1E293B' })] }),
                new Paragraph({ spacing: { before: 0 }, children: [new TextRun({ text: '💡  Técnicas aplicadas', size: 18, font: 'Arial', color: '475569' })] }),
                new Paragraph({ spacing: { before: 20 }, children: [new TextRun({ text: Array.isArray(d.tecnicas_aplicadas) ? d.tecnicas_aplicadas.join(', ') : (d.tecnicas_aplicadas || 'No registrado'), bold: true, size: 19, font: 'Arial', color: '1E293B' })] }),
              ],
            }),
          ],
        }),
      ],
    }),

    // ── V. CONDUCTAS Y ESTRATEGIAS ────────────────────────────────────────────
    ...(d.conductas_desafiantes || d.estrategias_manejo || d.reforzadores_efectivos ? [
      h2('V.  CONDUCTAS Y ESTRATEGIAS'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3200, 6160],
        rows: [
          ...(d.conductas_desafiantes ? [kv('Conductas desafiantes', d.conductas_desafiantes)] : []),
          ...(d.estrategias_manejo ? [kv('Estrategias de manejo', d.estrategias_manejo)] : []),
          ...(d.reforzadores_efectivos ? [kv('Reforzadores efectivos', d.reforzadores_efectivos)] : []),
        ],
      }),
    ] : []),

    // ── VI. OBSERVACIONES ─────────────────────────────────────────────────────
    ...(d.observaciones_clinicas || d.observaciones_generales ? [
      h2('VI.  OBSERVACIONES CLÍNICAS'),
      ...((d.observaciones_clinicas || d.observaciones_generales).split('\n').filter((l: string) => l.trim()).map((l: string) => pp(l))),
    ] : []),

    // ── VII. ANÁLISIS IA ──────────────────────────────────────────────────────
    h2('VII.  ANÁLISIS CLÍNICO — IA SUPERVISADA'),
    new Paragraph({
      spacing: { before: 60, after: 100 },
      shading: { fill: 'F0F9FF', type: ShadingType.CLEAR },
      border: { left: { style: BorderStyle.SINGLE, size: 10, color: '2563EB', space: 8 } },
      children: [new TextRun({ text: 'Análisis generado con IA clínica supervisada. Requiere revisión del especialista.', size: 17, font: 'Arial', color: '1D4ED8', italics: true })],
    }),
    ...parrafosIA,

    // ── VIII. RECOMENDACIONES PARA EL HOGAR ───────────────────────────────────
    ...(d.tarea_casa ? [
      h2('VIII.  TAREA PARA CASA'),
      ...d.tarea_casa.split('\n').filter((l: string) => l.trim()).map((l: string) => pp(l)),
    ] : []),

    ...(d.mensaje_familia ? [
      h2('Mensaje para la Familia 💜'),
      new Paragraph({
        spacing: { before: 80, after: 160 },
        shading: { fill: 'F5F3FF', type: ShadingType.CLEAR },
        border: { left: { style: BorderStyle.SINGLE, size: 12, color: '7C3AED', space: 10 } },
        children: [new TextRun({ text: d.mensaje_familia, size: 21, font: 'Arial', color: '4C1D95', italics: true })],
      }),
    ] : []),

    // ── SELLO QR DE VERIFICACIÓN ──────────────────────────────────────────────
    new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }),
    ...sellosVerif,

    // ── CIERRE ────────────────────────────────────────────────────────────────
    new Paragraph({
      spacing: { before: 320 },
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 8 } },
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI  ·  Equipo Clínico ABA', size: 20, font: 'Arial', color: '1E3A8A', bold: true })],
    }),
    new Paragraph({
      spacing: { before: 40, after: 0 },
      children: [new TextRun({ text: `${hoy}  ·  Documento confidencial — uso clínico exclusivo`, size: 16, font: 'Arial', color: '94A3B8', italics: true })],
    }),
  ]

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: DOC_PAGE_PROPS,
      footers: { default: piePaginaOficial() },
      children,
    }],
  })

  // Registrar el documento emitido para verificación pública vía QR
  await registrarDocumentoEmitido({
    codigoDoc,
    childId: d.child_id,
    tipo: 'sesion_aba',
    pacienteNombre: childName,
    pacienteIniciales: generarIniciales(childName),
    fileName: `Sesion_ABA_${childName.replace(/\s+/g, '_')}_${hoyISO}.docx`,
    metadata: {
      nivel_logro: nivelLogro,
      fecha_sesion: d.fecha_sesion || hoyISO,
    },
  })

  return Packer.toBuffer(doc)
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { registroId } = body

    if (!registroId) {
      return NextResponse.json({ error: 'registroId requerido' }, { status: 400 })
    }

    // 1. Obtener el registro ABA completo
    const { data: registro, error: regError } = await supabaseAdmin
      .from('registro_aba')
      .select('*, children(name, age)')
      .eq('id', registroId)
      .single()

    if (regError || !registro) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }

    const d = (registro as any).datos || registro
    const child = (registro as any).children
    const childName = child?.name || d.child_name || 'Paciente'
    const childAge = String(child?.age || d.child_age || '')
    const childId = (registro as any).child_id

    // 2. Usar análisis IA guardado o generar uno nuevo
    let analisisIA: string = ''

    if ((registro as any).ai_analysis) {
      // Hay análisis previo guardado
      const ai = (registro as any).ai_analysis
      analisisIA = typeof ai === 'string' ? ai :
        (ai.analisis_clinico || ai.resumen || ai.recomendaciones || JSON.stringify(ai, null, 2))
    } else {
      // Generar análisis con IA
      try {
        const ctx = await buildAIContext(childId, childName, childAge, 'sesión ABA')
        analisisIA = await callGroqSimple(
          'Eres neuropsicólogo clínico ABA. Redacta en párrafos fluidos, lenguaje técnico accesible. Sin bullets ni asteriscos.',
          `Análisis clínico de sesión ABA de ${childName} (${childAge} años):
Antecedente: ${d.antecedente || 'N/E'}
Conducta: ${d.conducta || 'N/E'}
Consecuencia: ${d.consecuencia || 'N/E'}
Función estimada: ${d.funcion_estimada || 'N/E'}
Nivel de logro: ${d.nivel_logro_objetivos || 'N/E'}
Atención: ${d.nivel_atencion || 'N/E'}/5
Tolerancia frustración: ${d.tolerancia_frustracion || 'N/E'}/5
Observaciones: ${d.observaciones_clinicas || d.observaciones_generales || 'Ninguna'}

Contexto previo: ${ctx.historialTexto || 'Primera sesión o sin historial.'}

Escribe 3 párrafos: (1) análisis funcional de la conducta, (2) interpretación del nivel de logro y tendencia, (3) recomendaciones para la próxima sesión.`,
          { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 600 }
        )
      } catch {
        analisisIA = 'Análisis automático no disponible. Por favor, revise los datos registrados.'
      }
    }

    // 3. Generar documento Word
    const buffer = await buildDoc(d, childName, childAge, analisisIA)
    const uint8 = new Uint8Array(buffer)
    const nombreArchivo = `Sesion_ABA_${childName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
        'Content-Length': String(uint8.byteLength),
      },
    })
  } catch (e: any) {
    console.error('Error reporte-sesion-aba:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message || 'Error al generar el reporte' }, { status: 500 })
  }
}
