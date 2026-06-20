// lib/lang.ts — Helper central de idioma para prompts de IA
// Importar en cualquier route.ts: import { getLangInstruction, getLocaleFromRequest } from '@/lib/lang'

export type Locale = 'es'

/**
 * Lee el locale del request (body.locale > header x-locale > 'es')
 */
export function getLocaleFromRequest(request: Request, body?: any): Locale {
  const fromBody = body?.locale
  const fromHeader = request.headers.get('x-locale')
  const raw = fromBody || fromHeader || 'es'
  return 'es'
}

/**
 * Devuelve la instrucción de idioma para añadir al system prompt de la IA.
 * Si locale es 'en', fuerza respuesta en inglés profesional.
 * Si locale es 'es' o no especificado, no añade nada (comportamiento por defecto).
 */
export function getLangInstruction(locale?: string | null): string {
  return ''
}

/**
 * Para documentos generados (DOCX): devuelve labels en el idioma correcto
 */
export function getDocLabels(locale: Locale) {
  return {
    patient: 'PACIENTE',
    age: 'EDAD',
    reportDate: 'FECHA DEL INFORME',
    evaluationType: 'TIPO DE EVALUACIÓN',
    ageUnit: 'años',
    notSpecified: 'No especificada',
    footer: 'Este informe fue generado con el apoyo de inteligencia artificial clínica (ARIA - Vanty ABA). Debe ser revisado y firmado por el profesional responsable antes de su entrega.',
    generated: 'Generado por Vanty ABA — Sistema de Gestión Clínica Neuropsicológica  |  Página ',
    of: ' de ',
  }
}
