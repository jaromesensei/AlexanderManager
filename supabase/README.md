# Supabase — אלכסנדר

תיקיית ההגדרות של בסיס הנתונים, ההרשאות (RLS) וה-Edge Functions.

## מבנה

- `migrations/` — קבצי SQL ממוספרים. כל שינוי סכמה = migration חדש.
- `functions/extract-invoice/` — Edge Function לחילוץ חשבונית עם Claude Vision.

## Edge Function: extract-invoice

מחלצת נתונים מתמונת חשבונית עם Claude (structured outputs). מפתח Claude נשמר
כסוד בצד שרת בלבד.

**פריסה (CLI):**
```bash
supabase functions deploy extract-invoice
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# אופציונלי: מודל זול יותר לחיסכון
# supabase secrets set EXTRACT_MODEL=claude-haiku-4-5
```

**פריסה מלוח הבקרה:** Edge Functions → Create a function → `extract-invoice` →
הדבק את תוכן `functions/extract-invoice/index.ts` → Deploy. הגדר את הסוד
`ANTHROPIC_API_KEY` תחת Edge Functions → Secrets.

הפונקציה משתמשת ב-`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(מוזרקים אוטומטית) + `ANTHROPIC_API_KEY` (סוד שאתה מגדיר).

## הרצה ראשונית (חד־פעמי)

1. צור פרויקט ב-[supabase.com](https://supabase.com).
2. העתק את `URL` ו-`anon key` מ-Settings → API אל `.env.local` בשורש הפרויקט.
3. הרץ את ה-migration: העתק את תוכן `migrations/0001_init_profiles.sql`
   ל-SQL Editor בלוח הבקרה של Supabase והרץ.
   (או עם ה-CLI: `supabase db push`.)

## הפיכת משתמש למנהל

לאחר הרשמה, המשתמש נוצר כ`employee` כברירת מחדל. כדי להפוך אותך למנהל,
הרץ ב-SQL Editor:

```sql
update public.profiles set role = 'manager'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

## עקרונות אבטחה

- **כל טבלה עם RLS.** ללא יוצא מן הכלל.
- מפתחות `service_role` ומפתח Claude API **לעולם לא** בצד לקוח — רק ב-Edge Functions.
- הקליינט משתמש אך ורק ב-`anon key` הציבורי.
