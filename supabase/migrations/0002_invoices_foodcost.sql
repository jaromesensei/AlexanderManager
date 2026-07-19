-- =============================================================
-- פאזה 1 - חשבוניות ופוד קוסט
-- ספקים, קטלוג מוצרים מנורמל, חשבוניות ושורות, היסטוריית מחירים,
-- התראות חריגה, מנות ומתכונים. הכל מנהל-בלבד (RLS דרך is_manager).
-- כסף = אגורות (integer). כמויות = numeric (מאפשר שברים כמו 2.5 ק"ג).
-- =============================================================

-- ---------- קטגוריות מוצרים ----------
create table public.product_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- ספקים ----------
create table public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

-- ---------- מוצרים (קטלוג מנורמל) ----------
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  category_id  uuid references public.product_categories(id) on delete set null,
  default_unit text,
  created_at   timestamptz not null default now()
);

-- ---------- כינויי מוצר (וריאציות כתיב → מוצר אחד) ----------
create table public.product_aliases (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  alias_name  text not null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (alias_name, supplier_id)
);

-- ---------- חשבוניות ----------
create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  invoice_date   date,
  image_path     text,                       -- נתיב ב-Storage (bucket: invoices)
  total_amount   integer,                     -- אגורות (סה"כ כפי שמופיע בחשבונית)
  status         text not null default 'pending' check (status in ('pending', 'confirmed')),
  raw_extraction jsonb,                       -- פלט גולמי מ-Vision
  notes          text,
  created_by     uuid references auth.users(id) default auth.uid(),
  created_at     timestamptz not null default now()
);

create index invoices_supplier_idx on public.invoices(supplier_id);
create index invoices_date_idx on public.invoices(invoice_date desc);

-- ---------- שורות חשבונית ----------
create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,  -- ממופה בהמשך
  raw_name    text not null,                  -- שם כפי שמופיע בחשבונית
  quantity    numeric,
  unit        text,
  unit_price  integer,                        -- אגורות ליחידה
  line_total  integer,                        -- אגורות
  position    integer not null default 0,     -- סדר בחשבונית
  created_at  timestamptz not null default now()
);

create index invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index invoice_items_product_idx on public.invoice_items(product_id);

-- ---------- היסטוריית מחירים ----------
create table public.price_points (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_id  uuid references public.invoices(id) on delete cascade,
  unit        text,
  unit_price  integer not null,               -- אגורות ליחידה
  observed_at date not null,
  created_at  timestamptz not null default now()
);

create index price_points_product_idx on public.price_points(product_id, observed_at desc);

-- ---------- התראות חריגת מחיר ----------
create table public.price_alerts (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products(id) on delete cascade,
  invoice_item_id uuid references public.invoice_items(id) on delete cascade,
  previous_avg    integer,                    -- אגורות
  new_price       integer,                    -- אגורות
  pct_change      numeric,
  acknowledged    boolean not null default false,
  created_at      timestamptz not null default now()
);

create index price_alerts_open_idx on public.price_alerts(acknowledged) where acknowledged = false;

-- ---------- מנות ----------
create table public.dishes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,
  menu_price integer,                          -- אגורות (מחיר מכירה)
  created_at timestamptz not null default now()
);

-- ---------- מתכון (מנה → מרכיבים) ----------
create table public.recipe_items (
  id         uuid primary key default gen_random_uuid(),
  dish_id    uuid not null references public.dishes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity   numeric not null,
  unit       text,
  created_at timestamptz not null default now()
);

create index recipe_items_dish_idx on public.recipe_items(dish_id);

-- =============================================================
-- RLS - כל הטבלאות מנהל-בלבד
-- =============================================================
alter table public.product_categories enable row level security;
alter table public.suppliers          enable row level security;
alter table public.products           enable row level security;
alter table public.product_aliases    enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_items      enable row level security;
alter table public.price_points       enable row level security;
alter table public.price_alerts       enable row level security;
alter table public.dishes             enable row level security;
alter table public.recipe_items       enable row level security;

create policy "cat_manager_all"      on public.product_categories for all using (public.is_manager()) with check (public.is_manager());
create policy "suppliers_manager_all" on public.suppliers         for all using (public.is_manager()) with check (public.is_manager());
create policy "products_manager_all"  on public.products          for all using (public.is_manager()) with check (public.is_manager());
create policy "aliases_manager_all"   on public.product_aliases   for all using (public.is_manager()) with check (public.is_manager());
create policy "invoices_manager_all"  on public.invoices          for all using (public.is_manager()) with check (public.is_manager());
create policy "items_manager_all"     on public.invoice_items     for all using (public.is_manager()) with check (public.is_manager());
create policy "prices_manager_all"    on public.price_points      for all using (public.is_manager()) with check (public.is_manager());
create policy "alerts_manager_all"    on public.price_alerts      for all using (public.is_manager()) with check (public.is_manager());
create policy "dishes_manager_all"    on public.dishes            for all using (public.is_manager()) with check (public.is_manager());
create policy "recipe_manager_all"    on public.recipe_items      for all using (public.is_manager()) with check (public.is_manager());

-- =============================================================
-- Storage - bucket פרטי לחשבוניות, מנהל-בלבד
-- =============================================================
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "invoices_storage_manager_all"
  on storage.objects for all
  using (bucket_id = 'invoices' and public.is_manager())
  with check (bucket_id = 'invoices' and public.is_manager());
