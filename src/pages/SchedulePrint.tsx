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
import { holidaysInRange } from '@/lib/holidays'
import { FullScreenSpinner } from '@/components/ui/Spinner'

function dm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const SHIFT_DOT: Record<ShiftType, string> = {
  morning: '#f59e0b',
  evening: '#6366f1',
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
  const holidays = useMemo(() => holidaysInRange(from, to), [from, to])

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

  const total = shifts?.length ?? 0
  const isWeekend = (i: number) => i === 5 || i === 6

  return (
    <div
      className="mx-auto min-h-screen max-w-[1120px] bg-white p-6 text-[#18181b]"
      dir="rtl"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      <style>{`@page { size: A4 landscape; margin: 10mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
        }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>

      {/* בקרות - לא מודפס */}
      <div className="no-print mb-5 flex items-center justify-between">
        <Link
          to="/schedule"
          className="inline-flex items-center gap-1 text-sm text-[#71717a] hover:text-[#18181b]"
        >
          <ArrowRight className="h-5 w-5" />
          חזרה
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#4338ca] px-4 py-2 font-semibold text-white shadow-sm hover:bg-[#4f46e5]"
        >
          <Printer className="h-4 w-4" />
          הדפס / שמור PDF
        </button>
      </div>

      {/* מסמך */}
      <header className="flex items-end justify-between border-b-2 border-[#4338ca] pb-4">
        <div>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4338ca]">
            סידור עבודה שבועי
          </div>
          <h1 className="text-3xl font-extrabold leading-none tracking-tight">אלכסנדר</h1>
          <p className="mt-1 text-sm text-[#71717a]">דיינר מקומי</p>
        </div>
        <div className="text-left">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
            שבוע
          </div>
          <div className="num text-xl font-bold text-[#18181b]">
            {dm(from)} – {dm(to)}
          </div>
        </div>
      </header>

      {total === 0 ? (
        <p className="py-16 text-center text-[#a1a1aa]">אין שיבוצים בשבוע זה.</p>
      ) : (
        <table className="mt-5 w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[92px]" />
          </colgroup>
          <thead>
            <tr>
              <th className="border-b border-[#e5e7eb] bg-[#f8f8fb] p-2 text-right text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                משמרת
              </th>
              {days.map((d, i) => (
                <th
                  key={i}
                  className="border-b border-r border-[#e5e7eb] p-2 text-center"
                  style={{ background: isWeekend(i) ? '#eef2ff' : '#f8f8fb' }}
                >
                  <div className="text-[14px] font-bold text-[#18181b]">
                    {WEEKDAY_NAMES[i]}
                  </div>
                  <div className="num mt-0.5 text-[11px] font-medium text-[#8a8a94]">
                    {dm(toISODate(d))}
                  </div>
                  {holidays[toISODate(d)] && (
                    <div className="mt-0.5 text-[10px] font-semibold text-[#b45309]">
                      {holidays[toISODate(d)].title}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((shift: ShiftType) => (
              <tr key={shift} className="align-top">
                <td className="border-b border-[#e5e7eb] bg-[#f8f8fb] p-2.5 text-right">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: SHIFT_DOT[shift] }}
                    />
                    <span className="text-[13px] font-bold">{SHIFT_LABELS[shift]}</span>
                  </div>
                </td>
                {days.map((d, i) => {
                  const cell = grid[toISODate(d)]?.[shift] ?? []
                  return (
                    <td
                      key={i}
                      className="border-b border-r border-[#eef0f2] p-2"
                      style={{ background: isWeekend(i) ? '#fafbff' : '#ffffff' }}
                    >
                      {cell.length === 0 ? (
                        <div className="py-1 text-center text-[#d4d4d8]">–</div>
                      ) : (
                        <div className="space-y-1">
                          {cell.map((s) => (
                            <div key={s.id} className="flex items-baseline gap-1.5">
                              <span className="text-[12.5px] font-semibold leading-snug text-[#18181b]">
                                {s.employee?.full_name}
                              </span>
                              <span className="text-[10.5px] text-[#9a9aa4]">
                                {ROLE_LABELS[s.role]}
                              </span>
                              {s.start_time && (
                                <span className="num mr-auto shrink-0 rounded-md bg-[#f1f1f4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#52525b]">
                                  {shortTime(s.start_time)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* כותרת תחתונה */}
      <footer className="mt-5 flex items-center justify-between border-t border-[#e5e7eb] pt-3 text-[11px] text-[#a1a1aa]">
        <span className="font-semibold text-[#71717a]">אלכסנדר · דיינר מקומי</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: SHIFT_DOT.morning }}
            />
            בוקר
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: SHIFT_DOT.evening }}
            />
            ערב
          </span>
        </span>
      </footer>
    </div>
  )
}
