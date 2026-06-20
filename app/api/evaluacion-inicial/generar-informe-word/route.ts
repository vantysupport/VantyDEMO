// app/api/evaluacion-inicial/generar-informe-word/route.ts
//
// Genera un informe Word profesional a partir de la 2ª anamnesis
// (psicológica o neuropsicológica) llenada por el padre, con un análisis
// clínico ejecutivo redactado por la IA, y lo guarda en `reportes_generados`
// para que aparezca automáticamente en la pestaña "Historial & IA" del paciente.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { buildClinicalContext } from '@/lib/ai-context-builder'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  PageNumber, Footer,
} from 'docx'
import {
  tituloPrincipal, tituloSeccion, subseccion, parrafo, items,
  tablaDatosGenerales, recomendaciones, piePaginaOficial,
  generarIniciales, generarCodigoDocumento, portadaInstitucional,
  selloQRVerificacionAsync, DOC_NUMBERING, DOC_PAGE_PROPS,
} from '@/lib/santi-report-template'
import { registrarDocumentoEmitido } from '@/lib/registrar-documento'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

const BD = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const BDR = { top: BD, bottom: BD, left: BD, right: BD }

// ─── Mapeo de IDs internos → etiquetas legibles del template oficial ────
const LABELS_NEURO: Record<string, { seccion: string; pregunta: string }> = {
  fam_padre_nombre:           { seccion: 'Datos Familiares', pregunta: 'Padre — Nombre y apellidos' },
  fam_padre_edad:             { seccion: 'Datos Familiares', pregunta: 'Padre — Edad' },
  fam_padre_instruccion:      { seccion: 'Datos Familiares', pregunta: 'Padre — Grado de instrucción' },
  fam_padre_ocupacion:        { seccion: 'Datos Familiares', pregunta: 'Padre — Ocupación' },
  fam_madre_nombre:           { seccion: 'Datos Familiares', pregunta: 'Madre — Nombre y apellidos' },
  fam_madre_edad:             { seccion: 'Datos Familiares', pregunta: 'Madre — Edad' },
  fam_madre_instruccion:      { seccion: 'Datos Familiares', pregunta: 'Madre — Grado de instrucción' },
  fam_madre_ocupacion:        { seccion: 'Datos Familiares', pregunta: 'Madre — Ocupación' },
  fam_hermanos:               { seccion: 'Datos Familiares', pregunta: 'Otros familiares que conviven' },

  perfil_preocupaciones:      { seccion: 'Perfil Actual', pregunta: 'Principales preocupaciones' },
  perfil_desde_cuando:        { seccion: 'Perfil Actual', pregunta: '¿Desde cuándo observa estas conductas?' },

  pren_duracion:              { seccion: 'Historia Evolutiva — Prenatal', pregunta: 'Duración del embarazo' },
  pren_programado:            { seccion: 'Historia Evolutiva — Prenatal', pregunta: '¿Embarazo programado?' },
  pren_salud:                 { seccion: 'Historia Evolutiva — Prenatal', pregunta: 'Salud durante el embarazo / enfermedades' },
  pren_edad_papa:             { seccion: 'Historia Evolutiva — Prenatal', pregunta: 'Edad del papá al nacer el hijo/a' },
  pren_edad_mama:             { seccion: 'Historia Evolutiva — Prenatal', pregunta: 'Edad de la mamá al nacer' },
  pren_medicamentos:          { seccion: 'Historia Evolutiva — Prenatal', pregunta: 'Medicamentos durante el embarazo' },
  pren_comentarios:           { seccion: 'Historia Evolutiva — Prenatal', pregunta: 'Comentarios adicionales' },

  peri_duracion_gestacion:    { seccion: 'Historia Evolutiva — Perinatal', pregunta: 'Duración de la gestación' },
  peri_tipo_parto:            { seccion: 'Historia Evolutiva — Perinatal', pregunta: 'Tipo de parto' },
  peri_motivo_cesarea:        { seccion: 'Historia Evolutiva — Perinatal', pregunta: 'Motivo de cesárea' },
  peri_comentarios:           { seccion: 'Historia Evolutiva — Perinatal', pregunta: 'Comentarios adicionales' },

  post_lloro:                 { seccion: 'Historia Evolutiva — Postnatal', pregunta: '¿Lloró al nacer?' },
  post_oxigeno:               { seccion: 'Historia Evolutiva — Postnatal', pregunta: '¿Necesitó oxígeno?' },
  post_incubadora:            { seccion: 'Historia Evolutiva — Postnatal', pregunta: 'Incubadora y duración' },
  post_color:                 { seccion: 'Historia Evolutiva — Postnatal', pregunta: 'Color al nacer' },
  post_comentarios:           { seccion: 'Historia Evolutiva — Postnatal', pregunta: 'Comentarios adicionales' },

  med_enfermedades:           { seccion: 'Historia Médica', pregunta: 'Enfermedades presentadas' },
  med_enfermedades_detalle:   { seccion: 'Historia Médica', pregunta: 'Detalles (edad/duración)' },
  med_accidentes:             { seccion: 'Historia Médica', pregunta: 'Accidentes' },
  med_cambios_post:           { seccion: 'Historia Médica', pregunta: 'Cambios tras enfermedades/accidentes' },
  med_examen_neuro:           { seccion: 'Historia Médica', pregunta: 'Examen neurológico previo' },
  med_diagnostico:            { seccion: 'Historia Médica', pregunta: 'Diagnósticos previos' },
  med_sensorial:              { seccion: 'Historia Médica', pregunta: 'Dificultades visuales/auditivas' },
  med_terapias_previas:       { seccion: 'Historia Médica', pregunta: 'Terapias previas' },
  med_otros:                  { seccion: 'Historia Médica', pregunta: 'Otros datos médicos' },

  mot_sentarse:               { seccion: 'Desarrollo Muscular', pregunta: 'Edad: sentarse solo/a' },
  mot_gatear:                 { seccion: 'Desarrollo Muscular', pregunta: 'Edad: gatear' },
  mot_pararse:                { seccion: 'Desarrollo Muscular', pregunta: 'Edad: pararse solo/a' },
  mot_primeros_pasos:         { seccion: 'Desarrollo Muscular', pregunta: 'Edad: primeros pasos' },
  mot_caminar:                { seccion: 'Desarrollo Muscular', pregunta: 'Edad: caminar solo/a' },
  mot_dificultades:           { seccion: 'Desarrollo Muscular', pregunta: 'Dificultades motoras observadas' },
  mot_actividad:              { seccion: 'Desarrollo Muscular', pregunta: 'Nivel de actividad' },
  mot_balanceo:               { seccion: 'Desarrollo Muscular', pregunta: 'Movimientos automáticos' },
  mot_agitados:               { seccion: 'Desarrollo Muscular', pregunta: 'Movimientos agitados' },
  mot_mano_preferida:         { seccion: 'Desarrollo Muscular', pregunta: 'Mano preferida' },

  leng_primera_edad:          { seccion: 'Habla y Lenguaje', pregunta: 'Edad de primeras palabras' },
  leng_primeras_cuales:       { seccion: 'Habla y Lenguaje', pregunta: 'Primeras palabras' },
  leng_dificultad_pronunciar: { seccion: 'Habla y Lenguaje', pregunta: 'Dificultad para pronunciar' },
  leng_dificultad_actual:     { seccion: 'Habla y Lenguaje', pregunta: 'Dificultad actual al hablar' },
  leng_comprende:             { seccion: 'Habla y Lenguaje', pregunta: '¿Entiende lo que se le dice?' },
  leng_comentarios:           { seccion: 'Habla y Lenguaje', pregunta: 'Comentarios adicionales' },

  hab_lactancia:              { seccion: 'Hábitos — Alimentos', pregunta: 'Tipo de lactancia' },
  hab_lactancia_duracion:     { seccion: 'Hábitos — Alimentos', pregunta: 'Duración de la lactancia' },
  hab_come_solo:              { seccion: 'Hábitos — Alimentos', pregunta: '¿Come solo/a?' },
  hab_apetito:                { seccion: 'Hábitos — Alimentos', pregunta: 'Apetito y rechazos' },
  hab_control_orina_edad:     { seccion: 'Hábitos — Higiene', pregunta: 'Edad: control de orina' },
  hab_control_heces_edad:     { seccion: 'Hábitos — Higiene', pregunta: 'Edad: control de heces' },
  hab_control_actual:         { seccion: 'Hábitos — Higiene', pregunta: 'Control actual' },
  hab_orina_cama:             { seccion: 'Hábitos — Higiene', pregunta: 'Edad final de mojar la cama' },
  hab_sueno_primeros:         { seccion: 'Hábitos — Sueño', pregunta: 'Sueño en los primeros 2 años' },
  hab_medicamento_dormir:     { seccion: 'Hábitos — Sueño', pregunta: 'Medicamento para dormir' },
  hab_horas_sueno:            { seccion: 'Hábitos — Sueño', pregunta: 'Horas que duerme' },
  hab_calidad_sueno:          { seccion: 'Hábitos — Sueño', pregunta: 'Comportamiento durante el sueño' },
  hab_mandados:               { seccion: 'Independencia Personal', pregunta: '¿Hace mandados?' },
  hab_ayuda_casa:             { seccion: 'Independencia Personal', pregunta: '¿Ayuda en casa?' },
  hab_viste_solo:             { seccion: 'Independencia Personal', pregunta: '¿Se viste solo/a?' },

  edu_edad_inicio:            { seccion: 'Historia Educativa', pregunta: 'Edad de inicio escolar' },
  edu_agrado:                 { seccion: 'Historia Educativa', pregunta: '¿Mostró agrado por el colegio?' },
  edu_cambios_colegio:        { seccion: 'Historia Educativa', pregunta: 'Cambios de colegio' },
  edu_dificultades_relaciones:{ seccion: 'Historia Educativa', pregunta: 'Dificultades con maestros/compañeros' },
  edu_conducta_aula:          { seccion: 'Historia Educativa', pregunta: 'Conducta en clase y recreo' },
  edu_resumen:                { seccion: 'Historia Educativa', pregunta: 'Resumen escolar' },

  jue_solo:                   { seccion: 'Juegos', pregunta: '¿Juega solo?' },
  jue_preferidos:             { seccion: 'Juegos', pregunta: 'Juegos preferidos' },
  jue_dirige:                 { seccion: 'Juegos', pregunta: 'Rol con otros niños' },
  jue_tiempo_libre:           { seccion: 'Juegos', pregunta: 'Tiempo libre' },

  din_estructura:             { seccion: 'Dinámica Familiar', pregunta: 'Composición familiar' },
  din_convive:                { seccion: 'Dinámica Familiar', pregunta: '¿Con quién vive?' },
  din_crianza_otros:          { seccion: 'Dinámica Familiar', pregunta: 'Otras figuras en la crianza' },
  din_dinamica:               { seccion: 'Dinámica Familiar', pregunta: 'Dinámica familiar' },
  din_cambios:                { seccion: 'Dinámica Familiar', pregunta: 'Cambios familiares significativos' },
  din_estilo_crianza:         { seccion: 'Dinámica Familiar', pregunta: 'Estilo de crianza predominante' },
  din_conducta_casa:          { seccion: 'Dinámica Familiar', pregunta: 'Conducta en casa' },
  din_conductas_preocupan:    { seccion: 'Dinámica Familiar', pregunta: 'Conductas que preocupan' },
  din_frente_a_limites:       { seccion: 'Dinámica Familiar', pregunta: 'Reacción ante límites y frustración' },
  din_le_gusta:               { seccion: 'Dinámica Familiar', pregunta: 'Le gusta hacer en su tiempo libre' },
  ant_familiares:             { seccion: 'Antecedentes Familiares', pregunta: 'Antecedentes presentes' },
  ant_familiares_detalle:     { seccion: 'Antecedentes Familiares', pregunta: 'Detalle de los antecedentes' },
}

