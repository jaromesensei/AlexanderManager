import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, ChevronLeft, Download, TrendingUp } from 'lucide-react'
import { useSpend } from '@/lib/queries/reports'
import { useProducts } from '@/lib/queries/products'
import { useCategories } from '@/lib/queries/categories'
import { downloadCsv } from '@/lib/exportCsv'
import { formatCurrency, shekelsToAgorot, agorotToShekels, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
const monthKey = (isoDate: string) => isoDate.slice(0, 7)
const NO_CAT = 'ללא קטגוריה'

function dmy(isoDate: string | null): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

export function Reports() {
  // תחילת החודש הנבחר
  const [month, setMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [revenue, setRevenue] = useState('')

  const selKey = monthKey(iso(month))
  const from = iso(new Date(month.getFullYear(), month.getMonth() - 5, 1))
  const to = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const { data: rows, isLoading } = useSpend(from, to)
  const { data: products } = useProducts()
  const { data: categories } = useCategories()

  // מיפויים: מוצר -> קטגוריה, מוצר -> שם
  const { catOf, nameOf } = useMemo(() => {
    const catById: Record<string, string> = {}
    for (const c of categories ?? []) catById[c.id] = c.name
    const catOf: Record<string, string> = {}
    const nameOf: Record<string, string> = {}
    for (const p of products ?? []) {
      catOf[p.id] = p.category_id ? (catById[p.category_id] ?? NO_CAT) : NO_CAT
      nameOf[p.id] = p.canonical_name
    }
    return { catOf, nameOf }
  }, [products, categories])

  const monthRows = useMemo(
    () =>
      (rows ?? []).filter((r) => r.invoice_date && monthKey(r.invoice_date) === selKey),
    [rows, selKey]
  )

  const total = monthRows.reduce((s, r) => s + r.line_total, 0)

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of monthRows) {
      const c = r.product_id ? (catOf[r.product_id] ?? NO_CAT) : NO_CAT
      m[c] = (m[c] ?? 0) + r.line_total
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthRows, catOf])

  const bySupplier = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of monthRows) {
      const s = r.supplier_name ?? 'ללא ספק'
      m[s] = (m[s] ?? 0) + r.line_total
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [monthRows])

  // מגמת 6 חודשים
  const trend = useMemo(() => {
    const m: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(month.getFullYear(), month.getMonth() - i, 1)
      m[monthKey(iso(d))] = 0
    }
    for (const r of rows ?? []) {
      if (!r.invoice_date) continue
      const k = monthKey(r.invoice_date)
      if (k in m) m[k] += r.line_total
    }
    return Object.entries(m)
  }, [rows, month])

  const revenueAgorot = revenue ? shekelsToAgorot(parseFloat(revenue)) : 0
  const foodCostPct = revenueAgorot > 0 ? (total / revenueAgorot) * 100 : null

  const monthLabel = new Intl.DateTimeFormat('he-IL', {
    month: 'long',
    year: 'numeric',
  }).format(month)

  function exportMonth() {
    const headers = [
      'תאריך',
      'ספק',
      'קטגוריה',
      'מוצר',
      'כמות',
      'יחידה',
      'מחיר יחידה (₪)',
      'סה"כ שורה (₪)',
      'מס׳ חשבונית',
    ]
    const data = monthRows
      .slice()
      .sort((a, b) => (a.invoice_date ?? '').localeCompare(b.invoice_date ?? ''))
      .map((r) => [
        dmy(r.invoice_date),
        r.supplier_name ?? '',
        r.product_id ? (catOf[r.product_id] ?? NO_CAT) : NO_CAT,
        r.product_id ? (nameOf[r.product_id] ?? r.raw_name) : r.raw_name,
        r.quantity ?? '',
        r.unit ?? '',
        r.unit_price != null ? agorotToShekels(r.unit_price) : '',
        agorotToShekels(r.line_total),
        r.invoice_number ?? '',
      ])
    // שורת סיכום בתחתית
    data.push(['', '', '', '', '', '', 'סה"כ', agorotToShekels(total), ''])
    downloadCsv(`alexander-expenses-${selKey}.csv`, headers, data)
  }

  const trendMax = Math.max(1, ...trend.map(([, v]) => v))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">דוחות והוצאות</h1>
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
      ) : monthRows.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="אין הוצאות בחודש זה"
          description="חשבוניות מאושרות בחודש שנבחר יופיעו כאן, עם פילוח וייצוא לאקסל."
        />
      ) : (
        <>
          {/* סיכום */}
          <Card className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-neutral-400">סה"כ הוצאות</p>
                <p className="text-3xl font-extrabold">{formatCurrency(total)}</p>
              </div>
              {foodCostPct != null && (
                <div className="text-left">
                  <p className="num text-2xl font-bold text-brand-500">
                    {foodCostPct.toFixed(0)}%
                  </p>
                  <p className="text-xs text-neutral-500">פוד קוסט</p>
                </div>
              )}
            </div>
            <Input
              label="מחזור מכירות החודש (₪) — לחישוב פוד קוסט (אופציונלי)"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              dir="ltr"
              inputMode="decimal"
              placeholder="לדוגמה: 85000"
            />
            <Button onClick={exportMonth} variant="secondary" className="w-full">
              <Download className="h-4 w-4" />
              ייצוא לאקסל (CSV)
            </Button>
          </Card>

          {/* לפי קטגוריה */}
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-neutral-300">לפי קטגוריה</h2>
            <Card className="space-y-3">
              {byCategory.map(([name, amount]) => (
                <BreakdownRow
                  key={name}
                  name={name}
                  amount={amount}
                  pct={(amount / total) * 100}
                />
              ))}
            </Card>
          </section>

          {/* לפי ספק */}
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-neutral-300">לפי ספק</h2>
            <Card className="space-y-3">
              {bySupplier.map(([name, amount]) => (
                <BreakdownRow
                  key={name}
                  name={name}
                  amount={amount}
                  pct={(amount / total) * 100}
                />
              ))}
            </Card>
          </section>

          {/* מגמה */}
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-neutral-300">
              מגמה · 6 חודשים
            </h2>
            <Card>
              <div
                className="flex items-end justify-between gap-2"
                style={{ height: 120 }}
              >
                {trend.map(([k, v]) => (
                  <div key={k} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={cn(
                          'w-full rounded-t-md',
                          k === selKey ? 'bg-brand-600' : 'bg-neutral-700'
                        )}
                        style={{ height: `${(v / trendMax) * 100}%` }}
                      />
                    </div>
                    <span className="num text-[10px] text-neutral-500">{k.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  )
}

function BreakdownRow({
  name,
  amount,
  pct,
}: {
  name: string
  amount: number
  pct: number
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span className="flex items-center gap-2">
          <span className="num text-neutral-400">{pct.toFixed(0)}%</span>
          <span className="num font-semibold">{formatCurrency(amount)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
