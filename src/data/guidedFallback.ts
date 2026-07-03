import type { Genre } from '@/services/claude/types'

/**
 * Local guided-prompt seed bank (spec §4.2A fallback): used by the mock
 * service AND as the AI-unavailable fallback for live mode. Prompt slots:
 * [0] everyday, [1] traveling, [2] book response, [3+] extras.
 * `gentle` is the tough-day prompt — optional, never probing (spec §11).
 */
export const GUIDED_FALLBACK: Record<
  Genre,
  {
    kidFriendlyName: string
    standardsTags: string[]
    prompts: string[]
    gentle: string
    sparkleSets: string[][]
    planningChips: string[]
  }
> = {
  narrative: {
    kidFriendlyName: 'Story Builder',
    standardsTags: ['W.NW.3.3'],
    prompts: [
      'Tell me the story of one moment from today — even a tiny one. Who was there, and what happened first?',
      'Tell me about your journey — what was the most interesting thing you saw along the way?',
      'Take a character from the book you are reading and give them ONE new adventure in your world.',
      'Write about a time something did not go the way you expected. What happened next?',
    ],
    gentle: 'Write about one small thing from today you want to remember. Just the moment — nothing else.',
    sparkleSets: [
      ['magnificent', 'trudged', 'astonished'],
      ['glimmering', 'cautiously', 'enormous'],
      ['mysterious', 'darted', 'triumphant'],
    ],
    planningChips: ['Who was there?', 'Where did it happen?', 'What happened first?', 'What changed?', 'How did it end?'],
  },
  opinion: {
    kidFriendlyName: 'Opinion Helper',
    standardsTags: ['W.AW.3.1'],
    prompts: [
      'What is the BEST dessert ever invented? Convince me with your strongest reasons!',
      'Which is better: road trips or plane rides? Make your case!',
      'Should everyone read the book you are reading right now? Convince me — with reasons!',
      'What is the best age to be? Defend your answer like a lawyer!',
    ],
    gentle: 'What is one thing that always makes days better? Tell me why it works.',
    sparkleSets: [
      ['delectable', 'genuine', 'preference'],
      ['convincing', 'declare', 'evidence'],
      ['remarkable', 'insist', 'certainly'],
    ],
    planningChips: ['My opinion is…', 'Reason 1', 'Reason 2', 'Example', 'Closing'],
  },
  informative: {
    kidFriendlyName: 'Fact Teacher',
    standardsTags: ['W.IW.3.2'],
    prompts: [
      'Explain how to make your favorite snack so clearly that a grown-up could follow it exactly.',
      'Explain how packing a suitcase works — what goes in first and why?',
      'Teach me three facts about the world of the book you are reading.',
      'Explain how you would teach an alien to solve a Math Kangaroo puzzle. Steps, please!',
    ],
    gentle: 'Teach me one thing you know a lot about. Start with the most interesting fact.',
    sparkleSets: [
      ['precise', 'instructions', 'observe'],
      ['procedure', 'essential', 'carefully'],
      ['diagram', 'accurate', 'demonstrate'],
    ],
    planningChips: ['Topic', 'Fact 1', 'Fact 2', 'Steps or details', 'Conclusion'],
  },
}
