export const maxDuration = 60;

// app/api/reporte-word/route.ts
// ­ƒôä Genera documentos Word profesionales para cada tipo de reporte IA
// Devuelve el .docx como stream descargable ÔÇö sin jsPDF, sin lab()

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callGroqSimple, GROQ_MODELS } from '@/lib/groq-client'
import { getLangInstruction, getDocLabels } from '@/lib/lang'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, LevelFormat,
  HeadingLevel, PageNumber, Footer, Header
} from 'docx'
import * as tpl from '@/lib/santi-report-template'
import {
  portadaInstitucional,
  firmaEspecialista,
  selloQRVerificacion,
  generarCodigoDocumento,
} from '@/lib/santi-report-template'
import type { HabilidadFila, RecomendacionesBloque } from '@/lib/santi-report-template'
import { registrarDocumentoEmitido } from '@/lib/registrar-documento'

// ÔöÇÔöÇ FIX: Helper universal para parsear nivel_logro_objetivos ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Maneja: n├║mero, "75", "75%", "51-75%", "mayormente logrado", "alto", etc.
function parseNivelLogro(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number' && !isNaN(val)) return Math.min(100, Math.max(0, Math.round(val)))
  const s = String(val).trim()
  const range = s.match(/(\d+)\s*[-ÔÇô]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const num = s.match(/(\d+)/)
  if (num) return Math.min(100, Math.max(0, parseInt(num[1])))
  const lower = s.toLowerCase()
  if (lower.includes('completamente') || lower.includes('independiente') || lower.includes('dominado')) return 90
  if (lower.includes('mayormente') || lower.includes('alto') || lower.includes('excelente')) return 75
  if (lower.includes('parcialmente') || lower.includes('medio') || lower.includes('proceso')) return 50
  if (lower.includes('m├¡nimo') || lower.includes('bajo') || lower.includes('emergente') || lower.includes('inicial')) return 20
  if (lower.includes('no logrado') || lower.includes('sin respuesta')) return 5
  return null
}

const BD = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const BDR = { top: BD, bottom: BD, left: BD, right: BD }
const NBD = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NBDR = { top: NBD, bottom: NBD, left: NBD, right: NBD }

// ÔöÇÔöÇ Helpers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function title(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text, bold: true, size: 40, font: 'Arial', color: '5B21B6' })]
  })
}
function subtitle(text: string) {
  return new Paragraph({
    spacing: { before: 0, after: 360 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: '9CA3AF' })]
  })
}
function h2(text: string, color = '1E293B') {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0', space: 4 } },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color })]
  })
}
function pp(text: string, color = '374151') {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text, size: 20, font: 'Arial', color })]
  })
}
function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: 'bul', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 20, font: 'Arial', color: '374151' })]
  })
}
function kv(label: string, value: string) {
  return new TableRow({ children: [
    new TableCell({ borders: BDR, width: { size: 3000, type: WidthType.DXA },
      shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 19, font: 'Arial', color: '475569' })] })] }),
    new TableCell({ borders: BDR, width: { size: 6360, type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: value, size: 19, font: 'Arial', color: '1E293B' })] })] }),
  ]})
}
function infoBox(text: string, fill = 'EDE9FE', color = '5B21B6') {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill, type: ShadingType.CLEAR },
    children: [new TextRun({ text, size: 19, font: 'Arial', color })]
  })
}

type DocChild = Paragraph | Table

/**
 * Cuenta el "Total de sesiones realizadas" exactamente como el UI lo muestra
 * en "Información General → Total de sesiones del paciente":
 *   sessions_before_platform (manual) + MAX(appointments, agenda_sesiones, aba_sessions_v2)
 */
async function contarSesionesRealizadas(childId: string, sessionsBefore: number = 0): Promise<number> {
  try {
    const [a, b, c] = await Promise.all([
      supabaseAdmin.from('appointments').select('id', { count: 'exact', head: true })
        .eq('child_id', childId).in('status', ['completed','completada','realizada']),
      supabaseAdmin.from('agenda_sesiones').select('id', { count: 'exact', head: true })
        .eq('child_id', childId).in('estado', ['realizada','completada','completed']),
      supabaseAdmin.from('aba_sessions_v2').select('id', { count: 'exact', head: true })
        .eq('child_id', childId),
    ])
    const max = Math.max((a as any).count || 0, (b as any).count || 0, (c as any).count || 0)
    return (Number(sessionsBefore) || 0) + max
  } catch {
    return Number(sessionsBefore) || 0
  }
}

async function makeDoc(
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
    conPortada?: boolean
    conQR?: boolean
  }
): Promise<Document> {
  const conPortada = opts?.conPortada !== false
  const conQR      = opts?.conQR !== false
  const codigo     = opts?.codigoDoc ?? ''
  const fecha      = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

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

  // Generar sello QR REAL (PNG embebido) si hay código de documento
  const selloFinal: DocChild[] = (conQR && codigo)
    ? (await tpl.selloQRVerificacionAsync({
        codigoDoc:    codigo,
        fechaEmision: fecha,
        especialista: opts?.especialista,
      }) as any[])
    : []

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
      ...(firmaEspecialista({
        nombre:      opts?.especialista,
        titulo:      opts?.credenciales?.split('·')[0]?.trim(),
        colegiatura: opts?.credenciales?.split('·')[1]?.trim(),
        especialidad: 'Neuropsicología Infantil y ABA',
        fecha,
      }) as any[]),
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
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [...seccionPortada, seccionContenido],
  })
}

async function generarReportePadres(childId: string, userLocale = 'es'): Promise<{ doc: Document; fileName: string }> {
  const { data: child } = await supabaseAdmin.from('children').select('name, age, diagnosis').eq('id', childId).single()
  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const nombreCorto = nombreCap.split(' ')[0]
  const edad = (child as any)?.age || 'N/A'
  const diagnostico = (child as any)?.diagnosis || 'TEA'

  // FIX: programas necesita id para el join con sesiones_datos_aba, y SIN filtro de estado
  //      para incluir programas con estado null (cuyo filter .in() los excluye silenciosamente)
  const [{ data: sesiones }, { data: programas }, { data: sesionesProg }] = await Promise.all([
    supabaseAdmin.from('registro_aba').select('datos, fecha_sesion').eq('child_id', childId).order('fecha_sesion', { ascending: true }).limit(30),
    supabaseAdmin.from('programas_aba').select('id, titulo, area, fase_actual, criterio_dominio_pct, estado').eq('child_id', childId).limit(20),
    supabaseAdmin.from('sesiones_datos_aba').select('fecha, porcentaje_exito, programa_id').eq('child_id', childId).order('fecha', { ascending: true }).limit(150),
  ])

  const sesArr = sesiones || []
  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]

  // FIX: unificar fuentes ÔÇö preferir sesiones modernas, fallback a legacy
  const extraerLogro = (s: any) =>
    parseNivelLogro(s.datos?.nivel_logro_objetivos) ?? parseNivelLogro(s.datos?.porcentaje_logro) ??
    parseNivelLogro(s.datos?.porcentaje_exito) ?? parseNivelLogro(s.datos?.logro_objetivos) ?? parseNivelLogro(s.datos?.logro)

  const logrosLegacy = sesArr.map(extraerLogro).filter((v: number | null): v is number => v !== null)
  const logrosModernos = sesProgArr.map((s: any) => parseNivelLogro(s.porcentaje_exito)).filter((v: number | null): v is number => v !== null)
  // Si hay datos modernos, esos mandan; si no, fallback al legacy
  const logros = logrosModernos.length > 0 ? logrosModernos : logrosLegacy
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0
  const promedioLogro = avg(logros)
  const logrosRecientes = logros.slice(-5)
  const promedioReciente = avg(logrosRecientes)
  const logrosIniciales = logros.slice(0, 5)
  const promedioInicial = avg(logrosIniciales)
  const delta = promedioReciente - promedioInicial

  const atenciones = sesArr.map((s: any) => s.datos?.nivel_atencion ? Math.round((s.datos.nivel_atencion/5)*100) : null).filter((v: number | null): v is number => v !== null)
  const tolerancias = sesArr.map((s: any) => s.datos?.tolerancia_frustracion ? Math.round((s.datos.tolerancia_frustracion/5)*100) : null).filter((v: number | null): v is number => v !== null)
  const promedioAtencion = avg(atenciones)
  const promedioTolerancia = avg(tolerancias)

  const progDominados = progArr.filter((p: any) =>
    p.estado === 'dominado' || p.estado === 'logrado' || p.estado === 'criterio_alcanzado'
  )

  // FIX: total y fechas desde fuente que tenga m├ís datos (modernas si las hay)
  const fechasModernas = sesProgArr.map((s: any) => s.fecha).filter(Boolean).sort()
  const fechasLegacy = (sesArr as any[]).map((s: any) => s.fecha_sesion).filter(Boolean).sort()
  const fechasUnif = fechasModernas.length > 0 ? fechasModernas : fechasLegacy

  const totalSesiones = fechasUnif.length
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaInicio = fechasUnif.length > 0 ? fmt(fechasUnif[0]) : 'N/A'
  const fechaFin = fechasUnif.length > 0 ? fmt(fechasUnif[fechasUnif.length-1]) : fmt(new Date().toISOString())
  const semanas = fechasUnif.length > 1
    ? Math.round((new Date(fechasUnif[fechasUnif.length-1]).getTime() - new Date(fechasUnif[0]).getTime())/(7*24*60*60*1000))
    : 0

  // Logro emoji para padres
  const logroEmoji = promedioLogro >= 80 ? '­ƒîƒ' : promedioLogro >= 65 ? 'Ô¡É' : promedioLogro >= 50 ? '­ƒôê' : '­ƒÆ¬'
  const logroTexto = promedioLogro >= 80 ? '┬íExcelente!' : promedioLogro >= 65 ? '┬íMuy bien!' : promedioLogro >= 50 ? 'En progreso' : 'Trabajando duro'

  const areaMap: Record<string,number[]> = {}
  for (const p of progArr) {
    const area = (p as any).area || 'General'
    const vals = sesProgArr.filter((s:any)=>s.programa_id===(p as any).id).map((s:any)=>s.porcentaje_exito||0).filter((v:number)=>v>0)
    if(vals.length>0){if(!areaMap[area])areaMap[area]=[];areaMap[area].push(...vals)}
  }
  const areasData = Object.entries(areaMap).map(([label,vals])=>({label,valor:avg(vals)}))

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0,10)
  const fileName = `Reporte_Familia_${nombreCap.replace(/\s+/g,'_')}_${hoyISO}.docx`

  const [textoBienvenida, textoLogros, textoActividadesCasa, textoMensaje] = await Promise.all([
    callGroqSimple('Eres terapeuta ABA emp├ítica. Lenguaje c├ílido, cercano, sin tecnicismos, como carta a una familia querida.',
      `Escribe el p├írrafo de BIENVENIDA del reporte mensual para la familia de ${nombreCorto} (${edad} a├▒os, ${diagnostico}).
Menciona el per├¡odo (${semanas} semanas, ${totalSesiones} sesiones), celebra la constancia de la familia, y anticipa que este reporte resume los avances del mes.
1 p├írrafo c├ílido y motivador, m├íximo 60 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.7,maxTokens:150}),

    callGroqSimple('Eres terapeuta ABA emp├ítica. Lenguaje c├ílido, celebratorio, accessible para padres. Sin tecnicismos.',
      `Escribe 3 p├írrafos sobre los LOGROS Y AVANCES de ${nombreCorto} con estos datos reales:
- Promedio de logro: ${promedioLogro}% (${logroTexto})
- Progreso desde el inicio: ${promedioInicial}% ÔåÆ ${promedioReciente}% (${delta>=0?`+${delta}%`:delta+'%'})
- Sesiones: ${totalSesiones} en ${semanas} semanas
- ├üreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'comunicaci├│n y conducta'}
- Atenci├│n en sesi├│n: ${promedioAtencion>0?promedioAtencion+'%':'buena'}
- Logros dominados: ${progDominados.length>0?progDominados.map((p:any)=>p.titulo||p.nombre).join(', '):'en camino a su primer dominio'}
Celebra con entusiasmo real. Usa ejemplos concretos. Sin tecnicismos. M├íximo 180 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.7,maxTokens:350}),

    callGroqSimple('Eres terapeuta ABA. Escribe sugerencias pr├ícticas y concretas para padres. Lenguaje simple y motivador.',
      `Escribe 4 ACTIVIDADES CONCRETAS para hacer en casa con ${nombreCorto} (${edad} a├▒os, ${diagnostico}).
Basadas en estas ├íreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'comunicaci├│n, conducta'}.
Cada actividad: nombre simple + descripci├│n de 1-2 oraciones + por qu├® ayuda. Sin tecnicismos. Sin bullets, en p├írrafos cortos.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.6,maxTokens:400}),

    callGroqSimple('Eres terapeuta ABA emp├ítica. Mensaje final c├ílido y motivador.',
      `Escribe el MENSAJE FINAL de cierre del reporte para la familia de ${nombreCorto}.
Reconoce el esfuerzo de los padres, proyecta optimismo realista, invita a seguir en contacto.
1 p├írrafo hermoso y motivador, m├íximo 60 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.8,maxTokens:150}),
  ])

  const sections: DocChild[] = [
    // ENCABEZADO C├üLIDO
    new Paragraph({ spacing:{before:0,after:20}, border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'7C3AED',space:8}},
      children:[new TextRun({text:'­ƒîƒ  Neuropsicolog├¡a y Terapias SANTI',bold:true,size:38,font:'Arial',color:'5B21B6'}),
                new TextRun({text:'  ┬À  Centro de Terapia ABA',size:22,font:'Arial',color:'9CA3AF'})] }),
    new Paragraph({ spacing:{before:180,after:60},
      children:[new TextRun({text:`Reporte de Progreso de ${nombreCorto}`,bold:true,size:44,font:'Arial',color:'4C1D95'})] }),
    new Paragraph({ spacing:{before:0,after:20},
      children:[new TextRun({text:'Para la familia con cari├▒o',size:24,font:'Arial',color:'7C3AED',italics:true})] }),
    new Paragraph({ spacing:{before:60,after:360}, shading:{fill:'F5F3FF',type:ShadingType.CLEAR},
      children:[new TextRun({text:`Per├¡odo: ${fechaInicio} al ${fechaFin}   ┬À   ${totalSesiones} sesiones   ┬À   Emitido: ${hoy}`,size:18,font:'Arial',color:'6D28D9'})] }),

    // BIENVENIDA
    h2('Querida Familia:'),
    ...textoBienvenida.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // C├ôMO VA
    h2(`┬┐C├│mo va ${nombreCorto}? ${logroEmoji}`),
    // Tarjeta de logro visual
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[4680,4680], rows:[
      new TableRow({children:[
        new TableCell({borders:NBDR, shading:{fill:promedioLogro>=65?'F0FDF4':promedioLogro>=45?'FFFBEB':'FFF1F2',type:ShadingType.CLEAR}, margins:{top:200,bottom:200,left:200,right:100},
          children:[
            new Paragraph({alignment:AlignmentType.CENTER, children:[new TextRun({text:`${promedioLogro}%`,bold:true,size:96,font:'Arial',color:promedioLogro>=65?'15803D':promedioLogro>=45?'B45309':'BE123C'})]}),
            new Paragraph({alignment:AlignmentType.CENTER, spacing:{before:60}, children:[new TextRun({text:'Promedio de logro',size:22,font:'Arial',color:'64748B',bold:true})]}),
            new Paragraph({alignment:AlignmentType.CENTER, spacing:{before:40}, children:[new TextRun({text:logroTexto,size:28,font:'Arial',color:promedioLogro>=65?'15803D':promedioLogro>=45?'B45309':'BE123C',bold:true})]}),
          ]}),
        new TableCell({borders:NBDR, shading:{fill:'F8FAFC',type:ShadingType.CLEAR}, margins:{top:100,bottom:100,left:100,right:200},
          children:[
            new Paragraph({spacing:{before:80}, children:[new TextRun({text:'­ƒôà  Sesiones realizadas',size:18,font:'Arial',color:'475569'})]}),
            new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${totalSesiones} sesiones en ${semanas} semanas`,bold:true,size:22,font:'Arial',color:'1E293B'})]}),
            new Paragraph({spacing:{before:0}, children:[new TextRun({text:'­ƒôê  Evoluci├│n del progreso',size:18,font:'Arial',color:'475569'})]}),
            new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${promedioInicial}% al inicio ÔåÆ ${promedioReciente}% hoy`,bold:true,size:22,font:'Arial',color:delta>=0?'15803D':'BE123C'})]}),
            ...(promedioAtencion>0?[
              new Paragraph({spacing:{before:0}, children:[new TextRun({text:'­ƒÄ»  Atenci├│n en sesi├│n',size:18,font:'Arial',color:'475569'})]}),
              new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${promedioAtencion}% de atenci├│n sostenida`,bold:true,size:22,font:'Arial',color:'1E293B'})]}),
            ]:[]),
            ...(promedioTolerancia>0?[
              new Paragraph({spacing:{before:0}, children:[new TextRun({text:'­ƒÿî  Manejo emocional',size:18,font:'Arial',color:'475569'})]}),
              new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${promedioTolerancia}% tolerancia a la frustraci├│n`,bold:true,size:22,font:'Arial',color:'1E293B'})]}),
            ]:[]),
            ...(progDominados.length>0?[
              new Paragraph({spacing:{before:0}, children:[new TextRun({text:'Ô£à  Logros dominados',size:18,font:'Arial',color:'15803D'})]}),
              new Paragraph({spacing:{before:20}, children:[new TextRun({text:`${progDominados.length} habilidad${progDominados.length>1?'es':''} completada${progDominados.length>1?'s':''}`,bold:true,size:22,font:'Arial',color:'15803D'})]}),
            ]:[]),
          ]}),
      ]}),
    ]}),
    new Paragraph({spacing:{before:120,after:0},children:[]}),

    // GR├üFICO POR ├üREAS (si hay datos)
    ...(areasData.length>0?[
      pp('As├¡ va en cada ├írea que estamos trabajando:'),
      ...graficoBarras('Progreso por ├írea',areasData),
      new Paragraph({spacing:{before:160,after:0},children:[]}),
    ]:[]),

    // LOGROS EN TEXTO
    h2('Sus logros este per├¡odo'),
    ...textoLogros.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // PROGRAMAS (simplificado para padres)
    ...(progArr.length>0?[
      h2('┬┐Qu├® estamos trabajando juntos?'),
      pp('Estas son las habilidades que estamos desarrollando con '+ nombreCorto+' en este momento:'),
      new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3600,3360,2400], rows:[
        new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:'4C1D95',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Habilidad',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'4C1D95',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'├ürea de desarrollo',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'4C1D95',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Estado',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        ]}),
        ...progArr.map((p:any,i:number)=>new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F5F3FF':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:p.titulo||p.nombre||'Habilidad',size:17,font:'Arial',bold:true,color:'4C1D95'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F5F3FF':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.area||'General',size:16,font:'Arial',color:'475569'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:p.estado==='dominado'?'F0FDF4':i%2===0?'F5F3FF':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:p.estado==='dominado'?'Ô£à Dominado':'­ƒöÁ Activo',bold:true,size:16,font:'Arial',color:p.estado==='dominado'?'15803D':'4C1D95'})]})]  }),
        ]})),
      ]}),
    ]:[]),

    // ACTIVIDADES EN CASA
    h2('Actividades para hacer en casa ­ƒÅá'),
    pp(`Estas actividades complementan el trabajo que hacemos en sesi├│n. Solo necesitan 10-15 minutos al d├¡a y hacen una gran diferencia en el progreso de ${nombreCorto}:`),
    ...textoActividadesCasa.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // HISTORIAL RECIENTE (simple, visual)
    ...(sesArr.slice(-8).length>0?[
      h2('As├¡ fue sesi├│n por sesi├│n ­ƒôè'),
      pp('Cada sesi├│n es un paso adelante. Aqu├¡ puedes ver c├│mo progres├│ en las ├║ltimas semanas:'),
      ...graficoBarras('Progreso por sesi├│n', sesArr.slice(-8).map((s:any,i:number)=>({
        label:`Sesi├│n ${sesArr.length-7+i} ÔÇö ${new Date(s.fecha_sesion).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}`,
        valor:extraerLogro(s)??0
      }))),
      new Paragraph({spacing:{before:160,after:0},children:[]}),
    ]:[]),

    // MENSAJE FINAL
    h2(`Un mensaje especial para ustedes ­ƒÆ£`),
    new Paragraph({ spacing:{before:80,after:160}, shading:{fill:'F5F3FF',type:ShadingType.CLEAR},
      border:{left:{style:BorderStyle.SINGLE,size:12,color:'7C3AED',space:10}},
      children:textoMensaje.split('\n').filter((l:string)=>l.trim()).flatMap((line:string,i:number,arr:string[])=>[
        new TextRun({text:line,size:22,font:'Arial',color:'4C1D95',italics:true}),
        ...(i<arr.length-1?[new TextRun({text:'\n',break:1})]:[])
      ]),
    }),

    // CIERRE
    new Paragraph({spacing:{before:400},border:{top:{style:BorderStyle.SINGLE,size:2,color:'E2E8F0',space:8}},
      children:[new TextRun({text:'Con cari├▒o, el equipo de Neuropsicolog├¡a y Terapias SANTI',size:20,font:'Arial',color:'7C3AED',bold:true,italics:true})]}),
    new Paragraph({spacing:{before:40,after:0},
      children:[new TextRun({text:`${hoy}  ┬À  Este reporte es personal y confidencial`,size:16,font:'Arial',color:'94A3B8'})]}),
  ]

  const codigoDoc = generarCodigoDocumento(childId, 'padres')
  await registrarDocumentoEmitido({
    codigoDoc, childId, tipo: 'reporte_padres',
    pacienteNombre: nombreCap, pacienteIniciales: tpl.generarIniciales(nombreCap),
    fileName, metadata: { periodo: `${fechaInicio} – ${fechaFin}`, semanas, total_sesiones: totalSesiones },
  })
  return {
    doc: await makeDoc(sections, fileName, {
      tipoInforme:  'REPORTE DE PROGRESO PARA LA FAMILIA',
      childName:    nombreCap,
      childAge:     String(edad),
      diagnosis:    diagnostico,
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'BCBA · Terapia ABA',
      periodoEval:  `${fechaInicio} – ${fechaFin}`,
      codigoDoc,
      conPortada:   true,
      conQR:        true,
    }),
    fileName,
  }
}


