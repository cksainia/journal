/**
 * Timezone-resilient day keying (spec §7). The journal day is ALWAYS derived
 * from the device's local clock — never UTC — and the timezone is stored
 * alongside it. Writing at 11 PM in Dubai and the next NJ morning must produce
 * two distinct dateKeys and an unbroken streak. Matches the tracker's ymd().
 */
export function dateKeyFor(d: Date = new Date()): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  )
}

/** "2026-07-02" → "20260702" (used in journalDays doc ids). */
export function compactDateKey(dateKey: string): string {
  return dateKey.replaceAll('-', '')
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
