-- =============================================================
-- פאזה 0 - טבלת ליבה: profiles
-- מגדירה משתמשים ותפקידים (מנהל / עובד) עם RLS.
-- מסעדה אחת, ללא org_id (לפי החלטת המוצר).
-- =============================================================

-- תפקידי משתמש
create type public.user_role as enum ('manager', 'employee');

-- טבלת פרופילים - מרחיבה את auth.users
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  role       public.user_role not null default 'employee',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'פרופיל משתמש עם תפקיד. מקושר ל-auth.users.';

-- ---------- טריגר: יצירת פרופיל אוטומטית בהרשמה ----------
-- ברירת מחדל: עובד. שדרוג למנהל נעשה ידנית ב-DB (מטעמי אבטחה).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'employee'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- פונקציית עזר: האם המשתמש הנוכחי מנהל ----------
-- security definer כדי לעקוף RLS ולמנוע רקורסיה במדיניות.
create or replace function public.is_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;

-- כל משתמש רואה את הפרופיל של עצמו
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- מנהל רואה את כל הפרופילים
create policy "profiles_select_manager"
  on public.profiles for select
  using (public.is_manager());

-- משתמש יכול לעדכן את השם של עצמו (לא את התפקיד - נאכף בהמשך)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- מנהל יכול לעדכן כל פרופיל (כולל שינוי תפקידים)
create policy "profiles_update_manager"
  on public.profiles for update
  using (public.is_manager())
  with check (public.is_manager());
