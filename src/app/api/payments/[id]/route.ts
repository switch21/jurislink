import { NextResponse } from 'next/server'

// Payment model removed (OOM constraint). This route returns 404.

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
