// app/api/chat-familias/upload/route.ts
// Sube archivos de chat (imágenes, docs, audios) a Supabase Storage

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = 'chat-media'
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const childId = formData.get('child_id') as string | null

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Archivo demasiado grande (máx 20MB)' }, { status: 413 })

    const ext = file.name.split('.').pop() || 'bin'
    const safeName = `chat-familias/${childId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Intentar subir — si el bucket no existe, devolver error claro
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(safeName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
    }

    // URL pública (el bucket debe ser público) o firmada
    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(safeName)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })
  } catch (e: any) {
    console.error('Chat upload error:', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
