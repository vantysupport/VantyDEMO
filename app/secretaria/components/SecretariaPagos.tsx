'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DollarSign, Plus, Search, Download, TrendingUp, CheckCircle2,
  Clock, XCircle, Loader2, Calendar, Save, X, Package, ChevronDown,
  ChevronUp, Repeat, Pencil, Trash2, Settings2, Check, FileText,
  BarChart3, CreditCard
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  paid:      { label: 'Pagado',    color: '#10b981', bg: '#d1fae5' },
  pending:   { label: 'Pendiente', color: '#f59e0b', bg: '#fef3c7' },
  partial:   { label: 'Parcial',   color: '#0284c7', bg: '#dbeafe' },
  cancelled: { label: 'Cancelado', color: '#ef4444', bg: '#fee2e2' },
  refunded:  { label: 'Devuelto',  color: '#0ea5e9', bg: '#ede9fe' },
}
const METHODS      = ['efectivo','yape','plin','transferencia','tarjeta','otro']
const MESES        = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MESES_LARGO  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS       = ['#0284c7','#10b981','#f59e0b','#ef4444','#0ea5e9','#ec4899','#06b6d4','#84cc16']

const DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

// ─── Group payments by patient + month ───────────────────────────────────────
// Packages (concept with "(N/M)" pattern) are grouped by their base concept.
// Individual payments keep separate entries so they don't mix with packages.
function groupByPatientMonth(pays: any[]) {
  const g: Record<string, any> = {}
  pays.forEach(p => {
    const d = new Date(p.paid_at || p.created_at)
    const year = d.getFullYear()
    const month = d.getMonth()

    // Detect package session: concept ends with "(N/M)" where M > 1
    const pkgMatch = p.concept?.match(/^(.+?)\s*\(\d+\/(\d+)\)$/)
    const isPackage = pkgMatch && Number(pkgMatch[2]) > 1

    let k: string
    if (isPackage) {
      // Same package: same base concept + same patient + same month
      const baseConcept = (pkgMatch[1] as string).trim()
      k = `pkg_${p.child_id}_${year}_${month}_${baseConcept}`
    } else {
      // Individual payments: unique per payment id
      k = `ind_${p.id}`
    }

    if (!g[k]) g[k] = {
      key: k,
      child: p.children?.name || p.paciente_externo || '—',
      month: `${year}-${String(month).padStart(2,'0')}`,
      monthLabel: `${MESES_LARGO[month]} ${year}`,
      pays: [],
      total: 0,
      isPackage: !!isPackage,
    }
    g[k].pays.push(p)
    g[k].total += Number(p.amount)
  })
  // Sort: newest month first, then alphabetically by patient
  return Object.values(g).sort((a: any, b: any) => {
    const mc = b.month.localeCompare(a.month)
    if (mc !== 0) return mc
    return a.child.localeCompare(b.child)
  })
}

