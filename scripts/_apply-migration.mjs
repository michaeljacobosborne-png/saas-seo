import { readFileSync } from 'node:fs'
import pg from 'pg'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const direct = new URL(env.SUPABASE_DB_URL)               // postgresql://postgres:pw@db.<ref>.supabase.co:5432/postgres
const ref = direct.hostname.split('.')[0].replace(/^db\./, '') || direct.hostname.split('.')[1]
const projectRef = direct.hostname.match(/^db\.([^.]+)\./)?.[1]
const password = decodeURIComponent(direct.password)

const sql = readFileSync(new URL('../supabase/migrations/20260608_fix_articles_status_check.sql', import.meta.url), 'utf8')

const hosts = ['aws-0-us-east-2.pooler.supabase.com', 'aws-1-us-east-2.pooler.supabase.com']

async function tryHost(host) {
  const client = new pg.Client({
    host, port: 5432,
    user: `postgres.${projectRef}`,
    password, database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })
  await client.connect()
  return client
}

let client = null
for (const h of hosts) {
  try { client = await tryHost(h); console.log('Connected via', h); break }
  catch (e) { console.log('connect fail', h, '->', e.code || e.message) }
}
if (!client) { console.error('Could not connect via any pooler host'); process.exit(1) }

try {
  const before = await client.query(`select pg_get_constraintdef(oid) as def from pg_constraint where conname='articles_status_check'`)
  console.log('BEFORE:', before.rows[0]?.def ?? '(none)')

  await client.query('begin')
  await client.query(sql)
  await client.query('commit')

  const after = await client.query(`select pg_get_constraintdef(oid) as def from pg_constraint where conname='articles_status_check'`)
  console.log('AFTER: ', after.rows[0]?.def ?? '(none)')
  console.log('Migration applied successfully.')
} catch (e) {
  try { await client.query('rollback') } catch {}
  console.error('FAILED:', e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
