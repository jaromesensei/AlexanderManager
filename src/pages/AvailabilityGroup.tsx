import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getRoster,
  getAvailabilityNamed,
  submitAvailabilityNamed,
  type RosterEntry,
} from '@/lib/queries/availability'
import { AvailabilityWeek } from '@/components/AvailabilityWeek'
import { FullScreenSpinner } from '@/components/ui/Spinner'
import { APP_VERSION } from '@/version'

export function AvailabilityGroup() {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null)
  const [picked, setPicked] = useState<RosterEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()
  const week = params.get('week') ?? undefined

  useEffect(() => {
    let active = true
    getRoster()
      .then((r) => active && setRoster(r))
      .catch(() => active && setError('טעינת רשימת העובדים נכשלה.'))
    return () => {
      active = false
    }
  }, [])

  if (picked) {
    return (
      <AvailabilityWeek
        getData={(from, to) => getAvailabilityNamed(picked.id, from, to)}
        submitData={(entries) => submitAvailabilityNamed(picked.id, entries)}
        onBack={() => setPicked(null)}
        fixedWeek={week}
      />
    )
  }

  if (error)
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-neutral-300">{error}</p>
      </div>
    )

  if (!roster) return <FullScreenSpinner />

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-extrabold text-brand-500">אלכסנדר</h1>
        <p className="mt-1 text-neutral-300">בחר את השם שלך למילוי זמינות</p>
      </div>

      {roster.length === 0 ? (
        <p className="text-center text-neutral-400">אין עובדים פעילים.</p>
      ) : (
        <div className="space-y-2">
          {roster.map((e) => (
            <button
              key={e.id}
              onClick={() => setPicked(e)}
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-right text-lg font-medium text-neutral-100 hover:border-brand-700"
            >
              {e.full_name}
            </button>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-neutral-600">גרסה {APP_VERSION}</p>
    </div>
  )
}
