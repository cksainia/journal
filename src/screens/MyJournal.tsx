import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { dateKeyFor } from '@/lib/dateKey'
import { loadRange, type DayBundle } from '@/lib/analytics'
import { MOODS } from '@/components/CheckIn'
import { JournalBook, JournalPage } from '@/components/JournalBook'
import { cn } from '@/lib/utils'

const MODES = [
  { id: 'guided', emoji: '✨', label: 'Guided' },
  { id: 'free', emoji: '🖊️', label: 'Free writing' },
  { id: 'nudge', emoji: '💭', label: 'Nudge' },
  { id: 'drawing', emoji: '🎨', label: 'Drawing' },
  { id: 'comic', emoji: '🗯️', label: 'Comic' },
] as const

/**
 * My Journal — HER BOOK, one view: each day is a single cohesive paper page
 * holding every entry (it scrolls when the day was a big one). A vertical
 * month rail on the left jumps between months; page flips walk through the
 * days. Finding a day = one collapsible with labeled Feelings / Entry-type
 * filters + word search. Memory jar resurfaces a random past page.
 */
export function MyJournal() {
  const [bundles, setBundles] = useState<DayBundle[] | null>(null)
  const [pageIndex, setPageIndex] = useState<number | null>(null) // null → open at latest
  const [findOpen, setFindOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState<string | null>(null)
  const [modeFilter, setModeFilter] = useState<string | null>(null)
  const [memory, setMemory] = useState<DayBundle | null>(null)

  useEffect(() => {
    loadRange(120).then(setBundles).catch(() => setBundles([]))
  }, [])

  // oldest → newest; only days with real content get a page
  const pages = useMemo(
    () =>
      (bundles ?? []).filter((b) =>
        b.sections.some(
          (s) => s.status !== 'archived' && (s.plainText?.trim() || (s.panels?.length ?? 0) > 0),
        ),
      ),
    [bundles],
  )

  const index = pageIndex ?? pages.length - 1

  // months present in the book, newest first for the rail
  const months = useMemo(() => {
    const seen = new Map<string, number>() // yyyy-MM → first page index
    pages.forEach((b, i) => {
      const key = b.day.dateKey.slice(0, 7)
      if (!seen.has(key)) seen.set(key, i)
    })
    return [...seen.entries()]
      .map(([ym, firstIndex]) => ({
        ym,
        firstIndex,
        label: new Date(ym + '-15T12:00:00').toLocaleDateString(undefined, { month: 'short' }),
        year: ym.slice(0, 4),
      }))
      .reverse()
  }, [pages])

  const currentMonth = pages[index]?.day.dateKey.slice(0, 7)
  const showYears = new Set(months.map((m) => m.year)).size > 1

  const filtering = !!(search.trim() || moodFilter || modeFilter)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...pages].reverse().filter((b) => {
      if (moodFilter && !(b.day.checkin?.moods ?? []).includes(moodFilter)) return false
      const live = b.sections.filter((s) => s.status !== 'archived')
      if (modeFilter && !live.some((s) => s.type === modeFilter)) return false
      if (q && !live.some((s) => (s.plainText + ' ' + s.prompt).toLowerCase().includes(q))) return false
      return true
    })
  }, [pages, search, moodFilter, modeFilter])

  function shakeMemoryJar() {
    if (!pages.length) return
    const past = pages.filter((b) => b.day.dateKey !== dateKeyFor())
    setMemory(past[Math.floor(Math.random() * past.length)] ?? pages[0])
  }

  if (!bundles) {
    return (
      <div className="flex flex-col gap-4">
        <Header />
        <Card className="text-center text-muted py-10">Opening your book… 📖</Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Header />

      <div className="flex flex-wrap gap-2 items-center">
        <Chip onClick={() => setFindOpen(!findOpen)} aria-expanded={findOpen}>
          🔍 Find a day {findOpen ? '▾' : '▸'}
        </Chip>
        <Chip onClick={shakeMemoryJar}>🫙 Memory jar</Chip>
        {filtering && (
          <Chip
            onClick={() => {
              setSearch('')
              setMoodFilter(null)
              setModeFilter(null)
            }}
          >
            ✖︎ Clear filters
          </Chip>
        )}
      </div>

      {findOpen && (
        <Card className="flex flex-col gap-3 p-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your words…"
            aria-label="Search journal entries"
            className="w-full min-h-11 px-4 rounded-full border-2 border-line bg-paper focus:border-teal focus:outline-none text-sm font-bold"
          />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted mb-1.5">
              💛 Feelings
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <Chip
                  key={m.id}
                  active={moodFilter === m.id}
                  onClick={() => setMoodFilter(moodFilter === m.id ? null : m.id)}
                  className="min-h-9 px-3 text-xs"
                >
                  {m.emoji} {m.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted mb-1.5">
              ✏️ Entry types
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((t) => (
                <Chip
                  key={t.id}
                  active={modeFilter === t.id}
                  onClick={() => setModeFilter(modeFilter === t.id ? null : t.id)}
                  className="min-h-9 px-3 text-xs"
                >
                  {t.emoji} {t.label}
                </Chip>
              ))}
            </div>
          </div>
        </Card>
      )}

      {memory && (
        <div className="relative">
          <p className="font-hand-display text-xl text-muted mb-1">🫙 shaken from your memory jar…</p>
          <JournalPage bundle={memory} compact />
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => setMemory(null)}>
            Put it back
          </Button>
        </div>
      )}

      {pages.length === 0 ? (
        <Card className="text-center text-muted py-8">Your book is waiting for its first page 💛</Card>
      ) : filtering ? (
        <div className="flex flex-col gap-4" aria-label="Matching days">
          {filtered.length === 0 ? (
            <Card className="text-center text-muted py-6">Nothing matched — try different words?</Card>
          ) : (
            filtered.map((b) => <JournalPage key={b.day.dateKey} bundle={b} compact />)
          )}
        </div>
      ) : (
        <div className="flex gap-2 items-start">
          {/* month rail — tap to jump, then flip through the days */}
          {months.length > 1 && (
            <nav aria-label="Jump to a month" className="flex flex-col gap-1.5 pt-2 sticky top-2">
              {months.map((m) => (
                <button
                  key={m.ym}
                  onClick={() => setPageIndex(m.firstIndex)}
                  aria-current={m.ym === currentMonth ? 'true' : undefined}
                  className={cn(
                    'min-w-11 min-h-11 px-1.5 rounded-xl font-extrabold text-xs uppercase tracking-wide',
                    'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender',
                    m.ym === currentMonth
                      ? 'bg-coral text-white shadow-card -rotate-2'
                      : 'bg-paper border border-line text-muted hover:border-coral hover:text-ink',
                  )}
                >
                  {m.label}
                  {showYears && <span className="block text-[9px] opacity-70">{m.year.slice(2)}</span>}
                </button>
              ))}
            </nav>
          )}
          <div className="flex-1 min-w-0">
            <JournalBook bundles={pages} index={index} onIndexChange={setPageIndex} />
          </div>
        </div>
      )}
    </div>
  )
}

function Header() {
  return (
    <header className="pt-2">
      <p className="text-sm font-bold uppercase tracking-widest text-muted">My Journal</p>
      <h1 className="text-3xl font-extrabold">My book 📖</h1>
    </header>
  )
}
