import { z } from 'zod'

/**
 * The Claude service seam (spec §4.5, §9). ALL Claude output — mock or live —
 * is untrusted structured data: it must parse against these schemas before the
 * app touches it. Caps (≤5 corrections, ≤2 quotes, no harsh labels) live in
 * the schemas so they're enforced uniformly on every path.
 */

const KID_SAFE = /\b(bad|wrong|weak|failed|failure|terrible|poor)\b/i
const kidFacing = (max = 400) =>
  z.string().min(1).max(max).refine((s) => !KID_SAFE.test(s), {
    message: 'harsh label in child-facing text',
  })

export const CorrectionSchema = z.object({
  id: z.string(),
  type: z.enum(['spelling', 'grammar', 'punctuation', 'capitalization', 'word_choice', 'structure']),
  category: z.string(),
  original: z.string(),
  suggestion: z.string(),
  explanationKid: kidFacing(200),
  standardsTags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
})

const coachLevel = z.number().int().min(1).max(3)
const njslaLevel = z.number().int().min(1).max(4)

export const ReviewSchema = z.object({
  schemaVersion: z.string(),
  encouragement: kidFacing(),
  strengths: z.array(kidFacing()).min(1).max(3),
  nextStep: z
    .object({ label: kidFacing(100), reason: kidFacing(200), example: kidFacing(200).optional() })
    .nullable(),
  corrections: z.array(CorrectionSchema).max(5), // hard cap (spec §4.5)
  counts: z.object({
    words: z.number().int().min(0),
    sentences: z.number().int().min(0),
    spelling: z.number().int().min(0),
    grammar: z.number().int().min(0),
  }),
  rubric: z.object({
    ideas: coachLevel,
    organization: coachLevel,
    details: coachLevel,
    voice: coachLevel,
    conventions: coachLevel,
  }),
  sparkle_words_used: z.array(z.string()).default([]),
  voiceNotes: z.array(z.string()).default([]),
  parent_metrics: z
    .object({
      njsla_written_expression_estimate: njslaLevel,
      njsla_conventions_estimate: njslaLevel,
      rubric_justification: z.string(),
    })
    .nullable(), // null for short pieces (nudges/captions)
  safetyFlags: z.array(z.string()).default([]),
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
