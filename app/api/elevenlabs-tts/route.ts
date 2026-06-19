import { NextRequest, NextResponse } from 'next/server'
import { logServerError } from '@/lib/log-server-error'
import { synthesizeEdgeTTS } from '@/lib/edge-tts'

// Voz de ARIA. GRATIS vía Microsoft Edge TTS — sin API key.
// El audio se genera al momento y NO se almacena en ningún lado.
// (La ruta conserva el nombre "elevenlabs-tts" por compatibilidad con los
//  componentes que ya la consumen; internamente ya NO usa ElevenLabs.)
export const runtime = 'nodejs'

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || 'es-PE-CamilaNeural'

export async function POST(req: NextRequest) {
  try {
    const { text, language, voice } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })
    }

    // Limpiar el texto de markdown y emojis antes de enviarlo
    const clean = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[💙📊🏠💬❌⚠️✅🎯📋💡🤖💜😊😐😔📨🔊🎤]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{2,}/g, '. ')
      .replace(/•/g, '')
      .trim()
      .slice(0, 4000)

    if (!clean) {
      return NextResponse.json({ error: 'Texto vacío tras limpieza' }, { status: 400 })
    }

    // El acento lo define la voz. Si el cliente envía un locale completo
    // (p. ej. "es-MX") lo respetamos; un simple "es" usa el acento de la voz.
    const lang = typeof language === 'string' && language.includes('-') ? language : undefined

    const audio = await synthesizeEdgeTTS(clean, {
      voice: voice || DEFAULT_VOICE,
      lang,
    })

    if (!audio || audio.length === 0) {
      await logServerError('Edge TTS audio vacío', `voz: ${voice || DEFAULT_VOICE}`, 'api:tts')
      return NextResponse.json({ error: 'No se pudo generar el audio. Intenta de nuevo.' }, { status: 502 })
    }

    return new NextResponse(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',  // nada se guarda — voz solo al momento
      },
    })

  } catch (error: any) {
    await logServerError('Error en /api/elevenlabs-tts (Edge TTS)', error?.stack || error?.message || String(error), 'api:tts')
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
