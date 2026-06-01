// app/api/admin/upload-imagen/route.ts
// Sube imágenes públicas (catálogo de terapias, tienda, recursos, etc.)
// a un bucket de Supabase Storage. Si el bucket no existe, lo CREA
// automáticamente con visibilidad pública usando service_role.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const DEFAULT_BUCKET = 'public-images'
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB para imágenes
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

async function ensureBucket(bucket: string): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets()
  const exists = (buckets || []).some(b => b.name === bucket)
  if (exists) return
  const { error } = await supabaseAdmin.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: MAX_SIZE,
    allowedMimeTypes: ALLOWED_TYPES,
  })
  if (error) {
    if (!/already exists/i.test(error.message)) {
      throw new Error(`No se pudo crear bucket ${bucket}: ${error.message}`)
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string | null) || 'misc'
    const bucket = (formData.get('bucket') as string | null) || DEFAULT_BUCKET
    // ✅ FIX: parámetro opcional — si se pasa, el servidor actualiza avatar_url
    // usando supabaseAdmin (sin restricciones de RLS del cliente browser)
    const updateProfileId = (formData.get('updateProfileId') as string | null) || null

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Imagen demasiado grande (máx 5 MB)' }, { status: 413 })
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Tipo no permitido (${file.type}). Usá JPG, PNG, WebP, GIF o AVIF.` }, { status: 415 })
    }

    await ensureBucket(bucket)

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5)
    const safeFolder = folder.replace(/[^a-z0-9_\-\/]/gi, '').replace(/^\/+|\/+$/g, '') || 'misc'
    const path = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (uploadErr) {
      console.error('[upload-imagen] upload error:', uploadErr)
      return NextResponse.json({ error: `Error al subir: ${uploadErr.message}` }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)
    const publicUrl = urlData.publicUrl

    // ✅ FIX: actualizar avatar_url server-side con supabaseAdmin para evitar
    // el fallo silencioso de RLS cuando se hace el update desde el cliente browser
    if (updateProfileId) {
      const { error: dbErr } = await supabaseAdmin
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', updateProfileId)
      if (dbErr) {
        console.error('[upload-imagen] profile update error:', dbErr)
        return NextResponse.json(
          { error: `Imagen subida pero error al guardar en perfil: ${dbErr.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path,
      bucket,
    })
  } catch (e: any) {
    console.error('[upload-imagen]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : (e?.message || "error") || 'Error desconocido' }, { status: 500 })
  }
}
