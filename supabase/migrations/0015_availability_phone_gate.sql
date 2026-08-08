-- =============================================================
-- פאזה 2 - קישור זמינות קבוצתי מאובטח בטלפון
-- העובד בוחר את שמו מהרשימה, ואז מזין את מספר הטלפון שלו.
-- הגישה נפתחת רק אם הטלפון תואם למספר השמור אצל העובד ב-DB.
-- ההשוואה מנרמלת ספרות ומשווה 9 ספרות אחרונות (0501234567 == +972501234567).
--
-- מחליף את avail_get_named / avail_submit_named הישנים שלא בדקו טלפון
-- (חור אבטחה - אפשר היה למלא זמינות בשם כל אחד). הגרסאות הישנות נמחקות.
-- =============================================================

-- מסירים את הגרסאות הלא-מאובטחות (חתימות ישנות)
drop function if exists public.avail_get_named(uuid, date, date);
drop function if exists public.avail_submit_named(uuid, jsonb);

-- נרמול טלפון ל-9 ספרות אחרונות (immutable, לשימוש חוזר)
create or replace function public.normalize_phone9(p text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9);
$$;

-- אימות שם מול טלפון. מחזיר את שם העובד אם תואם, אחרת שגיאה.
create or replace function public.avail_verify_named(p_id uuid, p_phone text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; v_stored text; v_in text;
begin
  select full_name, phone into v_name, v_stored
    from public.employees where id = p_id and active;
  if v_name is null then raise exception 'not found'; end if;

  v_stored := public.normalize_phone9(v_stored);
  v_in := public.normalize_phone9(p_phone);

  if length(v_stored) < 9 then raise exception 'no_phone'; end if;
  if v_in <> v_stored then raise exception 'phone_mismatch'; end if;

  return jsonb_build_object('id', p_id, 'full_name', v_name);
end; $$;

-- קריאת זמינות לפי מזהה עובד + אימות טלפון
create or replace function public.avail_get_named(
  p_id uuid, p_phone text, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text; v_stored text; v_avail jsonb; v_locked boolean;
begin
  select full_name, phone into v_name, v_stored
    from public.employees where id = p_id and active;
  if v_name is null then raise exception 'not found'; end if;

  v_stored := public.normalize_phone9(v_stored);
  if length(v_stored) < 9 then raise exception 'no_phone'; end if;
  if public.normalize_phone9(p_phone) <> v_stored then
    raise exception 'phone_mismatch';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'work_date', work_date, 'shift', shift, 'available', available)), '[]'::jsonb)
    into v_avail from public.shift_availability
    where employee_id = p_id and work_date between p_from and p_to;
  select exists(select 1 from public.availability_locks
                where employee_id = p_id and week_start = p_from) into v_locked;
  return jsonb_build_object('full_name', v_name, 'availability', v_avail, 'locked', v_locked);
end; $$;

-- הגשת זמינות לפי מזהה עובד + אימות טלפון (עם נעילה)
create or replace function public.avail_submit_named(
  p_id uuid, p_phone text, p_entries jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare e jsonb; v_week date; v_stored text;
begin
  select phone into v_stored from public.employees where id = p_id and active;
  if not found then raise exception 'not found'; end if;

  v_stored := public.normalize_phone9(v_stored);
  if length(v_stored) < 9 then raise exception 'no_phone'; end if;
  if public.normalize_phone9(p_phone) <> v_stored then
    raise exception 'phone_mismatch';
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

grant execute on function public.normalize_phone9(text) to anon, authenticated;
grant execute on function public.avail_verify_named(uuid, text) to anon, authenticated;
grant execute on function public.avail_get_named(uuid, text, date, date) to anon, authenticated;
grant execute on function public.avail_submit_named(uuid, text, jsonb) to anon, authenticated;