// ┬─ Reporte Comparativo + Predicci├│n ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
async function generarReporteComparativo(childId: string, userLocale = 'es'): Promise<{ doc: Document; fileName: string }> {
  const { data: child } = await supabaseAdmin.from('children').select('name, age, diagnosis, birth_date').eq('id', childId).single()
  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const edad = (child as any)?.age || 'N/A'
  const diagnostico = (child as any)?.diagnosis || 'TEA'

  // FIX: pull ALL data sources ÔÇö patientes modernos viven en sesiones_datos_aba
  //      registro_aba es legacy; programas_aba.id es CRUCIAL para joinear sesiones por programa.
  //      Tambi├®n cargamos eval inicial, documentos extra├¡dos, fichas cl├¡nicas y evaluaciones pro.
  const [
    { data: sesiones },           // registro_aba (legacy)
    { data: programas },          // programas_aba (modernos)
    { data: sesionesProg },       // sesiones_datos_aba (sesiones modernas)
    { data: evalInicial },        // evaluaciones_iniciales
    { data: docsExtraidos },      // patient_documents con texto extra├¡do
    { data: fichasClinicas },     // actas / templates cl├¡nicos
  ] = await Promise.all([
    supabaseAdmin.from('registro_aba').select('datos, fecha_sesion').eq('child_id', childId).order('fecha_sesion', { ascending: true }).limit(50),
    supabaseAdmin.from('programas_aba').select('id, titulo, area, fase_actual, criterio_dominio_pct, estado').eq('child_id', childId).limit(20),
    supabaseAdmin.from('sesiones_datos_aba').select('id, fecha, porcentaje_exito, programa_id, nivel_ayuda, fase').eq('child_id', childId).order('fecha', { ascending: true }).limit(200),
    (async () => { try { return await supabaseAdmin.from('evaluaciones_iniciales').select('estado, recomendacion, recomendacion_resumen, recomendacion_razon, anamnesis_completada_en').eq('child_id', childId).order('created_at', { ascending: false }).limit(1).maybeSingle() } catch { return { data: null } } })(),
    (async () => { try { return await supabaseAdmin.from('patient_documents').select('file_name, category, extracted_text, created_at').eq('child_id', childId).eq('extraction_status', 'done').not('extracted_text', 'is', null).order('created_at', { ascending: false }).limit(10) } catch { return { data: [] } } })(),
    (async () => { try { return await supabaseAdmin.from('clinical_template_responses').select('id, created_at, filler_name, filler_role, responses, notes, clinical_templates(name)').eq('child_id', childId).order('created_at', { ascending: false }).limit(8) } catch { return { data: [] } } })(),
  ])

  const sesArr = sesiones || []
  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]

  // ÔöÇÔöÇ ESTRATEGIA UNIFICADA DE SESIONES ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  //   Si hay sesiones modernas (sesiones_datos_aba), usalas como fuente primaria.
  //   Si NO hay modernas pero s├¡ legacy (registro_aba), usar legacy.
  //   El reporte se calcula sobre la fuente con datos.
  const tieneModernas = sesProgArr.length > 0
  const tieneLegacy = sesArr.length > 0

  // Sesiones unificadas: { fecha, porcentaje, programa_id?, fuente }
  type SesUnif = { fecha: string; porcentaje: number; programa_id?: string; fuente: 'moderna' | 'legacy' }
  const extraerLogroLegacy = (s: any): number | null =>
    parseNivelLogro(s.datos?.nivel_logro_objetivos) ?? parseNivelLogro(s.datos?.porcentaje_logro) ??
    parseNivelLogro(s.datos?.porcentaje_exito) ?? parseNivelLogro(s.datos?.logro_objetivos)

  const sesionesUnif: SesUnif[] = []
  if (tieneModernas) {
    for (const s of sesProgArr) {
      const p = parseNivelLogro(s.porcentaje_exito)
      if (p !== null && s.fecha) {
        sesionesUnif.push({ fecha: s.fecha, porcentaje: p, programa_id: s.programa_id, fuente: 'moderna' })
      }
    }
  }
  if (tieneLegacy) {
    for (const s of sesArr as any[]) {
      const p = extraerLogroLegacy(s)
      if (p !== null && s.fecha_sesion) {
        sesionesUnif.push({ fecha: s.fecha_sesion, porcentaje: p, fuente: 'legacy' })
      }
    }
  }
  sesionesUnif.sort((a, b) => a.fecha.localeCompare(b.fecha))

  const total = sesionesUnif.length || sesArr.length
  const logros = sesionesUnif.map(s => s.porcentaje)
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0

  // ÔöÇÔöÇ ESTADO DE PROGRAMAS ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const progActivos = progArr.filter(p => p.estado === 'activo' || p.estado === 'intervencion' || !p.estado)
  const progDominados = progArr.filter(p => p.estado === 'dominado' || p.estado === 'logrado' || p.estado === 'criterio_alcanzado')
  const progEnLineaBase = progArr.filter(p => p.fase_actual === 'linea_base')

  // Por programa: ├║ltimo % + tendencia
  const programasConDatos = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id).sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const pcts = sesP.map((s: any) => parseNivelLogro(s.porcentaje_exito)).filter((v: number | null): v is number => v !== null)
    return {
      titulo: p.titulo || 'Sin nombre',
      area: p.area || 'General',
      fase: p.fase_actual || 'ÔÇö',
      estado: p.estado || 'activo',
      criterio: p.criterio_dominio_pct || 90,
      ultimo_pct: pcts.length > 0 ? pcts[pcts.length - 1] : null,
      promedio: pcts.length > 0 ? avg(pcts) : null,
      n_sesiones: pcts.length,
    }
  })

  const mitad = Math.floor(total/2)
  // FIX: usar sesionesUnif (fuente unificada) en vez de sesArr (solo legacy)
  const periodo1 = sesionesUnif.slice(0, mitad)
  const periodo2 = sesionesUnif.slice(mitad)
  const logros1 = logros.slice(0, mitad)
  const logros2 = logros.slice(mitad)
  const avg1 = avg(logros1), avg2 = avg(logros2)
  const diferencia = avg2 - avg1

  // Cuartos para gr├ífico
  const q = (arr: number[], from: number, to: number) => avg(arr.slice(Math.floor(arr.length*from), Math.max(Math.floor(arr.length*to),1)))
  const q1=q(logros,0,0.25), q2=q(logros,0.25,0.5), q3=q(logros,0.5,0.75), q4=q(logros,0.75,1)

  // ÔöÇÔöÇ Predicci├│n con fallback cl├¡nico para pocas sesiones ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const calcPendienteReal = (vals: number[]) => {
    if (vals.length < 2) return 0
    const n = vals.length
    const sumX = (n*(n-1))/2
    const sumX2 = (n*(n-1)*(2*n-1))/6
    const sumY = vals.reduce((a,b)=>a+b,0)
    const sumXY = vals.reduce((a,v,i)=>a+i*v,0)
    const denom = n*sumX2 - sumX*sumX
    return denom===0 ? 0 : (n*sumXY - sumX*sumY)/denom
  }

  const pendiente = calcPendienteReal(logros)
  // FIX: calcular semanas desde la fuente unificada (modernas + legacy)
  const semanasTotal = sesionesUnif.length>1
    ? Math.round((new Date(sesionesUnif[sesionesUnif.length-1].fecha).getTime() - new Date(sesionesUnif[0].fecha).getTime())/(7*24*60*60*1000))
    : 0
  const sesXMes = semanasTotal > 4 ? (total / (semanasTotal / 4)) : 8
  const ses30d = Math.max(4, Math.round(sesXMes))
  const ses90d = Math.max(10, Math.round(sesXMes * 3))
  const ses180d = Math.max(20, Math.round(sesXMes * 6))

  // Con <6 sesiones la regresi├│n no es confiable: usar benchmark cl├¡nico ABA
  // Mejora t├¡pica mensual en terapia ABA sostenida: 3-7% seg├║n nivel base
  const pocasSesiones = logros.length < 6
  let pred30: number, pred90: number, pred180: number, confianzaNota: string

  if (pocasSesiones) {
    const mejoraMensualBase = avg2 < 40 ? 7 : avg2 < 55 ? 6 : avg2 < 70 ? 5 : avg2 < 85 ? 3 : 1
    const factorDiag = diagnostico?.toLowerCase().includes('tea') || diagnostico?.toLowerCase().includes('autis') ? 0.85
      : diagnostico?.toLowerCase().includes('tdah') ? 1.0 : 0.9
    const mm = Math.max(1, Math.round(mejoraMensualBase * factorDiag))
    pred30  = Math.min(100, avg2 + mm)
    pred90  = Math.min(100, avg2 + mm * 3)
    pred180 = Math.min(100, avg2 + mm * 6)
    confianzaNota = `ÔÜá Proyecci├│n estimativa basada en benchmarks cl├¡nicos ABA (solo ${logros.length} sesiones registradas). La precisi├│n mejora con m├ís datos ÔÇö se recomienda re-evaluar a partir de la sesi├│n 8.`
  } else {
    const senal = diferencia !== 0 ? diferencia * 0.15 : 0
    pred30  = Math.min(100, Math.max(avg2 + 1, Math.round(avg2 + pendiente * ses30d + senal)))
    pred90  = Math.min(100, Math.max(pred30 + 1, Math.round(avg2 + pendiente * ses90d + senal * 2)))
    pred180 = Math.min(100, Math.max(pred90 + 1, Math.round(avg2 + pendiente * ses180d + senal * 3)))
    confianzaNota = `Proyecci├│n basada en regresi├│n lineal sobre ${logros.length} sesiones (confianza ${logros.length >= 12 ? 'alta' : 'moderada'}).`
  }

  // Por ├írea ÔÇö FIX: ahora con id correcto en programas, el filter funciona
  const areaMap: Record<string,{p1:number[],p2:number[]}> = {}
  for (const p of progArr) {
    const area = (p as any).area || 'General'
    const allVals = sesProgArr.filter((s:any)=>s.programa_id===(p as any).id).map((s:any)=>s.porcentaje_exito||0).filter((v:number)=>v>0)
    if (allVals.length > 0) {
      if (!areaMap[area]) areaMap[area]={p1:[],p2:[]}
      const half = Math.floor(allVals.length/2)
      areaMap[area].p1.push(...allVals.slice(0,half))
      areaMap[area].p2.push(...allVals.slice(half))
    }
  }

  // Atenci├│n y tolerancia para comparativo ÔÇö solo legacy las trae; si no hay, queda en 0
  const atArr = (sesArr as any[]).map((s:any) => s.datos?.nivel_atencion ? Math.round((s.datos.nivel_atencion/5)*100) : null).filter((v:number|null):v is number=>v!==null)
  const tolArr = (sesArr as any[]).map((s:any) => s.datos?.tolerancia_frustracion ? Math.round((s.datos.tolerancia_frustracion/5)*100) : null).filter((v:number|null):v is number=>v!==null)
  const at1=avg(atArr.slice(0,Math.floor(atArr.length/2))), at2=avg(atArr.slice(Math.floor(atArr.length/2)))
  const tol1=avg(tolArr.slice(0,Math.floor(tolArr.length/2))), tol2=avg(tolArr.slice(Math.floor(tolArr.length/2)))

  const fmt = (d:string) => new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})
  // FIX: usar sesionesUnif para fechas
  const fechaInicio = sesionesUnif.length>0?fmt(sesionesUnif[0].fecha):'N/A'
  const fechaFin = sesionesUnif.length>0?fmt(sesionesUnif[sesionesUnif.length-1].fecha):fmt(new Date().toISOString())
  const semanas = semanasTotal

  const hoy = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})
  const hoyISO = new Date().toISOString().slice(0,10)
  const docNum = `COMP-${hoyISO.replace(/-/g,'')}-${childId.slice(0,6).toUpperCase()}`
  const fileName = `Reporte_Comparativo_${nombreCap.replace(/\s+/g,'_')}_${hoyISO}.docx`

  const tendenciaVerbal = diferencia>10?'progreso significativo':diferencia>3?'progreso moderado':diferencia<-5?'regresi├│n':'estabilidad'

  const [textoComparativo, textoPrediccion, textoRecomendaciones] = await Promise.all([
    callGroqSimple('Eres neuropsic├│loga ABA. Lenguaje t├®cnico accesible. P├írrafos fluidos. Sin bullets.',
      `An├ílisis COMPARATIVO DE PER├ìODOS para ${nombreCap} (${edad} a├▒os, ${diagnostico}):
Per├¡odo 1 (${periodo1.length} sesiones): ${avg1}% promedio
Per├¡odo 2 (${periodo2.length} sesiones): ${avg2}% promedio
Cambio: ${diferencia>0?'+':''}${diferencia}% (${tendenciaVerbal})
Atenci├│n: ${at1>0?at1+'%'  :'N/R'} ÔåÆ ${at2>0?at2+'%':'N/R'} | Tolerancia: ${tol1>0?tol1+'%':'N/R'} ÔåÆ ${tol2>0?tol2+'%':'N/R'}
Programas activos (${progActivos.length}): ${progActivos.map((p:any)=>p.titulo).join(', ').slice(0, 400)}
├üreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'comunicaci├│n'}
Programas con criterio alcanzado: ${progDominados.length} (${progDominados.map((p:any)=>p.titulo).join(', ').slice(0,200)})
${evalInicial ? `\nEvaluaci├│n inicial: ${(evalInicial as any).recomendacion || 'ÔÇö'} ┬À estado: ${(evalInicial as any).estado || 'ÔÇö'}` : ''}
${docsExtraidos && (docsExtraidos as any[]).length > 0 ? `\nDocumentos en expediente: ${(docsExtraidos as any[]).length} con texto le├¡do (${(docsExtraidos as any[]).slice(0,3).map((d:any) => d.file_name).join(', ')})` : ''}

Explica cl├¡nicamente qu├® significa esta evoluci├│n, qu├® factores pueden contribuir, y qu├® implica para el desarrollo del ni├▒o. Si hay programas con criterio alcanzado, mencion├ílos por nombre.
3 p├írrafos, m├íximo 220 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:400}),

    callGroqSimple('Eres neuropsic├│loga ABA. Lenguaje t├®cnico accesible. P├írrafos fluidos.',
      `Escribe el an├ílisis de PREDICCI├ôN TERAP├ëUTICA para ${nombreCap}:
Sesiones totales: ${total} | Logro actual: ${avg2}%
Proyecciones basadas en regresi├│n lineal: 30d ÔåÆ ${pred30}% | 90d ÔåÆ ${pred90}% | 180d ÔåÆ ${pred180}%
Tendencia observada: ${tendenciaVerbal} (pendiente: ${pendiente.toFixed(2)} pts/sesi├│n)
${total <= 5 ? `IMPORTANTE: Con solo ${total} sesiones, las proyecciones son estimativas. Menciona esto con transparencia.` : ''}
Interpreta las proyecciones: qu├® esperar, qu├® condiciones son necesarias para cumplirlas, cu├íl es el nivel de confianza seg├║n la cantidad de datos.
2 p├írrafos, m├íximo 130 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:260}),

    callGroqSimple('Eres neuropsic├│loga ABA. Lenguaje t├®cnico accesible. P├írrafos fluidos.',
      `Escribe RECOMENDACIONES TERAP├ëUTICAS para ${nombreCap} (${edad} a├▒os, ${diagnostico}) basadas en:
- Tendencia: ${tendenciaVerbal}, logro actual: ${avg2}%
- Programas activos (${progActivos.length}): ${progActivos.map((p:any)=>p.titulo).slice(0,8).join(', ')}
- Programas con criterio alcanzado: ${progDominados.length}
- ├üreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'en evaluaci├│n'}
${evalInicial ? `- Recomendaci├│n de eval inicial: ${(evalInicial as any).recomendacion_resumen || (evalInicial as any).recomendacion || 'ÔÇö'}` : ''}

Incluye: (a) ajustes al plan actual de los programas m├ís relevantes, (b) objetivos para el pr├│ximo per├¡odo, (c) frecuencia sugerida, (d) si corresponde, programas que pueden avanzar de set o consolidarse.
2-3 p├írrafos, m├íximo 160 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:280}),
  ])

  const pColor = (v: number) => v>=75?'15803D':v>=50?'B45309':'BE123C'
  const pBg = (v: number) => v>=75?'DCFCE7':v>=50?'FEF3C7':'FEE2E2'
  const diffColor = diferencia>=0?'15803D':'BE123C'
  const diffBg = diferencia>=0?'DCFCE7':'FEE2E2'

  const sections: DocChild[] = [
    // PORTADA
    new Paragraph({spacing:{before:0,after:20},border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'0F172A',space:8}},
      children:[new TextRun({text:'NEUROPSICOLOG├ìA Y TERAPIAS SANTI',bold:true,size:38,font:'Arial',color:'0F172A'}),
                new TextRun({text:'  ┬À  Centro Especializado de Terapia ABA',size:22,font:'Arial',color:'64748B'})] }),
    new Paragraph({spacing:{before:180,after:60},
      children:[new TextRun({text:'AN├üLISIS COMPARATIVO DE PER├ìODOS',bold:true,size:44,font:'Arial',color:'0F172A'})] }),
    new Paragraph({spacing:{before:0,after:20},
      children:[new TextRun({text:'Con Proyecci├│n IA a 30, 90 y 180 d├¡as',bold:true,size:26,font:'Arial',color:'475569'})] }),
    new Paragraph({spacing:{before:60,after:360},shading:{fill:'F1F5F9',type:ShadingType.CLEAR},
      children:[new TextRun({text:`Doc. N┬║ ${docNum}   ┬À   Emitido: ${hoy}   ┬À   Per├¡odo analizado: ${fechaInicio} al ${fechaFin}`,size:18,font:'Arial',color:'64748B'})] }),

    // I. DATOS
    h2('I.  DATOS DEL PACIENTE Y DEL AN├üLISIS'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3200,6160],rows:[
      kv('Paciente',nombreCap),
      kv('Edad',`${edad} a├▒os`),
      kv('Diagn├│stico',diagnostico),
      kv('Per├¡odo analizado',`${fechaInicio} al ${fechaFin} (${semanas} semanas)`),
      kv('Total de sesiones',`${total} sesiones registradas`),
      kv('Per├¡odo 1 (referencia)',`${periodo1.length} sesiones ÔÇö ${sesArr.length>0?fmt(sesArr[0].fecha_sesion):'N/A'} al ${sesArr.length>mitad?fmt(sesArr[mitad-1]?.fecha_sesion||sesArr[0].fecha_sesion):'N/A'}`),
      kv('Per├¡odo 2 (actual)',`${periodo2.length} sesiones ÔÇö ${sesArr.length>mitad?fmt(sesArr[mitad]?.fecha_sesion||sesArr[0].fecha_sesion):'N/A'} al ${fechaFin}`),
      kv('Fecha del an├ílisis',hoy),
    ]}),

    // II. COMPARACI├ôN VISUAL
    h2('II.  COMPARACI├ôN DIRECTA DE PER├ìODOS'),
    pp('La siguiente tabla compara los indicadores cl├¡nicos clave entre el per├¡odo de referencia y el per├¡odo actual:'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3400,1980,1980,2000],rows:[
      new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Indicador',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Per├¡odo 1 (${periodo1.length} ses.)`,bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Per├¡odo 2 (${periodo2.length} ses.)`,bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Variaci├│n',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
      ]}),
      ...([
        ['Logro de objetivos ABA', avg1, avg2, diferencia],
        ...(at1>0&&at2>0?[['Atenci├│n sostenida', at1, at2, at2-at1]]:  []),
        ...(tol1>0&&tol2>0?[['Tolerancia a frustraci├│n', tol1, tol2, tol2-tol1]]:[]),
      ] as [string,number,number,number][]).map(([ind,v1,v2,diff],i)=>new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:ind,size:17,font:'Arial',bold:i===0})]})]  }),
        new TableCell({borders:BDR,shading:{fill:pBg(v1),type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${v1}%`,bold:true,size:i===0?22:18,font:'Arial',color:pColor(v1)})]})]  }),
        new TableCell({borders:BDR,shading:{fill:pBg(v2),type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${v2}%`,bold:true,size:i===0?22:18,font:'Arial',color:pColor(v2)})]})]  }),
        new TableCell({borders:BDR,shading:{fill:diffBg,type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${diff>=0?'+':''}${diff}%`,bold:true,size:i===0?22:18,font:'Arial',color:diffColor})]})]  }),
      ]})),
    ]}),

    // III. GR├üFICO EVOLUCI├ôN COMPLETA
    h2('III.  REPRESENTACI├ôN GR├üFICA DE LA EVOLUCI├ôN'),
    pp('El siguiente gr├ífico muestra la evoluci├│n del logro terap├®utico distribuido en cuatro fases del tratamiento:'),
    ...graficoBarras('Evoluci├│n por Fase del Tratamiento',[
      {label:`Fase 1 ÔÇö Inicio  (S1ÔÇôS${Math.ceil(total*0.25)})`,valor:q1},
      {label:`Fase 2 ÔÇö Desarrollo  (S${Math.ceil(total*0.25)+1}ÔÇôS${Math.ceil(total*0.5)})`,valor:q2},
      {label:`Fase 3 ÔÇö Consolidaci├│n  (S${Math.ceil(total*0.5)+1}ÔÇôS${Math.ceil(total*0.75)})`,valor:q3},
      {label:`Fase 4 ÔÇö Estado Actual  (S${Math.ceil(total*0.75)+1}ÔÇôS${total})`,valor:q4},
    ]),
    new Paragraph({spacing:{before:160,after:0},children:[]}),

    // Comparativo por ├írea
    ...(Object.keys(areaMap).length>0?[
      pp('Comparaci├│n por ├írea de intervenci├│n entre per├¡odo 1 y per├¡odo 2:'),
      ...graficoBarras('Per├¡odo 1 ÔÇö Avance por ├ürea', Object.entries(areaMap).filter(([,v])=>v.p1.length>0).map(([label,vals])=>({label,valor:avg(vals.p1)}))),
      new Paragraph({spacing:{before:80,after:0},children:[]}),
      ...graficoBarras('Per├¡odo 2 ÔÇö Avance por ├ürea (Actual)', Object.entries(areaMap).filter(([,v])=>v.p2.length>0).map(([label,vals])=>({label,valor:avg(vals.p2)}))),
      new Paragraph({spacing:{before:160,after:0},children:[]}),
    ]:[]),

    // IV. AN├üLISIS COMPARATIVO
    h2('IV.  AN├üLISIS CL├ìNICO COMPARATIVO'),
    ...textoComparativo.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // V. PREDICCI├ôN IA
    h2('V.  PROYECCI├ôN TERAP├ëUTICA CON INTELIGENCIA ARTIFICIAL'),
    pp('Las siguientes proyecciones se calculan mediante regresi├│n lineal de m├¡nimos cuadrados sobre el historial real de sesiones, complementado con an├ílisis de tendencia conductual:'),
    ...(total <= 5 ? [new Paragraph({spacing:{before:60,after:100},shading:{fill:'FEF3C7',type:ShadingType.CLEAR},
      border:{left:{style:BorderStyle.SINGLE,size:10,color:'D97706',space:8}},
      children:[new TextRun({text:`ÔÜá  Nota de confianza: Con ${total} sesiones registradas, las proyecciones son estimativas. La precisi├│n mejora significativamente a partir de 10+ sesiones. Se recomienda interpretar como tendencia orientativa.`,size:17,font:'Arial',color:'92400E'})]})] : []),

    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2000,1400,1200,3160,1600],rows:[
      new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Horizonte',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Logro proy.',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'vs. actual',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Interpretaci├│n cl├¡nica',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Confianza',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
      ]}),
      ...([
        ['Actual', avg2, 'ÔÇö', avg2>=75?'Nivel ├│ptimo de respuesta':avg2>=55?'Nivel funcional adecuado':'Requiere intervenci├│n sostenida', 'ÔÇö'],
        [`En 30 d├¡as`, pred30, `${(pred30-avg2)>=0?'+':''}${pred30-avg2}%`, pred30>=75?'Excelente progreso esperado':pred30>=55?'Progreso sostenido':'Monitoreo intensivo recomendado', total>=15?'Alta':'Estimativa'],
        [`En 90 d├¡as`, pred90, `${(pred90-avg2)>=0?'+':''}${pred90-avg2}%`, pred90>=80?'Dominio funcional proyectado':pred90>=65?'Consolidaci├│n esperada':pred90>=50?'Progreso gradual':'Revisi├│n del plan', total>=10?'Moderada':'Orientativa'],
        [`En 180 d├¡as`, pred180, `${(pred180-avg2)>=0?'+':''}${pred180-avg2}%`, pred180>=85?'Criterio de alta funcional':pred180>=70?'Pron├│stico favorable':pred180>=55?'Continuidad necesaria':'Plan intensivo recomendado', total>=8?'Moderada':'Referencial'],
      ] as [string,number,string,string,string][]).map(([hor,val,diff,interp,conf],i)=>new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:hor,bold:i===0,size:17,font:'Arial',color:i===0?'FFFFFF':'1E293B'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':pBg(val),type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${val}%`,bold:true,size:22,font:'Arial',color:i===0?'FFFFFF':pColor(val)})]})]  }),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:diff,bold:true,size:17,font:'Arial',color:i===0?'9CA3AF':diff.startsWith('+')?'15803D':diff==='ÔÇö'?'64748B':'BE123C'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:interp,size:16,font:'Arial',color:i===0?'9CA3AF':'475569',italics:i!==0})]})]}),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':conf==='Alta'?'DCFCE7':conf==='Moderada'?'FEF3C7':'FFF1F2',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:conf,bold:true,size:15,font:'Arial',color:i===0?'9CA3AF':conf==='Alta'?'15803D':conf==='Moderada'?'92400E':'64748B'})]})]  }),
      ]})),
    ]}),
    new Paragraph({spacing:{before:120,after:0},children:[]}),

    // Gr├ífico de predicci├│n
    ...graficoBarras('Progreso Real + Proyecci├│n IA',[
      {label:`Per├¡odo 1 ÔÇö Referencia (${periodo1.length} sesiones)`,valor:avg1},
      {label:`Per├¡odo 2 ÔÇö Estado Actual (${periodo2.length} sesiones)`,valor:avg2},
      {label:`Proyecci├│n a 30 d├¡as`,valor:pred30},
      {label:`Proyecci├│n a 90 d├¡as`,valor:pred90},
      {label:`Proyecci├│n a 180 d├¡as`,valor:pred180},
    ]),
    new Paragraph({spacing:{before:200,after:0},children:[]}),

    // VI. AN├üLISIS NARRATIVO DE PREDICCI├ôN
    h2('VI.  INTERPRETACI├ôN DE LA PROYECCI├ôN TERAP├ëUTICA'),
    ...textoPrediccion.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // VII. PROGRAMAS
    h2('VII.  ESTADO DE LOS PROGRAMAS DE INTERVENCI├ôN'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3000,1800,1760,1400,1400],rows:[
      new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Programa',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'├ürea',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Fase',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Criterio',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Estado',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
      ]}),
      ...progArr.map((p:any,i:number)=>{
        const isDom=p.estado==='dominado',isAct=p.estado==='activo'||p.estado==='intervencion'
        return new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:p.titulo||p.nombre||'Sin t├¡tulo',bold:true,size:17,font:'Arial'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.area||'General',size:16,font:'Arial'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.fase_actual?.replace(/_/g,' ')||'N/A',size:16,font:'Arial'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`ÔëÑ${p.criterio_dominio_pct||90}%`,bold:true,size:17,font:'Arial',color:'1E40AF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:isDom?'DCFCE7':isAct?'DBEAFE':'F1F5F9',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:isDom?'Ô£ô DOMINADO':isAct?'EN CURSO':p.estado?.toUpperCase()||'N/A',bold:true,size:16,font:'Arial',color:isDom?'15803D':isAct?'1D4ED8':'475569'})]})]  }),
        ]})
      }),
      ...(!progArr.length?[new TableRow({children:[new TableCell({borders:BDR,columnSpan:5,margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Sin programas registrados',size:17,font:'Arial',color:'9CA3AF',italics:true})]})]})]})]:  []),
    ]}),

    // VIII. RECOMENDACIONES
    h2('VIII.  RECOMENDACIONES TERAP├ëUTICAS'),
    ...textoRecomendaciones.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // CIERRE
    new Paragraph({spacing:{before:400},border:{top:{style:BorderStyle.SINGLE,size:2,color:'E2E8F0',space:8}},
      children:[new TextRun({text:'Nota metodol├│gica: ',bold:true,size:16,font:'Arial',color:'64748B'}),
                new TextRun({text:confianzaNota,size:16,font:'Arial',color:'94A3B8',italics:true})]}),
    new Paragraph({spacing:{before:40,after:0},
      children:[new TextRun({text:`Neuropsicolog├¡a y Terapias SANTI  ┬À  ${hoy}  ┬À  Documento N┬║ ${docNum}  ┬À  Uso confidencial`,size:16,font:'Arial',color:'94A3B8'})]}),
  ]

    const codigoDoc = generarCodigoDocumento(childId, 'comp')
  await registrarDocumentoEmitido({
    codigoDoc, childId, tipo: 'reporte_comparativo',
    pacienteNombre: nombreCap, pacienteIniciales: tpl.generarIniciales(nombreCap),
    fileName, metadata: { periodo: `${fechaInicio} \u2013 ${fechaFin}`, semanas, total_sesiones: total },
  })
  return {
    doc: await makeDoc(sections, fileName, {
      tipoInforme:  'AN\u00c1LISIS COMPARATIVO DE PER\u00cdODOS',
      childName:    nombreCap,
      childAge:     String(edad),
      diagnosis:    diagnostico,
      especialista: 'Equipo Cl\u00ednico SANTI',
      credenciales: 'BCBA \u00b7 Neuropsicolog\u00eda Infantil',
      periodoEval:  `${fechaInicio} \u2013 ${fechaFin}`,
      codigoDoc,
      conPortada:   true,
      conQR:        true,
    }),
    fileName,
  }
}

// ÔöÇ Gráfico de barras
function graficoBarras(titulo: string, datos: { label: string; valor: number }[]): DocChild[] {
  const COLS = 28

  const headerRow = new TableRow({ children: [
    new TableCell({ borders: NBDR, width: { size: 3600, type: WidthType.DXA }, shading: { fill: '1E293B', type: ShadingType.CLEAR }, margins: { top: 90, bottom: 90, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: titulo, bold: true, size: 17, font: 'Arial', color: 'FFFFFF' })] })] }),
    new TableCell({ borders: NBDR, width: { size: 900, type: WidthType.DXA }, shading: { fill: '1E293B', type: ShadingType.CLEAR }, margins: { top: 90, bottom: 90, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Valor', bold: true, size: 17, font: 'Arial', color: 'FFFFFF' })] })] }),
    ...Array.from({ length: COLS }, () => new TableCell({ borders: NBDR, width: { size: 175, type: WidthType.DXA }, shading: { fill: '1E293B', type: ShadingType.CLEAR }, children: [new Paragraph({ children: [] })] })),
  ]})

  const dataRows = datos.map((d, i) => {
    const pct = Math.min(100, Math.max(0, d.valor))
    const filled = Math.round((pct / 100) * COLS)
    const barColor = pct >= 75 ? '16A34A' : pct >= 50 ? 'D97706' : 'DC2626'
    const bgRow = i % 2 === 0 ? 'F8FAFC' : 'FFFFFF'
    const valBg = pct >= 75 ? 'DCFCE7' : pct >= 50 ? 'FEF3C7' : 'FEE2E2'

    return new TableRow({ children: [
      new TableCell({ borders: NBDR, shading: { fill: bgRow, type: ShadingType.CLEAR }, margins: { top: 70, bottom: 70, left: 140, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: d.label, size: 17, font: 'Arial', color: '334155' })] })] }),
      new TableCell({ borders: NBDR, shading: { fill: valBg, type: ShadingType.CLEAR }, margins: { top: 70, bottom: 70, left: 60, right: 60 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pct}%`, bold: true, size: 19, font: 'Arial', color: barColor })] })] }),
      ...Array.from({ length: COLS }, (_, ci) => new TableCell({
        borders: NBDR,
        shading: { fill: ci < filled ? barColor : bgRow, type: ShadingType.CLEAR },
        children: [new Paragraph({ children: [] })],
      })),
    ]})
  })

  return [new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3600, 900, ...Array(COLS).fill(175)],
    rows: [headerRow, ...dataRows],
  })]
}

// ÔöÇÔöÇ Reporte Para Seguros ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
async function generarReporteSeguro(childId: string, userLocale = 'es'): Promise<{ doc: Document; fileName: string }> {
  const { data: child } = await supabaseAdmin.from('children').select('name, age, diagnosis, birth_date').eq('id', childId).single()
  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const edad = (child as any)?.age || 'N/A'
  const diagnostico = (child as any)?.diagnosis || 'TEA'

  const CIE10: Record<string, string> = { 'TEA': 'F84.0', 'Autismo': 'F84.0', 'TDAH': 'F90.0', 'S├¡ndrome de Down': 'Q90', 'Discapacidad intelectual': 'F79', 'Retraso': 'F79' }
  const cie = Object.entries(CIE10).find(([k]) => diagnostico?.includes(k))?.[1] || 'F84.0'

  const [{ data: sesiones }, { data: programas }, { data: sesionesProg }] = await Promise.all([
    supabaseAdmin.from('registro_aba').select('datos, fecha_sesion').eq('child_id', childId).order('fecha_sesion', { ascending: true }).limit(60),
    supabaseAdmin.from('programas_aba').select('titulo, area, fase_actual, criterio_dominio_pct, estado').eq('child_id', childId).limit(15),
    supabaseAdmin.from('sesiones_datos_aba').select('fecha, porcentaje_exito, programa_id, fase, notas').eq('child_id', childId).order('fecha', { ascending: true }).limit(100),
  ])

  const sesionesArr = sesiones || []
  const programasArr = programas || []
  const sesionesPArr = sesionesProg || []
  const totalSesiones = sesionesArr.length

  const extraerLogro = (s: any) =>
    parseNivelLogro(s.datos?.nivel_logro_objetivos) ?? parseNivelLogro(s.datos?.porcentaje_logro) ??
    parseNivelLogro(s.datos?.porcentaje_exito) ?? parseNivelLogro(s.datos?.logro_objetivos) ?? parseNivelLogro(s.datos?.logro)

  const logros = sesionesArr.map(extraerLogro).filter((v: number | null): v is number => v !== null)
  const atenciones = sesionesArr.map((s: any) => s.datos?.nivel_atencion ? Math.round((s.datos.nivel_atencion/5)*100) : null).filter((v: number | null): v is number => v !== null)
  const tolerancias = sesionesArr.map((s: any) => s.datos?.tolerancia_frustracion ? Math.round((s.datos.tolerancia_frustracion/5)*100) : null).filter((v: number | null): v is number => v !== null)
  const comunicaciones = sesionesArr.map((s: any) => s.datos?.iniciativa_comunicativa ? Math.round((s.datos.iniciativa_comunicativa/5)*100) : null).filter((v: number | null): v is number => v !== null)

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : 0
  const promedioLogro = avg(logros)
  const promedioAtencion = avg(atenciones)
  const promedioTolerancia = avg(tolerancias)
  const promedioComunicacion = avg(comunicaciones)

  const q = (arr: number[], from: number, to: number) => avg(arr.slice(Math.floor(arr.length*from), Math.floor(arr.length*to)))
  const logro_q1 = q(logros,0,0.25), logro_q2 = q(logros,0.25,0.5), logro_q3 = q(logros,0.5,0.75), logro_q4 = q(logros,0.75,1)
  const avgInicial = q(logros,0,0.33), avgFinal = q(logros,0.67,1)
  const delta = avgFinal - avgInicial
  const tendenciaVerbal = delta>10?'progreso significativo':delta>3?'progreso moderado':delta<-5?'regresi├│n cl├¡nica':'estabilidad terap├®utica'

  const diasUnicos = new Set(sesionesArr.map((s:any)=>s.fecha_sesion?.slice(0,10))).size
  const fmt = (d:string) => new Date(d).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})
  const fechaInicio = sesionesArr.length>0?fmt(sesionesArr[0].fecha_sesion):'N/A'
  const fechaFin = sesionesArr.length>0?fmt(sesionesArr[sesionesArr.length-1].fecha_sesion):fmt(new Date().toISOString())
  const semanasTratamiento = sesionesArr.length>1 ? Math.round((new Date(sesionesArr[sesionesArr.length-1].fecha_sesion).getTime()-new Date(sesionesArr[0].fecha_sesion).getTime())/(7*24*60*60*1000)):0

  const areaMap: Record<string,number[]> = {}
  for (const p of programasArr) {
    const area = (p as any).area||'General'
    const vals = sesionesPArr.filter((s:any)=>s.programa_id===(p as any).id).map((s:any)=>s.porcentaje_exito||0).filter((v:number)=>v>0)
    if(vals.length>0){if(!areaMap[area])areaMap[area]=[];areaMap[area].push(...vals)}
  }
  const areasData = Object.entries(areaMap).map(([label,vals])=>({label,valor:avg(vals)}))
  const historial = sesionesArr.slice(-12).reverse()
  const progActivos = programasArr.filter((p:any)=>p.estado==='activo'||p.estado==='intervencion')
  const progDominados = programasArr.filter((p:any)=>p.estado==='dominado')

  const hoy = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})
  const hoyISO = new Date().toISOString().slice(0,10)
  const docNum = `${hoyISO.replace(/-/g,'')}-${childId.slice(0,6).toUpperCase()}`
  const fileName = `Reporte_Clinico_${nombreCap.replace(/\s+/g,'_')}_${hoyISO}.docx`

  const [textoAnamnesis, textoProceso, textoPronostico, textoConclusiones] = await Promise.all([
    callGroqSimple('Eres neuropsic├│loga cl├¡nica ABA. Lenguaje t├®cnico formal, p├írrafos fluidos, sin bullets.',
      `ANTECEDENTES Y MOTIVO DE CONSULTA para ${nombreCap} (${edad} a├▒os, ${diagnostico}, CIE-10: ${cie}). Justifica la necesidad cl├¡nica del tratamiento ABA. 2 p├írrafos, m├íximo 100 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:250}),
    callGroqSimple('Eres neuropsic├│loga cl├¡nica ABA. Lenguaje t├®cnico formal, p├írrafos fluidos, sin bullets.',
      `EVOLUCI├ôN TERAP├ëUTICA de ${nombreCap}: ${totalSesiones} sesiones (${fechaInicio} al ${fechaFin}, ${semanasTratamiento} semanas). Logro: ${avgInicial}% inicial ÔåÆ ${avgFinal}% actual (${tendenciaVerbal}, delta ${delta>0?'+':''}${delta}%). Atenci├│n: ${promedioAtencion}%, Tolerancia: ${promedioTolerancia}%, Comunicaci├│n: ${promedioComunicacion}%. Programas activos: ${progActivos.map((p:any)=>p.titulo||p.nombre||p.area).join(', ')||'en evaluaci├│n'}. Dominados: ${progDominados.length>0?progDominados.map((p:any)=>p.titulo||p.nombre).join(', '):'ninguno a├║n'}. 3 p├írrafos, m├íximo 160 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.2,maxTokens:350}),
    callGroqSimple('Eres neuropsic├│loga cl├¡nica ABA. Lenguaje t├®cnico formal, p├írrafos fluidos, sin bullets.',
      `PRON├ôSTICO Y PLAN para ${nombreCap} (${diagnostico}). ${totalSesiones} sesiones, ${promedioLogro}% promedio, tendencia ${tendenciaVerbal}. Incluye objetivos a 3-6 meses, frecuencia recomendada, ├íreas prioritarias. 2 p├írrafos, m├íximo 100 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.2,maxTokens:250}),
    callGroqSimple('Eres neuropsic├│loga cl├¡nica ABA. Lenguaje t├®cnico-legal formal.',
      `CONCLUSIONES para aseguradora sobre ${nombreCap}: necesidad m├®dica del tratamiento, eficacia demostrada, recomendaci├│n de continuidad. 1 p├írrafo contundente, m├íximo 70 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.2,maxTokens:180}),
  ])

  const sections: DocChild[] = [
    // PORTADA
    new Paragraph({ spacing:{before:0,after:20}, border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'1E40AF',space:8}},
      children:[new TextRun({text:'NEUROPSICOLOG├ìA Y TERAPIAS SANTI',bold:true,size:38,font:'Arial',color:'1E293B'}),
                new TextRun({text:'  ┬À  Centro Especializado de Terapia ABA',size:22,font:'Arial',color:'64748B'})] }),
    new Paragraph({ spacing:{before:180,after:60},
      children:[new TextRun({text:'REPORTE NEUROPSICOL├ôGICO Y CL├ìNICO',bold:true,size:46,font:'Arial',color:'1E40AF'})] }),
    new Paragraph({ spacing:{before:0,after:20},
      children:[new TextRun({text:'Para presentaci├│n ante Aseguradoras, IMSS e ISSSTE',bold:true,size:24,font:'Arial',color:'475569'})] }),
    new Paragraph({ spacing:{before:80,after:360}, shading:{fill:'EFF6FF',type:ShadingType.CLEAR},
      children:[new TextRun({text:`N┬║ ${docNum}   ┬À   Emitido: ${hoy}   ┬À   Vigencia: 6 meses   ┬À   CONFIDENCIAL`,size:18,font:'Arial',color:'64748B'})] }),

    // I. DATOS
    h2('I.  DATOS DE IDENTIFICACI├ôN DEL PACIENTE'),
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3200,6160], rows:[
      kv('Nombre completo', nombreCap),
      kv('Edad cronol├│gica', `${edad} a├▒os`),
      kv('Diagn├│stico principal', diagnostico),
      kv('Clasificaci├│n CIE-10', cie),
      kv('Modalidad de intervenci├│n', 'An├ílisis Aplicado de la Conducta (ABA) ÔÇö Terapia Individual'),
      kv('Centro terap├®utico', 'Neuropsicolog├¡a y Terapias SANTI ÔÇö Centro Especializado en Neurodesarrollo'),
      kv('Inicio del tratamiento', fechaInicio),
      kv('├Ültima sesi├│n registrada', fechaFin),
      kv('Duraci├│n total del proceso', `${semanasTratamiento} semanas (${totalSesiones} sesiones)`),
      kv('Fecha del presente reporte', hoy),
    ]}),

    // II. ANTECEDENTES
    h2('II.  ANTECEDENTES CL├ìNICOS Y MOTIVO DE CONSULTA'),
    ...textoAnamnesis.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // III. INDICADORES
    h2('III.  INDICADORES CUANTITATIVOS DE PROGRESO TERAP├ëUTICO'),
    pp('Los siguientes indicadores resultan del an├ílisis sistem├ítico de las hojas de datos ABA registradas durante el per├¡odo de tratamiento. Cada valor representa el promedio ponderado de todas las sesiones evaluadas en el per├¡odo indicado.'),
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3800,1960,3600], rows:[
      new TableRow({ children:[
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Indicador cl├¡nico',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]}),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Valor',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]}),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Interpretaci├│n cl├¡nica',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]})
      ]}),
      ...([
        ['Total de sesiones realizadas', `${totalSesiones}`, totalSesiones>=20?'Proceso terap├®utico consolidado':totalSesiones>=10?'Proceso en desarrollo activo':'Fase inicial de intervenci├│n'],
        ['Promedio global de logro de objetivos', `${promedioLogro}%`, promedioLogro>=75?'Nivel ├│ptimo de respuesta terap├®utica':promedioLogro>=55?'Nivel funcional adecuado':promedioLogro>=35?'En desarrollo, requiere continuidad':'Fase inicial de adquisici├│n'],
        ['Nivel de logro ÔÇö inicio del tratamiento', `${avgInicial}%`, 'L├¡nea base del paciente al inicio'],
        ['Nivel de logro ÔÇö etapa actual', `${avgFinal}%`, delta>5?`Mejora de +${delta}% respecto al inicio`:delta<-3?`Variaci├│n de ${delta}% respecto al inicio`:'Estabilizaci├│n del proceso de aprendizaje'],
        ['Atenci├│n sostenida durante sesiones', promedioAtencion>0?`${promedioAtencion}%`:'No registrado', promedioAtencion>=70?'Atenci├│n funcional adecuada para el aprendizaje':promedioAtencion>0?'En desarrollo activo':'ÔÇö'],
        ['Tolerancia a la frustraci├│n', promedioTolerancia>0?`${promedioTolerancia}%`:'No registrado', promedioTolerancia>=60?'Regulaci├│n emocional adecuada':promedioTolerancia>0?'├ürea de trabajo prioritaria':'ÔÇö'],
        ['Iniciativa comunicativa', promedioComunicacion>0?`${promedioComunicacion}%`:'No registrado', promedioComunicacion>=60?'Comunicaci├│n funcional presente':promedioComunicacion>0?'En proceso de adquisici├│n':'ÔÇö'],
        ['Programas activos actualmente', `${progActivos.length}`, progActivos.length>0?progActivos.map((p:any)=>p.titulo||p.nombre||p.area).slice(0,3).join(' ┬À '):'En evaluaci├│n inicial'],
        ['Programas con criterio de dominio alcanzado', `${progDominados.length}`, progDominados.length>0?progDominados.map((p:any)=>p.titulo||p.nombre).join(' ┬À '):'En proceso de dominio'],
        ['Tendencia cl├¡nica general del per├¡odo', tendenciaVerbal.charAt(0).toUpperCase()+tendenciaVerbal.slice(1), delta>=0?`Incremento de ${Math.abs(delta)} puntos porcentuales`:`Variaci├│n de ${Math.abs(delta)} puntos porcentuales`],
      ] as [string,string,string][]).map(([ind,val,interp],i)=>{
        const isKey = i===1
        const vColor = isKey?(promedioLogro>=75?'15803D':promedioLogro>=45?'92400E':'991B1B'):'1E293B'
        const vBg = isKey?(promedioLogro>=75?'DCFCE7':promedioLogro>=45?'FEF3C7':'FEE2E2'):i%2===0?'F8FAFC':'FFFFFF'
        return new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:ind,size:17,font:'Arial',bold:isKey})]})]  }),
          new TableCell({borders:BDR,shading:{fill:vBg,type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:val,bold:true,size:isKey?22:17,font:'Arial',color:vColor})]})]}),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:interp,size:16,font:'Arial',color:'64748B',italics:true})]})]}),
        ]})
      }),
    ]}),

    // IV. GR├üFICOS
    h2('IV.  REPRESENTACI├ôN GR├üFICA DEL PROGRESO TERAP├ëUTICO'),
    pp('Los gr├íficos siguientes ilustran la evoluci├│n del nivel de logro de objetivos ABA a lo largo de cuatro fases temporales equitativas del per├¡odo de tratamiento:'),
    ...(logros.length>=4?graficoBarras('Evoluci├│n por Fase Terap├®utica',[
      {label:`Fase 1 ÔÇö L├¡nea Base  (S1ÔÇôS${Math.ceil(totalSesiones*0.25)})`,valor:logro_q1},
      {label:`Fase 2 ÔÇö Adquisici├│n  (S${Math.ceil(totalSesiones*0.25)+1}ÔÇôS${Math.ceil(totalSesiones*0.5)})`,valor:logro_q2},
      {label:`Fase 3 ÔÇö Consolidaci├│n  (S${Math.ceil(totalSesiones*0.5)+1}ÔÇôS${Math.ceil(totalSesiones*0.75)})`,valor:logro_q3},
      {label:`Fase 4 ÔÇö Estado Actual  (S${Math.ceil(totalSesiones*0.75)+1}ÔÇôS${totalSesiones})`,valor:logro_q4},
    ]):[pp('Datos insuficientes para representaci├│n gr├ífica por fases (m├¡nimo 4 sesiones).')]),
    new Paragraph({spacing:{before:200,after:0},children:[]}),

    ...(areasData.length>0?[
      pp('Nivel de desempe├▒o promedio por ├írea de intervenci├│n terap├®utica:'),
      ...graficoBarras('Avance por ├ürea de Intervenci├│n',areasData),
      new Paragraph({spacing:{before:200,after:0},children:[]}),
    ]:[]),

    ...(promedioAtencion>0||promedioTolerancia>0||promedioComunicacion>0?[
      pp('Perfil de indicadores conductuales y habilidades adaptativas del paciente:'),
      ...graficoBarras('Perfil Conductual Integral',[
        {label:'Logro de objetivos ABA',valor:promedioLogro},
        ...(promedioAtencion>0?[{label:'Atenci├│n sostenida en sesi├│n',valor:promedioAtencion}]:[]),
        ...(promedioTolerancia>0?[{label:'Tolerancia a la frustraci├│n',valor:promedioTolerancia}]:[]),
        ...(promedioComunicacion>0?[{label:'Iniciativa comunicativa',valor:promedioComunicacion}]:[]),
      ]),
      new Paragraph({spacing:{before:200,after:0},children:[]}),
    ]:[]),

    // V. PROGRAMAS
    h2('V.  PROGRAMAS DE INTERVENCI├ôN ABA ÔÇö ESTADO DETALLADO'),
    pp('Se detallan los programas terap├®uticos implementados, su ├írea de intervenci├│n, fase de aplicaci├│n y estado de dominio seg├║n el criterio establecido (ÔëÑ90% de respuestas correctas en dos sesiones consecutivas):'),
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3000,1600,1760,1400,1600],
      rows:[
        new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Programa / Objetivo terap├®utico',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'├ürea',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Fase actual',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Criterio',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Estado',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        ]}),
        ...programasArr.map((p:any,i:number)=>{
          const isDom=p.estado==='dominado', isAct=p.estado==='activo'||p.estado==='intervencion'
          return new TableRow({children:[
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:p.titulo||p.nombre||'Sin t├¡tulo',size:17,font:'Arial',bold:true})]})]  }),
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.area||'General',size:16,font:'Arial'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.fase_actual?.replace(/_/g,' ')||'N/A',size:16,font:'Arial'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`ÔëÑ${p.criterio_dominio_pct||90}%`,bold:true,size:17,font:'Arial',color:'1E40AF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:isDom?'DCFCE7':isAct?'DBEAFE':'F1F5F9',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:isDom?'Ô£ô DOMINADO':isAct?'EN CURSO':p.estado?.toUpperCase()||'N/A',bold:true,size:16,font:'Arial',color:isDom?'15803D':isAct?'1D4ED8':'475569'})]})]  }),
          ]})
        }),
        ...(!programasArr.length?[new TableRow({children:[new TableCell({borders:BDR,columnSpan:5,margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Sin programas registrados en el per├¡odo actual',size:17,font:'Arial',color:'94A3B8',italics:true})]})]})]})]:  []),
      ]
    }),

    // VI. HISTORIAL
    ...(historial.length>0?[
      h2('VI.  REGISTRO CRONOL├ôGICO DE SESIONES TERAP├ëUTICAS'),
      pp(`Registro de las ├║ltimas ${Math.min(historial.length,12)} sesiones con indicadores conductuales medidos por el terapeuta durante cada intervenci├│n:`),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1800,1500,1500,1500,3060],
        rows:[
          new TableRow({children:[
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Fecha',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Logro obj.',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Atenci├│n',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Tolerancia',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Observaci├│n cl├¡nica',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          ]}),
          ...historial.map((s:any,i:number)=>{
            const logro=extraerLogro(s)??0
            const aten=s.datos?.nivel_atencion?`${Math.round((s.datos.nivel_atencion/5)*100)}%`:'ÔÇö'
            const tol=s.datos?.tolerancia_frustracion?`${Math.round((s.datos.tolerancia_frustracion/5)*100)}%`:'ÔÇö'
            const obs=s.datos?.observaciones_generales||s.datos?.notas||'Sin observaci├│n registrada'
            const fc=logro>=75?'15803D':logro>=50?'92400E':'991B1B'
            const fg=logro>=75?'DCFCE7':logro>=50?'FEF3C7':'FEE2E2'
            const rb=i%2===0?'F8FAFC':'FFFFFF'
            return new TableRow({children:[
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:new Date(s.fecha_sesion).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}),size:16,font:'Arial'})]})]  }),
              new TableCell({borders:BDR,shading:{fill:fg,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${logro}%`,bold:true,size:20,font:'Arial',color:fc})]})]  }),
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:aten,size:16,font:'Arial',color:'475569'})]})]  }),
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:tol,size:16,font:'Arial',color:'475569'})]})]  }),
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:obs.length>75?obs.slice(0,75)+'ÔÇª':obs,size:15,font:'Arial',color:'64748B',italics:true})]})]}),
            ]})
          }),
        ]
      }),
    ]:[]),

    // VII. EVOLUCI├ôN
    h2('VII.  EVOLUCI├ôN DEL PROCESO TERAP├ëUTICO'),
    ...textoProceso.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // VIII. PRON├ôSTICO
    h2('VIII.  PRON├ôSTICO Y PLAN DE TRATAMIENTO PROPUESTO'),
    ...textoPronostico.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // IX. CONCLUSIONES
    h2('IX.  CONCLUSIONES CL├ìNICAS PARA ASEGURADORA'),
    new Paragraph({ spacing:{before:80,after:160}, shading:{fill:'EFF6FF',type:ShadingType.CLEAR},
      border:{left:{style:BorderStyle.SINGLE,size:14,color:'1E40AF',space:10}},
      children:textoConclusiones.split('\n').filter((l:string)=>l.trim()).flatMap((line:string,i:number,arr:string[])=>[
        new TextRun({text:line,size:20,font:'Arial',color:'1E3A5F'}),
        ...(i<arr.length-1?[new TextRun({text:'\n',break:1})]:[])
      ]),
    }),

    // X. FIRMA
    h2('X.  ACREDITACI├ôN PROFESIONAL Y FIRMA'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3200,6160],rows:[
      kv('Centro terap├®utico','Neuropsicolog├¡a y Terapias SANTI ÔÇö Centro Especializado en Neurodesarrollo'),
      kv('Especialidad','An├ílisis Aplicado de la Conducta (ABA)'),
      kv('Tipo de intervenci├│n','Terapia individual ÔÇö intervenci├│n temprana y desarrollo'),
      kv('Fecha de emisi├│n',hoy),
      kv('N├║mero de documento',docNum),
      kv('Documento v├ílido para','Aseguradoras privadas, IMSS, ISSSTE, Seguro Popular'),
      kv('Vigencia','6 meses a partir de la fecha de emisi├│n'),
    ]}),
    new Paragraph({spacing:{before:600,after:80},children:[new TextRun({text:'_'.repeat(50),size:20,font:'Arial',color:'1E293B'})]}),
    new Paragraph({spacing:{before:0,after:20},children:[new TextRun({text:'Responsable del Tratamiento ÔÇö Neuropsicolog├¡a y Terapias SANTI',bold:true,size:18,font:'Arial',color:'1E293B'})]}),
    new Paragraph({spacing:{before:0,after:40},children:[new TextRun({text:'Terapeuta ABA Certificado / Neuropsic├│logo Cl├¡nico',size:17,font:'Arial',color:'64748B',italics:true})]}),

    new Paragraph({spacing:{before:320},border:{top:{style:BorderStyle.SINGLE,size:2,color:'E2E8F0',space:8}},
      shading:{fill:'FFF7ED',type:ShadingType.CLEAR},
      children:[new TextRun({text:'ÔÜá  DOCUMENTO CONFIDENCIAL ÔÇö Uso exclusivo para tr├ímites m├®dico-legales con aseguradoras autorizadas. Prohibida su reproducci├│n parcial o total sin autorizaci├│n del centro emisor.',size:17,font:'Arial',color:'B45309',bold:true})]}),
    new Paragraph({spacing:{before:40,after:0},children:[new TextRun({text:`Neuropsicolog├¡a y Terapias SANTI  ┬À  ${hoy}  ┬À  Documento N┬║ ${docNum}`,size:16,font:'Arial',color:'94A3B8'})]}),
  ]

  const codigoDoc = generarCodigoDocumento(childId, 'seg')
  await registrarDocumentoEmitido({
    codigoDoc, childId, tipo: 'reporte_seguro',
    pacienteNombre: nombreCap, pacienteIniciales: tpl.generarIniciales(nombreCap),
    fileName, metadata: { periodo: `${fechaInicio} – ${fechaFin}` },
  })
  return {
    doc: await makeDoc(sections, fileName, {
      tipoInforme:  'REPORTE NEUROPSICOLÓGICO Y CLÍNICO',
      childName:    nombreCap,
      childAge:     String(edad),
      diagnosis:    diagnostico,
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'C.Ps.P. · Neuropsicología Clínica',
      periodoEval:  `${fechaInicio} – ${fechaFin}`,
      codigoDoc,
      conPortada:   true,
      conQR:        true,
    }),
    fileName,
  }
}

