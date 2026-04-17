export const maxDuration = 60;

// app/api/engagement-padres/route.ts
// 👨‍👩‍👧 Módulo de Engagement para Padres
// Genera planes semanales personalizados de actividades en casa
// ajustados por IA según el progreso real del niño

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { childId, accion = 'generar_plan', locale = 'es' } = await req.json()
    // accion: 'generar_plan' | 'registrar_actividad' | 'obtener_historial'

    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    if (accion === 'registrar_actividad') {
      const { actividadId, completada, nota } = await req.json()
      const { error } = await supabaseAdmin
        .from('engagement_actividades')
        .update({ completada, nota_padre: nota, fecha_completada: new Date().toISOString() })
        .eq('id', actividadId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (accion === 'actualizar_completadas') {
      const { planId, actividades, completadas_pct } = await req.json()
      if (!planId) return NextResponse.json({ error: 'planId requerido' }, { status: 400 })
      const { error } = await supabaseAdmin
        .from('engagement_planes')
        .update({ actividades, completadas_pct })
        .eq('id', planId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    // Cargar datos del niño
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, diagnosis')
      .eq('id', childId)
      .single()

    const childName = (child as any)?.name || 'el paciente'
    const diagnostico = (child as any)?.diagnosis || 'TEA'

    // Cargar últimas sesiones para contexto
    const { data: sesiones } = await supabaseAdmin
      .from('registro_aba')
      .select('datos, fecha_sesion')
      .eq('child_id', childId)
      .order('fecha_sesion', { ascending: false })
      .limit(5)

    // Cargar programas activos
    const { data: programas } = await supabaseAdmin
      .from('programas_aba')
      .select('titulo, area, fase_actual, objetivos_cp(nombre, estado)')
      .eq('child_id', childId)
      .in('estado', ['activo', 'intervencion'])
      .limit(5)

    // Cargar engagement previo para continuidad
    const { data: engagementPrevio } = await supabaseAdmin
      .from('engagement_planes')
      .select('semana, actividades, completadas_pct')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(3)

    const contextoPrevio = engagementPrevio && engagementPrevio.length > 0
      ? `Semanas anteriores: ${engagementPrevio.map((e: any) => `semana ${e.semana}: ${e.completadas_pct || 0}% completado`).join(', ')}`
      : 'Primera semana del programa'

    const resumenSesiones = sesiones && sesiones.length > 0
      ? sesiones.slice(0, 3).map((s: any) => {
          const d = s.datos || {}
          return `Sesión ${new Date(s.fecha_sesion).toLocaleDateString('es-ES')}: objetivo=${d.objetivo_principal || 'N/A'}, logro=${d.porcentaje_exito || 'N/A'}%`
        }).join('\n')
      : 'Sin sesiones recientes'

    const resumenProgramas = programas && programas.length > 0
      ? programas.map((p: any) => `${p.area}: ${p.titulo} (fase: ${p.fase_actual})`).join(', ')
      : 'Sin programas activos'

    const localeNames: Record<string,string> = { es:'español', en:'English', pt:'português', fr:'français', de:'Deutsch', it:'italiano' }
    const langInstruction = locale !== 'es' ? `\n\n[RESPONDE OBLIGATORIAMENTE EN: ${localeNames[locale] || 'español'}]` : ''
    const prompt = `Eres un especialista en ABA y participación familiar. IMPORTANTE: Estas actividades deben reforzar EN CASA los objetivos del programa ABA diseñado por el terapeuta. NO inventes objetivos nuevos. Basate ESTRICTAMENTE en los programas activos.

Genera actividades de refuerzo en casa para los padres de ${childName} (${diagnostico}), siguiendo el programa terapéutico del especialista.

CONTEXTO CLÍNICO:
- Programas activos: ${resumenProgramas}
- Últimas sesiones:
${resumenSesiones}
- ${contextoPrevio}

OBJETIVO: Crear actividades en casa que REFUERCEN lo trabajado en terapia, sean REALIZABLES (15-20 min/día), y aumenten la PARTICIPACIÓN de los padres.

INSTRUCCIONES:
- Genera exactamente 5 actividades para esta semana
- Cada actividad debe tener: titulo, descripcion (2-3 oraciones), duracion_minutos (10-20), dificultad (facil/media/alta), area (comunicacion/conducta/habilidades/socializacion/autonomia), materiales_necesarios (lista simple), por_que_importa (1 oración que conecta con la terapia)
- Las actividades deben ser CONCRETAS y ESPECÍFICAS, no genéricas
- Incluye variedad de áreas
- Considera el nivel actual del niño según las sesiones

Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicaciones:
{
  "semana": "Semana del [fecha inicio] al [fecha fin]",
  "mensaje_motivacional": "Mensaje cálido de 1-2 oraciones para los padres",
  "actividades": [
    {
      "titulo": "",
      "descripcion": "",
      "duracion_minutos": 15,
      "dificultad": "facil",
      "area": "comunicacion",
      "materiales_necesarios": ["item1", "item2"],
      "por_que_importa": "",
      "dias_recomendados": ["lunes", "miercoles", "viernes"]
    }
  ]
}`

    const respuestaRaw = await callGroqSimple('', prompt, { model: GROQ_MODELS.SMART, temperature: 0.6, maxTokens: 2000 })

    let plan: any
    try {
      const clean = respuestaRaw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      plan = JSON.parse(clean)
    } catch {
      throw new Error('La IA no generó un plan válido')
    }

    // Guardar el plan en Supabase
    const semanaNum = getWeekNumber(new Date())
    const { data: planGuardado, error: saveErr } = await supabaseAdmin
      .from('engagement_planes')
      .upsert({
        child_id: childId,
        semana: semanaNum,
        anio: new Date().getFullYear(),
        actividades: plan.actividades,
        mensaje_motivacional: plan.mensaje_motivacional,
        completadas_pct: 0,
        created_at: new Date().toISOString(),
      }, { onConflict: 'child_id,semana,anio' })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        semana_num: semanaNum,
        id: (planGuardado as any)?.id,
        child_name: childName,
      }
    })

  } catch (e: any) {
    console.error('Error engagement-padres:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId = searchParams.get('child_id')
  if (!childId) return NextResponse.json({ error: 'child_id requerido' }, { status: 400 })

  const semanaNum = getWeekNumber(new Date())
  const { data: plan } = await supabaseAdmin
    .from('engagement_planes')
    .select('*')
    .eq('child_id', childId)
    .eq('semana', semanaNum)
    .eq('anio', new Date().getFullYear())
    .single()

  const { data: historial } = await supabaseAdmin
    .from('engagement_planes')
    .select('semana, anio, completadas_pct, created_at')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(8)

  return NextResponse.json({ plan, historial: historial || [] })
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
