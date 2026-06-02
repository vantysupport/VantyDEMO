'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, X, Loader2, Copy, Check, ChevronRight, ChevronLeft,
  AlertCircle, ExternalLink, Star, Wifi, WifiOff, Home, Tag,
  BookOpen, GitBranch, ArrowLeft
} from 'lucide-react'

type Result = { id?: string; code: string; title: string; chapter?: string; isLeaf?: boolean }
type Detail = {
  code: string; title: string; definition: string
  inclusions: string[]; exclusions: string[]; indexTerms: string[]
  codingNote: string; diagnosticCriteria: string
  children: { id: string; code: string; title: string }[]
  parent: { id: string; code: string; title: string } | null
  browserUrl: string
}

const SIGLAS_ES: Record<string, string> = {
  'tea': 'Trastorno del espectro autista',
  'tdah': 'Trastorno por déficit de atención',
  'toc': 'Trastorno obsesivo compulsivo',
  'tept': 'Estrés postraumático',
  'tnd': 'Negativista desafiante',
  'tlp': 'Límite personalidad',
  'di': 'Discapacidad intelectual',
  'dislexia': 'Dislexia',
  'dispraxia': 'Coordinación motora desarrollo',
  'discalculia': 'Dificultad aprendizaje matemáticas',
  'disgrafia': 'Dificultad escritura',
  'arfid': 'Evitación restricción ingesta',
  'bipolar': 'Trastorno bipolar',
  'esquizofrenia': 'Esquizofrenia',
  'ansiedad': 'Ansiedad',
  'depresion': 'Depresivo',
  'enuresis': 'Enuresis',
  'encopresis': 'Encopresis',
  'tourette': 'Tourette',
  'mutismo': 'Mutismo selectivo',
  'tartamudez': 'Disfluencia',
}

const CHIPS = ['TEA','TDAH','TOC','TEPT','Ansiedad','Dislexia','TND','Depresión','Bipolar','Enuresis','ARFID','Dispraxia','Tourette','Mutismo','TLP','Esquizofrenia']

interface Props {
  onAsignar?: (r: Result | Detail) => void
  showAsignar?: boolean
}

