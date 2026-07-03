import { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/firebase'
import { monthGrid, monthLabel } from '@/lib/calendar'
import { dateKeyFor } from '@/lib/dateKey'
import { dayIdFor, type JournalDay, type JournalSection } from '@/lib/journal'
import { MOODS, RATINGS } from '@/components/CheckIn'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function moodEmoji(day: JournalDay): string | null {
  const first = day.checkin?.moods?.[0]
  return MOODS.find((m) => m.id === first)?.emoji ?? null
}

/**
 * My Journal (spec §10): calendar view (default) — month grid with mood-emoji
 * day markers; tap a day → detail with check-in summary and sections.
 * Carousel view + memory jar arrive in Phase 8.
 */
export function MyJournal() {
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
      <header className="pt-2">
        <p className="text-sm font-bold uppercase tracking-widest text-muted">My Journal</p>
        <h1 className="text-3xl font-extrabold">My days 📅</h1>
      </header>

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
  const live = (sections ?? []).filter((s) => s.status !== 'archived')

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
        live.map((s) => (
          <div key={s.id} className="border border-line rounded-2xl p-3">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {s.type === 'nudge' ? '💭 Nudge' : s.type === 'free' ? '🖊️ Free writing' : s.type}
            </p>
            {s.prompt && <p className="text-sm text-muted mt-1 italic">“{s.prompt}”</p>}
            <p className="mt-1 whitespace-pre-wrap">{s.plainText || <em className="text-muted">…</em>}</p>
          </div>
        ))
      )}
    </Card>
  )
}
