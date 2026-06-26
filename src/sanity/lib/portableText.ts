import type { PortableTextBlock } from '@portabletext/types'

type FaqItem = { question: string; answer: string }

// Pull plain text out of Portable Text blocks for reading-time estimation.
function blocksToPlainText(body: PortableTextBlock[] = []): string {
  return body
    .filter((block) => block._type === 'block' && Array.isArray(block.children))
    .map((block) =>
      (block.children as { text?: string }[])
        .map((child) => child.text || '')
        .join('')
    )
    .join(' ')
}

// Estimate reading time in minutes (~225 words/min), minimum 1.
export function readingTime(body: PortableTextBlock[] = []): number {
  const words = blocksToPlainText(body).trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 225))
}

// Collect FAQ blocks from the body for the FAQPage JSON-LD.
export function extractFaqs(body: PortableTextBlock[] = []): FaqItem[] {
  return body
    .filter((block) => block._type === 'faq')
    .map((block) => ({
      question: (block as unknown as FaqItem).question,
      answer: (block as unknown as FaqItem).answer,
    }))
    .filter((f) => f.question && f.answer)
}
