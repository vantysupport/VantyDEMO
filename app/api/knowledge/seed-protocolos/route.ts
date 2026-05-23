// app/api/knowledge/seed-protocolos/route.ts
//
// Endpoint "one-click" para importar protocolos preestablecidos al Cerebro IA.
// El admin solo presiona un botón en KnowledgeBaseView → la IA recibe los items.
//
// Soporta varios protocolos identificados por `preset`:
//   - abllsr-d  → ABLLS-R Sección D (Imitación motriz) · 27 ítems
//   (futuro: abllsr-a, abllsr-b, ..., afls-bls, ...)

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateEmbedding } from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

// ─── DATOS: ABLLS-R · Sección D · Imitación motriz ──────────────────────
const PRESET_ABLLSR_D = {
  titulo: 'ABLLS-R · Sección D · Imitación motriz',
  fuente: 'ABLLS-R',
  area: 'Imitación motriz',
  descripcion: 'Sección D del Protocolo ABLLS-R (Assessment of Basic Language and Learning Skills - Revised). 27 ítems de imitación motriz: con objetos, gruesa, fina, con sugerencias, en espejo, secuencias, velocidad, intensidad, simultánea con vocalización y demorada.',
  items: [
    { codigo: 'D1',  nombre: 'Imitación motriz usando objetos.', objetivo: 'A solicitud, el estudiante imitará una actividad motriz con un objeto.', criterios: '4= Por lo menos 10 acciones con por lo menos 2 diferentes acciones para cada objeto. 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D2',  nombre: 'Imitación motriz usando objetos con una discriminación.', objetivo: 'A solicitud, el estudiante imitará una actividad motriz que requiere discriminación entre objetos.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas. 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D3',  nombre: 'Imitación motriz de movimientos motrices gruesos con sugerencias verbales.', objetivo: 'A solicitud, el estudiante imitará un movimiento motriz bruto cuando se le presentan sugerencias verbales.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas. 3= Imita cualquier 10 acciones. 2= Imita cualquier 5 acciones. 1= Imita cualquier 2 acciones.' },
    { codigo: 'D4',  nombre: 'Imitar movimientos de la pierna y pie.', objetivo: 'A solicitud, el estudiante imitará un movimiento motriz bruto de la pierna y pie.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas. 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D5',  nombre: 'Imitar movimientos del brazo y mano.', objetivo: 'A solicitud, el estudiante imitará un movimiento motriz bruto del brazo y mano.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas. 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D6',  nombre: 'Imitar distinguiendo los movimientos estacionarios y los movimientos cinéticos.', objetivo: 'Cuando se le pide, el estudiante imitará acciones similares que necesitan que distinga entre una acción estacionaria (mantener la posición) o cinética (movimiento).', criterios: '4= Por lo menos 10 parejas de acciones e imita acciones originales. 3= Imita 10 parejas de acciones. 2= Imita 5 parejas de acciones. 1= Imita 2 parejas de acciones similares cuando una respuesta en la pareja incluye movimiento y la otra incluye una acción estacionaria.' },
    { codigo: 'D7',  nombre: 'Variedad de instrucciones de imitación.', objetivo: 'El estudiante imitará acciones cuando una variedad de instrucciones son usadas para indicar que debe imitar una acción.', criterios: '2= Imita acciones conocidas cuando dado 1 de 4 acciones diferentes para imitar. 1= Imita acciones conocidas cuando dado 1 de por lo menos 2 instrucciones para imitar.' },
    { codigo: 'D8',  nombre: 'Imitación de movimientos motrices brutos mostrados en un espejo.', objetivo: 'A solicitud, el estudiante imitará movimientos motrices brutos que observa demostrados por otros en un espejo.', criterios: '4= Por lo menos 10 acciones e imita acciones originales. 3= Imita 10 acciones. 2= Imita 4 acciones. 1= Imita 2 acciones.' },
    { codigo: 'D9',  nombre: 'Imitar movimientos de la cabeza.', objetivo: 'A solicitud, el estudiante imitará un movimiento motriz bruto de la cabeza.', criterios: '2= Imita 3 acciones. 1= 1 acción.' },
    { codigo: 'D10', nombre: 'Imitar movimientos de la boca y lengua.', objetivo: 'A solicitud, el estudiante imitará una actividad motriz que incluye movimientos de la boca y lengua.', criterios: '2= Imita 4 acciones. 1= Imita 2 acciones.' },
    { codigo: 'D11', nombre: 'Imitación de movimientos motrices de la cara/oral mostrados en un espejo.', objetivo: 'Al ser solicitado, el estudiante imitará los movimientos motrices de la cara/oral que observa demostrados por otros en un espejo.', criterios: '4= Por lo menos 6 movimientos motrices de la cara/oral que incluyen los que necesitan el movimiento repetido y los que necesitan mantener la posición (estacionaria). 3= Imita 6 acciones. 2= Imita 4 acciones. 1= Imita 2 acciones motrices de la cara/oral.' },
    { codigo: 'D12', nombre: 'Imitación de movimientos motrices finos.', objetivo: 'A solicitud, el estudiante imitará movimientos finos.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas. 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D13', nombre: 'Imitación de tocar objetos en una secuencia.', objetivo: 'A solicitud, el estudiante imitará tocar objetos en una secuencia al mismo tiempo que una persona demuestra la secuencia.', criterios: '2= Puede imitar una secuencia de tocar 4 de 6 objetos. 1= Puede imitar una secuencia de tocar 2 de 4 objetos.' },
    { codigo: 'D14', nombre: 'Imitación de soplar.', objetivo: 'A solicitud, el estudiante imitará soplar por un periodo sostenido como corresponde al modelo.', criterios: '2= Imita las dos acciones (corta y sostenida por lo menos 2 segundos). 1= Puede imitar o la corta o la sostenida.' },
    { codigo: 'D15', nombre: 'Imitación de la velocidad de una acción en curso con objetos.', objetivo: 'A solicitud, el estudiante imitará una actividad motriz que incluye hacer coincidir la velocidad de un objeto con el modelo en curso.', criterios: '2= Imita las acciones haciendo coincidir la velocidad del modelo en curso. 1= Necesita solo una sugerencia verbal para hacer coincidir la velocidad del modelo en curso.' },
    { codigo: 'D16', nombre: 'Imitar la velocidad de una acción con objetos demostrada recientemente.', objetivo: 'A solicitud, el estudiante imitará una actividad motriz que incluye hacer coincidir la velocidad de un objeto con el modelo reciente.', criterios: '2= Imita las acciones con objetos y hace coincidir la velocidad de la acción inmediatamente después de una demostración. 1= Necesita solo una sugerencia verbal para hacer coincidir la velocidad de una acción con un objeto después de una demostración.' },
    { codigo: 'D17', nombre: 'Imitar la velocidad de una acción.', objetivo: 'A solicitud, el estudiante imitará un movimiento motriz bruto que corresponde a la velocidad del modelo.', criterios: '2= Siempre imita acciones que corresponden a la velocidad del modelo. 1= Requiere solo sugerencias verbales para corresponder con la velocidad del modelo.' },
    { codigo: 'D18', nombre: 'Imitación de tocar objetos en una secuencia después de un modelo.', objetivo: 'A solicitud, el estudiante imitará tocar objetos en una secuencia después de una demostración del orden en que los objetos deberán ser tocados.', criterios: '2= Puede imitar tocando una secuencia de 4 de 6 objetos inmediatamente después de un modelo. 1= Puede imitar tocando una secuencia de 2 de 4 objetos inmediatamente después de una demostración.' },
    { codigo: 'D19', nombre: 'Imitación de una secuencia de acciones cambiando con el modelo.', objetivo: 'A solicitud, el estudiante imitará una secuencia de acciones motrices con el modelo inmediatamente cambiando de una a otra cuando cambia el modelo.', criterios: '2= Puede imitar una secuencia de 6 acciones diferentes en 10 segundos como demostrada. 1= Puede imitar una secuencia de 4 acciones diferentes de una demostración.' },
    { codigo: 'D20', nombre: 'Imitar movimientos en secuencia.', objetivo: 'A solicitud, el estudiante imitará la secuencia de actividades motrices.', criterios: '4= Por lo menos 10 acciones y siempre imita secuencias nuevas. 3= 10 secuencias de 2 acciones. 2= 5 secuencias de acciones. 1= 2 secuencias de 2 acciones después del modelo de la secuencia de las acciones.' },
    { codigo: 'D21', nombre: 'Imitación de la intensidad de una acción.', objetivo: 'A solicitud, el estudiante imitará una actividad del movimiento bruto y hará coincidir la intensidad del modelo.', criterios: '2= Imita la acción incluyendo hacer coincidir la intensidad del modelo. 1= Necesita solo una sugerencia verbal para hacer coincidir la intensidad del modelo.' },
    { codigo: 'D22', nombre: 'Imitación del número de repeticiones de un movimiento motriz.', objetivo: 'A solicitud, el estudiante imitará el movimiento motriz por el mismo número de repeticiones que el modelo.', criterios: '2= Imita el número de uno a tres repeticiones de una respuesta sin sugerencia. 1= Imita el número de uno a tres repeticiones con solo una sugerencia verbal o de gesto.' },
    { codigo: 'D23', nombre: 'Imitación simultánea de un movimiento y una vocalización.', objetivo: 'A solicitud, el estudiante imitará un movimiento motriz que corresponde con una vocalización.', criterios: '2= Imita hasta tres repeticiones de por lo menos 4 respuestas diferentes de acciones y verbalizaciones sin sugerencia. 1= Imita por lo menos una respuesta de acción y verbalización sin sugerencia.' },
    { codigo: 'D24', nombre: 'Una secuencia de imitaciones motrices con objetos múltiples.', objetivo: 'A solicitud, el estudiante imitará una secuencia de acciones usando objetos numerosos.', criterios: '2= Puede repetir por lo menos 6 secuencias diferentes de por lo menos 3 acciones que incluyen 4 objetos con el modelo original visible. 1= Puede repetir por lo menos 6 secuencias diferentes de por lo menos 2 acciones que incluyen 4 objetos con el modelo original visible.' },
    { codigo: 'D25', nombre: 'Imitar movimientos motrices sin sugerencias verbales directas.', objetivo: 'El estudiante imitará un movimiento motriz bruto modelado por un individuo sin que se le diga que lo haga, solo por el reconocimiento social de poder corresponderlos.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas. 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D26', nombre: 'Imitar acciones de otros espontáneamente.', objetivo: 'El estudiante imitará un movimiento motriz bruto espontáneamente, modelado por un individuo que no está directamente en frente del estudiante.', criterios: '4= Por lo menos 10 acciones y siempre imita acciones nuevas (no es necesario tener una secuencia de 10). 3= 10 acciones. 2= 5 acciones. 1= 2 acciones.' },
    { codigo: 'D27', nombre: 'Imitación demorada.', objetivo: 'A solicitud, o cuando nombra sus propias acciones, el estudiante podrá demostrar acciones que observó unas cuantas horas antes en el día.', criterios: '4= Nombra e imita varias acciones observadas hace 4 horas. 3= Nombra e imita después de 1 hora. 2= Nombra e imita después de 10 minutos. 1= A solicitud, 1 acción después de 5 minutos.' },
  ],
}

