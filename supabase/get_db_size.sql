-- Función para exponer el tamaño total de la base de datos al panel de Mi Perfil.
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- Devuelve el tamaño en bytes; el endpoint /api/admin/storage-usage la consulta
-- con el service_role para pintar la barra de "Base de datos".

create or replace function public.get_db_size()
returns bigint
language sql
security definer
set search_path = public
as $$
  select pg_database_size(current_database());
$$;

-- Solo el service_role (backend) necesita ejecutarla.
revoke all on function public.get_db_size() from public, anon, authenticated;
grant execute on function public.get_db_size() to service_role;
