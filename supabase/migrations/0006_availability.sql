-- =============================================================
-- פאזה 2 - זמינות/אילוצים ללא חשבונות עובדים
-- כל עובד מקבל קישור עם טוקן. הגשה וקריאה דרך RPC מאובטח (token-validated),
-- כך שאין צורך בהתחברות ובלי לפתוח את הטבלאות ל-anon.
-- =============================================================

-- טוקן ייחודי לכל עובד (לקישור הזמינות)
alter table public.employees
  add column if not exists avail_token uuid not null default gen_random_uuid();
create unique index if not exists employees_avail_token_idx
  on public.employees(avail_token);

-- זמינות לפי תאריך ומשמרת
create table if not exists public.shift_availability (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date   date not null,
  shift       public.shift_type not null,
  available   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (employee_id, work_date, shift)
);
create index if not exists shift_availability_date_idx
  on public.shift_availability(work_date);

alter table public.shift_availability enable row level security;
drop policy if exists "shiftavail_manager_all" on public.shift_availability;
create policy "shiftavail_manager_all" on public.shift_availability
  for all using (public.is_manager()) with check (public.is_manager());

-- ---------- RPC: קריאת זמינות לפי טוקן ----------
create or replace function public.avail_get(p_token uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_avail jsonb;
begin
  select id, full_name into v_id, v_name
    from public.employees where avail_token = p_token and active;
  if v_id is null then raise exception 'invalid token'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'work_date', work_date, 'shift', shift, 'available', available)), '[]'::jsonb)
    into v_avail
    from public.shift_availability
    where employee_id = v_id and work_date between p_from and p_to;
  return jsonb_build_object('full_name', v_name, 'availability', v_avail);
end; $$;

-- ---------- RPC: הגשת זמינות לפי טוקן ----------
create or replace function public.avail_submit(p_token uuid, p_entries jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; e jsonb;
begin
  select id into v_id from public.employees where avail_token = p_token and active;
  if v_id is null then raise exception 'invalid token'; end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    insert into public.shift_availability (employee_id, work_date, shift, available)
    values (v_id, (e->>'work_date')::date, (e->>'shift')::public.shift_type,
            (e->>'available')::boolean)
    on conflict (employee_id, work_date, shift)
    do update set available = excluded.available;
  end loop;
end; $$;

grant execute on function public.avail_get(uuid, date, date) to anon, authenticated;
grant execute on function public.avail_submit(uuid, jsonb) to anon, authenticated;
