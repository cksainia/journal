/**
 * Timezone-resilient day keying (spec §7). The journal day is ALWAYS derived
 * from the device's local clock — never UTC — and the timezone is stored
 * alongside it. Writing at 11 PM in Dubai and the next NJ morning must produce
 * two distinct dateKeys and an unbroken streak.
 *
 * The journal day rolls over at 4 AM, not midnight: a late-night entry about
 * "today" written at 12:30 AM still lands on the day she's writing about
 * (and the Today screen no longer flips to a fresh page mid-sentence).
 */
export const DAY_ROLLOVER_HOUR = 4

/** Pure calendar formatting — NO rollover shift. Use for calendar cells and
 *  date arithmetic on specific days; use dateKeyFor for "the journal day". */
export function formatDateKey(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/** The journal dateKey for a moment in time (defaults to now), applying the
 *  4 AM rollover: 00:00–03:59 belongs to the previous calendar day. */
export function dateKeyFor(d: Date = new Date()): string {
  return formatDateKey(new Date(d.getTime() - DAY_ROLLOVER_HOUR * 3_600_000))
}

/** "2026-07-02" → "20260702" (used in journalDays doc ids). */
export function compactDateKey(dateKey: string): string {
  return dateKey.replaceAll('-', '')
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