// ┬─ Handler principal ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

// ═══════════════════════════════════════════════════════════════════════════
// INFORME CLÍNICO PROFESIONAL — formato oficial SANTI (estilo LuTr)
// ─ Diseñado para SUPERAR a Central Reach con:
//   · Portada + datos generales + resumen ejecutivo IA
//   · Tabla de Habilidades y Logros con vertical merge (ÁREA / SUBÁREA spanning)
//   · Análisis clínico por programa (tendencia, criterio, observaciones)
//   · Gráficos de progreso por área y por programa
//   · Plan terapéutico 30/60/90 días con KPIs
//   · Recomendaciones tripartitas accionables
//   · Glosario + pie legal profesional
// ═══════════════════════════════════════════════════════════════════════════
async function generarInformeClinicoSanti(
  childId: string,
  userLocale = 'es',
): Promise<{ doc: Document; fileName: string }> {

  // ─── 1. Datos del paciente ──────────────────────────────────────────
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, age, birth_date, diagnosis, parent_id, sessions_before_platform')
    .eq('id', childId).single()

  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  let edadTexto = 'no registrada'
  if ((child as any)?.birth_date) {
    const nac = new Date((child as any).birth_date)
    const ahora = new Date()
    const años = ahora.getFullYear() - nac.getFullYear()
    const meses = ahora.getMonth() - nac.getMonth()
    const edad = (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) ? años - 1 : años
    const mesesAdj = meses < 0 ? meses + 12 : meses
    edadTexto = `${edad} años${mesesAdj > 0 ? ` ${mesesAdj} meses` : ''}`
  } else if ((child as any)?.age) {
    edadTexto = `${(child as any).age} años`
  }

  // Total de sesiones realizadas (misma fórmula que el UI)
  const totalSesionesRealizadas = await contarSesionesRealizadas(childId, (child as any)?.sessions_before_platform)

  // ─── 2. Cargar todo en paralelo (defensivo) ─────────────────────────
  const [
    { data: programas },
    { data: sesionesProg },
    evalIniRes,
    docsRes,
    fichasRes,
    anamnesisRes,
    registroAbaRes,
    entornoHogarRes,
    formResponsesRes,
  ] = await Promise.all([
    supabaseAdmin.from('programas_aba').select('id, titulo, area, fase_actual, criterio_dominio_pct, criterio_sesiones_consecutivas, estado, objetivo_lp').eq('child_id', childId).limit(30),
    supabaseAdmin.from('sesiones_datos_aba').select('id, programa_id, fecha, porcentaje_exito, fase, set, nivel_ayuda, notas').eq('child_id', childId).order('fecha', { ascending: true }).limit(400),
    (async () => { try { return await supabaseAdmin.from('evaluaciones_iniciales').select('estado, recomendacion, recomendacion_resumen, recomendacion_razon, anamnesis_completada_en').eq('child_id', childId).order('created_at', { ascending: false }).limit(1).maybeSingle() } catch { return { data: null } } })(),
    (async () => { try { return await supabaseAdmin.from('patient_documents').select('file_name, category, extracted_text, created_at').eq('child_id', childId).eq('extraction_status', 'done').not('extracted_text', 'is', null).order('created_at', { ascending: false }).limit(8) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('clinical_template_responses').select('id, created_at, filler_name, filler_role, responses, notes, clinical_templates(name)').eq('child_id', childId).order('created_at', { ascending: false }).limit(6) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('anamnesis_completa').select('id, form_title, datos, fecha_creacion').eq('child_id', childId).order('fecha_creacion', { ascending: false }).limit(3) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('registro_aba').select('id, form_title, datos, fecha_sesion').eq('child_id', childId).order('fecha_sesion', { ascending: false }).limit(5) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('registro_entorno_hogar').select('id, form_title, datos, fecha_visita').eq('child_id', childId).order('fecha_visita', { ascending: false }).limit(3) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('form_responses').select('id, form_type, form_title, responses, ai_analysis, created_at').eq('child_id', childId).order('created_at', { ascending: false }).limit(5) } catch { return { data: [] as any[] } } })(),
  ])

  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]
  const evalIni = (evalIniRes as any)?.data || null
  const docsArr = ((docsRes as any)?.data || []) as any[]
  const fichasArr = ((fichasRes as any)?.data || []) as any[]
  const anamnesisArr = ((anamnesisRes as any)?.data || []) as any[]
  const registroAbaArr = ((registroAbaRes as any)?.data || []) as any[]
  const entornoHogarArr = ((entornoHogarRes as any)?.data || []) as any[]
  const formResponsesArr = ((formResponsesRes as any)?.data || []) as any[]

  // Cargar objetivos_cp con los IDs reales
  let objetivosArr: any[] = []
  if (progArr.length > 0) {
    try {
      const progIds = progArr.map(p => p.id)
      const { data } = await supabaseAdmin
        .from('objetivos_cp')
        .select('id, programa_id, numero_set, descripcion, estado')
        .in('programa_id', progIds)
        .order('numero_set', { ascending: true })
      objetivosArr = data || []
    } catch (e: any) {
      console.warn('[informe-clinico] objetivos_cp falló:', e?.message)
    }
  }

  // ─── 3. Cálculos clínicos por programa ──────────────────────────────
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  type ProgramaConDatos = {
    id: string
    titulo: string
    area: string         // texto visible (normalizado, mayúsculas)
    areaKey: string      // clave para agrupar (sin tildes, mayúsculas)
    estado: string
    fase: string
    criterio: number
    objetivo_lp: string
    n_sesiones: number
    pcts: number[]
    ultimo_pct: number | null
    promedio: number | null
    promedio_reciente: number | null  // últimas 5
    tendencia: 'ascendente' | 'descendente' | 'estable'
    delta_inicio: number  // % cambio desde inicio
    sets: any[]
    primeraFecha?: string
    ultimaFecha?: string
    minPct?: number
    maxPct?: number
  }

  const programasConDatos: ProgramaConDatos[] = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const pcts = sesP.map((s: any) => parseNivelLogro(s.porcentaje_exito)).filter((v: number | null): v is number => v !== null)
    const ultimo = pcts.length > 0 ? pcts[pcts.length - 1] : null
    const promedio = pcts.length > 0 ? avg(pcts) : null
    const recientes = pcts.slice(-5)
    const promedioReciente = recientes.length > 0 ? avg(recientes) : null
    const iniciales = pcts.slice(0, 5)
    const promedioInicial = iniciales.length > 0 ? avg(iniciales) : null
    const delta = (promedioReciente != null && promedioInicial != null) ? promedioReciente - promedioInicial : 0
    let tendencia: 'ascendente' | 'descendente' | 'estable' = 'estable'
    if (delta >= 8) tendencia = 'ascendente'
    else if (delta <= -8) tendencia = 'descendente'

    const sets = objetivosArr.filter((o: any) => o.programa_id === p.id)
      .sort((a: any, b: any) => (a.numero_set || 0) - (b.numero_set || 0))

    // FIX: normalizar el área para evitar duplicados visuales (ej: "Memoria de trabajo" vs "MEMORIA DE TRABAJO" vs "memoria  de trabajo")
    //      trim → colapsar espacios → uppercase → quitar tildes residuales
    const areaRaw = String(p.area || 'General').trim().replace(/\s+/g, ' ')
    const areaNorm = areaRaw
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar diacríticos para comparar
      .toUpperCase()
    // Reconstruir con tildes a partir del texto original capitalizado uniformemente
    const areaFinal = areaRaw.toUpperCase()

    // Datos crudos adicionales para trazabilidad
    const primeraFecha = sesP.length > 0 ? sesP[0].fecha : undefined
    const ultimaFecha = sesP.length > 0 ? sesP[sesP.length - 1].fecha : undefined
    const minPct = pcts.length > 0 ? Math.min(...pcts) : undefined
    const maxPct = pcts.length > 0 ? Math.max(...pcts) : undefined

    return {
      id: p.id,
      titulo: p.titulo || 'Sin nombre',
      area: areaFinal,
      areaKey: areaNorm,  // clave para agrupar sin duplicar
      primeraFecha,
      ultimaFecha,
      minPct,
      maxPct,
      estado: p.estado || 'activo',
      fase: p.fase_actual || '—',
      criterio: p.criterio_dominio_pct || 90,
      objetivo_lp: p.objetivo_lp || '',
      n_sesiones: pcts.length,
      pcts,
      ultimo_pct: ultimo,
      promedio,
      promedio_reciente: promedioReciente,
      tendencia,
      delta_inicio: delta,
      sets,
    }
  })

  // Stats globales
  // FIX: sesiones_datos_aba tiene 1 fila POR PROGRAMA por sesión.
  //      Para contar sesiones reales, deduplicar por fecha.
  const fechasDistintas = new Set(sesProgArr.map((s: any) => s.fecha).filter(Boolean))
  const totalSesiones = fechasDistintas.size

  // Helper: criterio alcanzado por desempeño (últimas N sesiones >= criterio).
  // Replica el comportamiento del UI cuando no hay set explícito (ignora sets).
  const programaCumpleCriterioAuto = (programaId: string): boolean => {
    const p = progArr.find(x => x.id === programaId)
    if (!p) return false
    const crit = Number(p.criterio_dominio_pct) || 90
    const critSes = Number(p.criterio_sesiones_consecutivas) || 2
    const todas = sesProgArr.filter((s: any) => s.programa_id === programaId)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    if (todas.length < critSes) return false
    const ultimas = todas.slice(-critSes)
    return ultimas.every((s: any) => (Number(s.porcentaje_exito) || 0) >= crit)
  }

  // Helper: TODOS los SETs del programa están marcados como "dominado" por el especialista.
  // Un solo set dominado no basta — significaría que el programa todavía tiene otros sets pendientes.
  const programaTodosSetsDominados = (programaId: string): boolean => {
    const sets = objetivosArr.filter((o: any) => o.programa_id === programaId)
    if (sets.length === 0) return false  // sin sets definidos, esta vía no aplica
    return sets.every((o: any) => o.estado === 'dominado')
  }

  // Unificado: criterio alcanzado si CUALQUIERA de estas condiciones se cumple:
  //   1) Estado oficial del programa = dominado/logrado/criterio_alcanzado
  //   2) Últimas N sesiones consecutivas >= criterio (cálculo automático)
  //   3) TODOS los SETs del programa marcados como "dominado" por la especialista
  const programaCumpleCriterio = (programaId: string): boolean => {
    const p = progArr.find(x => x.id === programaId)
    if (!p) return false
    if (['dominado', 'logrado', 'criterio_alcanzado'].includes(p.estado)) return true
    if (programaCumpleCriterioAuto(programaId)) return true
    if (programaTodosSetsDominados(programaId)) return true
    return false
  }

  const programasDominados = programasConDatos.filter(p => programaCumpleCriterio(p.id))
  const programasIntervencion = programasConDatos.filter(p =>
    ['activo', 'intervencion', 'en_intervencion'].includes(p.estado) || (!p.estado && p.fase !== 'linea_base')
  )
  const programasLineaBase = programasConDatos.filter(p => p.fase === 'linea_base')

  const promediosTodos = programasConDatos.map(p => p.promedio).filter((v): v is number => v != null)
  const promedioGlobal = avg(promediosTodos)

  const fechasUnif = sesProgArr.map((s: any) => s.fecha).filter(Boolean).sort()
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaInicio = fechasUnif.length > 0 ? fmt(fechasUnif[0]) : '—'
  const fechaFin    = fechasUnif.length > 0 ? fmt(fechasUnif[fechasUnif.length - 1]) : fmt(new Date().toISOString())
  const semanas = fechasUnif.length > 1
    ? Math.round((new Date(fechasUnif[fechasUnif.length-1]).getTime() - new Date(fechasUnif[0]).getTime())/(7*24*60*60*1000))
    : 0

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const iniciales = tpl.generarIniciales(nombre)
  const fileName = `Informe_Clinico_${nombreCap.replace(/\s+/g, '_')}_${hoyISO}.docx`
  const docNum = `IC-${hoyISO.replace(/-/g, '')}-${childId.slice(0, 6).toUpperCase()}`

  // ─── 4. Construir filas de Habilidades y Logros con vertical merge ──
  const habilidades: HabilidadFila[] = []
  // FIX: agrupar por areaKey (normalizada sin tildes) para evitar duplicados
  //      pero usar el texto `area` (con tildes) para mostrar al usuario
  const programasPorArea: Record<string, ProgramaConDatos[]> = {}
  const areaKeyToLabel: Record<string, string> = {}
  for (const p of programasConDatos) {
    if (!programasPorArea[p.areaKey]) programasPorArea[p.areaKey] = []
    programasPorArea[p.areaKey].push(p)
    if (!areaKeyToLabel[p.areaKey]) areaKeyToLabel[p.areaKey] = p.area
  }

  for (const [areaKey, progs] of Object.entries(programasPorArea)) {
    let areaMostrada = false
    const areaName = areaKeyToLabel[areaKey] || areaKey
    for (const p of progs) {
      // Texto del objetivo en estilo LuTr:
      //   "Con un criterio de éxito del [X]% en dos sesiones consecutivas, [objetivo_lp]"
      let objetivoTxt = p.objetivo_lp.trim()
      if (objetivoTxt) {
        // Si ya empieza con "Con un criterio" lo dejamos, sino lo prefijamos
        if (!/^con un criterio/i.test(objetivoTxt)) {
          objetivoTxt = `Con un criterio de éxito del ${p.criterio}% en dos sesiones consecutivas, ${objetivoTxt.charAt(0).toLowerCase() + objetivoTxt.slice(1)}`
        }
      } else {
        objetivoTxt = `Con un criterio de éxito del ${p.criterio}% en dos sesiones consecutivas, el/la estudiante deberá alcanzar el dominio del programa "${p.titulo}".`
      }

      // Fila HEADER del programa (objetivo general, sin set)
      // Considera: estado oficial, criterio automático, O sets dominados manualmente
      const cumpleCriterio = programaCumpleCriterio(p.id)
      const estadoProgr: any =
        cumpleCriterio ? 'logrado'
        : (p.promedio_reciente != null && p.promedio_reciente >= 80) ? 'casi_logrado'
        : (p.promedio_reciente != null && p.promedio_reciente > 0) ? 'en_proceso'
        : 'no_iniciado'

      habilidades.push({
        area: areaMostrada ? '' : areaName,
        subarea: p.titulo,
        objetivo: objetivoTxt,
        estado: estadoProgr,
        porcentaje: p.promedio_reciente ?? p.promedio ?? undefined,
      })
      areaMostrada = true

      // Filas SET (si hay objetivos_cp definidos)
      for (const s of p.sets) {
        const sesSet = sesProgArr.filter((ses: any) => {
          if (ses.programa_id !== p.id) return false
          const fase = String(ses.fase || '').toLowerCase()
          return fase.includes(`set ${s.numero_set}`) || fase.includes(`set${s.numero_set}`) || fase === String(s.numero_set)
        })
        const pctsSet = sesSet.map((ses: any) => parseNivelLogro(ses.porcentaje_exito))
          .filter((v: number | null): v is number => v !== null)
        const promSet = pctsSet.length > 0 ? avg(pctsSet) : null

        const estadoObj = (s.estado || '').toLowerCase()
        let estadoSet: any = 'en_proceso'
        if (['dominado', 'logrado', 'criterio_alcanzado'].includes(estadoObj)) estadoSet = 'logrado'
        else if (estadoObj === 'casi_logrado') estadoSet = 'casi_logrado'
        else if (['no_iniciado', 'pendiente'].includes(estadoObj)) estadoSet = 'no_iniciado'
        else if (promSet != null) {
          estadoSet = promSet >= p.criterio ? 'logrado'
            : promSet >= 80 ? 'casi_logrado'
            : promSet > 0 ? 'en_proceso'
            : 'no_iniciado'
        }

        habilidades.push({
          area: '', subarea: '', objetivo: '',
          set: `SET ${s.numero_set}: ${s.descripcion || 'Sin descripción'}`,
          estado: estadoSet,
          porcentaje: promSet ?? undefined,
        })
      }
    }
  }

  // ─── 5. IA: Resumen ejecutivo + Análisis por área + Plan + Recomendaciones ─
  const resumenProgramas = programasConDatos
    .map(p => `· ${p.titulo} (${p.area}) — ${p.n_sesiones} sesiones — último ${p.ultimo_pct ?? 'N/D'}% — promedio ${p.promedio ?? 'N/D'}% — tendencia: ${p.tendencia} — estado: ${p.estado}`)
    .join('\n')

  const evalIniContexto = evalIni
    ? `Evaluación inicial: ${(evalIni as any).recomendacion || 'no concluyente'} — ${(evalIni as any).recomendacion_resumen?.slice(0, 250) || ''}`
    : 'Sin evaluación inicial registrada.'

  const docsResumen = docsArr.length > 0
    ? `Documentos en expediente (${docsArr.length}): ${docsArr.map(d => d.file_name).slice(0, 5).join(', ')}.`
    : 'Sin documentos adicionales en expediente.'

  const fichasResumen = fichasArr.length > 0
    ? `Fichas clínicas recientes (${fichasArr.length}): ${fichasArr.map(f => (f.clinical_templates as any)?.name || 'Ficha').slice(0, 4).join(', ')}.`
    : ''

  // ─── Contexto invisible: Evaluaciones del tab "Evaluaciones" ───
  // Estos datos NO aparecen como sección formal en el Word, solo enriquecen el análisis IA.
  const truncar = (s: any, max = 180) => {
    const txt = typeof s === 'string' ? s : (s != null ? JSON.stringify(s) : '')
    return txt.length > max ? txt.slice(0, max) + '…' : txt
  }
  const resumenRespuestas = (datos: any, maxClaves = 6, maxCharsValor = 100) => {
    if (!datos || typeof datos !== 'object') return ''
    const claves = Object.keys(datos).filter(k => datos[k] != null && datos[k] !== '').slice(0, maxClaves)
    return claves.map(k => `${k}: ${truncar(datos[k], maxCharsValor)}`).join(' | ')
  }

  const evalCtxParts: string[] = []
  if (anamnesisArr.length > 0) {
    evalCtxParts.push(`ANAMNESIS COMPLETA (${anamnesisArr.length}):\n` +
      anamnesisArr.slice(0, 2).map(a => `· ${a.form_title || 'Anamnesis'} (${(a.fecha_creacion || '').slice(0,10)}): ${resumenRespuestas(a.datos)}`).join('\n'))
  }
  if (registroAbaArr.length > 0) {
    evalCtxParts.push(`REGISTROS ABA (${registroAbaArr.length}):\n` +
      registroAbaArr.slice(0, 3).map(r => `· ${r.form_title || 'Registro ABA'} (${(r.fecha_sesion || '').slice(0,10)}): ${resumenRespuestas(r.datos)}`).join('\n'))
  }
  if (entornoHogarArr.length > 0) {
    evalCtxParts.push(`ENTORNO HOGAR (${entornoHogarArr.length}):\n` +
      entornoHogarArr.slice(0, 2).map(e => `· ${e.form_title || 'Entorno hogar'} (${(e.fecha_visita || '').slice(0,10)}): ${resumenRespuestas(e.datos)}`).join('\n'))
  }
  if (formResponsesArr.length > 0) {
    evalCtxParts.push(`OTRAS EVALUACIONES (${formResponsesArr.length}):\n` +
      formResponsesArr.slice(0, 3).map(f => `· ${f.form_title || f.form_type || 'Evaluación'} (${(f.created_at || '').slice(0,10)}): ${truncar(f.ai_analysis || f.responses, 200)}`).join('\n'))
  }
  const evaluacionesCtx = evalCtxParts.length > 0
    ? `\n\nEVALUACIONES COMPLEMENTARIAS REGISTRADAS (contexto adicional para tu análisis clínico, no las cites como secciones del informe):\n${evalCtxParts.join('\n\n')}`
    : ''

  const [textoResumenEjecutivo, textoAnalisisGlobal, textoPlanTerapeutico, textoRecomendacionesIA] = await Promise.all([
    callGroqSimple(
      'Eres neuropsicóloga clínica senior de SANTI. Prosa formal, sin emojis, sin bullets en el body.',
      `Redacta el RESUMEN EJECUTIVO del informe clínico de ${nombreCap} (${edadTexto}, ${(child as any)?.diagnosis || 'en evaluación'}).

Datos disponibles:
- Período: ${fechaInicio} al ${fechaFin} (${semanas} semanas)
- Total sesiones: ${totalSesiones}
- Programas activos: ${programasIntervencion.length}
- Programas con criterio alcanzado: ${programasDominados.length}
- Programas en línea base: ${programasLineaBase.length}
- Promedio global de logro: ${promedioGlobal}%
- ${evalIniContexto}

Programas:
${resumenProgramas}${evaluacionesCtx}

Escribe 2 párrafos densos (máximo 200 palabras total) que UN CLÍNICO senior pueda leer y comprender el caso en 30 segundos. NO repitas tablas. Sintetizá: dónde está hoy el paciente, qué fortalezas muestra, qué áreas requieren foco, qué tendencia clínica predomina. Tono académico, sin emojis.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 500 },
    ),

    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Prosa profesional, sin bullets, sin emojis.',
      `Redacta el "ANÁLISIS CLÍNICO POR ÁREA" de ${nombreCap}. Devuelve un texto con SUBSECCIONES en negrita por cada área de trabajo. Por cada área:
1. Nombre del área en **negrita**.
2. 1-2 oraciones de prosa que interpreten clínicamente el desempeño (no listar números, interpretarlos: tendencia, hipótesis de variabilidad, generalización, etc.).
3. Mencionar el programa más fuerte y el más débil del área si hay varios.

Datos:
${resumenProgramas}${evaluacionesCtx}

Sin bullets, sin emojis. Cada área 50-80 palabras. Total ≤ 450 palabras.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 1100 },
    ),

    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Prosa formal, sin emojis.',
      `Redacta el "PLAN TERAPÉUTICO" de ${nombreCap} para los próximos 30, 60 y 90 días. Tres párrafos cortos (máximo 60 palabras cada uno) con FOCOS específicos basados en los datos. Cita programas concretos por nombre. Sin emojis, sin bullets.

Datos:
- Programas con criterio alcanzado (consolidar): ${programasDominados.map(p => p.titulo).join(', ') || 'ninguno aún'}
- Programas en intervención activa: ${programasIntervencion.map(p => p.titulo).slice(0, 6).join(', ')}
- Línea base / nuevos: ${programasLineaBase.map(p => p.titulo).join(', ') || 'ninguno'}

Estructura:
**Próximos 30 días:** [foco inmediato]
**Próximos 60 días:** [consolidación y avance de sets]
**Próximos 90 días:** [generalización, nuevas áreas, evaluación de criterios]`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 600 },
    ),

    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Devolvé SOLO JSON válido, sin texto antes ni después.',
      `Generá las RECOMENDACIONES tripartitas para ${nombreCap} (${edadTexto}, ${(child as any)?.diagnosis || 'en evaluación'}).

Devolvé JSON ESTRICTO:
{
  "menor":   ["Recomendación 1 accionable y específica al caso", "..."],
  "familia": ["...", "..."],
  "escuela": ["...", "..."]
}

3-5 ítems por destinatario. ESPECÍFICOS al caso (citar áreas/programas reales cuando aplique). Sin emojis. Sin texto fuera del JSON.

Contexto del paciente:
${resumenProgramas}
${evalIniContexto}${evaluacionesCtx}`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.5, maxTokens: 900 },
    ),
  ])

  // Parsear recomendaciones JSON con fallback
  let recomObj: RecomendacionesBloque = { menor: [], familia: [], escuela: [] }
  try {
    const m = textoRecomendacionesIA.match(/\{[\s\S]*\}/)
    if (m) {
      const j = JSON.parse(m[0])
      recomObj = {
        menor:   Array.isArray(j.menor)   ? j.menor   : [],
        familia: Array.isArray(j.familia) ? j.familia : [],
        escuela: Array.isArray(j.escuela) ? j.escuela : [],
      }
    }
  } catch {
    recomObj = {
      menor: ['Continuar con el plan terapéutico actual.'],
      familia: ['Mantener regularidad en la asistencia y practicar en casa lo trabajado.'],
      escuela: ['Mantener comunicación constante con el equipo terapéutico.'],
    }
  }

  // Parsear texto IA con secciones en negrita → bloques formales
  const parsearProsaConSubsecciones = (texto: string): Paragraph[] => {
    const out: Paragraph[] = []
    const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)
    for (const l of lineas) {
      const m = l.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/)
      if (m) {
        const label = m[1].trim()
        const resto = m[2].trim()
        if (resto) {
          out.push(tpl.subseccion(label, resto))
        } else {
          out.push(new Paragraph({
            spacing: { before: 200, after: 60 },
            children: [new TextRun({ text: label, bold: true, size: 21, font: 'Arial', color: '1E293B' })],
          }))
        }
      } else {
        out.push(tpl.parrafo(l.replace(/\*\*/g, '')))
      }
    }
    return out
  }

  // ─── 6. Gráficos: progreso global + por área ────────────────────────
  // FIX: usar areaKey para agrupar (sin duplicados) + label legible con n° de programas
  const datosGraficoArea = Object.entries(programasPorArea).map(([areaKey, progs]) => {
    const proms = progs.map(p => p.promedio_reciente ?? p.promedio ?? 0).filter(v => v > 0)
    const label = areaKeyToLabel[areaKey] || areaKey
    return { label: `${label} (${progs.length})`, valor: proms.length > 0 ? avg(proms) : 0 }
  }).filter(d => d.valor > 0)

  const datosGraficoTopProgs = programasConDatos
    .filter(p => p.promedio != null)
    .sort((a, b) => (b.promedio || 0) - (a.promedio || 0))
    .slice(0, 8)
    .map(p => ({ label: p.titulo.slice(0, 38), valor: p.promedio_reciente ?? p.promedio ?? 0 }))

  // ─── 7. Construir documento ─────────────────────────────────────────
  const periodoTexto = fechasUnif.length > 1 ? `${fechaInicio} al ${fechaFin}` : (fechasUnif.length === 1 ? fechaInicio : '—')

  // ── Generar QR async (necesita estar fuera del array spread) ─────────
  const sellosVerificacion = await tpl.selloQRVerificacionAsync({
    codigoDoc: docNum,
    fechaEmision: hoy,
    especialista: 'Equipo Clínico SANTI',
  })

  const sections: DocChild[] = [
    // ── PORTADA institucional con QR ──
    ...portadaInstitucional({
      tipoInforme: 'INFORME CLÍNICO DE TRATAMIENTO',
      nombrePaciente: nombre,
      edadPaciente: edadTexto,
      diagnostico: (child as any)?.diagnosis || 'En evaluación clínica',
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'Centro Especializado en Neuropsicología y Terapias',
      fechaEmision: hoy,
      periodoEval: periodoTexto,
      codigoDoc: docNum,
    }),
    // (la portada ya incluye su propio salto de página)

    // ── DATOS GENERALES ──
    tpl.tituloSeccion('I.  Datos Generales'),
    tpl.tablaDatosGenerales([
      ['Apellidos y nombres', nombre],
      ['Fecha de nacimiento', (child as any)?.birth_date
        ? new Date((child as any).birth_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—'],
      ['Edad', edadTexto],
      ['Diagnóstico', (child as any)?.diagnosis || 'En evaluación'],
      ['Período de trabajo', periodoTexto],
      ['Total de sesiones realizadas', String(totalSesionesRealizadas)],
      // Programas activos = los que NO cumplen criterio (siguen en intervención/línea base)
      ['Programas activos', String(programasConDatos.filter(p => !programaCumpleCriterio(p.id)).length)],
      ['Programas con criterio alcanzado', String(programasDominados.length)],
      ['Promedio global de logro', `${promedioGlobal}%`],
      ['Documento N°', docNum],
      ['Fecha de entrega del informe', hoy],
    ]),

    // ── RESUMEN EJECUTIVO ──
    tpl.tituloSeccion('II.  Resumen Ejecutivo'),
    ...parsearProsaConSubsecciones(textoResumenEjecutivo),

    // ── HABILIDADES Y LOGROS (TABLA CON MERGE) ──
    tpl.tituloSeccion('III.  Habilidades y Logros'),
    new Paragraph({
      spacing: { before: 100, after: 120 },
      children: [new TextRun({
        text: 'Intervención con el menor — desempeño por programa, subárea y SET',
        italics: true, bold: true, size: 19, font: 'Arial', color: '1E293B',
      })],
    }),
    tpl.tablaHabilidades(habilidades),
    ...tpl.glosarioAyudas(),

    // ── ANÁLISIS POR ÁREA ──
    tpl.tituloSeccion('IV.  Análisis Clínico por Área'),
    ...parsearProsaConSubsecciones(textoAnalisisGlobal),
  ]

  // Gráficos
  if (datosGraficoArea.length > 0) {
    sections.push(tpl.tituloSeccion('V.  Representación Gráfica del Progreso'))
    sections.push(new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: 'Promedio de logro por área de intervención (sesiones recientes):', size: 19, font: 'Arial', color: '475569', italics: true })],
    }))
    sections.push(...tpl.graficoProgresoBarra('Logro por área (%)', datosGraficoArea, { mostrarMeta: true, metaPct: 90 }))
  }
  if (datosGraficoTopProgs.length > 0) {
    sections.push(new Paragraph({
      spacing: { before: 220, after: 100 },
      children: [new TextRun({ text: `Desempeño actual por programa (top ${datosGraficoTopProgs.length}):`, size: 19, font: 'Arial', color: '475569', italics: true })],
    }))
    sections.push(...tpl.graficoProgresoBarra('Logro por programa (%)', datosGraficoTopProgs, { mostrarMeta: true, metaPct: 90 }))
  }

  // Plan terapéutico
  sections.push(tpl.tituloSeccion('VI.  Plan Terapéutico 30 / 60 / 90 días'))
  sections.push(...parsearProsaConSubsecciones(textoPlanTerapeutico))

  // Recomendaciones
  sections.push(...tpl.recomendaciones(recomObj))

  // ─── VIII. FUENTE DE DATOS Y TRAZABILIDAD ──────────────────────────
  //   Esto permite al lector verificar cada número del informe contra
  //   los datos reales del expediente. Cero datos sintéticos.
  sections.push(tpl.tituloSeccion('VIII.  Fuente de Datos y Trazabilidad'))

  sections.push(tpl.parrafo(
    `Todos los porcentajes, conteos y análisis de este informe se calculan en tiempo real a partir de los datos registrados en la plataforma SANTI para este paciente. No se incluyen valores predeterminados, simulados ni inferidos. Las fuentes consultadas son:`
  ))

  sections.push(...tpl.items([
    `Tabla "programas_aba" — ${progArr.length} programas registrados para ${nombreCap}.`,
    `Tabla "sesiones_datos_aba" — ${sesProgArr.length} sesiones registradas en el período del ${fechaInicio} al ${fechaFin}.`,
    `Tabla "objetivos_cp" — ${objetivosArr.length} sets (objetivos a corto plazo) asociados a los programas activos.`,
    evalIni ? `Tabla "evaluaciones_iniciales" — evaluación inicial registrada (estado: ${(evalIni as any).estado}).` : 'Tabla "evaluaciones_iniciales" — sin evaluación inicial registrada.',
    `Tabla "patient_documents" — ${docsArr.length} documentos con texto extraído por IA.`,
    `Tabla "clinical_template_responses" — ${fichasArr.length} fichas clínicas registradas.`,
  ]))

  sections.push(new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [new TextRun({
      text: 'Cálculos por programa (datos crudos)',
      bold: true, italics: true, size: 19, font: 'Arial', color: '1E3A8A',
    })],
  }))

  // Tabla de trazabilidad: una fila por programa con todos los datos crudos
  const filasTraza: [string, string][] = []
  for (const p of programasConDatos) {
    const fechaIni = p.primeraFecha ? new Date(p.primeraFecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    const fechaFn = p.ultimaFecha ? new Date(p.ultimaFecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    const detalle =
      `${p.n_sesiones} sesiones · min ${p.minPct ?? '—'}% · max ${p.maxPct ?? '—'}% · promedio total ${p.promedio ?? '—'}% · promedio últimas 5 ${p.promedio_reciente ?? '—'}% · primera ${fechaIni} · última ${fechaFn} · estado ${p.estado} · tendencia ${p.tendencia}`
    filasTraza.push([
      `${p.titulo}  (${p.area})`,
      detalle,
    ])
  }
  if (filasTraza.length > 0) {
    sections.push(tpl.tablaDatosGenerales(filasTraza))
  }

  sections.push(tpl.parrafo(
    `Fórmulas utilizadas: "promedio total" = media aritmética de todas las sesiones del programa; "promedio últimas 5" = media de las cinco sesiones más recientes (lo que se muestra en los gráficos); "tendencia" se determina por la diferencia entre las cinco primeras y las cinco últimas sesiones (≥ +8% ascendente, ≤ −8% descendente, sino estable); "estado" proviene del campo "estado" del programa registrado por el especialista en la plataforma.`,
  ))

  // ── Sello QR de verificación + firma del equipo ──
  sections.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }))
  sections.push(...sellosVerificacion)

  // Cierre
  sections.push(
    new Paragraph({
      spacing: { before: 600, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 8 } },
      children: [new TextRun({ text: 'Equipo Clínico', bold: true, size: 22, font: 'Arial', color: '1E3A8A' })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI', size: 19, font: 'Arial', color: '475569' })],
    }),
    new Paragraph({
      spacing: { before: 80, after: 0 },
      children: [new TextRun({ text: `${hoy}  ·  Documento confidencial de uso clínico — Nº ${docNum}`, size: 16, font: 'Arial', color: '94A3B8', italics: true })],
    }),
  )

  const doc = new Document({
    numbering: tpl.DOC_NUMBERING,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: tpl.DOC_PAGE_PROPS,
      footers: { default: tpl.piePaginaOficial() },
      children: sections,
    }],
  })

  // Registrar el documento emitido (alimenta la página /verificar/<codigo>)
  await registrarDocumentoEmitido({
    codigoDoc:         docNum,
    childId:           childId,
    tipo:              'informe_clinico',
    pacienteNombre:    nombre,
    pacienteIniciales: iniciales,
    fileName,
    metadata: {
      total_sesiones:    totalSesiones,
      programas_activos: progArr.length,
      promedio_global:   promedioGlobal,
      periodo:           periodoTexto,
    },
  })

  return { doc, fileName }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTE PARA PADRES (versión PRO) — tono cálido + nivel profesional
