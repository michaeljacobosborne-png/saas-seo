'use client'

import { useState, useTransition } from 'react'
import { xLength, type QueuePart } from '@/lib/outreach-queue/parse'
import { keepLive, markDone, undoDone } from './actions'

export interface Item {
  id: string
  type: string
  account: string
  platform: string
  target: string | null
  parts: QueuePart[]
  warning: string | null
  note: string | null
  needsRerun: boolean
  closesOn: string | null
  waitingFor: string[]
  /** Set on stale items: whole days since anything changed. */
  idleDays?: number
}

const X_LIMIT = 280
const card = { background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older mobile browsers: select a hidden textarea and copy that.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

function partLabel(p: QueuePart): string | null {
  if (p.part) {
    const [n, of] = p.part.split('/')
    return `Part ${n} of ${of}`
  }
  if (p.alt) return `Alternative: ${p.alt}`
  return null
}

function closesLabel(d: string): string {
  const [y, m, dd] = d.split('-').map(Number)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, dd)))
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text)
        setState(ok ? 'copied' : 'failed')
        setTimeout(() => setState('idle'), 1800)
      }}
      className="w-full rounded-lg text-base font-semibold active:scale-[0.99] transition"
      style={{
        minHeight: 52,
        background: state === 'copied' ? '#2f6b3a' : 'var(--copper)',
        color: '#fff',
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed, select the text' : 'Copy'}
    </button>
  )
}

function Part({ part, platform }: { part: QueuePart; platform: string }) {
  const label = partLabel(part)
  const isX = platform === 'X'
  const n = isX ? xLength(part.text) : 0
  return (
    <div className="space-y-2">
      {(label || isX) && (
        <div className="flex items-center justify-between text-xs text-[var(--cream-dim)]">
          <span>{label}</span>
          {isX && (
            <span className="font-mono" style={{ color: n > X_LIMIT ? '#e5484d' : undefined }}>
              {n}/{X_LIMIT}
            </span>
          )}
        </div>
      )}
      <div
        className="whitespace-pre-wrap break-words rounded-lg p-3 text-[15px] leading-relaxed text-[var(--cream)] select-text"
        style={{ background: 'var(--ink-deep)' }}
      >
        {part.text}
      </div>
      <CopyButton text={part.text} />
    </div>
  )
}

function shortAccount(a: string): string {
  return a.split(',')[0].trim()
}

function ItemCard({ item, onDone, onKeep, busy }: { item: Item; onDone?: () => void; onKeep?: () => void; busy?: boolean }) {
  return (
    <article className="rounded-xl p-4 space-y-4" style={card}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded px-2 py-0.5 font-mono font-semibold" style={{ background: 'rgba(184,115,51,0.2)', color: 'var(--copper-lt)' }}>
            {item.id}
          </span>
          <span className="text-[var(--cream-dim)]">
            {item.type} · {item.platform} · {shortAccount(item.account)}
          </span>
          {item.closesOn && (
            <span className="rounded px-2 py-0.5 font-semibold" style={{ background: '#7a2e1c', color: '#fff' }}>
              Closes {closesLabel(item.closesOn)}
            </span>
          )}
          {item.idleDays !== undefined && (
            <span className="rounded px-2 py-0.5 font-semibold" style={{ background: 'rgba(122,101,85,0.35)', color: 'var(--cream)' }}>
              Stale, untouched {item.idleDays} days
            </span>
          )}
        </div>
        {item.target && <p className="text-sm text-[var(--cream)]">To: {item.target}</p>}
      </header>

      {item.waitingFor.length > 0 && (
        <p className="text-sm text-[var(--cream-dim)]">Waiting for {item.waitingFor.join(', ')} to be done first.</p>
      )}

      {/* Warnings sit above every copy button, never below. */}
      {item.warning && (
        <div role="note" className="rounded-lg p-3 text-sm leading-relaxed" style={{ background: 'rgba(229,160,13,0.14)', border: '1px solid rgba(229,160,13,0.5)', color: 'var(--cream)' }}>
          <strong className="block mb-1">{item.needsRerun ? 'Re-run first' : 'Before you send'}</strong>
          {item.warning}
        </div>
      )}

      {item.parts.map((p, i) => (
        <Part key={i} part={p} platform={item.platform} />
      ))}

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="w-full rounded-lg text-base font-semibold disabled:opacity-50"
          style={{ minHeight: 48, border: '1px solid var(--copper)', color: 'var(--copper-lt)', background: 'transparent' }}
        >
          Mark done
        </button>
      )}

      {onKeep && (
        <button
          type="button"
          onClick={onKeep}
          disabled={busy}
          className="w-full rounded-lg text-base font-semibold disabled:opacity-50 text-[var(--cream-dim)]"
          style={{ minHeight: 48, border: '1px solid rgba(184,115,51,0.3)', background: 'transparent' }}
        >
          Still live, keep it 7 more days
        </button>
      )}

      {item.note && (
        <details className="text-sm text-[var(--cream-dim)]">
          <summary className="cursor-pointer py-2">Context</summary>
          <p className="leading-relaxed">{item.note}</p>
        </details>
      )}
    </article>
  )
}

