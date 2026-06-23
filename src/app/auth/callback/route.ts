import { type EmailOtpType, type User } from '@supabase/supabase-js'
import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ghlUpsertContact, ghlAddToWorkflow } from '@/lib/ghl'

// This callback fires on every email confirmation AND every OAuth login, so we
// must only push to GHL on a genuinely new signup — otherwise returning users
// get re-enrolled in the welcome sequence on each login. A first sign-in has
// last_sign_in_at ≈ created_at (or no prior sign-in at all).
function isFirstSignIn(user: User): boolean {
  const created = user.created_at ? Date.parse(user.created_at) : NaN
  if (Number.isNaN(created)) return false
  const lastSignIn = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN
  if (Number.isNaN(lastSignIn)) return true // never signed in before → new
  return Math.abs(lastSignIn - created) < 5 * 60 * 1000 // within 5 min of account creation
}

function firstNameFromUser(user: User): string | undefined {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const full = (meta.full_name ?? meta.name ?? meta.first_name) as string | undefined
  if (!full || typeof full !== 'string') return undefined
  return full.trim().split(/\s+/)[0] || undefined
}

// Push a brand-new user into GoHighLevel and the welcome/onboarding workflow.
// Best-effort and non-blocking via after(); the GHL helpers never throw. `isPaid`
// tags paid subscribers distinctly from free-tier signups so the workflow can
// branch. Idempotent on GHL's side (upsert by email).
function pushNewUserToGhl(user: User, isPaid: boolean) {
  if (!user.email) return
  if (!isFirstSignIn(user)) return
  after(async () => {
    const contactId = await ghlUpsertContact({
      email: user.email!,
      firstName: firstNameFromUser(user),
      tags: isPaid ? ['byline_user', 'paid_subscriber'] : ['byline_user', 'free_tier'],
    })
    if (!contactId) return
    const workflowId = process.env.GHL_WORKFLOW_WELCOME_ONBOARDING_ID
    if (workflowId) await ghlAddToWorkflow(contactId, workflowId)
  })
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'
  const safeNext = next.startsWith('/') ? next : '/dashboard'

  // A paid signup carries the chosen plan/interval through confirmation. When
  // present, drop the user straight into Stripe checkout instead of /pricing or
  // /dashboard. The checkout-redirect route validates the params and creates the
  // session for the now-authenticated user.
  const plan = searchParams.get('plan')
  const interval = searchParams.get('interval')
  const checkoutRedirect = plan && interval
    ? `${origin}/api/billing/checkout-redirect?plan=${encodeURIComponent(plan)}&interval=${encodeURIComponent(interval)}`
    : null

  if (token_hash && type) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error && data.user) {
      // Paid signup: carry the chosen plan straight into Stripe checkout.
      if (checkoutRedirect) {
        return NextResponse.redirect(checkoutRedirect)
      }

      // Otherwise route by account type, mirroring the OAuth (code) branch below:
      // free-tier users land in the app; paid users with no sub yet go to pricing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (supabase as any)
        .from('subscriptions')
        .select('id')
        .eq('user_id', data.user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('account_type')
        .eq('user_id', data.user.id)
        .maybeSingle()

      const isFree = profile?.account_type === 'free'
      const hasSub = !!sub

      // New signup → GoHighLevel welcome/onboarding (no-op for returning logins).
      pushNewUserToGhl(data.user, hasSub || !isFree)

      if (!hasSub && !isFree) {
        return NextResponse.redirect(`${origin}/pricing`)
      }

      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Paid signup (OAuth): go straight to checkout with the carried plan.
      if (checkoutRedirect) {
        return NextResponse.redirect(checkoutRedirect)
      }

      // Check if this user has an active subscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sub } = await (supabase as any)
        .from('subscriptions')
        .select('id')
        .eq('user_id', data.user.id)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .maybeSingle()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('account_type')
        .eq('user_id', data.user.id)
        .maybeSingle()

      const isFree = profile?.account_type === 'free'
      const hasSub = !!sub

      // New signup → GoHighLevel welcome/onboarding (no-op for returning logins).
      pushNewUserToGhl(data.user, hasSub || !isFree)

      // New users (no sub, not free) go to pricing; existing users go to next
      if (!hasSub && !isFree) {
        return NextResponse.redirect(`${origin}/pricing`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
