// scripts/seed-abllsr-imitacion-motriz.ts
//
// Inserta en el Cerebro IA los 27 ítems de la Sección D del ABLLS-R
// (Imitación motriz). Cada ítem se guarda como un chunk independiente
// con embedding y metadatos ricos (código D1..D27, área, fuente).
//
// CÓMO USAR:
//   npx tsx scripts/seed-abllsr-imitacion-motriz.ts
//
// Requiere variables de entorno en .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   HF_API_KEY            (opcional — si no, se guarda solo texto)
//   GEMINI_API_KEY        (opcional fallback)

/* eslint-disable no-console */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Cargar .env.local manualmente (sin necesidad de dotenv) ───────────
function loadEnv(file: string) {
  if (!fs.existsSync(file)) return
  const content = fs.readFileSync(file, 'utf-8')
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv(path.join(process.cwd(), '.env.local'))
loadEnv(path.join(process.cwd(), '.env'))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ─── Embedding con HuggingFace (gratis) ────────────────────────────────
async function embedHF(text: string): Promise<number[] | null> {
  const key = process.env.HF_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-mpnet-base-v2', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text.slice(0, 8000), options: { wait_for_model: true } }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const vec = Array.isArray(data[0]) ? data[0] : data
    return Array.isArray(vec) && vec.length > 0 ? vec : null
  } catch { return null }
}

// ─── DATOS: ABLLS-R · Sección D · Imitación motriz (27 ítems) ──────────
const FUENTE = 'ABLLS-R'
const AREA = 'Imitación motriz'
const ITEMS = [
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
]

// ─── Formato para máxima recuperabilidad ───────────────────────────────
function formatChunk(it: typeof ITEMS[0]): string {
  return [
    `Código: ${it.codigo}`,
    `Tarea: ${it.nombre}`,
    `Área: ${AREA}`,
    `Fuente: ${FUENTE}`,
    `Objetivo: ${it.objetivo}`,
    `Criterios de logro: ${it.criterios}`,
  ].join('\n')
}

async function main() {
  console.log('🧠  SANTI · Cerebro IA — Importador de protocolos')
  console.log(`📚  Fuente: ${FUENTE}`)
  console.log(`📂  Área:   ${AREA}`)
  console.log(`📦  Ítems:  ${ITEMS.length}`)
  console.log('')

  // Comprobar si ya existe el documento para evitar duplicados
  const titulo = `${FUENTE} · Sección D · ${AREA}`
  const { data: existing } = await supa
    .from('knowledge_documents')
    .select('id, total_chunks')
    .eq('titulo', titulo)
    .maybeSingle()

  if (existing) {
    const respuesta = process.argv.includes('--force') ? 'sí' : ''
    if (!respuesta) {
      console.log(`⚠️  Ya existe un documento con título "${titulo}" (${existing.total_chunks} chunks).`)
      console.log('   Para reemplazarlo, corre el script con --force:')
      console.log('   npx tsx scripts/seed-abllsr-imitacion-motriz.ts --force')
      return
    }
    console.log(`🗑️  Eliminando documento existente y sus chunks…`)
    await supa.from('knowledge_chunks').delete().eq('document_id', existing.id)
    await supa.from('knowledge_documents').delete().eq('id', existing.id)
  }

  // 1. Crear documento
  console.log('📝  Creando documento en knowledge_documents…')
  const { data: doc, error: docErr } = await supa
    .from('knowledge_documents')
    .insert({
      titulo,
      tipo: 'protocolo',
      descripcion: `Sección D del Protocolo ABLLS-R (Assessment of Basic Language and Learning Skills - Revised). 27 ítems de imitación motriz: con objetos, gruesa, fina, con sugerencias, en espejo, secuencias, velocidad, intensidad, simultánea con vocalización y demorada.`,
      procesado: false,
      total_chunks: 0,
      metadata: { fuente: FUENTE, area: AREA, items_count: ITEMS.length, source_type: 'tabla_estructurada', seeded_by: 'script' },
    })
    .select()
    .single()
  if (docErr) throw docErr
  const docId = (doc as any).id
  console.log(`   ✅ doc id: ${docId}`)

  // 2. Insertar chunks
  let indexados = 0, conEmbedding = 0
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i]
    const contenido = formatChunk(item)
    process.stdout.write(`\r🔄  Indexando ${i + 1}/${ITEMS.length} · ${item.codigo}…  `)

    let embeddingValue: string | null = null
    try {
      const emb = await embedHF(contenido)
      if (emb && emb.length > 0) {
        embeddingValue = `[${emb.join(',')}]`
        conEmbedding++
      }
    } catch { /* sin embedding, igual guardamos */ }

    const { error } = await supa.from('knowledge_chunks').insert({
      document_id: docId,
      chunk_index: i,
      contenido,
      embedding: embeddingValue,
      metadata: {
        codigo: item.codigo,
        nombre: item.nombre,
        fuente: FUENTE,
        area: AREA,
        item_type: 'protocolo_estructurado',
        sin_embedding: embeddingValue === null,
      },
    })
    if (error) {
      console.error(`\n❌  Falló ${item.codigo}: ${error.message}`)
    } else {
      indexados++
    }
    // Pausa breve para no saturar HF
    if (i < ITEMS.length - 1) await new Promise(r => setTimeout(r, 200))
  }

  // 3. Marcar como procesado
  await supa
    .from('knowledge_documents')
    .update({ procesado: indexados > 0, total_chunks: indexados })
    .eq('id', docId)

  console.log('\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`✅  Indexados: ${indexados}/${ITEMS.length} ítems`)
  console.log(`🔮  Con embeddings: ${conEmbedding}`)
  console.log(`📝  Solo texto: ${indexados - conEmbedding}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('Ahora la IA debería poder responder cosas como:')
  console.log('  · "¿Qué dice D5 del ABLLS-R?"')
  console.log('  · "Criterios de logro de D20"')
  console.log('  · "Diferencia entre imitación en espejo D8 y D11"')
  console.log('  · "Para un niño que ya logra D1-D5, ¿qué objetivo sigue?"')
}

main().catch(e => {
  console.error('\n💥 Error fatal:', e)
  process.exit(1)
})
