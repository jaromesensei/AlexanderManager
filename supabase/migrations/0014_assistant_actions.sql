-- 0014 — יומן פעולות של אלכס (עוזר ה-AI) + ביטול בדיעבד
-- לכל פעולה שאלכס ביצע נשמר snapshot של המצב הקודם, לאפשר Undo מאוחר.

create table if not exists public.assistant_actions (
  id          uuid primary key default gen_random_uuid(),
  action_type text not null,            -- למשל 'close_tip_day'
  work_date   date,                     -- התאריך שהושפע (אם רלוונטי)
  description text not null,            -- תיאור קריא
  prev_state  jsonb,                    -- המצב הקודם לשחזור (null = לא היה קיים)
  undone      boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists assistant_actions_created_idx
  on public.assistant_actions(created_at desc);

alter table public.assistant_actions enable row level security;

drop policy if exists "assistant_actions manager" on public.assistant_actions;
create policy "assistant_actions manager" on public.assistant_actions
  for all using (public.is_manager()) with check (public.is_manager());
