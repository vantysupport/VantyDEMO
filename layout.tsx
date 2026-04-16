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
  title: "Vanty | Terapia ABA y Neurodivergencia en Pisco, Ica",
  description: "Centro especializado en terapia ABA y desarrollo infantil en Pisco, Ica. Atendemos niños con autismo, TEA, TDAH y neurodivergencia con metodología basada en evidencia e IA. +50 familias.",
  keywords: "terapeuta ABA Pisco, terapia autismo Ica, centro neurodivergencia Pisco, TEA Pisco, TDAH Pisco, desarrollo infantil Ica, terapia conductual niños Pisco",
  authors: [{ name: "Vanty" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vanty",
    startupImage: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Vanty | Terapia ABA en Pisco, Ica",
    description: "Centro especializado en neurodivergencia. Terapia ABA con IA para niños en Pisco, Ica, Perú.",
    type: "website",
    locale: "es_PE",
    url: "https://jugandoaprendo.com",
    siteName: "Vanty",
    images: [{ url: "/images/hero-image.jpg", width: 1200, height: 630, alt: "Vanty - Terapia ABA Pisco" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vanty | Terapia ABA en Pisco, Ica",
    description: "Centro especializado en neurodivergencia. Terapia ABA + IA para niños.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "https://jugandoaprendo.com" },
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
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vanty" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
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
