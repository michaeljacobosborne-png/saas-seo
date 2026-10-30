import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('title, target_keyword, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (!article.content) return NextResponse.json({ error: 'Article has no content yet' }, { status: 400 })

  // Strip markdown, take first ~600 chars as context
  const contentPreview = article.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .slice(0, 600)
    .trim()

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Write a single meta description for this article. Requirements:
- Exactly 140-155 characters (count carefully)
- Include the target keyword naturally
- Be compelling and specific — give a reason to click
- No quotes, no prefix like "Meta description:", just the text itself

Article title: ${article.title ?? article.target_keyword}
Target keyword: ${article.target_keyword}
Content preview: ${contentPreview}`,
      },
    ],
  })

  const metaDesc = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  return NextResponse.json({ meta_description: metaDesc })
}
