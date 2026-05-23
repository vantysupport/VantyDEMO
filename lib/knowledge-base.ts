// lib/knowledge-base.ts — v4
// Embeddings: Hugging Face (gratis, 768 dims) → Gemini (fallback) → texto plano
// PDFs: Gemini Vision (lee texto + imágenes + escaneados)

import { supabaseAdmin } from '@/lib/supabase-admin'
import { GoogleGenAI } from '@google/genai'

const CHUNK_SIZE    = 800
const CHUNK_OVERLAP = 100
const MAX_PDF_BYTES = 4 * 1024 * 1024

// Hugging Face: modelo gratuito, 768 dims (igual que Gemini text-embedding-004)
// Registro gratis en https://huggingface.co → Settings → Access Tokens
const HF_EMBEDDING_MODEL = 'sentence-transformers/all-mpnet-base-v2'
const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_EMBEDDING_MODEL}`

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada')
  return new GoogleGenAI({ apiKey })
}

// ── Embedding con Hugging Face (gratis) ───────────────────────────────────────
async function generateEmbeddingHF(text: string): Promise<number[]> {
  const hfKey = process.env.HF_API_KEY
  if (!hfKey) return []

  const res = await fetch(HF_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text.slice(0, 8000), options: { wait_for_model: true } }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HF error ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  // Respuesta puede ser [num, num, ...] o [[num, num, ...]]
  const vec = Array.isArray(data[0]) ? data[0] : data
  return Array.isArray(vec) && vec.length > 0 ? vec : []
}

// ── Embedding con Gemini (fallback) ───────────────────────────────────────────
async function generateEmbeddingGemini(text: string): Promise<number[]> {
  const ai = getAI()
  const response = await ai.models.embedContent({
    model: 'text-embedding-004',
    contents: text.slice(0, 8000),
  })
  const vals =
    (response as any).embeddings?.[0]?.values ??
    (response as any).embedding?.values ??
    []
  return Array.isArray(vals) ? vals : []
}

// ── generateEmbedding: HF → Gemini → vacío (usa búsqueda FTS) ────────────────
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const vec = await generateEmbeddingHF(text)
    if (vec.length > 0) return vec
  } catch (e: any) {
    console.warn('[embedding] HF falló, probando Gemini:', e?.message)
  }

  try {
    const vec = await generateEmbeddingGemini(text)
    if (vec.length > 0) return vec
  } catch (e: any) {
    console.warn('[embedding] Gemini falló:', e?.message)
  }

  return []  // Modo texto plano como último fallback
}

// ── Extraer texto de PDF con pdf-parse (sin IA, gratis, sin límites) ────────────
// Funciona perfecto con PDFs digitales (libros, artículos, guías)
// No funciona con PDFs escaneados (solo imágenes) → fallback a Gemini Vision
async function extractTextWithPdfParse(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfModule = await import('pdf-parse') as any
    const pdfParse = pdfModule.default ?? pdfModule
    const data = await pdfParse(Buffer.from(buffer))
    const text = data.text?.trim() || ''
    console.log(`[pdf-parse] Extraído: ${text.length} chars, ${data.numpages} páginas`)
    return text
  } catch (e: any) {
    console.warn('[pdf-parse] Error:', e?.message)
    return ''
  }
}

// ── extractTextFromPdfWithGemini: ahora es pdf-parse primero → Gemini fallback ─
// pdf-parse: gratis, sin API, sin límites, instantáneo
// Gemini Vision: solo para PDFs escaneados o cuando pdf-parse falla
export async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  // 1. Intentar con pdf-parse (gratis, sin IA)
  const textoPdfParse = await extractTextWithPdfParse(buffer)
  if (textoPdfParse.length > 200) {
    console.log('[pdf] ✅ Texto extraído con pdf-parse (sin IA)')
    return textoPdfParse
  }

  // 2. Fallback: Gemini Vision (para PDFs escaneados)
  console.log('[pdf] pdf-parse insuficiente, usando Gemini Vision...')
  return extractTextFromPdfWithGemini(buffer)
}

// ── Extraer texto de PDF con Gemini Vision ────────────────────────────────────
// Gemini 1.5 Flash acepta PDFs de hasta ~20MB vía inlineData.
// Para libros muy grandes, extraemos en fragmentos de 4MB.
export async function extractTextFromPdfWithGemini(buffer: ArrayBuffer): Promise<string> {
  try {
    const ai    = getAI()
    const bytes = new Uint8Array(buffer)
    const totalBytes = bytes.byteLength

    console.log(`[pdf] Tamaño del PDF: ${Math.round(totalBytes / 1024)}KB`)

    // Para PDFs pequeños/medianos: enviar completo
    if (totalBytes <= MAX_PDF_BYTES) {
      return await extractPdfChunk(ai, buffer)
    }

    // Para PDFs grandes: partir en lotes de 4MB y concatenar
    // Nota: esto no es perfecto porque cortar bytes puede romper páginas,
    // pero Gemini es robusto y extrae lo que puede de cada fragmento.
    console.log(`[pdf] PDF grande (${Math.round(totalBytes / 1024 / 1024)}MB) — procesando en lotes`)
    const textos: string[] = []
    let offset = 0
    let lote = 1

    while (offset < totalBytes) {
      const end   = Math.min(offset + MAX_PDF_BYTES, totalBytes)
      const slice = buffer.slice(offset, end)
      console.log(`[pdf] Lote ${lote}: bytes ${offset}–${end}`)

      try {
        const texto = await extractPdfChunk(ai, slice)
        if (texto.trim().length > 20) textos.push(texto)
      } catch (e) {
        console.warn(`[pdf] Lote ${lote} falló, usando fallback de texto plano`)
        const fallback = extractPdfTextFallback(slice)
        if (fallback.length > 20) textos.push(fallback)
      }

      offset = end
      lote++
      // Pausa breve entre lotes para no saturar la API
      if (offset < totalBytes) await new Promise(r => setTimeout(r, 1000))
    }

    const resultado = textos.join('\n\n')
    console.log(`[pdf] Texto total extraído: ${resultado.length} caracteres en ${lote - 1} lotes`)
    return resultado

  } catch (e: any) {
    console.error('[pdf-gemini] Error fatal:', e?.message)
    return extractPdfTextFallback(buffer)
  }
}

// ── Extraer un fragmento de PDF vía Gemini ───────────────────────────────────
async function extractPdfChunk(ai: GoogleGenAI, buffer: ArrayBuffer): Promise<string> {
  const base64 = Buffer.from(buffer).toString('base64')

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: base64,
          },
        },
        {
          text: `Extrae TODO el texto de este documento PDF.
