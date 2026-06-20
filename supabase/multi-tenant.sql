-- ─────────────────────────────────────────────────────────────────────────────
-- MULTI-TENANCY — aislamiento de datos por CENTRO.
--  • Cada centro demo = un tenant (uuid). El admin del centro lleva su tenant_id.
--  • Los usuarios/datos que ese centro crea heredan su tenant_id.
--  • tenant_id NULL = datos legacy / programador (ven todo, no se filtran).
-- Etapa 1: profiles. (Etapas siguientes: children, appointments, etc.)
-- Correr en el SQL Editor del proyecto demo (idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists tenant_id uuid;

create index if not exists idx_profiles_tenant on public.profiles (tenant_id);

-- Backfill: cada centro demo YA existente recibe su propio tenant (queda aislado).
update public.profiles
set tenant_id = gen_random_uuid()
where is_demo = true and tenant_id is null;
