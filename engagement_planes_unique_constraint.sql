-- ─────────────────────────────────────────────────────────────────────────────
-- Agrega el unique constraint que faltaba en engagement_planes
-- para que el upsert con onConflict funcione correctamente.
--
-- Ya NO es necesario para el código (el endpoint hace upsert manual),
-- pero es recomendable correrlo para:
--  1. Prevenir duplicados a nivel base de datos (race conditions)
--  2. Mejorar performance del lookup por (child_id, semana, anio)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Limpiar duplicados existentes (si los hay) ANTES de agregar el constraint.
--    Conserva el plan más reciente (mayor created_at) para cada combinación.
delete from engagement_planes a
using engagement_planes b
where a.child_id = b.child_id
  and a.semana   = b.semana
  and a.anio     = b.anio
  and a.id      <> b.id
  and a.created_at < b.created_at;

-- 2. Agregar el unique constraint
alter table engagement_planes
  add constraint engagement_planes_child_semana_anio_unique
  unique (child_id, semana, anio);
