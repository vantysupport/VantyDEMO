-- ─────────────────────────────────────────────────────────────────────────────
-- BLINDAJE DURO de límites a nivel de BASE DE DATOS (trigger en children).
--  • Tope TOTAL de pacientes (limits.paciente): aplica a TODOS (incluido el
--    personal). Nadie puede pasarse salvo que el programador lo amplíe.
--  • Tope de cuentas de PADRES (limits.padre): el padre que excede no puede
--    registrar a su hijo (el personal sí puede crear/asignar).
-- Ejecutar UNA VEZ en Supabase → SQL Editor (idempotente, se puede re-correr).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.enforce_padre_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role      text;
  v_created   timestamptz;
  v_limit     int;
  v_before    int;
  v_pac_limit int;
  v_pac_count int;
  v_is_staff  boolean;
begin
  -- 0) Tope TOTAL de pacientes — aplica a TODOS (incluido el personal).
  select coalesce(nullif(limits->>'paciente','')::int, 0) into v_pac_limit
  from public.app_settings where id = 1;
  if v_pac_limit is not null and v_pac_limit > 0 then
    select count(*) into v_pac_count from public.children;
    if v_pac_count >= v_pac_limit then
      raise exception 'El centro alcanzó el número máximo de pacientes.'
        using errcode = 'P0001';
    end if;
  end if;

  -- ¿Quien inserta es personal del centro? (para el límite de PADRES)
  v_is_staff := exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('jefe','admin','especialista','terapeuta','secretaria','programador')
  );
  if v_is_staff then
    return new;
  end if;

  -- 1) Límite de cuentas de PADRES (solo cuando el dueño es un padre).
  select role, created_at into v_role, v_created
  from public.profiles where id = new.parent_id;
  if v_role is distinct from 'padre' then
    return new;
  end if;

  select coalesce(nullif(limits->>'padre','')::int, 0) into v_limit
  from public.app_settings where id = 1;
  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  -- Padres que YA tienen hijos pueden agregar (hermanos).
  if exists (select 1 from public.children where parent_id = new.parent_id) then
    return new;
  end if;

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
