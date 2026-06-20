export const maxDuration = 60;

// ==============================================================================
// API: ANALIZAR FORMULARIO DE PADRES + GENERAR REPORTE WORD
// Ruta: /app/api/analyze-parent-form-submission/route.ts
//
// FIX CRÍTICO: Antes llamaba a /api/generate-report via fetch(localhost:3000)
// que falla en Vercel serverless. Ahora toda la lógica Word está INLINE aquí.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildAIContext, parseAIJson } from '@/lib/ai-context-builder'

const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel,
        PageBreak } = require('docx');


// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const userLocale = body.locale || request.headers.get('x-locale') || 'es'
    const { formId, formType, formTitle, responses, childId, parentId } = body


    // ── 1. Contexto completo: RAG + historial + centro ────────────────────
    const searchQuery = `${formTitle || 'formulario padres'} familia intervención conducta en casa`
    const ctx = await buildAIContext(childId, undefined, undefined, searchQuery)
    const childName = ctx.childName
    const childAgeStr = ctx.childAge
    const childAge: number | undefined = childAgeStr && !isNaN(Number(childAgeStr)) ? Number(childAgeStr) : undefined
    const diagnosis = ctx.diagnosis
    const historialTexto = ctx.fullContext  // RAG + centro + historial del niño

    // ── 2. Análisis IA del formulario ──────────────────────────────────────
    const responsesText = Object.entries(responses)
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}`)
      .join('\n')


    const prompt = `Eres un supervisor clínico especialista en neurodiversidad (TDAH, TEA, trastornos del desarrollo) y analista de conducta (IBA).

CONTEXTO CLÍNICO COMPLETO:
${historialTexto}

PACIENTE: ${childName}${childAge ? ` (${childAge} años)` : ''}
DIAGNÓSTICO: ${diagnosis}
FORMULARIO: ${formTitle}

RESPUESTAS DEL FORMULARIO:
${responsesText}

INSTRUCCIÓN: Usa el historial y base de conocimiento para contextualizar. Si hay protocolos relevantes en la base de conocimiento, referenciarlos. El mensaje a padres DEBE usar el nombre real "${childName}" y ser específico a sus respuestas, no genérico.

