// ==============================================================================
// ARCHIVO: app/admin/utils/helpers.ts
// Funciones utilitarias comunes
// ==============================================================================

/**
 * Calcula la edad en formato string legible
 * @param birthDate - Fecha de nacimiento (ISO string o Date)
 */
export function calcularEdad(birthDate: string | Date | null): string {
  if (!birthDate) return 'N/E'
  const birth = new Date(birthDate)
  const today = new Date()
  let years = today.getFullYear() - birth.getFullYear()
  let months = today.getMonth() - birth.getMonth()
  
  if (today.getDate() < birth.getDate()) months--
  if (months < 0) { years--; months += 12 }
  
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`
  if (months === 0) return `${years} año${years !== 1 ? 's' : ''}`
  return `${years} año${years !== 1 ? 's' : ''} ${months} mes${months !== 1 ? 'es' : ''}`
}

/**
 * Calcula la edad como número entero de años
 * @param birthDate - Fecha de nacimiento (ISO string)
 */
export function calcularEdadNumerica(birthDate: string | null | undefined): number {
  if (!birthDate) return 0
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

/**
 * Formatea una fecha ISO a formato legible en español
 */
export function formatFecha(dateStr: string): string {
  if (!dateStr) return ''
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return `${d} ${meses[m-1]} ${y}`
}

/**
 * Formatea hora de 24h a 12h con AM/PM
 */
export function formatHora(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

/**
 * Trunca texto a un máximo de caracteres
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Genera iniciales de un nombre
 */
export function getInitials(name: string): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}
