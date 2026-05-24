import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { message: 'TODO: Google Ads Keyword Planner integration' },
    { status: 501 }
  )
}
