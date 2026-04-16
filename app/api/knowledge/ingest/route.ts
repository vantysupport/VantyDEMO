// app/api/knowledge/ingest/route.ts
// ============================================================================
// API: Ingesta e Indexado de Documentos — Base de Conocimiento de ARIA
// Soporta: PDF (vía Gemini Vision), URL, texto plano, markdown
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  extractTextFromPdf,
  extractTextFromHtml,
  indexDocument,
  chunkText,
} from '@/lib/knowledge-base'

// ── GET: Listar documentos de la base de conocimiento ──────────────────────
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id, titulo, tipo, descripcion, procesado, total_chunks, source_url, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── DELETE: Eliminar documento y sus chunks ────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    // Borrar chunks primero
    await supabaseAdmin
      .from('knowledge_chunks')
      .delete()
      .eq('document_id', id)

    // Borrar documento
    const { error } = await supabaseAdmin
      .from('knowledge_documents')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── POST: Ingestar e indexar un documento nuevo ────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { titulo, tipo = 'libro', descripcion, storageUrl, fileName, sourceUrl, texto } = body

    if (!titulo) {
      return NextResponse.json({ error: 'titulo es requerido' }, { status: 400 })
    }

    // 1. Crear registro del documento en BD
    const { data: docRecord, error: docError } = await supabaseAdmin
      .from('knowledge_documents')
      .insert({
        titulo,
        tipo,
        descripcion: descripcion || '',
        procesado: false,
        total_chunks: 0,
        source_url: sourceUrl || null,
      })
      .select('id')
      .single()

    if (docError || !docRecord) {
      throw new Error(docError?.message || 'No se pudo crear el registro del documento')
    }

    const documentId = docRecord.id

    // 2. Procesar de forma SÍNCRONA (maxDuration: 300s en vercel.json)
    // NO usar fire-and-forget: Vercel mata el proceso al enviar la respuesta
    const result = await processAndIndex(documentId, { storageUrl, fileName, sourceUrl, texto, titulo, tipo })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        documentId,
        error: result.error || 'El indexado falló',
        chunks: 0,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      documentId,
      chunks: result.chunks,
      message: `Documento indexado correctamente (${result.chunks} fragmentos).`,
    })

  } catch (error: any) {
    console.error('[ingest] Error POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── Función principal de procesamiento e indexado ──────────────────────────
async function processAndIndex(
  documentId: string,
  source: {
    storageUrl?: string
    fileName?: string
    sourceUrl?: string
    texto?: string
    titulo: string
    tipo: string
  }
): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    let fullText = ''

    // ── A) Texto directo (modo texto/markdown) ───────────────────────────
    if (source.texto && source.texto.trim().length > 20) {
      console.log(`[ingest] Modo texto directo para doc ${documentId}`)
      fullText = source.texto.trim()
    }

    // ── B) URL externa (web o archivo público) ───────────────────────────
    else if (source.sourceUrl) {
      console.log(`[ingest] Descargando URL: ${source.sourceUrl}`)
      fullText = await fetchAndExtractFromUrl(source.sourceUrl)
    }

    // ── C) Archivo desde Supabase Storage ───────────────────────────────
    else if (source.storageUrl) {
      console.log(`[ingest] Descargando desde Storage: ${source.fileName}`)
      fullText = await fetchAndExtractFromStorage(source.storageUrl, source.fileName || '')
    }

    if (!fullText || fullText.trim().length < 30) {
      const errMsg = 'No se pudo extraer texto del documento. Verifica que el archivo no esté protegido.'
      await markFailed(documentId, errMsg)
      return { success: false, chunks: 0, error: errMsg }
    }

    console.log(`[ingest] Texto extraído: ${fullText.length} caracteres. Indexando...`)

    // Limpiar el texto antes de indexar
    fullText = cleanText(fullText)

    // Indexar (genera chunks + embeddings + guarda en knowledge_chunks)
    const result = await indexDocument(documentId, fullText, {
      titulo: source.titulo,
      tipo: source.tipo,
      fuente: source.sourceUrl || source.fileName || 'subida manual',
    })

    if (!result.success) {
      await markFailed(documentId, result.error || 'El indexado falló — verifica GEMINI_API_KEY')
      console.error(`[ingest] Falló indexado doc ${documentId}:`, result.error)
      return { success: false, chunks: 0, error: result.error }
    }

    console.log(`[ingest] ✅ Doc ${documentId} indexado: ${result.chunks} chunks`)
    return { success: true, chunks: result.chunks }

  } catch (error: any) {
    console.error(`[ingest] Error procesando ${documentId}:`, error)
    await markFailed(documentId, error.message)
    return { success: false, chunks: 0, error: error.message }
  }
}

