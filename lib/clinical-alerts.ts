// ============================================================================
// SISTEMA DE ALERTAS CLÍNICAS - lib/clinical-alerts.ts
// ============================================================================

import type { ClinicalAlert } from '@/types'

interface BRIEF2Data {
  inhibicion: number
  supervision: number
  flexibilidad: number
  control_emocional: number
  iniciativa: number
  memoria_trabajo: number
  planificacion: number
  organizacion: number
  supervision_tarea: number
}

interface WISCVData {
  comprensionVerbal: number
  visualEspacial: number
  razonamientoFluido: number
  memoriaOperacion: number
  velocidadProcesamiento: number
  ciTotal: number
}

interface ADOS2Data {
  comunicacion: number
  interaccion_social_reciproca: number
  juego: number
  comportamientos_estereotipados: number
  total_severity_score: number
}

interface Vineland3Data {
  comunicacion: number
  habilidades_vida_diaria: number
  socializacion: number
  habilidades_motoras: number
  conducta_adaptativa_compuesta: number
}

export class ClinicalAlertSystem {
  
  // Analizar BRIEF-2
  static analyzeBRIEF2(data: BRIEF2Data): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = []

    // Índice de Regulación Conductual (IRC)
    const irc = (data.inhibicion + data.supervision + data.flexibilidad + data.control_emocional) / 4
    
    if (irc > 70) {
      alerts.push({
        level: 'high',
        area: 'Regulación Conductual',
        message: `IRC elevado (${irc.toFixed(0)}) - Dificultades significativas en regulación conductual`,
        recommendation: 'Considerar evaluación TDAH. Intervención en autorregulación conductual urgente.',
        triggered_at: new Date().toISOString()
      })
    } else if (irc > 65) {
      alerts.push({
        level: 'medium',
        area: 'Regulación Conductual',
        message: `IRC borderline (${irc.toFixed(0)}) - Alertas en regulación conductual`,
        recommendation: 'Monitoreo cercano. Estrategias preventivas de autorregulación.',
        triggered_at: new Date().toISOString()
      })
    }

    // Índice de Metacognición (IMC)
    const imc = (data.iniciativa + data.memoria_trabajo + data.planificacion + 
                 data.organizacion + data.supervision_tarea) / 5
    
    if (imc > 70) {
      alerts.push({
        level: 'high',
        area: 'Funciones Ejecutivas - Metacognición',
        message: `IMC elevado (${imc.toFixed(0)}) - Dificultades severas en funciones ejecutivas`,
        recommendation: 'Intervención neuropsicológica en funciones ejecutivas. Considerar funciones ejecutivas "frías".',
        triggered_at: new Date().toISOString()
      })
    }

    // Alertas específicas por escala
    if (data.memoria_trabajo > 70) {
      alerts.push({
        level: 'high',
        area: 'Memoria de Trabajo',
        message: 'Déficit significativo en memoria de trabajo',
        recommendation: 'Estrategias compensatorias: uso de ayudas visuales, fragmentar instrucciones, repetición.',
        triggered_at: new Date().toISOString()
      })
    }

    if (data.flexibilidad > 70) {
      alerts.push({
        level: 'medium',
        area: 'Flexibilidad Cognitiva',
        message: 'Rigidez cognitiva - Dificultad para adaptarse a cambios',
        recommendation: 'Preparación anticipada para transiciones. Uso de historias sociales.',
        triggered_at: new Date().toISOString()
      })
    }