export default function TodayList(props: {
  dateLabel: string
  today: Item[]
  held: Item[]
  blocked: Item[]
  stale: Item[]
  doneToday: Item[]
  pendingCount: number
  caps: { comments: string; outbound: string }
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const done = (id: string) => {
    setHidden((s) => new Set(s).add(id))
    setError(null)
    startTransition(async () => {
      try {
        await markDone(id)
      } catch {
        setHidden((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
        setError(`Could not mark ${id} done. Try again.`)
      }
    })
  }

  const undo = (id: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await undoDone(id)
        setHidden((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
      } catch {
        setError(`Could not undo ${id}. Try again.`)
      }
    })
  }

  const keep = (id: string) => {
    setHidden((s) => new Set(s).add(id))
    setError(null)
    startTransition(async () => {
      try {
        await keepLive(id)
      } catch {
        setHidden((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        })
        setError(`Could not keep ${id}. Try again.`)
      }
    })
  }

  const today = props.today.filter((i) => !hidden.has(i.id))
  const held = props.held.filter((i) => !hidden.has(i.id))
  const stale = props.stale.filter((i) => !hidden.has(i.id))
  const rest = held.length + props.blocked.length + stale.length

  return (
    <main className="mx-auto max-w-xl px-4 py-6 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--cream)]">Today</h1>
        <p className="text-sm text-[var(--cream-dim)]">{props.dateLabel}</p>
        <p className="mt-1 text-xs text-[var(--cream-faint)]">
          Comments {props.caps.comments} · Outbound {props.caps.outbound} · {props.pendingCount} still in the queue
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg p-3 text-sm" style={{ background: '#7a2e1c', color: '#fff' }}>{error}</p>
      )}

      {today.length === 0 ? (
        <p className="rounded-xl p-4 text-[var(--cream)]" style={card}>
          Nothing left for today. Anything else is held by the daily and weekly limits, waiting on another item, or stale.
        </p>
      ) : (
        today.map((item) => <ItemCard key={item.id} item={item} onDone={() => done(item.id)} busy={pending} />)
      )}

      {props.doneToday.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Done today</h2>
          <ul className="space-y-2">
            {props.doneToday.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg px-3" style={{ ...card, minHeight: 48 }}>
                <span className="text-sm text-[var(--cream-dim)]">
                  <span className="font-mono">{i.id}</span> · {i.platform} · {shortAccount(i.account)}
                </span>
                <button type="button" onClick={() => undo(i.id)} disabled={pending} className="px-3 text-sm font-semibold text-[var(--copper-lt)]" style={{ minHeight: 48 }}>
                  Undo
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rest > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full rounded-lg text-base font-semibold text-[var(--cream)]"
          style={{ ...card, minHeight: 48 }}
          aria-expanded={showAll}
        >
          {showAll ? 'Hide the rest' : `See all (${rest} more)`}
        </button>
      )}

      {showAll && (
        <div className="space-y-5">
          {held.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Held by today&apos;s limits ({held.length})</h2>
              {held.map((item) => <ItemCard key={item.id} item={item} onDone={() => done(item.id)} busy={pending} />)}
            </section>
          )}
          {props.blocked.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Waiting on another item ({props.blocked.length})</h2>
              {props.blocked.map((item) => <ItemCard key={item.id} item={item} />)}
            </section>
          )}
          {stale.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Stale, nothing changed in 7 days ({stale.length})</h2>
              <p className="text-sm text-[var(--cream-dim)]">These no longer reach today&apos;s list. Mark one done if it went out, or keep it if it is still worth sending.</p>
              {stale.map((item) => <ItemCard key={item.id} item={item} onDone={() => done(item.id)} onKeep={() => keep(item.id)} busy={pending} />)}
            </section>
          )}
        </div>
      )}
    </main>
  )
}
