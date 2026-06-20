import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { profileLimitCheck } from '@/lib/profile-limits'

// Solo jefe/admin/programador pueden gestionar usuarios. Se valida por token.
const STAFF_ADMIN = ['jefe', 'admin', 'programador']
type Caller = { ok: boolean; reason: string; uid?: string; role?: string; tenantId?: string | null }

async function requireAdmin(req: NextRequest): Promise<Caller> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return { ok: false, reason: 'sin token' }
  const { data: u, error } = await supabaseAdmin.auth.getUser(token)
  const uid = u?.user?.id
  if (error || !uid) return { ok: false, reason: 'sesión inválida o expirada' }
  const { data: prof } = await supabaseAdmin.from('profiles').select('role, tenant_id').eq('id', uid).maybeSingle()
  const role = (prof as { role?: string } | null)?.role
  const tenantId = (prof as { tenant_id?: string | null } | null)?.tenant_id ?? null
  if (!role || !STAFF_ADMIN.includes(role)) return { ok: false, reason: 'requiere rol jefe/admin' }
  return { ok: true, reason: '', uid, role, tenantId }
}

// Verifica que el usuario objetivo pertenezca al MISMO centro que quien llama.
// (El programador con tenant null gestiona los de tenant null = legacy.)
async function sameTenant(callerTenant: string | null | undefined, userId?: string): Promise<boolean> {
  if (!userId) return true
  const { data } = await supabaseAdmin.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()
  const target = (data as { tenant_id?: string | null } | null)?.tenant_id ?? null
  return (callerTenant ?? null) === target
}

// GET: List all users with their profiles
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    if (authError) throw authError

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
    if (profileError) throw profileError

    const usersWithProfiles = authUsers.users.map(user => {
      const profile = profiles?.find(p => p.id === user.id)
      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed: !!user.email_confirmed_at,
        profile: profile || null,
      }
    })
    // 🔒 Aislamiento por centro: cada admin ve SOLO los usuarios de su tenant.
    // (tenant null = legacy/programador → ve los de tenant null.)
    const callerTenant = auth.tenantId ?? null
    const scoped = usersWithProfiles.filter(u =>
      ((u.profile as { tenant_id?: string | null } | null)?.tenant_id ?? null) === callerTenant)

    return NextResponse.json({ data: scoped })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}

// POST: Manage users
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.ok) return NextResponse.json({ error: `No autorizado (${auth.reason})` }, { status: 403 })
    const body = await request.json()
    const { action, userId, newPassword, tokens, email, role, specialty, full_name, is_active } = body

    // 🔒 Aislamiento: no se puede tocar un usuario de OTRO centro.
    const USER_SCOPED = ['change_password', 'update_tokens', 'update_role', 'update_profile', 'toggle_active', 'confirm_email', 'delete_user']
    if (USER_SCOPED.includes(action) && userId) {
      if (!(await sameTenant(auth.tenantId, userId))) {
        return NextResponse.json({ error: 'No autorizado: ese usuario pertenece a otro centro.' }, { status: 403 })
      }
    }

    if (action === 'change_password') {
      if (!userId || !newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'Contraseña debe tener al menos 6 caracteres' }, { status: 400 })
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Contraseña actualizada correctamente' })
    }

    if (action === 'update_tokens') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ tokens })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'update_role') {
      const validRoles = ['jefe', 'especialista', 'padre', 'admin', 'secretaria']
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Rol no válido' }, { status: 400 })
      }
      // Bloqueo duro de límite (excluye al propio usuario que cambia de rol).
      const lim = await profileLimitCheck(role, userId, auth.tenantId)
      if (lim.blocked) {
        return NextResponse.json({ error: `Límite de "${lim.key}" alcanzado (${lim.current}/${lim.limit}). Solo el programador puede ampliarlo.` }, { status: 409 })
      }
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true, message: `Rol actualizado a "${role}"` })
    }

    if (action === 'update_profile') {
      const updates: Record<string, any> = {}
      if (full_name !== undefined) updates.full_name = full_name
      if (specialty !== undefined) updates.specialty = specialty
      if (is_active !== undefined) updates.is_active = is_active
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_active') {
      const { data: current } = await supabaseAdmin
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single()
      const newActive = !current?.is_active
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ is_active: newActive })
        .eq('id', userId)
      if (error) throw error
      return NextResponse.json({ success: true, is_active: newActive })
    }

    if (action === 'send_reset_email') {
      const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
      })
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Email de recuperación enviado' })
    }

    if (action === 'confirm_email') {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true
      })
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'create_user') {
      if (!email || !newPassword || !role) {
        return NextResponse.json({ error: 'Email, contraseña y rol son requeridos' }, { status: 400 })
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
      }
      // Validar formato email básico
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'El formato del email no es válido' }, { status: 400 })
      }
      // Bloqueo duro de límite de perfiles (lo define el programador), por centro.
      const lim = await profileLimitCheck(role, undefined, auth.tenantId)
      if (lim.blocked) {
        return NextResponse.json({ error: `Límite de "${lim.key}" alcanzado (${lim.current}/${lim.limit}). Solo el programador puede ampliarlo.` }, { status: 409 })
      }
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true,
      })
      if (createErr) {
        // Mensajes de error claros en español
        if (createErr.message?.includes('already been registered') || createErr.message?.includes('already exists') || createErr.message?.includes('duplicate')) {
          return NextResponse.json({ error: `Ya existe un usuario con el email ${email}. Usá un email diferente.` }, { status: 400 })
        }
        if (createErr.message?.includes('invalid') && createErr.message?.includes('email')) {
          return NextResponse.json({ error: 'El email ingresado no es válido.' }, { status: 400 })
        }
        throw createErr
      }
      // Upsert profile: si Supabase ya lo creó via trigger, lo actualiza con los datos correctos
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: newUser.user.id,
          email,
          full_name: full_name || email.split('@')[0],
          role,
          tokens: 0,
          is_active: true,
          specialty: specialty || null,
          tenant_id: auth.tenantId ?? null,   // 🔒 hereda el centro de quien lo crea
        }, { onConflict: 'id' })
      if (profileErr) {
        // Rollback: eliminar el usuario de auth para no dejar huérfanos
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        throw profileErr
      }
      return NextResponse.json({ success: true, message: 'Usuario creado exitosamente' })
    }

    if (action === 'delete_user') {
      if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
      // Desvincular pacientes de este padre (NO se borran los pacientes).
      await supabaseAdmin.from('children').update({ parent_id: null }).eq('parent_id', userId)
      // Borrar perfil y luego la cuenta de auth.
      await supabaseAdmin.from('profiles').delete().eq('id', userId)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) throw error
      return NextResponse.json({ success: true, message: 'Usuario eliminado' })
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: process.env.NODE_ENV === "production" ? "Ocurrió un error. Intentá de nuevo." : error.message }, { status: 500 })
  }
}
