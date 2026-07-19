-- =============================================================
-- פאזה 1 (5) - מעקב מחירים והתראות חריגה
-- כשחשבונית מאושרת: מיפוי מוצרים אוטומטי, רישום מחיר, וזיהוי קפיצות.
-- ללא AI, הכל ב-Postgres. סף התראה: 15% מעל ממוצע 5 המחירים האחרונים.
-- =============================================================

-- נרמול שם מוצר להשוואה (אותיות קטנות, רווחים מנורמלים)
create or replace function public.normalize_name(txt text)
returns text language sql immutable as $$
  select lower(btrim(regexp_replace(coalesce(txt, ''), '\s+', ' ', 'g')))
$$;

-- עיבוד מחירים לחשבונית מאושרת. idempotent - אפשר להריץ שוב.
create or replace function public.process_invoice_prices(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status    text;
  v_supplier  uuid;
  v_date      date;
  r           record;
  v_product   uuid;
  v_norm      text;
  v_avg       numeric;
  v_pct       numeric;
  v_threshold numeric := 15; -- אחוז קפיצה שמפעיל התראה
begin
  if not public.is_manager() then
    raise exception 'נדרשת הרשאת מנהל';
  end if;

  select status, supplier_id, coalesce(invoice_date, current_date)
    into v_status, v_supplier, v_date
  from public.invoices where id = p_invoice_id;

  if v_status is distinct from 'confirmed' then
    return; -- מעבדים רק חשבוניות מאושרות
  end if;

  -- איפוס עיבוד קודם של אותה חשבונית
  delete from public.price_alerts
    where invoice_item_id in (
      select id from public.invoice_items where invoice_id = p_invoice_id
    );
  delete from public.price_points where invoice_id = p_invoice_id;

  for r in
    select * from public.invoice_items where invoice_id = p_invoice_id
  loop
    if r.unit_price is null then continue; end if;
    v_norm := public.normalize_name(r.raw_name);
    if v_norm = '' then continue; end if;

    -- מציאת מוצר: כינוי → שם קנוני → יצירה חדשה
    v_product := null;
    select product_id into v_product from public.product_aliases
      where public.normalize_name(alias_name) = v_norm limit 1;
    if v_product is null then
      select id into v_product from public.products
        where public.normalize_name(canonical_name) = v_norm limit 1;
    end if;
    if v_product is null then
      insert into public.products (canonical_name, default_unit)
        values (btrim(r.raw_name), r.unit)
        returning id into v_product;
    end if;

    update public.invoice_items set product_id = v_product where id = r.id;

    -- ממוצע עד 5 מחירים אחרונים לאותו מוצר ויחידה (לא כולל החשבונית הזו)
    select avg(unit_price) into v_avg from (
      select unit_price from public.price_points
      where product_id = v_product
        and invoice_id is distinct from p_invoice_id
        and unit is not distinct from r.unit
      order by observed_at desc
      limit 5
    ) prev;

    insert into public.price_points
      (product_id, supplier_id, invoice_id, unit, unit_price, observed_at)
      values (v_product, v_supplier, p_invoice_id, r.unit, r.unit_price, v_date);

    if v_avg is not null and v_avg > 0 then
      v_pct := round((r.unit_price - v_avg) / v_avg * 100, 1);
      if v_pct >= v_threshold then
        insert into public.price_alerts
          (product_id, invoice_item_id, previous_avg, new_price, pct_change)
          values (v_product, r.id, round(v_avg), r.unit_price, v_pct);
      end if;
    end if;
  end loop;
end;
$$;
