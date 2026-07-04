import { Card } from '@/components/ui/card'
import { Art } from '@/components/illustrations'
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
  onPick: (type: SectionType, opts?: { title?: string; prompt?: string; bookMode?: boolean }) => void
}) {
  const nudge = nudgeForDate(dateKey)

  const modes: {
    type: SectionType
    emoji: string
    title: string
    blurb: string
    soon?: boolean
    opts?: { title?: string; prompt?: string; bookMode?: boolean }
  }[] = [
    {
      type: 'nudge',
      emoji: '💭',
      title: "Today's Nudge",
      blurb: `“${nudge}”`,
      opts: { title: "Today's Nudge", prompt: nudge },
    },
    { type: 'free', emoji: '🖊️', title: 'Free Writing', blurb: 'Anything you want — your page!' },
    { type: 'guided', emoji: '✨', title: 'Guided Writing', blurb: 'A prompt made just for your day!' },
    { type: 'guided', emoji: '📖', title: 'About My Book', blurb: 'Write about what you are reading!', opts: { bookMode: true } },
    { type: 'drawing', emoji: '🎨', title: 'Drawing', blurb: 'Draw your day — add a caption!', opts: { title: 'My drawing' } },
    { type: 'comic', emoji: '🗯️', title: 'Comic', blurb: 'Tell a story in 1–3 panels!', opts: { title: 'My comic' } },
    { type: 'photo', emoji: '📸', title: 'Photo', blurb: 'Snap your art, crafts & creations!', opts: { title: 'My photo' } },
  ]

  // Reflection questions from her paper journal — quick, cozy, one-tap starts.
  const reflections = [
    { emoji: '🌟', prompt: 'Three good things today…' },
    { emoji: '💪', prompt: 'Today I was proud of…' },
    { emoji: '💛', prompt: 'Something that I like about me…' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="font-extrabold text-lg text-center">Pick your spark ⚡</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modes.map((m) => (
          <Card
            key={m.title}
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
            {m.opts?.bookMode || m.soon ? (
              <span className="text-4xl" aria-hidden>
                {m.emoji}
              </span>
            ) : (
              <Art set="entry" id={m.type} size={52} />
            )}
            <p className="font-extrabold mt-1">{m.title}</p>
            <p className="text-muted text-sm mt-0.5 line-clamp-3">{m.blurb}</p>
          </Card>
        ))}
      </div>

      <p className="font-extrabold text-center mt-2">…or a quick reflection 💭</p>
      <div className="flex flex-col gap-2">
        {reflections.map((r) => (
          <Card
            key={r.prompt}
            role="button"
            tabIndex={0}
            onClick={() => onPick('free', { title: r.prompt, prompt: r.prompt })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPick('free', { title: r.prompt, prompt: r.prompt })
              }
            }}
            className="p-3 cursor-pointer hover:scale-[1.01] active:scale-95 transition-transform
                       focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender"
          >
            <p className="font-extrabold">
              <span aria-hidden>{r.emoji} </span>
              {r.prompt}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}
