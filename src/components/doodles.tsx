import type { Checkin } from '@/lib/journal'

/**
 * Crayon-style doodles for the journal pages — wobbly strokes, pastel colors,
 * picked from the day's CHECK-IN answers (moods, activities, location, rating)
 * and placed deterministically from the dateKey so a page always looks the
 * same every time she opens it.
 */

const S = (d: string, color: string, extra?: React.ReactNode) => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full" aria-hidden>
    <path d={d} stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    {extra}
  </svg>
)

export const DOODLES: Record<string, React.ReactNode> = {
  sun: S(
    'M24 15a9 9 0 0 1 8 9c0 5-4 8-8 8s-9-3-8-8c1-4 4-9 8-9Z M24 6l0 5 M24 37l0 5 M6 24l5 0 M37 24l5 0 M11 11l4 4 M33 33l3 3 M37 11l-4 4 M15 33l-4 4',
    '#F59E0B',
  ),
  heart: S('M24 40C10 30 6 20 12 13c4-4 10-3 12 2 2-5 8-6 12-2 6 7 2 17-12 27Z', '#F472B6'),
  star: S('M24 6l5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1 5-12Z', '#FBBF24'),
  rainbow: S(
    'M8 36c0-11 7-19 16-19s16 8 16 19 M14 36c0-7 4-12 10-12s10 5 10 12 M20 36c0-3 1-5 4-5s4 2 4 5',
    '#A78BFA',
  ),
  cloud: S('M12 32c-4 0-6-3-6-6 0-4 3-6 6-6 1-5 5-8 10-8s9 3 10 8c4 0 8 2 8 7 0 3-3 5-6 5H12Z', '#93C5FD'),
  raincloud: S(
    'M12 26c-4 0-6-3-6-6 0-4 3-6 6-6 1-5 5-8 10-8s9 3 10 8c4 0 8 2 8 7 0 3-3 5-6 5H12Z M14 34l-2 6 M24 34l-2 6 M34 34l-2 6',
    '#93C5FD',
  ),
  book: S('M8 10c6-3 12-3 16 0 4-3 10-3 16 0v28c-6-3-12-3-16 0-4-3-10-3-16 0V10Z M24 10v28', '#6EE7B7'),
  ball: S('M24 42a18 18 0 1 1 0-36 18 18 0 0 1 0 36Z M24 6c-8 10-8 26 0 36 M6 20c10-4 26-4 36 0 M8 32c10 4 22 4 32 0', '#FB923C'),
  flower: S(
    'M24 26c-2-8 2-14 6-14s6 6 0 10c8-2 13 2 12 6-1 4-8 4-11 0 5 6 3 12-1 13-4 1-7-5-4-11-4 6-11 6-13 2-2-4 3-9 10-6-7-2-8-9-4-11 3-2 7 2 5 11Z M24 30l-2 12',
    '#F472B6',
  ),
  cupcake: S('M12 22c-2-10 6-14 12-14s14 4 12 14 M12 22h24l-3 16H15l-3-16Z M18 26l-1 8 M25 26v8 M31 26l1 8', '#FCA5A5'),
  lightbulb: S('M24 6a11 11 0 0 1 6 20c-1 1-1 3-1 5h-10c0-2 0-4-1-5a11 11 0 0 1 6-20Z M20 36h8 M21 41h6', '#FBBF24'),
  plane: S('M6 28l36-14-10 16 4 10-8-6-6 8-2-10-14-4Z M32 30L18 24', '#60A5FA'),
  house: S('M10 24L24 10l14 14 M14 22v16h20V22 M21 38v-8h6v8', '#F59E0B'),
  zzz: S('M10 18h10l-10 10h10 M26 12h8l-8 8h8 M36 26h6l-6 6h6', '#A78BFA'),
  squiggle: S('M6 30c4-8 8-8 12 0s8 8 12 0 8-8 12 0', '#6EE7B7'),
  music: S('M18 34V12l18-4v22 M18 34a5 4 0 1 1-10 0 5 4 0 0 1 10 0Z M36 30a5 4 0 1 1-10 0 5 4 0 0 1 10 0Z', '#F472B6'),
  paw: S('M24 26c5 0 9 3 9 8 0 4-4 6-9 6s-9-2-9-6c0-5 4-8 9-8Z M13 22a3 4 0 1 0 0-8 3 4 0 0 0 0 8Z M35 22a3 4 0 1 0 0-8 3 4 0 0 0 0 8Z M20 14a3 4 0 1 0 0-8 3 4 0 0 0 0 8Z M28 14a3 4 0 1 0 0-8 3 4 0 0 0 0 8Z', '#FB923C'),
  sparkle: S('M24 8l3 10 10 3-10 3-3 10-3-10-10-3 10-3 3-10Z M38 32l1.5 4.5L44 38l-4.5 1.5L38 44l-1.5-4.5L32 38l4.5-1.5L38 32Z', '#FBBF24'),
  tv: S('M10 14h28v20H10z M18 34l-3 6 M30 34l3 6 M18 8l6 6 6-6', '#A78BFA'),
}

