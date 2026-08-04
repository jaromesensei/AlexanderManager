// Edge Function: "אלכס" — עוזר הניהול. מקבל שיחה + הקשר (עובדים, טיפים אחרונים),
// שולח ל-Claude, ומחזיר תשובה בעברית + הצעות פעולה (proposals) לאישור בקליינט.
// אלכס לא מבצע כלום — הוא רק מציע. הכתיבה נעשית בקליינט אחרי אישור המנהל.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = Deno.env.get('ASSISTANT_MODEL') ?? 'claude-opus-4-8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

interface EmployeeCtx {
  id: string
  name: string
}
interface Ctx {
  today: string
  weekday: string
  min_hourly_wage_agorot: number
  employees: EmployeeCtx[]
  recent_days: unknown[]
}

function systemPrompt(ctx: Ctx): string {
  const wage = (ctx.min_hourly_wage_agorot / 100).toFixed(2)
  const emps = (ctx.employees ?? []).map((e) => `- ${e.name} (id: ${e.id})`).join('\n')
  return `אתה "אלכס", עוזר הניהול של מסעדת ההמבורגרים "אלכסנדר" בנהריה. אתה עוזר לבעלים (מנהל) בעברית, בקצרה וידידותית.

היום: ${ctx.today} (${ctx.weekday}). שכר מינימום לשעה: ${wage} ש"ח (בשבת 150%).

עובדים פעילים — השתמש אך ורק במזהים האלה, אל תמציא:
${emps || '(אין)'}

סגירות טיפים אחרונות (JSON, אגורות): ${JSON.stringify(ctx.recent_days ?? [])}

היכולות שלך:
1. לענות על שאלות לגבי טיפים, שעות, שכר ועובדים — לפי הנתונים שלמעלה.
2. להציע "סגירת יום טיפים" כשמבקשים להזין / לסגור / לעדכן יום.
3. אם צורפה תמונה של דף סגירות בכתב יד — חלץ ממנה לכל תאריך את העובדים, השעות (כניסה/יציאה) וסך הטיפים, והחזר proposal אחד לכל יום. אם התאריך לא ברור בדף, נסה להסיק מההקשר; אם אי אפשר — ציין זאת ב-note.

כללים:
- ענה תמיד בשדה reply בעברית, קצר וברור.
- הבן ניסוחים חופשיים, שמות חלקיים, וכינויי תאריך ("שבת שעברה", "אתמול", "ה-8 לחודש"). פרש אותם לפי היום.
- אם לא הבנת בקשה, או שחסר מידע — שאל שאלת הבהרה קצרה ב-reply במקום לנחש.
- התחום שלך כרגע: טיפים, שכר, שעות ועובדים. אם מבקשים משהו אחר (סידור עבודה, חשבוניות, ספקים) — הסבר בקצרה שכרגע אתה מטפל בטיפים ושכר בלבד, ושזה יתווסף בהמשך.
- אם מבקשים לסגור/לעדכן יום, הוסף proposal אחד או יותר עם kind="close_tip_day":
  - work_date בפורמט YYYY-MM-DD (פרש תאריכים יחסיים לפי היום).
  - אם נתנו סך טיפים → total_tips (בשקלים). אם נתנו טיפ לשעה → per_hour (בשקלים). רק אחד מהם; השני null.
  - לכל עובד entries עם: employee_id (מהרשימה), employee_name, start ו-end בפורמט HH:MM.
  - אם שם עמום או לא קיים ברשימה — השאר employee_id="" והסבר ב-note.
  - **חשוב:** ההצעה מחליפה את היום כולו. אם היום כבר קיים ב-recent_days ואתה רק מוסיף/מעדכן עובד — כלול ב-entries גם את כל העובדים שכבר סגורים באותו יום (מ-recent_days), לא רק את החדש, כדי שלא יימחקו.
  - אם חסר מידע קריטי (תאריך/שעות) — אל תמציא. בקש הבהרה ב-reply, והשאר proposals ריק.
- אל תמציא נתונים. אתה רק מציע — המנהל מאשר לפני כל שמירה.

החזר אך ורק JSON תקין במבנה:
{"reply": "טקסט", "proposals": [{"kind":"close_tip_day","work_date":"YYYY-MM-DD","total_tips":null,"per_hour":null,"entries":[{"employee_id":"","employee_name":"","start":"HH:MM","end":"HH:MM"}],"note":null}]}
בלי טקסט מחוץ ל-JSON, בלי סימוני קוד. אם אין הצעות — proposals הוא [].`
}

function parseJson(text: string): unknown {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim()
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start >= 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    if (!userData.user) return json({ error: 'לא מחובר' }, 401)
    const { data: isManager } = await userClient.rpc('is_manager')
    if (!isManager) return json({ error: 'נדרשת הרשאת מנהל' }, 403)

    const { messages, context, image_path } = await req.json()
    if (!Array.isArray(messages)) return json({ error: 'חסרות הודעות' }, 400)

    // הודעות בסיס (טקסט)
    const apiMessages: { role: string; content: unknown }[] = (
      messages as { role: string; content: string }[]
    ).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }))

    // אם צורפה תמונה — הורד אותה וצרף לתור המשתמש האחרון
    if (image_path && typeof image_path === 'string') {
      const adminClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      const { data: file, error: dlErr } = await adminClient.storage
        .from('invoices')
        .download(image_path)
      if (dlErr || !file) return json({ error: 'הורדת התמונה נכשלה' }, 400)
      const bytes = new Uint8Array(await file.arrayBuffer())
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      let lastUser = -1
      for (let i = apiMessages.length - 1; i >= 0; i--) {
        if (apiMessages[i].role === 'user') {
          lastUser = i
          break
        }
      }
      const textContent = lastUser >= 0 ? String(apiMessages[lastUser].content) : ''
      const imageBlock = {
        type: 'image',
        source: { type: 'base64', media_type: mediaTypeFor(image_path), data: base64 },
      }
      const content = [imageBlock, { type: 'text', text: textContent || 'חלץ מהדף.' }]
      if (lastUser >= 0) apiMessages[lastUser] = { role: 'user', content }
      else apiMessages.push({ role: 'user', content })
    }

    const body = {
      model: MODEL,
      // מספיק גדול לריבוי ימים בהצעה אחת (למשל צילום/הזנה של שבוע-חודש)
      max_tokens: 12000,
      system: systemPrompt(context as Ctx),
      messages: apiMessages,
    }

    let res: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (res.ok) break
      if ([500, 502, 503, 504, 529].includes(res.status) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
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
    const textBlock = (data.content ?? []).find(
      (b: { type: string }) => b.type === 'text'
    )
    if (!textBlock) return json({ error: 'אין תשובה מ-Claude' }, 502)

    let parsed: { reply?: string; proposals?: unknown[] }
    try {
      parsed = parseJson(textBlock.text) as typeof parsed
    } catch (_) {
      // תשובה שנקטעה (יותר מדי ימים בבת אחת)
      if (data.stop_reason === 'max_tokens') {
        return json({
          reply:
            'התשובה ארוכה מדי לעיבוד בבת אחת. נסה לחלק לפחות ימים — למשל שבוע כל פעם.',
          proposals: [],
        })
      }
      // אלכס ענה בטקסט חופשי (בלי JSON) — נציג את התשובה כמו שהיא, בלי הצעות
      return json({ reply: textBlock.text.trim(), proposals: [] })
    }
    return json({ reply: parsed.reply ?? '', proposals: parsed.proposals ?? [] })
  } catch (err) {
    console.error(err)
    return json({ error: 'שגיאה: ' + (err as Error).message }, 500)
  }
})
