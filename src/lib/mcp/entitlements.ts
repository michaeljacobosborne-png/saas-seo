/**
 * The ONE place MCP entitlements are decided (decision 27).
 *
 * Today MCP is a feature of existing paid plans. It may become its own
 * product. Everything that depends on that answer reads `PLAN_MODEL`, so
 * changing the model, e.g. a separate "data layer" plan, is an edit to this
 * table, not to tools, routes or messages.
 *
 * Rules carried here:
 *   - Crawler access test is free; audits, stored audits and comparison are
 *     paid; comparison is never free (decision 22). score_draft ships (24).
 *   - Quotas are a happy medium, metered from day one (23).
 *   - No plan names or tier assumptions in anything a caller sees: denial and
 *     quota wording below never mentions a tier (27).
 */
import type { PlanTier } from './auth'
import type { ToolName } from './schemas'

export type Capability = 'crawler_check' | 'audit' | 'stored_audits' | 'compare' | 'score_draft'

export const TOOL_CAPABILITY: Record<ToolName, Capability> = {
  check_crawler_access: 'crawler_check',
  run_audit: 'audit',
  get_audit: 'stored_audits',
  list_audits: 'stored_audits',
  compare_audits: 'compare',
  score_draft: 'score_draft',
}

/** Monthly allowance: a number, `null` for unmetered (rate limits still apply), or 0 for not included. */
type Allowance = number | null

export interface PlanModel {
  /** Which commercial model is live. Informational; the table below is what is enforced. */
  model: 'feature_of_existing_plans' | 'separate_data_layer_plan'
  allowances: Record<PlanTier, Record<Capability, Allowance>>
  /** Where a caller can see or change their subscription. No tier names. */
  upgradeUrl: string
}

/**
 * PROPOSED allowances (decision 23, awaiting Michael's confirmation).
 * Cost at full use per account per month, at about $0.0015/audit (model plus
 * function time) and $0.0001/crawler check:
 * Starter ≈ $0.28, Growth ≈ $0.90, Multi-Brand ≈ $2.70, Free ≈ $0.01.
 */
export const PLAN_MODEL: PlanModel = {
  model: 'feature_of_existing_plans',
  allowances: {
    free: { crawler_check: 30, audit: 0, stored_audits: 0, compare: 0, score_draft: 30 },
    starter: { crawler_check: 500, audit: 150, stored_audits: null, compare: null, score_draft: 500 },
    growth: { crawler_check: 1500, audit: 500, stored_audits: null, compare: null, score_draft: 2000 },
    multi_brand: { crawler_check: 4500, audit: 1500, stored_audits: null, compare: null, score_draft: 5000 },
  },
  upgradeUrl: 'https://app.bylineseo.com/pricing',
}

export type Entitlement =
  | { allowed: true; capability: Capability; monthlyAllowance: number | null }
  | { allowed: false; capability: Capability; message: string; upgradeUrl: string }

/** Is this principal allowed to call this tool at all? Quota usage is checked separately (limits.ts). */
export function entitlementFor(plan: PlanTier, isOwner: boolean, tool: ToolName, model: PlanModel = PLAN_MODEL): Entitlement {
  const capability = TOOL_CAPABILITY[tool]
  if (isOwner) return { allowed: true, capability, monthlyAllowance: null }
  const allowance = model.allowances[plan][capability]
  if (allowance === 0) {
    return {
      allowed: false,
      capability,
      message: 'This tool is not included in your current Byline subscription.',
      upgradeUrl: model.upgradeUrl,
    }
  }
  return { allowed: true, capability, monthlyAllowance: allowance }
}

/** Wording for a used-up allowance. No tier names. */
export function quotaExhaustedMessage(capability: Capability, used: number, allowance: number): string {
  return `You have used this month's allowance for this tool (${used} of ${allowance}). It resets on the 1st (UTC).`
}
