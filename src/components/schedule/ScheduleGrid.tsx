import { useMemo, useState } from 'react'
import { Sun, Moon, Plus, X } from 'lucide-react'
import {
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  type ShiftRow,
} from '@/lib/queries/shifts'
import type { EmployeeWithRoles } from '@/lib/queries/employees'
import type { WeekAvailRow } from '@/lib/queries/availability'
import type { ShiftType, StaffRole } from '@/types/database'
import {
  toISODate,
  WEEKDAY_NAMES,
  SHIFTS,
  SHIFT_LABELS,
  STAFF_ROLES,
  ROLE_LABELS,
  START_TIMES,
  DEFAULT_START,
  shortTime,
} from '@/lib/scheduling'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import type { HolidayInfo } from '@/lib/holidays'

const ROLE_COLOR: Record<StaffRole, string> = {
  waiter: '#6366f1',
  piccolo: '#14b8a6',
  host: '#ec4899',
  bar: '#f59e0b',
  shift_manager: '#a855f7',
}

const SMALL =
  'h-7 rounded-md border border-neutral-700 bg-neutral-900 px-1 text-xs text-neutral-100 focus:border-brand-500 focus:outline-none'

interface GridProps {
  days: Date[]
  byDate: Record<string, ShiftRow[]>
  requiredForWeekday: (
    weekday: number
  ) => Record<ShiftType, Partial<Record<StaffRole, number>>>
  weekAvail: WeekAvailRow[]
  employees: EmployeeWithRoles[]
  holidays: Record<string, HolidayInfo>
}

