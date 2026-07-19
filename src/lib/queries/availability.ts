import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  locked: boolean
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

export async function getAvailabilityNamed(
  id: string,
  from: string,
  to: string
): Promise<AvailData> {
  const { data, error } = await supabase.rpc(
    'avail_get_named',
    { p_id: id, p_from: from, p_to: to } as never
  )
  if (error) throw error
  return data as unknown as AvailData
}

export async function submitAvailabilityNamed(
  id: string,
  entries: AvailEntry[]
): Promise<void> {
  const { error } = await supabase.rpc(
    'avail_submit_named',
    { p_id: id, p_entries: entries } as never
  )
  if (error) throw error
}

export interface WeekAvailRow {
  employee_id: string
  work_date: string
  shift: ShiftType
  available: boolean
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift_availability'] }),
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
