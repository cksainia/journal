import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Art } from '@/components/illustrations'
import { bonusQuestionForDate } from '@/data/nudges'
import type { Checkin } from '@/lib/journal'

export const MOODS = [
  { id: 'happy', emoji: '😊', label: 'Happy' },
  { id: 'excited', emoji: '🤩', label: 'Excited' },
  { id: 'calm', emoji: '😌', label: 'Calm' },
  { id: 'proud', emoji: '😎', label: 'Proud' },
  { id: 'tired', emoji: '😴', label: 'Tired' },
  { id: 'sad', emoji: '😢', label: 'Sad' },
  { id: 'grumpy', emoji: '😠', label: 'Grumpy' },
  { id: 'nervous', emoji: '😬', label: 'Nervous' },
]

export const LOCATIONS = [
  { id: 'home', emoji: '🏠', label: 'Home' },
  { id: 'school-camp', emoji: '🎒', label: 'School or camp' },
  { id: 'traveling', emoji: '✈️', label: 'Traveling' },
  { id: 'friends-family', emoji: '🏡', label: "Friend's or family's" },
  { id: 'somewhere-new', emoji: '🌟', label: 'Somewhere new' },
]

export const ACTIVITIES = [
  { id: 'played-outside', emoji: '🌳', label: 'Played outside' },
  { id: 'read', emoji: '📚', label: 'Read a book' },
  { id: 'sports', emoji: '⚽', label: 'Sports' },
  { id: 'screen-time', emoji: '📱', label: 'Screen time' },
  { id: 'cooked', emoji: '🍪', label: 'Cooked or baked' },
  { id: 'art', emoji: '🎨', label: 'Art or craft' },
  { id: 'family-time', emoji: '👨‍👩‍👧', label: 'Family time' },
  { id: 'learned', emoji: '💡', label: 'Learned something new' },
  { id: 'something-else', emoji: '✨', label: 'Something else' },
]

export const RATINGS = [
  { id: 'awesome', emoji: '🤩', label: 'Awesome' },
  { id: 'good', emoji: '😊', label: 'Good' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'meh', emoji: '😑', label: 'Meh' },
  { id: 'tough', emoji: '😣', label: 'Tough' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-extrabold text-base mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** Daily check-in (spec §4.1): 30–60s, all taps, no typing required.
 *  Pass `initial` to reopen it prefilled for editing her answers. */
export function CheckIn({
  dateKey,
  initial = null,
  onDone,
}: {
  dateKey: string
  initial?: Checkin | null
  onDone: (checkin: Checkin) => void
}) {
  const [moods, setMoods] = useState<string[]>(initial?.moods ?? [])
  const [location, setLocation] = useState<string | null>(initial?.location ?? null)
  const [activities, setActivities] = useState<string[]>(initial?.activities ?? [])
  const [somethingElse, setSomethingElse] = useState(initial?.somethingElse ?? '')
  const [dayRating, setDayRating] = useState<string | null>(initial?.dayRating ?? null)
  const [bonusAnswer, setBonusAnswer] = useState<'yes' | 'no' | null>(initial?.bonus?.answer ?? null)
  const bonusQuestion = bonusQuestionForDate(dateKey)

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  return (
    <Card className="flex flex-col gap-5">
      <div className="text-center">
        <span className="text-4xl" aria-hidden>
          🦉
        </span>
        <h2 className="text-xl font-extrabold mt-1">Quick check-in!</h2>
      </div>

      <Section title="How are you feeling today?">
        {MOODS.map((m) => (
          <Chip
            key={m.id}
            active={moods.includes(m.id)}
            onClick={() => toggle(moods, setMoods, m.id)}
            aria-pressed={moods.includes(m.id)}
          >
            <Art set="feeling" id={m.id} size={30} /> {m.label}
          </Chip>
        ))}
      </Section>

      <Section title="Where were you today?">
        {LOCATIONS.map((l) => (
          <Chip
            key={l.id}
            active={location === l.id}
            onClick={() => setLocation(location === l.id ? null : l.id)}
            aria-pressed={location === l.id}
          >
            <span aria-hidden>{l.emoji}</span> {l.label}
          </Chip>
        ))}
      </Section>

      <Section title="What did you do today?">
        {ACTIVITIES.map((a) => (
          <Chip
            key={a.id}
            active={activities.includes(a.id)}
            onClick={() => toggle(activities, setActivities, a.id)}
            aria-pressed={activities.includes(a.id)}
          >
            <span aria-hidden>{a.emoji}</span> {a.label}
          </Chip>
        ))}
      </Section>
      {activities.includes('something-else') && (
        <input
          type="text"
          maxLength={60}
          placeholder="What was it?"
          value={somethingElse}
          onChange={(e) => setSomethingElse(e.target.value)}
          className="w-full min-h-12 px-4 rounded-2xl border-2 border-line bg-paper
                     focus:border-teal focus:outline-none text-base"
        />
      )}

      <Section title="One word for today?">
        {RATINGS.map((r) => (
          <Chip
            key={r.id}
            active={dayRating === r.id}
            onClick={() => setDayRating(dayRating === r.id ? null : r.id)}
            aria-pressed={dayRating === r.id}
          >
            <span aria-hidden>{r.emoji}</span> {r.label}
          </Chip>
        ))}
      </Section>

      <Section title={bonusQuestion}>
        {(['yes', 'no'] as const).map((v) => (
          <Chip
            key={v}
            active={bonusAnswer === v}
            onClick={() => setBonusAnswer(bonusAnswer === v ? null : v)}
            aria-pressed={bonusAnswer === v}
          >
            {v === 'yes' ? '👍 Yes!' : '👎 Nope'}
          </Chip>
        ))}
      </Section>

      <Button
        size="lg"
        onClick={() =>
          onDone({
            moods,
            location,
            activities,
            somethingElse: somethingElse.trim(),
            dayRating,
            bonus: { question: bonusQuestion, answer: bonusAnswer },
          })
        }
      >
        All done! ✨
      </Button>
    </Card>
  )
}
