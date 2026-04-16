import { NextRequest, NextResponse } from 'next/server'

// Voice ID: configura ELEVENLABS_VOICE_ID en tus env vars de Vercel
// Para obtenerlo: ElevenLabs → tu voz → copiar el ID desde la URL o la página de la voz
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'yM93hbw8Qtvdma2wCnJG'
const ELEVENLABS_MODEL    = process.env.ELEVENLABS_MODEL    || 'eleven_multilingual_v2'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto requerido' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY no configurada' }, { status: 500 })
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
      // Limitar a 4000 caracteres para evitar latencia excesiva (ElevenLabs soporta hasta 5000)
      .slice(0, 4000)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: clean,
          model_id: ELEVENLABS_MODEL,
          voice_settings: {
            stability: 0.45,          // Algo de variación para sonar natural
            similarity_boost: 0.80,   // Fiel a la voz original
            style: 0.30,              // Estilo expresivo moderado
            use_speaker_boost: true,
          },
          output_format: 'mp3_44100_128',
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error(`ElevenLabs error (voice: ${ELEVENLABS_VOICE_ID}):`, response.status, err)
      return NextResponse.json({ error: `ElevenLabs ${response.status}: ${err}` }, { status: response.status })
    }

    // Pasar el stream de audio directamente al cliente
    const audioBuffer = await response.arrayBuffer()
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })

  } catch (error: any) {
    console.error('Error en /api/elevenlabs-tts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
