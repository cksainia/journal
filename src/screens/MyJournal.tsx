import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { db } from '@/lib/firebase'
import { monthGrid, monthLabel } from '@/lib/calendar'
import { dateKeyFor } from '@/lib/dateKey'
import { dayIdFor, type JournalDay, type JournalSection } from '@/lib/journal'
import { loadRange, type DayBundle } from '@/lib/analytics'
import { MOODS, RATINGS } from '@/components/CheckIn'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function moodEmoji(day: JournalDay): string | null {
  const first = day.checkin?.moods?.[0]
  return MOODS.find((m) => m.id === first)?.emoji ?? null
}

/**
 * My Journal (spec §10): BOTH views with a toggle — calendar (default, month
 * grid with mood-emoji markers → day detail) and a book-like swipe carousel
 * with memory jar and search/filter by mood, mode, and word.
 */
export function MyJournal() {
  const [view, setView] = useState<'calendar' | 'carousel'>('calendar')
  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2 flex items-end justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-muted">My Journal</p>
          <h1 className="text-3xl font-extrabold">My days 📅</h1>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Journal view">
          <Chip active={view === 'calendar'} onClick={() => setView('calendar')} aria-selected={view === 'calendar'}>
            📅
          </Chip>
          <Chip active={view === 'carousel'} onClick={() => setView('carousel')} aria-selected={view === 'carousel'}>
            📖
          </Chip>
        </div>
      </header>
      {view === 'calendar' ? <CalendarView /> : <CarouselView />}
    </div>
  )
}

