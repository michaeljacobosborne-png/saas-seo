// Shared-link card for this page (src/lib/og/card.tsx).
import { renderCard } from '@/lib/og/card'

export const alt = "Byline pricing"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return renderCard({"title":"Byline pricing","descriptor":"Plans for checking AI search readiness, with the evidence shown."})
}
