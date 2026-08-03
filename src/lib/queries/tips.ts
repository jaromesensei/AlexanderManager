import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'
import { parseTimeToMinutes, shabbatHoursForShift } from '@/lib/shabbat'

// גמול שבת: שכר המינימום בשעות שבת הוא 150%.
export const SHABBAT_MULTIPLIER = 1.5

// ── חישוב (טהור, באגורות) ──────────────────────────────────────────
// טיפ/שעה = סך הטיפים ÷ סך השעות של כל המשתתפים באותו יום.
export function tipPerHour(totalTips: number, totalHours: number): number {
  return totalHours > 0 ? totalTips / totalHours : 0
}

export interface LineResult {
  tips: number // חלק העובד מהקופה (אגורות)
  base: number // בסיס שכר המינימום לפי השעות (אגורות)
  travel: number // נסיעות ליום (אגורות)
  topUp: number // השלמה עד הרצפה (בסיס + נסיעות) (אגורות)
  over: number // בכמה הטיפים עברו את הרצפה (אגורות)
  total: number // סה"כ לתשלום לאותו יום (אגורות)
  topped: boolean // האם היה צורך בהשלמה
}

/**
 * מחשב לעובד בודד ביום נתון: טיפים (לפי חלק בקופה), בסיס מינימום, נסיעות,
 * השלמה, בכמה עבר את הרצפה, וסה"כ. הרצפה = בסיס מינימום (רגיל 100% + שבת 150%)
 * + נסיעות ליום. הטיפים צריכים לכסות את הרצפה; מה שמעליה = "מעל הבסיס".
 */
export function calcLine(
  totalTips: number,
  dayHours: number,
  hours: number,
  shabbatHours: number,
  minWage: number,
  travelPerDay: number
): LineResult {
  const tph = tipPerHour(totalTips, dayHours)
  const tips = Math.round(tph * hours)
  const shabbat = Math.min(Math.max(0, shabbatHours), hours)
  const regular = Math.max(0, hours - shabbat)
  const base = Math.round(regular * minWage + shabbat * minWage * SHABBAT_MULTIPLIER)
  const travel = travelPerDay
  const floor = base + travel
  const total = Math.max(tips, floor)
  const topUp = Math.max(0, floor - tips)
  const over = Math.max(0, tips - floor)
  return { tips, base, travel, topUp, over, total, topped: floor > tips }
}

/** שעות השבת של שורה, לפי זמני התחלה/סיום (או נפילה חיננית: שבת=כל היום). */
export function entryShabbatHours(
  workDate: string,
  hours: number,
  startTime: string | null,
  endTime: string | null
): number {
  const s = parseTimeToMinutes(startTime)
  const e = parseTimeToMinutes(endTime)
  if (s != null && e != null) return shabbatHoursForShift(workDate, s, e)
  // אין זמנים (נתונים ישנים) — שבת מלאה נחשבת שבת, אחרת 0
  return isSaturday(workDate) ? hours : 0
}

// ── שכר מינימום (הגדרה) ─────────────────────────────────────────────
const MIN_WAGE_KEY = ['app_settings', 'min_hourly_wage']
const DEFAULT_MIN_WAGE = 3540 // 35.40 ₪ (אגורות)

export function useMinWage() {
  return useQuery({
    queryKey: MIN_WAGE_KEY,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'min_hourly_wage')
        .maybeSingle()
      if (error) throw error
      const v = (data as { value: string } | null)?.value
      const n = v ? parseInt(v, 10) : NaN
      return Number.isFinite(n) ? n : DEFAULT_MIN_WAGE
    },
  })
}

export function useSetMinWage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (agorot: number) => {
      const { error } = await supabase.from('app_settings').upsert(
        {
          key: 'min_hourly_wage',
          value: String(Math.round(agorot)),
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'key' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MIN_WAGE_KEY })
      toastBus('success', 'שכר המינימום עודכן')
    },
  })
}

// ── נסיעות ליום (הגדרה) ─────────────────────────────────────────────
const TRAVEL_KEY = ['app_settings', 'travel_per_day']
const DEFAULT_TRAVEL = 1700 // 17.00 ₪ (אגורות)

export function useTravelPerDay() {
  return useQuery({
    queryKey: TRAVEL_KEY,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'travel_per_day')
        .maybeSingle()
      if (error) throw error
      const v = (data as { value: string } | null)?.value
      const n = v ? parseInt(v, 10) : NaN
      return Number.isFinite(n) ? n : DEFAULT_TRAVEL
    },
  })
}

