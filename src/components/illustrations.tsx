/**
 * Storybook illustration set — soft watercolor-style vector art replacing the
 * emoji for feelings and entry types (modeled on the family's mockup). Hand
 * vectors keep them crisp at chip size, a few KB total, and offline-safe.
 */

const SKIN = '#F5C9A4'
const HAIR = '#8B5E3C'
const BLUSH = '#F8AFA6'
const INK = '#4A3F55'

function Face({
  mouth,
  eyes,
  extra,
}: {
  mouth: React.ReactNode
  eyes: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <>
      {/* hair behind */}
      <path d="M14 30c-2-14 8-22 18-22s20 8 18 22c1 8-2 12-4 14l-2-10c-8 2-16 2-24 0l-2 10c-2-2-5-6-4-14Z" fill={HAIR} />
      {/* face */}
      <ellipse cx="32" cy="30" rx="13.5" ry="14" fill={SKIN} />
      {/* fringe */}
      <path d="M20 22c2-6 7-9 12-9s10 3 12 9c-4-2-8-3-12-3s-8 1-12 3Z" fill={HAIR} />
      <circle cx="24.5" cy="34" r="2.6" fill={BLUSH} opacity="0.8" />
      <circle cx="39.5" cy="34" r="2.6" fill={BLUSH} opacity="0.8" />
      {eyes}
      {mouth}
      {extra}
    </>
  )
}

const closedHappyEyes = (
  <>
    <path d="M23 28c1.5-2 4-2 5.5 0" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <path d="M35.5 28c1.5-2 4-2 5.5 0" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </>
)
function Sparkle({ x, y, s = 1, color = '#FBBF24' }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      d={`M${x} ${y - 4 * s}l${1.2 * s} ${2.8 * s} ${2.8 * s} ${1.2 * s}-${2.8 * s} ${1.2 * s}-${1.2 * s} ${2.8 * s}-${1.2 * s}-${2.8 * s}-${2.8 * s}-${1.2 * s} ${2.8 * s}-${1.2 * s}Z`}
      fill={color}
    />
  )
}