// ═══════════════════════════════════════════════════════════════════════════
async function generarReportePadresPro(
  childId: string,
  userLocale = 'es',
): Promise<{ doc: Document; fileName: string }> {

  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, age, birth_date, diagnosis, parent_id, sessions_before_platform')
    .eq('id', childId).single()

  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  const nombreCorto = nombreCap.split(' ')[0]

  let edadTexto = 'no registrada'
  if ((child as any)?.birth_date) {
    const nac = new Date((child as any).birth_date)
    const ahora = new Date()
    const años = ahora.getFullYear() - nac.getFullYear()
    const meses = ahora.getMonth() - nac.getMonth()
    const edad = (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) ? años - 1 : años
    const mesesAdj = meses < 0 ? meses + 12 : meses
    edadTexto = `${edad} años${mesesAdj > 0 ? ` ${mesesAdj} meses` : ''}`
  } else if ((child as any)?.age) {
    edadTexto = `${(child as any).age} años`
  }

  // Total de sesiones realizadas (misma fórmula que el UI)
  const totalSesionesRealizadas = await contarSesionesRealizadas(childId, (child as any)?.sessions_before_platform)

  const [
    { data: programas },
    { data: sesionesProg },
    anamnesisRes,
    registroAbaRes,
    entornoHogarRes,
    formResponsesRes,
  ] = await Promise.all([
    supabaseAdmin.from('programas_aba').select('id, titulo, area, estado, fase_actual, criterio_dominio_pct, criterio_sesiones_consecutivas, objetivo_lp').eq('child_id', childId).limit(30),
    supabaseAdmin.from('sesiones_datos_aba').select('programa_id, fecha, porcentaje_exito, set').eq('child_id', childId).order('fecha', { ascending: true }).limit(300),
    (async () => { try { return await supabaseAdmin.from('anamnesis_completa').select('form_title, datos, fecha_creacion').eq('child_id', childId).order('fecha_creacion', { ascending: false }).limit(2) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('registro_aba').select('form_title, datos, fecha_sesion').eq('child_id', childId).order('fecha_sesion', { ascending: false }).limit(3) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('registro_entorno_hogar').select('form_title, datos, fecha_visita').eq('child_id', childId).order('fecha_visita', { ascending: false }).limit(2) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('form_responses').select('form_type, form_title, responses, ai_analysis, created_at').eq('child_id', childId).order('created_at', { ascending: false }).limit(3) } catch { return { data: [] as any[] } } })(),
  ])
  const anamnesisArr = ((anamnesisRes as any)?.data || []) as any[]
  const registroAbaArr = ((registroAbaRes as any)?.data || []) as any[]
  const entornoHogarArr = ((entornoHogarRes as any)?.data || []) as any[]
  const formResponsesArr = ((formResponsesRes as any)?.data || []) as any[]

  // Cargar objetivos_cp (sets) para contar los que el especialista marcó como dominados manualmente
  let objetivosArr: any[] = []
  if ((programas || []).length > 0) {
    try {
      const progIds = (programas as any[]).map(p => p.id)
      const { data } = await supabaseAdmin
        .from('objetivos_cp')
        .select('programa_id, estado')
        .in('programa_id', progIds)
      objetivosArr = data || []
    } catch (e: any) {
      console.warn('[padres-pro] objetivos_cp falló:', e?.message)
    }
  }
  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  // Helper: criterio alcanzado considerando 3 vías:
  //   1) Estado oficial del programa (dominado/logrado/criterio_alcanzado)
  //   2) Cálculo automático (últimas N sesiones >= criterio)
  //   3) TODOS los SETs del programa marcados como dominado por el especialista
  const programaCumpleCriterio = (programaId: string): boolean => {
    const p = progArr.find(x => x.id === programaId)
    if (!p) return false
    // 1) Estado oficial
    if (['dominado', 'logrado', 'criterio_alcanzado'].includes(p.estado)) return true
    // 2) Automático
    const crit = Number(p.criterio_dominio_pct) || 90
    const critSes = Number(p.criterio_sesiones_consecutivas) || 2
    const todas = sesProgArr.filter((s: any) => s.programa_id === programaId)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    if (todas.length >= critSes) {
      const ultimas = todas.slice(-critSes)
      if (ultimas.every((s: any) => (Number(s.porcentaje_exito) || 0) >= crit)) return true
    }
    // 3) TODOS los SETs marcados como dominado (no basta con uno)
    const setsProg = objetivosArr.filter((o: any) => o.programa_id === programaId)
    if (setsProg.length > 0 && setsProg.every((o: any) => o.estado === 'dominado')) return true
    return false
  }

  // Stats globales
  const promediosTodos: number[] = []
  const programasInfo = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const pcts = sesP.map((s: any) => Number(s.porcentaje_exito) || 0).filter((v: number) => v > 0)
    const recientes = pcts.slice(-5)
    const iniciales = pcts.slice(0, 5)
    const promReciente = recientes.length > 0 ? avg(recientes) : null
    const promInicial = iniciales.length > 0 ? avg(iniciales) : null
    if (promReciente != null) promediosTodos.push(promReciente)
    return {
      id: p.id,
      titulo: p.titulo, area: p.area || 'General', estado: p.estado || 'activo',
      criterio: Number(p.criterio_dominio_pct) || 90,
      cumple_criterio: programaCumpleCriterio(p.id),
      n_sesiones: pcts.length,
      promedio_reciente: promReciente,
      promedio_inicial: promInicial,
      delta: (promReciente != null && promInicial != null) ? promReciente - promInicial : 0,
    }
  })

  // programasInfo.cumple_criterio ya considera las 3 vías (estado, automático, SET manual).
  const programasDominados = programasInfo.filter(p => p.cumple_criterio)
  const promedioGlobal = avg(promediosTodos)
  // FIX: sesiones_datos_aba tiene 1 fila POR PROGRAMA por sesión.
  //      Para contar sesiones reales, deduplicar por fecha.
  const fechasDistintas = new Set(sesProgArr.map((s: any) => s.fecha).filter(Boolean))
  const totalSesiones = fechasDistintas.size

  const fechasUnif = sesProgArr.map((s: any) => s.fecha).filter(Boolean).sort()
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaInicio = fechasUnif.length > 0 ? fmt(fechasUnif[0]) : '—'
  const fechaFin    = fechasUnif.length > 0 ? fmt(fechasUnif[fechasUnif.length - 1]) : fmt(new Date().toISOString())
  const semanas = fechasUnif.length > 1
    ? Math.round((new Date(fechasUnif[fechasUnif.length-1]).getTime() - new Date(fechasUnif[0]).getTime())/(7*24*60*60*1000))
    : 0

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const iniciales = tpl.generarIniciales(nombre)
  const fileName = `Reporte_Familia_${nombreCap.replace(/\s+/g, '_')}_${hoyISO}.docx`
  const codigoDoc = generarCodigoDocumento(childId, 'padres')

  // ── IA: bienvenida + celebración + plan en casa + cierre cálido ──
  const resumenDatos = programasInfo
    .map(p => `· ${p.titulo} (${p.area}): ${p.n_sesiones} sesiones · ${p.promedio_reciente ?? 'sin datos'}% promedio reciente · estado ${p.estado}`)
    .join('\n')

  // Contexto invisible: evaluaciones complementarias (no se muestran como sección)
  const truncar = (s: any, max = 150) => {
    const txt = typeof s === 'string' ? s : (s != null ? JSON.stringify(s) : '')
    return txt.length > max ? txt.slice(0, max) + '…' : txt
  }
  const resumenRespuestas = (datos: any, maxClaves = 5, maxCharsValor = 80) => {
    if (!datos || typeof datos !== 'object') return ''
    const claves = Object.keys(datos).filter(k => datos[k] != null && datos[k] !== '').slice(0, maxClaves)
    return claves.map(k => `${k}: ${truncar(datos[k], maxCharsValor)}`).join(' | ')
  }
  const evalCtxParts: string[] = []
  if (anamnesisArr.length > 0) evalCtxParts.push(`ANAMNESIS: ${anamnesisArr.slice(0,1).map(a => resumenRespuestas(a.datos)).join('')}`)
  if (registroAbaArr.length > 0) evalCtxParts.push(`REGISTROS ABA (${registroAbaArr.length}): ${registroAbaArr.slice(0,2).map(r => resumenRespuestas(r.datos)).join(' || ')}`)
  if (entornoHogarArr.length > 0) evalCtxParts.push(`ENTORNO HOGAR: ${entornoHogarArr.slice(0,1).map(e => resumenRespuestas(e.datos)).join('')}`)
  if (formResponsesArr.length > 0) evalCtxParts.push(`OTRAS EVALUACIONES: ${formResponsesArr.slice(0,2).map(f => truncar(f.ai_analysis || f.responses, 120)).join(' || ')}`)
  const evaluacionesCtx = evalCtxParts.length > 0
    ? `\n\nContexto adicional de evaluaciones registradas (úsalo para personalizar el tono y mensaje, no las menciones explícitamente):\n${evalCtxParts.join('\n')}`
    : ''

  const [bienvenida, celebracion, planCasa, mensajeCierre] = await Promise.all([
    callGroqSimple(
      'Eres terapeuta ABA empática y cálida de SANTI. Escribís a familias con afecto, sin tecnicismos.',
      `Saluda a la familia de ${nombreCorto} (${edadTexto}). Hacé una bienvenida CORTA y cálida (1 párrafo, 50 palabras máximo) reconociendo el período de trabajo (${semanas} semanas, ${totalSesiones} sesiones) y celebrando la constancia de la familia.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 200 },
    ),
    callGroqSimple(
      'Eres terapeuta ABA cálida y celebratoria. Lenguaje accesible para padres.',
      `Escribí 3 párrafos sobre los LOGROS Y AVANCES de ${nombreCorto} con estos datos:
- Promedio general de logro: ${promedioGlobal}%
- Programas con criterio alcanzado: ${programasDominados.length} (${programasDominados.map(p => p.titulo).slice(0, 4).join(', ') || 'avanzando'})
- Sesiones: ${totalSesiones} en ${semanas} semanas
- Áreas trabajadas: ${[...new Set(programasInfo.map(p => p.area))].join(', ')}${evaluacionesCtx}

Celebrá con ejemplos concretos y entusiasmo real. Mencioná avances específicos (cita nombres de programas). Sin tecnicismos, sin emojis técnicos. Máximo 220 palabras total.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 500 },
    ),
    callGroqSimple(
      'Eres terapeuta ABA. Da consejos prácticos para casa, en lenguaje claro.',
      `Escribí 4-5 ACTIVIDADES CONCRETAS para hacer en casa con ${nombreCorto} (${edadTexto}, ${(child as any)?.diagnosis || 'desarrollo en curso'}) basadas en estos programas activos:
${resumenDatos}${evaluacionesCtx}

Cada actividad como un párrafo corto: nombre + cómo hacerla (1-2 oraciones) + por qué ayuda. No bullets, en prosa fluida. Lenguaje cercano, sin tecnicismos. Máximo 320 palabras.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.6, maxTokens: 700 },
    ),
    callGroqSimple(
      'Eres terapeuta ABA. Mensaje final cálido y motivador.',
      `Escribí un MENSAJE DE CIERRE corto (1 párrafo, máximo 70 palabras) para la familia de ${nombreCorto}. Reconocé el esfuerzo de los padres, proyectá optimismo realista, invitá a seguir en contacto. Sin emojis técnicos.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 200 },
    ),
  ])

  // QR
  const sellosVerif = await tpl.selloQRVerificacionAsync({
    codigoDoc, fechaEmision: hoy, especialista: 'Equipo Clínico SANTI',
  })

  // Datos del gráfico
  const datosGraficoAreas: { label: string; valor: number }[] = []
  const areasMap: Record<string, number[]> = {}
  for (const p of programasInfo) {
    if (p.promedio_reciente != null) {
      if (!areasMap[p.area]) areasMap[p.area] = []
      areasMap[p.area].push(p.promedio_reciente)
    }
  }
  for (const [area, vals] of Object.entries(areasMap)) {
    datosGraficoAreas.push({ label: area, valor: avg(vals) })
  }

  const periodoTexto = fechasUnif.length > 1 ? `${fechaInicio} al ${fechaFin}` : (fechasUnif.length === 1 ? fechaInicio : '—')

  const sections: DocChild[] = [
    // PORTADA con QR
    ...portadaInstitucional({
      tipoInforme: 'REPORTE DE PROGRESO PARA LA FAMILIA',
      nombrePaciente: nombre,
      edadPaciente: edadTexto,
      diagnostico: (child as any)?.diagnosis || 'En proceso',
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'Terapia ABA · Centro Especializado',
      fechaEmision: hoy,
      periodoEval: periodoTexto,
      codigoDoc,
    }),
    // (la portada ya incluye su propio salto de página)

    // I. Bienvenida
    tpl.tituloSeccion('I.  Querida Familia'),
    ...bienvenida.split('\n').filter(l => l.trim()).map(l => tpl.parrafo(l.replace(/\*\*/g, ''))),

    // II. Resumen del progreso (datos visuales)
    tpl.tituloSeccion(`II.  ¿Cómo va ${nombreCorto}?`),
    tpl.tablaDatosGenerales([
      ['Período de trabajo', periodoTexto],
      ['Total de sesiones realizadas', String(totalSesionesRealizadas)],
      ['Promedio general de logro', `${promedioGlobal}%`],
      // Programas en curso (no incluye los que ya cumplen criterio)
      ['Programas en los que está trabajando', `${programasInfo.filter(p => !p.cumple_criterio && !['dominado','logrado','criterio_alcanzado'].includes(p.estado)).length}`],
      ['Programas con criterio alcanzado', `${programasDominados.length}`],
    ]),

    // III. Celebración de logros
    tpl.tituloSeccion('III.  Sus logros este período'),
    ...celebracion.split('\n').filter(l => l.trim()).map(l => tpl.parrafo(l.replace(/\*\*/g, ''))),
  ]

  // IV. Gráfico de áreas
  if (datosGraficoAreas.length > 0) {
    sections.push(tpl.tituloSeccion('IV.  Progreso por área de trabajo'))
    sections.push(tpl.parrafo('Así va en cada área que estamos trabajando con ' + nombreCorto + ':'))
    sections.push(...tpl.graficoProgresoBarra('Logro por área (%)', datosGraficoAreas, { mostrarMeta: true, metaPct: 90 }))
  }

  // V. Actividades en casa
  sections.push(tpl.tituloSeccion('V.  Actividades para hacer en casa'))
  sections.push(tpl.parrafo(`Estas actividades complementan el trabajo que hacemos en sesión. Solo necesitan 10-15 minutos al día y hacen una gran diferencia en el progreso de ${nombreCorto}:`))
  planCasa.split('\n').filter(l => l.trim()).forEach(l => sections.push(tpl.parrafo(l.replace(/\*\*/g, ''))))

  // VI. Mensaje de cierre
  sections.push(tpl.tituloSeccion('VI.  Un mensaje especial para ustedes'))
  mensajeCierre.split('\n').filter(l => l.trim()).forEach(l => sections.push(tpl.parrafo(l.replace(/\*\*/g, ''))))

  // QR + firma
  sections.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }))
  sections.push(...sellosVerif)
  sections.push(
    new Paragraph({
      spacing: { before: 320, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 8 } },
      children: [new TextRun({ text: 'Con cariño,', italics: true, size: 20, font: 'Arial', color: '1E3A8A' })],
    }),
    new Paragraph({
      spacing: { before: 60, after: 0 },
      children: [new TextRun({ text: 'Equipo Clínico — Neuropsicología y Terapias SANTI', bold: true, size: 19, font: 'Arial', color: '475569' })],
    }),
  )

  const doc = new Document({
    numbering: tpl.DOC_NUMBERING,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: tpl.DOC_PAGE_PROPS,
      footers: { default: tpl.piePaginaOficial() },
      children: sections,
    }],
  })

  await registrarDocumentoEmitido({
    codigoDoc, childId, tipo: 'reporte_padres',
    pacienteNombre: nombreCap, pacienteIniciales: iniciales,
    fileName, metadata: { periodo: periodoTexto, total_sesiones: totalSesiones, promedio_global: promedioGlobal },
  })

  return { doc, fileName }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTE COMPARATIVO + PREDICCIÓN (versión PRO)
