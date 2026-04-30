'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, FileText, Image, File, Trash2, Download,
  Eye, EyeOff, Plus, Loader2, X, Search, Filter,
  FolderOpen, CheckCircle, AlertCircle, ExternalLink
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

// ── Types ───────────────────────────────────────────────────────────────────
interface Doc {
  id: string
  child_id: string
  uploaded_by: string
  uploader_role: string
  uploader_name: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  category: string
  description: string | null
  visible_to_parent: boolean
  created_at: string
}

const CATEGORIES = [
  { id: 'all',           label: 'Todos',           emoji: '📁' },
  { id: 'tarea',         label: 'Tarea',            emoji: '📝' },
  { id: 'informe',       label: 'Informe',          emoji: '📄' },
  { id: 'evaluacion',    label: 'Evaluación',       emoji: '🔬' },
  { id: 'consentimiento',label: 'Consentimiento',   emoji: '✍️' },
  { id: 'foto',          label: 'Foto / imagen',    emoji: '🖼️' },
  { id: 'general',       label: 'General',          emoji: '📂' },
  { id: 'otro',          label: 'Otro',             emoji: '📎' },
]

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', image: '🖼️', word: '📝', excel: '📊', other: '📎'
}

function fileTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['doc','docx'].includes(ext)) return 'word'
  if (['xls','xlsx','csv'].includes(ext)) return 'excel'
  return 'other'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Main Component ──────────────────────────────────────────────────────────
interface DocumentosViewProps {
  childId: string
  childName: string
  currentRole: 'jefe' | 'admin' | 'especialista' | 'terapeuta' | 'padre'
  isDark?: boolean
}

