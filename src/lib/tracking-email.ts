/**
 * The monthly re-check email (decision 8: the free monthly re-run is the
 * retention hook, and a re-run nobody hears about retains nobody).
 *
 * It says what the comparison says and nothing more: a change in content
 * readiness as Byline measures it, never a change in AI visibility. When the
 * engine changed between the two runs, the split between page and engine is in
 * the body, not left for the reader to discover.
 */
import { describeChange, engineSplit, type RecordedScores } from '@/lib/geo-audit/change-summary'
import { COMPARE_SCOPE } from '@/lib/geo-audit/compare'
import type { OverTime } from '@/lib/geo-audit/history'

const SITE = 'https://app.bylineseo.com'

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function buildChangeEmail(input: {
  pageId: string
  url: string
  overTime: OverTime
  recorded: RecordedScores
}): { subject: string; text: string } {
  const { overTime: o } = input
  const r = o.comparison.retrievability
  const moved = r.from !== null && r.to !== null && r.delta !== 0
  const headline = o.contentChanged ? 'the page changed' : moved ? 'the score moved, the text did not' : 'no change'
  const note = engineSplit(o, input.recorded)
  const text = [
    `Byline re-checked ${input.url} this month.`,
    '',
    describeChange(o),
    ...(note ? ['', `Engine version changed between these runs. ${note}`] : []),
    '',
    `See what changed: ${SITE}/tracking/${input.pageId}`,
    '',
    COMPARE_SCOPE,
    '',
    'To stop these emails, stop tracking the page on that screen. Its history is kept.',
    '',
    'Michael Jacobs, Byline',
  ].join('\n')
  return { subject: `Byline re-checked ${host(input.url)}: ${headline}`, text }
}