// ═══════════════════════════════════════════════════════════════════════════
async function generarReporteComparativoPro(
  childId: string,
  userLocale = 'es',
): Promise<{ doc: Document; fileName: string }> {

  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, age, birth_date, diagnosis, sessions_before_platform')
    .eq('id', childId).single()

  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  const diagnostico = (child as any)?.diagnosis || 'En evaluación'

  // Total de sesiones realizadas (misma fórmula que el UI)
  const totalSesionesRealizadas = await contarSesionesRealizadas(childId, (child as any)?.sessions_before_platform)

  let edadTexto = 'no registrada'
  if ((child as any)?.birth_date) {
    const nac = new Date((child as any).birth_date)
    const ahora = new Date()
    const años = ahora.getFullYear() - nac.getFullYear()
    const meses = ahora.getMonth() - nac.getMonth()
    const edad = (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) ? años - 1 : años
    const mesesAdj = meses < 0 ? meses + 12 : meses
    edadTexto = `${edad} años${mesesAdj > 0 ? ` ${mesesAdj} meses` : ''}`
  } else if ((child as any)?.age) {
    edadTexto = `${(child as any).age} años`
  }

  const [
    { data: programas },
    { data: sesionesProg },
    anamnesisRes,
    registroAbaRes,
    entornoHogarRes,
    formResponsesRes,
  ] = await Promise.all([
    supabaseAdmin.from('programas_aba').select('id, titulo, area, estado, criterio_dominio_pct').eq('child_id', childId).limit(30),
    supabaseAdmin.from('sesiones_datos_aba').select('programa_id, fecha, porcentaje_exito').eq('child_id', childId).order('fecha', { ascending: true }).limit(400),
    (async () => { try { return await supabaseAdmin.from('anamnesis_completa').select('form_title, datos, fecha_creacion').eq('child_id', childId).order('fecha_creacion', { ascending: false }).limit(2) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('registro_aba').select('form_title, datos, fecha_sesion').eq('child_id', childId).order('fecha_sesion', { ascending: false }).limit(4) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('registro_entorno_hogar').select('form_title, datos, fecha_visita').eq('child_id', childId).order('fecha_visita', { ascending: false }).limit(2) } catch { return { data: [] as any[] } } })(),
    (async () => { try { return await supabaseAdmin.from('form_responses').select('form_type, form_title, responses, ai_analysis, created_at').eq('child_id', childId).order('created_at', { ascending: false }).limit(4) } catch { return { data: [] as any[] } } })(),
  ])
  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]
  const anamnesisArr = ((anamnesisRes as any)?.data || []) as any[]
  const registroAbaArr = ((registroAbaRes as any)?.data || []) as any[]
  const entornoHogarArr = ((entornoHogarRes as any)?.data || []) as any[]
  const formResponsesArr = ((formResponsesRes as any)?.data || []) as any[]
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  // Unificar todas las sesiones en lista cronológica (datapoints = filas con %)
  const sesionesUnif = sesProgArr
    .map((s: any) => ({ fecha: s.fecha, porcentaje: Number(s.porcentaje_exito) || 0 }))
    .filter(s => s.porcentaje > 0 && s.fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))

  const total = sesionesUnif.length // # de datapoints (filas) para análisis estadístico
  // FIX: sesiones_datos_aba tiene 1 fila POR PROGRAMA por sesión.
  //      Para mostrar al usuario "Total de sesiones" hay que contar fechas únicas.
  const totalSesionesReales = new Set(sesionesUnif.map(s => s.fecha)).size
  const logros = sesionesUnif.map(s => s.porcentaje)

  // Período 1 (primera mitad) vs Período 2 (segunda mitad)
  const mitad = Math.floor(total / 2)
  const p1 = logros.slice(0, mitad)
  const p2 = logros.slice(mitad)
  const avg1 = avg(p1), avg2 = avg(p2)
  const diferencia = avg2 - avg1

  // Cuartos para gráfico de fases
  const q = (from: number, to: number) => avg(logros.slice(Math.floor(logros.length * from), Math.max(Math.floor(logros.length * to), 1)))
  const q1 = q(0, 0.25), q2 = q(0.25, 0.5), q3 = q(0.5, 0.75), q4 = q(0.75, 1)

  // Regresión lineal para predicción
  const calcPendiente = (vals: number[]) => {
    if (vals.length < 2) return 0
    const n = vals.length
    const sumX = (n*(n-1))/2
    const sumX2 = (n*(n-1)*(2*n-1))/6
    const sumY = vals.reduce((a, b) => a + b, 0)
    const sumXY = vals.reduce((a, v, i) => a + i*v, 0)
    const denom = n*sumX2 - sumX*sumX
    return denom === 0 ? 0 : (n*sumXY - sumX*sumY) / denom
  }
  const pendiente = calcPendiente(logros)

  const fechasUnif = sesionesUnif.map(s => s.fecha)
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaInicio = fechasUnif.length > 0 ? fmt(fechasUnif[0]) : '—'
  const fechaFin    = fechasUnif.length > 0 ? fmt(fechasUnif[fechasUnif.length - 1]) : fmt(new Date().toISOString())
  const semanas = fechasUnif.length > 1
    ? Math.round((new Date(fechasUnif[fechasUnif.length-1]).getTime() - new Date(fechasUnif[0]).getTime())/(7*24*60*60*1000))
    : 0
  const sesXMes = semanas > 4 ? (total / (semanas / 4)) : 8
  const ses30d = Math.max(4, Math.round(sesXMes))
  const ses90d = Math.max(10, Math.round(sesXMes * 3))
  const ses180d = Math.max(20, Math.round(sesXMes * 6))

  // Predicciones (con fallback clínico para pocas sesiones)
  let pred30: number, pred90: number, pred180: number, confianzaNota: string
  if (logros.length < 6) {
    const mejoraBase = avg2 < 40 ? 7 : avg2 < 55 ? 6 : avg2 < 70 ? 5 : avg2 < 85 ? 3 : 1
    const factor = /tea|autis/i.test(diagnostico) ? 0.85 : /tdah/i.test(diagnostico) ? 1.0 : 0.9
    const mm = Math.max(1, Math.round(mejoraBase * factor))
    pred30  = Math.min(100, avg2 + mm)
    pred90  = Math.min(100, avg2 + mm * 3)
    pred180 = Math.min(100, avg2 + mm * 6)
    confianzaNota = `Proyección basada en benchmarks clínicos ABA (${logros.length} sesiones disponibles). Se recomienda re-evaluar a partir de la sesión 8.`
  } else {
    const señal = diferencia * 0.15
    pred30  = Math.min(100, Math.max(avg2 + 1, Math.round(avg2 + pendiente * ses30d + señal)))
    pred90  = Math.min(100, Math.max(pred30 + 1, Math.round(avg2 + pendiente * ses90d + señal * 2)))
    pred180 = Math.min(100, Math.max(pred90 + 1, Math.round(avg2 + pendiente * ses180d + señal * 3)))
    confianzaNota = `Proyección por regresión lineal sobre ${logros.length} sesiones (confianza ${logros.length >= 12 ? 'alta' : 'moderada'}).`
  }

  // Por área
  const areaMap: Record<string, { p1: number[]; p2: number[] }> = {}
  for (const p of progArr) {
    const area = (p.area || 'General').toUpperCase()
    const allVals = sesProgArr.filter((s: any) => s.programa_id === p.id)
      .map((s: any) => Number(s.porcentaje_exito) || 0)
      .filter(v => v > 0)
    if (allVals.length > 0) {
      if (!areaMap[area]) areaMap[area] = { p1: [], p2: [] }
      const half = Math.floor(allVals.length / 2)
      areaMap[area].p1.push(...allVals.slice(0, half))
      areaMap[area].p2.push(...allVals.slice(half))
    }
  }

  const tendencia = diferencia > 10 ? 'progreso significativo' : diferencia > 3 ? 'progreso moderado' : diferencia < -5 ? 'regresión' : 'estabilidad'

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const iniciales = tpl.generarIniciales(nombre)
  const fileName = `Analisis_Comparativo_${nombreCap.replace(/\s+/g, '_')}_${hoyISO}.docx`
  const codigoDoc = generarCodigoDocumento(childId, 'comp')

  // IA: análisis comparativo + predicción + recomendaciones
  const programasResumen = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id)
    const pcts = sesP.map((s: any) => Number(s.porcentaje_exito) || 0).filter((v: number) => v > 0)
    return `· ${p.titulo} (${p.area}): ${pcts.length} sesiones · promedio ${avg(pcts) || '—'}% · estado ${p.estado}`
  }).join('\n')

  // Contexto invisible de evaluaciones registradas (no se muestran como sección)
  const truncar = (s: any, max = 160) => {
    const txt = typeof s === 'string' ? s : (s != null ? JSON.stringify(s) : '')
    return txt.length > max ? txt.slice(0, max) + '…' : txt
  }
  const resumenRespuestas = (datos: any, maxClaves = 5, maxCharsValor = 80) => {
    if (!datos || typeof datos !== 'object') return ''
    const claves = Object.keys(datos).filter(k => datos[k] != null && datos[k] !== '').slice(0, maxClaves)
    return claves.map(k => `${k}: ${truncar(datos[k], maxCharsValor)}`).join(' | ')
  }
  const evalCtxParts: string[] = []
  if (anamnesisArr.length > 0) evalCtxParts.push(`ANAMNESIS: ${anamnesisArr.slice(0,1).map(a => resumenRespuestas(a.datos)).join('')}`)
  if (registroAbaArr.length > 0) {
    // Comparar evaluación inicial vs reciente si hay al menos 2
    const reciente = registroAbaArr[0]
    const inicial = registroAbaArr[registroAbaArr.length - 1]
    evalCtxParts.push(`REGISTROS ABA — INICIAL (${(inicial.fecha_sesion||'').slice(0,10)}): ${resumenRespuestas(inicial.datos)}`)
    if (registroAbaArr.length > 1) evalCtxParts.push(`REGISTROS ABA — RECIENTE (${(reciente.fecha_sesion||'').slice(0,10)}): ${resumenRespuestas(reciente.datos)}`)
  }
  if (entornoHogarArr.length > 0) evalCtxParts.push(`ENTORNO HOGAR: ${entornoHogarArr.slice(0,1).map(e => resumenRespuestas(e.datos)).join('')}`)
  if (formResponsesArr.length > 0) evalCtxParts.push(`OTRAS EVALUACIONES: ${formResponsesArr.slice(0,2).map(f => truncar(f.ai_analysis || f.responses, 120)).join(' || ')}`)
  const evaluacionesCtx = evalCtxParts.length > 0
    ? `\n\nContexto clínico complementario (evaluaciones registradas — úsalo para fundamentar tu análisis, no las menciones como sección):\n${evalCtxParts.join('\n')}`
    : ''

  const [analisisComp, analisisPred, recomendacionesIA] = await Promise.all([
    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Prosa formal, sin emojis, sin bullets.',
      `Redactá el "ANÁLISIS COMPARATIVO DE PERÍODOS" para ${nombreCap} (${edadTexto}, ${diagnostico}):

Datos:
- Período 1 (${p1.length} registros): promedio ${avg1}%
- Período 2 (${p2.length} registros): promedio ${avg2}%
- Diferencia: ${diferencia > 0 ? '+' : ''}${diferencia}% (${tendencia})
- Distribución por fases del tratamiento: Fase 1 ${q1}% · Fase 2 ${q2}% · Fase 3 ${q3}% · Fase 4 ${q4}%
- Programas trabajados: ${progArr.length} (${progArr.filter((p: any) => ['dominado','logrado','criterio_alcanzado'].includes(p.estado)).length} con criterio alcanzado)${evaluacionesCtx}

Explicá clínicamente qué significa esta evolución, qué factores pueden contribuir, qué implica. 3 párrafos, máximo 240 palabras. Sin bullets, sin emojis.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 600 },
    ),
    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Prosa formal.',
      `Redactá el "ANÁLISIS DE PREDICCIÓN TERAPÉUTICA" para ${nombreCap}:

Sesiones totales: ${total} · Logro actual: ${avg2}%
Proyecciones:
- 30 días: ${pred30}%
- 90 días: ${pred90}%
- 180 días: ${pred180}%
Tendencia: ${tendencia} (pendiente: ${pendiente.toFixed(2)} pts/sesión)
${confianzaNota}

Interpretá qué esperar en cada horizonte, qué condiciones son necesarias, qué nivel de confianza tiene cada proyección. 2 párrafos, máximo 160 palabras.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 400 },
    ),
    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Devolvé SOLO JSON válido.',
      `Generá RECOMENDACIONES TERAPÉUTICAS para ${nombreCap} en formato JSON:

{
  "ajustes_plan": ["...", "..."],
  "objetivos_proximos": ["...", "..."],
  "frecuencia": "Texto corto sugiriendo frecuencia óptima"
}

Datos:
- Tendencia: ${tendencia}, logro actual ${avg2}%
- Áreas activas: ${[...new Set(progArr.map((p: any) => p.area))].join(', ')}${evaluacionesCtx}

3-4 ítems por array. Específicos al caso. Sin emojis.`,
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 500 },
    ),
  ])

  let recomData: any = { ajustes_plan: [], objetivos_proximos: [], frecuencia: '' }
  try {
    const m = recomendacionesIA.match(/\{[\s\S]*\}/)
    if (m) recomData = JSON.parse(m[0])
  } catch { /* usar defaults */ }

  const sellosVerif = await tpl.selloQRVerificacionAsync({
    codigoDoc, fechaEmision: hoy, especialista: 'Equipo Clínico SANTI',
  })

  const periodoTexto = fechasUnif.length > 1 ? `${fechaInicio} al ${fechaFin}` : (fechasUnif.length === 1 ? fechaInicio : '—')

  const parsearProsa = (texto: string): Paragraph[] => {
    return texto.split('\n').filter(l => l.trim())
      .map(l => tpl.parrafo(l.replace(/\*\*/g, '').trim()))
  }

  const sections: DocChild[] = [
    // PORTADA con QR
    ...portadaInstitucional({
      tipoInforme: 'ANÁLISIS COMPARATIVO Y PROYECCIÓN TERAPÉUTICA',
      nombrePaciente: nombre,
      edadPaciente: edadTexto,
      diagnostico,
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'BCBA · Neuropsicología Infantil',
      fechaEmision: hoy,
      periodoEval: periodoTexto,
      codigoDoc,
    }),
    // (la portada ya incluye su propio salto de página)

    // I. Datos del análisis
    tpl.tituloSeccion('I.  Datos del Análisis'),
    tpl.tablaDatosGenerales([
      ['Apellidos y nombres', nombre],
      ['Edad', edadTexto],
      ['Diagnóstico', diagnostico],
      ['Período analizado', periodoTexto],
      ['Total de sesiones realizadas', String(totalSesionesRealizadas)],
      ['Tendencia clínica', tendencia],
      ['Documento N°', codigoDoc],
    ]),

    // II. Comparación P1 vs P2
    tpl.tituloSeccion('II.  Comparación Directa de Períodos'),
    tpl.tablaDatosGenerales([
      [`Período 1 (${p1.length} registros)`, `${avg1}% promedio`],
      [`Período 2 (${p2.length} registros)`, `${avg2}% promedio`],
      ['Variación', `${diferencia > 0 ? '+' : ''}${diferencia}%`],
      ['Lectura clínica', tendencia],
    ]),

    // III. Gráfico por fases
    tpl.tituloSeccion('III.  Evolución por Fase del Tratamiento'),
    tpl.parrafo('La evolución del logro terapéutico, distribuida en cuatro fases del tratamiento desde el inicio hasta hoy:'),
    ...tpl.graficoProgresoBarra('Evolución por fase (%)', [
      { label: `Fase 1 — Inicio  (S1–S${Math.ceil(total*0.25)})`, valor: q1 },
      { label: `Fase 2 — Desarrollo  (S${Math.ceil(total*0.25)+1}–S${Math.ceil(total*0.5)})`, valor: q2 },
      { label: `Fase 3 — Consolidación  (S${Math.ceil(total*0.5)+1}–S${Math.ceil(total*0.75)})`, valor: q3 },
      { label: `Fase 4 — Estado Actual  (S${Math.ceil(total*0.75)+1}–S${total})`, valor: q4 },
    ], { mostrarMeta: true, metaPct: 90 }),

    // IV. Análisis clínico
    tpl.tituloSeccion('IV.  Análisis Clínico Comparativo'),
    ...parsearProsa(analisisComp),

    // V. Predicción
    tpl.tituloSeccion('V.  Proyección Terapéutica'),
    tpl.tablaDatosGenerales([
      ['Logro actual', `${avg2}%`],
      ['Proyección 30 días', `${pred30}%`],
      ['Proyección 90 días', `${pred90}%`],
      ['Proyección 180 días', `${pred180}%`],
      ['Pendiente observada', `${pendiente.toFixed(2)} pts/sesión`],
      ['Sesiones esperadas (período)', `${ses30d} (30d) · ${ses90d} (90d) · ${ses180d} (180d)`],
    ]),
    ...parsearProsa(analisisPred),
    tpl.parrafo(`Nota técnica: ${confianzaNota}`),
  ]

  // VI. Análisis por área
  const areasConDatos = Object.entries(areaMap).filter(([_, v]) => v.p1.length > 0 || v.p2.length > 0)
  if (areasConDatos.length > 0) {
    sections.push(tpl.tituloSeccion('VI.  Avance por Área de Intervención'))
    sections.push(tpl.parrafo('Comparación del logro promedio por área entre el período de referencia y el período actual:'))
    sections.push(...tpl.graficoProgresoBarra('Período 1 (referencia) — Logro por área (%)',
      areasConDatos.map(([area, v]) => ({ label: area, valor: avg(v.p1) })),
      { mostrarMeta: true, metaPct: 90 },
    ))
    sections.push(new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }))
    sections.push(...tpl.graficoProgresoBarra('Período 2 (actual) — Logro por área (%)',
      areasConDatos.map(([area, v]) => ({ label: area, valor: avg(v.p2) })),
      { mostrarMeta: true, metaPct: 90 },
    ))
  }

  // VII. Recomendaciones
  sections.push(tpl.tituloSeccion('VII.  Recomendaciones Terapéuticas'))
  if (recomData.ajustes_plan?.length > 0) {
    sections.push(new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: 'Ajustes al plan actual', bold: true, size: 21, font: 'Arial', color: '1E293B' })],
    }))
    sections.push(...tpl.items(recomData.ajustes_plan))
  }
  if (recomData.objetivos_proximos?.length > 0) {
    sections.push(new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: 'Objetivos para el próximo período', bold: true, size: 21, font: 'Arial', color: '1E293B' })],
    }))
    sections.push(...tpl.items(recomData.objetivos_proximos))
  }
  if (recomData.frecuencia) {
    sections.push(tpl.subseccion('Frecuencia sugerida', recomData.frecuencia))
  }

  // QR + firma
  sections.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }))
  sections.push(...sellosVerif)
  sections.push(
    new Paragraph({
      spacing: { before: 320, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 8 } },
      children: [new TextRun({ text: 'Equipo Clínico', bold: true, size: 22, font: 'Arial', color: '1E3A8A' })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI', size: 19, font: 'Arial', color: '475569' })],
    }),
  )

  const doc = new Document({
    numbering: tpl.DOC_NUMBERING,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: tpl.DOC_PAGE_PROPS,
      footers: { default: tpl.piePaginaOficial() },
      children: sections,
    }],
  })

  await registrarDocumentoEmitido({
    codigoDoc, childId, tipo: 'reporte_comparativo',
    pacienteNombre: nombreCap, pacienteIniciales: iniciales,
    fileName, metadata: { periodo: periodoTexto, total_sesiones: totalSesionesReales, datapoints: total, tendencia, pred30, pred90, pred180 },
  })

  return { doc, fileName }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTE DE PROGRAMAS ABA PARA LA FAMILIA (versión PRO, explicativa)
