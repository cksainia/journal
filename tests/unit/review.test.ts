import { describe, expect, it } from 'vitest'
import { ReviewSchema } from '../../src/services/claude/types'
import { mockClaudeService } from '../../src/services/claude/mockClaudeService'

const validReview = {
  schemaVersion: '1.0',
  encouragement: 'Wonderful work today!',
  strengths: ['Great describing words.'],
  nextStep: { label: 'Add one detail', reason: 'It helps the reader.' },
  corrections: [],
  counts: { words: 30, sentences: 4, spelling: 0, grammar: 0 },
  rubric: { ideas: 3, organization: 2, details: 2, voice: 3, conventions: 3 },
  sparkle_words_used: [],
  voiceNotes: [],
  parent_metrics: null,
  safetyFlags: [],
}
const correction = (id: string) => ({
  id,
  type: 'spelling',
  category: 'spelling',
  original: 'freind',
  suggestion: 'friend',
  explanationKid: 'Tricky word!',
  standardsTags: ['L.WF.3.2'],
  confidence: 0.9,
})

describe('ReviewSchema guardrails (spec §4.5)', () => {
  it('accepts a valid review', () => {
    expect(ReviewSchema.parse(validReview).encouragement).toBeTruthy()
  })
  it('REJECTS more than 5 corrections (hard cap)', () => {
    const over = { ...validReview, corrections: [1, 2, 3, 4, 5, 6].map((n) => correction('c' + n)) }
    expect(() => ReviewSchema.parse(over)).toThrow()
  })
  it('REJECTS harsh labels in child-facing text', () => {
    expect(() =>
      ReviewSchema.parse({ ...validReview, encouragement: 'This was a bad story.' }),
    ).toThrow()
    expect(() =>
      ReviewSchema.parse({ ...validReview, strengths: ['You failed less this time.'] }),
    ).toThrow()
  })
  it('REJECTS malformed rubric values', () => {
    expect(() =>
      ReviewSchema.parse({ ...validReview, rubric: { ...validReview.rubric, ideas: 7 } }),
    ).toThrow()
  })
})

describe('mock review derives real corrections from the text', () => {
  it('catches standalone lowercase i and misspellings, detects sparkle words', async () => {
    const r = await mockClaudeService.reviewEntry({
      plainText: 'Today i saw my freind at the magnificent park. We played until dark.',
      gradeLevel: 3,
      mode: 'free',
      sparkleWordsOffered: ['magnificent', 'trudged', 'curious'],
    })
    const types = r.corrections.map((c) => c.type)
    expect(types).toContain('capitalization')
    expect(types).toContain('spelling')
    expect(r.corrections.find((c) => c.type === 'spelling')?.suggestion).toBe('friend')
    expect(r.sparkle_words_used).toEqual(['magnificent'])
    expect(r.corrections.length).toBeLessThanOrEqual(5)
  })
  it('returns null parent metrics for short pieces', async () => {
    const r = await mockClaudeService.reviewEntry({
      plainText: 'One tiny sentence.',
      gradeLevel: 3,
      mode: 'nudge',
    })
    expect(r.parent_metrics).toBeNull()
  })
})
