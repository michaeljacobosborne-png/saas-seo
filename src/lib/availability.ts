// Support availability / Shabbat-window awareness.
//
// Michael is offline from Friday sundown to Saturday night. Sundown shifts weekly, so we
// use a conservative fixed window: Friday 16:30 -> Saturday 22:00, local time.
//
// Timezone rule (per spec): Michael is in Israel (UTC+3) from July 13 - Aug 24 each year,
// and on the US East Coast (UTC-4 / EDT) the rest of the year. This is an intentional
// approximation — it ignores EST (winter) and Israel DST edge cases.
//
// This text is shown on escalation confirmations only. The AI agent itself is always
// available; only the human (Michael) is bound by this window.

export type AvailabilityZone = 'Israel (UTC+3)' | 'US East (UTC-4)'

export interface Availability {
  isOffline: boolean
  /** Customer-facing line to append to escalation confirmations. */
  statusMessage: string
  zone: AvailabilityZone
}

const OFFLINE_MESSAGE =
  "We're currently offline for Shabbat. We'll be back online Saturday night and will respond within 30 minutes of opening."
const ONLINE_MESSAGE = 'Michael typically responds within 5 hours.'

/** UTC offset (hours) for Michael's location on the given date. */
function offsetHoursFor(nowUtc: Date): { offset: number; zone: AvailabilityZone } {
  const month = nowUtc.getUTCMonth() // 0 = Jan, 6 = Jul, 7 = Aug
  const day = nowUtc.getUTCDate()
  const inIsraelWindow = (month === 6 && day >= 13) || (month === 7 && day <= 24)
  return inIsraelWindow
    ? { offset: 3, zone: 'Israel (UTC+3)' }
    : { offset: -4, zone: 'US East (UTC-4)' }
}

/**
 * Determine whether support is inside the Shabbat offline window.
 * `now` defaults to the current time; pass an explicit Date for testing.
 */
export function getAvailability(now: Date = new Date()): Availability {
  const { offset, zone } = offsetHoursFor(now)

  // Shift to local time, then read fields via UTC accessors on the shifted instant.
  const local = new Date(now.getTime() + offset * 60 * 60 * 1000)
  const dow = local.getUTCDay() // 0 = Sun ... 5 = Fri, 6 = Sat
  const hour = local.getUTCHours()
  const minute = local.getUTCMinutes()

  const fridayEvening = dow === 5 && (hour > 16 || (hour === 16 && minute >= 30))
  const saturdayDaytime = dow === 6 && hour < 22
  const isOffline = fridayEvening || saturdayDaytime

  return {
    isOffline,
    statusMessage: isOffline ? OFFLINE_MESSAGE : ONLINE_MESSAGE,
    zone,
  }
}
