import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  X,
  Users,
  Sun,
  Moon,
  SlidersHorizontal,
  Send,
  Printer,
} from 'lucide-react'
import { useEmployees, type EmployeeWithRoles } from '@/lib/queries/employees'
import { useRequirements } from '@/lib/queries/requirements'
import {
  useWeekAvailability,
  useUnlockWeek,
  useLockWeek,
  useWeekLockCount,
  type WeekAvailRow,
} from '@/lib/queries/availability'
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
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
  START_TIMES,
  DEFAULT_START,
} from '@/lib/scheduling'
import { formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'

export function Schedule() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const from = toISODate(weekStart)
  const to = toISODate(addDays(weekStart, 6))
  const { data: shifts, isLoading } = useShifts(from, to)
  const { data: reqs } = useRequirements()
  const { data: weekAvail } = useWeekAvailability(from, to)
  const { data: employees } = useEmployees()
  const [view, setView] = useState<'schedule' | 'availability'>('schedule')

  // דרישות: ברירת מחדל + התאמות ליום. יום עם התאמה מחליף לגמרי את ברירת המחדל.
  const requiredForWeekday = useMemo(() => {
    const defaults: Record<ShiftType, Partial<Record<StaffRole, number>>> = {
      morning: {},
      evening: {},
    }
    const overrides: Record<
      number,
      Record<ShiftType, Partial<Record<StaffRole, number>>>
    > = {}
    for (const r of reqs ?? []) {
      if (r.weekday == null) {
        defaults[r.shift][r.role] = r.required_count
      } else {
        overrides[r.weekday] ??= { morning: {}, evening: {} }
        overrides[r.weekday][r.shift][r.role] = r.required_count
      }
    }
    return (weekday: number) => overrides[weekday] ?? defaults
  }, [reqs])

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
        <div className="flex gap-2">
          <Link to="/requirements">
            <Button size="sm" variant="secondary">
              <SlidersHorizontal className="h-4 w-4" />
              איוש
            </Button>
          </Link>
          <Link to="/employees">
            <Button size="sm" variant="secondary">
              <Users className="h-4 w-4" />
              עובדים
            </Button>
          </Link>
        </div>
      </div>

      {/* מתג תצוגה: סידור / זמינות */}
      <div className="flex gap-2">
        {(['schedule', 'availability'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'flex-1 rounded-xl py-2 text-sm font-semibold transition-colors',
              view === v ? 'bg-brand-700 text-white' : 'bg-neutral-800 text-neutral-300'
            )}
          >
            {v === 'schedule' ? 'סידור' : 'זמינות'}
          </button>
        ))}
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

      {view === 'schedule' && (shifts?.length ?? 0) > 0 && (
        <div className="flex gap-2">
          <Link to={`/schedule/send/${from}`} className="flex-1">
            <Button className="w-full">
              <Send className="h-4 w-4" />
              שלח בוואטסאפ
            </Button>
          </Link>
          <Link to={`/schedule/print/${from}`} className="flex-1">
            <Button variant="secondary" className="w-full">
              <Printer className="h-4 w-4" />
              טבלה / PDF
            </Button>
          </Link>
        </div>
      )}

      {view === 'availability' ? (
        <AvailabilityBoard
          days={days}
          weekAvail={weekAvail ?? []}
          employees={employees ?? []}
          weekStart={from}
        />
      ) : isLoading ? (
        <ListSkeleton rows={7} />
      ) : (
        <div className="stagger space-y-3">
          {days.map((day, i) => {
            const iso = toISODate(day)
            const dayShifts = byDate[iso] ?? []
            const req = requiredForWeekday(i)
            return (
              <Card key={iso} className="space-y-2.5">
                <div>
                  <span className="font-semibold">יום {WEEKDAY_NAMES[i]}</span>
                  <span className="mr-2 text-sm text-neutral-500">{formatDate(day)}</span>
                </div>
                {SHIFTS.map((sh) => (
                  <ShiftSection
                    key={sh}
                    date={iso}
                    shift={sh}
                    assignments={dayShifts.filter((s) => s.shift === sh)}
                    required={req[sh]}
                    avail={weekAvail ?? []}
                    employees={employees ?? []}
                  />
                ))}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AvailabilityBoard({
  days,
  weekAvail,
  employees,
  weekStart,
}: {
  days: Date[]
  weekAvail: WeekAvailRow[]
  employees: EmployeeWithRoles[]
  weekStart: string
}) {
  const nameById: Record<string, string> = {}
  for (const e of employees) nameById[e.id] = e.full_name
  const lock = useLockWeek()
  const unlock = useUnlockWeek()
  const { data: lockCount } = useWeekLockCount(weekStart)
  const isLocked = (lockCount ?? 0) > 0

  async function doLock() {
    const ids = employees.filter((e) => e.active).map((e) => e.id)
    await lock.mutateAsync({ weekStart, employeeIds: ids })
  }
  async function doUnlock() {
    await unlock.mutateAsync(weekStart)
  }

  // מי טרם שלח זמינות לשבוע זה
  const submittedIds = new Set(weekAvail.map((a) => a.employee_id))
  const missing = employees.filter((e) => e.active && !submittedIds.has(e.id))

  return (
    <div className="space-y-3">
      <Link to={`/schedule/request/${weekStart}`}>
        <Button variant="secondary" className="w-full">
          <Send className="h-4 w-4" />
          בקש זמינות לשבוע זה
        </Button>
      </Link>

      {isLocked ? (
        <Button
          variant="secondary"
          onClick={doUnlock}
          loading={unlock.isPending}
          className="w-full"
        >
          🔓 פתח זמינות לעריכה
        </Button>
      ) : (
        <Button onClick={doLock} loading={lock.isPending} className="w-full">
          🔒 נעל זמינות (מתחילים לבנות)
        </Button>
      )}

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3">
          <p className="text-sm font-medium text-amber-200">
            טרם שלחו זמינות ({missing.length}):
          </p>
          <p className="mt-1 text-sm text-amber-400/80">
            {missing.map((e) => e.full_name).join(' · ')}
          </p>
        </div>
      )}
      {days.map((day, i) => {
        const iso = toISODate(day)
        return (
          <Card key={iso} className="space-y-2">
            <div>
              <span className="font-semibold">יום {WEEKDAY_NAMES[i]}</span>
              <span className="mr-2 text-sm text-neutral-500">{formatDate(day)}</span>
            </div>
            {SHIFTS.map((shift) => {
              const names = weekAvail
                .filter((a) => a.work_date === iso && a.shift === shift && a.available)
                .map((a) => nameById[a.employee_id])
                .filter(Boolean)
              const Icon = shift === 'morning' ? Sun : Moon
              return (
                <div key={shift} className="flex items-start gap-2">
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      shift === 'morning' ? 'text-amber-400' : 'text-brand-500'
                    )}
                  />
                  {names.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {names.map((n, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-green-950/50 px-2 py-0.5 text-xs text-green-300"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-600">אין זמינות</span>
                  )}
                </div>
              )
            })}
          </Card>
        )
      })}
    </div>
  )
}

const SMALL_SELECT =
  'h-8 rounded-lg border border-neutral-700 bg-neutral-900 px-1.5 text-xs text-neutral-100 focus:border-brand-500 focus:outline-none'

function ShiftSection({
  date,
  shift,
  assignments,
  required,
  avail,
  employees,
}: {
  date: string
  shift: ShiftType
  assignments: ShiftRow[]
  required: Partial<Record<StaffRole, number>>
  avail: WeekAvailRow[]
  employees: EmployeeWithRoles[]
}) {
  const create = useCreateShift()
  const update = useUpdateShift()
  const del = useDeleteShift()
  const [open, setOpen] = useState(false)
  const [defStart, setDefStart] = useState(DEFAULT_START[shift])

  const active = employees.filter((e) => e.active)
  const empById: Record<string, EmployeeWithRoles> = {}
  for (const e of active) empById[e.id] = e

  // זמינות ליום ולמשמרת
  const availableIds = new Set<string>()
  const unavailableIds = new Set<string>()
  for (const a of avail)
    if (a.work_date === date && a.shift === shift)
      (a.available ? availableIds : unavailableIds).add(a.employee_id)

  const assignedIds = new Set(assignments.map((a) => a.employee_id))
  const rankOf = (id: string) =>
    availableIds.has(id) ? 0 : unavailableIds.has(id) ? 2 : 1
  const pickable = [...active].sort((a, b) => rankOf(a.id) - rankOf(b.id))

  // כיסוי
  const byRole: Partial<Record<StaffRole, number>> = {}
  for (const a of assignments) byRole[a.role] = (byRole[a.role] ?? 0) + 1
  const covRoles = STAFF_ROLES.map((role) => ({
    role,
    have: byRole[role] ?? 0,
    need: required[role] ?? 0,
  })).filter((r) => r.need > 0 || r.have > 0)

  // כפילות: אותו עובד יותר מפעם אחת במשמרת זו
  const dupCount: Record<string, number> = {}
  for (const a of assignments)
    dupCount[a.employee_id] = (dupCount[a.employee_id] ?? 0) + 1
  const hasDup = Object.values(dupCount).some((n) => n > 1)

  function toggle(emp: EmployeeWithRoles) {
    const existing = assignments.find((a) => a.employee_id === emp.id)
    if (existing) {
      del.mutate(existing.id)
    } else {
      create.mutate({
        employee_id: emp.id,
        work_date: date,
        shift,
        role: emp.roles[0]?.role ?? 'waiter',
        start_time: defStart,
        end_time: null,
        employee: {
          id: emp.id,
          full_name: emp.full_name,
          hourly_rate: emp.hourly_rate,
        },
      })
    }
  }

  const Icon = shift === 'morning' ? Sun : Moon
  return (
    <div className="space-y-2 rounded-xl border border-neutral-800 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Icon
            className={cn(
              'h-4 w-4',
              shift === 'morning' ? 'text-amber-400' : 'text-brand-500'
            )}
          />
          <span className="text-sm font-semibold">{SHIFT_LABELS[shift]}</span>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {covRoles.map(({ role, have, need }) => (
            <span
              key={role}
              className={cn(
                'num rounded-full px-2 py-0.5 text-xs',
                have < need
                  ? 'bg-red-950/60 text-red-300'
                  : need > 0
                    ? 'bg-green-950/50 text-green-300'
                    : 'bg-neutral-800 text-neutral-400'
              )}
            >
              {ROLE_LABELS[role]} {have}
              {need > 0 && `/${need}`}
            </span>
          ))}
        </div>
      </div>

      {hasDup && <p className="text-xs text-red-400">⚠️ עובד משובץ פעמיים במשמרת זו</p>}

      {/* משובצים */}
      {assignments.map((a) => {
        const roles = empById[a.employee_id]?.roles.map((r) => r.role) ?? []
        return (
          <div
            key={a.id}
            className="flex items-center gap-2 rounded-lg bg-neutral-800/50 px-2 py-1.5"
          >
            <span className="flex-1 truncate text-sm font-medium">
              {a.employee?.full_name ?? 'עובד'}
            </span>
            {roles.length > 1 ? (
              <select
                value={a.role}
                onChange={(e) =>
                  update.mutate({
                    id: a.id,
                    patch: { role: e.target.value as StaffRole },
                  })
                }
                className={SMALL_SELECT}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-neutral-400">{ROLE_LABELS[a.role]}</span>
            )}
            <select
              value={shortTime(a.start_time)}
              onChange={(e) =>
                update.mutate({ id: a.id, patch: { start_time: e.target.value } })
              }
              className={cn(SMALL_SELECT, 'num')}
              dir="ltr"
            >
              {START_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => del.mutate(a.id)}
              className="rounded-lg p-1 text-neutral-500 hover:text-red-400"
              aria-label="הסר"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )
      })}

      {/* מילוי מהיר */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-700 py-1.5 text-sm text-brand-400 hover:border-brand-600"
        >
          <Plus className="h-4 w-4" />
          מלא משמרת
        </button>
      ) : (
        <div className="space-y-2 rounded-lg bg-neutral-950/60 p-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">שעת התחלה:</span>
            <select
              value={defStart}
              onChange={(e) => setDefStart(e.target.value)}
              className={cn(SMALL_SELECT, 'num')}
              dir="ltr"
            >
              {START_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => setOpen(false)}
              className="mr-auto text-neutral-400 hover:text-neutral-100"
              aria-label="סגור"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            הקלק על עובד להוספה/הסרה. ירוק = זמין למשמרת.
          </p>
          <div className="flex flex-wrap gap-2">
            {pickable.map((e) => {
              const isAssigned = assignedIds.has(e.id)
              const isAvail = availableIds.has(e.id)
              const isUnavail = unavailableIds.has(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    isAssigned
                      ? 'bg-brand-700 text-white'
                      : isAvail
                        ? 'bg-green-950/60 text-green-300'
                        : isUnavail
                          ? 'bg-neutral-800 text-neutral-500'
                          : 'bg-neutral-800 text-neutral-300'
                  )}
                >
                  {isAssigned && '✓ '}
                  {e.full_name}
                  {isUnavail && !isAssigned && ' · לא זמין'}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
