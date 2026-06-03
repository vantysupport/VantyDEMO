'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  Loader2, FileText, ArrowLeft, Eye, LayoutTemplate
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { useTheme } from '@/components/ThemeContext'

// ── Types ────────────────────────────────────────────────────────────────────
interface Field {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'date' | 'number' | 'checkbox'
  required: boolean
  placeholder?: string
  options?: string[]
  section?: string
}

interface Section {
  id: string
  title: string
  description?: string
}

interface Template {
  id: string
  name: string
  description: string | null
  category: string
  fields: Field[]
  sections?: Section[]
  is_active: boolean
  is_default: boolean
  created_at: string
}

interface TemplateResponse {
  id: string
  template_id: string
  child_id: string
  filled_by: string
  filler_name: string
  filler_role: string
  responses: Record<string, any>
  notes: string | null
  created_at: string
  clinical_templates?: { name: string; fields: Field[]; sections?: Section[] }
}

const FIELD_TYPES = [
  { id: 'text',     label: 'Texto corto' },
  { id: 'textarea', label: 'Texto largo' },
  { id: 'select',   label: 'Lista' },
  { id: 'radio',    label: 'Opción única' },
  { id: 'date',     label: 'Fecha' },
  { id: 'number',   label: 'Número' },
  { id: 'checkbox', label: 'Casilla' },
]

const CATEGORIES = [
  { id: 'historia_clinica',   label: 'Historia Clínica' },
  { id: 'motivo_consulta',    label: 'Motivo de Consulta' },
  { id: 'seguimiento',        label: 'Seguimiento' },
  { id: 'evaluacion_inicial', label: 'Evaluación Inicial' },
  { id: 'otro',               label: 'Otro' },
]

