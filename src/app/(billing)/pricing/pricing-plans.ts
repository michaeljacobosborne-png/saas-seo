import { FREE_LIMITS, PLAN_LIMITS, type PaidPlan } from '@/lib/plans'

/**
 * The plans as the pricing page shows them. Every number comes from
 * src/lib/plans.ts (the same table the app enforces), so a card cannot say 100
 * pages while the code allows 50. Prices are the only numbers kept here.
 *
 * Two things are tagged `soon` because they are built but not live: MCP access
 * with API keys, and unbranded share links. Remove the tag when each ships.
 * Nothing here may say pages are re-scored daily: the interval column allows
 * 7 to 90 days. What is daily is the crawler access check.
 */

export interface Feature {
  text: string
  /** Not live yet. Rendered with a visible "Coming soon" tag. */
  soon?: boolean
}

export interface PlanCard {
  id: PaidPlan
  name: string
  tagline: string
  cta: string
  monthlyPrice: number
  annualPrice: number
  popular: boolean
  /** Founding rate, monthly only. No spot count: see docs/stripe-reprice-checklist.md. */
  founderPrice?: number
  founderPlanId?: 'starter_founder' | 'pro_founder'
  features: Feature[]
}

const n = (x: number) => x.toLocaleString('en-US')
const pages = (p: PaidPlan) => `${n(PLAN_LIMITS[p].trackedPages)} pages monitored`
const domains = (p: PaidPlan) => `${PLAN_LIMITS[p].domains} domain${PLAN_LIMITS[p].domains === 1 ? '' : 's'}`
const rescore = (p: PaidPlan) => (PLAN_LIMITS[p].rescoreIntervalDays === 7 ? 'Pages re-scored every week' : `Pages re-scored every ${PLAN_LIMITS[p].rescoreIntervalDays} days`)
const history = (p: PaidPlan) => {
  const d = PLAN_LIMITS[p].historyDays
  return d === null ? 'Unlimited history, compare any two runs' : d >= 365 ? `${Math.round(d / 365 * 12)} months of history, compare any two runs` : `${d} days of history, compare any two runs`
}
const audits = (p: PaidPlan) => `${n(PLAN_LIMITS[p].auditsPerMonth)} one-off audits a month, any URL`
const articles = (p: PaidPlan) => `${PLAN_LIMITS[p].articles} articles a month, drafted and scored in the editor`

const MONITORING: Feature = { text: 'Daily crawler access checks with change alerts' }

export const PLANS: PlanCard[] = [
  {
    id: 'starter',
    name: 'Solo',
    tagline: 'One site you answer for, watched every day.',
    cta: 'Start with Solo',
    monthlyPrice: 49,
    annualPrice: 470,
    popular: false,
    founderPrice: 39,
    founderPlanId: 'starter_founder',
    features: [
      { text: `${pages('starter')} on ${domains('starter')}` },
      MONITORING,
      { text: rescore('starter') },
      { text: history('starter') },
      { text: audits('starter') },
      { text: 'Share links for reports' },
      { text: articles('starter') },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'A real site, or several clients, with the data in your tools.',
    cta: 'Start with Pro',
    monthlyPrice: 129,
    annualPrice: 1238,
    popular: true,
    founderPrice: 99,
    founderPlanId: 'pro_founder',
    features: [
      { text: `${pages('pro')} across ${domains('pro')}` },
      MONITORING,
      { text: rescore('pro') },
      { text: history('pro') },
      { text: audits('pro') },
      { text: 'MCP access and API keys', soon: true },
      { text: 'Share links for reports' },
      { text: articles('pro') },
      { text: 'Priority support' },
    ],
  },
  {
    id: 'agency',
    name: 'Agency',
    tagline: 'Every client domain under watch, with alerts when one changes.',
    cta: 'Start with Agency',
    monthlyPrice: 599,
    annualPrice: 5750,
    popular: false,
    features: [
      { text: `${pages('agency')} across ${domains('agency')}` },
      MONITORING,
      { text: rescore('agency') },
      { text: history('agency') },
      { text: audits('agency') },
      { text: 'MCP access and API keys', soon: true },
      { text: 'Unbranded share links', soon: true },
      { text: `${articles('agency')}, up to ${PLAN_LIMITS.agency.brandProfiles} brand profiles` },
      { text: 'Priority support and an onboarding call' },
    ],
  },
]

export const FREE_FEATURES: string[] = [
  `${FREE_LIMITS.auditsPerMonth} audits a month on any URL, crawler access probe included`,
  `${FREE_LIMITS.draftScoresPerMonth} draft scores a month`,
  'No monitoring: a free account checks a page once, when you ask',
]

/** What monitoring does, in the order a buyer cares about it. Every line describes something built. */
export const MONITORING_POINTS: { title: string; body: string }[] = [
  {
    title: 'Daily crawler access checks',
    body: 'Every day Byline requests each monitored page as each AI crawler and as a plain browser, and records who was served the page and who was refused. The browser request is the control, so a block aimed at crawlers shows up as a difference, not a guess.',
  },
  {
    title: 'Alerts when access changes',
    body: 'A crawler that was served starts being refused after an edge or firewall change. You get an email with the evidence and how to reproduce it. A change must show up on two consecutive daily checks before it alerts, so one failed request does not wake you.',
  },
  {
    title: 'Scores re-recorded on a schedule',
    body: 'Each page is re-scored on Retrievable and Citable every week on Pro and Agency, every 30 days on Solo. Every run is kept with the engine version that produced it.',
  },
  {
    title: 'Comparison you can trust',
    body: 'Compare any two runs. If the scoring engine changed between them, Byline says so and lists both scores instead of reporting a difference it cannot stand behind. A change in a score means your page changed, not our rules.',
  },
]
