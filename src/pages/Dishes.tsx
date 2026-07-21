import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Pencil, Trash2, X, UtensilsCrossed } from 'lucide-react'
import {
  useDishes,
  useSaveDish,
  useDeleteDish,
  type DishWithRecipe,
} from '@/lib/queries/dishes'
import { useProducts, useLatestPrices, costPerBase } from '@/lib/queries/products'
import type { Product } from '@/types/database'
import { formatCurrency, shekelsToAgorot, agorotToShekels, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'

// אחוז פוד קוסט → צבע
function fcColor(pct: number): string {
  if (pct <= 30) return 'text-green-400'
  if (pct <= 35) return 'text-amber-400'
  return 'text-red-400'
}

interface ItemRow {
  product_id: string
  quantity: string
}

export function Dishes() {
  const { data: dishes, isLoading } = useDishes()
  const { data: products } = useProducts()
  const { data: prices } = useLatestPrices()
  const [editing, setEditing] = useState<DishWithRecipe | 'new' | null>(null)

  const byId = useMemo(() => {
    const m: Record<string, Product> = {}
    for (const p of products ?? []) m[p.id] = p
    return m
  }, [products])

  function itemCost(productId: string, qty: number): number | null {
    const p = byId[productId]
    if (!p) return null
    const cpb = costPerBase(p, prices?.[productId])
    if (cpb == null) return null
    return qty * cpb
  }

  function dishCost(d: DishWithRecipe): { cost: number; complete: boolean } {
    let cost = 0
    let complete = true
    for (const it of d.items) {
      const c = itemCost(it.product_id, it.quantity)
      if (c == null) complete = false
      else cost += c
    }
    return { cost, complete }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">מנות ופוד קוסט</h1>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          מנה חדשה
        </Button>
      </div>

      {editing && (
        <DishForm
          dish={editing === 'new' ? null : editing}
          products={products ?? []}
          prices={prices ?? {}}
          onClose={() => setEditing(null)}
        />
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !dishes?.length ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="עדיין אין מנות"
          description="הוסף מנה והרכב לה מתכון כדי לחשב פוד קוסט."
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              מנה חדשה
            </Button>
          }
        />
      ) : (
        <div className="stagger space-y-2">
          {dishes.map((d) => {
            const { cost, complete } = dishCost(d)
            const pct = d.menu_price ? (cost / d.menu_price) * 100 : null
            return (
              <Card
                key={d.id}
                className="flex items-center justify-between"
                onClick={() => setEditing(d)}
              >
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-sm text-neutral-400">
                    עלות {formatCurrency(cost)}
                    {!complete && ' (חלקי)'}
                    {d.menu_price != null && ` · מחיר ${formatCurrency(d.menu_price)}`}
                  </p>
                </div>
                <div className="text-left">
                  {pct != null ? (
                    <>
                      <p className={cn('text-lg font-bold num', fcColor(pct))}>
                        {pct.toFixed(0)}%
                      </p>
                      <p className="text-xs text-neutral-500">פוד קוסט</p>
                    </>
                  ) : (
                    <Pencil className="h-4 w-4 text-neutral-500" />
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DishForm({
  dish,
  products,
  prices,
  onClose,
}: {
  dish: DishWithRecipe | null
  products: Product[]
  prices: Record<string, number>
  onClose: () => void
}) {
  const save = useSaveDish()
  const del = useDeleteDish()
  const confirm = useConfirm()
  const [name, setName] = useState(dish?.name ?? '')
  const [menuShekels, setMenuShekels] = useState(
    dish?.menu_price != null ? String(agorotToShekels(dish.menu_price)) : ''
  )
  const [items, setItems] = useState<ItemRow[]>(
    dish?.items.map((it) => ({
      product_id: it.product_id,
      quantity: String(it.quantity),
    })) ?? [{ product_id: '', quantity: '' }]
  )
  const [error, setError] = useState<string | null>(null)

  const byId: Record<string, Product> = {}
  for (const p of products) byId[p.id] = p

  function rowCost(row: ItemRow): number | null {
    const p = byId[row.product_id]
    const qty = parseFloat(row.quantity)
    if (!p || isNaN(qty)) return null
    const cpb = costPerBase(p, prices[row.product_id])
    return cpb == null ? null : qty * cpb
  }

  const total = items.reduce((s, r) => s + (rowCost(r) ?? 0), 0)
  const menuAgorot = menuShekels ? shekelsToAgorot(parseFloat(menuShekels)) : 0
  const pct = menuAgorot ? (total / menuAgorot) * 100 : null

  function setItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  async function submit() {
    if (!name.trim()) return
    setError(null)
    try {
      await save.mutateAsync({
        id: dish?.id,
        input: {
          name: name.trim(),
          category: null,
          menu_price: menuShekels ? shekelsToAgorot(parseFloat(menuShekels)) : null,
          items: items
            .filter((r) => r.product_id && parseFloat(r.quantity) > 0)
            .map((r) => ({
              product_id: r.product_id,
              quantity: parseFloat(r.quantity),
              unit: byId[r.product_id]?.base_unit ?? null,
            })),
        },
      })
      onClose()
    } catch (err) {
      setError('שמירה נכשלה: ' + (err as Error).message)
    }
  }

  async function remove() {
    if (!dish) return
    const ok = await confirm({
      title: 'למחוק מנה?',
      message: `המנה "${dish.name}" והמתכון שלה יימחקו.`,
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(dish.id)
    onClose()
  }

  return (
    <Card className="space-y-3 border-brand-800">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{dish ? 'עריכת מנה' : 'מנה חדשה'}</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <Input label="שם המנה" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="מחיר מכירה (₪)"
        value={menuShekels}
        onChange={(e) => setMenuShekels(e.target.value)}
        dir="ltr"
        inputMode="decimal"
      />

      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-300">מרכיבים</p>
        {items.map((row, i) => {
          const p = byId[row.product_id]
          return (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={row.product_id}
                onChange={(e) => setItem(i, { product_id: e.target.value })}
                className="flex-1"
              >
                <option value="">— מרכיב —</option>
                {products.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.canonical_name}
                  </option>
                ))}
              </Select>
              <input
                value={row.quantity}
                onChange={(e) => setItem(i, { quantity: e.target.value })}
                placeholder="כמות"
                inputMode="decimal"
                dir="ltr"
                className="h-12 w-20 rounded-xl border border-neutral-700 bg-neutral-900 px-2 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <span className="w-10 shrink-0 text-xs text-neutral-500">
                {p?.base_unit ?? ''}
              </span>
              <button
                onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:text-red-400"
                aria-label="הסר"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )
        })}
        {/* אזהרה על מרכיב בלי עלות */}
        {items.some(
          (r) => r.product_id && parseFloat(r.quantity) > 0 && rowCost(r) == null
        ) && (
          <p className="text-xs text-amber-400">
            למרכיב חסר מחיר או יחידת בסיס — הגדר במסך "מוצרים".
          </p>
        )}
        <Button
          variant="secondary"
          onClick={() => setItems((prev) => [...prev, { product_id: '', quantity: '' }])}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          הוסף מרכיב
        </Button>
      </div>

      {/* סיכום עלות */}
      <div className="flex items-center justify-between rounded-xl bg-neutral-800/50 p-3">
        <div>
          <p className="text-sm text-neutral-400">עלות המנה</p>
          <p className="text-lg font-bold">{formatCurrency(total)}</p>
        </div>
        {pct != null && (
          <div className="text-left">
            <p className={cn('text-2xl font-bold num', fcColor(pct))}>
              {pct.toFixed(0)}%
            </p>
            <p className="text-xs text-neutral-500">פוד קוסט</p>
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={submit}
          loading={save.isPending}
          disabled={!name.trim()}
          className="flex-1"
        >
          שמירה
        </Button>
        {dish && (
          <Button variant="danger" onClick={remove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}
