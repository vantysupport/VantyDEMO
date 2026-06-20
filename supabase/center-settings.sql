-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIG POR CENTRO — cada centro puede tener distintos módulos/roles/límites.
--  • app_settings (id=1) = config GLOBAL por defecto.
--  • center_settings (tenant_id) = overrides de ESE centro (se mezclan sobre el default).
-- Correr en el SQL Editor del proyecto demo (idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.center_settings (
  tenant_id    uuid primary key,
  features     jsonb,
  roles_config jsonb,
  limits       jsonb,
  aria_limits  jsonb,
  updated_at   timestamptz default now()
);
alter table public.center_settings enable row level security;
-- El acceso va por /api/control con service_role (bypassa RLS); sin políticas públicas.
