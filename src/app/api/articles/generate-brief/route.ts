import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { message: 'TODO: Generate content brief from brand profile + keywords' },
    { status: 501 }
  )
}
