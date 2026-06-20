-- ════════════════════════════════════════════════════════════════════
-- ESQUEMA RECONSTRUIDO del proyecto original (Vanty ABA) — schema public
-- Generado automáticamente. Correr en el SQL Editor del proyecto DEMO.
-- ════════════════════════════════════════════════════════════════════

-- Resuelve el tipo "vector" y demás esté donde esté instalado pgvector.
set search_path = public, extensions;

-- ── Extensiones ──
create extension if not exists "pg_stat_statements" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "supabase_vault" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "vector" with schema extensions;

-- ── Secuencias ──
create sequence if not exists public."audit_logs_id_seq";

-- ── Tablas ──
create table if not exists public."aba_sessions_v2" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid,
  "child_id" uuid,
  "professional_id" uuid,
  "session_date" date not null,
  "session_type_id" uuid,
  "session_number" integer,
  "duration_minutes" integer default 45,
  "location" character varying(100),
  "child_mood" character varying(50),
  "cooperation_level" character varying(50),
  "overall_engagement_percentage" numeric,
  "total_trials_across_goals" integer default 0,
  "total_correct_responses" integer default 0,
  "overall_accuracy_percentage" numeric,
  "session_notes" text,
  "parent_message" text,
  "areas_of_concern" text,
  "recommendations" text,
  "reinforcers_used" text[],
  "reinforcement_effectiveness" character varying(50),
  "behaviors_observed" text,
  "challenging_behaviors_count" integer default 0,
  "environmental_modifications" text,
  "materials_used" text[],
  "is_complete" boolean default false,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."abc_observations" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid,
  "tenant_id" uuid,
  "child_id" uuid,
  "observation_time" timestamp with time zone not null,
  "antecedent" text not null,
  "behavior" text not null,
  "consequence" text not null,
  "behavior_category" character varying(100),
  "function_hypothesis" character varying(100),
  "setting" character varying(100),
  "activity" character varying(100),
  "people_present" text[],
  "severity" character varying(50),
  "duration_seconds" integer,
  "intervention_used" text,
  "intervention_effective" boolean,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."agenda_sesiones" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "terapeuta_id" uuid,
  "fecha" date not null,
  "hora_inicio" time without time zone not null,
  "hora_fin" time without time zone,
  "tipo" text default 'individual'::text,
  "estado" text default 'programada'::text,
  "modalidad" text default 'presencial'::text,
  "notas" text,
  "recordatorio_enviado" boolean default false,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "microsoft_calendar_event_id" text,
  "meeting_link" text
);

create table if not exists public."agente_acciones" (
  "id" uuid default gen_random_uuid() not null,
  "conversacion_id" uuid,
  "child_id" uuid,
  "tipo_accion" text,
  "input_data" jsonb,
  "output_data" jsonb,
  "fuentes_usadas" jsonb default '[]'::jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."agente_alertas" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "tipo" text,
  "titulo" text not null,
  "mensaje" text not null,
  "programa_id" uuid,
  "prioridad" text default 'media'::text,
  "resuelta" boolean default false,
  "leida" boolean default false,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."agente_conversaciones" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "user_id" uuid not null,
  "titulo" text,
  "contexto" text,
  "mensajes" jsonb default '[]'::jsonb,
  "metadata" jsonb default '{}'::jsonb,
  "activa" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."alertas_seguridad" (
  "id" uuid default gen_random_uuid() not null,
  "tipo" text not null,
  "user_id" uuid,
  "descripcion" text not null,
  "nivel" text not null,
  "metadata" jsonb,
  "resuelto" boolean default false,
  "resuelto_por" uuid,
  "resuelto_at" timestamp with time zone,
  "timestamp" timestamp with time zone default now()
);

create table if not exists public."anamnesis_completa" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "fecha_creacion" timestamp with time zone default now(),
  "datos" jsonb,
  "creado_por" uuid,
  "created_at" timestamp with time zone default now(),
  "form_title" text default 'Historia Clínica (Anamnesis)'::text
);

create table if not exists public."app_settings" (
  "id" integer default 1 not null,
  "maintenance" boolean default false not null,
  "maintenance_msg" text,
  "limits" jsonb default '{}'::jsonb not null,
  "updated_at" timestamp with time zone default now(),
  "aria_limits" jsonb default '{}'::jsonb not null,
  "features" jsonb default '{}'::jsonb,
  "roles_config" jsonb default '{}'::jsonb
);

create table if not exists public."appointments" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "parent_id" uuid,
  "appointment_date" date not null,
  "appointment_time" time without time zone not null,
  "service_type" text,
  "notes" text,
  "status" text default 'Pendiente'::text,
  "created_at" timestamp with time zone default now(),
  "is_group" boolean default false,
  "group_name" text,
  "type" character varying(20) default 'individual'::character varying,
  "metadata" jsonb,
  "modalidad" text default 'presencial'::text,
  "google_calendar_event_id" text,
  "microsoft_calendar_event_id" text,
  "created_by" uuid,
  "parent_google_calendar_event_id" text,
  "parent_microsoft_calendar_event_id" text,
  "video_link" text,
  "specialist_id" uuid
);

