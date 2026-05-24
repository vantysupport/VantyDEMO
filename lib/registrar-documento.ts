// lib/registrar-documento.ts
//
// Registra cada documento Word/PDF generado en la tabla `documentos_emitidos`.
// Esto alimenta el sistema de verificación pública vía QR (/verificar/<codigo>).
//
// Llamar al final de cada generador de Word, justo antes de devolver el buffer.

import { supabaseAdmin } from '@/lib/supabase-admin'

export type TipoDocumento =
  | 'informe_clinico'
  | 'anamnesis_inicial'
  | 'anamnesis_legacy'
  | 'sesion_aba'
  | 'ficha_clinica'
  | 'reporte_padres'
  | 'reporte_comparativo'
  | 'reporte_seguro'
  | 'evaluacion_profesional'
  | 'otro'

const TIPO_LABEL: Record<TipoDocumento, string> = {
  informe_clinico:         'Informe Clínico de Tratamiento',
  anamnesis_inicial:       'Informe de Anamnesis Inicial',
  anamnesis_legacy:        'Historia Clínica — Anamnesis',
  sesion_aba:              'Registro de Sesión ABA',
  ficha_clinica:           'Ficha Clínica',
  reporte_padres:          'Reporte de Progreso para la Familia',
  reporte_comparativo:     'Análisis Comparativo de Períodos',
  reporte_seguro:          'Reporte Neuropsicológico y Clínico',
  evaluacion_profesional:  'Informe de Evaluación Profesional',
  otro:                    'Documento Clínico',
}

export interface RegistrarDocOptions {
  codigoDoc:        string
  childId?:         string
  tipo:             TipoDocumento
  tipoLabel?:       string                // override si querés un texto custom
  pacienteNombre?:  string
  pacienteIniciales?: string
  especialista?:    string
  generadoPor?:     string                // user.id que generó el doc
  fileName?:        string
  notas?:           string
  metadata?:        Record<string, any>
}

/**
 * Registra (o actualiza si ya existe) un documento emitido en la BD.
 * Es best-effort: si falla, NO bloquea la generación del Word, solo loggea.
 */
export async function registrarDocumentoEmitido(opts: RegistrarDocOptions): Promise<void> {
  try {
    if (!opts.codigoDoc) {
      console.warn('[registrarDocumentoEmitido] codigoDoc requerido — skip')
      return
    }
    const tipoLabel = opts.tipoLabel || TIPO_LABEL[opts.tipo] || 'Documento Clínico'

    // upsert por codigo_doc (si se regenera el mismo doc, se actualiza)
    const { error } = await supabaseAdmin
      .from('documentos_emitidos')
      .upsert({
        codigo_doc:         opts.codigoDoc,
        child_id:           opts.childId || null,
        tipo:               opts.tipo,
        tipo_label:         tipoLabel,
        paciente_nombre:    opts.pacienteNombre || null,
        paciente_iniciales: opts.pacienteIniciales || null,
        fecha_emision:      new Date().toISOString(),
        especialista:       opts.especialista || 'Equipo Clínico SANTI',
        generado_por:       opts.generadoPor || null,
        valido:             true,
        file_name:          opts.fileName || null,
        notas:              opts.notas || null,
        metadata:           opts.metadata || {},
      }, { onConflict: 'codigo_doc' })

    if (error) {
      console.warn('[registrarDocumentoEmitido] falló:', error.message)
    }
  } catch (e: any) {
    // No bloquear nunca la generación del Word por este registro
    console.warn('[registrarDocumentoEmitido] excepción:', e?.message)
  }
}

/**
 * Marca un documento como inválido (ej: se generó una versión nueva).
 */
export async function invalidarDocumento(codigoDoc: string, motivo?: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('documentos_emitidos')
      .update({
        valido: false,
        notas: motivo ? `INVALIDADO: ${motivo}` : 'INVALIDADO',
      })
      .eq('codigo_doc', codigoDoc)
  } catch (e: any) {
    console.warn('[invalidarDocumento] falló:', e?.message)
  }
}

/**
 * Recupera un documento emitido por su código. Devuelve null si no existe.
 */
export async function obtenerDocumentoEmitido(codigoDoc: string) {
  try {
    const { data } = await supabaseAdmin
      .from('documentos_emitidos')
      .select('*')
      .eq('codigo_doc', codigoDoc)
      .maybeSingle()
    return data
  } catch {
    return null
  }
}
