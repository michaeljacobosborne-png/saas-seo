// Shared, dependency-free helpers used by BOTH client-side analytics and
// server-side conversion APIs. Keep this module free of node-only imports
// (e.g. `crypto`) so it can be bundled into the browser safely.

/**
 * Deterministic event_id for a subscription activation. The Meta Pixel (client)
 * and the Conversions API (server) must send the SAME event_id for the SAME
 * subscription so Meta can deduplicate the two into one event.
 */
export function subscriptionEventId(subscriptionId: string): string {
  return `sub_${subscriptionId}`
}
