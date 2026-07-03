import confetti from 'canvas-confetti'

/** Celebration confetti that ALWAYS respects prefers-reduced-motion (spec §10). */
export function celebrate(opts: { small?: boolean } = {}): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  confetti({
    particleCount: opts.small ? 30 : 90,
    spread: opts.small ? 45 : 70,
    startVelocity: opts.small ? 25 : 35,
    origin: { y: 0.7 },
    colors: ['#F4634A', '#12A594', '#FFC53D', '#8F7BE8'],
    disableForReducedMotion: true,
  })
}
