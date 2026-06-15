-- ─────────────────────────────────────────────────────────────────────────────
-- BLINDAJE DURO: límite de cuentas de padres a nivel de BASE DE DATOS.
-- Un trigger BEFORE INSERT en children rechaza el registro del hijo cuando el
-- padre dueño excede el límite (app_settings.limits.padre), por orden de
-- creación. Esto NO se puede saltar desde el cliente (a diferencia de la UI).
--  • El personal del centro (jefe/admin/especialista/terapeuta/secretaria/
--    programador) NUNCA es bloqueado (override).
--  • Los padres que YA tienen hijos pueden seguir agregando (hermanos).
--  • Límite 0 o ausente = sin límite.
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.enforce_padre_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role    text;
  v_created timestamptz;
  v_limit   int;
  v_before  int;
begin
  -- Override: si quien inserta es personal del centro, permitir siempre.
  if exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('jefe','admin','especialista','terapeuta','secretaria','programador')
  ) then
    return new;
  end if;

  -- Datos del padre dueño del hijo.
  select role, created_at into v_role, v_created
  from public.profiles where id = new.parent_id;

  -- Solo se limita a padres.
  if v_role is distinct from 'padre' then
    return new;
  end if;

  -- Límite configurado (0 o ausente = sin límite).
  select coalesce(nullif(limits->>'padre','')::int, 0) into v_limit
  from public.app_settings where id = 1;
  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  -- Si este padre YA tiene hijos, no es nuevo → permitir (hermanos).
  if exists (select 1 from public.children where parent_id = new.parent_id) then
    return new;
  end if;

  -- Padres creados ANTES que este (prioridad por orden de creación).
  select count(*) into v_before
  from public.profiles
  where role = 'padre' and created_at < v_created;

  if v_before >= v_limit then
    raise exception 'El centro alcanzó el número máximo de cuentas de familias.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_padre_limit on public.children;
create trigger trg_enforce_padre_limit
  before insert on public.children
  for each row execute function public.enforce_padre_limit();
