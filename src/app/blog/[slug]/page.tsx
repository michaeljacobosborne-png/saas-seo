import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { PortableTextBlock } from '@portabletext/types'
import type { Image as SanityImage } from 'sanity'

import { isSanityConfigured } from '@/sanity/env'
import { client } from '@/sanity/lib/client'
import { getPost } from '@/sanity/lib/getPost'
import { urlFor } from '@/sanity/lib/image'
import { postSlugsQuery } from '@/sanity/lib/queries'
import { extractFaqs, readingTime } from '@/sanity/lib/portableText'
import { PortableTextBody } from '../_components/PortableTextBody'

// ISR: regenerate published articles at most hourly.
export const revalidate = 3600

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || 'https://app.bylineseo.com'

type Category = { _id: string; title: string; slug: string }
type Author = {
  _id: string
  name: string
  slug?: string
  image?: SanityImage
  bio?: PortableTextBlock[]
}
type Post = {
  _id: string
  title: string
  slug: string
  excerpt?: string
  publishedAt?: string
  mainImage?: SanityImage & { alt?: string }
  body?: PortableTextBlock[]
  seoTitle?: string
  seoDescription?: string
  author?: Author
  categories?: Category[]
}

// Prerender every published post at build time; new slugs render on first
// request and are cached thereafter (dynamicParams defaults to true).
export async function generateStaticParams() {
  if (!isSanityConfigured) return []
  const slugs = await client.fetch<{ slug: string }[]>(postSlugsQuery)
  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: PageProps<'/blog/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const post = (await getPost(slug)) as Post | null

  if (!post) return { title: 'Post not found' }

  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || ''
  const ogImage = post.mainImage?.asset
    ? urlFor(post.mainImage).width(1200).height(630).fit('crop').url()
    : undefined

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      authors: post.author?.name ? [post.author.name] : undefined,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}

function formatDate(value?: string) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default async function BlogPostPage({
  params,
}: PageProps<'/blog/[slug]'>) {
  const { slug } = await params
  const post = (await getPost(slug)) as Post | null

  if (!post) notFound()

  const body = post.body || []
  const faqs = extractFaqs(body)
  const minutes = readingTime(body)
  const url = `${SITE_URL}/blog/${post.slug}`
  const ogImage = post.mainImage?.asset
    ? urlFor(post.mainImage).width(1200).height(630).fit('crop').url()
    : undefined

  // Article structured data (JSON-LD) for AEO / rich results.
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    image: ogImage ? [ogImage] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: post.author?.name
      ? { '@type': 'Person', name: post.author.name }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: 'Byline',
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }

  const faqJsonLd =
    faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <Link
        href="/blog"
        className="text-sm text-[#B87333] hover:text-[#D4954A] transition-colors"
      >
        ← All articles
      </Link>

      <header className="mt-6">
        {post.categories && post.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
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

        <h1 className="font-[family-name:var(--font-playfair)] text-3xl sm:text-4xl md:text-5xl font-black leading-[1.1] tracking-tight text-[#F7F3EC]">
          {post.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#A89070]">
          {post.author?.name && (
            <span className="flex items-center gap-2">
              {post.author.image?.asset && (
                <Image
                  src={urlFor(post.author.image).width(64).height(64).fit('crop').url()}
                  alt={post.author.name}
                  width={28}
                  height={28}
                  className="rounded-full"
                />
              )}
              <span className="text-[#F7F3EC] font-medium">
                {post.author.name}
              </span>
            </span>
          )}
          {post.publishedAt && (
            <>
              <span className="text-[#7A6555]">·</span>
              <time dateTime={post.publishedAt}>
                {formatDate(post.publishedAt)}
              </time>
            </>
          )}
          <span className="text-[#7A6555]">·</span>
          <span>{minutes} min read</span>
        </div>
      </header>

      {post.mainImage?.asset && (
        <div className="relative mt-8 aspect-[16/9] rounded-2xl overflow-hidden border border-[rgba(184,115,51,0.18)]">
          <Image
            src={urlFor(post.mainImage).width(1600).height(900).fit('crop').auto('format').url()}
            alt={post.mainImage.alt || post.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>
      )}

      <article className="mt-10">
        <PortableTextBody value={body} />
      </article>

      {/* Footer CTA to try Byline */}
      <aside className="mt-16 rounded-2xl border border-[rgba(184,115,51,0.25)] bg-[#231F1B] p-8 text-center">
        <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#F7F3EC]">
          Ready to publish content that ranks?
        </h2>
        <p className="mt-3 text-[#A89070] max-w-md mx-auto leading-relaxed">
          Byline pairs real keyword data with an editorial agent that rewrites
          the sections holding your articles back.
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center mt-6 px-7 py-3.5 rounded-xl text-base font-semibold bg-[#B87333] text-[#1C1917] hover:bg-[#D4954A] transition-colors"
        >
          Try Byline
        </Link>
      </aside>
    </main>
  )
}
