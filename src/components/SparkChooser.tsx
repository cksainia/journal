import { Card } from '@/components/ui/card'
import { nudgeForDate } from '@/data/nudges'
import type { SectionType } from '@/lib/journal'
import { cn } from '@/lib/utils'

/** Step 2 — Choose a spark (spec §4.2). Phase 2 ships Free + Nudge; Guided
 *  and Drawing arrive in Phases 4–6 and are teased, not clickable. */
export function SparkChooser({
  dateKey,
  onPick,
}: {
  dateKey: string
  onPick: (type: SectionType, opts?: { title?: string; prompt?: string }) => void
}) {
  const nudge = nudgeForDate(dateKey)

  const modes: {
    type: SectionType
    emoji: string
    title: string
    blurb: string
    soon?: boolean
    opts?: { title?: string; prompt?: string }
  }[] = [
    {
      type: 'nudge',
      emoji: '💭',
      title: "Today's Nudge",
      blurb: `“${nudge}”`,
      opts: { title: "Today's Nudge", prompt: nudge },
    },
    { type: 'free', emoji: '🖊️', title: 'Free Writing', blurb: 'Anything you want — your page!' },
    { type: 'guided', emoji: '✨', title: 'Guided Writing', blurb: 'Coming soon!', soon: true },
    { type: 'drawing', emoji: '🎨', title: 'Drawing', blurb: 'Coming soon!', soon: true },
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="font-extrabold text-lg text-center">Pick your spark ⚡</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modes.map((m) => (
          <Card
            key={m.type}
            role={m.soon ? undefined : 'button'}
            tabIndex={m.soon ? -1 : 0}
            aria-disabled={m.soon}
            onClick={() => !m.soon && onPick(m.type, m.opts)}
            onKeyDown={(e) => {
              if (!m.soon && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onPick(m.type, m.opts)
              }
            }}
            className={cn(
              'transition-transform',
              m.soon
                ? 'opacity-50'
                : 'cursor-pointer hover:scale-[1.02] active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender',
            )}
          >
            <span className="text-4xl" aria-hidden>
              {m.emoji}
            </span>
            <p className="font-extrabold mt-1">{m.title}</p>
            <p className="text-muted text-sm mt-0.5 line-clamp-3">{m.blurb}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
