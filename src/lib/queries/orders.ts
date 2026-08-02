import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'
import type { Order, OrderItem, OrderStatus } from '@/types/database'

const LIST_KEY = ['orders']
const detailKey = (id: string) => ['orders', id]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'טיוטה',
  ordered: 'בוצעה',
  received: 'התקבלה',
  closed: 'סגורה',
}

export interface OrderListRow extends Order {
  supplier: { id: string; name: string } | null
  items: { id: string; quantity: number; expected_unit_price: number | null }[]
}

export interface OrderWithItems extends Order {
  supplier: { id: string; name: string } | null
  items: OrderItem[]
}

export interface OrderItemInput {
  product_id: string | null
  name: string
  quantity: number
  unit: string | null
  expected_unit_price: number | null
}

export interface OrderInput {
  supplier_id: string | null
  order_date: string
  expected_date: string | null
  notes: string | null
  status: OrderStatus
  items: OrderItemInput[]
}

export function useOrders() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<OrderListRow[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, supplier:suppliers(id, name), items:order_items(id, quantity, expected_unit_price)'
        )
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OrderListRow[]
    },
  })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<OrderWithItems> => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, supplier:suppliers(id, name), items:order_items(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      const order = data as unknown as OrderWithItems
      order.items = [...(order.items ?? [])].sort((a, b) => a.position - b.position)
      return order
    },
  })
}

async function replaceOrderItems(orderId: string, items: OrderItemInput[]) {
  const { error: delErr } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)
  if (delErr) throw delErr

  const rows = items
    .filter((it) => it.name.trim() !== '' && it.quantity > 0)
    .map((it, i) => ({ ...it, order_id: orderId, position: i }))

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('order_items').insert(rows as never)
    if (insErr) throw insErr
  }
}

export function useSaveOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: OrderInput }) => {
      const { items, ...header } = input
      let orderId = id
      if (orderId) {
        const { error } = await supabase
          .from('orders')
          .update(header as never)
          .eq('id', orderId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('orders')
          .insert(header as never)
          .select()
          .single()
        if (error) throw error
        orderId = (data as { id: string }).id
      }
      await replaceOrderItems(orderId!, items)
      return { id: orderId! }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY })
      toastBus('success', 'ההזמנה נשמרה')
    },
  })
}

export function useDeleteOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY })
      toastBus('success', 'ההזמנה נמחקה')
    },
  })
}

export function useSetOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: LIST_KEY })
      qc.invalidateQueries({ queryKey: detailKey(id) })
    },
  })
}
