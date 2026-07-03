import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Tappable pill — check-in answers, planning helpers, sparkle words. 44px min target. */
export function Chip({
  active = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border-2 text-sm font-bold transition-colors select-none',
        'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender',
        active
          ? 'bg-teal text-white border-teal'
          : 'bg-paper text-ink border-line hover:border-teal',
        className,
      )}
      {...props}
    />
  )
}
