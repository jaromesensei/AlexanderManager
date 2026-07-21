import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** שורת הוצאה שטוחה - שורת חשבונית + פרטי החשבונית שלה. */
export interface SpendRow {
  invoice_date: string | null
  invoice_number: string | null
  supplier_name: string | null
  product_id: string | null
  raw_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null // אגורות
  line_total: number // אגורות
}

interface RawInvoice {
  invoice_date: string | null
  invoice_number: string | null
  supplier: { name: string } | null
  items: {
    raw_name: string
    product_id: string | null
    quantity: number | null
    unit: string | null
    unit_price: number | null
    line_total: number | null
  }[]
}

/** כל שורות ההוצאה מחשבוניות מאושרות בטווח תאריכים. */
export function useSpend(from: string, to: string) {
  return useQuery({
    queryKey: ['spend', from, to],
    queryFn: async (): Promise<SpendRow[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          'invoice_date, invoice_number, supplier:suppliers(name), items:invoice_items(raw_name, product_id, quantity, unit, unit_price, line_total)'
        )
        .eq('status', 'confirmed')
        .gte('invoice_date', from)
        .lte('invoice_date', to)
      if (error) throw error
      const invoices = (data ?? []) as unknown as RawInvoice[]
      const rows: SpendRow[] = []
      for (const inv of invoices) {
        for (const it of inv.items ?? []) {
          rows.push({
            invoice_date: inv.invoice_date,
            invoice_number: inv.invoice_number,
            supplier_name: inv.supplier?.name ?? null,
            product_id: it.product_id,
            raw_name: it.raw_name,
            quantity: it.quantity,
            unit: it.unit,
            unit_price: it.unit_price,
            line_total: it.line_total ?? 0,
          })
        }
      }
      return rows
    },
  })
}
