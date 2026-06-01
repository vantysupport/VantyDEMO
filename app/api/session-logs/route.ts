import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/session-logs
 * Query params:
 *   parent_id   – filter by a specific parent (optional)
 *   days        – how many days back to fetch (default 30)
 *   summary     – if "true", return aggregated totals per parent
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const parentId = searchParams.get('parent_id')
  const days = parseInt(searchParams.get('days') || '30')
  const summary = searchParams.get('summary') === 'true'

  const since = new Date()
  since.setDate(since.getDate() - days)

  try {
    if (summary) {
      // ── Aggregated view: total time per parent ──────────────────────────────
      const { data: logs, error } = await supabase
        .from('parent_session_logs')
        .select(`
          parent_id,
          started_at,
          ended_at,
          duration_seconds,
          device,
          profiles!parent_session_logs_parent_id_fkey (
            id, full_name, email, phone
          )
        `)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false })

      if (error) throw error

      // Group by parent
      const byParent: Record<string, any> = {}
      for (const log of logs || []) {
        const pid = log.parent_id
        if (!byParent[pid]) {
          byParent[pid] = {
            parent_id: pid,
            profile: (log as any).profiles,
            total_seconds: 0,
            session_count: 0,
            last_seen: null,
            first_seen: null,
            devices: new Set<string>(),
            sessions: [],
          }
        }
        const dur = log.duration_seconds || 0
        byParent[pid].total_seconds += dur
        byParent[pid].session_count += 1
        byParent[pid].devices.add(log.device || 'unknown')
        if (!byParent[pid].last_seen || log.started_at > byParent[pid].last_seen) {
          byParent[pid].last_seen = log.started_at
        }
        if (!byParent[pid].first_seen || log.started_at < byParent[pid].first_seen) {
          byParent[pid].first_seen = log.started_at
        }
        byParent[pid].sessions.push({
          started_at: log.started_at,
          ended_at: log.ended_at,
          duration_seconds: log.duration_seconds,
          device: log.device,
        })
      }

      const result = Object.values(byParent).map((p: any) => ({
        ...p,
        devices: Array.from(p.devices),
        avg_session_seconds: p.session_count > 0
          ? Math.round(p.total_seconds / p.session_count) : 0,
      }))

      // Sort by most active
      result.sort((a: any, b: any) => b.total_seconds - a.total_seconds)

      return NextResponse.json({ data: result })
    }

    // ── Raw logs for a single parent ──────────────────────────────────────────
    let query = supabase
      .from('parent_session_logs')
      .select('*')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false })
      .limit(100)

    if (parentId) query = query.eq('parent_id', parentId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : err.message }, { status: 500 })
  }
}

/**
 * POST /api/session-logs
 * Upsert/update a session log (called from client hook as fallback)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, id, parent_id, duration_seconds } = body

    if (action === 'end' && id) {
      const { error } = await supabase
        .from('parent_session_logs')
        .update({ ended_at: new Date().toISOString(), duration_seconds })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'start' && parent_id) {
      const device = body.device || 'unknown'
      const { data, error } = await supabase
        .from('parent_session_logs')
        .insert({ parent_id, started_at: new Date().toISOString(), device })
        .select('id')
        .single()
      if (error) throw error
      return NextResponse.json({ id: data.id })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : err.message }, { status: 500 })
  }
}
