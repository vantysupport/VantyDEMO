// app/api/evaluacion-inicial/generar-informe-word/route.ts
//
// Genera un informe Word profesional a partir de la 2ª anamnesis
// (psicológica o neuropsicológica) llenada por el padre, con un análisis
// clínico ejecutivo redactado por la IA, y lo guarda en `reportes_generados`
// para que aparezca automáticamente en la pestaña "Historial & IA" del paciente.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  PageNumber, Footer,
} from 'docx'

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

    const analisisIA = await callGroqSimple(
      `Eres neuropsicóloga clínica senior de SANTI (Perú). Vas a redactar el INFORME PROFESIONAL de una anamnesis ${tipoInforme.toLowerCase()} para incluir en el historial clínico del paciente. Lenguaje técnico riguroso, párrafos fluidos, sin bullets. Cita observaciones concretas de los datos. Estructurado en 5 secciones cortas:

1. **Motivo de consulta y antecedentes principales**
2. **Análisis del desarrollo y antecedentes médicos relevantes**
3. **Hallazgos en el ámbito ${isNeuro ? 'cognitivo / aprendizaje / lenguaje' : 'socioemocional y conductual'}**
4. **Dinámica familiar y factores contextuales**
5. **Conclusiones e impresión diagnóstica preliminar**

Cada sección 2-3 párrafos. Total máximo 800 palabras. No incluyas títulos numerados (solo los nombres en mayúsculas o negrita simulada con asteriscos). Sé prudente con afirmaciones diagnósticas — habla de "indicadores compatibles con", "rasgos sugerentes de", etc.`,
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

    const seccionesDocx: (Paragraph | Table)[] = [
      // Portada
      new Paragraph({
        spacing: { before: 0, after: 20 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '5B21B6', space: 8 } },
        children: [
          new TextRun({ text: 'NEUROPSICOLOGÍA Y TERAPIAS SANTI', bold: true, size: 38, font: 'Arial', color: '5B21B6' }),
          new TextRun({ text: '  ·  Centro Especializado', size: 22, font: 'Arial', color: '9CA3AF' }),
        ],
      }),
      title(`Informe de Anamnesis ${tipoInforme}`),
      subtitle(`Doc. Nº ${docNum}   ·   Emitido: ${hoy}`),

      // Datos del paciente
      h2('I.  DATOS DEL PACIENTE'),
      new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [3200, 6160],
        rows: [
          kv('Nombre', child.name || '—'),
          kv('Fecha de nacimiento', (child as any).birth_date || '—'),
          kv('Edad', (child as any).age != null ? `${(child as any).age} años` : '—'),
          kv('Diagnóstico previo', (child as any).diagnosis || 'Ninguno reportado'),
          kv('Informante', parentName || '—'),
          kv('Fecha de la anamnesis', eval_.anamnesis_completada_en
            ? new Date(eval_.anamnesis_completada_en).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
            : hoy),
          kv('Tipo de evaluación', tipoInforme),
        ],
      }),

      // Análisis IA
      h2('II.  ANÁLISIS CLÍNICO EJECUTIVO'),
      infoBox('Análisis generado a partir de la información proporcionada por la familia. Debe ser corroborado en sesión clínica.', 'EDE9FE', '5B21B6'),
      ...analisisIA.split('\n')
        .filter(l => l.trim())
        .map(l => {
          const isBold = /^\*\*.+\*\*$/.test(l.trim()) || /^[A-ZÁÉÍÓÚÑ\s\d\.]+$/.test(l.trim()) && l.trim().length < 80
          if (isBold) return h3(l.replace(/\*\*/g, '').trim())
          return pp(l)
        }),

      // Respuestas por sección
      h2('III.  RESPUESTAS DETALLADAS POR ÁREA'),
      pp('A continuación se presentan todas las respuestas proporcionadas por el informante, organizadas según las áreas de la anamnesis oficial:'),
    ]

    for (const sec of seccionesEnOrden) {
      const items = seccionesMap[sec]
      if (!items || items.length === 0) continue
      seccionesDocx.push(h3(sec))
      seccionesDocx.push(new Table({
        width: { size: 9360, type: WidthType.DXA }, columnWidths: [4000, 5360],
        rows: items.map(([q, a]) => kv(q, a)),
      }))
    }

    // Cierre
    seccionesDocx.push(
      h2('IV.  OBSERVACIONES FINALES'),
      pp(`Este informe fue generado a partir de la anamnesis ${tipoInforme.toLowerCase()} completada por la familia el ${hoy}. Su contenido es preliminar y debe ser validado, ampliado y contrastado durante las sesiones de evaluación clínica directa con el paciente.`),
      pp(`Documento generado automáticamente. La información contenida es CONFIDENCIAL y de uso exclusivo del equipo clínico de Neuropsicología y Terapias SANTI.`),
      new Paragraph({
        spacing: { before: 400 },
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 8 } },
        children: [new TextRun({ text: 'Equipo Clínico — Neuropsicología y Terapias SANTI', size: 20, font: 'Arial', color: '5B21B6', bold: true })],
      }),
      new Paragraph({
        spacing: { before: 40 },
        children: [new TextRun({ text: `${hoy}  ·  Documento confidencial`, size: 16, font: 'Arial', color: '94A3B8' })],
      }),
    )

    const doc = new Document({
      numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } }] }] },
      styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
      sections: [{
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `SANTI · ${fileName} · `, size: 16, font: 'Arial', color: '9CA3AF' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '9CA3AF' }),
              ],
            })],
          }),
        },
        children: seccionesDocx,
      }],
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
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