// ─── Helpers de formato ─────────────────────────────────────────────────
function title(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text, bold: true, size: 40, font: 'Arial', color: '5B21B6' })],
  })
}
function subtitle(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 360 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: '9CA3AF' })],
  })
}
function h2(text: string, color = '1E293B') {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 4 } },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color })],
  })
}
function h3(text: string) {
  return new Paragraph({
    spacing: { before: 180, after: 60 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color: '4C1D95' })],
  })
}
function pp(text: string) {
  return new Paragraph({
    spacing: { before: 40, after: 60 },
    children: [new TextRun({ text, size: 20, font: 'Arial', color: '374151' })],
  })
}
function kv(label: string, value: string) {
  return new TableRow({
    children: [
      new TableCell({
        borders: BDR, width: { size: 3200, type: WidthType.DXA },
        shading: { fill: 'F5F3FF', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18, font: 'Arial', color: '5B21B6' })] })],
      }),
      new TableCell({
        borders: BDR, width: { size: 6160, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value || '—', size: 18, font: 'Arial', color: '1E293B' })] })],
      }),
    ],
  })
}
function infoBox(text: string, fill = 'EDE9FE', color = '5B21B6') {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill, type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 19, font: 'Arial', color, italics: true })],
  })
}

function fmtRespuesta(v: any): string {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

// ─── Endpoint ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id } = await req.json()
    if (!evaluacion_id) return NextResponse.json({ error: 'evaluacion_id requerido' }, { status: 400 })

    // Cargar evaluación + paciente
    const { data: eval_, error } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('*')
      .eq('id', evaluacion_id)
      .maybeSingle()
    if (error) throw error
    if (!eval_) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })
    if (!eval_.anamnesis_especifica) {
      return NextResponse.json({ error: 'La anamnesis aún no está completada' }, { status: 400 })
    }

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, name, birth_date, age, diagnosis, parent_id')
      .eq('id', eval_.child_id)
      .maybeSingle()
    if (!child) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // Profile del padre
    let parentName = ''
    if ((child as any).parent_id) {
      const { data: parent } = await supabaseAdmin
        .from('profiles').select('full_name, phone').eq('id', (child as any).parent_id).maybeSingle()
      parentName = (parent as any)?.full_name || ''
    }

    const tipoInforme = eval_.recomendacion === 'psicologica' ? 'Psicológica Emocional' : 'Neuropsicológica'
    const isNeuro = eval_.recomendacion !== 'psicologica'

    // ── Llamar a la IA para que escriba el análisis ejecutivo ──
    const fmtPorSecciones = () => {
      const map: Record<string, { pregunta: string; valor: string }[]> = {}
      Object.entries(eval_.anamnesis_especifica || {}).forEach(([k, v]) => {
        const meta = LABELS_NEURO[k] || { seccion: 'Otros', pregunta: k.replace(/_/g, ' ') }
        if (!map[meta.seccion]) map[meta.seccion] = []
        map[meta.seccion].push({ pregunta: meta.pregunta, valor: fmtRespuesta(v) })
      })
      return Object.entries(map)
        .map(([sec, items]) => `## ${sec}\n${items.map(i => `- ${i.pregunta}: ${i.valor}`).join('\n')}`)
        .join('\n\n')
    }

    const intakeTxt = Object.entries(eval_.respuestas_intake || {})
      .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${fmtRespuesta(v)}`).join('\n')

    // Cerebro IA: protocolos clínicos relevantes para fundamentar el informe
    const motivoConsulta = String(eval_.respuestas_intake?.motivo_principal || '')
    const queryKB = `${motivoConsulta} ${(child as any).diagnosis || ''} ${tipoInforme} indicadores criterios DSM CIE-11 ABLLS AFLS hitos desarrollo`
    const knowledgeCtx = await buildClinicalContext(queryKB, 10).catch(() => '')

    const analisisIA = await callGroqSimple(
      `Eres neuropsicóloga clínica senior de SANTI (Perú). Vas a redactar el INFORME PROFESIONAL de una anamnesis ${tipoInforme.toLowerCase()} para incluir en el historial clínico del paciente. Lenguaje técnico riguroso, párrafos fluidos, sin bullets. Cita observaciones concretas de los datos.

