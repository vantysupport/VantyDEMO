-- ═══════════════════════════════════════════════════════════════════════════
-- EVALUACIÓN INICIAL — Migración v3
-- La IA ahora también recomienda terapias específicas del catálogo.
-- ═══════════════════════════════════════════════════════════════════════════

alter table evaluaciones_iniciales
  add column if not exists terapias_recomendadas      uuid[],
  add column if not exists terapias_recomendadas_razon text,
  add column if not exists terapias_recomendadas_en   timestamptz;

-- Comentario:
-- terapias_recomendadas        → array de IDs del catálogo (orden de prioridad)
-- terapias_recomendadas_razon  → texto del modelo explicando por qué cada una
-- terapias_recomendadas_en     → timestamp de generación
