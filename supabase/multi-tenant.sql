-- ─────────────────────────────────────────────────────────────────────────────
-- MULTI-TENANCY — aislamiento de datos por CENTRO.
--  • Cada centro demo = un tenant (uuid). El admin del centro lleva su tenant_id.
--  • Lo que ese centro crea hereda su tenant_id (vía triggers, automático).
--  • tenant_id NULL = datos legacy / programador (no se filtran).
-- Correr en el SQL Editor del proyecto demo (idempotente, se puede re-correr).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Columna tenant_id en las tablas de nivel superior ────────────────────
alter table public.profiles        add column if not exists tenant_id uuid;
-- children ya tiene tenant_id en el esquema; el resto se agregan:
alter table public.appointments    add column if not exists tenant_id uuid;
alter table public.agenda_sesiones add column if not exists tenant_id uuid;
alter table public.payments        add column if not exists tenant_id uuid;
alter table public.facturas        add column if not exists tenant_id uuid;
alter table public.evaluaciones_iniciales add column if not exists tenant_id uuid;

create index if not exists idx_profiles_tenant     on public.profiles (tenant_id);
create index if not exists idx_children_tenant     on public.children (tenant_id);
create index if not exists idx_appointments_tenant on public.appointments (tenant_id);
create index if not exists idx_agenda_tenant       on public.agenda_sesiones (tenant_id);
create index if not exists idx_payments_tenant     on public.payments (tenant_id);
create index if not exists idx_facturas_tenant     on public.facturas (tenant_id);
create index if not exists idx_evalini_tenant      on public.evaluaciones_iniciales (tenant_id);

-- ── 2) Trigger: al insertar, hereda el tenant del usuario que lo crea ────────
create or replace function public.set_tenant_from_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    select tenant_id into new.tenant_id from public.profiles where id = auth.uid();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['children','appointments','agenda_sesiones','payments','facturas','evaluaciones_iniciales']
  loop
    execute format('drop trigger if exists trg_set_tenant on public.%I', t);
    execute format('create trigger trg_set_tenant before insert on public.%I
                    for each row execute function public.set_tenant_from_user()', t);
  end loop;
end $$;

-- ── 3) Backfill ─────────────────────────────────────────────────────────────
-- Cada centro demo existente recibe su propio tenant.
update public.profiles set tenant_id = gen_random_uuid()
where is_demo = true and tenant_id is null;

-- Pacientes heredan el tenant de su padre (si lo tiene).
update public.children c set tenant_id = p.tenant_id
from public.profiles p
where c.parent_id = p.id and c.tenant_id is null and p.tenant_id is not null;

-- Citas / agenda / pagos / facturas / evaluaciones heredan el del paciente.
update public.appointments a set tenant_id = c.tenant_id
from public.children c where a.child_id = c.id and a.tenant_id is null and c.tenant_id is not null;
update public.agenda_sesiones a set tenant_id = c.tenant_id
from public.children c where a.child_id = c.id and a.tenant_id is null and c.tenant_id is not null;
update public.payments a set tenant_id = c.tenant_id
from public.children c where a.child_id = c.id and a.tenant_id is null and c.tenant_id is not null;
update public.facturas a set tenant_id = c.tenant_id
from public.children c where a.child_id = c.id and a.tenant_id is null and c.tenant_id is not null;
update public.evaluaciones_iniciales a set tenant_id = c.tenant_id
from public.children c where a.child_id = c.id and a.tenant_id is null and c.tenant_id is not null;

-- ── 4) RLS: aislamiento de LECTURAS por centro (cubre el cliente anon) ───────
-- Política RESTRICTIVE = se suma (AND) a las políticas existentes sin tocarlas.
-- Fail-open: si el usuario no tiene tenant (programador/legacy) o la fila no
-- tiene tenant, no se filtra. Solo oculta filas de OTROS centros.

create or replace function public.current_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- A) Tablas con tenant_id propio y SIN child_id (children, profiles, etc.):
--    se aíslan por su propio tenant_id.
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and not exists (
        select 1 from pg_attribute a2
        where a2.attrelid = c.oid and a2.attname = 'child_id' and not a2.attisdropped)
  loop
    execute format('drop policy if exists tenant_isolation_self on public.%I', t.relname);
    execute format('drop policy if exists tenant_isolation_child on public.%I', t.relname);
    execute format($f$create policy tenant_isolation_self on public.%I
      as restrictive for select to authenticated
      using ( current_tenant() is null or tenant_id is null or tenant_id = current_tenant() )$f$,
      t.relname);
  end loop;
end $$;

-- B) Tablas que cuelgan de un paciente (tienen child_id): se aíslan a través
--    del centro del PACIENTE — robusto sin importar cómo se insertó la fila.
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'child_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists tenant_isolation_self on public.%I', t.relname);
    execute format('drop policy if exists tenant_isolation_child on public.%I', t.relname);
    execute format($f$create policy tenant_isolation_child on public.%I
      as restrictive for select to authenticated
      using ( current_tenant() is null or exists (
        select 1 from public.children ch where ch.id = %I.child_id
        and (ch.tenant_id is null or ch.tenant_id = current_tenant()) ) )$f$,
      t.relname, t.relname);
  end loop;
end $$;
