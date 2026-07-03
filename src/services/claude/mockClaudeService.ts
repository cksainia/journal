import { countWords, countSentences } from '@/lib/counting'
import {
  GuidedPromptSchema,
  ReviewSchema,
  WeeklyInsightsSchema,
  type ClaudeService,
  type Genre,
  type GuidedPrompt,
  type GuidedPromptInput,
  type Review,
  type ReviewInput,
  type WeeklyInsights,
  type WeeklyInsightsInput,
} from './types'
import { GUIDED_FALLBACK } from '@/data/guidedFallback'

/**
 * mockClaudeService — spec §13 Phase 1/4. The ENTIRE app flow runs with zero
 * live API calls. Reviews derive real corrections from the actual text
 * (standalone "i", sentence-initial lowercase, common 3rd-grade misspellings)
 * so the muscle-memory spelling flow is genuinely testable. Every response
 * round-trips the same zod schemas as the live service.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MISSPELLINGS: Record<string, string> = {
  beleive: 'believe',
  becuase: 'because',
  freind: 'friend',
  definately: 'definitely',
  seperate: 'separate',
  untill: 'until',
  wich: 'which',
  recieve: 'receive',
  probly: 'probably',
  favrite: 'favorite',
}

function deriveCorrections(text: string) {
  const corrections: Review['corrections'][number][] = []
  let id = 0

  // Standalone lowercase "i"
  if (/(^|\s)i(\s|[.,!?]|$)/.test(text)) {
    corrections.push({
      id: `c${++id}`,
      type: 'capitalization',
      category: 'capitalization',
      original: 'i',
      suggestion: 'I',
      explanationKid: "The word 'I' is so important it ALWAYS gets a capital!",
      standardsTags: ['L.WF.3.3'],
      confidence: 0.97,
    })
  }
  // Sentence-initial lowercase letters
  const lower = text.match(/(?:^|[.!?]\s+)([a-z]\w*)/)
  if (lower && lower[1] !== 'i') {
    corrections.push({
      id: `c${++id}`,
      type: 'capitalization',
      category: 'capitalization',
      original: lower[1],
      suggestion: lower[1][0].toUpperCase() + lower[1].slice(1),
      explanationKid: 'New sentence, capital letter — like a fresh start! 🌱',
      standardsTags: ['L.WF.3.3'],
      confidence: 0.9,
    })
  }
  // Common misspellings
  for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
    if (new RegExp(`\\b${wrong}\\b`, 'i').test(text)) {
      corrections.push({
        id: `c${++id}`,
        type: 'spelling',
        category: 'spelling',
        original: wrong,
        suggestion: right,
        explanationKid: `This tricky word likes to hide its real spelling: ${right}`,
        standardsTags: ['L.WF.3.2'],
        confidence: 0.95,
      })
    }
  }
  // Missing terminal punctuation on the final sentence
  if (/[\p{L}\p{N}]\s*$/u.test(text.trim()) && !/[.!?…]\s*$/.test(text.trim())) {
    corrections.push({
      id: `c${++id}`,
      type: 'punctuation',
      category: 'punctuation',
      original: text.trim().split(/\s+/).slice(-2).join(' '),
      suggestion: text.trim().split(/\s+/).slice(-2).join(' ') + '.',
      explanationKid: 'Your last sentence wants a period to finish strong! 💪',
      standardsTags: ['L.WF.3.3'],
      confidence: 0.85,
    })
  }
  return corrections.slice(0, 5) // hard cap (§4.5)
}

const ENCOURAGEMENTS = [
  'I love how your ideas sparkle in this one! ✨',
  'You painted a picture with your words today!',
  'Your story pulled me right in — great job!',
  'What a fun read — your voice really shines!',
]
const FOLLOW_UPS = [
  'Ooh — and then what happened?',
  'What did that look like? I want to picture it!',
  'How did that make you feel inside?',
  'Who else was there? What did they say?',
  'What sounds or smells do you remember?',
]

const pick = <T,>(arr: T[], seed: number) => arr[seed % arr.length]

export const mockClaudeService: ClaudeService = {
  live: false,

  async generateGuidedPrompt(input: GuidedPromptInput): Promise<GuidedPrompt> {
    await delay(400)
    // Genre rotation: least-recently-used first (spec §5 rotation).
    const order: Genre[] = ['narrative', 'opinion', 'informative']
    const genre = order.find((g) => !input.recentGenres.includes(g)) ?? input.recentGenres[input.recentGenres.length - 1] ?? 'narrative'
    const bank = GUIDED_FALLBACK[genre]
    // Personalize from check-in (spec §4.2A): traveled → journey, read → book, etc.
    const c = input.checkin
    let variant = bank.prompts[0]
    if (c?.location === 'traveling') variant = bank.prompts[1] ?? variant
    else if (c?.activities?.includes('read') || input.currentBook) variant = bank.prompts[2] ?? variant
    else if (c?.moods?.some((m) => ['sad', 'grumpy', 'nervous'].includes(m)))
      variant = bank.gentle ?? variant
    else variant = pick(bank.prompts, (c?.activities?.length ?? 0) + (c?.moods?.length ?? 0))
    return GuidedPromptSchema.parse({
      prompt: variant,
      genre,
      kidFriendlyName: bank.kidFriendlyName,
      standardsTags: bank.standardsTags,
      sparkleWords: pick(bank.sparkleSets, variant.length),
      planningChips: bank.planningChips,
    })
  },

  async reviewEntry(input: ReviewInput): Promise<Review> {
    await delay(600)
    const words = countWords(input.plainText)
    const sentences = countSentences(input.plainText)
    const corrections = deriveCorrections(input.plainText)
    const spelling = corrections.filter((c) => c.type === 'spelling').length
    const grammar = corrections.length - spelling
    const shortPiece = words < 25
    const grammarByCategory: Record<string, number> = {}
    corrections.forEach((c) => {
      if (c.type !== 'spelling') grammarByCategory[c.category] = (grammarByCategory[c.category] || 0) + 1
    })
    return ReviewSchema.parse({
      schemaVersion: '1.0',
      encouragement: pick(ENCOURAGEMENTS, words),
      strengths: [
        sentences >= 4
          ? 'You kept your ideas flowing across several sentences!'
          : 'You used details that helped me picture the moment.',
      ],
      nextStep: {
        label: 'Add one more detail',
        reason: 'It helps your reader step right into your story.',
        example: pick(FOLLOW_UPS, sentences),
      },
      corrections,
      counts: { words, sentences, spelling, grammar },
      rubric: {
        ideas: Math.min(3, 1 + Math.floor(sentences / 3)),
        organization: sentences >= 5 ? 2 : 1,
        details: words >= 40 ? 3 : words >= 15 ? 2 : 1,
        voice: 3,
        conventions: corrections.length === 0 ? 3 : corrections.length <= 2 ? 2 : 1,
      },
      sparkle_words_used: (input.sparkleWordsOffered ?? []).filter((w) =>
        input.plainText.toLowerCase().includes(w.toLowerCase()),
      ),
      voiceNotes: ['imaginative', 'curious'],
      parent_metrics: shortPiece
        ? null
        : {
            njsla_written_expression_estimate: Math.min(4, 2 + Math.floor(sentences / 5)),
            njsla_conventions_estimate: corrections.length <= 1 ? 3 : 2,
            rubric_justification:
              'Mock estimate from length/convention heuristics — live Claude replaces this.',
          },
      safetyFlags: [],
    })
  },

  async generateWeeklyInsights(input: WeeklyInsightsInput): Promise<WeeklyInsights> {
    await delay(500)
    const n = input.reviews.length
    const catTotals: Record<string, number> = {}
    input.reviews.forEach((r) =>
      r.corrections.forEach((c) => {
        catTotals[c.category] = (catTotals[c.category] || 0) + 1
      }),
    )
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]
    const tagTotals: Record<string, number> = {}
    input.reviews.forEach((r) =>
      r.corrections.forEach((c) => c.standardsTags.forEach((t) => (tagTotals[t] = (tagTotals[t] || 0) + 1))),
    )
    return WeeklyInsightsSchema.parse({
      schemaVersion: '1.0',
      dateRange: { start: input.weekStart, end: input.weekStart },
      sampleCounts: { entries: n, reviewedEntries: n },
      strengths: ['Writes with humor and a strong personal voice.', 'Shows up and writes consistently.'],
      growthAreas: [
        topCat
          ? {
              pattern: `${topCat[0]} slips appear ${topCat[1]} time(s) across reviewed entries.`,
              recommendation: `IXL ELA Grade 3: ${topCat[0]} practice set.`,
            }
          : {
              pattern: 'Transition words appear rarely between ideas.',
              recommendation: 'IXL ELA Grade 3: linking words practice.',
            },
      ],
      voice: { adjectives: ['funny', 'curious'], evidenceQuotes: input.excerpts.slice(0, 2) },
      standardsCoverage: Object.keys(tagTotals).length ? tagTotals : { 'W.RW.3.7': n },
      recommendedPractice: ['IXL ELA: linking words', 'Read one comic panel aloud and add a caption'],
      kidVoiceCard: 'Your writing is 😂 funny and 💛 kind — keep those stories coming!',
    })
  },

  async followUpQuestion(plainText: string): Promise<string> {
    await delay(300)
    return pick(FOLLOW_UPS, countWords(plainText))
  },
}