function uid() { return `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

// ══════════════════════════════════════════════════════════════════════════════
// GESTOR DE PLANTILLAS — para Admin/Jefe
// ══════════════════════════════════════════════════════════════════════════════
export function GestorPlantillas({ isDark: isDarkProp }: { isDark?: boolean }) {
  const { isDark: isDarkCtx } = useTheme()
  const isDark = isDarkProp ?? isDarkCtx
  const toast = useToast()

  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'list' | 'create' | 'edit'>('list')
  const [editing, setEditing]     = useState<Template | null>(null)

  const cc = {
    card: isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200',
    txt1: isDark ? 'text-slate-100' : 'text-slate-800',
    txt3: isDark ? 'text-slate-500' : 'text-slate-400',
    hover: isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-50',
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clinical_templates').select('*').order('created_at')
    setTemplates(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteTemplate = async (id: string) => {
    if (!confirm('¿Eliminar esta ficha? Esta acción no se puede deshacer.')) return
    await supabase.from('clinical_templates').delete().eq('id', id)
    toast.success('Ficha eliminada')
    load()
  }

  const toggleActive = async (t: Template) => {
    await supabase.from('clinical_templates').update({ is_active: !t.is_active }).eq('id', t.id)
    setTemplates(prev => prev.map(tp => tp.id === t.id ? { ...tp, is_active: !tp.is_active } : tp))
    toast.success(t.is_active ? 'Ficha desactivada' : 'Ficha activada')
  }

  if (view === 'create' || view === 'edit') {
    return (
      <FormBuilder
        isDark={isDark}
        template={editing || undefined}
        onSave={() => { setView('list'); setEditing(null); load() }}
        onCancel={() => { setView('list'); setEditing(null) }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`font-bold text-base flex items-center gap-2 ${cc.txt1}`}>
            <LayoutTemplate size={18} className="text-sky-500" />
            Fichas Clínicas
          </h3>
          <p className={`text-xs mt-0.5 ${cc.txt3}`}>Crea y gestiona los modelos de ficha de tu centro</p>
        </div>
        <button onClick={() => { setEditing(null); setView('create') }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm">
          <Plus size={14} /> Nueva ficha
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={22} className="animate-spin text-sky-500" /></div>
      ) : templates.length === 0 ? (
        <div className={`${cc.card} border rounded-2xl p-12 text-center`}>
          <LayoutTemplate size={40} className={`mx-auto mb-3 ${cc.txt3}`} />
          <p className={`font-bold text-sm ${cc.txt3}`}>Sin fichas creadas</p>
          <p className={`text-xs mt-1 ${cc.txt3} opacity-60`}>Crea la primera ficha clínica de tu centro</p>
          <button onClick={() => setView('create')}
            className="mt-4 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl">
            Crear primera ficha
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className={`${cc.card} border rounded-2xl`}>
              <div className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-sky-900/30' : 'bg-sky-50'}`}>
                  <FileText size={18} className="text-sky-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-bold text-sm ${cc.txt1}`}>{t.name}</p>
                    {t.is_default && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">Sistema</span>}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${t.is_active ? 'bg-emerald-100 text-emerald-700' : isDark ? 'bg-[#21262d] text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                      {t.is_active ? '● Activa' : '○ Inactiva'}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#21262d] text-slate-500' : 'bg-slate-100 text-slate-500'}`}>
                      {CATEGORIES.find(c => c.id === t.category)?.label}
                    </span>
                  </div>
                  {t.description && <p className={`text-xs mt-0.5 ${cc.txt3}`}>{t.description}</p>}
                  <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t.fields?.length || 0} campo{(t.fields?.length || 0) !== 1 ? 's' : ''}
                    {t.sections?.length ? ` · ${t.sections.length} sección${t.sections.length !== 1 ? 'es' : ''}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(t)}
                    className={`p-2 rounded-lg text-xs font-bold transition-colors ${cc.hover} ${t.is_active ? 'text-emerald-500' : cc.txt3}`}>
                    {t.is_active ? '✓' : '○'}
                  </button>
                  <button onClick={() => { setEditing(t); setView('edit') }}
                    className={`p-2 rounded-lg transition-colors ${cc.hover} ${cc.txt3}`}>
                    <Edit2 size={14} />
                  </button>
                  {!t.is_default && (
                    <button onClick={() => deleteTemplate(t.id)}
                      className={`p-2 rounded-lg transition-colors text-red-400 ${isDark ? 'hover:bg-red-900/20' : 'hover:bg-red-50'}`}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORM BUILDER — constructor estilo Google Forms
// ══════════════════════════════════════════════════════════════════════════════
function FormBuilder({ isDark, template, onSave, onCancel }: {
  isDark: boolean; template?: Template; onSave: () => void; onCancel: () => void
}) {
  const toast = useToast()
  const [name, setName]         = useState(template?.name || '')
  const [desc, setDesc]         = useState(template?.description || '')
  const [category, setCategory] = useState(template?.category || 'historia_clinica')
  const [sections, setSections] = useState<Section[]>(template?.sections || [])
  const [fields, setFields]     = useState<Field[]>(template?.fields || [])
  const [saving, setSaving]     = useState(false)
  const [preview, setPreview]   = useState(false)

  const cc = {
    card:  isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200',
    muted: isDark ? 'bg-[#0d1117] border-[#30363d]' : 'bg-slate-50 border-slate-200',
    txt1:  isDark ? 'text-slate-100' : 'text-slate-800',
    txt3:  isDark ? 'text-slate-500' : 'text-slate-400',
    input: isDark
      ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600 focus:border-sky-500'
      : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-sky-400',
  }
  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all ${cc.input}`

  const addSection = () => setSections(prev => [...prev, { id: uid(), title: 'Nueva sección', description: '' }])
  const updateSection = (id: string, patch: Partial<Section>) => setSections(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  const removeSection = (id: string) => { setSections(prev => prev.filter(s => s.id !== id)); setFields(prev => prev.map(f => f.section === id ? { ...f, section: undefined } : f)) }
  const addField = (sectionId?: string) => setFields(prev => [...prev, { id: uid(), label: '', type: 'text', required: false, placeholder: '', section: sectionId }])
  const updateField = (id: string, patch: Partial<Field>) => setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id))
  const moveField = (id: string, dir: -1 | 1) => {
    const arr = [...fields]; const idx = arr.findIndex(f => f.id === id); const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]; setFields(arr)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('El nombre es obligatorio'); return }
    const valid = fields.filter(f => f.label.trim())
    if (valid.length === 0) { toast.error('Agrega al menos un campo'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { name: name.trim(), description: desc.trim() || null, category, fields: valid, sections, is_active: true, updated_at: new Date().toISOString() }
      if (template?.id) {
        const { error } = await supabase.from('clinical_templates').update(payload).eq('id', template.id)
        if (error) throw error
        toast.success('Ficha actualizada')
      } else {
        const { error } = await supabase.from('clinical_templates').insert({ ...payload, created_by: user?.id })
        if (error) throw error
        toast.success('Ficha creada')
      }
      onSave()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  if (preview) return <FormPreview name={name} desc={desc} sections={sections} fields={fields} isDark={isDark} onBack={() => setPreview(false)} />

  const unsectioned = fields.filter(f => !f.section)
  const bySection = (sid: string) => fields.filter(f => f.section === sid)

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onCancel} className={`p-2 rounded-xl ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}`}>
          <ArrowLeft size={16} className={cc.txt3} />
        </button>
        <div className="flex-1">
          <p className={`font-bold text-base ${cc.txt1}`}>{template ? 'Editar ficha' : 'Nueva ficha clínica'}</p>
          <p className={`text-xs ${cc.txt3}`}>Diseña el formulario con secciones y preguntas</p>
        </div>
        <button onClick={() => setPreview(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${isDark ? 'border-[#30363d] text-slate-400 hover:bg-[#21262d]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
          <Eye size={13} /> Vista previa
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saving ? 'Guardando...' : 'Guardar ficha'}
        </button>
      </div>

      {/* Datos básicos */}
      <div className={`${cc.card} border rounded-2xl p-5 space-y-4`}>
        <div>
          <label className={`block text-[10px] font-bold mb-1.5 ${cc.txt3}`}>Nombre de la ficha *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Historia Clínica, Seguimiento Mensual..." className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={`block text-[10px] font-bold mb-1.5 ${cc.txt3}`}>Descripción</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Para qué se usa esta ficha..." className={inputCls} />
          </div>
          <div>
            <label className={`block text-[10px] font-bold mb-1.5 ${cc.txt3}`}>Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={`${inputCls} cursor-pointer`}>
              {CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Campos sin sección */}
      <div className={`${cc.card} border rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-3 border-b flex items-center justify-between ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
          <p className={`text-xs font-bold ${cc.txt3}`}>Campos generales</p>
          <button onClick={() => addField()} className="flex items-center gap-1 text-xs font-bold text-sky-500 hover:text-sky-400">
            <Plus size={13} /> Añadir campo
          </button>
        </div>
        <div className="p-4 space-y-2">
          {unsectioned.length === 0 && (
            <p className={`text-xs text-center py-4 ${cc.txt3}`}>Sin campos — agrega campos aquí o crea secciones abajo</p>
          )}
          {unsectioned.map(field => (
            <FieldEditor key={field.id} field={field} isDark={isDark}
              onChange={p => updateField(field.id, p)}
              onDelete={() => removeField(field.id)}
              onMoveUp={() => moveField(field.id, -1)}
              onMoveDown={() => moveField(field.id, 1)} />
          ))}
        </div>
      </div>

      {/* Secciones */}
      {sections.map(section => (
        <div key={section.id} className={`${cc.card} border rounded-2xl overflow-hidden`}>
          <div className={`px-5 py-3 border-b ${isDark ? 'border-[#21262d] bg-[#0d1117]' : 'border-slate-100 bg-slate-50'}`}>
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-1.5">
                <input value={section.title} onChange={e => updateSection(section.id, { title: e.target.value })}
                  placeholder="Título de la sección"
                  className={`w-full px-3 py-1.5 rounded-lg text-sm font-bold border-2 outline-none ${isDark ? 'bg-[#161b22] border-[#21262d] text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`} />
                <input value={section.description || ''} onChange={e => updateSection(section.id, { description: e.target.value })}
                  placeholder="Descripción de la sección (opcional)"
                  className={`w-full px-3 py-1 rounded-lg text-xs border outline-none ${isDark ? 'bg-[#161b22] border-[#21262d] text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`} />
              </div>
              <button onClick={() => addField(section.id)} className="flex items-center gap-1 text-xs font-bold text-sky-500 hover:text-sky-400 whitespace-nowrap mt-1">
                <Plus size={12} /> Campo
              </button>
              <button onClick={() => removeSection(section.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 mt-0.5">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {bySection(section.id).length === 0 && (
              <p className={`text-xs text-center py-3 ${cc.txt3}`}>Sin campos — usa "+ Campo" para agregar</p>
            )}
            {bySection(section.id).map(field => (
              <FieldEditor key={field.id} field={field} isDark={isDark}
                onChange={p => updateField(field.id, p)}
                onDelete={() => removeField(field.id)}
                onMoveUp={() => moveField(field.id, -1)}
                onMoveDown={() => moveField(field.id, 1)} />
            ))}
          </div>
        </div>
      ))}

      {/* Agregar sección */}
      <button onClick={addSection}
        className={`w-full py-3 rounded-2xl border-2 border-dashed text-xs font-bold transition-all
          ${isDark ? 'border-[#30363d] text-slate-500 hover:border-sky-700 hover:text-sky-400' : 'border-slate-200 text-slate-400 hover:border-sky-300 hover:text-sky-500'}`}>
        + Agregar sección
      </button>
    </div>
  )
}

