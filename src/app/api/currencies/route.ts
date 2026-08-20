import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const currencies = await db.currency.findMany({
      orderBy: { code: 'asc' },
    })
    return NextResponse.json(currencies)
  } catch (error) {
    console.error('List currencies error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const currency = await db.currency.create({
      data: {
        code: body.code,
        name: body.name,
        symbol: body.symbol,
      },
    })
    return NextResponse.json(currency, { status: 201 })
  } catch (error) {
    console.error('Create currency error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
