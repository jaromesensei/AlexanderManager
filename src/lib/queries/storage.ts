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
