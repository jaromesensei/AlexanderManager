// Edge Function: חילוץ חשבונית מתמונה עם Claude Vision.
// מקבל { path } (נתיב תמונה ב-bucket 'invoices'), מוריד אותה עם service role,
// שולח ל-Claude בזרימה (streaming) לעמידות מול תקלות שער, ומחזיר JSON מובנה.
// המפתח ANTHROPIC_API_KEY נשמר כסוד בצד שרת — לעולם לא בקליינט.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
// ניתן לשנות מודל דרך סוד EXTRACT_MODEL (למשל claude-haiku-4-5 לחיסכון/מהירות).
const MODEL = Deno.env.get('EXTRACT_MODEL') ?? 'claude-opus-4-8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = `זו תמונה של חשבונית או תעודת משלוח של ספק למסעדה, בעברית.
חלץ את הנתונים בדייקנות והחזר אך ורק JSON תקין — בלי טקסט לפני או אחרי, בלי סימוני קוד.
המבנה המדויק:
{
  "supplier_name": "שם הספק, או '' אם לא ברור",
  "invoice_number": "מספר החשבונית/התעודה, או ''",
  "invoice_date": "תאריך בפורמט YYYY-MM-DD, או ''",
  "total": סה"כ לתשלום בשקלים כמספר (כולל מע"מ), או 0,
  "items": [
    {
      "name": "שם המוצר כפי שמופיע",
      "quantity": כמות כמספר (יכול להיות שבר),
      "unit": "יחידת מידה, למשל ק\\"ג / יחידה / ארגז, או ''",
      "unit_price": מחיר ליחידה בשקלים כמספר, או 0,
      "line_total": סה"כ לשורה בשקלים כמספר, או 0
    }
  ]
}
כל המחירים בשקלים (מספרים, בלי סימן ₪). אם שדה לא קריא או לא קיים — החזר '' או 0.
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

// מנקה גדרות קוד (```json) ומחלץ את אובייקט ה-JSON מהטקסט
function parseExtracted(text: string): unknown {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

// קורא תשובת streaming (SSE) ומצרף את הטקסט מכל ה-deltas
async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let streamError = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      let evt: {
        type?: string
        delta?: { type?: string; text?: string }
        error?: { message?: string }
      }
      try {
        evt = JSON.parse(payload)
      } catch (_) {
        continue
      }
      if (evt.type === 'error') streamError = evt.error?.message ?? 'שגיאת זרימה'
      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        text += evt.delta.text ?? ''
      }
    }
  }
  if (streamError) throw new Error(streamError)
  return text
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

    // קריאה ל-Claude בזרימה (עמיד מול תקלות שער) + ניסיון חוזר על 5xx זמניות
    const payload = JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      stream: true,
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
      // 500/502/503/504/529 = עומס/תקלת שער זמנית — נסה שוב אחרי המתנה
      if ([500, 502, 503, 504, 529].includes(res.status) && attempt < 2) {
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

    const text = await readStream(res)
    if (!text.trim()) return json({ error: 'אין תוצאה מ-Claude' }, 502)

    let extracted: unknown
    try {
      extracted = parseExtracted(text)
    } catch (_) {
      console.error('parse error, raw:', text.slice(0, 500))
      return json({ error: 'התשובה לא הייתה JSON תקין' }, 502)
    }
    return json({ extracted })
  } catch (err) {
    console.error(err)
    return json({ error: 'שגיאה בחילוץ: ' + (err as Error).message }, 500)
  }
})
