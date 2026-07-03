import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Cards hold entries, badges, prompts, dashboard modules — never nested (spec §10).
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-paper border border-line rounded-3xl p-5 shadow-card', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-extrabold text-ink', className)} {...props} />
}
