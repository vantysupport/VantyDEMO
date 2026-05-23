// app/api/patient-documents/extract/route.ts
//
// Extrae texto de los documentos del paciente (PDF, DOCX, imagen, TXT)
// y lo guarda en `patient_documents.extracted_text` para que la IA pueda
// citarlo cuando responda sobre ese paciente.
//
// Modos:
//   POST { document_id }                → procesar uno
//   POST { child_id, only_pending: 1 }  → procesar pendientes de un paciente
//   POST { all_pending: 1, limit: 50 }  → procesar pendientes de toda la base

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractTextFromPdf } from '@/lib/knowledge-base'
import { GoogleGenAI } from '@google/genai'
import JSZip from 'jszip'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

const MAX_CHARS = 200_000  // tope para no llenar la BD si es un libro enorme

// ─── DOCX → texto (DOCX es un ZIP con document.xml dentro) ─────────────
async function extractDocx(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const docXml = await zip.file('word/document.xml')?.async('string')
  if (!docXml) return ''
  // Extrae todo el texto entre <w:t...>...</w:t>, preserva saltos de párrafo
  const text = docXml
    .replace(/<w:p[\s>][^<]*?>/g, '\n')      // párrafo → salto de línea
    .replace(/<w:br[^>]*\/>/g, '\n')         // brs
    .replace(/<[^>]+>/g, '')                 // resto de tags
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text
}

// ─── Imagen → OCR con Gemini Vision ──────────────────────────────────────
async function extractImageWithGemini(buffer: ArrayBuffer, mimeType: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada — no se puede OCR imágenes')
  const ai = new GoogleGenAI({ apiKey })
  const base64 = Buffer.from(buffer).toString('base64')

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        {
          text: `Esta es una imagen relacionada con un paciente de un centro de neuropsicología.
Tu tarea: extrae TODA la información útil que veas — texto manuscrito o impreso, datos médicos, gráficos, esquemas, tablas, sellos, fechas, firmas, observaciones.
Si es una foto de un documento, transcribe el contenido completo.
Si es una foto del niño/a o de una actividad, describí brevemente qué se ve (sin describir rasgos personales, solo el contexto clínico relevante).
Responde SOLO con el contenido extraído, sin comentarios previos.`,
        },
      ],
    }],
  })
  return response.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── TXT/Markdown/CSV → directo ──────────────────────────────────────────
function extractText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(buffer))
  } catch {
    return new TextDecoder('latin1').decode(new Uint8Array(buffer))
  }
}

// ─── Dispatcher por mime type / extensión ───────────────────────────────
async function extraerSegunTipo(buffer: ArrayBuffer, fileName: string, fileType: string | null): Promise<{ texto: string; nota?: string }> {
  const name = (fileName || '').toLowerCase()
  const type = (fileType || '').toLowerCase()

  // PDF
  if (name.endsWith('.pdf') || type.includes('pdf')) {
    const texto = await extractTextFromPdf(buffer)
    return { texto }
  }

  // DOCX
  if (name.endsWith('.docx') || type.includes('officedocument.wordprocessingml')) {
    const texto = await extractDocx(buffer)
    return { texto }
  }

  // DOC viejo (Word 97-2003) — no soportado sin LibreOffice
  if (name.endsWith('.doc')) {
    return { texto: '', nota: 'Formato .doc (Word 97-2003) no soportado. Convierte a .docx o PDF.' }
  }

  // Imágenes → Gemini Vision OCR
  if (/\.(jpg|jpeg|png|webp|heic|heif|gif|bmp)$/i.test(name) || type.startsWith('image/')) {
    const mime = type.startsWith('image/') ? type : (
      name.endsWith('.png') ? 'image/png' :
      name.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
    )
    try {
      const texto = await extractImageWithGemini(buffer, mime)
      return { texto }
    } catch (e: any) {
      return { texto: '', nota: `OCR falló: ${e?.message || 'sin acceso a Gemini'}` }
    }
  }

  // Texto plano
  if (/\.(txt|md|csv|json|xml|html?)$/i.test(name) || type.startsWith('text/')) {
    return { texto: extractText(buffer) }
  }

  // No soportado
  return { texto: '', nota: `Tipo de archivo no soportado para extracción automática: ${type || 'desconocido'}` }
}

