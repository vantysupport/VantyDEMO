'use client'

// Catálogo global de terapias del centro.
// Diseño profesional con modo oscuro adaptativo (CSS vars) y picker de color por tarjeta.

import { useEffect, useState } from 'react'
import {
  Sparkles, Plus, Edit3, Trash2, Save, X, Image as ImageIcon, Loader2,
  Clock, Upload, Eye, EyeOff, Palette, Tag, DollarSign, Wifi, MapPin, Layers, Search,
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
  color_tema: string
  activo: boolean
  orden: number
}

const VACIA: Partial<Terapia> = {
  nombre: '', descripcion: '', por_que: '', imagen_url: '',
  precio: null, moneda: 'PEN', duracion: '', modalidad: 'presencial',
  categoria: '', orden: 0, color_tema: 'indigo',
}

const CATEGORIAS = ['ABA', 'Psicología', 'Lenguaje', 'Ocupacional', 'Aprendizaje', 'Neuropsicología', 'Familia', 'Otro']
const MODALIDADES: { id: string; label: string; icon: any }[] = [
  { id: 'presencial', label: 'Presencial', icon: MapPin },
  { id: 'online',     label: 'Online',     icon: Wifi },
  { id: 'mixta',      label: 'Mixta',      icon: Layers },
]

// Paleta de colores: cada tema → gradiente, accent, banner sólido y badge soft.
const COLORES: Record<string, { gradient: string; accent: string; accentDark: string; soft: string; softDark: string; nombre: string; emoji: string }> = {
  indigo:   { gradient: 'from-sky-500 to-blue-500',     accent: '#0284c7', accentDark: '#38bdf8', soft: '#eef2ff', softDark: '#082f49', nombre: 'Índigo',   emoji: '💙' },
  purple:   { gradient: 'from-sky-500 to-cyan-500',  accent: '#0ea5e9', accentDark: '#7dd3fc', soft: '#f0f9ff', softDark: '#3b0764', nombre: 'Púrpura',  emoji: '💜' },
  pink:     { gradient: 'from-pink-500 to-rose-500',       accent: '#ec4899', accentDark: '#f472b6', soft: '#fdf2f8', softDark: '#500724', nombre: 'Rosa',     emoji: '🌸' },
  rose:     { gradient: 'from-rose-500 to-red-500',        accent: '#f43f5e', accentDark: '#fb7185', soft: '#fff1f2', softDark: '#4c0519', nombre: 'Coral',    emoji: '🌹' },
  amber:    { gradient: 'from-amber-500 to-orange-500',    accent: '#f59e0b', accentDark: '#fbbf24', soft: '#fffbeb', softDark: '#451a03', nombre: 'Ámbar',    emoji: '☀️' },
  emerald:  { gradient: 'from-emerald-500 to-teal-500',    accent: '#10b981', accentDark: '#34d399', soft: '#ecfdf5', softDark: '#022c22', nombre: 'Esmeralda',emoji: '🌿' },
  cyan:     { gradient: 'from-cyan-500 to-sky-500',        accent: '#06b6d4', accentDark: '#22d3ee', soft: '#ecfeff', softDark: '#083344', nombre: 'Cian',     emoji: '🌊' },
  blue:     { gradient: 'from-blue-500 to-sky-500',     accent: '#3b82f6', accentDark: '#60a5fa', soft: '#eff6ff', softDark: '#172554', nombre: 'Azul',     emoji: '🌀' },
  orange:   { gradient: 'from-orange-500 to-red-500',      accent: '#f97316', accentDark: '#fb923c', soft: '#fff7ed', softDark: '#431407', nombre: 'Naranja',  emoji: '🔥' },
  slate:    { gradient: 'from-slate-600 to-slate-700',     accent: '#64748b', accentDark: '#94a3b8', soft: '#f8fafc', softDark: '#0f172a', nombre: 'Gris',     emoji: '⚪' },
}

const colorDe = (key?: string | null) => COLORES[key || 'indigo'] || COLORES.indigo

// Helper para usar CSS vars que sirven en oscuro y claro.
// Tailwind no nos da var() para `from-`/`to-` así que aplicamos gradiente vía style.

