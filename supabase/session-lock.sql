-- ─────────────────────────────────────────────────────────────────────────────
-- SESIÓN ÚNICA POR CUENTA (versión server-side)
-- La lógica de claim/heartbeat/release vive en los endpoints /api/session/* y se
-- ejecuta con service_role (bypassa RLS). Aquí solo necesitamos dos columnas.
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists active_session_id text,
  add column if not exists active_session_at timestamptz;

-- (Opcional) índice para limpiezas por token
create index if not exists idx_profiles_active_session_id
  on public.profiles (active_session_id);
