import { Link } from 'react-router-dom'
import { Plus, Store, Receipt, ChevronLeft, TrendingUp, X } from 'lucide-react'
import { useInvoices } from '@/lib/queries/invoices'
import { useOpenAlerts, useAcknowledgeAlert } from '@/lib/queries/alerts'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

function PriceAlerts() {
  const { data: alerts } = useOpenAlerts()
  const ack = useAcknowledgeAlert()
  if (!alerts?.length) return null

  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between rounded-2xl border border-amber-800/60 bg-amber-950/30 p-3"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">
                {a.product?.canonical_name ?? 'מוצר'} עלה{' '}
                <span className="num">+{a.pct_change}%</span>
              </p>
              <p className="text-sm text-amber-400/80">
                {a.previous_avg != null && a.new_price != null && (
                  <>
                    ממוצע {formatCurrency(a.previous_avg)} ← {formatCurrency(a.new_price)}
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => ack.mutate(a.id)}
            aria-label="אישור"
            className="rounded-lg p-2 text-amber-400/70 hover:bg-amber-900/40 hover:text-amber-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Invoices() {
  const { data: invoices, isLoading } = useInvoices()

  return (
    <div className="space-y-4">
      <PriceAlerts />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">חשבוניות</h1>
        <div className="flex gap-2">
          <Link to="/suppliers">
            <Button size="sm" variant="secondary">
              <Store className="h-4 w-4" />
              ספקים
            </Button>
          </Link>
          <Link to="/invoices/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              חדשה
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !invoices?.length ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="rounded-2xl bg-brand-950 p-4">
            <Receipt className="h-8 w-8 text-brand-500" />
          </div>
          <p className="text-neutral-300">עדיין אין חשבוניות</p>
          <Link to="/invoices/new">
            <Button>
              <Plus className="h-4 w-4" />
              הוסף חשבונית ראשונה
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <Link key={inv.id} to={`/invoices/${inv.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-brand-700">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">
                      {inv.supplier?.name ?? 'ללא ספק'}
                    </p>
                    {inv.status === 'pending' && (
                      <span className="shrink-0 rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
                        טיוטה
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-400">
                    {inv.invoice_date ? formatDate(inv.invoice_date) : 'ללא תאריך'}
                    {inv.invoice_number && ` · #${inv.invoice_number}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {inv.total_amount != null && (
                    <span className="font-semibold text-brand-400">
                      {formatCurrency(inv.total_amount)}
                    </span>
                  )}
                  <ChevronLeft className="h-5 w-5 text-neutral-500" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
