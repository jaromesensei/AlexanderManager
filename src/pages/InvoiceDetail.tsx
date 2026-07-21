import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Pencil, Trash2, Store } from 'lucide-react'
import { useInvoice, useDeleteInvoice } from '@/lib/queries/invoices'
import { getInvoiceImageUrl } from '@/lib/queries/storage'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FullScreenSpinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: invoice, isLoading } = useInvoice(id)
  const del = useDeleteInvoice()
  const confirm = useConfirm()
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (invoice?.image_path) getInvoiceImageUrl(invoice.image_path).then(setImageUrl)
  }, [invoice?.image_path])

  if (isLoading) return <FullScreenSpinner />
  if (!invoice)
    return <p className="py-10 text-center text-neutral-400">החשבונית לא נמצאה.</p>

  async function remove() {
    const ok = await confirm({
      title: 'למחוק חשבונית?',
      message: 'החשבונית וכל השורות שלה יימחקו לצמיתות.',
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(id!)
    navigate('/invoices')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-bold">{invoice.supplier?.name ?? 'חשבונית'}</h1>
          {invoice.status === 'pending' && (
            <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-400">
              טיוטה
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Link to={`/invoices/${invoice.id}/edit`}>
            <Button size="sm" variant="secondary">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Button size="sm" variant="danger" onClick={remove} loading={del.isPending}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="space-y-1 text-sm">
        <Row
          label="ספק"
          value={invoice.supplier?.name ?? '—'}
          icon={<Store className="h-4 w-4" />}
        />
        <Row
          label="תאריך"
          value={invoice.invoice_date ? formatDate(invoice.invoice_date) : '—'}
        />
        <Row label="מספר" value={invoice.invoice_number ?? '—'} />
        <Row
          label='סה"כ'
          value={
            invoice.total_amount != null ? formatCurrency(invoice.total_amount) : '—'
          }
          bold
        />
      </Card>

      {invoice.items.length > 0 && (
        <div className="space-y-2">
          <h2 className="px-1 font-semibold">פריטים ({invoice.items.length})</h2>
          {invoice.items.map((it) => (
            <Card key={it.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{it.raw_name}</p>
                <p className="text-sm text-neutral-400">
                  {it.quantity != null && <span className="num">{it.quantity}</span>}
                  {it.unit && ` ${it.unit}`}
                  {it.unit_price != null && (
                    <> · {formatCurrency(it.unit_price)} ליחידה</>
                  )}
                </p>
              </div>
              {it.line_total != null && (
                <span className="font-semibold text-brand-400">
                  {formatCurrency(it.line_total)}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}

      {invoice.notes && (
        <Card>
          <p className="text-sm text-neutral-300">{invoice.notes}</p>
        </Card>
      )}

      {imageUrl && (
        <Card>
          <img
            src={imageUrl}
            alt="חשבונית מקורית"
            className="w-full rounded-xl object-contain"
          />
        </Card>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  icon,
  bold,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="flex items-center gap-1.5 text-neutral-400">
        {icon}
        {label}
      </span>
      <span className={bold ? 'font-semibold text-brand-400' : ''}>{value}</span>
    </div>
  )
}
