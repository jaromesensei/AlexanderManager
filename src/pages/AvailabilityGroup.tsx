import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ArrowRight, Phone } from 'lucide-react'
import {
  getRoster,
  verifyNamed,
  getAvailabilityNamed,
  submitAvailabilityNamed,
  availErrorMessage,
  type RosterEntry,
} from '@/lib/queries/availability'
import { AvailabilityWeek } from '@/components/AvailabilityWeek'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FullScreenSpinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

type Step = 'pick' | 'phone' | 'fill'

// קישור זמינות קבוצתי: בוחרים שם מהרשימה, מזינים טלפון לאימות,
// והגישה נפתחת רק אם הטלפון תואם למספר השמור. כך אי אפשר למלא בשם מישהו אחר.
export function AvailabilityGroup() {
  const [params] = useSearchParams()
  const week = params.get('week') ?? undefined

  const [step, setStep] = useState<Step>('pick')
  const [roster, setRoster] = useState<RosterEntry[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const [picked, setPicked] = useState<RosterEntry | null>(null)
  const [phone, setPhone] = useState('')
  const [verifiedPhone, setVerifiedPhone] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [phoneErr, setPhoneErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getRoster()
      .then((r) => active && setRoster(r))
      .catch(() => active && setLoadErr('טעינת הרשימה נכשלה, נסה לרענן.'))
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim()
    if (!roster) return []
    if (!q) return roster
    return roster.filter((e) => e.full_name.includes(q))
  }, [roster, query])

  function choose(e: RosterEntry) {
    setPicked(e)
    setPhone('')
    setPhoneErr(null)
    setStep('phone')
  }

  function back() {
    setStep('pick')
    setPicked(null)
    setPhoneErr(null)
  }

  async function verify() {
    if (!picked) return
    setVerifying(true)
    setPhoneErr(null)
    try {
      await verifyNamed(picked.id, phone)
      setVerifiedPhone(phone)
      setStep('fill')
    } catch (err) {
      setPhoneErr(availErrorMessage(err))
    } finally {
      setVerifying(false)
    }
  }

  if (step === 'fill' && picked) {
    return (
      <AvailabilityWeek
        getData={(from, to) => getAvailabilityNamed(picked.id, verifiedPhone, from, to)}
        submitData={(entries) =>
          submitAvailabilityNamed(picked.id, verifiedPhone, entries)
        }
        onBack={back}
        fixedWeek={week}
      />
    )
  }

  if (!roster && !loadErr) return <FullScreenSpinner />

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <h1 className="text-center text-2xl font-extrabold text-brand-500">אלכסנדר</h1>

      {step === 'pick' && (
        <>
          <p className="mt-2 text-center text-neutral-300">בחר את השם שלך מהרשימה</p>

          {loadErr ? (
            <p className="mt-8 text-center text-red-400">{loadErr}</p>
          ) : (
            <>
              <div className="relative mt-5">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש שם…"
                  className="ps-10"
                />
              </div>

              <div className="mt-4 space-y-2">
                {filtered.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => choose(e)}
                    className="flex w-full items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-start font-semibold text-neutral-100 transition-colors hover:border-brand-500 hover:bg-neutral-800"
                  >
                    {e.full_name}
                    <ArrowRight className="h-5 w-5 text-neutral-500" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-neutral-500">לא נמצא שם תואם.</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {step === 'phone' && picked && (
        <div className="mt-6">
          <button
            onClick={back}
            className="mb-4 flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100"
          >
            <ArrowRight className="h-4 w-4" />
            חזרה לרשימה
          </button>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 text-brand-500">
              <Phone className="h-6 w-6" />
            </div>
            <p className="font-semibold text-neutral-100">היי {picked.full_name}</p>
            <p className="mt-1 text-sm text-neutral-400">הזן את מספר הטלפון שלך לאימות</p>

            <Input
              type="tel"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              placeholder="050-0000000"
              className={cn('mt-4 text-center', phoneErr && 'border-red-500')}
              autoFocus
            />

            {phoneErr && <p className="mt-2 text-sm text-red-400">{phoneErr}</p>}

            <Button
              onClick={verify}
              loading={verifying}
              disabled={phone.replace(/\D/g, '').length < 9}
              size="lg"
              className="mt-4 w-full"
            >
              המשך
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
