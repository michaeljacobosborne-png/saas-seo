import Link from 'next/link'

/**
 * The 404 page. Also what a prospect sees if an emailed report link is copied
 * incompletely (/audit/results/[id] calls notFound()), so it says that plainly
 * and offers the way back to a fresh report.
 */
export default function NotFound() {
  const playfair = { fontFamily: 'var(--font-playfair, "Playfair Display", serif)' }
  return (
    <main className="min-h-screen bg-[#FDFAF6] text-[#1C1917] px-6 py-20">
      <div className="max-w-xl mx-auto">
        <Link href="/" style={{ ...playfair, fontSize: 22, fontWeight: 900, color: '#B87333' }}>
          byline<span style={{ color: '#1C1917' }}>.</span>
        </Link>
        <h1 style={playfair} className="text-4xl font-bold mt-12 mb-4">
          This page does not exist
        </h1>
        <p className="text-lg text-[#57534E] leading-relaxed mb-10">
          The address may be mistyped, or the page may have moved. If you followed a link to a Byline report, the
          link may have been copied incompletely: report links are long, and email clients sometimes break them.
        </p>
        <h2 style={playfair} className="text-2xl font-bold mb-4">Where would you like to go?</h2>
        <ul className="space-y-3 text-[17px]">
          <li>
            <Link href="/geo-analyzer" className="text-[#B87333] underline">Run a free AI search readiness check</Link>
            <span className="text-[#57534E]"> on any page</span>
          </li>
          <li>
            <Link href="/" className="text-[#B87333] underline">What Byline is</Link>
          </li>
          <li>
            <Link href="/about" className="text-[#B87333] underline">Who builds it</Link>
          </li>
          <li>
            <Link href="/blog" className="text-[#B87333] underline">The blog</Link>
          </li>
        </ul>
        <p className="text-sm text-[#998876] mt-12">
          Still stuck? Email <a href="mailto:hi@bylineseo.com" className="underline">hi@bylineseo.com</a>.
        </p>
      </div>
    </main>
  )
}
