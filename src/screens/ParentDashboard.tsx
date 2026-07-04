import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { SyncStatusCard } from '@/components/SyncStatusCard'
import { ImportPaperJournal } from '@/components/ImportPaperJournal'
import { db } from '@/lib/firebase'
import { FAMILY_ID, CHILD_UID, CHILD_NAME } from '@/lib/constants'
import { dateKeyFor } from '@/lib/dateKey'
import {
  errorRates,
  loadRange,
  modeStats,
  moodPatterns,
  revisionRate,
  rubricTrend,
  sparkleAdoption,
  standardsCoverage,
  wpmTrend,
  MIN_SAMPLE_WORDS,
  type DayBundle,
} from '@/lib/analytics'
import { saveParentNote, watchMeta, metaRef, type JournalMeta } from '@/lib/meta'
import { addLoveNote, dayRef, removeLoveNote, type JournalDay, type LoveNote } from '@/lib/journal'
import { useDictation } from '@/lib/dictation'
import { getClaudeService } from '@/services/claude'
import type { WeeklyInsights } from '@/services/claude/types'
import { useSession } from '@/stores/session'
import { useSettings, hashPin, type JournalSettings } from '@/stores/settings'
import { MOODS } from '@/components/CheckIn'

const STANDARD_NAMES: Record<string, string> = {
  'W.AW.3.1': 'Opinion Helper',
  'W.IW.3.2': 'Fact Teacher',
  'W.NW.3.3': 'Story Builder',
  'W.WP.3.4': 'Revision Star',
  'W.RW.3.7': 'Every-Day Writer',
  'L.WF.3.2': 'Spelling Detective',
  'L.WF.3.3': 'Grammar Wizard',
}

function weekStartKey(d = new Date()): string {
  const s = new Date(d)
  s.setDate(s.getDate() - s.getDay()) // Sunday start
  return dateKeyFor(s)
}

/** Parent Dashboard (spec §6.2): PIN gate (UX only — rules are the boundary),
 *  then summary → trends → recommendations → raw data / settings. */
export function ParentDashboard() {
  const { role, signOut, user } = useSession()
  const { settings } = useSettings()
  const [pinOk, setPinOk] = useState(false)

  if (role !== 'parent') {
    return (
      <Card className="text-center">
        <span className="text-5xl" aria-hidden>💛</span>
        <CardTitle className="mt-2">For grown-ups</CardTitle>
        <p className="text-muted text-sm mt-1">This page is for your parents — go write something!</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => void signOut()}>
          Switch user
        </Button>
      </Card>
    )
  }

  if (settings.pinHash && !pinOk) return <PinGate onOk={() => setPinOk(true)} />

  return <Dashboard email={user?.email ?? ''} onSignOut={() => void signOut()} />
}

function PinGate({ onOk }: { onOk: () => void }) {
  const { settings } = useSettings()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)
  async function check() {
    if ((await hashPin(pin)) === settings.pinHash) onOk()
    else {
      setErr(true)
      setPin('')
    }
  }
  return (
    <Card className="text-center max-w-xs mx-auto">
      <CardTitle>Parent PIN</CardTitle>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void check()}
        aria-label="Parent PIN"
        className="mt-3 w-full min-h-12 px-4 rounded-2xl border-2 border-line text-center text-2xl tracking-widest focus:border-teal focus:outline-none"
      />
      {err && <p className="text-coral text-sm font-bold mt-2">Not quite — try again.</p>}
      <Button className="mt-3" onClick={() => void check()}>Unlock</Button>
    </Card>
  )
}

