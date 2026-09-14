import { PortableText, type PortableTextComponents } from '@portabletext/react'
import type { PortableTextBlock } from '@portabletext/types'
import Image from 'next/image'

import { urlFor } from '@/sanity/lib/image'

const components: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h2 className="font-[family-name:var(--font-playfair)] text-2xl sm:text-3xl font-bold text-[var(--cream)] mt-12 mb-4">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-[family-name:var(--font-playfair)] text-xl sm:text-2xl font-bold text-[var(--cream)] mt-10 mb-3">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-lg font-semibold text-[var(--cream)] mt-8 mb-2">
        {children}
      </h4>
    ),
    normal: ({ children }) => (
      <p className="text-[var(--cream-dim)] leading-relaxed my-5 text-[1.0625rem]">
        {children}
      </p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-[var(--copper)] pl-5 my-6 italic text-[var(--cream-dim)]">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-6 my-5 space-y-2 text-[var(--cream-dim)]">
        {children}
      </ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal pl-6 my-5 space-y-2 text-[var(--cream-dim)]">
        {children}
      </ol>
    ),
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-semibold text-[var(--cream)]">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ children, value }) => {
      const href = (value?.href as string) || '#'
      const external = /^https?:\/\//.test(href)
      return (
        <a
          href={href}
          className="text-[var(--copper-lt)] underline underline-offset-2 hover:text-[var(--copper)] transition-colors"
          {...(external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null
      const url = urlFor(value).width(1400).fit('max').auto('format').url()
      return (
        <figure className="my-8">
          <Image
            src={url}
            alt={value.alt || ''}
            width={1400}
            height={900}
            sizes="(max-width: 768px) 100vw, 768px"
            className="rounded-xl w-full h-auto border border-[var(--border)]"
          />
          {value.caption && (
            <figcaption className="text-center text-sm text-[var(--cream-faint)] mt-2">
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },
    faq: ({ value }) => (
      <details className="group my-3 rounded-lg border border-[var(--border)] bg-[var(--ink-card)] p-4 open:bg-[var(--ink-card)]">
        <summary className="cursor-pointer list-none font-semibold text-[var(--cream)] flex justify-between items-center gap-3">
          <span>{value.question}</span>
          <span className="text-[var(--copper)] transition-transform group-open:rotate-45 text-xl leading-none">
            +
          </span>
        </summary>
        <p className="mt-3 text-[var(--cream-dim)] leading-relaxed whitespace-pre-line">
          {value.answer}
        </p>
      </details>
    ),
  },
}

export function PortableTextBody({ value }: { value: PortableTextBlock[] }) {
  return <PortableText value={value} components={components} />
}
