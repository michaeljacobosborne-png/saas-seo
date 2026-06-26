'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { FileText, Loader2, AlertCircle, ArrowLeft, Upload } from 'lucide-react'
import * as mammoth from 'mammoth'

function htmlToMarkdown(html: string): string {
  return html
    // Headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    // Bold and italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    // Lists
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    // Line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface Suggestion {
  category: 'seo' | 'readability' | 'structure' | 'content'
  severity: 'high' | 'medium' | 'low'
  issue: string
  fix: string
}

interface ContentGap {
  topic: string
  rationale: string
  suggestedKeyword: string
}

interface ScoreResult {
  seo: { score: number }
  readability: { score: number }
  geo: { score: number }
  aeo: { score: number }
}

interface AnalyzeResult {
  scores: ScoreResult
  suggestions: Suggestion[]
  contentGaps: ContentGap[]
  articleId?: string
}

type Status = 'idle' | 'loading' | 'done' | 'error'

function ScoreColor({ score }: { score: number }) {
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-[var(--copper-lt)]'
  return 'text-[#f87171]'
}

function SeverityBadge({ severity }: { severity: Suggestion['severity'] }) {
  const map = {
    high: 'bg-[rgba(220,60,60,0.12)] text-[#f87171] border-[rgba(220,60,60,0.3)]',
    medium: 'bg-[rgba(184,115,51,0.12)] text-[var(--copper-lt)] border-[rgba(184,115,51,0.3)]',
    low: 'bg-[var(--ink-card)] text-[var(--cream-dim)] border-[rgba(184,115,51,0.2)]',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${map[severity]}`}>
      {severity}
    </span>
  )
}

export default function ImportArticlePage() {
  const [content, setContent] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [progress, setProgress] = useState<{ message: string; step: number; total: number } | null>(null)
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0
  const isAnalyzing = status === 'loading'

  async function runAnalysis(saveAsArticle = false) {
    if (!content.trim()) return

    if (saveAsArticle) {
      setSaving(true)
      setSaveError(null)
    } else {
      setStatus('loading')
      setError(null)
      setResult(null)
      setProgress(null)
    }

    try {
      const res = await fetch('/api/articles/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          targetKeyword: targetKeyword.trim() || undefined,
          saveAsArticle,
        }),
      })

      if (!res.ok || !res.body) {
        let msg = 'Analysis failed'
        try {
          const data = await res.json()
          msg = data.error ?? msg
        } catch { /* keep default */ }
        if (saveAsArticle) {
          setSaveError(msg)
          setSaving(false)
        } else {
          setError(msg)
          setStatus('error')
        }
        return
      }

      const reader = res.body.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: AnalyzeResult | null = null
      let streamError: string | null = null

      const handleLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        let evt: { type?: string; message?: string; step?: number; total?: number; error?: string; [k: string]: unknown }
        try {
          evt = JSON.parse(trimmed)
        } catch {
          return
        }
        if (evt.type === 'progress' && !saveAsArticle) {
          setProgress({ message: evt.message ?? '', step: evt.step ?? 0, total: evt.total ?? 0 })
        } else if (evt.type === 'result') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { type, ...data } = evt
          finalResult = data as unknown as AnalyzeResult
        } else if (evt.type === 'error') {
          streamError = evt.error ?? 'Analysis failed'
        }
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl
        while ((nl = buffer.indexOf('\n')) !== -1) {
          handleLine(buffer.slice(0, nl))
          buffer = buffer.slice(nl + 1)
        }
      }
      handleLine(buffer)

      if (streamError) {
        if (saveAsArticle) {
          setSaveError(streamError)
          setSaving(false)
        } else {
          setError(streamError)
          setStatus('error')
        }
        return
      }

      if (saveAsArticle) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const savedId = (finalResult as any)?.articleId as string | undefined
        if (savedId) setSavedArticleId(savedId)
        setSaving(false)
        return
      }

      if (!finalResult) {
        setError('Analysis failed. Please try again.')
        setStatus('error')
        return
      }

      setResult(finalResult)
      setStatus('done')
    } catch {
      if (saveAsArticle) {
        setSaveError('Network error. Please try again.')
        setSaving(false)
      } else {
        setError('Network error. Please try again.')
        setStatus('error')
      }
    }
  }

  async function handleFileUpload(file: File) {
    if (!file.name.endsWith('.docx')) {
      setConvertError('Only .docx files are supported.')
      return
    }
    setUploadedFile(file)
    setConverting(true)
    setConvertError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      const markdown = htmlToMarkdown(result.value)
      setContent(markdown)
    } catch {
      setConvertError('Failed to convert file. Please try a different .docx file.')
    } finally {
      setConverting(false)
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  function reset() {
    setStatus('idle')
    setError(null)
    setResult(null)
    setProgress(null)
    setSavedArticleId(null)
    setSaveError(null)
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link
          href="/articles"
          className="flex items-center gap-1.5 text-xs text-[var(--cream-dim)] hover:text-[var(--cream)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Articles
        </Link>
      </div>
      <div className="flex items-start gap-3 mb-2">
        <div className="inline-flex p-2 rounded-xl mt-0.5" style={{ background: 'rgba(184,115,51,0.08)' }}>
          <FileText className="w-5 h-5 text-[var(--copper-lt)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--cream)]">Import & Analyze Article</h1>
          <p className="text-sm text-[var(--cream-dim)] mt-1">
            Paste an existing article to score it across SEO, readability, GEO, and AEO — and get AI-powered suggestions to improve it.
          </p>
        </div>
      </div>

      <div className="mb-8" />

      {/* Phase 1 — idle input */}
      {status === 'idle' && (
        <div className="space-y-4">
          {/* .docx upload drop zone */}
          <div>
            <label className="block text-xs font-medium text-[var(--cream-dim)] mb-2">
              Upload .docx File <span className="text-[var(--cream-faint)] font-normal">(optional — or paste below)</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl py-7 px-4 cursor-pointer transition-colors select-none"
              style={{
                border: `2px dashed ${isDragOver ? 'rgba(184,115,51,0.6)' : 'rgba(184,115,51,0.2)'}`,
                background: isDragOver ? 'rgba(184,115,51,0.06)' : 'var(--ink-card)',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                  e.target.value = ''
                }}
              />
              {converting ? (
                <>
                  <Loader2 className="w-6 h-6 text-[var(--copper-lt)] animate-spin" />
                  <p className="text-sm text-[var(--cream-dim)]">Converting…</p>
                </>
              ) : uploadedFile && !convertError ? (
                <>
                  <FileText className="w-6 h-6 text-[var(--copper-lt)]" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--cream)]">{uploadedFile.name}</span>
                    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium border border-green-500/30 text-green-400" style={{ background: 'rgba(34,197,94,0.08)' }}>
                      Converted
                    </span>
                  </div>
                  <p className="text-xs text-[var(--cream-faint)]">Click to replace file</p>
                </>
              ) : (
                <>
                  <FileText className="w-6 h-6 text-[var(--copper-lt)]" />
                  <p className="text-sm text-[var(--cream-dim)]">
                    Drag & drop a <span className="text-[var(--cream)]">.docx</span> file, or <span className="text-[var(--copper-lt)] underline">click to browse</span>
                  </p>
                  <p className="text-xs text-[var(--cream-faint)]">Word documents only</p>
                </>
              )}
            </div>
            {convertError && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.25)' }}>
                <AlertCircle className="w-3.5 h-3.5 text-[#f87171] shrink-0" />
                <p className="text-xs text-[#f87171]">{convertError}</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--cream-dim)] mb-2">
              Article Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your article content here…"
              className="w-full min-h-[320px] px-4 py-3 rounded-xl text-sm text-[var(--cream)] placeholder:text-[var(--cream-faint)] resize-y focus:outline-none focus:ring-2 focus:ring-[#B87333] transition-shadow"
              style={{
                background: 'var(--ink-card)',
                border: '1px solid rgba(184,115,51,0.2)',
              }}
            />
            <p className="text-xs text-[var(--cream-faint)] mt-1.5">
              {wordCount > 0 ? `${wordCount.toLocaleString()} words` : '0 words'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--cream-dim)] mb-2">
              Target Keyword <span className="text-[var(--cream-faint)] font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g. best project management software"
              className="w-full px-4 py-2.5 rounded-xl text-sm text-[var(--cream)] placeholder:text-[var(--cream-faint)] focus:outline-none focus:ring-2 focus:ring-[#B87333] transition-shadow"
              style={{
                background: 'var(--ink-card)',
                border: '1px solid rgba(184,115,51,0.2)',
              }}
            />
          </div>

          <div className="pt-2">
            <button
              onClick={() => runAnalysis(false)}
              disabled={!content.trim() || isAnalyzing}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: '#B87333', color: 'white' }}
            >
              <Upload className="w-4 h-4" />
              Analyze Article
            </button>
          </div>
        </div>
      )}

      {/* Phase 2 — loading */}
      {status === 'loading' && (
        <div className="bg-[var(--ink-card)] rounded-2xl p-16 text-center border border-[rgba(184,115,51,0.25)]">
          <style>{`@keyframes analyze-progress {0%{transform:translateX(-120%)}100%{transform:translateX(420%)}}`}</style>
          <Loader2 className="w-10 h-10 animate-spin text-[var(--copper-lt)] mx-auto mb-4" />
          <p className="text-base font-semibold text-[var(--cream)]">
            Analyzing your article…
          </p>
          <p className="text-sm text-[var(--cream-dim)] mt-1">
            {progress?.message ?? 'Getting started…'}
          </p>

          <div className="mt-5 max-w-sm mx-auto h-1.5 rounded-full overflow-hidden bg-[rgba(184,115,51,0.15)]">
            {progress && progress.total > 0 ? (
              <div
                className="h-full bg-[var(--copper)] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, Math.round((progress.step / progress.total) * 100))}%` }}
              />
            ) : (
              <div
                className="h-full w-1/4 bg-[var(--copper)] rounded-full"
                style={{ animation: 'analyze-progress 1.2s ease-in-out infinite' }}
              />
            )}
          </div>

          {progress && progress.total > 0 && (
            <p className="text-xs text-[var(--copper-lt)] mt-2">
              Step {progress.step} of {progress.total}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div>
          <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4" style={{ background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.25)' }}>
            <AlertCircle className="w-4 h-4 text-[#f87171] mt-0.5 shrink-0" />
            <p className="text-sm text-[#f87171]">{error}</p>
          </div>
          <button
            onClick={reset}
            className="text-sm text-[var(--copper-lt)] hover:text-[var(--copper)] transition-colors underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Phase 3 — results */}
      {status === 'done' && result && (
        <div className="space-y-8">
          {/* Score cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {([
              { label: 'SEO', score: result.scores.seo.score },
              { label: 'Readability', score: result.scores.readability.score },
              { label: 'GEO', score: result.scores.geo.score },
              { label: 'AEO', score: result.scores.aeo.score },
            ] as const).map(({ label, score }) => (
              <div
                key={label}
                className="rounded-xl p-5 text-center border border-[rgba(184,115,51,0.2)]"
                style={{ background: 'var(--ink-card)' }}
              >
                <div className={`text-3xl font-bold tabular-nums ${ScoreColor({ score })}`}>
                  {score}
                </div>
                <div className="text-xs text-[var(--cream-dim)] mt-1 font-medium">{label}</div>
              </div>
            ))}
          </div>

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--cream)] mb-3">
                Improvement Suggestions ({result.suggestions.length})
              </h2>
              <div className="space-y-3">
                {result.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 border border-[rgba(184,115,51,0.2)]"
                    style={{ background: 'var(--ink)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1.5">
                          <SeverityBadge severity={s.severity} />
                          <span className="text-xs text-[var(--cream-faint)] capitalize">{s.category}</span>
                        </div>
                        <p className="text-sm text-[var(--cream)]">{s.issue}</p>
                        {s.fix && (
                          <p className="text-xs text-[var(--cream-dim)] mt-1">
                            <span className="font-medium text-[var(--copper-lt)]">Fix:</span> {s.fix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content gaps */}
          {result.contentGaps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--cream)] mb-3">
                Content Gaps ({result.contentGaps.length})
              </h2>
              <div className="space-y-3">
                {result.contentGaps.map((gap, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 border border-[rgba(184,115,51,0.2)]"
                    style={{ background: 'var(--ink)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--cream)] mb-1">{gap.topic}</p>
                        {gap.rationale && (
                          <p className="text-xs text-[var(--cream-dim)] mb-2">{gap.rationale}</p>
                        )}
                        {gap.suggestedKeyword && (
                          <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border border-[rgba(184,115,51,0.3)] text-[var(--copper-lt)]" style={{ background: 'rgba(184,115,51,0.1)' }}>
                            {gap.suggestedKeyword}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save / reset actions */}
          <div className="flex flex-col gap-3">
            {savedArticleId ? (
              <div className="flex items-center gap-3">
                <div className="flex items-start gap-2 rounded-xl px-4 py-3 flex-1" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <p className="text-sm text-green-400">
                    Article saved successfully.{' '}
                    <Link href={`/articles/${savedArticleId}`} className="underline hover:text-green-300 transition-colors">
                      Open article →
                    </Link>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => runAnalysis(true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                  style={{ background: '#B87333', color: 'white' }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save to Articles'}
                </button>
                {saveError && (
                  <p className="text-xs text-[#f87171]">{saveError}</p>
                )}
              </div>
            )}

            <div>
              <button
                onClick={reset}
                className="text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
                style={{
                  borderColor: 'rgba(184,115,51,0.25)',
                  color: 'var(--copper)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(184,115,51,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                Analyze Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
