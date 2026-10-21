/**
 * Generate a sample article through the real brief prompt and draft pipeline,
 * without touching the database, and score it with the draft engine. For
 * checking the generator against the 2026-10-02 audit.
 *
 *   npx tsx scripts/generate-sample.ts "<topic keyword>" [comparison|informational] [evidence text]
 *
 * Writes <dir>/<date>_<slug>.md (article) and .json (brief, generation report,
 * draft report) under BYLINE_AUDIT_DIR/generator-samples.
 */
import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

config({ path: '.env.local', quiet: true })
config({ path: 'C:/dev/Byline/.env.local', quiet: true })

const ROOT = process.env.BYLINE_AUDIT_DIR || 'C:\\Users\\ozzy5\\Documents\\byline-audits'

// Byline's own brand profile as it stands (author not set), so the sample is
// what Michael's account would get.
const BRAND = {
  name: 'Byline SEO',
  industry: 'SaaS',
  audience: 'Content marketers, SEO managers, and founders at small to mid-size B2B companies who need to produce search-optimized content consistently without a large writing team.',
  voice: 'Professional',
  tone: "Thought-leading and visionary. Grounded in data with a revolutionary edge. Position as industry disruptor—challenging what's broken, proving it with evidence, and showing the better way forward.",
  competitors: 'Surfer SEO, Frase, Jasper, MarketMuse, NeuronWriter, Clearscope',
}

async function main() {
  const [topic, intent = 'informational', evidence = ''] = process.argv.slice(2)
  if (!topic) {
    console.error('Usage: npx tsx scripts/generate-sample.ts "<topic>" [comparison|informational] [evidence]')
    process.exit(1)
  }
  const { default: OpenAI } = await import('openai')
  const { buildBriefPrompt } = await import('../src/lib/generator/prompts')
  const { runDraftPipeline } = await import('../src/lib/generator/pipeline')
  const { buildDraftReport } = await import('../src/lib/geo-audit/draft-report')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const briefRes = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: buildBriefPrompt({ brand: BRAND, keywordLines: `- "${topic}"`, directTopic: `${topic} (${intent})` }) }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2000,
  })
  const brief = JSON.parse(briefRes.choices[0].message.content ?? '{}')
  console.error(`brief: ${brief.h1_options?.[0]} (${brief.outline?.length} sections)`)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outlineText = (brief.outline ?? []).map((s: any) => `${s.heading_level === 'H3' ? '###' : '##'} ${s.heading}\n  → ${s.notes} (~${s.word_count_target} words)`).join('\n\n')
  const sources = evidence ? [{ label: 'Supplied by the writer for this article', text: evidence }] : []
  const title = brief.h1_options?.[0] ?? topic

  const out = await runDraftPipeline(
    async (req) => {
      const r = await openai.chat.completions.create({
        model: req.model === 'main' ? 'gpt-4o' : 'gpt-4o-mini',
        messages: [...(req.system ? [{ role: 'system' as const, content: req.system }] : []), { role: 'user' as const, content: req.user }],
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        ...(req.json ? { response_format: { type: 'json_object' as const } } : {}),
      })
      return r.choices[0].message.content ?? ''
    },
    {
      articleId: 'sample', brand: BRAND, author: null, sources, keyword: brief.target_keyword ?? topic,
      secondaryKeywords: brief.secondary_keywords ?? [], title, serpIntent: brief.serp_intent ?? intent,
      toneNotes: brief.tone_notes ?? '', competitorGaps: brief.competitor_gaps ?? [], directAnswer: brief.direct_answer ?? null,
      outlineText, targetWordCount: brief.word_count_target ?? 1500, polish: true,
      onStage: (s) => { console.error(`  ${s}`) },
    },
  )
  const draft = buildDraftReport({ markdown: out.content, articleId: 'sample', title, brandName: BRAND.name, author: null, now: new Date() })

  const dir = join(ROOT, 'generator-samples')
  mkdirSync(dir, { recursive: true })
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace('T', '_').replace(/:/g, '')
  writeFileSync(join(dir, `${stamp}_${slug}.md`), `# ${title}\n\n${out.content}\n`)
  writeFileSync(join(dir, `${stamp}_${slug}.json`), JSON.stringify({ topic, intent, evidence, brief, report: out.report, draft }, null, 2))

  const checks = draft.retrievability.groups.flatMap((g) => g.checks).filter((c) => c.scored).map((c) => `${c.name} ${c.score}/${c.maxScore}`)
  console.log(JSON.stringify({
    file: join(dir, `${stamp}_${slug}.md`),
    words: out.wordCount,
    retrievable: draft.retrievability.score,
    citable: draft.citability.label,
    checks,
    signals: draft.citability.signals.map((s) => `${s.name}: ${s.band}`),
    placeholders: out.report.evidenceReplaced.length,
    replaced: out.report.evidenceReplaced.map((r) => ({ original: r.original, reason: r.reason })),
    triads: `${out.report.triadsFound} found, ${out.report.triadsRemaining} remaining`,
    bannedWords: `${out.report.bannedWordsFound} found, ${out.report.bannedWordsRemaining} remaining`,
    evidenceUnused: out.report.evidenceUnused,
    openingAdded: out.report.openingAdded,
    openingSplit: out.report.openingSplit,
    headingsPromoted: out.report.headingsPromoted,
    bodyH1Removed: out.report.bodyH1Removed,
    revision: out.report.revision,
  }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