Responde SOLO con JSON (sin markdown):
{
  "resumen_ejecutivo": "3-4 oraciones contextualizadas con el historial y datos concretos",
  "analisis_clinico": "4-5 oraciones técnicas referenciando historial previo y fuentes clínicas si aplica",
  "areas_fortaleza": ["Fortaleza específica 1", "Fortaleza 2", "Fortaleza 3"],
  "areas_trabajo": ["Área prioritaria 1", "Área 2", "Área 3"],
  "recomendaciones": ["Recomendación accionable 1", "Rec 2", "Rec 3", "Rec 4"],
  "actividades_en_casa": ["Actividad específica 1", "Act 2", "Act 3"],
  "indicadores_clave": ["Ind 1", "Ind 2", "Ind 3"],
  "nivel_alerta": "bajo",
  "mensaje_padres": "Mensaje empático 2-3 oraciones usando el nombre ${childName}, específico a lo reportado.",
  "proximo_paso": "Acción concreta próxima sesión"
}`

    const aiResponse = await callGroqSimple(
        'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.',
        prompt,
        { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 2000 }
      )

    const text = aiResponse || '{}'
    let analysis: any = {}
    try { analysis = JSON.parse(text.replace(/```json|```/g, '').trim()) }
    catch { analysis = { resumen_ejecutivo: text } }

    // ── 3. Guardar en tabla clínica correspondiente ────────────────────────
    // Cuando el padre completa un formulario clínico, guardarlo en la misma
    // tabla que usa el admin para que aparezca en Historial & IA
    try {
      const clinicalTableMap: Record<string, string> = {
        anamnesis:     'anamnesis_completa',
        entorno_hogar: 'registro_entorno_hogar',
        aba:           'registro_aba',
      }
      const clinicalTable = clinicalTableMap[formType]
      if (clinicalTable) {
        const now = new Date().toISOString()
        const clinicalPayload: any = {
          child_id:    childId,
          datos:       responses,
          form_type:   formType,
          ai_analysis: analysis,
        }
        // anamnesis_completa usa fecha_creacion, registro_aba usa fecha_sesion
        if (formType === 'anamnesis')     clinicalPayload.fecha_creacion = now
        if (formType === 'aba')           clinicalPayload.fecha_sesion = now.split('T')[0]
        if (formType === 'entorno_hogar') clinicalPayload.created_at = now

        await supabaseAdmin.from(clinicalTable).insert([clinicalPayload])
        console.log(`✅ Guardado en tabla clínica: ${clinicalTable}`)
      } else {
        // Para otros tipos guardar en form_responses
        await supabaseAdmin.from('form_responses').insert([{
          child_id:    childId,
          form_type:   formType,
          form_title:  formTitle,
          responses:   responses,
          ai_analysis: analysis,
          created_at:  new Date().toISOString(),
        }])
        console.log(`✅ Guardado en form_responses (tipo: ${formType})`)
      }
    } catch (clinicalErr) {
      console.error('⚠️ Error guardando en tabla clínica (no crítico):', clinicalErr)
    }

    // ── 4. Cola de aprobación ──────────────────────────────────────────────
    await supabaseAdmin.from('parent_message_approvals').insert([{
      child_id:       childId,
      parent_id:      parentId,
      source:         'parent_form',
      source_title:   formTitle,
      ai_message:     analysis.mensaje_padres || 'Gracias por completar el formulario.',
      edited_message: analysis.mensaje_padres || 'Gracias por completar el formulario.',
      ai_analysis:    analysis,
      session_data:   { form_type: formType, form_id: formId, responses },
      status:         'pending_approval',
      created_at:     new Date().toISOString(),
    }])

    // ── 4. Generar Word INLINE (sin fetch a localhost) ─────────────────────
    try {
      const normalizedData = { responses, ai_analysis: analysis }

      // ⚡ NO llamamos Gemini de nuevo - el análisis JSON ya está listo
      // createNeuroFormReport lo usa directamente desde normalizedData.ai_analysis

      // Documento Word
      const docBuffer = await buildWordDocument({
        reportType: formType,
        childName,
        childAge,
        reportData: normalizedData,
        aiAnalysis: null,  // null = usa el análisis embebido en reportData.ai_analysis
        formTitle,
      })

      const base64Doc = docBuffer.toString('base64')
      const fileName  = `Reporte_${formType}_${childName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`

      await supabaseAdmin.from('reportes_generados').insert([{
        child_id:         childId,
        tipo_reporte:     formType,
        titulo:           `${formTitle} - ${childName}`,
        nombre_archivo:   fileName,
        file_data:        base64Doc,
        mime_type:        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        tamano_bytes:     Math.round((base64Doc.length * 3) / 4),
        fecha_generacion: new Date().toISOString(),
        generado_por:     'Padres + IA',
        source_id:        formId,
      }])
      console.log('✅ Reporte Word generado:', fileName)

    } catch (wordErr) {
      console.error('⚠️ Error generando Word (análisis guardado de todas formas):', wordErr)
    }

    return NextResponse.json({ success: true, analysis })

  } catch (error: any) {
    console.error('Error analyzing parent form:', error)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// ==============================================================================
// ANÁLISIS NARRATIVO PARA EL WORD
// ==============================================================================
async function generateNarrativeForWord(
  formType: string, childName: string, childAge: number | undefined,
  reportData: any, formTitle: string | undefined
): Promise<string | null> {
  try {
    const existingAnalysis = reportData?.ai_analysis
    const displayTitle = formTitle || formType.replace(/_/g, ' ').toUpperCase()

    const prompt = existingAnalysis && typeof existingAnalysis === 'object'
      ? `Eres un neuropsicólogo clínico especializado en neurodiversidad infantil.

Formulario "${displayTitle}" para ${childName}${childAge ? ` (${childAge} años)` : ''}.

ANÁLISIS IA PREVIO:
${JSON.stringify(existingAnalysis, null, 2)}

RESPUESTAS:
${JSON.stringify(reportData?.responses || reportData, null, 2)}

Genera un INFORME CLÍNICO PROFESIONAL con estas secciones:
## RESUMEN EJECUTIVO
## ANÁLISIS CLÍNICO DETALLADO
## ÁREAS DE FORTALEZA
## ÁREAS DE TRABAJO PRIORITARIAS
## RECOMENDACIONES TERAPÉUTICAS
## ESTRATEGIAS PARA EL HOGAR
## INDICADORES DE SEGUIMIENTO
## PRÓXIMOS PASOS SUGERIDOS

NIVEL DE ALERTA: ${existingAnalysis?.nivel_alerta || 'moderado'}
FORMATO: Profesional, empático, claro.`
      : `Eres un neuropsicólogo clínico especializado en neurodiversidad infantil.

Formulario "${displayTitle}" para ${childName}${childAge ? ` (${childAge} años)` : ''}.

RESPUESTAS:
${JSON.stringify(reportData?.responses || reportData, null, 2)}

Genera un INFORME CLÍNICO PROFESIONAL con:
## RESUMEN EJECUTIVO
## ANÁLISIS CLÍNICO DETALLADO
## ÁREAS DE FORTALEZA
## ÁREAS DE TRABAJO PRIORITARIAS
## RECOMENDACIONES TERAPÉUTICAS
## ESTRATEGIAS PARA EL HOGAR
## INDICADORES DE SEGUIMIENTO
## PRÓXIMOS PASOS`

    const resp = await callGroqSimple(
        'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.',
        prompt,
        { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 2000 }
      )
    return resp || null
  } catch { return null }
}