FORMATO OBLIGATORIO (respétalo al pie de la letra para que el documento se vea profesional):
- Estructura el informe en estas 5 secciones, EN ESTE ORDEN:
   Motivo de consulta y antecedentes principales
   Análisis del desarrollo y antecedentes médicos relevantes
   Hallazgos en el ámbito ${isNeuro ? 'cognitivo, de aprendizaje y lenguaje' : 'socioemocional y conductual'}
   Dinámica familiar y factores contextuales
   Conclusiones e impresión diagnóstica preliminar
- Escribe el TÍTULO de cada sección en su PROPIA LÍNEA, tal cual (con su primera letra en mayúscula, el resto en minúscula), SIN numeración, SIN asteriscos, SIN almohadillas y SIN dos puntos al final.
- Debajo de cada título, 2-3 párrafos de prosa continua. NO uses viñetas ni guiones.
- NO uses asteriscos (*) ni símbolos de markdown en ninguna parte del texto.
- Total máximo 800 palabras.
- Sé prudente con afirmaciones diagnósticas — habla de "indicadores compatibles con", "rasgos sugerentes de", etc.`,
      `# DATOS DEL PACIENTE
- Nombre: ${child.name}
- Edad: ${(child as any).age || '—'}
- Fecha nacimiento: ${(child as any).birth_date || '—'}
- Diagnóstico previo: ${(child as any).diagnosis || 'Ninguno'}
- Padre/madre informante: ${parentName || '—'}

