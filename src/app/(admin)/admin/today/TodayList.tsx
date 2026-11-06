'use client'

import { useState, useTransition } from 'react'
import { xLength, type QueuePart } from '@/lib/outreach-queue/parse'
import { acceptRequest, blockItem, giveUpOnRequest, keepLive, keepWaitingOnRequest, markDone, unblockItem, undoDone, type ActionResult } from './actions'

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
  /** Set on stale items: whole days since anything changed. On waiting items: days waiting. */
  idleDays?: number
  /** Why it is waiting on someone else. Only on blocked items. */
  blockedReason?: string | null
}

/** One person in the outreach column: the request and the message behind it. */
export interface OutreachCardView {
  key: string
  stage: 'request' | 'accept' | 'message'
  request: Item | null
  message: Item | null
  waitingReason?: string | null
  days?: number
  decide?: boolean
  /** The person on LinkedIn: their profile when we have it, else a search for name and company. */
  profile?: { url: string; direct: boolean } | null
}

export interface ColumnView<I> {
  key: 'social' | 'comments' | 'outreach'
  label: string
  due: I[]
  held: string[]
  waiting: string[]
  empty: string | null
}

export interface TodayView {
  dateLabel: string
  replies: Item[]
  social: ColumnView<Item>
  comments: ColumnView<Item>
  outreach: ColumnView<OutreachCardView> & { awaiting: OutreachCardView[] }
  stale: Item[]
  waitingOnOthers: Item[]
  doneToday: Item[]
  shownPerColumn: number
  /** The rule every plain request follows, shown once at the top of Outreach. */
  requestRule: string | null
  caps: { comments: string; outbound: string; requests: string }
}

const X_LIMIT = 280
const card = { background: 'var(--ink-card)', border: '1px solid rgba(184,115,51,0.18)' }
const panel = { background: 'rgba(36,25,22,0.6)', border: '1px solid rgba(184,115,51,0.18)' }

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

function shortAccount(a: string): string {
  return a.split(',')[0].trim()
}

/** "Dan Taylor" from "Dan Taylor, SALT.agency, on his post ...". */
function shortTarget(t: string | null): string {
  return (t ?? '').split(',')[0].trim()
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
      style={{ minHeight: 48, background: state === 'copied' ? '#2f6b3a' : 'var(--copper)', color: '#fff' }}
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
      <div className="whitespace-pre-wrap break-words rounded-lg p-3 text-[15px] leading-relaxed text-[var(--cream)] select-text" style={{ background: 'var(--ink-deep)' }}>
        {part.text}
      </div>
      <CopyButton text={part.text} />
    </div>
  )
}

/** Warnings sit above every copy button, never below. */
function Warning({ item }: { item: Item }) {
  if (!item.warning) return null
  return (
    <div role="note" className="rounded-lg p-3 text-sm leading-relaxed" style={{ background: 'rgba(229,160,13,0.14)', border: '1px solid rgba(229,160,13,0.5)', color: 'var(--cream)' }}>
      <strong className="block mb-1">{item.needsRerun ? 'Re-run first' : 'Before you send'}</strong>
      {item.warning}
    </div>
  )
}

function Context({ item }: { item: Item }) {
  if (!item.note) return null
  return (
    <details className="text-sm text-[var(--cream-dim)]">
      <summary className="cursor-pointer py-2">Context</summary>
      <p className="leading-relaxed">{item.note}</p>
    </details>
  )
}

function DoneButton({ onDone, busy, label = 'Mark done' }: { onDone: () => void; busy?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onDone}
      disabled={busy}
      className="w-full rounded-lg text-base font-semibold disabled:opacity-50"
      style={{ minHeight: 48, border: '1px solid var(--copper)', color: 'var(--copper-lt)', background: 'transparent' }}
    >
      {label}
    </button>
  )
}