Incluye: texto de todas las páginas, texto dentro de imágenes, tablas, encabezados, pies de página, notas al pie.
NO resumas ni parafrasees — transcribe el contenido COMPLETO tal como aparece.
Si hay texto en imágenes o diagramas, léelo también.
Responde SOLO con el texto extraído, sin comentarios previos ni posteriores.`,
        },
      ],
    }],
  })

  const texto = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (texto.trim().length > 50) return texto

  // Fallback con prompt en inglés
  const r2 = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: base64 } },
        { text: 'Transcribe all text content from this document. Include all pages. Output only the raw text.' },
      ],
    }],
  })
  return r2.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Fallback manual: extrae texto de PDFs con texto embebido ─────────────────
export function extractPdfTextFallback(buffer: ArrayBuffer): string {
  const raw    = new TextDecoder('latin1').decode(new Uint8Array(buffer))
  const chunks: string[] = []

  // Extraer bloques de texto BT...ET
  const btEtRegex = /BT([\s\S]*?)ET/g
  let match
  while ((match = btEtRegex.exec(raw)) !== null) {
    const inner = match[1]
    const tRegex = /\(([^)]{1,500})\)/g
    let t
    while ((t = tRegex.exec(inner)) !== null) {
      const clean = t[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'")
        .trim()
      if (clean.length > 2) chunks.push(clean)
    }
  }

  // Extraer texto legible de streams
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let sm
  while ((sm = streamRegex.exec(raw)) !== null) {
    const content = sm[1]
    if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]{4,}/.test(content) && !content.includes('\x00')) {
      const words = content.match(/[a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s,.;:!?()\-"']{10,}/g) || []
      chunks.push(...words)
    }
  }

  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

// ── Extraer texto de HTML ─────────────────────────────────────────────────────
export function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br|tr|td|th|section|article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()
}

// ── Dividir texto en chunks con overlap ──────────────────────────────────────
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words  = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  let i = 0

  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.trim().length > 50) chunks.push(chunk.trim())
    i += chunkSize - overlap
  }

  return chunks
}

// ── Indexar documento: texto → chunks → embeddings → Supabase ────────────────
export async function indexDocument(
  documentId: string,
  fullText: string,
  metadata: Record<string, any> = {}
): Promise<{ success: boolean; chunks: number; error?: string }> {
  try {
    if (!fullText || fullText.trim().length < 50) {
      return { success: false, chunks: 0, error: 'Texto insuficiente para indexar (menos de 50 caracteres)' }
    }

    const chunks = chunkText(fullText)
    if (chunks.length === 0) {
      return { success: false, chunks: 0, error: 'No se generaron chunks del texto' }
    }

    console.log(`[index] Indexando ${chunks.length} chunks para doc ${documentId}`)

    let indexed = 0
    let conEmbedding = 0
    const batchSize = 5

    for (let b = 0; b < chunks.length; b += batchSize) {
      const batch = chunks.slice(b, b + batchSize)

      await Promise.all(
        batch.map(async (chunk, idx) => {
          const chunkIdx = b + idx
          try {
            // Intentar embedding — si falla por cuota, guardar chunk igual (modo texto)
            let embeddingValue: string | null = null
            try {
              const embedding = await generateEmbedding(chunk)
              if (embedding.length > 0) {
                embeddingValue = `[${embedding.join(',')}]`
                conEmbedding++
              }
            } catch {
              // Sin cuota de embeddings — modo búsqueda por texto completo
            }

            // Guardar chunk SIEMPRE, con o sin embedding
            await supabaseAdmin.from('knowledge_chunks').insert({
              document_id: documentId,
              chunk_index: chunkIdx,
              contenido:   chunk,
              embedding:   embeddingValue,
              metadata: {
                ...metadata,
                chunk_index:   chunkIdx,
                total_chunks:  chunks.length,
                char_count:    chunk.length,
                sin_embedding: embeddingValue === null,
              },
            })
            indexed++
          } catch (e: any) {
            console.warn(`[index] Chunk ${chunkIdx} falló:`, e?.message)
          }
        })
      )

      if ((b + batchSize) % 50 === 0 || b + batchSize >= chunks.length) {
        console.log(`[index] Progreso: ${Math.min(b + batchSize, chunks.length)}/${chunks.length} chunks`)
      }

      if (b + batchSize < chunks.length) {
        await new Promise(r => setTimeout(r, 150))
      }
    }

    const exitoso = indexed > 0 && indexed >= Math.floor(chunks.length * 0.5)
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ procesado: exitoso, total_chunks: indexed })
      .eq('id', documentId)

    console.log(`[index] Doc ${documentId}: ${indexed} chunks (${conEmbedding} con vector, ${indexed - conEmbedding} solo texto)`)

    if (indexed === 0) {
      return { success: false, chunks: 0, error: 'No se pudo guardar ningún fragmento del documento.' }
    }

    return { success: exitoso, chunks: indexed }

  } catch (error: any) {
    console.error('[index] Error fatal:', error)
    return { success: false, chunks: 0, error: error.message }
  }
}

// ── Buscar conocimiento relevante por similitud semántica ─────────────────────
export async function searchKnowledge(
  query: string,
  options: { maxResults?: number; threshold?: number } = {}
): Promise<KnowledgeResult[]> {
  const { maxResults = 3, threshold = 0.55 } = options // reducido de 6 para ahorrar tokens Groq

  try {
    // Intentar búsqueda semántica (requiere cuota de embeddings)
    const queryEmbedding = await generateEmbedding(query)

    if (queryEmbedding.length > 0) {
      try {
        const { data, error } = await supabaseAdmin.rpc('buscar_conocimiento', {
          query_embedding:      `[${queryEmbedding.join(',')}]`,
          match_count:          maxResults,
          similarity_threshold: threshold,
        })
        if (!error && data && data.length > 0) {
          return data.map((r: any) => ({
            contenido: r.contenido,
            fuente:    r.titulo_doc,
            similitud: Math.round(r.similarity * 100),
            metadata:  r.metadata,
          }))
        }
      } catch { /* fallback a texto */ }
    }

    // Fallback: búsqueda por texto completo (PostgreSQL ILIKE)
    // Funciona aunque no haya cuota de embeddings en Gemini
    console.log('[search] Usando búsqueda por texto completo (sin embeddings)')
    const keywords = query.toLowerCase()
      .split(' ')
      .map((w: string) => w.replace(/[^a-záéíóúñü0-9]/gi, ''))
      .filter((w: string) => w.length > 3)
      .slice(0, 5)

    if (keywords.length === 0) return []

    const { data: rows, error: ftsError } = await supabaseAdmin
      .from('knowledge_chunks')
      .select('contenido, metadata, document_id')
      .ilike('contenido', `%${keywords[0]}%`)
      .limit(maxResults * 4)

    if (ftsError || !rows) return []

    // Rankear por número de keywords encontradas en el chunk
    const scored = rows
      .map((row: any) => ({
        ...row,
        score: keywords.filter((kw: string) => row.contenido.toLowerCase().includes(kw)).length,
      }))
      .filter((r: any) => r.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, maxResults)

    const docIds = [...new Set(scored.map((r: any) => r.document_id))] as string[]
    const { data: docs } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id, titulo')
      .in('id', docIds)

    const docMap: Record<string, string> = {}
    docs?.forEach((d: any) => { docMap[d.id] = d.titulo })

    return scored.map((r: any) => ({
      contenido: r.contenido,
      fuente:    docMap[r.document_id] || 'Documento',
      similitud: Math.min(95, r.score * 20 + 40),
      metadata:  r.metadata,
    }))

  } catch (error: any) {
    console.error('[search] Error:', error?.message)
    return []
  }
}

// ── Obtener instrucciones del centro ─────────────────────────────────────────
export async function getCentroInstrucciones(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from('centro_instrucciones')
      .select('titulo, contenido, prioridad')
      .eq('activo', true)
      .order('prioridad', { ascending: false })
      .limit(10)

    if (!data || data.length === 0) return ''

    return `\n━━━ INSTRUCCIONES DEL CENTRO ━━━\n` +
      data.map((i: any) => `[${i.titulo}]: ${i.contenido}`).join('\n') +
      `\n━━━ FIN INSTRUCCIONES ━━━\n`
  } catch {
    return ''
  }
}

// ── Construir contexto completo para la IA ────────────────────────────────────
export async function buildKnowledgeContext(query: string, childContext?: string): Promise<string> {
  const [resultados, instrucciones] = await Promise.all([
    searchKnowledge(query),
    getCentroInstrucciones(),
  ])

  let context = instrucciones

  if (resultados.length > 0) {
    context += `\n━━━ CONOCIMIENTO CLÍNICO RELEVANTE ━━━\n`
    resultados.forEach((r, i) => {
      context += `\n[Fuente ${i + 1}: ${r.fuente} | ${r.similitud}% relevancia]\n${r.contenido}\n`
    })
    context += `━━━ FIN CONOCIMIENTO ━━━\n`
  }

  if (childContext) context += childContext
  return context
}

// ── Tipos exportados ──────────────────────────────────────────────────────────
export interface KnowledgeResult {
  contenido: string
  fuente:    string
  similitud: number
  metadata:  any
}
