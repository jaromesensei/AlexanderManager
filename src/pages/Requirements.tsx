import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sun, Moon } from 'lucide-react'
import {
  useRequirements,
  useSaveRequirements,
  type RequirementEntry,
} from '@/lib/queries/requirements'
import type { ShiftType, StaffRole } from '@/types/database'
import { STAFF_ROLES, ROLE_LABELS, SHIFTS, SHIFT_LABELS } from '@/lib/scheduling'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const cellKey = (shift: ShiftType, role: StaffRole) => `${shift}:${role}`

export function Requirements() {
  const { data: reqs } = useRequirements()
  const save = useSaveRequirements()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!reqs) return
    const map: Record<string, number> = {}
    for (const r of reqs) {
      if (r.weekday == null) map[cellKey(r.shift, r.role)] = r.required_count
    }
    setCounts(map)
  }, [reqs])

  function setCount(shift: ShiftType, role: StaffRole, val: string) {
    const n = Math.max(0, parseInt(val) || 0)
    setCounts((prev) => ({ ...prev, [cellKey(shift, role)]: n }))
    setSaved(false)
  }

  async function submit() {
    const entries: RequirementEntry[] = []
    for (const shift of SHIFTS)
      for (const role of STAFF_ROLES)
        entries.push({
          shift,
          role,
          required_count: counts[cellKey(shift, role)] ?? 0,
        })
    await save.mutateAsync(entries)
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/schedule" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">דרישות איוש</h1>
      </div>

      <p className="text-sm text-neutral-400">
        כמה עובדים צריך מכל תפקיד בכל משמרת. המערכת תתריע כשחסר.
      </p>

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

      <Button onClick={submit} loading={save.isPending} size="lg" className="w-full">
        {saved ? 'נשמר ✓' : 'שמירת דרישות'}
      </Button>
    </div>
  )
}
