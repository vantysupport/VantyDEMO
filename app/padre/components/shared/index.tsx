'use client'

import { useI18n } from '@/lib/i18n-context'

import React from 'react'
import { Loader2 } from 'lucide-react'

export function StatCard({icon, label, value, color, trend}: any) {
    return (
        <div className={`${color} p-6 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all group cursor-default`}>
            <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">{icon}</div>
                {trend && <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{trend > 0 ? '+' : ''}{trend}%</span>}
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">{value}</p>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500">{label}</p>
        </div>
    )
}

export function ObjectiveBar({ label, progress, color, icon }: any) {
    return (
        <div className="flex items-center gap-3">
            <div className="text-lg">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{label}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 dark:text-slate-500 ml-2">{progress}%</p>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-[#21262d] rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{width: `${progress}%`}}></div>
                </div>
            </div>
        </div>
    )
}

export function TimeSlotBtn({ time, isTaken, loading, onClick, isPast }: any) {
    const isDisabled = isTaken || isPast
    return (
        <button
            onClick={onClick}
            disabled={isDisabled || loading}
            className={`
                p-3 rounded-xl text-sm font-bold transition-all
                ${isTaken ? 'bg-red-50 text-red-400 border border-red-100 cursor-not-allowed' : 
                  isPast ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed' :
                  'bg-white border-2 border-sky-100 text-sky-700 hover:bg-sky-600 hover:text-white hover:border-sky-600 hover:shadow-lg hover:shadow-sky-200/50 active:scale-95'}
                ${loading ? 'opacity-50 cursor-wait' : ''}
            `}
        >
            {loading ? <Loader2 size={14} className="animate-spin mx-auto" /> : time}
        </button>
    )
}

export function NavBtnDesktop({icon, label, active, onClick, badge}: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl transition-all relative ${active ? 'bg-sky-600 text-white shadow-lg shadow-sky-200' : 'hover:bg-slate-50 hover:text-slate-800'}`} style={{ color: active ? undefined : 'var(--text-muted)', textAlign: 'left' }}
        >
            <span style={{ flexShrink: 0 }}>{icon}</span>
            <span className="font-bold text-sm" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{label}</span>
            {badge > 0 && <span className="absolute right-3 top-2 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>}
        </button>
    )
}

export function NavBtnMobile({icon, label, active, onClick, badge}: any) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center gap-0.5 flex-1 py-1 rounded-xl transition-all relative active:scale-95 ${active ? 'text-sky-500' : ''}`} style={{ color: active ? undefined : 'var(--text-muted)', minWidth: 0 }}
        >
            <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-sky-500/10' : ''}`}>
                {icon}
                {badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[8px] font-bold flex items-center justify-center">
                        {badge}
                    </span>
                )}
            </div>
            <span className="text-[9px] font-bold leading-tight truncate w-full text-center">{label}</span>
        </button>
    )
}

export function NotificationItem({icon, title, message, time, isNew}: any) {
    return (
        <div className={`flex gap-3 p-3 rounded-xl transition-all ${isNew ? 'bg-sky-50 border border-sky-100' : 'hover:bg-slate-50'}`}>
            <div className="text-xl flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{title}</p>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">{time}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{message}</p>
            </div>
        </div>
    )
}

export function HelpItem({icon, title, description}: any) {
    return (
        <div className="flex gap-3 p-4 bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-100 dark:border-[#21262d] hover:border-sky-100 dark:border-sky-800/50 hover:shadow-sm transition-all cursor-pointer group">
            <div className="text-2xl flex-shrink-0">{icon}</div>
            <div>
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-sky-700 dark:text-sky-300 transition-colors">{title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">{description}</p>
            </div>
        </div>
    )
}

export function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
            {icon && <div className="mt-0.5 text-slate-400 dark:text-slate-500 flex-shrink-0">{icon}</div>}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 break-words">{value}</p>
            </div>
        </div>
    )
}
