import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Share2, MessageCircle, Copy, Check } from 'lucide-react'
import { useEmployees } from '@/lib/queries/employees'
import { addDays, toISODate } from '@/lib/scheduling'
import { toWaNumber, waLink, shareText } from '@/lib/whatsapp'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

const RESTAURANT = 'אלכסנדר'

function dm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** בקשת זמינות מהעובדים לשבוע נבחר - הודעה קבוצתית + קישור אישי לכל עובד. */
export function RequestAvailability() {
  const { from = '' } = useParams()
  const to = toISODate(addDays(new Date(from + 'T00:00:00'), 6))
  const { data: employees, isLoading } = useEmployees()

  const origin = window.location.origin
  const groupLink = `${origin}/availability?week=${from}`

  const active = useMemo(() => (employees ?? []).filter((e) => e.active), [employees])

  const groupMessage = [
    `היי לכולם 👋`,
    `נא למלא זמינות לשבוע ${dm(from)}–${dm(to)}:`,
    groupLink,
    ``,
    `בוחרים את השם, מסמנים בוקר/ערב לכל יום ושולחים. אחרי שליחה ננעל 🙏`,
    RESTAURANT,
  ].join('\n')

  function personalLink(token: string): string {
    return `${origin}/availability/${token}?week=${from}`
  }

  function personalMessage(name: string, token: string): string {
    return [
      `היי ${name} 👋`,
      `מלא/י זמינות לשבוע ${dm(from)}–${dm(to)}:`,
      personalLink(token),
      ``,
      `מסמנים בוקר/ערב לכל יום ושולחים. אחרי שליחה ננעל — אז דייק/י 🙏`,
    ].join('\n')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/schedule" className="text-neutral-400 hover:text-neutral-100">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">בקשת זמינות</h1>
      </div>
      <p className="text-sm text-neutral-400">
        שבוע {dm(from)}–{dm(to)}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : active.length === 0 ? (
        <Card className="py-10 text-center text-neutral-400">אין עובדים פעילים.</Card>
      ) : (
        <>
          <ShareGeneral message={groupMessage} />

          <h2 className="px-1 pt-2 font-semibold">שליחה אישית לכל עובד</h2>
          <p className="px-1 text-xs text-neutral-500">כל קישור נעול לשבוע הזה בלבד.</p>
          {active.map((e) => {
            const wa = toWaNumber(e.phone)
            const msg = personalMessage(e.full_name, e.avail_token)
            return (
              <Card key={e.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{e.full_name}</p>
                  <p className="text-sm text-neutral-400">
                    {wa ? 'קישור אישי מוכן' : 'אין טלפון — העתק ושלח'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CopyButton text={msg} />
                  {wa && (
                    <a href={waLink(wa, msg)} target="_blank" rel="noreferrer">
                      <Button size="sm">
                        <MessageCircle className="h-4 w-4" />
                        וואטסאפ
                      </Button>
                    </a>
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
        <h2 className="font-semibold">הודעה קבוצתית</h2>
        <p className="text-sm text-neutral-400">קישור אחד לכל הצוות — להדבקה בקבוצה</p>
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