const PRESETS: Record<string, typeof PRESET_ABLLSR_D> = {
  'abllsr-d': PRESET_ABLLSR_D,
}

function formatChunk(item: any, fuente: string, area: string): string {
  return [
    `Código: ${item.codigo}`,
    `Tarea: ${item.nombre}`,
    `Área: ${area}`,
    `Fuente: ${fuente}`,
    `Objetivo: ${item.objetivo}`,
    `Criterios de logro: ${item.criterios}`,
  ].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const { preset, force } = await req.json()
    if (!preset || !PRESETS[preset]) {
      return NextResponse.json({
        error: 'preset no encontrado',
        disponibles: Object.keys(PRESETS),
      }, { status: 400 })
    }

    const data = PRESETS[preset]

    // 1. Si ya existe, eliminar o avisar
    const { data: existente } = await supabaseAdmin
      .from('knowledge_documents')
      .select('id, total_chunks')
      .eq('titulo', data.titulo)
      .maybeSingle()

    if (existente && !force) {
      return NextResponse.json({
        ok: false,
        ya_existe: true,
        existente: { id: existente.id, total_chunks: existente.total_chunks },
        mensaje: `Ya existe "${data.titulo}" con ${existente.total_chunks} chunks. Envía { force: true } para reemplazar.`,
      })
    }

    if (existente && force) {
      await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', existente.id)
      await supabaseAdmin.from('knowledge_documents').delete().eq('id', existente.id)
    }

    // 2. Crear documento
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('knowledge_documents')
      .insert({
        titulo: data.titulo,
        tipo: 'protocolo',
        descripcion: `${data.descripcion}\n\n[Fuente: ${data.fuente} · Área: ${data.area} · ${data.items.length} ítems · preset:${preset}]`,
        procesado: false,
        total_chunks: 0,
      })
      .select()
      .single()
    if (docErr) throw docErr
    const docId = (doc as any).id

    // 3. Insertar chunks (en lotes de 5 para no saturar HF)
    let indexados = 0, conEmbedding = 0
    for (let i = 0; i < data.items.length; i += 5) {
      const lote = data.items.slice(i, i + 5)
      await Promise.all(
        lote.map(async (item, idx) => {
          const chunkIdx = i + idx
          const contenido = formatChunk(item, data.fuente, data.area)

          let embeddingValue: string | null = null
          try {
            const emb = await generateEmbedding(contenido)
            if (emb.length > 0) {
              embeddingValue = `[${emb.join(',')}]`
              conEmbedding++
            }
          } catch { /* sin embedding, igual guardamos */ }

          try {
            await supabaseAdmin.from('knowledge_chunks').insert({
              document_id: docId,
              chunk_index: chunkIdx,
              contenido,
              embedding: embeddingValue,
              metadata: {
                codigo: item.codigo,
                nombre: item.nombre,
                fuente: data.fuente,
                area: data.area,
                item_type: 'protocolo_estructurado',
                sin_embedding: embeddingValue === null,
              },
            })
            indexados++
          } catch (e: any) {
            console.warn(`[seed-protocolos] chunk ${item.codigo} falló:`, e?.message)
          }
        })
      )
      if (i + 5 < data.items.length) await new Promise(r => setTimeout(r, 250))
    }

    // 4. Marcar como procesado
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ procesado: indexados > 0, total_chunks: indexados })
      .eq('id', docId)

    return NextResponse.json({
      ok: true,
      document_id: docId,
      titulo: data.titulo,
      items_totales: data.items.length,
      chunks_indexados: indexados,
      con_embedding: conEmbedding,
      sin_embedding: indexados - conEmbedding,
    })
  } catch (e: any) {
    console.error('[seed-protocolos]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
