// ============================================================================
// PARCHE v3 — reporte-word/route.ts
// Integra: portada institucional · firma especialista · gráficas · QR
// ============================================================================
//
// INSTRUCCIONES DE APLICACIÓN
// ───────────────────────────
// 1. Reemplazar lib/santi-report-template.ts por el nuevo archivo (ya entregado).
// 2. En app/api/reporte-word/route.ts añadir los imports nuevos (bloque A).
// 3. Reemplazar la función makeDoc() por la nueva versión (bloque B).
// 4. En cada función generadora (generarReportePadres, generarReporteABA, etc.)
//    aplicar los cambios de bloque C al inicio y al final de sections[].
// 5. Añadir la función generarCodigoDoc() (bloque D).
//
// ============================================================================


// ── BLOQUE A: Nuevos imports desde santi-report-template ─────────────────────
// Agregar a la línea que ya importa de '@/lib/santi-report-template':

import * as tpl from '@/lib/santi-report-template'
import type { HabilidadFila, RecomendacionesBloque } from '@/lib/santi-report-template'
// ↑ estas ya existen — agregar únicamente las nuevas:
import {
  portadaInstitucional,
  firmaEspecialista,
  graficoProgresoBarra,
  graficoCurvaLineal,
  selloQRVerificacion,
  generarCodigoDocumento,
  type PortadaOptions,
  type FirmaOptions,
  type SelloQROptions,
  type DatoGrafico,
} from '@/lib/santi-report-template'


// ── BLOQUE B: makeDoc() mejorado — soporte portada en sección separada ────────
// Reemplaza la función makeDoc() existente (líneas ~97-112):

function makeDoc(
  sections: DocChild[],
  fileName: string,
  opts?: {
    tipoInforme?: string
    especialista?: string
    credenciales?: string
    childName?: string
    childAge?: string
    diagnosis?: string
    codigoDoc?: string
    periodoEval?: string
    conPortada?: boolean   // default true
    conQR?: boolean        // default true
  }
) {
  const conPortada = opts?.conPortada !== false
  const conQR      = opts?.conQR !== false
  const codigo     = opts?.codigoDoc ?? ''
  const fecha      = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  // Sección 1: portada (página completa)
  const seccionPortada = conPortada ? [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 720, right: 1260, bottom: 720, left: 1260 },
      },
    },
    children: portadaInstitucional({
      tipoInforme:    opts?.tipoInforme  ?? 'Informe Clínico',
      nombrePaciente: opts?.childName    ?? 'Paciente',
      edadPaciente:   opts?.childAge,
      diagnostico:    opts?.diagnosis,
      especialista:   opts?.especialista,
      credenciales:   opts?.credenciales,
      fechaEmision:   fecha,
      periodoEval:    opts?.periodoEval,
      codigoDoc:      codigo || undefined,
    }) as any[],
  }] : []

  // Sello QR al final del documento
  const selloFinal: DocChild[] = conQR && codigo ? [
    ...(selloQRVerificacion({
      codigoDoc:    codigo,
      fechaEmision: fecha,
      especialista: opts?.especialista,
    }) as any[]),
  ] : []

  // Sección 2: contenido principal + firma
  const seccionContenido = {
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1200, right: 1260, bottom: 1440, left: 1260 },
      },
    },
    headers: { default: tpl.headerInstitucional(opts?.tipoInforme ?? fileName) },
    footers: { default: tpl.piePaginaOficial() },
    children: [
      ...sections,
      // Firma del especialista
      ...(firmaEspecialista({
        nombre:      opts?.especialista,
        titulo:      opts?.credenciales?.split('·')[0]?.trim(),
        colegiatura: opts?.credenciales?.split('·')[1]?.trim(),
        especialidad:'Neuropsicología Infantil y ABA',
        fecha,
      }) as any[]),
      // Sello QR
      ...selloFinal,
    ] as any[],
  }

  return new Document({
    numbering: {
      config: [{
        reference: 'bul',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 300 } } },
        }],
      }],
    },
    styles: { default: { document: { run: { font: 'Calibri', size: 20 } } } },
    sections: [...seccionPortada, seccionContenido],
  })
}


