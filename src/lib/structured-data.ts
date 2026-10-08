/**
 * Site-wide schema.org entities, and the one place their facts live.
 *
 * Every page refers to the Organization, WebSite and Person by `@id` so an
 * engine sees one entity per thing rather than a fresh, disconnected node on
 * every page.
 *
 * The author split is deliberate: the canonical professional and publishing
 * name is "Michael Jacobs", while the LinkedIn profile displays "Michael
 * Osborne". Name matching cannot join those, so `sameAs` is the explicit
 * statement that the profiles below are one Person. Edit the profile list here
 * and nowhere else.
 */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://app.bylineseo.com').replace(/\/+$/, '')

export const ORG_ID = `${SITE_URL}/#organization`
export const WEBSITE_ID = `${SITE_URL}/#website`

type AuthorProfile = { id: string; name: string; sameAs: string[] }

/** Author documents keyed by their Sanity slug. */
export const AUTHOR_PROFILES: Record<string, AuthorProfile> = {
  'michael-osborne': {
    id: `${SITE_URL}/#michael-jacobs`,
    name: 'Michael Jacobs',
    sameAs: [
      'https://www.amazon.com/stores/Michael-Jacobs/author/B0H7PGQ2ZL',
      'https://www.linkedin.com/in/michael-j-osborne-32bb7957/',
      'https://x.com/MichaelJacobSeo',
      'https://github.com/michaeljacobosborne-png',
    ],
  },
}

/** The founder, used on pages with no specific author. */
export const FOUNDER = AUTHOR_PROFILES['michael-osborne']

/**
 * Reduce a profile URL to its identity: https, no query string, no fragment.
 *
 * A profile URL never needs a query to identify the profile, and pasted ones
 * routinely carry tracking (`ref`, `shoppingPortalEnabled`, `utm_*`, `trk`).
 * Dropping the whole query is stricter than a denylist and cannot miss a new
 * tracking parameter. Unparseable or non-http(s) input returns null.
 */
export function cleanProfileUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  u.protocol = 'https:'
  u.search = ''
  u.hash = ''
  return u.toString()
}

function cleanAll(urls: string[]): string[] {
  return [...new Set(urls.map(cleanProfileUrl).filter((u): u is string => !!u))]
}

export function organizationNode() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Byline',
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-192.png`, width: 192, height: 192 },
    founder: { '@id': FOUNDER.id },
  }
}

export function websiteNode() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: 'Byline',
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-US',
  }
}

/**
 * The Person node for an author. A known author gets the canonical name and
 * cleaned `sameAs`; an unknown one gets only the name the CMS holds, and no
 * `@id`, so it can never be merged into someone else's entity.
 */
export function personNode(author?: { name?: string; slug?: string } | null) {
  const profile = author?.slug ? AUTHOR_PROFILES[author.slug] : undefined
  if (profile) {
    return {
      '@type': 'Person',
      '@id': profile.id,
      name: profile.name,
      sameAs: cleanAll(profile.sameAs),
      worksFor: { '@id': ORG_ID },
    }
  }
  return author?.name ? { '@type': 'Person', name: author.name } : undefined
}

export function breadcrumbNode(pageUrl: string, trail: { name: string; url: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: t.url,
    })),
  }
}

/** Wrap nodes in one `@graph`, dropping empty ones. */
export function graph(...nodes: (object | null | undefined | false)[]) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) }
}

/** Serialise for a `<script type="application/ld+json">`, safe against `</script>` in content. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
