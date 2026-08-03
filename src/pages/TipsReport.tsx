import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Download,
  Printer,
  Users,
  ChevronDown,
} from 'lucide-react'
import {
  useMinWage,
  useTravelPerDay,
  useTipReport,
  aggregateReport,
} from '@/lib/queries/tips'
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
function weekdayLetter(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'][new Date(y, m - 1, d).getDay()]
}
function fmtHours(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export function TipsReport() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [open, setOpen] = useState<string | null>(null)

  const from = iso(new Date(month.getFullYear(), month.getMonth(), 1))
  const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const { data: days, isLoading } = useTipReport(from, to)
  const { data: minWage = 3540 } = useMinWage()
  const { data: travelPerDay = 1700 } = useTravelPerDay()

  const { emps, totals } = useMemo(
    () => aggregateReport(days ?? [], minWage, travelPerDay),
    [days, minWage, travelPerDay]
  )

  const monthLabel = new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
  }).format(month)
  const selKey = from.slice(0, 7)

  function exportCsv() {
    const headers = [
      'עובד',
      'תאריך',
      'יום',
      'שעות',
      'מזה שבת',
      'טיפ לשעה (₪)',
      'טיפים (₪)',
      'בסיס מינימום (₪)',
      'השלמה (₪)',
      'מעל הבסיס (₪)',
      'נסיעות (₪)',
      'סה"כ לתשלום (₪)',
    ]
    const data: (string | number)[][] = []
    for (const e of emps) {
      for (const l of e.lines) {
        data.push([
          e.name,
          dmy(l.date),
          weekdayLetter(l.date),
          l.hours,
          l.shabbatHours || '',
          agorotToShekels(Math.round(l.tph)),
          agorotToShekels(l.tips),
          agorotToShekels(l.base),
          agorotToShekels(l.topUp),
          '',
          '',
          agorotToShekels(l.total),
        ])
      }
      data.push([
        `${e.name} — סה"כ`,
        `${e.days} ימים`,
        '',
        e.hours,
        e.shabbatHours || '',
        '',
        agorotToShekels(e.tips),
        agorotToShekels(e.base),
        agorotToShekels(e.topUp),
        agorotToShekels(e.over),
        agorotToShekels(e.travel),
        agorotToShekels(e.total),
      ])
    }
    const totalShabbat = emps.reduce((s, e) => s + e.shabbatHours, 0)
    data.push([
      'סה"כ הכל',
      '',
      '',
      totals.hours,
      totalShabbat || '',
      '',
      agorotToShekels(totals.tips),
      agorotToShekels(totals.base),
      agorotToShekels(totals.topUp),
      agorotToShekels(totals.over),
      agorotToShekels(totals.travel),
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
          description="סגירות יום בחודש שנבחר יופיעו כאן, עם פירוט לכל עובד, ייצוא והדפסה."
        />
      ) : (
        <>
          {/* סיכום כללי */}
          <Card className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-neutral-400">סה"כ לתשלום החודש</p>
                <p className="text-3xl font-extrabold">{formatCurrency(totals.total)}</p>
              </div>
              <div className="text-left text-xs text-neutral-500">
                <p>
                  טיפים <span className="num">{formatCurrency(totals.tips)}</span>
                </p>
                <p>
                  נסיעות <span className="num">{formatCurrency(totals.travel)}</span>
                </p>
                <p className="text-green-400">
                  מעל הבסיס <span className="num">{formatCurrency(totals.over)}</span>
                </p>
                <p className="text-amber-400">
                  השלמות <span className="num">{formatCurrency(totals.topUp)}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => navigate(`/tips/report/print/${selKey}`)}
                className="w-full"
              >
                <Printer className="h-4 w-4" />
                הדפסה מפורטת
              </Button>
              <Button onClick={exportCsv} variant="secondary" className="w-full">
                <Download className="h-4 w-4" />
                ייצוא לאקסל
              </Button>
            </div>
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
                        {e.days} ימים · רגילות{' '}
                        <span className="num">{fmtHours(e.hours - e.shabbatHours)}</span>{' '}
                        · שבת <span className="num">{fmtHours(e.shabbatHours)}</span> ·
                        סה"כ <span className="num">{fmtHours(e.hours)}</span> ש'
                      </p>
                      <p className="mt-0.5 text-xs">
                        <span className="text-neutral-500">
                          בסיס {formatCurrency(e.base)} · נסיעות{' '}
                          {formatCurrency(e.travel)}
                        </span>
                        {e.over > 0 && (
                          <span className="text-green-400">
                            {' '}
                            · מעל הבסיס +{formatCurrency(e.over)}
                          </span>
                        )}
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
