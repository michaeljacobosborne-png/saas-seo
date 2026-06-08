import Link from 'next/link'
import Image from 'next/image'
import type { Image as SanityImage } from 'sanity'

import { isSanityConfigured } from '@/sanity/env'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { postsListQuery } from '@/sanity/lib/queries'

// ISR: rebuild this page at most once an hour without a full redeploy.
export const revalidate = 3600

type Category = { _id: string; title: string; slug: string }
type PostCard = {
  _id: string
  title: string
  slug: string
  excerpt?: string
  publishedAt?: string
  mainImage?: SanityImage & { alt?: string }
  categories?: Category[]
}

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// Fetch the post list, degrading to an empty list if Sanity is unconfigured or
// the request fails (network, auth, misconfig) so the build/page never crashes.
async function getPosts(): Promise<PostCard[]> {
  if (!isSanityConfigured) return []
  try {
    return await client.fetch<PostCard[]>(postsListQuery)
  } catch (err) {
    console.warn('[blog] list page: Sanity fetch failed', err)
    return []
  }
}

export default async function BlogIndexPage() {
  const posts = await getPosts()

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <header className="max-w-2xl mb-14">
        <p className="text-xs uppercase tracking-[0.2em] text-[#B87333] font-medium mb-3">
          The Byline Blog
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-4xl sm:text-5xl font-black tracking-tight">
          Know what ranks. Say what matters.
        </h1>
        <p className="mt-4 text-lg text-[#A89070] leading-relaxed">
          Practical guides on SEO, content operations, and answer-engine
          optimization from the team building Byline.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-[#7A6555]">No posts published yet. Check back soon.</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post._id}
              className="group flex flex-col rounded-2xl border border-[rgba(184,115,51,0.18)] bg-[#231F1B] overflow-hidden hover:border-[rgba(184,115,51,0.45)] transition-colors"
            >
              <Link href={`/blog/${post.slug}`} className="flex flex-col h-full">
                <div className="relative aspect-[16/9] bg-[#16140f] overflow-hidden">
                  {post.mainImage?.asset ? (
                    <Image
                      src={urlFor(post.mainImage)
                        .width(800)
                        .height(450)
                        .fit('crop')
                        .auto('format')
                        .url()}
                      alt={post.mainImage.alt || post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[#B87333]/40 font-[family-name:var(--font-playfair)] text-3xl font-black">
                      byline<span className="text-[#B87333]/60">.</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col flex-1 p-6">
                  {post.categories && post.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.categories.map((cat) => (
                        <span
                          key={cat._id}
                          className="text-[0.6875rem] uppercase tracking-wider text-[#B87333] bg-[rgba(184,115,51,0.1)] px-2 py-0.5 rounded-full"
                        >
                          {cat.title}
                        </span>
                      ))}
                    </div>
                  )}

                  <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold leading-snug text-[#F7F3EC] group-hover:text-[#D4954A] transition-colors">
                    {post.title}
                  </h2>

                  {post.excerpt && (
                    <p className="mt-3 text-sm text-[#A89070] leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}

                  <div className="mt-auto pt-5 flex items-center justify-between text-xs text-[#7A6555]">
                    <time dateTime={post.publishedAt}>
                      {formatDate(post.publishedAt)}
                    </time>
                    <span className="text-[#B87333] font-medium group-hover:translate-x-0.5 transition-transform">
                      Read more →
                    </span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
