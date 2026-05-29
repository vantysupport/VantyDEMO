-- ════════════════════════════════════════════════════════════════════════════
-- 👥 CLASIFICACIÓN DE EQUIPO — especialidad por miembro del staff
-- ════════════════════════════════════════════════════════════════════════════
-- Agrega el campo `specialty` a profiles para clasificar al equipo interno
-- (especialistas, directores, secretarias) según su especialidad/área.
--
-- USO INTERNO: este dato solo se muestra en los paneles de admin/especialista.
-- Los padres NUNCA lo ven (la app no lo expone en el portal de familias).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS specialty text;

COMMENT ON COLUMN public.profiles.specialty IS
  'Especialidad / área del miembro del equipo (ej: Neuropsicóloga, Terapeuta ABA, Secretaria de admisión). Uso interno — no visible para padres.';

-- Listo. No requiere índices: es un campo descriptivo de visualización.
