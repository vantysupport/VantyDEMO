'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, Plus, Trash2, Send, Globe, User, Video, FileText,
  Link as LinkIcon, Image as ImageIcon, Music, X, Loader2, RefreshCw,
  CheckCircle2, Eye, Search, Filter, Gift, Pencil
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

const RESOURCE_TYPES = [
  { id: 'video', label: 'Video', icon: Video, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', hint: 'YouTube, Vimeo, URL de video...' },
  { id: 'pdf', label: 'PDF / Doc', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', hint: 'URL de PDF o documento en Google Drive' },
  { id: 'link', label: 'Enlace web', icon: LinkIcon, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', hint: 'Cualquier página web útil...' },
  { id: 'image', label: 'Imagen', icon: ImageIcon, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', hint: 'URL de imagen...' },
  { id: 'document', label: 'Material', icon: BookOpen, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', hint: 'Guías, artículos, materiales...' },
  { id: 'audio', label: 'Audio', icon: Music, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', hint: 'Podcast, meditación, música...' },
]

const RESOURCE_TAGS = [
  'TDAH', 'TEA', 'Sensorial', 'Lenguaje', 'Conducta', 'Social', 'Familia',
  'Relajación', 'Juego', 'Rutinas', 'Emociones', 'Escuela', 'ABA', 'PECS'
]

export default function ResourcesManagementView() {
  const toast = useToast()
  const { t, locale } = useI18n()
  const [resources, setResources] = useState<any[]>([])
  const [patients, setPatients] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')

  const [newResource, setNewResource] = useState({
    title: '',
    description: '',
    resource_type: 'video',
    url: '',
    is_global: true,
    child_id: '',
    tags: [] as string[],
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/resources')
      const json = await res.json()
      if (!json.error) setResources(json.data || [])
      const { data: kids } = await supabase.from('children').select('id, name, age, diagnosis').order('name')
      if (kids) setPatients(kids)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!newResource.title.trim()) { toast.error('El título es obligatorio'); return }
    if (!newResource.url.trim()) { toast.error('La URL es obligatoria'); return }
    if (!newResource.is_global && !newResource.child_id) { toast.error('Selecciona un paciente'); return }
    setIsSaving(true)
    try {
      // Get parent_id from child if specific patient selected
      let parentId = null
      if (!newResource.is_global && newResource.child_id) {
        const { data: child } = await supabase.from('children').select('parent_id').eq('id', newResource.child_id).single()
        parentId = (child as any)?.parent_id || null
      }

      if (editingId) {
        // Update existing resource
        const { error } = await supabase.from('parent_resources').update({
          title: newResource.title,
          description: newResource.description,
          resource_type: newResource.resource_type,
          url: newResource.url,
          is_global: newResource.is_global,
          child_id: newResource.is_global ? null : newResource.child_id,
          parent_id: parentId,
          tags: newResource.tags,
        }).eq('id', editingId)
        if (error) throw new Error(error.message)
        toast.success('✅ Recurso actualizado correctamente')
      } else {
        const res = await fetch('/api/admin/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' },
          body: JSON.stringify({
            ...newResource,
            parent_id: parentId,
            child_id: newResource.is_global ? null : newResource.child_id,
          }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        toast.success('✅ Recurso compartido correctamente')
      }
      setShowForm(false)
      setEditingId(null)
      setNewResource({ title: '', description: '', resource_type: 'video', url: '', is_global: true, child_id: '', tags: [] })
      load()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este recurso?')) return
    try {
      await fetch('/api/admin/resources', { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-locale': typeof window !== 'undefined' ? (localStorage.getItem('vanty_locale') || 'es') : 'es' }, body: JSON.stringify({ id }) })
      toast.success('Recurso eliminado')
      load()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    }
  }

  const handleEdit = (resource: any) => {
    setEditingId(resource.id)
    setNewResource({
      title: resource.title || '',
      description: resource.description || '',
      resource_type: resource.resource_type || 'video',
      url: resource.url || '',
      is_global: resource.is_global !== false,
      child_id: resource.child_id || '',
      tags: resource.tags || [],
    })
    setShowForm(true)
  }

  const toggleTag = (tag: string) => {
    setNewResource(p => ({
      ...p,
      tags: p.tags.includes(tag) ? p.tags.filter(t => t !== tag) : [...p.tags, tag],
    }))
  }

  const filtered = resources.filter(r => {
    const matchSearch = !searchTerm || r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || r.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchType = filterType === 'all' || r.resource_type === filterType
    return matchSearch && matchType
  })

  const globalCount = resources.filter(r => r.is_global).length
  const specificCount = resources.filter(r => !r.is_global).length

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 animate-fade-in-up" style={{ background: "var(--background)" }}>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="font-black text-2xl md:text-3xl text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-violet-100 rounded-2xl"><BookOpen className="text-violet-600" size={28}/></div>
            Centro de Recursos
          </h2>
          <p className="text-slate-400 text-sm font-medium mt-1 ml-1">
            Comparte videos, PDFs, guías y materiales con las familias
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="p-3 rounded-xl border-2 border-slate-200 hover:border-violet-400 text-slate-400 hover:text-violet-600 transition-all">
            <RefreshCw size={18}/>
          </button>
          <button onClick={() => setShowForm(true)} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200/50 transition-all flex items-center gap-2">
            <Plus size={18}/> Compartir Recurso
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total', value: resources.length, color: 'violet' },
          { label: 'Para todos', value: globalCount, color: 'blue' },
          { label: 'Específicos', value: specificCount, color: 'indigo' },
          { label: 'Tipos', value: new Set(resources.map(r => r.resource_type)).size, color: 'emerald' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-5 shadow-sm border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`text-3xl font-black text-${color}-600 mt-1`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input type="text" {...{placeholder: t('ui.search_resource')}} value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm font-bold outline-none focus:border-violet-400 transition-all border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}/>
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="p-3.5 rounded-xl text-sm font-bold outline-none focus:border-violet-400 transition-all border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
          <option value="all">{t('common.todos')}</option>
          {RESOURCE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      {/* Resources Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-violet-400" size={32}/></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 bg-violet-50 rounded-3xl mb-4"><BookOpen size={40} className="text-violet-300"/></div>
          <p className="font-bold text-slate-400">{t('ui.no_resources')}</p>
          <p className="text-xs text-slate-300 mt-1">{t('recursos.compartePrimero')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(resource => {
            const typeInfo = RESOURCE_TYPES.find(t => t.id === resource.resource_type) || RESOURCE_TYPES[2]
            const IconComp = typeInfo.icon
            const patient = patients.find(p => p.id === resource.child_id)

            return (
              <div key={resource.id} className="rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-all group border" style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
                <div className="border-b px-5 py-4 flex items-center justify-between" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-white rounded-xl shadow-sm`}>
                      <IconComp size={18} className={typeInfo.color}/>
                    </div>
                    <div>
                      <span className={`text-[9px] font-black uppercase tracking-wider ${typeInfo.color}`}>{typeInfo.label}</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        {resource.is_global ? (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500">
                            <Globe size={9}/> Para todos
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-600">
                            <User size={9}/> {patient?.name || t('recursos.pacienteEspecifico')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(resource)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                      style={{ background: '#ede9fe', color: '#7c3aed' }}
                      title={t('common.editar')}>
                      <Pencil size={12}/> {t('common.editar')}
                    </button>
                    <button onClick={() => handleDelete(resource.id)}
                      className="p-1.5 rounded-lg transition-all"
                      style={{ background: '#fee2e2', color: '#dc2626' }}
                      title={t('common.eliminar')}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <h4 className="font-bold mb-1 leading-tight" style={{ color: "var(--text-primary)" }}>{resource.title}</h4>
                  {resource.description && <p className="text-xs font-medium line-clamp-2 mb-3" style={{ color: "var(--text-secondary)" }}>{resource.description}</p>}
                  
                  {resource.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {resource.tags.map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: "var(--muted-bg)", color: "var(--text-secondary)" }}>{tag}</span>
                      ))}
                    </div>
                  )}

                  {resource.url && (
                    <a href={resource.url} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-2 text-xs font-bold ${typeInfo.color} hover:underline`}>
                      <Eye size={12}/> Vista previa
                    </a>
                  )}
                  
                  <p className="text-[10px] mt-3" style={{ color: "var(--text-muted)" }}>{new Date(resource.created_at).toLocaleDateString(toBCP47(locale))}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: New Resource */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--card)" }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                {editingId ? <Pencil size={20} className="text-indigo-600"/> : <Gift size={20} className="text-violet-600"/>}
                {editingId ? 'Editar Recurso' : 'Compartir Recurso'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); setNewResource({ title: '', description: '', resource_type: 'video', url: '', is_global: true, child_id: '', tags: [] }) }} className="p-2 rounded-full hover:bg-slate-100 transition-all"><X size={20}/></button>
            </div>

            <div className="space-y-5">
              {/* Resource type */}
              <div>
                <label className="text-xs font-black uppercase tracking-widest block mb-3" style={{ color: "var(--text-muted)" }}>{t('ui.tipoRecurso')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {RESOURCE_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <button key={type.id} onClick={() => setNewResource(p => ({ ...p, resource_type: type.id }))}
                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all ${newResource.resource_type === type.id ? `${type.bg} ${type.border} shadow-md` : 'border-slate-200 hover:border-slate-300'}`} style={newResource.resource_type !== type.id ? { background: 'var(--muted-bg)' } : {}}>
                        <Icon size={18} className={newResource.resource_type === type.id ? type.color : 'text-slate-400'}/>
                        <span className={`text-[10px] font-black ${newResource.resource_type === type.id ? type.color : 'text-slate-500'}`}>{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">{t('recursos.tituloStar')}</label>
                <input type="text" value={newResource.title} onChange={e => setNewResource(p => ({ ...p, title: e.target.value }))}
                  {...{placeholder: t('ui.resource_title')}}
                  className="w-full p-4 rounded-xl text-sm font-bold outline-none focus:border-violet-400 transition-all border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}/>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">{t('common.descripcion')}</label>
                <textarea rows={2} value={newResource.description} onChange={e => setNewResource(p => ({ ...p, description: e.target.value }))}
                  {...{placeholder: t('ui.resource_desc')}}
                  className="w-full p-4 rounded-xl text-sm font-bold outline-none focus:border-violet-400 transition-all resize-none border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}/>
              </div>

              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">
                  URL *
                  <span className="ml-2 font-normal text-slate-300">
                    {RESOURCE_TYPES.find(t => t.id === newResource.resource_type)?.hint}
                  </span>
                </label>
                <input type="url" value={newResource.url} onChange={e => setNewResource(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full p-4 rounded-xl text-sm font-bold outline-none focus:border-violet-400 transition-all font-mono text-xs border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}/>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-2">{t('recursos.etiquetas')}</label>
                <div className="flex flex-wrap gap-2">
                  {RESOURCE_TAGS.map(tag => (
                    <button key={tag} type="button" onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${newResource.tags.includes(tag) ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`} style={!newResource.tags.includes(tag) ? { background: 'var(--muted-bg)' } : {}}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audience */}
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-3">{t('recursos.paraQuien')}</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button onClick={() => setNewResource(p => ({ ...p, is_global: true, parent_id: '' }))}
                    className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${newResource.is_global ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' : 'text-slate-600 border-slate-200 hover:border-blue-300'}`} style={newResource.is_global ? {} : { background: 'var(--muted-bg)' }}>
                    <Globe size={18}/><span className="font-bold text-sm">{t('ui.all_families')}</span>
                  </button>
                  <button onClick={() => setNewResource(p => ({ ...p, is_global: false }))}
                    className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${!newResource.is_global ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200' : 'text-slate-600 border-slate-200 hover:border-indigo-300'}`} style={!newResource.is_global ? {} : { background: 'var(--muted-bg)' }}>
                    <User size={18}/><span className="font-bold text-sm">{t('ui.specific_patient')}</span>
                  </button>
                </div>
                {!newResource.is_global && (
                  <select value={newResource.child_id} onChange={e => setNewResource(p => ({ ...p, child_id: e.target.value }))}
                    className="w-full p-4 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 transition-all border-2" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-primary)" }}>
                    <option value="">{t('common.seleccionarPaciente')}</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}{p.age ? ` (${p.age})` : ''}</option>)}
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setEditingId(null); setNewResource({ title: '', description: '', resource_type: 'video', url: '', is_global: true, child_id: '', tags: [] }) }} className="flex-1 py-4 text-slate-400 font-black uppercase text-xs tracking-widest hover:bg-slate-50 rounded-xl border-2 border-slate-100 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex-[2] py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-violet-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:from-violet-700">
                  {isSaving ? <Loader2 size={18} className="animate-spin"/> : <Send size={18}/>}
                  {isSaving ? 'Guardando...' : 'Compartir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
