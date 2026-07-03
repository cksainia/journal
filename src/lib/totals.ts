/** Pure day-totals math — no Firebase imports so tests and the sync adapter
 *  can use it without touching app initialization. */

export interface DailyTotals {
  words: number
  sentences: number
  sections: number
  reviewedSections: number
  drawings: number
}

export interface SectionLike {
  status: string
  type: string
  wordCount?: number
  sentenceCount?: number
  reviewCount?: number
}

/** Recompute day totals from live (non-archived) sections. Deterministic,
 *  never increments — the heart of the idempotent tracker sync (spec §8). */
export function computeTotals(sections: SectionLike[]): DailyTotals {
  const live = sections.filter((s) => s.status !== 'archived')
  return {
    words: live.reduce((n, s) => n + (s.wordCount || 0), 0),
    sentences: live.reduce((n, s) => n + (s.sentenceCount || 0), 0),
    sections: live.length,
    reviewedSections: live.filter((s) => (s.reviewCount || 0) > 0).length,
    drawings: live.filter((s) => s.type === 'drawing' || s.type === 'comic').length,
  }
}

export function totalsEqual(a: DailyTotals, b: DailyTotals): boolean {
  return (
    a.words === b.words &&
    a.sentences === b.sentences &&
    a.sections === b.sections &&
    a.reviewedSections === b.reviewedSections &&
    a.drawings === b.drawings
  )
}
