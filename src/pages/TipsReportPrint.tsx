import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Printer } from 'lucide-react'
import { useMinWage, useTipReport, aggregateReport, isSaturday } from '@/lib/queries/tips'
import { formatCurrency, formatAgorot } from '@/lib/utils'
import { FullScreenSpinner } from '@/components/ui/Spinner'

function dmy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}
function weekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  return names[new Date(y, m - 1, d).getDay()]
}

export function TipsReportPrint() {
  const { month = '' } = useParams() // YYYY-MM
  const [yy, mm] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = useMemo(() => {
    const last = new Date(yy, mm, 0).getDate()
    return `${month}-${String(last).padStart(2, '0')}`
  }, [yy, mm, month])

  const { data: days, isLoading } = useTipReport(from, to)
  const { data: minWage = 3540 } = useMinWage()
  const { emps } = useMemo(() => aggregateReport(days ?? [], minWage), [days, minWage])

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(
        new Date(yy, (mm || 1) - 1, 1)
      ),
    [yy, mm]
  )

  if (isLoading) return <FullScreenSpinner />

  return (
    <div
      className="mx-auto min-h-screen max-w-[800px] bg-white p-6 text-[#18181b]"
      dir="rtl"
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}
    >
      <style>{`@page { size: A4 portrait; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; }
          .emp-page { page-break-after: always; }
          .emp-page:last-child { page-break-after: auto; }
        }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>

      {/* בקרות - לא מודפס */}
      <div className="no-print mb-5 flex items-center justify-between">
        <Link
          to="/tips/report"
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

      {emps.length === 0 ? (
        <p className="py-16 text-center text-[#a1a1aa]">אין נתונים בחודש זה.</p>
      ) : (
        emps.map((e) => (
          <section key={e.id} className="emp-page pb-6">
            {/* כותרת */}
            <header className="flex items-end justify-between border-b-2 border-[#4338ca] pb-4">
              <div>
                <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#4338ca]">
                  ריכוז טיפים ושכר
                </div>
                <h1 className="text-3xl font-extrabold leading-none tracking-tight">
                  אלכסנדר
                </h1>
                <p className="mt-1 text-sm text-[#71717a]">דיינר מקומי</p>
              </div>
              <div className="text-left">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a1a1aa]">
                  חודש
                </div>
                <div className="text-xl font-bold text-[#18181b]">{monthLabel}</div>
              </div>
            </header>

            {/* שם העובד */}
            <div className="mt-4 flex items-baseline justify-between">
              <h2 className="text-2xl font-extrabold">{e.name}</h2>
              <span className="text-sm text-[#71717a]">
                {e.days} ימי עבודה · <span className="num">{e.hours}</span> שעות
                {e.shabbatHours > 0 && (
                  <>
                    {' '}
                    · מזה שבת <span className="num">{e.shabbatHours}</span>
                  </>
                )}
              </span>
            </div>

            {/* טבלת ימים */}
            <table className="mt-3 w-full table-fixed border-collapse text-[13px]">
              <colgroup>
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '17%' }} />
              </colgroup>
              <thead>
                <tr className="bg-[#f1f1f4] text-[11px] font-semibold text-[#52525b]">
                  <th className="border border-[#e5e7eb] p-2 text-right">תאריך</th>
                  <th className="border border-[#e5e7eb] p-2 text-right">יום</th>
                  <th className="border border-[#e5e7eb] p-2 text-right">שעות</th>
                  <th className="border border-[#e5e7eb] p-2 text-right">טיפ/שעה ₪</th>
                  <th className="border border-[#e5e7eb] p-2 text-right">טיפים ₪</th>
                  <th className="border border-[#e5e7eb] p-2 text-right">השלמה ₪</th>
                  <th className="border border-[#e5e7eb] p-2 text-right">סה"כ ₪</th>
                </tr>
              </thead>
              <tbody>
                {e.lines.map((l, i) => {
                  const sat = isSaturday(l.date)
                  return (
                    <tr key={i} style={{ background: sat ? '#fff7ed' : '#fff' }}>
                      <td className="border border-[#eef0f2] p-2 text-right">
                        <span className="num">{dmy(l.date)}</span>
                      </td>
                      <td className="border border-[#eef0f2] p-2 text-right text-[#52525b]">
                        {weekday(l.date)}
                        {sat && (
                          <span className="mr-1 rounded bg-[#fed7aa] px-1 text-[9px] font-bold text-[#9a3412]">
                            שבת
                          </span>
                        )}
                      </td>
                      <td className="border border-[#eef0f2] p-2 text-right">
                        <span className="num">{l.hours}</span>
                      </td>
                      <td className="border border-[#eef0f2] p-2 text-right text-[#52525b]">
                        <span className="num">{formatAgorot(Math.round(l.tph))}</span>
                      </td>
                      <td className="border border-[#eef0f2] p-2 text-right">
                        <span className="num">{formatAgorot(l.tips)}</span>
                      </td>
                      <td className="border border-[#eef0f2] p-2 text-right text-[#b45309]">
                        {l.topUp > 0 ? (
                          <span className="num">{formatAgorot(l.topUp)}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="border border-[#eef0f2] p-2 text-right font-semibold">
                        <span className="num">{formatAgorot(l.total)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#eef2ff] font-bold">
                  <td
                    className="border border-[#c7d2fe] p-2 text-right text-[#4338ca]"
                    colSpan={2}
                  >
                    סה"כ
                  </td>
                  <td className="border border-[#c7d2fe] p-2 text-right">
                    <span className="num">{e.hours}</span>
                  </td>
                  <td className="border border-[#c7d2fe] p-2"></td>
                  <td className="border border-[#c7d2fe] p-2 text-right">
                    <span className="num">{formatAgorot(e.tips)}</span>
                  </td>
                  <td className="border border-[#c7d2fe] p-2 text-right text-[#b45309]">
                    <span className="num">{formatAgorot(e.topUp)}</span>
                  </td>
                  <td className="border border-[#c7d2fe] p-2 text-right">
                    <span className="num">{formatAgorot(e.total)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* בסיס / מעל הבסיס / השלמה */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-[#f4f4f5] px-2 py-2">
                <div className="text-[10px] text-[#71717a]">בסיס מינימום</div>
                <div className="num text-[15px] font-bold">{formatCurrency(e.base)}</div>
              </div>
              <div className="rounded-lg bg-[#ecfdf5] px-2 py-2">
                <div className="text-[10px] text-[#047857]">מעל הבסיס</div>
                <div className="num text-[15px] font-bold text-[#047857]">
                  {e.over > 0 ? '+' + formatCurrency(e.over) : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-[#fffbeb] px-2 py-2">
                <div className="text-[10px] text-[#b45309]">השלמה</div>
                <div className="num text-[15px] font-bold text-[#b45309]">
                  {e.topUp > 0 ? formatCurrency(e.topUp) : '—'}
                </div>
              </div>
            </div>

            {/* סיכום לתשלום */}
            <div className="mt-2 flex items-center justify-between rounded-xl bg-[#eef2ff] px-4 py-3">
              <span className="font-semibold text-[#4338ca]">סה"כ לתשלום</span>
              <span className="num text-2xl font-extrabold text-[#4338ca]">
                {formatCurrency(e.total)}
              </span>
            </div>

            <p className="mt-3 text-[10.5px] text-[#a1a1aa]">
              טיפים לפי קופה משותפת (סך טיפים ÷ סך שעות), עם השלמה לשכר מינימום (
              {formatCurrency(minWage)} לשעה, בשבת 150% ={' '}
              {formatCurrency(Math.round(minWage * 1.5))}) בימים בהם הטיפ לשעה נמוך ממנו.
              מסמך זה הוא כלי תמיכה בהחלטה ואינו תלוש שכר רשמי.
            </p>
          </section>
        ))
      )}
    </div>
  )
}
