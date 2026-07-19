import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { StaffingRequirement, StaffRole, ShiftType } from '@/types/database'

const KEY = ['staffing_requirements']

/** דרישות איוש. כרגע ברירת מחדל לכל הימים (weekday = null). */
export function useRequirements() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<StaffingRequirement[]> => {
      const { data, error } = await supabase.from('staffing_requirements').select('*')
      if (error) throw error
      return data ?? []
    },
  })
}

export interface RequirementEntry {
  shift: ShiftType
  role: StaffRole
  required_count: number
}

/** שומר את מערך דרישות ברירת המחדל (מוחק ומכניס מחדש). */
export function useSaveRequirements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entries: RequirementEntry[]) => {
      const { error: delErr } = await supabase
        .from('staffing_requirements')
        .delete()
        .is('weekday', null)
      if (delErr) throw delErr
      const rows = entries
        .filter((e) => e.required_count > 0)
        .map((e) => ({ ...e, weekday: null }))
      if (rows.length > 0) {
        const { error } = await supabase
          .from('staffing_requirements')
          .insert(rows as never)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
