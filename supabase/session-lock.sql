-- ─────────────────────────────────────────────────────────────────────────────
-- SESIÓN ÚNICA POR CUENTA
-- Solo un dispositivo/persona puede estar dentro de una cuenta a la vez.
-- Si alguien intenta entrar mientras hay una sesión viva, se bloquea.
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Columnas de control en profiles
alter table public.profiles
  add column if not exists active_session_id text,
  add column if not exists active_session_at timestamptz;

-- 2) Reclamar la sesión para el usuario autenticado.
--    Devuelve 'claimed' si la tomó, 'in_use' si ya hay otra sesión VIVA.
--    Una sesión se considera muerta si su último heartbeat es más viejo
--    que p_stale_seconds (evita bloqueos permanentes si cierran el navegador).
create or replace function public.claim_session(p_session_id text, p_stale_seconds int default 90)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_at timestamptz;
begin
  if v_uid is null then
    return 'no_auth';
  end if;

  -- Bloqueo de fila para que dos logins simultáneos no se pisen
  select active_session_id, active_session_at
    into v_current, v_at
    from public.profiles
    where id = v_uid
    for update;

  if v_current is null
     or v_current = p_session_id
     or v_at is null
     or v_at < now() - make_interval(secs => p_stale_seconds) then
    update public.profiles
      set active_session_id = p_session_id,
          active_session_at = now()
      where id = v_uid;
    return 'claimed';
  else
    return 'in_use';
  end if;
end;
$$;

-- 3) Heartbeat: mantiene viva la sesión. true si sigo siendo el dueño.
create or replace function public.heartbeat_session(p_session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;
  update public.profiles
    set active_session_at = now()
    where id = v_uid and active_session_id = p_session_id;
  return found;
end;
$$;

-- 4) Liberar la sesión (logout / cierre de pestaña).
--    Funciona por token (p_session_id), así puede ejecutarse incluso justo
--    después de cerrar sesión (cuando ya no hay auth.uid()).
create or replace function public.release_session(p_session_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
    set active_session_id = null,
        active_session_at = null
    where active_session_id = p_session_id;
end;
$$;

-- 5) Permisos
grant execute on function public.claim_session(text, int) to authenticated;
grant execute on function public.heartbeat_session(text)    to authenticated;
grant execute on function public.release_session(text)      to authenticated, anon;
