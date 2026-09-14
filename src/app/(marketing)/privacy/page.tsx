import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Byline',
  description: 'How Byline collects, uses, and protects your data.',
}

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Effective date: June 1, 2025</p>

        <div className="space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Byline is operated by <strong>Peacock Creative Services LLC</strong>, 30 N Gould St
              Ste R, Sheridan, WY 82801 (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;).
              This Privacy Policy explains how we collect, use, and protect information when you use
              the Byline service at app.bylineseo.com. By using Byline, you agree to the practices
              described here.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account information:</strong> Your email address and, if you sign in with
                Google OAuth, your name and profile picture.
              </li>
              <li>
                <strong>Payment information:</strong> Billing is handled by Stripe. We never see or
                store your card number or full payment details — only a Stripe customer ID and
                subscription status.
              </li>
              <li>
                <strong>Content you create:</strong> Articles, briefs, keywords, and brand profiles
                you enter into Byline.
              </li>
              <li>
                <strong>Usage and log data:</strong> Pages visited, features used, timestamps, IP
                addresses, and browser/device information collected automatically.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Operate and deliver the Byline service.</li>
              <li>Process payments via Stripe.</li>
              <li>Generate content using AI APIs (OpenAI and Anthropic).</li>
              <li>Send transactional emails (receipts, account notifications).</li>
              <li>Improve and develop the product.</li>
            </ul>
            <p className="mt-4 font-medium text-gray-900">
              We do not use your content to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Third-Party Services</h2>
            <p className="mb-3">
              We rely on the following sub-processors to deliver Byline:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Supabase</strong> — database and authentication.{' '}
                <a
                  href="https://supabase.com/privacy"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>Stripe</strong> — payment processing.{' '}
                <a
                  href="https://stripe.com/privacy"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>OpenAI</strong> — AI content generation.{' '}
                <a
                  href="https://openai.com/policies/privacy-policy"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>Anthropic</strong> — AI content generation.{' '}
                <a
                  href="https://www.anthropic.com/privacy"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>DataForSEO</strong> — keyword and SEO data.{' '}
                <a
                  href="https://dataforseo.com/privacy-policy"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <strong>Vercel</strong> — hosting and edge delivery.{' '}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  className="text-indigo-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you close your account,
              your data will be deleted within 30 days, except where we are required to retain it
              for legal or tax purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data. To exercise
              these rights, email us at{' '}
              <a href="mailto:policies@bylineseo.com" className="text-indigo-600 hover:underline">
                policies@bylineseo.com
              </a>
              . If you are located in the European Union (GDPR) or California (CCPA), you have
              additional rights including data portability and the right to opt out of the sale of
              personal information. We do not sell personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Cookies</h2>
            <p>
              Byline uses session cookies to keep you logged in. We do not use advertising cookies,
              tracking pixels, or third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Security</h2>
            <p>
              All data is transmitted over HTTPS. Passwords are hashed and never stored in
              plaintext. Our database enforces row-level security so users can only access their
              own data. We take reasonable precautions to protect your information, but no
              system is completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Children</h2>
            <p>
              Byline is not directed at or intended for use by anyone under the age of 16. We do
              not knowingly collect personal information from children.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. For material changes, we will
              provide at least 14 days&apos; notice via email or an in-app banner before the changes
              take effect. Continued use of Byline after the effective date constitutes acceptance
              of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">11. Contact</h2>
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
