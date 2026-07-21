import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Trash2, Package, Plus, X, ChevronDown } from 'lucide-react'
import {
  useProducts,
  useUpdateProduct,
  useDeleteProduct,
  useLatestPrices,
  costPerBase,
} from '@/lib/queries/products'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useSeedCategories,
} from '@/lib/queries/categories'
import type { Product, ProductCategory } from '@/types/database'
import { formatCurrency, cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'

const BASE_UNITS = ['גרם', 'מ"ל', 'יחידה', 'ק"ג', 'ליטר']

export function Products() {
  const { data: products, isLoading } = useProducts()
  const { data: prices } = useLatestPrices()
  const { data: categories } = useCategories()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">מוצרים</h1>
      </div>
      <p className="text-sm text-neutral-400">
        המוצרים נוצרים אוטומטית מהחשבוניות. שייך קטגוריה (לדוחות) והגדר יחידת בסיס (לפוד
        קוסט).
      </p>

      <CategoryManager />

      {isLoading ? (
        <ListSkeleton />
      ) : !products?.length ? (
        <EmptyState
          icon={Package}
          title="עדיין אין מוצרים"
          description="אשר חשבונית והמוצרים ייווצרו אוטומטית מהשורות שלה."
        />
      ) : (
        <>
          <datalist id="base-units">
            {BASE_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="stagger space-y-2">
            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                latestPrice={prices?.[p.id]}
                categories={categories ?? []}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CategoryManager() {
  const { data: categories } = useCategories()
  const create = useCreateCategory()
  const del = useDeleteCategory()
  const seed = useSeedCategories()
  const [name, setName] = useState('')
  const [open, setOpen] = useState(false)
  const list = categories ?? []

  function add() {
    if (!name.trim()) return
    create.mutate(name.trim())
    setName('')
  }

  return (
    <Card className="space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <span className="font-semibold">קטגוריות ({list.length})</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-neutral-400 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <>
          {list.length === 0 ? (
            <div className="space-y-3 py-1 text-center">
              <p className="text-sm text-neutral-400">
                קטגוריות עוזרות לפלח הוצאות בדוחות סוף החודש.
              </p>
              <Button
                variant="secondary"
                onClick={() => seed.mutate()}
                loading={seed.isPending}
              >
                צור קטגוריות מומלצות
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {list.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-sm"
                >
                  {c.name}
                  <button
                    onClick={() => del.mutate(c.id)}
                    aria-label={`מחק ${c.name}`}
                    className="text-neutral-500 hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="קטגוריה חדשה"
              className="flex-1"
            />
            <Button onClick={add} disabled={!name.trim()} loading={create.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

function ProductRow({
  product,
  latestPrice,
  categories,
}: {
  product: Product
  latestPrice: number | undefined
  categories: ProductCategory[]
}) {
  const update = useUpdateProduct()
  const del = useDeleteProduct()
  const confirm = useConfirm()
  const [baseUnit, setBaseUnit] = useState(product.base_unit ?? '')
  const [perPurchase, setPerPurchase] = useState(String(product.base_per_purchase ?? 1))

  function saveBaseUnit() {
    if (baseUnit !== (product.base_unit ?? ''))
      update.mutate({ id: product.id, base_unit: baseUnit || null })
  }
  function savePer() {
    const n = parseFloat(perPurchase) || 1
    if (n !== product.base_per_purchase)
      update.mutate({ id: product.id, base_per_purchase: n })
  }

  const perNum = parseFloat(perPurchase) || 1
  const cpb = costPerBase({ ...product, base_per_purchase: perNum }, latestPrice)

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{product.canonical_name}</p>
        <button
          onClick={async () => {
            const ok = await confirm({
              title: 'למחוק מוצר?',
              message: `"${product.canonical_name}" יימחק מהקטלוג.`,
              confirmLabel: 'מחק',
              danger: true,
            })
            if (ok) del.mutate(product.id)
          }}
          className="rounded-lg p-1.5 text-neutral-500 hover:text-red-400"
          aria-label="מחק"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-neutral-400">
        נקנה ב: {product.default_unit || '—'}
        {latestPrice != null && ` · מחיר אחרון ${formatCurrency(latestPrice)}`}
      </p>

      {categories.length > 0 && (
        <Select
          label="קטגוריה"
          value={product.category_id ?? ''}
          onChange={(e) =>
            update.mutate({ id: product.id, category_id: e.target.value || null })
          }
        >
          <option value="">— ללא קטגוריה —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">יחידת בסיס</label>
          <input
            list="base-units"
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value)}
            onBlur={saveBaseUnit}
            placeholder="גרם / יחידה"
            className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">
            כמה {baseUnit || 'בסיס'} ב{product.default_unit || 'קנייה'}
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={perPurchase}
            onChange={(e) => setPerPurchase(e.target.value)}
            onBlur={savePer}
            dir="ltr"
            className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {cpb != null && baseUnit && (
        <p className="text-sm text-accent">
          עלות ל{baseUnit}: {formatCurrency(cpb)}
        </p>
      )}
    </Card>
  )
}
