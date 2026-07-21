import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Phone,
  Send,
  Check,
  Users,
} from 'lucide-react'
import {
  useEmployees,
  useSaveEmployee,
  useDeleteEmployee,
  type EmployeeWithRoles,
} from '@/lib/queries/employees'
import type { StaffRole } from '@/types/database'
import { STAFF_ROLES, ROLE_LABELS } from '@/lib/scheduling'
import { toWaNumber, waLink } from '@/lib/whatsapp'
import { shekelsToAgorot, agorotToShekels, formatCurrency, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useConfirm } from '@/components/ui/ConfirmDialog'

export function Employees() {
  const { data: employees, isLoading } = useEmployees()
  const [editing, setEditing] = useState<EmployeeWithRoles | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/schedule" className="text-neutral-400 hover:text-neutral-100">
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">עובדים</h1>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" />
          עובד חדש
        </Button>
      </div>

      {editing && (
        <EmployeeForm
          employee={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {isLoading ? (
        <ListSkeleton />
      ) : !employees?.length ? (
        <EmptyState
          icon={Users}
          title="עדיין אין עובדים"
          description="הוסף את העובדים כדי לשבץ אותם בסידור ולבקש זמינות."
          action={
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              עובד חדש
            </Button>
          }
        />
      ) : (
        <div className="stagger space-y-2">
          {employees.map((e) => (
            <Card key={e.id} className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{e.full_name}</p>
                  {!e.active && (
                    <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
                      לא פעיל
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-neutral-400">
                  {e.roles.map((r) => ROLE_LABELS[r.role]).join(' · ') || 'ללא תפקיד'}
                  {e.hourly_rate != null && ` · ${formatCurrency(e.hourly_rate)}/שעה`}
                </p>
                {e.phone && (
                  <a
                    href={`tel:${e.phone}`}
                    className="mt-0.5 flex items-center gap-1 text-sm text-neutral-400"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span className="num">{e.phone}</span>
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1">
                <AvailabilityLinkButton employee={e} />
                <button
                  onClick={() => setEditing(e)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
                  aria-label="עריכה"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function AvailabilityLinkButton({ employee }: { employee: EmployeeWithRoles }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/availability/${employee.avail_token}`
  const message = `היי ${employee.full_name}, שלח לי את הזמינות שלך לשבוע הבא דרך הקישור:\n${link}`
  const wa = toWaNumber(employee.phone)

  async function copy() {
    await navigator.clipboard.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (wa) {
    return (
      <a
        href={waLink(wa, message)}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg p-2 text-green-500 hover:bg-neutral-800"
        aria-label="שלח קישור זמינות בוואטסאפ"
      >
        <Send className="h-4 w-4" />
      </a>
    )
  }
  return (
    <button
      onClick={copy}
      className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      aria-label="העתק קישור זמינות"
    >
      {copied ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
    </button>
  )
}

function EmployeeForm({
  employee,
  onClose,
}: {
  employee: EmployeeWithRoles | null
  onClose: () => void
}) {
  const save = useSaveEmployee()
  const del = useDeleteEmployee()
  const confirm = useConfirm()
  const [name, setName] = useState(employee?.full_name ?? '')
  const [phone, setPhone] = useState(employee?.phone ?? '')
  const [rate, setRate] = useState(
    employee?.hourly_rate != null ? String(agorotToShekels(employee.hourly_rate)) : ''
  )
  const [active, setActive] = useState(employee?.active ?? true)
  const [roles, setRoles] = useState<StaffRole[]>(
    employee?.roles.map((r) => r.role) ?? []
  )
  const [error, setError] = useState<string | null>(null)
  const busy = save.isPending || del.isPending

  function toggleRole(role: StaffRole) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  async function submit() {
    if (!name.trim()) return
    setError(null)
    try {
      await save.mutateAsync({
        id: employee?.id,
        input: {
          full_name: name.trim(),
          phone: phone.trim() || null,
          hourly_rate: rate ? shekelsToAgorot(parseFloat(rate)) : null,
          active,
          roles,
        },
      })
      onClose()
    } catch (err) {
      setError('שמירה נכשלה: ' + (err as Error).message)
    }
  }

  async function remove() {
    if (!employee) return
    const ok = await confirm({
      title: 'למחוק עובד?',
      message: `${employee.full_name} יימחק, כולל השיוך לתפקידים.`,
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(employee.id)
    onClose()
  }

  return (
    <Card className="space-y-3 border-brand-800">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{employee ? 'עריכת עובד' : 'עובד חדש'}</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <Input label="שם מלא" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="טלפון"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          inputMode="tel"
          placeholder="050-1234567"
        />
        <Input
          label="שכר שעתי (₪)"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          dir="ltr"
          inputMode="decimal"
        />
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-300">תפקידים</p>
        <div className="flex flex-wrap gap-2">
          {STAFF_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                roles.includes(role)
                  ? 'bg-brand-700 text-white'
                  : 'bg-neutral-800 text-neutral-300'
              )}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-xl bg-neutral-800/50 p-3">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 accent-brand-600"
        />
        <span className="text-sm">עובד פעיל</span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <Button
          onClick={submit}
          loading={busy}
          disabled={!name.trim()}
          className="flex-1"
        >
          שמירה
        </Button>
        {employee && (
          <Button variant="danger" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  )
}