function WaitButton({ onWait, busy }: { onWait: (reason: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg text-sm text-[var(--cream-dim)]" style={{ minHeight: 44, background: 'transparent' }}>
        Waiting on someone else
      </button>
    )
  }
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="What are you waiting for?"
        className="w-full rounded-lg px-3 text-base text-[var(--cream)]"
        style={{ minHeight: 48, background: 'var(--ink-deep)', border: '1px solid rgba(184,115,51,0.3)' }}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !reason.trim()}
          onClick={() => onWait(reason.trim())}
          className="flex-1 rounded-lg text-base font-semibold disabled:opacity-50"
          style={{ minHeight: 48, border: '1px solid var(--copper)', color: 'var(--copper-lt)', background: 'transparent' }}
        >
          Move to waiting
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 text-base text-[var(--cream-dim)]" style={{ minHeight: 48, background: 'transparent' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function Meta({ left, right }: { left: string; right?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs text-[var(--cream-faint)]">
      <span className="min-w-0 truncate">{left}</span>
      {right && <span className="shrink-0">{right}</span>}
    </div>
  )
}

/** A post, comment or reply: its text, warnings above the copy button, one tap to mark done. */
function ItemCard({ item, onDone, onWait, onKeep, busy }: { item: Item; onDone?: () => void; onWait?: (reason: string) => void; onKeep?: () => void; busy?: boolean }) {
  const who = item.type === 'social post' ? `${shortAccount(item.account)}, ${item.platform}` : shortTarget(item.target) || shortAccount(item.account)
  const right = item.idleDays !== undefined ? `idle ${item.idleDays} days` : item.closesOn ? `closes ${closesLabel(item.closesOn)}` : null
  return (
    <article className="rounded-xl p-3 space-y-3" style={card}>
      <Meta left={`${item.id} · ${who}`} right={right} />
      <Warning item={item} />
      {item.parts.map((p, i) => (
        <Part key={i} part={p} platform={item.platform} />
      ))}
      {onDone && <DoneButton onDone={onDone} busy={busy} />}
      {onKeep && (
        <button
          type="button"
          onClick={onKeep}
          disabled={busy}
          className="w-full rounded-lg text-sm font-semibold disabled:opacity-50 text-[var(--cream-dim)]"
          style={{ minHeight: 44, border: '1px solid rgba(184,115,51,0.3)', background: 'transparent' }}
        >
          Still live, keep it 7 more days
        </button>
      )}
      {onWait && <WaitButton onWait={onWait} busy={busy} />}
      <Context item={item} />
    </article>
  )
}

function Pip({ n, on }: { n: string; on: boolean }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
      style={on ? { background: 'var(--copper)', color: '#1a1210' } : { border: '1px solid rgba(184,115,51,0.3)', color: 'var(--cream-faint)' }}
    >
      {n}
    </span>
  )
}

function messageLength(m: Item | null): string {
  const t = m?.parts[0]?.text
  return t ? `${t.length} characters` : 'no message drafted'
}

/**
 * One person, two stages: the plain connection request, then the message that
 * follows it once they accept. The waiting stage says what it waits for.
 */
