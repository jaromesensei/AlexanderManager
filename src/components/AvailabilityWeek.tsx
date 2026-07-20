import { useEffect, useMemo, useState } from 'react'
import { Sun, Moon, ChevronRight, ChevronLeft, Check, ArrowRight } from 'lucide-react'
import type { AvailData, AvailEntry } from '@/lib/queries/availability'
import {
  startOfWeek,
  addDays,
  toISODate,
  WEEKDAY_NAMES,
  SHIFTS,
  SHIFT_LABELS,
} from '@/lib/scheduling'
import { formatDate, cn } from '@/lib/utils'
import { APP_VERSION } from '@/version'
import { Button } from '@/components/ui/Button'
import { FullScreenSpinner } from '@/components/ui/Spinner'
import type { ShiftType } from '@/types/database'

const cellKey = (date: string, shift: ShiftType) => `${date}:${shift}`

/** מסך מילוי זמינות שבועי - משותף לקישור אישי ולקישור קבוצתי. */
export function AvailabilityWeek({
  getData,
  submitData,
  invalidMsg = 'הקישור לא תקין או שפג תוקפו.',
  onBack,
}: {
  getData: (from: string, to: string) => Promise<AvailData>
  submitData: (entries: AvailEntry[]) => Promise<void>
  invalidMsg?: string
  onBack?: () => void
}) {
  const [weekStart, setWeekStart] = useState(() => addDays(startOfWeek(new Date()), 7))
  const from = toISODate(weekStart)
  const to = toISODate(addDays(weekStart, 6))

  const [name, setName] = useState<string | null>(null)
  const [avail, setAvail] = useState<Record<string, boolean>>({})
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  useEffect(() => {
    let active = true
    setLoading(true)
    getData(from, to)
      .then((data) => {
        if (!active) return
        setName(data.full_name)
        setLocked(data.locked)
        const map: Record<string, boolean> = {}
        for (const a of data.availability)
          map[cellKey(a.work_date, a.shift)] = a.available
        setAvail(map)
      })
      .catch(() => active && setError(invalidMsg))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [from, to])

  function toggle(date: string, shift: ShiftType) {
    if (locked) return
    setAvail((prev) => ({ ...prev, [cellKey(date, shift)]: !prev[cellKey(date, shift)] }))
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const entries: AvailEntry[] = []
      for (const day of days) {
        const iso = toISODate(day)
        for (const shift of SHIFTS)
          entries.push({ work_date: iso, shift, available: !!avail[cellKey(iso, shift)] })
      }
      await submitData(entries)
      setLocked(true)
    } catch (err) {
      setError(
        (err as Error).message?.includes('locked')
          ? 'כבר שלחת זמינות לשבוע זה. לשינוי פנה למנהל.'
          : 'השליחה נכשלה, נסה שוב.'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading && !name) return <FullScreenSpinner />

  if (error && !name)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-neutral-300">{error}</p>
      </div>
    )

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-4 text-center">
        {onBack && (
          <button
            onClick={onBack}
            className="float-right rounded-lg p-1 text-neutral-400 hover:text-neutral-100"
            aria-label="חזרה"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-2xl font-extrabold text-brand-500">אלכסנדר</h1>
        <p className="mt-1 text-neutral-300">היי {name} 👋 סמן מתי אתה יכול לעבוד</p>
      </div>

      {locked && (
        <div className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-center text-sm text-amber-200">
          🔒 כבר שלחת זמינות לשבוע זה. לשינוי פנה למנהל.
        </div>
      )}

      <div className="mb-3 flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900 px-2 py-2">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
          aria-label="שבוע קודם"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-neutral-300">
          {formatDate(weekStart)} – {formatDate(addDays(weekStart, 6))}
        </span>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="rounded-lg p-2 text-neutral-300 hover:bg-neutral-800"
          aria-label="שבוע הבא"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        {days.map((day, i) => {
          const iso = toISODate(day)
          return (
            <div
              key={iso}
              className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900 p-3"
            >
              <div>
                <span className="font-semibold">יום {WEEKDAY_NAMES[i]}</span>
                <span className="mr-2 text-sm text-neutral-500">{formatDate(day)}</span>
              </div>
              <div className="flex gap-2">
                {SHIFTS.map((shift) => {
                  const on = !!avail[cellKey(iso, shift)]
                  const Icon = shift === 'morning' ? Sun : Moon
                  return (
                    <button
                      key={shift}
                      onClick={() => toggle(iso, shift)}
                      disabled={locked}
                      className={cn(
                        'flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        on
                          ? 'bg-green-700 text-white'
                          : 'bg-neutral-800 text-neutral-400',
                        locked && 'opacity-60'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {SHIFT_LABELS[shift]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-center text-xs text-neutral-500">
        ירוק = אני יכול לעבוד. השאר אפור = לא זמין.
      </p>

      {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}

      <div className="sticky bottom-4 mt-4">
        <Button
          onClick={submit}
          loading={saving}
          disabled={locked}
          size="lg"
          className="w-full"
        >
          {locked ? (
            <>
              <Check className="h-5 w-5" /> נשלח ונעול 🔒
            </>
          ) : (
            'שלח זמינות'
          )}
        </Button>
      </div>

      <p className="mt-4 text-center text-xs text-neutral-600">גרסה {APP_VERSION}</p>
    </div>
  )
}
