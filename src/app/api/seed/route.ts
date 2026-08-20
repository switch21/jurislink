import { NextResponse } from 'next/server'

export async function POST() {
  try {
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