export function ScheduleGrid({
  days,
  byDate,
  requiredForWeekday,
  weekAvail,
  employees,
  holidays,
}: GridProps) {
  const update = useUpdateShift()
  const toast = useToast()
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null) // "iso|shift"

  const allById = useMemo(() => {
    const m: Record<string, ShiftRow> = {}
    for (const list of Object.values(byDate)) for (const s of list) m[s.id] = s
    return m
  }, [byDate])

  const active = useMemo(() => employees.filter((e) => e.active), [employees])

  // מספר משמרות לעובד השבוע
  const perEmp = useMemo(() => {
    const count: Record<string, number> = {}
    for (const list of Object.values(byDate))
      for (const s of list) count[s.employee_id] = (count[s.employee_id] ?? 0) + 1
    return active.map((e) => ({ e, n: count[e.id] ?? 0 })).sort((a, b) => b.n - a.n)
  }, [byDate, active])
  const maxN = Math.max(1, ...perEmp.map((p) => p.n))

  function isWeekend(i: number) {
    return i === 5 || i === 6
  }

  function onDrop(date: string, shift: ShiftType) {
    setDropTarget(null)
    const id = dragId
    setDragId(null)
    if (!id) return
    const src = allById[id]
    if (!src) return
    if (src.work_date === date && src.shift === shift) return
    const dup = (byDate[date] ?? []).some(
      (a) => a.shift === shift && a.employee_id === src.employee_id
    )
    if (dup) {
      toast.error('העובד כבר משובץ למשמרת הזו')
      return
    }
    update.mutate({ id, patch: { work_date: date, shift } })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-start">
      <div className="overflow-x-auto rounded-2xl border border-neutral-800">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky end-0 w-[70px] bg-neutral-900 p-2"></th>
              {days.map((d, i) => {
                const iso = toISODate(d)
                const hol = holidays[iso]
                return (
                  <th
                    key={iso}
                    className={cn(
                      'border-s border-neutral-800 p-2 text-center',
                      isWeekend(i) ? 'bg-brand-950/20' : 'bg-neutral-900'
                    )}
                  >
                    <div className="text-sm font-extrabold">{WEEKDAY_NAMES[i]}</div>
                    <div className="num text-[11px] text-neutral-500">
                      {iso.slice(8)}/{iso.slice(5, 7)}
                    </div>
                    {hol && (
                      <div className="mt-0.5 text-[10px] font-semibold text-amber-400">
                        {hol.title}
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift) => (
              <tr key={shift}>
                <td className="sticky end-0 border-t border-neutral-800 bg-neutral-900 p-1 text-center align-top">
                  <div
                    className={cn(
                      'mx-auto mb-1 mt-2 flex h-6 w-6 items-center justify-center rounded-lg',
                      shift === 'morning'
                        ? 'bg-amber-950/40 text-amber-400'
                        : 'accent-soft text-brand-500'
                    )}
                  >
                    {shift === 'morning' ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="text-xs font-semibold">{SHIFT_LABELS[shift]}</div>
                </td>
                {days.map((d, i) => {
                  const iso = toISODate(d)
                  const req = requiredForWeekday(i)[shift]
                  const assignments = (byDate[iso] ?? []).filter((a) => a.shift === shift)
                  const key = `${iso}|${shift}`
                  return (
                    <GridCell
                      key={key}
                      date={iso}
                      shift={shift}
                      weekend={isWeekend(i)}
                      assignments={assignments}
                      required={req}
                      employees={active}
                      avail={weekAvail}
                      dropActive={dropTarget === key}
                      onDragStartChip={(id) => setDragId(id)}
                      onDragOverCell={() => setDropTarget(key)}
                      onDragLeaveCell={() => setDropTarget((t) => (t === key ? null : t))}
                      onDropCell={() => onDrop(iso, shift)}
                    />
                  )
                })}
              </tr>
            ))}
            {/* סה"כ ליום */}
            <tr>
              <td className="sticky end-0 border-t border-neutral-800 bg-neutral-900 p-2 text-center text-[11px] font-semibold text-neutral-500">
                צוות ליום
              </td>
              {days.map((d, i) => {
                const iso = toISODate(d)
                const n = (byDate[iso] ?? []).length
                return (
                  <td
                    key={iso}
                    className={cn(
                      'border-s border-t border-neutral-800 p-2 text-center',
                      isWeekend(i) ? 'bg-brand-950/20' : 'bg-neutral-900'
                    )}
                  >
                    <span className="num text-base font-extrabold">{n}</span>
                    <span className="block text-[10px] text-neutral-500">משמרות</span>
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* משמרות השבוע לעובד */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
        <h3 className="mb-2 text-sm font-bold">משמרות השבוע לעובד</h3>
        <div className="space-y-1.5">
          {perEmp.map(({ e, n }) => (
            <div key={e.id} className="flex items-center gap-2">
              <span className="flex-1 truncate text-sm">{e.full_name}</span>
              <span className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-800">
                <span
                  className="block h-full rounded-full bg-brand-600"
                  style={{ width: `${(n / maxN) * 100}%` }}
                />
              </span>
              <span className="num w-6 text-left text-sm font-bold">{n}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
          {STAFF_ROLES.map((r) => (
            <span key={r} className="inline-flex items-center gap-1">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: ROLE_COLOR[r] }}
              />
              {ROLE_LABELS[r]}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function GridCell({
  date,
  shift,
  weekend,
  assignments,
  required,
  employees,
  avail,
  dropActive,
  onDragStartChip,
  onDragOverCell,
  onDragLeaveCell,
  onDropCell,
}: {
  date: string
  shift: ShiftType
  weekend: boolean
  assignments: ShiftRow[]
  required: Partial<Record<StaffRole, number>>
  employees: EmployeeWithRoles[]
  avail: WeekAvailRow[]
  dropActive: boolean
  onDragStartChip: (id: string) => void
  onDragOverCell: () => void
  onDragLeaveCell: () => void
  onDropCell: () => void
}) {
  const create = useCreateShift()
  const update = useUpdateShift()
  const del = useDeleteShift()
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const empById: Record<string, EmployeeWithRoles> = {}
  for (const e of employees) empById[e.id] = e

  // זמינות
  const availIds = new Set<string>()
  const unavailIds = new Set<string>()
  for (const a of avail)
    if (a.work_date === date && a.shift === shift)
      (a.available ? availIds : unavailIds).add(a.employee_id)

  const assignedIds = new Set(assignments.map((a) => a.employee_id))
  const rank = (id: string) => (availIds.has(id) ? 0 : unavailIds.has(id) ? 2 : 1)
  const pickable = [...employees]
    .filter((e) => !assignedIds.has(e.id))
    .sort((a, b) => rank(a.id) - rank(b.id))

  // כיסוי
  const byRole: Partial<Record<StaffRole, number>> = {}
  for (const a of assignments) byRole[a.role] = (byRole[a.role] ?? 0) + 1
  const cov = STAFF_ROLES.map((role) => ({
    role,
    have: byRole[role] ?? 0,
    need: required[role] ?? 0,
  })).filter((r) => r.need > 0 || r.have > 0)

  function add(e: EmployeeWithRoles) {
    create.mutate({
      employee_id: e.id,
      work_date: date,
      shift,
      role: e.roles[0]?.role ?? 'waiter',
      start_time: DEFAULT_START[shift],
      end_time: null,
      employee: { id: e.id, full_name: e.full_name, hourly_rate: e.hourly_rate },
    })
  }

  return (
    <td
      onDragOver={(e) => {
        e.preventDefault()
        onDragOverCell()
      }}
      onDragLeave={onDragLeaveCell}
      onDrop={onDropCell}
      className={cn(
        'min-w-[120px] border-s border-t border-neutral-800 p-1.5 align-top',
        weekend ? 'bg-brand-950/10' : 'bg-neutral-950/30',
        dropActive && 'ring-2 ring-inset ring-brand-500'
      )}
    >
      {cov.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {cov.map(({ role, have, need }) => (
            <span
              key={role}
              className={cn(
                'num rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                need > 0 && have < need
                  ? 'bg-red-950/50 text-red-300'
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
      )}

      <div className="space-y-1">
        {assignments.map((a) => {
          const roles = empById[a.employee_id]?.roles.map((r) => r.role) ?? []
          const editing = editId === a.id
          return (
            <div key={a.id}>
              <div
                draggable
                onDragStart={() => onDragStartChip(a.id)}
                onClick={() => setEditId(editing ? null : a.id)}
                className="flex cursor-grab items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-1.5 py-1 active:cursor-grabbing"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: ROLE_COLOR[a.role] }}
                />
                <span className="flex-1 truncate text-xs font-medium">
                  {a.employee?.full_name ?? 'עובד'}
                </span>
                <span className="num text-[11px] text-neutral-500">
                  {shortTime(a.start_time)}
                </span>
              </div>
              {editing && (
                <div className="mt-1 flex items-center gap-1 rounded-lg bg-neutral-950/70 p-1.5">
                  <select
                    value={shortTime(a.start_time)}
                    onChange={(ev) =>
                      update.mutate({ id: a.id, patch: { start_time: ev.target.value } })
                    }
                    className={cn(SMALL, 'num')}
                    dir="ltr"
                  >
                    {START_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {roles.length > 1 && (
                    <select
                      value={a.role}
                      onChange={(ev) =>
                        update.mutate({
                          id: a.id,
                          patch: { role: ev.target.value as StaffRole },
                        })
                      }
                      className={SMALL}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => {
                      del.mutate(a.id)
                      setEditId(null)
                    }}
                    aria-label="הסר"
                    className="mr-auto rounded p-1 text-neutral-500 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {adding ? (
        <div className="mt-1 space-y-1 rounded-lg bg-neutral-950/70 p-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-500">ירוק = זמין</span>
            <button
              onClick={() => setAdding(false)}
              aria-label="סגור"
              className="text-neutral-500 hover:text-neutral-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {pickable.map((e) => (
              <button
                key={e.id}
                onClick={() => add(e)}
                className={cn(
                  'rounded-full px-2 py-1 text-[11px] font-medium',
                  availIds.has(e.id)
                    ? 'bg-green-950/60 text-green-300'
                    : unavailIds.has(e.id)
                      ? 'bg-neutral-800 text-neutral-500'
                      : 'bg-neutral-800 text-neutral-300'
                )}
              >
                {e.full_name}
                {unavailIds.has(e.id) && ' ·לא'}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-800 py-1 text-[11px] font-semibold text-accent hover:border-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
          הוסף
        </button>
      )}
    </td>
  )
}
