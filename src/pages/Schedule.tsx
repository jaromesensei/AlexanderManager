import { CalendarDays } from 'lucide-react'
import { Placeholder } from './Placeholder'

export function Schedule() {
  return (
    <Placeholder
      title="סידורי עבודה"
      description="כאן תבנה משמרות בוקר וערב, תוודא איוש עמדות ותשלח סידור לצוות בוואטסאפ."
      icon={CalendarDays}
      phase="פאזה 2"
    />
  )
}
