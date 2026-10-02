import { Star } from 'lucide-react'

/*
 * Social proof section — shared by the homepage and the pricing page.
 *
 * ⚠️  PLACEHOLDER CONTENT
 * The three testimonials below are placeholders written to read like real
 * SEO-tool users with concrete results. The owner will swap each one out for a
 * real beta-user quote. To replace one, edit the matching entry in TESTIMONIALS:
 * update `quote`, `name`, and `title`. Keep the array at three items so the grid
 * stays balanced.
 */

interface Testimonial {
  quote: string
  name: string
  title: string
}

const TESTIMONIALS: Testimonial[] = [
  /* PLACEHOLDER — replace with real beta user quote */
  {
    quote:
      'I used to spend 2 hours rewriting articles based on Surfer scores. Byline’s agent does it in 30 seconds — in my voice. First month using it, two articles hit page 1.',
    name: 'Jamie K.',
    title: 'Content Strategist',
  },
  /* PLACEHOLDER — replace with real beta user quote */
  {
    quote:
      'The content audit found 14 gaps I had no idea about. I turned them into articles over 6 weeks and organic traffic went up 38%. Wild.',
    name: 'Marcus T.',
    title: 'Founder, E-commerce brand',
  },
  /* PLACEHOLDER — replace with real beta user quote */
  {
    quote:
      'Finally an SEO tool that doesn’t just tell you what’s wrong — it fixes it. The agent rewrites are cleaner than what I’d write myself.',
    name: 'Priya R.',
    title: 'Freelance SEO consultant',
  },
]

/* Derives avatar initials from a name, e.g. "Jamie K." → "JK". */
function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
}

function StarRating() {
  return (
    <div className="flex items-center gap-1 mb-4" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="w-4 h-4 text-[#D4954A] fill-[#D4954A]" />
      ))}
    </div>
  )
}

export default function TestimonialsSection() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-4 text-[#F7F3EC]">What early users are saying</h2>
          <p className="text-[#A89070] max-w-xl mx-auto text-lg">
            Join our growing community of content teams using AI that actually works.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            /* PLACEHOLDER — replace with real beta user quote */
            <figure
              key={t.name}
              className="flex flex-col rounded-2xl border border-[rgba(184,115,51,0.2)] bg-[#231F1B] p-7 shadow-sm"
            >
              <StarRating />
              <blockquote className="text-[#F7F3EC] text-[15px] leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 pt-5 border-t border-[rgba(184,115,51,0.15)] flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-full bg-[rgba(184,115,51,0.15)] border border-[rgba(184,115,51,0.3)] text-[#D4954A] flex items-center justify-center text-sm font-semibold flex-shrink-0"
                >
                  {initials(t.name)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#F7F3EC]">{t.name}</div>
                  <div className="text-sm text-[#A89070]">{t.title}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
