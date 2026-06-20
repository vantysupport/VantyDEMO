-- ════════════════════════════════════════════════════════════════════════════
--  EXPORTAR ESQUEMA — corré cada consulta en Supabase → SQL Editor y pasá el
--  resultado (Download CSV o copiar). Con esto se reconstruye la base completa.
--  Corré las 7 por separado (no todas juntas) para ver cada resultado limpio.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) TABLAS + COLUMNAS (lo más importante) ────────────────────────────────
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,                 -- tipo real (sirve para enums, vector, jsonb, etc.)
  character_maximum_length,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;


-- ── 2) CLAVES PRIMARIAS Y FORÁNEAS (relaciones entre tablas) ────────────────
select
  tc.table_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name  as tabla_referenciada,
  ccu.column_name as columna_referenciada
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type;


-- ── 3) POLÍTICAS RLS (quién puede leer/escribir cada tabla) ─────────────────
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ── 4) ENUMS (tipos personalizados) ─────────────────────────────────────────
select t.typname as enum_name, e.enumlabel as valor
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;


-- ── 5) FUNCIONES (incluye triggers como handle_new_user) ────────────────────
select routine_name, data_type as retorna
from information_schema.routines
where routine_schema = 'public'
order by routine_name;


-- ── 6) TRIGGERS (qué se dispara y cuándo) ───────────────────────────────────
select event_object_table as tabla, trigger_name,
       action_timing, event_manipulation as evento
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table;


-- ── 7) STORAGE BUCKETS (archivos: documentos, imágenes, etc.) ───────────────
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets;


-- ── BONUS) DDL completo de funciones (pegá esto para el código exacto) ──────
-- Devuelve el CREATE FUNCTION tal cual de cada función tuya (no las del sistema).
select pg_get_functiondef(p.oid) as definicion
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
