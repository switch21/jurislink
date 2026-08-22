import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'JurisLink V2 API', status: 'ok' })
}
