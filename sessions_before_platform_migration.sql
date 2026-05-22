-- ─────────────────────────────────────────────────────────────────────────────
-- Agrega la columna `sessions_before_platform` a la tabla `children`
-- para registrar sesiones que el paciente tuvo ANTES de usar la plataforma.
--
-- El total de sesiones que ve el equipo es:
--    sessions_before_platform  +  COUNT(appointments completed | agenda_sesiones realizadas | aba_sessions_v2)
--
-- El admin puede ajustarlo manualmente desde "Información general → Ajustar previas"
-- ─────────────────────────────────────────────────────────────────────────────

alter table children
  add column if not exists sessions_before_platform integer not null default 0;

-- (Opcional) garantía: no permitir números negativos
alter table children
  drop constraint if exists children_sessions_before_platform_nonneg;
alter table children
  add constraint children_sessions_before_platform_nonneg check (sessions_before_platform >= 0);

comment on column children.sessions_before_platform is
  'Conteo de sesiones que el paciente tuvo antes de empezar a usar la plataforma. Se suma al conteo automático de appointments completados.';
