-- ════════════════════════════════════════════════════════════════════════════
-- 🔒 SEGURIDAD COMPLETA — Row Level Security (RLS) para SANTI
-- ════════════════════════════════════════════════════════════════════════════
-- VERSIÓN RESILIENTE: cada bloque verifica si la tabla existe antes de aplicar
-- políticas. No falla si una tabla no existe en tu DB.
--
-- Modelo de permisos:
--   • PADRE          → solo sus hijos (children.parent_id = auth.uid())
--   • ESPECIALISTA   → ve todos los pacientes (acceso clínico)
--   • TERAPEUTA      → ve todos los pacientes (acceso clínico)
--   • SECRETARIA     → ve todos los pacientes (administrativo)
--   • ADMIN / JEFE   → acceso total
--   • SERVICE_ROLE   → bypass total (endpoints server-side)
--
-- Ejecutá completo en Supabase SQL Editor. Idempotente.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Helper functions ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('jefe','admin','especialista','terapeuta','secretaria')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('jefe','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of(p_child_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id AND parent_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.auth_role()        TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_staff()         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()         TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid) TO authenticated, anon;


-- ─── 2. Helper procedural: aplica RLS + política a una tabla si existe ─────
-- Ejecuta los EXECUTE sólo cuando la tabla está presente. No falla si falta.

CREATE OR REPLACE FUNCTION public._apply_rls(
  p_table   text,
  p_policy  text,
  p_using   text,
  p_check   text DEFAULT NULL,
  p_for     text DEFAULT 'ALL'           -- ALL | SELECT | INSERT | UPDATE | DELETE
) RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_full text := format('public.%I', p_table);
  v_check_clause text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RAISE NOTICE '[RLS] tabla % no existe — se omite', p_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_full);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_policy, v_full);

  IF p_for = 'SELECT' OR p_for = 'DELETE' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s)',
      p_policy, v_full, p_for, p_using
    );
  ELSE
    v_check_clause := COALESCE(p_check, p_using);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
      p_policy, v_full, p_for, p_using, v_check_clause
    );
  END IF;
END;
$fn$;


-- ════════════════════════════════════════════════════════════════════════════
-- 👤 PROFILES
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('profiles', 'profiles_select_own_or_staff',
  'id = auth.uid() OR public.is_staff()', NULL, 'SELECT');
SELECT public._apply_rls('profiles', 'profiles_update_own_or_admin',
  'id = auth.uid() OR public.is_admin()', 'id = auth.uid() OR public.is_admin()', 'UPDATE');
SELECT public._apply_rls('profiles', 'profiles_insert_self',
  'id = auth.uid() OR public.is_admin()', 'id = auth.uid() OR public.is_admin()', 'INSERT');
SELECT public._apply_rls('profiles', 'profiles_delete_admin',
  'public.is_admin()', NULL, 'DELETE');


-- ════════════════════════════════════════════════════════════════════════════
-- 🧒 CHILDREN
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('children', 'children_select',
  'parent_id = auth.uid() OR public.is_staff()', NULL, 'SELECT');
SELECT public._apply_rls('children', 'children_insert',
  'parent_id = auth.uid() OR public.is_staff()', 'parent_id = auth.uid() OR public.is_staff()', 'INSERT');
SELECT public._apply_rls('children', 'children_update',
  'parent_id = auth.uid() OR public.is_staff()', 'parent_id = auth.uid() OR public.is_staff()', 'UPDATE');
SELECT public._apply_rls('children', 'children_delete',
  'public.is_admin()', NULL, 'DELETE');