export default function DocumentosView({ childId, childName, currentRole, isDark = false }: DocumentosViewProps) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [docs, setDocs]           = useState<Doc[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)

  // Upload form state
  const [newCat, setNewCat]       = useState('general')
  const [otroLabel, setOtroLabel] = useState('')
  const [newDesc, setNewDesc]     = useState('')
  const [visibleParent, setVisibleParent] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging]       = useState(false)

  const canUpload = ['jefe','admin','especialista','terapeuta','padre'].includes(currentRole)
  const canDelete = ['jefe','admin','especialista'].includes(currentRole)
  const canToggleVisibility = ['jefe','admin','especialista'].includes(currentRole)
  const isPadre = currentRole === 'padre'

  // Color helpers
  const card    = isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'
  const txt1    = isDark ? 'text-slate-100' : 'text-slate-800'
  const txt3    = isDark ? 'text-slate-500' : 'text-slate-400'
  const inputCls = isDark
    ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600 focus:border-blue-500'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400'

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('patient_documents')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })

      if (isPadre) q = q.eq('visible_to_parent', true)

      const { data, error } = await q
      if (error) throw error
      setDocs(data || [])
    } catch (e: any) {
      toast.error('Error cargando documentos: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [childId, isPadre])

  useEffect(() => { loadDocs() }, [loadDocs])

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) { toast.error('Selecciona al menos un archivo'); return }
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user.id).single()

      let uploaded = 0
      for (const file of selectedFiles) {
        const path = `${childId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

        const { error: upErr } = await supabase.storage
          .from('patient-documents')
          .upload(path, file, { upsert: false })
        if (upErr) throw upErr

        const { data: { publicUrl } } = supabase.storage.from('patient-documents').getPublicUrl(path)

        const { error: dbErr } = await supabase.from('patient_documents').insert({
          child_id:         childId,
          uploaded_by:      user.id,
          uploader_role:    profile?.role || currentRole,
          uploader_name:    profile?.full_name || 'Usuario',
          file_name:        file.name,
          file_url:         publicUrl,
          file_type:        fileTypeFromName(file.name),
          file_size:        file.size,
          category:         newCat === 'otro' && otroLabel.trim() ? otroLabel.trim() : newCat,
          description:      newDesc.trim() || null,
          visible_to_parent: visibleParent,
        })
        if (dbErr) throw dbErr
        uploaded++
      }

      toast.success(`✅ ${uploaded} documento${uploaded > 1 ? 's subidos' : ' subido'} correctamente`)
      setShowUpload(false)
      setSelectedFiles([])
      setNewDesc('')
      setNewCat('general')
      setOtroLabel('')
      loadDocs()
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (doc: Doc) => {
    if (!confirm(`¿Eliminar "${doc.file_name}"?`)) return
    try {
      await supabase.from('patient_documents').delete().eq('id', doc.id)
      toast.success('Documento eliminado')
      setDocs(prev => prev.filter(d => d.id !== doc.id))
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    }
  }

  const toggleVisibility = async (doc: Doc) => {
    try {
      await supabase.from('patient_documents')
        .update({ visible_to_parent: !doc.visible_to_parent })
        .eq('id', doc.id)
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, visible_to_parent: !d.visible_to_parent } : d))
    } catch (e: any) {
      toast.error('Error: ' + e.message)
    }
  }

  const filtered = docs.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase()) ||
      d.uploader_name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || d.category === catFilter
    return matchSearch && matchCat
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`font-black text-base ${txt1}`}>
            <FolderOpen size={16} className="inline mr-2 text-blue-500" />
            Documentos
          </h3>
          <p className={`text-xs mt-0.5 ${txt3}`}>
            {isPadre ? 'Documentos compartidos de tu hijo/a' : `Archivos y documentos de ${childName}`}
          </p>
        </div>
        {canUpload && (
          <button onClick={() => setShowUpload(!showUpload)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm">
            <Plus size={14} /> Subir documento
          </button>
        )}
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className={`${card} border rounded-2xl p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <p className={`text-sm font-black ${txt1}`}>Subir nuevo documento</p>
            <button onClick={() => { setShowUpload(false); setSelectedFiles([]) }}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}`}>
              <X size={14} className={txt3} />
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${isDragging
                ? isDark ? 'border-blue-500 bg-blue-900/20' : 'border-blue-400 bg-blue-50'
                : isDark ? 'border-[#30363d] hover:border-blue-700 hover:bg-blue-900/10' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }`}>
            <Upload size={28} className={`mx-auto mb-2 ${isDragging ? 'text-blue-500' : txt3}`} />
            <p className={`text-sm font-bold ${txt1}`}>
              {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
            </p>
            <p className={`text-xs mt-1 ${txt3}`}>PDF, imágenes, Word, Excel — varios a la vez — máx. 20MB c/u</p>
          </div>
          <input ref={fileRef} type="file" className="hidden" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mp3"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />

          {/* Selected files list */}
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {selectedFiles.map((f, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                  ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-base">{FILE_ICONS[fileTypeFromName(f.name)]}</span>
                  <span className={`flex-1 truncate font-medium ${txt1}`}>{f.name}</span>
                  <span className={txt3}>{formatSize(f.size)}</span>
                  <button onClick={() => removeFile(i)} className={`ml-1 p-0.5 rounded hover:text-red-400 ${txt3}`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Categoría */}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${txt3}`}>Categoría</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <button key={c.id} onClick={() => setNewCat(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all
                    ${newCat === c.id
                      ? 'bg-blue-600 text-white'
                      : isDark ? 'bg-[#21262d] text-slate-400 hover:bg-[#30363d]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            {/* Texto personalizado cuando se selecciona "Otro" */}
            {newCat === 'otro' && (
              <input
                autoFocus
                value={otroLabel}
                onChange={e => setOtroLabel(e.target.value)}
                placeholder="Escribe el nombre de la categoría..."
                className={`mt-2 w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all ${inputCls}`}
              />
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${txt3}`}>Descripción (opcional)</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Ej: Tarea de la semana 3..."
              className={`w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all ${inputCls}`} />
          </div>

          {/* Visibilidad para padres — solo clínicos */}
          {!isPadre && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setVisibleParent(!visibleParent)}
                className={`w-10 h-5 rounded-full transition-all relative ${visibleParent ? 'bg-blue-600' : isDark ? 'bg-[#30363d]' : 'bg-slate-200'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${visibleParent ? 'left-5' : 'left-0.5'}`} />
              </div>
              <span className={`text-sm ${txt1}`}>Visible para la familia</span>
            </label>
          )}

          <button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading
              ? 'Subiendo...'
              : selectedFiles.length > 0
                ? `Subir ${selectedFiles.length} archivo${selectedFiles.length > 1 ? 's' : ''}`
                : 'Subir documento'}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-white border-slate-200'}`}>
          <Search size={14} className={txt3} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, descripción..."
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-slate-300 placeholder:text-slate-600' : 'text-slate-700'}`} />
        </div>
        {/* Category filter */}
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className={`px-3 py-2 rounded-xl text-sm border-2 outline-none ${isDark ? 'bg-[#0d1117] border-[#30363d] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${card} border rounded-2xl p-10 text-center`}>
          <FolderOpen size={36} className={`mx-auto mb-3 ${txt3}`} />
          <p className={`font-black text-sm ${txt3}`}>
            {docs.length === 0 ? 'Sin documentos aún' : 'Sin resultados'}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            {docs.length === 0 && canUpload ? 'Sube el primer documento usando el botón de arriba' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id}
              className={`${card} border rounded-xl p-4 flex items-center gap-3 group transition-all hover:shadow-sm`}>
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg
                ${isDark ? 'bg-[#21262d]' : 'bg-slate-50'}`}>
                {FILE_ICONS[doc.file_type] || '📎'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-bold truncate ${txt1}`}>{doc.file_name}</p>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                    ${isDark ? 'bg-[#21262d] text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                    {CATEGORIES.find(c => c.id === doc.category)?.emoji} {doc.category}
                  </span>
                  {!doc.visible_to_parent && !isPadre && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full
                      ${isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                      🔒 Solo clínico
                    </span>
                  )}
                </div>
                {doc.description && (
                  <p className={`text-xs mt-0.5 truncate ${txt3}`}>{doc.description}</p>
                )}
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {doc.uploader_name} · {formatDate(doc.created_at)} · {formatSize(doc.file_size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Download/View */}
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  title="Ver / descargar">
                  <ExternalLink size={14} />
                </a>

                {/* Toggle parent visibility */}
                {canToggleVisibility && (
                  <button onClick={() => toggleVisibility(doc)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}
                      ${doc.visible_to_parent ? 'text-emerald-500' : txt3}`}
                    title={doc.visible_to_parent ? 'Ocultar a familia' : 'Mostrar a familia'}>
                    {doc.visible_to_parent ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}

                {/* Delete */}
                {(canDelete || doc.uploaded_by === undefined) && (
                  <button onClick={() => handleDelete(doc)}
                    className={`p-2 rounded-lg transition-colors text-red-400 ${isDark ? 'hover:bg-red-900/20' : 'hover:bg-red-50'}`}
                    title="Eliminar">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
