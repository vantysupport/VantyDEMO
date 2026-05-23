// app/api/knowledge/ocr-image/route.ts
//
// Recibe N imágenes (páginas renderizadas de un PDF escaneado) y devuelve
// el texto extraído por Gemini Vision. Permite hasta 8 imágenes por request
// para mantenerse bajo el límite de 4.5 MB de Vercel.
//
// Modo de uso desde el browser:
//   FormData con campos: page_<n> = Blob (image/jpeg)
//   y opcionalmente: titulo, tipo, descripcion (si se quiere indexar directo)

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { indexDocument } from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 120

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada — no se puede OCR')
  return new GoogleGenAI({ apiKey })
}

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()

    const titulo = (fd.get('titulo') as string) || ''
    const tipo   = (fd.get('tipo') as string)   || 'libro'
    const descripcion = (fd.get('descripcion') as string) || ''
    const indexar = (fd.get('indexar') as string) === '1'

    // Recolectar imágenes ordenadas por número de página
    const imagenes: { pagina: number; buffer: ArrayBuffer; mime: string }[] = []
    for (const [key, value] of fd.entries()) {
      if (!key.startsWith('page_')) continue
      // En el runtime de Next.js (web standard), los File de FormData no son
      // siempre `instanceof File` — usamos duck-typing por arrayBuffer + type.
      const v: any = value
      if (!v || typeof v.arrayBuffer !== 'function') continue
      const pagina = parseInt(key.replace('page_', ''), 10)
      if (isNaN(pagina)) continue
      imagenes.push({
        pagina,
        buffer: await v.arrayBuffer(),
        mime: v.type || 'image/jpeg',
      })
    }
    if (imagenes.length === 0) {
      return NextResponse.json({ error: 'No se recibieron imágenes (campos page_N)' }, { status: 400 })
    }
    imagenes.sort((a, b) => a.pagina - b.pagina)

    // OCR con Gemini Vision — multimodal con varias imágenes en un solo prompt
    const ai = getAI()
    const parts: any[] = []
    for (const img of imagenes) {
      parts.push({
        inlineData: {
          mimeType: img.mime || 'image/jpeg',
          data: Buffer.from(img.buffer).toString('base64'),
        },
      })
    }
    parts.push({
      text: `Estas son ${imagenes.length} páginas de un documento clínico/educativo escaneado.

Tu tarea: extraer TODO el texto de cada página, en orden.

REGLAS ESTRICTAS:
- Antes del texto de cada página, escribe el separador exacto: "=== PÁGINA ${imagenes[0].pagina} ===" (ajustando el número)
- Numera las páginas con los números: ${imagenes.map(i => i.pagina).join(', ')}
- Transcribe TODO el texto visible: encabezados, tablas, criterios, observaciones, sellos, fechas, notas al pie
- Mantén el orden de lectura natural (columnas, listas)
- Si hay tablas, transcríbelas con TAB entre columnas o con guiones
- Si una página NO tiene texto visible (solo imagen/diagrama), escribe debajo del separador: "[Página sin texto]"
- NO resumas ni parafrasees — TRANSCRIPCIÓN LITERAL
- NO comentarios tuyos al inicio ni al final, solo el texto extraído`,
    })

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ role: 'user', parts }],
    })
    const texto = response.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Si quieren que también lo indexemos directo en el cerebro
    if (indexar && titulo) {
      if (texto.trim().length < 50) {
        return NextResponse.json({ ok: false, texto, indexed: false, error: 'Texto OCR muy corto' })
      }
      const { data: doc, error: dErr } = await supabaseAdmin
        .from('knowledge_documents')
        .insert({
          titulo,
          tipo,
          descripcion: `${descripcion || ''}\n\n[OCR via Gemini · ${imagenes.length} págs ${imagenes[0].pagina}-${imagenes[imagenes.length-1].pagina}]`.trim(),
          procesado: false,
          total_chunks: 0,
        })
        .select('id')
        .single()
      if (dErr) throw dErr

      const result = await indexDocument(doc.id, texto, {
        fuente: 'OCR-Gemini',
        paginas: imagenes.map(i => i.pagina),
      })
      return NextResponse.json({
        ok: result.success,
        document_id: doc.id,
        chunks: result.chunks,
        texto_chars: texto.length,
        paginas: imagenes.length,
        indexed: true,
      })
    }

    return NextResponse.json({
      ok: true,
      texto,
      texto_chars: texto.length,
      paginas: imagenes.length,
      indexed: false,
    })
  } catch (e: any) {
    console.error('[ocr-image]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
