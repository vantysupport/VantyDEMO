// ============================================================================
// VALIDACIONES ZOD - lib/validations.ts
// ============================================================================

import { z } from 'zod'

// Validación de WISC-V con rangos estrictos
export const WISCVSchema = z.object({
  comprensionVerbal: z.number().min(45).max(155),
  visualEspacial: z.number().min(45).max(155),
  razonamientoFluido: z.number().min(45).max(155),
  memoriaOperacion: z.number().min(45).max(155),
  velocidadProcesamiento: z.number().min(45).max(155),
  ciTotal: z.number().min(40).max(160),
  fechaAplicacion: z.string().datetime().optional(),
  aplicadoPor: z.string().min(3).max(100),
  protocolo_url: z.string().url().optional() // URL del protocolo firmado
}).refine((data) => {
  // Validar que el CI total sea coherente con los índices
  const promedio = (
    data.comprensionVerbal +
    data.visualEspacial +
    data.razonamientoFluido +
    data.memoriaOperacion +
    data.velocidadProcesamiento
  ) / 5
  
  const diferencia = Math.abs(data.ciTotal - promedio)
  return diferencia < 15 // El CI total no debería diferir más de 15 puntos del promedio
}, {
  message: "El CI Total no es coherente con los índices individuales",
  path: ["ciTotal"]
})

// Validación de BRIEF-2
export const BRIEF2Schema = z.object({
  inhibicion: z.number().min(0).max(100),
  supervision: z.number().min(0).max(100),
  flexibilidad: z.number().min(0).max(100),
  control_emocional: z.number().min(0).max(100),
  iniciativa: z.number().min(0).max(100),
  memoria_trabajo: z.number().min(0).max(100),
  planificacion: z.number().min(0).max(100),
  organizacion: z.number().min(0).max(100),
  supervision_tarea: z.number().min(0).max(100),
  fechaAplicacion: z.string().datetime().optional(),
  informante: z.string().min(3)
})

// Validación de registro de sesión
export const SessionRecordSchema = z.object({
  child_id: z.string().uuid(),
  fecha_sesion: z.string().datetime(),
  datos: z.object({
    conducta: z.string().min(10).max(5000),
    abc_analysis: z.string().max(2000).optional(),
    barriers: z.string().max(1000).optional(),
    red_flags: z.string().max(1000).optional(),
    activity: z.string().max(2000).optional(),
    home_task: z.string().max(1000).optional(),
    observations: z.string().max(2000).optional()
  })
})

// Validación de niño
export const ChildSchema = z.object({
  name: z.string().min(3).max(100),
  birth_date: z.string().refine((date) => {
    const birthDate = new Date(date)
    const today = new Date()
    const age = today.getFullYear() - birthDate.getFullYear()
    return age >= 0 && age <= 18
  }, "La fecha de nacimiento debe corresponder a una edad entre 0 y 18 años"),
  diagnosis: z.string().max(200).optional(),
  photo_url: z.string().url().optional()
})

// Validación de cita
export const AppointmentSchema = z.object({
  child_id: z.string().uuid(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appointment_time: z.string().regex(/^\d{2}:\d{2}$/),
  service_type: z.string().min(3).max(100),
  notes: z.string().max(500).optional()
})

// Validación de objetivo conductual
export const BehaviorGoalSchema = z.object({
  child_id: z.string().uuid(),
  goal_description: z.string().min(10).max(500),
  target_value: z.number().positive(),
  current_value: z.number().min(0),
  target_date: z.string().refine((date) => {
    const targetDate = new Date(date)
    const today = new Date()
    return targetDate > today
  }, "La fecha objetivo debe ser futura")
})

// Validación de reporte
export const GenerateReportSchema = z.object({
  child_id: z.string().uuid(),
  evaluation_type: z.enum(['brief2', 'ados2', 'vineland3', 'wiscv', 'basc3']),
  // CORRECCIÓN: Se agregan dos argumentos: z.string() para la clave y z.unknown() para el valor
  data: z.record(z.string(), z.unknown()),
  include_recommendations: z.boolean().default(true),
  include_graphs: z.boolean().default(true)
})

// Validación de perfil de usuario
export const ProfileUpdateSchema = z.object({
  full_name: z.string().min(3).max(100).optional(),
  phone: z.string().regex(/^\+?[\d\s\-()]+$/).optional(),
  email: z.string().email().optional()
})

// Validación de cambio de contraseña
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    "La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial"
  ),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"]
})

// Validación de consentimiento informado
export const ConsentSchema = z.object({
  child_id: z.string().uuid(),
  consent_type: z.enum(['evaluation', 'treatment', 'data_sharing', 'video_recording']),
  granted_by: z.string().min(3),
  signature_data: z.string(), // Base64 de firma digital
  accepted_at: z.string().datetime()
})

// Helper para validar datos
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { 
  success: boolean
  data?: T
  errors?: z.ZodError
} {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

// Helper para formatear errores de Zod
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const formatted: Record<string, string> = {}
  
  // CORRECCIÓN: Usamos (error as any) para que TypeScript encuentre .errors
  const validationErrors = (error as any).errors || []

  validationErrors.forEach((err: any) => {
    const path = err.path.join('.')
    formatted[path] = err.message
  })
  
  return formatted
}
