// Shared-link card for each blog post, built from its title (src/lib/og/card.tsx).
// Every post gets one automatically; nobody has to make an image file.
import { renderCard } from '@/lib/og/card'
import { getPost } from '@/sanity/lib/getPost'

export const alt = 'A post on the Byline blog'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = (await getPost(slug).catch(() => null)) as { title?: string } | null
  return renderCard({
    kicker: 'Byline blog',
    title: post?.title ?? 'The Byline blog',
    descriptor: 'By Michael Jacobs',
  })
}
