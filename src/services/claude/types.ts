import { z } from 'zod'

/**
 * The Claude service seam (spec §4.5, §9). ALL Claude output — mock or live —
 * is untrusted structured data: it must parse against these schemas before the
 * app touches it. Caps (≤5 corrections, ≤3 strengths, length limits, no harsh
 * labels) live in the schemas — and they're enforced by TRUNCATION and
 * CLAMPING, never by failing the review. Both napping-checker incidents
 * (2026-07-05 truncation, 2026-07-21 drift) were the same failure class: model
 * output drifted, a strict schema rejected the WHOLE review, and Aria lost the
 * feature. A drifted-but-recognizable review must always survive; the only
 * hard requirement is kid-facing encouragement text.
 */

// Harsh labels never reach the child — but a stray "wrong" from a live model
// must SOFTEN the one string, not sink the whole review (see sanitizeReview).
export const HARSH_LABELS = /\b(bad|wrong|weak|failed|failure|terrible|poor)\b/i
// Length caps by truncation: a wordy model bloats one string, never kills a review.
const kidFacing = (max = 400) =>
  z
    .string()
    .min(1)
    .transform((s) => (s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s))
const clampInt = (lo: number, hi: number) => (n: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)))

export const CorrectionSchema = z.object({
  id: z.string(),
  type: z.enum(['spelling', 'grammar', 'punctuation', 'capitalization', 'word_choice', 'structure']),
  category: z.string().catch('other'),
  original: z.string(),
  suggestion: z.string(),
  explanationKid: kidFacing(200),
  standardsTags: z.array(z.string()).catch([]),
  confidence: z.number().catch(0.6).transform((n) => Math.min(1, Math.max(0, n))),
})
export type Correction = z.infer<typeof CorrectionSchema>

const coachLevel = z.number().catch(2).transform(clampInt(1, 3))
const njslaLevel = z.number().catch(2).transform(clampInt(1, 4))
const count = z.number().catch(0).transform((n) => Math.max(0, Math.round(n)))

export const ReviewSchema = z.object({
  schemaVersion: z.string().catch('1.0'),
  encouragement: kidFacing(), // the ONE required field — without it there is no review to show
  // ≤3 strengths, salvaged per item: one empty/odd entry drops that entry only.
  strengths: z
    .array(z.unknown())
    .catch([])
    .transform((a) =>
      a
        .flatMap((s) => {
          const r = kidFacing().safeParse(s)
          return r.success ? [r.data] : []
        })
        .slice(0, 3),
    ),
  nextStep: z
    .object({ label: kidFacing(100), reason: kidFacing(200), example: kidFacing(200).optional() })
    .nullable()
    .catch(null),
  // Hard cap 5 (§4.5) by truncation; a malformed correction drops ITSELF, not
  // the review. Missing ids get positional ones so outcome tracking still works.
  corrections: z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .flatMap((raw, i) => {
          const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
          const withId = base
            ? { ...base, id: typeof base.id === 'string' && base.id ? base.id : `c${i + 1}` }
            : raw
          const r = CorrectionSchema.safeParse(withId)
          return r.success ? [r.data] : []
        })
        .slice(0, 5),
    ),
  counts: z
    .object({ words: count, sentences: count, spelling: count, grammar: count })
    .catch({ words: 0, sentences: 0, spelling: 0, grammar: 0 }),
  rubric: z
    .object({
      ideas: coachLevel,
      organization: coachLevel,
      details: coachLevel,
      voice: coachLevel,
      conventions: coachLevel,
    })
    .catch({ ideas: 2, organization: 2, details: 2, voice: 2, conventions: 2 }),
  sparkle_words_used: z.array(z.string()).catch([]),
  voiceNotes: z.array(z.string()).catch([]),
  parent_metrics: z
    .object({
      njsla_written_expression_estimate: njslaLevel,
      njsla_conventions_estimate: njslaLevel,
      rubric_justification: z.string().catch(''),
    })
    .nullable()
    .catch(null), // null for short pieces (nudges/captions)
  // Safety channel: coerce shape rather than drop — a flag the model wrapped
  // oddly must still reach the parent, so non-strings are stringified.
  safetyFlags: z.unknown().optional().transform((v): string[] => {
    if (typeof v === 'string') return v ? [v] : []
    if (!Array.isArray(v)) return []
    return v
      .filter((x) => x != null && x !== '')
      .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
  }),
})
export type Review = z.infer<typeof ReviewSchema>

export const GENRES = ['narrative', 'opinion', 'informative'] as const
export type Genre = (typeof GENRES)[number]

