import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { dayIdFor, type JournalDay, type JournalSection, type Panel } from './journal'
import type { StoredReview } from './reviews'
import { dateKeyFor } from './dateKey'

/**
 * Dashboard data loading + pure metric math (spec §6.2). Loading fans out
 * per-day (no collection-group queries → no extra indexes or rules surface).
 * All child-facing surfaces must NOT import the error/WPM helpers here —
 * error detail is parent-only by design.
 */

export interface DayBundle {
  day: JournalDay & { reviewsUsed?: number }
  sections: (JournalSection & { panels?: Panel[] })[]
  reviews: StoredReview[]
}

export function daysAgoKey(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateKeyFor(d)
}

export async function loadRange(rangeDays: number): Promise<DayBundle[]> {
  const start = daysAgoKey(rangeDays - 1)
  const daySnap = await getDocs(
    query(collection(db, 'journalDays'), where('dateKey', '>=', start), orderBy('dateKey', 'asc')),
  )
  const days = daySnap.docs.map((d) => d.data() as DayBundle['day'])
  return Promise.all(
    days.map(async (day) => {
      const secSnap = await getDocs(collection(db, 'journalDays', dayIdFor(day.dateKey), 'sections'))
      const sections = secSnap.docs.map((s) => ({ ...(s.data() as DayBundle['sections'][number]), id: s.id }))
      const reviewed = sections.filter((s) => (s.reviewCount || 0) > 0)
      const reviews = (
        await Promise.all(
          reviewed.map(async (s) => {
            const rSnap = await getDocs(
              collection(db, 'journalDays', dayIdFor(day.dateKey), 'sections', s.id, 'reviews'),
            )
            return rSnap.docs.map((r) => ({ ...(r.data() as StoredReview), id: r.id, dateKey: day.dateKey }))
          }),
        )
      ).flat()
      return { day, sections, reviews }
    }),
  )
}

// ── Pure metrics ────────────────────────────────────────────────────────────

export const MIN_SAMPLE_WORDS = 50 // below this, rates mislead — suppress (spec §6.2)

export interface ErrorRatePoint {
  dateKey: string
  words: number
  spellingPer100: number | null // null = below sample threshold
  grammarPer100: number | null
}

/** Errors per 100 words from initial reviews, per day, with sample suppression. */
export function errorRates(bundles: DayBundle[]): ErrorRatePoint[] {
  return bundles
    .filter((b) => b.reviews.some((r) => r.reviewType === 'initial'))
    .map((b) => {
      const initial = b.reviews.filter((r) => r.reviewType === 'initial')
      const words = initial.reduce((n, r) => n + r.counts.words, 0)
      const spelling = initial.reduce((n, r) => n + r.counts.spelling, 0)
      const grammar = initial.reduce((n, r) => n + r.counts.grammar, 0)
      const ok = words >= MIN_SAMPLE_WORDS
      return {
        dateKey: b.day.dateKey,
        words,
        spellingPer100: ok ? +((spelling / words) * 100).toFixed(1) : null,
        grammarPer100: ok ? +((grammar / words) * 100).toFixed(1) : null,
      }
    })
}

/** Revision rate: corrections acted on (used / self-fixed) ÷ corrections offered. */
export function revisionRate(bundles: DayBundle[]): { acted: number; offered: number; rate: number | null } {
  let acted = 0
  let offered = 0
  for (const b of bundles)
    for (const r of b.reviews) {
      offered += r.corrections.length
      acted += Object.values(r.correctionOutcomes ?? {}).filter((o) => o === 'used' || o === 'selfFixed').length
    }
  return { acted, offered, rate: offered ? +(acted / offered).toFixed(2) : null }
}

export interface RubricPoint {
  dateKey: string
  ideas: number
  organization: number
  details: number
  voice: number
  conventions: number
  njslaExpression: number | null
  njslaConventions: number | null
}

