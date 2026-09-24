// This endpoint has been retired — it had no callers and accepted unauthenticated
// requests. Any lingering external calls will now receive a 404.
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
