import { NextRequest, NextResponse } from 'next/server'

const TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token'

async function getToken(): Promise<string> {
  const clientId     = process.env.WHO_ICD_CLIENT_ID     || ''
  const clientSecret = process.env.WHO_ICD_CLIENT_SECRET || ''
  if (!clientId || !clientSecret) throw new Error('WHO credentials not configured')

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'icdapi_access',
      grant_type:    'client_credentials',
    }),
    // No cache — siempre token fresco
    cache: 'no-store',
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Token request failed ${res.status}: ${t.slice(0, 100)}`)
  }

  const data = await res.json()
  if (!data.access_token) throw new Error('No access_token in response')
  return data.access_token
}

const WHO_HEADERS = (token: string) => ({
  Authorization:     `Bearer ${token}`,
  Accept:            'application/json',
  'Accept-Language': 'es',
  'API-Version':     'v2',
})

function txt(v: any): string {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (v['@value']) return v['@value']
  if (Array.isArray(v)) {
    const es = v.find((x: any) => x['@language']?.startsWith('es'))
    if (es?.['@value']) return es['@value']
    const any = v.find((x: any) => x['@value'])
    if (any?.['@value']) return any['@value']
    return v.map(txt).filter(Boolean).join(' ')
  }
  return String(v)
}

const SIGLAS: Record<string, string> = {
  'tea':   'trastorno espectro autista',
  'tdah':  'déficit atención hiperactividad',
  'toc':   'trastorno obsesivo compulsivo',
  'tept':  'estrés postraumático',
  'tnd':   'negativista desafiante',
  'tlp':   'trastorno límite personalidad',
  'di':    'discapacidad intelectual',
  'dislexia':  'dislexia lectura',
  'dispraxia': 'coordinación desarrollo motor',
  'arfid': 'evitación restricción ingesta',
  'bipolar':     'trastorno bipolar',
  'esquizofrenia': 'esquizofrenia',
  'ansiedad':  'ansiedad generalizada',
  'depresion': 'depresivo mayor',
  'tourette':  'síndrome tourette tics',
  'mutismo':   'mutismo selectivo',
  'enuresis':  'enuresis',
  'encopresis':'encopresis',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || ''
  const q      = searchParams.get('q')      || ''
  const code   = searchParams.get('code')   || ''

  // ── DEBUG ────────────────────────────────────────────────────────────────
  if (action === 'debug') {
    try {
      const token = await getToken()
      return NextResponse.json({ ok: true, tokenPrefix: token.slice(0, 10) + '...' })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message })
    }
  }

  // ── BÚSQUEDA ─────────────────────────────────────────────────────────────
  if (action === 'search') {
    if (q.trim().length < 2) return NextResponse.json({ results: [], fallback: false })

    let token: string
    try { token = await getToken() }
    catch (e: any) { return NextResponse.json({ results: [], fallback: true, error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }) }

    const resolved = SIGLAS[q.toLowerCase().trim()] || q
    try {
      const url = new URL('https://id.who.int/icd/release/11/2024-01/mms/search')
      url.searchParams.set('q', resolved)
      url.searchParams.set('useFlexisearch', 'true')
      url.searchParams.set('flatResults', 'true')
      url.searchParams.set('highlightingEnabled', 'false')
      url.searchParams.set('includeKeywordResult', 'true')

      const res = await fetch(url.toString(), { headers: WHO_HEADERS(token), cache: 'no-store' })
      if (!res.ok) return NextResponse.json({ results: [], fallback: true, error: `Search ${res.status}` })

      const data = await res.json()
      const results = (data.destinationEntities || []).slice(0, 30).map((e: any) => ({
        id: e.id, code: e.theCode || '', title: e.title || '', chapter: e.chapter || '',
      }))
      return NextResponse.json({ results, fallback: false })
    } catch (e: any) {
      return NextResponse.json({ results: [], fallback: true, error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message })
    }
  }

  // ── DETALLE ───────────────────────────────────────────────────────────────
  if (action === 'detail') {
    if (!code) return NextResponse.json({ error: 'code requerido' }, { status: 400 })

    // Obtener token fresco en ESTE mismo request
    let token: string
    try { token = await getToken() }
    catch (e: any) {
      return NextResponse.json({ error: `Token failed: ${e.message}`, fallback: true }, { status: 503 })
    }

    // La OMS devuelve IDs con http:// pero la API requiere https://
    const entityUrl = code.startsWith('http')
      ? code.replace('http://', 'https://')
      : `https://id.who.int/icd/release/11/2024-01/mms/${code}`

    try {
      const res = await fetch(entityUrl, {
        headers: WHO_HEADERS(token),
        cache: 'no-store',
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error('[CIE-11] Entity fetch error:', res.status, errText.slice(0, 300))
        return NextResponse.json({ error: `Entity ${res.status}`, fallback: true }, { status: res.status })
      }

      const d = await res.json()
      console.log('[CIE-11] ✅ Entity keys:', Object.keys(d).join(', '))

      // Para los hijos: hacer fetch paralelo para obtener código y título reales
      // Limitamos a 8 hijos para no sobrecargar
      const childUrls = (d.child || []).slice(0, 8)
      const children = await Promise.all(
        childUrls.map(async (url: string) => {
          const seg = url.split('/').pop() || ''
          const isSpecial = seg === 'other' || seg === 'unspecified'
          if (isSpecial) {
            return {
              id:    url.replace('http://', 'https://'),
              code:  seg === 'other' ? 'Otro especificado' : 'Sin especificación',
              title: seg === 'other' ? 'Otro trastorno especificado' : 'Sin especificación',
            }
          }
          try {
            const cr = await fetch(url.replace('http://', 'https://'), { headers: WHO_HEADERS(token), cache: 'no-store' })
            if (!cr.ok) return { id: url.replace('http://', 'https://'), code: seg, title: '' }
            const cd = await cr.json()
            return {
              id:    url.replace('http://', 'https://'),
              code:  cd.code || seg,
              title: txt(cd.title),
            }
          } catch {
            return { id: url.replace('http://', 'https://'), code: seg, title: '' }
          }
        })
      )

      // Para el padre: también obtener código y título reales
      let parent: { id: string; code: string; title: string } | null = null
      if (d.parent?.[0]) {
        try {
          const pr = await fetch(d.parent[0].replace('http://', 'https://'), { headers: WHO_HEADERS(token), cache: 'no-store' })
          if (pr.ok) {
            const pd = await pr.json()
            parent = { id: d.parent[0].replace('http://', 'https://'), code: pd.code || '', title: txt(pd.title) }
          } else {
            parent = { id: d.parent[0].replace('http://', 'https://'), code: d.parent[0].split('/').pop() || '', title: '' }
          }
        } catch {
          parent = { id: d.parent[0].replace('http://', 'https://'), code: d.parent[0].split('/').pop() || '', title: '' }
        }
      }

      return NextResponse.json({
        code:               d.code || '',
        title:              txt(d.title),
        definition:         txt(d.definition) || txt(d.longDefinition) || '',
        inclusions:         (d.inclusion  || []).map((i: any) => txt(i.label)).filter(Boolean),
        exclusions:         (d.exclusion  || []).map((e: any) => txt(e.label)).filter(Boolean),
        indexTerms:         (d.indexTerm  || []).map((t: any) => txt(t.label)).filter(Boolean),
        codingNote:         txt(d.codingNote),
        diagnosticCriteria: txt(d.diagnosticCriteria),
        children,
        parent,
        browserUrl: `https://icd.who.int/browse/2024-01/mms/es#${d.code || ''}`,
      })
    } catch (e: any) {
      console.error('[CIE-11] Detail exception:', e.message)
      return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message, fallback: true }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'action: search|detail|debug' }, { status: 400 })
}
