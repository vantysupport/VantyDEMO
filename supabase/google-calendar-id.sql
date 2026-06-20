-- ─────────────────────────────────────────────────────────────────────────────
-- Google Calendar con scope calendar.app.created (sin verificación de Google).
-- La app crea un calendario secundario "Vanty ABA" por usuario y guarda su id acá.
-- Correr UNA VEZ en el SQL Editor del proyecto demo (idempotente).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists google_calendar_id text;
