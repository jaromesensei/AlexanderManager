import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'elev-sm bg-brand-700 text-white hover:bg-brand-600 active:bg-brand-800',
  secondary:
    'border border-neutral-700 bg-neutral-800 text-neutral-100 hover:bg-neutral-700 active:bg-neutral-900',
  ghost: 'bg-transparent text-neutral-200 hover:bg-neutral-800',
  danger: 'elev-sm bg-[#dc2626] text-white hover:bg-[#ef4444] active:bg-[#b91c1c]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-base',
  lg: 'h-14 px-6 text-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
