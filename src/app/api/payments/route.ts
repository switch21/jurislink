import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([])
}

export async function POST() {
  return NextResponse.json({ error: 'Payments table not yet implemented in Supabase' }, { status: 501 })
}