export default function DiagnosticoBuscador({ onAsignar, showAsignar = false }: Props) {
  const [q, setQ]               = useState('')
  const [results, setResults]   = useState<Result[]>([])
  const [loading, setLoading]   = useState(false)
  const [apiOk, setApiOk]       = useState<boolean | null>(null)
  const [selected, setSelected] = useState<Detail | null>(null)
  const [detailLoading, setDL]  = useState(false)
  const [copied, setCopied]     = useState<string | null>(null)
  const [history, setHistory]   = useState<string[]>([])
  const [breadcrumb, setBreadcrumb] = useState<{ code: string; title: string }[]>([])
  const inputRef  = useRef<HTMLInputElement>(null)
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Verificar API al montar
  useEffect(() => {
    fetch('/api/cie11?action=search&q=autismo')
      .then(r => r.json())
      .then(d => setApiOk(!d.fallback))
      .catch(() => setApiOk(false))
  }, [])

  // Búsqueda con debounce
  const doSearch = useCallback(async (query: string) => {
    const q2 = query.trim()
    // Resolver sigla en español si aplica
    const resolved = SIGLAS_ES[q2.toLowerCase()] || q2
    setLoading(true)
    setSelected(null)
    setBreadcrumb([])
    try {
      const res  = await fetch(`/api/cie11?action=search&q=${encodeURIComponent(resolved)}`)
      const data = await res.json()
      setApiOk(!data.fallback)
      setResults(data.results || [])
      if (!history.includes(q2)) setHistory(h => [q2, ...h].slice(0, 6))
    } catch {
      setApiOk(false)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [history])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (q.trim().length < 2) { setResults([]); setSelected(null); return }
    debounce.current = setTimeout(() => doSearch(q), 400)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [q, doSearch])

  // Cargar detalle
  const loadDetail = async (r: { id?: string; code: string; title: string }, addBreadcrumb = true) => {
    setDL(true)
    if (addBreadcrumb && selected) {
      setBreadcrumb(bc => [...bc, { code: selected.code, title: selected.title }])
    }
    // Mostrar panel inmediatamente con lo que ya sabemos
    setSelected({
      code: r.code, title: r.title || r.code,
      definition: '', inclusions: [], exclusions: [],
      indexTerms: [], codingNote: '', diagnosticCriteria: '',
      children: [], parent: null,
      browserUrl: `https://icd.who.int/browse/2024-01/mms/es#${r.code}`,
    })
    try {
      // Siempre usar el ID completo (URL) si está disponible — más confiable que el código alfanumérico
      const param = r.id || r.code
      const res   = await fetch(`/api/cie11?action=detail&code=${encodeURIComponent(param)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data  = await res.json()
      console.log('[CIE-11] detail response:', data)
      if (data.fallback || data.error) throw new Error(data.error || 'fallback')
      setSelected({
        code:               data.code       || r.code,
        title:              data.title      || r.title || r.code,
        definition:         data.definition || '',
        inclusions:         Array.isArray(data.inclusions) ? data.inclusions : [],
        exclusions:         Array.isArray(data.exclusions) ? data.exclusions : [],
        indexTerms:         Array.isArray(data.indexTerms) ? data.indexTerms : [],
        children:           Array.isArray(data.children)   ? data.children   : [],
        codingNote:         data.codingNote         || '',
        diagnosticCriteria: data.diagnosticCriteria || '',
        parent:             data.parent             || null,
        browserUrl:         data.browserUrl || `https://icd.who.int/browse/2024-01/mms/es#${data.code || r.code}`,
      })
    } catch (e) {
      console.warn('[CIE-11] Detail load failed:', e)
      // Mantener el panel con lo básico ya mostrado
    } finally {
      setDL(false)
    }
  }

  const goBack = async () => {
    const prev = breadcrumb[breadcrumb.length - 1]
    if (!prev) { setSelected(null); setBreadcrumb([]); return }
    setBreadcrumb(bc => bc.slice(0, -1))
    await loadDetail(prev, false)
  }

  const copiar = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1800)
  }

  const clear = () => {
    setQ(''); setResults([]); setSelected(null); setBreadcrumb([])
    inputRef.current?.focus()
  }


  return (
    <div className="space-y-4">

      {/* ── ESTADO API ── */}
      {apiOk === true && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <Wifi size={13}/> Conectado a API oficial OMS — CIE-11 completo (+17.000 diagnósticos en español)
        </div>
      )}
      {apiOk === false && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
          <WifiOff size={13}/> Usando base local. Configura <code className="bg-amber-100 px-1 rounded">WHO_ICD_CLIENT_ID</code> y <code className="bg-amberity-100 px-1 rounded">WHO_ICD_CLIENT_SECRET</code> para acceso completo.
        </div>
      )}

      {/* ── BUSCADOR ── */}
      <div className="relative">
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && q.trim().length >= 2 && doSearch(q)}
          placeholder="Buscar diagnóstico — nombre, código CIE-11, sigla (TEA, TDAH, TOC...)..."
          className="w-full pl-10 pr-10 py-3.5 rounded-xl text-sm font-medium border-2 outline-none focus:border-sky-500 transition-colors shadow-sm"
          style={{ background:'var(--input-bg)', borderColor:'var(--input-border)', color:'var(--text-primary)' }}
          autoComplete="off"
        />
        {loading
          ? <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-sky-500"/>
          : q && <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-all"><X size={15}/></button>
        }
      </div>

      {/* ── CHIPS ── */}
      {q.length === 0 && !selected && (
        <div className="space-y-2">
          {history.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold text-slate-400">Recientes:</span>
              {history.map(h => (
                <button key={h} onClick={() => setQ(h)}
                  className="px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-50 border-slate-200 text-slate-500 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700 transition-all">
                  🕐 {h}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[10px] font-bold text-slate-400">Explorar:</span>
            {CHIPS.map(c => (
              <button key={c} onClick={() => setQ(c)}
                className="px-2.5 py-1 rounded-full text-xs font-bold border transition-all hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700"
                style={{ background:'var(--card)', borderColor:'var(--card-border)', color:'var(--text-secondary)' }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── PANEL DETALLE ── */}
      {selected && (
        <div ref={detailRef} className="rounded-2xl border overflow-hidden shadow-sm" style={{ background:'var(--card)', borderColor:'var(--card-border)' }}>

          {/* Breadcrumb */}
          <div className="px-4 py-2.5 border-b flex items-center gap-1.5 text-xs flex-wrap" style={{ background:'var(--muted-bg)', borderColor:'var(--card-border)' }}>
            <button onClick={() => { setSelected(null); setBreadcrumb([]) }}
              className="flex items-center gap-1 text-sky-600 hover:underline font-semibold">
              <Home size={11}/> Inicio
            </button>
            {breadcrumb.map((bc, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={11} className="text-slate-300"/>
                <button onClick={goBack} className="text-sky-600 hover:underline font-semibold">{bc.code}</button>
              </span>
            ))}
            <ChevronRight size={11} className="text-slate-300"/>
            <span className="font-bold text-slate-600">{selected.code}</span>
          </div>

          <div className="p-5 space-y-4">

            {detailLoading && (
              <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin text-sky-400"/> Cargando detalle desde API OMS...
              </div>
            )}
            {true && (<>

              {/* Código + Título */}
              <div className="flex items-start gap-3">
                <span className="px-3 py-1.5 rounded-xl text-sm font-bold bg-teal-500 text-white flex-shrink-0">{selected.code}</span>
                <div className="flex-1">
                  <h2 className="font-bold text-lg leading-tight" style={{ color:'var(--text-primary)' }}>{selected.title}</h2>
                  {selected.parent && (
                    <p className="text-xs mt-1 font-semibold" style={{ color:'var(--text-muted)' }}>
                      Capítulo: {CHAPTER_NAMES[selected.parent.code] || selected.parent.title}
                    </p>
                  )}
                </div>
              </div>

              {/* Definición */}
              {selected.definition && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-teal-600 flex items-center gap-1.5">
                    <BookOpen size={11}/> Definición
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color:'var(--text-secondary)' }}>
                    {selected.definition}
                  </p>
                </div>
              )}

              {/* Criterios diagnósticos OMS */}
              {selected.diagnosticCriteria && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200">
                  <p className="text-[10px] font-bold text-teal-700 mb-1.5 flex items-center gap-1.5">
                    🩺 Criterios diagnósticos (OMS CIE-11)
                  </p>
                  <p className="text-xs leading-relaxed text-teal-900 whitespace-pre-line">{selected.diagnosticCriteria}</p>
                </div>
              )}

              {/* Nota de codificación */}
              {selected.codingNote && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 mb-1">📋 Nota de codificación</p>
                  <p className="text-xs leading-relaxed text-blue-800">{selected.codingNote}</p>
                </div>
              )}

              {/* Términos índice / sinónimos */}
              {selected.indexTerms.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color:'var(--text-muted)' }}>
                    <Tag size={11}/> Términos incluidos / sinónimos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.indexTerms.map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs bg-sky-50 text-sky-700 border border-sky-100 font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Inclusions */}
              {selected.inclusions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-emerald-700 flex items-center gap-1.5">
                    ✓ Incluye
                  </p>
                  <ul className="space-y-1">
                    {selected.inclusions.map((inc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color:'var(--text-secondary)' }}>
                        <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span> {inc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Exclusiones */}
              {selected.exclusions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-red-600 flex items-center gap-1.5">
                    ✕ Exclusiones
                  </p>
                  <ul className="space-y-1">
                    {selected.exclusions.map((exc, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="mt-0.5 flex-shrink-0">•</span> {exc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Subcategorías / Hijos */}
              {selected.children.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color:'var(--text-muted)' }}>
                    <GitBranch size={11}/> Subcategorías / Hijos
                  </p>
                  <div className="space-y-1.5">
                    {selected.children.map((child, i) => (
                      <button key={i} onClick={() => loadDetail(child)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-teal-400 hover:bg-teal-50 group"
                        style={{ borderColor:'var(--card-border)', background:'var(--muted-bg)' }}>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-500 text-white flex-shrink-0">{child.code}</span>
                        <span className="text-sm font-semibold flex-1" style={{ color:'var(--text-primary)' }}>
                          {child.title || `Ver subcategoría ${child.code}`}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0"/>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categoría Padre */}
              {selected.parent && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color:'var(--text-muted)' }}>
                    ↑ Categoría Padre
                  </p>
                  <button onClick={() => loadDetail(selected.parent!)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:border-sky-400 hover:bg-sky-50 group"
                    style={{ borderColor:'var(--card-border)', background:'var(--muted-bg)' }}>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-400 text-white flex-shrink-0">{selected.parent.code}</span>
                    <span className="text-sm font-semibold flex-1" style={{ color:'var(--text-primary)' }}>{selected.parent.title}</span>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-sky-500 flex-shrink-0"/>
                  </button>
                </div>
              )}

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor:'var(--card-border)' }}>
                <button onClick={() => copiar(selected.code, 'code')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all hover:bg-slate-50"
                  style={{ borderColor:'var(--card-border)', color:'var(--text-secondary)' }}>
                  {copied === 'code' ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                  Copiar código
                </button>
                <button onClick={() => copiar(`${selected.title}\nCIE-11: ${selected.code}\n${selected.definition}`, 'full')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-sky-600 text-white hover:bg-sky-700 transition-colors">
                  {copied === 'full' ? <Check size={14}/> : <Copy size={14}/>}
                  Copiar para ARIA
                </button>
                {showAsignar && onAsignar && (
                  <button onClick={() => onAsignar(selected)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
                    <Star size={14}/> Asignar al paciente
                  </button>
                )}
                <a href={selected.browserUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all hover:bg-slate-50"
                  style={{ borderColor:'var(--card-border)', color:'var(--text-secondary)' }}>
                  <ExternalLink size={14}/> Ver en OMS CIE-11
                </a>
              </div>

            </>)}
          </div>
        </div>
      )}

      {/* ── LISTA RESULTADOS ── */}
      {!selected && (
        <div className="space-y-2">

          {q.length >= 2 && !loading && (
            <p className="text-xs font-bold" style={{ color:'var(--text-muted)' }}>
              {results.length === 0
                ? `Sin resultados para "${q}"`
                : `${results.length} resultado${results.length !== 1 ? 's' : ''} — haz clic para ver el detalle completo`}
            </p>
          )}

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">

            {/* Skeleton */}
            {loading && [1,2,3,4].map(i => (
              <div key={i} className="rounded-xl border p-4 animate-pulse" style={{ background:'var(--card)', borderColor:'var(--card-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-16 rounded-lg bg-slate-200"/>
                  <div className="h-4 rounded bg-slate-200 flex-1"/>
                </div>
              </div>
            ))}

            {/* Sin resultados */}
            {!loading && q.length >= 2 && results.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle size={36} className="mx-auto mb-3 text-slate-200"/>
                <p className="text-sm font-semibold mb-1" style={{ color:'var(--text-muted)' }}>Sin resultados para "{q}"</p>
                <p className="text-xs mb-4" style={{ color:'var(--text-muted)' }}>Intentá con el código CIE-11 (ej: 6A02), otro idioma o sinónimo</p>
                <button onClick={clear} className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition-colors">Nueva búsqueda</button>
              </div>
            )}

            {/* Resultados */}
            {!loading && results.map(r => (
              <button key={r.id || r.code} onClick={() => loadDetail(r)}
                className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all hover:border-teal-400 hover:shadow-sm hover:bg-teal-50/30 group"
                style={{ background:'var(--card)', borderColor:'var(--card-border)' }}>
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-teal-500 text-white flex-shrink-0 min-w-[60px] text-center">
                  {r.code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug" style={{ color:'var(--text-primary)' }}>{r.title}</p>
                  {r.chapter && (
                    <p className="text-[10px] mt-0.5 font-medium" style={{ color:'var(--text-muted)' }}>
                      {CHAPTER_NAMES[r.chapter] || `Capítulo ${r.chapter}`}
                    </p>
                  )}
                </div>
                <ChevronRight size={15} className="text-slate-300 group-hover:text-teal-500 transition-colors flex-shrink-0"/>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* PIE */}
      <p className="text-[10px] text-center" style={{ color:'var(--text-muted)' }}>
        CIE-11 — Clasificación Internacional de Enfermedades, 11.ª revisión · OMS 2024
      </p>
    </div>
  )
}

const CHAPTER_NAMES: Record<string, string> = {
  '01':'Enfermedades infecciosas', '02':'Neoplasias', '03':'Sangre',
  '04':'Sistema inmune', '05':'Endocrino / Nutrición',
  '06':'Trastornos mentales — Neurodesarrollo',
  '07':'Trastornos del sueño', '08':'Sistema nervioso',
  '09':'Ojo', '10':'Oído', '11':'Sistema circulatorio',
  '12':'Sistema respiratorio', '13':'Sistema digestivo',
  '14':'Piel', '15':'Músculo-esquelético', '16':'Genitourinario',
  '22':'Traumatismos', '24':'Factores de salud',
}
