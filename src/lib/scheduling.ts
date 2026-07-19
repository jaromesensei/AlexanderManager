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
