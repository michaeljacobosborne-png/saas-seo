import { NextResponse } from 'next/server'
import { marked } from 'marked'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encrypt'
import { normalizeSiteUrl, wpAuthHeader, type WpCredentials } from '@/lib/publishing'

export const runtime = 'nodejs'
export const maxDuration = 30

// Publish an article to WordPress as a draft post. Article content is stored as
// Markdown, so it's rendered to HTML here before posting.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let body: { connectionId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const connectionId = body.connectionId
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId is required' }, { status: 400 })
  }

  // Load the article (scoped to the user).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: article } = await (supabase as any)
    .from('articles')
    .select('id, title, target_keyword, content, meta_description')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (!article.content) {
    return NextResponse.json({ error: 'This article has no content to publish.' }, { status: 400 })
  }

  // Load the connection (scoped to the user).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conn } = await (supabase as any)
    .from('publishing_connections')
    .select('id, platform, site_url, credentials')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  if (conn.platform !== 'wordpress') {
    return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 })
  }

  let creds: WpCredentials
  try {
    creds = JSON.parse(decrypt(conn.credentials))
  } catch {
    return NextResponse.json({ error: 'Stored credentials are corrupt. Please reconnect the site.' }, { status: 500 })
  }

  const html = await marked.parse(article.content)
  const title = article.title || article.target_keyword || 'Untitled'
  const base = normalizeSiteUrl(conn.site_url)

  let res: Response
  try {
    res = await fetch(`${base}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: wpAuthHeader(creds.username, creds.appPassword),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title,
        content: html,
        status: 'draft',
        excerpt: article.meta_description ?? '',
      }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return NextResponse.json({ error: 'WordPress took too long to respond. Please try again.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Could not reach the WordPress site. Please try again.' }, { status: 502 })
  }

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json({ error: 'WordPress rejected the credentials. Re-test the connection.' }, { status: 400 })
  }
  if (!res.ok) {
    return NextResponse.json({ error: `WordPress returned an error (${res.status}).` }, { status: 502 })
  }

  let post: { id?: number; link?: string }
  try {
    post = await res.json()
  } catch {
    return NextResponse.json({ error: 'Unexpected response from WordPress.' }, { status: 502 })
  }

  const postUrl = post.link ?? `${base}/?p=${post.id ?? ''}`

  // Record the publish on the article. Cast through any — these columns aren't
  // in the generated Supabase types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('articles')
    .update({
      published_url: postUrl,
      published_at: new Date().toISOString(),
      wp_post_id: post.id ?? null,
      publish_channel: 'wordpress',
    })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true, url: postUrl })
}
