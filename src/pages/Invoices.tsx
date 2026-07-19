import { Receipt } from 'lucide-react'
import { Placeholder } from './Placeholder'

export function Invoices() {
  return (
    <Placeholder
      title="חשבוניות ופוד קוסט"
      description="כאן תצלם חשבוניות ספק, תעקוב אחרי מחירים ותחשב פוד קוסט למנות."
      icon={Receipt}
      phase="פאזה 1"
    />
  )
}
