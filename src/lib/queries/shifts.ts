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

// וריאנט ליצירה: נושא גם את פרטי העובד להצגה אופטימית מיידית
export interface CreateShiftVars extends ShiftInput {
  employee?: { id: string; full_name: string; hourly_rate: number | null } | null
}

const key = (from: string, to: string) => ['shifts', from, to]

// מזהה זמני לשורה אופטימית עד שהשרת מחזיר את האמיתי
function tempId(): string {
  const c = globalThis.crypto
  return `temp-${c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2)}`
}

type Snapshot = [readonly unknown[], ShiftRow[] | undefined][]

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

/** מעדכן את כל טווחי ה-shifts הקאשיים בבת אחת. */
function patchAllShiftQueries(
  qc: ReturnType<typeof useQueryClient>,
  updater: (rows: ShiftRow[]) => ShiftRow[]
) {
  qc.setQueriesData<ShiftRow[]>({ queryKey: ['shifts'] }, (old) =>
    old ? updater(old) : old
  )
}

export function useCreateShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateShiftVars) => {
      const payload: ShiftInput = {
        employee_id: input.employee_id,
        work_date: input.work_date,
        shift: input.shift,
        role: input.role,
        start_time: input.start_time,
        end_time: input.end_time,
      }
      const { error } = await supabase.from('shift_assignments').insert(payload as never)
      if (error) throw error
    },
    onMutate: async (input): Promise<{ prev: Snapshot }> => {
      await qc.cancelQueries({ queryKey: ['shifts'] })
      const prev = qc.getQueriesData<ShiftRow[]>({ queryKey: ['shifts'] })
      const row: ShiftRow = {
        id: tempId(),
        employee_id: input.employee_id,
        work_date: input.work_date,
        shift: input.shift,
        role: input.role,
        start_time: input.start_time,
        end_time: input.end_time,
        status: 'scheduled',
        created_at: new Date().toISOString(),
        employee: input.employee ?? null,
      }
      patchAllShiftQueries(qc, (rows) => [...rows, row])
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([k, data]) => qc.setQueryData(k, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
}

export function useUpdateShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string
      patch: Partial<Pick<ShiftAssignment, 'role' | 'start_time'>>
    }) => {
      const { error } = await supabase
        .from('shift_assignments')
        .update(patch as never)
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }): Promise<{ prev: Snapshot }> => {
      await qc.cancelQueries({ queryKey: ['shifts'] })
      const prev = qc.getQueriesData<ShiftRow[]>({ queryKey: ['shifts'] })
      patchAllShiftQueries(qc, (rows) =>
        rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([k, data]) => qc.setQueryData(k, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
}

export function useDeleteShift() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_assignments').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id): Promise<{ prev: Snapshot }> => {
      await qc.cancelQueries({ queryKey: ['shifts'] })
      const prev = qc.getQueriesData<ShiftRow[]>({ queryKey: ['shifts'] })
      patchAllShiftQueries(qc, (rows) => rows.filter((r) => r.id !== id))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      ctx?.prev.forEach(([k, data]) => qc.setQueryData(k, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  })
}
