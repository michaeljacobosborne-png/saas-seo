import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyMarkdownLink(content: string, anchorText: string, url: string): string {
  // Don't double-link — skip if anchorText already appears inside [text](url)
  const alreadyLinked = new RegExp(`\\[${escapeRegex(anchorText)}\\]\\(`, 'i')
  if (alreadyLinked.test(content)) return content

  // Replace first occurrence of anchorText NOT already inside a markdown link
  const pattern = new RegExp(`(?<!\\[)${escapeRegex(anchorText)}(?!\\])`, 'i')
  return content.replace(pattern, `[${anchorText}](${url})`)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { anchorText?: unknown; url?: unknown }
  try {
    body = await request.json() as { anchorText?: unknown; url?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { anchorText, url } = body

  // Validate inputs
  if (!anchorText || typeof anchorText !== 'string' || anchorText.trim().length === 0) {
    return NextResponse.json({ error: 'anchorText must be a non-empty string' }, { status: 400 })
  }
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return NextResponse.json({ error: 'url must be a non-empty string' }, { status: 400 })
  }
  const trimmedUrl = url.trim()
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://') && !trimmedUrl.startsWith('/')) {
    return NextResponse.json({ error: 'url must start with http://, https://, or /' }, { status: 400 })
  }

  // Fetch article — must be owned by current user and have content
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (!article.content) return NextResponse.json({ error: 'Article has no content yet' }, { status: 400 })

  const updatedContent = applyMarkdownLink(article.content as string, anchorText.trim(), trimmedUrl)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('articles')
    .update({ content: updatedContent })
    .eq('id', id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[links/apply] Update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update article content' }, { status: 500 })
  }

  return NextResponse.json({ success: true, content: updatedContent })
}