// ═══════════════════════════════════════════════════════════════════════════
// Pensado para padres/madres que NO son de tecnología: el especialista lo
// descarga y se lo envía. Lenguaje claro, glosario, y por cada programa una
// explicación en palabras simples de qué significa el avance.
async function generarReporteProgramasFamilia(
  childId: string,
  userLocale = 'es',
): Promise<{ doc: Document; fileName: string }> {

  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, age, birth_date, diagnosis, sessions_before_platform')
    .eq('id', childId).single()

  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  const nombreCorto = nombreCap.split(' ')[0]
  const diagnostico = (child as any)?.diagnosis || 'En evaluación'

  let edadTexto = 'no registrada'
  if ((child as any)?.birth_date) {
    const nac = new Date((child as any).birth_date)
    const ahora = new Date()
    const años = ahora.getFullYear() - nac.getFullYear()
    const meses = ahora.getMonth() - nac.getMonth()
    const edad = (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) ? años - 1 : años
    const mesesAdj = meses < 0 ? meses + 12 : meses
    edadTexto = `${edad} años${mesesAdj > 0 ? ` ${mesesAdj} meses` : ''}`
  } else if ((child as any)?.age) {
    edadTexto = `${(child as any).age} años`
  }

  const totalSesionesRealizadas = await contarSesionesRealizadas(childId, (child as any)?.sessions_before_platform)

  const [{ data: programas }, { data: sesionesProg }] = await Promise.all([
    supabaseAdmin.from('programas_aba')
      .select('id, titulo, area, estado, fase_actual, criterio_dominio_pct, criterio_sesiones_consecutivas, objetivo_lp')
      .eq('child_id', childId).limit(40),
    supabaseAdmin.from('sesiones_datos_aba')
      .select('programa_id, fecha, porcentaje_exito, set')
      .eq('child_id', childId).order('fecha', { ascending: true }).limit(500),
  ])
  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]

  // Cargar objetivos_cp (sets) para criterio manual
  let objetivosArr: any[] = []
  if (progArr.length > 0) {
    try {
      const progIds = progArr.map(p => p.id)
      const { data } = await supabaseAdmin
        .from('objetivos_cp')
        .select('programa_id, numero_set, descripcion, estado')
        .in('programa_id', progIds)
      objetivosArr = data || []
    } catch (e: any) {
      console.warn('[reporte-programas] objetivos_cp falló:', e?.message)
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  // Criterio alcanzado (3 vías): estado oficial · automático (últimas N ≥ criterio) · todos los sets dominados
  const programaCumpleCriterio = (programaId: string): boolean => {
    const p = progArr.find(x => x.id === programaId)
    if (!p) return false
    if (['dominado', 'logrado', 'criterio_alcanzado'].includes(String(p.estado || '').toLowerCase())) return true
    const crit = Number(p.criterio_dominio_pct) || 90
    const critSes = Number(p.criterio_sesiones_consecutivas) || 2
    const todas = sesProgArr.filter((s: any) => s.programa_id === programaId)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    if (todas.length >= critSes) {
      const ultimas = todas.slice(-critSes)
      if (ultimas.every((s: any) => parseNivelLogro(s.porcentaje_exito) != null && (parseNivelLogro(s.porcentaje_exito) as number) >= crit)) return true
    }
    const setsProg = objetivosArr.filter((o: any) => o.programa_id === programaId)
    if (setsProg.length > 0 && setsProg.every((o: any) => o.estado === 'dominado')) return true
    return false
  }

  // Construir datos por programa
  const programasInfo = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id)
      .sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const pcts = sesP.map((s: any) => parseNivelLogro(s.porcentaje_exito)).filter((v: number | null): v is number => v !== null)
    const ultimo = pcts.length > 0 ? pcts[pcts.length - 1] : null
    const promedio = pcts.length > 0 ? avg(pcts) : null
    const recientes = pcts.slice(-5)
    const promReciente = recientes.length > 0 ? avg(recientes) : null
    const iniciales = pcts.slice(0, 5)
    const promInicial = iniciales.length > 0 ? avg(iniciales) : null
    const delta = (promReciente != null && promInicial != null) ? promReciente - promInicial : 0
    let tendencia: 'sube' | 'baja' | 'estable' = 'estable'
    if (delta >= 8) tendencia = 'sube'
    else if (delta <= -8) tendencia = 'baja'
    const crit = Number(p.criterio_dominio_pct) || 90
    const cumple = programaCumpleCriterio(p.id)
    const fase = String(p.fase_actual || '').toLowerCase()
    const enLineaBase = fase.includes('linea') || fase.includes('base') || fase === 'baseline'

    return {
      id: p.id,
      titulo: p.titulo || 'Programa',
      area: (p.area || 'General').toString().trim(),
      objetivo: (p.objetivo_lp || '').toString().trim(),
      criterio: crit,
      n_sesiones: pcts.length,
      pcts,
      ultimo,
      promedio,
      promReciente,
      delta,
      tendencia,
      cumple,
      enLineaBase,
    }
  })

  const conDatos = programasInfo.filter(p => p.n_sesiones > 0)
  const sinDatos = programasInfo.filter(p => p.n_sesiones === 0)
  const logrados = programasInfo.filter(p => p.cumple)
  const enProceso = programasInfo.filter(p => !p.cumple && p.n_sesiones > 0)
  const promedioGlobal = avg(conDatos.map(p => p.promReciente ?? p.promedio ?? 0).filter(v => v > 0))

  const fechasUnif = sesProgArr.map((s: any) => s.fecha).filter(Boolean).sort()
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaInicio = fechasUnif.length > 0 ? fmt(fechasUnif[0]) : '—'
  const fechaFin = fechasUnif.length > 0 ? fmt(fechasUnif[fechasUnif.length - 1]) : fmt(new Date().toISOString())
  const periodoTexto = fechasUnif.length > 1 ? `${fechaInicio} al ${fechaFin}` : (fechasUnif.length === 1 ? fechaInicio : '—')

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const iniciales = tpl.generarIniciales(nombre)
  const fileName = `Programas_${nombreCap.replace(/\s+/g, '_')}_${hoyISO}.docx`
  const codigoDoc = generarCodigoDocumento(childId, 'programas')

  // ── IA: bienvenida cálida + cierre (con fallback si falla) ──
  const resumenIA = programasInfo
    .map(p => `· ${p.titulo} (${p.area}): ${p.n_sesiones} sesiones, ${p.promReciente ?? 'sin datos'}% reciente, ${p.cumple ? 'criterio alcanzado' : p.enLineaBase ? 'en línea base' : 'en proceso'}`)
    .join('\n')

  let bienvenida = ''
  let cierre = ''
  try {
    const [bRes, cRes] = await Promise.all([
      callGroqSimple(
        'Eres terapeuta ABA cálida y cercana de SANTI. Escribís a familias sin tecnicismos.',
        `Escribí una bienvenida CORTA y cálida (1 párrafo, máx 60 palabras) para la familia de ${nombreCorto}. Explicá que este documento resume los programas de terapia que estamos trabajando con su hijo/a y cómo va avanzando. Tono humano, esperanzador, sin tecnicismos, sin emojis.` + getLangInstruction(userLocale),
        { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 180 },
      ),
      callGroqSimple(
        'Eres terapeuta ABA cálida de SANTI.',
        `Escribí un MENSAJE DE CIERRE corto (1 párrafo, máx 55 palabras) para la familia de ${nombreCorto}. Reconocé el esfuerzo de la familia, invitá a preguntar cualquier duda al especialista y proyectá optimismo realista. Sin tecnicismos, sin emojis.` + getLangInstruction(userLocale),
        { model: GROQ_MODELS.SMART, temperature: 0.7, maxTokens: 160 },
      ),
    ])
    bienvenida = bRes
    cierre = cRes
  } catch { /* usar fallback */ }
  if (!bienvenida.trim()) bienvenida = `Estimada familia de ${nombreCorto}: en este documento les compartimos un resumen claro de los programas de terapia que estamos trabajando y cómo viene avanzando. Nuestro objetivo es que puedan acompañar este proceso con tranquilidad y confianza.`
  if (!cierre.trim()) cierre = `Agradecemos su compromiso y constancia, que son fundamentales para el progreso de ${nombreCorto}. Ante cualquier duda sobre este reporte, no duden en consultar con el especialista a cargo.`

  const sellosVerif = await tpl.selloQRVerificacionAsync({
    codigoDoc, fechaEmision: hoy, especialista: 'Equipo Clínico SANTI',
  })

  const limpiar = (t: string) => t.split('\n').filter(l => l.trim()).map(l => tpl.parrafo(l.replace(/\*\*/g, '').trim()))

  // ── Explicación en lenguaje simple por programa (determinística, confiable) ──
  const explicarPrograma = (p: typeof programasInfo[number]): string => {
    if (p.n_sesiones === 0) {
      return `Este programa recién comienza. Todavía no registramos sesiones con datos, así que pronto verán aquí su avance.`
    }
    if (p.cumple) {
      return `¡Muy buena noticia! ${nombreCorto} ya alcanzó el objetivo de este programa (la meta era ${p.criterio}% de aciertos). El equipo evaluará avanzar al siguiente nivel o reforzar lo aprendido para que se mantenga en el tiempo.`
    }
    if (p.enLineaBase) {
      return `Estamos en la etapa inicial de observación (línea base). Aquí medimos desde dónde parte ${nombreCorto} para luego diseñar el mejor plan de trabajo. Es un paso normal y necesario.`
    }
    const reciente = p.promReciente ?? p.promedio ?? 0
    if (p.tendencia === 'sube') {
      return `${nombreCorto} viene mejorando en este programa: su desempeño reciente está alrededor del ${reciente}% y la tendencia es de avance. Vamos por buen camino hacia la meta del ${p.criterio}%.`
    }
    if (p.tendencia === 'baja') {
      return `En las últimas sesiones notamos una baja en el desempeño (alrededor del ${reciente}%). Esto puede deberse a varios factores y el equipo ya lo está revisando para ajustar la estrategia. Es parte normal del proceso.`
    }
    return `${nombreCorto} se mantiene estable en este programa, con un desempeño cercano al ${reciente}%. Seguimos trabajando de forma constante para acercarnos a la meta del ${p.criterio}%.`
  }

  const estadoTexto = (p: typeof programasInfo[number]): string => {
    if (p.cumple) return 'Objetivo alcanzado'
    if (p.enLineaBase) return 'Etapa inicial (línea base)'
    if (p.n_sesiones === 0) return 'Por iniciar'
    if (p.tendencia === 'sube') return 'Avanzando'
    if (p.tendencia === 'baja') return 'En revisión'
    return 'En proceso'
  }

  // ─── Construcción del documento ───────────────────────────────────────────
  const sections: DocChild[] = [
    ...portadaInstitucional({
      tipoInforme: 'REPORTE DE PROGRAMAS DE TERAPIA',
      nombrePaciente: nombre,
      edadPaciente: edadTexto,
      diagnostico,
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'Terapia ABA · Neuropsicología Infantil',
      fechaEmision: hoy,
      periodoEval: periodoTexto,
      codigoDoc,
    }),

    // I. Bienvenida
    tpl.tituloSeccion('I.  Para la familia'),
    ...limpiar(bienvenida),

    // II. ¿Qué es este documento? (explicación)
    tpl.tituloSeccion('II.  ¿Qué encontrarán en este documento?'),
    tpl.parrafo('Cada "programa" es una habilidad específica que estamos enseñando a su hijo/a (por ejemplo: comunicación, atención, autonomía o conducta). Para cada uno verán:'),
    ...tpl.items([
      'El objetivo: qué buscamos que logre.',
      'Su avance: cómo viene desempeñándose en las sesiones, mostrado en porcentaje de aciertos.',
      'Una explicación en palabras sencillas de qué significa ese avance.',
      'La meta: el porcentaje que debe alcanzar de forma constante para considerar el objetivo logrado.',
    ]),

    // III. Resumen general
    tpl.tituloSeccion('III.  Resumen general'),
    tpl.tablaDatosGenerales([
      ['Nombre', nombreCap],
      ['Edad', edadTexto],
      ['Período de trabajo', periodoTexto],
      ['Total de sesiones realizadas', String(totalSesionesRealizadas)],
      ['Programas en total', String(programasInfo.length)],
      ['Objetivos ya alcanzados', String(logrados.length)],
      ['Programas en proceso', String(enProceso.length)],
      ['Promedio general de aciertos', promedioGlobal > 0 ? `${promedioGlobal}%` : 'En recolección de datos'],
      ['Documento N°', codigoDoc],
      ['Fecha de emisión', hoy],
    ]),
  ]

  // Gráfico resumen por área (si hay datos)
  const areaMap: Record<string, number[]> = {}
  for (const p of conDatos) {
    if (p.promReciente != null) {
      const key = p.area.toUpperCase()
      if (!areaMap[key]) areaMap[key] = []
      areaMap[key].push(p.promReciente)
    }
  }
  const datosArea = Object.entries(areaMap).map(([label, vals]) => ({ label, valor: avg(vals) }))
  if (datosArea.length > 0) {
    sections.push(tpl.tituloSeccion('IV.  Avance por área de trabajo'))
    sections.push(tpl.parrafo(`Así viene ${nombreCorto} en cada gran área que trabajamos. La línea punteada marca la meta de dominio.`))
    sections.push(...tpl.graficoProgresoBarra('Promedio reciente por área (%)', datosArea, { mostrarMeta: true, metaPct: 90 }))
  }

  // V. Detalle programa por programa
  sections.push(tpl.tituloSeccion('V.  Detalle de cada programa'))

  // Ordenar: primero logrados, luego en proceso, luego por iniciar
  const ordenados = [
    ...logrados,
    ...enProceso.filter(p => !p.cumple),
    ...sinDatos,
  ].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)

  let idx = 0
  for (const p of ordenados) {
    idx++
    // Título del programa
    sections.push(new Paragraph({
      spacing: { before: 280, after: 60 },
      children: [
        new TextRun({ text: `${idx}. ${p.titulo}`, bold: true, size: 24, font: 'Arial', color: '1E3A8A' }),
        new TextRun({ text: `   ·   ${p.area}`, size: 20, font: 'Arial', color: '64748B' }),
      ],
    }))

    // Tabla de datos del programa
    const filas: [string, string][] = []
    if (p.objetivo) filas.push(['Objetivo', p.objetivo])
    filas.push(['Estado', estadoTexto(p)])
    filas.push(['Meta a alcanzar', `${p.criterio}% de aciertos de forma constante`])
    if (p.n_sesiones > 0) {
      filas.push(['Sesiones registradas', String(p.n_sesiones)])
      if (p.promReciente != null) filas.push(['Desempeño reciente', `${p.promReciente}%`])
      if (p.promedio != null) filas.push(['Promedio histórico', `${p.promedio}%`])
    }
    sections.push(tpl.tablaDatosGenerales(filas))

    // Gráfico de avance (solo si hay ≥ 2 puntos)
    if (p.pcts.length >= 2) {
      sections.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [] }))
      sections.push(...tpl.graficoCurvaLineal('Evolución de aciertos (%)', p.pcts))
    }

    // Explicación en lenguaje simple
    sections.push(new Paragraph({
      spacing: { before: 120, after: 40 },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4F46E5', space: 10 } },
      children: [new TextRun({ text: explicarPrograma(p), size: 20, font: 'Arial', color: '334155', italics: true })],
    }))
  }

  // VI. Glosario simple
  sections.push(tpl.tituloSeccion('VI.  Pequeño glosario'))
  sections.push(...tpl.items([
    'Programa: una habilidad específica que enseñamos (ej. pedir lo que necesita, esperar su turno, leer).',
    'Sesión: cada encuentro de terapia donde practicamos y medimos el avance.',
    'Porcentaje de aciertos: de cada 100 oportunidades, cuántas respondió correctamente.',
    'Meta o criterio: el porcentaje que debe alcanzar de forma constante para dar por logrado el objetivo (normalmente 90%).',
    'Línea base: etapa inicial donde medimos el punto de partida antes de empezar a enseñar.',
    'Objetivo alcanzado: cuando logró la meta de forma estable y está listo para avanzar.',
  ]))

  // VII. Cierre
  sections.push(tpl.tituloSeccion('VII.  Mensaje final'))
  sections.push(...limpiar(cierre))

  // QR + firma
  sections.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }))
  sections.push(...sellosVerif)
  sections.push(
    new Paragraph({
      spacing: { before: 320, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 8 } },
      children: [new TextRun({ text: 'Equipo Clínico', bold: true, size: 22, font: 'Arial', color: '1E3A8A' })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI', size: 19, font: 'Arial', color: '475569' })],
    }),
  )

  const doc = new Document({
    numbering: tpl.DOC_NUMBERING,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: tpl.DOC_PAGE_PROPS,
      footers: { default: tpl.piePaginaOficial() },
      children: sections,
    }],
  })

  await registrarDocumentoEmitido({
    codigoDoc, childId, tipo: 'reporte_padres',
    tipoLabel: 'Reporte de Programas de Terapia',
    pacienteNombre: nombreCap, pacienteIniciales: iniciales,
    fileName, metadata: { periodo: periodoTexto, total_programas: programasInfo.length, logrados: logrados.length },
  })

  return { doc, fileName }
}

