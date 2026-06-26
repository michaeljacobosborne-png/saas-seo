import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Byline',
  description: 'Terms governing your use of the Byline service.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link href="/" className="font-bold text-xl tracking-tight">
            Byline
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: June 1, 2025</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. The Service</h2>
            <p>
              Byline is an AI-powered SEO writing service available at app.bylineseo.com. It is
              operated by <strong>Peacock Creative Services LLC</strong>, 30 N Gould St Ste R,
              Sheridan, WY 82801. By creating an account and using Byline, you agree to these
              Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Your Account</h2>
            <p>
              You must provide an accurate email address and keep your account credentials secure.
              You are responsible for all activity that occurs under your account. Do not share
              your login credentials with others.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Subscriptions and Billing</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                Paid plans are billed monthly on an auto-renewing basis via Stripe. By subscribing
                you authorize Stripe to charge your payment method each billing period.
              </li>
              <li>
                A 30-day money-back guarantee applies to your first payment only. After the first
                30 days, payments are non-refundable.
              </li>
              <li>
                You may cancel at any time. Cancellation takes effect at the end of the current
                billing period; you retain access until then.
              </li>
              <li>
                We will provide at least 30 days&apos; notice of any price increase before it
                applies to your subscription.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Your Content</h2>
            <p>
              You retain ownership of all content you create using Byline — articles, briefs,
              keywords, and brand profiles. We do not claim any ownership rights over your content.
              You grant us a limited license to store and process your content solely to deliver
              and improve the service. We do not use your content to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Acceptable Use</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Use Byline to generate spam or low-quality content at scale for link schemes.</li>
              <li>Scrape or bulk-export data from the service in an automated fashion.</li>
              <li>Circumvent plan limits or access controls through technical means.</li>
              <li>Resell or sublicense access to Byline to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. AI-Generated Content</h2>
            <p>
              Byline uses OpenAI and Anthropic APIs to generate content. AI-generated content can
              be inaccurate, incomplete, or outdated. You are solely responsible for reviewing,
              editing, and verifying all content before publishing it. Byline makes no warranties
              about the accuracy or fitness of AI-generated output.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
            <p>
              The Byline name, logo, interface, and underlying codebase are the intellectual
              property of Peacock Creative Services LLC. Nothing in these Terms grants you any
              right to use our trademarks or proprietary software.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Disclaimers</h2>
            <p>
              Byline is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranties of any kind, express or implied, including warranties of merchantability,
              fitness for a particular purpose, or non-infringement. We do not guarantee that the
              service will be uninterrupted, error-free, or that any specific SEO results will be
              achieved.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Peacock Creative Services LLC will not be
              liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of Byline. Our total liability to you for any claim arising
              under these Terms is capped at the total amount you paid to us in the 12 months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Peacock Creative Services LLC and
              its officers, employees, and agents from any claims, damages, losses, or expenses
              (including reasonable attorneys&apos; fees) arising out of your use of Byline, your
              content, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Termination</h2>
            <p>
              You may close your account at any time from your account settings. We may terminate
              or suspend your account for material breach of these Terms with reasonable notice
              where practicable. If we terminate your account without cause, we will refund any
              unused prepaid subscription amount on a pro-rated basis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Wyoming. Any disputes arising
              under these Terms will be resolved in the courts of Sheridan County, Wyoming.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">13. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. For material changes, we will provide
              at least 14 days&apos; notice via email or an in-app banner before the new Terms
              take effect. Continued use of Byline after the effective date constitutes acceptance
              of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">14. Contact</h2>
            <address className="not-italic">
              <strong>Peacock Creative Services LLC</strong>
              <br />
              30 N Gould St Ste R
              <br />
              Sheridan, WY 82801
              <br />
              <a href="mailto:policies@bylineseo.com" className="text-indigo-600 hover:underline">
                policies@bylineseo.com
              </a>
            </address>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-wrap gap-4 text-sm text-gray-400">
          <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
          <a href="mailto:policies@bylineseo.com" className="hover:text-gray-600 transition-colors">
            policies@bylineseo.com
          </a>
        </div>
      </footer>
    </div>
  )
}