// ==============================================================================
// CONSTRUCCIÓN DEL DOCUMENTO WORD
// ==============================================================================
async function buildWordDocument(params: {
  reportType: string; childName: string; childAge?: number;
  reportData: any; aiAnalysis?: string | null; formTitle?: string;
}): Promise<typeof Buffer.prototype> {
  const { reportType, childName, childAge, reportData, aiAnalysis, formTitle } = params

  const portada  = createCoverPage(reportType, childName, childAge, formTitle)
  const contenido = createNeuroFormReport(reportData, childName, reportType, aiAnalysis, formTitle)

  const doc = new Document({
    styles: getDocumentStyles(),
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [...portada, new PageBreak(), ...contenido]
    }]
  })
  return await Packer.toBuffer(doc)
}

function getDocumentStyles() {
  return {
    default: { document: { run: { font: 'Calibri', size: 22 } } },
    paragraphStyles: [
      { id: 'Normal', name: 'Normal', run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { line: 276, after: 200 } } },
      { id: 'Heading1', name: 'Heading 1', run: { size: 32, bold: true, font: 'Calibri', color: '2E75B5' }, paragraph: { spacing: { before: 480, after: 240 } } },
      { id: 'Heading2', name: 'Heading 2', run: { size: 28, bold: true, font: 'Calibri', color: '2E75B5' }, paragraph: { spacing: { before: 360, after: 180 } } },
      { id: 'Heading3', name: 'Heading 3', run: { size: 24, bold: true, font: 'Calibri', color: '1F4D78' }, paragraph: { spacing: { before: 280, after: 140 } } },
    ]
  }
}

