import { dateKeyFor } from './dateKey'

/**
 * Month-grid helper for My Journal: weeks (Sun–Sat) of dateKeys, padded with
 * nulls outside the month. Pure and unit-testable.
 */
export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(year, month0, 1)
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const weeks: (string | null)[][] = []
  let week: (string | null)[] = Array<string | null>(first.getDay()).fill(null)

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(dateKeyFor(new Date(year, month0, d)))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length) weeks.push([...week, ...Array<string | null>(7 - week.length).fill(null)])
  return weeks
}

export function monthLabel(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}
