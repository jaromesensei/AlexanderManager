import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, Send, Save } from 'lucide-react'
import { useSuppliers } from '@/lib/queries/suppliers'
import { useProducts } from '@/lib/queries/products'
import {
  useOrder,
  useSaveOrder,
  useDeleteOrder,
  type OrderItemInput,
} from '@/lib/queries/orders'
import type { OrderStatus } from '@/types/database'
import { toWaNumber, waLink } from '@/lib/whatsapp'
import { formatDate, shekelsToAgorot, agorotToShekels } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Row {
  name: string
  quantity: string
  unit: string
  price: string
}

function emptyRow(): Row {
  return { name: '', quantity: '', unit: '', price: '' }
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function OrderForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const from = params.get('from') ?? undefined
  const sourceId = id ?? from
  const isEditing = !!id
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()

  const { data: source, isLoading } = useOrder(sourceId)
  const { data: suppliers } = useSuppliers()
  const { data: products } = useProducts()
  const save = useSaveOrder()
  const del = useDeleteOrder()

  const [supplierId, setSupplierId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!source || hydrated.current) return
    hydrated.current = true
    setSupplierId(source.supplier_id ?? '')
    setExpectedDate(isEditing ? (source.expected_date ?? '') : '')
    setNotes(isEditing ? (source.notes ?? '') : '')
    setRows(
      source.items.map((it) => ({
        name: it.name,
        quantity: String(it.quantity),
        unit: it.unit ?? '',
        price:
          it.expected_unit_price != null
            ? String(agorotToShekels(it.expected_unit_price))
            : '',
      }))
    )
  }, [source, isEditing])

  const nameToId = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of products ?? []) m[p.canonical_name] = p.id
    return m
  }, [products])

  const supplier = suppliers?.find((s) => s.id === supplierId)

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function buildItems(): OrderItemInput[] {
    return rows
      .filter((r) => r.name.trim() && parseFloat(r.quantity) > 0)
      .map((r) => ({
        product_id: nameToId[r.name.trim()] ?? null,
        name: r.name.trim(),
        quantity: parseFloat(r.quantity),
        unit: r.unit.trim() || null,
        expected_unit_price: r.price ? shekelsToAgorot(parseFloat(r.price)) : null,
      }))
  }

  async function doSave(status: OrderStatus): Promise<string | null> {
    if (!supplierId) {
      setError('בחר ספק')
      return null
    }
    const items = buildItems()
    if (items.length === 0) {
      setError('הוסף לפחות פריט אחד')
      return null
    }
    setError(null)
    const res = await save.mutateAsync({
      id,
      input: {
        supplier_id: supplierId,
        order_date: isEditing && source ? source.order_date : todayIso(),
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        status,
        items,
      },
    })
    return res.id
  }

  async function saveOnly() {
    const ok = await doSave(isEditing && source ? source.status : 'draft')
    if (ok) navigate('/orders')
  }

  function buildMessage(items: OrderItemInput[]): string {
    const lines = ['הזמנה · אלכסנדר', `לספק: ${supplier?.name ?? ''}`]
    if (expectedDate) lines.push(`לתאריך: ${formatDate(expectedDate)}`)
    lines.push('')
    for (const it of items) {
      lines.push(`- ${it.name} · ${it.quantity}${it.unit ? ` ${it.unit}` : ''}`)
    }
    lines.push('', 'תודה, אלכסנדר')
    return lines.join('\n')
  }

  function sendWhatsApp() {
    if (!supplierId) {
      setError('בחר ספק')
      return
    }
    const items = buildItems()
    if (items.length === 0) {
      setError('הוסף לפחות פריט אחד')
      return
    }
    setError(null)
    // שמירה כ"בוצעה" (לא ממתינים כדי לא לחסום את פתיחת וואטסאפ)
    save.mutate({
      id,
      input: {
        supplier_id: supplierId,
        order_date: isEditing && source ? source.order_date : todayIso(),
        expected_date: expectedDate || null,
        notes: notes.trim() || null,
        status: 'ordered',
        items,
      },
    })
    const msg = buildMessage(items)
    const wa = toWaNumber(supplier?.phone)
    if (wa) window.open(waLink(wa, msg), '_blank')
    else {
      navigator.clipboard.writeText(msg).catch(() => {})
      toast.success('אין טלפון לספק — ההודעה הועתקה')
    }
    navigate('/orders')
  }

  async function remove() {
    if (!id) return
    const ok = await confirm({
      title: 'למחוק הזמנה?',
      message: 'ההזמנה והפריטים שלה יימחקו.',
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(id)
    navigate('/orders')
  }

  if (sourceId && isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/orders" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{isEditing ? 'עריכת הזמנה' : 'הזמנה חדשה'}</h1>
      </div>

      <Card className="space-y-3">
        <Select
          label="ספק"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="">— בחר ספק —</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Input
          label="לתאריך אספקה (אופציונלי)"
          type="date"
          value={expectedDate}
          onChange={(e) => setExpectedDate(e.target.value)}
          dir="ltr"
        />
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-neutral-300">פריטים</h2>
          <span className="text-xs text-neutral-500">
            מחיר מוסכם = לזיהוי חריגות בקבלה
          </span>
        </div>

        <datalist id="product-names">
          {(products ?? []).map((p) => (
            <option key={p.id} value={p.canonical_name} />
          ))}
        </datalist>

        {rows.map((row, i) => (
          <Card key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                list="product-names"
                value={row.name}
                onChange={(e) => setRow(i, { name: e.target.value })}
                placeholder="שם המוצר"
                className="h-11 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <button
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-lg p-2 text-neutral-500 hover:text-red-400"
                aria-label="הסר"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={row.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
                placeholder="כמות"
                inputMode="decimal"
                dir="ltr"
                className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <input
                value={row.unit}
                onChange={(e) => setRow(i, { unit: e.target.value })}
                placeholder="יחידה"
                className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <input
                value={row.price}
                onChange={(e) => setRow(i, { price: e.target.value })}
                placeholder="מחיר ₪"
                inputMode="decimal"
                dir="ltr"
                className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
            </div>
          </Card>
        ))}

        <Button
          variant="secondary"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          הוסף פריט
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="sticky bottom-4 space-y-2">
        <Button onClick={sendWhatsApp} size="lg" className="w-full">
          <Send className="h-5 w-5" />
          שלח לספק בוואטסאפ
        </Button>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={saveOnly}
            loading={save.isPending}
            className="flex-1"
          >
            <Save className="h-4 w-4" />
            שמור בלבד
          </Button>
          {isEditing && (
            <Button variant="danger" onClick={remove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
