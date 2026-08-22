import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json([])
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Case notes table not yet implemented in Supabase' }, { status: 501 })
}