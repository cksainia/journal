import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// shadcn-style primitive tuned for small hands: 48px+ targets, big radii,
// visible focus ring (spec §10).
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-bold transition-transform active:scale-95 ' +
    'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lavender ' +
    'disabled:opacity-50 disabled:pointer-events-none select-none',
  {
    variants: {
      variant: {
        primary: 'bg-coral text-white shadow-card hover:brightness-105',
        secondary: 'bg-paper text-ink border-2 border-line hover:border-coral',
        soft: 'bg-coral-soft text-coral hover:bg-coral hover:text-white',
        ghost: 'text-muted hover:bg-soft hover:text-ink',
      },
      size: {
        lg: 'min-h-14 px-8 text-lg rounded-3xl',
        md: 'min-h-12 px-6 text-base rounded-2xl',
        sm: 'min-h-11 px-4 text-sm rounded-xl',
        icon: 'size-12 rounded-2xl',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
