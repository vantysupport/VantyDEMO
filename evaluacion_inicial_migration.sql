-- ═══════════════════════════════════════════════════════════════════════════
-- FLUJO DE EVALUACIÓN INICIAL
-- Ficha intake (padres) → IA recomienda (psicológica / neuropsicológica)
-- → Admin configura servicios → Padre selecciona → Notifica especialista
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Tabla principal: una evaluación inicial por paciente.
create table if not exists evaluaciones_iniciales (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children(id) on delete cascade,
  parent_id uuid references profiles(id) on delete set null,

  -- Estado del flujo:
  -- 'pendiente_intake' | 'analizando' | 'recomendado'
  -- | 'servicios_listos' | 'seleccionado' | 'completado'
  estado text not null default 'pendiente_intake',

  -- Respuestas del intake (JSON con todos los campos de la ficha)
  respuestas_intake jsonb,
  intake_completado_en timestamptz,

  -- Recomendación de la IA
  recomendacion text,                 -- 'psicologica' | 'neuropsicologica' | 'ambas'
  recomendacion_razon text,           -- Explicación detallada (markdown)
  recomendacion_resumen text,         -- Resumen ejecutivo corto
  recomendacion_areas jsonb,          -- Áreas de interés detectadas
  recomendacion_generada_en timestamptz,
  recomendacion_modelo text,          -- Modelo IA usado

  -- Selección del padre
  servicio_seleccionado_id uuid,
  seleccionado_en timestamptz,
  mensaje_al_especialista text,       -- Nota opcional del padre

  -- Especialista asignado por el admin
  especialista_asignado_id uuid references profiles(id) on delete set null,
  asignado_en timestamptz,

  -- Documento generado (almacenado como texto/markdown; URL opcional si se sube a storage)
  documento_url text,
  documento_md text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_eval_inicial_child on evaluaciones_iniciales(child_id);
create index if not exists idx_eval_inicial_parent on evaluaciones_iniciales(parent_id);
create index if not exists idx_eval_inicial_estado on evaluaciones_iniciales(estado);

-- 2) Servicios configurables por el admin para CADA evaluación.
--    Permite ajustar el precio / descripción según el caso.
create table if not exists evaluacion_servicios (
  id uuid primary key default gen_random_uuid(),
  evaluacion_id uuid not null references evaluaciones_iniciales(id) on delete cascade,

  tipo text not null,                 -- 'psicologica' | 'neuropsicologica' | 'otro'
  nombre text not null,               -- "Evaluación Neuropsicológica"
  descripcion text,                   -- Qué incluye
  por_que text,                       -- Por qué se recomienda en este caso
  precio numeric(10,2),               -- En soles peruanos
  moneda text default 'PEN',
  duracion text,                      -- "3 sesiones de 60 min"
  incluye jsonb,                      -- ["Anamnesis","Pruebas estandarizadas","Informe escrito"]

  orden integer default 0,
  activo boolean default true,

  created_at timestamptz default now()
);

create index if not exists idx_eval_serv_evaluacion on evaluacion_servicios(evaluacion_id);

-- FK del servicio seleccionado (después de crear la tabla servicios)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'fk_eval_inicial_servicio'
  ) then
    alter table evaluaciones_iniciales
      add constraint fk_eval_inicial_servicio
      foreign key (servicio_seleccionado_id)
      references evaluacion_servicios(id)
      on delete set null;
  end if;
end $$;

-- 3) Catálogo global de servicios sugeridos (templates que el admin puede reutilizar)
create table if not exists evaluacion_servicios_catalogo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  nombre text not null,
  descripcion text,
  precio_default numeric(10,2),
  duracion text,
  incluye jsonb,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Semilla con los dos servicios base (idempotente)
insert into evaluacion_servicios_catalogo (tipo, nombre, descripcion, precio_default, duracion, incluye)
select 'psicologica',
       'Evaluación Psicológica Emocional',
       'Evaluación para identificar dificultades emocionales, conductuales o sociales. Permite diseñar estrategias de acompañamiento y bienestar emocional para el niño/adolescente y su familia.',
       null,
       '2 a 3 sesiones de 60 min',
       '["Anamnesis emocional con padres","Entrevista al niño/adolescente","Pruebas proyectivas y de personalidad","Informe escrito con recomendaciones","Devolución de resultados"]'::jsonb
where not exists (
  select 1 from evaluacion_servicios_catalogo where tipo = 'psicologica'
);

insert into evaluacion_servicios_catalogo (tipo, nombre, descripcion, precio_default, duracion, incluye)
select 'neuropsicologica',
       'Evaluación Neuropsicológica',
       'Evaluación de indicadores de neurodiversidad, dificultades cognitivas o de aprendizaje: atención, memoria, lenguaje, funciones ejecutivas y rendimiento escolar.',
       null,
       '3 a 4 sesiones de 60 min',
       '["Anamnesis neuropsicológica completa","Pruebas estandarizadas (WISC-V / BASC / BRIEF-2 / Vineland-3 según corresponda)","Análisis de funciones cognitivas","Informe neuropsicológico detallado","Recomendaciones para colegio y hogar"]'::jsonb
where not exists (
  select 1 from evaluacion_servicios_catalogo where tipo = 'neuropsicologica'
);

-- 4) RLS abierto via supabaseAdmin (el cliente usa endpoints)
alter table evaluaciones_iniciales enable row level security;
alter table evaluacion_servicios enable row level security;
alter table evaluacion_servicios_catalogo enable row level security;

-- Policies: lectura/escritura solo por endpoints (service_role salta RLS).
-- Para que el padre pueda leer su propia evaluación desde el cliente:
drop policy if exists "padre lee su evaluacion" on evaluaciones_iniciales;
create policy "padre lee su evaluacion"
  on evaluaciones_iniciales for select
  using (
    parent_id = auth.uid()
    or exists (
      select 1 from children c
      where c.id = evaluaciones_iniciales.child_id
        and c.parent_id = auth.uid()
    )
  );

drop policy if exists "padre lee servicios de su evaluacion" on evaluacion_servicios;
create policy "padre lee servicios de su evaluacion"
  on evaluacion_servicios for select
  using (
    exists (
      select 1 from evaluaciones_iniciales ei
      where ei.id = evaluacion_servicios.evaluacion_id
        and (
          ei.parent_id = auth.uid()
          or exists (
            select 1 from children c
            where c.id = ei.child_id and c.parent_id = auth.uid()
          )
        )
    )
  );

-- Catálogo: lectura para cualquier autenticado
drop policy if exists "lectura catalogo autenticado" on evaluacion_servicios_catalogo;
create policy "lectura catalogo autenticado"
  on evaluacion_servicios_catalogo for select
  using (auth.role() = 'authenticated');