// ── Descargar y extraer desde URL externa ─────────────────────────────────
async function fetchAndExtractFromUrl(url: string): Promise<string> {
  // Convertir URLs de Google Drive al formato de descarga directa
  const processedUrl = convertGoogleDriveUrl(url)

  const response = await fetch(processedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Vanty-Bot/1.0)',
      'Accept': 'text/html,application/pdf,*/*',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`No se pudo descargar la URL (${response.status}: ${response.statusText}). Verifica que sea pública.`)
  }

  const contentType = response.headers.get('content-type') || ''

  // PDF
  if (contentType.includes('pdf') || url.toLowerCase().includes('.pdf')) {
    const buffer = await response.arrayBuffer()
    return extractTextFromPdf(buffer)
  }

  // Texto plano / Markdown
  if (contentType.includes('text/plain') || url.endsWith('.txt') || url.endsWith('.md')) {
    return response.text()
  }

  // HTML (página web)
  if (contentType.includes('text/html') || contentType.includes('html')) {
    const html = await response.text()
    return extractTextFromHtml(html)
  }

  // Intentar como texto de todas formas
  const text = await response.text()
  if (text.trim().length > 100) return text

  throw new Error(`Tipo de archivo no soportado: ${contentType}`)
}

// ── Descargar desde Supabase Storage y extraer texto ─────────────────────
async function fetchAndExtractFromStorage(storageUrl: string, fileName: string): Promise<string> {
  const response = await fetch(storageUrl, {
    headers: { 'User-Agent': 'Vanty-Bot/1.0' },
  })

  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo desde Storage (${response.status})`)
  }

  const buffer = await response.arrayBuffer()
  const ext = fileName.toLowerCase().split('.').pop() || ''

  // PDF — usar Gemini Vision (lee texto + imágenes + escaneados)
  if (ext === 'pdf') {
    console.log(`[ingest] Extrayendo PDF con Gemini Vision (${Math.round(buffer.byteLength / 1024)}KB)`)
    return extractTextFromPdf(buffer)
  }

  // TXT / Markdown — leer directamente
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') {
    return new TextDecoder('utf-8').decode(new Uint8Array(buffer))
  }

  // Intentar como texto genérico
  const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer))
  if (text.trim().length > 100) return text

  throw new Error(`Formato de archivo no soportado: .${ext}`)
}

// ── Convertir URL de Google Drive a descarga directa ──────────────────────
function convertGoogleDriveUrl(url: string): string {
  // https://drive.google.com/file/d/FILE_ID/view → descarga directa
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`
  }

  // https://drive.google.com/open?id=FILE_ID
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/)
  if (openMatch) {
    return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`
  }

  // Dropbox: cambiar dl=0 a dl=1
  if (url.includes('dropbox.com')) {
    return url.replace('dl=0', 'dl=1').replace('?dl=0', '?dl=1')
  }

  return url
}

// ── Limpiar texto extraído ─────────────────────────────────────────────────
function cleanText(text: string): string {
  return text
    // Eliminar caracteres de control excepto saltos de línea y tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    // Normalizar espacios en blanco múltiples
    .replace(/[ \t]+/g, ' ')
    // Máximo 3 líneas en blanco consecutivas
    .replace(/\n{4,}/g, '\n\n\n')
    // Eliminar líneas que solo tienen números de página o caracteres solos
    .replace(/^\s*\d+\s*$/gm, '')
    .trim()
}

// ── Marcar documento como fallido ─────────────────────────────────────────
async function markFailed(documentId: string, errorMsg: string) {
  await supabaseAdmin
    .from('knowledge_documents')
    .update({
      procesado: false,
      total_chunks: 0,
      descripcion: `❌ Error: ${errorMsg.slice(0, 200)}`,
    })
    .eq('id', documentId)
}
