/**
 * Load the study populations from their CSV files.
 *
 * The harness adds nothing to the pre-registered rule: sites are taken in file
 * order, a duplicate of a site already in the run is marked (and counted, and
 * published), and nothing is ever dropped for its result.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { domainOf } from '@/lib/plans'

export interface PopulationConfig {
  id: string
  label: string
  file: string
  nameColumn: string
  urlColumn: string
  /** The rank column, when the file has one; otherwise file order. */
  rankColumn?: string
  /** Part of the default run. A later population is added by flipping this or passing --populations. */
  include: boolean
}

export interface Site {
  /** Unique within a run: population id plus the registrable domain. */
  key: string
  population: string
  rank: number
  name: string
  url: string
  domain: string
}

export interface LoadedPopulation {
  config: PopulationConfig
  sites: Site[]
  /** sha256 of the file as read, so the published methodology can name the exact input. */
  fileSha256: string
  rows: number
}

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  return rows
}

export function loadPopulation(config: PopulationConfig): LoadedPopulation {
  const raw = readFileSync(config.file)
  const rows = parseCsv(raw.toString('utf8'))
  const header = rows[0] ?? []
  const col = (name: string) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`${config.file}: no column "${name}". Columns: ${header.join(', ')}`)
    return i
  }
  const nameI = col(config.nameColumn)
  const urlI = col(config.urlColumn)
  const rankI = config.rankColumn ? col(config.rankColumn) : header.indexOf('rank')

  const sites: Site[] = []
  rows.slice(1).forEach((r, idx) => {
    const url = (r[urlI] ?? '').trim()
    const domain = domainOf(url)
    if (!url || !domain) throw new Error(`${config.file}: row ${idx + 2} has no usable URL ("${url}")`)
    const rank = rankI >= 0 && /^\d+$/.test(r[rankI] ?? '') ? Number(r[rankI]) : idx + 1
    sites.push({ key: `${config.id}:${domain}`, population: config.id, rank, name: (r[nameI] ?? '').trim(), url, domain })
  })
  return { config, sites, fileSha256: createHash('sha256').update(raw).digest('hex'), rows: sites.length }
}

export interface DuplicateMark {
  site: Site
  duplicateOf: Site
}

/**
 * Walk the populations in the order given. The first site on a registrable
 * domain is kept; later ones are duplicates (disqualification 3). A duplicate
 * is never audited and never silently removed: it is returned so it is written
 * to the ledger and counted.
 */
export function splitDuplicates(pops: LoadedPopulation[]): { unique: Site[]; duplicates: DuplicateMark[] } {
  const seen = new Map<string, Site>()
  const unique: Site[] = []
  const duplicates: DuplicateMark[] = []
  for (const pop of pops) {
    for (const site of pop.sites) {
      const first = seen.get(site.domain)
      if (first) duplicates.push({ site, duplicateOf: first })
      else {
        seen.set(site.domain, site)
        unique.push(site)
      }
    }
  }
  return { unique, duplicates }
}

/** `n` sites spread evenly through a population in file order, deterministic. For smoke tests. */
export function evenSample<T>(items: T[], n: number): T[] {
  if (n >= items.length) return items
  return Array.from({ length: n }, (_, i) => items[Math.floor((i * items.length) / n)])
}
