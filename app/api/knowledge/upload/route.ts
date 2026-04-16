// app/api/knowledge/upload/route.ts
// Sube archivos al Storage usando service role key (bypassa RLS del bucket)
// IMPORTANTE: Vercel limita el body a 4.5MB en el plan gratuito.
// Para archivos grandes, el frontend debe subir directamente a Supabase Storage
// usando una URL pre-firmada que generamos aquí.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const BUCKET = process.env.KNOWLEDGE_BUCKET_NAME || 'knowledge-base'
const MAX_SIZE = 500 * 1024 * 1024 // 500MB
const VERCEL_LIMIT = 4 * 1024 * 1024 // 4MB — límite seguro para FormData en Vercel

export async function POST(req: NextRequest) {
  try {
    const contentLength = parseInt(req.headers.get('content-length') || '0')

    // Si el archivo es grande, usar upload directo con presigned URL
    // El cliente pidió una URL de upload pre-firmada con GET ?presign=true
    const { searchParams } = new URL(req.url)
    if (searchParams.get('presign') === 'true') {
      return handlePresign(req)
    }

    // Para archivos pequeños (<4MB), recibir por FormData normal
    if (contentLength > VERCEL_LIMIT) {
      return NextResponse.json({
        error: `El archivo es demasiado grande para subir directamente (${Math.round(contentLength / 1024 / 1024)}MB). Usa la opción de URL pre-firmada.`,
        usePresign: true,
      }, { status: 413 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    const safeName = `knowledge/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(safeName, buffer, {
        contentType: file.type || 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `Error al subir: ${uploadError.message}` }, { status: 500 })
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(safeName, 7200)

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar la URL del archivo' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      storageUrl: signedData.signedUrl,
      fileName: file.name,
      path: safeName,
    })
  } catch (e: any) {
    console.error('Error en upload:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Genera una URL pre-firmada para que el cliente suba DIRECTAMENTE a Supabase Storage
// sin pasar por Vercel — evita el límite de 4.5MB
async function handlePresign(req: NextRequest) {
  try {
    const body = await req.json()
    const { fileName, contentType } = body
    if (!fileName) return NextResponse.json({ error: 'fileName requerido' }, { status: 400 })

    const safeName = `knowledge/${Date.now()}_${fileName.replace(/\s+/g, '_')}`

    // Crear upload URL pre-firmada (válida 1 hora)
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(safeName)

    if (error || !data) {
      return NextResponse.json({ error: `No se pudo crear URL de upload: ${error?.message}` }, { status: 500 })
    }

    // También pre-generar la signed URL de descarga para el ingest
    const { data: readUrl } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(safeName, 7200)

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      path: safeName,
      storageUrl: readUrl?.signedUrl || '',
      fileName,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
