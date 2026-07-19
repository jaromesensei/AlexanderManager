-- =============================================================
-- פאזה 2 - קישור זמינות קבוצתי (בחירת שם מרשימה, ללא טוקן אישי)
-- מפרסמים קישור אחד לקבוצה; העובד בוחר את שמו וממלא זמינות.
-- מודל אמון קבוצתי - טכנית כל אחד בצוות יכול לבחור כל שם.
-- =============================================================

-- רשימת עובדים פעילים (id + שם)
create or replace function public.avail_roster()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name) order by full_name)
    from public.employees where active
  ), '[]'::jsonb);
end; $$;

-- קריאת זמינות לפי מזהה עובד
create or replace function public.avail_get_named(p_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; v_avail jsonb; v_locked boolean;
begin
  select full_name into v_name from public.employees where id = p_id and active;
  if v_name is null then raise exception 'not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'work_date', work_date, 'shift', shift, 'available', available)), '[]'::jsonb)
    into v_avail from public.shift_availability
    where employee_id = p_id and work_date between p_from and p_to;
  select exists(select 1 from public.availability_locks
                where employee_id = p_id and week_start = p_from) into v_locked;
  return jsonb_build_object('full_name', v_name, 'availability', v_avail, 'locked', v_locked);
end; $$;

-- הגשת זמינות לפי מזהה עובד (עם נעילה)
create or replace function public.avail_submit_named(p_id uuid, p_entries jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb; v_week date;
begin
  if not exists(select 1 from public.employees where id = p_id and active) then
    raise exception 'not found';
  end if;
  select min((x->>'work_date')::date) into v_week from jsonb_array_elements(p_entries) x;
  if exists(select 1 from public.availability_locks
            where employee_id = p_id and week_start = v_week) then
    raise exception 'locked';
  end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    insert into public.shift_availability (employee_id, work_date, shift, available)
    values (p_id, (e->>'work_date')::date, (e->>'shift')::public.shift_type,
            (e->>'available')::boolean)
    on conflict (employee_id, work_date, shift) do update set available = excluded.available;
  end loop;
  insert into public.availability_locks (employee_id, week_start)
    values (p_id, v_week) on conflict do nothing;
end; $$;

grant execute on function public.avail_roster() to anon, authenticated;
grant execute on function public.avail_get_named(uuid, date, date) to anon, authenticated;
grant execute on function public.avail_submit_named(uuid, jsonb) to anon, authenticated;