create table if not exists public."aria_usage" (
  "rl_key" text not null,
  "count" integer default 0 not null,
  "window_start" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."audit_log" (
  "id" uuid default uuid_generate_v4() not null,
  "user_id" uuid,
  "action" character varying(100) not null,
  "resource_type" character varying(50),
  "resource_id" uuid,
  "details" jsonb,
  "ip_address" inet,
  "user_agent" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."audit_logs" (
  "id" bigint default nextval('audit_logs_id_seq'::regclass) not null,
  "accion" text not null,
  "user_id" uuid,
  "user_role" text,
  "recurso" text,
  "detalles" jsonb,
  "ip_address" text,
  "user_agent" text,
  "hash_verificacion" text,
  "timestamp" timestamp with time zone default now()
);

create table if not exists public."behavioral_goals" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid,
  "child_id" uuid,
  "domain" character varying(100) not null,
  "subdomain" character varying(100),
  "short_term_goal" text not null,
  "long_term_goal" text,
  "mastery_criterion" text not null,
  "baseline_percentage" numeric default 0,
  "current_percentage" numeric default 0,
  "status" character varying(50) default 'active'::character varying,
  "priority" integer default 2,
  "teaching_procedure" character varying(100),
  "total_sessions_worked" integer default 0,
  "sessions_at_criterion" integer default 0,
  "start_date" date default CURRENT_DATE not null,
  "target_date" date,
  "mastered_date" date,
  "discontinued_date" date,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "created_by" uuid
);

create table if not exists public."benchmark_snapshots" (
  "id" uuid default gen_random_uuid() not null,
  "fecha" date default CURRENT_DATE not null,
  "score_global" integer not null,
  "metricas" jsonb,
  "analisis_ia" text,
  "total_pacientes" integer,
  "total_sesiones" integer,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."blog_posts" (
  "id" uuid default uuid_generate_v4() not null,
  "title" text not null,
  "slug" text not null,
  "excerpt" text,
  "content" text,
  "cover_url" text,
  "cover_emoji" text default '📝'::text,
  "cover_bg" text default '#F2C8B6'::text,
  "category" text default 'Divulgación'::text not null,
  "author_name" text default 'Francesca R.B.'::text not null,
  "author_initials" text default 'FR'::text not null,
  "read_time" integer default 5 not null,
  "is_published" boolean default false not null,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."booking_config" (
  "id" uuid default gen_random_uuid() not null,
  "session_duration_min" integer default 45 not null,
  "slot_step_min" integer default 60 not null,
  "working_hours" jsonb default '{}'::jsonb not null,
  "closed_dates" text[] default '{}'::text[] not null,
  "max_advance_days" integer default 30 not null,
  "updated_by" uuid,
  "updated_at" timestamp with time zone default now() not null,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."booking_links" (
  "id" uuid default gen_random_uuid() not null,
  "token" text not null,
  "child_id" uuid,
  "specialist_id" uuid,
  "max_slots" integer default 1 not null,
  "plan_type" text,
  "service_type" text default 'Terapia'::text,
  "modalidad" text default 'presencial'::text,
  "notas" text,
  "expires_at" timestamp with time zone,
  "slots_used" integer default 0 not null,
  "active" boolean default true not null,
  "created_by" uuid,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."cambios_fase_aba" (
  "id" uuid default gen_random_uuid() not null,
  "programa_id" uuid,
  "child_id" uuid,
  "fecha" date default CURRENT_DATE,
  "fase_anterior" text,
  "fase_nueva" text,
  "motivo" text,
  "created_by" uuid,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."centro_instrucciones" (
  "id" uuid default gen_random_uuid() not null,
  "categoria" text not null,
  "titulo" text not null,
  "contenido" text not null,
  "prioridad" integer default 5,
  "activo" boolean default true,
  "embedding" vector(768),
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "nombre_centro" text default 'Vanty ABA'::text,
  "ruc" text,
  "direccion" text default ''::text,
  "telefono" text default '994 196 916'::text,
  "email" text default 'vantysupport@gmail.com'::text
);

create table if not exists public."chat_especialista_admin" (
  "id" uuid default gen_random_uuid() not null,
  "content" text not null,
  "sender_id" uuid not null,
  "sender_role" text not null,
  "sender_name" text not null,
  "recipient_id" uuid,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "message_type" text default 'text'::text,
  "file_url" text,
  "file_name" text,
  "file_type" text,
  "reaction" text,
  "is_pinned" boolean default false,
  "is_starred" boolean default false
);

create table if not exists public."chat_familias" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "content" text not null,
  "sender_id" uuid not null,
  "sender_role" text default 'padre'::text not null,
  "sender_name" text default 'Usuario'::text not null,
  "read_by" uuid[] default '{}'::uuid[],
  "message_type" text default 'text'::text not null,
  "file_url" text,
  "created_at" timestamp with time zone default now(),
  "file_name" text,
  "file_size" bigint
);

create table if not exists public."chat_padres" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "parent_user_id" uuid,
  "rol" text default 'user'::text,
  "mensaje" text not null,
  "metadata" jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."children" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid,
  "name" character varying(255) not null,
  "birth_date" date,
  "age" integer,
  "diagnosis" text,
  "notes" text,
  "parent_id" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "is_active" boolean default true,
  "apodo" text,
  "notas" text,
  "specialist_id" uuid,
  "sessions_before_platform" integer default 0 not null
);

create table if not exists public."clinical_template_responses" (
  "id" uuid default gen_random_uuid() not null,
  "template_id" uuid not null,
  "child_id" uuid not null,
  "filled_by" uuid not null,
  "filler_role" text not null,
  "filler_name" text not null,
  "responses" jsonb default '{}'::jsonb not null,
  "notes" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."clinical_templates" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text,
  "category" text default 'historia_clinica'::text,
  "fields" jsonb default '[]'::jsonb not null,
  "is_active" boolean default true,
  "is_default" boolean default false,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "sections" jsonb default '[]'::jsonb
);

create table if not exists public."conocimiento_clinico" (
  "id" uuid default gen_random_uuid() not null,
  "area_intervencion" text,
  "patron_efectivo" text,
  "patron_desafio" text,
  "tecnica_ganadora" text,
  "reforzador_tipo" text,
  "perfil_paciente" text,
  "aprendizaje_transferible" text,
  "nivel_complejidad" text,
  "tags" text[] default '{}'::text[],
  "votos_util" integer default 0,
  "sesion_fecha" date,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."documentos_emitidos" (
  "codigo_doc" text not null,
  "child_id" uuid,
  "tipo" text not null,
  "tipo_label" text not null,
  "paciente_nombre" text,
  "paciente_iniciales" text,
  "fecha_emision" timestamp with time zone default now(),
  "especialista" text,
  "generado_por" uuid,
  "valido" boolean default true,
  "file_name" text,
  "notas" text,
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."engagement_actividades" (
  "id" uuid default gen_random_uuid() not null,
  "plan_id" uuid,
  "child_id" uuid,
  "titulo" text,
  "completada" boolean default false,
  "fecha" date,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."engagement_planes" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "semana" integer not null,
  "anio" integer not null,
  "actividades" jsonb,
  "mensaje_motivacional" text,
  "completadas_pct" integer default 0,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."error_logs" (
  "id" uuid default gen_random_uuid() not null,
  "message" text,
  "detail" text,
  "source" text,
  "url" text,
  "user_email" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_abllsr" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "fecha_eval_ablls" date,
  "evaluador_ablls" text,
  "protocolo_usado" text,
  "contexto_eval" text,
  "duracion_ablls" integer,
  "coop_sigue_instrucciones" integer,
  "coop_permanece_tarea" integer,
  "coop_acepta_reforzador" integer,
  "coop_tolerancia_frustracion" integer,
  "coop_transiciones" integer,
  "coop_notas" text,
  "rec_responde_nombre" integer,
  "rec_sigue_1paso" integer,
  "rec_sigue_2pasos" integer,
  "rec_identifica_objetos" integer,
  "rec_identifica_acciones" integer,
  "rec_conceptos_basicos" integer,
  "rec_notas" text,
  "exp_solicita_objetos" integer,
  "exp_etiqueta_objetos" integer,
  "exp_responde_preguntas" integer,
  "exp_combina_palabras" integer,
  "exp_inicia_conversacion" integer,
  "exp_ecolalia" integer,
  "exp_notas" text,
  "social_juego_solo" integer,
  "social_juego_paralelo" integer,
  "social_juego_cooperativo" integer,
  "social_imita_pares" integer,
  "social_busca_interaccion" integer,
  "social_notas" text,
  "acad_discrimina_formas" integer,
  "acad_secuencia_numeros" integer,
  "acad_reconoce_letras" integer,
  "acad_escritura_nombre" integer,
  "acad_lectura_funcional" integer,
  "acad_notas" text,
  "avd_alimentacion" integer,
  "avd_bano" integer,
  "avd_vestido" integer,
  "avd_higiene" integer,
  "avd_notas" text,
  "analisis_ablls_ia" text,
  "objetivos_prioritarios" text,
  "informe_padres_ablls" text,
  "nivel_habilidades" text,
  "puntaje_cooperacion" integer,
  "puntaje_receptivo" integer,
  "puntaje_expresivo" integer,
  "puntaje_social" integer,
  "puntaje_academico" integer,
  "puntaje_avd" integer,
  "ai_analysis" jsonb,
  "created_by" uuid
);

create table if not exists public."evaluacion_ados2" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "datos" jsonb not null,
  "metricas" jsonb,
  "puntuacion_total" integer,
  "nivel_severidad" text,
  "fecha_evaluacion" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_basc3" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "datos" jsonb not null,
  "metricas" jsonb,
  "indice_sintomas_conductuales" integer,
  "perfil_riesgo" text,
  "fecha_evaluacion" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_brief2" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "datos" jsonb not null,
  "metricas" jsonb,
  "fecha_evaluacion" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_cdi2" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "emotional_problems" integer,
  "functional_problems" integer,
  "negative_mood" integer,
  "negative_self_esteem" integer,
  "ineffectiveness" integer,
  "interpersonal_problems" integer,
  "total_score" integer,
  "critical_items" jsonb,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_celf5" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "core_language_score" integer,
  "receptive_language" integer,
  "expressive_language" integer,
  "language_content" integer,
  "language_structure" integer,
  "sentence_comprehension" integer,
  "word_structure" integer,
  "formulated_sentences" integer,
  "recalling_sentences" integer,
  "semantic_relationships" integer,
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_conners3" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "inattention" integer,
  "hyperactivity_impulsivity" integer,
  "learning_problems" integer,
  "executive_functioning" integer,
  "aggression" integer,
  "peer_relations" integer,
  "adhd_inattentive" integer,
  "adhd_hyperactive_impulsive" integer,
  "conduct_disorder" integer,
  "oppositional_defiant" integer,
  "conners_global_index" integer,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_masc2" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "separation_anxiety" integer,
  "social_anxiety" integer,
  "physical_symptoms" integer,
  "harm_avoidance" integer,
  "total_anxiety" integer,
  "inconsistency_index" integer,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_servicios" (
  "id" uuid default gen_random_uuid() not null,
  "evaluacion_id" uuid not null,
  "tipo" text not null,
  "nombre" text not null,
  "descripcion" text,
  "por_que" text,
  "precio" numeric(10,2),
  "moneda" text default 'PEN'::text,
  "duracion" text,
  "incluye" jsonb,
  "orden" integer default 0,
  "activo" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_servicios_catalogo" (
  "id" uuid default gen_random_uuid() not null,
  "tipo" text not null,
  "nombre" text not null,
  "descripcion" text,
  "precio_default" numeric(10,2),
  "duracion" text,
  "incluye" jsonb,
  "activo" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_snapiv" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "inattention_total" integer,
  "inattention_avg" numeric,
  "hyperactivity_total" integer,
  "hyperactivity_avg" numeric,
  "oppositional_total" integer,
  "oppositional_avg" numeric,
  "informant" character varying(50),
  "notes" text,
  "alerts" jsonb,
  "executive_summary" text,
  "created_by" uuid,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_vineland3" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "datos" jsonb not null,
  "metricas" jsonb,
  "puntuacion_comunicacion" integer,
  "puntuacion_vida_diaria" integer,
  "puntuacion_socializacion" integer,
  "indice_conducta_adaptativa" integer,
  "fecha_evaluacion" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."evaluacion_wiscv" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "datos" jsonb not null,
  "metricas" jsonb,
  "ci_total" integer,
  "clasificacion_ci" text,
  "fecha_evaluacion" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."evaluaciones_iniciales" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "parent_id" uuid,
  "estado" text default 'pendiente_intake'::text not null,
  "respuestas_intake" jsonb,
  "intake_completado_en" timestamp with time zone,
  "recomendacion" text,
  "recomendacion_razon" text,
  "recomendacion_resumen" text,
  "recomendacion_areas" jsonb,
  "recomendacion_generada_en" timestamp with time zone,
  "recomendacion_modelo" text,
  "servicio_seleccionado_id" uuid,
  "seleccionado_en" timestamp with time zone,
  "mensaje_al_especialista" text,
  "especialista_asignado_id" uuid,
  "asignado_en" timestamp with time zone,
  "documento_url" text,
  "documento_md" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "mensaje_amigable_padre" text,
  "confirmado_en" timestamp with time zone,
  "rechazado_en" timestamp with time zone,
  "anamnesis_especifica" jsonb,
  "anamnesis_completada_en" timestamp with time zone,
  "terapias_seleccionadas" uuid[],
  "respuesta_especialista" text,
  "respondido_en" timestamp with time zone,
  "respondido_por" uuid,
  "terapias_recomendadas" uuid[],
  "terapias_recomendadas_razon" text,
  "terapias_recomendadas_en" timestamp with time zone,
  "terapias_cambiadas_por_admin" boolean default false,
  "nota_cambio_terapias" text
);

create table if not exists public."facturas" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "numero" text,
  "concepto" text not null,
  "monto" numeric not null,
  "moneda" text default 'PEN'::text,
  "estado" text default 'pendiente'::text,
  "fecha_emision" date default CURRENT_DATE,
  "fecha_vencimiento" date,
  "fecha_pago" date,
  "metodo_pago" text,
  "sesiones_incluidas" integer default 1,
  "notas" text,
  "archivo_url" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."fonema_ayuda" (
  "fonema_id" text not null,
  "boca_url" text,
  "video_url" text,
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."fonema_imagenes" (
  "id" uuid default gen_random_uuid() not null,
  "fonema_id" text not null,
  "url" text not null,
  "orden" integer default 0,
  "created_at" timestamp with time zone default now(),
  "label" text
);

create table if not exists public."form_ai_analyses" (
  "id" uuid default gen_random_uuid() not null,
  "form_id" uuid,
  "form_type" text not null,
  "child_name" text,
  "analysis" jsonb not null,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."form_responses" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "form_type" text not null,
  "form_title" text not null,
  "responses" jsonb not null,
  "ai_analysis" jsonb,
  "completed_by" text default 'admin'::text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."goal_progress" (
  "id" uuid default uuid_generate_v4() not null,
  "goal_id" uuid,
  "session_id" uuid,
  "value" numeric not null,
  "percentage" numeric,
  "notes" text,
  "recorded_by" uuid,
  "recorded_at" timestamp with time zone default now()
);

create table if not exists public."informed_consents" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "consent_type" character varying(50),
  "consent_text" text not null,
  "granted_by" character varying(200) not null,
  "relationship" character varying(50),
  "signature_data" text,
  "ip_address" inet,
  "accepted_at" timestamp with time zone not null,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."knowledge_chunks" (
  "id" uuid default gen_random_uuid() not null,
  "document_id" uuid,
  "chunk_index" integer not null,
  "contenido" text not null,
  "embedding" vector(768),
  "metadata" jsonb default '{}'::jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."knowledge_documents" (
  "id" uuid default gen_random_uuid() not null,
  "titulo" text not null,
  "tipo" text default 'libro'::text,
  "descripcion" text,
  "archivo_url" text,
  "total_chunks" integer default 0,
  "procesado" boolean default false,
  "activo" boolean default true,
  "subido_por" uuid,
  "created_at" timestamp with time zone default now(),
  "source_url" text,
  "texto_extraido" text
);

create table if not exists public."mensajes_familia" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "remitente_id" uuid,
  "rol_remitente" text not null,
  "mensaje" text not null,
  "adjunto_url" text,
  "leido" boolean default false,
  "leido_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."metricas_diarias" (
  "id" uuid default gen_random_uuid() not null,
  "fecha" date default CURRENT_DATE,
  "total_sesiones" integer default 0,
  "sesiones_realizadas" integer default 0,
  "sesiones_canceladas" integer default 0,
  "sesiones_no_asistio" integer default 0,
  "pacientes_activos" integer default 0,
  "pacientes_nuevos" integer default 0,
  "alertas_generadas" integer default 0,
  "alertas_resueltas" integer default 0,
  "tareas_asignadas" integer default 0,
  "tareas_completadas" integer default 0,
  "ingresos_dia" numeric default 0,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."notificaciones" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "child_id" uuid,
  "tipo" text not null,
  "titulo" text not null,
  "mensaje" text not null,
  "leida" boolean default false,
  "canal" text default 'in_app'::text,
  "canal_estado" text default 'pendiente'::text,
  "prioridad" integer default 2,
  "metadata" jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."notifications" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "title" text not null,
  "message" text not null,
  "type" text default 'info'::text,
  "is_read" boolean default false,
  "created_at" timestamp with time zone default now(),
  "form_type" text,
  "child_id" uuid,
  "metadata" jsonb
);

create table if not exists public."objetivos_adaptativos" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "accion" text not null,
  "resultado" jsonb,
  "programas_analizados" integer default 0,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."objetivos_cp" (
  "id" uuid default gen_random_uuid() not null,
  "programa_id" uuid,
  "numero_set" integer not null,
  "descripcion" text not null,
  "criterio_pct" integer default 90,
  "criterio_sesiones" integer default 2,
  "estado" text default 'pendiente'::text,
  "fecha_inicio" date,
  "fecha_dominio" date,
  "created_at" timestamp with time zone default now(),
  "correction_errores" text default ''::text,
  "generalizacion" text default 'Promover con la familia que realicen este ejercicio en casa.'::text,
  "sd_estimulo" text,
  "unidad_positiva" text,
  "unidad_negativa" text,
  "reforzadores" text,
  "materiales" text
);

create table if not exists public."parent_accounts" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "child_id" uuid,
  "nombre" text not null,
  "telefono" text,
  "email" text,
  "parentesco" text default 'padre'::text,
  "whatsapp_activo" boolean default false,
  "notif_citas" boolean default true,
  "notif_reportes" boolean default true,
  "notif_tareas" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."parent_forms" (
  "id" uuid default gen_random_uuid() not null,
  "parent_id" uuid,
  "child_id" uuid,
  "form_type" text not null,
  "form_title" text not null,
  "form_description" text,
  "message_to_parent" text,
  "deadline" date,
  "status" text default 'pending'::text,
  "responses" jsonb,
  "ai_analysis" jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."parent_message_approvals" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "parent_id" uuid,
  "source" text not null,
  "source_title" text,
  "ai_message" text not null,
  "edited_message" text,
  "ai_analysis" jsonb,
  "session_data" jsonb,
  "status" text default 'pending_approval'::text,
  "created_at" timestamp with time zone default now(),
  "approved_at" timestamp with time zone
);

create table if not exists public."parent_resources" (
  "id" uuid default gen_random_uuid() not null,
  "parent_id" uuid,
  "child_id" uuid,
  "title" text not null,
  "description" text,
  "resource_type" text not null,
  "url" text,
  "file_name" text,
  "thumbnail_url" text,
  "is_global" boolean default false,
  "tags" text[],
  "created_at" timestamp with time zone default now()
);

create table if not exists public."parent_session_logs" (
  "id" uuid default gen_random_uuid() not null,
  "parent_id" uuid not null,
  "started_at" timestamp with time zone default now() not null,
  "ended_at" timestamp with time zone,
  "duration_seconds" integer,
  "device" text,
  "created_at" timestamp with time zone default now() not null
);

create table if not exists public."patient_documents" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "uploaded_by" uuid not null,
  "uploader_role" text not null,
  "uploader_name" text not null,
  "file_name" text not null,
  "file_url" text not null,
  "file_type" text not null,
  "file_size" bigint default 0,
  "category" text default 'general'::text,
  "description" text,
  "visible_to_parent" boolean default true,
  "created_at" timestamp with time zone default now(),
  "extracted_text" text,
  "extracted_at" timestamp with time zone,
  "extraction_status" text default 'pending'::text,
  "extraction_error" text,
  "extracted_chars" integer
);

create table if not exists public."patrones_detectados" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "fecha_analisis" date not null,
  "patrones" jsonb default '[]'::jsonb,
  "sesiones_analizadas" integer default 0,
  "analisis_ia" text,
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."payments" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "appointment_id" uuid,
  "amount" numeric default 0 not null,
  "currency" text default 'PEN'::text,
  "status" text default 'pending'::text,
  "payment_method" text default 'efectivo'::text,
  "concept" text default 'Sesión de terapia'::text not null,
  "notes" text,
  "paid_at" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "paciente_externo" text
);

create table if not exists public."predicciones_ia" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "fecha_prediccion" date default CURRENT_DATE not null,
  "prediccion_30d" integer,
  "prediccion_90d" integer,
  "confianza" integer,
  "areas_riesgo" text[],
  "areas_fortaleza" text[],
  "analisis_ia" text,
  "sesiones_analizadas" integer,
  "tendencia_slope" double precision,
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."profiles" (
  "id" uuid not null,
  "email" character varying(255) not null,
  "full_name" character varying(255),
  "role" character varying(50) default 'padre'::character varying,
  "avatar_url" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "tokens" integer default 0,
  "phone" text,
  "user_id" uuid,
  "is_active" boolean default true,
  "specialty" text,
  "wsp_notif" boolean default true,
  "google_calendar_token" text,
  "calendar_provider" text,
  "google_calendar_refresh_token" text,
  "google_calendar_email" text,
  "microsoft_calendar_token" text,
  "microsoft_calendar_refresh_token" text,
  "microsoft_calendar_email" text,
  "active_session_id" text,
  "active_session_at" timestamp with time zone
);

create table if not exists public."programa_practica_casa" (
  "id" uuid default gen_random_uuid() not null,
  "programa_id" uuid not null,
  "child_id" uuid not null,
  "fecha" date not null,
  "nota" text,
  "created_at" timestamp with time zone default now(),
  "objetivo_id" uuid
);

create table if not exists public."programas_aba" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "specialist_id" uuid,
  "area" text not null,
  "titulo" text not null,
  "descripcion" text,
  "objetivo_lp" text not null,
  "criterio_dominio_pct" integer default 90,
  "criterio_sesiones_consecutivas" integer default 2,
  "tipo_medicion" text default 'porcentaje'::text,
  "estado" text default 'activo'::text,
  "fase_actual" text default 'linea_base'::text,
  "sd_estimulo" text,
  "correccion_error" text,
  "reforzadores" text,
  "materiales" text,
  "notas_procedimiento" text,
  "fecha_inicio" date default CURRENT_DATE,
  "fecha_dominio" date,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "unidad_positiva" text,
  "unidad_negativa" text,
  "generalizacion" text default 'Promover con la familia que realicen este ejercicio en casa.'::text,
  "total_unidades" text default '10u.'::text,
  "notas_programa" text,
  "ayudas" text,
  "drive_url" text,
  "area_tags" text[] default '{}'::text[]
);

create table if not exists public."push_subscriptions" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid not null,
  "endpoint" text not null,
  "subscription" jsonb not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."recursos_padres" (
  "id" uuid default gen_random_uuid() not null,
  "titulo" text not null,
  "descripcion" text,
  "tipo" text not null,
  "categoria" text,
  "diagnosticos" text[],
  "url" text,
  "thumbnail_url" text,
  "duracion_min" integer,
  "nivel" text default 'basico'::text,
  "activo" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."registro_aba" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "fecha_sesion" date default CURRENT_DATE,
  "datos" jsonb,
  "creado_por" uuid,
  "form_title" text default 'Sesión ABA'::text
);

create table if not exists public."registro_entorno_hogar" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "fecha_visita" timestamp with time zone default now(),
  "datos" jsonb,
  "created_at" timestamp with time zone default now(),
  "form_title" text default 'Evaluación del Entorno del Hogar'::text
);

create table if not exists public."reinforcement_data" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid,
  "child_id" uuid,
  "reinforcer_type" character varying(100),
  "reinforcer_name" character varying(255) not null,
  "times_used" integer default 1,
  "effectiveness_rating" integer,
  "reinforcement_schedule" character varying(100),
  "notes" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."reinforcers" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "name" character varying(200) not null,
  "description" text,
  "token_cost" integer,
  "category" character varying(50),
  "is_active" boolean default true,
  "times_used" integer default 0,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."reportes_generados" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid not null,
  "tipo_reporte" text not null,
  "evaluacion_id" uuid,
  "titulo" text not null,
  "descripcion" text,
  "nombre_archivo" text not null,
  "file_data" text not null,
  "mime_type" text default 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'::text,
  "tamano_bytes" integer,
  "generado_por" text,
  "version" integer default 1,
  "fecha_generacion" timestamp with time zone default now(),
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "source_id" uuid
);

create table if not exists public."reportes_padres" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "periodo_inicio" date,
  "periodo_fin" date,
  "metricas" jsonb,
  "texto_reporte" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."reportes_seguros" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "numero_referencia" text,
  "periodo_inicio" date,
  "periodo_fin" date,
  "estadisticas" jsonb,
  "texto_informe" text,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."role_changes_log" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "changed_by" uuid,
  "old_role" text,
  "new_role" text,
  "changed_at" timestamp with time zone default now()
);

create table if not exists public."service_rates" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text,
  "amount" numeric not null,
  "currency" text default 'PEN'::text,
  "duration_min" integer default 60,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."sesiones_datos_aba" (
  "id" uuid default gen_random_uuid() not null,
  "programa_id" uuid,
  "objetivo_cp_id" uuid,
  "child_id" uuid,
  "specialist_id" uuid,
  "fecha" date default CURRENT_DATE,
  "fase" text default 'intervencion'::text,
  "oportunidades_totales" integer default 0,
  "respuestas_correctas" integer default 0,
  "respuestas_incorrectas" integer default 0,
  "porcentaje_exito" numeric,
  "frecuencia_valor" numeric,
  "duracion_segundos" integer,
  "intervalo_segundos" integer,
  "nivel_ayuda" text,
  "notas" text,
  "ai_tendencia" text,
  "ai_sugerencia" text,
  "created_at" timestamp with time zone default now(),
  "set_nombre" text,
  "set" text
);

create table if not exists public."session_goals_data" (
  "id" uuid default gen_random_uuid() not null,
  "session_id" uuid,
  "goal_id" uuid,
  "teaching_procedure" character varying(100),
  "prompt_level" character varying(50),
  "trials_presented" integer default 0 not null,
  "correct_responses" integer default 0,
  "incorrect_responses" integer default 0,
  "prompted_responses" integer default 0,
  "no_response" integer default 0,
  "accuracy_percentage" numeric,
  "independence_percentage" numeric,
  "error_patterns" text,
  "notes" text,
  "modifications_made" text,
  "met_criterion" boolean default false,
  "progress_status" character varying(50),
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."session_types" (
  "id" uuid default gen_random_uuid() not null,
  "tenant_id" uuid,
  "name" character varying(100) not null,
  "description" text,
  "color" character varying(7) default '#3b82f6'::character varying,
  "icon" character varying(50) default 'calendar'::character varying,
  "duration_minutes" integer default 45,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."specialist_submissions" (
  "id" uuid default gen_random_uuid() not null,
  "specialist_id" uuid not null,
  "child_id" uuid not null,
  "tipo" text not null,
  "titulo" text not null,
  "contenido" text not null,
  "observaciones" text,
  "recomendaciones" text,
  "status" text default 'pending_approval'::text not null,
  "admin_comment" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."store_order_items" (
  "id" uuid default gen_random_uuid() not null,
  "order_id" uuid,
  "product_id" uuid,
  "product_nombre" text not null,
  "product_imagen" text,
  "cantidad" integer default 1 not null,
  "precio_unitario" numeric not null,
  "subtotal" numeric
);

create table if not exists public."store_orders" (
  "id" uuid default gen_random_uuid() not null,
  "parent_id" uuid,
  "parent_name" text,
  "parent_email" text,
  "parent_phone" text,
  "total_soles" numeric default 0 not null,
  "estado" text default 'pendiente'::text not null,
  "notas" text,
  "admin_notas" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."store_products" (
  "id" uuid default gen_random_uuid() not null,
  "nombre" text not null,
  "descripcion" text,
  "precio_soles" numeric default 0 not null,
  "stock" integer default 0 not null,
  "categoria" text default 'general'::text not null,
  "tipo" text default 'fisico'::text not null,
  "imagen_url" text,
  "archivo_url" text,
  "activo" boolean default true not null,
  "destacado" boolean default false not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."sugerencias_terapeutas" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "tipo" text not null,
  "prioridad" text,
  "prioridad_orden" integer default 1,
  "titulo" text not null,
  "descripcion" text,
  "accion_concreta" text,
  "dato_clave" text,
  "semanas_detectado" integer default 0,
  "resuelta" boolean default false,
  "nota_resolucion" text,
  "resuelta_at" timestamp with time zone,
  "updated_at" timestamp with time zone default now(),
  "created_at" timestamp with time zone default now()
);

create table if not exists public."tareas_hogar" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "sesion_id" uuid,
  "terapeuta_id" uuid,
  "titulo" text not null,
  "descripcion" text not null,
  "instrucciones" text,
  "objetivo" text,
  "fecha_asignada" date default CURRENT_DATE,
  "fecha_limite" date,
  "completada" boolean default false,
  "fecha_completada" timestamp with time zone,
  "nota_padre" text,
  "dificultad_reportada" text,
  "adjunto_url" text,
  "activa" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."tenants" (
  "id" uuid default gen_random_uuid() not null,
  "name" character varying(255) not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);

create table if not exists public."terapias_catalogo" (
  "id" uuid default gen_random_uuid() not null,
  "nombre" text not null,
  "descripcion" text,
  "por_que" text,
  "imagen_url" text,
  "precio" numeric(10,2),
  "moneda" text default 'PEN'::text,
  "duracion" text,
  "modalidad" text default 'presencial'::text,
  "categoria" text,
  "activo" boolean default true,
  "orden" integer default 0,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "color_tema" text default 'indigo'::text
);

create table if not exists public."token_transactions" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "amount" integer not null,
  "transaction_type" character varying(20),
  "reason" text,
  "session_id" uuid,
  "balance_after" integer,
  "created_by" uuid,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."user_roles" (
  "id" uuid default gen_random_uuid() not null,
  "user_id" uuid,
  "rol" text not null,
  "activo" boolean default true,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."video_assignments" (
  "id" uuid default uuid_generate_v4() not null,
  "child_id" uuid,
  "video_id" uuid,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone default now(),
  "completed_at" timestamp with time zone,
  "parent_notes" text
);

create table if not exists public."video_models" (
  "id" uuid default uuid_generate_v4() not null,
  "title" character varying(200) not null,
  "description" text,
  "video_url" text not null,
  "thumbnail_url" text,
  "skill_category" character varying(100),
  "age_range" character varying(50),
  "duration_seconds" integer,
  "created_by" uuid,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."video_sessions" (
  "id" uuid default gen_random_uuid() not null,
  "appointment_id" uuid,
  "child_id" uuid,
  "room_name" text not null,
  "room_url" text not null,
  "initiated_by" text default 'admin'::text not null,
  "status" text default 'waiting'::text not null,
  "duration_minutes" numeric default 0,
  "started_at" timestamp with time zone default now(),
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."weekly_progress_notes" (
  "id" uuid default gen_random_uuid() not null,
  "child_id" uuid,
  "week_start" date not null,
  "admin_note" text,
  "parent_note" text,
  "goals_progress" jsonb,
  "created_at" timestamp with time zone default now()
);

create table if not exists public."wsp_sessions" (
  "key" text not null,
  "value" text not null,
  "updated_at" timestamp with time zone default now()
);

-- ── Funciones ──
CREATE OR REPLACE FUNCTION public._apply_rls(p_table text, p_policy text, p_using text, p_check text DEFAULT NULL::text, p_for text DEFAULT 'ALL'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_full text := format('public.%I', p_table);
  v_check_clause text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_table
  ) THEN
    RAISE NOTICE '[RLS] tabla % no existe — se omite', p_table;
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_full);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %s', p_policy, v_full);

  -- PostgreSQL exige distintas cláusulas según el comando:
  --   SELECT/DELETE → solo USING
  --   INSERT        → solo WITH CHECK
  --   UPDATE/ALL    → ambas
  IF p_for = 'SELECT' OR p_for = 'DELETE' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s)',
      p_policy, v_full, p_for, p_using
    );
  ELSIF p_for = 'INSERT' THEN
    v_check_clause := COALESCE(p_check, p_using);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR INSERT TO authenticated WITH CHECK (%s)',
      p_policy, v_full, v_check_clause
    );
  ELSE
    -- UPDATE o ALL
    v_check_clause := COALESCE(p_check, p_using);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR %s TO authenticated USING (%s) WITH CHECK (%s)',
      p_policy, v_full, p_for, p_using, v_check_clause
    );
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auth_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION public.claim_session(p_session_id text, p_stale_seconds integer DEFAULT 30)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_current text;
  v_at timestamptz;
begin
  if v_uid is null then
    return 'no_auth';
  end if;

  -- Bloqueo de fila para que dos logins simultáneos no se pisen
  select active_session_id, active_session_at
    into v_current, v_at
    from public.profiles
    where id = v_uid
    for update;

  if v_current is null
     or v_current = p_session_id
     or v_at is null
     or v_at < now() - make_interval(secs => p_stale_seconds) then
    update public.profiles
      set active_session_id = p_session_id,
          active_session_at = now()
      where id = v_uid;
    return 'claimed';
  else
    return 'in_use';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_padre_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role      text;
  v_created   timestamptz;
  v_limit     int;
  v_before    int;
  v_pac_limit int;
  v_pac_count int;
  v_is_staff  boolean;
begin
  -- 0) Tope TOTAL de pacientes — aplica a TODOS (incluido el personal).
  select coalesce(nullif(limits->>'paciente','')::int, 0) into v_pac_limit
  from public.app_settings where id = 1;
  if v_pac_limit is not null and v_pac_limit > 0 then
    select count(*) into v_pac_count from public.children;
    if v_pac_count >= v_pac_limit then
      raise exception 'El centro alcanzó el número máximo de pacientes.'
        using errcode = 'P0001';
    end if;
  end if;

  -- ¿Quien inserta es personal del centro? (para el límite de PADRES)
  v_is_staff := exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('jefe','admin','especialista','terapeuta','secretaria','programador')
  );
  if v_is_staff then
    return new;
  end if;

  -- 1) Límite de cuentas de PADRES (solo cuando el dueño es un padre).
  select role, created_at into v_role, v_created
  from public.profiles where id = new.parent_id;
  if v_role is distinct from 'padre' then
    return new;
  end if;

  select coalesce(nullif(limits->>'padre','')::int, 0) into v_limit
  from public.app_settings where id = 1;
  if v_limit is null or v_limit <= 0 then
    return new;
  end if;

  -- Padres que YA tienen hijos pueden agregar (hermanos).
  if exists (select 1 from public.children where parent_id = new.parent_id) then
    return new;
  end if;

  select count(*) into v_before
  from public.profiles
  where role = 'padre' and created_at < v_created;

  if v_before >= v_limit then
    raise exception 'El centro alcanzó el número máximo de cuentas de familias.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_db_size()
 RETURNS bigint
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select pg_database_size(current_database());
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'padre'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.heartbeat_session(p_session_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;
  update public.profiles
    set active_session_at = now()
    where id = v_uid and active_session_id = p_session_id;
  return found;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('jefe','admin')
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_parent_of(p_child_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.children
    WHERE id = p_child_id AND parent_id = auth.uid()
  )
$function$
;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('jefe','admin','especialista','terapeuta','secretaria')
  )
$function$
;

CREATE OR REPLACE FUNCTION public.release_session(p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.profiles
    set active_session_id = null,
        active_session_at = null
    where active_session_id = p_session_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

-- ── Llaves y constraints ──
alter table public."tenants" add constraint "tenants_pkey" PRIMARY KEY (id);
alter table public."aba_sessions_v2" add constraint "aba_sessions_v2_pkey" PRIMARY KEY (id);
alter table public."abc_observations" add constraint "abc_observations_pkey" PRIMARY KEY (id);
alter table public."agenda_sesiones" add constraint "agenda_sesiones_pkey" PRIMARY KEY (id);
alter table public."agente_acciones" add constraint "agente_acciones_pkey" PRIMARY KEY (id);
alter table public."agente_alertas" add constraint "agente_alertas_pkey" PRIMARY KEY (id);
alter table public."anamnesis_completa" add constraint "anamnesis_completa_pkey" PRIMARY KEY (id);
alter table public."alertas_seguridad" add constraint "alertas_seguridad_pkey" PRIMARY KEY (id);
alter table public."behavioral_goals" add constraint "behavioral_goals_pkey" PRIMARY KEY (id);
alter table public."chat_especialista_admin" add constraint "chat_especialista_admin_pkey" PRIMARY KEY (id);
alter table public."cambios_fase_aba" add constraint "cambios_fase_aba_pkey" PRIMARY KEY (id);
alter table public."centro_instrucciones" add constraint "centro_instrucciones_pkey" PRIMARY KEY (id);
alter table public."audit_log" add constraint "audit_log_pkey" PRIMARY KEY (id);
alter table public."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY (id);
alter table public."benchmark_snapshots" add constraint "benchmark_snapshots_pkey" PRIMARY KEY (id);
alter table public."chat_familias" add constraint "chat_familias_pkey" PRIMARY KEY (id);
alter table public."chat_padres" add constraint "chat_padres_pkey" PRIMARY KEY (id);
alter table public."clinical_templates" add constraint "clinical_templates_pkey" PRIMARY KEY (id);
alter table public."clinical_template_responses" add constraint "clinical_template_responses_pkey" PRIMARY KEY (id);
alter table public."engagement_actividades" add constraint "engagement_actividades_pkey" PRIMARY KEY (id);
alter table public."engagement_planes" add constraint "engagement_planes_pkey" PRIMARY KEY (id);
alter table public."evaluacion_ados2" add constraint "evaluacion_ados2_pkey" PRIMARY KEY (id);
alter table public."evaluacion_basc3" add constraint "evaluacion_basc3_pkey" PRIMARY KEY (id);
alter table public."evaluacion_brief2" add constraint "evaluacion_brief2_pkey" PRIMARY KEY (id);
alter table public."evaluacion_cdi2" add constraint "evaluacion_cdi2_pkey" PRIMARY KEY (id);
alter table public."evaluacion_celf5" add constraint "evaluacion_celf5_pkey" PRIMARY KEY (id);
alter table public."evaluacion_conners3" add constraint "evaluacion_conners3_pkey" PRIMARY KEY (id);
alter table public."evaluacion_masc2" add constraint "evaluacion_masc2_pkey" PRIMARY KEY (id);
alter table public."evaluacion_snapiv" add constraint "evaluacion_snapiv_pkey" PRIMARY KEY (id);
alter table public."evaluacion_vineland3" add constraint "evaluacion_vineland3_pkey" PRIMARY KEY (id);
alter table public."facturas" add constraint "facturas_pkey" PRIMARY KEY (id);
alter table public."goal_progress" add constraint "goal_progress_pkey" PRIMARY KEY (id);
alter table public."form_responses" add constraint "form_responses_pkey" PRIMARY KEY (id);
alter table public."informed_consents" add constraint "informed_consents_pkey" PRIMARY KEY (id);
alter table public."knowledge_documents" add constraint "knowledge_documents_pkey" PRIMARY KEY (id);
alter table public."knowledge_chunks" add constraint "knowledge_chunks_pkey" PRIMARY KEY (id);
alter table public."form_ai_analyses" add constraint "form_ai_analyses_pkey" PRIMARY KEY (id);
alter table public."objetivos_cp" add constraint "objetivos_cp_pkey" PRIMARY KEY (id);
alter table public."objetivos_adaptativos" add constraint "objetivos_adaptativos_pkey" PRIMARY KEY (id);
alter table public."parent_accounts" add constraint "parent_accounts_pkey" PRIMARY KEY (id);
alter table public."parent_forms" add constraint "parent_forms_pkey" PRIMARY KEY (id);
alter table public."metricas_diarias" add constraint "metricas_diarias_pkey" PRIMARY KEY (id);
alter table public."mensajes_familia" add constraint "mensajes_familia_pkey" PRIMARY KEY (id);
alter table public."parent_message_approvals" add constraint "parent_message_approvals_pkey" PRIMARY KEY (id);
alter table public."parent_resources" add constraint "parent_resources_pkey" PRIMARY KEY (id);
alter table public."parent_session_logs" add constraint "parent_session_logs_pkey" PRIMARY KEY (id);
alter table public."patrones_detectados" add constraint "patrones_detectados_pkey" PRIMARY KEY (id);
alter table public."predicciones_ia" add constraint "predicciones_ia_pkey" PRIMARY KEY (id);
alter table public."payments" add constraint "payments_pkey" PRIMARY KEY (id);
alter table public."patient_documents" add constraint "patient_documents_pkey" PRIMARY KEY (id);
alter table public."programa_practica_casa" add constraint "programa_practica_casa_pkey" PRIMARY KEY (id);
alter table public."programas_aba" add constraint "programas_aba_pkey" PRIMARY KEY (id);
alter table public."reinforcement_data" add constraint "reinforcement_data_pkey" PRIMARY KEY (id);
alter table public."registro_aba" add constraint "registro_aba_pkey" PRIMARY KEY (id);
alter table public."registro_entorno_hogar" add constraint "registro_entorno_hogar_pkey" PRIMARY KEY (id);
alter table public."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY (id);
alter table public."recursos_padres" add constraint "recursos_padres_pkey" PRIMARY KEY (id);
alter table public."reportes_generados" add constraint "reportes_generados_pkey" PRIMARY KEY (id);
alter table public."reportes_padres" add constraint "reportes_padres_pkey" PRIMARY KEY (id);
alter table public."reportes_seguros" add constraint "reportes_seguros_pkey" PRIMARY KEY (id);
alter table public."session_goals_data" add constraint "session_goals_data_pkey" PRIMARY KEY (id);
alter table public."sesiones_datos_aba" add constraint "sesiones_datos_aba_pkey" PRIMARY KEY (id);
alter table public."service_rates" add constraint "service_rates_pkey" PRIMARY KEY (id);
alter table public."role_changes_log" add constraint "role_changes_log_pkey" PRIMARY KEY (id);
alter table public."session_types" add constraint "session_types_pkey" PRIMARY KEY (id);
alter table public."specialist_submissions" add constraint "specialist_submissions_pkey" PRIMARY KEY (id);
alter table public."store_products" add constraint "store_products_pkey" PRIMARY KEY (id);
alter table public."store_order_items" add constraint "store_order_items_pkey" PRIMARY KEY (id);
alter table public."store_orders" add constraint "store_orders_pkey" PRIMARY KEY (id);
alter table public."tareas_hogar" add constraint "tareas_hogar_pkey" PRIMARY KEY (id);
alter table public."sugerencias_terapeutas" add constraint "sugerencias_terapeutas_pkey" PRIMARY KEY (id);
alter table public."conocimiento_clinico" add constraint "conocimiento_clinico_pkey" PRIMARY KEY (id);
alter table public."children" add constraint "children_pkey" PRIMARY KEY (id);
alter table public."appointments" add constraint "appointments_pkey" PRIMARY KEY (id);
alter table public."notifications" add constraint "notifications_pkey" PRIMARY KEY (id);
alter table public."evaluacion_wiscv" add constraint "evaluacion_wiscv_pkey" PRIMARY KEY (id);
alter table public."notificaciones" add constraint "notificaciones_pkey" PRIMARY KEY (id);
alter table public."agente_conversaciones" add constraint "agente_conversaciones_pkey" PRIMARY KEY (id);
alter table public."user_roles" add constraint "user_roles_pkey" PRIMARY KEY (id);
alter table public."weekly_progress_notes" add constraint "weekly_progress_notes_pkey" PRIMARY KEY (id);
alter table public."wsp_sessions" add constraint "wsp_sessions_pkey" PRIMARY KEY (key);
alter table public."reinforcers" add constraint "reinforcers_pkey" PRIMARY KEY (id);
alter table public."token_transactions" add constraint "token_transactions_pkey" PRIMARY KEY (id);
alter table public."video_models" add constraint "video_models_pkey" PRIMARY KEY (id);
alter table public."video_assignments" add constraint "video_assignments_pkey" PRIMARY KEY (id);
alter table public."video_sessions" add constraint "video_sessions_pkey" PRIMARY KEY (id);
alter table public."profiles" add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public."fonema_imagenes" add constraint "fonema_imagenes_pkey" PRIMARY KEY (id);
alter table public."booking_config" add constraint "booking_config_pkey" PRIMARY KEY (id);
alter table public."booking_links" add constraint "booking_links_pkey" PRIMARY KEY (id);
alter table public."fonema_ayuda" add constraint "fonema_ayuda_pkey" PRIMARY KEY (fonema_id);
alter table public."evaluacion_abllsr" add constraint "evaluacion_abllsr_pkey" PRIMARY KEY (id);
alter table public."evaluacion_servicios_catalogo" add constraint "evaluacion_servicios_catalogo_pkey" PRIMARY KEY (id);
alter table public."evaluaciones_iniciales" add constraint "evaluaciones_iniciales_pkey" PRIMARY KEY (id);
alter table public."evaluacion_servicios" add constraint "evaluacion_servicios_pkey" PRIMARY KEY (id);
alter table public."app_settings" add constraint "app_settings_pkey" PRIMARY KEY (id);
alter table public."error_logs" add constraint "error_logs_pkey" PRIMARY KEY (id);
alter table public."terapias_catalogo" add constraint "terapias_catalogo_pkey" PRIMARY KEY (id);
alter table public."blog_posts" add constraint "blog_posts_pkey" PRIMARY KEY (id);
alter table public."aria_usage" add constraint "aria_usage_pkey" PRIMARY KEY (rl_key);
alter table public."documentos_emitidos" add constraint "documentos_emitidos_pkey" PRIMARY KEY (codigo_doc);
alter table public."blog_posts" add constraint "blog_posts_slug_key" UNIQUE (slug);
alter table public."booking_links" add constraint "booking_links_token_key" UNIQUE (token);
alter table public."children" add constraint "children_sessions_before_platform_nonneg" CHECK ((sessions_before_platform >= 0));
alter table public."app_settings" add constraint "app_settings_singleton" CHECK ((id = 1));
alter table public."payments" add constraint "fk_pay_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."payments" add constraint "fk_pay_created_by" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public."evaluacion_servicios" add constraint "evaluacion_servicios_evaluacion_id_fkey" FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones_iniciales(id) ON DELETE CASCADE;
alter table public."patient_documents" add constraint "fk_pd_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."patient_documents" add constraint "fk_pd_uploaded_by" FOREIGN KEY (uploaded_by) REFERENCES profiles(id);
alter table public."evaluacion_wiscv" add constraint "fk_wiscv_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."programa_practica_casa" add constraint "fk_ppc_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."programa_practica_casa" add constraint "fk_ppc_objetivo" FOREIGN KEY (objetivo_id) REFERENCES objetivos_cp(id);
alter table public."programa_practica_casa" add constraint "fk_ppc_programa" FOREIGN KEY (programa_id) REFERENCES programas_aba(id);
alter table public."notificaciones" add constraint "fk_notif_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."programas_aba" add constraint "fk_prog_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."booking_links" add constraint "booking_links_specialist_id_fkey" FOREIGN KEY (specialist_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."reinforcement_data" add constraint "fk_rd_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."reinforcement_data" add constraint "fk_rd_session" FOREIGN KEY (session_id) REFERENCES aba_sessions_v2(id);
alter table public."agente_conversaciones" add constraint "fk_agente_conv_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."aba_sessions_v2" add constraint "fk_aba_sessions_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."aba_sessions_v2" add constraint "fk_aba_sessions_professional" FOREIGN KEY (professional_id) REFERENCES profiles(id);
alter table public."aba_sessions_v2" add constraint "fk_aba_sessions_session_type" FOREIGN KEY (session_type_id) REFERENCES session_types(id);
alter table public."aba_sessions_v2" add constraint "fk_aba_sessions_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
alter table public."documentos_emitidos" add constraint "documentos_emitidos_generado_por_fkey" FOREIGN KEY (generado_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."abc_observations" add constraint "fk_abc_obs_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."abc_observations" add constraint "fk_abc_obs_session" FOREIGN KEY (session_id) REFERENCES aba_sessions_v2(id);
alter table public."abc_observations" add constraint "fk_abc_obs_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
alter table public."evaluacion_abllsr" add constraint "evaluacion_abllsr_child_id_fkey" FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
alter table public."agenda_sesiones" add constraint "fk_agenda_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."evaluacion_abllsr" add constraint "evaluacion_abllsr_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table public."agente_acciones" add constraint "fk_agente_acc_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."agente_acciones" add constraint "fk_agente_acc_conversacion" FOREIGN KEY (conversacion_id) REFERENCES agente_conversaciones(id);
alter table public."reportes_generados" add constraint "fk_rg_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."agente_alertas" add constraint "fk_agente_alertas_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."agente_alertas" add constraint "fk_agente_alertas_programa" FOREIGN KEY (programa_id) REFERENCES programas_aba(id);
alter table public."reinforcers" add constraint "fk_reinf_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."reportes_padres" add constraint "fk_rp_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."documentos_emitidos" add constraint "documentos_emitidos_child_id_fkey" FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL;
alter table public."behavioral_goals" add constraint "fk_bg_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."behavioral_goals" add constraint "fk_bg_created_by" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public."behavioral_goals" add constraint "fk_bg_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
alter table public."reportes_seguros" add constraint "fk_rs_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."chat_especialista_admin" add constraint "fk_chat_esp_recipient" FOREIGN KEY (recipient_id) REFERENCES profiles(id);
alter table public."chat_especialista_admin" add constraint "fk_chat_esp_sender" FOREIGN KEY (sender_id) REFERENCES profiles(id);
alter table public."token_transactions" add constraint "fk_tt_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."cambios_fase_aba" add constraint "fk_cambios_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."cambios_fase_aba" add constraint "fk_cambios_programa" FOREIGN KEY (programa_id) REFERENCES programas_aba(id);
alter table public."session_goals_data" add constraint "fk_sgd_goal" FOREIGN KEY (goal_id) REFERENCES behavioral_goals(id);
alter table public."session_goals_data" add constraint "fk_sgd_session" FOREIGN KEY (session_id) REFERENCES aba_sessions_v2(id);
alter table public."token_transactions" add constraint "fk_tt_session" FOREIGN KEY (session_id) REFERENCES registro_aba(id);
alter table public."sesiones_datos_aba" add constraint "fk_sda_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."sesiones_datos_aba" add constraint "fk_sda_objetivo" FOREIGN KEY (objetivo_cp_id) REFERENCES objetivos_cp(id);
alter table public."chat_familias" add constraint "fk_chat_fam_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."sesiones_datos_aba" add constraint "fk_sda_programa" FOREIGN KEY (programa_id) REFERENCES programas_aba(id);
alter table public."chat_padres" add constraint "fk_chat_padres_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."clinical_templates" add constraint "fk_ct_created_by" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public."evaluaciones_iniciales" add constraint "evaluaciones_iniciales_child_id_fkey" FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE;
alter table public."clinical_template_responses" add constraint "fk_ctr_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."clinical_template_responses" add constraint "fk_ctr_filled_by" FOREIGN KEY (filled_by) REFERENCES profiles(id);
alter table public."clinical_template_responses" add constraint "fk_ctr_template" FOREIGN KEY (template_id) REFERENCES clinical_templates(id);
alter table public."video_assignments" add constraint "fk_va_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."engagement_actividades" add constraint "fk_eng_act_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."engagement_actividades" add constraint "fk_eng_act_plan" FOREIGN KEY (plan_id) REFERENCES engagement_planes(id);
alter table public."session_types" add constraint "fk_st_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
alter table public."engagement_planes" add constraint "fk_eng_planes_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."video_assignments" add constraint "fk_va_video" FOREIGN KEY (video_id) REFERENCES video_models(id);
alter table public."evaluacion_ados2" add constraint "fk_ados2_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."specialist_submissions" add constraint "fk_ss_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."evaluacion_basc3" add constraint "fk_basc3_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."specialist_submissions" add constraint "fk_ss_specialist" FOREIGN KEY (specialist_id) REFERENCES profiles(id);
alter table public."evaluacion_brief2" add constraint "fk_brief2_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."evaluaciones_iniciales" add constraint "evaluaciones_iniciales_especialista_asignado_id_fkey" FOREIGN KEY (especialista_asignado_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."evaluacion_cdi2" add constraint "fk_cdi2_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."video_sessions" add constraint "fk_vs_appointment" FOREIGN KEY (appointment_id) REFERENCES appointments(id);
alter table public."evaluacion_celf5" add constraint "fk_celf5_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."store_order_items" add constraint "fk_soi_order" FOREIGN KEY (order_id) REFERENCES store_orders(id);
alter table public."evaluacion_conners3" add constraint "fk_conners3_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."store_order_items" add constraint "fk_soi_product" FOREIGN KEY (product_id) REFERENCES store_products(id);
alter table public."evaluacion_masc2" add constraint "fk_masc2_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."video_sessions" add constraint "fk_vs_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."evaluacion_snapiv" add constraint "fk_snapiv_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."store_orders" add constraint "fk_so_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."evaluacion_vineland3" add constraint "fk_vineland3_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."evaluaciones_iniciales" add constraint "evaluaciones_iniciales_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."facturas" add constraint "fk_facturas_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."goal_progress" add constraint "fk_gp_goal" FOREIGN KEY (goal_id) REFERENCES behavioral_goals(id);
alter table public."goal_progress" add constraint "fk_gp_session" FOREIGN KEY (session_id) REFERENCES registro_aba(id);
alter table public."tareas_hogar" add constraint "fk_th_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."form_responses" add constraint "fk_form_resp_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."tareas_hogar" add constraint "fk_th_sesion" FOREIGN KEY (sesion_id) REFERENCES agenda_sesiones(id);
alter table public."informed_consents" add constraint "fk_ic_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."sugerencias_terapeutas" add constraint "fk_sug_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."knowledge_chunks" add constraint "fk_kc_document" FOREIGN KEY (document_id) REFERENCES knowledge_documents(id);
alter table public."evaluaciones_iniciales" add constraint "evaluaciones_iniciales_respondido_por_fkey" FOREIGN KEY (respondido_por) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."evaluaciones_iniciales" add constraint "fk_eval_inicial_servicio" FOREIGN KEY (servicio_seleccionado_id) REFERENCES evaluacion_servicios(id) ON DELETE SET NULL;
alter table public."objetivos_cp" add constraint "fk_obj_cp_programa" FOREIGN KEY (programa_id) REFERENCES programas_aba(id);
alter table public."booking_config" add constraint "booking_config_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."objetivos_adaptativos" add constraint "fk_obj_adap_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."parent_accounts" add constraint "fk_pa_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."children" add constraint "children_specialist_id_fkey" FOREIGN KEY (specialist_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public."parent_forms" add constraint "fk_pf_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."parent_forms" add constraint "fk_pf_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."children" add constraint "fk_children_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."children" add constraint "fk_children_tenant" FOREIGN KEY (tenant_id) REFERENCES tenants(id);
alter table public."mensajes_familia" add constraint "fk_mf_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."booking_links" add constraint "booking_links_child_id_fkey" FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE SET NULL;
alter table public."parent_message_approvals" add constraint "fk_pma_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."parent_message_approvals" add constraint "fk_pma_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."appointments" add constraint "fk_appointments_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."parent_resources" add constraint "fk_pr_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."parent_resources" add constraint "fk_pr_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."appointments" add constraint "fk_appointments_created_by" FOREIGN KEY (created_by) REFERENCES profiles(id);
alter table public."parent_session_logs" add constraint "fk_psl_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."appointments" add constraint "fk_appointments_parent" FOREIGN KEY (parent_id) REFERENCES profiles(id);
alter table public."notifications" add constraint "fk_notifs_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."patrones_detectados" add constraint "fk_pat_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."predicciones_ia" add constraint "fk_pred_child" FOREIGN KEY (child_id) REFERENCES children(id);
alter table public."booking_links" add constraint "booking_links_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public."payments" add constraint "fk_pay_appointment" FOREIGN KEY (appointment_id) REFERENCES appointments(id);

-- ── Índices ──
create index if not exists idx_booking_links_token ON public.booking_links USING btree (token);
create index if not exists idx_booking_links_child ON public.booking_links USING btree (child_id);
create index if not exists idx_documentos_emitidos_fecha ON public.documentos_emitidos USING btree (fecha_emision DESC);
create index if not exists idx_documentos_emitidos_child ON public.documentos_emitidos USING btree (child_id);
create index if not exists idx_documentos_emitidos_tipo ON public.documentos_emitidos USING btree (tipo);
create index if not exists idx_error_logs_created ON public.error_logs USING btree (created_at DESC);
create index if not exists idx_evaluacion_abllsr_child ON public.evaluacion_abllsr USING btree (child_id);
create index if not exists idx_eval_serv_evaluacion ON public.evaluacion_servicios USING btree (evaluacion_id);
create index if not exists idx_eval_inicial_parent ON public.evaluaciones_iniciales USING btree (parent_id);
create index if not exists idx_eval_inicial_child ON public.evaluaciones_iniciales USING btree (child_id);
create index if not exists idx_eval_inicial_estado ON public.evaluaciones_iniciales USING btree (estado);
create index if not exists idx_fonema_imagenes_fonema ON public.fonema_imagenes USING btree (fonema_id);
create index if not exists knowledge_chunks_embedding_idx ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
create index if not exists idx_knowledge_embedding ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists='100');
create index if not exists idx_patient_documents_extraction_status ON public.patient_documents USING btree (extraction_status);
create index if not exists idx_profiles_active_session_id ON public.profiles USING btree (active_session_id);
create index if not exists idx_terapias_categoria ON public.terapias_catalogo USING btree (categoria);
create index if not exists idx_terapias_activo ON public.terapias_catalogo USING btree (activo);

-- ── RLS (Row Level Security) ──
alter table public."aba_sessions_v2" enable row level security;
alter table public."abc_observations" enable row level security;
alter table public."agenda_sesiones" enable row level security;
alter table public."alertas_seguridad" enable row level security;
alter table public."anamnesis_completa" enable row level security;
alter table public."app_settings" enable row level security;
alter table public."appointments" enable row level security;
alter table public."aria_usage" enable row level security;
alter table public."audit_log" enable row level security;
alter table public."audit_logs" enable row level security;
alter table public."behavioral_goals" enable row level security;
alter table public."benchmark_snapshots" enable row level security;
alter table public."blog_posts" enable row level security;
alter table public."booking_config" enable row level security;
alter table public."booking_links" enable row level security;
alter table public."cambios_fase_aba" enable row level security;
alter table public."centro_instrucciones" enable row level security;
alter table public."chat_especialista_admin" enable row level security;
alter table public."chat_familias" enable row level security;
alter table public."chat_padres" enable row level security;
alter table public."children" enable row level security;
alter table public."clinical_template_responses" enable row level security;
alter table public."clinical_templates" enable row level security;
alter table public."conocimiento_clinico" enable row level security;
alter table public."documentos_emitidos" enable row level security;
alter table public."engagement_actividades" enable row level security;
alter table public."engagement_planes" enable row level security;
alter table public."error_logs" enable row level security;
alter table public."evaluacion_abllsr" enable row level security;
alter table public."evaluacion_ados2" enable row level security;
alter table public."evaluacion_basc3" enable row level security;
alter table public."evaluacion_brief2" enable row level security;
alter table public."evaluacion_cdi2" enable row level security;
alter table public."evaluacion_celf5" enable row level security;
alter table public."evaluacion_conners3" enable row level security;
alter table public."evaluacion_masc2" enable row level security;
alter table public."evaluacion_servicios" enable row level security;
alter table public."evaluacion_servicios_catalogo" enable row level security;
alter table public."evaluacion_snapiv" enable row level security;
alter table public."evaluacion_vineland3" enable row level security;
alter table public."evaluacion_wiscv" enable row level security;
alter table public."evaluaciones_iniciales" enable row level security;
alter table public."facturas" enable row level security;
alter table public."fonema_ayuda" enable row level security;
alter table public."fonema_imagenes" enable row level security;
alter table public."form_responses" enable row level security;
alter table public."goal_progress" enable row level security;
alter table public."informed_consents" enable row level security;
alter table public."knowledge_chunks" enable row level security;
alter table public."knowledge_documents" enable row level security;
alter table public."mensajes_familia" enable row level security;
alter table public."notificaciones" enable row level security;
alter table public."notifications" enable row level security;
alter table public."objetivos_adaptativos" enable row level security;
alter table public."objetivos_cp" enable row level security;
alter table public."parent_accounts" enable row level security;
alter table public."parent_forms" enable row level security;
alter table public."parent_message_approvals" enable row level security;
alter table public."parent_resources" enable row level security;
alter table public."parent_session_logs" enable row level security;
alter table public."patient_documents" enable row level security;
alter table public."patrones_detectados" enable row level security;
alter table public."payments" enable row level security;
alter table public."predicciones_ia" enable row level security;
alter table public."profiles" enable row level security;
alter table public."programa_practica_casa" enable row level security;
alter table public."programas_aba" enable row level security;
alter table public."push_subscriptions" enable row level security;
alter table public."registro_aba" enable row level security;
alter table public."registro_entorno_hogar" enable row level security;
alter table public."reinforcers" enable row level security;
alter table public."reportes_generados" enable row level security;
alter table public."reportes_padres" enable row level security;
alter table public."reportes_seguros" enable row level security;
alter table public."service_rates" enable row level security;
alter table public."sesiones_datos_aba" enable row level security;
alter table public."session_goals_data" enable row level security;
alter table public."specialist_submissions" enable row level security;
alter table public."store_order_items" enable row level security;
alter table public."store_orders" enable row level security;
alter table public."store_products" enable row level security;
alter table public."sugerencias_terapeutas" enable row level security;
alter table public."tareas_hogar" enable row level security;
alter table public."terapias_catalogo" enable row level security;
alter table public."token_transactions" enable row level security;
alter table public."video_assignments" enable row level security;
alter table public."video_models" enable row level security;
alter table public."video_sessions" enable row level security;

-- ── Políticas ──
create policy "allow_all_aba_sessions_v2" on public."aba_sessions_v2" as permissive for all to public using (true) with check (true);
create policy "allow_all_abc_observations" on public."abc_observations" as permissive for all to public using (true) with check (true);
create policy "agenda_sesiones_rw" on public."agenda_sesiones" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_agenda_sesiones" on public."agenda_sesiones" as permissive for all to public using (true) with check (true);
create policy "allow_all_agente_acciones" on public."agente_acciones" as permissive for all to public using (true) with check (true);
create policy "allow_all_agente_alertas" on public."agente_alertas" as permissive for all to public using (true) with check (true);
create policy "allow_all_agente_conversaciones" on public."agente_conversaciones" as permissive for all to public using (true) with check (true);
create policy "allow_all_alertas_seguridad" on public."alertas_seguridad" as permissive for all to public using (true) with check (true);
create policy "allow_all_anamnesis_completa" on public."anamnesis_completa" as permissive for all to public using (true) with check (true);
create policy "anamnesis_completa_rw" on public."anamnesis_completa" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "Usuarios ven sus citas" on public."appointments" as permissive for all to public using (((auth.uid() = parent_id) OR (auth.uid() = specialist_id) OR (auth.uid() = created_by)));
create policy "allow_all_appointments" on public."appointments" as permissive for all to public using (true) with check (true);
create policy "appointments_rw" on public."appointments" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_audit_log" on public."audit_log" as permissive for all to public using (true) with check (true);
create policy "allow_all_audit_logs" on public."audit_logs" as permissive for all to public using (true) with check (true);
create policy "allow_all_behavioral_goals" on public."behavioral_goals" as permissive for all to public using (true) with check (true);
create policy "allow_all_benchmark_snapshots" on public."benchmark_snapshots" as permissive for all to public using (true) with check (true);
create policy "Admins can do everything" on public."blog_posts" as permissive for all to public using ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'admin'::text)))));
create policy "Public can read published posts" on public."blog_posts" as permissive for select to public using ((is_published = true));
create policy "booking_config_select" on public."booking_config" as permissive for select to "authenticated" using (true);
create policy "booking_config_write" on public."booking_config" as permissive for all to "authenticated" using (is_staff()) with check (is_staff());
create policy "booking_links_select" on public."booking_links" as permissive for select to "authenticated" using (true);
create policy "booking_links_write" on public."booking_links" as permissive for all to "authenticated" using (is_staff()) with check (is_staff());
create policy "allow_all_cambios_fase_aba" on public."cambios_fase_aba" as permissive for all to public using (true) with check (true);
create policy "cambios_fase_aba_rw" on public."cambios_fase_aba" as permissive for all to "authenticated" using ((is_staff() OR (EXISTS ( SELECT 1
   FROM programas_aba p
  WHERE ((p.id = cambios_fase_aba.programa_id) AND is_parent_of(p.child_id)))))) with check ((is_staff() OR (EXISTS ( SELECT 1
   FROM programas_aba p
  WHERE ((p.id = cambios_fase_aba.programa_id) AND is_parent_of(p.child_id))))));
