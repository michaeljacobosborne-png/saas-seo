import Link from 'next/link'

interface FounderSpotsData {
  available: boolean
  used: number
  total: number
  remaining: number
}

async function getFounderSpots(): Promise<FounderSpotsData | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.bylineseo.com'
    const res = await fetch(`${base}/api/billing/founder-spots`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function FounderBanner() {
  const data = await getFounderSpots()

  if (!data?.available) return null

  return (
    <section className="px-6 py-16 bg-[#1C1917]">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[rgba(184,115,51,0.12)] border border-[rgba(184,115,51,0.3)] rounded-full px-4 py-1.5 text-xs font-semibold text-[#D4954A] tracking-wide uppercase mb-4">
            Founder Pricing — Limited Time
          </div>
          <h2 className="text-3xl font-bold text-[#F7F3EC] mb-3">
            Lock in founder pricing. Forever.
          </h2>
          <p className="text-[#A89070] max-w-lg mx-auto">
            The first 100 subscribers get reduced pricing locked for life — your rate never increases, even as we add features and raise prices.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="h-2 w-48 rounded-full bg-[#2A2420] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#B87333] transition-all"
                style={{ width: `${(data.used / data.total) * 100}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-[#D4954A]">
              {data.remaining} of {data.total} spots remaining
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Starter Founder */}
          <div className="rounded-2xl border border-[rgba(184,115,51,0.3)] bg-[#231F1B] p-7 flex flex-col">
            <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-1">Starter — Founder</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-[#F7F3EC]">$39</span>
              <span className="text-sm text-[#7A6555]">/mo</span>
              <span className="text-base line-through text-[#7A6555]">$49</span>
            </div>
            <p className="text-xs text-[#D4954A] font-semibold mb-4">Locked forever at this rate</p>
            <p className="text-sm text-[#A89070] leading-relaxed mb-6 flex-1">
              Research, generate, and score articles. 8 articles per month, 10 keyword sessions.
            </p>
            <Link
              href="/signup?plan=starter_founder&interval=monthly"
              className="block w-full text-center py-2.5 rounded-lg bg-[rgba(184,115,51,0.12)] border border-[#B87333] text-[#B87333] text-sm font-semibold hover:bg-[rgba(184,115,51,0.2)] transition-colors"
            >
              Claim Starter Founder spot
            </Link>
          </div>

          {/* Growth Founder */}
          <div className="rounded-2xl border-2 border-[#B87333] bg-[#231F1B] p-7 flex flex-col relative shadow-lg">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
              <span className="bg-[#B87333] text-[#F7F3EC] text-xs font-bold px-3 py-1 rounded-full tracking-wide whitespace-nowrap">
                BEST VALUE
              </span>
            </div>
            <div className="text-xs font-semibold text-[#B87333] uppercase tracking-wider mb-1">Growth — Founder</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-[#F7F3EC]">$79</span>
              <span className="text-sm text-[#7A6555]">/mo</span>
              <span className="text-base line-through text-[#7A6555]">$99</span>
            </div>
            <p className="text-xs text-[#D4954A] font-semibold mb-4">Locked forever at this rate</p>
            <p className="text-sm text-[#A89070] leading-relaxed mb-6 flex-1">
              Full agent access, 30 articles/mo, Assist mode, score-based fixes, persistent memory.
            </p>
            <Link
              href="/signup?plan=pro_founder&interval=monthly"
              className="block w-full text-center py-2.5 rounded-lg bg-[#B87333] text-[#F7F3EC] text-sm font-semibold hover:bg-[#A0622A] transition-colors"
            >
              Claim Growth Founder spot
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-[#7A6555] mt-6">
          30-day money-back guarantee. Founder pricing is locked for the lifetime of your subscription.
        </p>
      </div>
    </section>
  )
}
