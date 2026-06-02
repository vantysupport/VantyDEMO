'use client'

// Flujo de Evaluación Inicial — vista del PADRE.
// Estados visibles: intake → analizando → recomendación amigable + confirmación
//   → 2ª anamnesis → catálogo de terapias → esperando → respuesta del especialista.
//
// ⚠️ El padre NUNCA ve documentos clínicos internos, ni razonamiento técnico.

import { useEffect, useState } from 'react'
import {
  ClipboardCheck, Sparkles, Loader2, CheckCircle2, Brain, Heart,
  ChevronRight, ChevronLeft, Send, Clock, X, MessageCircle, Image as ImageIcon,
  ThumbsUp, AlertCircle, Star,
} from 'lucide-react'

type Props = { child: any; profile: any }

// Paleta para tarjetas de terapia (debe coincidir con CatalogoTerapiasView del admin)
const TERAPIA_COLORES: Record<string, { gradient: string; accent: string; accentDark: string }> = {
  indigo:   { gradient: 'from-indigo-500 to-blue-500',     accent: '#6366f1', accentDark: '#818cf8' },
  purple:   { gradient: 'from-purple-500 to-fuchsia-500',  accent: '#a855f7', accentDark: '#c084fc' },
  pink:     { gradient: 'from-pink-500 to-rose-500',       accent: '#ec4899', accentDark: '#f472b6' },
  rose:     { gradient: 'from-rose-500 to-red-500',        accent: '#f43f5e', accentDark: '#fb7185' },
  amber:    { gradient: 'from-amber-500 to-orange-500',    accent: '#f59e0b', accentDark: '#fbbf24' },
  emerald:  { gradient: 'from-emerald-500 to-teal-500',    accent: '#10b981', accentDark: '#34d399' },
  cyan:     { gradient: 'from-cyan-500 to-sky-500',        accent: '#06b6d4', accentDark: '#22d3ee' },
  blue:     { gradient: 'from-blue-500 to-indigo-500',     accent: '#3b82f6', accentDark: '#60a5fa' },
  orange:   { gradient: 'from-orange-500 to-red-500',      accent: '#f97316', accentDark: '#fb923c' },
  slate:    { gradient: 'from-slate-600 to-slate-700',     accent: '#64748b', accentDark: '#94a3b8' },
}

type ColumnaTabla = { id: string; label: string; type?: 'text' | 'number' | 'date'; placeholder?: string; options?: string[] }

type Pregunta =
  | { id: string; type: 'text' | 'textarea' | 'number'; label: string; placeholder?: string; required?: boolean }
  | { id: string; type: 'select' | 'radio'; label: string; options: string[]; required?: boolean }
  | { id: string; type: 'checkbox'; label: string; options: string[] }
  | { id: string; type: 'date'; label: string; required?: boolean }
  | { id: string; type: 'tabla_dinamica'; label: string; columns: ColumnaTabla[]; addLabel?: string; minRows?: number; required?: boolean }

type Seccion = { titulo: string; descripcion?: string; icono: string; preguntas: Pregunta[] }

// ─── Primera ficha: INTAKE — "Ficha inicial para papás" ────────────────
// Estructura oficial SANTI: secciones que cubren datos del menor, padres,
// motivo de consulta, historia escolar, diagnósticos, terapias previas,
// dinámica familiar e información final / marketing.
const SECCIONES_INTAKE: Seccion[] = [
  {
    titulo: 'Datos generales del menor', icono: '🧒',
    descripcion: 'Información básica del niño/a a evaluar.',
    preguntas: [
      { id: 'menor_nombre', type: 'text', label: 'Nombres y apellidos del menor', required: true },
      { id: 'menor_edad', type: 'text', label: 'Edad (años y meses)', placeholder: 'Ej: 7 años 3 meses', required: true },
      { id: 'menor_fecha_nacimiento', type: 'date', label: 'Fecha de nacimiento', required: true },
      { id: 'menor_grado', type: 'text', label: 'Grado educativo', placeholder: 'Ej: 2° de primaria' },
      { id: 'menor_institucion', type: 'text', label: 'Institución educativa' },
      { id: 'menor_residencia', type: 'text', label: 'Lugar de residencia (distrito / ciudad)' },
      { id: 'menor_contacto', type: 'text', label: 'Número de contacto', placeholder: 'Indica si es de mamá o papá', required: true },
    ],
  },
  {
    titulo: 'Datos generales de los padres', icono: '👨‍👩‍👧',
    preguntas: [
      { id: 'padre_nombre', type: 'text', label: 'Nombres y apellidos del papá' },
      { id: 'madre_nombre', type: 'text', label: 'Nombres y apellidos de la mamá' },
    ],
  },
  {
    titulo: 'Motivo de consulta', icono: '💬',
    descripcion: 'Cuéntanos en tus palabras qué te trae al centro.',
    preguntas: [
      { id: 'motivo_principal', type: 'textarea', label: '¿Cuál es su principal preocupación? Menciona una o varias.', required: true },
      { id: 'desde_cuando', type: 'radio', label: '¿Desde cuándo notas esta preocupación?', options: ['Menos de 1 mes', '1-3 meses', '3-6 meses', 'Más de 6 meses'], required: true },
      { id: 'como_manejo', type: 'textarea', label: '¿De qué manera lo has manejado? ¿Cómo has tratado de solucionarlo?' },
    ],
  },
  {
    titulo: 'Historia escolar', icono: '🏫',
    preguntas: [
      { id: 'experiencia_escolar', type: 'textarea', label: '¿Cómo ha sido la experiencia escolar de tu hijo/a hasta ahora?' },
      { id: 'rendimiento_academico', type: 'textarea', label: '¿Cómo crees que le va a nivel académico?' },
      { id: 'bullying', type: 'textarea', label: '¿Alguna vez ha sufrido bullying? ¿Algún dato escolar importante que desees mencionar?' },
    ],
  },
  {
    titulo: 'Diagnóstico y/o comorbilidades', icono: '🩺',
    preguntas: [
      { id: 'diagnostico_previo', type: 'textarea', label: '¿Cuenta con algún diagnóstico previo? ¿Cuál?' },
      { id: 'alergias_medicacion', type: 'textarea', label: '¿Cuenta con alergias o está recibiendo alguna medicación?' },
      { id: 'antecedentes_medicos', type: 'textarea', label: '¿Algún antecedente médico del niño/a o de algún familiar que consideres importante?' },
    ],
  },
  {
    titulo: 'Evaluaciones y terapias anteriores', icono: '📋',
    preguntas: [
      { id: 'evaluaciones_previas', type: 'textarea', label: '¿Realizaron evaluaciones anteriores? Si fue así, ¿cuáles fueron los resultados?' },
      { id: 'terapias_previas', type: 'textarea', label: '¿Ha recibido algún tipo de terapia anteriormente (psicología, terapia ocupacional, lenguaje, fisioterapia, etc.)? ¿Cómo le fue?' },
    ],
  },
  {
    titulo: 'Dinámica familiar', icono: '🏠',
    preguntas: [
      { id: 'conflictos_recientes', type: 'textarea', label: '¿Hubo conflictos en la familia o algún cambio fuerte en los últimos 6 meses (separación, mudanza, pérdida de un ser querido)?' },
      { id: 'manejo_conflictos', type: 'textarea', label: '¿Cómo manejan los conflictos en casa?' },
      { id: 'notas_adicionales', type: 'textarea', label: 'Notas adicionales: algo que desees mencionar y que no se haya cubierto en las preguntas anteriores.' },
    ],
  },
  {
    titulo: 'Información final', icono: '✨',
    descripcion: 'Para conocerte mejor.',
    preguntas: [
      { id: 'medio_conocimiento', type: 'select', label: '¿Por cuál medio nos conociste?', options: ['Instagram', 'Tiktok', 'Recomendación', 'Colegio', 'Otros'] },
      { id: 'medio_otros', type: 'text', label: 'Si elegiste "Otros", cuéntanos cuál:', placeholder: 'Ej: Facebook, búsqueda en Google, etc.' },
      { id: 'recibir_contenido', type: 'radio', label: '¿Deseas recibir información, consejos de crianza/familia y contenido sobre nuestros servicios en tu correo?', options: ['Sí', 'No'], required: true },
    ],
  },
]

