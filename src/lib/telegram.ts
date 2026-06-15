// Telegram bot helper — sends escalation messages to Michael.
// Uses the Bot API directly via fetch (no extra dependency).
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. If either is missing, this no-ops and
// returns { ok: false, skipped: true } so support flows never hard-fail on a missing bot.

export interface TelegramResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

/**
 * Send a Markdown message to a Telegram chat.
 * Returns a result object rather than throwing, so callers can degrade gracefully.
 * Pass `chatId` to target a non-default channel (e.g. signup notifications);
 * defaults to TELEGRAM_CHAT_ID, which the customer-support flow relies on.
 */
export async function sendTelegramMessage(
  text: string,
  chatId: string | undefined = process.env.TELEGRAM_CHAT_ID,
): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN or chat id not set — skipping escalation send')
    return { ok: false, skipped: true }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[telegram] send failed', res.status, detail)
      return { ok: false, error: `Telegram ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    console.error('[telegram] send threw', msg)
    return { ok: false, error: msg }
  }
}

/** Escape Telegram Markdown special characters in user-supplied values. */
export function escapeMarkdown(value: string): string {
  return value.replace(/([_*`\[\]])/g, '\\$1')
}
