import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'
import type { ShiftType } from '@/types/database'

export interface AvailEntry {
  work_date: string
  shift: ShiftType
  available: boolean
}

export interface AvailData {
  full_name: string
  availability: AvailEntry[]
  locked: boolean
}

/** קריאת זמינות עובד לפי טוקן (עמוד ציבורי, ללא התחברות). */
export async function getAvailability(
  token: string,
  from: string,
  to: string
): Promise<AvailData> {
  const { data, error } = await supabase.rpc('avail_get', {
    p_token: token,
    p_from: from,
    p_to: to,
  } as never)
  if (error) throw error
  return data as unknown as AvailData
}

/** הגשת זמינות לפי טוקן. */
export async function submitAvailability(
  token: string,
  entries: AvailEntry[]
): Promise<void> {
  const { error } = await supabase.rpc('avail_submit', {
    p_token: token,
    p_entries: entries,
  } as never)
  if (error) throw error
}

export interface RosterEntry {
  id: string
  full_name: string
}

/** רשימת עובדים פעילים (לקישור הקבוצתי). */
export async function getRoster(): Promise<RosterEntry[]> {
  const { data, error } = await supabase.rpc('avail_roster' as never)
  if (error) throw error
  return (data ?? []) as unknown as RosterEntry[]
}

/** הודעת שגיאה ידידותית לפי קוד השגיאה מה-RPC. */
export function availErrorMessage(err: unknown): string {
  const m = (err as Error)?.message ?? ''
  if (m.includes('phone_mismatch')) return 'מספר הטלפון לא תואם. בדוק ונסה שוב.'
  if (m.includes('no_phone')) return 'אין מספר טלפון שמור עבורך. פנה למנהל.'
  if (m.includes('not found')) return 'העובד לא נמצא.'
  if (m.includes('locked')) return 'כבר שלחת זמינות לשבוע זה. לשינוי פנה למנהל.'
  return 'אירעה שגיאה, נסה שוב.'
}

/** אימות שם + טלפון מול השרת. מחזיר את שם העובד אם תואם. */
export async function verifyNamed(
  id: string,
  phone: string
): Promise<{ id: string; full_name: string }> {
  const { data, error } = await supabase.rpc('avail_verify_named', {
    p_id: id,
    p_phone: phone,
  } as never)
  if (error) throw error
  return data as unknown as { id: string; full_name: string }
}

export async function getAvailabilityNamed(
  id: string,
  phone: string,
  from: string,
  to: string
): Promise<AvailData> {
  const { data, error } = await supabase.rpc('avail_get_named', {
    p_id: id,
    p_phone: phone,
    p_from: from,
    p_to: to,
  } as never)
  if (error) throw error
  return data as unknown as AvailData
}

export async function submitAvailabilityNamed(
  id: string,
  phone: string,
  entries: AvailEntry[]
): Promise<void> {
  const { error } = await supabase.rpc('avail_submit_named', {
    p_id: id,
    p_phone: phone,
    p_entries: entries,
  } as never)
  if (error) throw error
}

export interface WeekAvailRow {
  employee_id: string
  work_date: string
  shift: ShiftType
  available: boolean
}

const LOCKS_KEY = 'availability_locks'

/** האם השבוע נעול (מספר נעילות). */
export function useWeekLockCount(from: string) {
  return useQuery({
    queryKey: [LOCKS_KEY, from],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('availability_locks')
        .select('employee_id')
        .eq('week_start', from)
      if (error) throw error
      return (data ?? []).length
    },
  })
}

/** נעילת הזמינות לשבוע לכל העובדים. צד מנהל. */
export function useLockWeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      weekStart,
      employeeIds,
    }: {
      weekStart: string
      employeeIds: string[]
    }) => {
      if (!employeeIds.length) return
      const rows = employeeIds.map((id) => ({ employee_id: id, week_start: weekStart }))
      const { error } = await supabase.from('availability_locks').upsert(rows as never, {
        onConflict: 'employee_id,week_start',
        ignoreDuplicates: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LOCKS_KEY] })
      toastBus('success', 'הזמינות ננעלה לשבוע')
    },
  })
}

/** פתיחת נעילת הזמינות לשבוע (מאפשר לעובדים לשלוח שוב). צד מנהל. */
export function useUnlockWeek() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { error } = await supabase
        .from('availability_locks')
        .delete()
        .eq('week_start', weekStart)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LOCKS_KEY] })
      toastBus('success', 'הזמינות נפתחה מחדש')
    },
  })
}

/** זמינות כל העובדים לשבוע (צד מנהל). */
export function useWeekAvailability(from: string, to: string) {
  return useQuery({
    queryKey: ['shift_availability', from, to],
    queryFn: async (): Promise<WeekAvailRow[]> => {
      const { data, error } = await supabase
        .from('shift_availability')
        .select('employee_id, work_date, shift, available')
        .gte('work_date', from)
        .lte('work_date', to)
      if (error) throw error
      return (data ?? []) as unknown as WeekAvailRow[]
    },
  })
}
