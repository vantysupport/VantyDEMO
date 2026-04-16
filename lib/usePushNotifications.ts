'use client'

import { useState, useEffect, useCallback } from 'react'

interface UsePushNotificationsResult {
  permission: NotificationPermission | 'unsupported'
  isSubscribed: boolean
  isLoading: boolean
  requestPermission: () => Promise<boolean>
  unsubscribe: () => Promise<void>
}

export function usePushNotifications(userId: string | null): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Check current state on mount
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported')
      return
    }
    setPermission(Notification.permission)

    if (Notification.permission === 'granted' && userId) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsSubscribed(!!sub)
        })
      })
    }
  }, [userId])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!userId) return false
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

    setIsLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') return false

      const reg = await navigator.serviceWorker.ready
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

      // Convert VAPID public key to Uint8Array
      const b64 = vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/')
      const raw = Uint8Array.from(atob(b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=')), c => c.charCodeAt(0))

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: raw,
      })

      // Save subscription to our backend
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: subscription.toJSON() }),
      })

      setIsSubscribed(true)
      return true
    } catch (err) {
      console.error('Push subscription error:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const unsubscribe = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
        setIsSubscribed(false)
      }
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  return { permission, isSubscribed, isLoading, requestPermission, unsubscribe }
}
