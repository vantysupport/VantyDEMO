export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { buildAdminChatContext } from '@/lib/ai-context-builder';

// FIX: calcular edad correctamente desde birth_date cuando age es null
function calcularEdad(birthDate: string | null | undefined, ageFallback: number | null | undefined): string {
  if (birthDate) {
    const hoy = new Date()
    const nacimiento = new Date(birthDate)
    const diff = hoy.getFullYear() - nacimiento.getFullYear()
    const m = hoy.getMonth() - nacimiento.getMonth()
    const edad = (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) ? diff - 1 : diff
    if (edad >= 0 && edad < 120) return `${edad} años`
  }
  if (ageFallback != null && !isNaN(Number(ageFallback))) return `${ageFallback} años`
  return 'edad no registrada'
}

// Helper: convierte cualquier valor a array de strings de forma segura
function toArr(val: any): string[] {
  if (!val) return []
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string') return val.split(/[,;•\n]+/).map(s => s.trim()).filter(Boolean)
  if (typeof val === 'object') return Object.values(val).map(String)
  return [String(val)]
}


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: Request) {
  try {
    const { question, childId, useWebSearch } = await req.json();

    // Auto-detect: si la pregunta contiene palabras que implican necesidad de info externa/actualizada
    const triggers = /(?:busc[aá] en internet|busc[aá] online|investiga|última investigación|reciente|2025|2026|publicación|estudio nuevo|paper|jaba|según.+autores|qué dicen los expertos|cuál es la evidencia|web|noticias)/i
    const autoWebSearch = triggers.test(question || '')
    const usarWeb = useWebSearch || autoWebSearch
    const userLocale: string = req.headers.get('x-locale') || 'es'

    // Validaciones iniciales
    if (!childId) return NextResponse.json({ text: "⚠️ Selecciona un paciente primero." });


    // ===========================================================================
    // 1. CARGAR DATOS DEL PACIENTE
    // ===========================================================================
    const { data: child } = await supabase
      .from('children')
      .select('name, birth_date, age, diagnosis')
      .eq('id', childId)
      .single();

    // ===========================================================================
    // 2. CARGAR ANAMNESIS
    // ===========================================================================
    // Buscar anamnesis: primero en anamnesis_completa, luego en parent_forms
    const { data: anamnesisAdmin } = await supabase
      .from('anamnesis_completa')
      .select('datos, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let anamnesis = anamnesisAdmin;
    if (!anamnesis) {
      const { data: pf } = await supabase
        .from('parent_forms')
        .select('responses, completed_at, form_title')
        .eq('child_id', childId)
        .eq('status', 'completed')
        .in('form_type', ['anamnesis', 'historia_familiar', 'Historia Familiar y del Desarrollo'])
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      if (pf) anamnesis = { datos: pf.responses, created_at: pf.completed_at };
    }

    // ===========================================================================
    // 3. CARGAR HISTORIAL ABA (últimas 15 sesiones)
    // ===========================================================================
    const { data: historyABA } = await supabase
      .from('registro_aba')
      .select('fecha_sesion, datos')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(15);

    // ===========================================================================
    // 4. CARGAR VISITAS DOMICILIARIAS
    // ===========================================================================
    const { data: historyEntorno } = await supabase
      .from('registro_entorno_hogar')
      .select('fecha_visita, datos, created_at')
      .eq('child_id', childId)
      .order('fecha_visita', { ascending: false })
      .limit(5);

    // ===========================================================================
    // 5. CARGAR EVALUACIONES PROFESIONALES
    // ===========================================================================
    
    // BRIEF-2 - Funciones Ejecutivas
    const { data: brief2 } = await supabase
      .from('evaluacion_brief2')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // ADOS-2 - Autismo
    const { data: ados2 } = await supabase
      .from('evaluacion_ados2')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Vineland-3 - Conducta Adaptativa
    const { data: vineland3 } = await supabase
      .from('evaluacion_vineland3')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // WISC-V - Coeficiente Intelectual
    const { data: wiscv } = await supabase
      .from('evaluacion_wiscv')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // BASC-3 - Conducta y Emociones
    const { data: basc3 } = await supabase
      .from('evaluacion_basc3')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // ===========================================================================
    // 5b. CARGAR PROGRAMAS ABA ACTIVOS CON SESIONES
    // ===========================================================================
    const { data: programasABA } = await supabase
      .from('programas_aba')
      .select(`
        id, titulo, area, fase_actual, estado, criterio_dominio_pct, objetivo_lp,
        objetivos_cp(numero_set, descripcion, estado)
      `)
      .eq('child_id', childId)
      .order('updated_at', { ascending: false })
      .limit(10)

    // Sesiones por programa (ordenadas, últimas 8 por programa)
    let sesionesPorPrograma: Record<string, any[]> = {}
    if (programasABA && programasABA.length > 0) {
      const pIds = (programasABA as any[]).map((p: any) => p.id)
      const { data: sesionesABA } = await supabase
        .from('sesiones_datos_aba')
        .select('programa_id, fecha, porcentaje_exito, fase, nivel_ayuda, notas')
        .in('programa_id', pIds)
        .order('fecha', { ascending: false })
        .limit(80)
      if (sesionesABA) {
        for (const s of sesionesABA as any[]) {
          if (!sesionesPorPrograma[s.programa_id]) sesionesPorPrograma[s.programa_id] = []
          if (sesionesPorPrograma[s.programa_id].length < 8) sesionesPorPrograma[s.programa_id].push(s)
        }
      }
    }

    // ===========================================================================
    // 6. CARGAR FORMULARIOS COMPLETADOS (NeuroFormas y formularios de padres)
    // ===========================================================================
    const { data: formResponses } = await supabase
      .from('form_responses')
      .select('form_type, form_title, responses, ai_analysis, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(15);

    // ===========================================================================
    // 6b. CARGAR FORMULARIOS COMPLETADOS POR LOS PADRES
    // ===========================================================================
    const { data: parentFormsData } = await supabase
      .from('parent_forms')
      .select('form_type, form_title, responses, completed_at')
      .eq('child_id', childId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10);

    // Fichas clínicas completadas (plantillas personalizadas del centro)
    const { data: fichasClinicas } = await supabase
      .from('clinical_template_responses')
      .select('*, clinical_templates(name, category)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Documentos subidos al expediente del paciente — CON texto extraído
    //   (la IA debe poder LEER el contenido, no solo ver los nombres)
    const { data: documentosPaciente } = await supabase
      .from('patient_documents')
      .select('file_name, category, description, uploader_name, uploader_role, file_type, created_at, extracted_text, extraction_status, extracted_chars')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(20);

    // ===========================================================================
    // 6. CONSTRUIR CONTEXTO CLÍNICO COMPLETO
    // ===========================================================================
    const context = `
🎯 CONTEXTO CLÍNICO INTEGRAL - SISTEMA PROFESIONAL

PACIENTE: ${child?.name || 'Paciente'}
Edad: ${calcularEdad(child?.birth_date, child?.age)}
Diagnóstico: ${child?.diagnosis || 'En evaluación'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 1. EVALUACIONES NEUROPSICOLÓGICAS ESTANDARIZADAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${brief2 ? `
✅ BRIEF-2 (Funciones Ejecutivas)
Fecha: ${new Date(brief2.created_at).toLocaleDateString()}
📊 MÉTRICAS:
  • Inhibición: ${brief2.metricas?.inhibicion || 'N/A'}
  • Flexibilidad: ${brief2.metricas?.flexibilidad || 'N/A'}
  • Control Emocional: ${brief2.metricas?.emocional || 'N/A'}
  • Memoria Trabajo: ${brief2.metricas?.memoria || 'N/A'}
  • Planificación: ${brief2.metricas?.planificacion || 'N/A'}
  • TOTAL: ${brief2.metricas?.total || 'N/A'} (${brief2.metricas?.porcentaje?.toFixed(0) || 0}%)
  • NIVEL RIESGO: ${brief2.metricas?.nivel_riesgo || 'N/A'}

💡 ANÁLISIS IA: ${brief2.datos?.analisis_ia || 'No disponible'}
` : '❌ BRIEF-2: No evaluado'}

${ados2 ? `
✅ ADOS-2 (Diagnóstico Autismo)
Fecha: ${new Date(ados2.created_at).toLocaleDateString()}
📊 MÉTRICAS:
  • Comunicación Social: ${ados2.metricas?.comunicacion || 'N/A'}
  • Interacción Recíproca: ${ados2.metricas?.interaccion || 'N/A'}
  • Juego/Imaginación: ${ados2.metricas?.juego || 'N/A'}
  • Conductas Repetitivas: ${ados2.metricas?.conductas || 'N/A'}
  • PUNTUACIÓN TOTAL: ${ados2.metricas?.total || 'N/A'}
  • SEVERIDAD: ${ados2.metricas?.severidad || 'N/A'}

💡 ANÁLISIS IA: ${ados2.datos?.analisis_diagnostico_ia || 'No disponible'}
` : '❌ ADOS-2: No evaluado'}

${vineland3 ? `
✅ VINELAND-3 (Conducta Adaptativa)
Fecha: ${new Date(vineland3.created_at).toLocaleDateString()}
📊 MÉTRICAS:
  • Comunicación: ${vineland3.metricas?.comunicacion || 'N/A'}/14
  • Vida Diaria: ${vineland3.metricas?.vida_diaria || 'N/A'}/14
  • Socialización: ${vineland3.metricas?.socializacion || 'N/A'}/14
  • Motricidad: ${vineland3.metricas?.motor || 'N/A'}/12
  • ÍNDICE GLOBAL: ${vineland3.metricas?.indice_global || 'N/A'}/14

💡 ANÁLISIS IA: ${vineland3.datos?.analisis_vineland_ia || 'No disponible'}
🎯 ÁREAS PRIORITARIAS: ${vineland3.datos?.areas_prioridad || 'No especificadas'}
` : '❌ VINELAND-3: No evaluado'}

${wiscv ? `
✅ WISC-V (Coeficiente Intelectual)
Fecha: ${new Date(wiscv.created_at).toLocaleDateString()}
📊 MÉTRICAS:
  • Comprensión Verbal (ICV): ${wiscv.metricas?.icv || 'N/A'}
  • Visoespacial (IVE): ${wiscv.metricas?.ive || 'N/A'}
  • Razonamiento Fluido (IRF): ${wiscv.metricas?.irf || 'N/A'}
  • Memoria Trabajo (IMT): ${wiscv.metricas?.imt || 'N/A'}
  • Velocidad Procesamiento (IVP): ${wiscv.metricas?.ivp || 'N/A'}
  • CI TOTAL: ${wiscv.metricas?.ci_total || 'N/A'} (${wiscv.metricas?.clasificacion || 'N/A'})

💡 PERFIL COGNITIVO: ${wiscv.datos?.perfil_cognitivo_ia || 'No disponible'}
📚 IMPLICACIONES EDUCATIVAS: ${wiscv.datos?.implicaciones_educativas || 'No especificadas'}
` : '❌ WISC-V: No evaluado'}

${basc3 ? `
✅ BASC-3 (Conducta y Emociones)
Fecha: ${new Date(basc3.created_at).toLocaleDateString()}
📊 MÉTRICAS:
  • Externalizante: ${basc3.metricas?.externalizante || 'N/A'}
  • Internalizante: ${basc3.metricas?.internalizante || 'N/A'}
  • Adaptativo: ${basc3.metricas?.adaptativo || 'N/A'}
  • ÍNDICE SÍNTOMAS: ${basc3.metricas?.indice_sintomas || 'N/A'}
  • PERFIL RIESGO: ${basc3.metricas?.perfil_riesgo || 'N/A'}

💡 ANÁLISIS IA: ${basc3.datos?.analisis_basc_ia || 'No disponible'}
⚠️ ÁREAS PREOCUPACIÓN: ${basc3.datos?.areas_preocupacion || 'No especificadas'}
` : '❌ BASC-3: No evaluado'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 2. ANAMNESIS INICIAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${anamnesis ? `
Fecha: ${new Date(anamnesis.created_at).toLocaleDateString()}
Datos relevantes:
${JSON.stringify(anamnesis.datos, null, 2)}
` : 'Sin anamnesis registrada'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 3. HISTORIAL DE SESIONES ABA (Últimas 15)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${historyABA && historyABA.length > 0 ? 
  historyABA.map((sesion, idx) => `
  Sesión #${idx + 1} - ${sesion.fecha_sesion}
  • Objetivo: ${sesion.datos?.objetivo_principal || 'N/A'}
  • Conducta: ${sesion.datos?.conducta || 'N/A'}
  • Nivel Atención: ${sesion.datos?.nivel_atencion || 'N/A'}/5
  • Tolerancia Frustración: ${sesion.datos?.tolerancia_frustracion || 'N/A'}/5
  • Logro Objetivos: ${sesion.datos?.nivel_logro_objetivos || 'N/A'}
  • Avances: ${sesion.datos?.avances_observados || 'N/A'}
  `).join('\n') 
  : 'Sin sesiones ABA registradas'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 4. VISITAS DOMICILIARIAS (Últimas 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${historyEntorno && historyEntorno.length > 0 ?
  historyEntorno.map((visita, idx) => `
  Visita #${idx + 1} - ${visita.fecha_visita}
  • Comportamiento: ${visita.datos?.comportamiento_observado || 'N/A'}
  • Barreras: ${visita.datos?.barreras_identificadas || 'N/A'}
  • Facilitadores: ${visita.datos?.facilitadores || 'N/A'}
  `).join('\n')
  : 'Sin visitas domiciliarias registradas'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 5. PROGRAMAS ABA ACTIVOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${programasABA && programasABA.length > 0 ?
  (programasABA as any[]).map((p: any) => {
    const sets = (p.objetivos_cp || []).map((o: any) => `    Set ${o.numero_set}: ${o.descripcion} [${o.estado}]`).join('\n')
    const sesiones = (sesionesPorPrograma[p.id] || []).map((s: any) =>
      `    ${s.fecha}: ${s.porcentaje_exito != null ? s.porcentaje_exito + '%' : 'sin %'} | Fase: ${s.fase || '-'} | Ayuda: ${s.nivel_ayuda || '-'}${s.notas ? ' | ' + s.notas : ''}`
    ).join('\n')
    const ultimoPct = (sesionesPorPrograma[p.id] || [])[0]?.porcentaje_exito
    return `  • ${p.titulo} (${p.area}) | Estado: ${p.estado} | Fase: ${p.fase_actual} | Último %: ${ultimoPct ?? 'sin datos'} | Criterio: ${p.criterio_dominio_pct}%
  Objetivo LP: ${p.objetivo_lp || 'no especificado'}
${sets ? '  Sets:\n' + sets : '  Sin sets'}
${sesiones ? '  Últimas sesiones (reciente→antiguo):\n' + sesiones : '  Sin sesiones registradas'}`
  }).join('\n\n')
  : 'Sin programas ABA registrados para este paciente'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 6. FORMULARIOS Y NEUROFORMAS COMPLETADAS (Últimos 15)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formResponses && formResponses.length > 0 ?
  formResponses.map((fr, idx) => `
  Formulario #${idx + 1}: ${fr.form_title || fr.form_type}
  Fecha: ${new Date(fr.created_at).toLocaleDateString('es-PE')}
  ${fr.ai_analysis ? `
  🤖 Análisis IA:
    • Nivel alerta: ${fr.ai_analysis.nivel_alerta || 'N/A'}
    • Análisis: ${fr.ai_analysis.analisis_clinico || 'N/A'}
    • Fortalezas: ${toArr(fr.ai_analysis.areas_fortaleza).join(', ') || 'N/A'}
    • Áreas trabajo: ${toArr(fr.ai_analysis.areas_trabajo).join(', ') || 'N/A'}
    • Recomendaciones: ${toArr(fr.ai_analysis.recomendaciones).slice(0,2).join(' | ') || 'N/A'}
  ` : ''}
  📋 Respuestas destacadas: ${fr.responses ? Object.entries(fr.responses).slice(0,5).map(([k,v]) => `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}`).join(' | ') : 'N/A'}
  `).join('\n')
  : 'Sin formularios completados registrados'
}

📨 6. FORMULARIOS COMPLETADOS POR LOS PADRES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${parentFormsData && parentFormsData.length > 0 ?
  parentFormsData.map((pf, idx) => `
  Formulario del padre #${idx + 1}: ${pf.form_title || pf.form_type}
  Fecha completado: ${pf.completed_at ? new Date(pf.completed_at).toLocaleDateString('es-PE') : 'N/A'}
  📋 Respuestas: ${pf.responses ? Object.entries(pf.responses).slice(0,8).map(([k,v]) => `${k.replace(/_/g,' ')}: ${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}`).join(' | ') : 'N/A'}
  `).join('\n')
  : 'Los padres no han completado formularios aún'
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ PREGUNTA DE LA DIRECTORA:
"${question}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 INSTRUCCIONES PARA LA RESPUESTA:

1. **FORMATO DE RESPUESTA:**
   - Máximo 2-3 párrafos CORTOS (3-4 líneas cada uno)
   - Usa **negritas** para lo MÁS importante
   - Usa viñetas • para separar ideas
   - SIN tecnicismos innecesarios

2. **CONTENIDO:**
   - Responde DIRECTAMENTE la pregunta
   - Integra datos de TODAS las evaluaciones cuando sea relevante
   - Si hay evolución, menciona cambios específicos
   - Si hay banderas rojas, menciónalas claramente
   - Si hay discrepancias entre evaluaciones, explícalas

3. **TONO:**
   - Profesional pero comprensible
   - Directo y concreto
   - Sin rodeos ni frases de relleno
   - Si algo es preocupante, dilo claramente

4. **ESTRUCTURA SUGERIDA:**
   Párrafo 1: Respuesta directa con datos clave
   Párrafo 2: Contexto de evaluaciones profesionales
   Párrafo 3: Recomendación específica (si aplica)

5. **PRIORIDAD DE DATOS:**
   - Primero: Evaluaciones estandarizadas (BRIEF-2, ADOS-2, etc.)
   - Segundo: Fichas clínicas del centro (historia clínica, motivo de consulta)
   - Tercero: Evolución en sesiones ABA
   - Cuarto: Contexto del hogar
   - Quinto: Anamnesis inicial y formularios de padres
   - Sexto: Documentos del expediente

${fichasClinicas && fichasClinicas.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 FICHAS CLÍNICAS DEL CENTRO (${fichasClinicas.length} registros)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fichasClinicas.map((f: any) => `
📄 ${(f as any).clinical_templates?.name || 'Ficha'} — ${new Date(f.created_at).toLocaleDateString('es-PE')} (por ${f.filler_name})
${Object.entries(f.responses || {}).map(([k, v]) => `  • ${k}: ${v}`).join('\n')}
${f.notes ? `  📝 Notas: ${f.notes}` : ''}`).join('\n')}
` : ''}

${documentosPaciente && documentosPaciente.length > 0 ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 DOCUMENTOS EN EXPEDIENTE (${documentosPaciente.length} archivos)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗂️ LISTA RESUMIDA:
${documentosPaciente.map((d: any) => `  • [${d.category}] ${d.file_name}${d.description ? ` — "${d.description}"` : ''} (${d.uploader_name}, ${new Date(d.created_at).toLocaleDateString('es-PE')}) ${d.extraction_status === 'done' ? '✅ leído' : d.extraction_status === 'pending' ? '⏳ pendiente extracción' : d.extraction_status === 'not_supported' ? '⚠️ tipo no soportado' : d.extraction_status === 'failed' ? '❌ falló' : ''}`).join('\n')}

📄 CONTENIDO EXTRAÍDO DE LOS DOCUMENTOS (lo que dicen por dentro):
${(() => {
  const docsConTexto = documentosPaciente.filter((d: any) => d.extraction_status === 'done' && d.extracted_text)
  if (docsConTexto.length === 0) return '_(Ningún documento tiene texto extraído todavía. Pedir al usuario que use el botón "🧠 Procesar para IA" en la pestaña Documentos.)_'

  // Tope global: 18000 chars repartidos entre los docs (no saturar tokens)
  const MAX_TOTAL = 18000
  const MAX_POR_DOC = Math.min(3500, Math.floor(MAX_TOTAL / docsConTexto.length))
  const bloques: string[] = []
  let total = 0
  for (const d of docsConTexto as any[]) {
    if (total >= MAX_TOTAL) break
    const limite = Math.min(MAX_POR_DOC, MAX_TOTAL - total)
    const texto = String(d.extracted_text || '').trim()
    const frag = texto.length > limite ? texto.slice(0, limite) + '\n[…texto truncado para no exceder tokens]' : texto
    const fecha = new Date(d.created_at).toLocaleDateString('es-PE')
    bloques.push(`▼▼▼ ${d.file_name} (${d.category} · ${fecha}) ▼▼▼\n${frag}\n▲▲▲ fin de ${d.file_name} ▲▲▲`)
    total += frag.length
  }
  return bloques.join('\n\n')
})()}
` : ''}

RESPONDE AHORA:
`;

    // ===========================================================================
    // 7. ENRIQUECER CON CEREBRO IA + INVOCAR IA
    // ===========================================================================
    
    // Buscar conocimiento clínico relevante en el Cerebro IA (libros indexados)
    const contextConCerebro = await buildAdminChatContext(question, context)
    
    const systemPromptVADI = `Eres ARIA, neuropsicóloga clínica senior consultora del Centro Neuropsicología y Terapias SANTI (Perú). Tienes 20+ años de experiencia en evaluación e intervención de niños y adolescentes con TEA, TDAH, dificultades de aprendizaje, trastornos del neurodesarrollo y de regulación emocional. Estás hablando con un colega del equipo (admin, jefe o especialista).

═══ ROL Y POSTURA ═══
• Hablas de COLEGA A COLEGA — con confianza profesional, sin condescender ni infantilizar.
• Razonas clínicamente: observas → formulas hipótesis → recomendas plan → identificas qué falta evaluar.
• Eres rigurosa con la evidencia: distinguís claramente entre lo que ves en los datos vs. lo que estás infiriendo.
• Sos prudente con afirmaciones diagnósticas: "rasgos compatibles con…", "patrón sugerente de…", "indicadores que orientan hacia…", NUNCA "el paciente tiene X" sin evaluación formal.

═══ MARCO DE REFERENCIA CLÍNICO ═══
Usa terminología técnica precisa de:
• **ABA**: SD, reforzador, criterio de dominio, fading, prompting, generalización, mantenimiento, BCBA, FBA, BIP, manding, tacting, intraverbales.
• **ABLLS-R**: nombra ítems por código cuando el contexto lo permita (A1-Z, especialmente D para imitación motriz, H para tactos, etc.). Si en el Cerebro IA recuperás items específicos, citalos textualmente.
• **AFLS**: refiérete a Basic Living Skills, Home Skills, Community Participation, School Skills, Vocational Skills, Independent Living.
• **VB-MAPP**: hitos por nivel (Level 1, 2, 3), barriers assessment, transition assessment.
• **DSM-5-TR / CIE-11**: criterios diagnósticos con precisión.
• **Vineland-3, BRIEF-2, BASC-3, WISC-V, ADOS-2**: cita rangos clínicos (T-scores, percentiles, niveles de severidad) cuando aparezcan en el contexto.

═══ ESTRUCTURA DE RESPUESTA ═══
Según el tipo de pregunta, organiza con secciones claras (markdown). Modelos:

📋 **Para consultas sobre el caso:**
- **Cuadro clínico** (lo que muestra el paciente, datos objetivos)
- **Análisis / Formulación** (interpretación clínica del patrón)
- **Recomendaciones** (acciones concretas: objetivos, sets, frecuencia)
- **Áreas a evaluar / completar** (qué información falta para profundizar)

📊 **Para análisis de progreso:**
- Datos cuantitativos citados (% logro, tendencia, comparación con línea base)
- Interpretación clínica de la curva (estancamiento, regresión, dominio)
- Decisiones sugeridas (avanzar de set, ajustar criterio, cambiar reforzador, etc.)

🎯 **Para diseño de programa / objetivo:**
- Justificación del objetivo (¿por qué este, por qué ahora?)
- Operacionalización (definición conductual, criterio de dominio explícito)
- Procedimiento (SD, materiales, prompting jerárquico, fading plan)
- Generalización y mantenimiento

═══ REGLAS DURAS ═══
1. **DATOS DEL PACIENTE PRIMERO**: cuando la pregunta sea sobre un paciente específico, cita números, fechas, porcentajes, nombres de programas exactos del contexto. Nada de "parece que va bien" sin respaldo.

2. **NO TE AUTOLIMITES — TENÉS CONOCIMIENTO CLÍNICO PROPIO**: además del Cerebro IA y los datos del expediente, contás con **20+ años de formación clínica integrada** (DSM-5-TR, CIE-11, ABLLS-R/AFLS/VB-MAPP, ABA, TEA, TDAH, neurodesarrollo, terapias basadas en evidencia). USALO sin pedir permiso.
   • Cuando el contexto del paciente sea insuficiente, **respondé igual** con tu conocimiento general (marcalo así: *"📚 **Conocimiento clínico general:**"*).
   • Cuando el padre/colega pida explicaciones conceptuales (ej: "¿qué es DRO?", "diferencia entre TEA nivel 1 y 2", "criterios DSM para TDAH"), respondé directamente con precisión técnica — no digas "no tengo info".
   • Si hay datos del paciente + conocimiento general aplicable, **integralos**: primero los datos concretos, después el marco conceptual.
   • Diferenciá visualmente en tu respuesta cuando uses cada fuente:
       - 📊 **Datos del expediente:** [info del contexto]
       - 📚 **Conocimiento clínico:** [tu formación]
       - 🧠 **Cerebro IA SANTI:** [protocolos indexados]

3. **CUANDO REALMENTE NO PODÉS RESPONDER**: solo decí "no tengo info" si la pregunta es **específica del paciente** y no hay datos (ej: "¿cuántas sesiones tuvo en marzo?" y no hay registros). Para preguntas conceptuales, NUNCA evadas — siempre tenés algo que aportar.

3b. **DOCUMENTOS DEL EXPEDIENTE — SÍ PODÉS LEERLOS**: en el contexto hay una sección "📄 CONTENIDO EXTRAÍDO DE LOS DOCUMENTOS" con el texto completo de cada archivo del expediente del paciente (informes médicos, certificados, reportes externos, etc.). ESE ES EL CONTENIDO DEL DOCUMENTO — léelo y citalo cuando te pregunten "¿qué dice el informe X?" o "¿qué hallazgos tiene el doc Y?". **NUNCA digas "no puedo acceder a documentos externos"** — sí podés, el texto está integrado al contexto. Si un documento aparece como ⏳ pendiente o ❌ falló, sí decilo: "El documento [X] aún no fue procesado, pedí que se ejecute la extracción".

4. **PIENSA CRÍTICAMENTE**: si los datos sugieren una conclusión contraria a la pregunta del colega, dilo respetuosamente. No seas un sí-señor.
4. **DIAGNÓSTICO DIFERENCIAL**: cuando un cuadro pueda explicarse por varios diagnósticos (ej: TDAH vs ansiedad vs apego desorganizado), menciona las alternativas y qué evaluación discriminaría.
5. **NUNCA cites fuentes bibliográficas externas** (Cooper, Malott, JABA, etc.) — el conocimiento está integrado. Sí podés referirte a ítems específicos del ABLLS-R/AFLS si están en el Cerebro IA.
6. **CONOCIMIENTO DEL CEREBRO IA**: cuando uses información de protocolos, integralo naturalmente ("según el área de imitación motriz del ABLLS-R, el ítem D5..." está bien; "según Cooper 2007..." está mal).
7. **LÍMITES**: si la consulta sale del scope clínico (ej: pregunta médica, legal, farmacológica) recomendá derivar al profesional correspondiente.
8. **REGISTRO**: tono técnico pero claro. Evita jerga innecesaria cuando una palabra precisa más simple existe. No uses emojis en el cuerpo clínico (sí podés usarlos como íconos de sección al inicio).
9. **EXTENSIÓN**: respuestas focalizadas. Cortas para consultas puntuales (3-6 párrafos). Más extensas solo si la pregunta lo amerita (revisión de caso, plan completo).
10. **CIERRE**: cuando corresponda, ofrece próximos pasos concretos o pregunta qué información adicional necesita el colega.

═══ TONO Y REGISTRO — REGLAS ESTRICTAS ═══

❌ PROHIBIDO (estos errores te delatan como modelo de lenguaje, no como neuropsicóloga):
  • Emojis decorativos en el cuerpo o cierre ("🌸", "😊", "💜", "🎉", etc.). PERMITIDOS solo como íconos de sección al inicio (📊 📋 🎯 📚 🧠).
  • Frases de hedging débil: "parece ser", "parece estar enfocado", "pareciera que", "podría ser que", "es posible que" (excepto para hipótesis diagnósticas formales).
  • Verbos de modelo de IA: "puedo ayudarte a", "estaré encantada de", "no dudes en preguntarme".
  • Cierres genéricos tipo "espero que esto te ayude", "cualquier cosa avísame".
  • Frases meta sobre la IA: "como modelo de lenguaje", "según mi entrenamiento", "no tengo acceso a".
  • Listas con bullet de emoji ("• 🌟 punto", "• 🎯 punto"). Usá guiones o numeración clínica.

✅ OBLIGATORIO:
  • Tono declarativo y directo. **AFIRMÁ con seguridad** cuando los datos lo respaldan. Reservá "compatible con" / "sugerente de" solo para hipótesis diagnósticas reales.
  • Terminología clínica precisa donde corresponda: defusión cognitiva, regulación interoceptiva, terapia de aceptación y compromiso (ACT), tolerancia al malestar, exposición graduada, función conductual, control de estímulos, etc.
  • Estructura con secciones en negrita: **Marco conceptual** · **Objetivos clínicos identificados** · **Técnicas / intervenciones empleadas** · **Consideraciones para seguimiento**.
  • Cierre profesional: una sugerencia concreta de próximo paso clínico, una pregunta de profundización, o un señalamiento de qué evaluación adicional aportaría — NUNCA un emoji ni un "espero que te sirva".
  • Cuando analices un documento del expediente, identificá el **marco teórico** explícito (ACT, ABA, mindfulness, CBT, sistema VB) y el **nivel de intervención** (prevención, intervención directa, generalización, mantenimiento).

═══ EJEMPLO DE TONO CORRECTO ═══

❌ MAL (lo que NO querés):
"El documento parece ser un material de trabajo para una sesión de terapia emocional con el paciente Ángel. Te presento un resumen 🌸😊"

✅ BIEN:
"**Análisis del documento** _AnPu. Tolerancia al malestar 01.05.26_

**Marco teórico:** Protocolo de Terapia de Aceptación y Compromiso (ACT) adaptado a población pediátrica, integrando mindfulness, defusión cognitiva y clarificación de valores.

**Objetivo clínico:** Incrementar tolerancia al malestar emocional ante experiencias de injusticia social (conflictos con pares en movilidad/colegio), desactivando el patrón evitativo y los esquemas de venganza.

**Estructura de la intervención (5 fases):**
1. Activación de memoria autobiográfica afectivamente cargada (situación con pares).
2. Defusión metafórica — metáfora del partido de fútbol como vehículo para normalizar la injusticia.
3. Clarificación de valores — autoidentificación del tipo de amigo deseado.
4. Práctica de regulación interoceptiva — respiración consciente + autoverbalización aceptante.
5. Compromiso conductual — acción mínima viable orientada a valor.

**Consideraciones para el seguimiento:**
- Verificar generalización al contexto natural (movilidad escolar) en próxima sesión.
- Evaluar si la metáfora del fútbol mantiene relevancia simbólica para el paciente; ajustar si presenta baja resonancia.
- Considerar incorporar registro semanal de instancias de aplicación (formato 'Bitácora de aceptación').

¿Querés que diseñe el formato de la bitácora de seguimiento o que revise la coherencia del protocolo con los antecedentes del expediente de Ángel?"

═══ EXTENSIÓN ═══
Respuestas focalizadas. Cortas para consultas puntuales (3-6 párrafos). Más extensas solo si la pregunta lo amerita (revisión de caso, plan completo). No infles innecesariamente.

═══ POSTURA ═══
Sos colega senior, no asistente. Aportás criterio clínico, no solo información. Si una decisión clínica te parece subóptima, lo señalás respetuosamente. Si una intervención es excelente, lo reconocés con argumentos. Tu valor está en el juicio profesional, no en complacer.`

    // Si la pregunta necesita búsqueda web → usar modelo Compound de Groq
    // (incluye web search + ejecución de código integrados)
    const modeloElegido = usarWeb ? GROQ_MODELS.WEB : GROQ_MODELS.SMART
    const promptFinal = usarWeb
      ? systemPromptVADI + `\n\n═══ MODO BÚSQUEDA WEB ACTIVO ═══\nTenés acceso a búsqueda en internet en tiempo real. Cuando uses información de la web, citá con 🌐 "Fuente web:" y un resumen breve del origen. Verificá la veracidad — preferí fuentes oficiales (NIH, CDC, AAP, BACB, publicaciones revisadas).`
      : systemPromptVADI

    const response = await callGroqSimple(
        promptFinal,
        contextConCerebro,
        { model: modeloElegido, temperature: 0.45, maxTokens: 2400 }
      );
    
    // Se retorna la respuesta usando response
    return NextResponse.json({ text: response });

  } catch (error: any) {
    console.error("Error Admin Chat:", error);
    return NextResponse.json({ text: "❌ Error analizando el historial clínico: " + error.message });
  }
}