import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Note: Permission model removed to avoid OOM. Using in-memory defaults only.

// ==================== Types ====================

export type Role =
  | 'root_admin'
  | 'associate'
  | 'firm_admin'
  | 'lawyer'
  | 'jurist'
  | 'assistant'
  | 'accountant'
  | 'client'

export type Resource =
  | 'case'
  | 'client'
  | 'document'
  | 'invoice'
  | 'task'
  | 'event'
  | 'audit'
  | 'user'
  | 'payment'
  | 'report'
  | 'setting'

export type Action =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'export'
  | 'manage_permissions'

export interface AuthContext {
  userId: string
  userRole: string
  tenantId: string | null
  userName: string
}

// ==================== Constants ====================

export const ROLES: Role[] = [
  'root_admin',
  'associate',
  'firm_admin',
  'lawyer',
  'jurist',
  'assistant',
  'accountant',
  'client',
]

export const RESOURCES: Resource[] = [
  'case', 'client', 'document', 'invoice', 'task', 'event',
  'audit', 'user', 'payment', 'report', 'setting',
]

export const ACTIONS: Action[] = [
  'view', 'create', 'edit', 'delete', 'export', 'manage_permissions',
]

/** Map HTTP method to default RBAC action */
export function methodToAction(method: string): Action {
  const m = method.toUpperCase()
  if (m === 'GET') return 'view'
  if (m === 'POST') return 'create'
  if (m === 'PUT' || m === 'PATCH') return 'edit'
  if (m === 'DELETE') return 'delete'
  return 'view'
}

