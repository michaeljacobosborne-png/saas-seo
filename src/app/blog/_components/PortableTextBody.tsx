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
    // Semantic table (DECISIONS 30): <table>, <caption>, <thead> with <th scope="col">,
    // <tbody>. Never a div grid: a real table is what AI systems and our own
    // engine can extract. Scrolls inside its own box on a phone.
    table: ({ value }) => {
      const header: string[] = value?.header ?? []
      const rows: { _key?: string; cells?: string[] }[] = value?.rows ?? []
      if (!header.length) return null
      return (
        <div className="my-8 overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full border-collapse text-left text-[0.95rem]">
            {value?.caption && (
              <caption className="caption-top px-4 pt-3 pb-2 text-left text-sm text-[var(--cream-faint)]">{value.caption}</caption>
            )}
            <thead className="bg-[var(--ink-card)]">
              <tr>
                {header.map((h, i) => (
                  <th key={i} scope="col" className="px-4 py-3 font-semibold text-[var(--cream)] border-b border-[var(--border)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r._key ?? ri} className="border-b border-[var(--border)] last:border-b-0">
                  {(r.cells ?? []).map((c, ci) => (
                    <td key={ci} className="px-4 py-3 align-top text-[var(--cream-dim)]">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

/**
 * The page renders the post title as its one H1. Generated posts used to start
 * their body with "# Title" too, which doubled the H1 (generator audit
 * 2026-10-02, 4 of 5 posts). Drop a body H1 that opens the post, and demote
 * any other body H1 to H2, so existing content renders with one H1.
 */
export function withoutBodyH1(blocks: PortableTextBlock[]): PortableTextBlock[] {
  const out: PortableTextBlock[] = []
  let first = true
  for (const b of blocks ?? []) {
    if (b._type === 'block' && b.style === 'h1') {
      if (first) {
        first = false
        continue
      }
      out.push({ ...b, style: 'h2' })
      continue
    }
    first = false
    out.push(b)
  }
  return out
}

export function PortableTextBody({ value }: { value: PortableTextBlock[] }) {
  return <PortableText value={withoutBodyH1(value)} components={components} />
}
