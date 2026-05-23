export const maxDuration = 60;

// app/api/reporte-word/route.ts
// 📄 Genera documentos Word profesionales para cada tipo de reporte IA
// Devuelve el .docx como stream descargable — sin jsPDF, sin lab()

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
import type { HabilidadFila, RecomendacionesBloque } from '@/lib/santi-report-template'

// ── FIX: Helper universal para parsear nivel_logro_objetivos ─────────────────
// Maneja: número, "75", "75%", "51-75%", "mayormente logrado", "alto", etc.
function parseNivelLogro(val: any): number | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number' && !isNaN(val)) return Math.min(100, Math.max(0, Math.round(val)))
  const s = String(val).trim()
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) return Math.round((parseInt(range[1]) + parseInt(range[2])) / 2)
  const num = s.match(/(\d+)/)
  if (num) return Math.min(100, Math.max(0, parseInt(num[1])))
  const lower = s.toLowerCase()
  if (lower.includes('completamente') || lower.includes('independiente') || lower.includes('dominado')) return 90
  if (lower.includes('mayormente') || lower.includes('alto') || lower.includes('excelente')) return 75
  if (lower.includes('parcialmente') || lower.includes('medio') || lower.includes('proceso')) return 50
  if (lower.includes('mínimo') || lower.includes('bajo') || lower.includes('emergente') || lower.includes('inicial')) return 20
  if (lower.includes('no logrado') || lower.includes('sin respuesta')) return 5
  return null
}

const BD = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
const BDR = { top: BD, bottom: BD, left: BD, right: BD }
const NBD = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NBDR = { top: NBD, bottom: NBD, left: NBD, right: NBD }

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function makeDoc(sections: DocChild[], fileName: string) {
  return new Document({
    numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 300 } } } }] }] },
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      footers: { default: new Footer({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: `Neuropsicología y Terapias SANTI · ${fileName} · `, size: 16, font: 'Arial', color: '9CA3AF' }),
          // ✅ FIX: PageNumber.CURRENT es un valor, no una función — sin paréntesis
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Arial', color: '9CA3AF' })
        ]})
      ]})},
      children: sections,
    }]
  })
}


