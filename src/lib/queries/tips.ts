import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'

// ── חישוב (טהור, באגורות) ──────────────────────────────────────────
// טיפ/שעה = סך הטיפים ÷ סך השעות של כל המשתתפים באותו יום.
export function tipPerHour(totalTips: number, totalHours: number): number {
  return totalHours > 0 ? totalTips / totalHours : 0
}

export interface LineResult {
  tips: number // חלק העובד מהקופה (אגורות)
  topUp: number // השלמה עד המינימום (אגורות)
  total: number // סה"כ לתשלום לאותו יום (אגורות)
  topped: boolean // האם היה צורך בהשלמה
}

/** מחשב לעובד בודד ביום נתון: טיפים, השלמה למינימום, וסה"כ. */
export function calcLine(
  totalTips: number,
  dayHours: number,
  hours: number,
  minWage: number
): LineResult {
  const tph = tipPerHour(totalTips, dayHours)
  const tips = Math.round(tph * hours)
  const effective = Math.max(tph, minWage)
  const total = Math.round(effective * hours)
  const topUp = Math.max(0, total - tips)
  return { tips, topUp, total, topped: tph < minWage }
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
  entries: { employee_id: string; hours: number; position: number }[]
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
          'id, work_date, total_tips, notes, entries:tip_day_entries(employee_id, hours, position)'
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
  entries: { hours: number; employee: { id: string; full_name: string } | null }[]
}

/** מושך את כל ימי הטיפים בטווח, עם שמות עובדים — לצורך אגרגציה בדוח. */
export function useTipReport(from: string, to: string) {
  return useQuery({
    queryKey: ['tip_report', from, to],
    queryFn: async (): Promise<ReportDay[]> => {
      const { data, error } = await supabase
        .from('tip_days')
        .select(
          'work_date, total_tips, entries:tip_day_entries(hours, employee:employees(id, full_name))'
        )
        .gte('work_date', from)
        .lte('work_date', to)
        .order('work_date')
      if (error) throw error
      return (data ?? []) as unknown as ReportDay[]
    },
  })
}