function Dashboard({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [range, setRange] = useState(30)
  const [bundles, setBundles] = useState<DayBundle[] | null>(null)
  const [meta, setMeta] = useState<JournalMeta>({})
  const [insights, setInsights] = useState<WeeklyInsights | null>(null)
  const [generating, setGenerating] = useState(false)

  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    setBundles(null) // range change → fresh load with spinner
    loadRange(range).then(setBundles).catch(() => setBundles([]))
  }, [range])
  useEffect(() => {
    if (reloadKey === 0) return
    // QUIET refresh after entry management: keep current data (and the
    // manager's open state / scroll position) while new data loads.
    loadRange(range).then(setBundles).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])
  useEffect(() => watchMeta(setMeta), [])

  const weekStart = weekStartKey()
  const insightsId = `${FAMILY_ID}_${CHILD_UID}_${weekStart}`

  useEffect(() => {
    getDoc(doc(db, 'weeklyInsights', insightsId))
      .then((s) => s.exists() && setInsights(s.data() as WeeklyInsights))
      .catch(() => {})
  }, [insightsId])

  const m = useMemo(() => {
    if (!bundles) return null
    return {
      errors: errorRates(bundles),
      rubric: rubricTrend(bundles),
      wpm: wpmTrend(bundles),
      modes: modeStats(bundles),
      moods: moodPatterns(bundles),
      revision: revisionRate(bundles),
      sparkle: sparkleAdoption(bundles),
      standards: standardsCoverage(bundles),
      volume: bundles.map((b) => ({
        dateKey: b.day.dateKey.slice(5),
        words: b.day.dailyTotals.words,
        sentences: b.day.dailyTotals.sentences,
      })),
      reviewedEntries: bundles.reduce((n, b) => n + b.reviews.filter((r) => r.reviewType === 'initial').length, 0),
      entries: bundles.reduce((n, b) => n + b.day.dailyTotals.sections, 0),
      totalWords: bundles.reduce((n, b) => n + b.day.dailyTotals.words, 0),
      safety: bundles.flatMap((b) =>
        b.reviews.filter((r) => (r.safetyFlags?.length ?? 0) > 0).map((r) => ({ dateKey: b.day.dateKey, flags: r.safetyFlags })),
      ),
    }
  }, [bundles])

  async function generateInsights() {
    if (!bundles) return
    setGenerating(true)
    try {
      const weekBundles = bundles.filter((b) => b.day.dateKey >= weekStart)
      const reviews = weekBundles.flatMap((b) => b.reviews)
      const excerpts = weekBundles
        .flatMap((b) => b.sections.filter((s) => s.status !== 'archived').map((s) => s.plainText))
        .filter(Boolean)
        .slice(0, 6)
      const result = await getClaudeService().generateWeeklyInsights({ weekStart, reviews, excerpts })
      await setDoc(doc(db, 'weeklyInsights', insightsId), { ...result, generatedAt: serverTimestamp() })
      // the child's voice card is the ONLY slice she ever sees — via journalMeta
      await setDoc(metaRef(), { kidVoiceCard: result.kidVoiceCard }, { merge: true })
      setInsights(result)
    } catch (e) {
      console.warn('insights generation failed:', (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  if (!bundles || !m) return <Card className="text-center text-muted py-10">Crunching the numbers…</Card>

  const confidence =
    m.reviewedEntries === 0
      ? 'No reviewed entries in this range yet — volume stats only.'
      : m.reviewedEntries < 4
        ? `Tentative — only ${m.reviewedEntries} reviewed entr${m.reviewedEntries === 1 ? 'y' : 'ies'} in range.`
        : `Based on ${m.reviewedEntries} reviewed entries.`

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2 flex items-end justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-muted">Parent Dashboard</p>
          <h1 className="text-2xl font-extrabold">{CHILD_NAME}'s writing</h1>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((r) => (
            <Chip key={r} active={range === r} onClick={() => setRange(r)}>
              {r}d
            </Chip>
          ))}
        </div>
      </header>

      {/* 1 — plain-language weekly summary */}
      <Card>
        <CardTitle className="text-base">This period at a glance</CardTitle>
        <p className="mt-2">
          {m.entries} entries · {m.totalWords.toLocaleString()} words · {m.reviewedEntries} reviewed
          {m.revision.rate !== null && <> · acted on {Math.round(m.revision.rate * 100)}% of suggestions</>}
        </p>
        <p className="text-muted text-sm mt-1">{confidence}</p>
        {insights?.strengths?.[0] && (
          <p className="text-sm mt-2">
            <span className="font-bold text-teal">Strength:</span> {insights.strengths[0]}
          </p>
        )}
        {insights?.growthAreas?.[0] && (
          <p className="text-sm mt-1">
            <span className="font-bold text-lavender">Growth focus:</span> {insights.growthAreas[0].pattern}
          </p>
        )}
      </Card>

      {m.safety.length > 0 && (
        <Card className="border-coral/40 bg-coral-soft">
          <CardTitle className="text-base">A gentle heads-up 💛</CardTitle>
          {m.safety.map((s, i) => (
            <p key={i} className="text-sm mt-1">
              <span className="font-bold">{s.dateKey}:</span> {s.flags.join(' · ')}
            </p>
          ))}
          <p className="text-muted text-xs mt-2">
            The journal never alarms {CHILD_NAME} — consider checking in personally.
          </p>
        </Card>
      )}

      {/* 2 — trends */}
      <ChartCard title="Words & sentences by day">
        <LineChart data={m.volume}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D3" />
          <XAxis dataKey="dateKey" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="words" stroke="#12A594" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sentences" stroke="#F4634A" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartCard>

      {m.errors.length > 0 && (
        <ChartCard
          title="Errors per 100 words"
          note={`Days under ${MIN_SAMPLE_WORDS} reviewed words are suppressed — small samples mislead.`}
        >
          <LineChart data={m.errors.map((e) => ({ ...e, dateKey: e.dateKey.slice(5) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D3" />
            <XAxis dataKey="dateKey" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="spellingPer100" name="spelling" stroke="#8F7BE8" strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="grammarPer100" name="grammar" stroke="#FFC53D" strokeWidth={2} connectNulls />
          </LineChart>
        </ChartCard>
      )}

      {m.rubric.length > 0 && (
        <ChartCard
          title="Coach rubric & NJSLA estimates"
          note="Coach estimates from reviews — trends matter, single points don't. Not formal grades. Never shown to her."
        >
          <LineChart data={m.rubric.map((r) => ({ ...r, dateKey: r.dateKey.slice(5) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D3" />
            <XAxis dataKey="dateKey" fontSize={11} />
            <YAxis domain={[0, 4]} fontSize={11} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="ideas" stroke="#12A594" dot={false} />
            <Line type="monotone" dataKey="conventions" stroke="#F4634A" dot={false} />
            <Line type="monotone" dataKey="njslaExpression" name="NJSLA expression (est.)" stroke="#8F7BE8" strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="njslaConventions" name="NJSLA conventions (est.)" stroke="#FFC53D" strokeWidth={2} connectNulls />
          </LineChart>
        </ChartCard>
      )}

      {m.wpm.length > 1 && (
        <ChartCard title="Typing fluency (Active WPM)" note="Counts only time while keys are moving — thinking pauses excluded. Never shown to her.">
          <LineChart data={m.wpm.map((w) => ({ ...w, dateKey: w.dateKey.slice(5) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D3" />
            <XAxis dataKey="dateKey" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="wpm" stroke="#12A594" strokeWidth={2} />
          </LineChart>
        </ChartCard>
      )}

      <ChartCard title="Mode mix & prompt effectiveness" note="Average words per entry by mode — which sparks lead to longer writing.">
        <BarChart data={m.modes}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EFE4D3" />
          <XAxis dataKey="mode" fontSize={10} />
          <YAxis fontSize={11} />
          <Tooltip />
          <Legend />
          <Bar dataKey="entries" fill="#F4634A" radius={[6, 6, 0, 0]} />
          <Bar dataKey="avgWords" fill="#12A594" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartCard>

      <Card>
        <CardTitle className="text-base">Sparkle words & revision</CardTitle>
        <p className="text-sm mt-2">
          ✨ Sparkle words used: <b>{m.sparkle.used}</b> of {m.sparkle.offered} offered
          {m.sparkle.offered > 0 && <> ({Math.round((m.sparkle.used / m.sparkle.offered) * 100)}%)</>}
        </p>
        <p className="text-sm mt-1">
          🛠️ Revision rate: {m.revision.rate === null ? 'no corrections offered yet' : <b>{Math.round(m.revision.rate * 100)}% of {m.revision.offered} suggestions acted on</b>}
        </p>
        {(meta.wordShelf?.length ?? 0) > 0 && (
          <p className="text-sm mt-1">⭐ Word shelf: {meta.wordShelf!.join(', ')}</p>
        )}
      </Card>

      {m.moods.length > 0 && (
        <Card>
          <CardTitle className="text-base">Patterns to explore</CardTitle>
          <p className="text-muted text-xs mt-1">Correlation is not a diagnosis or evaluation — just places to be curious.</p>
          {m.moods.map((p) => (
            <p key={p.label} className="text-sm mt-1">
              {MOODS.find((x) => x.id === p.label)?.emoji ?? '·'} {p.label}: {p.days} days, avg {p.avgWords} words
            </p>
          ))}
        </Card>
      )}

      {Object.keys(m.standards).length > 0 && (
        <Card>
          <CardTitle className="text-base">Standards coverage</CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(m.standards).map(([tag, n]) => (
              <span key={tag} className="bg-lavender-soft rounded-full px-3 py-1 text-sm font-bold">
                {STANDARD_NAMES[tag] ?? tag} <span className="text-muted">({tag})</span> ×{n}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* 3 — recommendations */}
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Weekly insights & practice queue</CardTitle>
          <Button size="sm" variant="secondary" onClick={generateInsights} disabled={generating}>
            {generating ? 'Thinking…' : insights ? 'Regenerate' : 'Generate for this week'}
          </Button>
        </div>
        {!insights ? (
          <p className="text-muted text-sm mt-2">Generate a weekly analysis of strengths, growth areas, and practice ideas.</p>
        ) : (
          <div className="mt-2 flex flex-col gap-2 text-sm">
            <p className="text-muted text-xs">
              Based on {insights.sampleCounts.reviewedEntries} reviewed entr{insights.sampleCounts.reviewedEntries === 1 ? 'y' : 'ies'} this week
              {insights.sampleCounts.reviewedEntries < 3 && ' — treat as tentative'}.
            </p>
            <div>
              <p className="font-bold text-teal">Strengths</p>
              {insights.strengths.map((s, i) => <p key={i}>• {s}</p>)}
            </div>
            <div>
              <p className="font-bold text-lavender">Growth areas</p>
              {insights.growthAreas.map((g, i) => (
                <p key={i}>• {g.pattern} <span className="text-muted">→ {g.recommendation}</span></p>
              ))}
            </div>
            {insights.voice.evidenceQuotes.length > 0 && (
              <p className="text-muted italic">“{insights.voice.evidenceQuotes[0]}”</p>
            )}
            <div>
              <p className="font-bold">This week's practice queue</p>
              {insights.recommendedPractice.map((p, i) => <p key={i}>☐ {p}</p>)}
            </div>
          </div>
        )}
      </Card>

      <ParentNotes meta={meta} weekStart={weekStart} />

      <LoveNoteCard />

      {/* 4 — raw data / settings */}
      <EntriesManager bundles={bundles} onChanged={() => setReloadKey((k) => k + 1)} />
      <ImportPaperJournal onImported={() => setReloadKey((k) => k + 1)} />
      <ExportsCard bundles={bundles} />
      <SyncStatusCard />
      <SettingsCard />
      <Card>
        <CardTitle className="text-base">Session</CardTitle>
        <p className="text-muted text-sm mt-1">{email}</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={onSignOut}>Sign out</Button>
      </Card>
    </div>
  )
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardTitle className="text-base mb-2">{title}</CardTitle>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
      {note && <p className="text-muted text-xs mt-2">{note}</p>}
    </Card>
  )
}

function ParentNotes({ meta, weekStart }: { meta: JournalMeta; weekStart: string }) {
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => setNote(meta.parentNotes?.[weekStart] ?? ''), [meta.parentNotes, weekStart])
  return (
    <Card>
      <CardTitle className="text-base">Parent notes (private, this week)</CardTitle>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false) }}
        rows={3}
        className="mt-2 w-full rounded-2xl border-2 border-line p-3 text-sm focus:border-teal focus:outline-none"
        placeholder="Observations, things to try, moments to remember…"
      />
      <Button size="sm" variant="secondary" className="mt-2" onClick={async () => { await saveParentNote(weekStart, note); setSaved(true) }}>
        {saved ? 'Saved ✓' : 'Save note'}
      </Button>
    </Card>
  )
}

/** A note in HER journal (visible to Aria, unlike the private notes above):
 *  "Dad says…" / "Mom says…" appreciation taped onto the day's page. Not an
 *  entry — it lives on the day doc and never touches her writing stats. */
function LoveNoteCard() {
  const [date, setDate] = useState(dateKeyFor())
  const [from, setFrom] = useState<'dad' | 'mom'>(
    (localStorage.getItem('love-note-from') as 'dad' | 'mom') || 'dad',
  )
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<LoveNote[]>([])
  const [busy, setBusy] = useState(false)
  const { supported, listening, start, stop } = useDictation((phrase) =>
    setText((t) => (t ? t.replace(/\s+$/, '') + ' ' : '') + phrase),
  )

  useEffect(() => {
    let stale = false
    getDoc(dayRef(date)).then((snap) => {
      if (!stale) setNotes(((snap.data() as JournalDay | undefined)?.loveNotes ?? []) as LoveNote[])
    })
    return () => {
      stale = true
    }
  }, [date, busy])

  async function send() {
    const clean = text.trim()
    if (!clean) return
    setBusy(true)
    try {
      if (listening) stop()
      await addLoveNote(date, { from, text: clean, at: Date.now() })
      setText('')
    } catch (e) {
      console.warn('love note failed:', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardTitle className="text-base">A note in her journal 💌</CardTitle>
      <p className="text-muted text-xs mt-1">
        Aria sees this on that day's journal page — a little "Dad says" / "Mom says" she can
        reread anytime. It never counts toward her writing stats.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Which day the note goes on"
          className="min-h-10 px-2 rounded-xl border-2 border-line font-bold"
        />
        {(['dad', 'mom'] as const).map((who) => (
          <Chip
            key={who}
            active={from === who}
            onClick={() => {
              setFrom(who)
              localStorage.setItem('love-note-from', who)
            }}
          >
            {who === 'dad' ? '👨 Dad says…' : '👩 Mom says…'}
          </Chip>
        ))}
      </div>
      <div className="mt-2 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="I loved how you helped your brother today…"
          aria-label="Note for her journal"
          className="w-full rounded-2xl border-2 border-line p-3 pr-14 text-sm focus:border-teal focus:outline-none"
        />
        {supported && (
          <button
            onClick={listening ? stop : start}
            aria-label={listening ? 'Stop dictation' : 'Dictate the note'}
            aria-pressed={listening}
            className={`absolute right-2 top-2 size-10 rounded-full text-lg border-2
                        focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender
                        ${listening ? 'bg-coral text-white border-coral animate-pulse' : 'bg-soft border-line'}`}
          >
            {listening ? '⏹' : '🎤'}
          </button>
        )}
      </div>
      {listening && <p className="text-coral text-xs font-bold">Listening… speak your note, then tap ⏹.</p>}
      <Button size="sm" className="mt-2" disabled={busy || !text.trim()} onClick={() => void send()}>
        {busy ? 'Sending…' : 'Put it on her page 💌'}
      </Button>

      {notes.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-xs font-bold text-muted">On {date}:</p>
          {notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 bg-sunny-soft rounded-xl p-2 text-sm">
              <span className="flex-1">
                <b>{n.from === 'dad' ? '👨 Dad' : '👩 Mom'} says:</b> {n.text}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-coral"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await removeLoveNote(date, n)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function SettingsCard() {
  const { settings, save } = useSettings()
  const [pin, setPin] = useState('')
  const set = (patch: Partial<JournalSettings>) => void save(patch)

  return (
    <Card>
      <CardTitle className="text-base">Settings</CardTitle>
      <div className="mt-3 flex flex-col gap-3 text-sm">
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold">Daily sentence target</span>
          <input
            type="number" min={1} max={50} value={settings.sentenceGoal}
            onChange={(e) => set({ sentenceGoal: +e.target.value || 1 })}
            className="w-20 min-h-10 px-2 rounded-xl border-2 border-line text-center font-bold"
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold">Writing checks per day</span>
          <input
            type="number" min={1} max={50} value={settings.reviewsPerDay}
            onChange={(e) => set({ reviewsPerDay: +e.target.value || 1 })}
            className="w-20 min-h-10 px-2 rounded-xl border-2 border-line text-center font-bold"
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold">No streak pressure <span className="text-muted font-normal">(hides streaks & targets)</span></span>
          <input type="checkbox" checked={settings.noStreakPressure} onChange={(e) => set({ noStreakPressure: e.target.checked })} className="size-5 accent-teal" />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold">Streak freeze (grace days)</span>
          <input
            type="number" min={0} max={7} value={settings.streakFreezeDays}
            onChange={(e) => set({ streakFreezeDays: Math.max(0, +e.target.value || 0) })}
            className="w-20 min-h-10 px-2 rounded-xl border-2 border-line text-center font-bold"
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold">AI safety scanning
            <span className="block text-muted font-normal">
              On: reviews may add a private parent note if writing suggests she needs help. Off: the journal is
              strictly private except your own reading — no automated flags.
            </span>
          </span>
          <input type="checkbox" checked={settings.safetyScanning} onChange={(e) => set({ safetyScanning: e.target.checked })} className="size-5 accent-teal" />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span className="font-bold">AI mode</span>
          <select
            value={settings.aiMode}
            onChange={(e) => set({ aiMode: e.target.value as 'mock' | 'live' })}
            className="min-h-10 px-2 rounded-xl border-2 border-line font-bold"
          >
            <option value="mock">Mock (no API calls)</option>
            <option value="live">Live (Claude via Worker)</option>
          </select>
        </label>
        {settings.aiMode === 'live' && (
          <label className="flex flex-col gap-1">
            <span className="font-bold">Claude Worker URL <span className="text-muted font-normal">(see workers/claude-proxy.js)</span></span>
            <input
              type="url" value={settings.workerUrl} placeholder="https://journal-claude.….workers.dev"
              onChange={(e) => set({ workerUrl: e.target.value.trim() })}
              className="min-h-10 px-3 rounded-xl border-2 border-line"
            />
          </label>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">Parent PIN <span className="text-muted font-normal">(screen gate only)</span></span>
          <div className="flex gap-2">
            <input
              type="password" inputMode="numeric" value={pin} placeholder={settings.pinHash ? '••••' : 'set PIN'}
              onChange={(e) => setPin(e.target.value)}
              className="w-24 min-h-10 px-2 rounded-xl border-2 border-line text-center"
              aria-label="New parent PIN"
            />
            <Button size="sm" variant="secondary" disabled={pin.length < 4}
              onClick={async () => { await save({ pinHash: await hashPin(pin) }); setPin('') }}>
              Set
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ExportsCard({ bundles }: { bundles: DayBundle[] }) {
  const [includeArchived, setIncludeArchived] = useState(false)
  return (
    <Card>
      <CardTitle className="text-base">Exports & keepsake</CardTitle>
      <p className="text-muted text-xs mt-1">
        Exports cover the selected date range. Archived entries are excluded unless you opt in.
      </p>
      <label className="flex items-center gap-2 mt-2 text-sm font-bold">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => setIncludeArchived(e.target.checked)}
          className="size-4 accent-teal"
        />
        Include archived entries
      </label>
      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="secondary" onClick={() => void import('@/lib/exports').then((m) => m.exportCsv(bundles))}>
          📊 CSV stats
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void import('@/lib/exports').then((m) => m.exportJson(bundles, includeArchived))}>
          💾 JSON backup
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void import('@/lib/exports').then((m) => m.openKeepsake(bundles, includeArchived))}>
          📖 Printable keepsake
        </Button>
      </div>
    </Card>
  )
}

/** Entry management (spec §11): the child can only archive — here the parent
 *  archives, restores, or deletes forever, one at a time or as a multi-select
 *  batch. Every change recomputes totals + tracker sync (once per day) and
 *  the view stays right where you were. */
function EntriesManager({ bundles, onChanged }: { bundles: DayBundle[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [moveDate, setMoveDate] = useState('')

  const daysWithSections = [...bundles].reverse().filter((b) => b.sections.length > 0)
  const allKeys = daysWithSections.flatMap((b) => b.sections.map((s) => `${b.day.dateKey}|${s.id}`))
  const key = (dateKey: string, id: string) => `${dateKey}|${id}`

  function toggle(k: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  async function act(items: { dateKey: string; sectionId: string }[], action: 'archive' | 'restore' | 'delete') {
    if (!items.length) return
    if (
      action === 'delete' &&
      !window.confirm(
        items.length === 1
          ? 'Delete this entry forever? This cannot be undone.'
          : `Delete ${items.length} entries forever? This cannot be undone.`,
      )
    )
      return
    setBusy(true)
    try {
      const { applySectionActions } = await import('@/lib/journal')
      await applySectionActions(items, action)
      setSelected(new Set())
      onChanged() // quiet background refresh — the manager stays open, right here
    } catch (e) {
      console.warn('entry action failed:', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const selectedItems = [...selected].map((k) => {
    const [dateKey, sectionId] = k.split('|')
    return { dateKey, sectionId }
  })

  async function moveTo() {
    if (!selectedItems.length || !moveDate) return
    setBusy(true)
    try {
      const { moveSections } = await import('@/lib/journal')
      await moveSections(selectedItems, moveDate)
      setSelected(new Set())
      setMoveDate('')
      onChanged()
    } catch (e) {
      console.warn('move failed:', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle className="text-base">Manage entries</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide ▾' : 'Show ▸'}
        </Button>
      </div>
      <p className="text-muted text-xs mt-1">
        Archive hides an entry everywhere (recoverable); delete is forever. Totals and Summer
        Tracker sync update automatically. Aria can never delete — only you can.
      </p>
      {open && (
        <>
          {/* batch toolbar */}
          <div className="flex flex-wrap items-center gap-2 mt-3 sticky top-0 bg-paper z-10 py-1">
            <label className="flex items-center gap-2 text-xs font-bold min-h-9">
              <input
                type="checkbox"
                className="size-4 accent-teal"
                checked={selected.size > 0 && selected.size === allKeys.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(allKeys) : new Set())}
                aria-label="Select all entries"
              />
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </label>
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(selectedItems, 'archive')}>
                  Archive selected
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(selectedItems, 'restore')}>
                  Restore selected
                </Button>
                <Button size="sm" variant="ghost" className="text-coral" disabled={busy} onClick={() => void act(selectedItems, 'delete')}>
                  {busy ? 'Working…' : 'Delete selected'}
                </Button>
                <span className="flex items-center gap-1">
                  <input
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    aria-label="Move selected entries to this date"
                    className="min-h-9 px-2 rounded-xl border-2 border-line text-xs font-bold"
                  />
                  <Button size="sm" variant="secondary" disabled={busy || !moveDate} onClick={() => void moveTo()}>
                    Move here
                  </Button>
                </span>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
            {daysWithSections.length === 0 && (
              <p className="text-muted text-sm">No entries in this date range.</p>
            )}
            {daysWithSections.map((b) => (
              <div key={b.day.dateKey}>
                <p className="font-bold text-sm">{b.day.dateKey}</p>
                {b.sections.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 border border-line rounded-xl p-2 mt-1"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-teal shrink-0"
                      checked={selected.has(key(b.day.dateKey, s.id))}
                      onChange={() => toggle(key(b.day.dateKey, s.id))}
                      aria-label={`Select ${s.type} entry from ${b.day.dateKey}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold">
                        {s.type}
                        {s.status === 'archived' && <span className="text-coral"> · archived</span>}
                        {s.status === 'draft' && <span className="text-muted"> · draft</span>}
                      </p>
                      <p className="text-muted text-xs truncate">
                        {s.plainText?.trim() ||
                          ((s.panels?.length ?? 0) > 0 ? (s.type === 'photo' ? '(photo)' : '(drawing)') : '(empty)')}
                      </p>
                    </div>
                    {s.status === 'archived' ? (
                      <Button size="sm" variant="secondary" disabled={busy}
                        onClick={() => void act([{ dateKey: b.day.dateKey, sectionId: s.id }], 'restore')}>
                        Restore
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={busy}
                        onClick={() => void act([{ dateKey: b.day.dateKey, sectionId: s.id }], 'archive')}>
                        Archive
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-coral" disabled={busy}
                      onClick={() => void act([{ dateKey: b.day.dateKey, sectionId: s.id }], 'delete')}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