create policy "allow_all_centro_instrucciones" on public."centro_instrucciones" as permissive for all to public using (true) with check (true);
create policy "allow_all_chat_especialista_admin" on public."chat_especialista_admin" as permissive for all to public using (true) with check (true);
create policy "allow_all_chat_familias" on public."chat_familias" as permissive for all to public using (true) with check (true);
create policy "allow_all_chat_padres" on public."chat_padres" as permissive for all to public using (true) with check (true);
create policy "Padres ven sus hijos" on public."children" as permissive for all to public using ((auth.uid() = parent_id));
create policy "allow_all_children" on public."children" as permissive for all to public using (true) with check (true);
create policy "children_delete" on public."children" as permissive for delete to "authenticated" using (is_admin());
create policy "children_insert" on public."children" as permissive for insert to "authenticated" with check (((parent_id = auth.uid()) OR is_staff()));
create policy "children_select" on public."children" as permissive for select to "authenticated" using (((parent_id = auth.uid()) OR is_staff()));
create policy "children_update" on public."children" as permissive for update to "authenticated" using (((parent_id = auth.uid()) OR is_staff())) with check (((parent_id = auth.uid()) OR is_staff()));
create policy "allow_all_clinical_template_responses" on public."clinical_template_responses" as permissive for all to public using (true) with check (true);
create policy "allow_all_clinical_templates" on public."clinical_templates" as permissive for all to public using (true) with check (true);
create policy "allow_all_conocimiento_clinico" on public."conocimiento_clinico" as permissive for all to public using (true) with check (true);
create policy "documentos_emitidos_public_verify" on public."documentos_emitidos" as permissive for select to "anon", "authenticated" using (true);
create policy "documentos_emitidos_write_del" on public."documentos_emitidos" as permissive for delete to "authenticated" using (is_staff());
create policy "documentos_emitidos_write_ins" on public."documentos_emitidos" as permissive for insert to "authenticated" with check (is_staff());
create policy "documentos_emitidos_write_upd" on public."documentos_emitidos" as permissive for update to "authenticated" using (is_staff()) with check (is_staff());
create policy "verificacion publica" on public."documentos_emitidos" as permissive for select to public using (true);
create policy "allow_all_engagement_actividades" on public."engagement_actividades" as permissive for all to public using (true) with check (true);
create policy "allow_all_engagement_planes" on public."engagement_planes" as permissive for all to public using (true) with check (true);
create policy "Admins can manage ablls evaluations" on public."evaluacion_abllsr" as permissive for all to public using ((auth.uid() IN ( SELECT user_roles.user_id
   FROM user_roles
  WHERE (user_roles.rol = ANY (ARRAY['admin'::text, 'especialista'::text])))));
