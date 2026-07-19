# CLAUDE.md — מוסכמות פרויקט אלכסנדר

מערכת ניהול למסעדת ההמבורגרים "אלכסנדר" בנהריה. אפליקציה אחת, mobile-first,
PWA, עברית מלאה (RTL). הבעלים (יארום) מפעיל אותה מהטלפון בעמידה במסעדה.

## מודולים

1. **חשבוניות ופוד קוסט** — צילום חשבוניות ספק, חילוץ אוטומטי (Claude Vision),
   קטלוג מוצרים מנורמל, היסטוריית מחירים + זיהוי חריגות, פוד קוסט למנות, דוחות.
2. **סידורי עבודה** — משמרות בוקר/ערב עם שעות מדורגות לכל עובד, דרישות איוש
   והתראה ויזואלית על חוסרים, זמינות עובדים, שליחה לוואטסאפ, סיכום שעות ועלות.
3. **שכר** — _הוסר מהתכולה כרגע, ייתכן שיתווסף בעתיד._ הסכמה שומרת מקום לו.

## סטאק טכני

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Routing | react-router-dom v6 |
| Server state | TanStack Query v5 |
| Backend | Supabase — Postgres, Auth, Storage, Edge Functions |
| Vision | Claude API מתוך Edge Function (המפתח בצד שרת בלבד) |
| PWA | vite-plugin-pwa (Workbox) |
| Icons | lucide-react |
| Deploy | Vercel |

## מבנה תיקיות

```
src/
  components/
    ui/           רכיבי design system בסיסיים (Button, Input, Card, Spinner)
    layout/       AppShell, TopBar, BottomNav, navItems
    ProtectedRoute.tsx
  contexts/       AuthContext (session, profile, role)
  lib/            supabase, queryClient, utils (cn, פורמט מטבע/תאריך)
  pages/          מסך לכל מסלול
  types/          טיפוסי DB
  main.tsx, App.tsx, index.css
supabase/
  migrations/     קבצי SQL ממוספרים
  README.md       הוראות הקמה + הפיכה למנהל
public/           אייקונים, favicon, manifest
```

## הרשאות ותפקידים

- שני תפקידים: **`manager`** (גישה מלאה) ו-**`employee`** (רק סידור העבודה, בלי
  חשבוניות/פוד-קוסט).
- התפקיד נשמר ב-`profiles.role`. ברירת מחדל בהרשמה: `employee`. שדרוג למנהל
  נעשה ידנית ב-DB (ראה `supabase/README.md`).
- אכיפה בשתי שכבות: **RLS ב-Postgres** (מקור האמת) + `ProtectedRoute`/ניווט
  בקליינט (חוויית משתמש בלבד — לא אבטחה).

## מוסכמות קוד

- **עברית RTL בכל מקום.** `dir="rtl"` ב-`<html>`. שדות אימייל/סיסמה/מספרים —
  `dir="ltr"` נקודתי. שבוע מתחיל ביום **ראשון** (weekday 0 = ראשון).
- **כסף = מספרים שלמים באגורות** (integer). לעולם לא float. הצגה עם
  `formatCurrency` מ-`lib/utils`.
- תאריכים ומספרים דרך `Intl` בלוקאל `he-IL` (`formatDate`, `formatCurrency`).
- **סודות אף פעם לא בקוד צד-לקוח.** רק `anon key` בקליינט. `service_role` ומפתח
  Claude — ב-Edge Functions בלבד.
- **כל טבלה עם RLS.** ללא יוצא מן הכלל.
- מיזוג מחלקות Tailwind עם `cn()`. רכיבי UI עם `forwardRef` ווריאנטים.
- Prettier: ללא נקודה-פסיק, גרשיים בודדים, רוחב 90. ESLint flat config.
- קומיטים קטנים וברורים, בעברית או אנגלית תמציתית.

## פקודות

```bash
npm run dev        # שרת פיתוח
npm run build      # typecheck + build לפרודקשן
npm run preview    # תצוגה מקדימה של הבילד
npm run lint       # ESLint
npm run typecheck  # בדיקת טיפוסים בלבד
npm run format     # Prettier
```

## הקמה מקומית

1. `npm install`
2. העתק `.env.example` ל-`.env.local` ומלא ערכי Supabase אמיתיים.
3. הרץ את ה-migrations (ראה `supabase/README.md`).
4. `npm run dev`

## אופן העבודה

עובדים בפאזות עם צ'קפוינט לאישור בסוף כל אחת. ראה `ROADMAP.md` לסטטוס.
לפני החלטה ארכיטקטונית משמעותית — עוצרים ושואלים.
