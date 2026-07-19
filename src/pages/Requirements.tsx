import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sun, Moon, RotateCcw } from 'lucide-react'
import {
  useRequirements,
  useSaveRequirements,
  useClearDayRequirements,
  type RequirementEntry,
} from '@/lib/queries/requirements'
import type { ShiftType, StaffRole, StaffingRequirement } from '@/types/database'
import {
  STAFF_ROLES,
  ROLE_LABELS,
  SHIFTS,
  SHIFT_LABELS,
  WEEKDAY_NAMES,
} from '@/lib/scheduling'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const cellKey = (shift: ShiftType, role: StaffRole) => `${shift}:${role}`

// scope: null = ברירת מחדל, 0-6 = יום ספציפי
type Scope = number | null

function countsForScope(reqs: StaffingRequirement[], scope: Scope) {
  const map: Record<string, number> = {}
  for (const r of reqs) {
    if ((scope == null ? r.weekday == null : r.weekday === scope))
      map[cellKey(r.shift, r.role)] = r.required_count
  }
  return map
}

export function Requirements() {
  const { data: reqs } = useRequirements()
  const save = useSaveRequirements()
  const clearDay = useClearDayRequirements()
  const [scope, setScope] = useState<Scope>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)

  // אילו ימים יש להם התאמה משלהם
  const customDays = useMemo(() => {
    const s = new Set<number>()
    for (const r of reqs ?? []) if (r.weekday != null) s.add(r.weekday)
    return s
  }, [reqs])

  // טעינה מחדש כשמחליפים סקופ / כשמגיע מידע
  useEffect(() => {
    if (!reqs) return
    const hasScope = scope == null || customDays.has(scope)
    // יום ללא התאמה - מתחילים מברירת המחדל כבסיס נוח לעריכה
    setCounts(countsForScope(reqs, hasScope ? scope : null))
    setSaved(false)
  }, [reqs, scope, customDays])

  function setCount(shift: ShiftType, role: StaffRole, val: string) {
    const n = Math.max(0, parseInt(val) || 0)
    setCounts((prev) => ({ ...prev, [cellKey(shift, role)]: n }))
    setSaved(false)
  }

  async function submit() {
    const entries: RequirementEntry[] = []
    for (const shift of SHIFTS)
      for (const role of STAFF_ROLES)
        entries.push({ shift, role, required_count: counts[cellKey(shift, role)] ?? 0 })
    await save.mutateAsync({ weekday: scope, entries })
    setSaved(true)
  }

  async function reset() {
    if (scope == null) return
    await clearDay.mutateAsync(scope)
    setSaved(false)
  }

  const isCustomDay = scope != null && customDays.has(scope)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/schedule" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">דרישות איוש</h1>
      </div>

      <p className="text-sm text-neutral-400">
        כמה עובדים צריך מכל תפקיד בכל משמרת. בחר "ברירת מחדל" לכל השבוע, או יום מסוים
        כדי להתאים אותו (למשל שישי).
      </p>

      {/* בורר סקופ: ברירת מחדל + ימים */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <ScopeChip active={scope == null} onClick={() => setScope(null)} label="ברירת מחדל" />
        {WEEKDAY_NAMES.map((name, i) => (
          <ScopeChip
            key={i}
            active={scope === i}
            custom={customDays.has(i)}
            onClick={() => setScope(i)}
            label={name}
          />
        ))}
      </div>

      {scope != null && !isCustomDay && (
        <p className="rounded-lg bg-neutral-800/50 px-3 py-2 text-sm text-neutral-400">
          יום {WEEKDAY_NAMES[scope]} יורש כרגע מברירת המחדל. שנה מספרים ושמור כדי להתאים אותו.
        </p>
      )}

      {SHIFTS.map((shift) => (
        <Card key={shift} className="space-y-3">
          <div className="flex items-center gap-2">
            {shift === 'morning' ? (
              <Sun className="h-5 w-5 text-amber-400" />
            ) : (
              <Moon className="h-5 w-5 text-indigo-400" />
            )}
            <h2 className="font-semibold">משמרת {SHIFT_LABELS[shift]}</h2>
          </div>
          <div className="space-y-2">
            {STAFF_ROLES.map((role) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-neutral-200">{ROLE_LABELS[role]}</span>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={counts[cellKey(shift, role)] ?? 0}
                  onChange={(e) => setCount(shift, role, e.target.value)}
                  dir="ltr"
                  className="h-11 w-20 rounded-xl border border-neutral-700 bg-neutral-900 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button onClick={submit} loading={save.isPending} size="lg" className="flex-1">
          {saved
            ? 'נשמר ✓'
            : scope == null
              ? 'שמירת ברירת מחדל'
              : `שמירה ליום ${WEEKDAY_NAMES[scope]}`}
        </Button>
        {isCustomDay && (
          <Button variant="secondary" onClick={reset} loading={clearDay.isPending}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function ScopeChip({
  active,
  custom,
  onClick,
  label,
}: {
  active: boolean
  custom?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-brand-700 text-white' : 'bg-neutral-800 text-neutral-300'
      )}
    >
      {label}
      {custom && !active && (
        <span className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-500" />
      )}
    </button>
  )
}
