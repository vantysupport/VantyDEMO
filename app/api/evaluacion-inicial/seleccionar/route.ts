// app/api/evaluacion-inicial/seleccionar/route.ts
//
// Cuando el padre elige uno de los servicios ofrecidos por el admin,
// guardamos la selección, generamos el documento resumen (markdown),
// notificamos al especialista correspondiente y cambiamos el estado.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function generarDocumentoMarkdown(eval_: any, child: any, servicio: any) {
  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
  const areas = eval_.recomendacion_areas || {}

  const respuestas = eval_.respuestas_intake || {}
  const respuestasMd = Object.entries(respuestas)
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      const val = Array.isArray(v) ? v.join(', ') : String(v ?? '—')
      return `- **${label}:** ${val}`
    })
    .join('\n')

  return `# Documento de Evaluación Inicial
**Centro:** Neuropsicología y Terapias SANTI
**Fecha:** ${fecha}

---

## 👤 Datos del Paciente
- **Nombre:** ${child.name}
- **Fecha de nacimiento:** ${child.birth_date || '—'}
- **Diagnóstico previo:** ${child.diagnosis || 'Ninguno reportado'}

---

## 📋 Resumen del Intake (llenado por el padre/madre)

${respuestasMd}

---

## 🧠 Recomendación Clínica

**Tipo de evaluación recomendada:** ${
    eval_.recomendacion === 'psicologica'
      ? 'Evaluación Psicológica Emocional'
      : eval_.recomendacion === 'neuropsicologica'
      ? 'Evaluación Neuropsicológica'
      : 'Evaluación Integral (Psicológica + Neuropsicológica)'
  }

### Resumen ejecutivo
${eval_.recomendacion_resumen || '—'}

### Razonamiento clínico
${eval_.recomendacion_razon || '—'}

### Áreas a evaluar
${(areas.areas_a_evaluar || []).map((a: string) => `- ${a}`).join('\n') || '—'}

### Señales detectadas
${(areas.señales_detectadas || []).map((s: any) => `- **${s.categoria}:** ${s.descripcion}`).join('\n') || '—'}

**Urgencia clínica:** ${areas.urgencia || 'media'}

${areas.recomendaciones_adicionales ? `### Recomendaciones para los padres\n${areas.recomendaciones_adicionales}` : ''}

---

## ✅ Servicio Seleccionado por la Familia

- **Servicio:** ${servicio.nombre}
- **Tipo:** ${servicio.tipo}
- **Duración estimada:** ${servicio.duracion || '—'}
- **Inversión:** ${servicio.precio ? `${servicio.precio} ${servicio.moneda || 'PEN'}` : 'A coordinar'}

${servicio.descripcion ? `### Qué incluye\n${servicio.descripcion}` : ''}

${
  Array.isArray(servicio.incluye) && servicio.incluye.length > 0
    ? `### Detalle del servicio\n${servicio.incluye.map((i: string) => `- ${i}`).join('\n')}`
    : ''
}

---

*Documento generado automáticamente por SANTI · ${fecha}*
`
}

export async function POST(req: NextRequest) {
  try {
    const { evaluacion_id, servicio_id, mensaje_al_especialista } = await req.json()

    if (!evaluacion_id || !servicio_id) {
      return NextResponse.json({ error: 'evaluacion_id y servicio_id son obligatorios' }, { status: 400 })
    }

    // 1. Cargar evaluación, paciente, servicio
    const { data: eval_, error: e1 } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .select('*')
      .eq('id', evaluacion_id)
      .maybeSingle()
    if (e1) throw e1
    if (!eval_) return NextResponse.json({ error: 'Evaluación no encontrada' }, { status: 404 })

    const { data: servicio, error: e2 } = await supabaseAdmin
      .from('evaluacion_servicios')
      .select('*')
      .eq('id', servicio_id)
      .maybeSingle()
    if (e2) throw e2
    if (!servicio) return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 })

    const { data: child } = await supabaseAdmin
      .from('children')
      .select('id, name, birth_date, diagnosis, parent_id')
      .eq('id', eval_.child_id)
      .maybeSingle()
    if (!child) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

    // 2. Generar documento markdown
    const documentoMd = generarDocumentoMarkdown(eval_, child, servicio)

    // 3. Actualizar evaluación
    const ahora = new Date().toISOString()
    const { data: updated, error: upErr } = await supabaseAdmin
      .from('evaluaciones_iniciales')
      .update({
        servicio_seleccionado_id: servicio_id,
        seleccionado_en: ahora,
        mensaje_al_especialista: mensaje_al_especialista || null,
        documento_md: documentoMd,
        estado: 'seleccionado',
        updated_at: ahora,
      })
      .eq('id', evaluacion_id)
      .select()
      .single()
    if (upErr) throw upErr

    // 4. Notificar al admin/especialistas (insert en notifications)
    try {
      const { data: especialistas } = await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .in('role', ['admin', 'jefe', 'especialista'])

      const titulo = '🆕 Nueva selección de evaluación inicial'
      const mensaje = `${child.name} eligió: ${servicio.nombre}${
        mensaje_al_especialista ? `\nMensaje: "${mensaje_al_especialista}"` : ''
      }`

      const notis = (especialistas || []).map((e: any) => ({
        user_id: e.id,
        title: titulo,
        message: mensaje,
        type: 'evaluacion_inicial',
        is_read: false,
        created_at: new Date().toISOString(),
      }))

      if (notis.length > 0) {
        await supabaseAdmin.from('notifications').insert(notis)
      }
    } catch (notiErr) {
      console.warn('[seleccionar] No se pudo notificar:', notiErr)
    }

    return NextResponse.json({
      ok: true,
      evaluacion: updated,
      documento_md: documentoMd,
      mensaje: 'Información enviada al especialista. En breve se comunicarán contigo.',
    })
  } catch (e: any) {
    console.error('[evaluacion-inicial][seleccionar]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
