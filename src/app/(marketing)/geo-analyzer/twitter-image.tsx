// Shared-link card for this page (src/lib/og/card.tsx).
import { renderCard } from '@/lib/og/card'

export const alt = "Free GEO Analyzer from Byline"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return renderCard({"kicker":"Free tool","title":"Free GEO Analyzer: can AI search read your site?","descriptor":"Reach, parse and quote, checked with the evidence. About 30 seconds."})
}