const MOOD_DOODLES: Record<string, string[]> = {
  happy: ['sun', 'sparkle'],
  excited: ['star', 'sparkle'],
  calm: ['cloud', 'flower'],
  proud: ['star', 'rainbow'],
  tired: ['zzz', 'cloud'],
  sad: ['raincloud', 'heart'],
  grumpy: ['squiggle', 'raincloud'],
  nervous: ['squiggle', 'heart'],
}
const ACTIVITY_DOODLES: Record<string, string[]> = {
  'played-outside': ['sun', 'flower'],
  read: ['book', 'sparkle'],
  sports: ['ball'],
  'screen-time': ['tv'],
  cooked: ['cupcake'],
  art: ['rainbow', 'flower'],
  'family-time': ['heart', 'house'],
  learned: ['lightbulb'],
}
const LOCATION_DOODLES: Record<string, string[]> = {
  home: ['house'],
  traveling: ['plane'],
  'somewhere-new': ['star', 'plane'],
  'school-camp': ['book'],
  'friends-family': ['heart'],
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export interface PlacedDoodle {
  key: string
  doodle: string
  style: React.CSSProperties
}

/** Margin slots around the page (percent-based, clear of the text column). */
const SLOTS: { top?: string; bottom?: string; left?: string; right?: string }[] = [
  { top: '2%', right: '3%' },
  { top: '30%', right: '1%' },
  { bottom: '18%', right: '4%' },
  { bottom: '2%', left: '14%' },
  { top: '14%', left: '1%' },
  { bottom: '38%', left: '2%' },
]

/** Deterministic doodle layout for a day: same page, same scribbles, always. */
export function doodlesForDay(dateKey: string, checkin: Checkin | null): PlacedDoodle[] {
  const pool: string[] = []
  checkin?.moods?.forEach((m) => pool.push(...(MOOD_DOODLES[m] ?? [])))
  checkin?.activities?.forEach((a) => pool.push(...(ACTIVITY_DOODLES[a] ?? [])))
  if (checkin?.location) pool.push(...(LOCATION_DOODLES[checkin.location] ?? []))
  if (checkin?.dayRating === 'awesome') pool.push('rainbow', 'sparkle')
  if (!pool.length) pool.push('sparkle', 'heart', 'star') // every page gets a little joy

  const unique = [...new Set(pool)]
  const h = hash(dateKey)
  const count = Math.min(unique.length, 3 + (h % 2)) // 3–4 doodles per page
  return Array.from({ length: count }, (_, i) => {
    const doodle = unique[(h + i * 7) % unique.length]
    const slot = SLOTS[(h + i * 5) % SLOTS.length]
    const rot = ((hash(dateKey + doodle + i) % 30) - 15).toFixed(0)
    const size = 34 + (hash(dateKey + i) % 18)
    return {
      key: `${doodle}-${i}`,
      doodle,
      style: {
        position: 'absolute',
        width: size,
        height: size,
        transform: `rotate(${rot}deg)`,
        opacity: 0.85,
        pointerEvents: 'none',
        ...slot,
      } as React.CSSProperties,
    }
  }).filter((p, i, arr) => arr.findIndex((q) => q.doodle === p.doodle) === i)
}
