import Script from 'next/script'

// Loads GA4 (gtag.js) and the Meta Pixel via next/script with the
// `afterInteractive` strategy. Rendered once from the root layout.
//
// Note: neither snippet fires an automatic page view here —
//  - GA4 is configured with `send_page_view: false`
//  - the Meta Pixel `init` is NOT followed by a `track('PageView')`
// The initial page view and all subsequent SPA route changes are tracked by
// <AnalyticsPageView /> instead, so each navigation is counted exactly once.

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID
const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID

export function AnalyticsScripts() {
  return (
    <>
      {GA4_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}', { send_page_view: false });`}
          </Script>
        </>
      ) : null}

      {FB_PIXEL_ID ? (
        <>
          <Script id="fb-pixel-init" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${FB_PIXEL_ID}');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}

      {/* Leadsy.ai visitor identification pixel */}
      <Script
        id="vtag-ai-js"
        src="https://r2.leadsy.ai/tag.js"
        strategy="afterInteractive"
        data-pid="bQq413m7bf7t4c5e"
        data-version="062024"
      />
    </>
  )
}