export default function CatalogoTerapiasView() {
  const [terapias, setTerapias] = useState<Terapia[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Terapia> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [filtroCat, setFiltroCat] = useState<string>('')

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
      // Usa el endpoint server-side que auto-crea el bucket si no existe
      // y maneja la subida con service_role (sin depender de RLS).
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'terapias')
      const res = await fetch('/api/admin/upload-imagen', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo subir la imagen')
      setEditing(ed => ({ ...ed!, imagen_url: data.url }))
    } catch (e: any) {
      alert(e.message)
    } finally { setUploading(false) }
  }

  const terapiasFiltradas = terapias.filter(t => {
    const matchSearch = !search || t.nombre.toLowerCase().includes(search.toLowerCase()) ||
                        t.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
                        t.categoria?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filtroCat || t.categoria === filtroCat
    return matchSearch && matchCat
  })

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={36} /></div>
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl bg-gradient-to-br from-sky-600 via-sky-500 to-cyan-500">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%)' }} />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Catálogo de Terapias</h1>
            </div>
            <p className="text-white/90 text-sm max-w-xl">
              Las terapias que verán los padres tras la evaluación inicial. La IA usará estos datos para recomendar las más adecuadas según cada caso.
            </p>
          </div>
          <button onClick={() => setEditing({ ...VACIA })}
            className="px-4 py-2.5 rounded-xl bg-white text-sky-700 font-bold text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition">
            <Plus size={16} /> Nueva terapia
          </button>
        </div>
      </div>

      {/* ─── FILTROS ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar terapia…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border outline-none text-sm focus:border-sky-500"
            style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          />
        </div>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}
          className="px-3 py-2.5 rounded-xl border outline-none text-sm focus:border-sky-500"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
          <option value="">Todas las categorías</option>
          {/* Categorías dinámicas extraídas de las terapias existentes */}
          {Array.from(new Set(terapias.map(t => t.categoria).filter(Boolean) as string[])).sort().map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="text-xs font-bold px-3 py-2.5 rounded-xl" style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>
          {terapiasFiltradas.length} {terapiasFiltradas.length === 1 ? 'terapia' : 'terapias'}
        </div>
      </div>

      {/* ─── GRID ────────────────────────────────────────────────────────── */}
      {terapiasFiltradas.length === 0 ? (
        <div className="rounded-2xl p-12 text-center border-2 border-dashed" style={{ borderColor: 'var(--card-border)' }}>
          <Sparkles size={36} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
          <p className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            {terapias.length === 0 ? 'Aún no hay terapias en el catálogo' : 'Sin resultados con esos filtros'}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {terapias.length === 0 ? 'Agrega la primera para que los padres la vean.' : 'Ajusta la búsqueda o limpia los filtros.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {terapiasFiltradas.map(t => (
            <TerapiaCard
              key={t.id}
              t={t}
              onEdit={() => setEditing(t)}
              onDelete={() => eliminar(t.id)}
              onToggle={() => toggleActivo(t)}
            />
          ))}
        </div>
      )}

      {/* ─── MODAL EDITAR ────────────────────────────────────────────────── */}
      {editing && (
        <EditorModal
          editing={editing}
          setEditing={setEditing}
          saving={saving}
          uploading={uploading}
          onSubirImagen={subirImagen}
          onGuardar={guardar}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// TARJETA DE TERAPIA
// ═════════════════════════════════════════════════════════════════════════
function TerapiaCard({
  t, onEdit, onDelete, onToggle,
}: { t: Terapia; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const c = colorDe(t.color_tema)
  const ModIcon = MODALIDADES.find(m => m.id === t.modalidad)?.icon || MapPin

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-xl ${!t.activo ? 'opacity-50' : ''}`}
      style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
    >
      {/* Banda de color en el tope */}
      <div className={`h-1.5 bg-gradient-to-r ${c.gradient}`} />

      {/* IMAGEN */}
      <div className="relative">
        {t.imagen_url ? (
          <img src={t.imagen_url} alt={t.nombre} className="w-full h-44 object-cover" />
        ) : (
          <div className={`w-full h-44 flex items-center justify-center bg-gradient-to-br ${c.gradient} opacity-20`}>
            <ImageIcon size={42} className="text-white/40" />
          </div>
        )}

        {/* Badges arriba */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {t.categoria && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full text-white shadow-lg bg-gradient-to-r ${c.gradient}`}>
              {t.categoria}
            </span>
          )}
          {!t.activo && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-900/80 text-white">
              Oculto
            </span>
          )}
        </div>

        {/* Acciones flotantes */}
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button onClick={onToggle}
            title={t.activo ? 'Ocultar' : 'Mostrar'}
            className="w-8 h-8 rounded-lg backdrop-blur bg-white/90 dark:bg-slate-800/90 flex items-center justify-center hover:scale-110 transition">
            {t.activo ? <Eye size={14} className="text-green-600" /> : <EyeOff size={14} className="text-slate-500" />}
          </button>
          <button onClick={onEdit}
            title="Editar"
            className="w-8 h-8 rounded-lg backdrop-blur bg-white/90 dark:bg-slate-800/90 flex items-center justify-center hover:scale-110 transition">
            <Edit3 size={14} className="text-blue-600" />
          </button>
          <button onClick={onDelete}
            title="Eliminar"
            className="w-8 h-8 rounded-lg backdrop-blur bg-white/90 dark:bg-slate-800/90 flex items-center justify-center hover:scale-110 transition">
            <Trash2 size={14} className="text-red-600" />
          </button>
        </div>
      </div>

      {/* CUERPO */}
      <div className="p-5 space-y-3">
        <h4 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>
          {t.nombre}
        </h4>

        {/* Descripción (sin truncar) */}
        {t.descripcion && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t.descripcion}
          </p>
        )}

        {/* ¿Por qué llevarla? Caja destacada con el color del tema */}
        {t.por_que && (
          <div
            className="rounded-xl p-3 text-sm leading-relaxed border-l"
            style={{
              background: 'var(--muted-bg)',
              borderLeftColor: c.accent,
              color: 'var(--text-secondary)',
            }}
          >
            <p className="text-[10px] font-bold mb-1" style={{ color: c.accent }}>
              ✨ ¿Por qué llevarla?
            </p>
            <p>{t.por_que}</p>
          </div>
        )}

        {/* META */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {t.duracion && (
            <div className="flex items-center gap-1.5 rounded-lg p-2"
              style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)' }}>
              <Clock size={12} className="shrink-0" style={{ color: c.accent }} />
              <span className="truncate">{t.duracion}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-lg p-2"
            style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)' }}>
            <ModIcon size={12} className="shrink-0" style={{ color: c.accent }} />
            <span className="capitalize">{t.modalidad}</span>
          </div>
        </div>

        {/* FOOTER — PRECIO PROMINENTE */}
        <div className="flex items-end justify-between pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <div>
            <p className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
              Inversión
            </p>
            {t.precio != null ? (
              <div className="flex items-baseline gap-1">
                <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>S/.</span>
                <span className="text-2xl font-bold" style={{ color: c.accent }}>
                  {Number(t.precio).toFixed(0)}
                </span>
              </div>
            ) : (
              <p className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>A consultar</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// MODAL EDITOR
// ═════════════════════════════════════════════════════════════════════════
function EditorModal({
  editing, setEditing, saving, uploading, onSubirImagen, onGuardar, onClose,
}: any) {
  const c = colorDe(editing?.color_tema)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md" onClick={onClose}>
      <div className="max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>

        {/* Header con gradiente del color elegido */}
        <div className={`bg-gradient-to-r ${c.gradient} px-6 py-5 text-white sticky top-0 z-10 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">{editing.id ? 'Editar terapia' : 'Nueva terapia'}</h3>
              <p className="text-xs opacity-90">{c.nombre} {c.emoji}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* PALETA DE COLORES */}
          <div>
            <label className="text-xs font-bold block mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Palette size={12} /> Color de la tarjeta
            </label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(COLORES).map(([key, col]) => (
                <button
                  key={key}
                  onClick={() => setEditing({ ...editing, color_tema: key })}
                  title={col.nombre}
                  className={`w-10 h-10 rounded-xl shadow-md transition-all hover:scale-110 bg-gradient-to-br ${col.gradient} ${
                    editing.color_tema === key ? 'ring-4 ring-offset-2 scale-110' : ''
                  }`}
                  style={editing.color_tema === key ? { boxShadow: `0 0 0 3px var(--card), 0 0 0 6px ${col.accent}` } : {}}
                />
              ))}
            </div>
          </div>

          {/* NOMBRE */}
          <Field label="Nombre *">
            <input value={editing.nombre || ''} onChange={e => setEditing({ ...editing, nombre: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm focus:border-sky-500"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </Field>

          {/* IMAGEN */}
          <Field label="Imagen">
            <div className="flex gap-3 items-start">
              {editing.imagen_url ? (
                <div className="relative">
                  <img src={editing.imagen_url} alt="" className="w-28 h-28 object-cover rounded-xl border-2" style={{ borderColor: 'var(--card-border)' }} />
                  <button onClick={() => setEditing({ ...editing, imagen_url: '' })}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shadow-lg">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="w-28 h-28 flex items-center justify-center rounded-xl border-2 border-dashed"
                  style={{ borderColor: 'var(--card-border)' }}>
                  <ImageIcon size={32} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div className="flex-1">
                <input value={editing.imagen_url || ''} onChange={e => setEditing({ ...editing, imagen_url: e.target.value })}
                  placeholder="URL de imagen…"
                  className="w-full px-3 py-2 rounded-lg border outline-none text-sm mb-2"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-bold cursor-pointer bg-gradient-to-r ${c.gradient}`}>
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploading ? 'Subiendo…' : 'Subir imagen'}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && onSubirImagen(e.target.files[0])} />
                </label>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Recomendado: imagen cuadrada o paisaje, mínimo 600×400px.
                </p>
              </div>
            </div>
          </Field>

          {/* CATEGORÍA + MODALIDAD */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Categoría">
              <input
                type="text"
                value={editing.categoria || ''}
                onChange={e => setEditing({ ...editing, categoria: e.target.value })}
                placeholder="Ej: ABA, Lenguaje, Aprendizaje, Conducta…"
                className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm focus:border-sky-500"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
            </Field>
            <Field label="Modalidad">
              <div className="grid grid-cols-3 gap-1.5">
                {MODALIDADES.map(m => {
                  const active = editing.modalidad === m.id
                  return (
                    <button key={m.id} type="button" onClick={() => setEditing({ ...editing, modalidad: m.id })}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold border-2 transition ${
                        active ? `text-white bg-gradient-to-r ${c.gradient} border-transparent` : ''
                      }`}
                      style={active ? {} : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                      <m.icon size={12} /> {m.label}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>

          {/* PRECIO + DURACIÓN */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Precio (Soles)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold pointer-events-none" style={{ color: 'var(--text-muted)' }}>S/.</span>
                <input type="number" step="0.01" value={editing.precio ?? ''}
                  onChange={e => setEditing({ ...editing, precio: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="0.00"
                  className="w-full pl-11 pr-3 py-2.5 rounded-lg border outline-none text-sm focus:border-sky-500"
                  style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
              </div>
            </Field>
            <Field label="Duración">
              <input value={editing.duracion || ''} onChange={e => setEditing({ ...editing, duracion: e.target.value })}
                placeholder="2 sesiones semanales de 45 min"
                className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm focus:border-sky-500"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
            </Field>
          </div>

          {/* DESCRIPCIÓN */}
          <Field label="Descripción">
            <textarea value={editing.descripcion || ''} onChange={e => setEditing({ ...editing, descripcion: e.target.value })}
              rows={3} placeholder="Qué hace la terapia, en qué consiste…"
              className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none focus:border-sky-500"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </Field>

          {/* POR QUÉ */}
          <Field
            label="¿Por qué llevarla?"
            hint="✨ Este texto lo usa la IA para decidir cuándo recomendar esta terapia. Sé específico."
          >
            <textarea value={editing.por_que || ''} onChange={e => setEditing({ ...editing, por_que: e.target.value })}
              rows={3} placeholder="Beneficios, casos en que ayuda especialmente…"
              className="w-full px-3 py-2.5 rounded-lg border outline-none text-sm resize-none focus:border-sky-500"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
          </Field>

          {/* PREVIEW */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-muted)' }}>
              Vista previa
            </p>
            <div className="max-w-sm">
              <TerapiaCard
                t={{
                  id: 'preview',
                  nombre: editing.nombre || 'Nombre de la terapia',
                  descripcion: editing.descripcion || null,
                  por_que: editing.por_que || null,
                  imagen_url: editing.imagen_url || null,
                  precio: editing.precio ?? null,
                  moneda: editing.moneda || 'PEN',
                  duracion: editing.duracion || null,
                  modalidad: editing.modalidad || 'presencial',
                  categoria: editing.categoria || null,
                  color_tema: editing.color_tema || 'indigo',
                  activo: true,
                  orden: 0,
                }}
                onEdit={() => {}}
                onDelete={() => {}}
                onToggle={() => {}}
              />
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 px-6 py-4 border-t flex gap-3"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <button onClick={onGuardar} disabled={saving}
            className={`flex-1 px-4 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r ${c.gradient} shadow-lg`}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar terapia
          </button>
          <button onClick={onClose} className="px-5 py-3 rounded-xl border-2 font-bold"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper de campo con label uniforme
function Field({ label, hint, children }: { label: string; hint?: string; children: any }) {
  return (
    <div>
      <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] mt-1.5 italic" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}
