'use client'

import { useI18n } from '@/lib/i18n-context'
import { useState, useEffect, useCallback } from 'react'
import {
  Book, Video, FileText, Link as LinkIcon, Image as ImageIcon, Music,
  ExternalLink, X, Loader2, RefreshCw, Bell, Search,
  ShoppingBag, ShoppingCart, Plus, Minus, Package, CheckCircle,
  Clock, Truck, XCircle as XCir, Tag, Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/components/ThemeContext'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Resource { id: string; title: string; description: string; resource_type: string; url: string; is_global: boolean; parent_id: string | null; tags: string[]; created_at: string }
interface Product { id: string; nombre: string; descripcion: string; precio_soles: number; stock: number; categoria: string; tipo: 'fisico'|'digital'; imagen_url: string|null; destacado: boolean }
interface CartItem { product: Product; cantidad: number }
interface Order { id: string; total_soles: number; estado: string; notas: string; created_at: string; store_order_items: any[] }

const TYPE_CFG: Record<string,{ icon: any; color: string; bg: string; border: string; label: string }> = {
  video:    { icon: Video,      color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Video' },
  pdf:      { icon: FileText,   color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'PDF' },
  link:     { icon: LinkIcon,   color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', label: 'Enlace' },
  image:    { icon: ImageIcon,  color: '#059669', bg: '#f0fdf4', border: '#bbf7d0', label: 'Imagen' },
  document: { icon: Book,       color: '#d97706', bg: '#fffbeb', border: '#fde68a', label: 'Material' },
  audio:    { icon: Music,      color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', label: 'Audio' },
}

const ESTADO_CFG: Record<string,any> = {
  pendiente:  { label:'Pendiente', Icon:Clock,     color:'#d97706', bg:'var(--c-stat-amber)', border:'#fde68a' },
  confirmado: { label:'Confirmado', Icon:CheckCircle, color:'#2563eb', bg:'var(--c-stat-blue)', border:'#bfdbfe' },
  listo:      { label:'Listo para recoger', Icon:Package, color:'#7c3aed', bg:'var(--c-stat-purple)', border:'#ddd6fe' },
  entregado:  { label:'Entregado', Icon:CheckCircle, color:'#059669', bg:'var(--c-stat-green)', border:'#bbf7d0' },
  cancelado:  { label:'Cancelado', Icon:XCir,     color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
}

// ── Carrito ────────────────────────────────────────────────────────────────
function CartDrawer({ cart, onClose, onUpdate, onCheckout }: any) {
  const total = cart.reduce((s: number, i: CartItem) => s + i.product.precio_soles * i.cantidad, 0)
  const [nota, setNota] = useState('')
  const [placing, setPlacing] = useState(false)
  const [done, setDone] = useState(false)

  const handleCheckout = async () => {
    setPlacing(true); const ok = await onCheckout(nota); if (ok) setDone(true); setPlacing(false)
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:50,display:'flex',justifyContent:'flex-end' }} onClick={onClose}>
      <div style={{ position:'absolute',inset:0,background:'rgba(0,0,0,.5)',backdropFilter:'blur(4px)' }}/>
      <div style={{ position:'relative',background:'var(--c-card)',width:'100%',maxWidth:420,height:'100%',display:'flex',flexDirection:'column',boxShadow:'-20px 0 60px rgba(0,0,0,.15)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 24px',borderBottom:'1px solid var(--c-border-light)' }}>
          <h3 style={{ fontWeight:900,fontSize:18,color:'var(--c-text-primary)',margin:0,display:'flex',alignItems:'center',gap:8 }}>
            <ShoppingCart size={20} color="#3b82f6"/> Mi carrito
            {cart.length>0&&<span style={{ background:'#3b82f6',color:'#ffffff',fontSize:11,fontWeight:800,padding:'2px 8px',borderRadius:20 }}>{cart.length}</span>}
          </h3>
          <button onClick={onClose} style={{ padding:8,background:'var(--c-surface)',border:'none',borderRadius:12,cursor:'pointer' }}><X size={18} color="var(--c-text-muted)"/></button>
        </div>
        {done ? (
          <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,textAlign:'center' }}>
            <div style={{ width:80,height:80,background:'var(--c-stat-green)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20 }}><CheckCircle size={40} color="#16a34a"/></div>
            <h3 style={{ fontWeight:900,fontSize:22,color:'var(--c-text-primary)',marginBottom:8 }}>¡Pedido enviado!</h3>
            <p style={{ fontSize:14,color:'var(--c-text-muted)',lineHeight:1.6 }}>El equipo del centro lo revisará y te contactará.</p>
          </div>
        ) : (
          <>
            <div style={{ flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12 }}>
              {cart.length===0 ? (
                <div style={{ textAlign:'center',padding:'40px 0' }}>
                  <ShoppingCart size={40} color="var(--c-text-placeholder)" style={{ margin:'0 auto 12px',display:'block' }}/>
                  <p style={{ color:'var(--c-text-placeholder)',fontSize:14 }}>Tu carrito está vacío</p>
                </div>
              ) : cart.map((item: CartItem) => (
                <div key={item.product.id} style={{ display:'flex',gap:12,padding:'12px',background:'var(--c-surface)',borderRadius:14 }}>
                  <div style={{ width:48,height:48,background:'linear-gradient(135deg,#eff6ff,#dbeafe)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                    <ShoppingBag size={20} color="#3b82f6"/>
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <p style={{ fontWeight:700,fontSize:13,color:'var(--c-text-primary)',margin:'0 0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{item.product.nombre}</p>
                    <p style={{ fontSize:12,color:'#7c3aed',fontWeight:800,margin:0 }}>S/ {(item.product.precio_soles*item.cantidad).toFixed(2)}</p>
                  </div>
                  <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                    <button onClick={()=>onUpdate(item.product.id,item.cantidad-1)} style={{ width:26,height:26,borderRadius:8,background:'var(--c-border)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Minus size={12} color="var(--c-text-muted)"/></button>
                    <span style={{ fontSize:13,fontWeight:800,color:'var(--c-text-primary)',minWidth:20,textAlign:'center' }}>{item.cantidad}</span>
                    <button onClick={()=>onUpdate(item.product.id,item.cantidad+1)} style={{ width:26,height:26,borderRadius:8,background:'#dbeafe',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Plus size={12} color="#3b82f6"/></button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length>0&&(
              <div style={{ padding:'16px 20px',borderTop:'1px solid var(--c-border-light)' }}>
                <input value={nota} onChange={e=>setNota(e.target.value)} placeholder="Nota para el centro (opcional)" style={{ width:'100%',padding:'10px 14px',background:'var(--c-surface)',border:'1.5px solid var(--c-border)',borderRadius:12,fontSize:13,outline:'none',marginBottom:12,boxSizing:'border-box',fontFamily:'inherit' }}/>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                  <span style={{ fontSize:14,color:'var(--c-text-muted)' }}>Total</span>
                  <span style={{ fontSize:20,fontWeight:900,color:'var(--c-text-primary)' }}>S/ {total.toFixed(2)}</span>
                </div>
                <button onClick={handleCheckout} disabled={placing} style={{ width:'100%',padding:'14px',background:'linear-gradient(135deg,#3b82f6,#2563eb)',color:'#ffffff',border:'none',borderRadius:14,fontSize:14,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}>
                  {placing?<Loader2 size={16} style={{ animation:'spin 1s linear infinite' }}/>:<ShoppingBag size={16}/>}
                  {placing?'Enviando...':'Confirmar pedido'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
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
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────────────────────
interface Props { profile: any }

export default function ResourcesView({ profile }: Props) {
  const { isDark } = useTheme()
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'biblioteca'|'tienda'>('biblioteca')
  // Biblioteca
  const [resources, setResources] = useState<Resource[]>([])
  const [loadingRes, setLoadingRes] = useState(true)
  const [selectedRes, setSelectedRes] = useState<Resource|null>(null)
  const [searchRes, setSearchRes] = useState('')
  const [filterType, setFilterType] = useState('all')
  // Tienda
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loadingStore, setLoadingStore] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [searchProd, setSearchProd] = useState('')
  const [addedId, setAddedId] = useState<string|null>(null)
  const [storeTab, setStoreTab] = useState<'catalogo'|'pedidos'>('catalogo')

  // Load biblioteca
  const loadResources = async () => {
    if (!profile?.id) return
    setLoadingRes(true)
    try {
      const { data: myChildren } = await supabase.from('children').select('id').eq('parent_id', profile.id)
      const childIds = (myChildren||[]).map((c:any)=>c.id)
      let orClause = `is_global.eq.true,parent_id.eq.${profile.id}`
      childIds.forEach((cid:string) => { orClause += `,child_id.eq.${cid}` })
      const { data } = await supabase.from('parent_resources').select('*').or(orClause).order('created_at',{ ascending:false })
      setResources(data||[])
    } catch {}
    setLoadingRes(false)
  }

  // Load tienda
  const loadStore = useCallback(async () => {
    setLoadingStore(true)
    const [{ data: prods }, { data: ords }] = await Promise.all([
      supabase.from('store_products').select('*').eq('activo',true).order('destacado',{ascending:false}).order('created_at',{ascending:false}),
      profile?.id ? supabase.from('store_orders').select('*, store_order_items(*)').eq('parent_id',profile.id).order('created_at',{ascending:false}) : Promise.resolve({ data:[] }),
    ])
    setProducts(prods||[])
    setOrders((ords as any)||[])
    setLoadingStore(false)
  }, [profile?.id])

  useEffect(() => { loadResources() }, [profile?.id])
  useEffect(() => { loadStore() }, [loadStore])

  const filteredRes = resources.filter(r => {
    const matchType = filterType==='all'||r.resource_type===filterType
    const matchSearch = !searchRes||r.title.toLowerCase().includes(searchRes.toLowerCase())||r.description?.toLowerCase().includes(searchRes.toLowerCase())
    return matchType && matchSearch
  })
  const filteredProds = products.filter(p => !searchProd||p.nombre.toLowerCase().includes(searchProd.toLowerCase())||p.descripcion?.toLowerCase().includes(searchProd.toLowerCase()))
  const featuredProds = filteredProds.filter(p=>p.destacado)
  const regularProds = filteredProds.filter(p=>!p.destacado)

  const addToCart = (product: Product) => {
    setCart(prev => { const ex=prev.find(i=>i.product.id===product.id); return ex?prev.map(i=>i.product.id===product.id?{...i,cantidad:i.cantidad+1}:i):[...prev,{product,cantidad:1}] })
    setAddedId(product.id); setTimeout(()=>setAddedId(null),1500)
  }
  const updateCart = (productId: string, cantidad: number) => {
    if (cantidad<=0) setCart(prev=>prev.filter(i=>i.product.id!==productId))
    else setCart(prev=>prev.map(i=>i.product.id===productId?{...i,cantidad}:i))
  }
  const checkout = async (nota: string) => {
    if (!profile?.id) return false
    const total = cart.reduce((s,i)=>s+i.product.precio_soles*i.cantidad,0)
    try {
      const { data: order, error } = await supabase.from('store_orders').insert({ parent_id:profile.id, parent_name:profile.full_name||'', parent_email:profile.email||'', parent_phone:profile.phone||'', total_soles:total, estado:'pendiente', notas:nota }).select().single()
      if (error) throw error
      await supabase.from('store_order_items').insert(cart.map(i=>({ order_id:order.id, product_id:i.product.id, product_nombre:i.product.nombre, product_imagen:i.product.imagen_url||'', cantidad:i.cantidad, precio_unitario:i.product.precio_soles })))
      setCart([]); await loadStore(); return true
    } catch { return false }
  }

  const isYouTube = (url:string) => url?.includes('youtube.com')||url?.includes('youtu.be')
  const getEmbedUrl = (url:string) => { const m=url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/); return m?`https://www.youtube.com/embed/${m[1]}`:url }

  const cartCount = cart.reduce((s,i)=>s+i.cantidad,0)

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:14,paddingBottom:32,width:'100%' }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .rv-card{animation:fadeUp .35s ease both}
        @media(min-width:640px){
          .rv-res-grid{grid-template-columns:repeat(2,1fr)!important;display:grid!important}
          .rv-prod-grid{grid-template-columns:repeat(2,1fr)!important;display:grid!important}
          .rv-feat-grid{grid-template-columns:repeat(2,1fr)!important;display:grid!important}
        }
        @media(min-width:1024px){
          .rv-res-grid{grid-template-columns:repeat(3,1fr)!important}
        }
      `}</style>

      {showCart&&<CartDrawer cart={cart} onClose={()=>setShowCart(false)} onUpdate={updateCart} onCheckout={checkout}/>}

      {/* HERO */}
      <div className="rv-card" style={{ background:activeTab==='biblioteca'?'linear-gradient(135deg,#7c3aed,#4f46e5,#6366f1)':'linear-gradient(135deg,#2563eb,#3b82f6,#0ea5e9)',borderRadius:28,padding:'22px 24px',color:'#ffffff',boxShadow:activeTab==='biblioteca'?'0 16px 50px rgba(124,58,237,.3)':'0 16px 50px rgba(59,130,246,.3)',position:'relative',overflow:'hidden',transition:'background .4s ease' }}>
        <div style={{ position:'absolute',top:-20,right:-20,width:130,height:130,background:'rgba(255,255,255,.08)',borderRadius:'50%' }}/>
        <div style={{ position:'relative',zIndex:1,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
              {activeTab==='biblioteca'?<Book size={15} style={{ opacity:.8 }}/>:<ShoppingBag size={15} style={{ opacity:.8 }}/>}
              <span style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1.2,color:'rgba(255,255,255,.7)' }}>{activeTab==='biblioteca'?'Biblioteca':'Tienda'}</span>
            </div>
            <h2 style={{ fontSize:20,fontWeight:900,margin:'0 0 4px' }}>{activeTab==='biblioteca'?'Materiales del centro':'Productos y materiales'}</h2>
            <p style={{ fontSize:12,color:'rgba(255,255,255,.65)',margin:0 }}>{activeTab==='biblioteca'?`${resources.length} recurso${resources.length!==1?'s':''} disponibles`:`${products.length} producto${products.length!==1?'s':''} en catálogo`}</p>
          </div>
          {activeTab==='tienda'&&cartCount>0&&(
            <button onClick={()=>setShowCart(true)} style={{ display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,.2)',border:'none',color:'#ffffff',borderRadius:14,padding:'8px 14px',cursor:'pointer',fontFamily:'inherit',fontWeight:700,fontSize:13 }}>
              <ShoppingCart size={16}/> {cartCount}
            </button>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="rv-card" style={{ display:'flex',background:'var(--c-border-light)',padding:4,borderRadius:18,gap:4 }}>
        {[{key:'biblioteca',icon:<Book size={15}/>,label:'Biblioteca'},{key:'tienda',icon:<ShoppingBag size={15}/>,label:'Tienda'}].map(({key,icon,label})=>(
          <button key={key} onClick={()=>setActiveTab(key as any)} style={{ flex:1,padding:'11px 16px',borderRadius:14,border:'none',fontWeight:700,fontSize:13,cursor:'pointer',transition:'all .2s',display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontFamily:'inherit',
            background:activeTab===key?'var(--c-card)':'transparent',
            color:activeTab===key?'#4f46e5':'var(--c-text-placeholder)',
            boxShadow:activeTab===key?'0 2px 8px rgba(0,0,0,.08)':'none' }}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ─── BIBLIOTECA ─── */}
      {activeTab==='biblioteca'&&(
        <>
          {/* Búsqueda */}
          <div className="rv-card" style={{ position:'relative' }}>
            <Search size={15} color="var(--c-text-placeholder)" style={{ position:'absolute',left:14,top:'50%',transform:'translateY(-50%)' }}/>
            <input type="text" placeholder="Buscar materiales..." value={searchRes} onChange={e=>setSearchRes(e.target.value)} style={{ width:'100%',padding:'12px 14px 12px 38px',background:'var(--c-card)',border:'1.5px solid var(--c-border)',borderRadius:14,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit',transition:'border-color .15s' }} onFocus={e=>(e.target as any).style.borderColor='#7c3aed'} onBlur={e=>(e.target as any).style.borderColor='var(--c-border)'}/>
          </div>
          {/* Filtros */}
          <div className="rv-card" style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
            <button onClick={()=>setFilterType('all')} style={{ padding:'6px 12px',borderRadius:20,border:`1.5px solid ${filterType==='all'?'#7c3aed':'var(--c-border)'}`,fontSize:12,fontWeight:700,cursor:'pointer',background:filterType==='all'?'#7c3aed':'var(--c-card)',color:filterType==='all'?'var(--c-card)':'var(--c-text-muted)' }}>Todos</button>
            {Object.entries(TYPE_CFG).map(([key,cfg])=>(
              <button key={key} onClick={()=>setFilterType(key)} style={{ padding:'6px 12px',borderRadius:20,border:`1.5px solid ${filterType===key?cfg.border:'var(--c-border)'}`,fontSize:12,fontWeight:700,cursor:'pointer',background:filterType===key?cfg.bg:'var(--c-card)',color:filterType===key?cfg.color:'var(--c-text-muted)',display:'flex',alignItems:'center',gap:4 }}>
                <cfg.icon size={12}/>{cfg.label}
              </button>
            ))}
          </div>
          {loadingRes ? (
            <div style={{ display:'flex',justifyContent:'center',padding:'40px 0' }}><Loader2 size={32} color="#7c3aed" style={{ animation:'spin 1s linear infinite' }}/></div>
          ) : filteredRes.length===0 ? (
            <div style={{ background:'var(--c-card)',borderRadius:24,border:'1.5px solid var(--c-border-light)',padding:'48px 24px',textAlign:'center' }}>
              <div style={{ width:64,height:64,background:'var(--c-stat-purple)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}><Book size={28} color="#c4b5fd"/></div>
              <p style={{ fontWeight:700,fontSize:14,color:'var(--c-text-muted)',margin:'0 0 6px' }}>{resources.length===0?'Sin recursos por ahora':'No se encontraron resultados'}</p>
              <p style={{ fontSize:12,color:'var(--c-text-placeholder)' }}>{resources.length===0?'El equipo terapéutico compartirá materiales pronto':'Prueba con otro término de búsqueda'}</p>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {filteredRes.map(r=>{
                const cfg=TYPE_CFG[r.resource_type]||TYPE_CFG.document; const Icon=cfg.icon; const isPersonal=!r.is_global
                return (
                  <div key={r.id} className="rv-card" onClick={()=>setSelectedRes(r)} style={{ background:'var(--c-card)',borderRadius:20,border:`1.5px solid ${isPersonal?'#ede9fe':'var(--c-border-light)'}`,padding:'14px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,transition:'all .15s',boxShadow:'0 2px 12px rgba(0,0,0,.04)' }}
                    onMouseEnter={e=>{(e.currentTarget as any).style.transform='translateY(-1px)';(e.currentTarget as any).style.boxShadow='0 8px 24px rgba(0,0,0,.08)'}}
                    onMouseLeave={e=>{(e.currentTarget as any).style.transform='translateY(0)';(e.currentTarget as any).style.boxShadow='0 2px 12px rgba(0,0,0,.04)'}}>
                    <div style={{ width:44,height:44,background:cfg.bg,border:`1.5px solid ${cfg.border}`,borderRadius:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><Icon size={20} color={cfg.color}/></div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2,flexWrap:'wrap' }}>
                        <p style={{ fontWeight:800,fontSize:13,color:'var(--c-text-primary)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:200 }}>{r.title}</p>
                        {isPersonal&&<span style={{ fontSize:9,fontWeight:800,padding:'2px 6px',background:'var(--c-stat-purple)',color:'#7c3aed',border:'1px solid var(--c-border)',borderRadius:20,display:'flex',alignItems:'center',gap:3,flexShrink:0 }}><Bell size={8}/>Para ti</span>}
                      </div>
                      {r.description&&<p style={{ fontSize:12,color:'var(--c-text-placeholder)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.description}</p>}
                      <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:20,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`,display:'inline-block',marginTop:4 }}>{cfg.label}</span>
                    </div>
                    <ExternalLink size={16} color="var(--c-text-placeholder)" style={{ flexShrink:0 }}/>
                  </div>
                )
              })}
            </div>
          )}

          {/* Modal recurso */}
          {selectedRes&&(()=>{
            const cfg=TYPE_CFG[selectedRes.resource_type]||TYPE_CFG.document; const Icon=cfg.icon
            return (
              <div style={{ position:'fixed',inset:0,background:'rgba(15,23,42,.7)',backdropFilter:'blur(6px)',zIndex:50,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:'0 0 0 0' }}>
                <div style={{ background:'var(--c-card)',width:'100%',maxWidth:600,borderRadius:'24px 24px 0 0',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 -30px 80px rgba(0,0,0,.2)' }}>
                  <div style={{ background:`linear-gradient(135deg,#7c3aed,#4f46e5)`,padding:'20px 24px',color:'#ffffff',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                      <div style={{ padding:10,background:'rgba(255,255,255,.2)',borderRadius:14 }}><Icon size={20}/></div>
                      <div><p style={{ color:'rgba(255,255,255,.7)',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:1,margin:'0 0 2px' }}>{cfg.label}</p><h3 style={{ fontWeight:900,fontSize:17,margin:0,lineHeight:1.2 }}>{selectedRes.title}</h3></div>
                    </div>
                    <button onClick={()=>setSelectedRes(null)} style={{ padding:8,background:'rgba(255,255,255,.2)',border:'none',borderRadius:12,cursor:'pointer',flexShrink:0 }}><X size={18} color="var(--c-card)"/></button>
                  </div>
                  <div style={{ overflowY:'auto',flex:1,padding:20,display:'flex',flexDirection:'column',gap:14 }}>
                    {selectedRes.description&&<p style={{ fontSize:13,color:'var(--c-text-muted)',lineHeight:1.6,background:'var(--c-surface)',borderRadius:16,padding:'14px 16px',margin:0 }}>{selectedRes.description}</p>}
                    {selectedRes.tags?.length>0&&<div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>{selectedRes.tags.map(tg=><span key={tg} style={{ padding:'4px 12px',background:'var(--c-stat-purple)',color:'#7c3aed',fontSize:12,fontWeight:700,borderRadius:20,border:'1px solid var(--c-border)' }}>{tg}</span>)}</div>}
                    {selectedRes.resource_type==='video'&&isYouTube(selectedRes.url)&&<div style={{ aspectRatio:'16/9',background:'var(--c-border-light)',borderRadius:16,overflow:'hidden' }}><iframe width="100%" height="100%" src={getEmbedUrl(selectedRes.url)} title={selectedRes.title} frameBorder="0" allowFullScreen/></div>}
                    <a href={selectedRes.url} target="_blank" rel="noopener noreferrer" style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'14px',background:'linear-gradient(135deg,#7c3aed,#4f46e5)',color:'#ffffff',borderRadius:16,fontWeight:800,fontSize:14,textDecoration:'none' }}><ExternalLink size={16}/>Abrir {cfg.label}</a>
                  </div>
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* ─── TIENDA ─── */}
      {activeTab==='tienda'&&(
        <>
          {/* Sub-tabs */}
          <div className="rv-card" style={{ display:'flex',background:'var(--c-border-light)',padding:4,borderRadius:16,gap:4 }}>
            {[{k:'catalogo',l:'🛍️ Catálogo'},{k:'pedidos',l:'📦 Mis pedidos'}].map(({k,l})=>(
              <button key={k} onClick={()=>setStoreTab(k as any)} style={{ flex:1,padding:'9px 12px',borderRadius:12,border:'none',fontWeight:700,fontSize:12,cursor:'pointer',transition:'all .15s',fontFamily:'inherit',background:storeTab===k?'var(--c-card)':'transparent',color:storeTab===k?'#2563eb':'var(--c-text-placeholder)',boxShadow:storeTab===k?'0 2px 8px rgba(0,0,0,.08)':'none' }}>{l}</button>
            ))}
          </div>

          {loadingStore ? (
            <div style={{ display:'flex',justifyContent:'center',padding:'40px 0' }}><Loader2 size={32} color="#3b82f6" style={{ animation:'spin 1s linear infinite' }}/></div>
          ) : storeTab==='catalogo' ? (
            <>
              {/* Búsqueda */}
              <div style={{ position:'relative' }}>
                <Search size={15} color="var(--c-text-placeholder)" style={{ position:'absolute',left:14,top:'50%',transform:'translateY(-50%)' }}/>
                <input type="text" placeholder="Buscar productos..." value={searchProd} onChange={e=>setSearchProd(e.target.value)} style={{ width:'100%',padding:'12px 14px 12px 38px',background:'var(--c-card)',border:'1.5px solid var(--c-border)',borderRadius:14,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit' }} onFocus={e=>(e.target as any).style.borderColor='#3b82f6'} onBlur={e=>(e.target as any).style.borderColor='var(--c-border)'}/>
              </div>
              {/* Destacados */}
              {featuredProds.length>0&&(
                <div>
                  <p style={{ fontSize:11,fontWeight:800,color:'var(--c-text-placeholder)',textTransform:'uppercase',letterSpacing:1,margin:'0 0 10px' }}>⭐ Destacados</p>
                  <div className="rv-feat-grid" style={{ display:'flex',flexDirection:'column',gap:10 }}>
                    {featuredProds.map(p=>{
                      const inCart=cart.some(i=>i.product.id===p.id); const justAdded=addedId===p.id
                      return (
                        <div key={p.id} style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)',borderRadius:20,border:'1.5px solid var(--c-border)',padding:'16px',display:'flex',alignItems:'center',gap:14 }}>
                          <div style={{ width:52,height:52,background:'var(--c-card)',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 12px rgba(59,130,246,.15)' }}><ShoppingBag size={24} color="#3b82f6"/></div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <p style={{ fontWeight:800,fontSize:14,color:'var(--c-text-primary)',margin:'0 0 2px' }}>{p.nombre}</p>
                            <p style={{ fontSize:12,color:'var(--c-text-muted)',margin:'0 0 6px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{p.descripcion}</p>
                            <p style={{ fontSize:16,fontWeight:900,color:'#2563eb',margin:0 }}>S/ {p.precio_soles.toFixed(2)}</p>
                          </div>
                          <button onClick={()=>addToCart(p)} disabled={p.stock===0} style={{ padding:'10px 16px',background:justAdded?'#f0fdf4':inCart?'#eff6ff':'linear-gradient(135deg,#3b82f6,#2563eb)',color:justAdded?'#16a34a':inCart?'#3b82f6':'var(--c-card)',border:justAdded?'1.5px solid #bbf7d0':inCart?'1.5px solid #bfdbfe':'none',borderRadius:12,fontSize:12,fontWeight:800,cursor:p.stock===0?'not-allowed':'pointer',flexShrink:0,fontFamily:'inherit' }}>
                            {justAdded?'✓ Agregado':inCart?'En carrito':'Agregar'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* Catálogo regular */}
              {regularProds.length>0&&(
                <div>
                  {featuredProds.length>0&&<p style={{ fontSize:11,fontWeight:800,color:'var(--c-text-placeholder)',textTransform:'uppercase',letterSpacing:1,margin:'0 0 10px' }}>Todo el catálogo</p>}
                  <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                    {regularProds.map(p=>{
                      const inCart=cart.some(i=>i.product.id===p.id); const justAdded=addedId===p.id
                      return (
                        <div key={p.id} style={{ background:'var(--c-card)',borderRadius:18,border:'1.5px solid var(--c-border-light)',padding:'14px 16px',display:'flex',alignItems:'center',gap:12 }}>
                          <div style={{ width:44,height:44,background:'var(--c-surface)',borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><ShoppingBag size={20} color="var(--c-text-placeholder)"/></div>
                          <div style={{ flex:1,minWidth:0 }}>
                            <p style={{ fontWeight:700,fontSize:13,color:'var(--c-text-primary)',margin:'0 0 2px' }}>{p.nombre}</p>
                            <p style={{ fontSize:14,fontWeight:900,color:'#7c3aed',margin:0 }}>S/ {p.precio_soles.toFixed(2)}</p>
                          </div>
                          <button onClick={()=>addToCart(p)} disabled={p.stock===0} style={{ padding:'8px 14px',background:justAdded?'#f0fdf4':inCart?'#f5f3ff':'var(--c-surface)',color:justAdded?'#16a34a':inCart?'#7c3aed':'var(--c-text-primary)',border:`1.5px solid ${justAdded?'#bbf7d0':inCart?'#ddd6fe':'var(--c-border)'}`,borderRadius:10,fontSize:12,fontWeight:700,cursor:p.stock===0?'not-allowed':'pointer',flexShrink:0,fontFamily:'inherit' }}>
                            {justAdded?'✓':inCart?'En carrito':'+ Agregar'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {filteredProds.length===0&&(
                <div style={{ background:'var(--c-card)',borderRadius:24,border:'1.5px solid var(--c-border-light)',padding:'48px 24px',textAlign:'center' }}>
                  <div style={{ width:64,height:64,background:'var(--c-stat-blue)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}><ShoppingBag size={28} color="#93c5fd"/></div>
                  <p style={{ fontWeight:700,fontSize:14,color:'var(--c-text-muted)',margin:'0 0 6px' }}>Sin productos disponibles</p>
                  <p style={{ fontSize:12,color:'var(--c-text-placeholder)' }}>El catálogo se actualizará pronto</p>
                </div>
              )}
              {/* Carrito flotante */}
              {cartCount>0&&(
                <div style={{ position:'sticky',bottom:16,zIndex:40 }}>
                  <button onClick={()=>setShowCart(true)} style={{ width:'100%',padding:'14px 20px',background:'linear-gradient(135deg,#2563eb,#3b82f6)',color:'#ffffff',border:'none',borderRadius:18,fontSize:14,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:'0 8px 24px rgba(37,99,235,.4)',fontFamily:'inherit' }}>
                    <ShoppingCart size={18}/> Ver carrito · {cartCount} producto{cartCount!==1?'s':''} · S/ {cart.reduce((s,i)=>s+i.product.precio_soles*i.cantidad,0).toFixed(2)}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Mis pedidos */
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {orders.length===0 ? (
                <div style={{ background:'var(--c-card)',borderRadius:24,border:'1.5px solid var(--c-border-light)',padding:'48px 24px',textAlign:'center' }}>
                  <div style={{ width:64,height:64,background:'var(--c-stat-blue)',borderRadius:18,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px' }}><Package size={28} color="#93c5fd"/></div>
                  <p style={{ fontWeight:700,fontSize:14,color:'var(--c-text-muted)',margin:'0 0 6px' }}>Sin pedidos realizados</p>
                  <p style={{ fontSize:12,color:'var(--c-text-placeholder)' }}>Tus pedidos aparecerán aquí</p>
                </div>
              ) : orders.map(order=>{
                const cfg=ESTADO_CFG[order.estado]||ESTADO_CFG.pendiente; const Icon=cfg.Icon
                return (
                  <div key={order.id} style={{ background:'var(--c-card)',borderRadius:20,border:`1.5px solid ${cfg.border}`,padding:'16px',boxShadow:'0 2px 12px rgba(0,0,0,.04)' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                      <span style={{ display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:cfg.bg,color:cfg.color }}><Icon size={12}/>{cfg.label}</span>
                      <span style={{ fontSize:11,color:'var(--c-text-placeholder)' }}>{new Date(order.created_at).toLocaleDateString('es',{day:'2-digit',month:'short'})}</span>
                    </div>
                    {order.store_order_items?.map((item:any,i:number)=>(
                      <div key={i} style={{ fontSize:13,color:'var(--c-text-muted)',padding:'4px 0',borderBottom:i<order.store_order_items.length-1?'1px solid var(--c-border-light)':'none' }}>
                        {item.product_nombre} × {item.cantidad}
                      </div>
                    ))}
                    <div style={{ display:'flex',justifyContent:'flex-end',marginTop:10 }}>
                      <span style={{ fontSize:16,fontWeight:900,color:'var(--c-text-primary)' }}>S/ {order.total_soles?.toFixed(2)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
