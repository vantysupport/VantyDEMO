'use client'
import React from 'react'

import { useI18n } from '@/lib/i18n-context'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface ImportRow {
  nombre: string
  apellido?: string
  email?: string
  fecha_nacimiento?: string
  diagnostico?: string
  tutor_nombre?: string
  tutor_email?: string
  tutor_telefono?: string
  [key: string]: string | undefined
}

interface ImportResult {
  total: number
  exitosos: number
  errores: { fila: number; motivo: string }[]
}

export default function ExcelImportView() {
  const { t } = useI18n()
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<ImportRow[]>([])
  const [headers, setHeaders]   = useState<string[]>([])
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const parseCSV = (text: string): { headers: string[]; rows: ImportRow[] } => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row: ImportRow = { nombre: '' }
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    })
    return { headers, rows }
  }

  const handleFile = (f: File) => {
    setFile(f)
    setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers, rows } = parseCSV(text)
      setHeaders(headers)
      setPreview(rows.slice(0, 5))
    }
    reader.readAsText(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) handleFile(f)
    else showToast('error', 'Solo se aceptan archivos CSV')
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    const reader = new FileReader()
    reader.onload = async e => {
      const text = e.target?.result as string
      const { rows } = parseCSV(text)
      const res: ImportResult = { total: rows.length, exitosos: 0, errores: [] }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const nombre = (row['nombre'] || row['Nombre'] || '').trim()
        if (!nombre) {
          res.errores.push({ fila: i + 2, motivo: 'Nombre vacío' })
          continue
        }
        try {
          const { error } = await supabase.from('ninos').insert({
            nombre,
            apellido:         row['apellido']         || row['Apellido']         || null,
            fecha_nacimiento: row['fecha_nacimiento']  || row['Fecha Nacimiento'] || null,
            diagnostico:      row['diagnostico']       || row['Diagnóstico']      || null,
            tutor_nombre:     row['tutor_nombre']      || row['Tutor']            || null,
            tutor_email:      row['tutor_email']       || row['Email Tutor']      || null,
            tutor_telefono:   row['tutor_telefono']    || row['Teléfono']         || null,
          })
          if (error) res.errores.push({ fila: i + 2, motivo: error.message })
          else res.exitosos++
        } catch (err: any) {
          res.errores.push({ fila: i + 2, motivo: err.message })
        }
      }

      setResult(res)
      setLoading(false)
      if (res.exitosos > 0) showToast('success', `${res.exitosos} pacientes importados`)
    }
    reader.readAsText(file)
  }

  const downloadTemplate = () => {
    const csv = 'nombre,apellido,fecha_nacimiento,diagnostico,tutor_nombre,tutor_email,tutor_telefono\nJuan,Pérez,2018-05-10,TEA,María Pérez,maria@email.com,999000000'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'plantilla_pacientes.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Importar Pacientes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('ui.subeCSV')}</p>
        </div>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-700 hover:bg-green-100 transition text-sm font-medium">
          <Download className="w-4 h-4" /> Descargar plantilla
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
          ${dragOver ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
        <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        {file ? (
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-200">{file.name}</p>
            <p className="text-sm text-gray-500">{preview.length}+ filas detectadas</p>
          </div>
        ) : (
          <div>
            <p className="font-semibold text-gray-700 dark:text-gray-200">{t('whatsapp.arrastraCSV')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('ui.oHazClic')}</p>
          </div>
        )}
      </div>

      {/* Preview */}
      {preview.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Vista previa (primeras 5 filas)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>{headers.map(h => <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-700">
                    {headers.map(h => <td key={h} className="px-4 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]">{row[h] || '—'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import button */}
      {file && !result && (
        <button onClick={handleImport} disabled={loading}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition">
          {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Importando...</> : <><Upload className="w-5 h-5" /> Importar pacientes</>}
        </button>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
              <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.exitosos}</p>
              <p className="text-xs text-green-600 dark:text-green-400">{t('ui.imported')}</p>
            </div>
            <div className="flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{result.errores.length}</p>
              <p className="text-xs text-red-600 dark:text-red-400">{t('common.error')}</p>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
              <FileText className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{result.total}</p>
              <p className="text-xs text-gray-500">{t('common.total')}</p>
            </div>
          </div>
          {result.errores.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-orange-600 dark:text-orange-400">
                <AlertTriangle className="w-4 h-4" /> Filas con error:
              </div>
              {result.errores.map((e, i) => (
                <div key={i} className="text-xs text-gray-600 dark:text-gray-400 bg-red-50 dark:bg-red-900/10 px-3 py-1.5 rounded-lg">
                  Fila {e.fila}: {e.motivo}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => { setFile(null); setPreview([]); setResult(null); setHeaders([]) }}
            className="w-full py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}
