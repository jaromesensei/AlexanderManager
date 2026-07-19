import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PriceAlert } from '@/types/database'

export const ALERTS_KEY = ['price_alerts']

export interface AlertRow extends PriceAlert {
  product: { id: string; canonical_name: string } | null
}

export function useOpenAlerts() {
  return useQuery({
    queryKey: ALERTS_KEY,
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await supabase
        .from('price_alerts')
        .select('*, product:products(id, canonical_name)')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as AlertRow[]
    },
  })
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('price_alerts')
        .update({ acknowledged: true } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ALERTS_KEY }),
  })
}
