import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionEditor } from '@/components/SectionEditor'
import { CheckIn, MOODS, LOCATIONS, ACTIVITIES, RATINGS } from '@/components/CheckIn'
import { SparkChooser } from '@/components/SparkChooser'
import { GuidedSetup } from '@/components/GuidedSetup'
import { DrawingEditor } from '@/components/DrawingEditor'
import { PhotoEditor } from '@/components/PhotoEditor'
import { Art } from '@/components/illustrations'
import { LOVE_NOTE_STYLES } from '@/components/JournalBook'
import { dateKeyFor } from '@/lib/dateKey'
import {
  computeTotals,
  createSection,
  dayRef,
  saveCheckin,
  sectionsRef,
  totalsEqual,
  updateDayTotals,
  type Checkin,
  type JournalDay,
  type JournalSection,
  type SectionType,
} from '@/lib/journal'
import { CHILD_NAME } from '@/lib/constants'

/**
 * Today (spec §3, §4): the session arc entry point, always showing the exact
 * next action — Start today's check-in → Choose a spark → Keep writing →
 * You wrote today! An unfinished draft resumes in one tap.
 */
export function Today() {
  const dateKey = dateKeyFor()
  const [day, setDay] = useState<JournalDay | null>(null)
  const [sections, setSections] = useState<JournalSection[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [guidedSetup, setGuidedSetup] = useState<false | { bookMode: boolean }>(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const stopDay = onSnapshot(dayRef(dateKey), (snap) => {
      setDay(snap.exists() ? (snap.data() as JournalDay) : null)
      setLoaded(true)
    })
    const stopSections = onSnapshot(
      query(sectionsRef(dateKey), orderBy('createdAt', 'asc')),
      (snap) => setSections(snap.docs.map((d) => ({ ...(d.data() as JournalSection), id: d.id }))),
    )
    return () => {
      stopDay()
      stopSections()
    }
  }, [dateKey])

  // Deterministic totals recompute — mirrors what the Phase 3 sync adapter will
  // do. Write-frugal: only when the numbers actually changed.
  useEffect(() => {
    if (!day || sections.length === 0) return
    const totals = computeTotals(sections)
    if (!totalsEqual(totals, day.dailyTotals)) {
      updateDayTotals(dateKey, totals).catch((e) => console.warn('totals update failed:', e.message))
    }
  }, [day, sections, dateKey])

  const liveSections = useMemo(() => sections.filter((s) => s.status !== 'archived'), [sections])
  const draft = liveSections.find((s) => s.status === 'draft')
  const wroteToday = liveSections.some((s) => s.status === 'saved')
  const editing = editingId ? sections.find((s) => s.id === editingId) : undefined

  async function onCheckinDone(checkin: Checkin) {
    const wasEditing = !!day?.checkin
    setBusy(true)
    try {
      await saveCheckin(dateKey, checkin)
      setCheckingIn(false)
      if (!wasEditing) setChoosing(true) // first check-in flows into writing; edits return home
    } catch (e) {
      console.warn('check-in save failed:', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function onPickSpark(
    type: SectionType,
    opts?: { title?: string; prompt?: string; bookMode?: boolean },
  ) {
    if (type === 'guided') {
      setChoosing(false)
      setGuidedSetup({ bookMode: !!opts?.bookMode })
      return
    }
    // ONE nudge per day: picking it again resumes the existing entry — no
    // pile of near-duplicate sections, one refined entry instead.
    if (type === 'nudge') {
      const existing = liveSections.find((s) => s.type === 'nudge')
      if (existing) {
        setChoosing(false)
        setEditingId(existing.id)
        return
      }
    }
    setBusy(true)
    try {
      const id = await createSection(dateKey, type, opts)
      setChoosing(false)
      setEditingId(id)
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    if (editing.type === 'photo') {
      return <PhotoEditor dateKey={dateKey} section={editing} onClose={() => setEditingId(null)} />
    }
    return editing.type === 'drawing' || editing.type === 'comic' ? (
      <DrawingEditor dateKey={dateKey} section={editing} onClose={() => setEditingId(null)} />
    ) : (
      <SectionEditor dateKey={dateKey} section={editing} onClose={() => setEditingId(null)} />
    )
  }

  if (checkingIn) {
    return <CheckIn dateKey={dateKey} initial={day?.checkin ?? null} onDone={onCheckinDone} />
  }

  if (guidedSetup) {
    return (
      <GuidedSetup
        dateKey={dateKey}
        checkin={day?.checkin ?? null}
        bookMode={guidedSetup.bookMode}
        onReady={(id) => {
          setGuidedSetup(false)
          setEditingId(id)
        }}
        onBack={() => {
          setGuidedSetup(false)
          setChoosing(true)
        }}
      />
    )
  }

  if (choosing) {
    return <SparkChooser dateKey={dateKey} onPick={onPickSpark} />
  }

  const needsCheckin = !day?.checkin

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <p className="text-sm font-bold uppercase tracking-widest text-muted">Today</p>
        <h1 className="text-3xl font-extrabold">Hi, {CHILD_NAME}! 🌞</h1>
      </header>

      {!loaded ? (
        <Card className="text-center text-muted">Loading…</Card>
      ) : draft ? (
        <Card className="text-center flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden>
            ✏️
          </span>
          <p className="font-extrabold text-xl">You have a story waiting!</p>
          <Button size="lg" onClick={() => setEditingId(draft.id)}>
            Keep writing
          </Button>
        </Card>
      ) : needsCheckin ? (
        <Card className="text-center flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden>
            🦉
          </span>
          <p className="font-extrabold text-xl">Ready for today?</p>
          <p className="text-muted text-sm">First, a quick check-in — all taps, no typing!</p>
          <Button size="lg" onClick={() => setCheckingIn(true)} disabled={busy}>
            Start today's check-in ☀️
          </Button>
        </Card>
      ) : wroteToday ? (
        <Card className="text-center flex flex-col items-center gap-3 bg-teal-soft border-teal/30">
          <span className="text-5xl" aria-hidden>
            🎉
          </span>
          <p className="font-extrabold text-xl">You wrote today!</p>
          <p className="text-muted text-sm">
            {day?.dailyTotals.sentences ?? 0} {(day?.dailyTotals.sentences ?? 0) === 1 ? 'sentence' : 'sentences'} ·{' '}
            {day?.dailyTotals.words ?? 0} {(day?.dailyTotals.words ?? 0) === 1 ? 'word' : 'words'}
          </p>
          <Button variant="soft" size="lg" onClick={() => setChoosing(true)} disabled={busy}>
            Write some more ✨
          </Button>
        </Card>
      ) : (
        <Card className="text-center flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden>
            ⚡
          </span>
          <p className="font-extrabold text-xl">Check-in done — time to write!</p>
          <Button size="lg" onClick={() => setChoosing(true)} disabled={busy}>
            Choose your spark ✨
          </Button>
        </Card>
      )}

      {/* a note from Mom or Dad — the day's little surprise */}
      {loaded &&
        (day?.loveNotes ?? []).map((n, i) => {
          const s = LOVE_NOTE_STYLES[n.from] ?? LOVE_NOTE_STYLES.dad
          return (
            <Card key={`love-${i}`} className="p-4" style={{ background: s.bg, borderColor: s.border }}>
              <p className="text-xs font-extrabold uppercase tracking-widest text-ink/60">
                💌 {n.from === 'dad' ? 'Dad' : 'Mom'} says…
              </p>
              <p className={`${s.font} ${s.size} leading-snug mt-1`} style={{ color: s.ink }}>
                {n.text}
              </p>
            </Card>
          )
        })}

      {/* Her check-in answers — always visible, always editable */}
      {loaded && day?.checkin && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted">
              🌞 My day
            </p>
            <Button variant="ghost" size="sm" onClick={() => setCheckingIn(true)}>
              ✏️ Change my answers
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
            {day.checkin.moods.map((id) => (
              <span key={id} className="flex items-center gap-1 font-bold text-sm">
                <Art set="feeling" id={id} size={28} />
                {MOODS.find((m) => m.id === id)?.label}
              </span>
            ))}
            {day.checkin.location && (
              <span className="bg-teal-soft rounded-full px-3 py-1 font-bold text-sm">
                {LOCATIONS.find((l) => l.id === day.checkin!.location)?.emoji}{' '}
                {LOCATIONS.find((l) => l.id === day.checkin!.location)?.label}
              </span>
            )}
            {day.checkin.activities.map((id) => {
              const a = ACTIVITIES.find((x) => x.id === id)
              return a ? (
                <span key={id} className="bg-soft rounded-full px-3 py-1 font-bold text-sm">
                  {a.emoji} {a.label}
                  {id === 'something-else' && day.checkin!.somethingElse
                    ? `: ${day.checkin!.somethingElse}`
                    : ''}
                </span>
              ) : null
            })}
            {day.checkin.dayRating && (
              <span className="bg-sunny-soft rounded-full px-3 py-1 font-bold text-sm">
                {RATINGS.find((r) => r.id === day.checkin!.dayRating)?.emoji}{' '}
                {RATINGS.find((r) => r.id === day.checkin!.dayRating)?.label} day
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Today's entries — tap any to reopen and keep refining it */}
      {liveSections.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted px-1">
            Today's entries
          </p>
          {liveSections.map((s) => {
            const snippet = s.plainText?.trim()
              ? s.plainText.trim().slice(0, 80) + (s.plainText.trim().length > 80 ? '…' : '')
              : '(nothing written yet)'
            return (
              <Card
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditingId(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setEditingId(s.id)
                  }
                }}
                className="p-3 cursor-pointer hover:border-teal transition-colors
                           focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender"
              >
                <div className="flex items-center gap-3">
                  <Art set="entry" id={s.type} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm">
                      {s.title || (s.type === 'free' ? 'Free writing' : s.type)}
                      {s.status === 'draft' && <span className="text-muted font-bold"> · draft</span>}
                    </p>
                    <p className="text-muted text-sm truncate">{snippet}</p>
                  </div>
                  <span className="text-muted" aria-hidden>›</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
