import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'
import type { Employee, StaffRole } from '@/types/database'

const KEY = ['employees']

export interface EmployeeWithRoles extends Employee {
  roles: { role: StaffRole }[]
}

export interface EmployeeInput {
  full_name: string
  phone: string | null
  hourly_rate: number | null
  active: boolean
  roles: StaffRole[]
}

export function useEmployees() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<EmployeeWithRoles[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, roles:employee_roles(role)')
        .order('full_name')
      if (error) throw error
      return (data ?? []) as unknown as EmployeeWithRoles[]
    },
  })
}

async function replaceRoles(employeeId: string, roles: StaffRole[]) {
  const { error: delErr } = await supabase
    .from('employee_roles')
    .delete()
    .eq('employee_id', employeeId)
  if (delErr) throw delErr
  if (roles.length > 0) {
    const rows = roles.map((role) => ({ employee_id: employeeId, role }))
    const { error: insErr } = await supabase.from('employee_roles').insert(rows as never)
    if (insErr) throw insErr
  }
}

export function useSaveEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EmployeeInput }) => {
      const { roles, ...fields } = input
      let empId = id
      if (empId) {
        const { error } = await supabase
          .from('employees')
          .update(fields as never)
          .eq('id', empId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert(fields as never)
          .select()
          .single()
        if (error) throw error
        empId = (data as { id: string }).id
      }
      await replaceRoles(empId!, roles)
      return { id: empId! }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toastBus('success', 'העובד נשמר')
    },
  })
}

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toastBus('success', 'העובד נמחק')
    },
  })
}
