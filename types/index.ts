// ============================================================================
// TYPES GLOBALES - types/index.ts
// ============================================================================

// NUEVO SISTEMA DE ROLES:
// 'jefe'        → Acceso total (super admin): usuarios, billing, config global
// 'especialista' → Terapeuta/clinico: pacientes, evaluaciones, reportes, agenda
// 'padre'       → Portal de padres: solo sus hijos, citas, recursos
export type UserRole = 'jefe' | 'especialista' | 'padre'

// Compatibilidad con role anterior 'admin' → se considera igual que 'jefe'
export type UserRoleLegacy = UserRole | 'admin'

export interface RoleConfig {
  label: string
  description: string
  color: string
  bgColor: string
  textColor: string
  borderColor: string
  permissions: string[]
}

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  jefe: {
    label: 'Jefe',
    description: 'Acceso total al sistema',
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300',
    permissions: ['all'],
  },
  especialista: {
    label: 'Especialista',
    description: 'Terapeuta / Clínico',
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300',
    permissions: ['patients', 'evaluations', 'reports', 'calendar', 'resources', 'ai'],
  },
  padre: {
    label: 'Padre / Tutor',
    description: 'Portal de familias',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-300',
    permissions: ['own_children', 'appointments', 'forms', 'resources', 'chat'],
  },
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRoleLegacy
  tokens: number
  phone?: string
  specialty?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Child {
  id: string
  parent_id: string
  name: string
  birth_date: string
  diagnosis?: string
  photo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  child_id: string
  appointment_date: string
  appointment_time: string
  service_type: string
  status: 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  created_at: string
}

export interface SessionRecord {
  id: string
  child_id: string
  fecha_sesion: string
  datos: {
    conducta?: string
    abc_analysis?: string
    barriers?: string
    red_flags?: string
    activity?: string
    home_task?: string
    observations?: string
  }
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  created_at: string
}

export interface Anamnesis {
  id: string
  child_id: string
  data: Record<string, any>
  completed_at?: string
  created_at: string
  updated_at: string
}

export type EvaluationType = 'brief2' | 'ados2' | 'vineland3' | 'wiscv' | 'basc3'

export interface Evaluation {
  id: string
  child_id: string
  evaluation_type: EvaluationType
  data: Record<string, any>
  interpreted_report?: string
  alerts?: ClinicalAlert[]
  completed_at?: string
  created_at: string
}

export interface ClinicalAlert {
  level: 'low' | 'medium' | 'high' | 'critical'
  area: string
  message: string
  recommendation: string
  triggered_at: string
}

export interface BehaviorGoal {
  id: string
  child_id: string
  goal_description: string
  target_value: number
  current_value: number
  status: 'in_progress' | 'achieved' | 'paused'
  start_date: string
  target_date: string
  updated_at: string
}

export interface TokenTransaction {
  id: string
  child_id: string
  amount: number
  transaction_type: 'earned' | 'spent'
  reason: string
  created_at: string
}

export interface Reinforcer {
  id: string
  name: string
  description: string
  cost: number
  image_url?: string
  category: 'activity' | 'food' | 'toy' | 'privilege'
  is_active: boolean
}

export interface VideoModel {
  id: string
  title: string
  description: string
  skill_category: string
  video_url: string
  thumbnail_url?: string
  steps: string[]
  target_age_min: number
  target_age_max: number
  created_at: string
}

export interface WISCVScores {
  comprensionVerbal: number
  visualEspacial: number
  razonamientoFluido: number
  memoriaOperacion: number
  velocidadProcesamiento: number
  ciTotal: number
}

export const WISCV_RANGES = {
  indices: { min: 45, max: 155 },
  ciTotal: { min: 40, max: 160 }
}

export interface AnamnesisSection {
  title: string
  questions: AnamnesisQuestion[]
}

export interface AnamnesisQuestion {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'radio' | 'number'
  placeholder?: string
  options?: string[]
  required?: boolean
}

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface FormState {
  isSubmitting: boolean
  errors: Record<string, string>
  touched: Record<string, boolean>
}

export type Theme = 'light' | 'dark'
