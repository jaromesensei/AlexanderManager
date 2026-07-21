import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'elev-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-4',
        className
      )}
      {...props}
    />
  )
}
