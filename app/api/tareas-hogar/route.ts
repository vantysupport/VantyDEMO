// app/api/tareas-hogar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'


// i18n: responder en el idioma del usuario
function getLangInstruction(locale?: string | null): string {
  return ''
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const childId      = searchParams.get('child_id')
  const parentUserId = searchParams.get('parent_user_id')
  const soloActivas  = searchParams.get('activas') !== 'false'

  try {
    // FIX: si viene parentUserId, verificar que tiene acceso a ese child_id
    if (parentUserId && childId) {
      const { data: acceso } = await supabaseAdmin
        .from('parent_accounts')
        .select('id')
        .eq('user_id', parentUserId)
        .eq('child_id', childId)
        .single()

      if (!acceso) {
        return NextResponse.json({ error: 'No tienes acceso a este paciente' }, { status: 403 })
      }
    }

    let query = supabaseAdmin
      .from('tareas_hogar')
      .select('id, titulo, objetivo, instrucciones, completada, fecha_asignada, fecha_limite, nota_padre, dificultad_reportada, activa, child_id, children(name)')
      .order('fecha_asignada', { ascending: false })

    if (childId)     query = query.eq('child_id', childId)
    if (soloActivas) query = query.eq('activa', true)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'
    const { action } = body

    // ── CREAR TAREA CON IA ────────────────────────────────────
    if (action === 'crear' || !action) {
      const { child_id, terapeuta_id, sesion_id, titulo, objetivo, fecha_limite } = body

      if (!child_id || !titulo) {
        return NextResponse.json({ error: 'child_id y titulo son requeridos' }, { status: 400 })
      }

      const instrucciones = await generarInstruccionesIA(child_id, titulo, objetivo, userLocale)

      const { data, error } = await supabaseAdmin
        .from('tareas_hogar')
        .insert({
          child_id, terapeuta_id, sesion_id,
          titulo, objetivo,
          instrucciones,
          fecha_asignada: new Date().toISOString().split('T')[0],
          fecha_limite: fecha_limite || null,
          activa: true
        })
        .select('*, children(name)')
        .single()

      if (error) throw error

      await notificarPadresTareaNueva(child_id, data)

      return NextResponse.json({ data })
    }

    // ── MARCAR COMO COMPLETADA (por padre) ───────────────────
    if (action === 'completar') {
      const { id, nota_padre, dificultad_reportada } = body

      const { data, error } = await supabaseAdmin
        .from('tareas_hogar')
        .update({
          completada: true,
          fecha_completada: new Date().toISOString(),
          nota_padre: nota_padre || null,
          dificultad_reportada: dificultad_reportada || null
        })
        .eq('id', id)
        .select('*, children(name, id)')
        .single()

      if (error) throw error

      await notificarTerapeutaTareaCompletada(data)

      return NextResponse.json({ data })
    }

    // ── GENERAR INSTRUCCIONES IA para tarea existente ─────────
    if (action === 'regenerar_instrucciones') {
      const { id, child_id, titulo, objetivo } = body
      const instrucciones = await generarInstruccionesIA(child_id, titulo, objetivo)

      const { data, error } = await supabaseAdmin
        .from('tareas_hogar')
        .update({ instrucciones })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ data })
    }

    // ── DESACTIVAR tarea ──────────────────────────────────────
    if (action === 'desactivar') {
      const { id } = body
      const { error } = await supabaseAdmin
        .from('tareas_hogar')
        .update({ activa: false })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Accion no reconocida' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : e.message }, { status: 500 })
  }
}