create policy "allow_all_evaluacion_ados2" on public."evaluacion_ados2" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_basc3" on public."evaluacion_basc3" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_brief2" on public."evaluacion_brief2" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_cdi2" on public."evaluacion_cdi2" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_celf5" on public."evaluacion_celf5" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_conners3" on public."evaluacion_conners3" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_masc2" on public."evaluacion_masc2" as permissive for all to public using (true) with check (true);
create policy "evaluacion_servicios_rw" on public."evaluacion_servicios" as permissive for all to "authenticated" using ((is_staff() OR (EXISTS ( SELECT 1
   FROM evaluaciones_iniciales e
  WHERE ((e.id = evaluacion_servicios.evaluacion_id) AND ((e.parent_id = auth.uid()) OR is_parent_of(e.child_id))))))) with check ((is_staff() OR (EXISTS ( SELECT 1
   FROM evaluaciones_iniciales e
  WHERE ((e.id = evaluacion_servicios.evaluacion_id) AND ((e.parent_id = auth.uid()) OR is_parent_of(e.child_id)))))));
create policy "padre lee servicios de su evaluacion" on public."evaluacion_servicios" as permissive for select to public using ((EXISTS ( SELECT 1
   FROM evaluaciones_iniciales ei
  WHERE ((ei.id = evaluacion_servicios.evaluacion_id) AND ((ei.parent_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM children c
          WHERE ((c.id = ei.child_id) AND (c.parent_id = auth.uid())))))))));
