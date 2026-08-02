import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Camera,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { useOrder, useSetOrderStatus } from '@/lib/queries/orders'
import { useCreateInvoice, type InvoiceItemInput } from '@/lib/queries/invoices'
import {
  uploadInvoiceImage,
  extractInvoice,
  type ExtractedInvoice,
} from '@/lib/queries/storage'
import { formatCurrency, shekelsToAgorot, agorotToShekels, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'

// סף לחיוב יתר משמעותי (מעבר לכך = אדום)
const PRICE_THRESHOLD = 0.05

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// נירמול שם מוצר להשוואה (רווחים, אותיות)
function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

// ציון התאמה בין שם בהזמנה לשם בתעודה: 3=זהה, 2=הכלה, 1=מילה משותפת
function matchScore(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 3
  if (na.includes(nb) || nb.includes(na)) return 2
  const tokensA = new Set(na.split(' ').filter((t) => t.length > 1))
  const shared = nb.split(' ').filter((t) => t.length > 1 && tokensA.has(t)).length
  return shared > 0 ? 1 : 0
}

interface Line {
  id: string
  name: string
  unit: string
  orderedQty: number
  expectedAgorot: number | null
  received: string
  price: string // ₪ בפועל
}

interface Extra {
  name: string
  quantity: string
  unit: string
  price: string
}

export function OrderReceive() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: order, isLoading } = useOrder(id)
  const createInvoice = useCreateInvoice()
  const setStatus = useSetOrderStatus()

  const [lines, setLines] = useState<Line[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanNote, setScanNote] = useState<string | null>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!order || hydrated.current) return
    hydrated.current = true
    setLines(
      order.items.map((it) => ({
        id: it.id,
        name: it.name,
        unit: it.unit ?? '',
        orderedQty: it.quantity,
        expectedAgorot: it.expected_unit_price,
        received: String(it.quantity),
        price:
          it.expected_unit_price != null
            ? String(agorotToShekels(it.expected_unit_price))
            : '',
      }))
    )
  }, [order])

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function setExtra(i: number, patch: Partial<Extra>) {
    setExtras((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  // התאמת פריטי התעודה שחולצו מול שורות ההזמנה
  function applyExtraction(ex: ExtractedInvoice) {
    const items = ex.items ?? []
    const used = new Set<number>()
    let matched = 0

    const nextLines = lines.map((l) => {
      let bestIdx = -1
      let bestScore = 0
      items.forEach((it, idx) => {
        if (used.has(idx)) return
        const score = matchScore(l.name, it.name)
        if (score > bestScore) {
          bestScore = score
          bestIdx = idx
        }
      })
      if (bestIdx >= 0 && bestScore > 0) {
        used.add(bestIdx)
        matched++
        const it = items[bestIdx]
        return {
          ...l,
          received: it.quantity ? String(it.quantity) : l.received,
          price: it.unit_price ? String(it.unit_price) : l.price,
        }
      }
      // לא זוהה בתעודה — מסומן כלא סופק לבדיקת המנהל
      return { ...l, received: '0' }
    })

    const newExtras: Extra[] = []
    items.forEach((it, idx) => {
      if (used.has(idx)) return
      if (!it.name?.trim()) return
      newExtras.push({
        name: it.name.trim(),
        quantity: it.quantity ? String(it.quantity) : '',
        unit: it.unit ?? '',
        price: it.unit_price ? String(it.unit_price) : '',
      })
    })

    setLines(nextLines)
    if (newExtras.length) setExtras((prev) => [...prev, ...newExtras])

    const parts = [`זוהו ${items.length} פריטים`, `${matched} הותאמו להזמנה`]
    if (newExtras.length) parts.push(`${newExtras.length} לא הוזמנו`)
    setScanNote(parts.join(' · ') + '. בדוק והתאם היכן שצריך.')
  }

  async function handleDeliveryNote(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setScanNote(null)
    try {
      const path = await uploadInvoiceImage(file)
      setImagePath(path)
      const ex = await extractInvoice(path)
      applyExtraction(ex)
    } catch (err) {
      toast.error('החילוץ נכשל: ' + (err as Error).message)
    } finally {
      setScanning(false)
    }
  }

  // אי-התאמות לכל שורה (לתצוגה ולסיכום)
  const issues = useMemo(() => {
    const out: { label: string; severity: 'red' | 'amber' }[] = []
    for (const l of lines) {
      const rec = parseFloat(l.received)
      if (isNaN(rec) || rec === 0) {
        out.push({ label: `${l.name}: לא סופק (הוזמן ${l.orderedQty})`, severity: 'red' })
        continue
      }
      if (rec < l.orderedQty)
        out.push({
          label: `${l.name}: חוסר (הוזמן ${l.orderedQty}, התקבל ${rec})`,
          severity: 'red',
        })
      else if (rec > l.orderedQty)
        out.push({
          label: `${l.name}: עודף (הוזמן ${l.orderedQty}, התקבל ${rec})`,
          severity: 'amber',
        })
      if (l.expectedAgorot != null && l.price) {
        const actual = shekelsToAgorot(parseFloat(l.price))
        if (actual > l.expectedAgorot) {
          const sev = actual > l.expectedAgorot * (1 + PRICE_THRESHOLD) ? 'red' : 'amber'
          out.push({
            label: `${l.name}: חיוב יתר (${formatCurrency(l.expectedAgorot)} ← ${formatCurrency(actual)})`,
            severity: sev,
          })
        }
      }
    }
    for (const e of extras) {
      const q = parseFloat(e.quantity)
      if (e.name.trim() && q > 0)
        out.push({ label: `${e.name}: לא הוזמן`, severity: 'amber' })
    }
    return out
  }, [lines, extras])

  function lineBadge(l: Line): { text: string; cls: string } | null {
    const rec = parseFloat(l.received)
    if (isNaN(rec) || rec === 0)
      return { text: 'לא סופק', cls: 'bg-red-950/40 text-red-300' }
    if (rec < l.orderedQty) return { text: 'חוסר', cls: 'bg-red-950/40 text-red-300' }
    if (rec > l.orderedQty) return { text: 'עודף', cls: 'bg-amber-950/40 text-amber-300' }
    return null
  }

  async function confirmReceipt() {
    if (!order) return
    const items: InvoiceItemInput[] = []
    for (const l of lines) {
      const rec = parseFloat(l.received)
      if (!(rec > 0)) continue
      const priceAg = l.price ? shekelsToAgorot(parseFloat(l.price)) : null
      items.push({
        raw_name: l.name,
        quantity: rec,
        unit: l.unit || null,
        unit_price: priceAg,
        line_total: priceAg != null ? Math.round(priceAg * rec) : null,
      })
    }
    for (const e of extras) {
      const q = parseFloat(e.quantity)
      if (!(e.name.trim() && q > 0)) continue
      const priceAg = e.price ? shekelsToAgorot(parseFloat(e.price)) : null
      items.push({
        raw_name: e.name.trim(),
        quantity: q,
        unit: e.unit.trim() || null,
        unit_price: priceAg,
        line_total: priceAg != null ? Math.round(priceAg * q) : null,
      })
    }
    if (items.length === 0) {
      toast.error('לא התקבל אף פריט')
      return
    }
    const total = items.reduce((s, it) => s + (it.line_total ?? 0), 0)
    const note =
      issues.length === 0
        ? 'קבלה תואמת להזמנה.'
        : 'אי-התאמות: ' + issues.map((x) => x.label).join(' · ')

    const inv = await createInvoice.mutateAsync({
      supplier_id: order.supplier_id,
      invoice_number: null,
      invoice_date: todayIso(),
      total_amount: total,
      status: 'confirmed',
      image_path: imagePath,
      notes: note,
      order_id: order.id,
      items,
    })
    await setStatus.mutateAsync({ id: order.id, status: 'closed' })
    toast.success('הקבלה אושרה ונרשמה')
    navigate(`/invoices/${(inv as { id: string }).id}`)
  }

  if (isLoading || !order) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  const busy = createInvoice.isPending || setStatus.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/orders" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">קבלת סחורה</h1>
      </div>
      <p className="text-sm text-neutral-400">
        {order.supplier?.name ?? 'ללא ספק'} · הצלב מול תעודת המשלוח והתאם היכן ששונה.
      </p>

      {/* צילום תעודת משלוח → מילוי אוטומטי */}
      <Card className="space-y-3">
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 py-4 text-neutral-300',
            'hover:border-brand-600 hover:text-white',
            scanning && 'pointer-events-none opacity-60'
          )}
        >
          {scanning ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
          {scanning ? 'מחלץ מהתעודה...' : 'צלם תעודת משלוח ומלא אוטומטית'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleDeliveryNote}
            disabled={scanning}
          />
        </label>
        {scanNote && (
          <p className="flex items-start gap-2 rounded-lg bg-brand-950/40 px-3 py-2 text-sm text-brand-200">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            {scanNote}
          </p>
        )}
      </Card>

      {/* סיכום אי-התאמות */}
      {issues.length === 0 ? (
        <Card className="flex items-center gap-3 border-green-900 bg-green-950/20">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-green-400" />
          <p className="text-green-200">הכל תואם להזמנה</p>
        </Card>
      ) : (
        <Card className="space-y-2 border-amber-900 bg-amber-950/20">
          <div className="flex items-center gap-2 font-semibold text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            {issues.length} אי-התאמות
          </div>
          <ul className="space-y-1 text-sm">
            {issues.map((x, i) => (
              <li
                key={i}
                className={x.severity === 'red' ? 'text-red-300' : 'text-amber-300'}
              >
                • {x.label}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* פריטים שהוזמנו */}
      <div className="space-y-2">
        {lines.map((l, i) => {
          const badge = lineBadge(l)
          return (
            <Card key={l.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{l.name}</p>
                {badge && (
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', badge.cls)}>
                    {badge.text}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>
                  הוזמן: <span className="num">{l.orderedQty}</span> {l.unit}
                </span>
                {l.expectedAgorot != null && (
                  <span>· מוסכם {formatCurrency(l.expectedAgorot)}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">התקבל</label>
                  <input
                    value={l.received}
                    onChange={(e) => setLine(i, { received: e.target.value })}
                    inputMode="decimal"
                    dir="ltr"
                    className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">
                    מחיר בפועל ₪
                  </label>
                  <input
                    value={l.price}
                    onChange={(e) => setLine(i, { price: e.target.value })}
                    inputMode="decimal"
                    dir="ltr"
                    className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* פריטים שהגיעו ולא הוזמנו */}
      <div className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-neutral-300">הגיע ולא הוזמן</h2>
        {extras.map((e, i) => (
          <Card key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={e.name}
                onChange={(ev) => setExtra(i, { name: ev.target.value })}
                placeholder="שם המוצר"
                className="h-11 flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <button
                onClick={() => setExtras((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 rounded-lg p-2 text-neutral-500 hover:text-red-400"
                aria-label="הסר"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                value={e.quantity}
                onChange={(ev) => setExtra(i, { quantity: ev.target.value })}
                placeholder="כמות"
                inputMode="decimal"
                dir="ltr"
                className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <input
                value={e.unit}
                onChange={(ev) => setExtra(i, { unit: ev.target.value })}
                placeholder="יחידה"
                className="h-11 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
              />
              <input
                value={e.price}
                onChange={(ev) => setExtra(i, { price: ev.target.value })}
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
          onClick={() =>
            setExtras((prev) => [
              ...prev,
              { name: '', quantity: '', unit: '', price: '' },
            ])
          }
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          הוסף פריט שלא הוזמן
        </Button>
      </div>

      <div className="sticky bottom-4">
        <Button onClick={confirmReceipt} loading={busy} size="lg" className="w-full">
          <Check className="h-5 w-5" />
          אשר קבלה ורשום חשבונית
        </Button>
      </div>
    </div>
  )
}