// ─── Segunda ficha: ANAMNESIS PSICOLÓGICA / EMOCIONAL ───────────────────
// Estructura oficial SANTI — 7 secciones (I a VII).
const SECCIONES_PSICO: Seccion[] = [
  // ─── I. Datos Generales y Familiares ───────────────────────────────────
  {
    titulo: 'I. Datos generales', icono: '🧒',
    descripcion: 'Información básica del niño/a.',
    preguntas: [
      { id: 'menor_nombre', type: 'text', label: 'Apellidos y nombres', required: true },
      { id: 'menor_sexo', type: 'radio', label: 'Sexo', options: ['Femenino', 'Masculino', 'Otro / prefiere no decir'] },
      { id: 'menor_edad', type: 'text', label: 'Edad (años y meses)', placeholder: 'Ej: 7 años 3 meses' },
      { id: 'menor_fecha_nacimiento', type: 'date', label: 'Fecha de nacimiento' },
      { id: 'menor_escolaridad', type: 'text', label: 'Escolaridad / grado', placeholder: 'Ej: 2° de primaria' },
      { id: 'menor_institucion', type: 'text', label: 'Institución educativa' },
      { id: 'menor_direccion', type: 'text', label: 'Dirección' },
      { id: 'menor_residencia', type: 'text', label: 'Lugar de residencia', placeholder: 'Distrito / ciudad' },
      { id: 'menor_tiempo_lima', type: 'text', label: 'Tiempo de residencia en Lima', placeholder: 'Ej: 5 años / siempre' },
      { id: 'menor_celular', type: 'text', label: 'Celular(es) de contacto' },
      { id: 'menor_correo', type: 'text', label: 'Correo(s) electrónico(s) de contacto' },
    ],
  },
  {
    titulo: 'I. Datos familiares', icono: '👨‍👩‍👧',
    descripcion: 'Personas que viven con el niño/a. Podés agregar tantos familiares como necesites.',
    preguntas: [
      { id: 'datos_familiares', type: 'tabla_dinamica', label: 'Familiares que conviven con el niño/a',
        addLabel: '+ Agregar familiar', minRows: 2,
        columns: [
          { id: 'relacion', label: 'Relación', options: ['Madre', 'Padre', 'Hermano/a', 'Abuelo/a', 'Tío/a', 'Otro'] },
          { id: 'nombre', label: 'Nombres y apellidos' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'instruccion', label: 'Grado de instrucción', placeholder: 'Ej: Superior, técnica' },
          { id: 'ocupacion', label: 'Ocupación' },
        ],
      },
    ],
  },

  // ─── II. Motivo de Consulta ────────────────────────────────────────────
  {
    titulo: 'II. Motivo de consulta', icono: '💬',
    descripcion: 'Las principales preocupaciones y su contexto.',
    preguntas: [
      { id: 'preocupaciones', type: 'textarea', label: '¿Cuáles son las preocupaciones principales (conducta, lenguaje, autovalimiento, emocional, etc.)? Describí cada una lo más detalladamente posible.', required: true },
      { id: 'desde_cuando', type: 'textarea', label: '¿Desde cuándo se observan estas conductas?', required: true },
      { id: 'situaciones_frecuentes', type: 'textarea', label: '¿En qué situaciones aparecen con mayor frecuencia?' },
      { id: 'entornos_afectados', type: 'checkbox', label: 'Entornos donde se manifiestan:', options: ['Casa', 'Colegio', 'Relaciones con pares', 'Familia extendida', 'Espacios públicos', 'Otros'] },
      { id: 'intentos_previos', type: 'textarea', label: '¿Qué han intentado para manejarlo? ¿Qué tan efectivo resultó?' },
      { id: 'opinion_profesores', type: 'textarea', label: 'Opinión de los profesores / equipo escolar' },
    ],
  },

  // ─── III. Historia del Desarrollo y Antecedentes ───────────────────────
  {
    titulo: 'III. Historia del desarrollo', icono: '🤰',
    descripcion: 'Embarazo, parto y primeros hitos.',
    preguntas: [
      { id: 'complicaciones_embarazo_parto', type: 'textarea', label: 'Complicaciones durante el embarazo y/o parto' },
      { id: 'hito_sostener_cabeza', type: 'text', label: 'Edad en que sostuvo la cabeza', placeholder: 'Meses' },
      { id: 'hito_sentarse', type: 'text', label: 'Edad en que se sentó solo/a', placeholder: 'Meses' },
      { id: 'hito_gatear', type: 'text', label: 'Edad en que gateó', placeholder: 'Meses' },
      { id: 'hito_caminar', type: 'text', label: 'Edad en que caminó', placeholder: 'Meses' },
      { id: 'hito_hablar', type: 'text', label: 'Edad en que comenzó a hablar', placeholder: 'Meses' },
    ],
  },
  {
    titulo: 'III. Antecedentes médicos y familiares', icono: '🩺',
    preguntas: [
      { id: 'alergias', type: 'textarea', label: '¿Cuenta con alergias? ¿Cuáles?' },
      { id: 'hospitalizaciones', type: 'textarea', label: 'Hospitalizaciones (motivo, edad, duración)' },
      { id: 'medicacion', type: 'textarea', label: '¿Está recibiendo medicación? ¿Cuál y desde cuándo?' },
      { id: 'diagnostico_previo', type: 'textarea', label: 'Diagnósticos previos' },
      { id: 'antecedentes_familiares', type: 'checkbox', label: 'Antecedentes familiares de:', options: ['Salud mental (depresión, ansiedad, etc.)', 'TEA / autismo', 'TDAH', 'Dificultades de aprendizaje', 'Dificultades de habla / lenguaje', 'Epilepsia / convulsiones', 'Discapacidad intelectual', 'Otros', 'Ninguno'] },
      { id: 'antecedentes_detalle', type: 'textarea', label: 'Si marcaste alguno, indicá quién y de qué se trata' },
    ],
  },

  // ─── IV. Historia Escolar ──────────────────────────────────────────────
  {
    titulo: 'IV. Historia escolar', icono: '🏫',
    descripcion: 'Trayectoria y desempeño en el colegio.',
    preguntas: [
      { id: 'edu_edad_inicio', type: 'text', label: 'Edad de inicio escolar', placeholder: 'Años' },
      { id: 'edu_adaptacion', type: 'textarea', label: 'Adaptación en los diferentes niveles educativos (inicial, primaria, secundaria)' },
      { id: 'edu_gustos', type: 'textarea', label: 'Cursos / materias que más le gustan' },
      { id: 'edu_dificultades', type: 'textarea', label: 'Cursos / materias en los que presenta dificultades' },
      { id: 'edu_comentarios_colegio', type: 'textarea', label: 'Comentarios recurrentes del colegio sobre su hijo/a' },
      { id: 'edu_conducta_bullying', type: 'textarea', label: 'Problemas de conducta o bullying (recibido o ejercido)' },
      { id: 'edu_apoyos_previos', type: 'textarea', label: 'Apoyos previos recibidos (refuerzo, terapia psicopedagógica, etc.)' },
    ],
  },

  // ─── V. Áreas Específicas ──────────────────────────────────────────────
  {
    titulo: 'V. Área socioemocional', icono: '❤️',
    preguntas: [
      { id: 'soc_personalidad', type: 'textarea', label: '¿Cómo describirías la personalidad de tu hijo/a?' },
      { id: 'soc_expresion_emociones', type: 'radio', label: '¿Cómo expresa sus emociones?', options: ['Las habla con palabras', 'Las muestra con conducta', 'Se las guarda', 'Depende del momento'] },
      { id: 'soc_factores_frustracion', type: 'textarea', label: '¿Qué situaciones le generan frustración?' },
      { id: 'soc_reaccion_limites', type: 'textarea', label: '¿Cómo reacciona ante los límites o cuando se le dice "no"?' },
      { id: 'soc_autorregulacion', type: 'textarea', label: '¿Qué estrategias usa para calmarse? ¿Lo logra solo/a o necesita ayuda?' },
    ],
  },
  {
    titulo: 'V. Relaciones familiares', icono: '🏡',
    preguntas: [
      { id: 'fam_convivencia', type: 'textarea', label: '¿Cómo es la convivencia en casa?' },
      { id: 'fam_vinculos_afectivos', type: 'textarea', label: 'Vínculos afectivos: ¿con quién es más cercano/a? ¿con quién le cuesta?' },
      { id: 'fam_estilo_disciplina', type: 'radio', label: 'Estilo de disciplina predominante:', options: ['Permisivo', 'Autoritario', 'Negociador / democrático', 'Inconsistente', 'Otro'] },
      { id: 'fam_estrategias_disciplina', type: 'textarea', label: '¿Qué estrategias usan cuando hay un problema de conducta?' },
      { id: 'fam_conflictos', type: 'textarea', label: '¿Hay conflictos familiares actuales que sea importante conocer?' },
    ],
  },
  {
    titulo: 'V. Ámbito social', icono: '🤝',
    preguntas: [
      { id: 'social_amigos', type: 'radio', label: '¿Le es fácil hacer amigos?', options: ['Sí, muy fácil', 'Con algo de esfuerzo', 'Le cuesta', 'Casi no socializa'] },
      { id: 'social_juego_pref', type: 'radio', label: 'Cuando juega, prefiere:', options: ['Estar solo/a', 'Estar en grupo', 'Le es indistinto', 'Depende del momento'] },
      { id: 'social_fuera_colegio', type: 'textarea', label: '¿Cómo es su interacción social fuera del colegio? (familiares, vecinos, actividades extracurriculares)' },
      { id: 'social_manejo_conflictos', type: 'textarea', label: '¿Cómo maneja los conflictos con sus compañeros?' },
    ],
  },
  {
    titulo: 'V. Estado emocional actual', icono: '🌧️',
    descripcion: 'Tu honestidad nos ayuda a cuidar mejor a tu hijo/a.',
    preguntas: [
      { id: 'emo_sintomas', type: 'checkbox', label: 'Marca lo que observas actualmente:', options: ['Tristeza persistente', 'Irritabilidad o enojo frecuente', 'Miedos intensos', 'Cambios en el sueño', 'Cambios en el apetito', 'Pensamientos negativos sobre sí mismo/a', 'Aislamiento social', 'Miedo anticipatorio (a algo que va a pasar)', 'Conductas de riesgo', 'Está bien la mayor parte del tiempo'] },
      { id: 'emo_pensamientos_riesgo', type: 'textarea', label: '¿Ha expresado pensamientos preocupantes (no querer estar, hacerse daño, etc.)? Tu sinceridad nos ayuda a cuidarlo/a mejor.' },
      { id: 'emo_descripcion_general', type: 'textarea', label: '¿Cómo describirías el estado emocional general de tu hijo/a en este momento?' },
    ],
  },

  // ─── VI. Áreas Específicas según Edad ──────────────────────────────────
  {
    titulo: 'VI. Área específica según edad (2–6 años)', icono: '🧸',
    descripcion: 'Completá esta sección si tu hijo/a tiene entre 2 y 6 años. Si no, saltala.',
    preguntas: [
      { id: 'edad26_juego_simbolico', type: 'textarea', label: 'Juego simbólico: ¿juega "de a que es..." (cocinar, ser doctor, etc.)? ¿Con qué frecuencia?' },
      { id: 'edad26_imitacion', type: 'textarea', label: 'Imitación: ¿imita acciones, sonidos, gestos de otros?' },
      { id: 'edad26_rutinas', type: 'textarea', label: 'Rutinas: ¿se adapta a rutinas o le cuesta? ¿Cómo reacciona a los cambios?' },
      { id: 'edad26_separacion', type: 'textarea', label: 'Separación del cuidador: ¿cómo reacciona al despedirse de mamá/papá?' },
    ],
  },
  {
    titulo: 'VI. Área específica según edad (7–11 años)', icono: '🎒',
    descripcion: 'Completá esta sección si tu hijo/a tiene entre 7 y 11 años. Si no, saltala.',
    preguntas: [
      { id: 'edad711_autoconcepto', type: 'textarea', label: 'Autoconcepto: ¿cómo se ve a sí mismo/a? ¿Qué opinión tiene de sí?' },
      { id: 'edad711_frustracion', type: 'textarea', label: 'Manejo de la frustración: ¿qué hace cuando algo no le sale?' },
      { id: 'edad711_habilidades_sociales', type: 'textarea', label: 'Habilidades sociales: ¿cómo se relaciona con sus pares?' },
      { id: 'edad711_miedos', type: 'textarea', label: 'Miedos frecuentes: ¿qué le causa temor o ansiedad?' },
    ],
  },
  {
    titulo: 'VI. Área específica según edad (12–15 años)', icono: '🎓',
    descripcion: 'Completá esta sección si tu hijo/a tiene entre 12 y 15 años. Si no, saltala.',
    preguntas: [
      { id: 'edad1215_autoestima', type: 'textarea', label: 'Autoestima / identidad: ¿cómo se valora a sí mismo/a?' },
      { id: 'edad1215_cambios_etapa', type: 'textarea', label: 'Gestión de los cambios propios de la adolescencia (corporales, emocionales, sociales)' },
      { id: 'edad1215_pares', type: 'textarea', label: 'Influencia de pares: ¿qué tan influenciable es por sus amigos?' },
      { id: 'edad1215_tecnologia', type: 'textarea', label: 'Uso de tecnología y redes sociales: cantidad de tiempo, plataformas, comportamiento' },
      { id: 'edad1215_metas_futuro', type: 'textarea', label: 'Metas a futuro: ¿qué planes / sueños tiene?' },
    ],
  },

  // ─── VII. Expectativas y Observaciones ─────────────────────────────────
  {
    titulo: 'VII. Expectativas y observaciones', icono: '✨',
    preguntas: [
      { id: 'expectativas', type: 'textarea', label: '¿Qué esperan obtener de esta evaluación?', required: true },
      { id: 'cambios_deseados', type: 'textarea', label: '¿Qué cambios desean observar en su hijo/a tras el proceso?' },
      { id: 'observaciones', type: 'textarea', label: 'Observaciones finales: cualquier cosa que quieran compartir y no se haya cubierto antes.' },
    ],
  },
]