// Default permission matrix
const DEFAULT_PERMISSIONS: Record<string, Record<string, Record<string, boolean>>> = {
  root_admin: {
    case:    { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    client:  { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    document:{ view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    invoice: { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    task:    { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    event:   { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    audit:   { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    user:    { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    payment: { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    report:  { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    setting: { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
  },
  associate: {
    case:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    client:  { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    document:{ view: true, create: true, edit: true, delete: true,  export: true, manage_permissions: false },
    invoice: { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    task:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:   { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:   { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    user:    { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment: { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    report:  { view: true, create: true, edit: false, delete: false, export: true, manage_permissions: false },
    setting: { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  firm_admin: {
    case:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    client:  { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    document:{ view: true, create: true, edit: true, delete: true,  export: true, manage_permissions: false },
    invoice: { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    task:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:   { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:   { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    user:    { view: true, create: true, edit: true, delete: false, export: false, manage_permissions: false },
    payment: { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    report:  { view: true, create: true, edit: false, delete: false, export: true, manage_permissions: false },
    setting: { view: true, create: false, edit: true, delete: false, export: false, manage_permissions: false },
  },
  lawyer: {
    case:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    client:  { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    document:{ view: true, create: true, edit: true, delete: true,  export: true, manage_permissions: false },
    invoice: { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    task:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:   { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:   { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:    { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:  { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    setting: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  jurist: {
    case:    { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    client:  { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    document:{ view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    invoice: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    task:    { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    event:   { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    audit:   { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:    { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:  { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    setting: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  assistant: {
    case:    { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    client:  { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    document:{ view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    invoice: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    task:    { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:   { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:   { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:    { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:  { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    setting: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  accountant: {
    case:    { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    client:  { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    document:{ view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    invoice: { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    task:    { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    event:   { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    audit:   { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:    { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment: { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    report:  { view: true, create: true, edit: false, delete: false, export: true, manage_permissions: false },
    setting: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  client: {
    case:    { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    client:  { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    document:{ view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    invoice: { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    task:    { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    event:   { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    audit:   { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:    { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment: { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:  { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    setting: { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
}

// ==================== In-memory permission cache ====================

function buildDefaultCache(cache: Map<string, boolean>) {
  for (const [role, resources] of Object.entries(DEFAULT_PERMISSIONS)) {
    for (const [resource, actions] of Object.entries(resources)) {
      for (const [action, allowed] of Object.entries(actions)) {
        cache.set(`${role}:${resource}:${action}`, allowed)
      }
    }
  }
}

const permissionCache: Map<string, boolean> = new Map()
buildDefaultCache(permissionCache)

async function loadPermissionCache(): Promise<Map<string, boolean>> {
  return permissionCache
}

/** Invalidate and rebuild the permission cache */
export function invalidatePermissionCache(): void {
  permissionCache.clear()
  buildDefaultCache(permissionCache)
}

// ==================== Core helpers (used directly in route handlers) ====================

/**
 * Authenticate a request and return the AuthContext.
 * Returns NextResponse (error) if authentication fails — callers must early-return.
 *
 * @example
 * const auth = await getAuth(request)
 * if (auth instanceof NextResponse) return auth
 */
export async function getAuth(request: Request): Promise<AuthContext | NextResponse> {
  const { searchParams } = new URL(request.url)
  const method = request.method.toUpperCase()
  // Accept auth from headers (preferred) or query params (backward compat)
  const userId = request.headers.get('x-user-id') || searchParams.get('userId')
  const tenantId = request.headers.get('x-tenant-id') || searchParams.get('tenantId')

  // For writes, userId is required
  if (!userId && method !== 'GET') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  // For reads, at least tenantId is needed
  if (!userId && !tenantId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true, name: true, role: true, tenantId: true, isActive: true,
          tenant: { select: { id: true, isActive: true } },
        },
      })

      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })
      if (!user.isActive) return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 })
      if (user.tenant && !user.tenant.isActive) return NextResponse.json({ error: 'Tenant is deactivated' }, { status: 403 })
      if (tenantId && user.tenantId && tenantId !== user.tenantId) return NextResponse.json({ error: 'Tenant mismatch' }, { status: 403 })

      return { userId: user.id, userRole: user.role, tenantId: user.tenantId, userName: user.name }
    }

    // Read-only access with tenantId only (no role enforcement)
    return { userId: '__readonly__', userRole: 'lawyer', tenantId: tenantId!, userName: 'Read Only' }
  } catch (error) {
    console.error('Authentication error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Check if a role has a specific permission.
 */
export async function hasPermission(
  role: string, resource: Resource, action: Action
): Promise<boolean> {
  const cache = await loadPermissionCache()
  return cache.get(`${role}:${resource}:${action}`) ?? false
}

/**
 * Get all permissions for a specific role.
 */
export async function getRolePermissions(
  role: string
): Promise<Record<string, Record<string, boolean>>> {
  const cache = await loadPermissionCache()
  const result: Record<string, Record<string, boolean>> = {}
  for (const resource of RESOURCES) {
    result[resource] = {}
    for (const action of ACTIONS) {
      result[resource][action] = cache.get(`${role}:${resource}:${action}`) ?? false
    }
  }
  return result
}

/**
 * Require a specific permission. Returns a 403 NextResponse if denied.
 * @example
 * const deny = await requirePermission(auth, 'case', 'create')
 * if (deny) return deny
 */
export async function requirePermission(
  auth: AuthContext,
  resource: Resource,
  action: Action
): Promise<NextResponse | null> {
  const allowed = await hasPermission(auth.userRole as Role, resource, action)
  if (!allowed) {
    return NextResponse.json(
      { error: `Access denied: ${auth.userRole} role does not have '${action}' permission on '${resource}'` },
      { status: 403 }
    )
  }
  return null
}

// ==================== Route guard wrappers ====================

type AnyFn = (...args: any[]) => Promise<any>
type AuthFn = (request: Request, auth: AuthContext, ...args: any[]) => Promise<any>

/**
 * Wrap a route handler with authentication only.
 * Usage: export const GET = withAuth(handler)
 */
export function withAuth(fn: AuthFn): AnyFn {
  return async (request: Request, ...args: any[]) => {
    const auth = await getAuth(request)
    if (auth instanceof NextResponse) return auth
    return fn(request, auth, ...args)
  }
}

/**
 * Wrap a route handler with authentication + permission check.
 * Action is inferred from HTTP method unless overridden.
 * Usage: export const GET = withPermission('case', handler)
 * Usage: export const POST = withPermission('case', handler, 'create')
 */
export function withPermission(
  resource: Resource,
  fn: AuthFn,
  actionOverride?: Action
): AnyFn {
  return async (request: Request, ...args: any[]) => {
    const auth = await getAuth(request)
    if (auth instanceof NextResponse) return auth

    const action: Action = actionOverride ?? methodToAction(request.method)
    const deny = await requirePermission(auth, resource, action)
    if (deny) return deny

    return fn(request, auth, ...args)
  }
}

// ==================== Tenant isolation ====================

/**
 * Ensure a where-clause filters by the authenticated user's tenant.
 */
export function enforceTenantIsolation(
  auth: AuthContext,
  where: Record<string, unknown>,
  allowCrossTenant = false
): Record<string, unknown> {
  if (!allowCrossTenant && auth.tenantId) {
    where.tenantId = auth.tenantId
  }
  return where
}
