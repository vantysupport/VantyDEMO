-- ─────────────────────────────────────────────────────────────────────────────
-- Plantilla clínica: "Acta de Sesión" (Registro breve)
--
-- Diseñada para que la especialista deje constancia rápida después de cada sesión.
-- Automatiza fecha, alumno, especialista y rol — solo pide la descripción.
--
-- Campos automáticos (NO se piden, los pone el sistema):
--   - created_at        → timestamp del momento del registro
--   - child_id          → paciente activo en la ficha
--   - filled_by         → user_id del especialista autenticado
--   - filler_name       → nombre completo del especialista (del perfil)
--   - filler_role       → rol del especialista (del perfil)
--
-- Campos manuales:
--   - descripcion_sesion → qué se trabajó con el niño (texto largo, requerido)
-- ─────────────────────────────────────────────────────────────────────────────

insert into clinical_templates (
  name,
  description,
  category,
  fields,
  sections,
  is_active,
  is_default,
  created_at
) values (
  'Acta de Sesión',
  'Registro breve de presencia: qué se trabajó con el niño en la sesión. Pensado como acto de constancia rápida, no como informe extenso.',
  'seguimiento',
  '[
    {
      "id": "descripcion_sesion",
      "label": "¿Qué se trabajó con el niño?",
      "type": "textarea",
      "required": true,
      "placeholder": "Ej: Trabajamos imitación motora con bloques. Lucía respondió bien al modelado verbal + físico. Reforzadores efectivos: stickers y elogios verbales. Próxima sesión: continuar con set 2.",
      "section": "registro"
    }
  ]'::jsonb,
  '[
    {
      "id": "registro",
      "title": "Resumen de la sesión",
      "description": "Anotá brevemente lo trabajado, cómo respondió el niño y cualquier observación relevante."
    }
  ]'::jsonb,
  true,
  false,
  now()
);