function createCoverPage(reportType: string, childName: string, childAge?: number, formTitle?: string): any[] {
  const titles: Record<string, { main: string; sub: string }> = {
    anamnesis:     { main: 'HISTORIA CLÍNICA', sub: 'Evaluación Integral del Desarrollo' },
    aba:           { main: 'REPORTE DE SESIÓN ABA', sub: 'Análisis Aplicado de la Conducta' },
    entorno_hogar: { main: 'EVALUACIÓN DEL ENTORNO DEL HOGAR', sub: 'Visita Domiciliaria' },
    brief2:        { main: 'EVALUACIÓN BRIEF-2', sub: 'Funciones Ejecutivas' },
    ados2:         { main: 'EVALUACIÓN ADOS-2', sub: 'Diagnóstico del Autismo' },
    vineland3:     { main: 'EVALUACIÓN VINELAND-3', sub: 'Conducta Adaptativa' },
    wiscv:         { main: 'EVALUACIÓN WISC-V', sub: 'Escala de Inteligencia' },
    basc3:         { main: 'EVALUACIÓN BASC-3', sub: 'Sistema Conductual' },
  }
  const t = titles[reportType] || (formTitle
    ? { main: formTitle.toUpperCase(), sub: 'Informe Clínico Especializado' }
    : { main: 'REPORTE PROFESIONAL', sub: 'Evaluación Clínica' })

  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2880, after: 720 }, children: [new TextRun({ text: 'NEUROPSICOLOGÍA Y TERAPIAS SANTI', font: 'Calibri', size: 32, bold: true, color: '2E75B5' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1440 }, children: [new TextRun({ text: 'Taller de Desarrollo Infantil', font: 'Calibri', size: 22, color: '595959' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1440 }, border: { bottom: { color: '2E75B5', space: 1, value: BorderStyle.SINGLE, size: 12 } }, children: [new TextRun({ text: '' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 720, after: 360 }, children: [new TextRun({ text: t.main, font: 'Calibri', size: 40, bold: true, color: '1F4D78' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1440 }, children: [new TextRun({ text: t.sub, font: 'Calibri', size: 24, color: '595959', italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1440, after: 240 }, children: [new TextRun({ text: 'PACIENTE', font: 'Calibri', size: 20, bold: true, color: '404040', allCaps: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: childName, font: 'Calibri', size: 32, bold: true, color: '2E75B5' })] }),
    ...(childAge ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 720 }, children: [new TextRun({ text: `Edad: ${childAge} años`, font: 'Calibri', size: 22, color: '595959' })] })] : []),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1440 }, children: [new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`, font: 'Calibri', size: 22, color: '737373' })] })
  ]
}

function createNeuroFormReport(data: any, childName: string, formType: string, aiAnalysis?: string | null, formTitle?: string): any[] {
  const elements: any[] = []
  const displayTitle = formTitle || formType.replace(/_/g, ' ')
  const today = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })

  const sep = () => new Paragraph({ spacing: { after: 200 }, border: { bottom: { color: 'CCCCCC', space: 1, value: BorderStyle.SINGLE, size: 6 } }, children: [new TextRun({ text: '' })] })
  const secHead = (txt: string, emoji: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 }, shading: { type: ShadingType.SOLID, color: 'EBF3FB' }, children: [new TextRun({ text: `${emoji}  ${txt}`, size: 28, bold: true, color: '2E75B5', font: 'Calibri' })] })
  const subHead = (txt: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun({ text: txt, size: 24, bold: true, color: '1F4D78', font: 'Calibri' })] })
  const body = (txt: string, bold = false) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: txt, size: 22, bold, font: 'Calibri', color: '333333' })] })
  const bullet = (txt: string, color = '2E75B5') => new Paragraph({ spacing: { after: 120 }, indent: { left: 360 }, children: [new TextRun({ text: '▪  ', size: 22, bold: true, color, font: 'Calibri' }), new TextRun({ text: txt, size: 22, font: 'Calibri', color: '333333' })] })

  // Encabezado
  elements.push(
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Paciente: ${childName}`, size: 22, bold: true, font: 'Calibri', color: '1F4D78' })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Evaluación: ${displayTitle}`, size: 22, font: 'Calibri', color: '595959' })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `Fecha: ${today}`, size: 22, font: 'Calibri', color: '595959' })] }),
    sep()
  )

  // Análisis narrativo IA
  if (aiAnalysis) {
    elements.push(secHead('Análisis Clínico Profesional', '🧠'))
    for (const line of aiAnalysis.split('\n')) {
      const t = line.trim()
      if (!t) continue
      if (t.startsWith('## '))      elements.push(subHead(t.replace(/^##\s*/, '')))
      else if (t.startsWith('# '))  elements.push(secHead(t.replace(/^#\s*/, ''), '📋'))
      else if (t.startsWith('- ') || t.startsWith('• ') || t.startsWith('* ')) elements.push(bullet(t.replace(/^[-•*]\s*/, '')))
      else if (t.match(/^\d+\.\s/)) elements.push(bullet(t.replace(/^\d+\.\s*/, ''), '1F4D78'))
      else if (t.startsWith('**') && t.endsWith('**')) elements.push(body(t.replace(/\*\*/g, ''), true))
      else elements.push(body(t))
    }
    elements.push(sep())
  }

  // Tabla de respuestas
  const responses = data?.responses || data
  if (responses && typeof responses === 'object' && !Array.isArray(responses)) {
    elements.push(secHead('Respuestas del Formulario', '📝'))
    const entries = Object.entries(responses).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'ai_analysis')
    if (entries.length > 0) {
      elements.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [
              new TableCell({ shading: { type: ShadingType.SOLID, color: '2E75B5' }, children: [new Paragraph({ children: [new TextRun({ text: 'Campo', size: 20, bold: true, color: 'FFFFFF', font: 'Calibri' })] })] }),
              new TableCell({ shading: { type: ShadingType.SOLID, color: '2E75B5' }, children: [new Paragraph({ children: [new TextRun({ text: 'Respuesta', size: 20, bold: true, color: 'FFFFFF', font: 'Calibri' })] })] })
            ]}),
            ...entries.map(([key, value]) => new TableRow({ children: [
              new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.SOLID, color: 'F0F4F8' }, children: [new Paragraph({ children: [new TextRun({ text: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), size: 20, bold: true, font: 'Calibri', color: '2E75B5' })] })] }),
              new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: Array.isArray(value) ? (value as any[]).join(', ') : String(value), size: 20, font: 'Calibri', color: '333333' })] })] })
            ]}))
          ]
        }),
        new Paragraph({ text: '' })
      )
    }
  }

  // Análisis IA embebido del formulario original
  const embedded = data?.ai_analysis
  if (embedded && typeof embedded === 'object') {
    elements.push(sep(), secHead('Análisis IA del Formulario', '🤖'))
    const alertColors: Record<string, string> = { bajo: '27AE60', moderado: 'F39C12', alto: 'E74C3C' }
    if (embedded.nivel_alerta) elements.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Nivel de Alerta: ', size: 22, bold: true, font: 'Calibri' }), new TextRun({ text: embedded.nivel_alerta.toUpperCase(), size: 22, bold: true, font: 'Calibri', color: alertColors[embedded.nivel_alerta] || '595959' })] }))
    if (embedded.resumen_ejecutivo) { elements.push(subHead('Resumen Ejecutivo')); elements.push(body(embedded.resumen_ejecutivo)) }
    if (embedded.analisis_clinico)  { elements.push(subHead('Análisis Clínico')); elements.push(body(embedded.analisis_clinico)) }
    if (embedded.areas_fortaleza?.length) { elements.push(subHead('Fortalezas')); (embedded.areas_fortaleza as string[]).forEach((f: string) => elements.push(bullet(f, '27AE60'))) }
    if (embedded.areas_trabajo?.length)   { elements.push(subHead('Áreas de Trabajo')); (embedded.areas_trabajo as string[]).forEach((a: string) => elements.push(bullet(a, 'E67E22'))) }
    if (embedded.recomendaciones?.length) { elements.push(subHead('Recomendaciones')); (embedded.recomendaciones as string[]).forEach((r: string) => elements.push(bullet(r))) }
    if (embedded.actividades_en_casa?.length) { elements.push(subHead('Actividades en Casa')); (embedded.actividades_en_casa as string[]).forEach((a: string) => elements.push(bullet(a, '8E44AD'))) }
    if (embedded.proximo_paso)  { elements.push(subHead('Próximo Paso')); elements.push(body(embedded.proximo_paso, true)) }
    if (embedded.mensaje_padres){ elements.push(subHead('Mensaje para los Padres')); elements.push(body(`"${embedded.mensaje_padres}"`)) }
  }

  // Footer
  elements.push(
    sep(),
    new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [
      new TextRun({ text: 'Informe generado con asistencia de IA · ', size: 18, italics: true, color: '999999', font: 'Calibri' }),
      new TextRun({ text: 'Vanty ABA', size: 18, bold: true, italics: true, color: '2E75B5', font: 'Calibri' }),
      new TextRun({ text: ` · ${today}`, size: 18, italics: true, color: '999999', font: 'Calibri' })
    ]})
  )

  return elements
}