export function useSetTravelPerDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (agorot: number) => {
      const { error } = await supabase.from('app_settings').upsert(
        {
          key: 'travel_per_day',
          value: String(Math.round(agorot)),
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: 'key' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRAVEL_KEY })
      toastBus('success', 'דמי הנסיעות עודכנו')
    },
  })
}

// ── ימי טיפים ───────────────────────────────────────────────────────
export interface TipDayRow {
  id: string
  work_date: string
  total_tips: number
  notes: string | null
  hours: number // סך השעות של כל המשתתפים
  count: number // מספר משתתפים
}

/** רשימת ימים (אחרון קודם), עם סיכום שעות ומשתתפים לכל יום. */
export function useTipDays(from?: string, to?: string) {
  return useQuery({
    queryKey: ['tip_days', from ?? 'all', to ?? 'all'],
    queryFn: async (): Promise<TipDayRow[]> => {
      let q = supabase
        .from('tip_days')
        .select('id, work_date, total_tips, notes, entries:tip_day_entries(hours)')
        .order('work_date', { ascending: false })
      if (from) q = q.gte('work_date', from)
      if (to) q = q.lte('work_date', to)
      const { data, error } = await q
      if (error) throw error
      const rows = (data ?? []) as unknown as {
        id: string
        work_date: string
        total_tips: number
        notes: string | null
        entries: { hours: number }[]
      }[]
      return rows.map((r) => ({
        id: r.id,
        work_date: r.work_date,
        total_tips: r.total_tips,
        notes: r.notes,
        hours: (r.entries ?? []).reduce((s, e) => s + Number(e.hours), 0),
        count: (r.entries ?? []).length,
      }))
    },
  })
}

export interface TipDayWithEntries {
  id: string
  work_date: string
  total_tips: number
  notes: string | null
  entries: {
    employee_id: string
    hours: number
    start_time: string | null
    end_time: string | null
    position: number
  }[]
}

/** טוען יום בודד לפי תאריך (לעריכה). מחזיר null אם עוד לא נסגר. */
export function useTipDayByDate(date: string | undefined) {
  return useQuery({
    queryKey: ['tip_day', date],
    enabled: !!date,
    queryFn: async (): Promise<TipDayWithEntries | null> => {
      const { data, error } = await supabase
        .from('tip_days')
        .select(
          'id, work_date, total_tips, notes, entries:tip_day_entries(employee_id, hours, start_time, end_time, position)'
        )
        .eq('work_date', date!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const day = data as unknown as TipDayWithEntries
      day.entries = [...(day.entries ?? [])].sort((a, b) => a.position - b.position)
      return day
    },
  })
}

export interface TipEntryInput {
  employee_id: string
  hours: number
  start_time: string | null
  end_time: string | null
}
export interface TipDayInput {
  work_date: string
  total_tips: number
  notes: string | null
  entries: TipEntryInput[]
}

/** שומר/מעדכן יום (upsert לפי תאריך) ומחליף את שורות המשתתפים. */
export function useSaveTipDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TipDayInput) => {
      const { entries, ...header } = input
      const { data, error } = await supabase
        .from('tip_days')
        .upsert(header as never, { onConflict: 'work_date' })
        .select('id')
        .single()
      if (error) throw error
      const day = data as { id: string }

      const { error: delErr } = await supabase
        .from('tip_day_entries')
        .delete()
        .eq('tip_day_id', day.id)
      if (delErr) throw delErr

      const rows = entries
        .filter((e) => e.employee_id && e.hours > 0)
        .map((e, i) => ({
          tip_day_id: day.id,
          employee_id: e.employee_id,
          hours: e.hours,
          start_time: e.start_time,
          end_time: e.end_time,
          position: i,
        }))
      if (rows.length > 0) {
        const { error: insErr } = await supabase
          .from('tip_day_entries')
          .insert(rows as never)
        if (insErr) throw insErr
      }
      return day
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tip_days'] })
      qc.invalidateQueries({ queryKey: ['tip_day'] })
      qc.invalidateQueries({ queryKey: ['tip_report'] })
      toastBus('success', 'היום נשמר')
    },
  })
}

