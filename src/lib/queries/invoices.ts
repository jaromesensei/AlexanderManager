import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toastBus } from '@/lib/toastBus'
import type { Invoice, InvoiceItem, InvoiceStatus, Supplier } from '@/types/database'
import { ALERTS_KEY } from './alerts'

/** מפעיל עיבוד מחירים + התראות בצד השרת (רק לחשבונית מאושרת). */
async function processPrices(invoiceId: string) {
  const { error } = await supabase.rpc('process_invoice_prices', {
    p_invoice_id: invoiceId,
  } as never)
  if (error) throw error
}

export interface InvoiceListRow extends Invoice {
  supplier: Pick<Supplier, 'id' | 'name'> | null
}

export interface InvoiceDetail extends Invoice {
  supplier: Pick<Supplier, 'id' | 'name'> | null
  items: InvoiceItem[]
}

export interface InvoiceItemInput {
  raw_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  line_total: number | null
}

export interface InvoiceInput {
  supplier_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  total_amount: number | null
  status: InvoiceStatus
  image_path: string | null
  notes: string | null
  order_id?: string | null
  items: InvoiceItemInput[]
}

const LIST_KEY = ['invoices']
const detailKey = (id: string) => ['invoices', id]

export function useInvoices() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: async (): Promise<InvoiceListRow[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, supplier:suppliers(id, name)')
        .order('invoice_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as InvoiceListRow[]
    },
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: detailKey(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<InvoiceDetail> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, supplier:suppliers(id, name), items:invoice_items(*)')
        .eq('id', id!)
        .single()
      if (error) throw error
      const invoice = data as unknown as InvoiceDetail
      invoice.items = [...(invoice.items ?? [])].sort((a, b) => a.position - b.position)
      return invoice
    },
  })
}

async function replaceItems(invoiceId: string, items: InvoiceItemInput[]) {
  const { error: delErr } = await supabase
    .from('invoice_items')
    .delete()
    .eq('invoice_id', invoiceId)
  if (delErr) throw delErr

  const rows = items
    .filter((it) => it.raw_name.trim() !== '')
    .map((it, i) => ({ ...it, invoice_id: invoiceId, position: i }))

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from('invoice_items').insert(rows as never)
    if (insErr) throw insErr
  }
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: InvoiceInput) => {
      const { items, ...header } = input
      const { data, error } = await supabase
        .from('invoices')
        .insert(header as never)
        .select()
        .single()
      if (error) throw error
      const created = data as { id: string }
      await replaceItems(created.id, items)
      if (header.status === 'confirmed') await processPrices(created.id)
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY })
      qc.invalidateQueries({ queryKey: ALERTS_KEY })
      toastBus('success', 'החשבונית נשמרה')
    },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: InvoiceInput }) => {
      const { items, ...header } = input
      const { error } = await supabase
        .from('invoices')
        .update(header as never)
        .eq('id', id)
      if (error) throw error
      await replaceItems(id, items)
      if (header.status === 'confirmed') await processPrices(id)
      return { id }
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: LIST_KEY })
      qc.invalidateQueries({ queryKey: detailKey(id) })
      qc.invalidateQueries({ queryKey: ALERTS_KEY })
      toastBus('success', 'החשבונית עודכנה')
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY })
      toastBus('success', 'החשבונית נמחקה')
    },
  })
}