function OutreachCard({ c, act, busy }: { c: OutreachCardView; act: Actions; busy: boolean }) {
  const lead = c.request ?? c.message!
  const ids = [c.request?.id, c.message?.id].filter(Boolean).join(' → ')
  const right = c.stage === 'accept' && c.days !== undefined ? `sent ${c.days === 0 ? 'today' : `${c.days} day${c.days === 1 ? '' : 's'} ago`}` : null
  const releaseId = c.request?.id ?? null
  return (
    <article className="rounded-xl p-3 space-y-2" style={card}>
      <Meta left={`${ids} · ${shortTarget(lead.target)}`} right={right} />
      {/* The one thing a request card needs: a way to reach the person. */}
      {c.profile && (
        <a
          href={c.profile.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center rounded-lg text-sm font-semibold"
          style={{ minHeight: 44, border: '1px solid rgba(184,115,51,0.35)', color: 'var(--copper-lt)' }}
        >
          {c.profile.direct ? 'Open LinkedIn profile' : 'Find on LinkedIn'}
        </a>
      )}

      {c.request && (
        <div className="flex gap-2 py-1">
          <Pip n={c.stage === 'request' ? '1' : '✓'} on={c.stage === 'request'} />
          <div className="min-w-0 flex-1 space-y-2">
            {c.stage === 'request' ? (
              <>
                <p className="text-sm text-[var(--cream)]">Send the connection request, no note.</p>
                <Warning item={c.request} />
                <DoneButton onDone={() => act.done(c.request!.id)} busy={busy} label="Mark sent" />
                <button type="button" onClick={() => act.accepted(c.request!.id)} disabled={busy} className="w-full rounded-lg text-sm text-[var(--cream-dim)] disabled:opacity-50" style={{ minHeight: 44, background: 'transparent' }}>
                  Sent earlier, and they already accepted
                </button>
              </>
            ) : (
              <p className="text-sm text-[var(--cream-dim)]">Request sent.</p>
            )}
          </div>
        </div>
      )}

      {c.message && (
        <div className="flex gap-2 py-1" style={c.request ? { borderTop: '1px dashed rgba(184,115,51,0.25)', paddingTop: 10 } : undefined}>
          <Pip n="2" on={c.stage === 'message'} />
          <div className="min-w-0 flex-1 space-y-2">
            {c.stage === 'message' ? (
              <>
                <p className="text-sm text-[var(--cream)]">Message ready, {messageLength(c.message)}.</p>
                <Warning item={c.message} />
                {c.message.parts.map((p, i) => (
                  <Part key={i} part={p} platform={c.message!.platform} />
                ))}
                <DoneButton onDone={() => act.done(c.message!.id)} busy={busy} />
              </>
            ) : (
              <>
                <p className="text-sm text-[var(--cream-dim)]">Message, {messageLength(c.message)}.</p>
                <p className="text-xs text-[var(--cream-faint)]">{c.waitingReason ?? 'Unlocks when they accept.'}</p>
                {c.stage === 'accept' && (
                  <button
                    type="button"
                    onClick={() => (releaseId ? act.accepted(releaseId) : act.unblock(c.message!.id))}
                    disabled={busy}
                    className="w-full rounded-lg text-base font-semibold disabled:opacity-50"
                    style={{ minHeight: 48, background: 'var(--copper)', color: '#fff' }}
                  >
                    They accepted
                  </button>
                )}
                {c.stage === 'accept' && c.decide && releaseId && (
                  <>
                    <p className="text-sm text-[var(--cream)]">No answer in three weeks. Keep waiting, or give up?</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => act.keepWaiting(releaseId)} disabled={busy} className="flex-1 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ minHeight: 44, border: '1px solid var(--copper)', color: 'var(--copper-lt)', background: 'transparent' }}>
                        Keep waiting
                      </button>
                      <button type="button" onClick={() => act.giveUp(releaseId)} disabled={busy} className="flex-1 rounded-lg text-sm text-[var(--cream-dim)] disabled:opacity-50" style={{ minHeight: 44, border: '1px solid rgba(184,115,51,0.3)', background: 'transparent' }}>
                        Give up, close it
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  )
}

interface Actions {
  done: (id: string) => void
  wait: (id: string, reason: string) => void
  keep: (id: string) => void
  unblock: (id: string) => void
  accepted: (id: string) => void
  keepWaiting: (id: string) => void
  giveUp: (id: string) => void
}

/** Held and waiting lines, then the empty state: always visible, no tap. */
function ColumnFoot({ held, waiting }: { held: string[]; waiting: string[] }) {
  if (!held.length && !waiting.length) return null
  return (
    <div className="space-y-1 pt-2 text-xs text-[var(--cream-faint)]" style={{ borderTop: '1px solid rgba(184,115,51,0.18)' }}>
      {held.map((h) => (
        <p key={h}>
          <b className="font-semibold text-[var(--cream-dim)]">Held:</b> {h}
        </p>
      ))}
      {waiting.map((w) => (
        <p key={w}>
          <b className="font-semibold text-[var(--cream-dim)]">Waiting:</b> {w}
        </p>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-3 text-sm text-[var(--cream-faint)]">
      <b className="block font-semibold text-[var(--cream-dim)]">Nothing due</b>
      {text}
    </div>
  )
}

function MoreButton({ n, open, onClick }: { n: number; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg text-sm text-[var(--copper-lt)]"
      style={{ minHeight: 44, border: '1px dashed rgba(184,115,51,0.35)', background: 'transparent' }}
      aria-expanded={open}
    >
      {open ? 'Show fewer' : `${n} more`}
    </button>
  )
}

/** Shows the first `limit` items; the rest expand in place. */
function Limited<I>({ items, limit, render }: { items: I[]; limit: number; render: (i: I) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const extra = items.length - limit
  return (
    <>
      {(open ? items : items.slice(0, limit)).map(render)}
      {extra > 0 && <MoreButton n={extra} open={open} onClick={() => setOpen((v) => !v)} />}
    </>
  )
}

export default function TodayList(props: TodayView) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hide = (id: string) => setHidden((s) => new Set(s).add(id))
  const unhide = (id: string) =>
    setHidden((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })

  const run = (id: string, fn: () => Promise<void | ActionResult>, fail: string, optimistic = true) => {
    if (optimistic) hide(id)
    setError(null)
    startTransition(async () => {
      try {
        const r = await fn()
        if (r && !r.ok) throw new Error(r.message)
      } catch (e) {
        unhide(id)
        setError(e instanceof Error && e.message && !/fetch|server/i.test(e.message) ? e.message : fail)
      }
    })
  }

  const act: Actions = {
    done: (id) => run(id, () => markDone(id), `Could not mark ${id} done. Try again.`),
    wait: (id, reason) => run(id, () => blockItem(id, reason), `Could not move ${id}. Try again.`),
    keep: (id) => run(id, () => keepLive(id), `Could not keep ${id}. Try again.`),
    unblock: (id) => run(id, () => unblockItem(id), `Could not release ${id}. Try again.`),
    accepted: (id) => run(id, () => acceptRequest(id), `Could not mark ${id} accepted. Try again.`),
    keepWaiting: (id) => run(id, () => keepWaitingOnRequest(id), `Could not save ${id}. Try again.`),
    giveUp: (id) => run(id, () => giveUpOnRequest(id), `Could not close ${id}. Try again.`),
  }
  const undo = (id: string) => run(id, () => undoDone(id).then(() => unhide(id)), `Could not undo ${id}. Try again.`, false)

  const live = (items: Item[]) => items.filter((i) => !hidden.has(i.id))
  const liveCards = (cards: OutreachCardView[]) => cards.filter((c) => !hidden.has(c.key) && !(c.message && hidden.has(c.message.id)))

  const replies = live(props.replies)
  const social = live(props.social.due)
  const comments = live(props.comments.due)
  const outreach = liveCards(props.outreach.due)
  const awaiting = liveCards(props.outreach.awaiting)
  const stale = live(props.stale)
  const waitingOnOthers = live(props.waitingOnOthers)

  const columns = [
    { key: 'social' as const, label: props.social.label, short: 'Posts', count: social.length },
    { key: 'comments' as const, label: props.comments.label, short: 'Comments', count: comments.length },
    { key: 'outreach' as const, label: props.outreach.label, short: 'Outreach', count: outreach.length },
  ]
  // On a phone one column shows at a time; start on the first with work in it.
  const [tab, setTab] = useState<'social' | 'comments' | 'outreach'>(() => columns.find((c) => c.count > 0)?.key ?? 'social')
  const limit = props.shownPerColumn

  const head = (label: string, n: number) => (
    <div className="flex items-baseline justify-between pb-2 mb-1" style={{ borderBottom: '1px solid rgba(184,115,51,0.18)' }}>
      <h2 className="text-sm font-bold text-[var(--cream)]">{label}</h2>
      <span className="text-xs tabular-nums text-[var(--cream-faint)]">{Math.min(n, limit)} of {n}</span>
    </div>
  )

  const columnBody = {
    social: (
      <>
        {head(props.social.label, social.length)}
        {social.length === 0 ? (
          <Empty text={props.social.empty ?? 'Everything here is done for today.'} />
        ) : (
          <Limited items={social} limit={limit} render={(i) => <ItemCard key={i.id} item={i} onDone={() => act.done(i.id)} onWait={(r) => act.wait(i.id, r)} busy={pending} />} />
        )}
        <ColumnFoot held={props.social.held} waiting={props.social.waiting} />
      </>
    ),
    comments: (
      <>
        {head(props.comments.label, comments.length)}
        {comments.length === 0 ? (
          <Empty text={props.comments.empty ?? 'Everything here is done for today.'} />
        ) : (
          <Limited items={comments} limit={limit} render={(i) => <ItemCard key={i.id} item={i} onDone={() => act.done(i.id)} onWait={(r) => act.wait(i.id, r)} busy={pending} />} />
        )}
        <ColumnFoot held={props.comments.held} waiting={props.comments.waiting} />
      </>
    ),
    outreach: (
      <>
        {head(props.outreach.label, outreach.length)}
        {props.requestRule && (
          <p role="note" className="rounded-lg p-2.5 text-xs leading-relaxed" style={{ background: 'rgba(229,160,13,0.10)', border: '1px solid rgba(229,160,13,0.35)', color: 'var(--cream-dim)' }}>
            {props.requestRule}
          </p>
        )}
        {outreach.length === 0 ? (
          <Empty text={props.outreach.empty ?? 'Everything here is done for today.'} />
        ) : (
          <Limited items={outreach} limit={limit} render={(c) => <OutreachCard key={c.key} c={c} act={act} busy={pending} />} />
        )}
        {awaiting.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Sent, waiting to accept ({awaiting.length})</h3>
            <Limited items={awaiting} limit={limit} render={(c) => <OutreachCard key={c.key} c={c} act={act} busy={pending} />} />
          </div>
        )}
        <ColumnFoot held={props.outreach.held} waiting={props.outreach.waiting} />
      </>
    ),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--cream)]">Today</h1>
        <p className="text-sm text-[var(--cream-dim)]">{props.dateLabel}</p>
        <p className="mt-1 text-xs text-[var(--cream-faint)]">
          Done today: comments {props.caps.comments} · requests {props.caps.requests} · messages {props.caps.outbound}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-lg p-3 text-sm" style={{ background: '#7a2e1c', color: '#fff' }}>
          {error}
        </p>
      )}

      {/* Replies: never capped, never held, never in a column. */}
      {replies.length > 0 && (
        <section className="space-y-2">
          {replies.map((i) => (
            <div key={i.id} className="rounded-xl p-1" style={{ background: 'rgba(199,91,74,0.1)', border: '1px solid rgba(199,91,74,0.45)' }}>
              <p className="px-2 pt-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#d9776a' }}>Reply · today</p>
              <ItemCard item={i} onDone={() => act.done(i.id)} busy={pending} />
            </div>
          ))}
        </section>
      )}

      {/* Phone: one column at a time, with the counts on the switch. */}
      <nav className="md:hidden sticky top-0 z-10 grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: 'var(--ink)', border: '1px solid rgba(184,115,51,0.25)' }} aria-label="Columns">
        {columns.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setTab(c.key)}
            aria-pressed={tab === c.key}
            className="min-w-0 overflow-hidden whitespace-nowrap rounded-lg px-1 py-1.5 text-xs"
            style={tab === c.key ? { background: 'var(--copper)', color: '#1a1210', fontWeight: 700 } : { color: 'var(--cream-dim)' }}
          >
            <span className="block text-base leading-tight tabular-nums">{c.count}</span>
            <span className="block truncate">{c.short}</span>
          </button>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start">
        {columns.map((c) => (
          <section key={c.key} className={`${tab === c.key ? '' : 'hidden'} md:block min-w-0 space-y-2 rounded-xl p-3`} style={panel} aria-label={c.label}>
            {columnBody[c.key]}
          </section>
        ))}
      </div>

      {stale.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Stale, nothing changed in 7 days ({stale.length})</h2>
          <p className="text-sm text-[var(--cream-dim)]">These no longer reach the columns. Re-run the finding and keep it, or mark it done if it went out.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {stale.map((i) => (
              <div key={i.id} style={{ opacity: 0.75 }}>
                <ItemCard item={i} onDone={() => act.done(i.id)} onKeep={() => act.keep(i.id)} busy={pending} />
              </div>
            ))}
          </div>
        </section>
      )}

      {waitingOnOthers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Waiting on others ({waitingOnOthers.length})</h2>
          {waitingOnOthers.map((i) => (
            <div key={i.id} className="rounded-lg p-3 space-y-2" style={card}>
              <p className="text-sm text-[var(--cream-dim)]">
                <span className="font-mono">{i.id}</span> · {i.platform} · {i.target ?? shortAccount(i.account)}
              </p>
              <p className="text-sm text-[var(--cream)]">{i.blockedReason ?? 'Waiting on someone else.'}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => act.unblock(i.id)} disabled={pending} className="flex-1 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ minHeight: 48, border: '1px solid var(--copper)', color: 'var(--copper-lt)', background: 'transparent' }}>
                  It came through, back to today
                </button>
                <button type="button" onClick={() => act.done(i.id)} disabled={pending} className="rounded-lg px-4 text-sm text-[var(--cream-dim)] disabled:opacity-50" style={{ minHeight: 48, background: 'transparent' }}>
                  Done
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {props.doneToday.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--cream-faint)]">Done today</h2>
          <ul className="grid gap-2 md:grid-cols-3">
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
    </main>
  )
}
