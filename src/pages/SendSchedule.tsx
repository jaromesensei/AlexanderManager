import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Share2, MessageCircle, Copy, Check } from 'lucide-react'
import { useShifts, type ShiftRow } from '@/lib/queries/shifts'
import { useEmployees } from '@/lib/queries/employees'
import {
  addDays,
  toISODate,
  WEEKDAY_NAMES,
  ROLE_LABELS,
  SHIFT_LABELS,
  shortTime,
} from '@/lib/scheduling'
import { toWaNumber, waLink, shareText } from '@/lib/whatsapp'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

const RESTAURANT = 'אלכסנדר'

function dm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function weekdayOf(iso: string): number {
  return new Date(iso + 'T00:00:00').getDay()
}

function sortShifts(a: ShiftRow, b: ShiftRow): number {
  if (a.work_date !== b.work_date) return a.work_date < b.work_date ? -1 : 1
  if (a.shift !== b.shift) return a.shift === 'morning' ? -1 : 1
  return (a.start_time ?? '').localeCompare(b.start_time ?? '')
}

export function SendSchedule() {
  const { from = '' } = useParams()
  const to = toISODate(addDays(new Date(from + 'T00:00:00'), 6))
  const { data: shifts, isLoading } = useShifts(from, to)
  const { data: employees } = useEmployees()

  const phoneById = useMemo(() => {
    const m: Record<string, string | null> = {}
    for (const e of employees ?? []) m[e.id] = e.phone
    return m
  }, [employees])

  const generalMessage = useMemo(() => {
    if (!shifts?.length) return ''
    const lines = [`סידור עבודה · ${RESTAURANT}`, `${dm(from)}–${dm(to)}`, '']
    const sorted = [...shifts].sort(sortShifts)
    let curDate = ''
    for (const s of sorted) {
      if (s.work_date !== curDate) {
        curDate = s.work_date
        lines.push('', `יום ${WEEKDAY_NAMES[weekdayOf(s.work_date)]} ${dm(s.work_date)}`)
      }
      const label = SHIFT_LABELS[s.shift]
      const time = s.start_time ? ` משעה ${shortTime(s.start_time)}` : ''
      lines.push(
        `${label} · ${s.employee?.full_name ?? ''} (${ROLE_LABELS[s.role]})${time}`
      )
    }
    return lines.join('\n').trim()
  }, [shifts, from, to])

  const byEmployee = useMemo(() => {
    const map: Record<string, ShiftRow[]> = {}
    for (const s of shifts ?? []) (map[s.employee_id] ??= []).push(s)
    for (const id in map) map[id].sort(sortShifts)
    return map
  }, [shifts])

  function personalMessage(name: string, list: ShiftRow[]): string {
    const lines = [`היי ${name} 👋 המשמרות שלך:`]
    for (const s of list) {
      const time = s.start_time ? ` משעה ${shortTime(s.start_time)}` : ''
      lines.push(
        `• ${WEEKDAY_NAMES[weekdayOf(s.work_date)]} ${dm(s.work_date)} — ${SHIFT_LABELS[s.shift]}${time} (${ROLE_LABELS[s.role]})`
      )
    }
    lines.push('', `בהצלחה! · ${RESTAURANT}`)
    return lines.join('\n')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/schedule" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">שליחת סידור</h1>
      </div>
      <p className="text-sm text-neutral-400">
        שבוע {dm(from)}–{dm(to)}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !shifts?.length ? (
        <Card className="py-10 text-center text-neutral-400">
          אין שיבוצים בשבוע הזה לשליחה.
        </Card>
      ) : (
        <>
          <ShareGeneral message={generalMessage} />

          <h2 className="px-1 pt-2 font-semibold">שליחה אישית לכל עובד</h2>
          {Object.entries(byEmployee).map(([empId, list]) => {
            const name = list[0].employee?.full_name ?? 'עובד'
            const wa = toWaNumber(phoneById[empId])
            const msg = personalMessage(name, list)
            return (
              <Card key={empId} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="text-sm text-neutral-400">{list.length} משמרות</p>
                </div>
                <div className="flex gap-2">
                  <CopyButton text={msg} />
                  {wa ? (
                    <a href={waLink(wa, msg)} target="_blank" rel="noreferrer">
                      <Button size="sm">
                        <MessageCircle className="h-4 w-4" />
                        וואטסאפ
                      </Button>
                    </a>
                  ) : (
                    <span className="self-center text-xs text-neutral-500">
                      אין טלפון
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}

function ShareGeneral({ message }: { message: string }) {
  const [status, setStatus] = useState<string | null>(null)
  async function go() {
    const res = await shareText(message)
    setStatus(res === 'copied' ? 'הועתק ללוח ✓' : res === 'failed' ? 'נכשל' : null)
  }
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">הודעה כללית</h2>
        <p className="text-sm text-neutral-400">הסידור המלא לשיתוף בקבוצה</p>
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-950 p-3 text-xs text-neutral-300">
        {message}
      </pre>
      <Button onClick={go} className="w-full">
        <Share2 className="h-4 w-4" />
        שתף / העתק
      </Button>
      {status && <p className="text-center text-sm text-green-400">{status}</p>}
    </Card>
  )
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text).catch(() => {})
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <Button size="sm" variant="secondary" onClick={copy}>
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