create policy "lectura catalogo autenticado" on public."evaluacion_servicios_catalogo" as permissive for select to public using ((auth.role() = 'authenticated'::text));
create policy "allow_all_evaluacion_snapiv" on public."evaluacion_snapiv" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_vineland3" on public."evaluacion_vineland3" as permissive for all to public using (true) with check (true);
create policy "allow_all_evaluacion_wiscv" on public."evaluacion_wiscv" as permissive for all to public using (true) with check (true);
create policy "evaluaciones_iniciales_rw" on public."evaluaciones_iniciales" as permissive for all to "authenticated" using ((is_staff() OR (parent_id = auth.uid()) OR is_parent_of(child_id))) with check ((is_staff() OR (parent_id = auth.uid()) OR is_parent_of(child_id)));
create policy "padre lee su evaluacion" on public."evaluaciones_iniciales" as permissive for select to public using (((parent_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM children c
  WHERE ((c.id = evaluaciones_iniciales.child_id) AND (c.parent_id = auth.uid()))))));
create policy "allow_all_facturas" on public."facturas" as permissive for all to public using (true) with check (true);
create policy "allow_all_form_ai_analyses" on public."form_ai_analyses" as permissive for all to public using (true) with check (true);
create policy "allow_all_form_responses" on public."form_responses" as permissive for all to public using (true) with check (true);
create policy "form_responses_rw" on public."form_responses" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_goal_progress" on public."goal_progress" as permissive for all to public using (true) with check (true);
create policy "allow_all_informed_consents" on public."informed_consents" as permissive for all to public using (true) with check (true);
create policy "allow_all_knowledge_chunks" on public."knowledge_chunks" as permissive for all to public using (true) with check (true);
create policy "allow_all_knowledge_documents" on public."knowledge_documents" as permissive for all to public using (true) with check (true);
create policy "allow_all_mensajes_familia" on public."mensajes_familia" as permissive for all to public using (true) with check (true);
create policy "allow_all_metricas_diarias" on public."metricas_diarias" as permissive for all to public using (true) with check (true);
create policy "Usuarios ven sus notificaciones ESP" on public."notificaciones" as permissive for all to public using ((auth.uid() = user_id));
create policy "allow_all_notificaciones" on public."notificaciones" as permissive for all to public using (true) with check (true);
create policy "Usuarios ven sus notificaciones" on public."notifications" as permissive for all to public using ((auth.uid() = user_id));
create policy "allow_all_notifications" on public."notifications" as permissive for all to public using (true) with check (true);
create policy "notifications_rw" on public."notifications" as permissive for all to "authenticated" using (((user_id = auth.uid()) OR is_staff())) with check (((user_id = auth.uid()) OR is_staff()));
create policy "allow_all_objetivos_adaptativos" on public."objetivos_adaptativos" as permissive for all to public using (true) with check (true);
create policy "objetivos_adaptativos_rw" on public."objetivos_adaptativos" as permissive for all to "authenticated" using (is_staff()) with check (is_staff());
create policy "allow_all_objetivos_cp" on public."objetivos_cp" as permissive for all to public using (true) with check (true);
create policy "objetivos_cp_rw" on public."objetivos_cp" as permissive for all to "authenticated" using ((is_staff() OR (EXISTS ( SELECT 1
   FROM programas_aba p
  WHERE ((p.id = objetivos_cp.programa_id) AND is_parent_of(p.child_id)))))) with check ((is_staff() OR (EXISTS ( SELECT 1
   FROM programas_aba p
  WHERE ((p.id = objetivos_cp.programa_id) AND is_parent_of(p.child_id))))));
