'use client'

import { useI18n } from '@/lib/i18n-context'
import { toBCP47 } from '@/lib/i18n'

import { useState, useEffect } from 'react'
import {
  Activity, AlertTriangle, BookOpen, Brain, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList, Eye, FileText, FileWarning, Home, Loader2, MoreHorizontal, Save, Send, ShieldAlert, Sparkles, User, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import ReportGenerator from '@/components/ReportGenerator'
import { calcularEdad, calcularEdadNumerica } from '../utils/helpers'
import { 
  FORM_TABLE_MAPPING, EVALUATION_COLORS,
  ANAMNESIS_DATA, ABA_DATA, ENTORNO_HOGAR_DATA, BRIEF2_DATA,
  ADOS2_DATA, VINELAND3_DATA, WISCV_DATA, BASC3_DATA
} from '../data/formConstants'

function DynamicEvaluationsView() {
  const { t, locale } = useI18n()
  const [activeForm, setActiveForm] = useState<'aba' | 'anamnesis' | 'entorno_hogar' | 'brief2' | 'ados2' | 'vineland3' | 'wiscv' | 'basc3' | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedChild, setSelectedChild] = useState('');
  const [listaNinos, setListaNinos] = useState<any[]>([]);
  const [respuestas, setRespuestas] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedEvaluationId, setSavedEvaluationId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    supabase.from('children').select('id, name').then(({ data }: { data: any[] | null }) => data && setListaNinos(data));
  }, []);

  const formConfig = activeForm === 'anamnesis' ? ANAMNESIS_DATA : 
                      activeForm === 'aba' ? ABA_DATA : 
                      activeForm === 'entorno_hogar' ? ENTORNO_HOGAR_DATA :
                      activeForm === 'brief2' ? BRIEF2_DATA :
                      activeForm === 'ados2' ? ADOS2_DATA :
                      activeForm === 'vineland3' ? VINELAND3_DATA :
                      activeForm === 'wiscv' ? WISCV_DATA :
                      activeForm === 'basc3' ? BASC3_DATA : null;
  const currentSection = formConfig ? formConfig[currentStep] : null;
  const totalSteps = formConfig ? formConfig.length : 0;
  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0;

  const handleInputChange = (id: string, value: any) => {
    setRespuestas({ ...respuestas, [id]: value });
  };

  // 🆕 MANEJO DE MULTISELECT
  const handleMultiselectChange = (id: string, option: string) => {
    const current = respuestas[id] || [];
    const newValue = current.includes(option)
      ? current.filter((item: string) => item !== option)
      : [...current, option];
    setRespuestas({ ...respuestas, [id]: newValue });
  };

  // Lógica Genérica para IA en cualquier formulario (excepto Anamnesis)
  const handleGenerateUniversalIA = async () => {
     if (isGenerating) return // Guard contra doble click
     const hasEnoughData = Object.keys(respuestas).length > 2;
     if (!hasEnoughData) {
         return alert("Por favor responde algunas preguntas antes de generar con IA.");
     }

     console.log('🤖 Generando IA para formulario:', activeForm);
     console.log('📝 Respuestas actuales:', respuestas);

     setIsGenerating(true);
     try {
        // Determinamos el endpoint según el tipo de formulario
        const { data: childData } = await supabase.from('children').select('name, age, diagnosis').eq('id', selectedChild).maybeSingle();
        const childName = childData?.name || 'Paciente';
        const childAge  = childData?.age || 0;
        const diagnosis = childData?.diagnosis || '';

        let endpoint = '/api/analyze-neurodivergent-form'; // Default universal
        let bodyPayload: any = {
          formType:  activeForm,
          formData:  respuestas,
          childName,
          childAge,
          diagnosis,
        };

        if (activeForm === 'entorno_hogar') {
            endpoint = '/api/generate-home-environment-report';
            bodyPayload = { ...respuestas, childName, childAge, diagnosis };
        } else if (activeForm === 'aba' && respuestas.antecedente && respuestas.conducta && respuestas.consecuencia) {
            // Solo usar generate-session-report si tiene los 3 campos ABC
            endpoint = '/api/generate-session-report';
            bodyPayload = { ...respuestas };
        } else if (['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3'].includes(activeForm || '')) {
            endpoint = '/api/analyze-professional-evaluation';
            bodyPayload = { evaluationType: activeForm, responses: respuestas, childName, childAge };
        }

        console.log('📡 Llamando a:', endpoint);
        console.log('📦 Payload:', bodyPayload);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
        });
        
        const data = await response.json();
        
        console.log('✅ Respuesta del API:', data);
        
        if (!response.ok || data.error) {
            console.error('❌ Error en respuesta:', data);
            throw new Error(data.error || "Error al conectar con el servidor IA");
        }

        // Unwrap .analysis si existe (analyze-neurodivergent-form lo envuelve así)
        const rawData = data.analysis || data
        console.log('🧠 rawData recibido de IA:', JSON.stringify(rawData).slice(0,300))
        // Aplanar metricas al nivel raíz para que los campos readonly los muestren
        const flatData: any = { ...rawData }
        if (rawData.metricas) {
          const m = rawData.metricas
          // Vineland-3
          if (m.comunicacion !== undefined)      flatData.puntuacion_comunicacion      = m.comunicacion
          if (m.socializacion !== undefined)     flatData.puntuacion_socializacion     = m.socializacion
          if (m.vida_diaria !== undefined)       flatData.puntuacion_vida_diaria        = m.vida_diaria
          if (m.indice_global !== undefined)     flatData.indice_conducta_adaptativa   = m.indice_global
          // BRIEF-2
          if (m.inhibicion !== undefined)        flatData.inhibicion                   = m.inhibicion
          if (m.flexibilidad !== undefined)      flatData.flexibilidad                 = m.flexibilidad
          if (m.total !== undefined)             flatData.total_brief                  = m.total
          // WISC-V
          if (m.ci_total !== undefined)          flatData.ci_total                     = m.ci_total
          if (m.clasificacion !== undefined)     flatData.clasificacion_ci             = m.clasificacion
          if (m.icv !== undefined)               flatData.icv_total                    = m.icv
          if (m.ive !== undefined)               flatData.ive_total                    = m.ive
          if (m.irf !== undefined)               flatData.irf_total                    = m.irf
          if (m.imt !== undefined)               flatData.imt_total                    = m.imt
          if (m.ivp !== undefined)               flatData.ivp_total                    = m.ivp
          if (m.icv_percentil !== undefined)     flatData.icv_percentil                = m.icv_percentil
          if (m.ive_percentil !== undefined)     flatData.ive_percentil                = m.ive_percentil
          if (m.irf_percentil !== undefined)     flatData.irf_percentil                = m.irf_percentil
          if (m.imt_percentil !== undefined)     flatData.imt_percentil                = m.imt_percentil
          if (m.ivp_percentil !== undefined)     flatData.ivp_percentil                = m.ivp_percentil
          if (m.ci_percentil !== undefined)      flatData.ci_percentil                 = m.ci_percentil
          // BASC-3
          if (m.indice_sintomas !== undefined)   flatData.indice_sintomas_conductuales = m.indice_sintomas
          if (m.perfil_riesgo !== undefined)     flatData.perfil_riesgo                = m.perfil_riesgo
          // ADOS-2
          if (m.severidad !== undefined)         flatData.nivel_severidad              = m.severidad
          if (m.afecto_social !== undefined)     flatData.puntuacion_total             = m.afecto_social
        }
        console.log('🔄 Actualizando respuestas con:', flatData)
        setRespuestas((prev: any) => {
          const newState = { ...prev, ...flatData }
          console.log('📊 Claves en newState:', Object.keys(newState))
          console.log('📊 analisis_vineland_ia:', newState.analisis_vineland_ia?.slice?.(0,50))
          console.log('📊 areas_fortaleza:', newState.areas_fortaleza?.slice?.(0,50))
          return newState
        })
        
        alert("¡Análisis IA completado!");

     } catch (e: any) {
        console.error('💥 Error completo:', e);
        const msg = e.message?.includes('Cuota') || e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED')
        ? '⏳ Cuota de IA agotada. Espera 1-2 minutos e intenta nuevamente.'
        : 'Error IA: ' + e.message
      alert(msg)
     } finally {
        setIsGenerating(false);
     }
  }


  // =====================================================================
  // 🔔 ENVIAR NOTIFICACIÓN AL PADRE - SE LLAMA AL GUARDAR CUALQUIER FORM
  // =====================================================================
  const enviarNotificacionPadre = async (childId: string, formType: string | null, datos: any) => {
    try {
      // 1. Obtener datos del niño y su parent_id
      const { data: child } = await supabase
        .from('children')
        .select('name, parent_id')
        .eq('id', childId)
        .maybeSingle();

      if (!child?.parent_id) {
        console.log('⚠️ Este niño no tiene padre asociado, no se envía notificación');
        return;
      }

      // 2. Obtener el user_id del padre desde profiles
      const { data: parentProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', child.parent_id)
        .maybeSingle();

      if (!parentProfile?.user_id) {
        console.log('⚠️ No se encontró user_id del padre en profiles');
        return;
      }

      // 3. Construir título y mensaje según tipo de formulario
      const childName = child.name;
      const fecha = new Date().toLocaleDateString(toBCP47(locale), { day: 'numeric', month: 'long' });
      let title = '';
      let message = '';

      if (formType === 'aba') {
        title = `📋 Nuevo reporte de sesión - ${childName}`;
        const mensajePadres = datos.mensaje_padres || datos.destacar_positivo || datos.proximos_pasos;
        const objetivo = datos.objetivo_principal || datos.conducta || '';
        const tarea = datos.actividad_casa || datos.instrucciones_padres || datos.tarea_hogar || '';
        if (mensajePadres) {
          message = mensajePadres;
        } else {
          message = `Sesión del ${fecha} registrada.${objetivo ? ` Trabajamos en: ${objetivo}.` : ''}${tarea ? ` Actividad para casa: ${tarea}` : ''}`;
        }
      } else if (formType === 'anamnesis') {
        title = `📝 Ficha de ingreso completada - ${childName}`;
        const motivo = datos.motivo_principal || datos.expectativas || '';
        message = `Hemos completado la ficha de ingreso de ${childName} el ${fecha}.${motivo ? ` Motivo: ${motivo}` : ' Pronto comenzaremos con el proceso de evaluación.'}`;
      } else if (formType === 'entorno_hogar') {
        title = `🏠 Reporte de visita al hogar - ${childName}`;
        const obs = datos.mensaje_padres_entorno || datos.impresion_general || datos.recomendaciones_espacio || '';
        message = obs || `Realizamos una visita al hogar de ${childName} el ${fecha}. Pronto recibirás el informe con nuestras recomendaciones.`;
      } else if (formType === 'brief2') {
        title = `🧠 Evaluación BRIEF-2 completada - ${childName}`;
        const analisis = datos.informe_padres || datos.analisis_ia || datos.recomendaciones_ia || '';
        message = analisis || `La evaluación BRIEF-2 de ${childName} fue completada el ${fecha}. Evalúa el funcionamiento ejecutivo (atención, memoria de trabajo, flexibilidad cognitiva).`;
      } else if (formType === 'ados2') {
        title = `🔬 Evaluación ADOS-2 completada - ${childName}`;
        const informe = datos.informe_familia_ados || datos.recomendaciones_intervencion || '';
        message = informe || `La evaluación ADOS-2 de ${childName} fue completada el ${fecha}. Te contactaremos para explicar los resultados en detalle.`;
      } else if (formType === 'vineland3') {
        title = `📊 Evaluación Vineland-3 completada - ${childName}`;
        const informe = datos.informe_padres_vineland || datos.analisis_vineland_ia || '';
        message = informe || `La evaluación de conducta adaptativa Vineland-3 de ${childName} fue completada el ${fecha}.`;
      } else if (formType === 'wiscv') {
        title = `🎯 Evaluación WISC-V completada - ${childName}`;
        const informe = datos.informe_padres_wisc || datos.perfil_cognitivo_ia || '';
        message = informe || `La evaluación cognitiva WISC-V de ${childName} fue completada el ${fecha}.`;
      } else if (formType === 'basc3') {
        title = `📈 Evaluación BASC-3 completada - ${childName}`;
        const informe = datos.informe_padres_basc || datos.analisis_basc_ia || '';
        message = informe || `La evaluación conductual BASC-3 de ${childName} fue completada el ${fecha}.`;
      } else {
        title = `📄 Nuevo registro clínico - ${childName}`;
        message = `Se realizó un nuevo registro clínico para ${childName} el ${fecha}.`;
      }

      // 4. Insertar en la tabla notifications
      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          user_id: parentProfile.user_id,
          title: title,
          message: message,
          type: formType || 'clinical_record',
          is_read: false,
          child_id: childId,
          form_type: formType,
        }]);

      if (notifError) {
        console.error('❌ Error al crear notificación para padre:', notifError);
      } else {
        console.log('✅ Notificación enviada al padre exitosamente:', title);
      }
    } catch (err: any) {
      // No lanzar error para no interrumpir el guardado principal
      console.error('❌ Error en enviarNotificacionPadre:', err);
    }
  };
  // =====================================================================

  const handleSave = async () => {
    if (!selectedChild) return alert("Selecciona un paciente");
    
    console.log('🔍 GUARDANDO FORMULARIO:', {
      formulario: activeForm,
      child_id: selectedChild,
      nombre_nino: listaNinos.find(n => n.id === selectedChild)?.name || 'No encontrado'
    });
    
    setIsSaving(true);
    
    try {
      let tabla = '';
      let dataToInsert: any = {};
      
      if (activeForm === 'anamnesis') {
        tabla = 'anamnesis_completa';
        dataToInsert = { child_id: selectedChild, datos: respuestas, fecha_creacion: new Date().toISOString() };
      } else if (activeForm === 'aba') {
        tabla = 'registro_aba';
        dataToInsert = { child_id: selectedChild, fecha_sesion: respuestas['fecha_sesion'] || new Date().toISOString(), datos: respuestas };
      } else if (activeForm === 'entorno_hogar') {
        tabla = 'registro_entorno_hogar';
        dataToInsert = { child_id: selectedChild, fecha_visita: respuestas['fecha_visita'] || new Date().toISOString(), datos: respuestas };
      } else if (['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3'].includes(activeForm || '')) {
        tabla = FORM_TABLE_MAPPING[activeForm as keyof typeof FORM_TABLE_MAPPING];
        dataToInsert = {
          child_id: selectedChild,
          fecha_evaluacion: respuestas[Object.keys(respuestas).find(k => k.includes('fecha')) || ''] || new Date().toISOString(),
          datos: respuestas,
        };
      }
      
      console.log('💾 Insertando en tabla:', tabla, 'con child_id:', dataToInsert.child_id);
      
      const { data: insertedData, error } = await supabase.from(tabla).insert([dataToInsert]).select('id').single();
      if (error) throw error;
      
      console.log('✅ Guardado exitoso en tabla:', tabla);
      setSavedEvaluationId(insertedData?.id || null);

      // 🔔 NUEVO: ENVIAR NOTIFICACIÓN AL PADRE AUTOMÁTICAMENTE
      await enviarNotificacionPadre(selectedChild, activeForm, respuestas);

      const wantsReport = confirm('✅ ¡Evaluación guardada exitosamente!\n\n¿Deseas generar el Reporte Word ahora?');
      if (wantsReport) {
        setShowReportModal(true);
      } else {
        setActiveForm(null); setRespuestas({}); setSelectedChild(''); setCurrentStep(0);
        setSavedEvaluationId(null);
      }
    } catch (error: any) {
      console.error('❌ Error al guardar:', error);
      alert("Error: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setActiveForm(null);
    setCurrentStep(0);
    setRespuestas({});
    setSelectedChild('');
    setSavedEvaluationId(null);
    setShowReportModal(false);
  };

  return (
    <div className="h-full w-full flex flex-col">
      {!activeForm ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl w-full">
            
            {/* Card ABA */}
            <button 
              onClick={() => setActiveForm('aba')} 
              className="group relative bg-white rounded-3xl md:rounded-[2.5rem] border-2 border-slate-100 hover:border-sky-400 hover:shadow-2xl transition-all duration-300 p-8 md:p-12 flex flex-col items-center justify-center text-center h-[320px] md:h-[420px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-3xl md:rounded-[2.5rem] flex items-center justify-center mb-6 md:mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xl shadow-sky-200">
                   <Activity size={40} className="md:w-16 md:h-16" strokeWidth={2.5}/>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4 tracking-tight">Registro ABA</h3>
                <p className="text-slate-500 text-sm md:text-base max-w-xs font-medium leading-relaxed mb-4">{t('evaluaciones.sistemaCompleto')}</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold">IA Pro</span>
                </div>
              </div>
            </button>

            {/* Card Anamnesis */}
            <button 
              onClick={() => setActiveForm('anamnesis')} 
              className="group relative bg-white rounded-3xl md:rounded-[2.5rem] border-2 border-slate-100 hover:border-sky-400 hover:shadow-2xl transition-all duration-300 p-8 md:p-12 flex flex-col items-center justify-center text-center h-[320px] md:h-[420px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-3xl md:rounded-[2.5rem] flex items-center justify-center mb-6 md:mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xl shadow-sky-200">
                   <FileText size={40} className="md:w-16 md:h-16" strokeWidth={2.5}/>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4 tracking-tight">{t('ui.anamnesis')}</h3>
                <p className="text-slate-500 text-sm md:text-base max-w-xs font-medium leading-relaxed mb-4">{t('ui.anamnesis')}</p>
              </div>
            </button>

            {/* Card Entorno Hogar */}
            <button 
              onClick={() => setActiveForm('entorno_hogar')} 
              className="group relative bg-white rounded-3xl md:rounded-[2.5rem] border-2 border-slate-100 hover:border-green-400 hover:shadow-2xl transition-all duration-300 p-8 md:p-12 flex flex-col items-center justify-center text-center h-[320px] md:h-[420px] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-3xl md:rounded-[2.5rem] flex items-center justify-center mb-6 md:mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xl shadow-green-200">
                   <Home size={40} className="md:w-16 md:h-16" strokeWidth={2.5}/>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4 tracking-tight">Entorno Hogar</h3>
                <p className="text-slate-500 text-sm md:text-base max-w-xs font-medium leading-relaxed mb-4">{t('ui.home_analysis')}</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold">IA Avanzada</span>
                </div>
              </div>
            </button>

            {/* Cards Dinámicas */}
            {['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3'].map((type) => (
              <button 
                key={type}
                onClick={() => setActiveForm(type as any)}
                className={`group relative bg-white rounded-3xl md:rounded-[2.5rem] border-2 border-slate-100 transition-all duration-300 p-8 md:p-12 flex flex-col items-center justify-center text-center h-[320px] md:h-[420px] overflow-hidden hover:shadow-2xl ${EVALUATION_COLORS[type as keyof typeof EVALUATION_COLORS].hover}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${EVALUATION_COLORS[type as keyof typeof EVALUATION_COLORS].primary} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>
                
                <div className="relative z-10 flex flex-col items-center">
                  <div className={`w-20 h-20 md:w-28 md:h-28 bg-gradient-to-br ${EVALUATION_COLORS[type as keyof typeof EVALUATION_COLORS].primary} text-white rounded-3xl md:rounded-[2.5rem] flex items-center justify-center mb-6 md:mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-xl`}>
                    <Brain size={40} className="md:w-16 md:h-16" strokeWidth={2.5}/>
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3 md:mb-4 tracking-tight uppercase">
                    {type.replace(/(\d+)/, '-$1')}
                  </h3>
                  
                  <p className="text-slate-500 text-sm md:text-base max-w-xs font-medium leading-relaxed mb-4">
                      Evaluación profesional estandarizada
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${EVALUATION_COLORS[type as keyof typeof EVALUATION_COLORS].light}`}>
                        Profesional
                    </span>
                    <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold border border-orange-100">
                        IA Análisis
                    </span>
                  </div>
                </div>
              </button>
            ))}

          </div>
        </div>
      ) : (
        // FORMULARIO ACTIVO
        <div className="bg-white rounded-3xl md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-full max-w-7xl mx-auto w-full my-2 md:my-4">
          
          {/* HEADER CON PROGRESO */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 md:px-8 py-4 md:py-6 text-white shrink-0">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3 md:gap-4 overflow-hidden flex-1">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center font-bold text-lg md:text-xl border border-white/20">
                     {currentStep + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                      <p className="text-sky-300 text-[9px] md:text-[10px] font-bold truncate mb-1">
                        EVALUACIÓN EN CURSO
                      </p>
                      <h2 className="text-base md:text-xl lg:text-2xl font-bold truncate leading-tight">
                        {currentSection?.title}
                      </h2>
                  </div>
              </div>
              <button 
                onClick={resetForm}
                className="p-2 md:p-2.5 hover:bg-white/10 rounded-xl transition-colors shrink-0 ml-2"
              >
                <X size={20} className="md:w-6 md:h-6"/>
              </button>
            </div>

            <div className="relative">
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-sky-400 to-sky-500 h-full rounded-full transition-all duration-500 shadow-lg shadow-sky-400/50"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* CONTENIDO DEL FORMULARIO */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-gradient-to-br from-slate-50 to-white">
             <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
               
               {/* BOTON IA - Se muestra en TODO excepto Anamnesis */}
               {activeForm !== 'anamnesis' && (
                   <div className="flex justify-end sticky top-0 z-20 pointer-events-none">
                       <div className="pointer-events-auto">
                           <button 
                               onClick={handleGenerateUniversalIA}
                               disabled={isGenerating}
                               className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-cyan-600 text-white px-5 py-2.5 rounded-full font-bold text-xs md:text-sm shadow-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                               {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>}
                               Generar IA
                           </button>
                       </div>
                   </div>
               )}

               {/* Selector de Paciente */}
               <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border-2 border-slate-200 shadow-sm hover:shadow-md transition-all">
                   <label className="text-xs md:text-sm font-bold text-slate-500 mb-3 ml-1 flex items-center gap-2">
                     <User size={16}/>
                     Seleccionar Paciente
                   </label>
                   <select 
                     className="w-full p-4 md:p-5 bg-slate-50 border-2 border-slate-200 rounded-xl md:rounded-2xl font-bold text-base md:text-lg text-slate-700 outline-none focus:ring-4 focus:ring-sky-100 focus:border-sky-500 transition-all" 
                     value={selectedChild} 
                     onChange={(e) => setSelectedChild(e.target.value)}
                   >
                      <option value="">{t('ui.buscarPaciente2')}</option>
                      {listaNinos.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}
                   </select>
               </div>

               {/* Preguntas del Formulario */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                 {currentSection?.questions.map((q: any) => (
                   <div key={q.id} className={`space-y-3 ${q.type === 'textarea' || q.type === 'multiselect' ? 'md:col-span-2' : ''}`}>
                     <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                         <label className="text-sm md:text-base font-bold text-slate-700 ml-1 flex items-center gap-2">
                           {q.label}
                           {q.required && <span className="text-red-500">*</span>}
                           {q.aiGenerated && (
                             <span className="text-xs bg-gradient-to-r from-sky-500 to-cyan-500 text-white px-2 py-0.5 rounded-full font-bold">IA</span>
                           )}
                         </label>
                     </div>

                     {/* Campo Date */}
                     {q.type === 'date' && (
                       <input 
                         type="date" 
                         className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-xl md:rounded-2xl text-sm md:text-base outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all font-medium" 
                         value={respuestas[q.id] || ''}
                         onChange={(e) => handleInputChange(q.id, e.target.value)} 
                       />
                     )}
                     
                     {/* Campo Number */}
                     {q.type === 'number' && (
                       <input 
                         type="number"
                         min={q.min}
                         max={q.max}
                         placeholder={q.placeholder}
                         className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-xl md:rounded-2xl text-sm md:text-base outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all font-medium" 
                         value={respuestas[q.id] || ''}
                         onChange={(e) => handleInputChange(q.id, e.target.value)} 
                       />
                     )}
                     
                     {/* Campo Text */}
                     {q.type === 'text' && (
                       <input 
                         className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-xl md:rounded-2xl text-sm md:text-base outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all font-medium" 
                         placeholder={q.placeholder} 
                         value={respuestas[q.id] || ''}
                         onChange={(e) => handleInputChange(q.id, e.target.value)} 
                       />
                     )}
                     
                     {/* Campo Textarea */}
                     {q.type === 'textarea' && (
                       <textarea 
                           className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-xl md:rounded-2xl text-sm md:text-base outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 transition-all font-medium min-h-[120px] md:min-h-[140px] resize-none leading-relaxed" 
                           placeholder={q.placeholder} 
                           value={respuestas[q.id] || ''} 
                           onChange={(e) => handleInputChange(q.id, e.target.value)}
                       ></textarea>
                     )}
                     
                     {/* Campo Select */}
                     {q.type === 'select' && (
                       <div className="relative">
                           <select 
                             className="w-full p-4 md:p-5 bg-white border-2 border-slate-200 rounded-xl md:rounded-2xl text-sm md:text-base outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100 appearance-none cursor-pointer font-medium pr-12" 
                             value={respuestas[q.id] || ''}
                             onChange={(e) => handleInputChange(q.id, e.target.value)}
                           >
                               <option value="">{t('ui.select_option')}</option>
                               {q.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                           </select>
                           <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20}/>
                       </div>
                     )}
                     
                     {/* Campo Range (Escala 1-5) */}
                     {q.type === 'range' && (
                       <div className="space-y-3">
                         <div className="flex items-center justify-between">
                           <span className="text-sm font-bold text-slate-500">
                             {q.labels?.[0] || 'Mínimo'}
                           </span>
                           <div className="flex items-center gap-2">
                             <span className="text-3xl font-bold text-sky-600">
                               {respuestas[q.id] || q.min || 1}
                             </span>
                             <span className="text-sm text-slate-400">/ {q.max || 5}</span>
                           </div>
                           <span className="text-sm font-bold text-slate-500">
                             {q.labels?.[q.labels.length - 1] || 'Máximo'}
                           </span>
                         </div>
                         <input 
                           type="range"
                           min={q.min || 1}
                           max={q.max || 5}
                           step="1"
                           value={respuestas[q.id] || q.min || 1}
                           onChange={(e) => handleInputChange(q.id, parseInt(e.target.value))}
                           className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:bg-sky-700"
                         />
                         {q.labels && (
                           <p className="text-xs text-center font-bold text-slate-600 bg-sky-50 px-3 py-2 rounded-lg">
                             {q.labels[respuestas[q.id] - 1] || q.labels[0]}
                           </p>
                         )}
                       </div>
                     )}
                     
                     {/* Campo Multiselect */}
                     {q.type === 'multiselect' && (
                       <div className="space-y-2">
                         <div className="flex flex-wrap gap-2">
                           {q.options.map((opt: string) => (
                             <label 
                               key={opt}
                               className={`px-4 py-2 rounded-xl border-2 cursor-pointer transition-all text-sm font-bold ${
                                 (respuestas[q.id] || []).includes(opt)
                                   ? 'bg-sky-600 border-sky-600 text-white shadow-lg'
                                   : 'bg-white border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50'
                               }`}
                             >
                               <input 
                                 type="checkbox"
                                 className="hidden"
                                 checked={(respuestas[q.id] || []).includes(opt)}
                                 onChange={() => handleMultiselectChange(q.id, opt)}
                               />
                               {opt}
                             </label>
                           ))}
                         </div>
                         {(respuestas[q.id] || []).length > 0 && (
                           <p className="text-xs text-slate-500 font-bold">
                             ✓ {(respuestas[q.id] || []).length} seleccionada(s)
                           </p>
                         )}
                       </div>
                     )}
                     
                     {/* Campo Radio */}
                     {q.type === 'radio' && (
                       <div className="flex flex-wrap gap-3">
                           {q.options.map((opt: string) => (
                               <label 
                                 key={opt} 
                                 className={`flex items-center gap-2 px-4 md:px-5 py-3 md:py-4 rounded-xl md:rounded-2xl border-2 cursor-pointer transition-all text-sm md:text-base font-bold ${
                                     respuestas[q.id] === opt 
                                     ? 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-200' 
                                     : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50'
                                 }`}
                               >
                                   <input 
                                     type="radio" 
                                     name={q.id} 
                                     value={opt} 
                                     className="hidden" 
                                     checked={respuestas[q.id] === opt}
                                     onChange={(e) => handleInputChange(q.id, e.target.value)} 
                                   />
                                   <span>{opt}</span>
                                   {respuestas[q.id] === opt && <CheckCircle2 size={18}/>}
                               </label>
                           ))}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
         </div>

         {/* FOOTER CON NAVEGACIÓN */}
         <div className="p-5 md:p-6 bg-white border-t-2 border-slate-100 flex justify-between shrink-0 gap-4 shadow-lg">
             <button 
               disabled={currentStep === 0} 
               onClick={() => setCurrentStep(currentStep-1)} 
               className="px-6 md:px-8 py-3 md:py-4 font-bold text-sm md:text-base text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
             >
               <ChevronLeft size={18}/>
               Atrás
             </button>
             
             {currentStep < (formConfig!.length - 1) ? (
                 <button 
                   onClick={() => setCurrentStep(currentStep+1)} 
                   className="px-8 md:px-12 py-3 md:py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl md:rounded-2xl font-bold text-sm md:text-base hover:from-black hover:to-slate-900 transition-all flex items-center gap-2 shadow-xl"
                 >
                   <span>{t('common.siguiente')}</span>
                   <ChevronRight size={18}/>
                 </button>
             ) : (
                 <button 
                   onClick={handleSave} 
                   disabled={isSaving || !selectedChild} 
                   className="px-10 md:px-14 py-3 md:py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl md:rounded-2xl font-bold text-sm md:text-base hover:from-green-700 hover:to-green-800 transition-all flex items-center gap-2 shadow-xl shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isSaving ? (
                     <>
                       <Loader2 className="animate-spin" size={18}/>
                       <span>{t('common.procesando')}</span>
                     </>
                   ) : (
                     <>
                       <Save size={18}/>
                       <span>{t('common.guardar')}</span>
                     </>
                   )}
                 </button>
             )}
         </div>
       </div>
     )}

     {/* ── MODAL REPORTE WORD (MOVIDO DENTRO DEL DIV PRINCIPAL) ─────────────────────────────────────────────── */}
     {showReportModal && savedEvaluationId && selectedChild && activeForm && (
       <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
         <div className="w-full max-w-xl animate-fade-in-up">
           <ReportGenerator
             childId={selectedChild}
             childName={listaNinos.find(n => n.id === selectedChild)?.name || ''}
             evaluationType={activeForm!}
             evaluationData={respuestas}
             evaluationId={savedEvaluationId!}  // <--- CORRECCIÓN AQUÍ (Signo !)
             compact={false}
             onClose={() => {
               setShowReportModal(false);
               setActiveForm(null);
               setRespuestas({});
               setSelectedChild('');
               setCurrentStep(0);
               setSavedEvaluationId(null);
             }}
           />
         </div>
       </div>
     )}
   </div>
 )
}


export default DynamicEvaluationsView