    return alerts
  }

  // Analizar WISC-V
  static analyzeWISCV(data: WISCVData): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = []

    // CI Total bajo
    if (data.ciTotal < 70) {
      alerts.push({
        level: 'critical',
        area: 'Funcionamiento Intelectual Global',
        message: `CI Total en rango de Discapacidad Intelectual (${data.ciTotal})`,
        recommendation: 'Evaluación integral de adaptación (Vineland-3). Considerar certificación de discapacidad. Plan educativo individualizado.',
        triggered_at: new Date().toISOString()
      })
    } else if (data.ciTotal < 85) {
      alerts.push({
        level: 'medium',
        area: 'Funcionamiento Intelectual Global',
        message: `CI Total en rango Limítrofe (${data.ciTotal})`,
        recommendation: 'Considerar apoyos educativos. Evaluación de habilidades adaptativas.',
        triggered_at: new Date().toISOString()
      })
    }

    // Discrepancias significativas entre índices
    const indices = [
      data.comprensionVerbal,
      data.visualEspacial,
      data.razonamientoFluido,
      data.memoriaOperacion,
      data.velocidadProcesamiento
    ]
    
    const maxIndex = Math.max(...indices)
    const minIndex = Math.min(...indices)
    const discrepancia = maxIndex - minIndex

    if (discrepancia >= 23) {
      alerts.push({
        level: 'high',
        area: 'Perfil Cognitivo',
        message: `Discrepancia significativa entre índices (${discrepancia} puntos)`,
        recommendation: 'Perfil cognitivo heterogéneo. Considerar trastorno del aprendizaje específico. Evaluación psicopedagógica complementaria.',
        triggered_at: new Date().toISOString()
      })
    }

    // Velocidad de Procesamiento baja
    if (data.velocidadProcesamiento < 85 && data.ciTotal >= 85) {
      alerts.push({
        level: 'medium',
        area: 'Velocidad de Procesamiento',
        message: 'VP significativamente por debajo del CI global',
        recommendation: 'Tiempo adicional en evaluaciones. Reducir demandas de velocidad en tareas académicas.',
        triggered_at: new Date().toISOString()
      })
    }

    // Memoria de Trabajo baja
    if (data.memoriaOperacion < 85) {
      alerts.push({
        level: 'medium',
        area: 'Memoria de Trabajo',
        message: 'Dificultades en memoria de trabajo',
        recommendation: 'Fragmentar instrucciones. Uso de agendas visuales. Técnicas de chunking.',
        triggered_at: new Date().toISOString()
      })
    }

    return alerts
  }

  // Analizar ADOS-2
  static analyzeADOS2(data: ADOS2Data): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = []

    // Severity Score (1-10, donde >7 es severo)
    if (data.total_severity_score >= 8) {
      alerts.push({
        level: 'critical',
        area: 'Trastorno del Espectro Autista',
        message: `ADOS-2 Severity Score alto (${data.total_severity_score}) - TEA severo`,
        recommendation: 'Intervención intensiva (25-40h/semana ABA). Considerar comunicación alternativa aumentativa (CAA). Evaluación de comorbilidades.',
        triggered_at: new Date().toISOString()
      })
    } else if (data.total_severity_score >= 6) {
      alerts.push({
        level: 'high',
        area: 'Trastorno del Espectro Autista',
        message: `ADOS-2 Severity Score moderado-alto (${data.total_severity_score})`,
        recommendation: 'Terapia ABA intensiva (15-25h/semana). Intervención en comunicación social.',
        triggered_at: new Date().toISOString()
      })
    }

    // Comunicación severamente afectada
    if (data.comunicacion > 7) {
      alerts.push({
        level: 'high',
        area: 'Comunicación',
        message: 'Déficits severos en comunicación',
        recommendation: 'Priorizar comunicación funcional. Evaluar para CAA (PECS, dispositivos). Terapia de lenguaje intensiva.',
        triggered_at: new Date().toISOString()
      })
    }

    // Interacción social recíproca afectada
    if (data.interaccion_social_reciproca > 7) {
      alerts.push({
        level: 'high',
        area: 'Interacción Social',
        message: 'Déficits severos en reciprocidad social',
        recommendation: 'Habilidades sociales grupales. Video-modelado. Historias sociales. Entrenamientos en ToM.',
        triggered_at: new Date().toISOString()
      })
    }

    // Comportamientos estereotipados
    if (data.comportamientos_estereotipados > 6) {
      alerts.push({
        level: 'medium',
        area: 'Conductas Repetitivas',
        message: 'Comportamientos estereotipados significativos',
        recommendation: 'Análisis funcional de conductas. Reforzamiento diferencial. Provisión de alternativas sensoriales.',
        triggered_at: new Date().toISOString()
      })
    }

    return alerts
  }

  // Analizar Vineland-3
  static analyzeVineland3(data: Vineland3Data): ClinicalAlert[] {
    const alerts: ClinicalAlert[] = []

    // Conducta Adaptativa Compuesta baja
    if (data.conducta_adaptativa_compuesta < 70) {
      alerts.push({
        level: 'critical',
        area: 'Conducta Adaptativa Global',
        message: `CAC en rango de discapacidad adaptativa (${data.conducta_adaptativa_compuesta})`,
        recommendation: 'Entrenamiento intensivo en habilidades de vida diaria. Considerar certificación de discapacidad. Apoyos estructurados.',
        triggered_at: new Date().toISOString()
      })
    } else if (data.conducta_adaptativa_compuesta < 85) {
      alerts.push({
        level: 'medium',
        area: 'Conducta Adaptativa Global',
        message: `CAC en rango limítrofe (${data.conducta_adaptativa_compuesta})`,
        recommendation: 'Entrenamiento en autonomía personal. Generalización de habilidades al contexto natural.',
        triggered_at: new Date().toISOString()
      })
    }

    // Comunicación baja
    if (data.comunicacion < 70) {
      alerts.push({
        level: 'high',
        area: 'Comunicación Funcional',
        message: 'Déficits severos en comunicación adaptativa',
        recommendation: 'Priorizar comunicación funcional cotidiana. Involucrar a familia en entrenamiento comunicativo.',
        triggered_at: new Date().toISOString()
      })
    }

    // Habilidades de Vida Diaria bajas
    if (data.habilidades_vida_diaria < 70) {
      alerts.push({
        level: 'high',
        area: 'Autonomía Personal',
        message: 'Dependencia significativa en actividades de vida diaria',
        recommendation: 'Entrenamiento en rutinas de autocuidado. Análisis de tareas. Reforzamiento de independencia.',
        triggered_at: new Date().toISOString()
      })
    }

    // Socialización baja
    if (data.socializacion < 70) {
      alerts.push({
        level: 'medium',
        area: 'Habilidades Sociales Adaptativas',
        message: 'Dificultades severas en socialización adaptativa',
        recommendation: 'Grupos de habilidades sociales. Oportunidades de práctica supervisada con pares.',
        triggered_at: new Date().toISOString()
      })
    }

    return alerts
  }

  // Método principal para generar alertas de cualquier evaluación
  static generateAlerts(evaluationType: string, data: any): ClinicalAlert[] {
    switch (evaluationType) {
      case 'brief2':
        return this.analyzeBRIEF2(data)
      case 'wiscv':
        return this.analyzeWISCV(data)
      case 'ados2':
        return this.analyzeADOS2(data)
      case 'vineland3':
        return this.analyzeVineland3(data)
      default:
        return []
    }
  }

  // Priorizar alertas por nivel
  static prioritizeAlerts(alerts: ClinicalAlert[]): ClinicalAlert[] {
    const priority = { critical: 0, high: 1, medium: 2, low: 3 }
    return alerts.sort((a, b) => priority[a.level] - priority[b.level])
  }

  // Generar resumen ejecutivo de alertas
  static generateExecutiveSummary(alerts: ClinicalAlert[]): string {
    if (alerts.length === 0) {
      return 'No se identificaron alertas clínicas significativas en esta evaluación.'
    }

    const critical = alerts.filter(a => a.level === 'critical')
    const high = alerts.filter(a => a.level === 'high')
    const medium = alerts.filter(a => a.level === 'medium')

    let summary = '**RESUMEN DE ALERTAS CLÍNICAS:**\n\n'

    if (critical.length > 0) {
      summary += `🔴 **CRÍTICAS (${critical.length}):** Requieren atención inmediata y derivación especializada.\n`
    }

    if (high.length > 0) {
      summary += `🟠 **ALTAS (${high.length}):** Áreas de dificultad significativa que necesitan intervención.\n`
    }

    if (medium.length > 0) {
      summary += `🟡 **MEDIAS (${medium.length}):** Áreas de alerta que requieren monitoreo.\n`
    }

    summary += '\n**ÁREAS PRIORITARIAS DE INTERVENCIÓN:**\n'
    
    const topAreas = [...new Set(alerts.slice(0, 3).map(a => a.area))]
    topAreas.forEach((area, i) => {
      summary += `${i + 1}. ${area}\n`
    })

    return summary
  }
}
