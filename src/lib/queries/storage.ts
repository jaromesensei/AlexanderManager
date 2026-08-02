import { supabase } from '@/lib/supabase'

const BUCKET = 'invoices'

/** מעלה תמונת חשבונית ל-Storage ומחזיר את הנתיב שנשמר. */
export async function uploadInvoiceImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  // שם קובץ ייחודי לפי זמן + אקראי (אין תלות במזהה משתמש)
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `${new Date().getFullYear()}/${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** מייצר קישור חתום (זמני) לצפייה בתמונה פרטית. */
export async function getInvoiceImageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60) // שעה
  if (error) return null
  return data.signedUrl
}

export async function deleteInvoiceImage(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}

export interface ExtractedItem {
  name: string
  quantity: number
  unit: string
  unit_price: number
  line_total: number
}

export interface ExtractedInvoice {
  supplier_name: string
  invoice_number: string
  invoice_date: string
  total: number
  items: ExtractedItem[]
}

/** מריץ חילוץ אוטומטי (Claude Vision) על תמונה שהועלתה. */
export async function extractInvoice(path: string): Promise<ExtractedInvoice> {
  const { data, error } = await supabase.functions.invoke('extract-invoice', {
    body: { path },
  })
  if (error) {
    // חילוץ הודעת השגיאה האמיתית מגוף התשובה (במקום "non-2xx status code" כללי)
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json()
        if (body?.error) throw new Error(body.error)
      } catch (e) {
        if (e instanceof Error && e.message) throw e
      }
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data.extracted as ExtractedInvoice
}
