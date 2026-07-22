import { describe, expect, it } from 'vitest'
import { ReviewSchema, sanitizeReview } from '../../src/services/claude/types'
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
  it('caps corrections at 5 by truncation — never by failing the review', () => {
    const over = { ...validReview, corrections: [1, 2, 3, 4, 5, 6].map((n) => correction('c' + n)) }
    expect(ReviewSchema.parse(over).corrections).toHaveLength(5)
  })
  it('SANITIZES harsh labels in child-facing text (review survives, word never renders)', () => {
    const parsed = ReviewSchema.parse({
      ...validReview,
      encouragement: 'This was a bad story.',
      strengths: ['You failed less this time.'],
      corrections: [{ ...correction('c1'), explanationKid: 'This spelling is wrong.' }],
    })
    const clean = sanitizeReview(parsed)
    expect(clean.encouragement).not.toMatch(/\bbad\b/i)
    expect(clean.strengths[0]).not.toMatch(/\bfailed\b/i)
    expect(clean.corrections[0].explanationKid).not.toMatch(/\bwrong\b/i)
    expect(clean.corrections[0].explanationKid).toContain('friend') // still points at the fix
    expect(clean.counts).toEqual(parsed.counts) // everything else untouched
  })
  it('CLAMPS drifted rubric/metric numbers instead of failing the review', () => {
    const r = ReviewSchema.parse({
      ...validReview,
      rubric: { ...validReview.rubric, ideas: 7, voice: 2.6 },
      corrections: [{ ...correction('c1'), confidence: 95 }],
      parent_metrics: {
        njsla_written_expression_estimate: 4.4,
        njsla_conventions_estimate: 0,
        rubric_justification: 'Solid work.',
      },
    })
    expect(r.rubric.ideas).toBe(3)
    expect(r.rubric.voice).toBe(3)
    expect(r.corrections[0].confidence).toBe(1)
    expect(r.parent_metrics?.njsla_written_expression_estimate).toBe(4)
    expect(r.parent_metrics?.njsla_conventions_estimate).toBe(1)
  })
  it('caps strengths at 3 by truncation — never by failing the review', () => {
    const over = { ...validReview, strengths: ['One.', 'Two.', 'Three.', 'Four.', 'Five.'] }
    expect(ReviewSchema.parse(over).strengths).toEqual(['One.', 'Two.', 'Three.'])
  })
  it('truncates overlong kid-facing text instead of failing', () => {
    const r = ReviewSchema.parse({ ...validReview, encouragement: 'Wow! '.repeat(120) })
    expect(r.encouragement.length).toBeLessThanOrEqual(400)
    expect(r.encouragement.endsWith('…')).toBe(true)
  })
  it('drops only the malformed correction and keeps the rest', () => {
    const r = ReviewSchema.parse({
      ...validReview,
      corrections: [
        correction('c1'),
        { type: 'grammar', original: 'we was', explanationKid: 'oops' }, // no suggestion → dropped
        { ...correction('c3'), id: undefined }, // missing id → positional id, kept
      ],
    })
    expect(r.corrections).toHaveLength(2)
    expect(r.corrections[0].id).toBe('c1')
    expect(r.corrections[1].suggestion).toBe('friend')
    expect(r.corrections[1].id).toBe('c3')
  })
  it('survives a bare-minimum payload — encouragement is the only hard requirement', () => {
    const r = ReviewSchema.parse({ encouragement: 'Lovely story!' })
    expect(r.strengths).toEqual([])
    expect(r.nextStep).toBeNull()
    expect(r.corrections).toEqual([])
    expect(r.counts).toEqual({ words: 0, sentences: 0, spelling: 0, grammar: 0 })
    expect(r.rubric).toEqual({ ideas: 2, organization: 2, details: 2, voice: 2, conventions: 2 })
    expect(r.parent_metrics).toBeNull()
    expect(r.safetyFlags).toEqual([])
  })
  it('coerces oddly-shaped safety flags instead of dropping them', () => {
    expect(ReviewSchema.parse({ ...validReview, safetyFlags: 'gentle note' }).safetyFlags).toEqual([
      'gentle note',
    ])
    expect(
      ReviewSchema.parse({ ...validReview, safetyFlags: [{ note: 'check in' }] }).safetyFlags,
    ).toEqual(['{"note":"check in"}'])
  })
  it('still rejects payloads with no kid-facing encouragement', () => {
    expect(() => ReviewSchema.parse({ ...validReview, encouragement: undefined })).toThrow()
    expect(() => ReviewSchema.parse({ notAReview: true })).toThrow()
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
