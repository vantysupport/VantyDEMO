import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/components/ThemeContext'
// import SessionGuard from '@/components/SessionGuard' // desactivado: ver nota abajo
import "./globals.css";

// Sistema de dos tipografías:
//  • CUERPO → Plus Jakarta Sans (var --font-sans): legible, profesional.
//  • TÍTULOS / NEGRITAS → Poppins (var --font-display): geométrica y con
//    presencia; el bold marca elegancia y jerarquía premium.
// La diferencia clara entre ambas (display bold vs body normal) da el look premium.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: " Terapias SANTI | Terapia ABA y Neurodivergencia en Pisco, Ica",
  description: "Centro especializado en terapia ABA y desarrollo infantil en Pisco, Ica. Atendemos niños con autismo, TEA, TDAH y neurodivergencia con metodología basada en evidencia e IA. +50 familias.",
  keywords: "terapeuta ABA Pisco, terapia autismo Ica, centro neurodivergencia Pisco, TEA Pisco, TDAH Pisco, desarrollo infantil Ica, terapia conductual niños Pisco",
  authors: [{ name: "SANTI" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SANTI",
    startupImage: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: " Terapias SANTI | Terapia ABA en Pisco, Ica",
    description: "Centro especializado en neurodivergencia. Terapia ABA con IA para niños en Pisco, Ica, Perú.",
    type: "website",
    locale: "es_PE",
    url: "https://centro-santi.vercel.app",
    siteName: "SANTI",
    images: [{ url: "/images/hero-image.jpg", width: 1200, height: 630, alt: " Terapias SANTI - Terapia ABA Pisco" }],
  },
  twitter: {
    card: "summary_large_image",
    title: " Terapias SANTI | Terapia ABA en Pisco, Ica",
    description: "Centro especializado en neurodivergencia. Terapia ABA + IA para niños.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://centro-santi.vercel.app" },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        {/*
          🚫 ANTI-FOUC (Flash of Unstyled Content)
          En caché frío (incógnito / primera visita) el navegador alcanza a pintar
          el HTML antes de aplicar el CSS, mostrando el texto amontonado un instante.
          Arrancamos el <body> invisible y lo revelamos con un fade apenas el DOM
          está listo (cuando el CSS ya aplicó). Dos redes de seguridad evitan que
          quede en blanco: un timeout failsafe y un <noscript>.
        */}
        <style dangerouslySetInnerHTML={{ __html: `body{opacity:0;transition:opacity .25s ease}` }} />
        <noscript><style dangerouslySetInnerHTML={{ __html: `body{opacity:1!important}` }} /></noscript>
        <script dangerouslySetInnerHTML={{
          __html: `
            (function(){
              function show(){ try{ if(document.body) document.body.style.opacity='1'; }catch(e){} }
              if (document.readyState !== 'loading') show();
              else document.addEventListener('DOMContentLoaded', show);
              window.addEventListener('load', show);
              setTimeout(show, 1500); // failsafe: nunca dejar la página invisible
            })();
          `
        }} />
        <meta name="google-site-verification" content="xQbKWmWgeRRPlZbv5h7rEDXAOw0TPHC3140_cyWT9OI" />
        <meta name="google-site-verification" content="Vm989cC49i4_RMsZFi23exrJONLlBnEvu00C4Zs1Lm4" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SANTI" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/*
          🔒 SILENCIADOR DE CONSOLA EN PRODUCCIÓN
          Neutraliza console.log/info/debug/warn/error en el navegador para que NO
          se filtren detalles internos (respuestas, IDs, errores) por la consola.
          Solo aplica en producción — en desarrollo la consola funciona normal.
          NOTA: esto no oculta la pestaña Red (eso es propio del navegador), pero
          sí elimina toda la información que la app imprimía en consola.
        */}
        {process.env.NODE_ENV === 'production' && (
          <script dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var noop = function(){};
                  ['log','info','debug','warn','error','trace','table','dir','group','groupEnd','count','time','timeEnd'].forEach(function(m){
                    if (window.console) window.console[m] = noop;
                  });
                } catch(e) {}
              })();
            `
          }} />
        )}

        {/*
          Script de pre-hidratación: aplica la clase `dark` ANTES del primer paint
          para evitar el "flash" de modo claro cuando el usuario tiene modo oscuro
          configurado en el OS. Lee localStorage y/o prefers-color-scheme.
          También quita la clase si la ruta es login (login siempre claro).
        */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var p = window.location.pathname;
                var isLogin = p === '/' || p === '/login';
                if (isLogin) {
                  document.documentElement.classList.remove('dark');
                  return;
                }
                var stored = localStorage.getItem('app-theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var dark = stored === 'dark' || ((stored === 'system' || !stored) && prefersDark);
                if (dark) document.documentElement.classList.add('dark');
                else document.documentElement.classList.remove('dark');
              } catch (e) { /* silencioso */ }
            })();
          `
        }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            {/* SessionGuard desactivado temporalmente: causaba deadlock del lock
                de auth de supabase-js (login lento y datos sin cargar). */}
            {/* <SessionGuard /> */}
            {children}
          </ToastProvider>
        </ThemeProvider>

        {/* El footer legal vive en la página de login (y landing). Se quitó del
            layout global porque aparecía molestando en todas las pantallas. */}

        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registrado:', reg.scope); })
                  .catch(function(err) { console.log('SW error:', err); });
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
