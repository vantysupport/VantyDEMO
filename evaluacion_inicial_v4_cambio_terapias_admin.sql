-- ════════════════════════════════════════════════════════════════════════════
-- Migración v4: Permitir que el especialista cambie la selección de terapias
-- ════════════════════════════════════════════════════════════════════════════
-- El admin/especialista, tras realizar su propia evaluación clínica del menor,
-- puede ajustar las terapias que el padre eligió originalmente. Estos campos
-- registran la decisión clínica para auditoría.

ALTER TABLE evaluaciones_iniciales
  ADD COLUMN IF NOT EXISTS terapias_cambiadas_por_admin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nota_cambio_terapias text;

COMMENT ON COLUMN evaluaciones_iniciales.terapias_cambiadas_por_admin IS
  'TRUE si el especialista modificó terapias_seleccionadas después de la elección inicial del padre.';

COMMENT ON COLUMN evaluaciones_iniciales.nota_cambio_terapias IS
  'Nota clínica que justifica por qué el especialista cambió la selección de terapias del padre.';

-- Listo. No requiere índices nuevos — son campos de visualización/auditoría.
