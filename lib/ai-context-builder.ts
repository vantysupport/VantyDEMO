// lib/ai-context-builder.ts
// Contexto completo para TODAS las IAs:
// Cerebro IA (knowledge base) + historial del niño + instrucciones del centro

import { createClient } from '@supabase/supabase-js'
import { getChildHistory } from '@/lib/child-history'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// ── Búsqueda en Cerebro IA ────────────────────────────────────────────────────
// Estrategia: embeddings reales (HF/Gemini) → vector search → keyword fallback
// FIX: antes llamaba al RPC con `query_text` (firma incorrecta) → caía al
// fallback de keywords. Ahora usa el módulo unificado `searchKnowledge`
// que genera el embedding y usa la firma correcta del RPC.
async function searchCerebroIA(query: string, maxResults = 8): Promise<string> {
  if (!query?.trim()) return ''
  const db = getAdmin()

  try {
    // 1. Búsqueda semántica con embeddings reales (vía módulo unificado)
    const { searchKnowledge } = await import('@/lib/knowledge-base')
    const resultados = await searchKnowledge(query, { maxResults, threshold: 0.5 })
    if (resultados.length > 0) {
      return formatKnowledgeResults(
        resultados.map(r => ({ contenido: r.contenido, fuente: r.fuente, similitud: r.similitud })),
        'vector'
      )
    }
  } catch (e) {
    console.warn('[searchCerebroIA] vector falló, usando keywords:', (e as any)?.message)
  }

  try {
    // 2. Fallback: búsqueda por keywords en knowledge_chunks
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 6)

    if (keywords.length === 0) return ''

    const { data: keywordResults } = await db
      .from('knowledge_chunks')
      .select('contenido, metadata, knowledge_documents(titulo, tipo)')
      .or(keywords.map(k => `contenido.ilike.%${k}%`).join(','))
      .limit(maxResults)

    if (keywordResults && keywordResults.length > 0) {
      return formatKnowledgeResults(
        keywordResults.map((r: any) => ({
          contenido: r.contenido,
          fuente: r.knowledge_documents?.titulo || r.metadata?.fuente || 'Cerebro IA',
          similitud: 70,
        })),
        'keyword'
      )
    }
  } catch {}

  return ''
}

function formatKnowledgeResults(results: any[], tipo: string): string {
  if (!results?.length) return ''
  return (
    `\n━━━ CONOCIMIENTO CLÍNICO — CEREBRO IA (${results.length} fuentes, búsqueda ${tipo}) ━━━\n` +
    results.map((r: any, i: number) => {
      const fuente = r.fuente || r.knowledge_documents?.titulo || 'Base de conocimiento'
      const similitud = r.similitud ? ` | ${Math.round(r.similitud)}% relevancia` : ''
      const contenido = (r.contenido || '').slice(0, 500)
      return `[Fuente ${i + 1}: ${fuente}${similitud}]\n${contenido}...`
    }).join('\n\n') +
    `\n━━━ FIN CONOCIMIENTO CEREBRO IA ━━━\n`
  )
}

// ── Instrucciones del centro ──────────────────────────────────────────────────
async function getCentroContext(): Promise<string> {
  try {
    const db = getAdmin()
    const { data } = await db
      .from('centro_instrucciones')
      .select('titulo, contenido, prioridad')
      .eq('activo', true)
      .order('prioridad', { ascending: false })
      .limit(6)

    if (!data?.length) return ''
    return `\n━━━ INSTRUCCIONES DEL CENTRO ━━━\n` +
      data.map((i: any) => `[${i.titulo}]: ${i.contenido}`).join('\n') +
      `\n━━━ FIN INSTRUCCIONES ━━━\n`
  } catch {
    return ''
  }
}

// ── Builder principal ─────────────────────────────────────────────────────────

// i18n: responder en el idioma del usuario
function getLangInstruction(locale: string): string {
  return ''
}

