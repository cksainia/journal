import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getClaudeService } from '@/services/claude'
import type { Review } from '@/services/claude/types'
import { recordOutcome, recordRecheck, saveReview, type CorrectionOutcome } from '@/lib/reviews'
import { celebrate } from '@/lib/confetti'
import type { JournalSection } from '@/lib/journal'

type Phase =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'result'; review: Review; reviewId: string }

const QUESTS = [
  'Add one more juicy detail!',
  'Try a stronger verb somewhere.',
  'Start one sentence a different way.',
]

/**
 * "Check My Writing" result (spec §4.5): encouragement FIRST, then at most one
 * glow and one grow, then friendly correction cards with agency. Spelling
 * corrections require typing the word (muscle-memory rule — no 1-click
 * replace); grammar/structure may apply on tap. Malformed AI output lands on
 * the napping-checker fallback and never blocks writing.
 */
export function ReviewPanel({
  dateKey,
  section,
  getPlainText,
  applyCorrection,
  onClose,
}: {
  dateKey: string
  section: JournalSection
  getPlainText: () => string
  applyCorrection: (original: string, suggestion: string) => boolean
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [outcomes, setOutcomes] = useState<Record<string, CorrectionOutcome>>({})
  const [recheck, setRecheck] = useState<'idle' | 'running'>('idle')
  const [isRecheck, setIsRecheck] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    void (async () => {
      try {
        const service = getClaudeService()
        const review = await service.reviewEntry({
          plainText: getPlainText(),
          gradeLevel: 3,
          mode: section.type === 'guided' ? 'guided' : section.type === 'nudge' ? 'nudge' : 'free',
          sparkleWordsOffered: section.sparkleWords?.offered ?? [],
        })
        const reviewId = await saveReview(
          dateKey,
          section.id,
          review,
          'initial',
          service.live ? 'live' : 'mock',
        )
        setPhase({ kind: 'result', review, reviewId })
        if (review.sparkle_words_used.length) celebrate({ small: true })
      } catch (e) {
        console.warn('review failed:', (e as Error).message)
        setPhase({ kind: 'error' })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function resolve(correctionId: string, outcome: CorrectionOutcome) {
    if (phase.kind !== 'result') return
    setOutcomes((o) => ({ ...o, [correctionId]: outcome }))
    recordOutcome(dateKey, section.id, phase.reviewId, correctionId, outcome).catch(() => {})
  }

  /** Re-check = a FULL fresh review of the current text. Remaining problems
   *  come back as actionable cards — never just a reassuring number while
   *  new errors sit unseen. The original review logs the postFixRecheck. */
  async function runRecheck() {
    if (phase.kind !== 'result') return
    setRecheck('running')
    try {
      const service = getClaudeService()
      const review = await service.reviewEntry({
        plainText: getPlainText(),
        gradeLevel: 3,
        mode: section.type === 'guided' ? 'guided' : section.type === 'nudge' ? 'nudge' : 'free',
        sparkleWordsOffered: section.sparkleWords?.offered ?? [],
      })
      const counts = { spelling: review.counts.spelling, grammar: review.counts.grammar }
      await recordRecheck(dateKey, section.id, phase.reviewId, counts)
      const reviewId = await saveReview(
        dateKey,
        section.id,
        review,
        'recheck',
        service.live ? 'live' : 'mock',
      )
      setOutcomes({})
      setIsRecheck(true)
      setPhase({ kind: 'result', review, reviewId })
      if (review.corrections.length === 0) celebrate()
    } catch (e) {
      console.warn('recheck failed:', (e as Error).message)
    } finally {
      setRecheck('idle')
    }
  }

  if (phase.kind === 'loading') {
    return (
      <Card className="text-center py-8">
        <span className="text-4xl animate-pulse" aria-hidden>🦉</span>
        <p className="font-extrabold mt-2">Reading your writing…</p>
      </Card>
    )
  }

  if (phase.kind === 'error') {
    return (
      <Card className="text-center py-6">
        <span className="text-4xl" aria-hidden>😴</span>
        <p className="font-extrabold mt-2">The writing checker is napping</p>
        <p className="text-muted text-sm mt-1">Try again soon — your writing is safe and saved!</p>
        <Button variant="soft" size="sm" className="mt-3" onClick={onClose}>OK</Button>
      </Card>
    )
  }

  const { review } = phase
  const unresolved = review.corrections.filter((c) => !outcomes[c.id])
  const anyResolved = Object.keys(outcomes).length > 0

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {/* Encouragement first — always (spec §4.5) */}
      <Card className="bg-sunny-soft border-sunny/40 text-center">
        <span className="text-3xl" aria-hidden>🎉</span>
        <p className="font-extrabold text-lg mt-1">{review.encouragement}</p>
      </Card>

      {/* One glow, one grow */}
      {review.strengths[0] && (
        <Card className="bg-teal-soft border-teal/30">
          <p className="font-extrabold text-teal text-sm uppercase tracking-wide">🌟 Glow</p>
          <p className="font-bold mt-1">{review.strengths[0]}</p>
        </Card>
      )}
      {review.nextStep && (
        <Card className="bg-lavender-soft border-lavender/30">
          <p className="font-extrabold text-lavender text-sm uppercase tracking-wide">🌱 Grow</p>
          <p className="font-bold mt-1">{review.nextStep.label}</p>
          <p className="text-muted text-sm mt-0.5">{review.nextStep.reason}</p>
          {review.nextStep.example && (
            <p className="text-sm mt-1 italic">Try: “{review.nextStep.example}”</p>
          )}
        </Card>
      )}

      {review.sparkle_words_used.length > 0 && (
        <p className="text-center font-bold text-sm">
          ✨ Sparkle words used: {review.sparkle_words_used.join(', ')} — amazing!
        </p>
      )}

      {unresolved.map((c) => (
        <CorrectionCard
          key={c.id}
          correction={c}
          onUse={(typed) => {
            const target = c.type === 'spelling' ? typed : c.suggestion
            applyCorrection(c.original, target)
            celebrate({ small: true })
            void resolve(c.id, 'used')
          }}
          onSkip={() => void resolve(c.id, 'skipped')}
          onSelfFix={() => void resolve(c.id, 'selfFixed')}
        />
      ))}

      {review.corrections.length === 0 && (
        <Card className="text-center bg-teal-soft border-teal/30">
          <p className="font-extrabold">
            {isRecheck ? 'Sparkling clean now — great editing! 🎉' : 'Sparkling clean — no fixes needed! ✨'}
          </p>
        </Card>
      )}

      {review.corrections.length > 0 && unresolved.length === 0 && (
        <Card className="text-center bg-teal-soft border-teal/30">
          <p className="font-extrabold">All checked — nice editing! 🧹</p>
          {/* Occasional revision quest (spec §4.5) — a tiny stretch, never homework */}
          {review.counts.sentences % 3 === 0 && (
            <p className="text-sm font-bold mt-1">
              🗺️ Revision quest: {QUESTS[review.counts.words % QUESTS.length]}
            </p>
          )}
          <Button variant="soft" size="sm" className="mt-2" onClick={runRecheck} disabled={recheck === 'running'}>
            {recheck === 'running' ? 'Checking again…' : 'Check again? 🔍'}
          </Button>
        </Card>
      )}

      <div className="flex justify-center gap-2">
        {anyResolved && recheck === 'idle' && unresolved.length > 0 && (
          <Button variant="ghost" size="sm" onClick={runRecheck}>Check again 🔍</Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>Done with review</Button>
      </div>
    </div>
  )
}

function CorrectionCard({
  correction: c,
  onUse,
  onSkip,
  onSelfFix,
}: {
  correction: Review['corrections'][number]
  onUse: (typed: string) => void
  onSkip: () => void
  onSelfFix: () => void
}) {
  const [typing, setTyping] = useState(false)
  const [typed, setTyped] = useState('')
  const [shake, setShake] = useState(false)
  const isSpelling = c.type === 'spelling'

  function submitTyped() {
    if (typed.trim().toLowerCase() === c.suggestion.toLowerCase()) {
      onUse(typed.trim())
    } else {
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <Card className="border-2">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
        {isSpelling ? '🔤 Spelling Detective' : c.type === 'capitalization' || c.type === 'punctuation' || c.type === 'grammar' ? '🪄 Grammar Wizard' : '💡 Word Helper'}
      </p>
      <p className="font-bold mt-1">{c.explanationKid}</p>
      <p className="text-sm mt-1">
        <span className="line-through text-muted">{c.original}</span>
        {!isSpelling && <span className="font-extrabold text-teal"> → {c.suggestion}</span>}
        {isSpelling && <span className="text-muted"> → can you spell it right?</span>}
      </p>

      {typing && isSpelling ? (
        <div className={shake ? 'animate-[wiggle_0.4s]' : ''}>
          <input
            autoFocus
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitTyped()}
            placeholder="Type the word here…"
            aria-label="Type the corrected spelling"
            className="mt-2 w-full min-h-12 px-4 rounded-2xl border-2 border-teal bg-paper
                       focus:outline-none text-lg font-bold tracking-wide"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {shake && <p className="text-coral text-xs font-bold mt-1">Almost — check it letter by letter! 🔍</p>}
          <Button size="sm" className="mt-2" onClick={submitTyped} disabled={!typed.trim()}>
            That's it!
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" onClick={() => (isSpelling ? setTyping(true) : onUse(c.suggestion))}>
            Use this
          </Button>
          <Button variant="secondary" size="sm" onClick={onSkip}>
            Skip
          </Button>
          <Button variant="ghost" size="sm" onClick={onSelfFix}>
            I fixed it myself
          </Button>
        </div>
      )}
    </Card>
  )
}

/** Always-available self-editing checklist — THE fallback when AI is offline (spec §4.5). */
export function SelfChecklist() {
  const items = [
    'Did I start my sentences with capitals?',
    'Did I end my sentences with . ! or ?',
    'Did I add at least one juicy detail?',
  ]
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false))
  return (
    <Card className="bg-soft">
      <p className="font-extrabold text-sm mb-2">✅ My own check</p>
      {items.map((item, i) => (
        <label key={i} className="flex items-center gap-3 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            checked={checked[i]}
            onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
            className="size-5 accent-teal"
          />
          <span className={checked[i] ? 'line-through text-muted' : 'font-bold'}>{item}</span>
        </label>
      ))}
      {checked.every(Boolean) && <p className="text-teal font-extrabold text-sm mt-1">Checklist champion! 🏆</p>}
    </Card>
  )
}
