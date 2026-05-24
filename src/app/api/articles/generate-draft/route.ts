import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { message: 'TODO: Generate full article draft' },
    { status: 501 }
  )
}
