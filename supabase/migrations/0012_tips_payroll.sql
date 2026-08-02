-- 0012 — טיפים ושכר: קופה משותפת + השלמה לשכר מינימום (לפי יום)
-- מודל: בסגירת יום מזינים סך טיפים + מי עבד וכמה שעות.
-- טיפ/שעה = סך הטיפים ÷ סך השעות. אם טיפ/שעה < מינימום → השלמה עד המינימום.
-- הכסף באגורות (integer). שעות = numeric.

-- הגדרות כלליות (key/value) — לאחסון שכר המינימום ועוד בעתיד.
create table if not exists public.app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ברירת מחדל לשכר המינימום השעתי (אגורות) — 35.40 ₪ (עדכני 04/2026, ניתן לשינוי).
insert into public.app_settings (key, value)
values ('min_hourly_wage', '3540')
on conflict (key) do nothing;

-- סגירת יום: סך הטיפים של היום (הקופה המשותפת).
create table if not exists public.tip_days (
  id         uuid primary key default gen_random_uuid(),
  work_date  date not null unique,
  total_tips integer not null default 0, -- אגורות
  notes      text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- מי עבד באותו יום וכמה שעות (= משתתפי הקופה).
create table if not exists public.tip_day_entries (
  id          uuid primary key default gen_random_uuid(),
  tip_day_id  uuid not null references public.tip_days(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  hours       numeric not null default 0,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (tip_day_id, employee_id)
);

create index if not exists tip_day_entries_day_idx on public.tip_day_entries(tip_day_id);
create index if not exists tip_day_entries_emp_idx on public.tip_day_entries(employee_id);
create index if not exists tip_days_date_idx on public.tip_days(work_date);

-- RLS: מנהל בלבד
alter table public.app_settings enable row level security;
alter table public.tip_days enable row level security;
alter table public.tip_day_entries enable row level security;

drop policy if exists "app_settings manager" on public.app_settings;
create policy "app_settings manager" on public.app_settings
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "tip_days manager" on public.tip_days;
create policy "tip_days manager" on public.tip_days
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "tip_day_entries manager" on public.tip_day_entries;
create policy "tip_day_entries manager" on public.tip_day_entries
  for all using (public.is_manager()) with check (public.is_manager());