export function useDeleteTipDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tip_days').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tip_days'] })
      qc.invalidateQueries({ queryKey: ['tip_report'] })
      toastBus('success', 'היום נמחק')
    },
  })
}

// ── דוח חודשי ───────────────────────────────────────────────────────
export interface ReportDay {
  work_date: string
  total_tips: number
  entries: {
    hours: number
    start_time: string | null
    end_time: string | null
    employee: { id: string; full_name: string } | null
  }[]
}

/** מושך את כל ימי הטיפים בטווח, עם שמות עובדים — לצורך אגרגציה בדוח. */
export function useTipReport(from: string, to: string) {
  return useQuery({
    queryKey: ['tip_report', from, to],
    queryFn: async (): Promise<ReportDay[]> => {
      const { data, error } = await supabase
        .from('tip_days')
        .select(
          'work_date, total_tips, entries:tip_day_entries(hours, start_time, end_time, employee:employees(id, full_name))'
        )
        .gte('work_date', from)
        .lte('work_date', to)
        .order('work_date')
      if (error) throw error
      return (data ?? []) as unknown as ReportDay[]
    },
  })
}

// ── אגרגציה לדוח (משותף למסך ולהדפסה) ───────────────────────────────
export interface ReportDayLine {
  date: string
  hours: number
  shabbatHours: number
  tph: number
  tips: number
  base: number
  travel: number
  topUp: number
  over: number
  total: number
}
export interface ReportEmp {
  id: string
  name: string
  days: number
  hours: number
  shabbatHours: number // שעות שבת (יום שבת) מתוך סך השעות
  tips: number
  base: number // סך הבסיס (מינימום מגיע)
  travel: number // סך דמי נסיעות (ימים × תעריף)
  topUp: number
  over: number // בכמה הטיפים עברו את הרצפה (בסיס + נסיעות)
  total: number
  lines: ReportDayLine[]
}

/** האם התאריך חל בשבת (יום 6). */
export function isSaturday(isoDate: string): boolean {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 6
}

export interface ReportTotals {
  hours: number
  tips: number
  base: number
  travel: number
  topUp: number
  over: number
  total: number
}

/** מקבץ את ימי הטיפים לפי עובד, עם פירוט יומי וסיכומים (הכל אגורות). */
export function aggregateReport(
  days: ReportDay[],
  minWage: number,
  travelPerDay: number
): { emps: ReportEmp[]; totals: ReportTotals } {
  const map = new Map<string, ReportEmp>()
  for (const day of days) {
    const dayHours = (day.entries ?? []).reduce((s, e) => s + Number(e.hours), 0)
    const tph = tipPerHour(day.total_tips, dayHours)
    for (const e of day.entries ?? []) {
      if (!e.employee) continue
      const h = Number(e.hours)
      if (!(h > 0)) continue
      const shabbatH = entryShabbatHours(day.work_date, h, e.start_time, e.end_time)
      const line = calcLine(day.total_tips, dayHours, h, shabbatH, minWage, travelPerDay)
      let agg = map.get(e.employee.id)
      if (!agg) {
        agg = {
          id: e.employee.id,
          name: e.employee.full_name,
          days: 0,
          hours: 0,
          shabbatHours: 0,
          tips: 0,
          base: 0,
          travel: 0,
          topUp: 0,
          over: 0,
          total: 0,
          lines: [],
        }
        map.set(e.employee.id, agg)
      }
      agg.days += 1
      agg.hours += h
      agg.shabbatHours += shabbatH
      agg.tips += line.tips
      agg.base += line.base
      agg.travel += line.travel
      agg.topUp += line.topUp
      agg.over += line.over
      agg.total += line.total
      agg.lines.push({
        date: day.work_date,
        hours: h,
        shabbatHours: shabbatH,
        tph,
        tips: line.tips,
        base: line.base,
        travel: line.travel,
        topUp: line.topUp,
        over: line.over,
        total: line.total,
      })
    }
  }
  const emps = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'))
  const totals = emps.reduce(
    (acc, e) => ({
      hours: acc.hours + e.hours,
      tips: acc.tips + e.tips,
      base: acc.base + e.base,
      travel: acc.travel + e.travel,
      topUp: acc.topUp + e.topUp,
      over: acc.over + e.over,
      total: acc.total + e.total,
    }),
    { hours: 0, tips: 0, base: 0, travel: 0, topUp: 0, over: 0, total: 0 }
  )
  return { emps, totals }
}
