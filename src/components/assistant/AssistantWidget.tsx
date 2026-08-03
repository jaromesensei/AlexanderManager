import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles,
  X,
  Send,
  Mic,
  Trash2,
  Check,
  Pencil,
  Undo2,
  Camera,
} from 'lucide-react'
import { useEmployees } from '@/lib/queries/employees'
import {
  useMinWage,
  useTipReport,
  useSaveTipDay,
  useDeleteTipDay,
} from '@/lib/queries/tips'
import type { TipDayInput } from '@/lib/queries/tips'
import { uploadInvoiceImage } from '@/lib/queries/storage'
import {
  askAssistant,
  type AssistantProposal,
  type AssistantMessage,
} from '@/lib/queries/assistant'
import { parseTimeToMinutes, shiftHours } from '@/lib/shabbat'
import { supabase } from '@/lib/supabase'
import { shekelsToAgorot, agorotToShekels, cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
function weekday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}
function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface Msg {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  image?: string // תצוגה מקדימה של צילום
  proposals?: AssistantProposal[]
  undo?: () => Promise<void>
}

// ── זיהוי דיבור (Web Speech API) ────────────────────────────────────
interface SpeechRec {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult:
    | ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void)
    | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}
function getSpeechCtor(): (new () => SpeechRec) | null {
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => SpeechRec
    SpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false)
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="פתח את אלכס"
          className="fixed bottom-24 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-500 active:scale-95"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}
      {open && <ChatPanel onClose={() => setOpen(false)} />}
    </>
  )
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const { data: employees } = useEmployees()
  const { data: minWage = 3540 } = useMinWage()
  const saveTip = useSaveTipDay()
  const del = useDeleteTipDay()

  // הקשר: 45 הימים האחרונים
  const today = todayIso()
  const from = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 45)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const { data: reportDays } = useTipReport(from, today)

  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: 'assistant',
      content:
        'היי, אני אלכס 👋 אפשר לשאול אותי על טיפים ושכר, או לבקש "סגור לי יום" ואני אכין לך את זה לאישור.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const idRef = useRef(1)
  const recRef = useRef<SpeechRec | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, loading])

  const activeEmployees = useMemo(
    () =>
      (employees ?? [])
        .filter((e) => e.active)
        .map((e) => ({ id: e.id, name: e.full_name })),
    [employees]
  )

  function buildContext() {
    return {
      today,
      weekday: weekday(today),
      min_hourly_wage_agorot: minWage,
      employees: activeEmployees,
      recent_days: (reportDays ?? []).map((d) => ({
        date: d.work_date,
        total_tips: d.total_tips,
        entries: (d.entries ?? []).map((e) => ({
          employee_id: e.employee?.id ?? '',
          employee_name: e.employee?.full_name ?? '',
          hours: e.hours,
          start: e.start_time,
          end: e.end_time,
        })),
      })),
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Msg = { id: idRef.current++, role: 'user', content: text }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)
    try {
      const convo: AssistantMessage[] = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      const res = await askAssistant(convo, buildContext())
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: 'assistant',
          content: res.reply || '...',
          proposals: res.proposals?.filter((p) => p.kind === 'close_tip_day'),
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: 'assistant',
          content: 'משהו השתבש: ' + (err as Error).message,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || loading) return
    const preview = URL.createObjectURL(file)
    const userMsg: Msg = {
      id: idRef.current++,
      role: 'user',
      content: 'צילום דף סגירות — חלץ והצע לי סגירות',
      image: preview,
    }
    const history = [...messages, userMsg]
    setMessages(history)
    setLoading(true)
    try {
      const path = await uploadInvoiceImage(file)
      const convo: AssistantMessage[] = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      const res = await askAssistant(convo, buildContext(), path)
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: 'assistant',
          content: res.reply || 'הנה מה שזיהיתי:',
          proposals: res.proposals?.filter((p) => p.kind === 'close_tip_day'),
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: 'assistant',
          content: 'החילוץ נכשל: ' + (err as Error).message,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function applyProposal(dayInput: TipDayInput) {
    // snapshot למצב הקודם (ל-Undo)
    const { data: existing } = await supabase
      .from('tip_days')
      .select(
        'id, total_tips, notes, entries:tip_day_entries(employee_id, hours, start_time, end_time, position)'
      )
      .eq('work_date', dayInput.work_date)
      .maybeSingle()
    const res = await saveTip.mutateAsync(dayInput)
    const newId = (res as { id: string }).id

    let undo: () => Promise<void>
    if (existing) {
      const p = existing as unknown as {
        total_tips: number
        notes: string | null
        entries: {
          employee_id: string
          hours: number
          start_time: string | null
          end_time: string | null
          position: number
        }[]
      }
      const prevInput: TipDayInput = {
        work_date: dayInput.work_date,
        total_tips: p.total_tips,
        notes: p.notes,
        entries: [...p.entries]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({
            employee_id: e.employee_id,
            hours: e.hours,
            start_time: e.start_time,
            end_time: e.end_time,
          })),
      }
      undo = async () => {
        await saveTip.mutateAsync(prevInput)
      }
    } else {
      undo = async () => {
        await del.mutateAsync(newId)
      }
    }

    setMessages((msgs) => [
      ...msgs,
      {
        id: idRef.current++,
        role: 'system',
        content: `נשמרה סגירת ${weekday(dayInput.work_date)} ${dmy(dayInput.work_date)} ✓`,
        undo,
      },
    ])
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const Ctor = getSpeechCtor()
    if (!Ctor) {
      toast.error('הכתבה קולית לא נתמכת במכשיר הזה')
      return
    }
    const rec = new Ctor()
    rec.lang = 'he-IL'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e) => {
      const t = e.results[0][0].transcript
      setInput((prev) => (prev ? prev + ' ' : '') + t)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    setListening(true)
    rec.start()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur">
      {/* כותרת */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="accent-soft rounded-lg p-1.5">
            <Sparkles className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <p className="font-bold leading-none">אלכס</p>
            <p className="text-xs text-neutral-500">העוזר של אלכסנדר</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="סגור"
          className="rounded-lg p-2 text-neutral-400 hover:text-neutral-100"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* הודעות */}
      <div
        ref={scrollRef}
        className="mx-auto w-full max-w-lg flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((m) => (
          <div key={m.id}>
            {m.role === 'system' ? (
              <div className="flex items-center justify-between rounded-xl border border-green-900 bg-green-950/30 px-3 py-2 text-sm text-green-200">
                <span>{m.content}</span>
                {m.undo && <UndoButton onUndo={m.undo} />}
              </div>
            ) : (
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                  m.role === 'user'
                    ? 'ml-auto bg-brand-600 text-white'
                    : 'bg-neutral-800 text-neutral-100'
                )}
              >
                {m.image && (
                  <img
                    src={m.image}
                    alt="צילום"
                    className="mb-2 max-h-40 rounded-lg object-contain"
                  />
                )}
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            )}
            {m.proposals?.map((p, i) => (
              <ProposalCard
                key={i}
                proposal={p}
                employees={activeEmployees}
                minWage={minWage}
                onApply={applyProposal}
                onClose={onClose}
              />
            ))}
          </div>
        ))}
        {loading && (
          <div className="max-w-[85%] rounded-2xl bg-neutral-800 px-3 py-2 text-sm text-neutral-400">
            אלכס חושב…
          </div>
        )}
      </div>

      {/* קלט */}
      <div className="mx-auto w-full max-w-lg border-t border-neutral-800 p-3">
        <div className="flex items-end gap-2">
          <label
            aria-label="צלם דף סגירות"
            className="shrink-0 cursor-pointer rounded-xl bg-neutral-800 p-3 text-neutral-300 transition hover:text-white"
          >
            <Camera className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImage}
              disabled={loading}
            />
          </label>
          <button
            onClick={toggleMic}
            aria-label="הכתבה קולית"
            className={cn(
              'shrink-0 rounded-xl p-3 transition',
              listening
                ? 'bg-red-600 text-white'
                : 'bg-neutral-800 text-neutral-300 hover:text-white'
            )}
          >
            <Mic className="h-5 w-5" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder={listening ? 'מקשיב…' : 'כתוב לאלכס…'}
            className="max-h-28 flex-1 resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-100 focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            aria-label="שלח"
            className="shrink-0 rounded-xl bg-brand-600 p-3 text-white transition hover:bg-brand-500 disabled:opacity-40"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function UndoButton({ onUndo }: { onUndo: () => Promise<void> }) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (done) return <span className="text-xs text-neutral-500">בוטל</span>
  return (
    <button
      onClick={async () => {
        setBusy(true)
        try {
          await onUndo()
          setDone(true)
        } finally {
          setBusy(false)
        }
      }}
      disabled={busy}
      className="flex items-center gap-1 rounded-lg bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
    >
      <Undo2 className="h-3.5 w-3.5" />
      בטל
    </button>
  )
}

