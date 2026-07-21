import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'
import type { ProductCategory } from '@/types/database'

const KEY = ['product_categories']

// קטגוריות מומלצות למבורגר דיינר (מבנה COGS סטנדרטי)
export const DEFAULT_CATEGORIES = [
  'בשר ועוף',
  'ירקות ופירות',
  'מוצרי חלב',
  'יבשים ומזווה',
  'משקאות',
  'חד-פעמי ואריזה',
  'ניקיון',
  'אחר',
]

export function useCategories() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ProductCategory[]> => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('product_categories')
        .insert({ name } as never)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toastBus('success', 'הקטגוריה נוספה')
    },
  })
}

export function useSeedCategories() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_CATEGORIES.map((name) => ({ name }))
      const { error } = await supabase.from('product_categories').insert(rows as never)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toastBus('success', 'קטגוריות מומלצות נוצרו')
    },
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_categories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['products'] })
      toastBus('success', 'הקטגוריה נמחקה')
    },
  })
}
