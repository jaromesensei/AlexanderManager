/** ממיר טלפון ישראלי למספר בפורמט בינלאומי ל-wa.me (ללא +). */
export function toWaNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('972')) return d
  if (d.startsWith('0')) return '972' + d.slice(1)
  if (d.length === 9) return '972' + d
  return d || null
}

/** קישור wa.me עם הודעה מוכנה. */
export function waLink(waNumber: string, text: string): string {
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`
}

/** שיתוף הודעה (navigator.share) עם נפילה להעתקה ללוח. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      // המשתמש ביטל או נכשל - ננסה להעתיק
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
