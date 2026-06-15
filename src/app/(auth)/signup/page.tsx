import SignupForm from './SignupForm'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string
    interval?: string
    ref?: string
    audit_keyword?: string
    audit_topic?: string
  }>
}) {
  const { plan, interval, ref, audit_keyword, audit_topic } = await searchParams
  return <SignupForm plan={plan} interval={interval} referrer={ref} auditKeyword={audit_keyword} auditTopic={audit_topic} />
}
