'use client'
import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
import {
  Upload, BookOpen, Trash2, CheckCircle2, Clock, Loader2,
  FileText, File, Plus, X, Brain, Database, Zap, AlertTriangle, Save, Link
} from 'lucide-react'
import { useToast } from '@/components/Toast'

// Modos de ingesta
type InputMode = 'archivo' | 'url' | 'texto'

export default function KnowledgeBaseView() {
  const toast = useToast()
  const { t } = useI18n()
  const [documentos, setDocumentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showInstrucciones, setShowInstrucciones] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({ titulo: '', tipo: 'libro', descripcion: '', texto: '', url: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  // ✅ NUEVO: modo de entrada
  const [inputMode, setInputMode] = useState<InputMode>('archivo')

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

  const handleUpload = async () => {
    if (!form.titulo) { toast.error('El título es requerido'); return }

    // Validar según modo
    if (inputMode === 'archivo' && !selectedFile) { toast.error('Selecciona un archivo'); return }
    if (inputMode === 'url' && !form.url.trim()) { toast.error('Ingresa una URL válida'); return }
    if (inputMode === 'texto' && !form.texto.trim()) { toast.error('Pega el contenido del documento'); return }

    // Validar URL básica
    if (inputMode === 'url') {
      try { new URL(form.url) } catch {
        toast.error('La URL no es válida. Ejemplo: https://drive.google.com/...')
        return
      }
    }

    setUploading(true)
    try {
      let body: Record<string, any> = {
        titulo: form.titulo,
        tipo: form.tipo,
        descripcion: form.descripcion,
      }

      // ── Modo: Archivo ────────────────────────────────────────────────────
      if (inputMode === 'archivo' && selectedFile) {
        const MAX_SIZE = 100 * 1024 * 1024
        if (selectedFile.size > MAX_SIZE) {
          toast.error(`Archivo muy grande (${Math.round(selectedFile.size / 1024 / 1024)}MB). Máx: 100MB. Usá el modo URL en su lugar.`)
          return
        }
        setUploadProgress(`Subiendo archivo (${Math.round(selectedFile.size / 1024 / 1024)}MB)...`)
        const safeName = `knowledge/${Date.now()}_${selectedFile.name.replace(/\s+/g, '_')}`

        const { error: uploadError } = await supabasePublic.storage
          .from('knowledge-base')
          .upload(safeName, selectedFile, { contentType: selectedFile.type, upsert: false })

        if (uploadError) throw new Error(`Error al subir: ${uploadError.message}`)

        const { data: signedData, error: signedError } = await supabasePublic.storage
          .from('knowledge-base')
          .createSignedUrl(safeName, 3600)

        if (signedError || !signedData?.signedUrl) throw new Error('No se pudo obtener la URL del archivo')

        body.storageUrl = signedData.signedUrl
        body.fileName = selectedFile.name
        setUploadProgress('Extrayendo texto...')
      }

      // ── Modo: URL ────────────────────────────────────────────────────────
      if (inputMode === 'url') {
        setUploadProgress('Descargando y procesando URL...')
        body.sourceUrl = form.url.trim()
      }

      // ── Modo: Texto ──────────────────────────────────────────────────────
      if (inputMode === 'texto') {
        body.texto = form.texto
      }

      const res = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (json.error) throw new Error(json.error)

      toast.success(`✅ "${form.titulo}" recibido — indexando en background`)
      setForm({ titulo: '', tipo: 'libro', descripcion: '', texto: '', url: '' })
      setSelectedFile(null)
      setUploadProgress('')
      setInputMode('archivo')
      setShowForm(false)
      setTimeout(loadDocs, 3000)
    } catch (e: any) {
      setUploadProgress('')
      toast.error(e.message)
    } finally { setUploading(false) }
  }

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar "${titulo}" de la base de conocimiento?`)) return
    try {
      await fetch('/api/knowledge/ingest', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      toast.success('Documento eliminado')
      loadDocs()
    } catch { toast.error('Error eliminando') }
  }

  const stats = {
    total: documentos.length,
    procesados: documentos.filter(d => d.procesado).length,
    chunks: documentos.reduce((a, d) => a + (d.total_chunks || 0), 0),
  }

  const tipoConfig: Record<string, { emoji: string; label: string; color: string }> = {
    libro:    { emoji: '📗', label: 'Libro', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    protocolo:{ emoji: '📋', label: 'Protocolo', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    guia:     { emoji: '🧭', label: 'Guía', color: 'bg-violet-50 text-violet-700 border-violet-200' },
    programa: { emoji: '🎯', label: 'Programa', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    centro:   { emoji: '🏥', label: 'Del centro', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  }

  const modoConfig: { id: InputMode; label: string; icon: any; desc: string }[] = [
    { id: 'archivo', label: 'Archivo', icon: Upload,   desc: 'PDF, TXT, MD (hasta 100MB)' },
    { id: 'url',     label: 'URL',     icon: Link,     desc: 'Google Drive, Dropbox, web' },
    { id: 'texto',   label: 'Texto',   icon: FileText, desc: 'Pegar contenido directo' },
  ]

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-black text-2xl text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-violet-100 rounded-2xl">
              <Brain className="text-violet-600" size={24} />
            </div>
            Cerebro de ARIA
          </h2>
          <p className="text-slate-400 text-sm mt-1">Base de conocimiento clínico que usa la IA en cada análisis</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInstrucciones(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-violet-400 hover:text-violet-600 transition-all">
            <Zap size={14} /> Instrucciones del centro
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 transition-all shadow-lg shadow-violet-200">
            <Plus size={14} /> Agregar documento
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Documentos', value: stats.total, icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Procesados', value: stats.procesados, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Fragmentos indexados', value: stats.chunks.toLocaleString(), icon: Database, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4`}>
            <s.icon size={20} className={`${s.color} mb-2`} />
            <p className={`font-black text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex gap-3">
        <Brain size={18} className="text-violet-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-black text-violet-800 text-sm">¿Cómo funciona?</p>
          <p className="text-violet-700 text-xs mt-0.5 leading-relaxed">
            Cada documento que subas se fragmenta y convierte en vectores semánticos. Cuando ARIA responde una consulta, busca automáticamente los fragmentos más relevantes y los incluye en su razonamiento. Cuanto más documentos indexes, más precisa y fundamentada será la IA.
          </p>
        </div>
      </div>

      {/* Lista de documentos */}
      {loading ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Loader2 className="animate-spin text-violet-400" size={28} />
          <p className="text-slate-400 text-sm">Cargando base de conocimiento...</p>
        </div>
      ) : documentos.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-14 text-center">
          <div className="w-14 h-14 bg-violet-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <BookOpen size={26} className="text-violet-300" />
          </div>
          <p className="font-bold text-slate-500 mb-1">Base de conocimiento vacía</p>
          <p className="text-xs text-slate-300 mb-4">Sube los libros y protocolos que usa tu centro</p>
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700">
            Subir primer documento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {documentos.map(doc => {
            const tipo = tipoConfig[doc.tipo] || tipoConfig.libro
            return (
              <div key={doc.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 hover:border-violet-100 transition-all">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl shrink-0 border">
                  {tipo.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-800 text-sm">{doc.titulo}</p>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${tipo.color}`}>{tipo.label}</span>
                    {doc.source_url && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1">
                        <Link size={8} /> URL
                      </span>
                    )}
                  </div>
                  {doc.descripcion && <p className="text-xs text-slate-400 mt-0.5 truncate">{doc.descripcion}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {doc.procesado ? (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                        <CheckCircle2 size={10} /> {doc.total_chunks} fragmentos indexados
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" /> Indexando...
                      </span>
                    )}
                    <span className="text-[10px] text-slate-300">
                      {new Date(doc.created_at).toLocaleDateString('es-PE')}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleDelete(doc.id, doc.titulo)}
                  className="p-2 text-slate-300 hover:text-red-400 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Agregar documento */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-black text-lg text-slate-800">Agregar a la base de conocimiento</h3>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-full hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">Título *</label>
                  <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="ej: Principios de Conducta - Malott 8va Ed."
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-violet-400" />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tipoConfig).map(([k, v]) => (
                      <button key={k} onClick={() => setForm(f => ({ ...f, tipo: k }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          form.tipo === k ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200'
                        }`}>
                        {v.emoji} {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">Descripción</label>
                  <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Breve descripción del contenido"
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-violet-400" />
                </div>

                {/* ── Selector de modo de entrada ── */}
                <div>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">Fuente del documento</label>
                  <div className="grid grid-cols-3 gap-2">
                    {modoConfig.map(m => (
                      <button key={m.id} onClick={() => setInputMode(m.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          inputMode === m.id
                            ? 'border-violet-500 bg-violet-50 text-violet-700'
                            : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                        }`}>
                        <m.icon size={18} />
                        <span className="text-xs font-black">{m.label}</span>
                        <span className="text-[10px] leading-tight">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Modo: Archivo ── */}
                {inputMode === 'archivo' && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-violet-300 transition-all cursor-pointer"
                    onClick={() => fileRef.current?.click()}>
                    <input ref={fileRef} type="file" accept=".pdf,.txt,.md" className="hidden"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                    {selectedFile ? (
                      <div className="flex items-center gap-3 justify-center">
                        <FileText size={20} className="text-violet-500" />
                        <span className="font-bold text-slate-700 text-sm">{selectedFile.name}</span>
                        <button onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                          className="text-slate-300 hover:text-red-400"><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-500 text-sm">Arrastra un PDF o haz clic</p>
                        <p className="text-xs text-slate-300 mt-1">PDF, TXT o Markdown · Hasta 100MB</p>
                      </>
                    )}
                  </div>
                )}

                {/* ── Modo: URL ── */}
                {inputMode === 'url' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={form.url}
                        onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                        placeholder="https://drive.google.com/file/d/... o cualquier URL pública"
                        className="w-full pl-9 pr-3 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-violet-400"
                      />
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                      <p className="text-xs font-black text-blue-700 mb-1">📎 URLs compatibles</p>
                      <ul className="text-xs text-blue-600 space-y-0.5">
                        <li>• <strong>Google Drive:</strong> compartir → "Cualquier persona con el enlace"</li>
                        <li>• <strong>Dropbox:</strong> usar enlace directo (dl=1)</li>
                        <li>• <strong>Web pública:</strong> cualquier página HTML o PDF online</li>
                        <li>• <strong>Archive.org, libgen, etc.</strong></li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* ── Modo: Texto ── */}
                {inputMode === 'texto' && (
                  <textarea value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))}
                    rows={6} placeholder="Pega aquí el contenido del documento..."
                    className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm resize-none outline-none focus:border-violet-400" />
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">El indexado puede tardar 2-5 minutos para libros largos. Puedes cerrar esta ventana — el proceso continúa en background.</p>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-3 text-slate-400 font-bold border-2 border-slate-100 rounded-xl">{t('common.cancelar')}</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="flex-[2] py-3 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? (uploadProgress || 'Procesando...') : 'Subir e Indexar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInstrucciones && <InstruccionesModal onClose={() => setShowInstrucciones(false)} />}
    </div>
  )
}

function InstruccionesModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [instrucciones, setInstrucciones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nueva, setNueva] = useState({ categoria: 'protocolo', titulo: '', contenido: '', prioridad: 5 })

  useEffect(() => {
    fetch('/api/knowledge/instrucciones')
      .then(r => r.json())
      .then(d => setInstrucciones(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!nueva.titulo || !nueva.contenido) { toast.error('Título y contenido son requeridos'); return }
    setSaving(true)
    try {
      await fetch('/api/knowledge/instrucciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      })
      toast.success('Instrucción guardada')
      setNueva({ categoria: 'protocolo', titulo: '', contenido: '', prioridad: 5 })
      const res = await fetch('/api/knowledge/instrucciones')
      const json = await res.json()
      setInstrucciones(json.data || [])
    } catch { toast.error('Error guardando') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="font-black text-lg text-slate-800">⚡ Instrucciones del Centro</h3>
              <p className="text-xs text-slate-400 mt-0.5">ARIA las incluye siempre en su contexto</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X size={18} /></button>
          </div>

          {loading ? <Loader2 className="animate-spin mx-auto" size={20} /> : (
            <div className="space-y-2 mb-5">
              {instrucciones.map((inst: any) => (
                <div key={inst.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">{inst.categoria}</span>
                    <span className="font-bold text-slate-700 text-sm">{inst.titulo}</span>
                    <span className="ml-auto text-[10px] text-slate-300">P: {inst.prioridad}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{inst.contenido}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">+ Nueva instrucción</p>
            <div className="grid grid-cols-2 gap-3">
              <select value={nueva.categoria} onChange={e => setNueva(n => ({ ...n, categoria: e.target.value }))}
                className="p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-violet-400">
                <option value="protocolo">Protocolo</option>
                <option value="estilo">Estilo de comunicación</option>
                <option value="terminologia">Terminología</option>
                <option value="regla">Regla clínica</option>
              </select>
              <input type="number" min="1" max="10" value={nueva.prioridad}
                onChange={e => setNueva(n => ({ ...n, prioridad: Number(e.target.value) }))}
                className="p-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-violet-400"
                placeholder="Prioridad 1-10" />
            </div>
            <input value={nueva.titulo} onChange={e => setNueva(n => ({ ...n, titulo: e.target.value }))}
              placeholder="ej: Criterio de dominio estándar"
              className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-violet-400" />
            <textarea value={nueva.contenido} onChange={e => setNueva(n => ({ ...n, contenido: e.target.value }))}
              rows={3} placeholder="Instrucción que ARIA debe seguir siempre..."
              className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm resize-none outline-none focus:border-violet-400" />
            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar instrucción
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
