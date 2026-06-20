'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import {
  Heart, Users, MapPin, CheckCircle, ArrowRight, HelpCircle,
  Brain, Calendar, Sparkles, LineChart, MessageSquareHeart,
  Star, Clock, Phone, Mail, Instagram, Facebook, ChevronDown,
  Quote, Image as ImageIcon,
  BookOpen, ClipboardList, Bell, Shield, ChevronLeft, ChevronRight, X, Zap, Globe
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'

// ═══════════════════════════════════════════════════════════════
//  EDITA TUS VIDEOS AQUÍ — soporta YouTube, TikTok, Drive, Vimeo
// ═══════════════════════════════════════════════════════════════
const VIDEOS = [
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title_es: '¿Qué es la terapia ABA?',
    desc_es: 'Conoce la metodología que usamos en cada sesión',
    title_en: 'What is ABA therapy?',
    desc_en: 'Learn about the methodology we use in every session',
  },
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title_es: 'Testimonio: Familia Rodríguez',
    desc_es: 'Una mamá comparte su experiencia con nosotros',
    title_en: 'Testimonial: The Rodríguez Family',
    desc_en: 'A mother shares her experience with us',
  },
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title_es: 'Cómo funciona nuestra plataforma',
    desc_es: 'Tour rápido por la app para padres',
    title_en: 'How our platform works',
    desc_en: 'A quick tour of the parent app',
  },
]

