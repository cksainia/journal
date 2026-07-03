import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import type { DayBundle } from '@/lib/analytics'
import { saveStickers, type Sticker } from '@/lib/journal'
import { MOODS, RATINGS } from '@/components/CheckIn'
import { Art } from '@/components/illustrations'
import { DOODLES, doodlesForDay } from '@/components/doodles'
import { celebrate } from '@/lib/confetti'

/**
 * The journal as a physical notebook: one day per ruled-paper page (Caveat
 * handwriting), doodles grown from her check-in, washi-tape prompt labels,
 * taped-polaroid drawings, HER OWN sticker collection, and an
 * Apple-Books-style page turn (reduced-motion safe via the CSS kill-switch).
 */

const STICKER_BOX = [
  '🦄', '🌈', '⭐', '✨', '💖', '🌸', '🦋', '🐶',
  '🐱', '🎀', '👑', '🍩', '🍦', '🍓', '🧁', '🫧',
  '🐢', '🐬', '⚽', '📚', '🎨', '🎸', '🌙', '😻',
]
const MAX_STICKERS = 12

export function JournalBook({
  bundles,
  index,
  onIndexChange,
}: {
  bundles: DayBundle[]
  /** Controlled page index (oldest → newest). Parent owns it so a month rail can jump. */
  index: number
  onIndexChange: (next: number) => void
}) {
  const pages = bundles
  const prevIndex = useRef(index)
  const [stickerMode, setStickerMode] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  // local sticker overlay so placement feels instant; Firestore write follows
  const [localStickers, setLocalStickers] = useState<Record<string, Sticker[]>>({})
  const touchX = useRef<number | null>(null)

  if (!pages.length) return null
  const clamped = Math.max(0, Math.min(index, pages.length - 1))
  const dir = clamped >= prevIndex.current ? 1 : -1
  prevIndex.current = clamped
  const bundle = pages[clamped]
  const dateKey = bundle.day.dateKey
  const stickers = localStickers[dateKey] ?? bundle.day.stickers ?? []

  function go(delta: number) {
    const next = clamped + delta
    if (next < 0 || next >= pages.length) return
    onIndexChange(next)
    setStickerMode(false)
    setPicked(null)
  }

  function placeSticker(x: number, y: number) {
    if (!picked || stickers.length >= MAX_STICKERS) return
    const next = [
      ...stickers,
      { emoji: picked, x, y, rot: Math.round(Math.random() * 28 - 14), size: 26 + Math.round(Math.random() * 12) },
    ]
    setLocalStickers((m) => ({ ...m, [dateKey]: next }))
    celebrate({ small: true })
    void saveStickers(dateKey, next).catch((e) => console.warn('sticker save:', e.message))
  }

  function peelSticker(i: number) {
    const next = stickers.filter((_, j) => j !== i)
    setLocalStickers((m) => ({ ...m, [dateKey]: next }))
    void saveStickers(dateKey, next).catch((e) => console.warn('sticker save:', e.message))
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
          if (!stickerMode && Math.abs(dx) > 60) go(dx < 0 ? 1 : -1)
        }}
        role="region"
        aria-label={`Journal page ${clamped + 1} of ${pages.length}. Swipe or use the arrows to turn pages.`}
      >
        <AnimatePresence initial={false} mode="popLayout" custom={dir}>
          <motion.div
            key={dateKey}
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
            <JournalPage
              bundle={bundle}
              pageNo={clamped + 1}
              stickers={stickers}
              stickerMode={stickerMode}
              placing={!!picked}
              onPlace={placeSticker}
              onPeel={peelSticker}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between px-2">
        <Button variant="ghost" size="sm" onClick={() => go(-1)} disabled={clamped === 0} aria-label="Previous page">
          ← older
        </Button>
        <button
          className="font-hand-display text-xl text-muted min-h-11 px-3 rounded-full hover:bg-soft
                     focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender"
          onClick={() => {
            setStickerMode(!stickerMode)
            setPicked(null)
          }}
          aria-pressed={stickerMode}
          aria-label="Open the sticker box"
        >
          {stickerMode ? 'done ✓' : 'stickers 💖'}
        </button>
        <Button variant="ghost" size="sm" onClick={() => go(1)} disabled={clamped === pages.length - 1} aria-label="Next page">
          newer →
        </Button>
      </div>
      <p className="text-center font-hand-display text-lg text-muted -mt-2">
        page {clamped + 1} of {pages.length}
      </p>

      {stickerMode && (
        <div className="bg-paper border border-line rounded-3xl p-3 shadow-card">
          <p className="font-hand-display text-xl text-center mb-2">
            {picked
              ? `now tap your page to stick the ${picked}!`
              : stickers.length >= MAX_STICKERS
                ? 'this page is full of stickers! peel one off first 🫧'
                : 'pick a sticker… (tap one on the page to peel it off)'}
          </p>
          <div className="grid grid-cols-8 gap-1">
            {STICKER_BOX.map((s) => (
              <Chip
                key={s}
                active={picked === s}
                onClick={() => setPicked(picked === s ? null : s)}
                className="justify-center text-xl min-h-11 px-0"
                aria-label={`Sticker ${s}`}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function JournalPage({
  bundle,
  pageNo,
  compact = false,
  stickers = bundle.day.stickers ?? [],
  stickerMode = false,
  placing = false,
  onPlace,
  onPeel,
}: {
  bundle: DayBundle
  pageNo?: number
  compact?: boolean
  stickers?: Sticker[]
  stickerMode?: boolean
  placing?: boolean
  onPlace?: (x: number, y: number) => void
  onPeel?: (index: number) => void
}) {
  const { day, sections } = bundle
  const pageRef = useRef<HTMLDivElement>(null)
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
    <div
      ref={pageRef}
      className={`paper-page paper-ink overflow-hidden ${compact ? 'p-4 pl-12' : 'p-5 pl-14 min-h-[480px]'} ${
        placing ? 'cursor-crosshair' : ''
      }`}
      onClick={(e) => {
        if (!placing || !onPlace || !pageRef.current) return
        const r = pageRef.current.getBoundingClientRect()
        onPlace(
          Math.min(94, Math.max(2, ((e.clientX - r.left) / r.width) * 100)),
          Math.min(94, Math.max(2, ((e.clientY - r.top) / r.height) * 100)),
        )
      }}
    >
      {/* margin doodles from her check-in */}
      {!compact &&
        doodles.map((d) => (
          <span key={d.key} style={d.style}>
            {DOODLES[d.doodle]}
          </span>
        ))}

      {/* her stickers */}
      {stickers.map((s, i) => (
        <button
          key={i}
          disabled={!stickerMode || !onPeel}
          onClick={(e) => {
            e.stopPropagation()
            if (stickerMode && onPeel) onPeel(i)
          }}
          aria-label={stickerMode ? `Peel off the ${s.emoji} sticker` : `${s.emoji} sticker`}
          className={`absolute drop-shadow-sm select-none ${stickerMode ? 'animate-pulse cursor-pointer' : 'pointer-events-none'}`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            fontSize: compact ? s.size * 0.7 : s.size,
            transform: `translate(-50%, -50%) rotate(${s.rot}deg)`,
            lineHeight: 1,
            background: 'none',
            border: 'none',
            padding: 0,
            zIndex: 5,
          }}
        >
          {s.emoji}
        </button>
      ))}

      {/* date headline + mood stickers */}
      <div className="flex items-start justify-between gap-2 relative">
        <p className="font-hand-display text-3xl leading-none -rotate-1">{pretty}</p>
        <div className="flex gap-1 items-center" aria-label="How she felt">
          {moods.map((m) => (
            <span key={m!.id} title={m!.label} className="drop-shadow-sm">
              <Art set="feeling" id={m!.id} size={compact ? 22 : 30} />
            </span>
          ))}
          {rating && (
            <span title={`${rating.label} day`} className="drop-shadow-sm text-xl">
              {rating.emoji}
            </span>
          )}
        </div>
      </div>

      {live.length === 0 ? (
        <p className="font-hand paper-lines text-2xl mt-4 text-muted">
          (checked in, but the page stayed empty today 💛)
        </p>
      ) : (
        live.map((s, i) => (
          <div key={s.id} className="mt-5 relative">
            {s.prompt && (
              <span className={`${washiColors[i % washiColors.length]} font-hand text-base text-ink/80`}>
                💭 {s.prompt}
              </span>
            )}
            {!s.prompt && s.type === 'free' && (
              <span className={`${washiColors[i % washiColors.length]} font-hand text-base text-ink/80`}>
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
                      <p className="font-hand text-sm text-center mt-1 text-ink/80">{p.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {s.plainText?.trim() && (
              <p
                className={`font-hand paper-lines whitespace-pre-wrap mt-1 ${compact ? 'text-xl line-clamp-4' : 'text-2xl'}`}
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
        {pageNo !== undefined && <p className="font-hand text-base text-muted">~ {pageNo} ~</p>}
      </div>
    </div>
  )
}
