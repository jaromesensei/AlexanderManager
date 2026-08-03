// חישוב שעות שבת לפי שעון: מכניסת שבת (הדלקת נרות, שישי) עד צאת השבת (מוצ"ש).
// זמנים מחושבים אוטומטית לנהריה עם @hebcal/core (בלי אינטרנט).

import { Location, Zmanim } from '@hebcal/core'

// נהריה: קו רוחב/אורך, אזור זמן ישראל.
const NAHARIYA = new Location(33.0058, 35.0942, true, 'Asia/Jerusalem', 'נהריה', 'IL')

/** דקות מחצות (בשעון ירושלים) עבור רגע נתון. */
function minutesInJerusalem(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  return hh * 60 + mm
}

function zmanimFor(iso: string): Zmanim {
  const [y, m, d] = iso.split('-').map(Number)
  return new Zmanim(NAHARIYA, new Date(y, m - 1, d, 12, 0, 0), false)
}

/** יום בשבוע (0=ראשון) לתאריך ISO. */
function dow(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** כניסת שבת (הדלקת נרות, 18 דק' לפני שקיעה) — דקות מחצות. */
export function candleLightingMinutes(iso: string): number | null {
  try {
    return minutesInJerusalem(zmanimFor(iso).sunsetOffset(-18, true))
  } catch {
    return null
  }
}

/** צאת השבת (צאת הכוכבים 8.5°) — דקות מחצות. */
export function havdalahMinutes(iso: string): number | null {
  try {
    return minutesInJerusalem(zmanimFor(iso).tzeit(8.5))
  } catch {
    return null
  }
}

/** המרת "HH:MM" לדקות מחצות, או null. */
export function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** משך משמרת בשעות (תומך בחציית חצות). */
export function shiftHours(start: number, end: number): number {
  let e = end
  if (e <= start) e += 1440
  return (e - start) / 60
}

/**
 * שעות השבת מתוך משמרת בתאריך נתון (start/end בדקות מחצות).
 * שישי: מהדלקת הנרות והלאה. שבת: עד צאת השבת. שאר הימים: 0.
 */
export function shabbatHoursForShift(iso: string, start: number, end: number): number {
  const day = dow(iso)
  let e = end
  if (e <= start) e += 1440 // חוצה חצות
  if (day === 5) {
    const candle = candleLightingMinutes(iso)
    if (candle == null) return 0
    return Math.max(0, e - Math.max(start, candle)) / 60
  }
  if (day === 6) {
    const havdalah = havdalahMinutes(iso)
    if (havdalah == null) return 0
    return Math.max(0, Math.min(e, havdalah) - start) / 60
  }
  return 0
}