// ── Content / translations ────────────────────────────────────
const CONTENT = {
  es: {
    nav: {
      parents: 'Para Padres',
      aria: 'Asistente ARIA',
      services: 'Servicios',
      gallery: 'Galería',
      faq: 'Preguntas',
      login: 'Ingresar',
    },
    hero: {
      badge: 'Terapia · Tecnología · Amor',
      headline1: 'Impulsando el potencial de',
      headline2: 'mentes brillantes.',
      subtitle: 'Centro especializado en neurodivergencia en Pisco. Combinamos terapia ABA basada en evidencia, seguimiento digital en tiempo real y la calidez de nuestro equipo.',
      ctaWa: 'Contáctanos',
      ctaLearn: '¿Qué ofrecemos?',
      chip1: 'Metodología ABA',
      chip2: '+50 Familias',
      chip3: 'IA Incluida',
      personalized: 'Personalizado',
    },
    stats: [
      { num: '+{n}', lbl: 'Familias felices', icon: '👨‍👩‍👧' },
      { num: '100%', lbl: 'Personalizado', icon: '🎯' },
      { num: 'ABA', lbl: 'Metodología', icon: '🧠' },
      { num: 'Pisco', lbl: 'Sede Central', icon: '📍' },
    ],
    parents: {
      tag: 'Para las familias',
      title: 'Todo lo que brindamos\na los padres',
      sub: 'Acompañar a tu hijo es un camino compartido. Herramientas digitales y humanas para que siempre estés informado, empoderado y parte activa del proceso.',
      cta: 'Accede a la plataforma de padres',
    },
    benefits: [
      { title: 'Reportes diarios', desc: 'Resumen claro de cada sesión con logros y observaciones.' },
      { title: 'Gráficos de progreso', desc: 'Evolución de tu hijo semana a semana en habilidades y conducta.' },
      { title: 'Chat con especialistas', desc: 'Comunícate directamente con el equipo terapéutico desde la app.' },
      { title: 'ARIA 24/7', desc: 'Nuestra IA analiza datos y te da sugerencias personalizadas.' },
      { title: 'Agenda de citas', desc: 'Reserva y confirma sesiones en un solo lugar, sin llamadas.' },
      { title: 'Biblioteca de recursos', desc: 'Guías, videos y actividades ABA para reforzar en casa.' },
      { title: 'Notificaciones', desc: 'Alertas de progreso, citas y mensajes en tiempo real.' },
      { title: 'Datos protegidos', desc: 'Información 100% segura con estándares clínicos.' },
    ],
    testimonials: {
      tag: 'Familias reales',
      title: 'Resultados que hablan por sí solos',
      cta: 'Quiero resultados para mi hijo/a',
      items: [
        { name: 'María G.', desc: 'Mamá de Rodrigo, 6 años · TEA Nivel 2', a: 'M', color: '#f97316', text: 'En 3 meses mi hijo empezó a comunicarse con frases completas. Los reportes con IA nos ayudan a entender su progreso sin tecnicismos. ¡Los recomiendo al 100%!' },
        { name: 'Carlos R.', desc: 'Papá de Valentina, 4 años · TDAH', a: 'C', color: '#10b981', text: 'Lo que más me sorprendió fue poder seguir el avance semana a semana desde mi celular. El asistente IA nos da consejos para trabajar en casa. Valentina ha mejorado muchísimo.' },
        { name: 'Rosa T.', desc: 'Mamá de Mateo, 5 años · TEA Nivel 1', a: 'R', color: '#8b5cf6', text: 'Al principio tenía miedo de no entender los términos clínicos. La terapeuta y el sistema de reportes lo explican todo de manera muy sencilla. Me siento acompañada.' },
      ],
    },
    aria: {
      tag: 'Inteligencia Artificial',
      title: 'Conoce a',
      highlight: 'ARIA',
      sub: 'Tu asistente clínica inteligente. Aprende de los registros diarios de tu hijo y te acompaña 24/7 entre sesiones.',
      cta: 'Habla con ARIA ahora',
      online: 'En línea · 24/7',
      features: [
        { title: 'Seguimiento Preciso', desc: 'ARIA analiza tendencias conductuales sesión a sesión.' },
        { title: 'Apoyo 24/7', desc: 'Resúmenes sencillos y recomendaciones para reforzar en casa.' },
        { title: 'Progreso Visible', desc: 'Gráficos del avance en tiempo real de cada sesión.' },
        { title: 'Respuestas Rápidas', desc: 'Pregúntale a ARIA sobre actividades o dudas al instante.' },
      ],
      chat: [
        { from: 'aria', text: '¡Hola! Hoy Rodrigo logró <b>3 nuevas habilidades</b> en su sesión. ¿Quieres ver el reporte?' },
        { from: 'parent', text: 'Sí, ¡qué emoción! ¿Cómo lo refuerzo en casa?' },
        { from: 'aria', text: 'Te recomiendo <b>3 actividades</b> basadas en los datos de esta semana...' },
      ],
    },
    gallery: {
      tag: 'Galería de fotos',
      title: 'Nuestro centro en imágenes',
      sub: 'Conoce el ambiente seguro, cálido y estimulante donde los niños aprenden y crecen.',
      captions: ['Sesiones personalizadas de terapia ABA', 'Talleres de habilidades sociales', 'Escuela para Padres', 'Evaluaciones especializadas'],
    },
    services: {
      tag: 'Nuestros Servicios',
      title: 'Soluciones integrales para el desarrollo',
      cta: 'Contáctanos',
      popular: 'Popular',
      moreInfo: 'Más información',
      items: [
        { title: 'Terapia ABA', desc: 'Intervención basada en evidencia para mejorar habilidades sociales, comunicación y aprendizaje.', color: '#2563eb', bg: '#dbeafe', featured: false, altCta: false },
        { title: 'Habilidades Sociales', desc: 'Talleres grupales donde los niños aprenden a interactuar en un entorno seguro y lúdico.', featured: true, color: '', bg: '', altCta: false },
        { title: 'Escuela para Padres', desc: 'Capacitación constante para que las familias sean parte activa del proceso de desarrollo.', color: '#16a34a', bg: '#dcfce7', altCta: true, featured: false },
      ],
    },
    faq: {
      tag: 'Preguntas Frecuentes',
      title: 'Resolvemos tus dudas',
      ctaBanner: '¿Listo para dar el primer paso?',
      ctaBannerSub: 'Escríbenos hoy y da el primer paso hacia el desarrollo de tu hijo/a.',
      ctaBannerBtn: 'Hablar con un especialista',
      items: [
        { q: '¿A qué edad pueden empezar las terapias?', a: 'Atendemos niños desde los 1 año en adelante. La intervención temprana es clave. Nuestro equipo adapta las sesiones según la edad y necesidades de cada niño.' },
        { q: '¿Cómo puedo empezar?', a: 'Es muy sencillo. Contáctanos por WhatsApp y nuestro equipo te orientará sobre el proceso de admisión y los servicios que mejor se adaptan a las necesidades de tu hijo/a.' },
        { q: '¿Cómo veo el progreso de mi hijo?', a: 'A través de nuestra plataforma verás reportes diarios, gráficos de avance y observaciones de cada sesión. ARIA genera resúmenes semanales en lenguaje sencillo.' },
        { q: '¿Qué metodología utilizan?', a: 'Trabajamos con la metodología ABA (Applied Behavior Analysis), reconocida como el enfoque más efectivo con respaldo científico para la neurodivergencia.' },
        { q: '¿Qué incluye la plataforma para padres?', a: 'Incluye: reportes diarios, gráficos de progreso, chat con el equipo, asistente ARIA 24/7, agenda de citas, biblioteca de recursos y notificaciones en tiempo real.' },
      ],
    },
    map: {
      title: 'Visítanos',
      sub: 'Independencia, Pisco. Un ambiente seguro y adaptado para tus hijos.',
      schedule: 'Lun - Vie: 8:00 AM - 6:00 PM',
      mapsBtn: 'Ver en Google Maps',
    },
    footer: {
      tagline: 'Centro especializado en terapia ABA y desarrollo infantil potenciado por IA. Pisco, Ica, Perú.',
      services: 'Servicios',
      platform: 'Plataforma',
      schedule: 'Horarios',
      login: 'Ingresar',
      signup: 'Registrarse',
      forParents: 'Para Padres',
      ariaAssistant: 'Asistente ARIA',
      scheduleHours: 'Lun - Vie: 8AM - 6PM',
      saturDayClosed: 'Sábado: Cerrado',
      sundayClosed: 'Domingo: Cerrado',
      serviceItems: ['Terapia ABA', 'Habilidades Sociales', 'Escuela para Padres', 'Evaluación Gratuita'],
      copy: '© 2025 Vanty ABA — Centro de Desarrollo Infantil · Pisco, Ica, Perú. Todos los derechos reservados.',
    },
    wa: { msg: 'Hola, vi su página web y me interesa conocer más sobre sus servicios de terapia para mi hijo/a.' },
  },

  en: {
    nav: {
      parents: 'For Parents',
      aria: 'ARIA Assistant',
      services: 'Services',
      gallery: 'Gallery',
      faq: 'FAQ',
      login: 'Log in',
    },
    hero: {
      badge: 'Therapy · Technology · Love',
      headline1: 'Unlocking the potential of',
      headline2: 'brilliant minds.',
      subtitle: 'A specialized neurodevelopment center in Pisco, Peru. We combine evidence-based ABA therapy, real-time digital tracking, and the warmth of our dedicated team.',
      ctaWa: 'Contact us',
      ctaLearn: 'What we offer',
      chip1: 'ABA Methodology',
      chip2: '+50 Families',
      chip3: 'AI Included',
      personalized: 'Personalized',
    },
    stats: [
      { num: '+{n}', lbl: 'Happy families', icon: '👨‍👩‍👧' },
      { num: '100%', lbl: 'Personalized', icon: '🎯' },
      { num: 'ABA', lbl: 'Methodology', icon: '🧠' },
      { num: 'Pisco', lbl: 'Main center', icon: '📍' },
    ],
    parents: {
      tag: 'For families',
      title: 'Everything we offer\nto parents',
      sub: 'Supporting your child is a shared journey. Digital and human tools so you are always informed, empowered, and an active part of the process.',
      cta: 'Access the parent platform',
    },
    benefits: [
      { title: 'Daily reports', desc: 'A clear summary of every session with achievements and observations.' },
      { title: 'Progress charts', desc: "Your child's week-by-week evolution in skills and behavior." },
      { title: 'Chat with specialists', desc: 'Communicate directly with the therapy team from the app.' },
      { title: 'ARIA 24/7', desc: 'Our AI analyzes data and gives you personalized suggestions.' },
      { title: 'Appointment schedule', desc: 'Book and confirm sessions in one place — no phone calls needed.' },
      { title: 'Resource library', desc: 'ABA guides, videos, and activities to reinforce learning at home.' },
      { title: 'Notifications', desc: 'Real-time progress alerts, appointment reminders, and messages.' },
      { title: 'Protected data', desc: '100% secure information following clinical-grade standards.' },
    ],
    testimonials: {
      tag: 'Real families',
      title: 'Results that speak for themselves',
      cta: 'I want results for my child',
      items: [
        { name: 'María G.', desc: 'Mother of Rodrigo, 6 y/o · ASD Level 2', a: 'M', color: '#f97316', text: 'In 3 months my son started communicating in full sentences. The AI reports help us understand his progress without confusing jargon. I recommend them 100%!' },
        { name: 'Carlos R.', desc: 'Father of Valentina, 4 y/o · ADHD', a: 'C', color: '#10b981', text: "What surprised me most was tracking her progress week by week from my phone. The AI assistant gives us tips to reinforce learning at home. Valentina has improved so much." },
        { name: 'Rosa T.', desc: 'Mother of Mateo, 5 y/o · ASD Level 1', a: 'R', color: '#8b5cf6', text: "At first I was afraid I wouldn't understand the clinical terms. The therapist and report system explain everything in a very simple way. I feel truly supported." },
      ],
    },
    aria: {
      tag: 'Artificial Intelligence',
      title: 'Meet',
      highlight: 'ARIA',
      sub: "Your intelligent clinical assistant. She learns from your child's daily records and supports you 24/7 between sessions.",
      cta: 'Talk to ARIA now',
      online: 'Online · 24/7',
      features: [
        { title: 'Precise Tracking', desc: 'ARIA analyzes behavioral trends session by session.' },
        { title: '24/7 Support', desc: 'Simple summaries and home reinforcement recommendations.' },
        { title: 'Visible Progress', desc: 'Real-time progress charts for every session.' },
        { title: 'Instant Answers', desc: 'Ask ARIA about activities or concerns at any moment.' },
      ],
      chat: [
        { from: 'aria', text: 'Hi! Today Rodrigo mastered <b>3 new skills</b> in his session. Would you like to see the report?' },
        { from: 'parent', text: "Yes! How can I reinforce this at home?" },
        { from: 'aria', text: "I recommend <b>3 activities</b> based on this week's data..." },
      ],
    },
    gallery: {
      tag: 'Photo gallery',
      title: 'Our center in pictures',
      sub: 'Discover the safe, warm, and stimulating environment where children learn and grow.',
      captions: ['Personalized ABA therapy sessions', 'Social skills workshops', 'Parent School program', 'Specialized assessments'],
    },
    services: {
      tag: 'Our Services',
      title: 'Comprehensive solutions for development',
      cta: 'Contact us',
      popular: 'Popular',
      moreInfo: 'More information',
      items: [
        { title: 'ABA Therapy', desc: 'Evidence-based intervention to improve social skills, communication, and learning.', color: '#2563eb', bg: '#dbeafe', featured: false, altCta: false },
        { title: 'Social Skills', desc: 'Group workshops where children learn to interact in a safe, playful environment.', featured: true, color: '', bg: '', altCta: false },
        { title: 'Parent School', desc: 'Ongoing training so families become active participants in the development process.', color: '#16a34a', bg: '#dcfce7', altCta: true, featured: false },
      ],
    },
    faq: {
      tag: 'Frequently Asked Questions',
      title: 'We answer your questions',
      ctaBanner: 'Ready to take the first step?',
      ctaBannerSub: "Write to us today and begin your child's development journey.",
      ctaBannerBtn: 'Talk to a specialist',
      items: [
        { q: 'What age can children start therapy?', a: 'We work with children from 1 year old and up. Early intervention is key. Our team adapts every session to each child\'s age and individual needs.' },
        { q: 'How do I get started?', a: 'It\'s simple. Contact us via WhatsApp and our team will guide you through the admission process and the services that best fit your child\'s needs.' },
        { q: "How do I track my child's progress?", a: 'Through our platform you will see daily reports, progress charts, and observations from every session. ARIA generates weekly summaries in plain, easy-to-understand language.' },
        { q: 'What methodology do you use?', a: 'We use ABA (Applied Behavior Analysis), widely recognized as the most effective evidence-based approach for neurodevelopmental differences.' },
        { q: 'What does the parent platform include?', a: 'It includes: daily reports, progress charts, team chat, ARIA 24/7 assistant, appointment scheduling, resource library, and real-time notifications.' },
      ],
    },
    map: {
      title: 'Visit us',
      sub: 'Independencia, Pisco. A safe and adapted environment for your children.',
      schedule: 'Mon – Fri: 8:00 AM – 6:00 PM',
      mapsBtn: 'View on Google Maps',
    },
    footer: {
      tagline: 'Specialized center in ABA therapy and AI-powered child development. Pisco, Ica, Peru.',
      services: 'Services',
      platform: 'Platform',
      schedule: 'Hours',
      login: 'Log in',
      signup: 'Sign up',
      forParents: 'For Parents',
      ariaAssistant: 'ARIA Assistant',
      scheduleHours: 'Mon – Fri: 8AM – 6PM',
      saturDayClosed: 'Saturday: Closed',
      sundayClosed: 'Sunday: Closed',
      serviceItems: ['ABA Therapy', 'Social Skills', 'Parent School', 'Free Assessment'],
      copy: '© 2025 Vanty ABA — Child Development Center · Pisco, Ica, Peru. All rights reserved.',
    },
    wa: { msg: "Hello, I saw your website and I'm interested in learning more about your therapy services for my child." },
  },
} as const


