'use client'

// AgendaView — redirige la funcionalidad al centro
// Las citas son asignadas exclusivamente por el equipo del centro terapéutico.
// Este componente muestra las citas del niño seleccionado junto con info de contacto.

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect } from 'react'
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, Phone, Mail, Info, CalendarDays, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeContext'

const ST: Record<string,{label:string;dot:string;bg:string;text:string;border:string;Icon:any}> = {
  confirmed: { label:'Confirmada', dot:'#10b981', bg:'var(--c-stat-green)', text:'#15803d', border:'#bbf7d0', Icon:CheckCircle2 },
  pending:   { label:'Pendiente',  dot:'#f59e0b', bg:'var(--c-stat-amber)', text:'#b45309', border:'#fde68a', Icon:AlertCircle },
  cancelled: { label:'Cancelada',  dot:'#ef4444', bg:'#fef2f2', text:'#dc2626', border:'#fecaca', Icon:XCircle },
  completed: { label:'Completada', dot:'#0284c7', bg:'var(--c-stat-purple)', text:'#4338ca', border:'#ddd6fe', Icon:CheckCircle2 },
}
const MONTHS_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function fmt(t: string) {
  if (!t) return ''
  const [h,m] = t.split(':').map(Number)
  return `${h%12||12}:${m.toString().padStart(2,'0')} ${h>=12?'PM':'AM'}`
}

