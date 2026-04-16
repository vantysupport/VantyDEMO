'use client'

import { useEffect, useState } from 'react'
import { Video, AlertTriangle, CheckCircle } from 'lucide-react'

export default function VideoUsageIndicator() {
  const [usage, setUsage] = useState<{ used: number; remaining: number; percentage: number; limit: number } | null>(null)

  useEffect(() => {
    fetch('/api/video-call')
      .then(r => r.json())
      .then(data => {
        // Solo actualizar el estado si la respuesta tiene los campos esperados
        if (typeof data.used === 'number' && typeof data.limit === 'number') {
          setUsage(data)
        }
      })
      .catch(() => {})
  }, [])

  if (!usage) return null

  const isWarning  = usage.percentage >= 80
  const isCritical = usage.percentage >= 95
  const isOk       = usage.percentage < 80

  return (
    <div className={`rounded-2xl p-4 border ${
      isCritical ? 'bg-red-50 border-red-200' :
      isWarning  ? 'bg-amber-50 border-amber-200' :
                   'bg-emerald-50 border-emerald-200'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Video size={14} className={isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'} />
        <p className={`text-xs font-black uppercase tracking-widest ${
          isCritical ? 'text-red-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'
        }`}>
          Videollamadas este mes
        </p>
        {isCritical && <AlertTriangle size={12} className="text-red-500 ml-auto animate-pulse" />}
        {isOk && <CheckCircle size={12} className="text-emerald-500 ml-auto" />}
      </div>

      {/* Barra de progreso */}
      <div className="w-full h-2 bg-white rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${Math.min(100, usage.percentage)}%` }}
        />
      </div>

      <div className="flex justify-between items-center">
        <p className={`text-xs font-bold ${
          isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'
        }`}>
          {(usage.used ?? 0).toLocaleString()} / {(usage.limit ?? 0).toLocaleString()} min usados
        </p>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
          isCritical ? 'bg-red-100 text-red-700' :
          isWarning  ? 'bg-amber-100 text-amber-700' :
                       'bg-emerald-100 text-emerald-700'
        }`}>
          {usage.percentage}%
        </span>
      </div>

      {isCritical && (
        <p className="text-[10px] text-red-600 font-bold mt-2 flex items-center gap-1">
          ⚠️ Las videollamadas se bloquearán al llegar a 10,000 min
        </p>
      )}
      {isWarning && !isCritical && (
        <p className="text-[10px] text-amber-600 font-medium mt-1">
          Quedan ~{Math.round(usage.remaining)} min disponibles
        </p>
      )}
    </div>
  )
}
