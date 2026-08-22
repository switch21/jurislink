import { NextResponse } from 'next/server'

const ROLES = ['root_admin', 'firm_admin', 'lawyer', 'secretary', 'client', 'collaborator', 'accountant', 'trainee']
const RESOURCES = ['case', 'client', 'document', 'invoice', 'task', 'event', 'audit', 'user', 'payment', 'report', 'setting']
const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'manage_permissions']

function getDefaultMatrix() {
  const matrix: Array<{ role: string; resource: string; action: string; allowed: boolean }> = []
  for (const role of ROLES) {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        let allowed = false
        if (role === 'root_admin') {
          allowed = true
        } else if (role === 'firm_admin' || role === 'collaborator') {
          allowed = action !== 'delete' && action !== 'manage_permissions'
        } else if (role === 'lawyer') {
          allowed = action !== 'delete' && action !== 'manage_permissions'
        } else if (role === 'secretary') {
          allowed = ['view', 'export'].includes(action) ||
            (['document', 'task', 'event'].includes(resource) && ['create', 'edit'].includes(action)) ||
            (resource === 'client' && action === 'edit')
        } else if (role === 'accountant') {
          allowed = action === 'view' ||
            (['document', 'invoice', 'payment'].includes(resource) && ['create', 'edit'].includes(action)) ||
            (['client', 'document', 'invoice', 'payment', 'report'].includes(resource) && action === 'export')
        } else if (role === 'trainee') {
          allowed = action === 'view' || (resource === 'document' && action === 'export')
        } else if (role === 'client') {
          const viewable = ['case', 'document', 'invoice', 'event', 'payment']
          const exportable = ['case', 'document', 'invoice']
          allowed = (viewable.includes(resource) && action === 'view') ||
            (exportable.includes(resource) && action === 'export')
        }
        matrix.push({ role, resource, action, allowed })
      }
    }
  }
  return matrix
}

export async function GET() {
  try {
    return NextResponse.json({ source: 'default', permissions: getDefaultMatrix() })
  } catch (error) {
    console.error('List permissions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Permissions table not yet implemented in Supabase' }, { status: 501 })
}
