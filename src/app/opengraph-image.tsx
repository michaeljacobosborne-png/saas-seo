// Shared-link card for this page (src/lib/og/card.tsx).
import { renderCard } from '@/lib/og/card'

export const alt = "Byline: AI search readiness, scored from your page"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return renderCard({"title":"AI search readiness, scored from your page","descriptor":"Two scores, with the evidence behind every finding."})
}
