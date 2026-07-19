import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { StaffingRequirement, StaffRole, ShiftType } from '@/types/database'

const KEY = ['staffing_requirements']

/** דרישות איוש - ברירת מחדל (weekday=null) + התאמות לימים ספציפיים. */
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

/** שומר דרישות לסקופ מסוים: null = ברירת מחדל, 0-6 = יום ספציפי. */
export function useSaveRequirements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      weekday,
      entries,
    }: {
      weekday: number | null
      entries: RequirementEntry[]
    }) => {
      const base = supabase.from('staffing_requirements').delete()
      const { error: delErr } =
        weekday == null ? await base.is('weekday', null) : await base.eq('weekday', weekday)
      if (delErr) throw delErr

      const rows = entries
        .filter((e) => e.required_count > 0)
        .map((e) => ({ ...e, weekday }))
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

/** מוחק התאמה של יום ספציפי (חזרה לברירת מחדל). */
export function useClearDayRequirements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (weekday: number) => {
      const { error } = await supabase
        .from('staffing_requirements')
        .delete()
        .eq('weekday', weekday)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
