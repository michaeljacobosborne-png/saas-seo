import { createClient as createSupabaseClient, type User } from '@supabase/supabase-js'
import { consumeRun } from '@/lib/geo-audit/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Checks shared by the account-security routes: does this signed-in person know
 * the current password, and how many guesses a session gets. A session alone is
 * not enough to change a password or an email.
 */
export const PASSWORD_CHECKS_PER_DAY = 10

export type PasswordCheck = 'ok' | 'wrong' | 'limited' | 'no-password'

export function hasPasswordLogin(user: Pick<User, 'app_metadata' | 'identities'>): boolean {
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? []
  return providers.includes('email') || !!user.identities?.some((i) => i.provider === 'email')
}

export async function checkCurrentPassword(user: User, password: unknown): Promise<PasswordCheck> {
  if (!user.email || !hasPasswordLogin(user)) return 'no-password'
  if (typeof password !== 'string' || !password) return 'wrong'
  const budget = await consumeRun(user.id, { tool: 'acct-password-check', limit: PASSWORD_CHECKS_PER_DAY })
  if (!budget.allowed) return 'limited'
  // A separate client that never touches the person's cookies; its session is
  // ended again straight away (local scope, so their real session is untouched).
  const probe = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await probe.auth.signInWithPassword({ email: user.email, password })
  if (error) return 'wrong'
  await probe.auth.signOut({ scope: 'local' })
  return 'ok'
}

export const emailChangeEpoch = (user: Pick<User, 'app_metadata'>): number => Number(user.app_metadata?.email_change_epoch ?? 0) || 0

/** Invalidate every pending email-change link for this account. */
export async function bumpEmailChangeEpoch(user: Pick<User, 'id' | 'app_metadata'>, extra: { email?: string; email_confirm?: boolean } = {}) {
  return createServiceClient().auth.admin.updateUserById(user.id, {
    ...extra,
    app_metadata: { ...user.app_metadata, email_change_epoch: emailChangeEpoch(user) + 1 },
  })
}
