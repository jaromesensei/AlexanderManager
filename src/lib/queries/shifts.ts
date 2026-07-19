import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ShiftAssignment, ShiftType, StaffRole } from '@/types/database'

export interface ShiftRow extends ShiftAssignment {
  employee: { id: string; full_name: string; hourly_rate: number | null } | null
}

export interface ShiftInput {
  employee_id: string
  work_date: string
  shift: ShiftType
  role: StaffRole
  start_time: string | null
  end_time: string | null
}

const key = (from: string, to: string) => ['shifts', from, to]

/** שיבוצים בטווח תאריכים (שבוע). */
export function useShifts(from: string, to: string) {
  return useQuery({
    queryKey: key(from, to),
    queryFn: async (): Promise<ShiftRow[]> => {
      const { data, error } = await supabase
        .from('shift_assignments')
        .select('*, employee:employees(id, full_name, hourly_rate)')
        .gte('work_date', from)
        .lte('work_date', to)
        .order('start_time')
      if (error) throw error
      return (data ?? []) as unknown as ShiftRow[]
    },
  })
}

export function useCreateShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ShiftInput) => {
      const { error } = await supabase.from('shift_assignments').insert(input as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
}

export function useDeleteShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_assignments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
}