export interface AIContextResult {
  childName:       string
  childAge:        string
  diagnosis:       string
  historialTexto:  string
  knowledgeContext: string
  centroContext:   string
  fullContext:     string
}

export async function buildAIContext(
  childId?:           string,
  childNameFallback?: string,
  childAgeFallback?:  string,
  searchQuery?:       string
): Promise<AIContextResult> {

  const [childHistory, knowledgeCtx, centroCtx] = await Promise.all([
    childId
      ? getChildHistory(childId, childNameFallback, childAgeFallback)
      : Promise.resolve({
          nombre: childNameFallback || 'Paciente',
          edad:   childAgeFallback  || 'N/E',
          diagnostico: 'No especificado',
          historialTexto: '',
        }),
    searchQuery ? searchCerebroIA(searchQuery) : Promise.resolve(''),
    getCentroContext(),
  ])

  const fullContext = [centroCtx, knowledgeCtx, childHistory.historialTexto]
    .filter(Boolean).join('\n')

  return {
    childName:        childHistory.nombre,
    childAge:         childHistory.edad,
    diagnosis:        childHistory.diagnostico,
    historialTexto:   childHistory.historialTexto,
    knowledgeContext: knowledgeCtx,
    centroContext:    centroCtx,
    fullContext,
  }
}

// ── Conectar admin-chat al Cerebro IA ─────────────────────────────────────────
// Para especialistas/admin: 8 chunks (más contexto técnico)
export async function buildAdminChatContext(
  question: string,
  existingContext: string
): Promise<string> {
  const knowledgeCtx = await searchCerebroIA(question, 8)
  const centroCtx    = await getCentroContext()
  return [centroCtx, knowledgeCtx, existingContext].filter(Boolean).join('\n')
}

// ── Conectar parent-chat al Cerebro IA ────────────────────────────────────────
// Para padres: 6 chunks orientados a consejos prácticos
export async function buildParentChatContext(
  question: string,
  existingContext: string
): Promise<string> {
  // Para padres: búsqueda más orientada a consejos prácticos
  const query = `estrategias para padres ${question}`
  const knowledgeCtx = await searchCerebroIA(query, 6)
  return [knowledgeCtx, existingContext].filter(Boolean).join('\n')
}

// ── Para endpoints clínicos (evaluación, recomendación, informes) ──────────
// 10 chunks con threshold más bajo para captar más contexto técnico
export async function buildClinicalContext(question: string, maxResults = 10): Promise<string> {
  if (!question?.trim()) return ''
  try {
    const { searchKnowledge } = await import('@/lib/knowledge-base')
    const resultados = await searchKnowledge(question, { maxResults, threshold: 0.45 })
    if (resultados.length === 0) return ''
    return formatKnowledgeResults(
      resultados.map(r => ({ contenido: r.contenido, fuente: r.fuente, similitud: r.similitud })),
      'vector'
    )
  } catch { return '' }
}

// ── callGeminiSafe (compatibilidad — ahora usa Groq) ─────────────────────────
export async function callGeminiSafe(
  _ai: any, _model: string, prompt: string,
  config: any = {}, maxRetries = 3
): Promise<string> {
  return callGroqSimple(
    'Eres un asistente clínico especializado en ABA, TEA, TDAH y neurodesarrollo. Responde en español.',
    prompt,
    { model: GROQ_MODELS.SMART, temperature: config.temperature ?? 0.5, maxTokens: config.maxOutputTokens ?? 2500, maxRetries }
  )
}

// ── Parsers JSON ──────────────────────────────────────────────────────────────
export function parseAIJson(rawText: string, fallback: any = {}): any {
  try {
    const match = rawText.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  return { ...fallback, raw_text: rawText }
}

export function sanitizeGroqJson(raw: string): any {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch {}
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return {}
    return JSON.parse(
      match[0]
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .replace(/(?<!\\)\n/g, '\\n')
        .replace(/(?<!\\)\r/g, '\\r')
        .replace(/(?<!\\)\t/g, '\\t')
    )
  } catch { return {} }
}
