-- =============================================================
-- פאזה 2 - סידורי עבודה
-- עובדים ותפקידים, דרישות איוש, זמינות, ושיבוצים למשמרות.
-- שבוע מתחיל ביום ראשון (weekday 0 = ראשון). שכר שעתי באגורות.
-- הכל מנהל-בלבד כרגע (RLS); גישת עובדים תתווסף עם חשבונות העובדים.
-- =============================================================

create type public.staff_role as enum ('waiter', 'host', 'bar', 'shift_manager');
create type public.shift_type as enum ('morning', 'evening');

-- ---------- עובדים ----------
create table public.employees (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text,
  hourly_rate integer,                       -- אגורות לשעה
  active      boolean not null default true,
  user_id     uuid references auth.users(id) on delete set null, -- קישור לחשבון (עתידי)
  created_at  timestamptz not null default now()
);

-- ---------- תפקידי עובד (ריבוי) ----------
create table public.employee_roles (
  employee_id uuid not null references public.employees(id) on delete cascade,
  role        public.staff_role not null,
  primary key (employee_id, role)
);

-- ---------- דרישות איוש ----------
-- weekday null = ברירת מחדל לכל הימים; אחרת ליום ספציפי.
create table public.staffing_requirements (
  id             uuid primary key default gen_random_uuid(),
  weekday        int check (weekday between 0 and 6),
  shift          public.shift_type not null,
  role           public.staff_role not null,
  required_count int not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- זמינות שבועית קבועה ----------
create table public.availability (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  weekday     int not null check (weekday between 0 and 6),
  start_time  time,
  end_time    time,
  created_at  timestamptz not null default now()
);

-- ---------- חריגי זמינות (תאריך ספציפי) ----------
create table public.availability_exceptions (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date        date not null,
  type        text not null check (type in ('off', 'extra')),
  start_time  time,
  end_time    time,
  created_at  timestamptz not null default now()
);

-- ---------- שיבוצים למשמרת ----------
create table public.shift_assignments (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date   date not null,
  shift       public.shift_type not null,
  role        public.staff_role not null,
  start_time  time,
  end_time    time,
  status      text not null default 'planned',
  created_at  timestamptz not null default now()
);

create index shift_assignments_date_idx on public.shift_assignments(work_date);
create index shift_assignments_emp_idx on public.shift_assignments(employee_id);

-- =============================================================
-- RLS - מנהל בלבד (כרגע)
-- =============================================================
alter table public.employees               enable row level security;
alter table public.employee_roles          enable row level security;
alter table public.staffing_requirements   enable row level security;
alter table public.availability            enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.shift_assignments       enable row level security;

create policy "employees_manager_all" on public.employees for all using (public.is_manager()) with check (public.is_manager());
create policy "emp_roles_manager_all" on public.employee_roles for all using (public.is_manager()) with check (public.is_manager());
create policy "staffreq_manager_all" on public.staffing_requirements for all using (public.is_manager()) with check (public.is_manager());
create policy "avail_manager_all" on public.availability for all using (public.is_manager()) with check (public.is_manager());
create policy "availexc_manager_all" on public.availability_exceptions for all using (public.is_manager()) with check (public.is_manager());
create policy "shifts_manager_all" on public.shift_assignments for all using (public.is_manager()) with check (public.is_manager());
