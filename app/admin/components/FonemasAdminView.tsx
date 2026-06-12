'use client'
// app/admin/components/FonemasAdminView.tsx
// Apartado "Fonemas" para el centro: vista previa de la actividad + repositorio
// de imágenes (galería por fonema). El admin pega URLs de imágenes; las familias
// las ven en Practicar en Casa → Fonemas. Sin imágenes propias → sticker OpenMoji.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { Mic, Plus, Trash2, Loader2, Eye, EyeOff, Images, Save, Smile, Video } from 'lucide-react'
import FonemasPractica, { FONEMAS, FonemaImg } from '@/app/padre/components/FonemasPractica'

type ImgRow = { id: string; url: string; label?: string }
type Ayuda = { boca_url?: string | null; video_url?: string | null }

export default function FonemasAdminView() {
  const toast = useToast()
  const [imgs, setImgs] = useState<Record<string, ImgRow[]>>({})
  const [inputs, setInputs] = useState<Record<string, { label: string; url: string }>>({})
  const [ayudaInputs, setAyudaInputs] = useState<Record<string, { boca: string; video: string }>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const load = async () => {
    try {
      const r = await fetch('/api/fonemas-imagenes')
      const j = await r.json()
      setImgs(j?.imagenes || {})
      const a: Record<string, Ayuda> = j?.ayuda || {}
      const ai: Record<string, { boca: string; video: string }> = {}
      for (const k of Object.keys(a)) ai[k] = { boca: a[k].boca_url || '', video: a[k].video_url || '' }
      setAyudaInputs(ai)
    } catch { /* noop */ }
  }
  useEffect(() => { load() }, [])

  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token || ''

  const add = async (fid: string) => {
    const entry = inputs[fid] || { label: '', url: '' }
    const url = entry.url.trim()
    const label = entry.label.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) { toast.error('La URL debe empezar con http:// o https://'); return }
    setBusy(fid + ':add')
    try {
      const token = await getToken()
      const r = await fetch('/api/fonemas-imagenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'agregar', fonema_id: fid, url, label }),
      })
      const j = await r.json()
      if (!r.ok) { toast.error(j.error || 'Error al agregar'); return }
      setInputs(s => ({ ...s, [fid]: { label: '', url: '' } }))
      await load()
      toast.success('Imagen agregada')
    } catch { toast.error('Error de red') } finally { setBusy(null) }
  }

  const del = async (id: string) => {
    setBusy(id)
    try {
      const token = await getToken()
      const r = await fetch('/api/fonemas-imagenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'eliminar', id }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); toast.error(j.error || 'Error al eliminar'); return }
      await load()
    } catch { toast.error('Error de red') } finally { setBusy(null) }
  }

  const saveAyuda = async (fid: string) => {
    const entry = ayudaInputs[fid] || { boca: '', video: '' }
    setBusy(fid + ':ayuda')
    try {
      const token = await getToken()
      const r = await fetch('/api/fonemas-imagenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_ayuda', fonema_id: fid, boca_url: entry.boca.trim(), video_url: entry.video.trim() }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(j.error || 'Error al guardar'); return }
      toast.success('Ayuda guardada')
    } catch { toast.error('Error de red') } finally { setBusy(null) }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Mic size={20} /> Fonemas
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Actividad de fonemas y repositorio de imágenes. Las imágenes que agregues aquí se muestran a las
          familias como galería por fonema. Si un fonema no tiene imágenes propias, se usa el sticker por defecto.
        </p>
      </div>

      <button
        onClick={() => setPreview(p => !p)}
        className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-sky-700 dark:text-sky-400">
        {preview ? <EyeOff size={15} /> : <Eye size={15} />}
        {preview ? 'Ocultar vista previa' : 'Ver la actividad (vista previa)'}
      </button>

      {preview && (
        <div className="mb-6">
          <FonemasPractica childId="admin-preview" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-3 text-slate-600 dark:text-slate-300">
        <Images size={16} />
        <h2 className="text-sm font-extrabold">Repositorio de imágenes</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {FONEMAS.map(f => {
          const list = imgs[f.id] || []
          return (
            <div key={f.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <FonemaImg code={f.code} emoji={f.emoji} size={30} />
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-700 dark:text-slate-100 leading-tight">{f.letra}</p>
                  <p className="text-xs text-slate-400 truncate">{f.ejemplo}</p>
                </div>
                <span className="ml-auto text-[11px] font-bold text-slate-400">{list.length} img</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {list.map(im => (
                  <div key={im.id} className="flex flex-col items-center gap-1 w-12">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.url} alt={im.label || ''} className="w-full h-full object-cover" />
                      <button
                        onClick={() => del(im.id)} disabled={busy === im.id}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow"
                        title="Eliminar">
                        {busy === im.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      </button>
                    </div>
                    <span className="text-[10px] leading-tight text-center text-slate-500 dark:text-slate-400 w-full truncate" title={im.label || ''}>
                      {im.label || '—'}
                    </span>
                  </div>
                ))}
                {list.length === 0 && (
                  <span className="text-xs text-slate-400 italic py-2">Sin imágenes propias — se usa el sticker por defecto.</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  value={inputs[f.id]?.label || ''}
                  onChange={e => setInputs(s => ({ ...s, [f.id]: { label: e.target.value, url: s[f.id]?.url || '' } }))}
                  placeholder="Etiqueta / palabra que dirá (ej. Avión)"
                  className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 outline-none focus:border-sky-400" />
                <div className="flex gap-2">
                  <input
                    value={inputs[f.id]?.url || ''}
                    onChange={e => setInputs(s => ({ ...s, [f.id]: { url: e.target.value, label: s[f.id]?.label || '' } }))}
                    onKeyDown={e => { if (e.key === 'Enter') add(f.id) }}
                    placeholder="URL de la imagen (https://…)"
                    className="flex-1 min-w-0 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 outline-none focus:border-sky-400" />
                  <button
                    onClick={() => add(f.id)} disabled={busy === f.id + ':add'}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold disabled:opacity-50 shrink-0">
                    {busy === f.id + ':add' ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Agregar
                  </button>
                </div>
              </div>

              {/* Boca + video de cómo se pronuncia (1 por fonema) */}
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Cómo se pronuncia</p>
                <div className="flex items-center gap-2">
                  <Smile size={14} className="text-slate-400 shrink-0" />
                  <input
                    value={ayudaInputs[f.id]?.boca || ''}
                    onChange={e => setAyudaInputs(s => ({ ...s, [f.id]: { boca: e.target.value, video: s[f.id]?.video || '' } }))}
                    placeholder="URL imagen de la boca (https://…)"
                    className="flex-1 min-w-0 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 outline-none focus:border-sky-400" />
                </div>
                <div className="flex items-center gap-2">
                  <Video size={14} className="text-slate-400 shrink-0" />
                  <input
                    value={ayudaInputs[f.id]?.video || ''}
                    onChange={e => setAyudaInputs(s => ({ ...s, [f.id]: { video: e.target.value, boca: s[f.id]?.boca || '' } }))}
                    placeholder="URL del video (YouTube o MP4)"
                    className="flex-1 min-w-0 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 outline-none focus:border-sky-400" />
                  <button
                    onClick={() => saveAyuda(f.id)} disabled={busy === f.id + ':ayuda'}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold disabled:opacity-50 shrink-0">
                    {busy === f.id + ':ayuda' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