export function rubricTrend(bundles: DayBundle[]): RubricPoint[] {
  return bundles
    .filter((b) => b.reviews.length > 0)
    .map((b) => {
      const rs = b.reviews
      const avg = (f: (r: StoredReview) => number) => +(rs.reduce((n, r) => n + f(r), 0) / rs.length).toFixed(2)
      const withMetrics = rs.filter((r) => r.parent_metrics)
      return {
        dateKey: b.day.dateKey,
        ideas: avg((r) => r.rubric.ideas),
        organization: avg((r) => r.rubric.organization),
        details: avg((r) => r.rubric.details),
        voice: avg((r) => r.rubric.voice),
        conventions: avg((r) => r.rubric.conventions),
        njslaExpression: withMetrics.length
          ? +(withMetrics.reduce((n, r) => n + r.parent_metrics!.njsla_written_expression_estimate, 0) / withMetrics.length).toFixed(2)
          : null,
        njslaConventions: withMetrics.length
          ? +(withMetrics.reduce((n, r) => n + r.parent_metrics!.njsla_conventions_estimate, 0) / withMetrics.length).toFixed(2)
          : null,
      }
    })
}

/** Average Active WPM per day (typing fluency, parent-only). */
export function wpmTrend(bundles: DayBundle[]): { dateKey: string; wpm: number }[] {
  return bundles
    .map((b) => {
      const vals = b.sections.map((s) => s.activeWPM).filter((v): v is number => v != null && v > 0)
      return vals.length ? { dateKey: b.day.dateKey, wpm: +(vals.reduce((a, c) => a + c, 0) / vals.length).toFixed(1) } : null
    })
    .filter((x): x is { dateKey: string; wpm: number } => x !== null)
}

/** Mode mix + prompt effectiveness: entries and avg words by section type/genre. */
export function modeStats(bundles: DayBundle[]) {
  const acc: Record<string, { count: number; words: number }> = {}
  for (const b of bundles)
    for (const s of b.sections) {
      if (s.status === 'archived') continue
      const key = s.type === 'guided' && s.genre ? `guided·${s.genre}` : s.type
      acc[key] = acc[key] || { count: 0, words: 0 }
      acc[key].count++
      acc[key].words += s.wordCount || 0
    }
  return Object.entries(acc).map(([mode, v]) => ({
    mode,
    entries: v.count,
    avgWords: +(v.words / v.count).toFixed(0),
  }))
}

/** Sparkle Word adoption: offered vs used across guided sections. */
export function sparkleAdoption(bundles: DayBundle[]): { offered: number; used: number } {
  let offered = 0
  let used = 0
  for (const b of bundles)
    for (const s of b.sections) {
      offered += s.sparkleWords?.offered?.length || 0
      used += s.sparkleWords?.used?.length || 0
    }
  return { offered, used }
}

/** Mood/context → volume. Labeled "patterns to explore", never conclusions. */
export function moodPatterns(bundles: DayBundle[]): { label: string; days: number; avgWords: number }[] {
  const acc: Record<string, { days: number; words: number }> = {}
  for (const b of bundles) {
    const words = b.day.dailyTotals.words
    for (const m of b.day.checkin?.moods ?? []) {
      acc[m] = acc[m] || { days: 0, words: 0 }
      acc[m].days++
      acc[m].words += words
    }
  }
  return Object.entries(acc)
    .filter(([, v]) => v.days >= 2) // one day is an anecdote, not a pattern
    .map(([label, v]) => ({ label, days: v.days, avgWords: +(v.words / v.days).toFixed(0) }))
    .sort((a, b) => b.avgWords - a.avgWords)
}

/** Standards coverage across guided sections + review tags. */
export function standardsCoverage(bundles: DayBundle[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const b of bundles) {
    for (const s of b.sections) for (const t of s.standardsTags ?? []) acc[t] = (acc[t] || 0) + 1
    for (const r of b.reviews)
      for (const c of r.corrections) for (const t of c.standardsTags) acc[t] = (acc[t] || 0) + 1
  }
  return acc
}
