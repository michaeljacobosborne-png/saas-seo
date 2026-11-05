import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Pins the author save path across migration 20261001_brand_author:
 * before it runs, a profile save must not fail and must say the author was not
 * stored; after it runs, the author must be written in one call. Unrelated
 * errors must never be swallowed by the fallback.
 */

const upserts: Record<string, unknown>[] = []
let upsertResults: { error: { message: string } | null }[] = []
let existing: Record<string, unknown> | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: null } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing }) }) }),
      upsert: async (payload: Record<string, unknown>) => {
        upserts.push(payload)
        return upsertResults.shift() ?? { error: null }
      },
    }),
  }),
}))
vi.mock('@/lib/ghl', () => ({ ghlUpsertContact: async () => null, ghlAddTags: async () => {} }))
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: () => {} }))

const MISSING = "Could not find the 'author_name' column of 'brand_profiles' in the schema cache"

async function save(body: Record<string, unknown>) {
  const { POST } = await import('./route')
  const res = await POST(new Request('http://x/api/brand/save', { method: 'POST', body: JSON.stringify(body) }))
  return { status: res.status, json: await res.json() }
}

const FORM = { brand_name: 'Acme', website_url: 'https://acme.io', target_audience: 'Founders' }
const AUTHOR = { author_name: 'Jane Doe', author_credentials: '12 years in payroll', author_url: 'https://acme.io/jane' }

describe('POST /api/brand/save — author fields across the migration', () => {
  beforeEach(() => {
    upserts.length = 0
    upsertResults = []
    existing = null
  })

  it('before the migration: saves the rest of the profile and reports authorSaved:false', async () => {
    upsertResults = [{ error: { message: MISSING } }, { error: null }]
    const r = await save({ ...FORM, ...AUTHOR })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ success: true, authorSaved: false })
    expect(upserts).toHaveLength(2)
    expect(upserts[1]).toMatchObject({ brand_name: 'Acme', target_audience: 'Founders' })
    for (const k of Object.keys(AUTHOR)) expect(upserts[1]).not.toHaveProperty(k)
  })

  it('after the migration: writes the author in one call and reports authorSaved:true', async () => {
    const r = await save({ ...FORM, ...AUTHOR })
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ success: true, authorSaved: true })
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).toMatchObject(AUTHOR)
  })

  it('after the migration: clearing the author in the form clears it (mergeStr form rule)', async () => {
    existing = { brand_name: 'Acme', author_name: 'Jane Doe', author_credentials: 'old' }
    await save({ ...FORM, author_name: 'Jane Doe', author_credentials: '', author_url: '' })
    expect(upserts[0]).toMatchObject({ author_name: 'Jane Doe', author_credentials: null, author_url: null })
  })

  it('never swallows an unrelated error through the fallback', async () => {
    upsertResults = [{ error: { message: 'duplicate key value violates unique constraint' } }]
    const r = await save({ ...FORM, ...AUTHOR })
    expect(r.status).toBe(500)
    expect(upserts).toHaveLength(1)
  })

  it('a save without author fields never touches the author columns', async () => {
    const r = await save(FORM)
    expect(r.json).toEqual({ success: true, authorSaved: false })
    expect(upserts).toHaveLength(1)
    for (const k of Object.keys(AUTHOR)) expect(upserts[0]).not.toHaveProperty(k)
  })
})
