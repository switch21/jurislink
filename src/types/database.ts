/**
 * JurisLink V2 — Database Types
 * Matches the Supabase PostgreSQL schema (snake_case columns
 * are converted to camelCase at the API boundary).
 */

// ─── Enums ───────────────────────────────────────────────────────────
export type UserRole =
  | 'root_admin'
  | 'firm_admin'
  | 'lawyer'
  | 'secretary'
  | 'client'
  | 'collaborator'
  | 'accountant'
  | 'trainee'

export type CaseStatus =
  | 'open'
  | 'closed'
  | 'pending'
  | 'archived'
  | 'new'
  | 'in_progress'

export type CaseOutcome =
  | 'ongoing'
  | 'won'
  | 'lost'
  | 'settled'
  | 'dismissed'

export type PaymentStatus = 'pending' | 'partial' | 'paid'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'

export type CriticalityLevel = 'low' | 'medium' | 'high' | 'urgent'

// ─── Tables (camelCase, as returned by API routes) ──────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  language: string | null
  timezone: string | null
  phone: string | null
  email: string | null
  address: string | null
  niu: string | null
  plan: string
  maxUsers: number
  maxStorageGb: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  tenantId: string | null
  email: string
  name: string
  phone: string | null
  avatarUrl: string | null
  role: UserRole
  isActive: boolean
  preferredLanguage: string | null
  createdAt: string
  updatedAt: string
  // Joined at runtime
  tenant?: Tenant
}

export interface Client {
  id: string
  tenantId: string
  fullName: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  niu: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { cases: number }
}

export interface Case {
  id: string
  tenantId: string
  clientId: string
  title: string
  description: string | null
  reference: string | null
  type: string
  status: string
  outcome: string | null
  paymentStatus: string | null
  priority: string | null
  isSecret: boolean
  openDate: string | null
  nextDeadline: string | null
  createdAt: string
  updatedAt: string
  // Joined at runtime
  client?: { id: string; firstName?: string; lastName?: string; fullName?: string }
  assignments?: CaseAssignment[]
  notes?: CaseNote[]
  documents?: Document[]
  events?: Event[]
  tasks?: Task[]
}

export interface CaseAssignment {
  id?: string
  userId: string
  user?: { id: string; name?: string; email?: string }
}

export interface CaseNote {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  caseId: string
  userId?: string
  user?: { id: string; name?: string }
}

export interface Task {
  id: string
  tenantId: string
  caseId: string
  assigneeId: string | null
  title: string
  description: string | null
  dueDate: string | null
  status: string
  priority: string | null
  createdAt: string
  updatedAt: string
  // Joined at runtime
  user?: { id: string; name?: string; email?: string }
  creator?: { id: string; name?: string }
  case?: { id: string; reference?: string; title?: string }
  event?: { id: string; title?: string }
}

export interface Document {
  id: string
  tenantId: string
  caseId: string | null
  uploaderId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string | null
  tags: string[] | null
  version: number
  isConfidential: boolean
  deletedAt: string | null
  createdAt: string
  // Joined at runtime
  user?: { id: string; name?: string }
  case?: { id: string; reference?: string; title?: string }
}

export interface Event {
  id: string
  tenantId: string
  caseId: string | null
  title: string
  description: string | null
  startTime: string
  endTime: string
  reminderSent: boolean
  criticality: string
  eventType: string | null
  createdAt: string
  // Joined at runtime
  assignments?: EventAssignment[]
  case?: { id: string; reference?: string; title?: string }
}

export interface EventAssignment {
  id?: string
  userId: string
  user?: { id: string; name?: string }
}

export interface Invoice {
  id: string
  tenantId: string
  caseId: string | null
  clientId: string
  amount: number
  currencyId: string
  currencyCode: string
  status: string
  issueDate: string | null
  dueDate: string | null
  reference: string
  type: string
  notes: string | null
  paymentMethod: string | null
  billingType: string | null
  paidAmount: number | null
  paidDate: string | null
  createdAt: string
  updatedAt: string
  // Joined at runtime
  client?: { id: string; firstName?: string; lastName?: string; company?: string }
  case?: { id: string; reference?: string; title?: string }
}

export interface Message {
  id: string
  tenantId: string
  senderId: string
  receiverId: string
  caseId: string | null
  content: string
  isRead: boolean
  createdAt: string
  // Joined at runtime
  sender?: { id: string; name?: string; avatarUrl?: string }
  receiver?: { id: string; name?: string; avatarUrl?: string }
}

export interface Notification {
  id: string
  tenantId: string
  userId: string | null
  title: string
  message: string
  type: string | null
  isRead: boolean
  eventId: string | null
  category: string | null
  resourceType: string | null
  resourceId: string | null
  createdAt: string
  // Joined at runtime
  event?: { id: string; title?: string }
}

export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  createdAt?: string
  updatedAt?: string
}

export interface AuditLog {
  id: string
  tenantId: string
  userId: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  metadata: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: { id: string; name?: string; email?: string }
}

export interface DashboardStats {
  totalCases: number
  activeCases: number
  totalClients: number
  upcomingEvents: number
  unpaidInvoices: number
  totalRevenue: number
  paidInvoices: number
  casesByStatus: Record<string, number>
  casesByType: Record<string, number>
  recentActivity: AuditLog[]
 upcomingEventsList: Event[]
  urgencies: any[]
  overdueInvoices: Invoice[]
  urgentTasks: Task[]
  upcomingEventsEnhanced: Event[]
  myTasks: Task[]
  financial: {
    revenueThisMonth: number
    revenueLastMonth: number
    collectedThisMonth: number
    collectedLastMonth: number
    toRecover: number
    overdueInvoicesCount: number
    topClients: any[]
    monthlyRevenue: any[]
    methodBreakdown: any[]
  }
}
