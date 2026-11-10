/**
 * MCP usage metering (decisions 23, 26, 27).
 *
 * Every call is recorded, whatever the plan, per account AND per credential
 * (OAuth client or API key), per tool, with enough detail to price MCP on its
 * own later: target domain, outcome, duration and model cost. Plan-level totals
 * alone could never tell us what MCP was worth by itself.
 *
 * Records are for Michael's visibility (admin) and billing analysis only.
 * They are never sent to GHL, tagged, or used to trigger email (decision 26).
 *
 * The sink is injected; the `api_calls` table implements it once the migration
 * lands.
 */
import type { McpPrincipal } from './auth'
import type { ToolName } from './schemas'

export interface UsageRecord {
  userId: string
  /** OAuth client_id or API key id: which integration made the call. */
  credentialId: string | null
  via: McpPrincipal['via']
  tool: ToolName
  targetDomain: string | null
  outcome: 'ok' | 'denied' | 'rate_limited' | 'error'
  /** Why it was denied or failed, as a reason code, never free text from the target site. */
  reason: string | null
  durationMs: number
  /** Model spend for this call (narration in run_audit), in USD. */
  modelCostUsd: number
  /** Engine version that produced any report in the result. */
  engineVersion: string | null
  at: string
}

export interface UsageSink {
  record(r: UsageRecord): Promise<void>
}

/** Build a record from a principal; never throws. */
export function usageRecord(
  principal: McpPrincipal,
  call: Omit<UsageRecord, 'userId' | 'credentialId' | 'via' | 'at'> & { at?: Date },
): UsageRecord {
  return {
    userId: principal.userId,
    credentialId: principal.keyId,
    via: principal.via,
    tool: call.tool,
    targetDomain: call.targetDomain,
    outcome: call.outcome,
    reason: call.reason,
    durationMs: Math.max(0, Math.round(call.durationMs)),
    modelCostUsd: Math.max(0, call.modelCostUsd),
    engineVersion: call.engineVersion,
    at: (call.at ?? new Date()).toISOString(),
  }
}

/** Write a record without ever failing the tool call because metering failed. */
export async function meter(sink: UsageSink, record: UsageRecord): Promise<void> {
  try {
    await sink.record(record)
  } catch (err) {
    console.error('[mcp/metering] failed to record usage', err)
  }
}