export const GuidedPromptSchema = z.object({
  prompt: kidFacing(500),
  genre: z.enum(GENRES),
  kidFriendlyName: z.string(), // "Story Builder", "Opinion Helper", "Fact Teacher"
  standardsTags: z.array(z.string()).min(1),
  sparkleWords: z.array(z.string()).length(3), // Lexile 700–800 vocabulary
  planningChips: z.array(z.string()).min(3).max(6),
})
export type GuidedPrompt = z.infer<typeof GuidedPromptSchema>

const soften = (s: string, fallback: string) => (HARSH_LABELS.test(s) ? fallback : s)

/**
 * Kid-safety guarantee, applied AFTER structural validation on every live
 * response: any child-facing string containing a harsh label is replaced with
 * a warm generic — the review survives, the harsh word never renders.
 */
export function sanitizeReview(r: Review): Review {
  return {
    ...r,
    encouragement: soften(r.encouragement, 'What a wonderful piece of writing — I loved reading it! ✨'),
    strengths: r.strengths.map((s) => soften(s, 'You put real thought into this entry!')),
    nextStep: r.nextStep
      ? {
          label: soften(r.nextStep.label, 'Add one more detail'),
          reason: soften(r.nextStep.reason, 'It helps your reader picture the moment.'),
          ...(r.nextStep.example
            ? { example: soften(r.nextStep.example, 'What happened next?') }
            : {}),
        }
      : null,
    corrections: r.corrections.map((c) => ({
      ...c,
      explanationKid: soften(c.explanationKid, `Here's the tricky part — try: ${c.suggestion}`),
    })),
  }
}

export function sanitizeInsights(w: WeeklyInsights): WeeklyInsights {
  return {
    ...w,
    kidVoiceCard: soften(w.kidVoiceCard, 'Your writing voice is bright and full of ideas — keep going! 💛'),
  }
}

export const WeeklyInsightsSchema = z.object({
  schemaVersion: z.string(),
  dateRange: z.object({ start: z.string(), end: z.string() }),
  sampleCounts: z.object({ entries: z.number().int(), reviewedEntries: z.number().int() }),
  strengths: z.array(z.string()).min(1),
  growthAreas: z
    .array(z.object({ pattern: z.string(), recommendation: z.string() }))
    .min(1),
  voice: z.object({
    adjectives: z.array(z.string()),
    evidenceQuotes: z.array(z.string()).max(2), // ≤2 quotes from her writing (spec §6.3)
  }),
  standardsCoverage: z.record(z.string(), z.number().int()),
  recommendedPractice: z.array(z.string()).max(4),
  kidVoiceCard: kidFacing(200), // strengths/voice ONLY — never weaknesses
})
export type WeeklyInsights = z.infer<typeof WeeklyInsightsSchema>

/** OCR result for one photographed page of her PAPER journal (parent-only
 *  import flow). Everything is a *suggestion* the parent reviews and edits
 *  before anything is written — so the schema is deliberately forgiving. */
export const ImportedPageSchema = z.object({
  date: z.string().nullable().catch(null),
  dayOfWeek: z.string().nullable().catch(null),
  moods: z.array(z.string()).catch([]),
  extraFeelings: z.array(z.string()).catch([]),
  dayRating: z.string().nullable().catch(null),
  entries: z.array(z.object({ title: z.string(), text: z.string() })).catch([]),
  pageKind: z.enum(['writing', 'drawing', 'mixed']).catch('writing'),
  drawingDescription: z.string().nullable().catch(null),
})
export type ImportedPage = z.infer<typeof ImportedPageSchema>

// ── Inputs ────────────────────────────────────────────────────────────────
export interface CheckinData {
  moods: string[]
  location: string | null
  activities: string[]
  dayRating: string | null
}

export interface GuidedPromptInput {
  checkin: CheckinData | null
  recentGenres: Genre[]
  currentBook?: string
}

export interface ReviewInput {
  plainText: string
  gradeLevel: number
  mode: 'guided' | 'free' | 'nudge' | 'caption'
  sparkleWordsOffered?: string[]
}

export interface WeeklyInsightsInput {
  weekStart: string
  reviews: Review[]
  excerpts: string[]
}

/**
 * One interface, two implementations: mockClaudeService (Phases 1–3, zero live
 * API calls) and the Cloud-Function-backed live service (Phase 4) swap behind
 * this seam. `live` lets the UI disable AI buttons offline / in mock mode.
 */
export interface ClaudeService {
  readonly live: boolean
  generateGuidedPrompt(input: GuidedPromptInput): Promise<GuidedPrompt>
  reviewEntry(input: ReviewInput): Promise<Review>
  generateWeeklyInsights(input: WeeklyInsightsInput): Promise<WeeklyInsights>
  /** "Keep going?" — ONE encouraging follow-up question, never a new assignment (§4.2A). */
  followUpQuestion(plainText: string): Promise<string>
}
