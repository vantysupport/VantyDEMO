// lib/child-history.ts
// FIX: programas ABA se construyen PRIMERO en el texto para no ser truncados por el límite de tokens

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getChildHistory(childId: string, childNameFallback?: string, childAgeFallback?: string | number) {
  // 1. Datos básicos del niño
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, age, birth_date, diagnosis')
    .eq('id', childId)
    .single()

  if (!child) {
    return {
      nombre: childNameFallback || 'Paciente no encontrado',
      edad: childAgeFallback ? String(childAgeFallback) : '',
      diagnostico: '',
      historialTexto: '',
    }
  }

  // Calcular edad precisa desde birth_date
  let edadTexto = 'edad N/E'
  if ((child as any).birth_date) {
    const hoy = new Date()
    const nac = new Date((child as any).birth_date)
    const diff = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    const edad = (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) ? diff - 1 : diff
    edadTexto = `${edad} años`
  } else if ((child as any).age) {
    const numAge = parseInt(String((child as any).age).replace(/[^0-9]/g, ''), 10)
    edadTexto = !isNaN(numAge) ? `${numAge} años` : 'edad N/E'
  }

  const partes: string[] = []

  // ── FIX PRIORIDAD 1: Programas ABA PRIMERO ───────────────────────────────
  // Se ubican al inicio del texto para no ser truncados por el límite de tokens.
  // La query de sesiones_datos_aba ahora trae solo las últimas 8, ordenadas desc.
  // FIX: sin filtro de estado — evita fallos por mayúsculas o valores distintos en BD
  const { data: programasAba } = await supabaseAdmin
    .from('programas_aba')
    .select(`
      id, titulo, objetivo_lp, area, fase_actual, estado, criterio_dominio_pct,
      objetivos_cp(numero_set, descripcion, estado)
    `)
    .eq('child_id', childId)
    .order('updated_at', { ascending: false })
    .limit(10)

  // FIX: query separada para sesiones ordenadas y limitadas por programa
  let sesionesPorPrograma: Record<string, any[]> = {}
  if (programasAba && programasAba.length > 0) {
    const programaIds = (programasAba as any[]).map(p => p.id)
    const { data: todasSesiones } = await supabaseAdmin
      .from('sesiones_datos_aba')
      .select('programa_id, fecha, porcentaje_exito, fase, nivel_ayuda, notas')
      .in('programa_id', programaIds)
      .order('fecha', { ascending: false })
      .limit(80) // máx 80 en total, repartidas entre programas

    if (todasSesiones) {
      for (const s of todasSesiones as any[]) {
        if (!sesionesPorPrograma[s.programa_id]) sesionesPorPrograma[s.programa_id] = []
        if (sesionesPorPrograma[s.programa_id].length < 8) {
          sesionesPorPrograma[s.programa_id].push(s)
        }
      }
    }
  }

  if (programasAba && programasAba.length > 0) {
    const progTexto = (programasAba as any[]).map(p => {
      const sets = (p.objetivos_cp || [])
        .map((o: any) => `    Set ${o.numero_set}: ${o.descripcion} [${o.estado}]`)
        .join('\n')

      const sesiones = (sesionesPorPrograma[p.id] || [])
        .map((s: any) =>
          `    ${s.fecha}: ${s.porcentaje_exito != null ? s.porcentaje_exito + '%' : 'sin %'} | Fase: ${s.fase || '-'} | Ayuda: ${s.nivel_ayuda || '-'}${s.notas ? ' | ' + s.notas : ''}`
        )
        .join('\n')

      const ultimoPct = (sesionesPorPrograma[p.id] || []).length > 0
        ? (sesionesPorPrograma[p.id][0]?.porcentaje_exito ?? 'sin datos')
        : 'sin datos'

      return `• ${p.titulo} (${p.area}) | Fase: ${p.fase_actual} | Último %: ${ultimoPct} | Criterio dominio: ${p.criterio_dominio_pct}%
  Objetivo LP: ${p.objetivo_lp || 'no especificado'}
${sets ? '  Sets:\n' + sets : '  Sin sets registrados'}
${sesiones ? '  Últimas sesiones (recientes primero):\n' + sesiones : '  Sin sesiones registradas'}`
    }).join('\n\n')

    partes.push(`Programas ABA activos (${programasAba.length}):\n${progTexto}`)
  } else {
    partes.push('Programas ABA activos: ninguno registrado.')
  }

  // 2. Últimas 5 sesiones ABA (registro general)
  const { data: sesionesAba } = await supabaseAdmin
    .from('registro_aba')
    .select('fecha_sesion, datos, ai_analysis')
    .eq('child_id', childId)
    .order('fecha_sesion', { ascending: false })
    .limit(5)

  // 3. Anamnesis más reciente
  const { data: anamnesis } = await supabaseAdmin
    .from('anamnesis_completa')
    .select('fecha_creacion, datos')
    .eq('child_id', childId)
    .order('fecha_creacion', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 4. Últimas evaluaciones clínicas
  const { data: formResponses } = await supabaseAdmin
    .from('form_responses')
    .select('form_type, form_title, created_at, ai_analysis')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(8)

  // 5. Evaluaciones profesionales
  const evalTables = [
    { table: 'evaluacion_brief2',    label: 'BRIEF-2 (Funciones Ejecutivas)' },
    { table: 'evaluacion_ados2',     label: 'ADOS-2 (TEA)' },
    { table: 'evaluacion_vineland3', label: 'Vineland-3 (Conducta Adaptativa)' },
    { table: 'evaluacion_wiscv',     label: 'WISC-V (Cognitivo)' },
    { table: 'evaluacion_basc3',     label: 'BASC-3 (Conducta)' },
  ]

  const evalResults: string[] = []
  for (const { table, label } of evalTables) {
    try {
      const { data: evalData } = await supabaseAdmin
        .from(table)
        .select('created_at, ai_analysis')
        .eq('child_id', childId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (evalData && (evalData as any).ai_analysis) {
        const summary = String((evalData as any).ai_analysis).slice(0, 300)
        evalResults.push(`${label} (${(evalData as any).created_at?.slice(0, 10)}): ${summary}`)
      }
    } catch {
      // tabla no existe aún, ignorar
    }
  }

  if (evalResults.length > 0) {
    partes.push(`Evaluaciones clínicas:\n${evalResults.map(e => '• ' + e).join('\n')}`)
  }

  if (sesionesAba && sesionesAba.length > 0) {
    const sesionesTexto = (sesionesAba as any[]).map((s, i) => {
      const logro = s.datos?.nivel_logro_objetivos ?? 'N/D'
      return `  Sesión ${i + 1} (${s.fecha_sesion || 'sin fecha'}): logro=${logro}${s.ai_analysis ? ' | AI: ' + String(s.ai_analysis).slice(0, 150) : ''}`
    }).join('\n')
    partes.push(`Últimas ${sesionesAba.length} sesiones ABA:\n${sesionesTexto}`)
  }

  if (anamnesis && (anamnesis as any).datos) {
    const anamnesisResumen = JSON.stringify((anamnesis as any).datos).slice(0, 600)
    partes.push(`Anamnesis (${(anamnesis as any).fecha_creacion?.slice(0, 10)}): ${anamnesisResumen}`)
  }

  if (formResponses && formResponses.length > 0) {
    const formsTexto = (formResponses as any[])
      .filter(f => f.ai_analysis)
      .slice(0, 4)
      .map(f => `• ${f.form_title} (${f.created_at?.slice(0, 10)}): ${String(f.ai_analysis).slice(0, 200)}`)
      .join('\n')
    if (formsTexto) partes.push(`Evaluaciones de formularios:\n${formsTexto}`)
  }

  // 6. Fichas clínicas (actas de sesión, visita escolar, visita casa, historia clínica…)
  try {
    const { data: fichas } = await supabaseAdmin
      .from('clinical_template_responses')
      .select('created_at, filler_name, filler_role, responses, notes, clinical_templates(name)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(8)
    if (fichas && fichas.length > 0) {
      const fichasTxt = (fichas as any[]).map(f => {
        const fName = f.clinical_templates?.name || 'Ficha'
        const fecha = (f.created_at || '').slice(0, 10)
        const responsable = f.filler_name ? `${f.filler_name}${f.filler_role ? ` (${f.filler_role})` : ''}` : 'profesional'
        const resumen = Object.values(f.responses || {})
          .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
          .slice(0, 2)
          .map((v: any) => String(v).slice(0, 220))
          .join(' | ')
        return `• ${fecha} — ${fName} (${responsable}): ${resumen}${f.notes ? ` | Notas: ${String(f.notes).slice(0, 150)}` : ''}`
      }).join('\n')
      partes.push(`Fichas clínicas (${fichas.length}):\n${fichasTxt}`)
    }
  } catch { /* tabla puede no existir */ }

  // 7. Análisis predictivo
  try {
    const { data: pred } = await supabaseAdmin
      .from('predicciones_ia')
      .select('analisis_ia, prediccion_30d, sesiones_analizadas, fecha_analisis')
      .eq('child_id', childId)
      .maybeSingle()
    if (pred && (pred as any).analisis_ia) {
      partes.push(
        `Análisis predictivo IA (${(pred as any).sesiones_analizadas || 0} sesiones analizadas):\n${String((pred as any).analisis_ia).slice(0, 600)}${(pred as any).prediccion_30d ? `\nProyección 30d: ${String((pred as any).prediccion_30d).slice(0, 300)}` : ''}`
      )
    }
  } catch { /* opcional */ }

  // 8. Patrones detectados
  try {
    const { data: pats } = await supabaseAdmin
      .from('patrones_detectados')
      .select('analisis_ia, patrones, sesiones_analizadas')
      .eq('child_id', childId)
      .maybeSingle()
    if (pats && (pats as any).analisis_ia) {
      partes.push(`Patrones detectados:\n${String((pats as any).analisis_ia).slice(0, 500)}`)
    }
  } catch { /* opcional */ }

  // 9. Alertas activas (logros y atención)
  try {
    const { data: alertas } = await supabaseAdmin
      .from('agente_alertas')
      .select('tipo, titulo, descripcion, mensaje, prioridad')
      .eq('child_id', childId)
      .eq('resuelta', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (alertas && alertas.length > 0) {
      const alertasTxt = (alertas as any[]).map(a => {
        const tipoStr = String(a.tipo || '')
        const esLogro = tipoStr.startsWith('logro_') || tipoStr === 'criterio_alcanzado'
        const icon = esLogro ? '🎉' : (a.prioridad === 'alta' || a.prioridad === 1) ? '⚠️' : 'ℹ️'
        return `${icon} ${a.titulo || a.tipo}: ${(a.descripcion || a.mensaje || '').slice(0, 200)}`
      }).join('\n')
      partes.push(`Alertas activas:\n${alertasTxt}`)
    }
  } catch { /* opcional */ }

  // 10. Plan de Practicar en Casa generado por IA (engagement)
  try {
    const { data: engagement } = await supabaseAdmin
      .from('engagement_planes')
      .select('semana, anio, actividades, mensaje_motivacional, completadas_pct, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (engagement) {
      const p: any = engagement
      const acts = Array.isArray(p.actividades) ? p.actividades.slice(0, 4) : []
      const actTxt = acts.map((a: any, i: number) =>
        `  ${i + 1}. ${a.titulo || 'Actividad'} (${a.duracion_minutos || 15}min)${a.completada ? ' ✅' : ''}`
      ).join('\n')
      partes.push(`Plan Practicar en Casa (semana ${p.semana}/${p.anio}, ${p.completadas_pct || 0}% completado):\n${actTxt}`)
    }
  } catch { /* opcional */ }

  // 11. Bienestar del padre (chequeos mensuales)
  try {
    const { data: wellbeing } = await supabaseAdmin
      .from('parent_wellbeing_checkins')
      .select('mood, nota, created_at')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(3)
    if (wellbeing && wellbeing.length > 0) {
      const wbTxt = (wellbeing as any[]).map(w => {
        const moodLabel = w.mood === 'bien' ? '😊 Bien' : w.mood === 'regular' ? '😐 Regular' : '😔 Difícil'
        return `• ${(w.created_at || '').slice(0, 10)}: ${moodLabel}${w.nota ? ` — "${String(w.nota).slice(0, 200)}"` : ''}`
      }).join('\n')
      partes.push(`Chequeos de bienestar del padre/madre:\n${wbTxt}`)
    }
  } catch { /* tabla puede no existir aún */ }

  // 12. Citas próximas y pasadas
  try {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ data: proximas }, { data: pasadas }] = await Promise.all([
      supabaseAdmin
        .from('appointments')
        .select('appointment_date, appointment_time, service_type, status')
        .eq('child_id', childId)
        .gte('appointment_date', hoy)
        .not('status', 'in', '(cancelled,completed,realizada,completada,done)')
        .order('appointment_date', { ascending: true })
        .limit(3),
      supabaseAdmin
        .from('appointments')
        .select('appointment_date, appointment_time, service_type, status')
        .eq('child_id', childId)
        .lt('appointment_date', hoy)
        .in('status', ['completed', 'completada', 'realizada'])
        .order('appointment_date', { ascending: false })
        .limit(5),
    ])
    const citasTxt: string[] = []
    if (proximas && proximas.length > 0) {
      citasTxt.push('Próximas:\n' + (proximas as any[]).map(c =>
        `  · ${c.appointment_date} ${c.appointment_time?.slice(0, 5) || ''} — ${c.service_type || 'Sesión'} [${c.status}]`
      ).join('\n'))
    }
    if (pasadas && pasadas.length > 0) {
      citasTxt.push('Recientes realizadas:\n' + (pasadas as any[]).map(c =>
        `  · ${c.appointment_date} ${c.appointment_time?.slice(0, 5) || ''} — ${c.service_type || 'Sesión'}`
      ).join('\n'))
    }
    if (citasTxt.length > 0) partes.push(`Agenda:\n${citasTxt.join('\n')}`)
  } catch { /* opcional */ }

  return {
    nombre: (child as any).name || 'Sin nombre',
    edad: edadTexto,
    diagnostico: (child as any).diagnosis || 'No especificado',
    historialTexto: partes.join('\n\n'),
  }
}
