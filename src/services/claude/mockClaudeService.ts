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

/**
 * mockClaudeService — spec §13 Phase 1. The ENTIRE app flow is testable with
 * zero live API calls. Every response round-trips through the same zod schemas
 * the live service will use, so the validation seam is exercised from day one.
 */

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const PROMPTS: Record<Genre, Omit<GuidedPrompt, 'genre'>> = {
  narrative: {
    prompt:
      'Tell me a story about something that happened today — even a tiny moment! Who was there, and what happened first?',
    kidFriendlyName: 'Story Builder',
    standardsTags: ['W.NW.3.3'],
    sparkleWords: ['magnificent', 'trudged', 'astonished'],
    planningChips: ['Who was there?', 'Where did it happen?', 'What happened first?', 'How did it end?'],
  },
  opinion: {
    prompt: 'What is the BEST dessert ever invented? Convince me with your strongest reasons!',
    kidFriendlyName: 'Opinion Helper',
    standardsTags: ['W.AW.3.1'],
    sparkleWords: ['delectable', 'genuine', 'preference'],
    planningChips: ['My opinion is…', 'Reason 1', 'Reason 2', 'Closing'],
  },
  informative: {
    prompt:
      'Explain how you would teach an alien to play your favorite game. What are the steps?',
    kidFriendlyName: 'Fact Teacher',
    standardsTags: ['W.IW.3.2'],
    sparkleWords: ['precise', 'instructions', 'observe'],
    planningChips: ['Topic', 'Fact 1', 'Fact 2', 'Steps or details', 'Conclusion'],
  },
}

export const mockClaudeService: ClaudeService = {
  live: false,

  async generateGuidedPrompt(input: GuidedPromptInput): Promise<GuidedPrompt> {
    await delay(400)
    // Simple genre rotation: pick the genre least recently used.
    const order: Genre[] = ['narrative', 'opinion', 'informative']
    const genre = order.find((g) => !input.recentGenres.includes(g)) ?? 'narrative'
    return GuidedPromptSchema.parse({ ...PROMPTS[genre], genre })
  },

  async reviewEntry(input: ReviewInput): Promise<Review> {
    await delay(600)
    const words = countWords(input.plainText)
    const sentences = countSentences(input.plainText)
    const shortPiece = words < 25
    return ReviewSchema.parse({
      schemaVersion: '1.0',
      encouragement: 'I love how you kept writing — your ideas really sparkle today! ✨',
      strengths: ['You used details that helped me picture the moment.'],
      nextStep: {
        label: 'Add one more detail',
        reason: 'It helps your reader step right into your story.',
        example: 'What did it sound like?',
      },
      corrections: [
        {
          id: 'c1',
          type: 'capitalization',
          category: 'capitalization',
          original: 'i',
          suggestion: 'I',
          explanationKid: "The word 'I' is so important it always gets a capital!",
          standardsTags: ['L.WF.3.3'],
          confidence: 0.97,
        },
      ],
      counts: { words, sentences, spelling: 0, grammar: 1 },
      rubric: { ideas: 3, organization: 2, details: 2, voice: 3, conventions: 2 },
      sparkle_words_used: (input.sparkleWordsOffered ?? []).filter((w) =>
        input.plainText.toLowerCase().includes(w.toLowerCase()),
      ),
      voiceNotes: ['imaginative', 'funny'],
      parent_metrics: shortPiece
        ? null
        : {
            njsla_written_expression_estimate: 3,
            njsla_conventions_estimate: 3,
            rubric_justification:
              'Mock estimate — varied sentences, light transition-word use. (Replace with live service in Phase 4.)',
          },
      safetyFlags: [],
    })
  },

  async generateWeeklyInsights(input: WeeklyInsightsInput): Promise<WeeklyInsights> {
    await delay(500)
    return WeeklyInsightsSchema.parse({
      schemaVersion: '1.0',
      dateRange: { start: input.weekStart, end: input.weekStart },
      sampleCounts: { entries: input.reviews.length, reviewedEntries: input.reviews.length },
      strengths: ['Writes with humor and a strong personal voice.'],
      growthAreas: [
        {
          pattern: 'Transition words appear rarely between ideas.',
          recommendation: 'IXL ELA: linking words practice (grade 3, writing strand).',
        },
      ],
      voice: { adjectives: ['funny', 'curious'], evidenceQuotes: [] },
      standardsCoverage: { 'W.NW.3.3': input.reviews.length },
      recommendedPractice: ['IXL ELA: linking words', 'Read one comic panel aloud and add a caption'],
      kidVoiceCard: 'Your writing is 😂 funny and 💛 kind — keep those stories coming!',
    })
  },
}
