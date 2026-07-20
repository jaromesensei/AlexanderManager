import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/types/database'

const KEY = ['products']

export function useProducts() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('canonical_name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<Product> & { id: string }) => {
      const { error } = await supabase
        .from('products')
        .update(patch as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** מחיר אחרון (אגורות ליחידת קנייה) לכל מוצר, מתוך היסטוריית המחירים. */
export function useLatestPrices() {
  return useQuery({
    queryKey: ['latest_prices'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('price_points')
        .select('product_id, unit_price, observed_at')
        .order('observed_at', { ascending: false })
      if (error) throw error
      const map: Record<string, number> = {}
      const rows = (data ?? []) as unknown as {
        product_id: string
        unit_price: number
      }[]
      for (const p of rows) {
        if (!(p.product_id in map)) map[p.product_id] = p.unit_price
      }
      return map
    },
  })
}

/** עלות ליחידת בסיס (אגורות) = מחיר אחרון ÷ base_per_purchase. */
export function costPerBase(product: Product, latestPrice: number | undefined): number | null {
  if (latestPrice == null) return null
  const per = product.base_per_purchase || 1
  return latestPrice / per
}
