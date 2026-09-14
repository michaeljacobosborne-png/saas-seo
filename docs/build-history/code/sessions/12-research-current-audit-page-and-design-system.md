# Research current audit page and design system

- Session `4969d330-8f8b-480b-8a99-9dc91dd54e3a`
- 2026-06-17 13:30 to 2026-06-17 13:31
- Branch: `master`  |  Claude Code 2.1.170

**Files touched (7):** `src/app/(marketing)/audit/page.tsx`, `src/app/(marketing)/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/_components/NavLinks.tsx`, `src/app/_components/TestimonialsSection.tsx`

---


## Michael

Research only — no changes. I need to understand the current state of two things before rebuilding the /audit page.

1. Read `src/app/(marketing)/audit/page.tsx` in full — what does the current /audit page look like? What copy does it have? What components?

2. Read the main marketing homepage: check `src/app/(marketing)/page.tsx` or `src/app/page.tsx` — what's the visual design, color scheme, fonts, component patterns used?

3. Read `src/app/(marketing)/layout.tsx` — what global styles/fonts/classes apply to marketing pages?

4. Check `src/app/globals.css` or `tailwind.config.ts` — what are the brand colors, font families, design tokens?

5. Look at any shared marketing components: check `src/app/(marketing)/_components/` or `src/components/` for things like Hero, NavLinks, Footer, etc.

Report: the full current /audit page content (verbatim copy), the visual design system (colors, fonts, component patterns from the homepage), and any reusable marketing components I should use when rebuilding the page.

**Claude:** I'll research the current state of the /audit page and the marketing design system. Let me start by locating the relevant files.

> `Glob: src/app/**/audit/page.tsx`

> `Glob: src/app/(marketing)/**/*.tsx`

> `Glob: src/app/**/globals.css`

> `Glob: tailwind.config.*`

**Claude:** There's no root `tailwind.config.ts` (likely Tailwind v4 with CSS config). Let me read the core files.

> `Read: src/app/(marketing)/audit/page.tsx`

> `Read: src/app/(marketing)/layout.tsx`

> `Read: src/app/globals.css`

> `Glob: src/app/page.tsx`

**Claude:** Key finding so far: the `/audit` page uses a **light white/indigo** theme, while `globals.css` defines a **dark copper/cream** brand system. Let me read the homepage and hunt for shared components.

> `Read: src/app/page.tsx`

> `Glob: src/app/(marketing)/_components/**`

> `Glob: src/components/**/*.tsx`

> `Read: src/app/layout.tsx`

**Claude:** Now let me read the shared homepage components — `NavLinks` and `TestimonialsSection` — plus check what else is in `_components`.

> `Read: src/app/_components/NavLinks.tsx`

> `Read: src/app/_components/TestimonialsSection.tsx`

> `Glob: src/app/_components/**/*.tsx`

**Claude:** I now have everything needed. Here's the full research report.

---

# Research Report: `/audit` page rebuild

## 1. Current `/audit` page — verbatim content & structure

**File:** `src/app/(marketing)/audit/page.tsx` (483 lines, `'use client'`)

It's a **fully self-contained lead-magnet funnel** — it does NOT use any shared marketing components. It renders its own nav, hero, input, results, and CTA inline.

### Functionality
- Input a URL → POSTs to `/api/audit`, which **streams newline-delimited JSON** (progress events + a final `result`/`error`). Renders a 3-step progress bar.
- Results show: a summary banner, "Quick Wins", top 3 "free" content gaps, then **blurred locked gaps** behind a `Lock`-icon paywall overlay, then a conversion funnel card with an **email-capture form** that POSTs to `/api/audit/lead`.
- Types: `Gap { title, description, priority: high|medium|low, suggestedKeyword }`, `AuditResult { gaps, topicClusters, quickWins, pageCount }`.