export const FEELING_ART: Record<string, React.ReactNode> = {
  happy: (
    <svg viewBox="0 0 64 64" aria-hidden>
      <Face
        eyes={closedHappyEyes}
        mouth={<path d="M25 36c2.5 4.5 11.5 4.5 14 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />}
        extra={
          <>
            <circle cx="12" cy="16" r="4" fill="#F9A8D4" />
            <circle cx="12" cy="16" r="1.5" fill="#FBBF24" />
            <circle cx="52" cy="14" r="4" fill="#C4B5FD" />
            <circle cx="52" cy="14" r="1.5" fill="#FBBF24" />
            <Sparkle x={8} y={34} s={0.8} />
            <Sparkle x={56} y={32} s={0.8} />
          </>
        }
      />
    </svg>
  ),
  excited: (
    <svg viewBox="0 0 64 64" aria-hidden>
      <path d="M32 4l6 12 13-4-6 12 13 5-14 3 4 13-11-7-5 13-5-13-11 7 4-13-14-3 13-5-6-12 13 4 6-12Z" fill="#FDE68A" />
      {/* jumping kid */}
      <circle cx="32" cy="24" r="6.5" fill={SKIN} />
      <path d="M25 22c1-5 4-7 7-7s6 2 7 7c-2-1.5-4.5-2.2-7-2.2s-5 .7-7 2.2Z" fill={HAIR} />
      <path d="M23 27c-1.5-2-4-4-6-4.5 M41 27c1.5-2 4-4 6-4.5" stroke={SKIN} strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <path d="M27 30h10l-1.5 11h-7L27 30Z" fill="#FB7185" />
      <path d="M28.5 41l-2.5 9 M35.5 41l2.5 9" stroke="#3B82F6" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="30" cy="24" r="1.3" fill={INK} />
      <circle cx="34.5" cy="24" r="1.3" fill={INK} />
      <path d="M30 27c1.2 1.6 3.3 1.6 4.5 0" stroke={INK} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="44" r="2" fill="#F472B6" />
      <circle cx="52" cy="42" r="2" fill="#8B5CF6" />
      <path d="M50 12 q3 2 0 5 M14 26 q-3 2 0 5" stroke="#F472B6" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  ),
  calm: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* tassel pillow */}
      <ellipse cx="32" cy="44" rx="22" ry="9" fill="#A5B4FC" />
      <ellipse cx="32" cy="41.5" rx="22" ry="8" fill="#C7D2FE" />
      <circle cx="9" cy="43" r="1.8" fill="#FBBF24" />
      <circle cx="55" cy="43" r="1.8" fill="#FBBF24" />
      {/* curled cat */}
      <path d="M15 38c-1-9 6-15 15-15 10 0 18 5 18 13 0 3-2 5.5-6 5.5H21c-3 0-5.5-1-6-3.5Z" fill="#E8D5BC" />
      <path d="M42 24l1.5-5 4 3.5Z M30 22l1-4.5 4 3Z" fill="#E8D5BC" />
      <path d="M17 36c-3-1-5-4-4-7 2 1 4 3 4 7Z" fill="#C9A97C" />
      <path d="M25 30c3-2 8-2 11 0" stroke="#C9A97C" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M38 30.5c1.4-1.6 3.6-1.6 5 0" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M45 33.5c.8.6 2 .6 2.8 0" stroke="#B98A5E" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* breeze */}
      <path d="M48 12c3-1.5 6-.5 7 1.5 M50 18c4-1.8 7 0 7.5 2" stroke="#7DD3FC" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  ),
  proud: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* rosette ribbons */}
      <path d="M36 38l-4 16-4-6-7 4 6-15Z" fill="#F87171" />
      <path d="M40 38l6 15-7-3-3 6-4-16Z" fill="#FB923C" />
      {/* rosette */}
      <circle cx="38" cy="26" r="14" fill="#FCA5A5" />
      <circle cx="38" cy="26" r="14" fill="none" stroke="#F87171" strokeWidth="2.5" strokeDasharray="4 3" />
      <circle cx="38" cy="26" r="9" fill="#FEF3C7" />
      <text x="38" y="31" textAnchor="middle" fontSize="13" fontWeight="800" fill="#D97706" fontFamily="inherit">1</text>
      {/* proud face peeking */}
      <circle cx="14" cy="30" r="8" fill={SKIN} />
      <path d="M6 28c1-6 5-8 8-8 3.5 0 7 2 8 8-2.5-1.6-5-2.4-8-2.4s-5.5.8-8 2.4Z" fill={HAIR} />
      <path d="M10.5 30c1-1.3 2.6-1.3 3.6 0 M17 30c1-1.3 2.6-1.3 3.6 0" stroke={INK} strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M11.5 34c1.6 1.8 4.4 1.8 6 0" stroke={INK} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <Sparkle x={54} y={12} />
      <Sparkle x={26} y={8} s={0.7} color="#F472B6" />
    </svg>
  ),
  tired: (
    <svg viewBox="0 0 64 64" aria-hidden>
      <rect x="4" y="4" width="56" height="56" rx="14" fill="#E0E7FF" opacity="0.6" />
      <path d="M50 8a9 9 0 1 0 8 13 10 10 0 0 1-8-13Z" fill="#FDE68A" />
      {/* pillow */}
      <path d="M8 46c0-5 4-8 12-8h16c8 0 12 3 12 8s-4 8-12 8H20c-8 0-12-3-12-8Z" fill="#fff" />
      {/* resting head */}
      <circle cx="26" cy="34" r="10" fill={SKIN} />
      <path d="M15 32c1-8 6-11 11-11s10 3 11 11c-3-2-7-3-11-3s-8 1-11 3Z" fill={HAIR} />
      <path d="M20 34.5c1.6 1 3.4 1 5 0 M30 34.5c1.6 1 3.4 1 5 0" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M25 40c1 .8 2.6 .8 3.6 0" stroke={INK} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <circle cx="23" cy="38" r="2" fill={BLUSH} opacity="0.8" />
      <path d="M44 20h5l-5 5h5" stroke="#818CF8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  sad: (
    <svg viewBox="0 0 64 64" aria-hidden>
      <Face
        eyes={
          <>
            <path d="M23 27.5c1.5 1.6 4 1.6 5.5 0 M35.5 27.5c1.5 1.6 4 1.6 5.5 0" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        }
        mouth={<path d="M27 39c1.6-2.4 8.4-2.4 10 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />}
        extra={
          <>
            {/* tear */}
            <path d="M41 31c2.6 3.6 3.4 5.6 3.4 7.2a3.4 3.4 0 1 1-6.8 0c0-1.6.8-3.6 3.4-7.2Z" fill="#7DD3FC" />
            {/* drooping flower */}
            <path d="M10 52c0-8 2-13 6-16" stroke="#86EFAC" strokeWidth="2" strokeLinecap="round" fill="none" />
            <circle cx="17" cy="35" r="3.4" fill="#DDA7E6" />
            <circle cx="17" cy="35" r="1.2" fill="#FBBF24" />
          </>
        }
      />
    </svg>
  ),
  grumpy: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* storm cloud body */}
      <path d="M14 40c-6 0-9-4-9-8 0-5 4-8 8-8 1.5-7 7-11 14-11s12.5 4 14 11c5 0 10 3 10 9 0 4-4 7-9 7H14Z" fill="#BCC3D0" />
      <path d="M14 40c-6 0-9-4-9-8 0-5 4-8 8-8 1.5-7 7-11 14-11 3 0 6 .8 8.4 2.3C29 16 24 20 23 27c-4 0-8 3-8 8 0 2 .7 3.8 2 5H14Z" fill="#A9B1C2" />
      {/* angry brows + eyes */}
      <path d="M20 26l6 2.4 M38 26l-6 2.4" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24.5" cy="31" r="1.7" fill={INK} />
      <circle cx="34" cy="31" r="1.7" fill={INK} />
      <path d="M25 37c2.6-1.8 6.4-1.8 9 0" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="21" cy="34" r="2" fill={BLUSH} opacity="0.6" />
      <circle cx="38" cy="34" r="2" fill={BLUSH} opacity="0.6" />
      {/* crossed arms */}
      <path d="M18 44c4 3 8 4 11 4M40 44c-4 3-8 4-11 4" stroke="#8E99AE" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* bolt */}
      <path d="M50 34l-5 9h4l-6 11 10-13h-4l5-7Z" fill="#FBBF24" />
    </svg>
  ),
  nervous: (
    <svg viewBox="0 0 64 64" aria-hidden>
      <Face
        eyes={
          <>
            <circle cx="25.5" cy="28" r="2" fill={INK} />
            <circle cx="38.5" cy="28" r="2" fill={INK} />
            <circle cx="26.2" cy="27.3" r="0.7" fill="#fff" />
            <circle cx="39.2" cy="27.3" r="0.7" fill="#fff" />
          </>
        }
        mouth={<path d="M26 38c2-1.6 4-.2 6 0s4 1.6 6 0" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />}
        extra={
          <>
            {/* hands near mouth */}
            <ellipse cx="24" cy="42" rx="4" ry="3" fill={SKIN} />
            <ellipse cx="40" cy="42" rx="4" ry="3" fill={SKIN} />
            {/* butterflies */}
            <path d="M10 20c-2-3-6-2-5 1s4 2 5-1Zm0 0c2-3 6-2 5 1s-4 2-5-1Z" fill="#C4B5FD" />
            <path d="M54 26c-2-3-6-2-5 1s4 2 5-1Zm0 0c2-3 6-2 5 1s-4 2-5-1Z" fill="#F9A8D4" />
          </>
        }
      />
    </svg>
  ),
}

