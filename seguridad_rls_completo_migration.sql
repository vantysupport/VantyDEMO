-- ════════════════════════════════════════════════════════════════════════════
-- 🔒 SEGURIDAD COMPLETA — Row Level Security (RLS) para SANTI
-- ════════════════════════════════════════════════════════════════════════════
-- Esta migración habilita RLS y crea políticas en TODAS las tablas con datos
-- sensibles. El objetivo: si alguien obtiene el `anon_key` (público por diseño),
-- NO puede leer ni un solo registro de pacientes / evaluaciones / clinical data.
--
-- Modelo de permisos:
--   • PADRE          → solo ve datos de SUS hijos (children.parent_id = auth.uid())
--   • ESPECIALISTA   → ve todos los pacientes (acceso clínico)
--   • TERAPEUTA      → ve todos los pacientes (acceso clínico)
--   • SECRETARIA     → ve todos los pacientes (administrativo)
--   • ADMIN / JEFE   → acceso total
--   • SERVICE_ROLE   → bypass total (lo usan los endpoints server-side)
--
-- Ejecutá en Supabase SQL Editor. Es idempotente (CREATE OR REPLACE, DROP IF EXISTS).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Helper functions ────────────────────────────────────────────────────

-- Devuelve el role del usuario autenticado (lee de la tabla profiles).
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- TRUE si el usuario actual es admin/jefe/especialista/terapeuta/secretaria
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('jefe','admin','especialista','terapeuta','secretaria')
  )
$$;

-- TRUE si el usuario actual es admin o jefe (decisiones más sensibles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('jefe','admin')
  )
$$;

-- TRUE si el usuario actual es padre/madre del child_id pasado como parámetro
CREATE OR REPLACE FUNCTION public.is_parent_of(p_child_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id AND parent_id = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.auth_role()      TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_staff()       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()       TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid) TO authenticated, anon;

-- ─── 2. Política base de bloqueo: enable RLS + force ─────────────────────────
-- Macro para aplicar el patrón estándar a todas las tablas
-- (no es macro real de SQL, lo replicamos manual abajo)

-- ════════════════════════════════════════════════════════════════════════════
-- 👤 PROFILES — cada usuario ve su propio perfil; staff ve todos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_staff ON public.profiles;
CREATE POLICY profiles_select_own_or_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
CREATE POLICY profiles_update_own_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS profiles_delete_admin ON public.profiles;
CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════════════════
-- 🧒 CHILDREN — padres ven a sus hijos; staff ve todos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS children_select ON public.children;
CREATE POLICY children_select ON public.children
  FOR SELECT TO authenticated
  USING (parent_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS children_insert ON public.children;
CREATE POLICY children_insert ON public.children
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS children_update ON public.children;
CREATE POLICY children_update ON public.children
  FOR UPDATE TO authenticated
  USING (parent_id = auth.uid() OR public.is_staff())
  WITH CHECK (parent_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS children_delete ON public.children;
CREATE POLICY children_delete ON public.children
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ════════════════════════════════════════════════════════════════════════════
-- 🧠 PROGRAMAS ABA + SESIONES + OBJETIVOS CP
-- ════════════════════════════════════════════════════════════════════════════

-- programas_aba
ALTER TABLE public.programas_aba ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS programas_aba_rw ON public.programas_aba;
CREATE POLICY programas_aba_rw ON public.programas_aba
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));

-- sesiones_datos_aba
ALTER TABLE public.sesiones_datos_aba ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sesiones_datos_aba_rw ON public.sesiones_datos_aba;
CREATE POLICY sesiones_datos_aba_rw ON public.sesiones_datos_aba
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));

-- objetivos_cp (sets de cada programa — heredan permisos del programa padre)
ALTER TABLE public.objetivos_cp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS objetivos_cp_rw ON public.objetivos_cp;
CREATE POLICY objetivos_cp_rw ON public.objetivos_cp
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.programas_aba p
      WHERE p.id = programa_id AND public.is_parent_of(p.child_id)
    )
  )
  WITH CHECK (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.programas_aba p
      WHERE p.id = programa_id AND public.is_parent_of(p.child_id)
    )
  );

