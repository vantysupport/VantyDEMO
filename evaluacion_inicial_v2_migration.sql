-- ═══════════════════════════════════════════════════════════════════════════
-- EVALUACIÓN INICIAL — Migración v2
-- Cambios respecto a v1:
--   • Mensaje amigable al padre (separado del razonamiento clínico)
--   • Nuevos pasos: confirmar → 2ª anamnesis → seleccionar terapias → respuesta del especialista
--   • Tabla global de terapias del centro (admin la administra una sola vez)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) Campos nuevos en evaluaciones_iniciales ─────────────────────────────
alter table evaluaciones_iniciales
  add column if not exists mensaje_amigable_padre text,
  add column if not exists confirmado_en          timestamptz,
  add column if not exists rechazado_en           timestamptz,
  add column if not exists anamnesis_especifica   jsonb,
  add column if not exists anamnesis_completada_en timestamptz,
  add column if not exists terapias_seleccionadas uuid[],
  add column if not exists respuesta_especialista text,
  add column if not exists respondido_en          timestamptz,
  add column if not exists respondido_por         uuid references profiles(id) on delete set null;

-- ─── 2) Catálogo global de terapias que ofrece el centro ───────────────────
create table if not exists terapias_catalogo (
  id uuid primary key default gen_random_uuid(),

  nombre text not null,
  descripcion text,
  por_que text,                    -- "¿Por qué llevarla?" — beneficios
  imagen_url text,                 -- URL pública de imagen
  precio numeric(10,2),            -- precio referencial
  moneda text default 'PEN',
  duracion text,                   -- "1 sesión semanal de 50 min"
  modalidad text default 'presencial',  -- presencial | online | mixta
  categoria text,                  -- 'ABA' | 'Lenguaje' | 'Ocupacional' | 'Psicología' | etc.

  activo boolean default true,
  orden integer default 0,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_terapias_activo on terapias_catalogo(activo);
create index if not exists idx_terapias_categoria on terapias_catalogo(categoria);

-- ─── 3) Semilla de terapias base (idempotente) ─────────────────────────────
insert into terapias_catalogo (nombre, descripcion, por_que, categoria, duracion, modalidad)
select 'Terapia ABA (Análisis Conductual Aplicado)',
       'Intervención basada en evidencia para desarrollar habilidades conductuales, comunicativas, sociales y académicas. Personalizada por objetivos medibles.',
       'Ideal para niños con TEA o dificultades conductuales. Aumenta habilidades funcionales y reduce conductas que interfieren con el aprendizaje.',
       'ABA',
       '2-3 sesiones semanales de 60 min',
       'presencial'
where not exists (select 1 from terapias_catalogo where nombre = 'Terapia ABA (Análisis Conductual Aplicado)');

insert into terapias_catalogo (nombre, descripcion, por_que, categoria, duracion, modalidad)
select 'Terapia Psicológica Infantil',
       'Acompañamiento emocional al niño/adolescente para trabajar ansiedad, tristeza, miedos, autoestima y regulación emocional. Incluye orientación a padres.',
       'Recomendada cuando hay dificultades emocionales, eventos estresantes o cambios conductuales recientes.',
       'Psicología',
       '1 sesión semanal de 50 min',
       'presencial'
where not exists (select 1 from terapias_catalogo where nombre = 'Terapia Psicológica Infantil');

insert into terapias_catalogo (nombre, descripcion, por_que, categoria, duracion, modalidad)
select 'Terapia de Lenguaje',
       'Intervención para estimular y desarrollar habilidades de comunicación verbal y no verbal, comprensión, vocabulario, articulación y lectoescritura.',
       'Recomendada cuando hay retraso del habla, dificultades de comprensión o problemas de pronunciación.',
       'Lenguaje',
       '2 sesiones semanales de 45 min',
       'presencial'
where not exists (select 1 from terapias_catalogo where nombre = 'Terapia de Lenguaje');

insert into terapias_catalogo (nombre, descripcion, por_que, categoria, duracion, modalidad)
select 'Terapia Ocupacional',
       'Trabaja integración sensorial, motricidad fina/gruesa, autonomía y habilidades de la vida diaria a través del juego y actividades dirigidas.',
       'Útil cuando hay dificultades motoras, sensoriales o de coordinación que afectan la vida cotidiana.',
       'Ocupacional',
       '1-2 sesiones semanales de 45 min',
       'presencial'
where not exists (select 1 from terapias_catalogo where nombre = 'Terapia Ocupacional');

insert into terapias_catalogo (nombre, descripcion, por_que, categoria, duracion, modalidad)
select 'Terapia de Aprendizaje',
       'Refuerzo de habilidades académicas (lectoescritura, matemáticas, comprensión) y estrategias de estudio adaptadas al perfil cognitivo del niño.',
       'Para niños con dificultades específicas de aprendizaje, bajo rendimiento o necesidades educativas especiales.',
       'Aprendizaje',
       '2 sesiones semanales de 50 min',
       'presencial'
where not exists (select 1 from terapias_catalogo where nombre = 'Terapia de Aprendizaje');

-- ─── 4) RLS ────────────────────────────────────────────────────────────────
alter table terapias_catalogo enable row level security;

drop policy if exists "lectura terapias autenticado" on terapias_catalogo;
create policy "lectura terapias autenticado"
  on terapias_catalogo for select
  using (auth.role() = 'authenticated' and activo = true);

-- ─── 5) Comentario sobre los nuevos estados ────────────────────────────────
-- Estados actualizados en evaluaciones_iniciales.estado:
--   pendiente_intake → analizando → recomendado
--     → confirmado (padre aceptó la recomendación)
--       → anamnesis_completa (terminó la 2ª anamnesis)
--         → terapia_seleccionada (eligió terapias del catálogo)
--           → revisado (especialista respondió)
--             → completado
--   rechazado (padre no estuvo de acuerdo con recomendación)
