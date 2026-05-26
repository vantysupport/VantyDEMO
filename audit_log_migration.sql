-- ════════════════════════════════════════════════════════════════════════════
-- 📋 AUDIT LOG — Registro completo de acciones críticas
-- ════════════════════════════════════════════════════════════════════════════
-- Registra QUIÉN, QUÉ, CUÁNDO, DESDE DÓNDE para auditoría y respuesta a incidentes.
--
-- Casos de uso:
--   • Investigar quién eliminó/modificó datos de un paciente
--   • Cumplir requisitos de la Ley 29733 (Perú) sobre tratamiento de datos sensibles
--   • Detectar accesos anómalos (mismo usuario desde múltiples IPs en minutos)
--   • Trazabilidad ante reclamos legales
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.audit_log (
  id              bigserial PRIMARY KEY,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Quién
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text,
  user_role       text,

  -- Qué
  action          text NOT NULL,           -- 'create' | 'update' | 'delete' | 'login' | 'export' | 'generate_report' | ...
  resource_type   text NOT NULL,           -- 'evaluacion' | 'paciente' | 'sesion_aba' | 'documento' | 'config' | ...
  resource_id     text,                    -- id del recurso afectado (UUID o código)
  child_id        uuid,                    -- si la acción involucra a un paciente

  -- Detalles
  description     text,                    -- texto humano corto
  metadata        jsonb DEFAULT '{}'::jsonb, -- payload adicional (diff, params, etc.)

  -- Dónde
  ip_address      text,
  user_agent      text,

  -- Resultado
  success         boolean DEFAULT true,
  error_message   text
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id        ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_child_id       ON public.audit_log(child_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at     ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action         ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource_type  ON public.audit_log(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource       ON public.audit_log(resource_type, resource_id);

-- RLS: solo admin/jefe pueden LEER los logs. Nadie puede modificarlos desde el cliente
-- (los inserts se hacen siempre con SERVICE_ROLE desde el backend).
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- No hay políticas de INSERT/UPDATE/DELETE → solo service_role escribe (bypass).
-- Esto garantiza inmutabilidad: ni siquiera admin puede borrar logs.

COMMENT ON TABLE public.audit_log IS 'Registro inmutable de acciones críticas. Solo lectura para admin/jefe.';
COMMENT ON COLUMN public.audit_log.action IS 'Tipo de acción: create, update, delete, login, logout, export, generate_report, mfa_enroll, mfa_verify, password_change, role_change, permission_grant, permission_revoke.';
COMMENT ON COLUMN public.audit_log.resource_type IS 'Tipo de recurso: evaluacion, paciente, sesion_aba, documento, programa, config, usuario.';

-- ════════════════════════════════════════════════════════════════════════════
-- 🔐 MFA factor tracking (refuerzo de 2FA)
-- ════════════════════════════════════════════════════════════════════════════
-- Marca cuándo un usuario habilitó MFA por primera vez. Lo usamos para
-- forzar configuración de 2FA en roles críticos (admin/jefe).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS mfa_required boolean DEFAULT false;

-- Marcar automáticamente todos los admin/jefe como "MFA requerido"
UPDATE public.profiles
SET mfa_required = true
WHERE role IN ('jefe', 'admin') AND COALESCE(mfa_required, false) = false;

COMMENT ON COLUMN public.profiles.mfa_enrolled_at IS 'Fecha en que el usuario configuró por primera vez 2FA.';
COMMENT ON COLUMN public.profiles.mfa_required IS 'Si TRUE, el usuario debe configurar 2FA antes de poder operar (forzado por middleware).';
