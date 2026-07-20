import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Trash2 } from 'lucide-react'
import {
  useProducts,
  useUpdateProduct,
  useDeleteProduct,
  useLatestPrices,
  costPerBase,
} from '@/lib/queries/products'
import type { Product } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

const BASE_UNITS = ['גרם', 'מ"ל', 'יחידה', 'ק"ג', 'ליטר']

export function Products() {
  const { data: products, isLoading } = useProducts()
  const { data: prices } = useLatestPrices()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">מוצרים</h1>
      </div>
      <p className="text-sm text-neutral-400">
        המוצרים נוצרים אוטומטית מהחשבוניות. הגדר לכל מוצר יחידת בסיס וכמה יחידות בסיס יש
        ביחידת הקנייה — כדי לחשב עלות למנה.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !products?.length ? (
        <Card className="py-10 text-center text-neutral-400">
          עדיין אין מוצרים. אשר חשבונית והמוצרים ייווצרו אוטומטית.
        </Card>
      ) : (
        <datalist id="base-units">
          {BASE_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      )}

      <div className="space-y-2">
        {products?.map((p) => (
          <ProductRow key={p.id} product={p} latestPrice={prices?.[p.id]} />
        ))}
      </div>
    </div>
  )
}

function ProductRow({
  product,
  latestPrice,
}: {
  product: Product
  latestPrice: number | undefined
}) {
  const update = useUpdateProduct()
  const del = useDeleteProduct()
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
          onClick={() => {
            if (confirm(`למחוק את "${product.canonical_name}"?`)) del.mutate(product.id)
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
        <p className="text-sm text-brand-400">
          עלות ל{baseUnit}: {formatCurrency(cpb)}
        </p>
      )}
    </Card>
  )
}
