-- Ejecutar en Supabase → SQL Editor
-- Tabla para guardar la sesión de WhatsApp

CREATE TABLE IF NOT EXISTS wsp_sessions (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Sin RLS — solo accede el service_role desde Railway
ALTER TABLE wsp_sessions DISABLE ROW LEVEL SECURITY;
