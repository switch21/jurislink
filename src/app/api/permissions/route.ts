import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ROLES = [
  'root_admin',
  'associate',
  'firm_admin',
  'lawyer',
  'jurist',
  'assistant',
  'accountant',
  'client',
]

const RESOURCES = [
  'case',
  'client',
  'document',
  'invoice',
  'task',
  'event',
  'audit',
  'user',
  'payment',
  'report',
  'setting',
]

const ACTIONS = [
  'view',
  'create',
  'edit',
  'delete',
  'export',
  'manage_permissions',
]

// Default permission matrix: true = allowed
const DEFAULT_PERMISSIONS: Record<string, Record<string, Record<string, boolean>>> = {
  root_admin: {
    case:           { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    client:         { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    document:       { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    invoice:        { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    task:           { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    event:          { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    audit:          { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    user:           { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    payment:        { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    report:         { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
    setting:        { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: true },
  },
  associate: {
    case:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    client:         { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    document:       { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: false },
    invoice:        { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    task:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:          { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:          { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    user:           { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment:        { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    report:         { view: true, create: true, edit: false, delete: false, export: true, manage_permissions: false },
    setting:        { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  firm_admin: {
    case:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    client:         { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    document:       { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: false },
    invoice:        { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    task:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:          { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:          { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    user:           { view: true, create: true, edit: true, delete: false, export: false, manage_permissions: false },
    payment:        { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    report:         { view: true, create: true, edit: false, delete: false, export: true, manage_permissions: false },
    setting:        { view: true, create: false, edit: true, delete: false, export: false, manage_permissions: false },
  },
  lawyer: {
    case:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    client:         { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    document:       { view: true, create: true, edit: true, delete: true, export: true, manage_permissions: false },
    invoice:        { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    task:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:          { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:          { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:           { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:         { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    setting:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  jurist: {
    case:           { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    client:         { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    document:       { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    invoice:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    task:           { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    event:          { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    audit:          { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:           { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:         { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    setting:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  assistant: {
    case:           { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    client:         { view: true, create: false, edit: true, delete: false, export: true, manage_permissions: false },
    document:       { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    invoice:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    task:           { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    event:          { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    audit:          { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:           { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:         { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    setting:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  accountant: {
    case:           { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    client:         { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    document:       { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    invoice:        { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    task:           { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    event:          { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    audit:          { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:           { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment:        { view: true, create: true, edit: true, delete: false, export: true, manage_permissions: false },
    report:         { view: true, create: true, edit: false, delete: false, export: true, manage_permissions: false },
    setting:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
  client: {
    case:           { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    client:         { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    document:       { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    invoice:        { view: true, create: false, edit: false, delete: false, export: true, manage_permissions: false },
    task:           { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    event:          { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    audit:          { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    user:           { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    payment:        { view: true, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    report:         { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
    setting:        { view: false, create: false, edit: false, delete: false, export: false, manage_permissions: false },
  },
}

function getDefaultMatrix() {
  const matrix: Array<{
    role: string
    resource: string
    action: string
    allowed: boolean
  }> = []
  for (const role of ROLES) {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        matrix.push({
          role,
          resource,
          action,
          allowed: DEFAULT_PERMISSIONS[role]?.[resource]?.[action] ?? false,
        })
      }
    }
  }
  return matrix
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')

    const where: Record<string, unknown> = {}
    if (role) where.role = role

    const count = await db.permission.count()

    // If no permissions exist in DB, return default matrix
    if (count === 0) {
      const defaults = getDefaultMatrix()
      return NextResponse.json({ source: 'default', permissions: defaults })
    }

    const permissions = await db.permission.findMany({ where })
    return NextResponse.json({ source: 'database', permissions })
  } catch (error) {
    console.error('List permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { role, resource, action, allowed } = body

    if (!role || !resource || !action) {
      return NextResponse.json(
        { error: 'role, resource, and action are required' },
        { status: 400 }
      )
    }

    // Upsert: if exists, update; if not, create
    const permission = await db.permission.upsert({
      where: {
        role_resource_action: { role, resource, action },
      },
      update: {
        allowed: allowed ?? false,
      },
      create: {
        role,
        resource,
        action,
        allowed: allowed ?? false,
      },
    })

    return NextResponse.json(permission)
  } catch (error) {
    console.error('Upsert permission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
