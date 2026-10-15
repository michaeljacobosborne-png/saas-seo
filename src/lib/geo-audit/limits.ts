/**
 * Cost guards.
 *
 * The risk is not a large page, it is an *uncapped* one. A 50MB HTML document
 * extracts to roughly 12 million tokens; at that size a single run costs cents
 * on a nano-class model and well over a hundred dollars on a frontier one.
 * Scripted a few thousand times against a free endpoint, that is a real bill.
 *
 * Two independent caps, because they fail differently:
 *
 *  - `MAX_FETCH_BYTES` bounds what we download and parse. Protects memory and
 *    CPU on the serverless function.
 *  - `MAX_MODEL_INPUT_CHARS` bounds what we hand to the language model.
 *    Protects spend. Parsing 2MB of HTML is cheap; sending it to a model is not.
 *
 * Every truncation is DISCLOSED in the report. Silent truncation is the exact
 * failure this engine was rewritten to fix — the previous version cut pages at
 * 15,000 characters and then reported the missing content as absent.
 */

/** Hard cap on downloaded HTML. Pages above this are truncated and disclosed. */
export const MAX_FETCH_BYTES = 2_000_000

/** robots.txt is a text file; anything past this is pathological. */
export const MAX_ROBOTS_BYTES = 512_000

/**
 * Cap on characters handed to the language model.
 *
 * Roughly 4 characters per token, so ~15k tokens of input. The model only ever
 * receives the scored findings and their evidence snippets, never raw HTML, so
 * this is generous for the job it does.
 */
export const MAX_MODEL_INPUT_CHARS = 60_000

/** Rough token estimate. Deliberately conservative — overestimates slightly. */
export function estimateTokens(text: string): number {
  return Math.ceil((text ?? '').length / 4)
}

export interface Truncation {
  /** What was truncated, e.g. "page HTML" or "model input". */
  subject: string
  originalBytes: number
  keptBytes: number
  /** Report-ready sentence. Always shown to the user when truncation occurred. */
  disclosure: string
}

export function truncationDisclosure(subject: string, originalBytes: number, keptBytes: number): Truncation {
  const pct = originalBytes > 0 ? Math.round((keptBytes / originalBytes) * 100) : 100
  return {
    subject,
    originalBytes,
    keptBytes,
    disclosure:
      `This page is ${formatBytes(originalBytes)}. We analysed the first ${formatBytes(keptBytes)} ` +
      `(about ${pct}% of it) and stopped there. Findings below describe only the part we read — ` +
      `anything past that point was not assessed.`,
  }
}

/**
 * Cap text destined for the model. Returns the kept text plus a disclosure when
 * anything was dropped.
 */
export function capModelInput(
  text: string,
  max = MAX_MODEL_INPUT_CHARS,
): { text: string; truncation: Truncation | null } {
  const input = text ?? ''
  if (input.length <= max) return { text: input, truncation: null }

  return {
    text: input.slice(0, max),
    truncation: {
      subject: 'model input',
      originalBytes: input.length,
      keptBytes: max,
      disclosure:
        `The findings summary was too long to send in full, so recommendations were written from ` +
        `the first ${formatBytes(max)} of it. Scores are unaffected — they are computed in code from ` +
        `the complete page, not from this summary.`,
    },
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} bytes`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
