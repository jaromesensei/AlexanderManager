import { Link } from 'react-router-dom'
import { ArrowRight, Plus, ClipboardList, PackageCheck } from 'lucide-react'
import { useOrders, ORDER_STATUS_LABELS, type OrderListRow } from '@/lib/queries/orders'
import type { OrderStatus } from '@/types/database'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

const STATUS_CLS: Record<OrderStatus, string> = {
  draft: 'bg-neutral-800 text-neutral-300',
  ordered: 'accent-soft text-accent',
  received: 'bg-green-950/40 text-green-300',
  closed: 'bg-neutral-800 text-neutral-400',
}

function orderTotal(o: OrderListRow): number {
  return o.items.reduce((s, it) => s + (it.expected_unit_price ?? 0) * it.quantity, 0)
}

export function Orders() {
  const { data: orders, isLoading } = useOrders()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">הזמנות רכש</h1>
        </div>
        <Link to="/orders/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            חדשה
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : !orders?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="עדיין אין הזמנות"
          description="צור הזמנה לספק, שלח בוואטסאפ, ובקבלה נצליב מול תעודת המשלוח."
          action={
            <Link to="/orders/new">
              <Button>
                <Plus className="h-4 w-4" />
                הזמנה ראשונה
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="stagger space-y-2">
          {orders.map((o) => {
            const total = orderTotal(o)
            const canReceive = o.status === 'ordered' || o.status === 'draft'
            return (
              <Card key={o.id} className="space-y-2">
                <Link to={`/orders/${o.id}/edit`} className="tap block">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">
                          {o.supplier?.name ?? 'ללא ספק'}
                        </p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs',
                            STATUS_CLS[o.status]
                          )}
                        >
                          {ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-neutral-400">
                        {formatDate(o.order_date)} · {o.items.length} פריטים
                      </p>
                    </div>
                    {total > 0 && (
                      <span className="num font-semibold text-accent">
                        {formatCurrency(total)}
                      </span>
                    )}
                  </div>
                </Link>
                {canReceive && (
                  <Link to={`/orders/${o.id}/receive`}>
                    <Button variant="secondary" size="sm" className="w-full">
                      <PackageCheck className="h-4 w-4" />
                      קבלת סחורה
                    </Button>
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
