'use client'

import { useI18n } from '@/lib/i18n-context'

import React from 'react'

export function StatCardPremium({ title, value, icon, color, trend, trendUp }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl md:rounded-[2rem] shadow-sm border border-slate-200 hover:shadow-xl transition-all hover:-translate-y-1 group cursor-default relative overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-2xl bg-gradient-to-br ${color} shadow-lg text-white`}>
            {icon}
          </div>
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {trendUp ? '↗' : '↘'}
          </div>
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{title}</p>
        <h4 className="text-4xl font-black text-slate-800 mb-2">{value}</h4>
        <p className="text-xs text-slate-500 font-bold">{trend}</p>
      </div>
    </div>
  )
}

export function QuickActionButton({ icon, label, color, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${color} transition-all font-bold text-sm hover:scale-105 active:scale-95 shadow-sm`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function StatusRow({ label, status, color }: any) {
  const colors = {
    green: 'bg-green-400 shadow-green-400/50',
    yellow: 'bg-yellow-400 shadow-yellow-400/50',
    red: 'bg-red-400 shadow-red-400/50'
  }
  
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-bold text-slate-300">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${colors[color as keyof typeof colors]} animate-pulse`}></div>
        <span className="text-sm font-bold">{status}</span>
      </div>
    </div>
  )
}

export function MiniStatCard({ value, label, icon, color }: any) {
  return (
    <div className={`${color} p-4 rounded-2xl text-center hover:scale-105 transition-transform cursor-default`}>
      <div className="flex justify-center mb-2">{icon}</div>
      <h4 className="text-2xl font-black mb-1">{value}</h4>
      <p className="text-xs font-bold opacity-80">{label}</p>
    </div>
  )
}

export function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      {icon && <div className="mt-0.5 text-slate-400">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm font-bold text-slate-700 break-words">{value}</p>
      </div>
    </div>
  )
}

export function NavItem({ icon, label, active, onClick }: any) { 
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-3 md:gap-4 w-full p-3 md:p-4 rounded-xl md:rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-105' : 'text-slate-500 hover:bg-slate-50 hover:pl-4 md:hover:pl-6'}`}
    >
      {icon} 
      <span className="block md:hidden lg:block font-black text-[10px] md:text-xs uppercase tracking-[0.15em]">{label}</span>
    </button>
  ) 
}
