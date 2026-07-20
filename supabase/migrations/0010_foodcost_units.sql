-- =============================================================
-- פאזה 1 - פוד קוסט: יחידת בסיס והמרה לכל מוצר
-- base_unit = יחידת השימוש במתכון (גרם/מ"ל/יחידה).
-- base_per_purchase = כמה יחידות בסיס יש ביחידת הקנייה (מה שבחשבונית).
-- עלות ליחידת בסיס = מחיר אחרון בחשבונית ÷ base_per_purchase.
-- (dishes ו-recipe_items כבר קיימים ממיגרציה 0002.)
-- =============================================================

alter table public.products
  add column if not exists base_unit text;

alter table public.products
  add column if not exists base_per_purchase numeric not null default 1;
