'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingBag, ShoppingCart, Plus, Minus, X, Package, Star,
  CheckCircle, Clock, Truck, XCircle, ChevronRight, Loader2,
  Phone, Filter, Search, ImageIcon, ArrowLeft, FileText, Tag
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  nombre: string
  descripcion: string
  precio_soles: number
  stock: number
  categoria: string
  tipo: 'fisico' | 'digital'
  imagen_url: string | null
  destacado: boolean
}

interface CartItem { product: Product; cantidad: number }

interface Order {
  id: string
  total_soles: number
  estado: string
  notas: string
  created_at: string
  store_order_items: any[]
}

const ESTADO_CFG: Record<string, any> = {
  pendiente:  { label: 'Pendiente de confirmación', icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  confirmado: { label: 'Confirmado',                icon: CheckCircle, color: 'text-sky-600',    bg: 'bg-sky-50',    border: 'border-sky-200'  },
  listo:      { label: '¡Listo para recoger!',      icon: Package,     color: 'text-sky-600',  bg: 'bg-sky-50',  border: 'border-sky-200'},
  entregado:  { label: 'Entregado',                 icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200'},
  cancelado:  { label: 'Cancelado',                 icon: XCircle,     color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200'   },
}

// ── Carrito flotante ──────────────────────────────────────────────────────────
function CartDrawer({ cart, onClose, onUpdate, onCheckout }: any) {
  const total = cart.reduce((s: number, i: CartItem) => s + i.product.precio_soles * i.cantidad, 0)
  const { t, locale } = useI18n()
  const [nota, setNota] = useState('')
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState(false)

  const handleCheckout = async () => {
    setPlacing(true)
    const ok = await onCheckout(nota)
    if (ok) setDone(true)
    setPlacing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md h-full flex flex-col shadow-2xl" style={{ background: "var(--c-card)" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid var(--c-border)" }}>
          <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: "var(--c-text-primary)" }}>
            <ShoppingCart size={20} className="text-sky-600 dark:text-sky-400" /> Mi carrito
            {cart.length > 0 && <span className="text-xs bg-sky-600 text-white px-2 py-0.5 rounded-full">{cart.length}</span>}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl transition-all" style={{ background: "var(--c-surface)" }}>
            <X size={20} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
          </button>
        </div>

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
              <CheckCircle size={40} className="text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold mb-2" style={{ color: "var(--c-text-primary)" }}>{t('tienda.pedidoEnviado')}</h3>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--c-text-muted)" }}>
              Tu pedido fue registrado. Nos pondremos en contacto contigo para confirmar el pago y la entrega.
            </p>
            <a href="https://wa.me/51994196916" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all">
              <Phone size={16} /> Coordinar por WhatsApp
            </a>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{ background: "var(--c-surface)" }}>
              <ShoppingCart size={36} className="text-slate-300" />
            </div>
            <p className="font-bold mb-1" style={{ color: "var(--c-text-muted)" }}>{t('ui.cart_empty')}</p>
            <p className="text-sm" style={{ color: "var(--c-text-muted)" }}>{t('ui.add_items')}</p>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cart.map(({ product: p, cantidad }: CartItem) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)" }}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0" style={{ background: "var(--c-surface)" }}>
                    {p.imagen_url
                      ? <img src={p.imagen_url} alt={p.nombre} className="absolute inset-0 w-full h-full object-cover" />
                      : <Package size={20} className="text-slate-300 m-auto mt-3.5" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight truncate" style={{ color: "var(--c-text-primary)" }}>{p.nombre}</p>
                    <p className="text-xs text-sky-600 dark:text-sky-400 font-bold mt-0.5">S/ {(p.precio_soles * cantidad).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => onUpdate(p.id, cantidad - 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
                      <Minus size={12} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
                    </button>
                    <span className="w-6 text-center font-bold text-sm" style={{ color: "var(--c-text-primary)" }}>{cantidad}</span>
                    <button onClick={() => onUpdate(p.id, cantidad + 1)}
                      disabled={p.tipo === 'fisico' && cantidad >= p.stock}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
                      <Plus size={12} className="text-slate-500 dark:text-slate-400 dark:text-slate-500" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Nota */}
              <div className="pt-2">
                <label className="block text-xs font-bold mb-2" style={{ color: "var(--c-text-muted)" }}>{t('familias.notaCentro')}</label>
                <textarea
                  value={nota} onChange={e => setNota(e.target.value)}
                  rows={2} placeholder={t("tienda.pedidoGuardar")}
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all resize-none" style={{ background: "var(--c-surface)", border: "1px solid var(--c-border)", color: "var(--c-text-primary)" }}
                />
              </div>

              {/* Info pago */}
              <div className="rounded-xl p-4" style={{ background: "var(--c-stat-blue)", border: "1px solid var(--c-border)" }}>
                <p className="text-xs font-bold text-sky-500 mb-1">{t('tienda.comoPaga')}</p>
                <p className="text-xs text-sky-500 leading-relaxed">
                  El pago se realiza al recoger el pedido en el centro (efectivo o yape). Para artículos digitales te enviaremos el archivo por WhatsApp tras confirmar el pago.
                </p>
              </div>
            </div>

            {/* Footer con total y botón */}
            <div className="p-5 space-y-3" style={{ borderTop: "1px solid var(--c-border)" }}>
              <div className="flex justify-between items-center">
                <span className="font-bold" style={{ color: "var(--c-text-secondary)" }}>{t('ui.total_to_pay')}</span>
                <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">S/ {total.toFixed(2)}</span>
              </div>
              <button onClick={handleCheckout} disabled={placing}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white font-bold text-base rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-sky-200">
                {placing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />}
                {placing ? 'Enviando pedido...' : 'Confirmar pedido'}
              </button>
              <p className="text-center text-xs" style={{ color: "var(--c-text-muted)" }}>
                Al confirmar, el centro recibirá tu pedido y te contactará
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Vista principal de la tienda ──────────────────────────────────────────────
export default function StoreView({ profile }: { profile: any }) {
  const { t, locale } = useI18n()
  const [view, setView] = useState<'catalogo' | 'mis-pedidos'>('catalogo')
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [filterCat, setFilterCat] = useState('todos')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [addedId, setAddedId] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const { data } = await supabase
      .from('store_products')
      .select('*')
      .eq('activo', true)
      .order('destacado', { ascending: false })
      .order('created_at', { ascending: false })
    setProducts(data || [])
  }, [])

  const loadOrders = useCallback(async () => {
    if (!profile?.id) return
    const { data } = await supabase
      .from('store_orders')
      .select('*, store_order_items(*)')
      .eq('parent_id', profile.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
  }, [profile?.id])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([loadProducts(), loadOrders()])
      setLoading(false)
    }
    load()
  }, [loadProducts, loadOrders])

  const addToCart = (product: Product) => {
    setCart(prev => {
      const exists = prev.find(i => i.product.id === product.id)
      if (exists) return prev.map(i => i.product.id === product.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { product, cantidad: 1 }]
    })
    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 1500)
  }

  const updateCart = (productId: string, cantidad: number) => {
    if (cantidad <= 0) setCart(prev => prev.filter(i => i.product.id !== productId))
    else setCart(prev => prev.map(i => i.product.id === productId ? { ...i, cantidad } : i))
  }

  const checkout = async (nota: string) => {
    if (!profile?.id) return false
    const total = cart.reduce((s, i) => s + i.product.precio_soles * i.cantidad, 0)
    try {
      const { data: order, error } = await supabase.from('store_orders').insert({
        parent_id: profile.id,
        parent_name: profile.full_name || '',
        parent_email: profile.email || '',
        parent_phone: profile.phone || '',
        total_soles: total,
        estado: 'pendiente',
        notas: nota,
      }).select().single()
      if (error) throw error

      const items = cart.map(i => ({
        order_id: order.id,
        product_id: i.product.id,
        product_nombre: i.product.nombre,
        product_imagen: i.product.imagen_url || '',
        cantidad: i.cantidad,
        precio_unitario: i.product.precio_soles,
      }))
      await supabase.from('store_order_items').insert(items)

      // Reducir stock de productos físicos
      for (const item of cart) {
        if (item.product.tipo === 'fisico') {
          await supabase.from('store_products').update({ stock: item.product.stock - item.cantidad }).eq('id', item.product.id)
        }
      }

      setCart([])
      await loadOrders()
      return true
    } catch (e) { return false }
  }

  const categorias = ['todos', ...new Set(products.map(p => p.categoria))]
  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0)

  const filtered = products.filter(p => {
    const ms = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.descripcion?.toLowerCase().includes(search.toLowerCase())
    const mt = filterTipo === 'todos' || p.tipo === filterTipo
    const mc = filterCat === 'todos' || p.categoria === filterCat
    return ms && mt && mc
  })

  const destacados = filtered.filter(p => p.destacado)
  const resto = filtered.filter(p => !p.destacado)

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={32} className="animate-spin text-sky-600 dark:text-sky-400" />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 32, width: '100%' }}>
      <style>{`
        .sv-products-grid,.sv-featured-grid,.sv-orders-grid{display:grid!important;grid-template-columns:repeat(1,1fr)!important;gap:12px!important}
        @media(min-width:480px){
          .sv-products-grid,.sv-featured-grid,.sv-orders-grid{grid-template-columns:repeat(2,1fr)!important}
        }
        @media(min-width:1024px){
          .sv-products-grid,.sv-featured-grid{grid-template-columns:repeat(3,1fr)!important}
        }
      `}</style>

      {/* ── Clean header with tabs ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4" style={{ borderBottom: "1px solid var(--c-border)" }}>
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--c-text-primary)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--c-stat-blue)", border: "1px solid var(--c-border)" }}>
              <ShoppingBag size={15} className="text-sky-600 dark:text-sky-400"/>
            </div>
            {view === 'catalogo' ? 'Tienda' : 'Mis pedidos'}
          </h2>
          <p className="text-xs mt-0.5 ml-10" style={{ color: "var(--c-text-muted)" }}>
            {view === 'catalogo' ? `${products.length} productos disponibles` : `${orders.length} pedido${orders.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Cart button */}
          {view === 'catalogo' && cartCount > 0 && (
            <button onClick={() => setShowCart(true)}
              className="flex items-center gap-2 px-3 py-2 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 transition-colors">
              <ShoppingCart size={15}/> {cartCount}
            </button>
          )}
          {/* Toggle view */}
          <div className="flex rounded-xl p-1 gap-1" style={{ background: "var(--c-surface)" }}>
            <button onClick={() => setView('catalogo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all`} style={{ background: view === "catalogo" ? "var(--c-card)" : "transparent", color: view === "catalogo" ? "var(--c-text-primary)" : "var(--c-text-muted)" }}>
              Catálogo
            </button>
            <button onClick={() => setView('mis-pedidos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5`} style={{ background: view === "mis-pedidos" ? "var(--c-card)" : "transparent", color: view === "mis-pedidos" ? "var(--c-text-primary)" : "var(--c-text-muted)" }}>
              📦 Pedidos
              {orders.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: view === 'mis-pedidos' ? '#0284c7' : 'var(--c-surface)', color: view === 'mis-pedidos' ? '#fff' : 'var(--c-text-muted)' }}>
                  {orders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── CATÁLOGO ── */}
      {view === 'catalogo' && (
        <>
          {/* Búsqueda y filtros */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} {...{placeholder: t('ui.search_material')}}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium outline-none focus:border-sky-400 transition-all shadow-sm" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)", color: "var(--c-text-primary)" }}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['todos', 'fisico', 'digital'].map(f => (
                <button key={f} onClick={() => setFilterTipo(f)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${filterTipo === f ? 'bg-sky-600 text-white border-sky-600' : 'hover:border-sky-300'}`} style={filterTipo === f ? {} : { background: 'var(--c-card)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                  {f === 'todos' ? 'Todo' : f === 'fisico' ? '📦 Físicos' : '📄 Digitales'}
                </button>
              ))}
              <div className="w-px self-stretch mx-1" style={{ background: "var(--c-border)" }} />
              {categorias.map(c => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${filterCat === c ? 'bg-slate-700 text-white border-slate-700' : 'hover:border-slate-300'}`} style={filterCat === c ? {} : { background: 'var(--c-card)', color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                  {c === 'todos' ? 'Categorías' : c}
                </button>
              ))}
            </div>
          </div>

          {/* Destacados */}
          {destacados.length > 0 && search === '' && filterTipo === 'todos' && filterCat === 'todos' && (
            <div>
              <p className="text-xs font-bold mb-3 flex items-center gap-2" style={{ color: "var(--c-text-muted)" }}>
                <Star size={12} className="text-amber-400 fill-amber-400" /> Destacados
              </p>
              <div className="sv-featured-grid">
                {destacados.map(p => (
                  <ProductCard key={p.id} product={p} onAdd={addToCart} onDetail={setSelectedProduct} justAdded={addedId === p.id} inCart={cart.find(i => i.product.id === p.id)?.cantidad || 0} featured />
                ))}
              </div>
            </div>
          )}

          {/* Todos los productos */}
          {resto.length > 0 || (filtered.length > 0 && destacados.length === 0) ? (
            <div>
              {destacados.length > 0 && search === '' && filterTipo === 'todos' && filterCat === 'todos' && (
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-3">{t('ui.all_items')}</p>
              )}
              <div className="sv-products-grid">
                {(destacados.length > 0 && search === '' && filterTipo === 'todos' && filterCat === 'todos' ? resto : filtered).map(p => (
                  <ProductCard key={p.id} product={p} onAdd={addToCart} onDetail={setSelectedProduct} justAdded={addedId === p.id} inCart={cart.find(i => i.product.id === p.id)?.cantidad || 0} />
                ))}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl py-20 text-center" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
              <ShoppingBag size={36} className="text-slate-200 mx-auto mb-3" />
              <p className="font-bold text-slate-400 dark:text-slate-500">{t('ui.no_items_found')}</p>
              <button onClick={() => { setSearch(''); setFilterTipo('todos'); setFilterCat('todos') }}
                className="mt-3 text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline">
                Limpiar filtros
              </button>
            </div>
          ) : null}

          {/* Info tienda */}
          <div className="bg-gradient-to-r from-sky-50 to-cyan-50 rounded-2xl border border-sky-100 dark:border-sky-800/50 p-5 flex gap-4 items-start">
            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center shrink-0">
              <Package size={18} className="text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="font-bold text-sky-800 text-sm mb-1">{t('tienda.comoFuncTienda')}</p>
              <p className="text-xs text-sky-500 leading-relaxed">
                {t('ui.physical_items_note')}
                Los <strong>{t('ui.digitales')}</strong> te los enviamos por WhatsApp tras confirmar el pago.
                ¿Dudas? Escríbenos al <a href="https://wa.me/51994196916" className="underline font-bold">+51 994 196 916</a>.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── MIS PEDIDOS ── */}
      {view === 'mis-pedidos' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="rounded-2xl py-20 text-center" style={{ background: "var(--c-card)", border: "1px solid var(--c-border)" }}>
              <ShoppingBag size={36} className="text-slate-200 mx-auto mb-3" />
              <p className="font-bold mb-1" style={{ color: "var(--c-text-muted)" }}>{t('tienda.sinPedidos')}</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">{t('tienda.exploraCompra')}</p>
              <button onClick={() => setView('catalogo')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white font-bold text-sm rounded-xl hover:bg-sky-700 transition-all">
                Ir a la tienda →
              </button>
            </div>
          ) : orders.map(order => {
            const cfg = ESTADO_CFG[order.estado] || ESTADO_CFG.pendiente
            const StatusIcon = cfg.icon
            return (
              <div key={order.id} className={`rounded-2xl border-2 overflow-hidden ${cfg.border}`} style={{ background: "var(--c-card)" }}>
                <div className={`${cfg.bg} px-5 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <StatusIcon size={15} className={cfg.color} />
                    <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(order.created_at).toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  {(order.store_order_items || []).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#21262d] shrink-0">
                        {item.product_imagen
                          ? <img src={item.product_imagen} alt="" className="w-full h-full object-cover" />
                          : <Package size={18} className="text-slate-300 m-auto mt-3" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{item.product_nombre}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">x{item.cantidad} · S/ {Number(item.precio_unitario).toFixed(2)} c/u</p>
                      </div>
                      <p className="font-bold text-slate-700 dark:text-slate-200">S/ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-slate-100 dark:border-[#21262d] flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 font-medium">Total pagado</span>
                    <span className="text-xl font-bold text-sky-600 dark:text-sky-400">S/ {Number(order.total_soles).toFixed(2)}</span>
                  </div>
                  {order.notas && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Tu nota: "{order.notas}"</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Carrito */}
      {showCart && (
        <CartDrawer cart={cart} onClose={() => setShowCart(false)} onUpdate={updateCart} onCheckout={checkout} />
      )}

      {/* Detalle producto */}
      {selectedProduct && (
        <ProductDetail product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} inCart={cart.find(i => i.product.id === selectedProduct.id)?.cantidad || 0} justAdded={addedId === selectedProduct.id} />
      )}
    </div>
  )
}

// ── Tarjeta de producto ───────────────────────────────────────────────────────
function ProductCard({ product: p, onAdd, onDetail, justAdded, inCart, featured }: any) {
  const { t } = useI18n()
  const sinStock = p.tipo === 'fisico' && p.stock === 0
  return (
    <div className="rounded-2xl border-2 overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer" style={{ background: "var(--c-card)", borderColor: featured ? "rgba(251,191,36,0.4)" : "var(--c-border)" }}>
      {/* Imagen */}
      <div style={{ background: "var(--muted-bg)", height: 160, overflow: 'hidden', position: 'relative' }} onClick={() => onDetail(p)}>
        {p.imagen_url
          ? <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ImageIcon size={28} className="text-slate-300" /></div>
        }
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${p.tipo === 'digital' ? 'bg-sky-600' : 'bg-slate-700'}`}>
            {p.tipo === 'digital' ? '📄' : '📦'}
          </span>
          {featured && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400 text-white">⭐</span>}
        </div>
        {sinStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">Sin stock</span>
          </div>
        )}
        {p.tipo === 'fisico' && p.stock > 0 && p.stock <= 3 && (
          <div className="absolute bottom-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Solo {p.stock}</div>
        )}
      </div>

      <div className="p-3 sm:p-4">
        <p className="font-bold text-xs sm:text-sm leading-tight mb-1 line-clamp-2" style={{ color: "var(--c-text-primary)" }} onClick={() => onDetail(p)}>{p.nombre}</p>
        <p className="text-[10px] sm:text-xs line-clamp-2 mb-2 sm:mb-3 leading-relaxed" style={{ color: "var(--c-text-muted)" }}>{p.descripcion}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm sm:text-lg font-bold text-sky-500">S/ {Number(p.precio_soles).toFixed(2)}</span>
          <button onClick={() => !sinStock && onAdd(p)} disabled={sinStock}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${justAdded ? 'bg-emerald-600 text-white scale-95' : sinStock ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-200'}`}>
            {justAdded ? <><CheckCircle size={13} /> {t('ui.added_short')}</> : <><ShoppingCart size={13} /> {inCart > 0 ? `${t('ui.in_cart')} (${inCart})` : t('common.agregar')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detalle de producto (modal) ───────────────────────────────────────────────
function ProductDetail({ product: p, onClose, onAdd, inCart, justAdded }: any) {
  const { t } = useI18n()
  const sinStock = p.tipo === 'fisico' && p.stock === 0
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end', justifyContent:'center', padding:0 }} onClick={onClose}>
      <div style={{ background:'var(--c-card)', width:'100%', maxWidth:480, borderRadius:'24px 24px 0 0', maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden' }} onClick={e => e.stopPropagation()}>
        
        {/* Imagen compacta */}
        <div style={{ position:'relative', height:160, flexShrink:0, background:'var(--c-surface)', overflow:'hidden' }}>
          {p.imagen_url
            ? <img src={p.imagen_url} alt={p.nombre} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            : <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}><ImageIcon size={36} color="var(--c-text-muted)" /></div>
          }
          <button onClick={onClose} style={{ position:'absolute', top:12, right:12, width:36, height:36, borderRadius:10, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--c-card)' }}>
            <X size={16} color="var(--c-text-primary)" />
          </button>
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6 }}>
            <span style={{ fontSize:10, fontWeight:800, padding:'3px 10px', borderRadius:20, color:'#fff', background: p.tipo === 'digital' ? '#0284c7' : '#475569' }}>
              {p.tipo === 'digital' ? '📄 Digital' : '📦 Físico'}
            </span>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div style={{ padding:'16px 20px 20px', overflowY:'auto', flex:1 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:8 }}>
            <h3 style={{ fontWeight:900, fontSize:17, color:'var(--c-text-primary)', margin:0, lineHeight:1.3, flex:1 }}>{p.nombre}</h3>
            <span style={{ fontWeight:900, fontSize:20, color:'#0284c7', flexShrink:0 }}>S/ {Number(p.precio_soles).toFixed(2)}</span>
          </div>

          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--c-surface)', color:'var(--c-text-secondary)', textTransform:'capitalize' }}>{p.categoria}</span>
            {p.tipo === 'fisico' && <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background: p.stock > 3 ? 'rgba(16,185,129,0.12)' : p.stock > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)', color: p.stock > 3 ? '#10b981' : p.stock > 0 ? '#f59e0b' : '#ef4444' }}>
              {p.stock === 0 ? 'Sin stock' : `${p.stock} disponibles`}
            </span>}
            {p.tipo === 'digital' && <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'var(--c-stat-purple)', color:'#0ea5e9' }}>Descarga inmediata</span>}
          </div>

          <p style={{ fontSize:13, color:'var(--c-text-secondary)', lineHeight:1.6, marginBottom:14 }}>{p.descripcion || 'Sin descripción disponible.'}</p>

          {p.tipo === 'digital' && (
            <div style={{ background:'var(--c-stat-purple)', border:'1px solid var(--c-border)', borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
              <p style={{ fontSize:11, fontWeight:800, color:'#0ea5e9', margin:'0 0 4px' }}>📄 {t('tienda.articuloDigital')}</p>
              <p style={{ fontSize:11, color:'var(--c-text-muted)', margin:0, lineHeight:1.5 }}>Al confirmar tu pedido y pagar, recibirás el archivo por WhatsApp en menos de 24 horas.</p>
            </div>
          )}

          <button onClick={() => !sinStock && onAdd(p)} disabled={sinStock}
            style={{ width:'100%', padding:'14px', borderRadius:16, border:'none', cursor: sinStock ? 'not-allowed' : 'pointer', fontWeight:900, fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'all .2s',
              background: justAdded ? '#10b981' : sinStock ? 'var(--c-surface)' : '#0284c7',
              color: sinStock ? 'var(--c-text-muted)' : '#fff' }}>
            {justAdded ? <><CheckCircle size={16} /> {t('ui.added_to_cart')}</> : sinStock ? t('ui.out_of_stock') : <><ShoppingCart size={16} /> {inCart > 0 ? `${t('ui.add_another')} (${inCart})` : t('ui.add_to_cart')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