// ─── Segunda ficha: ANAMNESIS NEUROPSICOLÓGICA ──────────────────────────
// Estructura oficial SANTI — 11 secciones (I a XI).
// Las tablas dinámicas permiten al padre/madre agregar varias filas (familiares, accidentes, etc.).
const SECCIONES_NEURO: Seccion[] = [
  // ─── I. Datos Familiares ───────────────────────────────────────────────
  {
    titulo: 'I. Datos familiares', icono: '👨‍👩‍👧',
    descripcion: 'Familiares que viven con el niño/a. Podés agregar tantos como necesites.',
    preguntas: [
      { id: 'datos_familiares', type: 'tabla_dinamica', label: 'Familiares que conviven con el niño/a',
        addLabel: '+ Agregar familiar', minRows: 2,
        columns: [
          { id: 'relacion', label: 'Relación', options: ['Madre', 'Padre', 'Hermano/a', 'Abuelo/a', 'Tío/a', 'Otro'] },
          { id: 'nombre', label: 'Nombres y apellidos' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'instruccion', label: 'Grado de instrucción', placeholder: 'Ej: Superior, técnica' },
          { id: 'ocupacion', label: 'Ocupación' },
        ],
      },
    ],
  },

  // ─── II. Perfil Actual ─────────────────────────────────────────────────
  {
    titulo: 'II. Perfil actual', icono: '🔍',
    descripcion: 'Las principales preocupaciones que motivan la consulta.',
    preguntas: [
      { id: 'perfil_preocupaciones', type: 'textarea', label: 'Motivo de consulta: ¿Cuáles son las principales preocupaciones relacionadas con conducta, lenguaje, autovalimiento, etc.? Describí cada una lo más detalladamente posible.', required: true },
      { id: 'perfil_desde_cuando', type: 'textarea', label: 'Inicio: ¿Desde cuándo se observan estas conductas?', required: true },
    ],
  },

  // ─── III. Historia Evolutiva ───────────────────────────────────────────
  {
    titulo: 'III. Historia evolutiva — Prenatal', icono: '🤰',
    descripcion: 'Etapa antes del nacimiento.',
    preguntas: [
      { id: 'pren_duracion', type: 'text', label: 'Duración del embarazo', placeholder: 'Ej: 9 meses / 38 semanas' },
      { id: 'pren_programado', type: 'radio', label: '¿Fue un embarazo programado?', options: ['Sí', 'No', 'No estoy seguro/a'] },
      { id: 'pren_salud', type: 'textarea', label: 'Salud materna durante el embarazo (enfermedades, complicaciones)' },
      { id: 'pren_edad_papa', type: 'number', label: 'Edad del papá cuando nació su hijo/a' },
      { id: 'pren_edad_mama', type: 'number', label: 'Edad de la mamá cuando nació' },
      { id: 'pren_medicamentos', type: 'textarea', label: 'Ingesta de medicamentos durante el embarazo. ¿Cuáles?' },
      { id: 'pren_comentarios', type: 'textarea', label: 'Otros comentarios sobre el embarazo' },
    ],
  },
  {
    titulo: 'III. Historia evolutiva — Perinatal', icono: '🍼',
    descripcion: 'El parto.',
    preguntas: [
      { id: 'peri_duracion_gestacion', type: 'radio', label: 'Duración de la gestación:', options: ['Normal (a término)', 'Prematuro', 'Post-término', 'No lo sé'] },
      { id: 'peri_tipo_parto', type: 'radio', label: 'Tipo de parto:', options: ['Natural', 'Cesárea programada', 'Cesárea de emergencia', 'No lo sé'] },
      { id: 'peri_motivo_cesarea', type: 'textarea', label: 'Si fue cesárea, ¿por qué?' },
      { id: 'peri_comentarios', type: 'textarea', label: 'Comentarios adicionales sobre el parto' },
    ],
  },
  {
    titulo: 'III. Historia evolutiva — Post natal', icono: '👶',
    descripcion: 'Los primeros días después del nacimiento.',
    preguntas: [
      { id: 'post_lloro', type: 'radio', label: '¿Lloró inmediatamente al nacer?', options: ['Sí', 'No', 'No lo sé'] },
      { id: 'post_oxigeno', type: 'radio', label: '¿Necesitó oxígeno / reanimación?', options: ['No', 'Sí, brevemente', 'Sí, prolongado', 'No lo sé'] },
      { id: 'post_incubadora', type: 'text', label: '¿Necesitó incubadora? ¿Por cuánto tiempo?', placeholder: 'No / Sí, X días' },
      { id: 'post_color', type: 'text', label: 'Color que presentó al nacer', placeholder: 'Rosado, azulado, amarillo…' },
      { id: 'post_comentarios', type: 'textarea', label: 'Comentarios adicionales' },
    ],
  },

  // ─── IV. Historia Médica ───────────────────────────────────────────────
  {
    titulo: 'IV. Historia médica — Enfermedades', icono: '🏥',
    descripcion: 'Padecimientos específicos.',
    preguntas: [
      { id: 'med_enfermedades', type: 'checkbox', label: 'Marca las enfermedades que haya presentado:', options: ['Meningitis', 'Encefalitis', 'Convulsiones', 'Otitis', 'Ictericia', 'Fiebres altas', 'Amigdalitis', 'Otros', 'Ninguna'] },
      { id: 'med_enfermedades_detalle', type: 'textarea', label: 'Detalla las marcadas: edad y duración aproximadas.', placeholder: 'Ej: convulsiones a los 2 años, una sola vez de 5 min' },
    ],
  },
  {
    titulo: 'IV. Historia médica — Accidentes', icono: '🚨',
    descripcion: 'Registro de accidentes ocurridos.',
    preguntas: [
      { id: 'med_accidentes', type: 'tabla_dinamica', label: 'Accidentes',
        addLabel: '+ Agregar accidente', minRows: 0,
        columns: [
          { id: 'anio', label: 'Año', type: 'number', placeholder: 'Ej: 2022' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'tipo', label: 'Tipo de accidente' },
          { id: 'tratamiento', label: 'Tratamiento recibido' },
          { id: 'situacion_final', label: 'Situación final / secuelas' },
          { id: 'medicamentos', label: 'Medicamentos' },
        ],
      },
    ],
  },
  {
    titulo: 'IV. Historia médica — Otros', icono: '🩺',
    preguntas: [
      { id: 'med_cambios_post', type: 'textarea', label: 'Cambios post-evento: ¿hubo cambios en el niño/a tras enfermedades o accidentes? ¿Pasajeros o continuos?' },
      { id: 'med_examen_neuro', type: 'textarea', label: 'Exámenes neurológicos: ¿le han hecho alguno? ¿Cuál fue el resultado?' },
      { id: 'med_diagnostico', type: 'textarea', label: 'Diagnósticos previos: ¿ha sido diagnosticado/a con alguna condición?' },
      { id: 'med_sensorial', type: 'textarea', label: '¿Presenta dificultades visuales o auditivas?' },
      { id: 'med_terapias_previas', type: 'textarea', label: 'Terapias recibidas: ¿cuál? ¿desde cuándo? ¿cuántas veces a la semana/mes?' },
      { id: 'med_otros', type: 'textarea', label: 'Otros comentarios médicos' },
    ],
  },

  // ─── V. Historia del Desarrollo Muscular ───────────────────────────────
  {
    titulo: 'V. Desarrollo muscular', icono: '🏃',
    descripcion: 'Hitos motores, dificultades y temperamento.',
    preguntas: [
      { id: 'mot_sentarse', type: 'text', label: '¿A qué edad se sentó solo/a?', placeholder: 'Meses' },
      { id: 'mot_gatear', type: 'text', label: '¿A qué edad gateó?', placeholder: 'Meses' },
      { id: 'mot_pararse', type: 'text', label: '¿A qué edad se paró solo/a?', placeholder: 'Meses' },
      { id: 'mot_caminar', type: 'text', label: '¿A qué edad caminó?', placeholder: 'Meses' },
      { id: 'mot_dificultades', type: 'textarea', label: 'Dificultades observadas durante estos hitos' },
      { id: 'mot_actividad', type: 'radio', label: 'Temperamento — considera que su hijo/a es:', options: ['Demasiado inquieto/a para su edad', 'Demasiado tranquilo/a para su edad', 'Adecuado/a para su edad'] },
    ],
  },

  // ─── VI. Movimiento y Lenguaje ─────────────────────────────────────────
  {
    titulo: 'VI. Movimiento y lenguaje', icono: '🗣️',
    descripcion: 'Movimientos, lateralidad y comunicación.',
    preguntas: [
      { id: 'mov_balanceo', type: 'textarea', label: 'Movimientos automáticos (balanceo, mecerse): ¿los presenta? ¿cuáles?' },
      { id: 'mov_agitados', type: 'textarea', label: 'Movimientos agitados (sacudir manos, estrujar): ¿cuándo aparecen?' },
      { id: 'mov_mano_preferida', type: 'radio', label: 'Lateralidad — mano preferida:', options: ['Derecha', 'Izquierda', 'Ambas', 'No definida aún'] },
      { id: 'leng_primera_edad', type: 'text', label: 'Edad de sus primeras palabras', placeholder: 'Meses' },
      { id: 'leng_dificultad_pronunciar', type: 'textarea', label: 'Dificultades de pronunciación (cuáles)' },
      { id: 'leng_dificultad_actual', type: 'textarea', label: 'Dificultades actuales al hablar: ¿en qué situaciones aparecen?' },
      { id: 'leng_comprende', type: 'radio', label: 'Nivel de comprensión — ¿entiende lo que se le dice?', options: ['Sí, todo', 'Casi todo', 'Solo cosas simples', 'Le cuesta entender'] },
    ],
  },

  // ─── VII. Formación de Hábitos ─────────────────────────────────────────
  {
    titulo: 'VII. Formación de hábitos — Alimentación', icono: '🍽️',
    preguntas: [
      { id: 'hab_lactancia', type: 'radio', label: 'Tipo de lactancia que recibió:', options: ['Materna exclusiva', 'Artificial', 'Mixta', 'No lo sé'] },
      { id: 'hab_lactancia_duracion', type: 'text', label: 'Duración de la lactancia', placeholder: 'Ej: 6 meses' },
      { id: 'hab_come_solo', type: 'radio', label: '¿Come sin ayuda y usa cubiertos?', options: ['Sí, sin problema', 'Parcialmente', 'No', 'Aún no por edad'] },
      { id: 'hab_apetito', type: 'textarea', label: 'Apetito y rechazo de alimentos: ¿cuáles?' },
    ],
  },
  {
    titulo: 'VII. Formación de hábitos — Higiene y sueño', icono: '🛁',
    preguntas: [
      { id: 'hab_control_orina_edad', type: 'text', label: 'Edad de control de orina (diurno/nocturno)' },
      { id: 'hab_control_heces_edad', type: 'text', label: 'Edad de control de heces' },
      { id: 'hab_control_actual', type: 'radio', label: 'En la actualidad, ¿controla orina y heces?', options: ['Sí, ambas', 'Solo diurno', 'Aún no', 'Variable'] },
      { id: 'hab_orina_cama', type: 'text', label: '¿Hasta qué edad se orinó en la cama? (o si aún ocurre)', placeholder: 'Ej: 5 años / aún ocurre' },
      { id: 'hab_sueno_primeros', type: 'textarea', label: 'Calidad del sueño durante los primeros 2 años' },
      { id: 'hab_medicamento_dormir', type: 'textarea', label: '¿Usó medicamentos para dormir? ¿Cuáles y por cuánto tiempo?' },
      { id: 'hab_horas_sueno', type: 'text', label: 'Horas que duerme actualmente', placeholder: 'Ej: 9 horas' },
      { id: 'hab_calidad_sueno', type: 'checkbox', label: 'Conductas durante el sueño:', options: ['Habla dormido', 'Grita', 'Se mueve mucho', 'Transpira', 'Babea', 'Cruje los dientes', 'Sonambulismo', 'Duerme tranquilo'] },
    ],
  },
  {
    titulo: 'VII. Formación de hábitos — Independencia', icono: '🧦',
    preguntas: [
      { id: 'hab_mandados', type: 'radio', label: '¿Realiza mandados?', options: ['Sí, dentro y fuera de casa', 'Solo dentro de casa', 'No', 'Aún no por edad'] },
      { id: 'hab_ayuda_casa', type: 'textarea', label: 'Ayuda en casa: ¿qué cosas hace?' },
      { id: 'hab_viste_solo', type: 'radio', label: 'Capacidad para vestirse solo/a:', options: ['Sí, completamente', 'Casi todo', 'Con ayuda', 'No, depende del adulto'] },
    ],
  },

  // ─── VIII. Historia Educativa ──────────────────────────────────────────
  {
    titulo: 'VIII. Historia educativa', icono: '🏫',
    descripcion: 'Trayectoria escolar.',
    preguntas: [
      { id: 'edu_edad_inicio', type: 'text', label: 'Edad de ingreso al colegio' },
      { id: 'edu_agrado', type: 'radio', label: '¿Le agrada asistir al colegio?', options: ['Sí, le gusta', 'Al inicio costó pero ahora va bien', 'Le cuesta ir', 'No le gusta'] },
      { id: 'edu_cambios_colegio', type: 'textarea', label: 'Cambios de colegio (¿cuántos y por qué?)' },
      { id: 'edu_relaciones', type: 'textarea', label: 'Relación con maestros y compañeros' },
      { id: 'edu_conducta_aula', type: 'textarea', label: 'Conducta en clase y en el recreo' },
      { id: 'edu_trayectoria', type: 'tabla_dinamica', label: 'Registro escolar por año',
        addLabel: '+ Agregar año escolar', minRows: 1,
        columns: [
          { id: 'anio', label: 'Año', type: 'number', placeholder: 'Ej: 2024' },
          { id: 'edad', label: 'Edad', type: 'number', placeholder: 'Años' },
          { id: 'colegio', label: 'Colegio / institución' },
          { id: 'grado', label: 'Grado' },
          { id: 'conducta', label: 'Conducta / dificultades observadas' },
          { id: 'aprobado', label: '¿Aprobó?', options: ['Sí', 'No', 'En proceso'] },
        ],
      },
    ],
  },

  // ─── IX. Juegos ────────────────────────────────────────────────────────
  {
    titulo: 'IX. Juegos', icono: '🎲',
    descripcion: 'Actividades preferidas y socialización al jugar.',
    preguntas: [
      { id: 'jue_solo', type: 'radio', label: '¿Juega solo/a?', options: ['Sí, frecuentemente', 'A veces', 'No, prefiere con otros', 'Variable'] },
      { id: 'jue_preferidos', type: 'textarea', label: 'Juegos, juguetes o actividades preferidas' },
      { id: 'jue_dirige', type: 'radio', label: 'Cuando juega con otros niños:', options: ['Dirige a los demás', 'Es dirigido por ellos', 'Es flexible / colabora', 'Le cuesta integrarse'] },
      { id: 'jue_tiempo_libre', type: 'textarea', label: 'Uso del tiempo libre' },
    ],
  },

  // ─── X. Dinámica Familiar ──────────────────────────────────────────────
  {
    titulo: 'X. Dinámica familiar', icono: '🏡',
    descripcion: 'Vínculos en el hogar, estilo de crianza y comportamiento.',
    preguntas: [
      { id: 'din_estructura', type: 'textarea', label: 'Estructura: ¿quiénes conforman la familia y con quién vive el menor?' },
      { id: 'din_crianza_otros', type: 'textarea', label: 'Roles de otros familiares cercanos en la crianza' },
      { id: 'din_dinamica', type: 'textarea', label: 'Dinámica: descripción de la comunicación en casa' },
      { id: 'din_cambios', type: 'textarea', label: 'Cambios significativos recientes (duelos, mudanzas, separaciones, etc.)' },
      { id: 'din_estilo_crianza', type: 'radio', label: 'Estilo de crianza predominante:', options: ['Permisivo', 'Autoritario', 'Negociador / democrático', 'Inconsistente', 'Otro'] },
      { id: 'din_conducta_casa', type: 'textarea', label: 'Comportamiento en casa' },
      { id: 'din_conductas_preocupan', type: 'textarea', label: 'Preocupaciones específicas de los padres (agresividad, retraimiento, miedo excesivo, etc.)' },
      { id: 'din_frente_a_limites', type: 'textarea', label: 'Reacciones ante situaciones nuevas, frustraciones o límites' },
      { id: 'din_tiempo_libre', type: 'textarea', label: '¿Qué le gusta hacer en su tiempo libre?' },
    ],
  },

  // ─── XI. Antecedentes Familiares ───────────────────────────────────────
  {
    titulo: 'XI. Antecedentes familiares', icono: '🧬',
    descripcion: 'Historial genético / familiar.',
    preguntas: [
      { id: 'ant_familiares', type: 'checkbox', label: '¿En la familia hay o hubo casos de…?', options: ['Enfermedades psiquiátricas', 'Epilepsia o convulsiones', 'Retardo mental / discapacidad intelectual', 'Dificultades de aprendizaje', 'Problemas de habla / lenguaje', 'TEA / autismo', 'TDAH', 'Depresión / ansiedad', 'Otros', 'Ninguno'] },
      { id: 'ant_familiares_detalle', type: 'textarea', label: 'Si marcaste alguna opción, indicá quién y de qué se trata' },
    ],
  },
]

