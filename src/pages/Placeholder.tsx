import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'

/** דף זמני למודול שעדיין לא נבנה (יוחלף בפאזות הבאות). */
export function Placeholder({
  title,
  description,
  icon: Icon,
  phase,
}: {
  title: string
  description: string
  icon: LucideIcon
  phase: string
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="rounded-2xl bg-brand-950 p-4">
          <Icon className="h-8 w-8 text-brand-500" />
        </div>
        <p className="text-neutral-300">{description}</p>
        <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
          יבנה ב{phase}
        </span>
      </Card>
    </div>
  )
}
