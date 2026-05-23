'use client'

// Catálogo global de terapias del centro.
// El admin define: nombre, imagen, descripción, por qué llevarla, precio, duración, modalidad, categoría.
// Los padres lo ven al finalizar la 2ª anamnesis.

import { useEffect, useState } from 'react'
import {
  Sparkles, Plus, Edit3, Trash2, Save, X, Image as ImageIcon, Loader2,
  DollarSign, Clock, Tag, Upload, Eye, EyeOff,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Terapia = {
  id: string
  nombre: string
  descripcion: string | null
  por_que: string | null
  imagen_url: string | null
  precio: number | null
  moneda: string
  duracion: string | null
  modalidad: string
  categoria: string | null
  activo: boolean
  orden: number
}

const VACIA: Partial<Terapia> = {
  nombre: '', descripcion: '', por_que: '', imagen_url: '',
  precio: null, moneda: 'PEN', duracion: '', modalidad: 'presencial',
  categoria: '', orden: 0,
}

const CATEGORIAS = ['ABA', 'Psicología', 'Lenguaje', 'Ocupacional', 'Aprendizaje', 'Neuropsicología', 'Familia', 'Otro']
const MODALIDADES = ['presencial', 'online', 'mixta']

export default function CatalogoTerapiasView() {
  const [terapias, setTerapias] = useState<Terapia[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Terapia> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/terapias-catalogo?all=1')
      const data = await res.json()
      if (data.ok) setTerapias(data.terapias)
    } finally { setLoading(false) }
  }

  const guardar = async () => {
    if (!editing?.nombre?.trim()) { alert('Nombre obligatorio'); return }
    setSaving(true)
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const res = await fetch('/api/terapias-catalogo', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })
      const d = await res.json()
      if (!d.ok) throw new Error(d.error)
      setEditing(null)
      await cargar()
    } catch (e: any) { alert('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta terapia del catálogo?')) return
    await fetch(`/api/terapias-catalogo?id=${id}&force=1`, { method: 'DELETE' })
    cargar()
  }

  const toggleActivo = async (t: Terapia) => {
    await fetch('/api/terapias-catalogo', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, activo: !t.activo }),
    })
    cargar()
  }

  const subirImagen = async (file: File) => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `terapias/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('public').upload(path, file, { upsert: false })
      if (error) {
        // intentar con bucket 'images'
        const { error: e2 } = await supabase.storage.from('images').upload(path, file, { upsert: false })
        if (e2) throw new Error('No se pudo subir: ' + e2.message + ' (verifica que exista un bucket público "public" o "images")')
        const { data } = supabase.storage.from('images').getPublicUrl(path)
        setEditing(ed => ({ ...ed!, imagen_url: data.publicUrl }))
      } else {
        const { data } = supabase.storage.from('public').getPublicUrl(path)
        setEditing(ed => ({ ...ed!, imagen_url: data.publicUrl }))
      }
    } catch (e: any) {
      alert(e.message)
    } finally { setUploading(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={36} /></div>
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="rounded-3xl p-6 mb-6 text-white shadow-xl flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={22} />
            <h1 className="text-2xl font-black">Catálogo de Terapias</h1>
          </div>
          <p className="text-white/90 text-sm">
            Las terapias que aparecerán a los padres tras completar la evaluación inicial. Imagen, descripción, "por qué" y precio.
          </p>
        </div>
        <button onClick={() => setEditing({ ...VACIA })}
          className="px-4 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-sm flex items-center gap-2 shadow">
          <Plus size={16} /> Nueva terapia
        </button>
      </div>

      {/* Grid */}
      {terapias.length === 0 ? (
        <div className="rounded-2xl p-12 text-center border-2 border-dashed" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
          <p className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Aún no hay terapias en el catálogo</p>
          <p className="text-sm">Agrega la primera para que los padres la vean al terminar la evaluación inicial.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {terapias.map(t => (
            <div key={t.id} className={`rounded-2xl border overflow-hidden transition ${!t.activo ? 'opacity-50' : ''}`}
              style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
              {t.imagen_url ? (
                <img src={t.imagen_url} alt={t.nombre} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100">
                  <ImageIcon size={36} className="text-indigo-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-black text-base flex-1" style={{ color: 'var(--text-primary)' }}>{t.nombre}</h4>
                  <div className="flex gap-1">
                    <button onClick={() => toggleActivo(t)} className="p-1.5 rounded-lg hover:bg-slate-100" title={t.activo ? 'Desactivar' : 'Activar'}>
                      {t.activo ? <Eye size={14} className="text-green-600" /> : <EyeOff size={14} className="text-slate-400" />}
                    </button>
                    <button onClick={() => setEditing(t)} className="p-1.5 rounded-lg hover:bg-slate-100" title="Editar">
                      <Edit3 size={14} className="text-blue-600" />
                    </button>
                    <button onClick={() => eliminar(t.id)} className="p-1.5 rounded-lg hover:bg-red-50" title="Eliminar">
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                </div>
                {t.categoria && (
                  <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 mb-2">
                    {t.categoria}
                  </span>
                )}
                {t.descripcion && <p className="text-xs mb-2 leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{t.descripcion}</p>}
                {t.por_que && (
                  <div className="rounded-lg p-2 text-xs mb-2 line-clamp-2" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--text-secondary)' }}>
                    <strong className="text-indigo-600">¿Por qué?</strong> {t.por_que}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs pt-2 border-t" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>
                  {t.duracion && <span className="flex items-center gap-1"><Clock size={11} /> {t.duracion}</span>}
                  {t.precio != null && <span className="font-black text-indigo-600 text-sm">{Number(t.precio).toFixed(0)} {t.moneda}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setEditing(null)}>
          <div className="max-w-2xl w-full max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl p-6" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
                {editing.id ? 'Editar terapia' : 'Nueva terapia'}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Nombre *</label>
                <input value={editing.nombre || ''} onChange={e => setEditing({ ...editing, nombre: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>

              {/* Imagen */}
              <div>
                <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Imagen</label>
                <div className="flex gap-2 items-start">
                  {editing.imagen_url ? (
                    <img src={editing.imagen_url} alt="" className="w-24 h-24 object-cover rounded-lg border" style={{ borderColor: 'var(--card-border)' }} />
                  ) : (
                    <div className="w-24 h-24 flex items-center justify-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--card-border)' }}>
                      <ImageIcon size={28} className="text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <input value={editing.imagen_url || ''} onChange={e => setEditing({ ...editing, imagen_url: e.target.value })}
                      placeholder="URL de imagen o sube una"
                      className="w-full px-3 py-2 rounded-lg border outline-none text-sm mb-2"
                      style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                      {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                      {uploading ? 'Subiendo…' : 'Subir imagen'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && subirImagen(e.target.files[0])} />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Categoría</label>
                  <select value={editing.categoria || ''} onChange={e => setEditing({ ...editing, categoria: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                    <option value="">— Sin categoría —</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Modalidad</label>
                  <select value={editing.modalidad || 'presencial'} onChange={e => setEditing({ ...editing, modalidad: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                    {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Precio (PEN)</label>
                  <input type="number" step="0.01" value={editing.precio ?? ''} onChange={e => setEditing({ ...editing, precio: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Duración</label>
                  <input value={editing.duracion || ''} onChange={e => setEditing({ ...editing, duracion: e.target.value })}
                    placeholder="2 sesiones semanales de 45 min"
                    className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm"
                    style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>Descripción</label>
                <textarea value={editing.descripcion || ''} onChange={e => setEditing({ ...editing, descripcion: e.target.value })}
                  rows={3} placeholder="Qué hace la terapia, en qué consiste…"
                  className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>

              <div>
                <label className="text-xs font-bold uppercase block mb-1.5" style={{ color: 'var(--text-muted)' }}>¿Por qué llevarla?</label>
                <textarea value={editing.por_que || ''} onChange={e => setEditing({ ...editing, por_que: e.target.value })}
                  rows={2} placeholder="Beneficios, casos en que ayuda…"
                  className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={guardar} disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
              </button>
              <button onClick={() => setEditing(null)} className="px-4 py-2.5 rounded-lg border-2 font-bold"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
