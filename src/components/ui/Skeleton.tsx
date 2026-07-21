import { cn } from '@/lib/utils'

/** בלוק טעינה בצורת התוכן - מרגיש מהיר יותר מספינר. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-neutral-800', className)} />
}

/** שלד של כרטיס רשימה - שורה עם כותרת ותת-כותרת. */
export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <Skeleton className="h-8 w-12" />
      </div>
    </div>
  )
}

/** רשימת שלדים לטעינת מסך. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