create policy "allow_all_parent_accounts" on public."parent_accounts" as permissive for all to public using (true) with check (true);
create policy "allow_all_parent_forms" on public."parent_forms" as permissive for all to public using (true) with check (true);
create policy "allow_all_parent_message_approvals" on public."parent_message_approvals" as permissive for all to public using (true) with check (true);
create policy "allow_all_parent_resources" on public."parent_resources" as permissive for all to public using (true) with check (true);
create policy "allow_all_parent_session_logs" on public."parent_session_logs" as permissive for all to public using (true) with check (true);
create policy "allow_all_patient_documents" on public."patient_documents" as permissive for all to public using (true) with check (true);
create policy "patient_documents_rw" on public."patient_documents" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_patrones_detectados" on public."patrones_detectados" as permissive for all to public using (true) with check (true);
create policy "patrones_detectados_rw" on public."patrones_detectados" as permissive for all to "authenticated" using (is_staff()) with check (is_staff());
create policy "allow_all_payments" on public."payments" as permissive for all to public using (true) with check (true);
create policy "allow_all_predicciones_ia" on public."predicciones_ia" as permissive for all to public using (true) with check (true);
create policy "Usuarios ven su propio perfil" on public."profiles" as permissive for all to public using ((auth.uid() = id));
create policy "allow_all_profiles" on public."profiles" as permissive for all to public using (true) with check (true);
create policy "profiles_delete_admin" on public."profiles" as permissive for delete to "authenticated" using (is_admin());
create policy "profiles_insert_self" on public."profiles" as permissive for insert to "authenticated" with check (((id = auth.uid()) OR is_admin()));
create policy "profiles_select_own_or_staff" on public."profiles" as permissive for select to "authenticated" using (((id = auth.uid()) OR is_staff()));
create policy "profiles_update_own_or_admin" on public."profiles" as permissive for update to "authenticated" using (((id = auth.uid()) OR is_admin())) with check (((id = auth.uid()) OR is_admin()));
create policy "allow_all_programa_practica_casa" on public."programa_practica_casa" as permissive for all to public using (true) with check (true);
create policy "allow_all_programas_aba" on public."programas_aba" as permissive for all to public using (true) with check (true);
create policy "programas_aba_rw" on public."programas_aba" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_push_subscriptions" on public."push_subscriptions" as permissive for all to public using (true) with check (true);
create policy "allow_all_recursos_padres" on public."recursos_padres" as permissive for all to public using (true) with check (true);
create policy "allow_all_registro_aba" on public."registro_aba" as permissive for all to public using (true) with check (true);
create policy "registro_aba_rw" on public."registro_aba" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_registro_entorno_hogar" on public."registro_entorno_hogar" as permissive for all to public using (true) with check (true);
create policy "registro_entorno_hogar_rw" on public."registro_entorno_hogar" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_reinforcement_data" on public."reinforcement_data" as permissive for all to public using (true) with check (true);
create policy "allow_all_reinforcers" on public."reinforcers" as permissive for all to public using (true) with check (true);
create policy "allow_all_reportes_generados" on public."reportes_generados" as permissive for all to public using (true) with check (true);
create policy "allow_all_reportes_padres" on public."reportes_padres" as permissive for all to public using (true) with check (true);
create policy "allow_all_reportes_seguros" on public."reportes_seguros" as permissive for all to public using (true) with check (true);
create policy "allow_all_role_changes_log" on public."role_changes_log" as permissive for all to public using (true) with check (true);
create policy "allow_all_service_rates" on public."service_rates" as permissive for all to public using (true) with check (true);
create policy "allow_all_sesiones_datos_aba" on public."sesiones_datos_aba" as permissive for all to public using (true) with check (true);
create policy "sesiones_datos_aba_rw" on public."sesiones_datos_aba" as permissive for all to "authenticated" using ((is_staff() OR is_parent_of(child_id))) with check ((is_staff() OR is_parent_of(child_id)));
create policy "allow_all_session_goals_data" on public."session_goals_data" as permissive for all to public using (true) with check (true);
create policy "allow_all_session_types" on public."session_types" as permissive for all to public using (true) with check (true);
create policy "allow_all_specialist_submissions" on public."specialist_submissions" as permissive for all to public using (true) with check (true);
create policy "allow_all_store_order_items" on public."store_order_items" as permissive for all to public using (true) with check (true);
create policy "allow_all_store_orders" on public."store_orders" as permissive for all to public using (true) with check (true);
create policy "allow_all_store_products" on public."store_products" as permissive for all to public using (true) with check (true);
create policy "allow_all_sugerencias_terapeutas" on public."sugerencias_terapeutas" as permissive for all to public using (true) with check (true);
create policy "sugerencias_terapeutas_rw" on public."sugerencias_terapeutas" as permissive for all to "authenticated" using (is_staff()) with check (is_staff());
create policy "allow_all_tareas_hogar" on public."tareas_hogar" as permissive for all to public using (true) with check (true);
create policy "allow_all_tenants" on public."tenants" as permissive for all to public using (true) with check (true);
create policy "lectura terapias autenticado" on public."terapias_catalogo" as permissive for select to public using (((auth.role() = 'authenticated'::text) AND (activo = true)));
create policy "terapias_catalogo_select" on public."terapias_catalogo" as permissive for select to "authenticated" using (((activo = true) OR is_staff()));
create policy "terapias_catalogo_write_del" on public."terapias_catalogo" as permissive for delete to "authenticated" using (is_staff());
create policy "terapias_catalogo_write_ins" on public."terapias_catalogo" as permissive for insert to "authenticated" with check (is_staff());
create policy "terapias_catalogo_write_upd" on public."terapias_catalogo" as permissive for update to "authenticated" using (is_staff()) with check (is_staff());
create policy "allow_all_token_transactions" on public."token_transactions" as permissive for all to public using (true) with check (true);
create policy "allow_all_user_roles" on public."user_roles" as permissive for all to public using (true) with check (true);
create policy "allow_all_video_assignments" on public."video_assignments" as permissive for all to public using (true) with check (true);
create policy "allow_all_video_models" on public."video_models" as permissive for all to public using (true) with check (true);
create policy "allow_all_video_sessions" on public."video_sessions" as permissive for all to public using (true) with check (true);
create policy "allow_all_weekly_progress_notes" on public."weekly_progress_notes" as permissive for all to public using (true) with check (true);
create policy "allow_all_wsp_sessions" on public."wsp_sessions" as permissive for all to public using (true) with check (true);

-- ── Triggers ──
CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enforce_padre_limit BEFORE INSERT ON public.children FOR EACH ROW EXECUTE FUNCTION enforce_padre_limit();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- AÑADIDOS PARA LA DEMO (no estaban en el original)
-- ════════════════════════════════════════════════════════════════════

-- ── Storage buckets (los archivos: documentos, imágenes, chat) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('chat-files',        'chat-files',        true,  null,      null),
  ('chat-media',        'chat-media',        true,  null,      null),
  ('store-images',      'store-images',      true,  null,      null),
  ('patient-documents', 'patient-documents', true,  null,      null),
  ('blog-covers',       'blog-covers',       true,  null,      null),
  ('public-images',     'public-images',     true,  5242880,   array['image/jpeg','image/png','image/webp','image/gif','image/avif']),
  ('knowledge-base',    'knowledge-base',    false, 104857600, array['application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- ── Control de CENTROS DEMO (columnas extra en profiles) ──
alter table public.profiles
  add column if not exists is_demo         boolean     not null default false,
  add column if not exists demo_active     boolean     not null default true,
  add column if not exists demo_expires_at timestamptz,
  add column if not exists center_name     text;

create index if not exists idx_profiles_is_demo
  on public.profiles (is_demo) where is_demo = true;
