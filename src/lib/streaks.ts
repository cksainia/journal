import { dateKeyFor } from './dateKey'

/**
 * Streak math (spec §6.1). Pure and testable. A "writing day" is a day doc
 * with streakCredit. `freezeDays` = parent-configurable grace: up to that many
 * consecutive missed days don't break the chain (they just don't add to it).
 * Today not yet written never breaks the streak.
 */
export interface StreakResult {
  current: number
  best: number
  totalDays: number
}

function prevKey(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return dateKeyFor(d)
}

export function computeStreaks(
  creditedDays: Set<string>,
  today: string,
  freezeDays = 0,
): StreakResult {
  // current: walk back from today (today itself optional)
  let current = 0
  let misses = 0
  let cursor = today
  if (!creditedDays.has(cursor)) cursor = prevKey(cursor) // today pending — start yesterday
  while (true) {
    if (creditedDays.has(cursor)) {
      current++
      misses = 0
    } else {
      misses++
      if (misses > freezeDays) break
    }
    cursor = prevKey(cursor)
    if (current + misses > 400) break // safety bound
  }

  // best: scan the full history with the same freeze rule
  const sorted = [...creditedDays].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of sorted) {
    if (prev === null) run = 1
    else {
      let gap = 0
      let k = prevKey(day)
      while (k !== prev && gap <= freezeDays + 1) {
        gap++
        k = prevKey(k)
      }
      run = gap <= freezeDays ? run + 1 : 1
    }
    best = Math.max(best, run)
    prev = day
  }

  return { current, best: Math.max(best, current), totalDays: creditedDays.size }
}
