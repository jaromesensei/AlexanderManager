import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, FileBarChart, Coins, Settings2 } from 'lucide-react'
import {
  useMinWage,
  useSetMinWage,
  useTravelPerDay,
  useSetTravelPerDay,
  useTipDays,
  tipPerHour,
  type TipDayRow,
} from '@/lib/queries/tips'
import { formatCurrency, shekelsToAgorot, agorotToShekels } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'

function dmy(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}
function weekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  return names[new Date(y, m - 1, d).getDay()]
}

export function Tips() {
  const navigate = useNavigate()
  const { data: minWage } = useMinWage()
  const setMinWage = useSetMinWage()
  const { data: days, isLoading } = useTipDays()

  const { data: travel } = useTravelPerDay()
  const setTravel = useSetTravelPerDay()

  const [editWage, setEditWage] = useState(false)
  const [wageInput, setWageInput] = useState('')
  const [editTravel, setEditTravel] = useState(false)
  const [travelInput, setTravelInput] = useState('')

  useEffect(() => {
    if (minWage != null) setWageInput(String(agorotToShekels(minWage)))
  }, [minWage])
  useEffect(() => {
    if (travel != null) setTravelInput(String(agorotToShekels(travel)))
  }, [travel])

  async function saveWage() {
    const val = parseFloat(wageInput)
    if (!(val > 0)) return
    await setMinWage.mutateAsync(shekelsToAgorot(val))
    setEditWage(false)
  }
  async function saveTravel() {
    const val = parseFloat(travelInput)
    if (!(val >= 0)) return
    await setTravel.mutateAsync(shekelsToAgorot(val))
    setEditTravel(false)
  }

  const recent = days ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/" className="text-neutral-400 hover:text-neutral-100">
          <ChevronLeft className="h-5 w-5 rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold">טיפים ושכר</h1>
      </div>

      {/* פעולות ראשיות */}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => navigate('/tips/close')} size="lg" className="w-full">
          <Plus className="h-5 w-5" />
          סגירת יום
        </Button>
        <Button
          onClick={() => navigate('/tips/report')}
          variant="secondary"
          size="lg"
          className="w-full"
        >
          <FileBarChart className="h-5 w-5" />
          דוח חודשי
        </Button>
      </div>

      {/* שכר מינימום */}
      <Card className="space-y-2">
        {editWage ? (
          <div className="space-y-2">
            <Input
              label="שכר מינימום לשעה (₪)"
              value={wageInput}
              onChange={(e) => setWageInput(e.target.value)}
              inputMode="decimal"
              dir="ltr"
            />
            <div className="flex gap-2">
              <Button
                onClick={saveWage}
                loading={setMinWage.isPending}
                className="flex-1"
              >
                שמור
              </Button>
              <Button variant="ghost" onClick={() => setEditWage(false)}>
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditWage(true)}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Settings2 className="h-4 w-4 text-neutral-500" />
              שכר מינימום לשעה
            </span>
            <span className="num font-semibold">
              {minWage != null ? formatCurrency(minWage) : '—'}
            </span>
          </button>
        )}
      </Card>

      {/* נסיעות ליום */}
      <Card className="space-y-2">
        {editTravel ? (
          <div className="space-y-2">
            <Input
              label="דמי נסיעות ליום עבודה (₪)"
              value={travelInput}
              onChange={(e) => setTravelInput(e.target.value)}
              inputMode="decimal"
              dir="ltr"
            />
            <div className="flex gap-2">
              <Button
                onClick={saveTravel}
                loading={setTravel.isPending}
                className="flex-1"
              >
                שמור
              </Button>
              <Button variant="ghost" onClick={() => setEditTravel(false)}>
                ביטול
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditTravel(true)}
            className="flex w-full items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm text-neutral-300">
              <Settings2 className="h-4 w-4 text-neutral-500" />
              נסיעות ליום עבודה
            </span>
            <span className="num font-semibold">
              {travel != null ? formatCurrency(travel) : '—'}
            </span>
          </button>
        )}
      </Card>

      {/* ימים אחרונים */}
      <div className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-neutral-300">סגירות אחרונות</h2>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : recent.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="עוד לא נסגר יום"
            description='לחץ "סגירת יום" כדי להזין טיפים ושעות ולחשב תשלום לכל עובד.'
          />
        ) : (
          recent.map((d) => <DayRow key={d.id} day={d} />)
        )}
      </div>
    </div>
  )
}

function DayRow({ day }: { day: TipDayRow }) {
  const tph = tipPerHour(day.total_tips, day.hours)
  return (
    <Link to={`/tips/close?date=${day.work_date}`}>
      <Card className="tap flex items-center justify-between">
        <div>
          <p className="font-semibold">
            {weekday(day.work_date)} · {dmy(day.work_date)}
          </p>
          <p className="text-xs text-neutral-500">
            {day.count} עובדים · <span className="num">{day.hours}</span> שעות ·{' '}
            {formatCurrency(Math.round(tph))}/שעה
          </p>
        </div>
        <div className="text-left">
          <p className="num font-bold">{formatCurrency(day.total_tips)}</p>
          <p className="text-xs text-neutral-500">טיפים</p>
        </div>
      </Card>
    </Link>
  )
}
