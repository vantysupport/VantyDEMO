import type { Metadata, Viewport } from "next";
import { ToastProvider } from '@/components/Toast'
import { ThemeProvider } from '@/components/ThemeContext'
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#5B3FC8",
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="xQbKWmWgeRRPlZbv5h7rEDXAOw0TPHC3140_cyWT9OI" />
        <meta name="google-site-verification" content="Vm989cC49i4_RMsZFi23exrJONLlBnEvu00C4Zs1Lm4" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SANTI" />
        <meta name="mobile-web-app-capable" content="yes" />
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
            {children}
          </ToastProvider>
        </ThemeProvider>

        {/* Footer con links legales para Google OAuth */}
        <footer className="text-center text-sm text-gray-400 py-6 border-t mt-auto">
          <div className="flex justify-center gap-6">
            <a href="/privacy" className="hover:underline">Política de Privacidad</a>
            <a href="/terms" className="hover:underline">Términos de Servicio</a>
          </div>
          <p className="mt-2">© 2026 Neuropsicología y Terapias SANTI</p>
        </footer>

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
