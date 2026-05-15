'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, FileText, Image, File, Trash2, Download,
  Eye, EyeOff, Plus, Loader2, X, Search, Filter,
  FolderOpen, CheckCircle, AlertCircle, ExternalLink,
  Folder, FolderPlus, ChevronRight, Home, MoreVertical,
  Edit2, Move, FolderInput
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

interface Carpeta {
  id: string
  name: string
  emoji: string
  createdAt: string
  parentId: string | null
}

interface FolderState {
  carpetas: Carpeta[]
  docFolder: Record<string, string | null> // docId -> carpetaId | null (raíz)
}

const EMOJIS_FOLDER = ['📁','📂','🗂️','📋','📌','🗒️','🔖','📎','🏷️','💼','🗃️','📦']

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

function useFolderState(childId: string) {
  const key = `docs_folders_${childId}`
  const [state, setState] = useState<FolderState>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : { carpetas: [], docFolder: {} }
    } catch { return { carpetas: [], docFolder: {} } }
  })

  const save = (next: FolderState) => {
    setState(next)
    localStorage.setItem(key, JSON.stringify(next))
  }

  const crearCarpeta = (name: string, emoji: string, parentId: string | null) => {
    const nueva: Carpeta = { id: Date.now().toString(), name, emoji, createdAt: new Date().toISOString(), parentId }
    save({ ...state, carpetas: [...state.carpetas, nueva] })
  }

  const renombrarCarpeta = (id: string, name: string, emoji: string) => {
    save({ ...state, carpetas: state.carpetas.map(c => c.id === id ? { ...c, name, emoji } : c) })
  }

  const eliminarCarpeta = (id: string) => {
    // Move docs in deleted folder to root
    const newDocFolder = { ...state.docFolder }
    Object.keys(newDocFolder).forEach(docId => {
      if (newDocFolder[docId] === id) newDocFolder[docId] = null
    })
    // Also delete sub-carpetas
    const toDelete = new Set<string>()
    const collect = (pid: string) => {
      toDelete.add(pid)
      state.carpetas.filter(c => c.parentId === pid).forEach(c => collect(c.id))
    }
    collect(id)
    save({ carpetas: state.carpetas.filter(c => !toDelete.has(c.id)), docFolder: newDocFolder })
  }

  const moverDoc = (docId: string, carpetaId: string | null) => {
    save({ ...state, docFolder: { ...state.docFolder, [docId]: carpetaId } })
  }

  return { state, crearCarpeta, renombrarCarpeta, eliminarCarpeta, moverDoc }
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

  // Folder navigation
  const { state: fs, crearCarpeta, renombrarCarpeta, eliminarCarpeta, moverDoc } = useFolderState(childId)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null) // null = raíz
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderEmoji, setNewFolderEmoji] = useState('📁')
  const [editingFolder, setEditingFolder] = useState<Carpeta | null>(null)
  const [movingDoc, setMovingDoc] = useState<Doc | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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

  const card    = isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200'
  const cardHover = isDark ? 'hover:bg-[#1c2128]' : 'hover:bg-slate-50'
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

  // Close menus on outside click
  useEffect(() => {
    const handler = () => setOpenMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))]
    })
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) { toast.error('Selecciona al menos un archivo'); return }
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user.id).single()

      let uploaded = 0
      const newIds: string[] = []
      for (const file of selectedFiles) {
        const path = `${childId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const { error: upErr } = await supabase.storage.from('patient-documents').upload(path, file, { upsert: false })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('patient-documents').getPublicUrl(path)
        const { data: inserted, error: dbErr } = await supabase.from('patient_documents').insert({
          child_id: childId, uploaded_by: user.id,
          uploader_role: profile?.role || currentRole,
          uploader_name: profile?.full_name || 'Usuario',
          file_name: file.name, file_url: publicUrl,
          file_type: fileTypeFromName(file.name), file_size: file.size,
          category: newCat === 'otro' && otroLabel.trim() ? otroLabel.trim() : newCat,
          description: newDesc.trim() || null, visible_to_parent: visibleParent,
        }).select('id').single()
        if (dbErr) throw dbErr
        if (inserted?.id && currentFolder) newIds.push(inserted.id)
        uploaded++
      }
      // Assign to current folder
      if (currentFolder && newIds.length > 0) {
        const newDocFolder = { ...fs.docFolder }
        newIds.forEach(id => { newDocFolder[id] = currentFolder })
        // we need to update through moverDoc for each
        newIds.forEach(id => moverDoc(id, currentFolder))
      }
      toast.success(`✅ ${uploaded} documento${uploaded > 1 ? 's subidos' : ' subido'} correctamente`)
      setShowUpload(false); setSelectedFiles([]); setNewDesc(''); setNewCat('general'); setOtroLabel('')
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
    } catch (e: any) { toast.error('Error: ' + e.message) }
  }

  const toggleVisibility = async (doc: Doc) => {
    try {
      await supabase.from('patient_documents').update({ visible_to_parent: !doc.visible_to_parent }).eq('id', doc.id)
      setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, visible_to_parent: !d.visible_to_parent } : d))
    } catch (e: any) { toast.error('Error: ' + e.message) }
  }

  // Build breadcrumb path
  const buildPath = (folderId: string | null): Carpeta[] => {
    if (!folderId) return []
    const folder = fs.carpetas.find(c => c.id === folderId)
    if (!folder) return []
    return [...buildPath(folder.parentId), folder]
  }
  const breadcrumb = buildPath(currentFolder)

  // Carpetas en la carpeta actual
  const subCarpetas = fs.carpetas.filter(c => c.parentId === currentFolder)

  // Docs en la carpeta actual (con filtros)
  const docsEnCarpeta = docs.filter(d => {
    const docCarpeta = fs.docFolder[d.id] ?? null
    return docCarpeta === currentFolder
  })
  const filtered = docsEnCarpeta.filter(d => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase()) ||
      d.uploader_name.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || d.category === catFilter
    return matchSearch && matchCat
  })

  // Count items for each sub-carpeta
  const countInFolder = (fid: string): number => {
    const subIds = new Set<string>()
    const collect = (pid: string) => {
      subIds.add(pid)
      fs.carpetas.filter(c => c.parentId === pid).forEach(c => collect(c.id))
    }
    collect(fid)
    const docCount = docs.filter(d => subIds.has(fs.docFolder[d.id] ?? '')).length
    const folderCount = fs.carpetas.filter(c => c.parentId === fid).length
    return docCount + folderCount
  }

  const handleCrearCarpeta = () => {
    if (!newFolderName.trim()) return
    crearCarpeta(newFolderName.trim(), newFolderEmoji, currentFolder)
    setNewFolderName(''); setNewFolderEmoji('📁'); setShowNewFolder(false)
    toast.success('📁 Carpeta creada')
  }

  const handleEditarCarpeta = () => {
    if (!editingFolder || !newFolderName.trim()) return
    renombrarCarpeta(editingFolder.id, newFolderName.trim(), newFolderEmoji)
    setEditingFolder(null); setNewFolderName(''); setNewFolderEmoji('📁')
    toast.success('Carpeta actualizada')
  }

  const isEmpty = subCarpetas.length === 0 && filtered.length === 0 && !search && catFilter === 'all'

  return (
    <div className="space-y-4" onClick={() => setOpenMenuId(null)}>

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
        <div className="flex items-center gap-2">
          {canUpload && (
            <button onClick={() => setShowNewFolder(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border
                ${isDark ? 'bg-[#21262d] border-[#30363d] text-slate-300 hover:bg-[#30363d]' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}>
              <FolderPlus size={14} /> Nueva carpeta
            </button>
          )}
          {canUpload && (
            <button onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm">
              <Plus size={14} /> Subir documento
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumb */}
      <div className={`flex items-center gap-1 text-xs flex-wrap`}>
        <button onClick={() => setCurrentFolder(null)}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-colors
            ${currentFolder === null
              ? 'bg-blue-600 text-white'
              : isDark ? 'text-slate-400 hover:bg-[#21262d]' : 'text-slate-500 hover:bg-slate-100'}`}>
          <Home size={11} /> Inicio
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight size={11} className={txt3} />
            <button onClick={() => setCurrentFolder(crumb.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold transition-colors
                ${currentFolder === crumb.id
                  ? 'bg-blue-600 text-white'
                  : isDark ? 'text-slate-400 hover:bg-[#21262d]' : 'text-slate-500 hover:bg-slate-100'}`}>
              {crumb.emoji} {crumb.name}
            </button>
          </span>
        ))}
      </div>

      {/* New Folder modal */}
      {(showNewFolder || editingFolder) && (
        <div className={`${card} border rounded-2xl p-4 space-y-3`}>
          <p className={`text-sm font-black ${txt1}`}>{editingFolder ? 'Editar carpeta' : 'Nueva carpeta'}</p>
          <div className="flex gap-2">
            {/* Emoji picker */}
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === 'emoji' ? null : 'emoji') }}
                className={`w-10 h-10 rounded-xl border-2 text-xl flex items-center justify-center transition-all
                  ${isDark ? 'border-[#30363d] bg-[#0d1117] hover:border-blue-500' : 'border-slate-200 bg-slate-50 hover:border-blue-400'}`}>
                {newFolderEmoji}
              </button>
              {openMenuId === 'emoji' && (
                <div className={`absolute top-12 left-0 z-20 p-2 rounded-xl border grid grid-cols-4 gap-1 shadow-xl
                  ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}
                  onClick={e => e.stopPropagation()}>
                  {EMOJIS_FOLDER.map(em => (
                    <button key={em} onClick={() => { setNewFolderEmoji(em); setOpenMenuId(null) }}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center hover:scale-110 transition-transform
                        ${newFolderEmoji === em ? (isDark ? 'bg-blue-900/40' : 'bg-blue-50') : ''}`}>
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input autoFocus value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (editingFolder ? handleEditarCarpeta() : handleCrearCarpeta())}
              placeholder="Nombre de la carpeta..."
              className={`flex-1 px-3 py-2 rounded-xl text-sm border-2 outline-none transition-all ${inputCls}`} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowNewFolder(false); setEditingFolder(null); setNewFolderName(''); setNewFolderEmoji('📁') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'text-slate-400 hover:bg-[#21262d]' : 'text-slate-500 hover:bg-slate-100'}`}>
              Cancelar
            </button>
            <button onClick={editingFolder ? handleEditarCarpeta : handleCrearCarpeta}
              disabled={!newFolderName.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40">
              {editingFolder ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      )}

      {/* Move doc modal */}
      {movingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setMovingDoc(null)}>
          <div className={`${card} border rounded-2xl p-5 w-80 shadow-2xl space-y-3`}
            onClick={e => e.stopPropagation()}>
            <p className={`text-sm font-black ${txt1}`}>Mover a carpeta</p>
            <p className={`text-xs truncate ${txt3}`}>{movingDoc.file_name}</p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {/* Root option */}
              <button onClick={() => { moverDoc(movingDoc.id, null); setMovingDoc(null); toast.success('Movido a Inicio') }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors
                  ${fs.docFolder[movingDoc.id] === null
                    ? 'bg-blue-600 text-white'
                    : isDark ? 'hover:bg-[#21262d] text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                <Home size={14} /> Inicio (raíz)
              </button>
              {fs.carpetas.map(c => (
                <button key={c.id} onClick={() => { moverDoc(movingDoc.id, c.id); setMovingDoc(null); toast.success(`Movido a ${c.name}`) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors
                    ${fs.docFolder[movingDoc.id] === c.id
                      ? 'bg-blue-600 text-white'
                      : isDark ? 'hover:bg-[#21262d] text-slate-300' : 'hover:bg-slate-100 text-slate-700'}`}>
                  {c.emoji} {c.name}
                  {c.parentId && <span className={`text-[10px] ml-auto ${txt3}`}>subcarpeta</span>}
                </button>
              ))}
            </div>
            <button onClick={() => setMovingDoc(null)}
              className={`w-full py-2 rounded-xl text-xs font-bold ${isDark ? 'bg-[#21262d] text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Upload panel */}
      {showUpload && (
        <div className={`${card} border rounded-2xl p-5 space-y-4`}>
          <div className="flex items-center justify-between">
            <p className={`text-sm font-black ${txt1}`}>
              Subir en: {currentFolder ? (fs.carpetas.find(c => c.id === currentFolder)?.name || 'Carpeta') : 'Inicio'}
            </p>
            <button onClick={() => { setShowUpload(false); setSelectedFiles([]) }}
              className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}`}>
              <X size={14} className={txt3} />
            </button>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
              ${isDragging
                ? isDark ? 'border-blue-500 bg-blue-900/20' : 'border-blue-400 bg-blue-50'
                : isDark ? 'border-[#30363d] hover:border-blue-700 hover:bg-blue-900/10' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50'}`}>
            <Upload size={28} className={`mx-auto mb-2 ${isDragging ? 'text-blue-500' : txt3}`} />
            <p className={`text-sm font-bold ${txt1}`}>
              {isDragging ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
            </p>
            <p className={`text-xs mt-1 ${txt3}`}>PDF, imágenes, Word, Excel — varios a la vez — máx. 20MB c/u</p>
          </div>
          <input ref={fileRef} type="file" className="hidden" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.mp4,.mp3"
            onChange={e => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />
          {selectedFiles.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {selectedFiles.map((f, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs
                  ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-base">{FILE_ICONS[fileTypeFromName(f.name)]}</span>
                  <span className={`flex-1 truncate font-medium ${txt1}`}>{f.name}</span>
                  <span className={txt3}>{formatSize(f.size)}</span>
                  <button onClick={() => setSelectedFiles(prev => prev.filter((_, j) => j !== i))}
                    className={`ml-1 p-0.5 rounded hover:text-red-400 ${txt3}`}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${txt3}`}>Categoría</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <button key={c.id} onClick={() => setNewCat(c.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all
                    ${newCat === c.id ? 'bg-blue-600 text-white'
                      : isDark ? 'bg-[#21262d] text-slate-400 hover:bg-[#30363d]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            {newCat === 'otro' && (
              <input autoFocus value={otroLabel} onChange={e => setOtroLabel(e.target.value)}
                placeholder="Escribe el nombre de la categoría..."
                className={`mt-2 w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all ${inputCls}`} />
            )}
          </div>
          <div>
            <label className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${txt3}`}>Descripción (opcional)</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
              placeholder="Ej: Tarea de la semana 3..."
              className={`w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all ${inputCls}`} />
          </div>
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
            {uploading ? 'Subiendo...' : selectedFiles.length > 0 ? `Subir ${selectedFiles.length} archivo${selectedFiles.length > 1 ? 's' : ''}` : 'Subir documento'}
          </button>
        </div>
      )}

      {/* Filters (solo si hay docs o búsqueda activa) */}
      {(docs.length > 0 || search) && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 ${isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-white border-slate-200'}`}>
            <Search size={14} className={txt3} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, descripción..."
              className={`flex-1 text-sm bg-transparent outline-none ${isDark ? 'text-slate-300 placeholder:text-slate-600' : 'text-slate-700'}`} />
          </div>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className={`px-3 py-2 rounded-xl text-sm border-2 outline-none ${isDark ? 'bg-[#0d1117] border-[#30363d] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : isEmpty ? (
        <div className={`${card} border rounded-2xl p-10 text-center`}>
          <FolderOpen size={36} className={`mx-auto mb-3 ${txt3}`} />
          <p className={`font-black text-sm ${txt3}`}>
            {currentFolder ? 'Carpeta vacía' : 'Sin documentos aún'}
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
            {canUpload ? 'Sube documentos o crea subcarpetas para organizar' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Sub-carpetas primero */}
          {subCarpetas.map(carpeta => (
            <div key={carpeta.id}
              className={`${card} ${cardHover} border rounded-xl px-4 py-3 flex items-center gap-3 group cursor-pointer transition-all`}
              onClick={() => setCurrentFolder(carpeta.id)}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0
                ${isDark ? 'bg-[#21262d]' : 'bg-amber-50'}`}>
                {carpeta.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${txt1}`}>{carpeta.name}</p>
                <p className={`text-xs ${txt3}`}>
                  {countInFolder(carpeta.id)} elemento{countInFolder(carpeta.id) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === carpeta.id ? null : carpeta.id) }}
                    className={`p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all
                      ${isDark ? 'hover:bg-[#30363d] text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}>
                    <MoreVertical size={14} />
                  </button>
                  {openMenuId === carpeta.id && (
                    <div className={`absolute right-0 top-8 z-20 w-40 rounded-xl border shadow-xl overflow-hidden
                      ${isDark ? 'bg-[#161b22] border-[#30363d]' : 'bg-white border-slate-200'}`}
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditingFolder(carpeta); setNewFolderName(carpeta.name); setNewFolderEmoji(carpeta.emoji); setOpenMenuId(null) }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors
                          ${isDark ? 'hover:bg-[#21262d] text-slate-300' : 'hover:bg-slate-50 text-slate-700'}`}>
                        <Edit2 size={12} /> Renombrar
                      </button>
                      <button onClick={() => { if (confirm(`¿Eliminar carpeta "${carpeta.name}"? Los documentos se moverán a Inicio.`)) { eliminarCarpeta(carpeta.id); setOpenMenuId(null) } }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 size={12} /> Eliminar
                      </button>
                    </div>
                  )}
                </div>
                <ChevronRight size={14} className={`${txt3} opacity-0 group-hover:opacity-100`} />
              </div>
            </div>
          ))}

          {/* Documentos */}
          {filtered.map(doc => (
            <div key={doc.id}
              className={`${card} border rounded-xl p-4 flex items-center gap-3 group transition-all hover:shadow-sm`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg
                ${isDark ? 'bg-[#21262d]' : 'bg-slate-50'}`}>
                {FILE_ICONS[doc.file_type] || '📎'}
              </div>
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
                {doc.description && <p className={`text-xs mt-0.5 truncate ${txt3}`}>{doc.description}</p>}
                <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                  {doc.uploader_name} · {formatDate(doc.created_at)} · {formatSize(doc.file_size)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                  title="Ver / descargar"><ExternalLink size={14} /></a>
                {canUpload && (
                  <button onClick={() => setMovingDoc(doc)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#21262d] text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
                    title="Mover a carpeta"><FolderInput size={14} /></button>
                )}
                {canToggleVisibility && (
                  <button onClick={() => toggleVisibility(doc)}
                    className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}
                      ${doc.visible_to_parent ? 'text-emerald-500' : txt3}`}
                    title={doc.visible_to_parent ? 'Ocultar a familia' : 'Mostrar a familia'}>
                    {doc.visible_to_parent ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(doc)}
                    className={`p-2 rounded-lg transition-colors text-red-400 ${isDark ? 'hover:bg-red-900/20' : 'hover:bg-red-50'}`}
                    title="Eliminar"><Trash2 size={14} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
