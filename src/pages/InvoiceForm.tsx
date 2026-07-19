import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, Camera, Loader2, Sparkles } from 'lucide-react'
import {
  useCreateInvoice,
  useInvoice,
  useUpdateInvoice,
  type InvoiceInput,
} from '@/lib/queries/invoices'
import { useSuppliers } from '@/lib/queries/suppliers'
import {
  uploadInvoiceImage,
  getInvoiceImageUrl,
  extractInvoice,
} from '@/lib/queries/storage'
import {
  cn,
  formatCurrency,
  shekelsToAgorot,
  agorotToShekels,
} from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { FullScreenSpinner } from '@/components/ui/Spinner'

const UNITS = ['ק"ג', 'גרם', 'יחידה', 'ליטר', 'מ"ל', 'מארז', 'ארגז', 'שקית']

interface ItemRow {
  raw_name: string
  quantity: string
  unit: string
  unit_price: string // בשקלים
}

function emptyRow(): ItemRow {
  return { raw_name: '', quantity: '', unit: '', unit_price: '' }
}

function rowLineTotalAgorot(row: ItemRow): number {
  const qty = parseFloat(row.quantity)
  const price = parseFloat(row.unit_price)
  if (isNaN(qty) || isNaN(price)) return 0
  return Math.round(qty * shekelsToAgorot(price))
}

