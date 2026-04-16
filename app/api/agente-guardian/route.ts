// app/api/agente-guardian/route.ts
// 🔐 Agente Guardián — seguridad de datos, auditoría y detección de anomalías
// Registra accesos, detecta patrones sospechosos y protege datos clínicos

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createHash } from 'crypto'

// ─── Tipos de eventos auditables ────────────────────────────────────────────
export type EventoAuditoria =
  | 'LOGIN' | 'LOGOUT' | 'DATA_ACCESS' | 'DATA_EXPORT' | 'REPORT_GENERATED'
  | 'PATIENT_VIEW' | 'RECORD_CREATE' | 'RECORD_UPDATE' | 'RECORD_DELETE'
  | 'BULK_EXPORT' | 'UNAUTHORIZED_ATTEMPT' | 'PASSWORD_CHANGE' | 'ROLE_CHANGE'

function generarHashEvento(data: object): string {
  return createHash('sha256')
    .update(JSON.stringify(data) + process.env.AUDIT_SECRET || 'jugando-aprendo-audit')
    .digest('hex')
    .slice(0, 16)
}

// ─── POST: Registrar evento de auditoría ─────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { accion, userId, userRole, recurso, detalles, ip } = body

    if (!accion || !userId) {
      return NextResponse.json({ error: 'accion y userId requeridos' }, { status: 400 })
    }

    const timestamp = new Date().toISOString()
    const hashVerificacion = generarHashEvento({ accion, userId, recurso, timestamp })

    // Insertar log
    const { data: log } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        accion,
        user_id: userId,
        user_role: userRole || 'unknown',
        recurso: recurso || null,
        detalles: detalles || null,
        ip_address: ip || req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        hash_verificacion: hashVerificacion,
        timestamp
      })
      .select('id')
      .single()

    // Detectar anomalías en tiempo real
    const anomalia = await detectarAnomalia(userId, accion, recurso)
    if (anomalia) {
      await supabaseAdmin.from('alertas_seguridad').insert({
        tipo: anomalia.tipo,
        user_id: userId,
        descripcion: anomalia.descripcion,
        nivel: anomalia.nivel,
        metadata: { accion, recurso, detalles },
        resuelto: false,
        timestamp
      })
    }

    return NextResponse.json({
      registrado: true,
      id: (log as any)?.id,
      hash: hashVerificacion,
      anomalia: anomalia || null
    })

  } catch (e: any) {
    console.error('❌ Error guardian:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── GET: Consultar logs y alertas ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo') || 'resumen'
  const userId = searchParams.get('user_id')
  const dias = parseInt(searchParams.get('dias') || '7')

  const fechaInicio = new Date()
  fechaInicio.setDate(fechaInicio.getDate() - dias)

  try {
    if (tipo === 'alertas') {
      const { data } = await supabaseAdmin
        .from('alertas_seguridad')
        .select('*')
        .eq('resuelto', false)
        .gte('timestamp', fechaInicio.toISOString())
        .order('timestamp', { ascending: false })
        .limit(50)
      return NextResponse.json({ alertas: data || [] })
    }

    if (tipo === 'logs') {
      let query = supabaseAdmin
        .from('audit_logs')
        .select('*')
        .gte('timestamp', fechaInicio.toISOString())
        .order('timestamp', { ascending: false })
        .limit(200)

      if (userId) query = query.eq('user_id', userId)
      const { data } = await query
      return NextResponse.json({ logs: data || [] })
    }

    // Resumen de seguridad
    const [logs, alertas, exportaciones] = await Promise.all([
      supabaseAdmin.from('audit_logs').select('accion, user_role, timestamp').gte('timestamp', fechaInicio.toISOString()),
      supabaseAdmin.from('alertas_seguridad').select('tipo, nivel, resuelto').gte('timestamp', fechaInicio.toISOString()),
      supabaseAdmin.from('audit_logs').select('id').eq('accion', 'DATA_EXPORT').gte('timestamp', fechaInicio.toISOString())
    ])

    const totalAccesos = logs.data?.length || 0
    const alertasActivas = alertas.data?.filter(a => !a.resuelto).length || 0
    const alertasCriticas = alertas.data?.filter(a => a.nivel === 'critico' && !a.resuelto).length || 0
    const exportacionesTotal = exportaciones.data?.length || 0

    // Accesos por rol
    const accesosPorRol: Record<string, number> = {}
    logs.data?.forEach(l => {
      accesosPorRol[l.user_role] = (accesosPorRol[l.user_role] || 0) + 1
    })

    // Actividad por hora (últimas 24h)
    const hace24h = new Date()
    hace24h.setHours(hace24h.getHours() - 24)
    const actividadHoras: number[] = Array(24).fill(0)
    logs.data?.forEach(l => {
      const hora = new Date(l.timestamp).getHours()
      actividadHoras[hora]++
    })

    // Score de seguridad (0-100)
    const scoreSeguridad = Math.max(0, Math.min(100,
      100
      - (alertasCriticas * 20)
      - (alertasActivas * 5)
      - (exportacionesTotal > 10 ? 10 : 0)
    ))

    return NextResponse.json({
      scoreSeguridad,
      totalAccesos,
      alertasActivas,
      alertasCriticas,
      exportacionesTotal,
      accesosPorRol,
      actividadHoras,
      estado: alertasCriticas > 0 ? 'critico' : alertasActivas > 0 ? 'alerta' : 'seguro'
    })

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ─── Detector de anomalías ───────────────────────────────────────────────────
async function detectarAnomalia(userId: string, accion: string, recurso: string | null) {
  try {
    const hace1hora = new Date()
    hace1hora.setHours(hace1hora.getHours() - 1)

    // Regla 1: Demasiados accesos en 1 hora
    const { count: accesosRecientes } = await supabaseAdmin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('timestamp', hace1hora.toISOString())

    if ((accesosRecientes || 0) > 100) {
      return {
        tipo: 'EXCESO_ACCESOS',
        descripcion: `Usuario realizó ${accesosRecientes} accesos en 1 hora. Posible scraping o acceso automatizado.`,
        nivel: 'alto'
      }
    }

    // Regla 2: Múltiples exportaciones
    const { count: exportaciones } = await supabaseAdmin
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('accion', 'DATA_EXPORT')
      .gte('timestamp', hace1hora.toISOString())

    if ((exportaciones || 0) > 5) {
      return {
        tipo: 'EXPORTACION_MASIVA',
        descripcion: `${exportaciones} exportaciones en 1 hora. Posible extracción masiva de datos clínicos.`,
        nivel: 'critico'
      }
    }

    // Regla 3: Intento no autorizado
    if (accion === 'UNAUTHORIZED_ATTEMPT') {
      return {
        tipo: 'ACCESO_NO_AUTORIZADO',
        descripcion: `Intento de acceso no autorizado al recurso: ${recurso || 'desconocido'}`,
        nivel: 'critico'
      }
    }

    return null
  } catch {
    return null
  }
}
