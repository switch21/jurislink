import { db } from '@/lib/db'

interface AuditInput {
  tenantId: string
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Create an audit log entry. Fire-and-forget — errors are logged but never thrown.
 */
export async function createAuditLog(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to create audit log:', error)
  }
}

/**
 * Shorthand to extract IP and User-Agent from a Request.
 */
export function getRequestInfo(request: Request): { ipAddress?: string; userAgent?: string } {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  }
}
