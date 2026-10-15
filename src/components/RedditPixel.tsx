'use client'

import Script from 'next/script'

const REDDIT_PIXEL_ID = 'a2_j8679g6sf5so'

/**
 * Reddit Pixel base loader + a single PageVisit. Rendered once from the root
 * layout with `strategy="afterInteractive"` so it never blocks render.
 *
 * When a logged-in user's email is available it is passed into `rdt('init')`
 * for Reddit's advanced matching (Reddit hashes it client-side before it leaves
 * the browser); logged-out visitors get a plain init. SPA route changes are not
 * re-tracked — conversion events (SignUp, Lead, Purchase) fire via
 * src/lib/reddit-pixel.ts.
 */
export function RedditPixel({ email }: { email?: string | null }) {
  // Build the init args string. JSON.stringify escapes the email safely for
  // embedding in the inline script; init + PageVisit live in the same inline
  // snippet as the loader so there is no ordering race against the queue.
  const initArgs = email
    ? `'${REDDIT_PIXEL_ID}', ${JSON.stringify({ email })}`
    : `'${REDDIT_PIXEL_ID}'`

  return (
    <Script id="reddit-pixel" strategy="afterInteractive">
      {`!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=${REDDIT_PIXEL_ID}",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init',${initArgs});rdt('track','PageVisit');`}
    </Script>
  )
}
