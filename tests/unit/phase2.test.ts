import { describe, expect, it } from 'vitest'
import { NUDGES, BONUS_QUESTIONS, nudgeForDate, bonusQuestionForDate } from '../../src/data/nudges'
import { ActiveWpmTracker } from '../../src/lib/wpm'
import { monthGrid } from '../../src/lib/calendar'

describe('nudge bank', () => {
  it('ships 150+ prompts (spec §4.2D)', () => {
    expect(NUDGES.length).toBeGreaterThanOrEqual(150)
    expect(new Set(NUDGES).size).toBe(NUDGES.length) // no duplicates
  })
  it('rotates deterministically — same day, same nudge', () => {
    expect(nudgeForDate('2026-07-02')).toBe(nudgeForDate('2026-07-02'))
    expect(bonusQuestionForDate('2026-07-02')).toBe(bonusQuestionForDate('2026-07-02'))
  })
  it('varies across days', () => {
    const week = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']
    expect(new Set(week.map(nudgeForDate)).size).toBeGreaterThan(1)
    expect(BONUS_QUESTIONS.length).toBeGreaterThanOrEqual(5)
  })
})

describe('ActiveWpmTracker (spec §6.2)', () => {
  it('counts only rolling-3s-window typing time, excluding thinking pauses', () => {
    const t = new ActiveWpmTracker()
    let now = 0
    // 60 keystrokes 1s apart = 59s active typing
    for (let i = 0; i < 60; i++) { t.keystroke(now); now += 1000 }
    now += 60_000 // long thinking pause — must NOT count
    t.keystroke(now)
    // ~59s active for 12 words → ≈12.2 WPM (not ~6 WPM, which a naive elapsed-time calc would give)
    expect(t.wpm(12)).toBeCloseTo(12 / (59 / 60), 0)
  })
  it('returns null with too little signal', () => {
    const t = new ActiveWpmTracker()
    t.keystroke(0)
    t.keystroke(500)
    expect(t.wpm(2)).toBeNull()
  })
})

describe('monthGrid', () => {
  it('lays out July 2026 correctly (starts Wednesday, 31 days)', () => {
    const weeks = monthGrid(2026, 6)
    expect(weeks[0]).toEqual([null, null, null, '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04'])
    const all = weeks.flat().filter(Boolean)
    expect(all.length).toBe(31)
    expect(all[30]).toBe('2026-07-31')
    weeks.forEach((w) => expect(w.length).toBe(7))
  })
})
