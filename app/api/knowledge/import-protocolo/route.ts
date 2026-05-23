// app/api/knowledge/import-protocolo/route.ts
//
// Importador estructurado de protocolos tabulares (ABLLS-R, AFLS, VB-MAPP, etc.)
// Cada fila se convierte en UN chunk independiente con metadatos ricos
// (código, área, fuente). Esto da mucha mejor precisión al RAG que partir
// el PDF por palabras: la IA puede recuperar el ítem D5 exacto cuando se
// pregunta por "imitación de brazo y mano".
//
// Acepta dos modos:
//   1) `items`: array estructurado [{codigo, nombre, objetivo, criterios}]
//   2) `tabla`: string con TSV/CSV/texto pegado que parseamos automáticamente

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateEmbedding } from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

type Item = {
  codigo?: string
  nombre?: string
  objetivo?: string
  criterios?: string
}

// ── Parser tolerante: detecta TSV, CSV o cualquier separador consistente ──
function parsearTabla(tabla: string): Item[] {
  const lineasRaw = tabla
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  if (lineasRaw.length === 0) return []

  // Detectar si la primera línea son headers
  const primera = lineasRaw[0].toLowerCase()
  const tieneHeader = /tarea|nombre|objetivo|criterios|código|codigo/i.test(primera)
  const lineas = tieneHeader ? lineasRaw.slice(1) : lineasRaw

  // Detectar separador (probamos en orden de especificidad)
  const detectarSep = (l: string): string => {
    if (l.includes('\t')) return '\t'
    if (l.includes('|')) return '|'
    if (l.includes(';')) return ';'
    // CSV: detectar comas si hay al menos 3 (4 columnas)
    const comas = (l.match(/,/g) || []).length
    if (comas >= 3) return ','
    // Por defecto: múltiples espacios (2 o más)
    return /\s{2,}/.test(l) ? 'multispace' : 'tab'
  }
  const sep = detectarSep(lineas[0] || lineasRaw[0])

  const split = (l: string): string[] => {
    if (sep === 'multispace') return l.split(/\s{2,}/).map(s => s.trim())
    if (sep === ',') {
      // CSV simple (no maneja comillas escapadas avanzadas pero suficiente)
      return l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.trim().replace(/^"|"$/g, ''))
    }
    return l.split(sep).map(s => s.trim())
  }

  const items: Item[] = []
  for (const linea of lineas) {
    const cols = split(linea)
    if (cols.length < 2) continue
    // El primer campo suele ser el código (D1, A12, etc.) — corto y sin espacios
    const esCodigo = cols[0].length <= 8 && /^[A-Z]?[A-Z0-9-]+$/i.test(cols[0])
    if (esCodigo && cols.length >= 4) {
      items.push({
        codigo: cols[0],
        nombre: cols[1],
        objetivo: cols[2],
        criterios: cols.slice(3).join(' '),
      })
    } else if (cols.length >= 3) {
      // Sin código explícito → asumimos nombre/objetivo/criterios
      items.push({
        nombre: cols[0],
        objetivo: cols[1],
        criterios: cols.slice(2).join(' '),
      })
    } else if (cols.length === 2) {
      items.push({ nombre: cols[0], objetivo: cols[1] })
    }
  }
  return items
}

// ── Formatear el contenido de cada chunk para máxima recuperabilidad ──
function formatearChunk(item: Item, fuente: string, area: string | null): string {
  const partes: string[] = []
  if (item.codigo) partes.push(`Código: ${item.codigo}`)
  if (item.nombre) partes.push(`Tarea: ${item.nombre}`)
  if (area)         partes.push(`Área: ${area}`)
  if (fuente)       partes.push(`Fuente: ${fuente}`)
  if (item.objetivo)  partes.push(`Objetivo: ${item.objetivo}`)
  if (item.criterios) partes.push(`Criterios de logro: ${item.criterios}`)
  return partes.join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      titulo,
      fuente,           // 'ABLLS-R', 'AFLS', 'VB-MAPP', etc.
      area,             // 'Imitación motriz', 'Manding', 'Habilidades funcionales'
      descripcion,
      items: itemsRaw,  // opción 1: estructurado
      tabla,            // opción 2: pegar texto/TSV
    } = body

    if (!titulo?.trim()) {
      return NextResponse.json({ error: 'titulo requerido' }, { status: 400 })
    }

    // Decidir fuente de items
    let items: Item[] = []
    if (Array.isArray(itemsRaw) && itemsRaw.length > 0) {
      items = itemsRaw
    } else if (typeof tabla === 'string' && tabla.trim().length > 0) {
      items = parsearTabla(tabla)
    }

    if (items.length === 0) {
      return NextResponse.json({
        error: 'No se detectaron filas. Asegúrate de pegar la tabla con columnas separadas por TAB o que la primera línea tenga los encabezados TAREA / NOMBRE / OBJETIVO / CRITERIOS.',
      }, { status: 400 })
    }

    // 1. Crear el documento
    const desc = (descripcion || `Protocolo estructurado ${fuente || ''} ${area || ''}`.trim()) +
                 `\n\n[Fuente: ${fuente || '—'} · Área: ${area || '—'} · ${items.length} ítems]`
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('knowledge_documents')
      .insert({
        titulo: titulo.trim(),
        tipo: 'protocolo',
        descripcion: desc,
        procesado: false,
        total_chunks: 0,
      })
      .select()
      .single()
    if (docErr) throw docErr
    const documentId = (doc as any).id

    // 2. Crear un chunk por ítem, con embedding individual
    let indexados = 0
    let conEmbedding = 0
    let chunkIdx = 0

    // Procesar en lotes de 5 para no saturar HF
    for (let i = 0; i < items.length; i += 5) {
      const lote = items.slice(i, i + 5)
      await Promise.all(
        lote.map(async (item) => {
          const contenido = formatearChunk(item, fuente || '', area)
          if (!contenido || contenido.length < 20) return

          let embeddingValue: string | null = null
          try {
            const emb = await generateEmbedding(contenido)
            if (emb.length > 0) {
              embeddingValue = `[${emb.join(',')}]`
              conEmbedding++
            }
          } catch { /* sin cuota — guardamos solo texto */ }

          try {
            await supabaseAdmin.from('knowledge_chunks').insert({
              document_id: documentId,
              chunk_index: chunkIdx++,
              contenido,
              embedding: embeddingValue,
              metadata: {
                codigo:    item.codigo || null,
                nombre:    item.nombre || null,
                fuente:    fuente || null,
                area:      area || null,
                item_type: 'protocolo_estructurado',
                sin_embedding: embeddingValue === null,
              },
            })
            indexados++
          } catch (e: any) {
            console.warn('[import-protocolo] chunk falló:', e?.message)
          }
        })
      )
      // Pausa breve entre lotes
      if (i + 5 < items.length) await new Promise(r => setTimeout(r, 200))
    }

    // 3. Marcar documento como procesado
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ procesado: indexados > 0, total_chunks: indexados })
      .eq('id', documentId)

    return NextResponse.json({
      ok: true,
      document_id: documentId,
      items_detectados: items.length,
      chunks_indexados: indexados,
      con_embedding: conEmbedding,
      sin_embedding: indexados - conEmbedding,
      preview: items.slice(0, 3),
    })
  } catch (e: any) {
    console.error('[import-protocolo]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
