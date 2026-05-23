-- ═══════════════════════════════════════════════════════════════════════════
-- PATIENT_DOCUMENTS — texto extraído para alimentar a la IA
-- ═══════════════════════════════════════════════════════════════════════════
-- Cuando se sube un PDF/DOCX/imagen/TXT, se extrae el texto y se guarda aquí
-- para que la IA pueda citarlo cuando responda sobre el paciente.

alter table patient_documents
  add column if not exists extracted_text     text,
  add column if not exists extracted_at       timestamptz,
  add column if not exists extraction_status  text default 'pending',  -- pending | done | failed | not_supported
  add column if not exists extraction_error   text,
  add column if not exists extracted_chars    integer;

create index if not exists idx_patient_documents_extraction_status
  on patient_documents(extraction_status);