// ── Field Editor ──────────────────────────────────────────────────────────────
function FieldEditor({ field, isDark, onChange, onDelete, onMoveUp, onMoveDown }: {
  field: Field; isDark: boolean
  onChange: (p: Partial<Field>) => void
  onDelete: () => void; onMoveUp: () => void; onMoveDown: () => void
}) {
  const cc = {
    border: isDark ? 'border-[#30363d]' : 'border-slate-200',
    bg:     isDark ? 'bg-[#0d1117]'     : 'bg-slate-50',
    txt3:   isDark ? 'text-slate-500'   : 'text-slate-400',
    input:  isDark ? 'bg-[#161b22] border-[#21262d] text-slate-200 placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400',
  }
  return (
    <div className={`${cc.bg} border-2 ${cc.border} rounded-xl p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onMoveUp} className={`text-[9px] leading-none ${cc.txt3} hover:text-sky-500`}>▲</button>
          <button onClick={onMoveDown} className={`text-[9px] leading-none ${cc.txt3} hover:text-sky-500`}>▼</button>
        </div>
        <input value={field.label} onChange={e => onChange({ label: e.target.value })}
          placeholder="Pregunta o etiqueta del campo"
          className={`flex-1 px-3 py-2 rounded-lg text-sm border-2 outline-none focus:border-sky-400 transition-all ${cc.input}`} />
        <select value={field.type} onChange={e => {
          const newType = e.target.value as Field['type']
          const needsOptions = ['select', 'radio'].includes(newType)
          onChange({
            type: newType,
            options: needsOptions && (!field.options || field.options.length === 0) ? [''] : field.options
          })
        }}
          className={`px-2 py-2 rounded-lg text-xs font-bold border-2 outline-none cursor-pointer ${isDark ? 'bg-[#161b22] border-[#21262d] text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
          {FIELD_TYPES.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
        </select>
        <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" title="Campo obligatorio">
          <input type="checkbox" checked={field.required} onChange={e => onChange({ required: e.target.checked })} className="rounded accent-sky-500" />
          <span className={`text-[10px] font-bold ${cc.txt3}`}>*</span>
        </label>
        <button onClick={onDelete} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
          <X size={13} />
        </button>
      </div>
      {['text', 'textarea', 'number'].includes(field.type) && (
        <input value={field.placeholder || ''} onChange={e => onChange({ placeholder: e.target.value })}
          placeholder="Texto de ayuda (opcional)"
          className={`w-full px-3 py-1.5 rounded-lg text-xs border-2 outline-none ${cc.input}`} />
      )}
      {['select', 'radio'].includes(field.type) && (
        <div className="space-y-1.5">
          <p className={`text-[9px] font-bold ${cc.txt3}`}>Opciones</p>
          <div className="space-y-1">
            {(field.options || []).map((opt, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className={`text-[10px] ${cc.txt3} flex-shrink-0 w-4 text-right`}>{idx + 1}.</span>
                <input
                  value={opt}
                  onChange={e => {
                    const newOpts = [...(field.options || [])]
                    newOpts[idx] = e.target.value
                    onChange({ options: newOpts })
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const newOpts = [...(field.options || []), '']
                      onChange({ options: newOpts })
                    }
                    if (e.key === 'Backspace' && opt === '' && (field.options || []).length > 1) {
                      const newOpts = (field.options || []).filter((_, i) => i !== idx)
                      onChange({ options: newOpts })
                    }
                  }}
                  placeholder={`Opción ${idx + 1}`}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs border-2 outline-none focus:border-sky-400 transition-all ${cc.input}`}
                  autoFocus={idx === (field.options || []).length - 1 && opt === ''}
                />
                <button
                  onClick={() => {
                    const newOpts = (field.options || []).filter((_, i) => i !== idx)
                    onChange({ options: newOpts.length > 0 ? newOpts : [''] })
                  }}
                  className="p-1 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0">
                  <X size={11} />
                </button>
              </div>
            ))}
            {/* Add option button */}
            <button
              onClick={() => onChange({ options: [...(field.options || []), ''] })}
              className={`flex items-center gap-1 text-xs font-bold mt-1 px-2 py-1 rounded-lg transition-colors ${isDark ? 'text-sky-400 hover:bg-sky-900/20' : 'text-sky-600 hover:bg-sky-50'}`}>
              <Plus size={11} /> Añadir opción
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Form Preview ──────────────────────────────────────────────────────────────
function FormPreview({ name, desc, sections, fields, isDark, onBack }: {
  name: string; desc: string; sections: Section[]; fields: Field[]; isDark: boolean; onBack: () => void
}) {
  const cc = {
    card:  isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200',
    txt1:  isDark ? 'text-slate-100' : 'text-slate-800',
    txt3:  isDark ? 'text-slate-500' : 'text-slate-400',
    input: isDark ? 'bg-[#0d1117] border-[#30363d] text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600',
  }
  const renderField = (f: Field) => (
    <div key={f.id}>
      <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {f.label || '(Sin nombre)'} {f.required && <span className="text-red-400">*</span>}
      </label>
      {f.type === 'textarea' && <textarea rows={3} disabled placeholder={f.placeholder} className={`w-full px-3 py-2 rounded-xl text-sm border-2 resize-none opacity-70 ${cc.input}`} />}
      {f.type === 'text' && <input type="text" disabled placeholder={f.placeholder} className={`w-full px-3 py-2 rounded-xl text-sm border-2 opacity-70 ${cc.input}`} />}
      {f.type === 'number' && <input type="number" disabled className={`w-full px-3 py-2 rounded-xl text-sm border-2 opacity-70 ${cc.input}`} />}
      {f.type === 'date' && <input type="date" disabled className={`w-full px-3 py-2 rounded-xl text-sm border-2 opacity-70 ${cc.input}`} />}
      {f.type === 'select' && (
        <select disabled className={`w-full px-3 py-2 rounded-xl text-sm border-2 opacity-70 ${cc.input}`}>
          <option>Seleccionar...</option>
          {(f.options || []).map(o => <option key={o}>{o}</option>)}
        </select>
      )}
      {f.type === 'radio' && (
        <div className="flex flex-wrap gap-2">
          {(f.options || []).map(o => (
            <label key={o} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border-2 opacity-70 ${isDark ? 'border-[#30363d] text-slate-400' : 'border-slate-200 text-slate-600'}`}>
              <input type="radio" disabled /> {o}
            </label>
          ))}
        </div>
      )}
      {f.type === 'checkbox' && (
        <label className={`flex items-center gap-2 text-sm opacity-70 ${cc.txt1}`}>
          <input type="checkbox" disabled /> {f.placeholder || 'Sí'}
        </label>
      )}
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`p-2 rounded-xl ${isDark ? 'hover:bg-[#21262d]' : 'hover:bg-slate-100'}`}>
          <ArrowLeft size={16} className={cc.txt3} />
        </button>
        <p className={`font-bold text-sm ${cc.txt1}`}>Vista previa — así verán la ficha los especialistas</p>
      </div>
      <div className={`${cc.card} border rounded-2xl p-6 space-y-5`}>
        <div className={`pb-4 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
          <p className={`font-bold text-lg ${cc.txt1}`}>{name || '(Sin nombre)'}</p>
          {desc && <p className={`text-sm mt-1 ${cc.txt3}`}>{desc}</p>}
        </div>
        {fields.filter(f => !f.section).length > 0 && (
          <div className="space-y-4">{fields.filter(f => !f.section).map(renderField)}</div>
        )}
        {sections.map(section => {
          const sf = fields.filter(f => f.section === section.id)
          return (
            <div key={section.id} className={`rounded-xl p-4 border ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-100'}`}>
              <p className={`font-bold text-sm mb-0.5 ${cc.txt1}`}>{section.title}</p>
              {section.description && <p className={`text-xs mb-3 ${cc.txt3}`}>{section.description}</p>}
              <div className="space-y-4">{sf.map(renderField)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// RELLENAR FICHA — para especialistas/terapeutas
// ══════════════════════════════════════════════════════════════════════════════
export function RellenarFicha({
  childId, childName, isDark: isDarkProp = false, onSaved
}: {
  childId: string; childName: string; isDark?: boolean; onSaved?: (responseId: string) => void
}) {
  const { isDark: isDarkCtx } = useTheme()
  const isDark = isDarkProp ?? isDarkCtx
  const toast = useToast()

  const [templates, setTemplates]     = useState<Template[]>([])
  const [responses, setResponses]     = useState<TemplateResponse[]>([])
  const [selected, setSelected]       = useState<Template | null>(null)
  const [answers, setAnswers]         = useState<Record<string, any>>({})
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [loading, setLoading]         = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ full_name: string; role: string } | null>(null)

  // Cargar perfil del especialista actual para mostrarlo en el header de la ficha
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', user.id)
          .maybeSingle()
        if (profile) setCurrentUser(profile as any)
      } catch { /* silencioso */ }
    })()
  }, [])

  const roleLabel = (r?: string) => {
    const map: Record<string, string> = {
      jefe: 'Director(a)',
      admin: 'Administrador(a)',
      especialista: 'Especialista',
      terapeuta: 'Terapeuta',
      secretaria: 'Secretaría',
    }
    return map[r || ''] || r || 'Profesional'
  }

  const fechaHoyFmt = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const cc = {
    card:  isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200',
    txt1:  isDark ? 'text-slate-100' : 'text-slate-800',
    txt3:  isDark ? 'text-slate-500' : 'text-slate-400',
    input: isDark
      ? 'bg-[#0d1117] border-[#30363d] text-slate-200 placeholder:text-slate-600 focus:border-sky-500'
      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-400',
  }
  const inputCls = `w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all ${cc.input}`

  const loadData = useCallback(async () => {
    const [{ data: tmpl }, { data: resp }] = await Promise.all([
      supabase.from('clinical_templates').select('*').eq('is_active', true).order('name'),
      supabase.from('clinical_template_responses')
        .select('*, clinical_templates(name,fields,sections)')
        .eq('child_id', childId)
        .order('created_at', { ascending: false }),
    ])
    setTemplates(tmpl || [])
    setResponses(resp || [])
    setLoading(false)
  }, [childId])

  useEffect(() => { loadData() }, [loadData])

  const handleSave = async () => {
    if (!selected) return
    const missing = selected.fields.filter(f => f.required && !answers[f.id] && answers[f.id] !== false)
    if (missing.length > 0) { toast.error(`Obligatorios: ${missing.map(f => f.label).join(', ')}`); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('full_name,role').eq('id', user!.id).single()
      const { data: inserted, error } = await supabase.from('clinical_template_responses').insert({
        template_id: selected.id, child_id: childId, filled_by: user!.id,
        filler_role: profile?.role || 'especialista', filler_name: profile?.full_name || 'Clínico',
        responses: answers, notes: notes.trim() || null,
      }).select('id').single()
      if (error) throw error
      toast.success('Ficha guardada')
      setAnswers({}); setNotes(''); setSelected(null)
      if (inserted?.id) onSaved?.(inserted.id)
      loadData()
    } catch (e: any) { toast.error('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const renderField = (field: Field) => (
    <div key={field.id}>
      <label className={`block text-xs font-bold mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {field.label} {field.required && <span className="text-red-400">*</span>}
      </label>
      {field.type === 'textarea' && <textarea rows={3} value={answers[field.id] || ''} placeholder={field.placeholder} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={`${inputCls} resize-none`} />}
      {field.type === 'text'     && <input type="text"   value={answers[field.id] || ''} placeholder={field.placeholder} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={inputCls} />}
      {field.type === 'number'   && <input type="number" value={answers[field.id] || ''} placeholder={field.placeholder} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={inputCls} />}
      {field.type === 'date'     && <input type="date"   value={answers[field.id] || ''} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={inputCls} />}
      {field.type === 'select'   && (
        <select value={answers[field.id] || ''} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.value }))} className={`${inputCls} cursor-pointer`}>
          <option value="">Seleccionar...</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
      {field.type === 'radio' && (
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map(o => (
            <button key={o} onClick={() => setAnswers(p => ({ ...p, [field.id]: o }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all
                ${answers[field.id] === o ? 'bg-sky-600 border-sky-600 text-white' : isDark ? 'border-[#30363d] text-slate-400 hover:border-sky-700' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>
              {o}
            </button>
          ))}
        </div>
      )}
      {field.type === 'checkbox' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!answers[field.id]} onChange={e => setAnswers(p => ({ ...p, [field.id]: e.target.checked }))} />
          <span className={`text-sm ${cc.txt1}`}>{field.placeholder || 'Sí'}</span>
        </label>
      )}
    </div>
  )

  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-sky-500" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className={`font-bold text-base flex items-center gap-2 ${cc.txt1}`}>
            <FileText size={16} className="text-sky-500" /> Fichas Clínicas
          </h3>
          <p className={`text-xs mt-0.5 ${cc.txt3}`}>{selected ? selected.name : `Fichas de ${childName}`}</p>
        </div>
        {!selected && (
          <button onClick={() => setShowHistory(!showHistory)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${isDark ? 'border-[#30363d] text-slate-400 hover:bg-[#21262d]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {showHistory ? 'Nueva ficha' : `Historial (${responses.length})`}
          </button>
        )}
        {selected && (
          <button onClick={() => { setSelected(null); setAnswers({}) }}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${isDark ? 'border-[#30363d] text-slate-400 hover:bg-[#21262d]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            ← Cambiar ficha
          </button>
        )}
      </div>

      {/* Historial */}
      {!selected && showHistory && (
        <div className="space-y-3">
          {responses.length === 0 ? (
            <div className={`${cc.card} border rounded-2xl p-8 text-center`}>
              <FileText size={28} className={`mx-auto mb-2 ${cc.txt3}`} />
              <p className={`text-sm font-bold ${cc.txt3}`}>Sin fichas registradas</p>
            </div>
          ) : responses.map(r => <ResponseCard key={r.id} response={r} isDark={isDark} />)}
        </div>
      )}

      {/* Selector de plantilla */}
      {!selected && !showHistory && (
        templates.length === 0 ? (
          <div className={`${cc.card} border rounded-2xl p-10 text-center`}>
            <LayoutTemplate size={32} className={`mx-auto mb-3 ${cc.txt3}`} />
            <p className={`font-bold text-sm ${cc.txt3}`}>Sin fichas disponibles</p>
            <p className={`text-xs mt-1 opacity-70 ${cc.txt3}`}>El administrador debe crear fichas primero desde Mi Perfil</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map(t => (
              <button key={t.id} onClick={() => { setSelected(t); setAnswers({}) }}
                className={`${cc.card} border rounded-2xl p-4 text-left hover:border-sky-400 transition-all`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-sky-900/30' : 'bg-sky-50'}`}>
                    <FileText size={18} className="text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${cc.txt1}`}>{t.name}</p>
                    {t.description && <p className={`text-xs mt-0.5 ${cc.txt3} line-clamp-2`}>{t.description}</p>}
                    <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {t.fields?.length || 0} campos{t.sections?.length ? ` · ${t.sections.length} secciones` : ''}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      )}

      {/* Rellenar ficha */}
      {selected && (
        <div className={`${cc.card} border rounded-2xl p-5 space-y-5`}>
          <div className={`pb-3 border-b ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
            <p className={`font-bold text-base ${cc.txt1}`}>{selected.name}</p>
            {selected.description && <p className={`text-xs mt-0.5 ${cc.txt3}`}>{selected.description}</p>}
          </div>

          {/* ── Header automatizado: Fecha / Alumno / Especialista ─────────────── */}
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-sky-50/50 border-sky-100'}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className={`text-[10px] font-bold mb-1 ${cc.txt3}`}>📅 Fecha</p>
                <p className={`text-sm font-bold capitalize ${cc.txt1}`}>{fechaHoyFmt}</p>
              </div>
              <div>
                <p className={`text-[10px] font-bold mb-1 ${cc.txt3}`}>👤 Alumno</p>
                <p className={`text-sm font-bold ${cc.txt1}`}>{childName}</p>
              </div>
              <div>
                <p className={`text-[10px] font-bold mb-1 ${cc.txt3}`}>👨‍⚕️ Especialista a cargo</p>
                {currentUser ? (
                  <p className={`text-sm font-bold ${cc.txt1}`}>
                    {currentUser.full_name}
                    <span className={`ml-1.5 text-[10px] font-semibold ${cc.txt3}`}>· {roleLabel(currentUser.role)}</span>
                  </p>
                ) : (
                  <p className={`text-xs italic ${cc.txt3}`}>Cargando...</p>
                )}
              </div>
            </div>
            <p className={`text-[10px] mt-3 italic ${cc.txt3}`}>
              Estos campos se registran automáticamente al guardar la ficha.
            </p>
          </div>

          {selected.fields.filter(f => !f.section).length > 0 && (
            <div className="space-y-4">{selected.fields.filter(f => !f.section).map(renderField)}</div>
          )}
          {(selected.sections || []).map(section => {
            const sf = selected.fields.filter(f => f.section === section.id)
            if (sf.length === 0) return null
            return (
              <div key={section.id} className={`rounded-xl p-4 border ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`font-bold text-sm mb-0.5 ${cc.txt1}`}>{section.title}</p>
                {section.description && <p className={`text-xs mb-3 ${cc.txt3}`}>{section.description}</p>}
                <div className="space-y-4">{sf.map(renderField)}</div>
              </div>
            )
          })}
          <div>
            <label className={`block text-xs font-bold mb-1.5 ${cc.txt3}`}>Observaciones adicionales</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas del clínico..." className={`${inputCls} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-sky-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Guardando...' : 'Guardar ficha'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Response Card ─────────────────────────────────────────────────────────────
