-- ═══════════════════════════════════════════════════════════════════════════
-- EVALUACIÓN INICIAL — Migración v4
-- Permite que cada terapia tenga su propio color/tema visual.
-- ═══════════════════════════════════════════════════════════════════════════

alter table terapias_catalogo
  add column if not exists color_tema text default 'indigo';

-- Valores válidos: 'indigo' | 'purple' | 'pink' | 'rose' | 'amber' |
--                  'emerald' | 'cyan' | 'blue' | 'orange' | 'slate'
