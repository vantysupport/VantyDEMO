'use client'

import { useI18n } from '@/lib/i18n-context'
import DiagnosticoBuscador from './DiagnosticoBuscador'
import { useState, useEffect, useRef } from 'react'
import { supabase as supabasePublic } from '@/lib/supabase'
import {
  Upload, Trash2, CheckCircle2, Clock, Loader2,
  FileText, Plus, X, Brain, Save, Search,
  Sparkles, Cpu, BookMarked, RefreshCw, Globe, Stethoscope,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'

type InputMode = 'archivo' | 'url' | 'texto' | 'buscar'
type Tab = 'aprender' | 'biblioteca' | 'diagnosticos'

export default function KnowledgeBaseView({ enabledTabs }: { enabledTabs?: Record<string, boolean> } = {}) {
  const toast = useToast()
  const { t } = useI18n()
  const { isDark } = useTheme()
  const [tab, setTab] = useState<Tab>('aprender')
  const cerebroTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'aprender',     label: 'Aprender',       icon: null },
    { id: 'diagnosticos', label: 'Diagnósticos',   icon: null },
    { id: 'biblioteca',   label: 'Biblioteca',     icon: null },
  ].filter(t => !enabledTabs || enabledTabs[`cerebro_${t.id}`] !== false) as { id: Tab; label: string; icon: React.ReactNode }[]
  // If active tab got disabled, jump to first available
  const activeTab: Tab = cerebroTabs.find(t => t.id === tab) ? tab : (cerebroTabs[0]?.id ?? 'aprender')
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [keywords, setKeywords] = useState('')
  const [modo, setModo] = useState<'completo' | 'rapido'>('completo')
  const [aprendiendo, setAprendiendo] = useState(false)
  const [logAprender, setLogAprender] = useState<string[]>([])
  const [resultadoAprender, setResultadoAprender] = useState<any>(null)
  const [urlAprender, setUrlAprender] = useState('')
  const [modoFuente, setModoFuente] = useState<'keywords' | 'url'>('keywords')

  const temasSugeridos = [
    'Reforzamiento positivo ABA',
    'Comunicación aumentativa AAC TEA',
    'Análisis funcional de conducta',
    'Habilidades sociales autismo',
    'Control de impulsos TDAH',
    'Moldeamiento shaping ABA',
    'Entrenamiento de habilidades diarias',
    'Regulación emocional niños',
    'Terapia de juego ABA',
    'Lenguaje verbal comportamental',
    'Reducción de conductas repetitivas',
    'Integración sensorial TEA',
  ]

  const [inputMode, setInputMode] = useState<InputMode>('archivo')
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ titulo: '', tipo: 'libro', descripcion: '', texto: '', url: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [resultadosBusqueda, setResultadosBusqueda] = useState<any[]>([])
  const [libroSeleccionado, setLibroSeleccionado] = useState<any>(null)

  const loadDocs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/ingest')
      const json = await res.json()
      setDocumentos(json.data || [])
    } catch { toast.error('Error cargando documentos') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadDocs() }, [])

  const handleAprender = async () => {
    if (!keywords.trim()) { toast.error('Escribe palabras clave'); return }
    setAprendiendo(true)
    setLogAprender([`🚀 Iniciando aprendizaje: "${keywords}"...`])
    setResultadoAprender(null)
    try {
      const res = await fetch('/api/knowledge/aprender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ keywords: keywords.trim(), modo , locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setLogAprender(json.log || [])
      setResultadoAprender(json)
      toast.success(`${json.totalChunks} fragmentos aprendidos`)
      await loadDocs()
    } catch (e: any) {
      toast.error(e.message)
      setLogAprender(prev => [...prev, `❌ Error: ${e.message}`])
    } finally { setAprendiendo(false) }
  }

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch('/api/knowledge/ingest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({ id, locale: localStorage.getItem('vanty_locale') || 'es' }),
      })
      const json = await res.json()
      if (json.ok) { toast.success(`Re-indexado: ${json.chunks} fragmentos`); await loadDocs() }
      else toast.error(json.error || 'Error al re-indexar')
    } catch (e: any) { toast.error(e.message) }
  }

  const handleAprenderUrl = async () => {
    if (!urlAprender.trim()) { toast.error('Ingresa una URL'); return }
    setAprendiendo(true)
    setLogAprender([`🌐 Leyendo URL: "${urlAprender}"...`])
    setResultadoAprender(null)
    try {
      let hostname = urlAprender
      try { hostname = new URL(urlAprender).hostname } catch { /* keep raw */ }
      const res = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
        body: JSON.stringify({
          titulo: `Página web: ${hostname}`,
          tipo: 'articulo',
          sourceUrl: urlAprender,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Error leyendo la URL')
      setLogAprender([
        `✅ URL leída: ${json.chars?.toLocaleString() || 0} caracteres`,
        `✅ Método: ${json.method || 'scraping'}`,
        `✅ Indexados: ${json.chunks || 0} fragmentos`,
        `🎉 La IA ya aprendió el contenido de esa página`,
      ])
      setResultadoAprender({ keywords: urlAprender, terminos: [urlAprender], fuentes: 1, documentos: 1, totalChunks: json.chunks || 0 })
      toast.success(`${json.chunks} fragmentos aprendidos de la URL`)
      await loadDocs()
    } catch (e: any) {
      toast.error(e.message)
      setLogAprender(prev => [...prev, `❌ ${e.message}`])
    } finally { setAprendiendo(false) }
  }

  const buscarLibros = async () => {
    if (!busqueda.trim()) return
    setBuscando(true); setResultadosBusqueda([]); setLibroSeleccionado(null)
    try {
      const res = await fetch(`/api/knowledge/buscar-libro?q=${encodeURIComponent(busqueda)}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setResultadosBusqueda(json.resultados || [])
      if (!json.resultados?.length) toast.error('Sin resultados. Prueba otro título.')
    } catch (e: any) { toast.error(e.message) }
    finally { setBuscando(false) }
  }

  // ── Extraer texto de PDF en el navegador usando pdfjs-dist (npm) ────────────
  //   Optimizado para PDFs grandes (>50MB):
  //     - Libera la memoria de cada página después de extraerla (page.cleanup())
  //     - Cede el control al event loop cada 20 páginas
  //     - Desactiva fuentes embebidas y rendering (solo necesitamos texto)
  const extractPdfTextInBrowser = async (file: File, onProgress: (p: string) => void): Promise<string> => {
    onProgress('Cargando lector de PDF...')

    const pdfjs = await import('pdfjs-dist')
    // Worker inline — evita problemas de CORS con archivos externos
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    const sizeMB = Math.round(file.size / 1024 / 1024)
    onProgress(`Leyendo archivo (${sizeMB} MB)...`)
    const arrayBuffer = await file.arrayBuffer()

    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      // Optimizaciones para archivos grandes — solo extraemos texto
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
      verbosity: 0,
    } as any)
    const pdf = await loadingTask.promise

    const totalPages = pdf.numPages
    onProgress(`Leyendo ${totalPages} páginas... (esto puede tardar 1-3 min en archivos grandes)`)

    const textos: string[] = []
    let charsTotales = 0
    for (let i = 1; i <= totalPages; i++) {
      if (i % 10 === 0 || i === totalPages) {
        onProgress(`📖 Página ${i} de ${totalPages} · ${Math.round(charsTotales / 1000)}k chars extraídos`)
        // Ceder el control al navegador para que respire (evita "Aw, snap!")
        await new Promise(r => setTimeout(r, 0))
      }
      try {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (pageText.length > 10) {
          textos.push(pageText)
          charsTotales += pageText.length
        }
        // CRÍTICO: liberar memoria de la página antes de pasar a la siguiente
        page.cleanup()
      } catch (pageErr: any) {
        console.warn(`pdfjs: página ${i} falló — ${pageErr?.message || 'error'}`)
      }
    }

    // Liberar memoria del documento completo
    try { await pdf.cleanup() } catch {}
    try { await pdf.destroy() } catch {}

    const fullText = textos.join('\n\n')
    onProgress(`✅ ${totalPages} páginas leídas — ${Math.round(fullText.length / 1000)}k caracteres`)
    return fullText
  }

  // ── Renderizar páginas de un PDF como JPEGs (para OCR de PDFs escaneados) ──
  //   Devuelve un array de Blobs (uno por página, comprimidos a JPEG 0.85)
  const renderPdfPagesAsJpegs = async (
    pdf: any,
    fromPage: number,
    toPage: number,
    onProgress?: (msg: string) => void,
  ): Promise<{ pagina: number; blob: Blob }[]> => {
    const imgs: { pagina: number; blob: Blob }[] = []
    for (let i = fromPage; i <= toPage; i++) {
      try {
        const page = await pdf.getPage(i)
        // scale 1.5 = ~150 DPI — buena legibilidad sin archivos enormes
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) { page.cleanup(); continue }
        await page.render({ canvasContext: ctx, viewport }).promise
        const blob: Blob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.82)
        )
        if (blob) imgs.push({ pagina: i, blob })
        page.cleanup()
        // limpiar canvas
        canvas.width = 0; canvas.height = 0
        if (i % 3 === 0) {
          await new Promise(r => setTimeout(r, 0))
          if (onProgress) onProgress(`🖼️ Renderizando página ${i} para OCR…`)
        }
      } catch (e: any) {
        console.warn(`render página ${i} falló:`, e?.message)
      }
    }
    return imgs
  }

  // ── Worker de Tesseract reutilizable ──────────────────────────────────
  //   Se crea una sola vez por subida y se destruye al final, para no descargar
  //   el modelo de idioma (~10MB) en cada página.
  const tesseractWorkerRef = useRef<any>(null)

  const getTesseractWorker = async (onProgress: (m: string) => void) => {
    if (tesseractWorkerRef.current) return tesseractWorkerRef.current
    onProgress('Cargando OCR (Tesseract.js)… primera vez descarga ~10MB de idioma')
    const Tesseract: any = await import('tesseract.js')
    // 'spa+eng' → reconoce español E inglés en el mismo doc
    const worker = await Tesseract.createWorker(['spa', 'eng'], 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && m.progress != null) {
          // No log spam, lo manejamos afuera
        }
      },
    })
    tesseractWorkerRef.current = worker
    return worker
  }

  const closeTesseractWorker = async () => {
    if (tesseractWorkerRef.current) {
      try { await tesseractWorkerRef.current.terminate() } catch {}
      tesseractWorkerRef.current = null
    }
  }

  // ── OCR de un lote de imágenes EN EL NAVEGADOR con Tesseract.js (gratis) ─
  //   Reconoce páginas una por una, junta el texto, y lo manda al endpoint
  //   /api/knowledge/ingest como texto plano (payload chico, sin timeout).
  const ocrPaginasConTesseract = async (
    imgs: { pagina: number; blob: Blob }[],
    titulo: string,
    tipo: string,
    descripcion: string,
    onProgress: (m: string) => void,
    locale: string,
  ): Promise<{ ok: boolean; chunks: number; texto_chars: number; error?: string }> => {
    if (imgs.length === 0) return { ok: false, chunks: 0, texto_chars: 0, error: 'sin imágenes' }

    try {
      const worker = await getTesseractWorker(onProgress)
      const textosPorPagina: string[] = []

      for (let idx = 0; idx < imgs.length; idx++) {
        const { pagina, blob } = imgs[idx]
        onProgress(`🔠 OCR página ${pagina} (${idx + 1}/${imgs.length})…`)
        try {
          const { data } = await worker.recognize(blob)
          const txt = (data?.text || '').trim()
          if (txt.length > 10) {
            textosPorPagina.push(`=== PÁGINA ${pagina} ===\n${txt}`)
          }
        } catch (pageErr: any) {
          console.warn(`Tesseract página ${pagina} falló:`, pageErr?.message)
        }
        // Yield para que el navegador no se cuelgue
        if (idx % 2 === 0) await new Promise(r => setTimeout(r, 0))
      }

      const textoCompleto = textosPorPagina.join('\n\n')
      if (textoCompleto.length < 50) {
        return { ok: false, chunks: 0, texto_chars: 0, error: 'Tesseract no produjo texto utilizable' }
      }

      // Mandar texto extraído al ingest (payload chico = sin riesgo de timeout)
      const subTitulo = `${titulo} (págs ${imgs[0].pagina}-${imgs[imgs.length - 1].pagina})`
      const res = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify({
          titulo: subTitulo,
          tipo,
          descripcion: `${descripcion || ''}\n[OCR Tesseract.js · ${imgs.length} páginas]`.trim(),
          texto: textoCompleto,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return { ok: false, chunks: 0, texto_chars: textoCompleto.length, error: json.error || `HTTP ${res.status}` }

      return { ok: true, chunks: json.chunks || 0, texto_chars: textoCompleto.length }
    } catch (e: any) {
      return { ok: false, chunks: 0, texto_chars: 0, error: e?.message }
    }
  }

  // ── Procesar PDF MUY grande en lotes de 50 páginas e indexar cada lote ──
  //   No retorna texto — manda directo a /api/knowledge/ingest cada lote.
  //   Así nunca se mantienen >50 páginas de texto en memoria.
  const extractAndIngestPdfBatched = async (
    file: File,
    baseTitulo: string,
    baseTipo: string,
    baseDescripcion: string,
    onProgress: (p: string) => void,
    locale: string,
  ): Promise<{ partes: number; chunksIndexados: number }> => {
    onProgress('Cargando lector de PDF...')

    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    const sizeMB = Math.round(file.size / 1024 / 1024)
    onProgress(`Leyendo archivo (${sizeMB} MB)...`)
    const arrayBuffer = await file.arrayBuffer()

    const pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
      verbosity: 0,
    } as any).promise

    const totalPages = pdf.numPages
    const BATCH = 50
    const totalLotes = Math.ceil(totalPages / BATCH)
    onProgress(`PDF cargado: ${totalPages} páginas. Procesando en ${totalLotes} lotes de ${BATCH} páginas...`)

    let totalChunks = 0
    let totalChars = 0
    let lote = 0
    let lotesVacios = 0
    let lotesProcesados = 0

    for (let start = 1; start <= totalPages; start += BATCH) {
      lote++
      const end = Math.min(start + BATCH - 1, totalPages)
      const buffer: string[] = []
      let charsLote = 0

      onProgress(`Lote ${lote}/${totalLotes} · leyendo páginas ${start}-${end}...`)

      for (let i = start; i <= end; i++) {
        try {
          const page = await pdf.getPage(i)
          const tc = await page.getTextContent()
          const pageText = tc.items.map((it: any) => it.str || '').join(' ').replace(/\s+/g, ' ').trim()
          if (pageText.length > 10) {
            buffer.push(pageText)
            charsLote += pageText.length
          }
          page.cleanup()
        } catch (e: any) {
          console.warn(`pdfjs: página ${i} falló — ${e?.message}`)
        }
        // Yield al event loop cada 10 páginas
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0))
      }

      const loteTexto = buffer.join('\n\n')

      // ── FALLBACK AUTOMÁTICO: si pdfjs no extrajo texto, hacemos OCR ──
      //   Esto cubre PDFs escaneados (imágenes con texto). Renderizamos
      //   cada página como JPEG y hacemos OCR en el NAVEGADOR con Tesseract.js
      //   (gratis, ilimitado, sin API keys).
      if (loteTexto.trim().length < 50) {
        lotesVacios++
        onProgress(`Lote ${lote}/${totalLotes} sin texto digital · iniciando OCR (Tesseract.js)…`)
        try {
          const imgs = await renderPdfPagesAsJpegs(pdf, start, end, (m) => onProgress(`${m} (Lote ${lote}/${totalLotes})`))
          if (imgs.length === 0) {
            console.warn(`Lote ${lote} sin imágenes renderizables`)
            continue
          }
          onProgress(`Lote ${lote}/${totalLotes} · OCR Tesseract de ${imgs.length} páginas…`)
          const ocrRes = await ocrPaginasConTesseract(
            imgs, baseTitulo, baseTipo,
            `${baseDescripcion || ''}\n[OCR auto Tesseract para PDF escaneado]`.trim(),
            (m) => onProgress(`Lote ${lote}/${totalLotes} · ${m}`),
            locale,
          )
          if (ocrRes.ok && ocrRes.chunks > 0) {
            totalChunks += ocrRes.chunks
            totalChars += ocrRes.texto_chars
            lotesProcesados++
            onProgress(`Lote ${lote}/${totalLotes} OCR ✅ ${ocrRes.chunks} fragmentos · ${Math.round(ocrRes.texto_chars / 1000)}k chars`)
          } else {
            console.warn(`Lote ${lote} OCR no produjo chunks:`, ocrRes.error)
          }
        } catch (ocrErr: any) {
          console.warn(`Lote ${lote} OCR falló:`, ocrErr?.message)
        }
        continue
      }

      totalChars += loteTexto.length
      lotesProcesados++

      // Indexar este lote (puede partirlo internamente si excede 300KB)
      const MAX_PARTE = 300 * 1024
      const partes: string[] = []
      if (new Blob([loteTexto]).size > MAX_PARTE) {
        let off = 0
        while (off < loteTexto.length) {
          let cut = off + MAX_PARTE
          if (cut < loteTexto.length) {
            const nb = loteTexto.indexOf('\n', cut)
            if (nb !== -1 && nb - cut < 2000) cut = nb
          }
          partes.push(loteTexto.slice(off, cut))
          off = cut
        }
      } else {
        partes.push(loteTexto)
      }

      for (let p = 0; p < partes.length; p++) {
        const partNum = partes.length > 1 ? `, parte ${p + 1}/${partes.length}` : ''
        onProgress(`Lote ${lote}/${totalLotes} (págs ${start}-${end}${partNum}) → indexando ${Math.round(partes[p].length / 1000)}k chars...`)

        const titulo = `${baseTitulo} (págs ${start}-${end}${partes.length > 1 ? ` · ${p + 1}/${partes.length}` : ''})`
        const res = await fetch('/api/knowledge/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': locale },
          body: JSON.stringify({
            titulo, tipo: baseTipo,
            descripcion: `${baseDescripcion || ''}\n\n[Lote ${lote}/${totalLotes} — páginas ${start}-${end}${partNum}]`.trim(),
            texto: partes[p],
          }),
        })
        let json: any
        try { json = await res.json() } catch { throw new Error(`HTTP ${res.status} en lote ${lote}`) }
        if (!res.ok) throw new Error(json.error || `Error en lote ${lote} (HTTP ${res.status})`)
        totalChunks += json.chunks || 0
      }

      // Pausa breve para no saturar y permitir GC
      await new Promise(r => setTimeout(r, 100))
    }

    try { await pdf.cleanup() } catch {}
    try { await pdf.destroy() } catch {}
    // Cerrar Tesseract si fue usado (libera memoria del modelo de idioma)
    await closeTesseractWorker()

    // Diagnóstico: si después de pdfjs + OCR fallback NADA funcionó
    if (totalChars < 500 && totalChunks === 0) {
      throw new Error(
        `No se pudo extraer texto del PDF ni con lectura digital ni con OCR (${totalPages} páginas, ${totalChars} chars).\n\n` +
        `POSIBLES CAUSAS:\n` +
        `  • GEMINI_API_KEY no configurada → el OCR no puede correr\n` +
        `  • PDF protegido con contraseña o corrupto\n` +
        `  • Calidad del escaneo muy baja (imágenes borrosas)\n\n` +
        `OPCIONES:\n` +
        `  1) Verificá que GEMINI_API_KEY esté en las variables de entorno\n` +
        `  2) Si tenés el contenido en Word/web, usá modo "📝 Pegar texto"`
      )
    }

    if (lotesVacios > 0) {
      onProgress(`⚠️ ${lotesProcesados} lotes con texto · ${lotesVacios} vacíos · ${totalChunks} fragmentos indexados`)
    } else {
      onProgress(`✅ ${lotesProcesados} lotes procesados — ${totalChunks} fragmentos indexados (${Math.round(totalChars / 1000)}k chars totales)`)
    }
    return { partes: lotesProcesados, chunksIndexados: totalChunks }
  }

  const handleUpload = async () => {
    if (!form.titulo) { toast.error('El título es requerido'); return }
    if (inputMode === 'archivo' && !selectedFile) { toast.error('Selecciona un archivo'); return }
    if (inputMode === 'url' && !form.url.trim()) { toast.error('Ingresa una URL válida'); return }
    if (inputMode === 'texto' && !form.texto.trim()) { toast.error('Pega el contenido'); return }
    if (inputMode === 'buscar' && !libroSeleccionado) { toast.error('Selecciona un libro'); return }

    setUploading(true)
    try {
      const body: Record<string, any> = { titulo: form.titulo, tipo: form.tipo, descripcion: form.descripcion }

      if (inputMode === 'archivo' && selectedFile) {
        const isPdf = selectedFile.name.toLowerCase().endsWith('.pdf')
        // UMBRAL ÚNICO: cualquier PDF >5MB usa el pipeline batched
        // (procesa por lotes, OCR automático si el PDF es escaneado).
        // PDFs <=5MB van por el camino simple (Storage → server con pdf-parse).
        const isBig = selectedFile.size > 5 * 1024 * 1024
        const isHuge = selectedFile.size > 5 * 1024 * 1024

        // ── PDFs MUY grandes (>40MB): procesar por lotes de 50 páginas e ingerir cada lote ─
        if (isPdf && isHuge) {
          const sizeMB = Math.round(selectedFile.size / 1024 / 1024)
          setUploadProgress(`PDF grande (${sizeMB} MB) — se procesará por lotes...`)
          try {
            const locale = typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es'
            const result = await extractAndIngestPdfBatched(
              selectedFile, form.titulo, form.tipo, form.descripcion, setUploadProgress, locale
            )
            toast.success(`${result.chunksIndexados} fragmentos indexados en ${result.partes} lotes`)
            setForm({ titulo: '', tipo: 'libro', descripcion: '', texto: '', url: '' })
            setSelectedFile(null)
            setShowForm(false)
            loadDocs()
          } catch (e: any) {
            toast.error('Error procesando PDF grande: ' + e.message)
          } finally {
            setUploading(false)
            setUploadProgress('')
          }
          return
        }

        if (isPdf && isBig) {
          // ── Archivos grandes (10-40MB): extraer texto en el navegador ──
          const sizeMB = Math.round(selectedFile.size / 1024 / 1024)
          setUploadProgress(`Archivo grande (${sizeMB} MB) — extrayendo texto localmente...`)
          try {
            const texto = await extractPdfTextInBrowser(selectedFile, setUploadProgress)
            if (!texto || texto.trim().length < 100) {
              throw new Error('No se pudo extraer texto del PDF. El archivo puede estar escaneado o protegido.')
            }
            body.texto = texto
            body.fileName = selectedFile.name
          } catch (pdfErr: any) {
            // Si pdfjs falla:
            //   • Si el archivo es <= 40MB → intentar subir a Storage (el bucket tolera 50MB)
            //   • Si el archivo es > 40MB → NO subir (fallaría seguro); mensaje claro al usuario
            console.warn('pdfjs falló:', pdfErr?.message)
            if (selectedFile.size > 40 * 1024 * 1024) {
              throw new Error(
                `No se pudo extraer texto en el navegador (PDF demasiado grande: ${sizeMB} MB) y Supabase Storage rechaza archivos >50MB. Opciones:\n` +
                `  1) Abrí el PDF en Adobe Reader → Ctrl+A → Ctrl+C → pegá en modo "Pegar texto"\n` +
                `  2) Convertilo a sections más chicas (ej: divide el PDF por capítulo)\n` +
                `  3) Usá modo "📋 Protocolo tabular" si tu PDF es una tabla de items\n` +
                `  4) Aumentá el límite del bucket "knowledge-base" en Supabase Storage Settings`
              )
            }
            setUploadProgress('Subiendo archivo a servidor...')
            const safeName = `${Date.now()}-${selectedFile.name.replace(/[^a-z0-9._-]/gi, '_')}`
            const { data: up, error: upErr } = await supabasePublic.storage
              .from('knowledge-base').upload(safeName, selectedFile, { upsert: false })
            if (upErr) throw new Error(`Error al subir: ${upErr.message}`)
            const { data: signed } = await supabasePublic.storage
              .from('knowledge-base').createSignedUrl(up.path, 60 * 60 * 24 * 7)
            body.storageUrl = signed?.signedUrl
            body.fileName = selectedFile.name
          }
        } else {
          // ── Archivos pequeños (<10MB): subir a Storage normal ────────────
          setUploadProgress('Subiendo archivo...')
          const safeName = `${Date.now()}-${selectedFile.name.replace(/[^a-z0-9._-]/gi, '_')}`
          const { data: up, error: upErr } = await supabasePublic.storage
            .from('knowledge-base').upload(safeName, selectedFile, { upsert: false })
          if (upErr) throw new Error(`Error al subir: ${upErr.message}`)
          const { data: signed } = await supabasePublic.storage
            .from('knowledge-base').createSignedUrl(up.path, 60 * 60 * 24 * 7)
          body.storageUrl = signed?.signedUrl
          body.fileName = selectedFile.name
        }
      } else if (inputMode === 'url') {
        body.sourceUrl = form.url.trim()
      } else if (inputMode === 'texto') {
        body.texto = form.texto
      } else if (inputMode === 'buscar' && libroSeleccionado) {
        body.sourceUrl = libroSeleccionado.url
        if (!form.titulo) body.titulo = libroSeleccionado.titulo
      }

      // Si el texto es muy grande, dividirlo en partes de 300KB
      // para no superar el límite de 4.5MB de Vercel por request
      const MAX_BODY_BYTES = 300 * 1024 // 300KB de texto por parte
      const textoCompleto: string | undefined = body.texto

      if (textoCompleto && new Blob([textoCompleto]).size > MAX_BODY_BYTES) {
        // Dividir en partes
        const partes: string[] = []
        let offset = 0
        while (offset < textoCompleto.length) {
          // Cortar en el siguiente punto/salto de línea para no romper frases
          let end = offset + MAX_BODY_BYTES
          if (end < textoCompleto.length) {
            const nextBreak = textoCompleto.indexOf('\n', end)
            if (nextBreak !== -1 && nextBreak - end < 2000) end = nextBreak
          }
          partes.push(textoCompleto.slice(offset, end))
          offset = end
        }

        let totalChunksIndexados = 0
        for (let i = 0; i < partes.length; i++) {
          setUploadProgress(`Indexando parte ${i + 1} de ${partes.length}...`)
          const partBody = {
            ...body,
            titulo: partes.length > 1 ? `${body.titulo} (Parte ${i + 1}/${partes.length})` : body.titulo,
            texto: partes[i],
          }
          const res = await fetch('/api/knowledge/ingest', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
            body: JSON.stringify(partBody),
          })
          let json: any
          try { json = await res.json() }
          catch { throw new Error(await res.text() || `Error HTTP ${res.status}`) }
          if (!res.ok) throw new Error(json.error || `Error en parte ${i + 1}`)
          totalChunksIndexados += json.chunks || 0
        }
        toast.success(`${totalChunksIndexados} fragmentos indexados en ${partes.length} partes`)
      } else {
        // Texto pequeño o no es texto → request único normal
        setUploadProgress('Indexando en el Cerebro IA... (puede tardar 1-3 min)')
        const res = await fetch('/api/knowledge/ingest', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify(body),
        })
        let json: any
        try { json = await res.json() }
        catch { throw new Error(await res.text() || `Error HTTP ${res.status}`) }
        if (!res.ok) throw new Error(json.error || 'Error al indexar')
        if (!json.success) throw new Error(json.error || 'El indexado falló')
        toast.success(`${json.chunks} fragmentos indexados correctamente`)
      }

      setShowForm(false)
      setForm({ titulo: '', tipo: 'libro', descripcion: '', texto: '', url: '' })
      setSelectedFile(null); setLibroSeleccionado(null)
      await loadDocs()
    } catch (e: any) { toast.error(e.message) }
    finally { setUploading(false); setUploadProgress('') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este documento?')) return
    await fetch('/api/knowledge/ingest', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
      body: JSON.stringify({ id, locale: localStorage.getItem('vanty_locale') || 'es' }),
    })
    toast.success('Documento eliminado')
    await loadDocs()
  }

  const docsAuto = documentos.filter(d => d.source_url?.startsWith('auto:'))
  const docsManual = documentos.filter(d => !d.source_url?.startsWith('auto:'))
  const totalChunks = documentos.reduce((a, d) => a + (d.total_chunks || 0), 0)

  return (
    <div className="space-y-4 w-full">

      {/* Header */}
      <div className={`rounded-2xl border p-4 md:p-5 ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200 shadow-sm'}`}>
        {/* Top row: icon + title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center flex-shrink-0">
            <Brain size={22} className="text-white" />
          </div>
          <div>
            <h2 className={`text-base md:text-lg font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('nav.cerebro')}</h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('ui.baseConocimiento')}</p>
          </div>
        </div>
        {/* Stats row: 3 equal columns */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('ui.documents'), value: documentos.length, color: 'text-sky-500' },
            { label: t('ui.fragments'), value: totalChunks.toLocaleString(), color: 'text-sky-500' },
            { label: 'Auto-aprendidos', value: docsAuto.length, color: 'text-sky-500' },
          ].map(s => (
            <div key={s.label} className={`text-center px-2 py-2 rounded-xl border ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`text-lg md:text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className={`text-[9px] md:text-[10px] font-bold leading-tight mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex rounded-2xl p-1.5 border gap-1.5 overflow-x-auto scrollbar-hide ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-200'}`}>
        <button onClick={() => setTab('aprender')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 md:px-4 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${tab === 'aprender'
            ? isDark ? 'bg-[#161b22] text-sky-400 shadow border border-[#30363d]' : 'bg-white text-sky-700 shadow border border-slate-200'
            : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
          <Sparkles size={13} />
          <span className="hidden sm:inline">{t('whatsapp.aprenderInternet')}</span>
          <span className="sm:hidden">Aprender</span>
        </button>
        <button onClick={() => setTab('diagnosticos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 md:px-4 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${tab === 'diagnosticos'
            ? isDark ? 'bg-[#161b22] text-sky-400 shadow border border-[#30363d]' : 'bg-white text-sky-700 shadow border border-slate-200'
            : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
          <Stethoscope size={13} />
          <span className="hidden sm:inline">CIE-11 / DSM-5</span>
          <span className="sm:hidden">CIE-11</span>
        </button>
        <button onClick={() => setTab('biblioteca')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 md:px-4 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${tab === 'biblioteca'
            ? isDark ? 'bg-[#161b22] text-sky-400 shadow border border-[#30363d]' : 'bg-white text-sky-700 shadow border border-slate-200'
            : isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
          <BookMarked size={13} />
          <span className="hidden sm:inline">Biblioteca ({documentos.length})</span>
          <span className="sm:hidden">Biblio ({documentos.length})</span>
        </button>
      </div>

      {/* ══ TAB: APRENDER ══ */}
      {activeTab === 'aprender' && (
        <div className="space-y-4">

          {/* Cómo funciona */}
          <div className={`rounded-2xl p-4 border ${isDark ? 'bg-sky-900/20 border-sky-800/30' : 'bg-sky-50 border-sky-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={16} className="text-sky-600" />
              <span className={`font-bold text-sm ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>{t('ui.comoFuncAuto')}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { Icon: Search,   t: 'Expande palabras clave', d: 'La IA genera 8-12 términos técnicos relacionados' },
                { Icon: Globe,    t: 'Busca en internet', d: 'Groq IA Web + PubMed + EuropePMC + OpenAlex + CORE + ERIC + CrossRef + BASE + Wikipedia + Semantic Scholar' },
                { Icon: Sparkles, t: 'Sintetiza con IA', d: 'Genera resumen clínico estructurado para ABA' },
                { Icon: Brain,    t: 'Indexa en el Cerebro', d: 'ARIA y todos los agentes ya saben ese tema' },
              ].map((s, i) => (
                <div key={i} className={`rounded-xl p-3 border ${isDark ? 'bg-[#161b22] border-sky-900/30' : 'bg-white border-sky-100'}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
                    <s.Icon size={16} />
                  </div>
                  <p className="text-xs font-bold text-sky-700">{s.t}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Input box */}
          <div className={`rounded-2xl border shadow-sm p-5 space-y-4 ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'}`}>

            {/* Selector keywords vs URL */}
            <div className={`flex gap-1 p-1 rounded-xl ${isDark ? 'bg-[#0d1117]' : 'bg-slate-100'}`}>
              <button onClick={() => setModoFuente('keywords')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${modoFuente === 'keywords' ? (isDark ? 'bg-[#161b22] shadow text-sky-400' : 'bg-white shadow text-sky-700') : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
                🔍 Palabras clave
              </button>
              <button onClick={() => setModoFuente('url')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${modoFuente === 'url' ? (isDark ? 'bg-[#161b22] shadow text-sky-400' : 'bg-white shadow text-sky-700') : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
                🌐 URL de página web
              </button>
            </div>

            {/* Keywords section */}
            {modoFuente === 'keywords' && (
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 block">
                  ¿Qué tema quieres que aprenda la IA?
                </label>
                <textarea
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  {...{placeholder: t('ui.search_resource')}}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-400"
                  rows={3}
                  disabled={aprendiendo}
                />
                <div>
                  <p className="text-[11px] font-bold text-slate-400 mb-2">Temas sugeridos:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {temasSugeridos.map(tema => (
                      <button key={tema} onClick={() => setKeywords(tema)} disabled={aprendiendo}
                        className="text-[11px] bg-slate-50 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 hover:border-sky-200 px-2.5 py-1 rounded-full transition">
                        {tema}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['completo', 'rapido'] as const).map(m => (
                    <button key={m} onClick={() => setModo(m)}
                      className={`flex-1 p-3 rounded-xl border text-left transition ${modo === m ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-500 hover:border-sky-200'}`}>
                      <p className="text-xs font-bold flex items-center gap-1.5">{m === 'completo' ? <><Sparkles size={12}/> Completo</> : <><Cpu size={12}/> Rápido</>}</p>
                      <p className={`text-[10px] mt-0.5 ${modo === m ? 'text-sky-200' : 'text-slate-400'}`}>
                        {m === 'completo' ? 'Más fuentes, más fragmentos, más rico' : 'Solo síntesis IA, más veloz'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* URL section */}
            {modoFuente === 'url' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 block">
                  URL de página web a aprender
                </label>
                <input
                  value={urlAprender}
                  onChange={e => setUrlAprender(e.target.value)}
                  placeholder="https://ejemplo.com/articulo-sobre-aba"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  disabled={aprendiendo}
                />
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
                  <p className="text-xs text-sky-700 font-bold mb-1">{t('ui.queTipoURLs')}</p>
                  <p className="text-[11px] text-sky-600">{t('ui.urlsPublicas')}</p>
                  <p className="text-[11px] text-sky-600">{t('ui.urlsOrg')}</p>
                  <p className="text-[11px] text-slate-400">{t('ui.urlsNoFuncionan')}</p>
                </div>
              </div>
            )}

            {/* Botón aprender */}
            <button
              onClick={modoFuente === 'url' ? handleAprenderUrl : handleAprender}
              disabled={aprendiendo || (modoFuente === 'keywords' ? !keywords.trim() : !urlAprender.trim())}
              className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition shadow-md">
              {aprendiendo
                ? <><Loader2 size={16} className="animate-spin" /> Aprendiendo desde internet...</>
                : <><Sparkles size={16} /> Aprender ahora</>}
            </button>
          </div>

          {/* Log */}
          {logAprender.length > 0 && (
            <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs space-y-1.5">
              <p className="text-slate-400 text-[10px] mb-2">{t('ui.real_time_progress')}</p>
              {logAprender.map((line, i) => (
                <p key={i} className={
                  line.startsWith('✅') ? 'text-emerald-400' :
                  line.startsWith('❌') ? 'text-red-400' :
                  line.startsWith('⚠️') ? 'text-amber-400' :
                  line.startsWith('🎉') ? 'text-sky-300 font-bold' :
                  'text-slate-300'
                }>{line}</p>
              ))}
              {aprendiendo && <p className="text-sky-400 animate-pulse">⟳ Procesando...</p>}
            </div>
          )}

          {/* Resultado */}
          {resultadoAprender && !aprendiendo && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={20} className="text-emerald-500" />
                <span className="font-bold text-emerald-800">{t('whatsapp.aprendizajeCompleto')}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { v: resultadoAprender.fuentes, l: 'Fuentes' },
                  { v: resultadoAprender.documentos, l: 'Documentos' },
                  { v: resultadoAprender.totalChunks, l: 'Fragmentos' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                    <p className="text-xl font-bold text-emerald-700">{s.v}</p>
                    <p className="text-[11px] text-slate-500">{s.l}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-emerald-700 bg-white rounded-xl px-3 py-2.5 border border-emerald-100">
                🤖 ARIA ya conoce sobre <strong>"{resultadoAprender.keywords}"</strong>. Prueba preguntarle ahora.
              </p>
              {resultadoAprender.terminos?.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold text-emerald-700 mb-1.5">{t('ui.terminosAprendidos')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {resultadoAprender.terminos.map((t: string, i: number) => (
                      <span key={i} className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Temas ya aprendidos */}
          {docsAuto.length > 0 && (
            <div className={`rounded-2xl border shadow-sm p-4 ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'}`}>
              <p className="text-xs font-bold text-slate-500 mb-3">
                Temas ya aprendidos por la IA ({docsAuto.length})
              </p>
              <div className="space-y-2">
                {docsAuto.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-sky-50 rounded-xl px-3 py-2 border border-sky-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(2,132,199,0.12)', color: '#0284c7' }}>
                        <Brain size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{doc.titulo.replace('[IA] ', '')}</p>
                        <p className="text-[10px] text-slate-400">{doc.total_chunks || 0} fragmentos · {new Date(doc.created_at).toLocaleDateString('es-ES')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {doc.procesado ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Clock size={13} className="text-amber-400" />}
                      <button onClick={() => handleDelete(doc.id)} className="p-1 text-slate-300 hover:text-red-400 transition">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: CIE-11 / DSM-5 ══ */}
      {activeTab === 'diagnosticos' && (
        <div className="space-y-4">
          <div className={`rounded-2xl p-4 border ${isDark ? 'bg-sky-900/20 border-sky-800/30' : 'bg-sky-50 border-sky-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏥</span>
              <span className={`font-bold text-sm ${isDark ? 'text-sky-300' : 'text-sky-800'}`}>Buscador de Diagnósticos — CIE-11 / DSM-5 / ICD-10</span>
            </div>
            <p className="text-xs text-sky-600">
              Busca por nombre, código CIE-11 (ej: <b>6A02</b>), ICD-10 (ej: <b>F84</b>), DSM-5 o sinónimo. Haz clic en los códigos para copiarlos directamente.
            </p>
          </div>
          <DiagnosticoBuscador />
        </div>
      )}

      {/* ══ TAB: BIBLIOTECA ══ */}
      {activeTab === 'biblioteca' && (
        <div className="space-y-4">
          <button onClick={() => setShowForm(v => !v)}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 text-sm transition">
            {showForm ? <><X size={16} /> {t('common.cancelar')}</> : <><Plus size={16} /> Agregar documento manualmente</>}
          </button>

          {showForm && (
            <div className={`rounded-2xl border shadow-sm p-5 space-y-4 ${isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'}`}>
              <p className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('ui.add_document')}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['archivo', 'url', 'texto', 'buscar'] as const).map(m => {
                  const icons: Record<string, string> = { archivo: '📎', url: '🔗', texto: '📝', buscar: '🔍' }
                  const labels: Record<string, string> = { archivo: 'Archivo PDF/TXT', url: 'URL', texto: 'Pegar texto', buscar: 'Buscar libro' }
                  return (
                    <button key={m} onClick={() => { setInputMode(m); setLibroSeleccionado(null) }}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${inputMode === m ? (isDark ? 'bg-sky-900/30 border-sky-700 text-sky-400' : 'bg-sky-100 border-sky-300 text-sky-700') : (isDark ? 'border-[#30363d] text-slate-500' : 'border-slate-200 text-slate-500 hover:border-sky-200')}`}>
                      <span className="text-lg block mb-0.5">{icons[m]}</span>{labels[m]}
                    </button>
                  )
                })}
              </div>

              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                {...{placeholder: t('ui.document_title')}}
                value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} />

              <div className="flex gap-2">
                {['libro', 'articulo', 'guia', 'protocolo'].map(t => (
                  <button key={t} onClick={() => setForm(p => ({ ...p, tipo: t }))}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-bold transition capitalize ${form.tipo === t ? 'bg-sky-600 text-white border-sky-600' : isDark ? 'border-[#30363d] text-slate-500' : 'border-slate-200 text-slate-500'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {inputMode === 'archivo' && (
                <div onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-sky-300 hover:bg-sky-50 transition">
                  <Upload size={20} className="text-slate-400 mx-auto mb-2" />
                  {selectedFile ? (
                    <div>
                      <p className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{selectedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                        {selectedFile.size > 10 * 1024 * 1024 && (
                          <span className="ml-2 text-sky-500 font-medium">{t('ui.extractaLocal')}</span>
                        )}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-slate-400">{t('whatsapp.clickPDF')}</p>
                      <p className="text-xs text-slate-300 mt-1">{t('ui.sinLimite')}</p>
                    </div>
                  )}
                  <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.md"
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) { setSelectedFile(f); if (!form.titulo) setForm(p => ({ ...p, titulo: f.name.replace(/\.[^.]+$/, '') })) }
                    }} />
                </div>
              )}
              {uploading && uploadProgress && (
                <div className={`rounded-xl px-4 py-3 mt-2 border ${isDark ? 'bg-sky-900/20 border-sky-800/40' : 'bg-sky-50 border-sky-200'}`}>
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-sky-500 flex-shrink-0" />
                    <p className="text-xs text-sky-700 font-medium">{uploadProgress}</p>
                  </div>
                </div>
              )}

              {inputMode === 'url' && (
                <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="https://drive.google.com/..."
                  value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} />
              )}

              {inputMode === 'texto' && (
                <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none"
                  {...{placeholder: t('ui.paste_content')}}
                  rows={6} value={form.texto} onChange={e => setForm(p => ({ ...p, texto: e.target.value }))} />
              )}

              {inputMode === 'buscar' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
                      {...{placeholder: t('ui.search_book')}} value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && buscarLibros()} />
                    <button onClick={buscarLibros} disabled={buscando}
                      className="px-4 bg-sky-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                      {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {resultadosBusqueda.map(libro => (
                      <div key={libro.id}
                        onClick={() => { setLibroSeleccionado(libro); setForm(p => ({ ...p, titulo: libro.titulo })) }}
                        className={`p-3 rounded-xl border cursor-pointer transition ${libroSeleccionado?.id === libro.id ? (isDark ? 'bg-sky-900/20 border-sky-700' : 'bg-sky-50 border-sky-300') : (isDark ? 'border-[#21262d] hover:border-sky-800' : 'border-slate-200 hover:border-sky-200')}`}>
                        <p className="font-semibold text-slate-800 text-xs truncate">{libro.titulo}</p>
                        <p className="text-[10px] text-slate-500">{libro.autor} · {libro.fuente} · {libro.formato}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none"
                placeholder={t('ui.paste_content')} rows={2}
                value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />

              <button onClick={handleUpload} disabled={uploading}
                className="w-full py-3 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-sky-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {uploading
                  ? <><Loader2 size={14} className="animate-spin" /> {uploadProgress || 'Procesando...'}</>
                  : <><Save size={14} /> Indexar en el Cerebro</>}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-sky-400" /></div>
          ) : documentos.length === 0 ? (
            <div className={`rounded-2xl border border-dashed p-10 text-center ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}>
              <Brain size={32} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-semibold">{t('recursos.bibliotecaVacia')}</p>
              <p className="text-slate-400 text-sm mt-1">Usa "{t('whatsapp.aprenderInternet')}" para empezar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docsManual.length > 0 && (
                <p className="text-xs font-bold text-slate-400 px-1">
                  Subidos manualmente ({docsManual.length})
                </p>
              )}
              {docsManual.map(doc => (
                <DocCard key={doc.id} doc={doc} onDelete={handleDelete} onRetry={handleRetry} />
              ))}
              {docsAuto.length > 0 && (
                <p className="text-xs font-bold text-slate-400 px-1 pt-2">
                  Auto-aprendidos ({docsAuto.length})
                </p>
              )}
              {docsAuto.map(doc => (
                <DocCard key={doc.id} doc={doc} onDelete={handleDelete} onRetry={handleRetry} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DocCard({ doc, onDelete, onRetry }: {
  doc: any
  onDelete: (id: string) => void | Promise<void>
  onRetry?: (id: string) => void | Promise<void>
  key?: any
}) {
  const { t } = useI18n()
  const { isDark } = useTheme()
  const isAuto = doc.source_url?.startsWith('auto:')
  return (
    <div className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 transition ${isDark ? 'bg-[#161b22] border-[#21262d] hover:border-[#30363d]' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isAuto ? 'bg-sky-100' : 'bg-slate-100'}`}>
          {isAuto
            ? <Sparkles size={16} className="text-sky-600" />
            : <FileText size={16} className="text-slate-500" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{doc.titulo.replace('[IA] ', '')}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${isAuto ? (isDark ? 'bg-sky-900/30 text-sky-400' : 'bg-sky-100 text-sky-600') : (isDark ? 'bg-[#21262d] text-slate-500' : 'bg-slate-100 text-slate-500')}`}>
              {isAuto ? 'auto' : doc.tipo}
            </span>
            <span className="text-[10px] text-slate-400">{doc.total_chunks || 0} fragmentos</span>
            <span className="text-[10px] text-slate-400">{new Date(doc.created_at).toLocaleDateString('es-ES')}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {doc.procesado && doc.total_chunks > 0 ? (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
            <CheckCircle2 size={12} />{t('ui.ready')}
          </span>
        ) : doc.procesado && doc.total_chunks === 0 ? (
          <button onClick={() => onRetry?.(doc.id)}
            className="flex items-center gap-1 text-[10px] text-red-500 font-bold hover:underline">
            <RefreshCw size={11} />{t('ui.reindex')}
          </button>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-amber-500 font-bold">
            <Clock size={12} />{t('ui.pending_status')}
          </span>
        )}
        <button onClick={() => onDelete(doc.id)}
          className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
