import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Delete a publishing connection. RLS also scopes this to the owner; the
// explicit user_id filter keeps the 404 path honest.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { connectionId } = await params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('publishing_connections')
    .delete()
    .eq('id', connectionId)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
