-- ════════════════════════════════════════════════════════════════════════════
-- 💰 PAGOS — permitir registrar pagos de pacientes NO inscritos (nombre libre)
-- ════════════════════════════════════════════════════════════════════════════
-- Casos: niños que van por evaluación inicial y todavía no se inscriben.
-- Se guarda el nombre en `paciente_externo` y child_id queda NULL.

-- 1. Columna para el nombre libre
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paciente_externo text;

-- 2. Permitir child_id nulo (para pagos de pacientes aún no registrados)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments'
      AND column_name = 'child_id' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.payments ALTER COLUMN child_id DROP NOT NULL';
  END IF;
END $$;

COMMENT ON COLUMN public.payments.paciente_externo IS
  'Nombre libre del niño/a cuando aún no está inscrito (ej. evaluación inicial). Se usa cuando child_id es NULL.';