### Verbatim copy
- **Nav brand:** `Byline` (plain bold, no period) — links: Pricing, Log in, **"Get started free"** → `/signup?plan=free&ref=audit`
- **H1:** "Find what's missing from your content strategy. **Free.**" (the "Free." in indigo)
- **Subhead:** "Enter your website URL. We'll scan your existing content and surface the gaps your competitors are filling."
- **Input placeholder:** `https://yoursite.com` · button **"Run Audit"**
- **Microcopy:** "No email required. Results in ~10 seconds."
- **Progress steps:** "Scanning your sitemap..." / "Analyzing content gaps..." / "Building your report..."
- **Trust signal:** "Analyzed 10,000+ URLs across 50+ niches."
- **Summary banner:** "Scanned **N** pages. Found **N** content gaps."
- **Section headers:** "Quick Wins", "Top Content Gaps"
- **Locked overlay:** "**N** more gaps found" / "Including **{keywords}** and N more" / CTA **"Write your first article free — no credit card needed"** / "Already have an account? Sign in →"
- **Funnel card:** "Found N content gaps on {domain}" / "**Want articles that fill these gaps, written in your brand voice?**" / "Byline turns these gaps into publish-ready, SEO-optimized articles — matched to how your site already sounds." / CTA **"Start free — no credit card required"** → `/signup?source=lead_magnet&ref=audit`
- **Email capture:** "Or get the full breakdown by email:" / placeholder `you@company.com` / button "Send report" / success: "Thanks — we'll send the full breakdown to {email}."

### ⚠️ The critical visual mismatch
The `/audit` page is styled in a **light, generic SaaS theme that is completely off-brand**:
- Background `bg-white`, text `text-gray-900`/`gray-500`/`gray-400`
- Accent color **indigo** (`indigo-600`, `indigo-50`, `indigo-700`) — *not the brand copper*
- Generic `lucide-react` icons, system font (no Playfair/DM Sans applied)

The rest of the marketing site is a **dark copper/cream editorial theme**. **This is the main reason to rebuild** — it should be migrated to the brand system below.

---

## 2 & 4. Visual design system (from homepage + globals.css)

The brand is a warm, dark, **copper-on-charcoal "editorial" aesthetic**.

### Fonts (loaded in `src/app/layout.tsx` via `next/font/google`)
| Use | Font | CSS var |
|---|---|---|
| Body / UI | **DM Sans** | `--font-dm-sans` (`font-sans`) |
| Display / headings / logo | **Playfair Display** (700, 900) | `--font-playfair` |
| Mono / code | **DM Mono** | `--font-dm-mono` |

### Color palette (hardcoded hex on homepage; also CSS vars in `globals.css`)
| Token | Hex | Role |
|---|---|---|
| Background (ink) | `#1C1917` | page bg (charcoal) |
| Card | `#231F1B` / `#2A2420` | raised surfaces |
| Deep | `#16140f` | code blocks |
| **Copper** | `#B87333` | primary accent / buttons |
| Copper hover | `#A0622A` | button hover |
| Copper light | `#D4954A` | highlights, stars |
| Cream | `#F7F3EC` | primary text |
| Cream-dim | `#A89070` | secondary text |
| Cream-faint | `#7A6555` | muted/tertiary text |
| Border | `rgba(184,115,51,0.15–0.2)` | all borders |
| Hover bg | `rgba(184,115,51,0.08)` | subtle hover |

> Note: `globals.css` exposes these as CSS variables (`--copper`, `--cream`, `--ink`, etc.) **and** supports a light theme via `:root[data-theme="light"]` (dark is default). But the **homepage hardcodes hex values directly in Tailwind arbitrary classes** (e.g. `bg-[#1C1917]`, `text-[#A89070]`) rather than using the vars. Match that convention for consistency with the homepage. There's a `ThemeToggle`/`ThemeScript` system, but the marketing homepage doesn't use it.

