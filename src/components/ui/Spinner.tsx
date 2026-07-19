import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-6 w-6 animate-spin text-brand-500', className)} />
}

export function FullScreenSpinner() {
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
