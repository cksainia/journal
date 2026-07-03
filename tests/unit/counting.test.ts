import { describe, expect, it } from 'vitest'
import { countWords, countSentences } from '../../src/lib/counting'
import { dateKeyFor, compactDateKey } from '../../src/lib/dateKey'

describe('countWords', () => {
  it('counts whitespace tokens', () => {
    expect(countWords('I love my dog')).toBe(4)
    expect(countWords('  spaced   out\nwords ')).toBe(3)
  })
  it('returns 0 for empty/whitespace', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('   ')).toBe(0)
  })
})

describe('countSentences', () => {
  it('splits on terminal punctuation', () => {
    expect(countSentences('I ran. I jumped! Did I fly?')).toBe(3)
  })
  it('counts a trailing fragment without punctuation (kids skip the last period)', () => {
    expect(countSentences('I ran. then I jumped')).toBe(2)
    expect(countSentences('just one thought')).toBe(1)
  })
  it('ignores punctuation-only noise', () => {
    expect(countSentences('!!!')).toBe(0)
    expect(countSentences('Wow!!! So cool...')).toBe(2)
  })
  it('returns 0 for empty', () => {
    expect(countSentences('')).toBe(0)
  })
})

describe('dateKey', () => {
  it('uses device-local date, zero-padded', () => {
    expect(dateKeyFor(new Date(2026, 6, 2, 23, 59))).toBe('2026-07-02')
    expect(dateKeyFor(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05')
  })
  it('compacts for doc ids', () => {
    expect(compactDateKey('2026-07-02')).toBe('20260702')
  })
})