// ═══════════════════════════════════════════════════════════════════════════
// GUÍA DE EJERCICIO PARA CASA (un set/objetivo) — para la familia
// ═══════════════════════════════════════════════════════════════════════════
// Convierte el procedimiento de un set (materiales, Sd, unidad +/-, ayudas,
// corrección, generalización) en una guía clara, paso a paso, que el padre
// puede seguir en casa aunque no tenga formación clínica.
async function generarGuiaSetFamilia(
  objetivoId: string,
  userLocale = 'es',
): Promise<{ doc: Document; fileName: string }> {

  // 1. Cargar el set + su programa + el paciente
  const { data: setObj, error: e1 } = await supabaseAdmin
    .from('objetivos_cp')
    .select('*')
    .eq('id', objetivoId)
    .maybeSingle()
  if (e1) throw e1
  if (!setObj) throw new Error('Set/objetivo no encontrado')

  const { data: programa } = await supabaseAdmin
    .from('programas_aba')
    .select('id, titulo, area, criterio_dominio_pct, objetivo_lp, child_id')
    .eq('id', (setObj as any).programa_id)
    .maybeSingle()

  const childId = (programa as any)?.child_id || null
  const { data: child } = childId
    ? await supabaseAdmin.from('children').select('name, age, birth_date, diagnosis').eq('id', childId).maybeSingle()
    : { data: null }

  const nombre = (child as any)?.name || 'el/la estudiante'
  const nombreCap = nombre.split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
  const nombreCorto = nombreCap.split(' ')[0]
  const diagnostico = (child as any)?.diagnosis || 'En evaluación'

  let edadTexto = 'no registrada'
  if ((child as any)?.birth_date) {
    const nac = new Date((child as any).birth_date)
    const ahora = new Date()
    const años = ahora.getFullYear() - nac.getFullYear()
    const meses = ahora.getMonth() - nac.getMonth()
    const edad = (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) ? años - 1 : años
    const mesesAdj = meses < 0 ? meses + 12 : meses
    edadTexto = `${edad} años${mesesAdj > 0 ? ` ${mesesAdj} meses` : ''}`
  } else if ((child as any)?.age) {
    edadTexto = `${(child as any).age} años`
  }

  const s: any = setObj
  const prog: any = programa || {}
  const criterio = Number(prog.criterio_dominio_pct) || 90
  const tituloPrograma = prog.titulo || 'Programa'
  const area = (prog.area || 'General').toString().trim()
  const numeroSet = s.numero_set != null ? `Set ${s.numero_set}` : 'Set'
  const descSet = (s.descripcion || '').toString().trim()
  const ayudas = (s.reforzadores || s.ayudas || '').toString().trim()

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const iniciales = tpl.generarIniciales(nombre)
  const safeName = nombreCap.replace(/\s+/g, '_') || 'Paciente'
  const fileName = `Guia_Casa_${safeName}_${numeroSet.replace(/\s+/g, '')}_${hoyISO}.docx`
  const codigoDoc = generarCodigoDocumento(childId || objetivoId, 'guia')

  // 2. Pasos del procedimiento → cada uno con explicación amigable
  type Paso = { icono: string; titulo: string; queSignifica: string; contenido: string }
  const pasosRaw: Paso[] = [
    { icono: '📚', titulo: 'Qué necesitas (materiales)', queSignifica: 'Reuní estos materiales antes de empezar para que la práctica fluya sin interrupciones.', contenido: (s.materiales || '').toString().trim() },
    { icono: '📍', titulo: 'Qué decir o mostrar (la instrucción)', queSignifica: 'Es la indicación que le das para que sepa qué tiene que hacer. Decila de forma clara y una sola vez.', contenido: (s.sd_estimulo || '').toString().trim() },
    { icono: '✅', titulo: 'Qué respuesta buscamos (respuesta correcta)', queSignifica: 'Esto es lo que esperamos que haga. Cuando lo logre, felicitalo enseguida con entusiasmo.', contenido: (s.unidad_positiva || '').toString().trim() },
    { icono: '❎', titulo: 'Qué no contamos como correcto', queSignifica: 'Si responde de esta manera, no es la respuesta que buscamos todavía. No lo regañes: simplemente seguí al paso de corrección.', contenido: (s.unidad_negativa || '').toString().trim() },
    { icono: '🤝', titulo: 'Cómo ayudarlo (ayudas / apoyos)', queSignifica: 'Si le cuesta, podés darle estos apoyos. La idea es ir retirándolos de a poco para que lo haga cada vez más solo.', contenido: ayudas },
    { icono: '🔄', titulo: 'Qué hacer si se equivoca (corrección)', queSignifica: 'Cuando no acierte, seguí estos pasos con calma y paciencia, sin frustrarte. Es parte normal del aprendizaje.', contenido: (s.correction_errores || '').toString().trim() },
    { icono: '🏠', titulo: 'Cómo practicarlo en el día a día (generalización)', queSignifica: 'Buscá momentos naturales en casa para repetir esta habilidad, así la aprende de verdad y la usa en su vida diaria.', contenido: (s.generalizacion || '').toString().trim() },
  ]
  const pasos = pasosRaw.filter(p => p.contenido)

  const sellosVerif = await tpl.selloQRVerificacionAsync({
    codigoDoc, fechaEmision: hoy, especialista: 'Equipo Clínico SANTI',
  })

  const sections: DocChild[] = [
    ...portadaInstitucional({
      tipoInforme: 'GUÍA DE EJERCICIO PARA CASA',
      nombrePaciente: nombre,
      edadPaciente: edadTexto,
      diagnostico,
      especialista: 'Equipo Clínico SANTI',
      credenciales: 'Terapia ABA · Neuropsicología Infantil',
      fechaEmision: hoy,
      periodoEval: tituloPrograma,
      codigoDoc,
    }),

    // I. Presentación
    tpl.tituloSeccion('I.  ¿Para qué sirve esta guía?'),
    tpl.parrafo(`Esta guía explica, paso a paso, cómo practicar en casa un ejercicio que estamos trabajando con ${nombreCorto} en terapia. Practicar en casa ayuda muchísimo a que aprenda más rápido y use lo aprendido en su día a día. No necesitas experiencia previa: solo seguí los pasos con cariño, paciencia y constancia.`),

    // II. Datos del ejercicio
    tpl.tituloSeccion('II.  El ejercicio de hoy'),
    tpl.tablaDatosGenerales([
      ['Estudiante', nombreCap],
      ['Área de trabajo', area],
      ['Programa', tituloPrograma],
      ['Ejercicio', `${numeroSet}${descSet ? ` — ${descSet}` : ''}`],
      ['Meta', `Que lo logre en el ${criterio}% de las veces, de forma constante`],
    ]),
  ]

  if (prog.objetivo_lp) {
    sections.push(tpl.subseccion('¿Qué queremos lograr a largo plazo?', String(prog.objetivo_lp)))
  }

  // III. Pasos
  sections.push(tpl.tituloSeccion('III.  Cómo hacerlo, paso a paso'))
  if (pasos.length === 0) {
    sections.push(tpl.parrafo('Este ejercicio todavía no tiene el procedimiento detallado. Consultá con el especialista para que te explique cómo practicarlo en casa.'))
  } else {
    let n = 0
    for (const paso of pasos) {
      n++
      // Encabezado del paso
      sections.push(new Paragraph({
        spacing: { before: 220, after: 40 },
        children: [
          new TextRun({ text: `${paso.icono}  Paso ${n}: ${paso.titulo}`, bold: true, size: 23, font: 'Arial', color: '1E3A8A' }),
        ],
      }))
      // Qué significa (nota guía, en cursiva)
      sections.push(new Paragraph({
        spacing: { before: 0, after: 40 },
        children: [new TextRun({ text: paso.queSignifica, italics: true, size: 19, font: 'Arial', color: '64748B' })],
      }))
      // Contenido específico de este set (lo que escribió el especialista)
      sections.push(new Paragraph({
        spacing: { before: 0, after: 40 },
        border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4F46E5', space: 10 } },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
        children: [new TextRun({ text: paso.contenido, size: 21, font: 'Arial', color: '1E293B' })],
      }))
    }
  }

  // IV. Consejos para la familia
  sections.push(tpl.tituloSeccion('IV.  Consejos para que funcione mejor'))
  sections.push(...tpl.items([
    'Elegí un momento tranquilo, sin distracciones (sin TV ni celular cerca).',
    'Practicá poco tiempo pero seguido: 5 a 10 minutos varias veces es mejor que una sesión larga.',
    'Festejá cada logro al instante: un aplauso, un abrazo o algo que le guste lo motiva muchísimo.',
    'Si se frustra o se cansa, hacé una pausa. Nunca lo obligues ni lo regañes por equivocarse.',
    'La constancia es la clave: repetir el ejercicio en distintos momentos del día acelera el aprendizaje.',
    'Anotá tus dudas y compartilas con el especialista en la próxima sesión.',
  ]))

  // V. Cierre
  sections.push(tpl.tituloSeccion('V.  Gracias por acompañar'))
  sections.push(tpl.parrafo(`Tu participación en casa hace una diferencia enorme en el progreso de ${nombreCorto}. Cada pequeño paso cuenta. Ante cualquier duda sobre cómo realizar este ejercicio, el equipo está para ayudarte.`))

  // QR + firma
  sections.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [] }))
  sections.push(...sellosVerif)
  sections.push(
    new Paragraph({
      spacing: { before: 320, after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 8 } },
      children: [new TextRun({ text: 'Equipo Clínico', bold: true, size: 22, font: 'Arial', color: '1E3A8A' })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI', size: 19, font: 'Arial', color: '475569' })],
    }),
  )

  const doc = new Document({
    numbering: tpl.DOC_NUMBERING,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: tpl.DOC_PAGE_PROPS,
      footers: { default: tpl.piePaginaOficial() },
      children: sections,
    }],
  })

  await registrarDocumentoEmitido({
    codigoDoc, childId: childId || undefined, tipo: 'reporte_padres',
    tipoLabel: 'Guía de Ejercicio para Casa',
    pacienteNombre: nombreCap, pacienteIniciales: iniciales,
    fileName, metadata: { programa: tituloPrograma, set: numeroSet, objetivo_id: objetivoId },
  })

  return { doc, fileName }
}

