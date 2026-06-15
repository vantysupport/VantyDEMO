-- ─────────────────────────────────────────────────────────────────────────────
-- PANEL DE CONTROL DEL PROGRAMADOR
--  • app_settings: modo mantenimiento + límites de perfiles (singleton, id=1).
--  • error_logs: errores reales de la app (DB, APIs, etc.) — SOLO los ve el
--    programador. A los usuarios nunca se les muestra el detalle técnico.
--  • El acceso va por /api/control con service_role (bypassa RLS).
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.app_settings (
  id              int primary key default 1,
  maintenance     boolean not null default false,
  maintenance_msg text,
  limits          jsonb not null default '{}'::jsonb,
  updated_at      timestamptz default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
alter table public.app_settings enable row level security;

create table if not exists public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  message     text,
  detail      text,
  source      text,
  url         text,
  user_email  text,
  created_at  timestamptz default now()
);
create index if not exists idx_error_logs_created on public.error_logs (created_at desc);
alter table public.error_logs enable row level security;

-- ── Rate limiting de ARIA (IA de padres) — configurable desde /control ──────────
-- aria_limits = { enabled, maxMessages, windowHours }
alter table public.app_settings add column if not exists aria_limits jsonb not null default '{}'::jsonb;

-- Contador de uso por familia/padre (clave = parentUserId o childId)
create table if not exists public.aria_usage (
  rl_key       text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now(),
  updated_at   timestamptz default now()
);
alter table public.aria_usage enable row level security;

-- El rol 'programador' se asigna manualmente desde aquí:
--   update public.profiles set role = 'programador' where email = 'TU_CORREO';
