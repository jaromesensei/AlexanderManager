import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="mb-1.5 block text-sm font-medium text-neutral-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'h-12 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-base text-neutral-100 transition-colors',
            'placeholder:text-neutral-500',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/40',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