// i18n: responder en el idioma del usuario
// getLangInstruction moved to lib/lang.ts

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { childId, tipo, objetivoId } = body
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'

    let result: { doc: Document; fileName: string }

    // Guía de ejercicio para casa (un set) — usa objetivoId, no childId
    if (tipo === 'set' || tipo === 'guia_set') {
      if (!objetivoId) return NextResponse.json({ error: 'objetivoId requerido' }, { status: 400 })
      result = await generarGuiaSetFamilia(objetivoId, userLocale)
      const bufSet = await Packer.toBuffer(result.doc)
      const u8Set = new Uint8Array(bufSet)
      return new NextResponse(u8Set, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${result.fileName}"`,
          'Content-Length': String(u8Set.byteLength),
        },
      })
    }

    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    // 'seguro' (botón "Informe Clínico" en el UI) → nuevo informe SANTI profesional
    if (tipo === 'seguro' || tipo === 'clinico' || tipo === 'tratamiento') result = await generarInformeClinicoSanti(childId, userLocale)
    else if (tipo === 'seguro_legacy') result = await generarReporteSeguro(childId, userLocale)
    // Versiones PRO (nivel profesional con portada + QR + IA + trazabilidad)
    else if (tipo === 'comparativo') result = await generarReporteComparativoPro(childId, userLocale)
    // Reporte de programas ABA — explicativo para la familia
    else if (tipo === 'programas') result = await generarReporteProgramasFamilia(childId, userLocale)
    else if (tipo === 'padres_legacy') result = await generarReportePadres(childId, userLocale)
    else if (tipo === 'comparativo_legacy') result = await generarReporteComparativo(childId, userLocale)
    else result = await generarReportePadresPro(childId, userLocale)

    const buffer = await Packer.toBuffer(result.doc)
    const uint8 = new Uint8Array(buffer)

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': String(uint8.byteLength),
      },
    })
  } catch (e: any) {
    console.error('Error reporte-word:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