// ─── Render del razonamiento de la IA (convierte **negritas** y --- a formato) ──
function RazonRecomendacion({ texto }: { texto: string }) {
  // Parte por líneas. Los "---" se vuelven separadores; el resto, párrafos
  // con soporte de **negritas** (markdown sencillo que devuelve el modelo).
  const lineas = (texto || '').split('\n')

  const renderInline = (linea: string, key: number) => {
    // Divide en segmentos: los que están entre ** ** se renderizan en negrita.
    const partes = linea.split(/(\*\*[^*]+\*\*)/g)
    return (
      <p key={key} className="text-sm leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--text-secondary)' }}>
        {partes.map((p, i) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return (
              <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
                {p.slice(2, -2)}
              </strong>
            )
          }
          return <span key={i}>{p}</span>
        })}
      </p>
    )
  }

  return (
    <div>
      {lineas.map((ln, i) => {
        const t = ln.trim()
        if (t === '') return null
        // Línea separadora (---, —, ***, etc.)
        if (/^[-—*_]{2,}$/.test(t)) {
          return <hr key={i} className="my-3 border-0 h-px" style={{ background: 'rgba(168,85,247,0.25)' }} />
        }
        return renderInline(ln, i)
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
export default function EvaluacionInicialView({ child, profile }: Props) {
  const [loading, setLoading] = useState(true)
  const [evaluacion, setEvaluacion] = useState<any>(null)
  const [terapias, setTerapias] = useState<any[]>([])

  // Estado del wizard intake
  const [pasoIntake, setPasoIntake] = useState(0)
  const [respIntake, setRespIntake] = useState<Record<string, any>>({})
  const [enviandoIntake, setEnviandoIntake] = useState(false)
  const [analizando, setAnalizando] = useState(false)

  // Estado wizard anamnesis
  const [pasoAnamnesis, setPasoAnamnesis] = useState(0)
  const [respAnamnesis, setRespAnamnesis] = useState<Record<string, any>>({})
  const [enviandoAnamnesis, setEnviandoAnamnesis] = useState(false)

  // Estado selección de terapias
  const [terapiasElegidas, setTerapiasElegidas] = useState<string[]>([])
  const [mensajeEspecialista, setMensajeEspecialista] = useState('')
  const [enviandoSeleccion, setEnviandoSeleccion] = useState(false)

  // Estado confirmación recomendación
  const [confirmando, setConfirmando] = useState(false)
  const [showRechazoModal, setShowRechazoModal] = useState(false)
  const [motivoRechazo, setMotivoRechazo] = useState('')

  // Estado generación de recomendación de terapias (IA)
  const [generandoRec, setGenerandoRec] = useState(false)
  const [recIntentada, setRecIntentada] = useState(false)

  useEffect(() => { if (child?.id) cargar() }, [child?.id])

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/evaluacion-inicial?child_id=${child.id}`)
      const data = await res.json()
      if (data.ok) {
        setEvaluacion(data.evaluacion)
        if (data.evaluacion?.respuestas_intake) setRespIntake(data.evaluacion.respuestas_intake)
        if (data.evaluacion?.anamnesis_especifica) setRespAnamnesis(data.evaluacion.anamnesis_especifica)
        if (data.evaluacion?.terapias_seleccionadas) setTerapiasElegidas(data.evaluacion.terapias_seleccionadas)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const cargarTerapias = async () => {
    try {
      const res = await fetch('/api/terapias-catalogo')
      const data = await res.json()
      if (data.ok) setTerapias(data.terapias || [])
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (evaluacion?.estado === 'anamnesis_completa' ||
        evaluacion?.estado === 'terapia_seleccionada' ||
        evaluacion?.estado === 'revisado' ||
        evaluacion?.estado === 'completado') {
      cargarTerapias()
    }
  }, [evaluacion?.estado])

  // 🔮 Asegura que la recomendación de terapias exista al llegar a la selección.
  // (En la anamnesis se dispara fire-and-forget y en serverless puede no completarse,
  //  así que acá la generamos de forma confiable si todavía no hay recomendación.)
  useEffect(() => {
    const necesitaRec =
      evaluacion?.estado === 'anamnesis_completa' &&
      (!evaluacion?.terapias_recomendadas || evaluacion.terapias_recomendadas.length === 0)
    if (necesitaRec && !recIntentada && !generandoRec) {
      setRecIntentada(true)
      ;(async () => {
        setGenerandoRec(true)
        try {
          await fetch('/api/evaluacion-inicial/recomendar-terapias', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evaluacion_id: evaluacion.id }),
          })
          await cargar()
        } catch (e) { console.error(e) }
        finally { setGenerandoRec(false) }
      })()
    }
  }, [evaluacion?.estado, evaluacion?.terapias_recomendadas, recIntentada, generandoRec])

  if (!child) {
    return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Selecciona un hijo/a.</div>
  }
  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
  }

  const estado = evaluacion?.estado || 'pendiente_intake'

  // ═══ FASE 1: INTAKE INICIAL ════════════════════════════════════════════
  if (estado === 'pendiente_intake' || !evaluacion) {
    return <WizardIntake
      child={child}
      profile={profile}
      seccionIdx={pasoIntake}
      setSeccionIdx={setPasoIntake}
      respuestas={respIntake}
      setRespuestas={setRespIntake}
      enviando={enviandoIntake}
      analizando={analizando}
      onEnviar={async () => {
        setEnviandoIntake(true)
        try {
          const res = await fetch('/api/evaluacion-inicial', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ child_id: child.id, parent_id: profile?.id, respuestas: respIntake }),
          })
          const d = await res.json()
          if (!d.ok) throw new Error(d.error)
          setAnalizando(true)
          await fetch('/api/evaluacion-inicial/analizar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: d.evaluacion.id }),
          })
          await cargar()
        } catch (e: any) { alert('Error: ' + e.message) }
        finally { setEnviandoIntake(false); setAnalizando(false) }
      }}
    />
  }

  // ═══ FASE 2: ANALIZANDO ════════════════════════════════════════════════
  if (estado === 'analizando') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white mb-6 animate-pulse">
          <Brain size={48} />
        </div>
        <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
          Estamos revisando tu información…
        </h2>
        <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
          Esto toma unos segundos. Si tarda más, vuelve en un momentito.
        </p>
        <button onClick={cargar} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-2 mx-auto">
          <Loader2 className="animate-spin" size={18} /> Verificar de nuevo
        </button>
      </div>
    )
  }

  // ═══ FASE 3: RECOMENDACIÓN + CONFIRMACIÓN ══════════════════════════════
  if (estado === 'recomendado') {
    const rec = evaluacion.recomendacion
    const mensaje = evaluacion.mensaje_amigable_padre || evaluacion.recomendacion_resumen ||
      'Hemos revisado tu información. Te sugerimos continuar con una evaluación para conocer mejor a tu hijo/a.'
    const RecIcon = rec === 'neuropsicologica' ? Brain : Heart
    const recTitulo = rec === 'psicologica' ? 'Evaluación Psicológica Emocional'
                    : rec === 'neuropsicologica' ? 'Evaluación Neuropsicológica'
                    : 'Evaluación Integral'
    const recColor = rec === 'psicologica' ? 'from-pink-500 to-rose-500' : 'from-indigo-500 to-blue-500'

    return (
      <div className="max-w-2xl mx-auto pb-12">
        <div className={`rounded-3xl p-6 mb-6 text-white shadow-xl bg-gradient-to-br ${recColor}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
              <RecIcon size={26} />
            </div>
            <div>
              <p className="text-sm font-medium opacity-80">Nuestra sugerencia para {child.name}</p>
              <h1 className="text-2xl font-bold tracking-tight">{recTitulo}</h1>
            </div>
          </div>
          <p className="text-white/95 leading-relaxed whitespace-pre-wrap">{mensaje}</p>
        </div>

        <div className="rounded-2xl p-5 mb-5 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <h3 className="font-black text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Star size={16} className="text-amber-500" /> ¿Qué sigue si aceptas?
          </h3>
          <ol className="space-y-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li className="flex gap-3"><span className="font-black text-indigo-600">1.</span> Completas una ficha un poco más detallada (5-7 minutos).</li>
            <li className="flex gap-3"><span className="font-black text-indigo-600">2.</span> Te mostramos las terapias que podrían ayudar a {child.name}.</li>
            <li className="flex gap-3"><span className="font-black text-indigo-600">3.</span> Eliges la que prefieras y nuestro equipo te contactará para coordinar.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              setConfirmando(true)
              try {
                const r = await fetch('/api/evaluacion-inicial/confirmar', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ evaluacion_id: evaluacion.id, acepta: true }),
                })
                const d = await r.json()
                if (!d.ok) throw new Error(d.error)
                await cargar()
              } catch (e: any) { alert('Error: ' + e.message) }
              finally { setConfirmando(false) }
            }}
            disabled={confirmando}
            className="flex-1 px-6 py-4 rounded-2xl font-black text-base bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-xl hover:scale-[1.01] transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {confirmando ? <Loader2 className="animate-spin" size={20} /> : <ThumbsUp size={20} />}
            Estoy de acuerdo, continuar
          </button>
          <button
            onClick={() => setShowRechazoModal(true)}
            className="flex-1 sm:flex-initial px-6 py-4 rounded-2xl font-bold text-sm border-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          >
            Tengo dudas
          </button>
        </div>

        {showRechazoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setShowRechazoModal(false)}>
            <div className="max-w-md w-full rounded-2xl shadow-2xl p-6" style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>
              <h3 className="font-black mb-2" style={{ color: 'var(--text-primary)' }}>Cuéntanos tus dudas</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Nuestro equipo te contactará por WhatsApp para conversar.
              </p>
              <textarea
                value={motivoRechazo}
                onChange={e => setMotivoRechazo(e.target.value)}
                rows={4}
                placeholder="¿Qué te genera dudas?"
                className="w-full px-3 py-2 rounded-lg border outline-none text-sm resize-none mb-4"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await fetch('/api/evaluacion-inicial/confirmar', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ evaluacion_id: evaluacion.id, acepta: false, motivo_rechazo: motivoRechazo }),
                    })
                    setShowRechazoModal(false)
                    await cargar()
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 text-white font-bold"
                >Enviar</button>
                <button onClick={() => setShowRechazoModal(false)} className="px-4 py-2.5 rounded-lg border-2 font-bold"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══ FASE 4: 2ª ANAMNESIS ══════════════════════════════════════════════
  if (estado === 'confirmado') {
    const secciones = evaluacion.recomendacion === 'neuropsicologica' ? SECCIONES_NEURO : SECCIONES_PSICO
    return <WizardAnamnesis
      child={child}
      tipo={evaluacion.recomendacion}
      secciones={secciones}
      seccionIdx={pasoAnamnesis}
      setSeccionIdx={setPasoAnamnesis}
      respuestas={respAnamnesis}
      setRespuestas={setRespAnamnesis}
      enviando={enviandoAnamnesis}
      onEnviar={async () => {
        setEnviandoAnamnesis(true)
        try {
          const res = await fetch('/api/evaluacion-inicial/anamnesis', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evaluacion_id: evaluacion.id, respuestas: respAnamnesis }),
          })
          const d = await res.json()
          if (!d.ok) throw new Error(d.error)
          await cargar()
        } catch (e: any) { alert('Error: ' + e.message) }
        finally { setEnviandoAnamnesis(false) }
      }}
    />
  }

  // ═══ FASE 5: SELECCIÓN DE TERAPIAS ═════════════════════════════════════
  if (estado === 'anamnesis_completa') {
    const recomendadasIds: string[] = evaluacion.terapias_recomendadas || []
    const recSet = new Set(recomendadasIds)
    // Recomendadas en el orden que dio la IA
    const recomendadas = recomendadasIds
      .map(id => terapias.find(t => t.id === id))
      .filter(Boolean) as any[]
    // El resto del catálogo (no recomendadas)
    const resto = terapias.filter(t => !recSet.has(t.id))

    const nombreCorto = (child.name || '').split(' ')[0] || child.name

    // Tarjeta de terapia reutilizable (recomendada o catálogo general)
    const renderTarjeta = (t: any) => {
      const checked = terapiasElegidas.includes(t.id)
      const esRecomendada = recSet.has(t.id)
      const colorTema = TERAPIA_COLORES[t.color_tema || 'indigo'] || TERAPIA_COLORES.indigo
      return (
        <button
          key={t.id}
          onClick={() => setTerapiasElegidas(arr => arr.includes(t.id) ? arr.filter(x => x !== t.id) : [...arr, t.id])}
          className="relative text-left rounded-2xl border-2 overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-xl"
          style={{
            background: 'var(--card)',
            borderColor: checked ? colorTema.accent : esRecomendada ? colorTema.accent : 'var(--card-border)',
            boxShadow: checked ? `0 0 0 3px ${colorTema.accent}33` : undefined,
          }}
        >
          {/* Banda superior con el color */}
          <div className={`h-1.5 bg-gradient-to-r ${colorTema.gradient}`} />

          {esRecomendada && (
            <div className="absolute top-3.5 right-3 z-10 px-2.5 py-1 rounded-full text-[11px] font-semibold text-white shadow-lg flex items-center gap-1"
              style={{ background: `linear-gradient(135deg, ${colorTema.accent}, ${colorTema.accentDark})` }}>
              <Sparkles size={11} /> Recomendada
            </div>
          )}
          {checked && (
            <div className="absolute top-3.5 left-3 z-10 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg"
              style={{ background: colorTema.accent }}>
              <CheckCircle2 size={16} />
            </div>
          )}

          {t.imagen_url ? (
            <img src={t.imagen_url} alt={t.nombre} className="w-full h-40 object-cover" />
          ) : (
            <div className={`w-full h-40 flex items-center justify-center bg-gradient-to-br ${colorTema.gradient} opacity-30`}>
              <ImageIcon size={42} className="text-white/60" />
            </div>
          )}

          <div className="p-5 space-y-3">
            {t.categoria && (
              <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md"
                style={{ background: `${colorTema.accent}1a`, color: colorTema.accent }}>
                {t.categoria}
              </span>
            )}
            <h4 className="font-bold text-lg leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>{t.nombre}</h4>
            {t.descripcion && <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t.descripcion}</p>}
            {t.por_que && (
              <div className="rounded-xl p-3.5 text-sm leading-relaxed"
                style={{ background: `${colorTema.accent}0d`, color: 'var(--text-secondary)' }}>
                <p className="text-[13px] font-semibold mb-1 flex items-center gap-1.5" style={{ color: colorTema.accent }}>
                  <Sparkles size={13} /> Por qué llevarla
                </p>
                <p>{t.por_que}</p>
              </div>
            )}
            <div className="flex items-end justify-between pt-3 border-t" style={{ borderColor: 'var(--card-border)' }}>
              {t.duracion && (
                <div>
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Duración</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{t.duracion}</p>
                </div>
              )}
              {t.precio != null && (
                <div className="text-right">
                  <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-muted)' }}>Inversión</p>
                  <p className="text-xl font-bold tabular-nums" style={{ color: colorTema.accent }}>
                    S/. {Number(t.precio).toFixed(0)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </button>
      )
    }

    return (
      <div className="max-w-4xl mx-auto pb-12">
        <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
          <h1 className="text-2xl font-black mb-2">🎉 ¡Casi terminamos!</h1>
          <p className="text-white/95">
            {recomendadas.length > 0
              ? <>Revisamos con cuidado lo que nos contaste sobre <strong>{nombreCorto}</strong>. Más abajo verás <strong>nuestra recomendación personalizada</strong> y, debajo, <strong>todo nuestro catálogo</strong> por si quieres explorar otras opciones. Marca la(s) que te interese conocer más.</>
              : <>Estas son las terapias que ofrecemos en SANTI. Marca la(s) que te interese conocer más. El especialista te contactará con la propuesta personalizada.</>
            }
          </p>
        </div>

        {terapias.length === 0 || generandoRec ? (
          <div className="text-center py-16 rounded-2xl border" style={{ color: 'var(--text-muted)', background: 'var(--card)', borderColor: 'var(--card-border)' }}>
            <Loader2 className="animate-spin mx-auto mb-3 text-purple-500" size={32} />
            <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
              {generandoRec ? `Estamos preparando la recomendación para ${nombreCorto}…` : 'Cargando terapias…'}
            </p>
            {generandoRec && <p className="text-sm mt-1">Esto toma unos segundos. No cierres esta página.</p>}
          </div>
        ) : (
          <>
            {/* ─── SECCIÓN A: RECOMENDACIÓN PERSONALIZADA ─────────────────── */}
            {recomendadas.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      Lo que te recomendamos para {nombreCorto}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Basado en la información que nos diste
                    </p>
                  </div>
                </div>

                {/* Razonamiento general de la IA (formateado) */}
                {evaluacion.terapias_recomendadas_razon && (
                  <div className="rounded-2xl p-5 my-4 border" style={{ background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.2)' }}>
                    <RazonRecomendacion texto={evaluacion.terapias_recomendadas_razon} />
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {recomendadas.map(renderTarjeta)}
                </div>
              </section>
            )}

            {/* ─── SECCIÓN B: CATÁLOGO COMPLETO ───────────────────────────── */}
            {resto.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--muted-bg)', color: 'var(--text-secondary)' }}>
                    <ClipboardCheck size={18} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {recomendadas.length > 0 ? 'Todo nuestro catálogo de terapias' : 'Nuestras terapias'}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {recomendadas.length > 0 ? 'Otras opciones que también ofrecemos' : 'Marca las que te interese conocer'}
                    </p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {resto.map(renderTarjeta)}
                </div>
              </section>
            )}
          </>
        )}

        <div className="rounded-2xl p-5 mb-4 border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Mensaje al especialista (opcional)
          </label>
          <textarea
            value={mensajeEspecialista}
            onChange={e => setMensajeEspecialista(e.target.value)}
            rows={3}
            placeholder="Horarios preferidos, dudas, comentarios…"
            className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none"
            style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
          />
        </div>

        <button
          onClick={async () => {
            if (terapiasElegidas.length === 0) { alert('Elige al menos una terapia'); return }
            setEnviandoSeleccion(true)
            try {
              const r = await fetch('/api/evaluacion-inicial/seleccionar', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  evaluacion_id: evaluacion.id,
                  terapia_ids: terapiasElegidas,
                  mensaje_al_especialista: mensajeEspecialista,
                }),
              })
              const d = await r.json()
              if (!d.ok) throw new Error(d.error)
              await cargar()
            } catch (e: any) { alert('Error: ' + e.message) }
            finally { setEnviandoSeleccion(false) }
          }}
          disabled={terapiasElegidas.length === 0 || enviandoSeleccion}
          className="w-full px-6 py-4 rounded-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {enviandoSeleccion ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          Enviar al especialista ({terapiasElegidas.length} terapia{terapiasElegidas.length === 1 ? '' : 's'})
        </button>
      </div>
    )
  }

  // ═══ FASE 6: ESPERANDO RESPUESTA DEL ESPECIALISTA ══════════════════════
  if (estado === 'terapia_seleccionada') {
    const elegidas = terapias.filter(t => (evaluacion.terapias_seleccionadas || []).includes(t.id))
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-8 text-center shadow-xl border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white mb-5 animate-pulse">
            <Clock size={40} />
          </div>
          <h2 className="text-2xl font-black mb-3" style={{ color: 'var(--text-primary)' }}>
            Tu solicitud está en revisión
          </h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
            Nuestro <strong>especialista está revisando tu caso</strong>. En cuanto tengamos una respuesta personalizada para {child.name}, te la enviaremos por aquí y por WhatsApp.
          </p>
          {elegidas.length > 0 && (
            <div className="rounded-2xl p-4 mb-6 text-left" style={{ background: 'var(--muted-bg)' }}>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Terapias que pediste conocer</p>
              <ul className="space-y-1">
                {elegidas.map(t => (
                  <li key={t.id} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                    <CheckCircle2 size={14} className="text-green-500" /> {t.nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold border-2"
            style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
            <MessageCircle size={18} /> Contactar al centro mientras tanto
          </a>
        </div>
      </div>
    )
  }

  // ═══ FASE 7: RESPUESTA DEL ESPECIALISTA ════════════════════════════════
  if (estado === 'revisado' || estado === 'completado') {
    const elegidas = terapias.filter(t => (evaluacion.terapias_seleccionadas || []).includes(t.id))
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-7 shadow-xl border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Respuesta del especialista</p>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Mensaje para {child.name}</h2>
            </div>
          </div>

          {evaluacion.respuesta_especialista ? (
            <div className="rounded-2xl p-5 mb-5 whitespace-pre-wrap leading-relaxed"
              style={{ background: 'rgba(16,185,129,0.08)', color: 'var(--text-primary)', border: '1px solid rgba(16,185,129,0.2)' }}>
              {evaluacion.respuesta_especialista}
            </div>
          ) : (
            <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>El especialista enviará su mensaje pronto.</p>
          )}

          {elegidas.length > 0 && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--muted-bg)' }}>
              <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Terapias solicitadas</p>
              <ul className="space-y-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                {elegidas.map(t => <li key={t.id}>· {t.nombre}</li>)}
              </ul>
            </div>
          )}

          <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-green-600 text-white font-bold">
            <MessageCircle size={18} /> Coordinar primera cita
          </a>
        </div>
      </div>
    )
  }

  // ═══ FASE: RECHAZADO ═══════════════════════════════════════════════════
  if (estado === 'rechazado') {
    return (
      <div className="max-w-xl mx-auto py-10 px-4">
        <div className="rounded-3xl p-7 text-center shadow-xl border-2 border-amber-300 bg-amber-50">
          <AlertCircle size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-black mb-3 text-amber-900">Recibimos tus dudas</h2>
          <p className="text-amber-800 mb-5">
            Nuestro equipo se va a comunicar contigo para conversar sobre tu caso y resolver cualquier inquietud.
          </p>
          <a href="https://wa.me/51991070734" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-600 text-white font-bold">
            <MessageCircle size={18} /> Contactar ahora
          </a>
        </div>
      </div>
    )
  }

  return null
}

// ═════════════════════════════════════════════════════════════════════════
// Componentes wizard reutilizables
// ═════════════════════════════════════════════════════════════════════════

function WizardIntake({ child, seccionIdx, setSeccionIdx, respuestas, setRespuestas, enviando, analizando, onEnviar }: any) {
  const seccion = SECCIONES_INTAKE[seccionIdx]
  const progreso = ((seccionIdx + 1) / SECCIONES_INTAKE.length) * 100

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }}>
        <div className="flex items-center gap-3 mb-2">
          <ClipboardCheck size={28} />
          <h1 className="text-2xl font-black">Ficha inicial para papás</h1>
        </div>
        <p className="text-white/90 text-sm mb-2">
          Documento necesario para la entrevista inicial / primera consulta de <strong>{child.name}</strong>.
        </p>
        <p className="text-white/80 text-xs leading-relaxed">
          Este cuestionario nos permite atender mejor las necesidades de tu hijo/a. Los datos son <strong>privados y confidenciales</strong> y se usan únicamente con fines clínicos.
        </p>
      </div>

      <BarraProgreso paso={seccionIdx + 1} total={SECCIONES_INTAKE.length} progreso={progreso} />

      <SeccionRender seccion={seccion} respuestas={respuestas} setRespuestas={setRespuestas} />

      <NavWizard
        idx={seccionIdx}
        total={SECCIONES_INTAKE.length}
        onPrev={() => setSeccionIdx(Math.max(0, seccionIdx - 1))}
        onNext={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          setSeccionIdx(seccionIdx + 1)
        }}
        onSubmit={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          onEnviar()
        }}
        enviando={enviando}
        textoEnviando={analizando ? 'Analizando…' : 'Enviando…'}
      />
    </div>
  )
}