-- cambios_fase_aba (auditoría de cambios de fase)
ALTER TABLE public.cambios_fase_aba ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cambios_fase_aba_rw ON public.cambios_fase_aba;
CREATE POLICY cambios_fase_aba_rw ON public.cambios_fase_aba
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.programas_aba p
      WHERE p.id = programa_id AND public.is_parent_of(p.child_id)
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 📋 EVALUACIONES INICIALES + servicios asociados
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.evaluaciones_iniciales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evaluaciones_iniciales_rw ON public.evaluaciones_iniciales;
CREATE POLICY evaluaciones_iniciales_rw ON public.evaluaciones_iniciales
  FOR ALL TO authenticated
  USING (public.is_staff() OR parent_id = auth.uid() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR parent_id = auth.uid() OR public.is_parent_of(child_id));

ALTER TABLE public.evaluacion_servicios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS evaluacion_servicios_rw ON public.evaluacion_servicios;
CREATE POLICY evaluacion_servicios_rw ON public.evaluacion_servicios
  FOR ALL TO authenticated
  USING (
    public.is_staff() OR EXISTS (
      SELECT 1 FROM public.evaluaciones_iniciales e
      WHERE e.id = evaluacion_id
        AND (e.parent_id = auth.uid() OR public.is_parent_of(e.child_id))
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 📄 PATIENT DOCUMENTS — informes / PDFs subidos
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patient_documents_rw ON public.patient_documents;
CREATE POLICY patient_documents_rw ON public.patient_documents
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));


-- ════════════════════════════════════════════════════════════════════════════
-- 📅 APPOINTMENTS + AGENDA
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appointments_rw ON public.appointments;
CREATE POLICY appointments_rw ON public.appointments
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));

ALTER TABLE public.agenda_sesiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agenda_sesiones_rw ON public.agenda_sesiones;
CREATE POLICY agenda_sesiones_rw ON public.agenda_sesiones
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));


-- ════════════════════════════════════════════════════════════════════════════
-- 📝 FORMULARIOS Y EVALUACIONES (registro_aba, anamnesis, entorno, form_responses)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS form_responses_rw ON public.form_responses;
CREATE POLICY form_responses_rw ON public.form_responses
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));

ALTER TABLE public.anamnesis_completa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anamnesis_completa_rw ON public.anamnesis_completa;
CREATE POLICY anamnesis_completa_rw ON public.anamnesis_completa
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));

ALTER TABLE public.registro_aba ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registro_aba_rw ON public.registro_aba;
CREATE POLICY registro_aba_rw ON public.registro_aba
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));

ALTER TABLE public.registro_entorno_hogar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registro_entorno_hogar_rw ON public.registro_entorno_hogar;
CREATE POLICY registro_entorno_hogar_rw ON public.registro_entorno_hogar
  FOR ALL TO authenticated
  USING (public.is_staff() OR public.is_parent_of(child_id))
  WITH CHECK (public.is_staff() OR public.is_parent_of(child_id));


-- ════════════════════════════════════════════════════════════════════════════
-- 🧠 IA — sugerencias, patrones, objetivos adaptativos (solo staff puede ver
--   datos agregados de pacientes; padres no acceden directamente a estas tablas)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.sugerencias_terapeutas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sugerencias_terapeutas_rw ON public.sugerencias_terapeutas;
CREATE POLICY sugerencias_terapeutas_rw ON public.sugerencias_terapeutas
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

ALTER TABLE public.patrones_detectados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS patrones_detectados_rw ON public.patrones_detectados;
CREATE POLICY patrones_detectados_rw ON public.patrones_detectados
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