// ─── Procesar un documento ──────────────────────────────────────────────
async function procesarDocumento(doc: any): Promise<{ ok: boolean; chars: number; error?: string }> {
  try {
    // Bajar archivo del storage (file_url es signed URL pero también podemos parsearlo)
    let fileBuffer: ArrayBuffer
    if (doc.file_url) {
      const res = await fetch(doc.file_url)
      if (!res.ok) throw new Error(`Storage HTTP ${res.status}`)
      fileBuffer = await res.arrayBuffer()
    } else {
      throw new Error('Documento sin file_url')
    }

    const { texto, nota } = await extraerSegunTipo(fileBuffer, doc.file_name || '', doc.file_type || null)

    if (!texto || texto.trim().length < 10) {
      await supabaseAdmin.from('patient_documents')
        .update({
          extraction_status: nota ? 'not_supported' : 'failed',
          extraction_error: nota || 'No se extrajo texto',
          extracted_at: new Date().toISOString(),
        })
        .eq('id', doc.id)
      return { ok: false, chars: 0, error: nota || 'sin texto' }
    }

    const textoLimitado = texto.length > MAX_CHARS ? texto.slice(0, MAX_CHARS) + '\n\n[…texto truncado por longitud]' : texto

    await supabaseAdmin.from('patient_documents')
      .update({
        extracted_text: textoLimitado,
        extracted_chars: textoLimitado.length,
        extraction_status: 'done',
        extraction_error: null,
        extracted_at: new Date().toISOString(),
      })
      .eq('id', doc.id)

    return { ok: true, chars: textoLimitado.length }
  } catch (e: any) {
    await supabaseAdmin.from('patient_documents')
      .update({
        extraction_status: 'failed',
        extraction_error: e?.message?.slice(0, 500) || 'Error desconocido',
        extracted_at: new Date().toISOString(),
      })
      .eq('id', doc.id)
    return { ok: false, chars: 0, error: e?.message }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { document_id, child_id, only_pending, all_pending, limit } = body

    // ─── Modo 1: un solo documento ──────────────────────────────────
    if (document_id) {
      const { data: doc } = await supabaseAdmin
        .from('patient_documents')
        .select('*')
        .eq('id', document_id)
        .maybeSingle()
      if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

      const result = await procesarDocumento(doc)
      return NextResponse.json({ ...result, document_id })
    }

    // ─── Modo 2: pendientes de un paciente ──────────────────────────
    if (child_id) {
      let q = supabaseAdmin.from('patient_documents').select('*').eq('child_id', child_id)
      if (only_pending) q = q.in('extraction_status', ['pending', 'failed'])
      const { data: docs } = await q.limit(50)

      const resultados = []
      for (const d of (docs || [])) {
        resultados.push({ id: d.id, ...(await procesarDocumento(d)) })
      }
      return NextResponse.json({ ok: true, procesados: resultados.length, resultados })
    }

    // ─── Modo 3: todos los pendientes del sistema ───────────────────
    if (all_pending) {
      const { data: docs } = await supabaseAdmin
        .from('patient_documents')
        .select('*')
        .in('extraction_status', ['pending'])
        .limit(limit || 30)

      const resultados = []
      for (const d of (docs || [])) {
        resultados.push({ id: d.id, ...(await procesarDocumento(d)) })
      }
      return NextResponse.json({ ok: true, procesados: resultados.length, resultados })
    }

    return NextResponse.json({ error: 'Falta document_id, child_id o all_pending' }, { status: 400 })
  } catch (e: any) {
    console.error('[patient-documents/extract]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
