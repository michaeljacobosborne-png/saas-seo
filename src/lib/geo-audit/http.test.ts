import http from 'node:http'
import zlib from 'node:zlib'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { httpFetch } from './http'

let server: http.Server
let base = ''
const seenUA: string[] = []

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seenUA.push(String(req.headers['user-agent'] ?? ''))
    if (req.url === '/redirect') {
      res.writeHead(301, { location: '/gz' })
      return res.end()
    }
    if (req.url === '/gz') {
      res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
      return res.end(zlib.gzipSync('<html><body>hello compressed</body></html>'))
    }
    if (req.url === '/forbidden') {
      res.writeHead(403, { 'content-type': 'text/html' })
      return res.end('no')
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<html>plain</html>')
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

describe('httpFetch (node:http transport for the engine)', () => {
  it('follows redirects, decodes gzip, and reports the final URL', async () => {
    const res = await httpFetch(`${base}/redirect`, { redirect: 'follow' })
    expect(res.status).toBe(200)
    expect(res.url).toBe(`${base}/gz`)
    expect(await res.text()).toContain('hello compressed')
    expect(res.headers.get('content-encoding')).toBeNull()
  })

  it('passes the caller user-agent through unchanged', async () => {
    await httpFetch(`${base}/`, { headers: { 'User-Agent': 'GPTBot/1.2 test' } })
    expect(seenUA.at(-1)).toBe('GPTBot/1.2 test')
  })

  it('returns non-2xx responses rather than throwing', async () => {
    const res = await httpFetch(`${base}/forbidden`)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(403)
  })

  it('honours an abort signal', async () => {
    const c = new AbortController()
    c.abort()
    await expect(httpFetch(`${base}/`, { signal: c.signal })).rejects.toBeTruthy()
  })
})
