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

function blockText(block: PortableTextBlock): string {
  if (block._type !== 'block' || !Array.isArray(block.children)) return ''
  return (block.children as { text?: string }[]).map((c) => c.text || '').join('').trim()
}

const FAQ_HEADING = /\b(faqs?|frequently asked questions?)\b/i

/**
 * Collect question/answer pairs for the FAQPage JSON-LD.
 *
 * Prefers `faq` objects. Posts written before those existed carry their FAQ as
 * an h2 ("Frequently Asked Questions", "FAQs About …") followed by h3/h4
 * questions, so when there are no `faq` objects that visible section is read
 * instead: each question heading up to the next heading is one answer, and the
 * section ends at the next h2. Only text that is on the page is emitted.
 */
export function extractFaqs(body: PortableTextBlock[] = []): FaqItem[] {
  const objects = body
    .filter((block) => block._type === 'faq')
    .map((block) => ({
      question: (block as unknown as FaqItem).question,
      answer: (block as unknown as FaqItem).answer,
    }))
    .filter((f) => f.question && f.answer)
  if (objects.length) return objects

  const start = body.findIndex((b) => b._type === 'block' && b.style === 'h2' && FAQ_HEADING.test(blockText(b)))
  if (start < 0) return []

  const faqs: FaqItem[] = []
  let current: { question: string; answer: string[] } | null = null
  const flush = () => {
    if (current && current.answer.length) faqs.push({ question: current.question, answer: current.answer.join('\n\n') })
    current = null
  }
  for (const block of body.slice(start + 1)) {
    const style = block._type === 'block' ? block.style : undefined
    if (style === 'h2') break
    if (style === 'h3' || style === 'h4') {
      flush()
      current = { question: blockText(block), answer: [] }
      continue
    }
    const text = blockText(block)
    if (current && text) current.answer.push(text)
  }
  flush()
  return faqs.filter((f) => f.question)
}
