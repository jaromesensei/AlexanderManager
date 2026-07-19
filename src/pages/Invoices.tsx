import { Link } from 'react-router-dom'
import { Plus, Store, Receipt, ChevronLeft } from 'lucide-react'
import { useInvoices } from '@/lib/queries/invoices'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

export function Invoices() {
  const { data: invoices, isLoading } = useInvoices()

  return (
    <div className="space-y-4">
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