// ─── GENERAR INSTRUCCIONES CON GROQ ──────────────────────────
async function generarInstruccionesIA(childId: string, titulo: string, objetivo?: string, userLocale = 'es'): Promise<string> {
  try {
    const { data: child } = await supabaseAdmin
      .from('children')
      .select('name, age, birth_date, diagnosis')
      .eq('id', childId)
      .single()

    // FIX: calcular edad desde birth_date si age es null
    let edadTexto = 'edad no registrada'
    if ((child as any)?.birth_date) {
      const hoy = new Date()
      const nac = new Date((child as any).birth_date)
      const diff = hoy.getFullYear() - nac.getFullYear()
      const m = hoy.getMonth() - nac.getMonth()
      const edad = (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) ? diff - 1 : diff
      edadTexto = `${edad} años`
    } else if ((child as any)?.age) {
      edadTexto = `${(child as any).age} años`
    }

    const prompt = `Eres un terapeuta ABA especializado en neuropsicologia infantil.

Genera instrucciones CLARAS y PRACTICAS para que los padres realicen esta actividad terapeutica en casa:

PACIENTE: ${(child as any)?.name}, ${edadTexto}, diagnostico: ${(child as any)?.diagnosis}
ACTIVIDAD: ${titulo}
OBJETIVO TERAPEUTICO: ${objetivo || 'Reforzar habilidades trabajadas en sesion'}

Responde con instrucciones paso a paso en este formato exacto:
MATERIALES NECESARIOS: [lista de materiales, si aplica]
DURACION SUGERIDA: [X minutos]
COMO HACERLO:
1. [paso 1]
2. [paso 2]
3. [paso 3]
(maximo 5 pasos)
CONSEJO PARA PADRES: [1 consejo practico]
QUE OBSERVAR: [que registrar o notar]
Usa lenguaje simple, sin tecnicismos. Maximo 150 palabras total.`

    const response = await callGroqSimple(
      'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo.',
      prompt,
      { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 2000 }
    )

    return response || generarInstruccionesGenericas(titulo)
  } catch {
    return generarInstruccionesGenericas(titulo)
  }
}

function generarInstruccionesGenericas(titulo: string): string {
  return `ACTIVIDAD: ${titulo}

COMO HACERLO:
1. Busca un momento tranquilo del dia, sin distracciones.
2. Realiza la actividad junto a tu hijo/a de forma positiva.
3. Celebra cada logro, por pequeno que sea.
4. Si hay dificultades, toma un descanso y reintentalo despues.

DURACION SUGERIDA: 10-15 minutos
CONSEJO PARA PADRES: La constancia es clave. Intenta hacerlo a la misma hora cada dia.
QUE OBSERVAR: Nivel de participacion y cualquier dificultad que notes.`
}

// ─── NOTIFICACIONES ───────────────────────────────────────────
async function notificarPadresTareaNueva(childId: string, tarea: any) {
  try {
    const { data: padres } = await supabaseAdmin
      .from('parent_accounts')
      .select('user_id')
      .eq('child_id', childId)

    if (!padres || padres.length === 0) return

    const notifs = padres.map(p => ({
      user_id: p.user_id,
      child_id: childId,
      tipo: 'tarea_nueva',
      titulo: 'Nueva actividad para casa asignada',
      mensaje: `Tu terapeuta asignó una nueva actividad: "${tarea.titulo}". Ingresa a la app para ver las instrucciones paso a paso.`,
      prioridad: 2,
      canal: 'in_app',
      metadata: { tarea_id: tarea.id }
    }))

    await supabaseAdmin.from('notificaciones').insert(notifs)
  } catch (err) {
    console.error('Error notificando tarea nueva:', err)
  }
}

async function notificarTerapeutaTareaCompletada(tarea: any) {
  try {
    if (!tarea.terapeuta_id) return
    await supabaseAdmin.from('notificaciones').insert({
      user_id: tarea.terapeuta_id,
      child_id: tarea.child_id,
      tipo: 'tarea_completada',
      titulo: 'Actividad completada por la familia',
      mensaje: `La familia completó la actividad "${tarea.titulo}"${tarea.nota_padre ? '. Nota: ' + tarea.nota_padre : ''}.`,
      prioridad: 3,
      canal: 'in_app',
      metadata: { tarea_id: tarea.id }
    })
  } catch (err) {
    console.error('Error notificando tarea completada:', err)
  }
}
