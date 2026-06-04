// app/api/admin/storage-usage/route.ts
// Devuelve el uso real de almacenamiento del proyecto Supabase:
//  - Storage (archivos): suma recursiva del tamaño de todos los objetos de cada bucket.
//  - Base de datos: tamaño total vía RPC get_db_size() (pg_database_size).
// Solo accesible para roles jefe/admin. Usa service_role para evitar RLS.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Cupos del plan Free de Supabase
const STORAGE_CAP = 1 * 1024 * 1024 * 1024   // 1 GB de archivos
const DB_CAP      = 500 * 1024 * 1024         // 500 MB de base de datos

// Suma recursiva del tamaño de todos los objetos de un bucket
async function sumBucket(bucket: string): Promise<number> {
  let total = 0
  const LIMIT = 1000

  async function walk(prefix: string): Promise<void> {
    let offset = 0
    while (true) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(prefix, { limit: LIMIT, offset, sortBy: { column: 'name', order: 'asc' } })
      if (error || !data || data.length === 0) break

      for (const item of data) {
        // Las carpetas vienen con id === null (sin metadata)
        if (item.id === null) {
          await walk(prefix ? `${prefix}/${item.name}` : item.name)
        } else {
          const size = (item.metadata as any)?.size
          if (typeof size === 'number') total += size
        }
      }

      if (data.length < LIMIT) break
      offset += LIMIT
    }
  }

  await walk('')
  return total
}

export async function GET(req: NextRequest) {
  try {
    // ── Verificar que el solicitante sea jefe/admin ──
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
    if (userErr || !userData?.user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()
    if (!profile || (profile.role !== 'jefe' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // ── Storage: sumar todos los buckets ──
    const { data: buckets } = await supabaseAdmin.storage.listBuckets()
    const breakdown: { bucket: string; bytes: number }[] = []
    let storageBytes = 0
    for (const b of buckets || []) {
      const bytes = await sumBucket(b.name)
      breakdown.push({ bucket: b.name, bytes })
      storageBytes += bytes
    }
    breakdown.sort((a, b) => b.bytes - a.bytes)

    // ── Base de datos: RPC opcional (tolerante si no existe la función) ──
    let dbBytes: number | null = null
    try {
      const { data, error } = await supabaseAdmin.rpc('get_db_size')
      if (!error && data != null) dbBytes = Number(data)
    } catch { /* función no instalada todavía */ }

    return NextResponse.json({
      ok: true,
      storage: { used: storageBytes, cap: STORAGE_CAP, breakdown },
      database: { used: dbBytes, cap: DB_CAP },
      updatedAt: new Date().toISOString(),
    })
  } catch (e: any) {
    console.error('[storage-usage]', e)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'production' ? 'Error al calcular el uso.' : (e?.message || 'error') },
      { status: 500 }
    )
  }
}
