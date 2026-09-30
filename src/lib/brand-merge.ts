/**
 * Merge rules for saving a brand profile over an existing row.
 *
 * Two kinds of caller, two rules:
 *
 * - **Agent payloads** (`company_name` shape) are partial by nature: the chat
 *   re-collects a few fields and sends blanks for the rest. An empty value there
 *   means "not collected", so it keeps what is stored. This is the rule that
 *   fixed the original data-loss bug and it must not change.
 *
 * - **Form payloads** (onboarding review, edit modal) show the user every field
 *   they post. An empty value there is the user clearing the field, so it
 *   clears. Treating it as "keep" made a cleared field come back on reload.
 *
 * For both, a key absent from the request keeps the stored value, so a form
 * that does not show a field (e.g. the expertise fields) never touches it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

export function brandMergers(prev: Row, isAgentFormat: boolean) {
  const stored = (column: string): string | null => prev[column] ?? null
  const storedArr = (column: string): string[] => (Array.isArray(prev[column]) ? prev[column] : [])

  const mergeStr = (incoming: unknown, column: string): string | null => {
    if (incoming === undefined) return stored(column)
    const v = typeof incoming === 'string' ? incoming.trim() : ''
    if (v) return v
    if (isAgentFormat) return stored(column)
    return incoming === null || typeof incoming === 'string' ? null : stored(column)
  }

  const mergeArr = (incoming: unknown, column: string): string[] => {
    if (incoming === undefined) return storedArr(column)
    if (!Array.isArray(incoming)) return storedArr(column)
    const cleaned = [...new Set(incoming.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))]
    if (cleaned.length) return cleaned
    return isAgentFormat ? storedArr(column) : []
  }

  return { mergeStr, mergeArr }
}
