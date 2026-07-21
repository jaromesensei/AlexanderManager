import { HebrewCalendar, flags } from '@hebcal/core'

export interface HolidayInfo {
  title: string
  /** יום טוב (חג מהתורה / יום כיפור) — השפעה גדולה, לרוב סגור. */
  major: boolean
}

function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * חגי ומועדי ישראל בטווח תאריכים, מחושבים מקומית (בלי אינטרנט).
 * מפתח: תאריך ISO → פרטי החג. מדלג על שבתות מיוחדות וראש חודש.
 */
export function holidaysInRange(
  fromISO: string,
  toISO: string
): Record<string, HolidayInfo> {
  const start = new Date(fromISO + 'T00:00:00')
  const end = new Date(toISO + 'T00:00:00')
  const events = HebrewCalendar.calendar({
    start,
    end,
    il: true,
    locale: 'he-x-NoNikud',
    noRoshChodesh: true,
    sedrot: false,
    candlelighting: false,
  })

  const map: Record<string, HolidayInfo> = {}
  for (const ev of events) {
    const f = ev.getFlags()
    if (f & flags.SPECIAL_SHABBAT) continue // שבת שובה/הגדול וכו' — לא רלוונטי לאיוש
    const key = iso(ev.getDate().greg())
    if (map[key]) continue // חג ראשון ליום מספיק
    const title = ev.render('he-x-NoNikud').replace(/\s+\d{4}$/, '')
    map[key] = { title, major: !!(f & flags.CHAG) }
  }
  return map
}