-- ════════════════════════════════════════════════════════════════════════════
-- 🧠 PROGRAMAS ABA + SESIONES + OBJETIVOS
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('programas_aba', 'programas_aba_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('sesiones_datos_aba', 'sesiones_datos_aba_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('objetivos_cp', 'objetivos_cp_rw',
  'public.is_staff() OR EXISTS (SELECT 1 FROM public.programas_aba p WHERE p.id = programa_id AND public.is_parent_of(p.child_id))');

SELECT public._apply_rls('cambios_fase_aba', 'cambios_fase_aba_rw',
  'public.is_staff() OR EXISTS (SELECT 1 FROM public.programas_aba p WHERE p.id = programa_id AND public.is_parent_of(p.child_id))');


-- ════════════════════════════════════════════════════════════════════════════
-- 📋 EVALUACIONES INICIALES
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('evaluaciones_iniciales', 'evaluaciones_iniciales_rw',
  'public.is_staff() OR parent_id = auth.uid() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('evaluacion_servicios', 'evaluacion_servicios_rw',
  'public.is_staff() OR EXISTS (SELECT 1 FROM public.evaluaciones_iniciales e WHERE e.id = evaluacion_id AND (e.parent_id = auth.uid() OR public.is_parent_of(e.child_id)))');


-- ════════════════════════════════════════════════════════════════════════════
-- 📄 PATIENT DOCUMENTS
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('patient_documents', 'patient_documents_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');


-- ════════════════════════════════════════════════════════════════════════════
-- 📅 APPOINTMENTS + AGENDA
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('appointments', 'appointments_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('agenda_sesiones', 'agenda_sesiones_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');


-- ════════════════════════════════════════════════════════════════════════════
-- 📝 FORMULARIOS (registro_aba, anamnesis, entorno, form_responses)
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('form_responses', 'form_responses_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('anamnesis_completa', 'anamnesis_completa_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('registro_aba', 'registro_aba_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');

SELECT public._apply_rls('registro_entorno_hogar', 'registro_entorno_hogar_rw',
  'public.is_staff() OR public.is_parent_of(child_id)');


-- ════════════════════════════════════════════════════════════════════════════
-- 🧠 IA — solo staff
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('sugerencias_terapeutas', 'sugerencias_terapeutas_rw',
  'public.is_staff()');

SELECT public._apply_rls('patrones_detectados', 'patrones_detectados_rw',
  'public.is_staff()');

SELECT public._apply_rls('objetivos_adaptativos', 'objetivos_adaptativos_rw',
  'public.is_staff()');


-- ════════════════════════════════════════════════════════════════════════════
-- 💬 CHATS
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('parent_chat_messages', 'parent_chat_messages_rw',
  'public.is_staff() OR parent_user_id = auth.uid() OR (child_id IS NOT NULL AND public.is_parent_of(child_id))');


-- ════════════════════════════════════════════════════════════════════════════
-- 💰 PAGOS
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('pagos', 'pagos_rw',
  'public.is_staff() OR public.is_parent_of(child_id)',
  'public.is_staff()');


-- ════════════════════════════════════════════════════════════════════════════
-- 🛒 CATÁLOGO PÚBLICO (terapias_catalogo)
--    Lectura: cualquier autenticado puede ver activas; staff ve todas
--    Escritura: solo staff
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('terapias_catalogo', 'terapias_catalogo_select',
  'activo = true OR public.is_staff()', NULL, 'SELECT');
SELECT public._apply_rls('terapias_catalogo', 'terapias_catalogo_write_ins',
  'public.is_staff()', 'public.is_staff()', 'INSERT');
SELECT public._apply_rls('terapias_catalogo', 'terapias_catalogo_write_upd',
  'public.is_staff()', 'public.is_staff()', 'UPDATE');
SELECT public._apply_rls('terapias_catalogo', 'terapias_catalogo_write_del',
  'public.is_staff()', NULL, 'DELETE');


-- ════════════════════════════════════════════════════════════════════════════
-- 📑 DOCUMENTOS EMITIDOS — verificación pública por código (read-only para anon)
-- ════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='documentos_emitidos') THEN
    EXECUTE 'ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS documentos_emitidos_public_verify ON public.documentos_emitidos';
    EXECUTE 'CREATE POLICY documentos_emitidos_public_verify ON public.documentos_emitidos FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS documentos_emitidos_write_ins ON public.documentos_emitidos';
    EXECUTE 'CREATE POLICY documentos_emitidos_write_ins ON public.documentos_emitidos FOR INSERT TO authenticated WITH CHECK (public.is_staff())';
    EXECUTE 'DROP POLICY IF EXISTS documentos_emitidos_write_upd ON public.documentos_emitidos';
    EXECUTE 'CREATE POLICY documentos_emitidos_write_upd ON public.documentos_emitidos FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())';
    EXECUTE 'DROP POLICY IF EXISTS documentos_emitidos_write_del ON public.documentos_emitidos';
    EXECUTE 'CREATE POLICY documentos_emitidos_write_del ON public.documentos_emitidos FOR DELETE TO authenticated USING (public.is_staff())';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 🔔 NOTIFICACIONES
-- ════════════════════════════════════════════════════════════════════════════
SELECT public._apply_rls('notifications', 'notifications_rw',
  'user_id = auth.uid() OR public.is_staff()');


-- ════════════════════════════════════════════════════════════════════════════
-- ✅ Limpiar el helper temporal (opcional). Si querés conservarlo para futuras
--    migraciones, podés dejarlo. Lo dejamos para reutilizar.
-- ════════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.auth_role()         IS 'Devuelve el role del usuario autenticado actual.';
COMMENT ON FUNCTION public.is_staff()          IS 'TRUE si el usuario actual es jefe/admin/especialista/terapeuta/secretaria.';
COMMENT ON FUNCTION public.is_admin()          IS 'TRUE si el usuario actual es jefe o admin (acciones críticas).';
COMMENT ON FUNCTION public.is_parent_of(uuid)  IS 'TRUE si el usuario actual es el padre/madre del child_id pasado.';
COMMENT ON FUNCTION public._apply_rls(text,text,text,text,text) IS
  'Helper interno: aplica RLS y una política a una tabla si existe (no falla si la tabla no está).';


-- ════════════════════════════════════════════════════════════════════════════
-- 📊 VERIFICACIÓN FINAL — listar todas las tablas con RLS activo:
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables
-- WHERE schemaname='public' AND rowsecurity = true
-- ORDER BY tablename;

-- Y políticas activas por tabla:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;

-- ════════════════════════════════════════════════════════════════════════════
-- NOTAS:
-- 1. Si una tabla NO existe, verás un NOTICE pero NO error. La migración sigue.
-- 2. Los endpoints server-side con SERVICE_ROLE_KEY bypasean estas políticas
--    automáticamente. No necesitás cambiar el backend.
-- 3. Para verificar que funciona, probá desde el cliente (con anon_key) acceder
--    a children sin login → debe devolver [].
-- ════════════════════════════════════════════════════════════════════════════
