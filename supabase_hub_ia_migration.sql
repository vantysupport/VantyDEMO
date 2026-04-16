-- ============================================================
-- MIGRACIÓN HUB IA — Jugando Aprendo
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. PREDICCIONES IA
-- Almacena predicciones de progreso generadas por el agente
CREATE TABLE IF NOT EXISTS predicciones_ia (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id      uuid REFERENCES children(id) ON DELETE CASCADE,
  fecha_prediccion date,
  prediccion_30d   text,
  prediccion_90d   text,
  confianza        integer DEFAULT 0,
  areas_riesgo     text[]  DEFAULT '{}',
  areas_fortaleza  text[]  DEFAULT '{}',
  analisis_ia      text,
  sesiones_analizadas integer DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (child_id)
);
ALTER TABLE predicciones_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON predicciones_ia FOR ALL TO service_role USING (true);

-- 2. PATRONES DETECTADOS
-- Almacena patrones ABA detectados por el agente
CREATE TABLE IF NOT EXISTS patrones_detectados (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id         uuid REFERENCES children(id) ON DELETE CASCADE,
  fecha_analisis   date,
  patrones         jsonb DEFAULT '[]',
  sesiones_analizadas integer DEFAULT 0,
  analisis_ia      text,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (child_id)
);
ALTER TABLE patrones_detectados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON patrones_detectados FOR ALL TO service_role USING (true);

-- 3. OBJETIVOS ADAPTATIVOS
-- Almacena objetivos terapéuticos generados/ajustados por IA
CREATE TABLE IF NOT EXISTS objetivos_adaptativos (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id            uuid REFERENCES children(id) ON DELETE CASCADE,
  accion              text,   -- 'generar' | 'ajustar' | 'evaluar_dominio'
  resultado           jsonb,
  programas_analizados integer DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);
ALTER TABLE objetivos_adaptativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON objetivos_adaptativos FOR ALL TO service_role USING (true);

-- 4. AUDIT LOGS
-- Registro de acciones para el módulo de Seguridad
CREATE TABLE IF NOT EXISTS audit_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid,
  user_role  text,
  accion     text,
  recurso    text,
  detalle    jsonb,
  ip         text,
  timestamp  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_accion    ON audit_logs(accion);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON audit_logs FOR ALL TO service_role USING (true);

-- 5. ALERTAS SEGURIDAD
-- Alertas de seguridad detectadas por el agente guardián
CREATE TABLE IF NOT EXISTS alertas_seguridad (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo        text,
  nivel       text,   -- 'info' | 'warning' | 'critical'
  descripcion text,
  resuelto    boolean DEFAULT false,
  user_id     uuid,
  timestamp   timestamptz DEFAULT now()
);
ALTER TABLE alertas_seguridad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON alertas_seguridad FOR ALL TO service_role USING (true);

-- ============================================================
-- FIN MIGRACIÓN
-- ============================================================
