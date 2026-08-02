import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Download,
  Users,
  ChevronDown,
} from 'lucide-react'
import { useMinWage, useTipReport, calcLine, tipPerHour } from '@/lib/queries/tips'
import { downloadCsv } from '@/lib/exportCsv'
import { formatCurrency, agorotToShekels, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function dmy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

interface DayLine {
  date: string
  hours: number
  tph: number
  tips: number
  topUp: number
  total: number
}
interface EmpAgg {
  id: string
  name: string
  days: number
  hours: number
  tips: number
  topUp: number
  total: number
  lines: DayLine[]
}

export function TipsReport() {
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [open, setOpen] = useState<string | null>(null)

  const from = iso(new Date(month.getFullYear(), month.getMonth(), 1))
  const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const { data: days, isLoading } = useTipReport(from, to)
  const { data: minWage = 3540 } = useMinWage()

  const { emps, totals } = useMemo(() => {
    const map = new Map<string, EmpAgg>()
    for (const day of days ?? []) {
      const dayHours = (day.entries ?? []).reduce((s, e) => s + Number(e.hours), 0)
      const tph = tipPerHour(day.total_tips, dayHours)
      for (const e of day.entries ?? []) {
        if (!e.employee) continue
        const h = Number(e.hours)
        if (!(h > 0)) continue
        const line = calcLine(day.total_tips, dayHours, h, minWage)
        let agg = map.get(e.employee.id)
        if (!agg) {
          agg = {
            id: e.employee.id,
            name: e.employee.full_name,
            days: 0,
            hours: 0,
            tips: 0,
            topUp: 0,
            total: 0,
            lines: [],
          }
          map.set(e.employee.id, agg)
        }
        agg.days += 1
        agg.hours += h
        agg.tips += line.tips
        agg.topUp += line.topUp
        agg.total += line.total
        agg.lines.push({
          date: day.work_date,
          hours: h,
          tph,
          tips: line.tips,
          topUp: line.topUp,
          total: line.total,
        })
      }
    }
    const emps = [...map.values()].sort((a, b) => b.total - a.total)
    const totals = emps.reduce(
      (acc, e) => ({
        hours: acc.hours + e.hours,
        tips: acc.tips + e.tips,
        topUp: acc.topUp + e.topUp,
        total: acc.total + e.total,
      }),
      { hours: 0, tips: 0, topUp: 0, total: 0 }
    )
    return { emps, totals }
  }, [days, minWage])

  const monthLabel = new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
  }).format(month)
  const selKey = from.slice(0, 7)

  function exportCsv() {
    const headers = [
      'עובד',
      'תאריך',
      'שעות',
      'טיפ לשעה (₪)',
      'טיפים (₪)',
      'השלמה (₪)',
      'סה"כ ליום (₪)',
    ]
    const data: (string | number)[][] = []
    for (const e of emps) {
      for (const l of e.lines) {
        data.push([
          e.name,
          dmy(l.date),
          l.hours,
          agorotToShekels(Math.round(l.tph)),
          agorotToShekels(l.tips),
          agorotToShekels(l.topUp),
          agorotToShekels(l.total),
        ])
      }
      // שורת סיכום לעובד
      data.push([
        `${e.name} — סה"כ (${e.days} ימים)`,
        '',
        e.hours,
        '',
        agorotToShekels(e.tips),
        agorotToShekels(e.topUp),
        agorotToShekels(e.total),
      ])
      data.push([])
    }
    data.push([
      'סה"כ הכל',
      '',
      totals.hours,
      '',
      agorotToShekels(totals.tips),
      agorotToShekels(totals.topUp),
      agorotToShekels(totals.total),
    ])
    downloadCsv(`alexander-tips-${selKey}.csv`, headers, data)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/tips" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">דוח טיפים ושכר</h1>
      </div>

      {/* ניווט חודש */}
      <Card className="flex items-center justify-between py-2">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
          aria-label="חודש קודם"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
          aria-label="חודש הבא"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </Card>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : emps.length === 0 ? (
        <EmptyState
          icon={Users}
          title="אין נתונים בחודש זה"
          description="סגירות יום בחודש שנבחר יופיעו כאן, עם פירוט לכל עובד וייצוא לאקסל."
        />
      ) : (
        <>
          {/* סיכום כללי */}
          <Card className="space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-neutral-400">סה"כ לתשלום החודש</p>
                <p className="text-3xl font-extrabold">{formatCurrency(totals.total)}</p>
              </div>
              <div className="text-left text-xs text-neutral-500">
                <p>
                  טיפים <span className="num">{formatCurrency(totals.tips)}</span>
                </p>
                <p className="text-amber-400">
                  השלמות <span className="num">{formatCurrency(totals.topUp)}</span>
                </p>
              </div>
            </div>
            <Button onClick={exportCsv} variant="secondary" className="w-full">
              <Download className="h-4 w-4" />
              ייצוא לאקסל (CSV)
            </Button>
          </Card>

          {/* לכל עובד */}
          <div className="space-y-2">
            {emps.map((e) => {
              const isOpen = open === e.id
              return (
                <Card key={e.id} className="space-y-2">
                  <button
                    onClick={() => setOpen(isOpen ? null : e.id)}
                    className="flex w-full items-center justify-between text-right"
                  >
                    <div>
                      <p className="font-semibold">{e.name}</p>
                      <p className="text-xs text-neutral-500">
                        {e.days} ימים · <span className="num">{e.hours}</span> שעות
                        {e.topUp > 0 && (
                          <span className="text-amber-400">
                            {' '}
                            · השלמה {formatCurrency(e.topUp)}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num font-bold">{formatCurrency(e.total)}</span>
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-neutral-500 transition-transform',
                          isOpen && 'rotate-180'
                        )}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="space-y-1 border-t border-neutral-800 pt-2">
                      {e.lines.map((l, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs text-neutral-400"
                        >
                          <span className="num">{dmy(l.date)}</span>
                          <span className="num">{l.hours} ש'</span>
                          <span className="num">
                            {formatCurrency(Math.round(l.tph))}/ש'
                          </span>
                          <span className="num font-semibold text-neutral-200">
                            {formatCurrency(l.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
