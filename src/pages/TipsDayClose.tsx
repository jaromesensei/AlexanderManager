import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus, Trash2, Check, Coins } from 'lucide-react'
import { useEmployees } from '@/lib/queries/employees'
import {
  useMinWage,
  useTipDayByDate,
  useSaveTipDay,
  useDeleteTipDay,
  tipPerHour,
  calcLine,
  minWageForDate,
  isSaturday,
} from '@/lib/queries/tips'
import { formatCurrency, shekelsToAgorot, agorotToShekels, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useConfirm } from '@/components/ui/ConfirmDialog'

interface Row {
  employee_id: string
  hours: string
}

function emptyRow(): Row {
  return { employee_id: '', hours: '' }
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TipsDayClose() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const [date, setDate] = useState(params.get('date') || todayIso())
  const { data: employees } = useEmployees()
  const { data: minWage = 3540 } = useMinWage()
  const { data: day, isLoading } = useTipDayByDate(date)
  const save = useSaveTipDay()
  const del = useDeleteTipDay()

  // מצב הזנה: 'total' = מזינים סך טיפים · 'perHour' = מזינים טיפ לשעה והמערכת מחשבת את הסך
  const [mode, setMode] = useState<'total' | 'perHour'>('total')
  const [totalTips, setTotalTips] = useState('')
  const [perHourInput, setPerHourInput] = useState('')
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [error, setError] = useState<string | null>(null)
  const hydratedFor = useRef<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    if (hydratedFor.current === date) return
    hydratedFor.current = date
    if (day) {
      setMode('total')
      setTotalTips(String(agorotToShekels(day.total_tips)))
      setPerHourInput('')
      setNotes(day.notes ?? '')
      setRows(
        day.entries.length
          ? day.entries.map((e) => ({
              employee_id: e.employee_id,
              hours: String(e.hours),
            }))
          : [emptyRow()]
      )
    } else {
      setMode('total')
      setTotalTips('')
      setPerHourInput('')
      setNotes('')
      setRows([emptyRow()])
    }
  }, [day, isLoading, date])

  const activeEmployees = useMemo(
    () => (employees ?? []).filter((e) => e.active),
    [employees]
  )

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const totalHours = rows.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0)
  // לפי מצב ההזנה: או שהסך ידוע וממנו נגזר טיפ/שעה, או שטיפ/שעה ידוע וממנו נגזר הסך.
  const perHourAgorot = perHourInput ? shekelsToAgorot(parseFloat(perHourInput)) : 0
  const totalTipsAgorot =
    mode === 'total'
      ? totalTips
        ? shekelsToAgorot(parseFloat(totalTips))
        : 0
      : Math.round(perHourAgorot * totalHours)
  const tph = mode === 'total' ? tipPerHour(totalTipsAgorot, totalHours) : perHourAgorot
  // שכר המינימום שחל על היום (בשבת — 150%)
  const effMinWage = minWageForDate(date, minWage)
  const isShabbat = isSaturday(date)
  const topped = totalHours > 0 && tph < effMinWage

  const payout = useMemo(() => {
    let sum = 0
    for (const r of rows) {
      const h = parseFloat(r.hours) || 0
      if (h <= 0) continue
      sum += calcLine(totalTipsAgorot, totalHours, h, effMinWage).total
    }
    return sum
  }, [rows, totalTipsAgorot, totalHours, effMinWage])

  async function onSave() {
    const entries = rows
      .filter((r) => r.employee_id && parseFloat(r.hours) > 0)
      .map((r) => ({ employee_id: r.employee_id, hours: parseFloat(r.hours) }))
    if (entries.length === 0) {
      setError('הוסף לפחות עובד אחד עם שעות')
      return
    }
    const ids = entries.map((e) => e.employee_id)
    if (new Set(ids).size !== ids.length) {
      setError('אותו עובד מופיע יותר מפעם אחת')
      return
    }
    setError(null)
    await save.mutateAsync({
      work_date: date,
      total_tips: totalTipsAgorot,
      notes: notes.trim() || null,
      entries,
    })
    navigate('/tips')
  }

  async function onDelete() {
    if (!day) return
    const ok = await confirm({
      title: 'למחוק את היום?',
      message: 'סגירת היום והנתונים שלה יימחקו.',
      confirmLabel: 'מחק',
      danger: true,
    })
    if (!ok) return
    await del.mutateAsync(day.id)
    navigate('/tips')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/tips" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">סגירת יום</h1>
      </div>

      <Card className="space-y-3">
        <Input
          label="תאריך"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          dir="ltr"
        />
        {/* מתג מצב הזנה */}
        <div>
          <span className="mb-1 block text-sm text-neutral-400">אופן הזנת הטיפים</span>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-800/60 p-1">
            <button
              type="button"
              onClick={() => setMode('total')}
              className={cn(
                'rounded-lg py-2 text-sm font-medium transition-colors',
                mode === 'total'
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-300 hover:text-white'
              )}
            >
              סך טיפים
            </button>
            <button
              type="button"
              onClick={() => setMode('perHour')}
              className={cn(
                'rounded-lg py-2 text-sm font-medium transition-colors',
                mode === 'perHour'
                  ? 'bg-brand-600 text-white'
                  : 'text-neutral-300 hover:text-white'
              )}
            >
              טיפ לשעה
            </button>
          </div>
        </div>

        {mode === 'total' ? (
          <Input
            label="סך הטיפים של היום (₪)"
            value={totalTips}
            onChange={(e) => setTotalTips(e.target.value)}
            inputMode="decimal"
            dir="ltr"
            placeholder="מזומן + אשראי יחד"
          />
        ) : (
          <div>
            <Input
              label="טיפ לשעה (₪)"
              value={perHourInput}
              onChange={(e) => setPerHourInput(e.target.value)}
              inputMode="decimal"
              dir="ltr"
              placeholder="למשל 45"
            />
            <p className="mt-1 text-xs text-neutral-500">
              הסך יחושב אוטומטית לפי השעות שתזין למטה.
            </p>
          </div>
        )}
      </Card>

      {/* משתתפים */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-neutral-300">מי עבד היום</h2>
          <span className="text-xs text-neutral-500">שעות בפועל</span>
        </div>

        {rows.map((row, i) => {
          const h = parseFloat(row.hours) || 0
          const line = h > 0 ? calcLine(totalTipsAgorot, totalHours, h, effMinWage) : null
          return (
            <Card key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <Select
                  value={row.employee_id}
                  onChange={(e) => setRow(i, { employee_id: e.target.value })}
                  className="flex-1"
                >
                  <option value="">— בחר עובד —</option>
                  {activeEmployees.map((emp) => (
                    <option
                      key={emp.id}
                      value={emp.id}
                      disabled={
                        row.employee_id !== emp.id &&
                        rows.some((r) => r.employee_id === emp.id)
                      }
                    >
                      {emp.full_name}
                    </option>
                  ))}
                </Select>
                <input
                  value={row.hours}
                  onChange={(e) => setRow(i, { hours: e.target.value })}
                  placeholder="שעות"
                  inputMode="decimal"
                  dir="ltr"
                  className="h-11 w-20 rounded-xl border border-neutral-700 bg-neutral-900 px-2 text-center text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 rounded-lg p-2 text-neutral-500 hover:text-red-400"
                  aria-label="הסר"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {line && (
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="text-neutral-500">
                    טיפים {formatCurrency(line.tips)}
                    {line.topUp > 0 && (
                      <span className="text-amber-400">
                        {' '}
                        + השלמה {formatCurrency(line.topUp)}
                      </span>
                    )}
                  </span>
                  <span className="num font-semibold text-neutral-200">
                    {formatCurrency(line.total)}
                  </span>
                </div>
              )}
            </Card>
          )
        })}

        <Button
          variant="secondary"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
          className="w-full"
        >
          <Plus className="h-4 w-4" />
          הוסף עובד
        </Button>
      </div>

      {/* סיכום היום */}
      <Card className="space-y-2 border-brand-800 bg-brand-950/20">
        {isShabbat && (
          <div className="rounded-lg bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300">
            שבת · שכר מינימום 150% ({formatCurrency(effMinWage)} לשעה)
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-neutral-300">
            <Coins className="h-4 w-4 text-brand-400" />
            טיפ לשעה
          </span>
          <span className="num font-semibold">{formatCurrency(Math.round(tph))}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-300">
            סך טיפים{mode === 'perHour' && ' (מחושב)'}
          </span>
          <span className="num font-semibold">{formatCurrency(totalTipsAgorot)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-300">סה"כ שעות</span>
          <span className="num">{totalHours}</span>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-800 pt-2 text-sm">
          <span className="text-neutral-300">סה"כ לתשלום (כולל השלמות)</span>
          <span className="num text-lg font-bold">{formatCurrency(payout)}</span>
        </div>
        {topped && (
          <p className="rounded-lg bg-amber-950/40 px-3 py-2 text-xs text-amber-300">
            הטיפ לשעה נמוך משכר המינימום{isShabbat ? ' בשבת' : ''} (
            {formatCurrency(effMinWage)}) — הופעלה השלמה למינימום.
          </p>
        )}
      </Card>

      {error && (
        <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="sticky bottom-4 space-y-2">
        <Button onClick={onSave} loading={save.isPending} size="lg" className="w-full">
          <Check className="h-5 w-5" />
          שמור סגירת יום
        </Button>
        {day && (
          <Button variant="danger" onClick={onDelete} className="w-full">
            <Trash2 className="h-4 w-4" />
            מחק את היום
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      )}
    </div>
  )
}
