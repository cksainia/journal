import { useEffect, useMemo, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { loadRange, type DayBundle } from '@/lib/analytics'
import { computeStreaks } from '@/lib/streaks'
import { computeBadges } from '@/lib/badges'
import { dateKeyFor } from '@/lib/dateKey'
import { watchMeta, saveFavoriteSentence, type JournalMeta } from '@/lib/meta'
import { useSettings } from '@/stores/settings'
import { celebrate } from '@/lib/confetti'
import { cn } from '@/lib/utils'

/**
 * My Progress (spec §6.1) — effort, variety, growth. NO error detail, no WPM,
 * no NJSLA numbers: those exist only on the Parent Dashboard by design.
 */
export function MyProgress() {
  const { settings } = useSettings()
  const [bundles, setBundles] = useState<DayBundle[] | null>(null)
  const [meta, setMeta] = useState<JournalMeta>({})

  useEffect(() => {
    loadRange(60).then(setBundles).catch(() => setBundles([]))
    return watchMeta(setMeta)
  }, [])

  const today = dateKeyFor()
  const stats = useMemo(() => {
    if (!bundles) return null
    const credited = new Set(bundles.filter((b) => b.day.streakCredit).map((b) => b.day.dateKey))
    const streaks = computeStreaks(credited, today, settings.streakFreezeDays)
    const words = (filter: (dk: string) => boolean) =>
      bundles.filter((b) => filter(b.day.dateKey)).reduce((n, b) => n + b.day.dailyTotals.words, 0)
    const weekAgo = dateKeyFor(new Date(Date.now() - 6 * 86400000))
    return {
      streaks,
      badges: computeBadges(bundles, meta),
      wordsToday: words((dk) => dk === today),
      wordsWeek: words((dk) => dk >= weekAgo),
      wordsAll: words(() => true),
      last14: bundles.slice(-14).map((b) => b.day.dailyTotals.words),
      writingDays30: bundles.filter((b) => b.day.streakCredit && b.day.dateKey >= dateKeyFor(new Date(Date.now() - 29 * 86400000))).length,
    }
  }, [bundles, meta, settings.streakFreezeDays, today])

  if (!bundles || !stats) {
    return <Card className="text-center text-muted py-10">Loading your adventure… 🗺️</Card>
  }

  const milestone =
    stats.wordsAll >= 5000
      ? "5,000 words — that's a whole picture book! 📚"
      : stats.wordsAll >= 1000
        ? '1,000 words and climbing! 🧗'
        : null

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <p className="text-sm font-bold uppercase tracking-widest text-muted">My Progress</p>
        <h1 className="text-3xl font-extrabold">Your adventure 🌟</h1>
      </header>

      <FantasyMap step={stats.writingDays30} />

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center p-3">
          <p className="text-2xl font-extrabold">{stats.wordsToday}</p>
          <p className="text-xs text-muted font-bold">words today</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-extrabold">{stats.wordsWeek}</p>
          <p className="text-xs text-muted font-bold">this week</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-extrabold">{stats.wordsAll}</p>
          <p className="text-xs text-muted font-bold">this summer</p>
        </Card>
      </div>
      {milestone && <p className="text-center font-extrabold text-teal">{milestone}</p>}

      {!settings.noStreakPressure && (
        <p className="text-center text-sm font-bold text-muted">
          🔥 {stats.streaks.current}-day streak · best {stats.streaks.best}
        </p>
      )}

      <Sparkline values={stats.last14} />

      {meta.kidVoiceCard && (
        <Card className="bg-lavender-soft border-lavender/30 text-center">
          <p className="text-xs font-extrabold uppercase tracking-wide text-lavender">My writing voice</p>
          <p className="font-extrabold mt-1">{String(meta.kidVoiceCard)}</p>
        </Card>
      )}

      <FavoriteSentence bundles={bundles} meta={meta} />

      <Card>
        <CardTitle className="text-base mb-3">Badges 🏅</CardTitle>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {stats.badges.map((b) => (
            <div
              key={b.id}
              title={b.blurb}
              className={cn(
                'rounded-2xl border p-2 text-center',
                b.earned ? 'bg-sunny-soft border-sunny/50' : 'opacity-35 border-line',
              )}
            >
              <span className="text-2xl" aria-hidden>{b.emoji}</span>
              <p className="text-[11px] font-extrabold leading-tight mt-1">{b.name}</p>
            </div>
          ))}
        </div>
      </Card>

      {(meta.wordShelf?.length ?? 0) > 0 && (
        <Card>
          <CardTitle className="text-base mb-2">My word shelf ⭐</CardTitle>
          <div className="flex flex-wrap gap-2">
            {meta.wordShelf!.slice(-20).map((w) => (
              <span key={w} className="bg-teal-soft rounded-full px-3 py-1 font-bold text-sm">{w}</span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/** 30-day fantasy map path: gem at 7, dragon at 14, castle at 30 (spec §6.1). */
function FantasyMap({ step }: { step: number }) {
  const points = Array.from({ length: 30 }, (_, i) => {
    const t = i / 29
    return { x: 30 + t * 340, y: 90 + Math.sin(t * Math.PI * 2.2) * 45 }
  })
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const avatarIdx = Math.max(0, Math.min(step, 30) - 1)
  const landmark = (i: number) => (i === 6 ? '💎' : i === 13 ? '🐉' : i === 29 ? '🏰' : null)

  return (
    <Card className="overflow-hidden">
      <CardTitle className="text-base mb-1">Your story path 🗺️</CardTitle>
      <svg viewBox="0 0 400 180" role="img" aria-label={`Map showing ${step} writing days out of 30`} className="w-full">
        <path d={path} fill="none" stroke="#EFE4D3" strokeWidth="10" strokeLinecap="round" />
        {points.map((p, i) => {
          const lm = landmark(i)
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={lm ? 0 : 5} fill={i < step ? '#12A594' : '#EFE4D3'} />
              {lm && (
                <text x={p.x} y={p.y + 8} textAnchor="middle" fontSize="22" opacity={i < step ? 1 : 0.4}>
                  {lm}
                </text>
              )}
            </g>
          )
        })}
        {step > 0 && (
          <text x={points[avatarIdx].x} y={points[avatarIdx].y - 12} textAnchor="middle" fontSize="24">
            🦄
          </text>
        )}
      </svg>
      <p className="text-center text-sm font-bold text-muted">
        {step} writing day{step === 1 ? '' : 's'} — {step >= 30 ? 'you reached the castle! 🏰' : `${Math.max(7 - step, 0) > 0 ? 7 - step + ' to the gem 💎' : step < 14 ? 14 - step + ' to the dragon 🐉' : 30 - step + ' to the castle 🏰'}`}
      </p>
    </Card>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 300},${60 - (v / max) * 50}`).join(' ')
  return (
    <Card className="p-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted mb-1">Words each day</p>
      <svg viewBox="0 0 300 65" className="w-full" role="img" aria-label="Words per day, recent days">
        <polyline points={pts} fill="none" stroke="#12A594" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Card>
  )
}

/** She picks a favorite sentence from this week — pinned here (spec §4.6). */
function FavoriteSentence({ bundles, meta }: { bundles: DayBundle[]; meta: JournalMeta }) {
  const [picking, setPicking] = useState(false)
  const weekStart = dateKeyFor(new Date(Date.now() - 6 * 86400000))
  const current = (meta.favoriteSentences ?? []).filter((f) => f.weekStart >= weekStart).at(-1)

  const candidates = useMemo(
    () =>
      bundles
        .filter((b) => b.day.dateKey >= weekStart)
        .flatMap((b) =>
          b.sections
            .filter((s) => s.status !== 'archived' && s.plainText)
            .flatMap((s) =>
              s.plainText
                .split(/(?<=[.!?…])\s+/)
                .map((x) => x.trim())
                .filter((x) => x.length > 8 && x.length < 160)
                .map((sentence) => ({ sentence, dateKey: b.day.dateKey })),
            ),
        )
        .slice(-12),
    [bundles, weekStart],
  )

  return (
    <Card className="text-center">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">⭐ Favorite sentence of the week</p>
      {current && !picking ? (
        <>
          <p className="font-extrabold text-lg mt-2">“{current.sentence}”</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPicking(true)}>
            Pick a different one
          </Button>
        </>
      ) : candidates.length === 0 ? (
        <p className="text-muted text-sm mt-2">Write something this week, then pick your favorite! 💛</p>
      ) : (
        <div className="flex flex-col gap-2 mt-2 text-left">
          {candidates.map((c, i) => (
            <Chip
              key={i}
              className="justify-start text-left h-auto py-2"
              onClick={() => {
                void saveFavoriteSentence({ weekStart, sentence: c.sentence, dateKey: c.dateKey })
                setPicking(false)
                celebrate({ small: true })
              }}
            >
              “{c.sentence}”
            </Chip>
          ))}
        </div>
      )}
    </Card>
  )
}