// ── Helpers ───────────────────────────────────────────────────
function detectPlatform(url: string): 'youtube' | 'tiktok' | 'drive' | 'vimeo' | 'other' {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube') || u.hostname === 'youtu.be') return 'youtube'
    if (u.hostname.includes('tiktok')) return 'tiktok'
    if (u.hostname.includes('drive.google')) return 'drive'
    if (u.hostname.includes('vimeo')) return 'vimeo'
  } catch {}
  return 'other'
}

function getEmbedUrl(url: string): string {
  try {
    const u = new URL(url)
    const platform = detectPlatform(url)
    if (platform === 'youtube') {
      let id = ''
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1)
      else if (u.pathname.includes('/shorts/')) id = u.pathname.split('/shorts/')[1].split('/')[0]
      else id = u.searchParams.get('v') || ''
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`
    }
    if (platform === 'tiktok') {
      const match = u.pathname.match(/\/video\/(\d+)/)
      if (match) return `https://www.tiktok.com/embed/v2/${match[1]}`
      return url
    }
    if (platform === 'drive') {
      const match = u.pathname.match(/\/d\/([^/]+)/)
      if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
      return url
    }
    if (platform === 'vimeo') {
      const id = u.pathname.replace('/', '').split('/')[0]
      return `https://player.vimeo.com/video/${id}?autoplay=1`
    }
  } catch {}
  return url
}

