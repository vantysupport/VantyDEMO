import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import webpush from 'web-push'

export async function POST(request: NextRequest) {
  // Configure VAPID inside the handler so env vars are available at runtime
  webpush.setVapidDetails(
    'mailto:hola@vanty.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  try {
    const { userId, title, body, url } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    // Get all push subscriptions for this user
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('subscription, endpoint')
      .eq('user_id', userId)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0, message: 'Sin suscripciones activas' })
    }

    const payload = JSON.stringify({
      title: title || 'Vanty',
      body: body || 'Tienes un nuevo mensaje',
      url: url || '/padre',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
    })

    const results = await Promise.allSettled(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
          return 'ok'
        } catch (err: any) {
          // 410 Gone = subscription expired, remove it
          if (err.statusCode === 410) {
            await supabaseAdmin
              .from('push_subscriptions')
              .delete()
              .eq('user_id', userId)
              .eq('endpoint', row.endpoint)
          }
          throw err
        }
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ sent, total: subs.length })

  } catch (error: any) {
    console.error('Push notification error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
