import SignupForm from './SignupForm'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; ref?: string }>
}) {
  const { plan } = await searchParams
  return <SignupForm plan={plan} />
}
