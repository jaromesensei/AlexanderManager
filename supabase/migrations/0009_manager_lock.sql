-- =============================================================
-- פאזה 2 - מעבר לנעילה בשליטת המנהל
-- מסירים נעילה אוטומטית בשליחה. עובדים עורכים חופשי עד שהמנהל נועל.
-- (בדיקת הנעילה נשארת - אם נעול, שליחה נכשלת.)
-- =============================================================

create or replace function public.avail_submit(p_token uuid, p_entries jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; e jsonb; v_week date;
begin
  select id into v_id from public.employees where avail_token = p_token and active;
  if v_id is null then raise exception 'invalid token'; end if;
  select min((x->>'work_date')::date) into v_week from jsonb_array_elements(p_entries) x;
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
end; $$;

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
end; $$;
