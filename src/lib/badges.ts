import type { DayBundle } from './analytics'
import type { JournalMeta } from './meta'

/**
 * Badges (spec §6.1): tuned toward EFFORT and REVISION — never error-free-ness.
 * ("Polished Piece" deliberately replaces any "Clean Sheet" concept, which
 * would reward writing less.) No leaderboards, no loss-aversion.
 */
export interface Badge {
  id: string
  emoji: string
  name: string
  blurb: string
  earned: boolean
}

export function computeBadges(bundles: DayBundle[], meta: JournalMeta): Badge[] {
  const writingDays = bundles.filter((b) => b.day.streakCredit)
  const sections = bundles.flatMap((b) => b.sections.filter((s) => s.status !== 'archived'))
  const reviews = bundles.flatMap((b) => b.reviews)
  const totalSentences = bundles.reduce((n, b) => n + b.day.dailyTotals.sentences, 0)
  const genres = new Set(sections.filter((s) => s.genre).map((s) => s.genre))
  const modes = new Set(sections.map((s) => s.type))
  const shelf = meta.wordShelf?.length ?? 0
  const acted = reviews.some((r) =>
    Object.values(r.correctionOutcomes ?? {}).some((o) => o === 'used' || o === 'selfFixed'),
  )
  const detailsUsed = reviews.reduce(
    (n, r) => n + Object.values(r.correctionOutcomes ?? {}).filter((o) => o === 'used').length,
    0,
  )
  // welcome back: a writing day right after a 3+ day gap
  const keys = writingDays.map((b) => b.day.dateKey).sort()
  let welcomeBack = false
  for (let i = 1; i < keys.length; i++) {
    const gap = (new Date(keys[i]).getTime() - new Date(keys[i - 1]).getTime()) / 86400000
    if (gap >= 4) welcomeBack = true
  }

  return [
    { id: 'first-entry', emoji: '🌱', name: 'First Entry', blurb: 'You started your journal!', earned: writingDays.length >= 1 },
    { id: 'path-7', emoji: '💎', name: 'Gem Finder', blurb: '7 writing days', earned: writingDays.length >= 7 },
    { id: 'path-14', emoji: '🐉', name: 'Dragon Friend', blurb: '14 writing days', earned: writingDays.length >= 14 },
    { id: 'path-30', emoji: '🏰', name: 'Castle Keeper', blurb: '30 writing days', earned: writingDays.length >= 30 },
    { id: 'sentences-100', emoji: '💯', name: '100 Sentences', blurb: 'One hundred sentences!', earned: totalSentences >= 100 },
    { id: 'first-drawing', emoji: '🎨', name: 'First Drawing', blurb: 'You drew your day!', earned: modes.has('drawing') },
    { id: 'first-comic', emoji: '🗯️', name: 'Comic Creator', blurb: 'Your first comic strip!', earned: modes.has('comic') },
    { id: 'polished-piece', emoji: '✨', name: 'Polished Piece', blurb: 'You made your writing even better after a review!', earned: acted },
    { id: 'detail-detective', emoji: '🔍', name: 'Detail Detective', blurb: 'Used 3+ suggestions', earned: detailsUsed >= 3 },
    { id: 'genre-sampler', emoji: '🎪', name: 'Genre Sampler', blurb: 'Tried all three writing genres', earned: genres.size >= 3 },
    { id: 'word-collector-5', emoji: '⭐', name: 'Word Collector', blurb: '5 words on your shelf', earned: shelf >= 5 },
    { id: 'word-collector-15', emoji: '🌟', name: 'Word Hoarder', blurb: '15 words on your shelf!', earned: shelf >= 15 },
    { id: 'welcome-back', emoji: '💛', name: 'Welcome Back', blurb: 'You came back — that matters most!', earned: welcomeBack },
  ]
}
