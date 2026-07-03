import { describe, expect, it } from 'vitest'
import { computeStreaks } from '../../src/lib/streaks'
import { errorRates, revisionRate, MIN_SAMPLE_WORDS, type DayBundle } from '../../src/lib/analytics'

describe('computeStreaks', () => {
  const days = (...keys: string[]) => new Set(keys)

  it('counts consecutive days; today pending never breaks the chain', () => {
    const s = computeStreaks(days('2026-07-01', '2026-07-02'), '2026-07-03')
    expect(s.current).toBe(2)
  })
  it('a missed day breaks it without freeze', () => {
    const s = computeStreaks(days('2026-06-30', '2026-07-02'), '2026-07-02')
    expect(s.current).toBe(1)
  })
  it('streak freeze bridges a gap (spec §6.1)', () => {
    const s = computeStreaks(days('2026-06-30', '2026-07-02'), '2026-07-02', 1)
    expect(s.current).toBe(2)
    expect(s.best).toBe(2)
  })
  it('best streak found in history', () => {
    const s = computeStreaks(days('2026-06-01', '2026-06-02', '2026-06-03', '2026-07-02'), '2026-07-02')
    expect(s.best).toBe(3)
    expect(s.totalDays).toBe(4)
  })
})

const bundle = (dateKey: string, words: number, spelling: number, outcomes: string[] = []): DayBundle =>
  ({
    day: { dateKey, dailyTotals: { words } },
    sections: [],
    reviews: [
      {
        reviewType: 'initial',
        counts: { words, sentences: 5, spelling, grammar: 1 },
        corrections: outcomes.map((_, i) => ({ id: 'c' + i })),
        correctionOutcomes: Object.fromEntries(outcomes.map((o, i) => ['c' + i, o])),
      },
    ],
  }) as unknown as DayBundle

describe('errorRates sample-size suppression (spec §6.2)', () => {
  it('suppresses rates below the minimum word sample', () => {
    const [small, big] = errorRates([bundle('2026-07-01', MIN_SAMPLE_WORDS - 10, 3), bundle('2026-07-02', 200, 4)])
    expect(small.spellingPer100).toBeNull()
    expect(big.spellingPer100).toBe(2)
  })
})

describe('revisionRate', () => {
  it('counts used + selfFixed over offered', () => {
    const r = revisionRate([bundle('2026-07-01', 100, 0, ['used', 'skipped', 'selfFixed', 'skipped'])])
    expect(r.offered).toBe(4)
    expect(r.acted).toBe(2)
    expect(r.rate).toBe(0.5)
  })
})
