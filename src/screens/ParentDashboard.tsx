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

  useEffect(() => {
    setBundles(null)
    loadRange(range).then(setBundles).catch(() => setBundles([]))
  }, [range])
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

      {/* 4 — raw data / settings */}
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
