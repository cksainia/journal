import { useEffect, useMemo, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionEditor } from '@/components/SectionEditor'
import { dateKeyFor } from '@/lib/dateKey'
import {
  computeTotals,
  createSection,
  dayRef,
  sectionsRef,
  totalsEqual,
  updateDayTotals,
  type JournalDay,
  type JournalSection,
} from '@/lib/journal'
import { CHILD_NAME } from '@/lib/constants'

/**
 * Today (spec §3, §10): never a marketing page — the exact next action.
 * "Start today's entry" / "Keep writing" (one-tap resume) / "You wrote today! 🎉"
 */
export function Today() {
  const dateKey = dateKeyFor()
  const [day, setDay] = useState<JournalDay | null>(null)
  const [sections, setSections] = useState<JournalSection[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

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
  // do server-side. Write-frugal: only when the numbers actually changed.
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

  async function startWriting() {
    setStarting(true)
    try {
      const id = await createSection(dateKey, 'free')
      setEditingId(id)
    } finally {
      setStarting(false)
    }
  }

  if (editing) {
    return (
      <SectionEditor
        dateKey={dateKey}
        section={editing}
        onClose={() => setEditingId(null)}
      />
    )
  }

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
      ) : wroteToday ? (
        <Card className="text-center flex flex-col items-center gap-3 bg-teal-soft border-teal/30">
          <span className="text-5xl" aria-hidden>
            🎉
          </span>
          <p className="font-extrabold text-xl">You wrote today!</p>
          <p className="text-muted text-sm">
            {day?.dailyTotals.sentences ?? 0} sentences · {day?.dailyTotals.words ?? 0} words
          </p>
          <Button variant="soft" size="lg" onClick={startWriting} disabled={starting}>
            Write some more ✨
          </Button>
        </Card>
      ) : (
        <Card className="text-center flex flex-col items-center gap-3">
          <span className="text-5xl" aria-hidden>
            🦉
          </span>
          <p className="font-extrabold text-xl">Ready for today's story?</p>
          <Button size="lg" onClick={startWriting} disabled={starting}>
            {starting ? 'Opening…' : 'Start writing! ✨'}
          </Button>
        </Card>
      )}

      {wroteToday && draft == null && liveSections.length > 0 && (
        <p className="text-center text-xs text-muted">
          Check-in, sparks, and drawing modes arrive in Phase 2 💛
        </p>
      )}
    </div>
  )
}
