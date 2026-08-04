import { supabase } from '@/lib/supabase'

const BUCKET = 'invoices'

// גודל צלע מקסימלי אחרי דחיסה — מספיק לקריאות טקסט, קל לשליחה ל-AI.
const MAX_EDGE = 1600

/**
 * דוחס תמונה: מקטין ל-MAX_EDGE ומייצא JPEG. מקטין דרמטית את גודל
 * הקובץ (צילום טלפון ~4MB → ~300KB) — מהיר ואמין יותר מול Claude,
 * ומונע כשלי 502 שנגרמים מבקשה כבדה. אם משהו נכשל — מחזיר את הקובץ המקורי.
 */
async function compressImage(file: File): Promise<{ blob: Blob; isJpeg: boolean }> {
  if (!file.type.startsWith('image/')) return { blob: file, isJpeg: false }
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > MAX_EDGE || height > MAX_EDGE) {
      const scale = MAX_EDGE / Math.max(width, height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { blob: file, isJpeg: false }
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    )
    if (!blob) return { blob: file, isJpeg: false }
    return { blob, isJpeg: true }
  } catch {
    return { blob: file, isJpeg: false }
  }
}

/** מעלה תמונת חשבונית ל-Storage (אחרי דחיסה) ומחזיר את הנתיב שנשמר. */
export async function uploadInvoiceImage(file: File): Promise<string> {
  const { blob, isJpeg } = await compressImage(file)
  const ext = isJpeg ? 'jpg' : (file.name.split('.').pop() ?? 'jpg')
  // שם קובץ ייחודי לפי זמן + אקראי (אין תלות במזהה משתמש)
  const rand = Math.random().toString(36).slice(2, 10)
  const path = `${new Date().getFullYear()}/${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: isJpeg ? 'image/jpeg' : file.type,
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
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  const { data, error } = await supabase.functions.invoke('extract-invoice', {
    body: { path },
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (error) {
    // חילוץ הסיבה האמיתית מגוף התשובה (במקום "non-2xx status code" כללי)
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.text === 'function') {
      const raw = await ctx.text().catch(() => '')
      if (raw) {
        let msg: string = raw
        try {
          msg = JSON.parse(raw)?.error ?? raw
        } catch {
          // גוף שאינו JSON (למשל שגיאת פלטפורמה) — נשאיר את הטקסט הגולמי
        }
        throw new Error(`(${ctx.status}) ${String(msg).slice(0, 300)}`)
      }
    }
    throw new Error(error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data.extracted as ExtractedInvoice
}