function ResponseCard({ response, isDark }: { response: TemplateResponse; isDark: boolean }) {
  const [open, setOpen]           = useState(false)
  const [downloading, setDownloading] = useState(false)
  const template = (response as any).clinical_templates
  const fields: Field[]    = template?.fields || []
  const sections: Section[] = template?.sections || []
  const cc = {
    card: isDark ? 'bg-[#161b22] border-[#21262d]' : 'bg-white border-slate-200',
    txt1: isDark ? 'text-slate-100' : 'text-slate-800',
    txt3: isDark ? 'text-slate-500' : 'text-slate-400',
  }
  const handleWord = async () => {
    setDownloading(true)
    try {
      const res = await fetch('/api/reporte-ficha-clinica', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ responseId: response.id }) })
      if (!res.ok) throw new Error('Error generando documento')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `Ficha_${template?.name || 'Clinica'}.docx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setDownloading(false) }
  }
  const val = (fid: string) => { const v = response.responses[fid]; if (v === undefined || v === null || v === '') return null; return typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v) }

  return (
    <div className={`${cc.card} border rounded-2xl overflow-hidden`}>
      <div className="p-4 flex items-center gap-3">
        <button onClick={() => setOpen(!open)} className="flex-1 flex items-center gap-3 text-left min-w-0">
          <FileText size={16} className="text-sky-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${cc.txt1}`}>{template?.name || 'Ficha'}</p>
            <p className={`text-xs ${cc.txt3}`}>{response.filler_name} · {new Date(response.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          {open ? <ChevronUp size={15} className={cc.txt3} /> : <ChevronDown size={15} className={cc.txt3} />}
        </button>
        <button onClick={handleWord} disabled={downloading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all flex-shrink-0 disabled:opacity-50 ${isDark ? 'border-sky-700 text-sky-400 hover:bg-sky-900/20' : 'border-sky-200 text-sky-600 hover:bg-sky-50'}`}>
          {downloading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {downloading ? '...' : 'Word'}
        </button>
      </div>
      {open && (
        <div className={`p-4 pt-2 border-t space-y-3 ${isDark ? 'border-[#21262d]' : 'border-slate-100'}`}>
          {fields.filter(f => !f.section).map(f => { const v = val(f.id); if (!v) return null; return <div key={f.id}><p className={`text-[10px] font-bold mb-0.5 ${cc.txt3}`}>{f.label}</p><p className={`text-sm ${cc.txt1}`}>{v}</p></div> })}
          {sections.map(s => {
            const sf = fields.filter(f => f.section === s.id)
            if (!sf.some(f => val(f.id))) return null
            return (
              <div key={s.id} className={`rounded-xl p-3 border ${isDark ? 'bg-[#0d1117] border-[#21262d]' : 'bg-slate-50 border-slate-100'}`}>
                <p className={`text-xs font-bold mb-2 ${cc.txt1}`}>{s.title}</p>
                <div className="space-y-2">
                  {sf.map(f => { const v = val(f.id); if (!v) return null; return <div key={f.id}><p className={`text-[10px] font-bold mb-0.5 ${cc.txt3}`}>{f.label}</p><p className={`text-sm ${cc.txt1}`}>{v}</p></div> })}
                </div>
              </div>
            )
          })}
          {response.notes && <div><p className={`text-[10px] font-bold mb-0.5 ${cc.txt3}`}>Observaciones</p><p className={`text-sm ${cc.txt1}`}>{response.notes}</p></div>}
        </div>
      )}
    </div>
  )
}