export const ENTRY_ART: Record<string, React.ReactNode> = {
  guided: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* sparkle trail */}
      <path d="M8 18C20 8 40 8 52 20" stroke="#C4B5FD" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 6" fill="none" />
      <Sparkle x={14} y={14} />
      <Sparkle x={30} y={9} s={0.7} color="#F472B6" />
      <Sparkle x={46} y={14} s={0.8} color="#8B5CF6" />
      {/* compass */}
      <circle cx="32" cy="40" r="15" fill="#FEF3C7" stroke="#D9A441" strokeWidth="3" />
      <circle cx="32" cy="40" r="11" fill="#FFFBEB" />
      <path d="M32 31l3.5 7.5L32 49l-3.5-10.5L32 31Z" fill="#EF4444" />
      <path d="M32 31l3.5 7.5h-7L32 31Z" fill="#F87171" />
      <circle cx="32" cy="40" r="2" fill={INK} />
      <circle cx="32" cy="25" r="1.6" fill="#D9A441" />
    </svg>
  ),
  free: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* fountain pen */}
      <path d="M46 6l12 12-24 24-14 2 2-14L46 6Z" fill="#3F4B66" />
      <path d="M46 6l12 12-5 5-12-12 5-5Z" fill="#D9A441" />
      <path d="M22 42l-2 6 6-2Z" fill="#2A3245" />
      <circle cx="30" cy="34" r="1.6" fill="#D9A441" />
      {/* signature flourish */}
      <path d="M8 56c6-6 10 2 15-3s8 1 14-3 9 1 17-4" stroke="#7C8CF8" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  ),
  nudge: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* thought cloud */}
      <path d="M8 18c-3 0-5-2-5-4.5S5.5 9 8 9c.6-3 3-5 6.5-5s6 2 6.5 5c2.6 0 5 2 5 4.5S23.5 18 21 18H8Z" fill="#E4E9F2" />
      {/* bulb buddy */}
      <circle cx="36" cy="30" r="14" fill="#FDE68A" />
      <path d="M28 41h16v4c0 2-1.6 3.5-4 3.5h-8c-2.4 0-4-1.5-4-3.5v-4Z" fill="#C9CDD6" />
      <path d="M31 26c1-1.3 2.6-1.3 3.6 0 M39 26c1-1.3 2.6-1.3 3.6 0" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M33 33c1.8 2 4.8 2 6.6 0" stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <circle cx="30" cy="31" r="2" fill={BLUSH} opacity="0.8" />
      <circle cx="42.5" cy="31" r="2" fill={BLUSH} opacity="0.8" />
      {/* little legs + arrow */}
      <path d="M32 48.5l-1.5 6 M40 48.5l1.5 6" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M50 42h7m0 0l-3-3m3 3l-3 3" stroke="#60A5FA" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M36 12l0 4 M28 14l2 3.5 M44 14l-2 3.5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  drawing: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* palette */}
      <path d="M32 10c14 0 24 9 24 20 0 6-4 9-9 9h-6c-3 0-4 2-3 4.5 1.5 3.5-1 8.5-6 8.5C18 52 8 42 8 30S18 10 32 10Z" fill="#C9905E" />
      <path d="M32 13c12.5 0 21 8 21 17 0 4.5-3 6.5-6.5 6.5h-6c-5 0-7.5 4-6 8 .8 2-.3 4.5-3 4.5C20 49 11 40.5 11 30S20 13 32 13Z" fill="#E3B88A" />
      <circle cx="21" cy="24" r="3.4" fill="#EF4444" />
      <circle cx="31" cy="20" r="3.4" fill="#3B82F6" />
      <circle cx="42" cy="24" r="3.4" fill="#22C55E" />
      <circle cx="19" cy="34" r="3.4" fill="#F59E0B" />
      {/* brush */}
      <path d="M50 6l6 6-16 18-7 1 1-7L50 6Z" fill="#8B5E3C" />
      <path d="M41 24l-7 1 1-7" fill="#F472B6" />
      <path d="M52 4l8 8" stroke="#D9A441" strokeWidth="4" strokeLinecap="round" />
    </svg>
  ),
  comic: (
    <svg viewBox="0 0 64 64" aria-hidden>
      {/* burst */}
      <path d="M32 6l5 9 10-5-3 10 11 1-8 7 8 6-11 1 3 10-10-4-5 9-5-9-10 4 3-10-11-1 8-6-8-7 11-1-3-10 10 5 5-9Z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
      <text x="32" y="37" textAnchor="middle" fontSize="12" fontWeight="900" fill="#B91C1C" fontFamily="inherit" transform="rotate(-6 32 34)">BOOM!</text>
      <rect x="44" y="44" width="16" height="14" rx="2" fill="#fff" stroke={INK} strokeWidth="1.6" />
      <circle cx="52" cy="50" r="3" fill={SKIN} />
      <path d="M48.8 49c.4-2.4 1.8-3.4 3.2-3.4s2.8 1 3.2 3.4c-1-.7-2-1-3.2-1s-2.2.3-3.2 1Z" fill={HAIR} />
    </svg>
  ),
}

/** Small wrapper so call sites stay tidy: <Art set="feeling" id="happy" size={32}/> */
export function Art({
  set,
  id,
  size = 32,
  className = '',
}: {
  set: 'feeling' | 'entry'
  id: string
  size?: number
  className?: string
}) {
  const node = set === 'feeling' ? FEELING_ART[id] : ENTRY_ART[id]
  if (!node) return null
  return (
    <span className={className} style={{ width: size, height: size, display: 'inline-block', flexShrink: 0 }}>
      {node}
    </span>
  )
}
