import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Plus, Trash2, X, Users, Sun, Moon } from 'lucide-react'
import { useEmployees } from '@/lib/queries/employees'
import {
  useShifts,
  useCreateShift,
  useDeleteShift,
  type ShiftRow,
} from '@/lib/queries/shifts'
import type { ShiftType, StaffRole } from '@/types/database'
import {
  startOfWeek,
  addDays,
  toISODate,
  WEEKDAY_NAMES,
  SHIFTS,
  SHIFT_LABELS,
  STAFF_ROLES,
  ROLE_LABELS,
  shortTime,
} from '@/lib/scheduling'
import { formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'

export function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const from = toISODate(weekStart)
  const to = toISODate(addDays(weekStart, 6))
  const { data: shifts, isLoading } = useShifts(from, to)
  const [addingDate, setAddingDate] = useState<string | null>(null)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const byDate = useMemo(() => {
    const map: Record<string, ShiftRow[]> = {}
    for (const s of shifts ?? []) (map[s.work_date] ??= []).push(s)
    return map
  }, [shifts])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">סידור עבודה</h1>
        <Link to="/employees">
          <Button size="sm" variant="secondary">
            <Users className="h-4 w-4" />
            עובדים
          </Button>
        </Link>
      </div>

      {/* ניווט שבוע */}
      <Card className="flex items-center justify-between py-2">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
          aria-label="שבוע קודם"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="text-sm font-medium text-neutral-300"
        >
          {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
        </button>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
          aria-label="שבוע הבא"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((day, i) => {
            const iso = toISODate(day)
            const dayShifts = byDate[iso] ?? []
            return (
              <Card key={iso} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">יום {WEEKDAY_NAMES[i]}</span>
                    <span className="mr-2 text-sm text-neutral-500">
                      {formatDate(day)}
                    </span>
                  </div>
                  <button
                    onClick={() => setAddingDate(addingDate === iso ? null : iso)}
                    className="rounded-lg p-1.5 text-brand-400 hover:bg-neutral-800"
                    aria-label="הוסף משמרת"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {dayShifts.length === 0 && addingDate !== iso && (
                  <p className="text-sm text-neutral-600">אין שיבוצים</p>
                )}

                {dayShifts.map((s) => (
                  <ShiftLine key={s.id} shift={s} />
                ))}

                {addingDate === iso && (
                  <AddShiftForm date={iso} onDone={() => setAddingDate(null)} />
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ShiftLine({ shift }: { shift: ShiftRow }) {
  const del = useDeleteShift()
  const ShiftIcon = shift.shift === 'morning' ? Sun : Moon
  return (
    <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <ShiftIcon
          className={cn(
            'h-4 w-4',
            shift.shift === 'morning' ? 'text-amber-400' : 'text-indigo-400'
          )}
        />
        <div>
          <p className="text-sm font-medium">
            {shift.employee?.full_name ?? 'עובד'}
            <span className="mr-1.5 text-neutral-400">· {ROLE_LABELS[shift.role]}</span>
          </p>
          {(shift.start_time || shift.end_time) && (
            <p className="num text-xs text-neutral-400">
              {shortTime(shift.start_time)}–{shortTime(shift.end_time)}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={() => del.mutate(shift.id)}
        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-700 hover:text-red-400"
        aria-label="הסר"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

const DEFAULT_TIMES: Record<ShiftType, { start: string; end: string }> = {
  morning: { start: '09:00', end: '17:00' },
  evening: { start: '17:00', end: '23:00' },
}

function AddShiftForm({ date, onDone }: { date: string; onDone: () => void }) {
  const { data: employees } = useEmployees()
  const create = useCreateShift()
  const active = (employees ?? []).filter((e) => e.active)

  const [employeeId, setEmployeeId] = useState('')
  const [shift, setShift] = useState<ShiftType>('evening')
  const [role, setRole] = useState<StaffRole>('waiter')
  const [start, setStart] = useState(DEFAULT_TIMES.evening.start)
  const [end, setEnd] = useState(DEFAULT_TIMES.evening.end)

  const selected = active.find((e) => e.id === employeeId)
  const roleOptions = selected?.roles.length
    ? selected.roles.map((r) => r.role)
    : STAFF_ROLES

  function pickShift(s: ShiftType) {
    setShift(s)
    setStart(DEFAULT_TIMES[s].start)
    setEnd(DEFAULT_TIMES[s].end)
  }

  async function submit() {
    if (!employeeId) return
    await create.mutateAsync({
      employee_id: employeeId,
      work_date: date,
      shift,
      role,
      start_time: start || null,
      end_time: end || null,
    })
    onDone()
  }

  return (
    <div className="space-y-2 rounded-xl border border-brand-800 bg-neutral-900 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">שיבוץ חדש</span>
        <button onClick={onDone} className="text-neutral-400 hover:text-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-neutral-400">
          אין עובדים פעילים.{' '}
          <Link to="/employees" className="text-brand-400 underline">
            הוסף עובדים
          </Link>
        </p>
      ) : (
        <>
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">— בחר עובד —</option>
            {active.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name}
              </option>
            ))}
          </Select>

          <div className="flex gap-2">
            {SHIFTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pickShift(s)}
                className={cn(
                  'flex-1 rounded-xl py-2 text-sm font-medium',
                  shift === s ? 'bg-brand-700 text-white' : 'bg-neutral-800 text-neutral-300'
                )}
              >
                {SHIFT_LABELS[s]}
              </button>
            ))}
          </div>

          <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              dir="ltr"
              className="h-12 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              dir="ltr"
              className="h-12 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <Button
            onClick={submit}
            loading={create.isPending}
            disabled={!employeeId}
            className="w-full"
          >
            הוסף לסידור
          </Button>
        </>
      )}
    </div>
  )
}
