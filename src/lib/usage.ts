export const PLAN_LIMITS = {
  starter: { articles: 8, keywordSessions: 10, brandProfiles: 1 },
  pro: { articles: 25, keywordSessions: 40, brandProfiles: 3 },
  agency: { articles: 80, keywordSessions: Infinity, brandProfiles: 10 },
}

export async function checkArticleLimit(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  const plan = (sub?.plan ?? 'starter') as keyof typeof PLAN_LIMITS
  const limit = PLAN_LIMITS[plan]?.articles ?? 0

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { count } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', periodStart)

  const used = count ?? 0

  return {
    allowed: limit === Infinity || used < limit,
    used,
    limit,
  }
}
