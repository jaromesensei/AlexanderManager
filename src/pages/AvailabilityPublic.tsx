import { useParams } from 'react-router-dom'
import { getAvailability, submitAvailability } from '@/lib/queries/availability'
import { AvailabilityWeek } from '@/components/AvailabilityWeek'

export function AvailabilityPublic() {
  const { token = '' } = useParams()
  return (
    <AvailabilityWeek
      getData={(from, to) => getAvailability(token, from, to)}
      submitData={(entries) => submitAvailability(token, entries)}
    />
  )
}
