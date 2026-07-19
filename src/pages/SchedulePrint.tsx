import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Printer } from 'lucide-react'
import { useShifts, type ShiftRow } from '@/lib/queries/shifts'
import { useEmployees } from '@/lib/queries/employees'
import {
  addDays,
  toISODate,
  WEEKDAY_NAMES,
  ROLE_LABELS,
  SHIFT_LABELS,
  shortTime,
} from '@/lib/scheduling'
import { FullScreenSpinner } from '@/components/ui/Spinner'

function dm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function SchedulePrint() {
  const { from = '' } = useParams()
  const start = new Date(from + 'T00:00:00')
  const to = toISODate(addDays(start, 6))
  const { data: shifts, isLoading } = useShifts(from, to)
  const { data: employees } = useEmployees()

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [from]
  )

  const grid = useMemo(() => {
    // map[empId][iso] = shifts
    const m: Record<string, Record<string, ShiftRow[]>> = {}
    for (const s of shifts ?? []) {
      ;(m[s.employee_id] ??= {})[s.work_date] ??= []
      m[s.employee_id][s.work_date].push(s)
    }
    for (const emp in m)
      for (const d in m[emp])
        m[emp][d].sort((a, b) =>
          a.shift === b.shift ? 0 : a.shift === 'morning' ? -1 : 1
        )
    return m
  }, [shifts])

  const rows = useMemo(() => {
    return (employees ?? [])
      .filter((e) => grid[e.id])
      .map((e) => ({ id: e.id, name: e.full_name }))
  }, [employees, grid])

  if (isLoading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-white p-4 text-neutral-900" dir="rtl">
      <style>{`@page { size: A4 landscape; margin: 8mm; }
        @media print { .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/schedule" className="text-neutral-500">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 font-semibold text-white"
        >
          <Printer className="h-4 w-4" />
          הדפס / שמור PDF
        </button>
      </div>

      <h1 className="mb-1 text-center text-xl font-bold">
        סידור עבודה · אלכסנדר
      </h1>
      <p className="mb-4 text-center text-sm text-neutral-600">
        {dm(from)} – {dm(to)}
      </p>

      {rows.length === 0 ? (
        <p className="text-center text-neutral-500">אין שיבוצים בשבוע זה.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-neutral-300 bg-neutral-100 p-2 text-right">
                עובד
              </th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className="border border-neutral-300 bg-neutral-100 p-2 text-center"
                >
                  <div>{WEEKDAY_NAMES[i]}</div>
                  <div className="text-xs font-normal text-neutral-500">
                    {dm(toISODate(d))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="border border-neutral-300 p-2 font-medium">{r.name}</td>
                {days.map((d, i) => {
                  const iso = toISODate(d)
                  const cell = grid[r.id]?.[iso] ?? []
                  return (
                    <td
                      key={i}
                      className="border border-neutral-300 p-2 text-center align-top"
                    >
                      {cell.map((s) => (
                        <div key={s.id} className="whitespace-nowrap">
                          {SHIFT_LABELS[s.shift]}
                          {s.start_time ? ` ${shortTime(s.start_time)}` : ''}
                          <span className="text-xs text-neutral-500">
                            {' '}
                            {ROLE_LABELS[s.role]}
                          </span>
                        </div>
                      ))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
