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
} from 'lucide-react'
import { useEmployees } from '@/lib/queries/employees'
import { useRequirements } from '@/lib/queries/requirements'
import {
  useWeekAvailability,
  useUnlockWeek,
  type WeekAvailRow,
} from '@/lib/queries/availability'
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
  START_TIMES,
  DEFAULT_START,
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
  const { data: reqs } = useRequirements()
  const { data: weekAvail } = useWeekAvailability(from, to)
  const { data: employees } = useEmployees()
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const [view, setView] = useState<'schedule' | 'availability'>('schedule')

  // דרישות: ברירת מחדל + התאמות ליום. יום עם התאמה מחליף לגמרי את ברירת המחדל.
  const requiredForWeekday = useMemo(() => {
    const defaults: Record<ShiftType, Partial<Record<StaffRole, number>>> = {
      morning: {},
      evening: {},
    }
    const overrides: Record<number, Record<ShiftType, Partial<Record<StaffRole, number>>>> =
      {}
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
        <Link to={`/schedule/send/${from}`}>
          <Button className="w-full">
            <Send className="h-4 w-4" />
            שלח לצוות בוואטסאפ
          </Button>
        </Link>
      )}

      {view === 'availability' ? (
        <AvailabilityBoard
          days={days}
          weekAvail={weekAvail ?? []}
          employees={employees ?? []}
          weekStart={from}
        />
      ) : isLoading ? (
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

                <Coverage dayShifts={dayShifts} required={requiredForWeekday(i)} />

                {dayShifts.length === 0 && addingDate !== iso && (
                  <p className="text-sm text-neutral-600">אין שיבוצים</p>
                )}

                {dayShifts.map((s) => (
                  <ShiftLine key={s.id} shift={s} />
                ))}

                {addingDate === iso && (
                  <AddShiftForm
                    date={iso}
                    avail={weekAvail ?? []}
                    onDone={() => setAddingDate(null)}
                  />
                )}
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
  employees: { id: string; full_name: string }[]
  weekStart: string
}) {
  const nameById: Record<string, string> = {}
  for (const e of employees) nameById[e.id] = e.full_name
  const unlock = useUnlockWeek()
  const [unlocked, setUnlocked] = useState(false)

  async function doUnlock() {
    if (!confirm('לפתוח לעובדים לערוך מחדש את הזמינות לשבוע זה?')) return
    await unlock.mutateAsync(weekStart)
    setUnlocked(true)
    setTimeout(() => setUnlocked(false), 2500)
  }

  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        onClick={doUnlock}
        loading={unlock.isPending}
        className="w-full"
      >
        {unlocked ? 'נפתח לעריכה ✓' : '🔓 פתח זמינות לעובדים (השבוע הזה)'}
      </Button>
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
                      shift === 'morning' ? 'text-amber-400' : 'text-indigo-400'
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

function Coverage({
  dayShifts,
  required,
}: {
  dayShifts: ShiftRow[]
  required: Record<ShiftType, Partial<Record<StaffRole, number>>>
}) {
  const rows = SHIFTS.map((shift) => {
    const assigned: Partial<Record<StaffRole, number>> = {}
    for (const s of dayShifts)
      if (s.shift === shift) assigned[s.role] = (assigned[s.role] ?? 0) + 1
    const roles = STAFF_ROLES.map((role) => ({
      role,
      have: assigned[role] ?? 0,
      need: required[shift][role] ?? 0,
    })).filter((r) => r.need > 0 || r.have > 0)
    return { shift, roles }
  }).filter((r) => r.roles.length > 0)

  if (rows.length === 0) return null

  return (
    <div className="space-y-1.5">
      {rows.map(({ shift, roles }) => (
        <div key={shift} className="flex flex-wrap items-center gap-1.5">
          {shift === 'morning' ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          )}
          {roles.map(({ role, have, need }) => {
            const short = have < need
            return (
              <span
                key={role}
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs num',
                  short
                    ? 'bg-red-950/60 text-red-300'
                    : need > 0
                      ? 'bg-green-950/50 text-green-300'
                      : 'bg-neutral-800 text-neutral-400'
                )}
              >
                {ROLE_LABELS[role]} {have}
                {need > 0 && `/${need}`}
              </span>
            )
          })}
        </div>
      ))}
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
          {shift.start_time && (
            <p className="num text-xs text-neutral-400">משעה {shortTime(shift.start_time)}</p>
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

function AddShiftForm({
  date,
  avail,
  onDone,
}: {
  date: string
  avail: WeekAvailRow[]
  onDone: () => void
}) {
  const { data: employees } = useEmployees()
  const create = useCreateShift()
  const active = (employees ?? []).filter((e) => e.active)

  const [employeeId, setEmployeeId] = useState('')
  const [shift, setShift] = useState<ShiftType>('evening')
  const [role, setRole] = useState<StaffRole>('waiter')
  const [start, setStart] = useState(DEFAULT_START.evening)

  // זמינות ליום ולמשמרת הנבחרים
  const availableIds = new Set<string>()
  const unavailableIds = new Set<string>()
  for (const a of avail) {
    if (a.work_date === date && a.shift === shift)
      (a.available ? availableIds : unavailableIds).add(a.employee_id)
  }
  const rank = (id: string) => (availableIds.has(id) ? 0 : unavailableIds.has(id) ? 2 : 1)
  const sortedEmployees = [...active].sort((a, b) => rank(a.id) - rank(b.id))
  const chosenUnavailable = employeeId && unavailableIds.has(employeeId)

  const selected = active.find((e) => e.id === employeeId)
  const roleOptions = selected?.roles.length
    ? selected.roles.map((r) => r.role)
    : STAFF_ROLES

  function pickShift(s: ShiftType) {
    setShift(s)
    setStart(DEFAULT_START[s])
  }

  async function submit() {
    if (!employeeId) return
    await create.mutateAsync({
      employee_id: employeeId,
      work_date: date,
      shift,
      role,
      start_time: start || null,
      end_time: null,
    })
    onDone()
  }

  return (
    <div className="space-y-3 rounded-xl border border-brand-800 bg-neutral-900 p-3">
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
          {/* בחירת משמרת קודם - משפיעה על הזמינות */}
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

          {/* עובדים - זמינים ירוקים וראשונים */}
          <div>
            <p className="mb-1.5 text-xs text-neutral-400">
              בחר עובד (ירוק = זמין למשמרת זו)
            </p>
            <div className="flex flex-wrap gap-2">
              {sortedEmployees.map((e) => {
                const isAvail = availableIds.has(e.id)
                const isUnavail = unavailableIds.has(e.id)
                const isSel = employeeId === e.id
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setEmployeeId(e.id)
                      const rs = e.roles.map((r) => r.role)
                      if (rs.length) setRole(rs[0])
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                      isSel
                        ? 'bg-brand-700 text-white ring-2 ring-brand-400'
                        : isAvail
                          ? 'bg-green-950/60 text-green-300'
                          : isUnavail
                            ? 'bg-neutral-800 text-neutral-500'
                            : 'bg-neutral-800 text-neutral-300'
                    )}
                  >
                    {e.full_name}
                    {isUnavail && ' · לא זמין'}
                  </button>
                )
              })}
            </div>
          </div>

          {chosenUnavailable && (
            <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
              ⚠️ העובד סימן שאינו זמין במשמרת זו
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <Select value={start} onChange={(e) => setStart(e.target.value)}>
              {START_TIMES.map((t) => (
                <option key={t} value={t}>
                  משעה {t}
                </option>
              ))}
            </Select>
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
