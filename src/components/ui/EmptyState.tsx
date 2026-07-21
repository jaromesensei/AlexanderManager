import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from './Card'

/** מצב ריק ידידותי - אייקון, כותרת, הסבר וכפתור פעולה אופציונלי. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <Card className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="rounded-2xl bg-neutral-800 p-4">
        <Icon className="h-7 w-7 text-neutral-400" />
      </div>
      <div>
        <p className="font-semibold text-neutral-100">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-xs text-sm text-neutral-400">{description}</p>
        )}
      </div>
      {action}
    </Card>
  )
}
