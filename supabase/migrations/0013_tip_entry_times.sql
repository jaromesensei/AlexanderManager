-- 0013 — שעות התחלה/סיום לשורות טיפים (לחישוב שעות שבת לפי שעון)
-- שישי/שבת: גמול שבת חל על השעות שבין כניסת השבת לצאתה. השעות (hours)
-- נגזרות מהזמנים בעת השמירה, אך נשמרות גם הן לנוחות הדוחות.

alter table public.tip_day_entries
  add column if not exists start_time time,
  add column if not exists end_time time;
