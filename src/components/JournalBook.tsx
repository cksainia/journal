import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import type { DayBundle } from '@/lib/analytics'
import { MOODS, RATINGS } from '@/components/CheckIn'
import { DOODLES, doodlesForDay } from '@/components/doodles'

/**
 * The journal as a physical notebook: one day per ruled-paper page, doodles
 * grown from her check-in, washi-tape prompt labels, taped-polaroid drawings,
 * and an Apple-Books-style page turn (framer-motion; instant when the OS asks
 * for reduced motion — the CSS kill-switch zeroes the duration).
 */
export function JournalBook({ bundles }: { bundles: DayBundle[] }) {
  // oldest → newest, opened to the latest page like a real journal
  const pages = bundles
  const [index, setIndex] = useState(pages.length - 1)
  const [dir, setDir] = useState(1)
  const touchX = useRef<number | null>(null)

  if (!pages.length) return null
  const clamped = Math.min(index, pages.length - 1)

  function go(delta: number) {
    const next = clamped + delta
    if (next < 0 || next >= pages.length) return
    setDir(delta)
    setIndex(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="book-perspective relative"
        onPointerDown={(e) => (touchX.current = e.clientX)}
        onPointerUp={(e) => {
          if (touchX.current === null) return
          const dx = e.clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
        }}
        role="region"
        aria-label={`Journal page ${clamped + 1} of ${pages.length}. Swipe or use the arrows to turn pages.`}
      >
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.div
            key={pages[clamped].day.dateKey}
            custom={dir}
            initial="enter"
            animate="center"
            exit="exit"
            variants={{
              enter: (d: number) => ({
                rotateY: d > 0 ? 70 : -70,
                opacity: 0.3,
                transformOrigin: d > 0 ? 'left center' : 'right center',
              }),
              center: { rotateY: 0, opacity: 1, transition: { duration: 0.45, ease: [0.3, 0.9, 0.3, 1] } },
              exit: (d: number) => ({
                rotateY: d > 0 ? -80 : 80,
                opacity: 0.2,
                transformOrigin: d > 0 ? 'left center' : 'right center',
                transition: { duration: 0.35, ease: [0.6, 0, 0.7, 0.4] },
              }),
            }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <JournalPage bundle={pages[clamped]} pageNo={clamped + 1} total={pages.length} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-2">
        <Button variant="ghost" size="sm" onClick={() => go(-1)} disabled={clamped === 0} aria-label="Previous page">
          ← older
        </Button>
        <span className="font-hand-display text-xl text-muted">
          page {clamped + 1} of {pages.length}
        </span>
        <Button variant="ghost" size="sm" onClick={() => go(1)} disabled={clamped === pages.length - 1} aria-label="Next page">
          newer →
        </Button>
      </div>
    </div>
  )
}

export function JournalPage({
  bundle,
  pageNo,
  total,
  compact = false,
}: {
  bundle: DayBundle
  pageNo?: number
  total?: number
  compact?: boolean
}) {
  const { day, sections } = bundle
  const live = sections.filter(
    (s) => s.status !== 'archived' && (s.plainText?.trim() || (s.panels?.length ?? 0) > 0),
  )
  const doodles = doodlesForDay(day.dateKey, day.checkin)
  const pretty = new Date(day.dateKey + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const moods = (day.checkin?.moods ?? [])
    .map((id) => MOODS.find((m) => m.id === id))
    .filter(Boolean)
  const rating = RATINGS.find((r) => r.id === day.checkin?.dayRating)
  const washiColors = ['washi', 'washi washi-pink', 'washi washi-mint']

  return (
    <div className={`paper-page paper-ink overflow-hidden ${compact ? 'p-4 pl-12' : 'p-5 pl-14 min-h-[480px]'}`}>
      {/* margin doodles from her check-in */}
      {!compact &&
        doodles.map((d) => (
          <span key={d.key} style={d.style}>
            {DOODLES[d.doodle]}
          </span>
        ))}

      {/* date headline + mood stickers */}
      <div className="flex items-start justify-between gap-2 relative">
        <p className="font-hand-display text-3xl leading-none -rotate-1">{pretty}</p>
        <div className="flex gap-1 text-xl" aria-label="How she felt">
          {moods.map((m) => (
            <span key={m!.id} title={m!.label} className="drop-shadow-sm">
              {m!.emoji}
            </span>
          ))}
          {rating && (
            <span title={`${rating.label} day`} className="drop-shadow-sm">
              {rating.emoji}
            </span>
          )}
        </div>
      </div>

      {live.length === 0 ? (
        <p className="font-hand paper-lines text-xl mt-4 text-muted">
          (checked in, but the page stayed empty today 💛)
        </p>
      ) : (
        live.map((s, i) => (
          <div key={s.id} className="mt-5 relative">
            {s.prompt && (
              <span className={`${washiColors[i % washiColors.length]} font-hand text-sm text-ink/80`}>
                💭 {s.prompt}
              </span>
            )}
            {!s.prompt && s.type === 'free' && (
              <span className={`${washiColors[i % washiColors.length]} font-hand text-sm text-ink/80`}>
                🖊️ dear journal…
              </span>
            )}

            {(s.panels?.length ?? 0) > 0 && (
              <div className="flex gap-4 mt-4 mb-1 flex-wrap">
                {s.panels!.map((p, j) => (
                  <div
                    key={j}
                    className="polaroid relative"
                    style={{ transform: `rotate(${j % 2 ? 2.5 : -2}deg)`, width: compact ? 90 : 130 }}
                  >
                    <span className="tape" />
                    <img src={p.image} alt={p.caption || `Drawing ${j + 1}`} className="w-full" />
                    {p.caption && (
                      <p className="font-hand text-xs text-center mt-1 text-ink/80">{p.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {s.plainText?.trim() && (
              <p
                className={`font-hand paper-lines whitespace-pre-wrap mt-1 ${compact ? 'text-lg line-clamp-4' : 'text-xl'}`}
              >
                {s.plainText}
              </p>
            )}
          </div>
        ))
      )}

      {/* footer: counts as a pencil note + page corner */}
      <div className="mt-6 flex items-end justify-between">
        <p className="font-hand-display text-lg text-muted -rotate-2">
          {day.dailyTotals.sentences} {day.dailyTotals.sentences === 1 ? 'sentence' : 'sentences'} ·{' '}
          {day.dailyTotals.words} {day.dailyTotals.words === 1 ? 'word' : 'words'} ✏️
        </p>
        {pageNo !== undefined && (
          <p className="font-hand text-sm text-muted">~ {pageNo} ~{total ? '' : ''}</p>
        )}
      </div>
    </div>
  )
}
