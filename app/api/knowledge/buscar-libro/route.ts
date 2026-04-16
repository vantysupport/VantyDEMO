// app/api/knowledge/buscar-libro/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ error: 'query requerido' }, { status: 400 })

  try {
    const resultados = await Promise.allSettled([
      buscarArchiveOrg(query),
      buscarOpenLibrary(query),
    ])

    const libros: any[] = []
    for (const r of resultados) {
      if (r.status === 'fulfilled') libros.push(...r.value)
    }

    // Deduplicar por título
    const unicos = libros
      .filter((v, i, a) => a.findIndex(x => x.titulo.toLowerCase().slice(0, 30) === v.titulo.toLowerCase().slice(0, 30)) === i)
      .slice(0, 8)

    return NextResponse.json({ resultados: unicos })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ── Archive.org: busca y obtiene URL pública verificada ───────────────────────
async function buscarArchiveOrg(query: string): Promise<any[]> {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&fl[]=identifier,title,creator,downloads,language&rows=6&output=json&mediatype=texts`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
  if (!res.ok) return []

  const data = await res.json()
  const docs = data?.response?.docs || []

  const libros = await Promise.all(
    docs.map(async (doc: any) => {
      const info = await getArchiveInfo(doc.identifier)
      if (!info) return null
      return {
        id: `archive_${doc.identifier}`,
        titulo: doc.title || doc.identifier,
        autor: Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Desconocido'),
        fuente: 'Archive.org',
        url: info.url,
        formato: info.formato,
        urlVista: `https://archive.org/details/${doc.identifier}`,
        idioma: doc.language || 'en',
        acceso: info.acceso,
      }
    })
  )
  return libros.filter(Boolean)
}

async function getArchiveInfo(identifier: string): Promise<{ url: string; formato: string; acceso: string } | null> {
  try {
    const res = await fetch(`https://archive.org/metadata/${identifier}/files`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    const files: any[] = data?.result || []

    // 1. Texto plano DjVu — siempre público, ideal para indexar
    const djvu = files.find(f => f.name?.endsWith('_djvu.txt'))
    if (djvu) return {
      url: `https://archive.org/download/${identifier}/${encodeURIComponent(djvu.name)}`,
      formato: 'TXT',
      acceso: 'público',
    }

    // 2. PDF sin restricción (acceso = 'permit' significa libre)
    const pdfLibre = files.find(f =>
      f.name?.toLowerCase().endsWith('.pdf') &&
      !f.name?.includes('_text') &&
      (f.source === 'original' || f.source === 'derivative')
    )
    if (pdfLibre) return {
      url: `https://archive.org/download/${identifier}/${encodeURIComponent(pdfLibre.name)}`,
      formato: 'PDF',
      acceso: 'verificar',
    }

    return null
  } catch {
    return null
  }
}

// ── Open Library: solo muestra libros con acceso libre verificado ─────────────
async function buscarOpenLibrary(query: string): Promise<any[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=8&fields=key,title,author_name,ia,public_scan_b,language,edition_count`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return []

  const data = await res.json()
  const docs = data?.docs || []

  // Solo los que tienen escaneo público (public_scan_b = true)
  const publicos = docs.filter((doc: any) => doc.ia?.length > 0 && doc.public_scan_b === true)

  const libros = await Promise.all(
    publicos.map(async (doc: any) => {
      const identifier = doc.ia[0]
      const info = await getArchiveInfo(identifier)
      if (!info) return null
      return {
        id: `ol_${doc.key}`,
        titulo: doc.title,
        autor: doc.author_name?.[0] || 'Desconocido',
        fuente: 'Open Library',
        url: info.url,
        formato: info.formato,
        urlVista: `https://openlibrary.org${doc.key}`,
        idioma: doc.language?.[0] || 'en',
        acceso: 'público',
      }
    })
  )
  return libros.filter(Boolean)
}
