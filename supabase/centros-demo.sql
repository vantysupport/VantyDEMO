-- ─────────────────────────────────────────────────────────────────────────────
-- CENTROS DEMO — control de cuentas de prueba por el PROGRAMADOR
--  • Cada "centro" es una cuenta admin (role 'jefe') marcada is_demo = true.
--  • El programador crea cada cuenta desde /control con N días de demo.
--  • demo_active: interruptor manual (apaga/enciende UN centro sin tocar al resto).
--  • demo_expires_at: vence automáticamente a los N días (editable / extensible).
--  • El bloqueo se aplica en proxy.ts en CADA request → efecto inmediato.
-- Ejecutar UNA VEZ en Supabase → SQL Editor (idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists is_demo         boolean     not null default false,
  add column if not exists demo_active     boolean     not null default true,
  add column if not exists demo_expires_at timestamptz,
  add column if not exists center_name     text;

-- Índice para listar/filtrar centros demo rápido desde el panel.
create index if not exists idx_profiles_is_demo
  on public.profiles (is_demo) where is_demo = true;