// ── BLOQUE C: Cambios en cada función generadora ──────────────────────────────
//
// EJEMPLO para generarReportePadres():
// ─────────────────────────────────────
// 1. Al inicio de la función, generar el código de documento:
//
//    const codigoDoc = generarCodigoDocumento(childId, 'padres')
//
// 2. Donde se llama a makeDoc(), pasar las nuevas opciones:
//
//    // ANTES:
//    return { doc: makeDoc(sections, fileName), fileName }
//
//    // DESPUÉS:
//    return {
//      doc: makeDoc(sections, fileName, {
//        tipoInforme:  'REPORTE DE PROGRESO PARA LA FAMILIA',
//        childName:     nombreCap,
//        childAge:      String(edad),
//        diagnosis:     diagnostico,
//        especialista:  'Equipo Clínico SANTI',
//        credenciales:  'BCBA · Terapia ABA',
//        periodoEval:   `${fechaInicio} – ${fechaFin}`,
//        codigoDoc:     codigoDoc,
//        conPortada:    true,
//        conQR:         true,
//      }),
//      fileName,
//    }
//
// 3. Reemplazar las llamadas a graficoBarras() por la nueva graficoProgresoBarra():
//
//    // ANTES (en sections[]):
//    ...graficoBarras('Progreso por área', areasData),
//
//    // DESPUÉS:
//    ...graficoProgresoBarra('Progreso por área', areasData, {
//      mostrarMeta: true,
//      metaPct: 80,
//    }),
//
// 4. Añadir curva de evolución de sesiones:
//
//    // Después de los logros por sesión, antes del mensaje final:
//    ...(logros.length >= 3 ? graficoCurvaLineal(
//      'Curva de aprendizaje — últimas sesiones',
//      logros.slice(-12),
//      fechasUnif.slice(-12).map((f: string) => new Date(f).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }))
//    ) : []),
//
//
// MISMO PATRÓN para generarReporteABA(), generarReporteComparativo(),
// generarReporteSeguro(), generarReporteAnamnesis(), etc.
// En reportes clínicos formales (BRIEF-2, ADOS-2, WISC-V) usar:
//    credenciales: 'C.Ps.P. Nº XXXXX · Neuropsicóloga Clínica'
//


// ── BLOQUE D: Helper para lookup del especialista desde Supabase (opcional) ──
//
// Si quieren que la firma sea dinámica según quién generó el reporte,
// agregar este helper en route.ts y pasar specialistId desde el frontend:
//
//    async function obtenerEspecialistaInfo(userId: string) {
//      const { data } = await supabaseAdmin
//        .from('users')
//        .select('full_name, credentials, colegiatura, specialty')
//        .eq('id', userId)
//        .single()
//      return {
//        nombre:      data?.full_name ?? 'Equipo Clínico SANTI',
//        titulo:      data?.credentials ?? 'Terapeuta Clínico',
//        colegiatura: data?.colegiatura,
//        especialidad:data?.specialty ?? 'Neuropsicología Infantil',
//      }
//    }
//
// Luego en el body del POST:
//    const { childId, reportType, specialistId, locale } = body
//    const espInfo = specialistId ? await obtenerEspecialistaInfo(specialistId) : null
//
// Y pasarlo a makeDoc():
//    especialista: espInfo?.nombre,
//    credenciales: [espInfo?.titulo, espInfo?.colegiatura].filter(Boolean).join(' · '),
//


// ── RESUMEN DE CAMBIOS ────────────────────────────────────────────────────────
//
//  Archivo                           Cambio
//  ─────────────────────────────── ─────────────────────────────────────────
//  lib/santi-report-template.ts    REEMPLAZAR completo (nuevo archivo v3)
//  app/api/reporte-word/route.ts   Aplicar bloques A, B, C, D arriba
//
//  Resultado en cada .docx generado:
//  ┌─────────────────────────────────────────────────────────────────────────┐
//  │  Página 1  →  PORTADA INSTITUCIONAL                                    │
//  │              Logo SANTI · Tipo de informe · Paciente · Especialista    │
//  │              Código de documento · CONFIDENCIAL                        │
//  ├─────────────────────────────────────────────────────────────────────────┤
//  │  Págs. 2+  →  CONTENIDO DEL INFORME (sin cambios en la lógica)        │
//  │              Header: "NEUROPSICOLOGÍA Y TERAPIAS SANTI | Tipo informe" │
//  │              Footer: Disclaimer · Teléfono · Pág. N / Total            │
//  │              Gráficas de progreso incrustadas (barras + curva)         │
//  ├─────────────────────────────────────────────────────────────────────────┤
//  │  Última pág →  FIRMA DEL ESPECIALISTA                                  │
//  │              Línea de firma · Nombre · Título · Colegiatura            │
//  │              Espacio para sello del centro                              │
//  │              SELLO DE VERIFICACIÓN con código QR                       │
//  │              URL: santiterapias.com/verificar/SANTI-XXXXXX             │
//  └─────────────────────────────────────────────────────────────────────────┘
//
// ============================================================================