function WizardAnamnesis({ child, tipo, secciones, seccionIdx, setSeccionIdx, respuestas, setRespuestas, enviando, onEnviar }: any) {
  const seccion = secciones[seccionIdx]
  const progreso = ((seccionIdx + 1) / secciones.length) * 100
  const titulo = tipo === 'neuropsicologica' ? 'Ficha Neuropsicológica' : 'Ficha Psicológica Emocional'

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="rounded-3xl p-6 mb-6 text-white shadow-xl" style={{ background: tipo === 'neuropsicologica' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#ec4899,#f43f5e)' }}>
        <h1 className="text-2xl font-black mb-1">{titulo}</h1>
        <p className="text-white/90 text-sm">
          Algunas preguntas más para entender mejor a <strong>{child.name}</strong>.
        </p>
      </div>

      <BarraProgreso paso={seccionIdx + 1} total={secciones.length} progreso={progreso} />
      <SeccionRender seccion={seccion} respuestas={respuestas} setRespuestas={setRespuestas} />
      <NavWizard
        idx={seccionIdx}
        total={secciones.length}
        onPrev={() => setSeccionIdx(Math.max(0, seccionIdx - 1))}
        onNext={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          setSeccionIdx(seccionIdx + 1)
        }}
        onSubmit={() => {
          for (const p of seccion.preguntas) {
            if ((p as any).required && !respuestas[p.id]) { alert(`Responde: "${p.label}"`); return }
          }
          onEnviar()
        }}
        enviando={enviando}
        textoEnviando="Guardando…"
      />
    </div>
  )
}

