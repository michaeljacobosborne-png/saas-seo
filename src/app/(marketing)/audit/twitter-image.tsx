// Shared-link card for this page (src/lib/og/card.tsx).
import { renderCard } from '@/lib/og/card'

export const alt = "Free Content Map from Byline"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return renderCard({"kicker":"Free tool","title":"Free Content Map","descriptor":"See what you have published, and what you have not."})
}
