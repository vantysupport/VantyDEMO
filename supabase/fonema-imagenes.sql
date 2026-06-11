-- ─────────────────────────────────────────────────────────────────────────────
-- REPOSITORIO DE IMÁGENES DE FONEMAS (galería por fonema)
-- El admin agrega URLs de imágenes por fonema; las familias las ven en la
-- actividad "Fonemas" (Practicar en Casa). Si un fonema no tiene imágenes,
-- se usa el sticker de OpenMoji por defecto.
-- El acceso va por /api/fonemas-imagenes con service_role (bypassa RLS).
-- Ejecutar UNA VEZ en Supabase → SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.fonema_imagenes (
  id          uuid primary key default gen_random_uuid(),
  fonema_id   text not null,
  url         text not null,
  orden       int  default 0,
  created_at  timestamptz default now()
);

create index if not exists idx_fonema_imagenes_fonema
  on public.fonema_imagenes (fonema_id);

-- RLS activado SIN políticas públicas: solo el service_role (servidor) accede.
alter table public.fonema_imagenes enable row level security;