export default function AgendaView({ selectedChild, onChangeView }: { selectedChild?: any; onChangeView?: (v:string)=>void }) {
  const { isDark } = useTheme()
  const { t } = useI18n()
  const [citas, setCitas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    if (!selectedChild?.id) { setLoading(false); return }
    setLoading(true)
    supabase.from('appointments').select('*')
      .eq('child_id',selectedChild.id)
      .order('appointment_date',{ascending:true})
      .then(({data}:{data:any[]|null})=>{ setCitas(data||[]); setLoading(false) })
  },[selectedChild])

  const today = new Date().toISOString().split('T')[0]
  const proximas = citas.filter(c=>c.appointment_date>=today&&c.status!=='cancelled')
  const pasadas  = citas.filter(c=>c.appointment_date<today||c.status==='completed')

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,paddingBottom:32,width:'100%' }}>
      <style>{`
  :root {
    --c-card: #ffffff;
    --c-surface: #f8fafc;
    --c-bg: #f1f5f9;
    --c-border: #e2e8f0;
    --c-border-light: #f1f5f9;
    --c-text-primary: #0f172a;
    --c-text-secondary: #374151;
    --c-text-muted: #64748b;
    --c-text-placeholder: #94a3b8;
  }
  .dark {
    --c-card: #161b22;
    --c-surface: #0d1117;
    --c-bg: #090d12;
    --c-border: #30363d;
    --c-border-light: #21262d;
    --c-text-primary: #f0f6fc;
    --c-text-secondary: #c9d1d9;
    --c-text-muted: #8b949e;
    --c-text-placeholder: #6e7681;
  }

  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
  .av-card{animation:fadeUp .35s ease both}
  @media(min-width:640px){
    .av-citas-grid{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
  }
`}</style>

      {/* Hero */}
      <div className="av-card" style={{ background:'linear-gradient(135deg,#0369a1,#0284c7,#0ea5e9)',borderRadius:28,padding:'22px 24px',color:'#ffffff',boxShadow:'0 16px 50px rgba(79,70,229,.3)',position:'relative',overflow:'hidden' }}>
        <div style={{ position:'absolute',top:-20,right:-20,width:120,height:120,background:'rgba(255,255,255,.08)',borderRadius:'50%' }}/>
        <div style={{ position:'relative',zIndex:1 }}>
          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
            <CalendarDays size={15} style={{ opacity:.8 }}/>
            <span style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'rgba(255,255,255,.7)' }}>Mis citas</span>
          </div>
          <h2 style={{ fontSize:22,fontWeight:900,margin:'0 0 4px' }}>{selectedChild?.name||'Citas'}</h2>
          <p style={{ fontSize:12,color:'rgba(255,255,255,.65)',margin:'0 0 16px' }}>Programadas por el equipo del centro terapéutico</p>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
            {[['Próximas',proximas.length],['Realizadas',pasadas.filter(c=>c.status==='completed').length],['Total',citas.length]].map(([l,v])=>(
              <div key={l as string} style={{ background:'rgba(255,255,255,.15)',backdropFilter:'blur(8px)',borderRadius:14,padding:'10px 8px',textAlign:'center' }}>
                <div style={{ fontSize:22,fontWeight:900,lineHeight:1 }}>{v}</div>
                <div style={{ fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:700,marginTop:2,textTransform:'uppercase',letterSpacing:.5 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Info contacto */}
      <div className="av-card" style={{ background:'linear-gradient(135deg,#f0f9ff,#e0f2fe)',border:'1.5px solid #bae6fd',borderRadius:20,padding:'16px 18px' }}>
        <p style={{ fontSize:13,fontWeight:800,color:'#075985',margin:'0 0 6px',display:'flex',alignItems:'center',gap:6 }}><Info size={14} color="#0284c7"/>Las citas son asignadas por el equipo del centro</p>
        <p style={{ fontSize:12,color:'#0284c7',margin:'0 0 12px',lineHeight:1.5 }}>Para solicitar, cambiar o cancelar, contactá directamente con recepción.</p>
        <div style={{ display:'flex',flexWrap:'wrap',gap:10 }}>
          <a href="tel:+51991070734" style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',background:'var(--c-card)',border:'1.5px solid #bae6fd',borderRadius:12,fontSize:12,fontWeight:700,color:'#0369a1',textDecoration:'none' }}><Phone size={12}/>+51 991 070 734</a>
          <a href="mailto:contacto@santi.com" style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'8px 14px',background:'var(--c-card)',border:'1.5px solid #bae6fd',borderRadius:12,fontSize:12,fontWeight:700,color:'#0369a1',textDecoration:'none' }}><Mail size={12}/>Escribir email</a>
        </div>
      </div>

      {!selectedChild ? (
        <div className="av-card" style={{ background:'var(--c-card)',borderRadius:24,border:'1.5px solid var(--c-border-light)',padding:'48px 24px',textAlign:'center' }}>
          <div style={{ width:64,height:64,background:'linear-gradient(135deg,#f5f3ff,#ede9fe)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}><CalendarDays size={28} color="#a78bfa"/></div>
          <p style={{ fontWeight:700,fontSize:14,color:'var(--c-text-placeholder)',margin:0 }}>Seleccioná un niño/a para ver sus citas</p>
        </div>
      ) : loading ? (
        <div style={{ display:'flex',justifyContent:'center',padding:'40px 0' }}><div style={{ width:32,height:32,borderRadius:'50%',border:'3px solid #e2e8f0',borderTop:'3px solid #0284c7',animation:'spin 1s linear infinite' }}/></div>
      ) : (
        <>
          {/* Próximas */}
          <div className="av-card">
            <p style={{ fontSize:11,fontWeight:800,color:'var(--c-text-placeholder)',textTransform:'uppercase',letterSpacing:1,margin:'0 0 10px' }}>Próximas ({proximas.length})</p>
            {proximas.length===0 ? (
              <div style={{ background:'var(--c-surface)',border:'2px dashed var(--c-border)',borderRadius:18,padding:'32px 20px',textAlign:'center' }}>
                <CalendarDays size={28} color="var(--c-text-placeholder)" style={{ margin:'0 auto 10px',display:'block' }}/>
                <p style={{ fontWeight:700,fontSize:13,color:'var(--c-text-placeholder)',margin:'0 0 4px' }}>Sin citas próximas</p>
                <p style={{ fontSize:12,color:'var(--c-text-placeholder)',margin:0 }}>El centro te notificará cuando se asigne una nueva cita.</p>
              </div>
            ) : (
              <div className='av-citas-grid' style={{ display:'flex',flexDirection:'column',gap:10 }}>
                {proximas.map(cita=>{
                  const s=ST[cita.status]||ST.confirmed; const Icon=s.Icon
                  const fecha=new Date(cita.appointment_date+'T12:00:00')
                  return (
                    <div key={cita.id} style={{ background:'var(--c-card)',borderRadius:20,border:`1.5px solid ${s.border}`,padding:'14px 16px',display:'flex',alignItems:'center',gap:14,boxShadow:'0 2px 12px rgba(0,0,0,.04)' }}>
                      <div style={{ background:'linear-gradient(135deg,#0284c7,#0369a1)',color:'#ffffff',borderRadius:14,padding:'10px 12px',textAlign:'center',flexShrink:0,boxShadow:'0 4px 12px rgba(2,132,199,.25)'  }}>
                        <div style={{ fontSize:10,fontWeight:700,opacity:.8,textTransform:'uppercase' }}>{MONTHS_S[fecha.getMonth()]}</div>
                        <div style={{ fontSize:22,fontWeight:900,lineHeight:1.1 }}>{fecha.getDate()}</div>
                        <div style={{ fontSize:9,opacity:.7 }}>{DAYS[fecha.getDay()]}</div>
                      </div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontWeight:800,fontSize:14,color:'var(--c-text-primary)',margin:'0 0 4px' }}>{cita.service_type||'Terapia ABA'}</p>
                        <p style={{ fontSize:12,color:'var(--c-text-muted)',margin:'0 0 4px',display:'flex',alignItems:'center',gap:4 }}><Clock size={11}/>{fmt(cita.appointment_time)}</p>
                        {cita.notes&&<p style={{ fontSize:11,color:'var(--c-text-placeholder)',margin:0,fontStyle:'italic' }}>"{cita.notes}"</p>}
                      </div>
                      <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:s.bg,color:s.text,flexShrink:0 }}><Icon size={11}/>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Historial */}
          {pasadas.length>0&&(
            <div className="av-card">
              <p style={{ fontSize:11,fontWeight:800,color:'var(--c-text-placeholder)',textTransform:'uppercase',letterSpacing:1,margin:'0 0 10px' }}>Historial ({pasadas.length})</p>
              <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
                {pasadas.slice(0,8).map(cita=>{
                  const s=ST[cita.status]||ST.completed
                  const fecha=new Date(cita.appointment_date+'T12:00:00')
                  return (
                    <div key={cita.id} style={{ background:'var(--c-surface)',borderRadius:14,border:'1px solid var(--c-border-light)',padding:'10px 14px',display:'flex',alignItems:'center',gap:10,opacity:.75 }}>
                      <div style={{ width:8,height:8,borderRadius:'50%',background:s.dot,flexShrink:0 }}/>
                      <span style={{ fontSize:12,color:'var(--c-text-muted)',flex:1 }}>
                        {fecha.toLocaleDateString('es',{day:'2-digit',month:'short',year:'numeric'})} · {fmt(cita.appointment_time)}
                      </span>
                      <span style={{ fontSize:11,fontWeight:600,color:'var(--c-text-placeholder)' }}>{cita.service_type||'Terapia'}</span>
                      <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:s.bg,color:s.text }}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
