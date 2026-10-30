import { describe, expect, it } from 'vitest'
import type { PortableTextBlock } from '@portabletext/types'
import { AUTHOR_PROFILES, cleanProfileUrl, graph, jsonLdString, personNode } from './structured-data'
import { extractFaqs } from '@/sanity/lib/portableText'

describe('cleanProfileUrl', () => {
  it('strips tracking parameters and fragments', () => {
    expect(
      cleanProfileUrl('https://www.amazon.com/stores/Michael-Jacobs/author/B0H7PGQ2ZL?ref=ap_rdr&shoppingPortalEnabled=true#x'),
    ).toBe('https://www.amazon.com/stores/Michael-Jacobs/author/B0H7PGQ2ZL')
    expect(cleanProfileUrl(' http://x.com/MichaelJacobSeo?s=21&t=abc ')).toBe('https://x.com/MichaelJacobSeo')
    expect(cleanProfileUrl('https://www.linkedin.com/in/michael-j-osborne-32bb7957/?utm_source=share&trk=p')).toBe(
      'https://www.linkedin.com/in/michael-j-osborne-32bb7957/',
    )
  })

  it('rejects junk', () => {
    expect(cleanProfileUrl('not a url')).toBeNull()
    expect(cleanProfileUrl('javascript:alert(1)')).toBeNull()
  })
})

describe('personNode', () => {
  it('gives the known author the canonical name and all four clean profiles', () => {
    const p = personNode({ name: 'Michael Osborne', slug: 'michael-osborne' })!
    expect(p.name).toBe('Michael Jacobs')
    expect('sameAs' in p && p.sameAs).toEqual([
      'https://www.amazon.com/stores/Michael-Jacobs/author/B0H7PGQ2ZL',
      'https://www.linkedin.com/in/michael-j-osborne-32bb7957/',
      'https://x.com/MichaelJacobSeo',
      'https://github.com/michaeljacobosborne-png',
    ])
  })

  it('never puts a query string into sameAs, even if one is pasted into the config', () => {
    const original = AUTHOR_PROFILES['michael-osborne'].sameAs
    AUTHOR_PROFILES['michael-osborne'].sameAs = [...original, 'https://www.amazon.com/stores/Michael-Jacobs/author/B0H7PGQ2ZL?ref=ap_rdr']
    try {
      const p = personNode({ slug: 'michael-osborne' })!
      const sameAs = ('sameAs' in p && p.sameAs) || []
      expect(sameAs.some((u) => u.includes('?'))).toBe(false)
      expect(sameAs).toHaveLength(4)
    } finally {
      AUTHOR_PROFILES['michael-osborne'].sameAs = original
    }
  })

  it('does not attach an @id or sameAs to an unknown author', () => {
    expect(personNode({ name: 'Guest Writer', slug: 'guest' })).toEqual({ '@type': 'Person', name: 'Guest Writer' })
    expect(personNode(null)).toBeUndefined()
  })
})

describe('graph / jsonLdString', () => {
  it('drops empty nodes and escapes </script>', () => {
    const g = graph({ a: 1 }, null, false, undefined)
    expect(g['@graph']).toHaveLength(1)
    expect(jsonLdString({ t: '</script><b>' })).not.toContain('</script>')
  })
})

const block = (style: string, text: string, key = Math.random().toString(36).slice(2)) =>
  ({ _type: 'block', _key: key, style, children: [{ _type: 'span', _key: 's', text }], markDefs: [] }) as PortableTextBlock

describe('extractFaqs', () => {
  it('prefers faq objects', () => {
    const body = [
      { _type: 'faq', _key: 'f', question: 'Q?', answer: 'A.' } as unknown as PortableTextBlock,
      block('h2', 'Frequently Asked Questions'),
      block('h3', 'Other?'),
      block('normal', 'Other answer.'),
    ]
    expect(extractFaqs(body)).toEqual([{ question: 'Q?', answer: 'A.' }])
  })

  it('reads a visible FAQ heading section, stopping at the next h2', () => {
    const body = [
      block('h2', 'Intro'),
      block('h3', 'Not an FAQ?'),
      block('normal', 'Body text.'),
      block('h2', 'FAQs About AI SEO Tools'),
      block('h3', 'Is it fast?'),
      block('normal', 'Yes.'),
      block('normal', 'Very.'),
      block('h3', 'Empty question?'),
      block('h4', 'Is it cheap?'),
      block('normal', 'From $49.'),
      block('h2', 'Conclusion'),
      block('h3', 'After?'),
      block('normal', 'Ignored.'),
    ]
    expect(extractFaqs(body)).toEqual([
      { question: 'Is it fast?', answer: 'Yes.\n\nVery.' },
      { question: 'Is it cheap?', answer: 'From $49.' },
    ])
  })

  it('returns nothing without an FAQ section', () => {
    expect(extractFaqs([block('h2', 'Intro'), block('h3', 'Why?'), block('normal', 'Because.')])).toEqual([])
  })
})
