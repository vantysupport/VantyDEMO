'use client'

/**
 * useSessionTracker
 * -----------------
 * Tracks how long the authenticated parent is connected in the current session.
 *
 * - Records a row in `parent_session_logs` when the session starts
 * - Updates `ended_at` + `duration_seconds` periodically (every 30 s) and on unload
 * - Exposes `elapsedSeconds` for a live display in the UI
 *
 * Supabase table required:
 *   parent_session_logs (
 *     id            uuid primary key default gen_random_uuid(),
 *     parent_id     uuid not null references profiles(id),
 *     started_at    timestamptz not null default now(),
 *     ended_at      timestamptz,
 *     duration_seconds int,
 *     device        text,
 *     created_at    timestamptz default now()
 *   )
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useSessionTracker(parentId: string | null | undefined) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const sessionRowId = useRef<string | null>(null)
  const startTime = useRef<number>(Date.now())
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Persist elapsed time to Supabase ───────────────────────────────────────
  const persistDuration = useCallback(async () => {
    if (!sessionRowId.current || !parentId) return
    const seconds = Math.round((Date.now() - startTime.current) / 1000)
    await supabase
      .from('parent_session_logs')
      .update({ ended_at: new Date().toISOString(), duration_seconds: seconds })
      .eq('id', sessionRowId.current)
  }, [parentId])

  useEffect(() => {
    if (!parentId) return

    // ── Create the session log row ────────────────────────────────────────────
    const createRow = async () => {
      const device = typeof window !== 'undefined'
        ? (navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop')
        : 'unknown'

      const { data, error } = await supabase
        .from('parent_session_logs')
        .insert({
          parent_id: parentId,
          started_at: new Date().toISOString(),
          device,
        })
        .select('id')
        .single()

      if (!error && data?.id) {
        sessionRowId.current = data.id
        startTime.current = Date.now()
      }
    }

    createRow()

    // ── Live elapsed ticker (every second) ───────────────────────────────────
    tickRef.current = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startTime.current) / 1000))
    }, 1000)

    // ── Sync to DB every 30 seconds ───────────────────────────────────────────
    syncRef.current = setInterval(persistDuration, 30_000)

    // ── Persist on tab close / navigation away ────────────────────────────────
    const handleUnload = () => { persistDuration() }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') persistDuration()
    }

    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (tickRef.current)  clearInterval(tickRef.current)
      if (syncRef.current)  clearInterval(syncRef.current)
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
      persistDuration()
    }
  }, [parentId, persistDuration])

  return { elapsedSeconds }
}

// ── Formatting helpers ─────────────────────────────────────────────────────────
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function formatDurationShort(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