export function InvoiceForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const { data: suppliers } = useSuppliers()
  const { data: existing, isLoading: loadingExisting } = useInvoice(id)
  const create = useCreateInvoice()
  const update = useUpdateInvoice()

  const [supplierId, setSupplierId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [totalShekels, setTotalShekels] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [items, setItems] = useState<ItemRow[]>([emptyRow()])
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractNote, setExtractNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // טעינת חשבונית קיימת לעריכה
  useEffect(() => {
    if (!existing) return
    setSupplierId(existing.supplier_id ?? '')
    setInvoiceNumber(existing.invoice_number ?? '')
    setInvoiceDate(existing.invoice_date ?? '')
    setTotalShekels(
      existing.total_amount != null ? String(agorotToShekels(existing.total_amount)) : ''
    )
    setNotes(existing.notes ?? '')
    setConfirmed(existing.status === 'confirmed')
    setImagePath(existing.image_path)
    setItems(
      existing.items.length
        ? existing.items.map((it) => ({
            raw_name: it.raw_name,
            quantity: it.quantity != null ? String(it.quantity) : '',
            unit: it.unit ?? '',
            unit_price:
              it.unit_price != null ? String(agorotToShekels(it.unit_price)) : '',
          }))
        : [emptyRow()]
    )
  }, [existing])

  // קישור חתום לתצוגת התמונה
  useEffect(() => {
    if (imagePath) getInvoiceImageUrl(imagePath).then(setImageUrl)
    else setImageUrl(null)
  }, [imagePath])

  const lineSumAgorot = useMemo(
    () => items.reduce((sum, r) => sum + rowLineTotalAgorot(r), 0),
    [items]
  )

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const path = await uploadInvoiceImage(file)
      setImagePath(path)
    } catch (err) {
      setError('העלאת התמונה נכשלה: ' + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleExtract() {
    if (!imagePath) return
    setExtracting(true)
    setError(null)
    setExtractNote(null)
    try {
      const ex = await extractInvoice(imagePath)
      if (ex.invoice_number) setInvoiceNumber(ex.invoice_number)
      if (ex.invoice_date) setInvoiceDate(ex.invoice_date)
      if (ex.total) setTotalShekels(String(ex.total))
      if (ex.items?.length) {
        setItems(
          ex.items.map((it) => ({
            raw_name: it.name ?? '',
            quantity: it.quantity ? String(it.quantity) : '',
            unit: it.unit ?? '',
            unit_price: it.unit_price ? String(it.unit_price) : '',
          }))
        )
      }
      // ניסיון להתאים ספק קיים לפי השם
      const name = ex.supplier_name?.trim()
      if (name && suppliers) {
        const match = suppliers.find(
          (s) => s.name.trim() === name || s.name.includes(name) || name.includes(s.name)
        )
        if (match) setSupplierId(match.id)
        else setExtractNote(`הספק "${name}" זוהה — בחר או הוסף אותו ידנית`)
      }
    } catch (err) {
      setError('החילוץ נכשל: ' + (err as Error).message)
    } finally {
      setExtracting(false)
    }
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function addItem() {
    setItems((prev) => [...prev, emptyRow()])
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setError(null)
    const input: InvoiceInput = {
      supplier_id: supplierId || null,
      invoice_number: invoiceNumber.trim() || null,
      invoice_date: invoiceDate || null,
      total_amount: totalShekels ? shekelsToAgorot(parseFloat(totalShekels)) : null,
      status: confirmed ? 'confirmed' : 'pending',
      image_path: imagePath,
      notes: notes.trim() || null,
      items: items
        .filter((r) => r.raw_name.trim() !== '')
        .map((r) => ({
          raw_name: r.raw_name.trim(),
          quantity: r.quantity ? parseFloat(r.quantity) : null,
          unit: r.unit || null,
          unit_price: r.unit_price ? shekelsToAgorot(parseFloat(r.unit_price)) : null,
          line_total: rowLineTotalAgorot(r) || null,
        })),
    }

    try {
      if (isEdit) {
        await update.mutateAsync({ id: id!, input })
        navigate(`/invoices/${id}`)
      } else {
        const inv = await create.mutateAsync(input)
        navigate(`/invoices/${inv.id}`)
      }
    } catch (err) {
      setError('שמירה נכשלה: ' + (err as Error).message)
    }
  }

  if (isEdit && loadingExisting) return <FullScreenSpinner />
  const busy = create.isPending || update.isPending

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="text-neutral-400 hover:text-neutral-100"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">{isEdit ? 'עריכת חשבונית' : 'חשבונית חדשה'}</h1>
      </div>

      {/* תמונת החשבונית */}
      <Card className="space-y-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="חשבונית"
            className="max-h-64 w-full rounded-xl object-contain"
          />
        ) : null}
        <label
          className={cn(
            'flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-700 py-4 text-neutral-300',
            'hover:border-brand-600 hover:text-white'
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
          {imageUrl ? 'החלף תמונה' : 'צלם / העלה חשבונית'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImage}
            disabled={uploading}
          />
        </label>

        {imagePath && (
          <>
            <Button
              onClick={handleExtract}
              loading={extracting}
              disabled={uploading}
              className="w-full"
            >
              <Sparkles className="h-4 w-4" />
              {extracting ? 'מחלץ...' : 'חלץ אוטומטית עם AI'}
            </Button>
            {extractNote && (
              <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
                {extractNote}
              </p>
            )}
          </>
        )}
      </Card>

      {/* פרטי החשבונית */}
      <Card className="space-y-3">
        <Select
          label="ספק"
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
        >
          <option value="">— בחר ספק —</option>
          {suppliers?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="מספר חשבונית"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            dir="ltr"
          />
          <Input
            label="תאריך"
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            dir="ltr"
          />
        </div>
      </Card>

      {/* שורות פריטים */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-semibold">פריטים</h2>
          <span className="text-sm text-neutral-400">
            סה"כ שורות: {formatCurrency(lineSumAgorot)}
          </span>
        </div>

        {items.map((row, i) => (
          <Card key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={row.raw_name}
                onChange={(e) => updateItem(i, { raw_name: e.target.value })}
                placeholder="שם המוצר"
                className="flex-1"
              />
              <button
                onClick={() => removeItem(i)}
                className="shrink-0 rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-red-400"
                aria-label="הסר שורה"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={row.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                placeholder="כמות"
                inputMode="decimal"
                dir="ltr"
              />
              <input
                list="units"
                value={row.unit}
                onChange={(e) => updateItem(i, { unit: e.target.value })}
                placeholder="יחידה"
                className="h-12 rounded-xl border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-brand-500 focus:outline-none"
              />
              <Input
                value={row.unit_price}
                onChange={(e) => updateItem(i, { unit_price: e.target.value })}
                placeholder="₪ ליחידה"
                inputMode="decimal"
                dir="ltr"
              />
            </div>
            <p className="text-left text-sm text-neutral-400">
              שורה: {formatCurrency(rowLineTotalAgorot(row))}
            </p>
          </Card>
        ))}
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <Button variant="secondary" onClick={addItem} className="w-full">
          <Plus className="h-4 w-4" />
          הוסף פריט
        </Button>
      </div>

      {/* סיכום */}
      <Card className="space-y-3">
        <div className="flex items-end gap-2">
          <Input
            label='סה"כ לתשלום (₪)'
            value={totalShekels}
            onChange={(e) => setTotalShekels(e.target.value)}
            inputMode="decimal"
            dir="ltr"
            placeholder="כולל מע״מ"
          />
          <Button
            variant="ghost"
            size="sm"
            className="mb-0.5 shrink-0"
            onClick={() => setTotalShekels(String(agorotToShekels(lineSumAgorot)))}
          >
            = סכום השורות
          </Button>
        </div>
        <Textarea
          label="הערות"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
        <label className="flex items-center gap-3 rounded-xl bg-neutral-800/50 p-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="h-5 w-5 accent-brand-600"
          />
          <span className="text-sm">
            אשר חשבונית (מאושרת נכנסת להיסטוריית מחירים בהמשך)
          </span>
        </label>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={save} loading={busy} size="lg" className="flex-1">
          שמירה
        </Button>
      </div>
    </div>
  )
}
