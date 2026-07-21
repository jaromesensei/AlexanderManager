import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Printer } from 'lucide-react'
import { useShifts, type ShiftRow } from '@/lib/queries/shifts'
import {
  addDays,
  toISODate,
  WEEKDAY_NAMES,
  ROLE_LABELS,
  SHIFT_LABELS,
  SHIFTS,
  shortTime,
} from '@/lib/scheduling'
import type { ShiftType } from '@/types/database'
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

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    [from]
  )

  // grid[iso][shift] = שיבוצים ממויינים
  const grid = useMemo(() => {
    const m: Record<string, Record<string, ShiftRow[]>> = {}
    for (const s of shifts ?? []) {
      ;((m[s.work_date] ??= {})[s.shift] ??= []).push(s)
    }
    for (const d in m)
      for (const sh in m[d])
        m[d][sh].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
    return m
  }, [shifts])

  if (isLoading) return <FullScreenSpinner />

  return (
    <div className="min-h-screen bg-white p-4 text-[#18181b]" dir="rtl">
      <style>{`@page { size: A4 landscape; margin: 8mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
        }`}</style>

      <div className="no-print mb-4 flex items-center justify-between">
        <Link to="/schedule" className="text-[#71717a]">
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

      <h1 className="mb-1 text-center text-xl font-bold">סידור עבודה · אלכסנדר</h1>
      <p className="mb-4 text-center text-sm text-[#52525b]">
        {dm(from)} – {dm(to)}
      </p>

      {(shifts?.length ?? 0) === 0 ? (
        <p className="text-center text-[#71717a]">אין שיבוצים בשבוע זה.</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-16 border border-[#a3a3a3] bg-[#f4f4f5] p-2"></th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className="border border-[#a3a3a3] bg-[#f4f4f5] p-1.5 text-center"
                >
                  <div className="font-bold">{WEEKDAY_NAMES[i]}</div>
                  <div className="text-xs font-normal text-[#71717a]">
                    {dm(toISODate(d))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift: ShiftType) => (
              <tr key={shift}>
                <td className="border border-[#a3a3a3] bg-[#fafafa] p-1.5 text-center font-bold">
                  {SHIFT_LABELS[shift]}
                </td>
                {days.map((d, i) => {
                  const cell = grid[toISODate(d)]?.[shift] ?? []
                  return (
                    <td
                      key={i}
                      className="border border-[#a3a3a3] p-1.5 align-top text-xs leading-relaxed"
                    >
                      {cell.map((s) => (
                        <div key={s.id}>
                          {s.employee?.full_name}{' '}
                          <span className="text-[#71717a]">({ROLE_LABELS[s.role]})</span>
                          {s.start_time && (
                            <span className="text-[#52525b]">
                              {' '}
                              {shortTime(s.start_time)}
                            </span>
                          )}
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