// ─── KPI ──────────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, icon: Icon, bar }: any) {
  return (
    <div className="group rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: `linear-gradient(157deg, ${bar}0d 0%, var(--card) 46%)`, border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ background: `${bar}1a`, color: bar }}>
          <Icon size={17} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl md:text-3xl font-extrabold leading-tight mb-1 break-all tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

// ─── Input helper ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SecretariaPagos({ profile }: { profile: any }) {
  const toast    = useToast()
  const rtRef    = useRef<any>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const [tab, setTab]           = useState<'dashboard'|'registros'|'agrupado'|'tarifas'>('dashboard')
  const [payments, setPayments] = useState<any[]>([])
  const [children, setChildren] = useState<any[]>([])
  const [rates, setRates]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [periodo, setPeriodo]   = useState<'semana'|'mes'|'anio'>('mes')
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Forms
  const [showNew, setShowNew]     = useState(false)
  const [showPkg, setShowPkg]     = useState(false)
  const [showRateForm, setShowRateForm] = useState(false)
  const [editingRate, setEditingRate]   = useState<any>(null)

  // Stats
  const [stats, setStats] = useState({ total: 0, cobros: 0, pendiente: 0, cancelados: 0, porMes: [] as any[], porMetodo: [] as any[] })

  const buildStats = useCallback((pays: any[]) => {
    const paid = pays.filter(p => p.status === 'paid')
    const pend = pays.filter(p => p.status === 'pending')
    const canc = pays.filter(p => p.status === 'cancelled')
    const sum  = (a: any[]) => a.reduce((s, p) => s + Number(p.amount), 0)
    const porMes = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
      const m = d.getMonth(); const y = d.getFullYear()
      const mp = paid.filter(p => { const pd = new Date(p.paid_at || p.created_at); return pd.getMonth() === m && pd.getFullYear() === y })
      return { mes: MESES[m], total: sum(mp) }
    })
    const porMetodo = METHODS.map((m, i) => ({ name: m.charAt(0).toUpperCase() + m.slice(1), value: sum(paid.filter(p => p.payment_method === m)), color: COLORS[i] })).filter(m => m.value > 0)
    setStats({ total: sum(paid), cobros: paid.length, pendiente: sum(pend), cancelados: canc.length, porMes, porMetodo })
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const now = new Date()
      let desde = new Date()
      if (periodo === 'semana') desde.setDate(now.getDate() - 7)
      else if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1)
      else desde = new Date(now.getFullYear(), 0, 1)

      const [{ data: pays }, { data: kids }, { data: svcRates }] = await Promise.all([
        supabase.from('payments').select('*, children(name)').gte('created_at', desde.toISOString()).order('created_at', { ascending: false }).limit(500),
        supabase.from('children').select('id, name').eq('is_active', true).order('name'),
        supabase.from('service_rates').select('*').order('amount', { ascending: true }),
      ])
      const p = pays || []
      setPayments(p); setChildren(kids || []); setRates(svcRates || [])
      buildStats(p)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [periodo, buildStats])

  useEffect(() => { cargar() }, [cargar])

  // Real-time
  useEffect(() => {
    rtRef.current = supabase.channel('payments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
        setPayments(prev => {
          let u = prev
          if (payload.eventType === 'INSERT') u = [payload.new, ...prev]
          else if (payload.eventType === 'UPDATE') u = prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p)
          else if (payload.eventType === 'DELETE') u = prev.filter(p => p.id !== (payload.old as any).id)
          buildStats(u); return u
        })
      }).subscribe()
    return () => { if (rtRef.current) supabase.removeChannel(rtRef.current) }
  }, [buildStats])

  // ─── Payment form ───────────────────────────────────────────────────────────
  // modo: 'registrado' (paciente del sistema) | 'externo' (nombre libre, ej. evaluación inicial)
  const emptyForm = { child_id: '', external_name: '', modo: 'registrado' as 'registrado' | 'externo', amount: '', concept: '', method: 'efectivo', status: 'paid', notes: '', date: new Date().toISOString().split('T')[0] }
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const rateNames = rates.map(r => r.name)

  const handleSave = async () => {
    const esExterno = form.modo === 'externo'
    if (esExterno) {
      if (!form.external_name.trim()) { toast.error('Ingresa el nombre del niño/a'); return }
    } else {
      if (!form.child_id) { toast.error('Selecciona el paciente'); return }
    }
    if (!form.amount || isNaN(Number(form.amount))) { toast.error('Ingresa un monto válido'); return }
    if (!form.concept.trim()) { toast.error('Ingresa el concepto'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('payments').insert({
        child_id: esExterno ? null : form.child_id,
        paciente_externo: esExterno ? form.external_name.trim() : null,
        amount: Number(form.amount), concept: form.concept.trim(),
        payment_method: form.method, status: form.status, notes: form.notes || null,
        paid_at: form.status === 'paid' ? new Date(form.date).toISOString() : null,
        created_by: profile?.id,
      })
      if (error) throw error
      toast.success('Pago registrado'); setShowNew(false); setForm(emptyForm)
      await cargar()   // ← refrescar tabla para que el nuevo pago aparezca de inmediato
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ─── Package form ───────────────────────────────────────────────────────────
  const emptyPkg = {
    child_id: '', external_name: '', modo: 'registrado' as 'registrado' | 'externo',
    amount: '', concept: '', method: 'efectivo', status: 'paid',
    calMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  }
  const [pkg, setPkg] = useState(emptyPkg)
  const [pkgDates, setPkgDates] = useState<string[]>([]) // manually selected dates
  const [savingPkg, setSavingPkg] = useState(false)

  const handleSavePkg = async () => {
    const esExterno = pkg.modo === 'externo'
    if (esExterno) {
      if (!pkg.external_name.trim()) { toast.error('Ingresa el nombre del niño/a'); return }
    } else {
      if (!pkg.child_id) { toast.error('Selecciona el paciente'); return }
    }
    if (!pkg.amount || isNaN(Number(pkg.amount))) { toast.error('Ingresa el monto por sesión'); return }
    if (!pkg.concept.trim()) { toast.error('Ingresa el concepto'); return }
    if (pkgDates.length === 0) { toast.error('Selecciona al menos un día de sesión'); return }
    setSavingPkg(true)
    try {
      const inserts = pkgDates.map((date, i) => ({
        child_id: esExterno ? null : pkg.child_id,
        paciente_externo: esExterno ? pkg.external_name.trim() : null,
        amount: Number(pkg.amount),
        concept: `${pkg.concept.trim()} (${i+1}/${pkgDates.length})`,
        payment_method: pkg.method, status: pkg.status,
        paid_at: pkg.status === 'paid' ? new Date(date + 'T12:00:00').toISOString() : null,
        notes: `Paquete de ${pkgDates.length} sesiones seleccionadas manualmente`,
        created_by: profile?.id,
      }))
      const { error } = await supabase.from('payments').insert(inserts)
      if (error) throw error
      toast.success(`${pkgDates.length} pagos creados · S/ ${(Number(pkg.amount) * pkgDates.length).toFixed(2)} total`)
      setShowPkg(false); setPkg(emptyPkg); setPkgDates([])
      await cargar()   // ← refrescar tabla para que los nuevos pagos aparezcan de inmediato
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingPkg(false) }
  }

  // ─── Eliminar pago ──────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const handleDeletePago = async (p: any) => {
    const monto = `S/ ${Number(p.amount).toFixed(2)}`
    const nombre = p.children?.name || p.paciente_externo || 'paciente'
    if (!confirm(`¿Eliminar este pago de ${nombre}?\n\nConcepto: ${p.concept}\nMonto: ${monto}\n\nEsta acción no se puede deshacer.`)) return
    setDeletingId(p.id)
    // Optimistic update — sacar de la lista al instante
    const prev = payments
    const next = payments.filter(x => x.id !== p.id)
    setPayments(next); buildStats(next)
    try {
      const { error } = await supabase.from('payments').delete().eq('id', p.id)
      if (error) throw error
      toast.success('Pago eliminado')
    } catch (e: any) {
      // Rollback si falla
      setPayments(prev); buildStats(prev)
      toast.error('No se pudo eliminar: ' + e.message)
    } finally {
      setDeletingId(null)
    }
  }

  // Eliminar paquete completo (todos los pagos del grupo)
  const handleDeletePaquete = async (g: any) => {
    const total = `S/ ${g.total.toFixed(2)}`
    const cantidad = g.pays.length
    if (!confirm(`¿Eliminar el paquete completo de ${g.child}?\n\n${cantidad} sesión${cantidad !== 1 ? 'es' : ''} · ${total}\n\nEsta acción borrará TODOS los pagos del paquete y no se puede deshacer.`)) return
    const ids = g.pays.map((p: any) => p.id)
    const prev = payments
    const next = payments.filter(x => !ids.includes(x.id))
    setPayments(next); buildStats(next)
    try {
      const { error } = await supabase.from('payments').delete().in('id', ids)
      if (error) throw error
      toast.success(`Paquete eliminado (${cantidad} pago${cantidad !== 1 ? 's' : ''})`)
    } catch (e: any) {
      setPayments(prev); buildStats(prev)
      toast.error('No se pudo eliminar: ' + e.message)
    }
  }

  // ─── Rate CRUD ──────────────────────────────────────────────────────────────
  const emptyRate = { name: '', description: '', amount: '', duration_min: '60' }
  const [rateForm, setRateForm] = useState(emptyRate)
  const [savingRate, setSavingRate] = useState(false)

  const openRateForm = (r?: any) => {
    if (r) { setEditingRate(r); setRateForm({ name: r.name, description: r.description || '', amount: String(r.amount), duration_min: String(r.duration_min) }) }
    else { setEditingRate(null); setRateForm(emptyRate) }
    setShowRateForm(true)
  }

  const handleSaveRate = async () => {
    if (!rateForm.name.trim()) { toast.error('Ingresa el nombre del servicio'); return }
    if (!rateForm.amount || isNaN(Number(rateForm.amount))) { toast.error('Ingresa un monto válido'); return }
    setSavingRate(true)
    try {
      const payload = { name: rateForm.name.trim(), description: rateForm.description.trim() || null, amount: Number(rateForm.amount), duration_min: Number(rateForm.duration_min) || 60, is_active: true }
      if (editingRate) await supabase.from('service_rates').update(payload).eq('id', editingRate.id)
      else await supabase.from('service_rates').insert(payload)
      toast.success(editingRate ? 'Tarifa actualizada' : 'Tarifa creada')
      setShowRateForm(false); cargar()
    } catch (e: any) { toast.error(e.message) }
    finally { setSavingRate(false) }
  }

  const deleteRate = async (id: string) => {
    if (!confirm('¿Eliminar esta tarifa?')) return
    await supabase.from('service_rates').delete().eq('id', id)
    toast.success('Tarifa eliminada'); cargar()
  }

  // ─── Excel export via API ───────────────────────────────────────────────────
  const exportExcel = async () => {
    try {
      const params = new URLSearchParams()
      const now = new Date()
      let desde = new Date()
      if (periodo === 'semana') desde.setDate(now.getDate() - 7)
      else if (periodo === 'mes') desde = new Date(now.getFullYear(), now.getMonth(), 1)
      else desde = new Date(now.getFullYear(), 0, 1)
      params.set('desde', desde.toISOString())
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (search) params.set('search', search)
      const res = await fetch(`/api/pagos/export?${params}`)
      if (!res.ok) throw new Error('Error al generar el reporte')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a'); a.href = url
      a.download = `pagos_jugando_aprendo_${new Date().toISOString().slice(0,10)}.xlsx`; a.click()
      URL.revokeObjectURL(url); toast.success('Excel exportado')
    } catch (e: any) { toast.error(e.message) }
  }

  const filtered = payments.filter(p => {
    const q = search.toLowerCase()
    return (filterStatus === 'all' || p.status === filterStatus) &&
           (!q || (p.children?.name || p.paciente_externo || '').toLowerCase().includes(q) || (p.concept || '').toLowerCase().includes(q))
  })
  const grouped = groupByPatientMonth(filtered)

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm border-2 outline-none transition-all bg-[var(--muted-bg)] border-[var(--card-border)] text-[var(--text-primary)] focus:border-sky-500 focus:bg-[var(--card)]"

  // Autocomplete list for concept with price auto-fill
  const ConceptInput = ({ value, onChange, onPriceMatch }: { value: string; onChange: (v: string) => void; onPriceMatch?: (price: string) => void }) => (
    <div className="relative">
      <input value={value}
        onChange={e => {
          onChange(e.target.value)
          // Auto-detect price from rates
          if (onPriceMatch) {
            const matched = rates.find(r => r.name.toLowerCase() === e.target.value.toLowerCase())
            if (matched) onPriceMatch(String(matched.amount))
          }
        }}
        onBlur={e => {
          if (onPriceMatch) {
            const matched = rates.find(r => r.name.toLowerCase() === e.target.value.toLowerCase())
            if (matched) onPriceMatch(String(matched.amount))
          }
        }}
        placeholder="Ej: Sesión ABA, Evaluación..." className={inputCls} list="concepts-list" />
      <datalist id="concepts-list">
        {rates.map(r => <option key={r.id} value={r.name} />)}
        <option value="Sesión de terapia" />
        <option value="Evaluación inicial" />
        <option value="Consulta de seguimiento" />
        <option value="Material terapéutico" />
      </datalist>
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #10b981 0%, #0284c7 50%, #f59e0b 100%)' }} />
        <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Pagos y Facturación</h2>
            <p className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              Gestión de ingresos del centro
              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> En tiempo real
              </span>
            </p>
          </div>
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--card-border)' }}>
            {(['semana','mes','anio'] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className="px-4 py-2 text-xs font-bold transition-all"
                style={{ background: periodo === p ? '#0284c7' : 'var(--muted-bg)', color: periodo === p ? '#fff' : 'var(--text-muted)' }}>
                {p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Ingresos cobrados" value={loading ? '—' : `S/ ${stats.total.toFixed(2)}`}     sub="Pagos recibidos"    icon={DollarSign}   bar="#10b981" />
        <KPI label="Transacciones"     value={loading ? '—' : stats.cobros}                         sub="Cobros realizados"  icon={CheckCircle2} bar="#0284c7" />
        <KPI label="Por cobrar"        value={loading ? '—' : `S/ ${stats.pendiente.toFixed(2)}`}  sub="Pendiente de pago"  icon={Clock}        bar="#f59e0b" />
        <KPI label="Cancelados"        value={loading ? '—' : stats.cancelados}                     sub="Este período"       icon={XCircle}      bar="#ef4444" />
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────────── */}
      <div className="flex rounded-2xl p-1.5 border gap-1.5" style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
        {[
          { id: 'dashboard', label: 'Dashboard',    Icon: BarChart3 },
          { id: 'registros', label: 'Registros',    Icon: CreditCard },
          { id: 'agrupado',  label: 'Por paciente', Icon: Calendar },
          { id: 'tarifas',   label: 'Tarifas',      Icon: Package },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            style={{
              background: tab === t.id ? 'var(--card)' : 'transparent',
              color: tab === t.id ? '#0284c7' : 'var(--text-muted)',
              border: tab === t.id ? '1px solid var(--card-border)' : '1px solid transparent',
              boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            <t.Icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ──────────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Ingresos por mes</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Últimos 6 meses</p>
              </div>
              <TrendingUp size={16} style={{ color: '#10b981' }} />
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={stats.porMes} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={45} tickFormatter={v => `S/${v}`} />
                  <Tooltip formatter={(v: any) => [`S/ ${Number(v).toFixed(2)}`, 'Ingresos']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                    itemStyle={{ color: 'var(--text-secondary)' }}
                    cursor={{ fill: 'var(--muted-bg)' }} />
                  <Bar dataKey="total" fill="#0284c7" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--card-border)' }}>
              <div>
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Métodos de pago</h3>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Distribución de cobros</p>
              </div>
              <DollarSign size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div className="p-5">
              {stats.porMetodo.length === 0 ? (
                <div className="flex items-center justify-center h-[190px]">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos para este período</p>
                </div>
              ) : (
                <div className="flex items-center gap-5">
                  <ResponsiveContainer width="50%" height={190}>
                    <PieChart>
                      <Pie data={stats.porMetodo} cx="50%" cy="50%" innerRadius={48} outerRadius={75} dataKey="value" paddingAngle={3}>
                        {stats.porMetodo.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => `S/ ${Number(v).toFixed(2)}`}
                        contentStyle={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 11, color: 'var(--text-primary)', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                        labelStyle={{ color: 'var(--text-primary)', fontWeight: 700 }}
                        itemStyle={{ color: 'var(--text-secondary)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {stats.porMetodo.map(m => {
                      const tot = stats.porMetodo.reduce((a, x) => a + x.value, 0)
                      const pct = tot > 0 ? Math.round(m.value / tot * 100) : 0
                      return (
                        <div key={m.name}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{m.name}</span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>S/{m.value.toFixed(0)}</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
                            <div style={{ width: `${pct}%`, background: m.color, height: '100%', borderRadius: 999 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── REGISTROS ──────────────────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border flex-1 min-w-0"
              style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente o concepto..."
                className="flex-1 text-sm bg-transparent outline-none min-w-0" style={{ color: 'var(--text-primary)' }} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm border-2 outline-none flex-shrink-0"
              style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={exportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all hover:opacity-80 flex-shrink-0"
              style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
              <Download size={13} /> Excel
            </button>
            <button onClick={() => { setShowPkg(false); setShowNew(v => !v) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all flex-shrink-0"
              style={{ borderColor: '#0284c7', color: '#0284c7', background: showNew ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
              <Plus size={13} /> Pago único
            </button>
            <button onClick={() => { setShowNew(false); setShowPkg(v => !v) }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0 transition-all"
              style={{ background: showPkg ? '#0369a1' : '#0284c7' }}>
              <Package size={13} /> Paquete
            </button>
          </div>

          {/* Single payment form */}
          {showNew && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '2px solid var(--card-border)' }}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Registrar pago único</p>
                <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Paciente *">
                  {/* Toggle: paciente registrado vs nombre libre (no inscrito aún) */}
                  <div className="flex gap-1 mb-2">
                    <button type="button" onClick={() => setForm(f => ({ ...f, modo: 'registrado' }))}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border-2 transition ${form.modo === 'registrado' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>
                      Registrado
                    </button>
                    <button type="button" onClick={() => setForm(f => ({ ...f, modo: 'externo' }))}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border-2 transition ${form.modo === 'externo' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>
                      Sin inscribir
                    </button>
                  </div>
                  {form.modo === 'registrado' ? (
                    <select value={form.child_id} onChange={e => setForm(f => ({ ...f, child_id: e.target.value }))} className={inputCls}>
                      <option value="">Seleccionar...</option>
                      {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ) : (
                    <input value={form.external_name} onChange={e => setForm(f => ({ ...f, external_name: e.target.value }))}
                      placeholder="Nombre del niño/a (ej. evaluación inicial)" className={inputCls} />
                  )}
                </Field>
                <Field label="Concepto *">
                  <ConceptInput value={form.concept} onChange={v => setForm(f => ({ ...f, concept: v }))}
                    onPriceMatch={price => setForm(f => ({ ...f, amount: price }))} />
                </Field>
                <Field label="Monto (S/) *">
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className={inputCls} />
                </Field>
                <Field label="Fecha de pago">
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Método de pago">
                  <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className={inputCls}>
                    {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="Estado">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                    {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Notas (opcional)">
                    <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones adicionales..." className={inputCls} />
                  </Field>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowNew(false)} className="flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar pago
                </button>
              </div>
            </div>
          )}

          {/* Package form */}
          {showPkg && (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '2px solid #0284c7' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--card-border)', background: 'rgba(59,130,246,0.04)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center"><Package size={16} className="text-sky-600" /></div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Crear paquete de sesiones</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Selecciona fechas exactas en el calendario</p>
                  </div>
                </div>
                <button onClick={() => { setShowPkg(false); setPkgDates([]) }} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
              </div>

              <div className="p-5 space-y-4">
                {/* Row 1: Paciente, Concepto, Monto */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Paciente *">
                    <div className="flex gap-1 mb-2">
                      <button type="button" onClick={() => setPkg(p => ({ ...p, modo: 'registrado' }))}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border-2 transition ${pkg.modo === 'registrado' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>
                        Registrado
                      </button>
                      <button type="button" onClick={() => setPkg(p => ({ ...p, modo: 'externo' }))}
                        className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border-2 transition ${pkg.modo === 'externo' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'}`}>
                        Sin inscribir
                      </button>
                    </div>
                    {pkg.modo === 'registrado' ? (
                      <select value={pkg.child_id} onChange={e => setPkg(p => ({ ...p, child_id: e.target.value }))} className={inputCls}>
                        <option value="">Seleccionar...</option>
                        {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    ) : (
                      <input value={pkg.external_name} onChange={e => setPkg(p => ({ ...p, external_name: e.target.value }))}
                        placeholder="Nombre del niño/a" className={inputCls} />
                    )}
                  </Field>
                  <Field label="Concepto *">
                    <ConceptInput value={pkg.concept}
                      onChange={v => setPkg(p => ({ ...p, concept: v }))}
                      onPriceMatch={price => setPkg(p => ({ ...p, amount: price }))} />
                  </Field>
                  <Field label="Monto por sesión (S/) *">
                    <div className="relative">
                      <input type="number" value={pkg.amount} onChange={e => setPkg(p => ({ ...p, amount: e.target.value }))}
                        placeholder="0.00" className={inputCls} />
                      {pkg.concept && rates.find(r => r.name.toLowerCase() === pkg.concept.toLowerCase()) && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>Tarifa</span>
                      )}
                    </div>
                  </Field>
                </div>

                {/* Row 2: Método, Estado */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Método de pago">
                    <select value={pkg.method} onChange={e => setPkg(p => ({ ...p, method: e.target.value }))} className={inputCls}>
                      {METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                    </select>
                  </Field>
                  <Field label="Estado de los pagos">
                    <select value={pkg.status} onChange={e => setPkg(p => ({ ...p, status: e.target.value }))} className={inputCls}>
                      {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </Field>
                </div>

                {/* Calendar picker */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      Selecciona las fechas de sesión
                    </label>
                    <div className="flex items-center gap-2">
                      <button onClick={() => {
                        const [y, m] = pkg.calMonth.split('-').map(Number)
                        const prev = new Date(y, m - 2, 1)
                        setPkg(p => ({ ...p, calMonth: `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}` }))
                      }} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)', background: 'var(--muted-bg)' }}>‹</button>
                      <span className="text-xs font-bold px-2" style={{ color: 'var(--text-primary)' }}>
                        {(() => { const [y,m] = pkg.calMonth.split('-').map(Number); return `${MESES_LARGO[m-1]} ${y}` })()}
                      </span>
                      <button onClick={() => {
                        const [y, m] = pkg.calMonth.split('-').map(Number)
                        const next = new Date(y, m, 1)
                        setPkg(p => ({ ...p, calMonth: `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}` }))
                      }} className="p-1 rounded-lg hover:opacity-70" style={{ color: 'var(--text-muted)', background: 'var(--muted-bg)' }}>›</button>
                    </div>
                  </div>

                  {/* Calendar grid */}
                  {(() => {
                    const [y, m] = pkg.calMonth.split('-').map(Number)
                    const firstDay = new Date(y, m - 1, 1).getDay() // 0=Sun
                    const daysInMonth = new Date(y, m, 0).getDate()
                    const today = new Date().toISOString().split('T')[0]
                    const cells: (number | null)[] = [
                      ...Array(firstDay).fill(null),
                      ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
                    ]
                    // Pad to complete weeks
                    while (cells.length % 7 !== 0) cells.push(null)

                    return (
                      <div>
                        {/* Day headers */}
                        <div className="grid grid-cols-7 mb-1">
                          {DAYS_ES.map(d => (
                            <div key={d} className="text-center text-[10px] font-bold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
                          ))}
                        </div>
                        {/* Weeks */}
                        {Array.from({ length: cells.length / 7 }, (_, wi) => (
                          <div key={wi} className="grid grid-cols-7 gap-0.5 mb-0.5">
                            {cells.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                              if (!day) return <div key={di} />
                              const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                              const isSelected = pkgDates.includes(dateStr)
                              const isToday = dateStr === today
                              return (
                                <button key={di} type="button"
                                  onClick={() => setPkgDates(prev =>
                                    prev.includes(dateStr)
                                      ? prev.filter(d => d !== dateStr)
                                      : [...prev, dateStr].sort()
                                  )}
                                  className="flex items-center justify-center h-9 rounded-lg text-sm font-bold transition-all active:scale-95"
                                  style={{
                                    background: isSelected ? '#0284c7' : isToday ? 'rgba(59,130,246,0.08)' : 'transparent',
                                    color: isSelected ? '#fff' : isToday ? '#0284c7' : 'var(--text-primary)',
                                    border: isToday && !isSelected ? '1.5px solid #0284c7' : '1.5px solid transparent',
                                  }}>
                                  {day}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Summary */}
                  {pkgDates.length > 0 && (
                    <div className="flex items-center justify-between mt-3 px-3 py-2 rounded-xl" style={{ background: 'rgba(59,130,246,0.08)' }}>
                      <p className="text-xs font-bold" style={{ color: '#0284c7' }}>
                        {pkgDates.length} fecha{pkgDates.length !== 1 ? 's' : ''} seleccionada{pkgDates.length !== 1 ? 's' : ''}
                        {pkg.amount && ` · S/ ${(Number(pkg.amount) * pkgDates.length).toFixed(2)} total`}
                      </p>
                      <button onClick={() => setPkgDates([])}
                        className="text-[10px] font-bold hover:opacity-70" style={{ color: '#ef4444' }}>
                        Limpiar
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {pkgDates.length > 0 && pkg.concept && (
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                    <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'var(--muted-bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                        Vista previa {pkg.modo === 'externo' ? (pkg.external_name ? `— ${pkg.external_name}` : '') : (pkg.child_id ? `— ${children.find(c => c.id === pkg.child_id)?.name}` : '')}
                      </p>
                      <p className="text-xs font-bold" style={{ color: '#10b981' }}>
                        Total: S/ {(Number(pkg.amount || 0) * pkgDates.length).toFixed(2)}
                      </p>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {pkgDates.map((date, i) => {
                        const d = new Date(date + 'T12:00:00')
                        const lbl = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${String(d.getFullYear()).slice(2)}`
                        return (
                          <div key={date} className="flex items-center gap-3 px-4 py-2.5"
                            style={{ borderBottom: i < pkgDates.length - 1 ? '1px solid var(--card-border)' : 'none' }}>
                            <span className="text-[10px] font-bold w-8 text-center px-1 py-0.5 rounded flex-shrink-0"
                              style={{ background: 'rgba(59,130,246,0.1)', color: '#0284c7' }}>{DAYS_ES[d.getDay()]}</span>
                            <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                            <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{pkg.concept}</span>
                            <button onClick={() => setPkgDates(prev => prev.filter(x => x !== date))}
                              className="flex-shrink-0 hover:opacity-70" style={{ color: '#ef4444' }}>
                              <X size={12} />
                            </button>
                            <span className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                              S/ {Number(pkg.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowPkg(false); setPkgDates([]) }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold border-2"
                    style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>Cancelar</button>
                  <button onClick={handleSavePkg}
                    disabled={savingPkg || (pkg.modo === 'externo' ? !pkg.external_name.trim() : !pkg.child_id) || !pkg.amount || !pkg.concept || pkgDates.length === 0}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                    {savingPkg ? <Loader2 size={14} className="animate-spin" /> : <Repeat size={14} />}
                    {savingPkg ? 'Creando...' : pkgDates.length > 0 ? `Crear ${pkgDates.length} cobros` : 'Selecciona fechas'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Payments table */}

          {loading ? (
            <div className="flex justify-center py-14"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <DollarSign size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Sin pagos registrados en este período</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Usa los botones de arriba para registrar un pago</p>
            </div>
          ) : (
            <div className="rounded-2xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', overflow: 'visible' }}>
              <div className="hidden md:grid grid-cols-[1fr_1.5fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 text-[10px] font-bold rounded-t-2xl"
                style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', background: 'var(--muted-bg)' }}>
                <span>Paciente</span><span>Concepto</span><span>Monto</span><span>Método</span><span>Estado</span><span></span><span></span>
              </div>
              {filtered.map(p => {
                const st = STATUS_CFG[p.status] || { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
                return (
                  <div key={p.id} className="flex flex-col gap-2 px-4 py-3 md:grid md:grid-cols-[1fr_1.5fr_auto_auto_auto_auto_auto] md:gap-4 md:px-5 md:py-3.5 md:items-center transition-colors hover:bg-[var(--muted-bg)]"
                    style={{ borderBottom: '1px solid var(--card-border)' }}>
                    {/* Paciente (+ monto a la derecha en móvil) */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{p.children?.name || p.paciente_externo || '—'}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString('es-PE')}</p>
                      </div>
                      <p className="md:hidden text-sm font-bold whitespace-nowrap" style={{ color: '#10b981' }}>S/ {Number(p.amount).toFixed(2)}</p>
                    </div>
                    <p className="text-xs md:truncate" style={{ color: 'var(--text-secondary)' }}>
                      <span className="md:hidden font-semibold" style={{ color: 'var(--text-muted)' }}>Concepto: </span>{p.concept}
                    </p>
                    <p className="hidden md:block text-sm font-bold whitespace-nowrap" style={{ color: '#10b981' }}>S/ {Number(p.amount).toFixed(2)}</p>
                    <p className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>
                      <span className="md:hidden font-semibold" style={{ color: 'var(--text-muted)' }}>Método: </span>{p.payment_method}
                    </p>
                    {/* Estado + acciones — juntos en móvil, celdas en desktop */}
                    <div className="flex items-center gap-2 md:contents">
                    {/* Status — clickable to change */}
                    <div className="relative group">
                      <button className="text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap hover:opacity-80 transition-opacity"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label} ▾
                      </button>
                      <div className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden shadow-xl z-20 hidden group-hover:block"
                        style={{ background: 'var(--card)', border: '1px solid var(--card-border)', minWidth: 130 }}>
                        {Object.entries(STATUS_CFG).map(([k, v]) => (
                          <button key={k} onClick={async () => {
                            // Optimistic update — UI changes instantly
                            const prevPayments = payments
                            const updated = payments.map(x => x.id === p.id ? { ...x, status: k, paid_at: k === 'paid' ? new Date().toISOString() : null } : x)
                            setPayments(updated)
                            buildStats(updated)
                            const { error } = await supabase.from('payments').update({
                              status: k,
                              paid_at: k === 'paid' ? new Date().toISOString() : null,
                            }).eq('id', p.id)
                            if (!error) toast.success(`Actualizado a ${v.label}`)
                            else { setPayments(prevPayments); buildStats(prevPayments); toast.error('Error al actualizar') }
                          }}
                            className="w-full text-left px-3 py-2.5 text-xs font-bold flex items-center gap-2 hover:opacity-80 transition-opacity"
                            style={{ color: v.color, background: p.status === k ? v.bg : 'transparent', borderBottom: '1px solid var(--card-border)' }}>
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: v.color }} />
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`/api/pagos/recibo-pdf?id=${p.id}`, '_blank')}
                      title="Ver recibo"
                      className="p-1.5 rounded-lg transition-all hover:opacity-70 flex-shrink-0"
                      style={{ background: 'var(--muted-bg)', color: '#0284c7' }}>
                      <FileText size={13} />
                    </button>
                    <button
                      onClick={() => handleDeletePago(p)}
                      disabled={deletingId === p.id}
                      title="Eliminar pago"
                      className="p-1.5 rounded-lg transition-all hover:opacity-100 flex-shrink-0 disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', opacity: 0.7 }}>
                      {deletingId === p.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                    </div>
                  </div>
                )
              })}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'var(--muted-bg)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} registros</p>
                <p className="text-sm font-bold" style={{ color: '#10b981' }}>
                  Total: S/ {filtered.filter(p => p.status === 'paid').reduce((a, p) => a + Number(p.amount), 0).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── AGRUPADO POR PACIENTE ──────────────────────────────────────────────── */}
      {tab === 'agrupado' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-14"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
          ) : grouped.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <Calendar size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Sin registros</p>
            </div>
          ) : (grouped as any[]).map((g: any) => {
            const isOpen = expanded.has(g.key)
            return (
              <div key={g.key} className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                <button onClick={() => setExpanded(s => { const n = new Set(s); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n })}
                  className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-4 text-left hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ background: '#0284c7' }}>{g.child.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{g.child}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {g.isPackage && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(59,130,246,0.12)', color: '#0284c7' }}>Paquete</span>
                        )}
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{g.monthLabel} · {g.pays.length} sesión{g.pays.length !== 1 ? 'es' : ''}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                    <p className="text-base sm:text-xl font-bold whitespace-nowrap" style={{ color: '#10b981' }}>S/ {g.total.toFixed(2)}</p>
                    {/* Recibo del paquete completo */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        const ids = g.pays.map((p: any) => p.id).join(',')
                        window.open(`/api/pagos/recibo-paquete?ids=${ids}`, '_blank')
                      }}
                      title="Recibo del paquete completo"
                      className="p-2 rounded-lg transition-all hover:opacity-70 flex-shrink-0"
                      style={{ background: 'rgba(59,130,246,0.1)', color: '#0284c7' }}>
                      <FileText size={14} />
                    </button>
                    {/* Eliminar paquete completo */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeletePaquete(g) }}
                      title="Eliminar paquete completo"
                      className="p-2 rounded-lg transition-all hover:opacity-100 flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', opacity: 0.7 }}>
                      <Trash2 size={14} />
                    </button>
                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </button>
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--card-border)' }}>
                    {g.pays.map((p: any, pi: number) => {
                      const d = new Date(p.paid_at || p.created_at)
                      const lbl = `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()}`
                      const st = STATUS_CFG[p.status] || { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
                      return (
                        <div key={p.id} className="flex items-center gap-4 px-6 py-3"
                          style={{ borderBottom: pi < g.pays.length-1 ? '1px solid var(--card-border)' : 'none', background: 'var(--muted-bg)' }}>
                          <span className="text-xs font-mono font-bold w-20 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{lbl}</span>
                          <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{p.concept}</span>
                          <span className="text-sm font-bold flex-shrink-0" style={{ color: '#10b981' }}>S/ {Number(p.amount).toFixed(2)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg flex-shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                          <button
                            onClick={() => handleDeletePago(p)}
                            disabled={deletingId === p.id}
                            title="Eliminar este pago"
                            className="p-1 rounded-md transition-all hover:opacity-100 flex-shrink-0 disabled:opacity-50"
                            style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444', opacity: 0.7 }}>
                            {deletingId === p.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                          </button>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                      <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Total {g.monthLabel}</span>
                      <span className="text-lg font-bold" style={{ color: '#10b981' }}>S/ {g.total.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── TARIFAS EDITABLES ──────────────────────────────────────────────────── */}
      {tab === 'tarifas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              Define los servicios y tarifas de tu centro. Se usan como sugerencias al registrar pagos.
            </p>
            <button onClick={() => openRateForm()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 transition-all">
              <Plus size={13} /> Nueva tarifa
            </button>
          </div>

          {/* Rate form */}
          {showRateForm && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--card)', border: '2px solid #0284c7' }}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{editingRate ? 'Editar tarifa' : 'Nueva tarifa'}</p>
                <button onClick={() => setShowRateForm(false)} style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Field label="Nombre del servicio *">
                    <input value={rateForm.name} onChange={e => setRateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Sesión ABA Individual, Evaluación, Consulta..." className={inputCls} />
                  </Field>
                </div>
                <Field label="Descripción">
                  <input value={rateForm.description} onChange={e => setRateForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Descripción opcional del servicio" className={inputCls} />
                </Field>
                <Field label="Duración (minutos)">
                  <input type="number" value={rateForm.duration_min} onChange={e => setRateForm(f => ({ ...f, duration_min: e.target.value }))}
                    placeholder="60" className={inputCls} />
                </Field>
                <Field label="Precio (S/) *">
                  <input type="number" value={rateForm.amount} onChange={e => setRateForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" className={inputCls} />
                </Field>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowRateForm(false)} className="flex-1 py-3 rounded-xl text-sm font-bold border-2" style={{ borderColor: 'var(--card-border)', color: 'var(--text-muted)' }}>Cancelar</button>
                <button onClick={handleSaveRate} disabled={savingRate}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingRate ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingRate ? 'Actualizar' : 'Crear tarifa'}
                </button>
              </div>
            </div>
          )}

          {/* Rates grid */}
          {rates.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              <Settings2 size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Sin tarifas configuradas</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Agrega las tarifas de tu centro para usarlas como referencia rápida</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rates.map((r, i) => (
                <div key={r.id} className="rounded-2xl p-5 group relative" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  <div className="flex items-start justify-between pl-2 mb-3">
                    <p className="text-sm font-bold leading-tight flex-1 pr-2" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => openRateForm(r)}
                        className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                        style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => deleteRate(r.id)}
                        className="p-1.5 rounded-lg transition-colors hover:opacity-70"
                        style={{ background: '#fee2e2', color: '#ef4444' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <p className="text-2xl font-bold pl-2" style={{ color: COLORS[i % COLORS.length] }}>S/ {Number(r.amount).toFixed(2)}</p>
                  <div className="flex items-center gap-3 mt-2 pl-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--muted-bg)', color: 'var(--text-muted)' }}>{r.duration_min} min</span>
                    {r.description && <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>{r.description}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
