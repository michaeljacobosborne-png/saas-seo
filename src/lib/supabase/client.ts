import { createBrowserClient } from '@supabase/ssr'

// Reuse a single browser client for the whole app. Calling createBrowserClient()
// on every invocation (it used to run on each component render) spins up multiple
// GoTrueClient instances that all read/write the same auth storage. When the tab
// is backgrounded — Chrome freezes timers after ~5 min hidden — and then refocused,
// each instance races to refresh the access token. Refresh-token rotation means one
// refresh wins and the others get "Invalid Refresh Token: Already Used", which nulls
// the session and bounces the user to a blank/redirected page on return. A singleton
// keeps a single auto-refresh + visibility handler, so tabbing away and back recovers
// the session cleanly instead of dropping it.
function newBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let browserClient: ReturnType<typeof newBrowserClient> | undefined

export function createClient() {
  return (browserClient ??= newBrowserClient())
}
