import { Home, Receipt, CalendarDays, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** האם הפריט מוצג גם לעובדים (ולא רק למנהלים) */
  employeeVisible: boolean
}

// מודול השכר הוסר בשלב זה - יתווסף בעתיד.
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'בית', icon: Home, employeeVisible: true },
  { to: '/invoices', label: 'חשבוניות', icon: Receipt, employeeVisible: false },
  { to: '/schedule', label: 'סידור', icon: CalendarDays, employeeVisible: true },
]
