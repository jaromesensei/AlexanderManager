import type { StaffRole, ShiftType } from '@/types/database'

export const STAFF_ROLES: StaffRole[] = [
  'waiter',
  'piccolo',
  'host',
  'bar',
  'shift_manager',
]

export const ROLE_LABELS: Record<StaffRole, string> = {
  waiter: 'מלצר',
  piccolo: 'פיקולו',
  host: 'מארח/ת',
  bar: 'בר',
  shift_manager: 'אחמ"ש',
}

export const SHIFTS: ShiftType[] = ['morning', 'evening']

export const SHIFT_LABELS: Record<ShiftType, string> = {
  morning: 'בוקר',
  evening: 'ערב',
}

export const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

/** שעות התחלה אפשריות למשמרת (העבודה דינמית - אין שעת סיום). */
export const START_TIMES = [
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '14:00',
  '16:00',
  '17:00',
  '17:30',
  '18:00',
  '19:00',
  '19:30',
]

/** שעת התחלה ברירת מחדל לפי משמרת. */
export const DEFAULT_START: Record<ShiftType, string> = {
  morning: '11:00',
  evening: '17:00',
}

/** תחילת השבוע (יום ראשון) עבור תאריך נתון. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - out.getDay()) // getDay: 0=ראשון
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

/** תאריך בפורמט YYYY-MM-DD (מקומי, לא UTC). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** קיצוץ HH:MM:SS ל-HH:MM לתצוגה. */
export function shortTime(t: string | null): string {
  if (!t) return ''
  return t.slice(0, 5)
}
