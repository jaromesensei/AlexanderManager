-- =============================================================
-- פאזה 2 - נעילת זמינות לאחר שליחה
-- ברגע שעובד שולח זמינות לשבוע, הוא ננעל ולא יכול לשנות (אלא אם המנהל
-- פותח מחדש). מונע שינויים תוך כדי בניית הסידור.
-- =============================================================

create table if not exists public.availability_locks (
  employee_id uuid not null references public.employees(id) on delete cascade,
  week_start  date not null,
  locked_at   timestamptz not null default now(),
  primary key (employee_id, week_start)
);

alter table public.availability_locks enable row level security;
drop policy if exists "availlocks_manager_all" on public.availability_locks;
create policy "availlocks_manager_all" on public.availability_locks
  for all using (public.is_manager()) with check (public.is_manager());

-- avail_get: מחזיר גם האם השבוע נעול
create or replace function public.avail_get(p_token uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_avail jsonb; v_locked boolean;
begin
  select id, full_name into v_id, v_name
    from public.employees where avail_token = p_token and active;
  if v_id is null then raise exception 'invalid token'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'work_date', work_date, 'shift', shift, 'available', available)), '[]'::jsonb)
    into v_avail from public.shift_availability
    where employee_id = v_id and work_date between p_from and p_to;
  select exists(
    select 1 from public.availability_locks
    where employee_id = v_id and week_start = p_from
  ) into v_locked;
  return jsonb_build_object('full_name', v_name, 'availability', v_avail, 'locked', v_locked);
end; $$;

-- avail_submit: נכשל אם נעול; אחרת שומר ונועל את השבוע
create or replace function public.avail_submit(p_token uuid, p_entries jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; e jsonb; v_week date;
begin
  select id into v_id from public.employees where avail_token = p_token and active;
  if v_id is null then raise exception 'invalid token'; end if;

  select min((x->>'work_date')::date) into v_week
    from jsonb_array_elements(p_entries) x;

  if exists(select 1 from public.availability_locks
            where employee_id = v_id and week_start = v_week) then
    raise exception 'locked';
  end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    insert into public.shift_availability (employee_id, work_date, shift, available)
    values (v_id, (e->>'work_date')::date, (e->>'shift')::public.shift_type,
            (e->>'available')::boolean)
    on conflict (employee_id, work_date, shift) do update set available = excluded.available;
  end loop;

  insert into public.availability_locks (employee_id, week_start)
    values (v_id, v_week) on conflict do nothing;
end; $$;

grant execute on function public.avail_get(uuid, date, date) to anon, authenticated;
grant execute on function public.avail_submit(uuid, jsonb) to anon, authenticated;
