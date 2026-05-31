-- ════════════════════════════════════════════════════════════════════════════
-- 📅 RESERVAS ONLINE — link de reserva para padres + disponibilidad configurable
-- ════════════════════════════════════════════════════════════════════════════
-- Flujo:
--   1. Jefe/Secretaria configura la disponibilidad del centro (booking_config):
--      horas de trabajo por día, duración de sesión, días cerrados.
--   2. Genera un link (booking_links) con: cuántas citas puede separar el padre,
--      tipo de plan (individual/paquete), especialista y servicio.
--   3. El padre abre el link, inicia sesión y elige sus horarios.
--   4. Cada reserva crea filas en `appointments` → aparece en la agenda de todos.
--   5. Los horarios ya tomados dejan de mostrarse a los siguientes padres.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Configuración de disponibilidad (singleton global del centro) ────────
CREATE TABLE IF NOT EXISTS public.booking_config (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Duración de cada sesión en minutos (ej. 45)
  session_duration_min int NOT NULL DEFAULT 45,
  -- Separación entre el inicio de un turno y el siguiente (ej. 60 = turnos cada hora)
  slot_step_min        int NOT NULL DEFAULT 60,
  -- Horario de trabajo por día de la semana (0=domingo … 6=sábado)
  --   { "1": { "activo": true, "bloques": [{"inicio":"09:00","fin":"13:00"}] }, ... }
  working_hours        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Fechas cerradas (feriados, vacaciones): ['2026-07-28', ...]
  closed_dates         text[] NOT NULL DEFAULT '{}',
  -- Cuántos días hacia adelante se puede reservar
  max_advance_days     int NOT NULL DEFAULT 30,
  updated_by           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Fila por defecto (lun-vie 9-13 y 15-19)
INSERT INTO public.booking_config (session_duration_min, slot_step_min, working_hours, max_advance_days)
SELECT 45, 60,
  '{
    "1": {"activo": true, "bloques": [{"inicio":"09:00","fin":"13:00"},{"inicio":"15:00","fin":"19:00"}]},
    "2": {"activo": true, "bloques": [{"inicio":"09:00","fin":"13:00"},{"inicio":"15:00","fin":"19:00"}]},
    "3": {"activo": true, "bloques": [{"inicio":"09:00","fin":"13:00"},{"inicio":"15:00","fin":"19:00"}]},
    "4": {"activo": true, "bloques": [{"inicio":"09:00","fin":"13:00"},{"inicio":"15:00","fin":"19:00"}]},
    "5": {"activo": true, "bloques": [{"inicio":"09:00","fin":"13:00"},{"inicio":"15:00","fin":"19:00"}]},
    "6": {"activo": false, "bloques": []},
    "0": {"activo": false, "bloques": []}
  }'::jsonb,
  30
WHERE NOT EXISTS (SELECT 1 FROM public.booking_config);

-- ─── 2. Links de reserva enviados a padres ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text NOT NULL UNIQUE,
  -- Paciente para el que se reserva (opcional: si no se fija, el padre elige su hijo)
  child_id      uuid REFERENCES public.children(id) ON DELETE SET NULL,
  -- Especialista con quien serán las citas (opcional)
  specialist_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Cuántas citas puede separar el padre con este link (1, 2, 3, …)
  max_slots     int NOT NULL DEFAULT 1,
  -- Tipo de plan elegido: 'individual' | 'paquete' | texto libre
  plan_type     text,
  service_type  text DEFAULT 'Terapia',
  modalidad     text DEFAULT 'presencial',
  notas         text,
  -- Vencimiento del link
  expires_at    timestamptz,
  -- Cuántas citas ya separó (cuando llega a max_slots, el link se agota)
  slots_used    int NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_links_token ON public.booking_links(token);
CREATE INDEX IF NOT EXISTS idx_booking_links_child ON public.booking_links(child_id);

-- ─── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.booking_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_links  ENABLE ROW LEVEL SECURITY;

-- booking_config: lectura para autenticados (la página de reserva la necesita);
-- escritura solo staff. (El endpoint server-side usa service_role igualmente.)
DROP POLICY IF EXISTS booking_config_select ON public.booking_config;
CREATE POLICY booking_config_select ON public.booking_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS booking_config_write ON public.booking_config;
CREATE POLICY booking_config_write ON public.booking_config
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- booking_links: lectura para autenticados (el padre con el token lo necesita);
-- escritura solo staff.
DROP POLICY IF EXISTS booking_links_select ON public.booking_links;
CREATE POLICY booking_links_select ON public.booking_links
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS booking_links_write ON public.booking_links;
CREATE POLICY booking_links_write ON public.booking_links
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

COMMENT ON TABLE public.booking_config IS 'Disponibilidad del centro para reservas online (horario, duración, días cerrados).';
COMMENT ON TABLE public.booking_links  IS 'Links de reserva enviados a padres. Cada uno permite separar N citas.';
