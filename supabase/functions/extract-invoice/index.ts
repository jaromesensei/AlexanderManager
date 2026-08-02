// Edge Function: חילוץ חשבונית מתמונה עם Claude Vision.
// מקבל { path } (נתיב תמונה ב-bucket 'invoices'), מוריד אותה עם service role,
// שולח ל-Claude עם סכמת JSON, ומחזיר נתונים מובנים לעריכה בקליינט.
// המפתח ANTHROPIC_API_KEY נשמר כסוד בצד שרת — לעולם לא בקליינט.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
// ניתן לשנות מודל דרך סוד EXTRACT_MODEL (למשל claude-haiku-4-5 לחיסכון).
const MODEL = Deno.env.get('EXTRACT_MODEL') ?? 'claude-opus-4-8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// סכמת החילוץ — מבטיחה JSON תקף (structured outputs).
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    supplier_name: { type: 'string', description: 'שם הספק, או מחרוזת ריקה אם לא ברור' },
    invoice_number: { type: 'string', description: 'מספר החשבונית, או מחרוזת ריקה' },
    invoice_date: {
      type: 'string',
      description: 'תאריך בפורמט YYYY-MM-DD, או מחרוזת ריקה אם לא ברור',
    },
    total: { type: 'number', description: 'סה"כ לתשלום בשקלים (כולל מע"מ), 0 אם לא ברור' },
    items: {
      type: 'array',
      description: 'שורות הפריטים בחשבונית',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'שם המוצר כפי שמופיע' },
          quantity: { type: 'number', description: 'כמות (יכול להיות שבר)' },
          unit: { type: 'string', description: 'יחידת מידה, למשל ק"ג / יחידה / ארגז' },
          unit_price: { type: 'number', description: 'מחיר ליחידה בשקלים' },
          line_total: { type: 'number', description: 'סה"כ לשורה בשקלים' },
        },
        required: ['name', 'quantity', 'unit', 'unit_price', 'line_total'],
      },
    },
  },
  required: ['supplier_name', 'invoice_number', 'invoice_date', 'total', 'items'],
}

const PROMPT = `זו תמונה של חשבונית ספק למסעדה, בעברית. חלץ את הנתונים בדייקנות:
- שם הספק, מספר החשבונית, ותאריך (המר לפורמט YYYY-MM-DD).
- כל שורת פריט: שם המוצר, כמות, יחידת מידה, מחיר ליחידה, וסה"כ לשורה.
- הסכום הכולל לתשלום.
כל המחירים בשקלים (מספרים). אם שדה כלשהו לא קריא או לא קיים — החזר מחרוזת ריקה או 0.
אל תמציא נתונים שאינם בתמונה.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function mediaTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    // אימות שהמשתמש מחובר והוא מנהל
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    if (!userData.user) return json({ error: 'לא מחובר' }, 401)

    const { data: isManager } = await userClient.rpc('is_manager')
    if (!isManager) return json({ error: 'נדרשת הרשאת מנהל' }, 403)

    const { path } = await req.json()
    if (!path || typeof path !== 'string') return json({ error: 'חסר path' }, 400)

    // הורדת התמונה עם service role
    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: file, error: dlErr } = await adminClient.storage
      .from('invoices')
      .download(path)
    if (dlErr || !file) return json({ error: 'הורדת התמונה נכשלה' }, 400)

    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)

    // קריאה ל-Claude עם structured outputs (עם ניסיון חוזר על שגיאות שער)
    const payload = JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaTypeFor(path), data: base64 },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    let res: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: payload,
      })
      if (res.ok) break
      // 502/503/504/529 = תקלת שער/עומס זמנית — נסה שוב אחרי המתנה קצרה
      if ([502, 503, 504, 529].includes(res.status) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        continue
      }
      break
    }

    if (!res || !res.ok) {
      const errText = res ? await res.text() : 'אין תשובה'
      console.error('Anthropic error:', res?.status, errText)
      let detail = errText
      try {
        detail = JSON.parse(errText)?.error?.message ?? errText
      } catch (_) {
        detail = errText.slice(0, 200)
      }
      return json({ error: `Claude (${res?.status ?? '—'}): ${detail}` }, 502)
    }

    const data = await res.json()
    if (data.stop_reason === 'refusal') return json({ error: 'הבקשה נדחתה' }, 400)

    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
    if (!textBlock) return json({ error: 'אין תוצאה' }, 502)

    const extracted = JSON.parse(textBlock.text)
    return json({ extracted })
  } catch (err) {
    console.error(err)
    return json({ error: 'שגיאה בחילוץ: ' + (err as Error).message }, 500)
  }
})