interface PRow {
  employee_id: string
  start: string
  end: string
}

function ProposalCard({
  proposal,
  employees,
  minWage,
  onApply,
  onClose,
}: {
  proposal: AssistantProposal
  employees: { id: string; name: string }[]
  minWage: number
  onApply: (input: TipDayInput) => Promise<void>
  onClose: () => void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const [rows, setRows] = useState<PRow[]>(
    proposal.entries.map((e) => ({
      employee_id: e.employee_id,
      start: e.start,
      end: e.end,
    }))
  )
  const [tips, setTips] = useState(() => {
    if (proposal.total_tips != null) return String(proposal.total_tips)
    return ''
  })
  const [applied, setApplied] = useState(false)
  const [busy, setBusy] = useState(false)

  const metrics = rows.map((r) => {
    const s = parseTimeToMinutes(r.start)
    const e = parseTimeToMinutes(r.end)
    return s != null && e != null ? shiftHours(s, e) : 0
  })
  const totalHours = metrics.reduce((s, h) => s + h, 0)
  // אם הוצע טיפ-לשעה, נגזור סך מוערך
  const effTips =
    tips !== ''
      ? parseFloat(tips)
      : proposal.per_hour != null
        ? Math.round(proposal.per_hour * totalHours)
        : 0
  const unresolved = rows.some((r) => !r.employee_id)

  function setRow(i: number, patch: Partial<PRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  function toInput(): TipDayInput | null {
    const entries = rows
      .map((r, i) => ({ r, h: metrics[i] }))
      .filter(({ r, h }) => r.employee_id && h > 0)
      .map(({ r, h }) => ({
        employee_id: r.employee_id,
        hours: h,
        start_time: r.start || null,
        end_time: r.end || null,
      }))
    if (entries.length === 0) return null
    const ids = entries.map((e) => e.employee_id)
    if (new Set(ids).size !== ids.length) return null
    const totalTipsAgorot =
      tips !== ''
        ? shekelsToAgorot(parseFloat(tips))
        : proposal.per_hour != null
          ? Math.round(shekelsToAgorot(proposal.per_hour) * totalHours)
          : 0
    return {
      work_date: proposal.work_date,
      total_tips: totalTipsAgorot,
      notes: 'נוצר עם אלכס',
      entries,
    }
  }

  async function apply() {
    const inp = toInput()
    if (!inp) {
      toast.error('חסרים פרטים או עובד כפול')
      return
    }
    setBusy(true)
    try {
      await onApply(inp)
      setApplied(true)
    } finally {
      setBusy(false)
    }
  }

  function openEditor() {
    navigate('/tips/close', {
      state: {
        prefill: {
          date: proposal.work_date,
          totalTips: proposal.total_tips ?? (tips !== '' ? parseFloat(tips) : null),
          perHour: proposal.per_hour,
          rows: rows.map((r) => ({
            employee_id: r.employee_id,
            start: r.start,
            end: r.end,
          })),
        },
      },
    })
    onClose()
  }

  if (applied) {
    return (
      <div className="mt-2 rounded-xl border border-green-900 bg-green-950/20 px-3 py-2 text-sm text-green-300">
        ההצעה אושרה ונשמרה.
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-brand-800 bg-neutral-900 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          הצעה · {weekday(proposal.work_date)} {dmy(proposal.work_date)}
        </p>
        <span className="text-xs text-neutral-500">
          {totalHours ? totalHours + " ש'" : ''}
        </span>
      </div>

      {proposal.note && (
        <p className="rounded-lg bg-amber-950/40 px-2 py-1 text-xs text-amber-300">
          {proposal.note}
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Select
              value={r.employee_id}
              onChange={(e) => setRow(i, { employee_id: e.target.value })}
              className={cn('flex-1', !r.employee_id && 'border-amber-600')}
            >
              <option value="">— בחר עובד —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </Select>
            <input
              type="time"
              value={r.start}
              onChange={(e) => setRow(i, { start: e.target.value })}
              dir="ltr"
              className="h-10 w-[72px] rounded-lg border border-neutral-700 bg-neutral-900 text-center text-sm text-neutral-100 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="time"
              value={r.end}
              onChange={(e) => setRow(i, { end: e.target.value })}
              dir="ltr"
              className="h-10 w-[72px] rounded-lg border border-neutral-700 bg-neutral-900 text-center text-sm text-neutral-100 focus:border-brand-500 focus:outline-none"
            />
            <button
              onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label="הסר"
              className="shrink-0 rounded-lg p-1.5 text-neutral-500 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-neutral-400">סך טיפים ₪</label>
        <input
          value={tips}
          onChange={(e) => setTips(e.target.value)}
          inputMode="decimal"
          dir="ltr"
          placeholder={
            proposal.per_hour != null ? `לפי ${proposal.per_hour}/שעה` : 'סכום'
          }
          className="h-9 w-28 rounded-lg border border-neutral-700 bg-neutral-900 px-2 text-center text-sm text-neutral-100 focus:border-brand-500 focus:outline-none"
        />
        {tips === '' && proposal.per_hour != null && effTips > 0 && (
          <span className="text-xs text-neutral-500">≈ {effTips} ₪ (מחושב)</span>
        )}
      </div>

      {unresolved && (
        <p className="text-xs text-amber-400">בחר עובד לכל שורה לפני האישור.</p>
      )}

      <div className="flex gap-2">
        <Button onClick={apply} loading={busy} disabled={unresolved} className="flex-1">
          <Check className="h-4 w-4" />
          אשר ושמור
        </Button>
        <Button variant="secondary" onClick={openEditor}>
          <Pencil className="h-4 w-4" />
          ערוך
        </Button>
      </div>
      <p className="text-center text-[11px] text-neutral-600">
        שכר מינימום {agorotToShekels(minWage)} ₪/שעה · שום דבר לא נשמר עד שתאשר
      </p>
    </div>
  )
}
