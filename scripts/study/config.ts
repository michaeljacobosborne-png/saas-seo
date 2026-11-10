/**
 * The study run's configuration, in one place. It describes the pre-registered
 * run (docs: Documents\byline-study-selection-rule.md) and nothing more.
 *
 * Adding a population later is a config change: add an entry below (the third
 * one is already listed, switched off), or pass --populations A,B,C.
 */
import type { PopulationConfig } from '../../src/lib/study/populations'
import type { Pacing } from '../../src/lib/study/ledger'

const DOCS = process.env.BYLINE_DOCS_DIR || 'C:\\Users\\ozzy5\\Documents'

export const POPULATIONS: PopulationConfig[] = [
  {
    id: 'A',
    label: 'Marketing agencies that publicly sell GEO or AEO',
    file: `${DOCS}\\byline-study-population-a-agencies.csv`,
    nameColumn: 'agency_name',
    urlColumn: 'homepage_url',
    rankColumn: 'rank',
    include: true,
  },
  {
    id: 'B',
    label: 'B2B SaaS companies from G2 top 50',
    file: `${DOCS}\\byline-study-population-b-saas.csv`,
    nameColumn: 'company_name',
    urlColumn: 'homepage_url',
    rankColumn: 'rank',
    include: true,
  },
  {
    id: 'C',
    label: 'Small and mid-market SaaS (later work, not part of this run)',
    file: `${DOCS}\\byline-study-population-smallsaas.csv`,
    nameColumn: 'company_name',
    urlColumn: 'homepage_url',
    rankColumn: 'rank',
    include: false,
  },
]

/** The engine the whole run must be on. A row from any other version halts the run. */
export const ENGINE_VERSION_REQUIRED = '2026.15'

/** Where the run's vantage point must be. Checked at start and on every row. */
export const REQUIRED_COUNTRY = 'US'

export const PACING: Pacing = {
  siteGapSeconds: 30,
  jitter: 0.3,
  // The existing per-domain cap (src/lib/mcp/limits.ts DOMAIN_BUDGET): 6 calls per 10 minutes.
  perDomainMax: 6,
  perDomainWindowMs: 10 * 60_000,
  retryMinGapHours: 6,
  maxAttempts: 3,
  minSpanHours: 12,
  siteTimeoutMs: 100_000,
}

/** Raw results land here, outside the repo, in a form that can be published. */
export const OUT_DIR = process.env.BYLINE_STUDY_DIR || `${DOCS}\\byline-study-runs`