function CalendarView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month0, setMonth0] = useState(today.getMonth())
  const [days, setDays] = useState<Record<string, JournalDay>>({})
  const [selected, setSelected] = useState<string | null>(null)

  const weeks = monthGrid(year, month0)
  const first = weeks[0].find(Boolean) as string
  const last = [...weeks[weeks.length - 1]].reverse().find(Boolean) as string

  useEffect(() => {
    const q = query(
      collection(db, 'journalDays'),
      where('dateKey', '>=', first),
      where('dateKey', '<=', last),
    )
    return onSnapshot(q, (snap) => {
      const map: Record<string, JournalDay> = {}
      snap.docs.forEach((d) => {
        const day = d.data() as JournalDay
        map[day.dateKey] = day
      })
      setDays(map)
    })
  }, [first, last])

  function nav(delta: number) {
    const d = new Date(year, month0 + delta, 1)
    setYear(d.getFullYear())
    setMonth0(d.getMonth())
    setSelected(null)
  }

  const todayKey = dateKeyFor()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" onClick={() => nav(-1)} aria-label="Previous month">
            ←
          </Button>
          <CardTitle>{monthLabel(year, month0)}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => nav(1)} aria-label="Next month">
            →
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <div key={i} className="text-xs font-extrabold text-muted py-1">
              {w}
            </div>
          ))}
          {weeks.flat().map((dk, i) =>
            dk === null ? (
              <div key={i} />
            ) : (
              <button
                key={i}
                onClick={() => setSelected(selected === dk ? null : dk)}
                aria-label={dk + (days[dk] ? ' — has an entry' : '')}
                className={cn(
                  'aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold',
                  'focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-lavender',
                  dk === todayKey && 'ring-2 ring-coral',
                  selected === dk
                    ? 'bg-lavender text-white'
                    : days[dk]
                      ? 'bg-teal-soft text-ink'
                      : 'text-muted hover:bg-soft',
                )}
              >
                <span>{parseInt(dk.slice(8), 10)}</span>
                {days[dk] && (
                  <span className="text-xs leading-none" aria-hidden>
                    {moodEmoji(days[dk]) ?? '✏️'}
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      </Card>

      {selected && <DayDetail dateKey={selected} day={days[selected] ?? null} />}
    </div>
  )
}

function DayDetail({ dateKey, day }: { dateKey: string; day: JournalDay | null }) {
  const [sections, setSections] = useState<JournalSection[] | null>(null)

  useEffect(() => {
    setSections(null)
    if (!day) return
    getDocs(query(collection(db, 'journalDays', dayIdFor(dateKey), 'sections'), orderBy('createdAt', 'asc')))
      .then((snap) =>
        setSections(snap.docs.map((d) => ({ ...(d.data() as JournalSection), id: d.id }))),
      )
      .catch(() => setSections([]))
  }, [dateKey, day])

  const pretty = new Date(dateKey + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  if (!day) {
    return (
      <Card className="text-center text-muted">
        <p className="font-bold">{pretty}</p>
        <p className="text-sm mt-1">No entry this day — and that's okay 💛</p>
      </Card>
    )
  }

  const rating = RATINGS.find((r) => r.id === day.checkin?.dayRating)
  // The journal shows only real, current content — archived AND empty
  // sections stay out (edit history lives in the entry's reviews, not here).
  const live = (sections ?? []).filter(
    (s) =>
      s.status !== 'archived' &&
      (s.plainText?.trim() ||
        ((s as JournalSection & { panels?: unknown[] }).panels?.length ?? 0) > 0),
  )

  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{pretty}</CardTitle>

      <div className="flex flex-wrap gap-2 text-sm">
        {day.checkin?.moods?.map((id) => {
          const m = MOODS.find((x) => x.id === id)
          return m ? (
            <span key={id} className="bg-sunny-soft rounded-full px-3 py-1 font-bold">
              {m.emoji} {m.label}
            </span>
          ) : null
        })}
        {rating && (
          <span className="bg-coral-soft rounded-full px-3 py-1 font-bold">
            {rating.emoji} {rating.label} day
          </span>
        )}
      </div>

      <p className="text-sm text-muted font-bold">
        {day.dailyTotals.sentences} sentences · {day.dailyTotals.words} words
      </p>

      {sections === null ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : live.length === 0 ? (
        <p className="text-muted text-sm">Checked in, but no writing yet.</p>
      ) : (
        live.map((s) => {
          const panels = (s as JournalSection & { panels?: { image: string; caption: string }[] }).panels ?? []
          const label =
            s.type === 'nudge' ? '💭 Nudge'
            : s.type === 'free' ? '🖊️ Free writing'
            : s.type === 'guided' ? `✨ ${s.title || 'Guided'}`
            : s.type === 'drawing' ? '🎨 Drawing'
            : s.type === 'comic' ? '🗯️ Comic'
            : s.type
          return (
            <div key={s.id} className="border border-line rounded-2xl p-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{label}</p>
              {s.prompt && <p className="text-sm text-muted mt-1 italic">“{s.prompt}”</p>}
              {panels.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {panels.map((p, i) => (
                    <img
                      key={i}
                      src={p.image}
                      alt={p.caption || `Panel ${i + 1}`}
                      className="w-1/3 max-w-40 rounded-xl border border-line"
                    />
                  ))}
                </div>
              )}
              <p className="mt-1 whitespace-pre-wrap">{s.plainText || <em className="text-muted">…</em>}</p>
            </div>
          )
        })
      )}
    </Card>
  )
}

/** Book-like carousel + memory jar + search/filter (spec §10, Phase 8). */
function CarouselView() {
  const [bundles, setBundles] = useState<DayBundle[] | null>(null)
  const [search, setSearch] = useState('')
  const [moodFilter, setMoodFilter] = useState<string | null>(null)
  const [modeFilter, setModeFilter] = useState<string | null>(null)
  const [memory, setMemory] = useState<DayBundle | null>(null)

  useEffect(() => {
    loadRange(60).then(setBundles).catch(() => setBundles([]))
  }, [])

  const withEntries = useMemo(
    () =>
      (bundles ?? [])
        .filter((b) =>
          b.sections.some(
            (s) => s.status !== 'archived' && (s.plainText?.trim() || (s.panels?.length ?? 0) > 0),
          ),
        )
        .reverse(),
    [bundles],
  )

  const filtering = !!(search.trim() || moodFilter || modeFilter)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return withEntries.filter((b) => {
      if (moodFilter && !(b.day.checkin?.moods ?? []).includes(moodFilter)) return false
      const live = b.sections.filter((s) => s.status !== 'archived')
      if (modeFilter && !live.some((s) => s.type === modeFilter)) return false
      if (q && !live.some((s) => (s.plainText + ' ' + s.prompt).toLowerCase().includes(q))) return false
      return true
    })
  }, [withEntries, search, moodFilter, modeFilter])

  function shakeMemoryJar() {
    if (!withEntries.length) return
    const pastDays = withEntries.filter((b) => b.day.dateKey !== dateKeyFor())
    const pick = pastDays[Math.floor(Math.random() * pastDays.length)] ?? withEntries[0]
    setMemory(pick)
  }

  if (!bundles) return <Card className="text-center text-muted py-8">Opening your book… 📖</Card>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your words…"
          aria-label="Search journal entries"
          className="flex-1 min-w-40 min-h-11 px-4 rounded-full border-2 border-line bg-paper focus:border-teal focus:outline-none text-sm font-bold"
        />
        <Chip onClick={shakeMemoryJar}>🫙 Memory jar</Chip>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => (
          <Chip key={m.id} active={moodFilter === m.id} onClick={() => setMoodFilter(moodFilter === m.id ? null : m.id)} className="min-h-9 px-3 text-xs">
            {m.emoji}
          </Chip>
        ))}
        {(['guided', 'free', 'nudge', 'drawing', 'comic'] as const).map((t) => (
          <Chip key={t} active={modeFilter === t} onClick={() => setModeFilter(modeFilter === t ? null : t)} className="min-h-9 px-3 text-xs">
            {{ guided: '✨', free: '🖊️', nudge: '💭', drawing: '🎨', comic: '🗯️' }[t]} {t}
          </Chip>
        ))}
      </div>

      {memory && (
        <Card className="bg-sunny-soft border-sunny/50">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">🫙 From your memory jar</p>
          <DayCard bundle={memory} plain />
          <Button variant="ghost" size="sm" onClick={() => setMemory(null)}>Put it back</Button>
        </Card>
      )}

      {withEntries.length === 0 ? (
        <Card className="text-center text-muted py-8">Your book is waiting for its first page 💛</Card>
      ) : filtering ? (
        <div className="flex flex-col gap-3" aria-label="Search results">
          {filtered.length === 0 ? (
            <Card className="text-center text-muted py-6">Nothing matched — try different words?</Card>
          ) : (
            filtered.map((b) => (
              <Card key={b.day.dateKey}>
                <DayCard bundle={b} />
              </Card>
            ))
          )}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4" aria-label="Journal pages, swipe to browse">
          {withEntries.map((b) => (
            <Card key={b.day.dateKey} className="min-w-[85%] sm:min-w-[70%] snap-center">
              <DayCard bundle={b} />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function DayCard({ bundle, plain = false }: { bundle: DayBundle; plain?: boolean }) {
  const { day, sections } = bundle
  const live = sections.filter(
    (s) => s.status !== 'archived' && (s.plainText?.trim() || (s.panels?.length ?? 0) > 0),
  )
  const pretty = new Date(day.dateKey + 'T12:00:00').toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  })
  return (
    <div className={plain ? '' : 'flex flex-col gap-2'}>
      <div className="flex items-center justify-between">
        <p className="font-extrabold">{pretty}</p>
        <span aria-hidden>{moodEmoji(day) ?? ''}</span>
      </div>
      {live.map((s) => (
        <div key={s.id} className="mt-1">
          {s.prompt && <p className="text-xs text-muted italic">"{s.prompt}"</p>}
          {(s.panels ?? []).length > 0 && (
            <div className="flex gap-2 my-1">
              {s.panels!.map((p, i) => (
                <img key={i} src={p.image} alt={p.caption || `Panel ${i + 1}`} className="w-1/3 max-w-32 rounded-lg border border-line" />
              ))}
            </div>
          )}
          {s.plainText && <p className="text-sm mt-0.5 line-clamp-4 whitespace-pre-wrap">{s.plainText}</p>}
        </div>
      ))}
      <p className="text-xs text-muted font-bold mt-1">
        {day.dailyTotals.sentences} sentences · {day.dailyTotals.words} words
      </p>
    </div>
  )
}
