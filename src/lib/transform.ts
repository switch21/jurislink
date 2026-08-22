/**
 * Convert a snake_case string to camelCase.
 */
export function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Convert a camelCase string to snake_case.
 */
export function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

/**
 * Recursively convert all object keys from snake_case to camelCase.
 * Handles Date strings (ISO) by converting to Date objects.
 */
export function toCamelCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj as T
  if (Array.isArray(obj)) return obj.map(toCamelCase) as T
  if (obj instanceof Date) return obj as T
  if (typeof obj === 'object') {
    const out: Record<string, any> = {}
    for (const [key, val] of Object.entries(obj)) {
      out[toCamel(key)] = toCamelCase(val)
    }
    return out as T
  }
  return obj as T
}

/**
 * Recursively convert all object keys from camelCase to snake_case.
 */
export function toSnakeCase<T = any>(obj: any): T {
  if (obj === null || obj === undefined) return obj as T
  if (Array.isArray(obj)) return obj.map(toSnakeCase) as T
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const out: Record<string, any> = {}
    for (const [key, val] of Object.entries(obj)) {
      out[toSnake(key)] = toSnakeCase(val)
    }
    return out as T
  }
  return obj as T
}

// ─── Domain-specific field mappers ───────────────────────────────────

/**
 * Map a Supabase 'users' row to the shape the frontend expects.
 */
export function mapUser(row: any): any {
  const base = toCamelCase(row)
  // Supabase has full_name → frontend expects name
  base.name = row.full_name ?? row.name
  delete base.fullName // avoid duplication
  return base
}

/**
 * Map a Supabase 'clients' row (full_name) to frontend shape (firstName + lastName).
 */
export function mapClient(row: any): any {
  const base = toCamelCase(row)
  const names = (row.full_name || '').split(' ')
  base.firstName = names[0] || ''
  base.lastName = names.slice(1).join(' ') || ''
  return base
}

/**
 * Map a Supabase 'cases' row to frontend shape.
 * - assigned_lawyer_id → assignments array
 * - case_type → type
 * - open_date → createdAt (kept separately as openDate)
 */
export function mapCase(row: any, lawyerMap?: Record<string, any>): any {
  const base = toCamelCase(row)
  // assigned_lawyer_id → assignments array (frontend expects this shape)
  if (row.assigned_lawyer_id && lawyerMap) {
    const lawyer = lawyerMap[row.assigned_lawyer_id]
    base.assignments = [
      {
        userId: row.assigned_lawyer_id,
        user: lawyer
          ? { id: lawyer.id, name: lawyer.full_name, email: lawyer.email }
          : { id: row.assigned_lawyer_id, name: 'Inconnu' },
      },
    ]
  } else {
    base.assignments = []
  }
  // Rename case_type → type (frontend uses 'type')
  if (base.caseType) {
    base.type = base.caseType
  }
  // Map open_date → openDate
  // Map next_deadline → nextDueDate
  if (base.nextDeadline) {
    base.nextDueDate = base.nextDeadline
  }
  return base
}

/**
 * Map a Supabase 'invoices' row to frontend shape.
 * - currency_id → currencyCode (requires join)
 * - Add default values for fields that don't exist in Supabase
 */
export function mapInvoice(row: any, currencyCode?: string): any {
  const base = toCamelCase(row)
  base.currencyCode = currencyCode || 'XAF'
  // Frontend expects these optional fields
  base.reference = row.reference || `INV-${row.id?.slice(0, 8)}`
  base.type = base.type || 'facture'
  base.notes = row.notes || ''
  base.paymentMethod = null
  base.billingType = null
  base.paidAmount = null
  base.paidDate = null
  return base
}

/**
 * Map a Supabase 'events' row to frontend shape.
 */
export function mapEvent(row: any): any {
  const base = toCamelCase(row)
  base.startTime = row.start_time
  base.endTime = row.end_time
  return base
}

/**
 * Map a Supabase 'notifications' row to frontend shape.
 * - 'read' (reserved word in JS) → isRead
 */
export function mapNotification(row: any): any {
  const base = toCamelCase(row)
  base.isRead = row.read ?? false
  delete base.read
  return base
}

/**
 * Map a Supabase 'messages' row to frontend shape.
 * - read_status → isRead
 */
export function mapMessage(row: any): any {
  const base = toCamelCase(row)
  base.isRead = row.read_status ?? false
  delete base.readStatus
  return base
}

/**
 * Map a Supabase 'tasks' row to frontend shape.
 */
export function mapTask(row: any): any {
  const base = toCamelCase(row)
  // Supabase task_status enum: todo, in_progress, done
  // Frontend expects: a_faire, en_cours, terminee, annulee
  const statusMap: Record<string, string> = {
    todo: 'a_faire',
    in_progress: 'en_cours',
    done: 'terminee',
  }
  if (base.status && statusMap[base.status]) {
    base.status = statusMap[base.status]
  }
  // Map assignee_id → userId (the frontend's 'user' field)
  // Map due_date → dueDate (already handled by toCamelCase)
  return base
}

/**
 * Map a Supabase 'tenants' row to frontend shape.
 */
export function mapTenant(row: any): any {
  const base = toCamelCase(row)
  base.slug = row.name
    ? row.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    : ''
  return base
}