function BarraProgreso({ paso, total, progreso }: { paso: number; total: number; progreso: number }) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
        <span>Paso {paso} de {total}</span>
        <span>{Math.round(progreso)}%</span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--muted-bg)' }}>
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${progreso}%` }} />
      </div>
    </div>
  )
}

function NavWizard({ idx, total, onPrev, onNext, onSubmit, enviando, textoEnviando }: any) {
  const last = idx === total - 1
  return (
    <div className="flex items-center justify-between mt-6 pt-6 border-t" style={{ borderColor: 'var(--card-border)' }}>
      <button onClick={onPrev} disabled={idx === 0}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-30"
        style={{ color: 'var(--text-secondary)' }}>
        <ChevronLeft size={18} /> Anterior
      </button>
      {!last ? (
        <button onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg">
          Siguiente <ChevronRight size={18} />
        </button>
      ) : (
        <button onClick={onSubmit} disabled={enviando}
          className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg disabled:opacity-50">
          {enviando ? <><Loader2 className="animate-spin" size={18} /> {textoEnviando}</> : <><Sparkles size={18} /> Enviar</>}
        </button>
      )}
    </div>
  )
}

function SeccionRender({ seccion, respuestas, setRespuestas }: any) {
  const setCampo = (id: string, v: any) => setRespuestas((r: any) => ({ ...r, [id]: v }))
  const toggleCheck = (id: string, o: string) => setRespuestas((r: any) => {
    const arr = Array.isArray(r[id]) ? r[id] : []
    return { ...r, [id]: arr.includes(o) ? arr.filter((x: string) => x !== o) : [...arr, o] }
  })

  return (
    <div className="rounded-2xl p-6 shadow-lg border" style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-3xl">{seccion.icono}</span>
        <h2 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>{seccion.titulo}</h2>
      </div>
      {seccion.descripcion && <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{seccion.descripcion}</p>}

      <div className="space-y-5">
        {seccion.preguntas.map((p: Pregunta) => (
          <div key={p.id}>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {p.label}{(p as any).required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {(p.type === 'text' || p.type === 'number' || p.type === 'date') && (
              <input
                type={p.type === 'date' ? 'date' : p.type}
                value={respuestas[p.id] || ''}
                placeholder={(p as any).placeholder}
                onChange={e => setCampo(p.id, e.target.value)}
                className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}
              />
            )}
            {p.type === 'textarea' && (
              <textarea value={respuestas[p.id] || ''} placeholder={(p as any).placeholder} onChange={e => setCampo(p.id, e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500 resize-none"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
            )}
            {p.type === 'select' && (
              <select value={respuestas[p.id] || ''} onChange={e => setCampo(p.id, e.target.value)}
                className="w-full px-4 py-3 rounded-xl border outline-none focus:border-indigo-500"
                style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                <option value="">— Selecciona —</option>
                {(p as any).options.map((o: string) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}
            {p.type === 'radio' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(p as any).options.map((o: string) => (
                  <button key={o} type="button" onClick={() => setCampo(p.id, o)}
                    className={`px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${
                      respuestas[p.id] === o ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'hover:border-indigo-300'
                    }`}
                    style={respuestas[p.id] === o ? {} : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                    {o}
                  </button>
                ))}
              </div>
            )}
            {p.type === 'checkbox' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(p as any).options.map((o: string) => {
                  const checked = Array.isArray(respuestas[p.id]) && respuestas[p.id].includes(o)
                  return (
                    <button key={o} type="button" onClick={() => toggleCheck(p.id, o)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border-2 text-left transition-all ${
                        checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'hover:border-indigo-300'
                      }`}
                      style={checked ? {} : { background: 'var(--muted-bg)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-400'}`}>
                        {checked && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      {o}
                    </button>
                  )
                })}
              </div>
            )}
            {p.type === 'tabla_dinamica' && (() => {
              const cols = (p as any).columns as ColumnaTabla[]
              const minRows = (p as any).minRows ?? 1
              const filas: any[] = Array.isArray(respuestas[p.id]) ? respuestas[p.id] : []
              const filasMostrar = filas.length >= minRows ? filas : [...filas, ...Array(minRows - filas.length).fill({})]
              const setFila = (idx: number, colId: string, v: any) => {
                const next = [...filasMostrar]
                next[idx] = { ...(next[idx] || {}), [colId]: v }
                setCampo(p.id, next)
              }
              const addFila = () => setCampo(p.id, [...filasMostrar, {}])
              const removeFila = (idx: number) => {
                const next = filasMostrar.filter((_, i) => i !== idx)
                setCampo(p.id, next.length === 0 ? [{}] : next)
              }
              return (
                <div className="space-y-3">
                  {filasMostrar.map((fila, idx) => (
                    <div key={idx} className="rounded-xl border-2 p-3 space-y-2 relative"
                      style={{ background: 'var(--muted-bg)', borderColor: 'var(--card-border)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                          {(p as any).addLabel?.replace(/^\+\s*/, '') || 'Fila'} {idx + 1}
                        </span>
                        {filasMostrar.length > minRows && (
                          <button type="button" onClick={() => removeFila(idx)}
                            className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1">
                            <X size={12} /> Quitar
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cols.map(col => (
                          <div key={col.id}>
                            <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{col.label}</label>
                            {col.options ? (
                              <select value={fila[col.id] || ''} onChange={e => setFila(idx, col.id, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-indigo-500"
                                style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }}>
                                <option value="">—</option>
                                {col.options.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input type={col.type || 'text'} value={fila[col.id] || ''} placeholder={col.placeholder}
                                onChange={e => setFila(idx, col.id, e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border text-sm outline-none focus:border-indigo-500"
                                style={{ background: 'var(--card)', borderColor: 'var(--card-border)', color: 'var(--text-primary)' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addFila}
                    className="w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2 hover:border-indigo-400 transition-colors"
                    style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}>
                    <span className="text-lg leading-none">+</span> {(p as any).addLabel || 'Agregar fila'}
                  </button>
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </div>
  )
}
