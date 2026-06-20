// app/api/evaluacion-inicial/seleccionar/route.ts
//
// El padre elige UNA o VARIAS terapias del catálogo global del centro
// (terapias_catalogo). Se guarda la selección, se genera un documento
// INTERNO para el especialista (NO visible al padre) y se notifica al equipo.
// Estado pasa a 'terapia_seleccionada' (esperando respuesta del especialista).

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function generarDocumentoInternoMD(eval_: any, child: any, terapias: any[]) {
  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
  const areas = eval_.recomendacion_areas || {}

  const respIntake = eval_.respuestas_intake || {}
  const respAnamnesis = eval_.anamnesis_especifica || {}

  const fmtRespuestas = (obj: any) =>
    Object.entries(obj || {})
      .map(([k, v]) => {
        const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
        const val = Array.isArray(v) ? v.join(', ') : String(v ?? '—')
        return `- **${label}:** ${val}`
      })
      .join('\n') || '_(sin respuestas)_'

  const terapiasMd = terapias
    .map(t => `### ${t.nombre}\n${t.descripcion ? `${t.descripcion}\n` : ''}${
      t.precio ? `**Precio referencial:** ${t.precio} ${t.moneda || 'PEN'}\n` : ''
    }${t.duracion ? `**Duración:** ${t.duracion}\n` : ''}`)
    .join('\n')

  return `# 🩺 Documento Clínico Interno — Evaluación Inicial
**⚠️ USO EXCLUSIVO DEL EQUIPO CLÍNICO — NO COMPARTIR CON PADRES**
**Fecha:** ${fecha}

---

## 👤 Paciente
- **Nombre:** ${child.name}
- **Fecha de nacimiento:** ${child.birth_date || '—'}
- **Diagnóstico previo:** ${child.diagnosis || 'Ninguno reportado'}

---

## 📋 1. Intake inicial (llenado por el padre)

${fmtRespuestas(respIntake)}

---

## 🧠 2. Recomendación clínica de la IA

**Tipo:** ${
    eval_.recomendacion === 'psicologica' ? 'Evaluación Psicológica Emocional'
    : eval_.recomendacion === 'neuropsicologica' ? 'Evaluación Neuropsicológica'
    : 'Evaluación Integral'
  }

### Razonamiento clínico
${eval_.recomendacion_razon || '—'}

### Áreas a evaluar
${(areas.areas_a_evaluar || []).map((a: string) => `- ${a}`).join('\n') || '—'}

### Señales detectadas
${(areas.señales_detectadas || []).map((s: any) => `- **${s.categoria}:** ${s.descripcion}`).join('\n') || '—'}

**Urgencia clínica:** ${areas.urgencia || 'media'}

---

## 📝 3. Anamnesis específica (segunda ficha)

${fmtRespuestas(respAnamnesis)}

---

## 🎯 4. Terapias seleccionadas por la familia

${terapiasMd || '_(ninguna)_'}

---

*Documento generado automáticamente — Vanty ABA · ${fecha}*
`
}

export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id, terapia_ids, mensaje_al_especialista } = await req.json()

    if (!evaluacion_id || !Array.isArray(terapia_ids) || terapia_ids.length === 0) {
      return NextResponse.json({ error: 'evaluacion_id y terapia_ids (array) requeridos' }, { status: 400 })
    }

    // 1. Cargar evaluación + paciente + terapias seleccionadas
    const { data: eval_, error: e1 } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('*')
      .eq('id', evaluacion_id)
      .maybeSingle()
    if (e1) throw e1
    if (!eval_) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })

    const { data: terapias } = await supabaseAdmin
      .from('terapias_catalogo')
      .select('*')
      .in('id', terapia_ids)
    if (!terapias || terapias.length === 0) {
      return NextResponse.json({ error: 'Terapias no encontradas' }, { status: 404 })
    }

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, name, birth_date, diagnosis, parent_id')
      .eq('id', eval_.child_id)
      .maybeSingle()
    if (!child) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // 2. Generar documento INTERNO (solo para el especialista)
    const documentoMd = generarDocumentoInternoMD(eval_, child, terapias)

    // 3. Actualizar evaluación
    const ahora = new Date().toISOString()
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        terapias_seleccionadas: terapia_ids,
        seleccionado_en: ahora,
        mensaje_al_especialista: mensaje_al_especialista || null,
        documento_md: documentoMd,
        estado: 'terapia_seleccionada',
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select()
      .single()
    if (upErr) throw upErr

    // 4. Notificar al equipo
    try {
      const { data: equipo } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'jefe', 'especialista'])

      const nombresTerapias = terapias.map(t => t.nombre).join(', ')
      const notis = (equipo || []).map((e: any) => ({
        user_id: e.id,
        title: '🆕 Nueva solicitud de terapia para revisar',
        message: `${child.name} eligió: ${nombresTerapias}${
          mensaje_al_especialista ? `\nMensaje: "${mensaje_al_especialista}"` : ''
        }`,
        type: 'evaluacion_inicial',
        is_read: false,
        created_at: ahora,
      }))
      if (notis.length > 0) await supabaseAdmin.from('notifications').insert(notis)
    } catch (e) { console.warn('[seleccionar] noti falló', e) }

    // ⚠️ NO devolver documento_md al cliente del padre
    return NextResponse.json({
      ok: true,
      evaluacion_id,
      estado: 'terapia_seleccionada',
      mensaje: 'Tu solicitud está siendo revisada por el especialista. Recibirás una respuesta pronto.',
    })
  } catch (e: any) {
    console.error('[evaluacion-inicial][seleccionar]', e)
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}
