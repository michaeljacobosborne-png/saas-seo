// Shared-link card for this page (src/lib/og/card.tsx).
import { renderCard } from '@/lib/og/card'

export const alt = "The Byline blog"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return renderCard({"kicker":"Blog","title":"How AI search reads pages","descriptor":"Notes from auditing real sites, with the evidence."})
}
