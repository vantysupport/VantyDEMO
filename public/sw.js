// Vanty Service Worker v3 — optimizado para iOS Safari PWA
const CACHE_NAME = 'vanty-v3'

const STATIC_ASSETS = [
  '/',
  '/login',
  '/padre',
  '/admin',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-152x152.png',
  '/icons/apple-touch-icon.png',
]

// ── Instalación ─────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll puede fallar si algún asset no existe — usar add individual
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      )
    })
  )
  self.skipWaiting()
})

// ── Activación: limpiar caches viejos ───────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // No interceptar: APIs, auth, supabase, otros dominios
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('openai') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('microsoft') ||
    url.hostname !== self.location.hostname
  ) {
    return
  }

  // Estrategia: Network first con fallback a cache
  // Para iOS Safari PWA es importante tener fallback para offline
  event.respondWith(
    fetch(request)
      .then(response => {
        // Solo cachear respuestas exitosas
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        // Fallback a cache cuando no hay red
        return caches.match(request).then(cached => {
          if (cached) return cached
          // Fallback final: página principal
          if (request.destination === 'document') {
            return caches.match('/') || caches.match('/login')
          }
        })
      })
  )
})

// ── Push notifications (mantener funcionalidad existente) ────────────────────
self.addEventListener('push', event => {
  if (!event.data) return
  try {
    const data = event.data.json()
    event.waitUntil(
      self.registration.showNotification(data.title || 'Vanty', {
        body:    data.body    || '',
        icon:    data.icon    || '/icons/icon-192x192.png',
        badge:   data.badge   || '/icons/icon-96x96.png',
        data:    data.data    || {},
        actions: data.actions || [],
        tag:     data.tag     || 'vanty-notification',
        renotify: true,
      })
    )
  } catch {
    const text = event.data.text()
    event.waitUntil(
      self.registration.showNotification('Vanty', { body: text, icon: '/icons/icon-192x192.png' })
    )
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          return
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
