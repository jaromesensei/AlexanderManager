import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** מיזוג מחלקות Tailwind בצורה בטוחה */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** פורמט מטבע בשקלים. הקלט הוא אגורות (מספר שלם). */
export function formatCurrency(agorot: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 2,
  }).format(agorot / 100)
}

/** פורמט תאריך עברי קצר: יום/חודש/שנה */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

/** שם היום בעברית (שבוע מתחיל ביום ראשון) */
export function weekdayName(weekday: number): string {
  const names = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  return names[weekday] ?? ''
}
