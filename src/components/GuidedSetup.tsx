import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getClaudeService } from '@/services/claude'
import type { GuidedPrompt, Genre, CheckinData } from '@/services/claude/types'
import { GUIDED_FALLBACK } from '@/data/guidedFallback'
import { createSection, type Checkin } from '@/lib/journal'

const ROTATION_KEY = 'guided-genre-rotation'

function recentGenres(): Genre[] {
  try {
    return JSON.parse(localStorage.getItem(ROTATION_KEY) || '[]')
  } catch {
    return []
  }
}
function pushGenre(g: Genre) {
  localStorage.setItem(ROTATION_KEY, JSON.stringify([...recentGenres(), g].slice(-2)))
}

/** Local fallback (spec §4.2A): guided writing NEVER depends on AI. */
function fallbackPrompt(recent: Genre[]): GuidedPrompt {
  const order: Genre[] = ['narrative', 'opinion', 'informative']
  const genre = order.find((g) => !recent.includes(g)) ?? 'narrative'
  const bank = GUIDED_FALLBACK[genre]
  return {
    prompt: bank.prompts[Math.floor(Math.random() * bank.prompts.length)],
    genre,
    kidFriendlyName: bank.kidFriendlyName,
    standardsTags: bank.standardsTags,
    sparkleWords: bank.sparkleSets[Math.floor(Math.random() * bank.sparkleSets.length)],
    planningChips: bank.planningChips,
  }
}

/** Guided Writing setup (spec §4.2A): personalized prompt from the check-in,
 *  Sparkle Words preview, genre rotation, one-tap start. */
export function GuidedSetup({
  dateKey,
  checkin,
  onReady,
  onBack,
}: {
  dateKey: string
  checkin: Checkin | null
  onReady: (sectionId: string) => void
  onBack: () => void
}) {
  const [prompt, setPrompt] = useState<GuidedPrompt | null>(null)
  const [starting, setStarting] = useState(false)
  const requested = useRef(false)

  async function load() {
    setPrompt(null)
    const recent = recentGenres()
    try {
      const p = await getClaudeService().generateGuidedPrompt({
        checkin: (checkin as CheckinData | null) ?? null,
        recentGenres: recent,
      })
      setPrompt(p)
    } catch (e) {
      console.warn('guided prompt fell back to local bank:', (e as Error).message)
      setPrompt(fallbackPrompt(recent))
    }
  }

  useEffect(() => {
    if (requested.current) return
    requested.current = true
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    if (!prompt) return
    setStarting(true)
    try {
      pushGenre(prompt.genre)
      const id = await createSection(dateKey, 'guided', {
        title: prompt.kidFriendlyName,
        prompt: prompt.prompt,
        genre: prompt.genre,
        standardsTags: prompt.standardsTags,
        sparkleWords: prompt.sparkleWords,
        planningChips: prompt.planningChips,
      })
      onReady(id)
    } finally {
      setStarting(false)
    }
  }

  if (!prompt) {
    return (
      <Card className="text-center py-10">
        <span className="text-4xl animate-pulse" aria-hidden>✨</span>
        <p className="font-extrabold mt-2">Cooking up your prompt…</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="text-center">
        <span className="inline-block bg-lavender-soft text-lavender font-extrabold text-xs uppercase tracking-wide rounded-full px-3 py-1">
          {prompt.kidFriendlyName}
        </span>
        <p className="font-extrabold text-xl mt-3">{prompt.prompt}</p>

        <div className="mt-4">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted mb-2">
            ✨ Sparkle words — try one!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {prompt.sparkleWords.map((w) => (
              <span key={w} className="bg-sunny-soft border border-sunny/50 rounded-full px-4 py-2 font-extrabold">
                {w}
              </span>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-5">
          <Button size="lg" onClick={start} disabled={starting}>
            {starting ? 'Opening…' : "Let's write! ✏️"}
          </Button>
        </div>
        <div className="flex justify-center gap-2 mt-2">
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            Different idea 🎲
          </Button>
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        </div>
      </Card>
    </div>
  )
}
