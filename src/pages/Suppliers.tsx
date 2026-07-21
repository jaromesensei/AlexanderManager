import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Pencil, Trash2, Phone, X, Truck } from 'lucide-react'
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from '@/lib/queries/suppliers'
import type { Supplier } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export function Suppliers() {
  const { data: suppliers, isLoading } = useSuppliers()
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/invoices" className="text-neutral-400 hover:text-neutral-100">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">ספקים</h1>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          ספק חדש
        </Button>
      </div>

      {editing && (
        <SupplierForm
          supplier={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !suppliers?.length ? (
        <EmptyState
          icon={Truck}
          title="עדיין אין ספקים"
          description="הוסף את הספקים שמהם אתה מזמין, כדי לשייך אליהם חשבוניות."
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              ספק חדש
            </Button>
          }
        />
      ) : (
        <div className="stagger space-y-2">
          {suppliers.map((s) => (
            <Card key={s.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{s.name}</p>
                {s.phone && (
                  <a
                    href={`tel:${s.phone}`}
                    className="mt-0.5 flex items-center gap-1 text-sm text-neutral-400"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="num">{s.phone}</span>
                  </a>
                )}
              </div>
              <button
                onClick={() => setEditing(s)}
                className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                aria-label="עריכה"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function SupplierForm({
  supplier,
  onClose,
}: {
  supplier: Supplier | null
  onClose: () => void
}) {
  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const del = useDeleteSupplier()
  const confirm = useConfirm()
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = create.isPending || update.isPending || del.isPending

  async function save() {
    if (!name.trim()) return
    setError(null)
    const payload = { name: name.trim(), phone: phone.trim(), notes: notes.trim() }
    try {
      if (supplier) {
        await update.mutateAsync({ id: supplier.id, ...payload })
      } else {
        await create.mutateAsync(payload)
      }
      onClose()
    } catch (err) {
      setError('שמירה נכשלה: ' + (err as Error).message)
    }
  }

  async function remove() {
    if (!supplier) return
    const ok = await confirm({
      title: 'למחוק ספק?',
      message: `הספק "${supplier.name}" יימחק לצמיתות.`,
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(supplier.id)
    onClose()
  }

  return (
    <Card className="space-y-3 border-brand-800">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{supplier ? 'עריכת ספק' : 'ספק חדש'}</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <Input
        label="שם הספק"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="למשל: קצביית הגליל"
      />
      <Input
        label="טלפון"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        dir="ltr"
        inputMode="tel"
        placeholder="050-1234567"
      />
      <Textarea
        label="הערות"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
      />
      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={save} loading={busy} disabled={!name.trim()} className="flex-1">
          שמירה
        </Button>
        {supplier && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}