ALTER TABLE public.objetivos_adaptativos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS objetivos_adaptativos_rw ON public.objetivos_adaptativos;
CREATE POLICY objetivos_adaptativos_rw ON public.objetivos_adaptativos
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- ════════════════════════════════════════════════════════════════════════════
-- 💬 CHATS (padre ↔ admin, especialista ↔ admin, ARIA logs)
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.parent_chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_chat_messages_rw ON public.parent_chat_messages;
CREATE POLICY parent_chat_messages_rw ON public.parent_chat_messages
  FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR parent_user_id = auth.uid()
    OR (child_id IS NOT NULL AND public.is_parent_of(child_id))
  )
  WITH CHECK (
    public.is_staff()
    OR parent_user_id = auth.uid()
    OR (child_id IS NOT NULL AND public.is_parent_of(child_id))
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 💰 PAGOS — solo staff puede leer/modificar
-- ════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='pagos') THEN
    EXECUTE 'ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pagos_rw ON public.pagos';
    EXECUTE 'CREATE POLICY pagos_rw ON public.pagos FOR ALL TO authenticated USING (public.is_staff() OR public.is_parent_of(child_id)) WITH CHECK (public.is_staff())';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 🛒 CATÁLOGO PÚBLICO (terapias_catalogo, recursos, store)
--    Lectura: cualquier autenticado puede ver el catálogo activo
--    Escritura: solo staff
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.terapias_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS terapias_catalogo_select ON public.terapias_catalogo;
CREATE POLICY terapias_catalogo_select ON public.terapias_catalogo
  FOR SELECT TO authenticated
  USING (activo = true OR public.is_staff());

DROP POLICY IF EXISTS terapias_catalogo_write ON public.terapias_catalogo;
CREATE POLICY terapias_catalogo_write ON public.terapias_catalogo
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- ════════════════════════════════════════════════════════════════════════════
-- 📑 DOCUMENTOS EMITIDOS (Word/PDF generados) — verificación pública por código
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

-- Lectura pública (anon) — necesario para /verificar/[codigo].
-- IMPORTANTE: solo expone metadata (iniciales, tipo, fecha, validez), NO el archivo.
DROP POLICY IF EXISTS documentos_emitidos_public_verify ON public.documentos_emitidos;
CREATE POLICY documentos_emitidos_public_verify ON public.documentos_emitidos
  FOR SELECT TO anon, authenticated
  USING (true);

-- Escritura: solo staff (los endpoints server-side usan service_role, que igualmente bypasea)
DROP POLICY IF EXISTS documentos_emitidos_write ON public.documentos_emitidos;
CREATE POLICY documentos_emitidos_write ON public.documentos_emitidos
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());


-- ════════════════════════════════════════════════════════════════════════════
-- 🔔 NOTIFICACIONES — cada usuario ve las suyas
-- ════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='notifications') THEN
    EXECUTE 'ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS notifications_rw ON public.notifications';
    EXECUTE 'CREATE POLICY notifications_rw ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_staff()) WITH CHECK (user_id = auth.uid() OR public.is_staff())';
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════════════════
-- ✅ VERIFICACIÓN FINAL
-- Listar todas las tablas que tienen RLS activado:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
-- ════════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.auth_role() IS 'Devuelve el role del usuario autenticado actual.';
COMMENT ON FUNCTION public.is_staff() IS 'TRUE si el usuario actual es jefe/admin/especialista/terapeuta/secretaria.';
COMMENT ON FUNCTION public.is_admin() IS 'TRUE si el usuario actual es jefe o admin (acciones críticas).';
COMMENT ON FUNCTION public.is_parent_of(uuid) IS 'TRUE si el usuario actual es el padre/madre del child_id pasado.';

-- ════════════════════════════════════════════════════════════════════════════
-- NOTAS DE EJECUCIÓN:
-- 1. Si una tabla NO existe en tu DB, el ALTER fallará — comentá esa sección.
-- 2. Los endpoints server-side (con SERVICE_ROLE_KEY) bypasean estas políticas
--    automáticamente. NO necesitás cambiar el código del backend.
-- 3. Después de ejecutar, probá:
--    a) Login como padre → ¿ve solo a sus hijos? ✓
--    b) Login como padre → ¿GET /rest/v1/children devuelve solo los suyos? ✓
--    c) Login como admin → ¿ve todo? ✓
--    d) Sin login (anon) → ¿GET /rest/v1/children devuelve []? ✓ (debería)
-- ════════════════════════════════════════════════════════════════════════════
