import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ShiftType } from '@/types/database'

export interface AvailEntry {
  work_date: string
  shift: ShiftType
  available: boolean
}

export interface AvailData {
  full_name: string
  availability: AvailEntry[]
}

/** קריאת זמינות עובד לפי טוקן (עמוד ציבורי, ללא התחברות). */
export async function getAvailability(
  token: string,
  from: string,
  to: string
): Promise<AvailData> {
  const { data, error } = await supabase.rpc(
    'avail_get',
    { p_token: token, p_from: from, p_to: to } as never
  )
  if (error) throw error
  return data as unknown as AvailData
}

/** הגשת זמינות לפי טוקן. */
export async function submitAvailability(
  token: string,
  entries: AvailEntry[]
): Promise<void> {
  const { error } = await supabase.rpc(
    'avail_submit',
    { p_token: token, p_entries: entries } as never
  )
  if (error) throw error
}

export interface WeekAvailRow {
  employee_id: string
  work_date: string
  shift: ShiftType
  available: boolean
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
