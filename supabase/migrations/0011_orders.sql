-- 0011 — הזמנות רכש + התאמת קבלה (3-Way Match)
-- ההזמנה = הצפוי. תעודת המשלוח/חשבונית המקושרת = בפועל. ההצלבה = ההפרש.

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   uuid references public.suppliers(id) on delete set null,
  status        text not null default 'draft'
                check (status in ('draft', 'ordered', 'received', 'closed')),
  order_date    date not null default current_date,
  expected_date date,
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);

create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  product_id          uuid references public.products(id) on delete set null,
  name                text not null,
  quantity            numeric not null default 1,
  unit                text,
  expected_unit_price integer, -- אגורות, המחיר המוסכם
  position            int not null default 0,
  created_at          timestamptz not null default now()
);

-- קישור תעודת משלוח/חשבונית להזמנה
alter table public.invoices
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists orders_supplier_id_idx on public.orders(supplier_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists invoices_order_id_idx on public.invoices(order_id);

-- RLS: מנהל בלבד
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders manager" on public.orders;
create policy "orders manager" on public.orders
  for all using (public.is_manager()) with check (public.is_manager());

drop policy if exists "order_items manager" on public.order_items;
create policy "order_items manager" on public.order_items
  for all using (public.is_manager()) with check (public.is_manager());
