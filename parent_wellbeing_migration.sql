-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla: parent_wellbeing_checkins
-- Propósito: registrar el "Chequeo de bienestar mensual" que el padre completa
-- desde la app del padre. Lo ve la terapeuta en la ficha del paciente.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists parent_wellbeing_checkins (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid not null references auth.users(id) on delete cascade,
  child_id     uuid not null references children(id)    on delete cascade,
  mood          text not null check (mood in ('bien','regular','dificil')),
  nota          text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_wellbeing_child       on parent_wellbeing_checkins(child_id, created_at desc);
create index if not exists idx_wellbeing_parent      on parent_wellbeing_checkins(parent_id, created_at desc);

-- RLS
alter table parent_wellbeing_checkins enable row level security;

-- Padre: puede insertar y leer SUS propios checkins
drop policy if exists "wellbeing_parent_insert" on parent_wellbeing_checkins;
create policy "wellbeing_parent_insert" on parent_wellbeing_checkins
  for insert with check (parent_id = auth.uid());

drop policy if exists "wellbeing_parent_select" on parent_wellbeing_checkins;
create policy "wellbeing_parent_select" on parent_wellbeing_checkins
  for select using (parent_id = auth.uid());

-- Staff (jefe/admin/especialista/terapeuta): puede leer todos los checkins
drop policy if exists "wellbeing_staff_select" on parent_wellbeing_checkins;
create policy "wellbeing_staff_select" on parent_wellbeing_checkins
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('jefe','admin','especialista','terapeuta')
    )
  );