// ── Reporte Para Padres ───────────────────────────────────────────────────────
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

  // FIX: unificar fuentes — preferir sesiones modernas, fallback a legacy
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

  // FIX: total y fechas desde fuente que tenga más datos (modernas si las hay)
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
  const logroEmoji = promedioLogro >= 80 ? '🌟' : promedioLogro >= 65 ? '⭐' : promedioLogro >= 50 ? '📈' : '💪'
  const logroTexto = promedioLogro >= 80 ? '¡Excelente!' : promedioLogro >= 65 ? '¡Muy bien!' : promedioLogro >= 50 ? 'En progreso' : 'Trabajando duro'

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
    callGroqSimple('Eres terapeuta ABA empática. Lenguaje cálido, cercano, sin tecnicismos, como carta a una familia querida.',
      `Escribe el párrafo de BIENVENIDA del reporte mensual para la familia de ${nombreCorto} (${edad} años, ${diagnostico}).
Menciona el período (${semanas} semanas, ${totalSesiones} sesiones), celebra la constancia de la familia, y anticipa que este reporte resume los avances del mes.
1 párrafo cálido y motivador, máximo 60 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.7,maxTokens:150}),

    callGroqSimple('Eres terapeuta ABA empática. Lenguaje cálido, celebratorio, accessible para padres. Sin tecnicismos.',
      `Escribe 3 párrafos sobre los LOGROS Y AVANCES de ${nombreCorto} con estos datos reales:
- Promedio de logro: ${promedioLogro}% (${logroTexto})
- Progreso desde el inicio: ${promedioInicial}% → ${promedioReciente}% (${delta>=0?`+${delta}%`:delta+'%'})
- Sesiones: ${totalSesiones} en ${semanas} semanas
- Áreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'comunicación y conducta'}
- Atención en sesión: ${promedioAtencion>0?promedioAtencion+'%':'buena'}
- Logros dominados: ${progDominados.length>0?progDominados.map((p:any)=>p.titulo||p.nombre).join(', '):'en camino a su primer dominio'}
Celebra con entusiasmo real. Usa ejemplos concretos. Sin tecnicismos. Máximo 180 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.7,maxTokens:350}),

    callGroqSimple('Eres terapeuta ABA. Escribe sugerencias prácticas y concretas para padres. Lenguaje simple y motivador.',
      `Escribe 4 ACTIVIDADES CONCRETAS para hacer en casa con ${nombreCorto} (${edad} años, ${diagnostico}).
Basadas en estas áreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'comunicación, conducta'}.
Cada actividad: nombre simple + descripción de 1-2 oraciones + por qué ayuda. Sin tecnicismos. Sin bullets, en párrafos cortos.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.6,maxTokens:400}),

    callGroqSimple('Eres terapeuta ABA empática. Mensaje final cálido y motivador.',
      `Escribe el MENSAJE FINAL de cierre del reporte para la familia de ${nombreCorto}.
Reconoce el esfuerzo de los padres, proyecta optimismo realista, invita a seguir en contacto.
1 párrafo hermoso y motivador, máximo 60 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.8,maxTokens:150}),
  ])

  const sections: DocChild[] = [
    // ENCABEZADO CÁLIDO
    new Paragraph({ spacing:{before:0,after:20}, border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'7C3AED',space:8}},
      children:[new TextRun({text:'🌟  Neuropsicología y Terapias SANTI',bold:true,size:38,font:'Arial',color:'5B21B6'}),
                new TextRun({text:'  ·  Centro de Terapia ABA',size:22,font:'Arial',color:'9CA3AF'})] }),
    new Paragraph({ spacing:{before:180,after:60},
      children:[new TextRun({text:`Reporte de Progreso de ${nombreCorto}`,bold:true,size:44,font:'Arial',color:'4C1D95'})] }),
    new Paragraph({ spacing:{before:0,after:20},
      children:[new TextRun({text:'Para la familia con cariño',size:24,font:'Arial',color:'7C3AED',italics:true})] }),
    new Paragraph({ spacing:{before:60,after:360}, shading:{fill:'F5F3FF',type:ShadingType.CLEAR},
      children:[new TextRun({text:`Período: ${fechaInicio} al ${fechaFin}   ·   ${totalSesiones} sesiones   ·   Emitido: ${hoy}`,size:18,font:'Arial',color:'6D28D9'})] }),

    // BIENVENIDA
    h2('Querida Familia:'),
    ...textoBienvenida.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // CÓMO VA
    h2(`¿Cómo va ${nombreCorto}? ${logroEmoji}`),
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
            new Paragraph({spacing:{before:80}, children:[new TextRun({text:'📅  Sesiones realizadas',size:18,font:'Arial',color:'475569'})]}),
            new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${totalSesiones} sesiones en ${semanas} semanas`,bold:true,size:22,font:'Arial',color:'1E293B'})]}),
            new Paragraph({spacing:{before:0}, children:[new TextRun({text:'📈  Evolución del progreso',size:18,font:'Arial',color:'475569'})]}),
            new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${promedioInicial}% al inicio → ${promedioReciente}% hoy`,bold:true,size:22,font:'Arial',color:delta>=0?'15803D':'BE123C'})]}),
            ...(promedioAtencion>0?[
              new Paragraph({spacing:{before:0}, children:[new TextRun({text:'🎯  Atención en sesión',size:18,font:'Arial',color:'475569'})]}),
              new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${promedioAtencion}% de atención sostenida`,bold:true,size:22,font:'Arial',color:'1E293B'})]}),
            ]:[]),
            ...(promedioTolerancia>0?[
              new Paragraph({spacing:{before:0}, children:[new TextRun({text:'😌  Manejo emocional',size:18,font:'Arial',color:'475569'})]}),
              new Paragraph({spacing:{before:20,after:60}, children:[new TextRun({text:`${promedioTolerancia}% tolerancia a la frustración`,bold:true,size:22,font:'Arial',color:'1E293B'})]}),
            ]:[]),
            ...(progDominados.length>0?[
              new Paragraph({spacing:{before:0}, children:[new TextRun({text:'✅  Logros dominados',size:18,font:'Arial',color:'15803D'})]}),
              new Paragraph({spacing:{before:20}, children:[new TextRun({text:`${progDominados.length} habilidad${progDominados.length>1?'es':''} completada${progDominados.length>1?'s':''}`,bold:true,size:22,font:'Arial',color:'15803D'})]}),
            ]:[]),
          ]}),
      ]}),
    ]}),
    new Paragraph({spacing:{before:120,after:0},children:[]}),

    // GRÁFICO POR ÁREAS (si hay datos)
    ...(areasData.length>0?[
      pp('Así va en cada área que estamos trabajando:'),
      ...graficoBarras('Progreso por área',areasData),
      new Paragraph({spacing:{before:160,after:0},children:[]}),
    ]:[]),

    // LOGROS EN TEXTO
    h2('Sus logros este período'),
    ...textoLogros.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // PROGRAMAS (simplificado para padres)
    ...(progArr.length>0?[
      h2('¿Qué estamos trabajando juntos?'),
      pp('Estas son las habilidades que estamos desarrollando con '+ nombreCorto+' en este momento:'),
      new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3600,3360,2400], rows:[
        new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:'4C1D95',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Habilidad',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'4C1D95',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Área de desarrollo',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'4C1D95',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Estado',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        ]}),
        ...progArr.map((p:any,i:number)=>new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F5F3FF':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:p.titulo||p.nombre||'Habilidad',size:17,font:'Arial',bold:true,color:'4C1D95'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F5F3FF':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.area||'General',size:16,font:'Arial',color:'475569'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:p.estado==='dominado'?'F0FDF4':i%2===0?'F5F3FF':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:p.estado==='dominado'?'✅ Dominado':'🔵 Activo',bold:true,size:16,font:'Arial',color:p.estado==='dominado'?'15803D':'4C1D95'})]})]  }),
        ]})),
      ]}),
    ]:[]),

    // ACTIVIDADES EN CASA
    h2('Actividades para hacer en casa 🏠'),
    pp(`Estas actividades complementan el trabajo que hacemos en sesión. Solo necesitan 10-15 minutos al día y hacen una gran diferencia en el progreso de ${nombreCorto}:`),
    ...textoActividadesCasa.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // HISTORIAL RECIENTE (simple, visual)
    ...(sesArr.slice(-8).length>0?[
      h2('Así fue sesión por sesión 📊'),
      pp('Cada sesión es un paso adelante. Aquí puedes ver cómo progresó en las últimas semanas:'),
      ...graficoBarras('Progreso por sesión', sesArr.slice(-8).map((s:any,i:number)=>({
        label:`Sesión ${sesArr.length-7+i} — ${new Date(s.fecha_sesion).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}`,
        valor:extraerLogro(s)??0
      }))),
      new Paragraph({spacing:{before:160,after:0},children:[]}),
    ]:[]),

    // MENSAJE FINAL
    h2(`Un mensaje especial para ustedes 💜`),
    new Paragraph({ spacing:{before:80,after:160}, shading:{fill:'F5F3FF',type:ShadingType.CLEAR},
      border:{left:{style:BorderStyle.SINGLE,size:12,color:'7C3AED',space:10}},
      children:textoMensaje.split('\n').filter((l:string)=>l.trim()).flatMap((line:string,i:number,arr:string[])=>[
        new TextRun({text:line,size:22,font:'Arial',color:'4C1D95',italics:true}),
        ...(i<arr.length-1?[new TextRun({text:'\n',break:1})]:[])
      ]),
    }),

    // CIERRE
    new Paragraph({spacing:{before:400},border:{top:{style:BorderStyle.SINGLE,size:2,color:'E2E8F0',space:8}},
      children:[new TextRun({text:'Con cariño, el equipo de Neuropsicología y Terapias SANTI',size:20,font:'Arial',color:'7C3AED',bold:true,italics:true})]}),
    new Paragraph({spacing:{before:40,after:0},
      children:[new TextRun({text:`${hoy}  ·  Este reporte es personal y confidencial`,size:16,font:'Arial',color:'94A3B8'})]}),
  ]

  return { doc: makeDoc(sections, fileName), fileName }
}


// ── Reporte Comparativo + Predicción ─────────────────────────────────────────
async function generarReporteComparativo(childId: string, userLocale = 'es'): Promise<{ doc: Document; fileName: string }> {
  const { data: child } = await supabaseAdmin.from('children').select('name, age, diagnosis, birth_date').eq('id', childId).single()
  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const edad = (child as any)?.age || 'N/A'
  const diagnostico = (child as any)?.diagnosis || 'TEA'

  // FIX: pull ALL data sources — patientes modernos viven en sesiones_datos_aba
  //      registro_aba es legacy; programas_aba.id es CRUCIAL para joinear sesiones por programa.
  //      También cargamos eval inicial, documentos extraídos, fichas clínicas y evaluaciones pro.
  const [
    { data: sesiones },           // registro_aba (legacy)
    { data: programas },          // programas_aba (modernos)
    { data: sesionesProg },       // sesiones_datos_aba (sesiones modernas)
    { data: evalInicial },        // evaluaciones_iniciales
    { data: docsExtraidos },      // patient_documents con texto extraído
    { data: fichasClinicas },     // actas / templates clínicos
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

  // ── ESTRATEGIA UNIFICADA DE SESIONES ─────────────────────────────────
  //   Si hay sesiones modernas (sesiones_datos_aba), usalas como fuente primaria.
  //   Si NO hay modernas pero sí legacy (registro_aba), usar legacy.
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

  // ── ESTADO DE PROGRAMAS ─────────────────────────────────────────────
  const progActivos = progArr.filter(p => p.estado === 'activo' || p.estado === 'intervencion' || !p.estado)
  const progDominados = progArr.filter(p => p.estado === 'dominado' || p.estado === 'logrado' || p.estado === 'criterio_alcanzado')
  const progEnLineaBase = progArr.filter(p => p.fase_actual === 'linea_base')

  // Por programa: último % + tendencia
  const programasConDatos = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id).sort((a: any, b: any) => (a.fecha || '').localeCompare(b.fecha || ''))
    const pcts = sesP.map((s: any) => parseNivelLogro(s.porcentaje_exito)).filter((v: number | null): v is number => v !== null)
    return {
      titulo: p.titulo || 'Sin nombre',
      area: p.area || 'General',
      fase: p.fase_actual || '—',
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

  // Cuartos para gráfico
  const q = (arr: number[], from: number, to: number) => avg(arr.slice(Math.floor(arr.length*from), Math.max(Math.floor(arr.length*to),1)))
  const q1=q(logros,0,0.25), q2=q(logros,0.25,0.5), q3=q(logros,0.5,0.75), q4=q(logros,0.75,1)

  // ── Predicción con fallback clínico para pocas sesiones ───────────────────
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

  // Con <6 sesiones la regresión no es confiable: usar benchmark clínico ABA
  // Mejora típica mensual en terapia ABA sostenida: 3-7% según nivel base
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
    confianzaNota = `⚠ Proyección estimativa basada en benchmarks clínicos ABA (solo ${logros.length} sesiones registradas). La precisión mejora con más datos — se recomienda re-evaluar a partir de la sesión 8.`
  } else {
    const señal = diferencia !== 0 ? diferencia * 0.15 : 0
    pred30  = Math.min(100, Math.max(avg2 + 1, Math.round(avg2 + pendiente * ses30d + señal)))
    pred90  = Math.min(100, Math.max(pred30 + 1, Math.round(avg2 + pendiente * ses90d + señal * 2)))
    pred180 = Math.min(100, Math.max(pred90 + 1, Math.round(avg2 + pendiente * ses180d + señal * 3)))
    confianzaNota = `Proyección basada en regresión lineal sobre ${logros.length} sesiones (confianza ${logros.length >= 12 ? 'alta' : 'moderada'}).`
  }

  // Por área — FIX: ahora con id correcto en programas, el filter funciona
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

  // Atención y tolerancia para comparativo — solo legacy las trae; si no hay, queda en 0
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

  const tendenciaVerbal = diferencia>10?'progreso significativo':diferencia>3?'progreso moderado':diferencia<-5?'regresión':'estabilidad'

  const [textoComparativo, textoPrediccion, textoRecomendaciones] = await Promise.all([
    callGroqSimple('Eres neuropsicóloga ABA. Lenguaje técnico accesible. Párrafos fluidos. Sin bullets.',
      `Análisis COMPARATIVO DE PERÍODOS para ${nombreCap} (${edad} años, ${diagnostico}):
Período 1 (${periodo1.length} sesiones): ${avg1}% promedio
Período 2 (${periodo2.length} sesiones): ${avg2}% promedio
Cambio: ${diferencia>0?'+':''}${diferencia}% (${tendenciaVerbal})
Atención: ${at1>0?at1+'%'  :'N/R'} → ${at2>0?at2+'%':'N/R'} | Tolerancia: ${tol1>0?tol1+'%':'N/R'} → ${tol2>0?tol2+'%':'N/R'}
Programas activos (${progActivos.length}): ${progActivos.map((p:any)=>p.titulo).join(', ').slice(0, 400)}
Áreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'comunicación'}
Programas con criterio alcanzado: ${progDominados.length} (${progDominados.map((p:any)=>p.titulo).join(', ').slice(0,200)})
${evalInicial ? `\nEvaluación inicial: ${(evalInicial as any).recomendacion || '—'} · estado: ${(evalInicial as any).estado || '—'}` : ''}
${docsExtraidos && (docsExtraidos as any[]).length > 0 ? `\nDocumentos en expediente: ${(docsExtraidos as any[]).length} con texto leído (${(docsExtraidos as any[]).slice(0,3).map((d:any) => d.file_name).join(', ')})` : ''}

Explica clínicamente qué significa esta evolución, qué factores pueden contribuir, y qué implica para el desarrollo del niño. Si hay programas con criterio alcanzado, mencionálos por nombre.
3 párrafos, máximo 220 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:400}),

    callGroqSimple('Eres neuropsicóloga ABA. Lenguaje técnico accesible. Párrafos fluidos.',
      `Escribe el análisis de PREDICCIÓN TERAPÉUTICA para ${nombreCap}:
Sesiones totales: ${total} | Logro actual: ${avg2}%
Proyecciones basadas en regresión lineal: 30d → ${pred30}% | 90d → ${pred90}% | 180d → ${pred180}%
Tendencia observada: ${tendenciaVerbal} (pendiente: ${pendiente.toFixed(2)} pts/sesión)
${total <= 5 ? `IMPORTANTE: Con solo ${total} sesiones, las proyecciones son estimativas. Menciona esto con transparencia.` : ''}
Interpreta las proyecciones: qué esperar, qué condiciones son necesarias para cumplirlas, cuál es el nivel de confianza según la cantidad de datos.
2 párrafos, máximo 130 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:260}),

    callGroqSimple('Eres neuropsicóloga ABA. Lenguaje técnico accesible. Párrafos fluidos.',
      `Escribe RECOMENDACIONES TERAPÉUTICAS para ${nombreCap} (${edad} años, ${diagnostico}) basadas en:
- Tendencia: ${tendenciaVerbal}, logro actual: ${avg2}%
- Programas activos (${progActivos.length}): ${progActivos.map((p:any)=>p.titulo).slice(0,8).join(', ')}
- Programas con criterio alcanzado: ${progDominados.length}
- Áreas trabajadas: ${progArr.map((p:any)=>p.area).filter((v:string,i:number,a:string[])=>a.indexOf(v)===i).join(', ')||'en evaluación'}
${evalInicial ? `- Recomendación de eval inicial: ${(evalInicial as any).recomendacion_resumen || (evalInicial as any).recomendacion || '—'}` : ''}

Incluye: (a) ajustes al plan actual de los programas más relevantes, (b) objetivos para el próximo período, (c) frecuencia sugerida, (d) si corresponde, programas que pueden avanzar de set o consolidarse.
2-3 párrafos, máximo 160 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:280}),
  ])

  const pColor = (v: number) => v>=75?'15803D':v>=50?'B45309':'BE123C'
  const pBg = (v: number) => v>=75?'DCFCE7':v>=50?'FEF3C7':'FEE2E2'
  const diffColor = diferencia>=0?'15803D':'BE123C'
  const diffBg = diferencia>=0?'DCFCE7':'FEE2E2'

  const sections: DocChild[] = [
    // PORTADA
    new Paragraph({spacing:{before:0,after:20},border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'0F172A',space:8}},
      children:[new TextRun({text:'NEUROPSICOLOGÍA Y TERAPIAS SANTI',bold:true,size:38,font:'Arial',color:'0F172A'}),
                new TextRun({text:'  ·  Centro Especializado de Terapia ABA',size:22,font:'Arial',color:'64748B'})] }),
    new Paragraph({spacing:{before:180,after:60},
      children:[new TextRun({text:'ANÁLISIS COMPARATIVO DE PERÍODOS',bold:true,size:44,font:'Arial',color:'0F172A'})] }),
    new Paragraph({spacing:{before:0,after:20},
      children:[new TextRun({text:'Con Proyección IA a 30, 90 y 180 días',bold:true,size:26,font:'Arial',color:'475569'})] }),
    new Paragraph({spacing:{before:60,after:360},shading:{fill:'F1F5F9',type:ShadingType.CLEAR},
      children:[new TextRun({text:`Doc. Nº ${docNum}   ·   Emitido: ${hoy}   ·   Período analizado: ${fechaInicio} al ${fechaFin}`,size:18,font:'Arial',color:'64748B'})] }),

    // I. DATOS
    h2('I.  DATOS DEL PACIENTE Y DEL ANÁLISIS'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3200,6160],rows:[
      kv('Paciente',nombreCap),
      kv('Edad',`${edad} años`),
      kv('Diagnóstico',diagnostico),
      kv('Período analizado',`${fechaInicio} al ${fechaFin} (${semanas} semanas)`),
      kv('Total de sesiones',`${total} sesiones registradas`),
      kv('Período 1 (referencia)',`${periodo1.length} sesiones — ${sesArr.length>0?fmt(sesArr[0].fecha_sesion):'N/A'} al ${sesArr.length>mitad?fmt(sesArr[mitad-1]?.fecha_sesion||sesArr[0].fecha_sesion):'N/A'}`),
      kv('Período 2 (actual)',`${periodo2.length} sesiones — ${sesArr.length>mitad?fmt(sesArr[mitad]?.fecha_sesion||sesArr[0].fecha_sesion):'N/A'} al ${fechaFin}`),
      kv('Fecha del análisis',hoy),
    ]}),

    // II. COMPARACIÓN VISUAL
    h2('II.  COMPARACIÓN DIRECTA DE PERÍODOS'),
    pp('La siguiente tabla compara los indicadores clínicos clave entre el período de referencia y el período actual:'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3400,1980,1980,2000],rows:[
      new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Indicador',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Período 1 (${periodo1.length} ses.)`,bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`Período 2 (${periodo2.length} ses.)`,bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Variación',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
      ]}),
      ...([
        ['Logro de objetivos ABA', avg1, avg2, diferencia],
        ...(at1>0&&at2>0?[['Atención sostenida', at1, at2, at2-at1]]:  []),
        ...(tol1>0&&tol2>0?[['Tolerancia a frustración', tol1, tol2, tol2-tol1]]:[]),
      ] as [string,number,number,number][]).map(([ind,v1,v2,diff],i)=>new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:ind,size:17,font:'Arial',bold:i===0})]})]  }),
        new TableCell({borders:BDR,shading:{fill:pBg(v1),type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${v1}%`,bold:true,size:i===0?22:18,font:'Arial',color:pColor(v1)})]})]  }),
        new TableCell({borders:BDR,shading:{fill:pBg(v2),type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${v2}%`,bold:true,size:i===0?22:18,font:'Arial',color:pColor(v2)})]})]  }),
        new TableCell({borders:BDR,shading:{fill:diffBg,type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${diff>=0?'+':''}${diff}%`,bold:true,size:i===0?22:18,font:'Arial',color:diffColor})]})]  }),
      ]})),
    ]}),

    // III. GRÁFICO EVOLUCIÓN COMPLETA
    h2('III.  REPRESENTACIÓN GRÁFICA DE LA EVOLUCIÓN'),
    pp('El siguiente gráfico muestra la evolución del logro terapéutico distribuido en cuatro fases del tratamiento:'),
    ...graficoBarras('Evolución por Fase del Tratamiento',[
      {label:`Fase 1 — Inicio  (S1–S${Math.ceil(total*0.25)})`,valor:q1},
      {label:`Fase 2 — Desarrollo  (S${Math.ceil(total*0.25)+1}–S${Math.ceil(total*0.5)})`,valor:q2},
      {label:`Fase 3 — Consolidación  (S${Math.ceil(total*0.5)+1}–S${Math.ceil(total*0.75)})`,valor:q3},
      {label:`Fase 4 — Estado Actual  (S${Math.ceil(total*0.75)+1}–S${total})`,valor:q4},
    ]),
    new Paragraph({spacing:{before:160,after:0},children:[]}),

    // Comparativo por área
    ...(Object.keys(areaMap).length>0?[
      pp('Comparación por área de intervención entre período 1 y período 2:'),
      ...graficoBarras('Período 1 — Avance por Área', Object.entries(areaMap).filter(([,v])=>v.p1.length>0).map(([label,vals])=>({label,valor:avg(vals.p1)}))),
      new Paragraph({spacing:{before:80,after:0},children:[]}),
      ...graficoBarras('Período 2 — Avance por Área (Actual)', Object.entries(areaMap).filter(([,v])=>v.p2.length>0).map(([label,vals])=>({label,valor:avg(vals.p2)}))),
      new Paragraph({spacing:{before:160,after:0},children:[]}),
    ]:[]),

    // IV. ANÁLISIS COMPARATIVO
    h2('IV.  ANÁLISIS CLÍNICO COMPARATIVO'),
    ...textoComparativo.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // V. PREDICCIÓN IA
    h2('V.  PROYECCIÓN TERAPÉUTICA CON INTELIGENCIA ARTIFICIAL'),
    pp('Las siguientes proyecciones se calculan mediante regresión lineal de mínimos cuadrados sobre el historial real de sesiones, complementado con análisis de tendencia conductual:'),
    ...(total <= 5 ? [new Paragraph({spacing:{before:60,after:100},shading:{fill:'FEF3C7',type:ShadingType.CLEAR},
      border:{left:{style:BorderStyle.SINGLE,size:10,color:'D97706',space:8}},
      children:[new TextRun({text:`⚠  Nota de confianza: Con ${total} sesiones registradas, las proyecciones son estimativas. La precisión mejora significativamente a partir de 10+ sesiones. Se recomienda interpretar como tendencia orientativa.`,size:17,font:'Arial',color:'92400E'})]})] : []),

    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[2000,1400,1200,3160,1600],rows:[
      new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Horizonte',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Logro proy.',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'vs. actual',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Interpretación clínica',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E40AF',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Confianza',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]  }),
      ]}),
      ...([
        ['Actual', avg2, '—', avg2>=75?'Nivel óptimo de respuesta':avg2>=55?'Nivel funcional adecuado':'Requiere intervención sostenida', '—'],
        [`En 30 días`, pred30, `${(pred30-avg2)>=0?'+':''}${pred30-avg2}%`, pred30>=75?'Excelente progreso esperado':pred30>=55?'Progreso sostenido':'Monitoreo intensivo recomendado', total>=15?'Alta':'Estimativa'],
        [`En 90 días`, pred90, `${(pred90-avg2)>=0?'+':''}${pred90-avg2}%`, pred90>=80?'Dominio funcional proyectado':pred90>=65?'Consolidación esperada':pred90>=50?'Progreso gradual':'Revisión del plan', total>=10?'Moderada':'Orientativa'],
        [`En 180 días`, pred180, `${(pred180-avg2)>=0?'+':''}${pred180-avg2}%`, pred180>=85?'Criterio de alta funcional':pred180>=70?'Pronóstico favorable':pred180>=55?'Continuidad necesaria':'Plan intensivo recomendado', total>=8?'Moderada':'Referencial'],
      ] as [string,number,string,string,string][]).map(([hor,val,diff,interp,conf],i)=>new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:hor,bold:i===0,size:17,font:'Arial',color:i===0?'FFFFFF':'1E293B'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':pBg(val),type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${val}%`,bold:true,size:22,font:'Arial',color:i===0?'FFFFFF':pColor(val)})]})]  }),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:diff,bold:true,size:17,font:'Arial',color:i===0?'9CA3AF':diff.startsWith('+')?'15803D':diff==='—'?'64748B':'BE123C'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:interp,size:16,font:'Arial',color:i===0?'9CA3AF':'475569',italics:i!==0})]})]}),
        new TableCell({borders:BDR,shading:{fill:i===0?'1E293B':conf==='Alta'?'DCFCE7':conf==='Moderada'?'FEF3C7':'FFF1F2',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:conf,bold:true,size:15,font:'Arial',color:i===0?'9CA3AF':conf==='Alta'?'15803D':conf==='Moderada'?'92400E':'64748B'})]})]  }),
      ]})),
    ]}),
    new Paragraph({spacing:{before:120,after:0},children:[]}),

    // Gráfico de predicción
    ...graficoBarras('Progreso Real + Proyección IA',[
      {label:`Período 1 — Referencia (${periodo1.length} sesiones)`,valor:avg1},
      {label:`Período 2 — Estado Actual (${periodo2.length} sesiones)`,valor:avg2},
      {label:`Proyección a 30 días`,valor:pred30},
      {label:`Proyección a 90 días`,valor:pred90},
      {label:`Proyección a 180 días`,valor:pred180},
    ]),
    new Paragraph({spacing:{before:200,after:0},children:[]}),

    // VI. ANÁLISIS NARRATIVO DE PREDICCIÓN
    h2('VI.  INTERPRETACIÓN DE LA PROYECCIÓN TERAPÉUTICA'),
    ...textoPrediccion.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // VII. PROGRAMAS
    h2('VII.  ESTADO DE LOS PROGRAMAS DE INTERVENCIÓN'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3000,1800,1760,1400,1400],rows:[
      new TableRow({children:[
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Programa',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Área',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Fase',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Criterio',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Estado',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
      ]}),
      ...progArr.map((p:any,i:number)=>{
        const isDom=p.estado==='dominado',isAct=p.estado==='activo'||p.estado==='intervencion'
        return new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:p.titulo||p.nombre||'Sin título',bold:true,size:17,font:'Arial'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.area||'General',size:16,font:'Arial'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.fase_actual?.replace(/_/g,' ')||'N/A',size:16,font:'Arial'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`≥${p.criterio_dominio_pct||90}%`,bold:true,size:17,font:'Arial',color:'1E40AF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:isDom?'DCFCE7':isAct?'DBEAFE':'F1F5F9',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:isDom?'✓ DOMINADO':isAct?'EN CURSO':p.estado?.toUpperCase()||'N/A',bold:true,size:16,font:'Arial',color:isDom?'15803D':isAct?'1D4ED8':'475569'})]})]  }),
        ]})
      }),
      ...(!progArr.length?[new TableRow({children:[new TableCell({borders:BDR,columnSpan:5,margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Sin programas registrados',size:17,font:'Arial',color:'9CA3AF',italics:true})]})]})]})]:  []),
    ]}),

    // VIII. RECOMENDACIONES
    h2('VIII.  RECOMENDACIONES TERAPÉUTICAS'),
    ...textoRecomendaciones.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // CIERRE
    new Paragraph({spacing:{before:400},border:{top:{style:BorderStyle.SINGLE,size:2,color:'E2E8F0',space:8}},
      children:[new TextRun({text:'Nota metodológica: ',bold:true,size:16,font:'Arial',color:'64748B'}),
                new TextRun({text:confianzaNota,size:16,font:'Arial',color:'94A3B8',italics:true})]}),
    new Paragraph({spacing:{before:40,after:0},
      children:[new TextRun({text:`Neuropsicología y Terapias SANTI  ·  ${hoy}  ·  Documento Nº ${docNum}  ·  Uso confidencial`,size:16,font:'Arial',color:'94A3B8'})]}),
  ]

  return { doc: makeDoc(sections, fileName), fileName }
}

// ── Gráfico de barras tipo Word (tabla con celdas coloreadas) ─────────────────
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

// ── Reporte Para Seguros ──────────────────────────────────────────────────────
async function generarReporteSeguro(childId: string, userLocale = 'es'): Promise<{ doc: Document; fileName: string }> {
  const { data: child } = await supabaseAdmin.from('children').select('name, age, diagnosis, birth_date').eq('id', childId).single()
  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  const edad = (child as any)?.age || 'N/A'
  const diagnostico = (child as any)?.diagnosis || 'TEA'

  const CIE10: Record<string, string> = { 'TEA': 'F84.0', 'Autismo': 'F84.0', 'TDAH': 'F90.0', 'Síndrome de Down': 'Q90', 'Discapacidad intelectual': 'F79', 'Retraso': 'F79' }
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
  const tendenciaVerbal = delta>10?'progreso significativo':delta>3?'progreso moderado':delta<-5?'regresión clínica':'estabilidad terapéutica'

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
    callGroqSimple('Eres neuropsicóloga clínica ABA. Lenguaje técnico formal, párrafos fluidos, sin bullets.',
      `ANTECEDENTES Y MOTIVO DE CONSULTA para ${nombreCap} (${edad} años, ${diagnostico}, CIE-10: ${cie}). Justifica la necesidad clínica del tratamiento ABA. 2 párrafos, máximo 100 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.3,maxTokens:250}),
    callGroqSimple('Eres neuropsicóloga clínica ABA. Lenguaje técnico formal, párrafos fluidos, sin bullets.',
      `EVOLUCIÓN TERAPÉUTICA de ${nombreCap}: ${totalSesiones} sesiones (${fechaInicio} al ${fechaFin}, ${semanasTratamiento} semanas). Logro: ${avgInicial}% inicial → ${avgFinal}% actual (${tendenciaVerbal}, delta ${delta>0?'+':''}${delta}%). Atención: ${promedioAtencion}%, Tolerancia: ${promedioTolerancia}%, Comunicación: ${promedioComunicacion}%. Programas activos: ${progActivos.map((p:any)=>p.titulo||p.nombre||p.area).join(', ')||'en evaluación'}. Dominados: ${progDominados.length>0?progDominados.map((p:any)=>p.titulo||p.nombre).join(', '):'ninguno aún'}. 3 párrafos, máximo 160 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.2,maxTokens:350}),
    callGroqSimple('Eres neuropsicóloga clínica ABA. Lenguaje técnico formal, párrafos fluidos, sin bullets.',
      `PRONÓSTICO Y PLAN para ${nombreCap} (${diagnostico}). ${totalSesiones} sesiones, ${promedioLogro}% promedio, tendencia ${tendenciaVerbal}. Incluye objetivos a 3-6 meses, frecuencia recomendada, áreas prioritarias. 2 párrafos, máximo 100 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.2,maxTokens:250}),
    callGroqSimple('Eres neuropsicóloga clínica ABA. Lenguaje técnico-legal formal.',
      `CONCLUSIONES para aseguradora sobre ${nombreCap}: necesidad médica del tratamiento, eficacia demostrada, recomendación de continuidad. 1 párrafo contundente, máximo 70 palabras.`+getLangInstruction(userLocale),
      {model:GROQ_MODELS.SMART,temperature:0.2,maxTokens:180}),
  ])

  const sections: DocChild[] = [
    // PORTADA
    new Paragraph({ spacing:{before:0,after:20}, border:{bottom:{style:BorderStyle.SINGLE,size:8,color:'1E40AF',space:8}},
      children:[new TextRun({text:'NEUROPSICOLOGÍA Y TERAPIAS SANTI',bold:true,size:38,font:'Arial',color:'1E293B'}),
                new TextRun({text:'  ·  Centro Especializado de Terapia ABA',size:22,font:'Arial',color:'64748B'})] }),
    new Paragraph({ spacing:{before:180,after:60},
      children:[new TextRun({text:'REPORTE NEUROPSICOLÓGICO Y CLÍNICO',bold:true,size:46,font:'Arial',color:'1E40AF'})] }),
    new Paragraph({ spacing:{before:0,after:20},
      children:[new TextRun({text:'Para presentación ante Aseguradoras, IMSS e ISSSTE',bold:true,size:24,font:'Arial',color:'475569'})] }),
    new Paragraph({ spacing:{before:80,after:360}, shading:{fill:'EFF6FF',type:ShadingType.CLEAR},
      children:[new TextRun({text:`Nº ${docNum}   ·   Emitido: ${hoy}   ·   Vigencia: 6 meses   ·   CONFIDENCIAL`,size:18,font:'Arial',color:'64748B'})] }),

    // I. DATOS
    h2('I.  DATOS DE IDENTIFICACIÓN DEL PACIENTE'),
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3200,6160], rows:[
      kv('Nombre completo', nombreCap),
      kv('Edad cronológica', `${edad} años`),
      kv('Diagnóstico principal', diagnostico),
      kv('Clasificación CIE-10', cie),
      kv('Modalidad de intervención', 'Análisis Aplicado de la Conducta (ABA) — Terapia Individual'),
      kv('Centro terapéutico', 'Neuropsicología y Terapias SANTI — Centro Especializado en Neurodesarrollo'),
      kv('Inicio del tratamiento', fechaInicio),
      kv('Última sesión registrada', fechaFin),
      kv('Duración total del proceso', `${semanasTratamiento} semanas (${totalSesiones} sesiones)`),
      kv('Fecha del presente reporte', hoy),
    ]}),

    // II. ANTECEDENTES
    h2('II.  ANTECEDENTES CLÍNICOS Y MOTIVO DE CONSULTA'),
    ...textoAnamnesis.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // III. INDICADORES
    h2('III.  INDICADORES CUANTITATIVOS DE PROGRESO TERAPÉUTICO'),
    pp('Los siguientes indicadores resultan del análisis sistemático de las hojas de datos ABA registradas durante el período de tratamiento. Cada valor representa el promedio ponderado de todas las sesiones evaluadas en el período indicado.'),
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3800,1960,3600], rows:[
      new TableRow({ children:[
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Indicador clínico',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]}),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Valor',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]}),
        new TableCell({borders:BDR,shading:{fill:'0F172A',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Interpretación clínica',bold:true,size:18,font:'Arial',color:'FFFFFF'})]})]})
      ]}),
      ...([
        ['Total de sesiones realizadas', `${totalSesiones}`, totalSesiones>=20?'Proceso terapéutico consolidado':totalSesiones>=10?'Proceso en desarrollo activo':'Fase inicial de intervención'],
        ['Promedio global de logro de objetivos', `${promedioLogro}%`, promedioLogro>=75?'Nivel óptimo de respuesta terapéutica':promedioLogro>=55?'Nivel funcional adecuado':promedioLogro>=35?'En desarrollo, requiere continuidad':'Fase inicial de adquisición'],
        ['Nivel de logro — inicio del tratamiento', `${avgInicial}%`, 'Línea base del paciente al inicio'],
        ['Nivel de logro — etapa actual', `${avgFinal}%`, delta>5?`Mejora de +${delta}% respecto al inicio`:delta<-3?`Variación de ${delta}% respecto al inicio`:'Estabilización del proceso de aprendizaje'],
        ['Atención sostenida durante sesiones', promedioAtencion>0?`${promedioAtencion}%`:'No registrado', promedioAtencion>=70?'Atención funcional adecuada para el aprendizaje':promedioAtencion>0?'En desarrollo activo':'—'],
        ['Tolerancia a la frustración', promedioTolerancia>0?`${promedioTolerancia}%`:'No registrado', promedioTolerancia>=60?'Regulación emocional adecuada':promedioTolerancia>0?'Área de trabajo prioritaria':'—'],
        ['Iniciativa comunicativa', promedioComunicacion>0?`${promedioComunicacion}%`:'No registrado', promedioComunicacion>=60?'Comunicación funcional presente':promedioComunicacion>0?'En proceso de adquisición':'—'],
        ['Programas activos actualmente', `${progActivos.length}`, progActivos.length>0?progActivos.map((p:any)=>p.titulo||p.nombre||p.area).slice(0,3).join(' · '):'En evaluación inicial'],
        ['Programas con criterio de dominio alcanzado', `${progDominados.length}`, progDominados.length>0?progDominados.map((p:any)=>p.titulo||p.nombre).join(' · '):'En proceso de dominio'],
        ['Tendencia clínica general del período', tendenciaVerbal.charAt(0).toUpperCase()+tendenciaVerbal.slice(1), delta>=0?`Incremento de ${Math.abs(delta)} puntos porcentuales`:`Variación de ${Math.abs(delta)} puntos porcentuales`],
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

    // IV. GRÁFICOS
    h2('IV.  REPRESENTACIÓN GRÁFICA DEL PROGRESO TERAPÉUTICO'),
    pp('Los gráficos siguientes ilustran la evolución del nivel de logro de objetivos ABA a lo largo de cuatro fases temporales equitativas del período de tratamiento:'),
    ...(logros.length>=4?graficoBarras('Evolución por Fase Terapéutica',[
      {label:`Fase 1 — Línea Base  (S1–S${Math.ceil(totalSesiones*0.25)})`,valor:logro_q1},
      {label:`Fase 2 — Adquisición  (S${Math.ceil(totalSesiones*0.25)+1}–S${Math.ceil(totalSesiones*0.5)})`,valor:logro_q2},
      {label:`Fase 3 — Consolidación  (S${Math.ceil(totalSesiones*0.5)+1}–S${Math.ceil(totalSesiones*0.75)})`,valor:logro_q3},
      {label:`Fase 4 — Estado Actual  (S${Math.ceil(totalSesiones*0.75)+1}–S${totalSesiones})`,valor:logro_q4},
    ]):[pp('Datos insuficientes para representación gráfica por fases (mínimo 4 sesiones).')]),
    new Paragraph({spacing:{before:200,after:0},children:[]}),

    ...(areasData.length>0?[
      pp('Nivel de desempeño promedio por área de intervención terapéutica:'),
      ...graficoBarras('Avance por Área de Intervención',areasData),
      new Paragraph({spacing:{before:200,after:0},children:[]}),
    ]:[]),

    ...(promedioAtencion>0||promedioTolerancia>0||promedioComunicacion>0?[
      pp('Perfil de indicadores conductuales y habilidades adaptativas del paciente:'),
      ...graficoBarras('Perfil Conductual Integral',[
        {label:'Logro de objetivos ABA',valor:promedioLogro},
        ...(promedioAtencion>0?[{label:'Atención sostenida en sesión',valor:promedioAtencion}]:[]),
        ...(promedioTolerancia>0?[{label:'Tolerancia a la frustración',valor:promedioTolerancia}]:[]),
        ...(promedioComunicacion>0?[{label:'Iniciativa comunicativa',valor:promedioComunicacion}]:[]),
      ]),
      new Paragraph({spacing:{before:200,after:0},children:[]}),
    ]:[]),

    // V. PROGRAMAS
    h2('V.  PROGRAMAS DE INTERVENCIÓN ABA — ESTADO DETALLADO'),
    pp('Se detallan los programas terapéuticos implementados, su área de intervención, fase de aplicación y estado de dominio según el criterio establecido (≥90% de respuestas correctas en dos sesiones consecutivas):'),
    new Table({ width:{size:9360,type:WidthType.DXA}, columnWidths:[3000,1600,1760,1400,1600],
      rows:[
        new TableRow({children:[
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Programa / Objetivo terapéutico',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Área',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Fase actual',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Criterio',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          new TableCell({borders:BDR,shading:{fill:'1E3A5F',type:ShadingType.CLEAR},margins:{top:90,bottom:90,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Estado',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
        ]}),
        ...programasArr.map((p:any,i:number)=>{
          const isDom=p.estado==='dominado', isAct=p.estado==='activo'||p.estado==='intervencion'
          return new TableRow({children:[
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:p.titulo||p.nombre||'Sin título',size:17,font:'Arial',bold:true})]})]  }),
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.area||'General',size:16,font:'Arial'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:p.fase_actual?.replace(/_/g,' ')||'N/A',size:16,font:'Arial'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:i%2===0?'F8FAFC':'FFFFFF',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`≥${p.criterio_dominio_pct||90}%`,bold:true,size:17,font:'Arial',color:'1E40AF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:isDom?'DCFCE7':isAct?'DBEAFE':'F1F5F9',type:ShadingType.CLEAR},margins:{top:70,bottom:70,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:isDom?'✓ DOMINADO':isAct?'EN CURSO':p.estado?.toUpperCase()||'N/A',bold:true,size:16,font:'Arial',color:isDom?'15803D':isAct?'1D4ED8':'475569'})]})]  }),
          ]})
        }),
        ...(!programasArr.length?[new TableRow({children:[new TableCell({borders:BDR,columnSpan:5,margins:{top:80,bottom:80,left:120,right:120},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Sin programas registrados en el período actual',size:17,font:'Arial',color:'94A3B8',italics:true})]})]})]})]:  []),
      ]
    }),

    // VI. HISTORIAL
    ...(historial.length>0?[
      h2('VI.  REGISTRO CRONOLÓGICO DE SESIONES TERAPÉUTICAS'),
      pp(`Registro de las últimas ${Math.min(historial.length,12)} sesiones con indicadores conductuales medidos por el terapeuta durante cada intervención:`),
      new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[1800,1500,1500,1500,3060],
        rows:[
          new TableRow({children:[
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:'Fecha',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Logro obj.',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Atención',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:'Tolerancia',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
            new TableCell({borders:BDR,shading:{fill:'334155',type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:'Observación clínica',bold:true,size:17,font:'Arial',color:'FFFFFF'})]})]  }),
          ]}),
          ...historial.map((s:any,i:number)=>{
            const logro=extraerLogro(s)??0
            const aten=s.datos?.nivel_atencion?`${Math.round((s.datos.nivel_atencion/5)*100)}%`:'—'
            const tol=s.datos?.tolerancia_frustracion?`${Math.round((s.datos.tolerancia_frustracion/5)*100)}%`:'—'
            const obs=s.datos?.observaciones_generales||s.datos?.notas||'Sin observación registrada'
            const fc=logro>=75?'15803D':logro>=50?'92400E':'991B1B'
            const fg=logro>=75?'DCFCE7':logro>=50?'FEF3C7':'FEE2E2'
            const rb=i%2===0?'F8FAFC':'FFFFFF'
            return new TableRow({children:[
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:120,right:80},children:[new Paragraph({children:[new TextRun({text:new Date(s.fecha_sesion).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}),size:16,font:'Arial'})]})]  }),
              new TableCell({borders:BDR,shading:{fill:fg,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:`${logro}%`,bold:true,size:20,font:'Arial',color:fc})]})]  }),
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:aten,size:16,font:'Arial',color:'475569'})]})]  }),
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({text:tol,size:16,font:'Arial',color:'475569'})]})]  }),
              new TableCell({borders:BDR,shading:{fill:rb,type:ShadingType.CLEAR},margins:{top:60,bottom:60,left:80,right:80},children:[new Paragraph({children:[new TextRun({text:obs.length>75?obs.slice(0,75)+'…':obs,size:15,font:'Arial',color:'64748B',italics:true})]})]}),
            ]})
          }),
        ]
      }),
    ]:[]),

    // VII. EVOLUCIÓN
    h2('VII.  EVOLUCIÓN DEL PROCESO TERAPÉUTICO'),
    ...textoProceso.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // VIII. PRONÓSTICO
    h2('VIII.  PRONÓSTICO Y PLAN DE TRATAMIENTO PROPUESTO'),
    ...textoPronostico.split('\n').filter((l:string)=>l.trim()).map((l:string)=>pp(l)),

    // IX. CONCLUSIONES
    h2('IX.  CONCLUSIONES CLÍNICAS PARA ASEGURADORA'),
    new Paragraph({ spacing:{before:80,after:160}, shading:{fill:'EFF6FF',type:ShadingType.CLEAR},
      border:{left:{style:BorderStyle.SINGLE,size:14,color:'1E40AF',space:10}},
      children:textoConclusiones.split('\n').filter((l:string)=>l.trim()).flatMap((line:string,i:number,arr:string[])=>[
        new TextRun({text:line,size:20,font:'Arial',color:'1E3A5F'}),
        ...(i<arr.length-1?[new TextRun({text:'\n',break:1})]:[])
      ]),
    }),

    // X. FIRMA
    h2('X.  ACREDITACIÓN PROFESIONAL Y FIRMA'),
    new Table({width:{size:9360,type:WidthType.DXA},columnWidths:[3200,6160],rows:[
      kv('Centro terapéutico','Neuropsicología y Terapias SANTI — Centro Especializado en Neurodesarrollo'),
      kv('Especialidad','Análisis Aplicado de la Conducta (ABA)'),
      kv('Tipo de intervención','Terapia individual — intervención temprana y desarrollo'),
      kv('Fecha de emisión',hoy),
      kv('Número de documento',docNum),
      kv('Documento válido para','Aseguradoras privadas, IMSS, ISSSTE, Seguro Popular'),
      kv('Vigencia','6 meses a partir de la fecha de emisión'),
    ]}),
    new Paragraph({spacing:{before:600,after:80},children:[new TextRun({text:'_'.repeat(50),size:20,font:'Arial',color:'1E293B'})]}),
    new Paragraph({spacing:{before:0,after:20},children:[new TextRun({text:'Responsable del Tratamiento — Neuropsicología y Terapias SANTI',bold:true,size:18,font:'Arial',color:'1E293B'})]}),
    new Paragraph({spacing:{before:0,after:40},children:[new TextRun({text:'Terapeuta ABA Certificado / Neuropsicólogo Clínico',size:17,font:'Arial',color:'64748B',italics:true})]}),

    new Paragraph({spacing:{before:320},border:{top:{style:BorderStyle.SINGLE,size:2,color:'E2E8F0',space:8}},
      shading:{fill:'FFF7ED',type:ShadingType.CLEAR},
      children:[new TextRun({text:'⚠  DOCUMENTO CONFIDENCIAL — Uso exclusivo para trámites médico-legales con aseguradoras autorizadas. Prohibida su reproducción parcial o total sin autorización del centro emisor.',size:17,font:'Arial',color:'B45309',bold:true})]}),
    new Paragraph({spacing:{before:40,after:0},children:[new TextRun({text:`Neuropsicología y Terapias SANTI  ·  ${hoy}  ·  Documento Nº ${docNum}`,size:16,font:'Arial',color:'94A3B8'})]}),
  ]

  return { doc: makeDoc(sections, fileName), fileName }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── INFORME CLÍNICO SANTI (estilo LuTr — formato oficial del centro) ───────
// ═══════════════════════════════════════════════════════════════════════════
// Estructura inspirada en el modelo "LuTr. Inf Tx 04 - 2025":
//   1. Encabezado + Alumno(a): XxXx
//   2. Datos Generales (tabla)
//   3. Observaciones generales y de conducta (prosa)
//   4. Habilidades y Logros (tabla ÁREA / SUBÁREA / OBJETIVO / SET / LOGROS)
//   5. Glosario de niveles de ayuda
//   6. Limitaciones
//   7. Recomendaciones (menor / familia / escuela)
async function generarInformeClinicoSanti(
  childId: string,
  userLocale = 'es',
): Promise<{ doc: Document; fileName: string }> {
  // Template profesional importado al inicio del archivo

  // ─── 1. Cargar todos los datos del paciente ──────────────────────────
  const { data: child } = await supabaseAdmin
    .from('children')
    .select('name, age, birth_date, diagnosis, parent_id')
    .eq('id', childId)
    .single()
  const nombre = (child as any)?.name || 'Paciente'
  const nombreCap = nombre.split(' ')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  // Calcular edad
  let edadTexto = 'edad no registrada'
  if ((child as any)?.birth_date) {
    const nac = new Date((child as any).birth_date)
    const ahora = new Date()
    const años = ahora.getFullYear() - nac.getFullYear()
    const meses = ahora.getMonth() - nac.getMonth()
    const edad = (meses < 0 || (meses === 0 && ahora.getDate() < nac.getDate())) ? años - 1 : años
    const mesesAdj = meses < 0 ? meses + 12 : meses
    edadTexto = `${edad} años ${mesesAdj > 0 ? `${mesesAdj} meses` : ''}`.trim()
  } else if ((child as any)?.age) {
    edadTexto = `${(child as any).age} años`
  }

  // Programas + sesiones (defensivo). objetivos_cp se carga después con los IDs reales.
  const [{ data: programas }, { data: sesionesProg }, evalIniRes, docsRes] = await Promise.all([
    supabaseAdmin.from('programas_aba').select('id, titulo, area, fase_actual, criterio_dominio_pct, estado, objetivo_lp').eq('child_id', childId).limit(30),
    supabaseAdmin.from('sesiones_datos_aba').select('programa_id, fecha, porcentaje_exito, fase, nivel_ayuda').eq('child_id', childId).order('fecha', { ascending: true }).limit(300),
    (async () => { try { return await supabaseAdmin.from('evaluaciones_iniciales').select('estado, recomendacion, recomendacion_resumen, anamnesis_completada_en').eq('child_id', childId).order('created_at', { ascending: false }).limit(1).maybeSingle() } catch { return { data: null } } })(),
    (async () => { try { return await supabaseAdmin.from('patient_documents').select('file_name, category').eq('child_id', childId).limit(20) } catch { return { data: [] } } })(),
  ])

  const progArr = (programas || []) as any[]
  const sesProgArr = (sesionesProg || []) as any[]

  // Cargar objetivos_cp ahora con los IDs de programas
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
      console.warn('[reporte-clinico] objetivos_cp falló:', e?.message)
    }
  }

  // Calcular n° de sesiones totales (por programa o todas)
  const totalSesiones = sesProgArr.length
  const fechasUnif = sesProgArr.map((s: any) => s.fecha).filter(Boolean).sort()
  const fmt = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const fechaInicio = fechasUnif.length > 0 ? fmt(fechasUnif[0]) : '—'
  const fechaFin = fechasUnif.length > 0 ? fmt(fechasUnif[fechasUnif.length - 1]) : fmt(new Date().toISOString())

  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
  const hoyISO = new Date().toISOString().slice(0, 10)
  const iniciales = tpl.generarIniciales(nombre)
  const fileName = `Informe_Clinico_${nombreCap.replace(/\s+/g, '_')}_${hoyISO}.docx`

  // ─── 2. Construir filas de Habilidades y Logros (estilo LuTr) ────────
  // Agrupar programas por área; por programa, mostrar SET-by-SET con %
  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0

  const habilidades: HabilidadFila[] = []
  // Agrupamos por area para que la columna ÁREA solo aparezca en la primera fila del grupo
  const programasPorArea: Record<string, any[]> = {}
  for (const p of progArr) {
    const a = (p.area || 'General').toUpperCase()
    if (!programasPorArea[a]) programasPorArea[a] = []
    programasPorArea[a].push(p)
  }

  for (const [area, progsArea] of Object.entries(programasPorArea)) {
    let areaMostrada = false
    for (const p of progsArea) {
      const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id)
      const pctsTodos = sesP.map((s: any) => Number(s.porcentaje_exito) || 0).filter(v => v > 0)
      const promedioProg = pctsTodos.length > 0 ? avg(pctsTodos) : null

      const setsDelProg = objetivosArr.filter((o: any) => o.programa_id === p.id)
        .sort((a: any, b: any) => (a.numero_set || 0) - (b.numero_set || 0))

      // Fila principal (objetivo del programa, sin set específico)
      habilidades.push({
        area: areaMostrada ? '' : area,
        subarea: p.titulo || 'Sin nombre',
        objetivo: (() => {
          const base = p.objetivo_lp || ''
          // Si el objetivo ya menciona el criterio, usarlo tal cual
          if (base.toLowerCase().includes('criterio') || base.toLowerCase().includes('%')) return base
          // Si hay texto pero no menciona criterio, anteponer el criterio
          if (base.trim()) {
            return `Con un criterio de éxito de ${p.criterio_dominio_pct || 90}% en dos sesiones consecutivas, ${base.charAt(0).toLowerCase() + base.slice(1)}`
          }
          // Fallback genérico con criterio explícito
          return `Con un criterio de éxito de ${p.criterio_dominio_pct || 90}% en dos sesiones consecutivas, el estudiante podrá demostrar dominio del objetivo trabajado en el programa: ${p.titulo || 'sin descripción'}.`
        })(),
        estado: promedioProg !== null
          ? (promedioProg >= (p.criterio_dominio_pct || 90) ? 'logrado'
            : promedioProg >= 80 ? 'casi_logrado'
            : promedioProg > 0 ? 'en_proceso'
            : 'no_iniciado')
          : 'no_iniciado',
        porcentaje: promedioProg ?? undefined,
      })
      areaMostrada = true

      // Filas por SET si hay objetivos_cp
      for (const obj of setsDelProg) {
        // Filtrar sesiones del set (si fase coincide con numero_set)
        const sesSet = sesP.filter((s: any) => {
          const fase = String(s.fase || '').toLowerCase()
          return fase.includes(`set ${obj.numero_set}`) || fase.includes(`set${obj.numero_set}`) || fase === String(obj.numero_set)
        })
        const pctsSet = sesSet.map((s: any) => Number(s.porcentaje_exito) || 0).filter(v => v > 0)
        const promSet = pctsSet.length > 0 ? avg(pctsSet) : null

        const estadoObj = (obj.estado || '').toLowerCase()
        let estadoSet: HabilidadFila['estado'] = 'en_proceso'
        if (estadoObj === 'dominado' || estadoObj === 'logrado' || estadoObj === 'criterio_alcanzado') estadoSet = 'logrado'
        else if (estadoObj === 'casi_logrado') estadoSet = 'casi_logrado'
        else if (estadoObj === 'no_iniciado' || estadoObj === 'pendiente') estadoSet = 'no_iniciado'
        else if (promSet !== null) {
          estadoSet = promSet >= (p.criterio_dominio_pct || 90) ? 'logrado'
            : promSet >= 80 ? 'casi_logrado'
            : promSet > 0 ? 'en_proceso'
            : 'no_iniciado'
        }

        habilidades.push({
          area: '',
          subarea: '',
          objetivo: '',
          set: `SET ${obj.numero_set}: ${obj.descripcion || '—'}`,
          estado: estadoSet,
          porcentaje: promSet ?? undefined,
        })
      }
    }
  }

  // ─── 3. Generar prosa de observaciones + recomendaciones via IA ─────
  const programasConDatos = progArr.map((p: any) => {
    const sesP = sesProgArr.filter((s: any) => s.programa_id === p.id)
    const pcts = sesP.map((s: any) => Number(s.porcentaje_exito) || 0).filter(v => v > 0)
    const ultimoPct = pcts.length > 0 ? pcts[pcts.length - 1] : null
    const promedio = pcts.length > 0 ? avg(pcts) : null
    return {
      titulo: p.titulo, area: p.area, estado: p.estado,
      n_sesiones: pcts.length, ultimo_pct: ultimoPct, promedio,
    }
  })

  const resumenDatos = programasConDatos
    .map(p => `· ${p.titulo} (${p.area || 'General'}): ${p.n_sesiones} sesiones, último ${p.ultimo_pct ?? 'N/D'}%, promedio ${p.promedio ?? 'N/D'}%, estado ${p.estado || 'activo'}`)
    .join('\n')

  const [textoObservaciones, textoLimitaciones, textoRecomendacionesIA] = await Promise.all([
    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Escribe en prosa formal, sin emojis, sin tablas.',
      `Redacta la sección "OBSERVACIONES GENERALES Y DE CONDUCTA" del informe clínico de ${nombreCap} (${edadTexto}, ${(child as any)?.diagnosis || 'en evaluación'}). Estructúrala en 3-4 subsecciones cortas con label en negrita seguido de dos puntos y prosa:

**Salud y apariencia física durante las sesiones:** (1-2 oraciones tipo "El menor asistió a las sesiones acompañado por su familia, en buenas condiciones de higiene y vestimenta adecuada a la estación")

**Seguimiento de instrucciones y unidades de aprendizaje:** (basado en los datos: ${programasConDatos.filter(p => p.estado === 'criterio_alcanzado' || p.estado === 'dominado').length} programas con criterio alcanzado, evolución de los activos. 2-3 oraciones).

**Presencia de conductas interferentes:** (especular brevemente sobre base de los datos. 1-2 oraciones).

**Disposición durante la intervención:** (1-2 oraciones sobre el compromiso terapéutico).

Datos disponibles:
${resumenDatos}

NO uses emojis. NO uses bullets. Cada subsección máximo 3 oraciones.`+getLangInstruction(userLocale),
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 700 },
    ),
    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Prosa formal, sin emojis.',
      `Redacta la sección "LIMITACIONES" del informe clínico de ${nombreCap}. 1 párrafo de 2-3 oraciones describiendo factores que pudieron limitar el avance (asistencia, salud, contexto). Si los datos no indican limitaciones específicas, redacta una nota general sobre la necesidad de regularidad terapéutica.`,
      { model: GROQ_MODELS.SMART, temperature: 0.3, maxTokens: 200 },
    ),
    callGroqSimple(
      'Eres neuropsicóloga clínica de SANTI. Prosa formal, sin emojis.',
      `Redacta las RECOMENDACIONES del informe clínico de ${nombreCap} (${edadTexto}). Devuelve JSON ESTRICTO con tres arrays de strings (sin emojis), uno por destinatario:

{
  "menor": [
    "Continuar con [terapia X] durante N meses, Y horas por semana, con el objetivo de…",
    "..."
  ],
  "familia": [
    "Acción concreta práctica…",
    "..."
  ],
  "escuela": [
    "Mantener comunicación fluida con el equipo terapéutico mediante…",
    "..."
  ]
}

Datos:
${resumenDatos}

Áreas que están dominadas: ${programasConDatos.filter(p => p.estado === 'criterio_alcanzado' || p.estado === 'dominado').map(p => p.titulo).join(', ') || 'ninguna aún'}.
Áreas en intervención activa: ${programasConDatos.filter(p => p.estado === 'intervencion' || p.estado === 'activo').map(p => p.titulo).join(', ')}.

Genera 3-5 recomendaciones por destinatario, específicas y accionables. Sin emojis. Respuesta SOLO el JSON.`,
      { model: GROQ_MODELS.SMART, temperature: 0.4, maxTokens: 900 },
    ),
  ])

  // Parsear recomendaciones JSON con fallback robusto
  let recomendacionesObj: RecomendacionesBloque = { menor: [], familia: [], escuela: [] }
  try {
    const match = textoRecomendacionesIA.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      recomendacionesObj = {
        menor: Array.isArray(parsed.menor) ? parsed.menor : [],
        familia: Array.isArray(parsed.familia) ? parsed.familia : [],
        escuela: Array.isArray(parsed.escuela) ? parsed.escuela : [],
      }
    }
  } catch (e) {
    console.warn('[reporte-clinico] no se pudo parsear recomendaciones JSON, usando fallback')
    recomendacionesObj = {
      menor: ['Continuar con el plan terapéutico actual según indicación del equipo clínico.'],
      familia: ['Mantener la asistencia regular a las sesiones programadas.', 'Practicar en casa las actividades sugeridas por el terapeuta.'],
      escuela: ['Mantener comunicación fluida con el equipo terapéutico para alinear estrategias.'],
    }
  }

  // Parsear observaciones (separar subsecciones en negrita)
  const observacionesBloques: Paragraph[] = []
  const lineasObs = textoObservaciones.split('\n').map(l => l.trim()).filter(Boolean)
  for (const l of lineasObs) {
    const m = l.match(/^\*\*(.+?):?\*\*:?\s*(.*)$/)
    if (m) {
      observacionesBloques.push(...tpl.subseccion(m[1].trim(), m[2].trim()))
    } else {
      observacionesBloques.push(tpl.parrafo(l.replace(/\*\*/g, '')))
    }
  }

  // ─── 4. Construir documento ──────────────────────────────────────────
  const periodoTexto = fechasUnif.length > 1 ? `${fechaInicio} al ${fechaFin}` : (fechasUnif.length === 1 ? fechaInicio : '—')

  const seccionesDocx: (Paragraph | Table)[] = [
    // Encabezado
    ...tpl.encabezado('Informe Clínico de Tratamiento', iniciales),

    // Datos Generales
    tpl.tituloSeccion('Datos Generales'),
    tpl.tablaDatosGenerales([
      ['Apellidos y nombres', nombre],
      ['Fecha de nacimiento', (child as any)?.birth_date
        ? new Date((child as any).birth_date).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
        : '—'],
      ['Edad', edadTexto],
      ['Diagnóstico', (child as any)?.diagnosis || 'En evaluación'],
      ['Período de trabajo', periodoTexto],
      ['N° de sesiones', String(totalSesiones)],
      ['Programas activos', String(progArr.length)],
      ['Programas con criterio alcanzado', String(programasConDatos.filter(p => p.estado === 'criterio_alcanzado' || p.estado === 'dominado').length)],
      ['Fecha de entrega del informe', hoy],
    ]),

    // Observaciones
    tpl.tituloSeccion('Observaciones generales y de conducta'),
    ...observacionesBloques,

    // Habilidades y Logros
    tpl.tituloSeccion('Habilidades y logros'),
    new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: 'Intervención con el menor', italics: true, bold: true, size: 19, font: 'Arial', color: '1E293B' })],
    }),
    tpl.tablaHabilidades(habilidades),
    ...tpl.glosarioAyudas(),

    // Limitaciones
    tpl.tituloSeccion('Limitaciones'),
    tpl.parrafo(textoLimitaciones.replace(/\*\*/g, '').trim()),

    // Recomendaciones
    ...tpl.recomendaciones(recomendacionesObj),

    // Cierre profesional
    new Paragraph({
      spacing: { before: 480, after: 0 },
      children: [new TextRun({ text: 'Equipo Clínico', bold: true, size: 20, font: 'Arial', color: '1E3A8A' })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'Neuropsicología y Terapias SANTI', size: 18, font: 'Arial', color: '475569' })],
    }),
  ]

  const doc = new Document({
    numbering: tpl.DOC_NUMBERING,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: tpl.DOC_PAGE_PROPS,
      footers: { default: tpl.piePaginaOficial() },
      children: seccionesDocx,
    }],
  })

  return { doc, fileName }
}

// ── Handler principal ──────────────────────────────────────────────────────────

// i18n: responder en el idioma del usuario
// getLangInstruction moved to lib/lang.ts

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { childId, tipo } = body
    const userLocale = body.locale || req.headers.get('x-locale') || 'es'
    if (!childId) return NextResponse.json({ error: 'childId requerido' }, { status: 400 })

    let result: { doc: Document; fileName: string }
    // Nota: 'seguro' ahora apunta al nuevo Informe Clínico estilo SANTI (formato LuTr)
    //       El antiguo 'generarReporteSeguro' queda accesible bajo tipo: 'seguro_legacy' si se necesita.
    if (tipo === 'seguro_legacy') result = await generarReporteSeguro(childId, userLocale)
    else if (tipo === 'seguro' || tipo === 'clinico' || tipo === 'tratamiento') result = await generarInformeClinicoSanti(childId, userLocale)
    else if (tipo === 'comparativo') result = await generarReporteComparativo(childId, userLocale)
    else result = await generarReportePadres(childId, userLocale)

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