import { useParams, useSearchParams } from 'react-router-dom'
import { getAvailability, submitAvailability } from '@/lib/queries/availability'
import { AvailabilityWeek } from '@/components/AvailabilityWeek'

export function AvailabilityPublic() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const week = params.get('week') ?? undefined
  return (
    <AvailabilityWeek
      getData={(from, to) => getAvailability(token, from, to)}
      submitData={(entries) => submitAvailability(token, entries)}
      fixedWeek={week}
    />
  )
}
