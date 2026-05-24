-- ═══════════════════════════════════════════════════════════════════════════
-- DOCUMENTOS EMITIDOS — Registro central de todos los documentos generados
-- ═══════════════════════════════════════════════════════════════════════════
-- Cada vez que se genera un .docx desde el sistema, se inserta una fila aquí.
-- El QR del documento apunta a /verificar/<codigo_doc> que consulta esta tabla
-- y muestra si el documento es válido + metadata básica (sin info sensible).

create table if not exists documentos_emitidos (
  codigo_doc       text primary key,            -- ej: 'IC-20260523-9C5C7A'
  child_id         uuid references children(id) on delete set null,
  tipo             text not null,               -- 'informe_clinico' | 'anamnesis' | 'sesion_aba' | 'ficha' | 'padres' | 'comparativo' | 'seguro'
  tipo_label       text not null,               -- texto visible: "Informe Clínico de Tratamiento"
  paciente_nombre  text,                        -- nombre completo (para uso interno)
  paciente_iniciales text,                      -- iniciales mostrables: "ArAg"
  fecha_emision    timestamptz default now(),
  especialista     text,                        -- nombre del responsable
  generado_por     uuid references profiles(id) on delete set null,
  valido           boolean default true,        -- se puede invalidar manualmente si se reemite
  file_name        text,                        -- nombre del archivo generado
  notas            text,
  metadata         jsonb default '{}'::jsonb,   -- libre: periodo, sets, etc.
  created_at       timestamptz default now()
);

create index if not exists idx_documentos_emitidos_child on documentos_emitidos(child_id);
create index if not exists idx_documentos_emitidos_fecha on documentos_emitidos(fecha_emision desc);
create index if not exists idx_documentos_emitidos_tipo on documentos_emitidos(tipo);

-- RLS: la VERIFICACIÓN pública (lectura) está permitida; las inserciones solo via service_role
alter table documentos_emitidos enable row level security;

drop policy if exists "verificacion publica" on documentos_emitidos;
create policy "verificacion publica"
  on documentos_emitidos for select
  using (true);  -- cualquiera puede verificar por código (el código es difícil de adivinar)

-- (las inserciones ocurren via supabaseAdmin que bypassa RLS)