# INTAKE INICIAL
${intakeTxt || '_(sin datos)_'}

# 2ª ANAMNESIS (${tipoInforme.toUpperCase()})
${fmtPorSecciones()}

# CONTEXTO CLÍNICO PREVIO (RECOMENDACIÓN IA)
- Tipo de evaluación recomendada: ${tipoInforme}
- Razonamiento previo: ${eval_.recomendacion_razon || '—'}

${knowledgeCtx ? `# 📚 PROTOCOLOS CLÍNICOS Y GUÍAS DE REFERENCIA (Cerebro IA SANTI)
${knowledgeCtx}

INSTRUCCIONES ADICIONALES:
- Cuando hagas afirmaciones clínicas, FUNDAMENTA con criterios de los protocolos arriba (ABLLS-R, AFLS, DSM-5, CIE-11, guías).
- Cita áreas/hitos específicos (ej: "compatible con criterios del área de manding del ABLLS-R" o "indicadores funcionales por debajo del rango esperado según AFLS para su edad").
- Sé técnico pero claro.
` : ''}

---
Redacta el INFORME COMPLETO ahora siguiendo la estructura indicada.`,
      { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 1500 }
    )

    // ── Construir documento ──
    const hoy = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
    const hoyISO = new Date().toISOString().slice(0, 10)
    const docNum = `ANAM-${hoyISO.replace(/-/g, '')}-${(child.id || '').slice(0, 6).toUpperCase()}`
    const nombreCap = (child.name || 'Paciente').split(' ').map((w: string) =>
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    const fileName = `Anamnesis_${isNeuro ? 'Neuropsicologica' : 'Psicologica'}_${nombreCap.replace(/\s+/g, '_')}_${hoyISO}.docx`

    // Agrupar respuestas por sección
    const seccionesMap: Record<string, [string, string][]> = {}
    Object.entries(eval_.anamnesis_especifica || {}).forEach(([k, v]) => {
      const meta = LABELS_NEURO[k] || { seccion: 'Otros', pregunta: k.replace(/_/g, ' ') }
      if (!seccionesMap[meta.seccion]) seccionesMap[meta.seccion] = []
      seccionesMap[meta.seccion].push([meta.pregunta, fmtRespuesta(v)])
    })

    const seccionesEnOrden = [
      'Datos Familiares',
      'Perfil Actual',
      'Historia Evolutiva — Prenatal',
      'Historia Evolutiva — Perinatal',
      'Historia Evolutiva — Postnatal',
      'Historia Médica',
      'Desarrollo Muscular',
      'Habla y Lenguaje',
      'Hábitos — Alimentos',
      'Hábitos — Higiene',
      'Hábitos — Sueño',
      'Independencia Personal',
      'Historia Educativa',
      'Juegos',
      'Dinámica Familiar',
      'Antecedentes Familiares',
      'Otros',
    ]

    // ─── CONSTRUCCIÓN CON ESTILO PROFESIONAL DEL CENTRO ──────────────────
    //   Basado en los modelos oficiales LuTr (informe de tratamiento) y
    //   SoRo (informe de evaluación). Sin emojis, colores sobrios, prosa formal.

    const iniciales = generarIniciales(child.name || 'Paciente')

    // Convierte un texto con **negritas** inline en TextRuns, limpiando
    // cualquier asterisco/almohadilla suelto que deje el modelo.
    const runsConNegritas = (texto: string, baseColor = '374151', size = 20): TextRun[] => {
      // Quitar viñetas iniciales (•, -, *) que a veces agrega el modelo
      const limpio = texto.replace(/^\s*[•\-•]\s+/, '')
      const partes = limpio.split(/(\*\*[^*]+\*\*)/g)
      const runs: TextRun[] = []
      for (const p of partes) {
        if (!p) continue
        if (p.startsWith('**') && p.endsWith('**')) {
          const t = p.slice(2, -2)
          if (t) runs.push(new TextRun({ text: t, bold: true, size, font: 'Arial', color: '1E293B' }))
        } else {
          const t = p.replace(/[*#]+/g, '').trim()
          // re-agregar el espacio si la parte original tenía espacios alrededor
          const conEspacio = p.match(/^\s/) ? ' ' + t : t
          if (t) runs.push(new TextRun({ text: conEspacio + (p.match(/\s$/) ? ' ' : ''), size, font: 'Arial', color: baseColor }))
        }
      }
      if (runs.length === 0) runs.push(new TextRun({ text: '', size, font: 'Arial', color: baseColor }))
      return runs
    }

    const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

    // Parsear el análisis IA: detecta títulos (con *, **, #, numeración o EN MAYÚSCULAS)
    // y los renderiza como subtítulos elegantes; el resto, como párrafos justificados.
    const parsearAnalisisIA = (texto: string): (Paragraph | Table)[] => {
      const out: (Paragraph | Table)[] = []
      const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
      for (const raw of lineas) {
        const l = raw
        // Línea separadora suelta (---, ***, ___) → ignorar
        if (/^[-—*_#]{2,}$/.test(l)) continue

        // Quitar numeración inicial "1. " / "1) "
        const sinNum = l.replace(/^\d+[\.\)]\s*/, '')
        // Título envuelto en *...* o **...** que ocupa TODA la línea
        const soloBold = sinNum.match(/^\*{1,2}(.+?)\*{1,2}:?\s*$/)
        // Título con almohadillas markdown (#, ##)
        const conHash = sinNum.match(/^#{1,4}\s*(.+?):?\s*$/)
        let headingText: string | null = soloBold ? soloBold[1] : conHash ? conHash[1] : null

        // Título EN MAYÚSCULAS sin marcas (ej: "MOTIVO DE CONSULTA")
        const limpioCaps = sinNum.replace(/[*#:]/g, '').trim()
        const esCaps =
          !headingText &&
          limpioCaps.length > 2 && limpioCaps.length < 80 &&
          /[A-ZÁÉÍÓÚÑ]/.test(limpioCaps) && !/[a-záéíóúñ]/.test(limpioCaps)
        if (esCaps) headingText = limpioCaps

        if (headingText) {
          let title = headingText.replace(/[*#]/g, '').replace(/^\d+[\.\)]\s*/, '').replace(/:$/, '').trim()
          // Normalizar títulos que vienen TODO EN MAYÚSCULAS
          if (title === title.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(title)) title = capFirst(title)
          out.push(new Paragraph({
            spacing: { before: 260, after: 90 },
            children: [new TextRun({ text: title, bold: true, size: 22, font: 'Arial', color: '4C1D95' })],
          }))
        } else {
          out.push(new Paragraph({
            spacing: { before: 40, after: 120 },
            alignment: AlignmentType.JUSTIFIED,
            children: runsConNegritas(l),
          }))
        }
      }
      return out
    }

    // Sello QR de verificación (async)
    const sellosVerif = await selloQRVerificacionAsync({
      codigoDoc: docNum,
      fechaEmision: hoy,
      especialista: 'Equipo Clínico SANTI',
    })

    const seccionesDocx: (Paragraph | Table)[] = [
      // ── Portada institucional profesional ──
      ...portadaInstitucional({
        tipoInforme: `INFORME DE ANAMNESIS ${tipoInforme.toUpperCase()}`,
        nombrePaciente: child.name || 'Paciente',
        edadPaciente: (child as any).age != null ? `${(child as any).age} años` : '—',
        diagnostico: (child as any).diagnosis || 'En evaluación clínica',
        especialista: 'Equipo Clínico SANTI',
        credenciales: 'Centro de Neuropsicología y Terapias',
        fechaEmision: hoy,
        codigoDoc: docNum,
      }),
      // (la portada ya incluye su propio salto de página)

      // ── Datos generales (estilo LuTr/SoRo) ──
      tituloSeccion('Datos Generales'),
      tablaDatosGenerales([
        ['Apellidos y nombres', child.name || '—'],
        ['Fecha de nacimiento', (child as any).birth_date
          ? new Date((child as any).birth_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
          : '—'],
        ['Edad', (child as any).age != null ? `${(child as any).age} años` : '—'],
        ['Diagnóstico previo', (child as any).diagnosis || 'Ninguno reportado'],
        ['Tipo de informe', `Anamnesis ${tipoInforme}`],
        ['Informante', parentName || '—'],
        ['Fecha de la anamnesis', eval_.anamnesis_completada_en
          ? new Date(eval_.anamnesis_completada_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
          : hoy],
        ['Fecha de entrega del informe', hoy],
        ['N° de documento', docNum],
      ]),

      // ── Análisis clínico ──
      tituloSeccion('Análisis Clínico'),
      parrafo('El presente análisis se elabora a partir de la información proporcionada por el padre/madre informante en la ficha de anamnesis ' + tipoInforme.toLowerCase() + ', y se complementa con criterios clínicos de referencia. El contenido es preliminar y deberá ser corroborado durante las sesiones de evaluación directa con el paciente.'),
      ...parsearAnalisisIA(analisisIA),

      // ── Respuestas detalladas ──
      tituloSeccion('Respuestas detalladas por área'),
      parrafo('A continuación se transcriben las respuestas brindadas por el informante, organizadas según las áreas establecidas en el protocolo oficial de anamnesis del centro:'),
    ]

    // Bloques por sección con tabla de pregunta/respuesta
    for (const sec of seccionesEnOrden) {
      const itemsSec = seccionesMap[sec]
      if (!itemsSec || itemsSec.length === 0) continue

      seccionesDocx.push(new Paragraph({
        spacing: { before: 280, after: 80 },
        children: [new TextRun({
          text: sec,
          bold: true,
          size: 21,
          font: 'Arial',
          color: '1E293B',
        })],
      }))
      seccionesDocx.push(tablaDatosGenerales(itemsSec))
    }

    // ── Observaciones finales ──
    seccionesDocx.push(
      tituloSeccion('Observaciones finales'),
      parrafo(`El presente informe fue generado a partir de la ficha de anamnesis ${tipoInforme.toLowerCase()} completada por la familia el ${hoy}. La información aquí consignada constituye una base preliminar para el proceso de evaluación clínica directa con el paciente y deberá ser corroborada, ampliada y contrastada por el equipo profesional a cargo del caso.`),
      parrafo(`La información contenida en este documento es confidencial y de uso exclusivo del equipo clínico del Centro de Vanty ABA, en el marco del proceso de atención del paciente.`),
      // ── Sello QR ──
      new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }),
      ...sellosVerif,
      new Paragraph({
        spacing: { before: 320, after: 40 },
        children: [new TextRun({
          text: 'Equipo Clínico',
          bold: true,
          size: 20,
          font: 'Arial',
          color: '1E3A8A',
        })],
      }),
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text: 'Vanty ABA',
          size: 18,
          font: 'Arial',
          color: '475569',
        })],
      }),
    )

    const doc = new Document({
      numbering: DOC_NUMBERING,
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [{
        properties: DOC_PAGE_PROPS,
        footers: { default: piePaginaOficial() },
        children: seccionesDocx,
      }],
    })

    // Registrar el documento emitido para verificación pública vía QR
    await registrarDocumentoEmitido({
      codigoDoc: docNum,
      childId: child.id,
      tipo: 'anamnesis_inicial',
      pacienteNombre: child.name || 'Paciente',
      pacienteIniciales: iniciales,
      fileName,
      metadata: {
        tipo_anamnesis: tipoInforme,
        recomendacion: eval_.recomendacion,
      },
    })

    const buffer = await Packer.toBuffer(doc)
    const base64Doc = buffer.toString('base64')

    // Guardar en reportes_generados (aparece automáticamente en Historial & IA)
    const tipoReporte = isNeuro ? 'anamnesis_neuropsicologica' : 'anamnesis_psicologica'
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('reportes_generados')
      .insert({
        child_id: child.id,
        tipo_reporte: tipoReporte,
        titulo: `Anamnesis ${tipoInforme} - ${nombreCap}`,
        nombre_archivo: fileName,
        file_data: base64Doc,
        mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        tamano_bytes: Math.round((base64Doc.length * 3) / 4),
        fecha_generacion: new Date().toISOString(),
        generado_por: 'Padres + IA',
        source_id: evaluacion_id,
      })
      .select()
      .single()
    if (insErr) throw insErr

    return NextResponse.json({
      ok: true,
      reporte_id: (inserted as any)?.id,
      file_name: fileName,
      bytes: Math.round((base64Doc.length * 3) / 4),
    })
  } catch (e: any) {
    console.error('[evaluacion-inicial][generar-informe-word]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