// ── Chat illustration ─────────────────────────────────────────
function ARIAChatIllustration({ chat }: { chat: { from: string; text: string }[] }) {
  return (
    <div style={{ position: 'relative', width: 340, maxWidth: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg,#f97316,#ea580c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(249,115,22,.12), 0 16px 40px rgba(249,115,22,.25)',
          animation: 'ariaFloat 4s ease-in-out infinite',
          position: 'relative',
        }}>
          <Brain size={44} color="#fff" />
          <div style={{ position: 'absolute', bottom: 6, right: 6, width: 18, height: 18, background: '#22c55e', borderRadius: '50%', border: '3px solid #fff' }} />
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {chat.map((msg, i) => (
            msg.from === 'aria' ? (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Brain size={16} color="#fff" />
                </div>
                <div
                  style={{ background: '#fff', border: '1.5px solid #fed7aa', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', fontSize: 13, color: '#44403c', lineHeight: 1.6, boxShadow: '0 4px 16px rgba(249,115,22,.08)', maxWidth: 260 }}
                  dangerouslySetInnerHTML={{ __html: msg.text.replace(/<b>/g, '<strong style="color:#f97316">').replace(/<\/b>/g, '</strong>') }}
                />
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', fontSize: 13, color: '#fff', lineHeight: 1.6, maxWidth: 200 }}>
                  {msg.text}
                </div>
              </div>
            )
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.5 }}>
              <Brain size={16} color="#fff" />
            </div>
            <div style={{ background: '#fff', border: '1.5px solid #fed7aa', borderRadius: '18px 18px 18px 4px', padding: '12px 20px', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', opacity: 0.4, animation: `ariaLed ${0.8+i*.2}s ease-in-out infinite` }} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function LandingPage() {
  const { locale } = useI18n()
  const lang = 'es'
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null)
  const [count50, setCount50] = useState(0)
  const [activeImg, setActiveImg] = useState(0)
  const [playingVideo, setPlayingVideo] = useState<number | null>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const counted = useRef(false)

  const t = CONTENT[lang]

  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !counted.current) {
        counted.current = true
        let n = 0
        const timer = setInterval(() => { n += 2; setCount50(n); if (n >= 50) clearInterval(timer) }, 40)
      }
    }, { threshold: 0.4 })
    if (statsRef.current) obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setActiveImg(p => (p + 1) % 4), 4500)
    return () => clearInterval(timer)
  }, [])

  // Reset accordion when language changes
  useEffect(() => { setActiveAccordion(null) }, [lang])

  const waMsg = encodeURIComponent(t.wa.msg)
  const waUrl = `https://wa.me/51991070734?text=${waMsg}`

  const benefitIcons = [
    { icon: <ClipboardList size={20} color="#fff" />, bg: 'linear-gradient(135deg,#f97316,#fb923c)' },
    { icon: <LineChart size={20} color="#fff" />,     bg: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
    { icon: <MessageSquareHeart size={20} color="#fff" />, bg: 'linear-gradient(135deg,#10b981,#34d399)' },
    { icon: <Brain size={20} color="#fff" />,         bg: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
    { icon: <Calendar size={20} color="#fff" />,      bg: 'linear-gradient(135deg,#f43f5e,#fb7185)' },
    { icon: <BookOpen size={20} color="#fff" />,      bg: 'linear-gradient(135deg,#14b8a6,#2dd4bf)' },
    { icon: <Bell size={20} color="#fff" />,          bg: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
    { icon: <Shield size={20} color="#fff" />,        bg: 'linear-gradient(135deg,#059669,#10b981)' },
  ]

  const ariaFeatureIcons = [
    { icon: <LineChart size={18} color="#f97316" />, bg: '#fff7ed', border: '#fed7aa' },
    { icon: <MessageSquareHeart size={18} color="#10b981" />, bg: '#f0fdf4', border: '#bbf7d0' },
    { icon: <Brain size={18} color="#8b5cf6" />, bg: '#faf5ff', border: '#e9d5ff' },
    { icon: <Zap size={18} color="#f59e0b" />, bg: '#fffbeb', border: '#fde68a' },
  ]

  const imgs = t.gallery.captions.map((caption) => ({ src: '/images/hero-image.jpg', caption }))

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Nunito', sans-serif; background: #fffbf5; color: #2d1b69; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 7px; }
        ::-webkit-scrollbar-track { background: #fef3c7; }
        ::-webkit-scrollbar-thumb { background: #f97316; border-radius: 99px; }

        .lp-nav { position: sticky; top: 0; z-index: 100; transition: all .3s; }
        .lp-nav.scrolled { background: rgba(255,251,245,.97); backdrop-filter: blur(16px); box-shadow: 0 4px 24px rgba(249,115,22,.12); border-bottom: 2px solid #fed7aa; }
        .lp-nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 20px; height: 68px; display: flex; align-items: center; justify-content: space-between; }
        .lp-nav-links { display: none; gap: 24px; }
        @media(min-width:768px){ .lp-nav-links { display: flex; } }
        .lp-nav-links a { font-family: 'Baloo 2',cursive; font-size: 14px; font-weight: 700; color: #78350f; text-decoration: none; transition: color .2s; }
        .lp-nav-links a:hover { color: #f97316; }
        .lp-btn-fill { padding: 8px 20px; background: linear-gradient(135deg,#f97316,#ea580c); border-radius: 99px; font-family: 'Baloo 2',cursive; font-size: 13px; font-weight: 700; color: #fff; text-decoration: none; transition: all .2s; box-shadow: 0 4px 14px rgba(249,115,22,.3); }
        .lp-btn-fill:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(249,115,22,.4); }

        .lp-hero { min-height: 92vh; display: flex; align-items: center; background: linear-gradient(160deg,#fff7ed 0%,#fffbf5 55%,#ecfdf5 100%); position: relative; overflow: hidden; padding: 80px 20px 60px; }
        .lp-hero-inner { max-width: 1200px; margin: 0 auto; width: 100%; display: grid; gap: 48px; position: relative; z-index: 1; align-items: center; }
        @media(min-width:900px){ .lp-hero-inner { grid-template-columns: 1fr 1fr; } }

        .btn-wa { display: inline-flex; align-items: center; gap: 8px; padding: 14px 26px; background: #25d366; color: #fff; border-radius: 99px; font-family: 'Baloo 2',cursive; font-weight: 700; font-size: 15px; text-decoration: none; transition: all .25s; box-shadow: 0 6px 20px rgba(37,211,102,.3); }
        .btn-wa:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(37,211,102,.4); }
        .btn-orange { display: inline-flex; align-items: center; gap: 8px; padding: 14px 26px; background: linear-gradient(135deg,#f97316,#ea580c); color: #fff; border-radius: 99px; font-family: 'Baloo 2',cursive; font-weight: 700; font-size: 15px; text-decoration: none; transition: all .25s; box-shadow: 0 6px 20px rgba(249,115,22,.3); }
        .btn-orange:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(249,115,22,.4); }
        .btn-outline { display: inline-flex; align-items: center; gap: 8px; padding: 14px 26px; border: 2.5px solid #fed7aa; color: #78350f; border-radius: 99px; font-family: 'Baloo 2',cursive; font-weight: 700; font-size: 15px; background: #fff; transition: all .25s; cursor: pointer; text-decoration: none; }
        .btn-outline:hover { border-color: #f97316; color: #f97316; }
        @keyframes lp-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }

        .lp-stats-inner { max-width: 900px; margin: 0 auto; display: grid; grid-template-columns: repeat(2,1fr); gap: 24px; }
        @media(min-width:640px){ .lp-stats-inner { grid-template-columns: repeat(4,1fr); } }

        .lp-section { padding: 80px 20px; }
        .lp-inner { max-width: 1200px; margin: 0 auto; }
        .lp-tag { display: inline-flex; align-items: center; gap: 6px; background: #fff7ed; border: 2px solid #fed7aa; color: #c2410c; border-radius: 99px; padding: 4px 14px; font-family: 'Baloo 2',cursive; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
        .lp-h2 { font-family: 'Baloo 2',cursive; font-size: clamp(26px,4vw,42px); font-weight: 800; color: #1c1917; line-height: 1.2; margin-bottom: 14px; }
        .lp-sub { font-size: 16px; color: #78716c; line-height: 1.85; max-width: 580px; }

        .lp-grid-3 { display: grid; gap: 20px; }
        @media(min-width:640px){ .lp-grid-3 { grid-template-columns: repeat(2,1fr); } }
        @media(min-width:900px){ .lp-grid-3 { grid-template-columns: repeat(3,1fr); } }
        .lp-grid-4 { display: grid; gap: 16px; }
        @media(min-width:540px){ .lp-grid-4 { grid-template-columns: repeat(2,1fr); } }
        @media(min-width:960px){ .lp-grid-4 { grid-template-columns: repeat(4,1fr); } }

        .lp-benefit-card { background: #fff; border: 2px solid #fef3c7; border-radius: 20px; padding: 24px 20px; transition: all .3s; }
        .lp-benefit-card:hover { border-color: #fed7aa; box-shadow: 0 14px 36px rgba(249,115,22,.1); transform: translateY(-4px) rotate(-.5deg); }
        .lp-testi-card { background: #fff; border-radius: 22px; padding: 28px; border: 2px solid #fef3c7; transition: all .3s; }
        .lp-testi-card:hover { border-color: #fed7aa; box-shadow: 0 16px 40px rgba(249,115,22,.08); transform: translateY(-4px); }
        .lp-svc-card { background: #fff; border-radius: 22px; padding: 32px; border: 2px solid #fef3c7; transition: all .3s; position: relative; overflow: hidden; }
        .lp-svc-card::before { content:''; position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#f97316,#fbbf24); transform:scaleX(0); transform-origin:left; transition:transform .35s; }
        .lp-svc-card:hover::before { transform:scaleX(1); }
        .lp-svc-card:hover { border-color: #fed7aa; box-shadow: 0 20px 60px rgba(249,115,22,.12); transform: translateY(-4px); }
        .lp-svc-card.featured { background: linear-gradient(145deg,#f97316,#ea580c); border-color: transparent; }
        .lp-svc-card.featured::before { display: none; }
        .lp-faq-item { border: 2.5px solid #fef3c7; border-radius: 16px; overflow: hidden; cursor: pointer; transition: all .2s; margin-bottom: 12px; background: #fff; }
        .lp-faq-item:hover { border-color: #fed7aa; }
        .lp-faq-item.open { border-color: #fb923c; background: #fff7ed; }

        .lp-gallery-main { position: relative; border-radius: 24px; overflow: hidden; aspect-ratio: 16/9; box-shadow: 0 20px 60px rgba(0,0,0,.15); }
        .lp-gallery-caption { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent,rgba(0,0,0,.65)); padding: 28px 20px 16px; color: #fff; font-family: 'Baloo 2',cursive; font-weight: 700; font-size: 14px; }
        .lp-gallery-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,.9); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .2s; }
        .lp-gallery-btn:hover { background: #fff; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
        .lp-thumbs { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-top: 12px; }
        .lp-thumb { border-radius: 12px; overflow: hidden; cursor: pointer; border: 3px solid transparent; transition: all .25s; aspect-ratio: 16/9; position: relative; }
        .lp-thumb.active { border-color: #f97316; box-shadow: 0 4px 14px rgba(249,115,22,.3); }

        .lp-modal { position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: lp-up .2s ease; }
        .lp-modal-inner { position: relative; width: 100%; max-width: 880px; border-radius: 20px; overflow: hidden; box-shadow: 0 40px 100px rgba(0,0,0,.6); background: #000; }
        .lp-modal iframe { width: 100%; aspect-ratio: 16/9; border: none; display: block; }
        .lp-modal-x { position: absolute; top: -14px; right: -14px; background: #fff; border: none; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.3); transition: transform .2s; z-index: 10; }
        .lp-modal-x:hover { transform: scale(1.1) rotate(90deg); }

        .lp-map-section { position: relative; }
        .lp-map-card { background: #fff; padding: 28px; border: 2px solid #fef3c7; }
        @media(min-width:640px){ .lp-map-section { height: 500px; } .lp-map-card { position: absolute; top: 50%; left: 48px; transform: translateY(-50%); border-radius: 22px; box-shadow: 0 24px 60px rgba(0,0,0,.15); max-width: 360px; } }

        .lp-footer { background: #1c1917; color: rgba(255,255,255,.4); padding: 64px 20px 28px; }
        .lp-footer-inner { max-width: 1200px; margin: 0 auto; display: grid; gap: 36px; margin-bottom: 40px; }
        @media(min-width:768px){ .lp-footer-inner { grid-template-columns: 2fr 1fr 1fr 1fr; } }
        .lp-footer h4 { font-family: 'Baloo 2',cursive; color: #fff; font-weight: 700; font-size: 14px; margin-bottom: 14px; }
        .lp-footer ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .lp-footer ul li a { color: rgba(255,255,255,.4); text-decoration: none; font-size: 13px; transition: color .2s; }
        .lp-footer ul li a:hover { color: #fb923c; }
        .lp-social { width: 38px; height: 38px; background: rgba(255,255,255,.07); border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; color: rgba(255,255,255,.45); transition: all .2s; text-decoration: none; margin-right: 8px; }
        .lp-social:hover { background: #f97316; color: #fff; transform: translateY(-2px); }

        @keyframes waFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes waPing { 75%,100%{transform:scale(2);opacity:0} }
        .lp-wa { position: fixed; bottom: 22px; right: 22px; z-index: 998; width: 60px; height: 60px; background: #25d366; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(37,211,102,.45); animation: waFloat 3s ease-in-out infinite; text-decoration: none; }
        .lp-wa-ping { position: absolute; top: -3px; right: -3px; width: 18px; height: 18px; background: #ef4444; border-radius: 50%; }
        .lp-wa-ping::before { content:''; position:absolute; inset:0; background:#ef4444; border-radius:50%; animation: waPing 1.5s cubic-bezier(0,0,.2,1) infinite; }

        @keyframes ariaFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes ariaLed { 0%,100%{opacity:1} 50%{opacity:.25} }

        .aria-cards-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .lp-ia-layout { display: grid; gap: 56px; align-items: center; }
        @media(min-width:900px){ .lp-ia-layout { grid-template-columns: 1fr 420px; } }

        @keyframes shapeFloat1 { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-16px) rotate(10deg)} }
        @keyframes shapeFloat2 { 0%,100%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-12px) rotate(-8deg)} }

        @media(max-width:639px){
          .lp-hero { padding: 70px 16px 50px; min-height: 100svh; overflow: hidden; }
          .lp-hero-inner { gap: 32px; }
          .lp-ia-layout { gap: 32px; }
          .lp-section { padding: 64px 16px; }
          .lp-footer { padding: 48px 16px 24px; }
          .lp-map-section { height: auto; min-height: 0; }
          .lp-map-card { position: static; transform: none; margin: 0; border-radius: 0; box-shadow: 0 -4px 20px rgba(0,0,0,.08); max-width: 100%; width: 100%; }
          .lp-modal { padding: 8px; }
          .lp-modal-x { top: 8px; right: 8px; }
          .lp-nav-inner { height: 60px; }
          .aria-cards-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .aria-card { flex-direction: column !important; gap: 10px !important; padding: 14px !important; }
          .aria-chat-panel { display: none !important; }
          .lp-thumbs { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* WA FLOAT */}
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className="lp-wa" aria-label="WhatsApp">
        <Phone size={26} color="#fff" />
        <div className="lp-wa-ping" />
      </a>

      {/* VIDEO MODAL */}
      {playingVideo !== null && (
        <div className="lp-modal" onClick={() => setPlayingVideo(null)}>
          <div className="lp-modal-inner" onClick={e => e.stopPropagation()}>
            <button className="lp-modal-x" onClick={() => setPlayingVideo(null)}><X size={18} color="#1c1917" /></button>
            <iframe src={getEmbedUrl(VIDEOS[playingVideo].url)} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="video" />
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className={`lp-nav ${isScrolled ? 'scrolled' : ''}`} style={{ background: isScrolled ? undefined : 'transparent' }}>
        <div className="lp-nav-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', width: 42, height: 42 }}>
              <Image src="/images/logo.png?v=2" alt="Logo" fill style={{ objectFit: 'contain' }} priority unoptimized />
            </div>
            <div>
              <p style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 800, fontSize: 16, color: '#1c1917', lineHeight: 1.1 }}>Vanty ABA</p>
              <p style={{ fontSize: 10, color: '#a8a29e', fontWeight: 600 }}>
                {'Centro de Desarrollo Infantil · Pisco'}
              </p>
            </div>
          </div>
          <div className="lp-nav-links">
            <a href="#para-padres">{t.nav.parents}</a>
            <a href="#aria">{t.nav.aria}</a>
            <a href="#servicios">{t.nav.services}</a>
            <a href="#galeria">{t.nav.gallery}</a>
            <a href="#faq">{t.nav.faq}</a>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href="/login" className="lp-btn-fill">{t.nav.login}</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="lp-hero">
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle,rgba(249,115,22,.08) 2px,transparent 2px)', backgroundSize: '40px 40px' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, background: 'radial-gradient(circle,rgba(251,191,36,.14) 0%,transparent 70%)', top: -140, right: -60, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', width: 340, height: 340, background: 'radial-gradient(circle,rgba(16,185,129,.1) 0%,transparent 70%)', bottom: -80, left: -60, borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: 90, left: '8%', width: 56, height: 56, background: '#fef08a', borderRadius: '50%', opacity: .55, animation: 'shapeFloat1 6s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: 130, right: '10%', width: 38, height: 38, background: '#bbf7d0', borderRadius: '12px', opacity: .6, animation: 'shapeFloat2 5s ease-in-out infinite 1s', transform: 'rotate(25deg)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '4%', width: 26, height: 26, background: '#fecdd3', borderRadius: '50%', opacity: .7, animation: 'shapeFloat1 7s ease-in-out infinite .5s' }} />

        <div className="lp-hero-inner">
          <div style={{ animation: 'lp-up .6s ease both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff7ed', border: '2px solid #fed7aa', borderRadius: 99, padding: '6px 16px', fontFamily: "'Baloo 2',cursive", fontSize: 13, fontWeight: 700, color: '#c2410c', marginBottom: 18 }}>
              <Heart size={13} style={{ fill: 'currentColor' }} /> {t.hero.badge}
            </div>
            <h1 style={{ fontFamily: "'Baloo 2',cursive", fontSize: 'clamp(34px,5vw,58px)', fontWeight: 800, lineHeight: 1.15, color: '#1c1917', marginBottom: 18 }}>
              {t.hero.headline1}{' '}
              <span style={{ color: '#f97316', position: 'relative', display: 'inline-block' }}>
                {t.hero.headline2}
                <span style={{ position: 'absolute', bottom: 3, left: 0, right: 0, height: 7, background: '#fef08a', borderRadius: 99, zIndex: -1 }} />
              </span>
            </h1>
            <p style={{ fontSize: 17, color: '#57534e', lineHeight: 1.85, marginBottom: 32, maxWidth: 480 }}>{t.hero.subtitle}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 36 }}>
              <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-wa">
                <Phone size={16} /> {t.hero.ctaWa}
              </a>
              <button className="btn-outline" onClick={() => document.getElementById('para-padres')?.scrollIntoView({ behavior: 'smooth' })}>
                <Sparkles size={16} color="#f97316" /> {t.hero.ctaLearn}
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {[
                { bg: '#dcfce7', icon: <CheckCircle size={16} color="#16a34a" />, label: t.hero.chip1 },
                { bg: '#fef9c3', icon: <Star size={16} color="#ca8a04" fill="#ca8a04" />, label: t.hero.chip2 },
                { bg: '#fce7f3', icon: <Brain size={16} color="#db2777" />, label: t.hero.chip3 },
              ].map(({ bg, icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 36, height: 36, background: bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                  <span style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 13, color: '#44403c' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', animation: 'lp-up .7s .15s ease both' }}>
            <div style={{ borderRadius: 28, overflow: 'hidden', boxShadow: '0 28px 72px rgba(0,0,0,.14)', aspectRatio: '4/3', position: 'relative', border: '5px solid #fff' }}>
              <Image src="/images/hero-image.jpg?v=2" alt={'Niños en terapia ABA'} fill style={{ objectFit: 'cover' }} priority unoptimized />
            </div>
            <div style={{ position: 'absolute', top: 18, left: 10, background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 12, color: '#1c1917', border: '2px solid #fef3c7' }}>
              <div style={{ width: 30, height: 30, background: '#fef9c3', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Brain size={15} color="#d97706" /></div>
              {t.hero.chip1}
            </div>
            <div style={{ position: 'absolute', bottom: 18, right: 10, background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,.1)', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 12, color: '#1c1917', border: '2px solid #d1fae5' }}>
              <CheckCircle size={18} color="#10b981" style={{ flexShrink: 0 }} /> 100% {t.hero.personalized}
            </div>
          </div>
        </div>
      </header>

      {/* STATS */}
      <div ref={statsRef} style={{ background: '#fff', borderTop: '1.5px solid #fef3c7', borderBottom: '1.5px solid #fef3c7', padding: '48px 20px' }}>
        <div className="lp-stats-inner">
          {t.stats.map(({ num, lbl, icon }) => (
            <div key={lbl} style={{ textAlign: 'center', padding: '24px 16px', background: '#fff7ed', borderRadius: 20, border: '2px solid #fed7aa' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontSize: 38, fontWeight: 800, color: '#f97316', lineHeight: 1, marginBottom: 6 }}>
                {num.includes('{n}') ? num.replace('{n}', String(count50)) : num}
              </div>
              <div style={{ fontSize: 12, color: '#a8a29e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PARENTS */}
      <section id="para-padres" className="lp-section" style={{ background: '#fffbf5' }}>
        <div className="lp-inner">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="lp-tag"><Heart size={12} /> {t.parents.tag}</div>
            <h2 className="lp-h2" style={{ whiteSpace: 'pre-line' }}>{t.parents.title}</h2>
            <p className="lp-sub" style={{ margin: '0 auto' }}>{t.parents.sub}</p>
          </div>
          <div className="lp-grid-4">
            {t.benefits.map(({ title, desc }, idx) => (
              <div key={title} className="lp-benefit-card">
                <div style={{ width: 48, height: 48, borderRadius: 14, background: benefitIcons[idx].bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{benefitIcons[idx].icon}</div>
                <h4 style={{ fontFamily: "'Baloo 2',cursive", fontSize: 15, fontWeight: 700, color: '#1c1917', marginBottom: 6 }}>{title}</h4>
                <p style={{ fontSize: 13, color: '#78716c', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <Link href="/login?mode=signup" className="btn-orange" style={{ display: 'inline-flex' }}>
              {t.parents.cta} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ background: '#fff7ed', padding: '80px 20px' }}>
        <div className="lp-inner">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="lp-tag"><Quote size={12} /> {t.testimonials.tag}</div>
            <h2 className="lp-h2">{t.testimonials.title}</h2>
          </div>
          <div className="lp-grid-3">
            {t.testimonials.items.map(({ name, desc, a, color, text }) => (
              <div key={name} className="lp-testi-card">
                <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
                  {[1,2,3,4,5].map(i => <Star key={i} size={14} color="#f59e0b" fill="#f59e0b" />)}
                </div>
                <p style={{ color: '#44403c', fontSize: 14, lineHeight: 1.85, marginBottom: 20, fontStyle: 'italic' }}>&ldquo;{text}&rdquo;</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Baloo 2',cursive", fontWeight: 800, fontSize: 18, color: '#fff' }}>{a}</div>
                  <div>
                    <p style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 14, color: '#1c1917' }}>{name}</p>
                    <p style={{ fontSize: 11, color: '#a8a29e' }}>{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 44 }}>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn-orange" style={{ display: 'inline-flex' }}>
              {t.testimonials.cta} <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ARIA */}
      <section id="aria" style={{ background: '#fff', padding: '72px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(249,115,22,.04) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff7ed', border: '2px solid #fed7aa', color: '#c2410c', borderRadius: 99, padding: '5px 16px', fontFamily: "'Baloo 2',cursive", fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
              <Sparkles size={13} /> {t.aria.tag}
            </div>
            <h2 style={{ fontFamily: "'Baloo 2',cursive", fontSize: 'clamp(26px,4vw,46px)', fontWeight: 800, color: '#1c1917', lineHeight: 1.15, marginBottom: 12 }}>
              {t.aria.title} <span style={{ color: '#f97316' }}>{t.aria.highlight}</span>
            </h2>
            <p style={{ color: '#78716c', fontSize: 15, lineHeight: 1.75, maxWidth: 520, margin: '0 auto' }}>{t.aria.sub}</p>
          </div>
          <div style={{ display: 'grid', gap: 48, alignItems: 'center' }} className="lp-ia-layout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="aria-cards-grid">
                {t.aria.features.map(({ title, desc }, idx) => (
                  <div
                    key={title}
                    className="aria-card"
                    style={{ background: '#fff', border: `2px solid ${ariaFeatureIcons[idx].border}`, borderRadius: 16, padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-start', transition: 'all .3s', boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 28px rgba(249,115,22,.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,.04)'; }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: ariaFeatureIcons[idx].bg, border: `1.5px solid ${ariaFeatureIcons[idx].border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ariaFeatureIcons[idx].icon}</div>
                    <div>
                      <h4 style={{ fontFamily: "'Baloo 2',cursive", color: '#1c1917', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</h4>
                      <p style={{ color: '#78716c', fontSize: 12, lineHeight: 1.6 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8 }}>
                <Link href="/login?mode=signup" className="btn-orange" style={{ display: 'inline-flex' }}>
                  {t.aria.cta} <ArrowRight size={16} />
                </Link>
              </div>
            </div>
            <div className="aria-chat-panel" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ background: '#f8fafc', border: '2px solid #f1f5f9', borderRadius: 28, padding: '28px 24px', width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 18, borderBottom: '1.5px solid #f1f5f9' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(249,115,22,.3)' }}>
                    <Brain size={22} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 800, fontSize: 15, color: '#1c1917' }}>ARIA</p>
                    <p style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> {t.aria.online}
                    </p>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                    {['#ef4444','#f59e0b','#22c55e'].map((c,i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                  </div>
                </div>
                <ARIAChatIllustration chat={[...t.aria.chat]} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="galeria" className="lp-section" style={{ background: '#fffbf5' }}>
        <div className="lp-inner">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div className="lp-tag"><ImageIcon size={12} /> {t.gallery.tag}</div>
            <h2 className="lp-h2">{t.gallery.title}</h2>
            <p className="lp-sub" style={{ margin: '0 auto' }}>{t.gallery.sub}</p>
          </div>
          <div className="lp-gallery-main">
            <Image src={imgs[activeImg].src} alt={imgs[activeImg].caption} fill style={{ objectFit: 'cover' }} unoptimized />
            <div className="lp-gallery-caption">{imgs[activeImg].caption}</div>
            <button className="lp-gallery-btn" style={{ left: 12 }} onClick={() => setActiveImg((activeImg - 1 + 4) % 4)}><ChevronLeft size={18} color="#1c1917" /></button>
            <button className="lp-gallery-btn" style={{ right: 12 }} onClick={() => setActiveImg((activeImg + 1) % 4)}><ChevronRight size={18} color="#1c1917" /></button>
            <div style={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 7 }}>
              {[0,1,2,3].map(i => <div key={i} onClick={() => setActiveImg(i)} style={{ width: 8, height: 8, borderRadius: '50%', background: activeImg === i ? '#fff' : 'rgba(255,255,255,.4)', cursor: 'pointer', transition: 'all .2s' }} />)}
            </div>
          </div>
          <div className="lp-thumbs">
            {imgs.map((img, i) => (
              <div key={i} className={`lp-thumb ${activeImg === i ? 'active' : ''}`} onClick={() => setActiveImg(i)}>
                <Image src={img.src} alt={img.caption} fill style={{ objectFit: 'cover' }} unoptimized />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="servicios" className="lp-section" style={{ background: '#fffbf5' }}>
        <div className="lp-inner">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div className="lp-tag"><Star size={12} /> {t.services.tag}</div>
            <h2 className="lp-h2">{t.services.title}</h2>
          </div>
          <div className="lp-grid-3">
            {t.services.items.map(({ title, desc, featured, color, bg, altCta }) => (
              <div key={title} className={`lp-svc-card${featured ? ' featured' : ''}`}>
                {featured && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: '#fbbf24', color: '#1c1917', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 99, fontFamily: "'Baloo 2',cursive" }}>{t.services.popular}</div>
                )}
                <div style={{ width: 56, height: 56, background: featured ? 'rgba(255,255,255,.2)' : bg, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  {featured ? <Users size={26} color="#fff" /> : altCta ? <Calendar size={26} color={color} /> : <Brain size={26} color={color} />}
                </div>
                <h3 style={{ fontFamily: "'Baloo 2',cursive", fontSize: 20, fontWeight: 800, color: featured ? '#fff' : '#1c1917', marginBottom: 10 }}>{title}</h3>
                <p style={{ color: featured ? 'rgba(255,255,255,.75)' : '#78716c', fontSize: 14, lineHeight: 1.85, marginBottom: 20 }}>{desc}</p>
                <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, color: featured ? '#fff' : altCta ? '#10b981' : '#f97316', fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
                  {altCta ? t.services.moreInfo : t.services.cta} <ArrowRight size={15} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="lp-section" style={{ background: '#fffbf5' }}>
        <div className="lp-inner" style={{ maxWidth: 760 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="lp-tag"><HelpCircle size={12} /> {t.faq.tag}</div>
            <h2 className="lp-h2">{t.faq.title}</h2>
          </div>
          {t.faq.items.map((faq, i) => (
            <div key={`${lang}-${i}`} className={`lp-faq-item ${activeAccordion === i ? 'open' : ''}`} onClick={() => setActiveAccordion(activeAccordion === i ? null : i)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px' }}>
                <h4 style={{ fontFamily: "'Baloo 2',cursive", fontSize: 15, fontWeight: 700, color: '#1c1917', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, height: 28, background: '#fff7ed', border: '2px solid #fed7aa', borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#f97316', flexShrink: 0 }}>{i+1}</span>
                  {faq.q}
                </h4>
                <ChevronDown size={19} color="#a8a29e" style={{ transform: activeAccordion === i ? 'rotate(180deg)' : '', transition: 'transform .3s', flexShrink: 0 }} />
              </div>
              {activeAccordion === i && <div style={{ padding: '0 22px 20px', fontSize: 14, color: '#78716c', lineHeight: 1.8 }}>{faq.a}</div>}
            </div>
          ))}
          <div style={{ marginTop: 44, background: 'linear-gradient(135deg,#f97316,#ea580c)', borderRadius: 22, padding: '38px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🌟</div>
            <h3 style={{ fontFamily: "'Baloo 2',cursive", color: '#fff', fontWeight: 800, fontSize: 22, marginBottom: 8 }}>{t.faq.ctaBanner}</h3>
            <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 14, marginBottom: 24 }}>{t.faq.ctaBannerSub}</p>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '13px 28px', background: '#fff', color: '#f97316', borderRadius: 99, fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              <Phone size={17} /> {t.faq.ctaBannerBtn}
            </a>
          </div>
        </div>
      </section>

      {/* MAP */}
      <section id="ubicacion" className="lp-map-section">
        <div style={{ position: 'relative', height: 340 }}>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3876.4229091779425!2d-76.0288421240214!3d-13.692817174731204!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x91104331c0093305%3A0x21adbeb7d8eb168d!2sC.%20Victor%20Raul%20Haya%20de%20la%20Torre%2C%2011641!5e0!3m2!1ses-419!2spe!4v1770256602309!5m2!1ses-419!2spe"
            width="100%" height="100%" style={{ border: 0, position: 'absolute', inset: 0 }} allowFullScreen loading="lazy" title={t.map.title}
          />
        </div>
        <div className="lp-map-card">
          <h3 style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 800, fontSize: 20, color: '#1c1917', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
            <MapPin color="#ef4444" size={20} /> {t.map.title}
          </h3>
          <p style={{ color: '#78716c', fontSize: 13, lineHeight: 1.75, marginBottom: 18 }}>{t.map.sub}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#44403c' }}>
              <Clock size={15} color="#f97316" /><span><strong>{t.map.schedule}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#44403c' }}>
              <Phone size={15} color="#25d366" /><span>+51 991 070 734</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: '#44403c' }}>
              <Mail size={15} color="#f59e0b" /><span>contacto@santi.com</span>
            </div>
          </div>
          <a href="https://maps.app.goo.gl/fv9HhtWj5R45a5paA" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', borderRadius: 99, fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
            <MapPin size={16} /> {t.map.mapsBtn}
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ position: 'relative', width: 40, height: 40 }}>
                <Image src="/images/logo.png?v=2" alt="Logo" fill style={{ objectFit: 'contain' }} unoptimized />
              </div>
              <span style={{ fontFamily: "'Baloo 2',cursive", color: '#fff', fontWeight: 800, fontSize: 17 }}>Vanty ABA</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.75, marginBottom: 18 }}>{t.footer.tagline}</p>
            <div>
              <a href="https://www.facebook.com" className="lp-social" aria-label="Facebook"><Facebook size={15} /></a>
              <a href="https://www.instagram.com" className="lp-social" aria-label="Instagram"><Instagram size={15} /></a>
            </div>
          </div>
          <div>
            <h4>{t.footer.services}</h4>
            <ul>
              {t.footer.serviceItems.map(s => <li key={s}><a href={waUrl}>{s}</a></li>)}
            </ul>
          </div>
          <div>
            <h4>{t.footer.platform}</h4>
            <ul>
              <li><a href="/login">{t.footer.login}</a></li>
              <li><a href="/login?mode=signup">{t.footer.signup}</a></li>
              <li><a href="#para-padres">{t.footer.forParents}</a></li>
              <li><a href="#aria">{t.footer.ariaAssistant}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t.footer.schedule}</h4>
            <p style={{ fontSize: 13, marginBottom: 6 }}>{t.footer.scheduleHours}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.22)', marginBottom: 3 }}>{t.footer.saturDayClosed}</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.22)', marginBottom: 14 }}>{t.footer.sundayClosed}</p>
            <p style={{ fontSize: 12 }}>Independencia, Pisco, Ica</p>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 22, textAlign: 'center', fontSize: 12 }}>
          {t.footer.copy}
        </div>
      </footer>
    </>
  )
}