### Component patterns (homepage idioms to reuse)
- **Layout:** `max-w-4xl`/`max-w-5xl`/`max-w-6xl mx-auto px-6`, sections `py-20`
- **Nav:** `sticky top-0 z-50 bg-[#1C1917]/95 backdrop-blur border-b border-[rgba(184,115,51,0.15)]`, h-14
- **Logo:** Playfair, weight 900, 22px — `Byline` + copper period `.` (`<span style={{color:'#B87333'}}>.</span>`)
- **Cards:** `rounded-2xl border border-[rgba(184,115,51,0.2)] bg-[#231F1B] p-7 shadow-sm`
- **Primary button:** `bg-[#B87333] text-[#F7F3EC] hover:bg-[#A0622A] rounded-lg/xl font-semibold`
- **Secondary/ghost button:** `border border-[#B87333] text-[#B87333] hover:bg-[rgba(184,115,51,0.08)]`
- **Headings:** `text-3xl/5xl font-bold tracking-tight text-[#F7F3EC]`
- **Body text:** `text-[#A89070] leading-relaxed`
- **Eyebrow labels:** `text-xs font-semibold text-[#B87333] uppercase tracking-wider`
- **Numbered step badges:** `w-8 h-8 rounded-full bg-[#B87333] text-[#F7F3EC]`
- **Icons:** `lucide-react`, sized `w-4/6 h-4/6`, copper-tinted

---

## 3. Marketing layout

**File:** `src/app/(marketing)/layout.tsx` — **empty passthrough**:
```tsx
export default function MarketingLayout({ children }) { return <>{children}</> }
```
It applies **no nav, footer, fonts, or wrapper**. All global setup (fonts, theme script, analytics, dark `<body>`) lives in the **root** `src/app/layout.tsx`. So each marketing page renders its own nav + footer inline (the homepage does; the audit page does too). **A rebuild must bring its own nav/footer** — there's nothing shared to inherit at the layout level.

---

## 5. Reusable marketing components

Shared components live in **`src/app/_components/`** (note: the root `_components`, NOT `(marketing)/_components/` — that directory doesn't exist).

| Component | Reusable for audit rebuild? |
|---|---|
| **`NavLinks.tsx`** | ✅ **Yes.** Auth-aware nav (logged out: Pricing/Log in/Get started; logged in: Help/Settings/Dashboard). Already brand-styled (copper/cream). The homepage pairs it with the Playfair logo span. *Caveat:* its CTA points to `/pricing`, whereas the audit page currently wants `/signup?plan=free&ref=audit` — you may want a variant or to keep a custom nav for funnel-specific CTAs. |
| **`TestimonialsSection.tsx`** | ✅ Available (used by homepage + pricing). Self-contained social proof grid, brand-styled. Optional for audit. |
| `ThemeToggle.tsx` / `ThemeScript.tsx` | Theme switching infra; homepage doesn't use the toggle. Probably skip. |
| `SupportWidget.tsx` | Global support chat widget. |
| `AnalyticsScripts` / `AnalyticsPageView` | Wired in root layout; nothing to do. |

**There is no shared `Hero`, `Footer`, or `Button` component** — the homepage inlines its own nav, `PrimaryCta`/`GuaranteeLine` helpers, and footer. For a brand-consistent rebuild you'd either copy the homepage's footer markup or extract it.

### Footer markup to mirror (from homepage, lines 428–457)
`© {year} Peacock Creative Services LLC` · links: Blog, Privacy, Terms, `mailto:policies@bylineseo.com`, X, LinkedIn. Note the homepage footer itself contains a **"Start your free audit →"** CTA pointing to `/audit`.

---

## Summary / recommendations for the rebuild
1. **Re-skin from light-indigo → dark copper/cream.** Swap `bg-white`/`gray-*`/`indigo-*` for `#1C1917`/`#A89070`/`#B87333` etc. This is the core fix.
2. **Adopt brand nav:** use the Playfair logo span + `<NavLinks />` (or a funnel-specific variant), matching the homepage's nav exactly.
3. **Add the homepage footer** (currently the audit page has none).
4. **Use Playfair Display for the H1**, DM Sans for body.
5. **Keep all existing copy and the streaming/email-capture logic** — only the visual layer is off-brand; the funnel mechanics are sound.
6. Optionally drop in `<TestimonialsSection />` for social proof.

No files were changed — research only.
