-- Vendors (e.g. the CPA who files the tax return), vendor cost on each invoice item and saved service,
-- payables created automatically when the client pays, and the payment of each payable in Endeavor's books.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  service text check (service is null or char_length(service) <= 200),
  contact_name text check (contact_name is null or char_length(contact_name) <= 200),
  email text check (email is null or char_length(email) <= 254),
  phone text check (phone is null or char_length(phone) <= 40),
  pay_method text not null default 'ach' check (pay_method in ('ach', 'zelle', 'wire', 'check', 'card', 'other')),
  terms_days int not null default 15 check (terms_days between 0 and 120),
  notes text check (notes is null or char_length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text
);
alter table public.vendors enable row level security;
drop policy if exists vendors_admin on public.vendors;
create policy vendors_admin on public.vendors for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.billing_services add column if not exists vendor_id uuid references public.vendors(id) on delete set null;
alter table public.billing_services add column if not exists vendor_cost_cents int not null default 0 check (vendor_cost_cents >= 0);

create table if not exists public.payables (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  invoice_id uuid references public.invoices(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  item_index int,
  description text not null check (char_length(description) <= 300),
  amount_cents int not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  paid_at date,
  paid_note text check (paid_note is null or char_length(paid_note) <= 500),
  bk_entry_id uuid,
  bk_pay_entry_id uuid,
  created_at timestamptz not null default now(),
  unique (invoice_id, item_index)
);
create index if not exists payables_vendor on public.payables(vendor_id, status);
create index if not exists payables_client on public.payables(client_id);
alter table public.payables enable row level security;
drop policy if exists payables_admin on public.payables;
create policy payables_admin on public.payables for select to authenticated using (public.is_admin());

-- Vendor cost per item, kept apart from the items the client can read (invoices/proposals are visible to the owner)
create table if not exists public.item_costs (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  proposal_id uuid references public.proposals(id) on delete cascade,
  item_index int not null check (item_index between 0 and 99),
  vendor_id uuid not null references public.vendors(id),
  cost_cents int not null check (cost_cents > 0),
  check ((invoice_id is null) <> (proposal_id is null))
);
create unique index if not exists item_costs_inv on public.item_costs(invoice_id, item_index) where invoice_id is not null;
create unique index if not exists item_costs_prop on public.item_costs(proposal_id, item_index) where proposal_id is not null;
alter table public.item_costs enable row level security;
drop policy if exists item_costs_admin on public.item_costs;
create policy item_costs_admin on public.item_costs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- When an invoice is paid: one payable per item with vendor cost, and Dr 5100 Subcontractors / Cr 2000 Accounts Payable in the house books
create or replace function public.bk_record_vendor_costs(p_invoice uuid) returns int
language plpgsql security definer set search_path = public as $$
declare i public.invoices; h uuid; cogs uuid; ap uuid; it jsonb; idx int; k public.item_costs; v public.vendors; c int; n int := 0; d date; cl text; pid uuid; e uuid;
begin
  select * into i from public.invoices where id = p_invoice;
  if i.id is null or i.status <> 'paid' then return 0; end if;
  select id into h from public.companies where is_house and books_provider = 'endeavor';
  if h is not null then
    select id into cogs from public.bk_accounts where company_id = h and code = '5100';
    select id into ap from public.bk_accounts where company_id = h and code = '2000';
  end if;
  select name into cl from public.clients where id = i.client_id;
  d := coalesce((i.paid_at at time zone 'America/New_York')::date, current_date);
  for k in select * from public.item_costs where invoice_id = i.id order by item_index loop
    idx := k.item_index; it := coalesce(i.items -> idx, '{}'::jsonb);
    c := k.cost_cents * greatest(1, coalesce((it->>'quantity')::int, 1));
    select * into v from public.vendors where id = k.vendor_id;
    if v.id is null then continue; end if;
    insert into public.payables (vendor_id, invoice_id, client_id, item_index, description, amount_cents, due_date)
      values (v.id, i.id, i.client_id, idx, left(coalesce(it->>'description', 'Service') || ' · ' || coalesce(cl, ''), 300), c, d + v.terms_days)
      on conflict (invoice_id, item_index) do nothing returning id into pid;
    if pid is null then continue; end if;
    n := n + 1;
    if cogs is not null and ap is not null then
      e := public.bk_post_core(h, d, left('Vendor cost: ' || v.name || ' · ' || coalesce(it->>'description', '') || ' · Invoice ' || coalesce(i.number, ''), 500),
        jsonb_build_array(jsonb_build_object('account_id', cogs, 'debit_cents', c, 'contact', v.name, 'description', left(coalesce(it->>'description', ''), 300)),
                          jsonb_build_object('account_id', ap, 'credit_cents', c, 'contact', v.name)), 'import', 'payables');
      update public.payables set bk_entry_id = e where id = pid;
    end if;
    pid := null;
  end loop;
  return n;
end $$;
revoke all on function public.bk_record_vendor_costs(uuid) from public, anon, authenticated;
grant execute on function public.bk_record_vendor_costs(uuid) to service_role;

-- Admin pays a payable: optionally posts Dr 2000 / Cr the bank or card account it was paid from.
-- Without an account, the payment is recorded only; categorize the bank feed line to 2000 Accounts Payable.
create or replace function public.bk_pay_payable(p_id uuid, p_date date, p_account uuid default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payables; h uuid; ap uuid; vn text; e uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into p from public.payables where id = p_id for update;
  if p.id is null or p.status <> 'open' then raise exception 'not_open'; end if;
  if p_account is not null then
    select id into h from public.companies where is_house and books_provider = 'endeavor';
    select id into ap from public.bk_accounts where company_id = h and code = '2000';
    if not exists (select 1 from public.bk_accounts where id = p_account and company_id = h and subtype in ('bank', 'credit_card')) then raise exception 'invalid_account'; end if;
    select name into vn from public.vendors where id = p.vendor_id;
    e := public.bk_post_core(h, coalesce(p_date, current_date), left('Payment to ' || vn || ' · ' || p.description, 500),
      jsonb_build_array(jsonb_build_object('account_id', ap, 'debit_cents', p.amount_cents, 'contact', vn),
                        jsonb_build_object('account_id', p_account, 'credit_cents', p.amount_cents, 'contact', vn)), 'manual', coalesce(auth.jwt()->>'email', 'admin'));
  end if;
  update public.payables set status = 'paid', paid_at = coalesce(p_date, current_date), paid_note = left(nullif(btrim(p_note), ''), 500), bk_pay_entry_id = e where id = p.id;
end $$;
grant execute on function public.bk_pay_payable(uuid, date, uuid, text) to authenticated;

-- Undo a payment (wrong click) or void an open payable (service not done by the vendor)
create or replace function public.bk_payable_action(p_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payables;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into p from public.payables where id = p_id for update;
  if p.id is null then raise exception 'not_found'; end if;
  if p_action = 'unpay' and p.status = 'paid' then
    if p.bk_pay_entry_id is not null then perform public.bk_void_entry(p.bk_pay_entry_id); end if;
    update public.payables set status = 'open', paid_at = null, paid_note = null, bk_pay_entry_id = null where id = p.id;
  elsif p_action = 'void' and p.status = 'open' then
    if p.bk_entry_id is not null then perform public.bk_void_entry(p.bk_entry_id); end if;
    update public.payables set status = 'void' where id = p.id;
  else raise exception 'invalid_action'; end if;
end $$;
grant execute on function public.bk_payable_action(uuid, text) to authenticated;

-- Bank feed: an outflow with the exact amount of an open payable is suggested as 2000 Accounts Payable
create or replace function public.bk_suggest(p_txn uuid)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare t public.bk_transactions; r public.bk_rules; h uuid; key text; b public.bk_bank_accounts; other uuid; txt text; pv text;
begin
  select * into t from public.bk_transactions where id = p_txn;
  if t.id is null or t.status <> 'review' then return; end if;
  txt := lower(coalesce(t.merchant, '') || ' ' || t.description);
  select * into r from public.bk_rules where company_id = t.company_id
     and position(lower(match_text) in txt) > 0
     and (direction = 'any' or (direction = 'in' and t.amount_cents > 0) or (direction = 'out' and t.amount_cents < 0))
   order by char_length(match_text) desc limit 1;
  if r.id is not null then
    update public.bk_transactions set suggested_account_id = r.account_id, suggest_source = 'rule', ai_confidence = 1, ai_reason = 'Rule: ' || r.match_text where id = t.id;
    return;
  end if;
  if t.amount_cents < 0 and exists (select 1 from public.companies where id = t.company_id and is_house) then
    select v.name into pv from public.payables p join public.vendors v on v.id = p.vendor_id
     where p.amount_cents = -t.amount_cents and (p.status = 'open' or (p.status = 'paid' and p.bk_pay_entry_id is null))
     order by (position(lower(split_part(v.name, ' ', 1)) in txt) > 0) desc, p.due_date limit 1;
    if pv is not null then
      update public.bk_transactions set suggested_account_id = (select id from public.bk_accounts where company_id = t.company_id and code = '2000'),
        suggest_source = 'history', ai_confidence = 0.9, ai_reason = left('Payment to vendor ' || pv || ' (accounts payable)', 200) where id = t.id;
      return;
    end if;
  end if;
  select * into b from public.bk_bank_accounts where id = t.bank_account_id;
  if txt ~ '(payment|pymt|autopay|auto pay|epay|thank you|pagamento)' then
    if b.kind <> 'credit_card' and t.amount_cents < 0 then
      select x.ledger_account_id into other from public.bk_bank_accounts x where x.company_id = t.company_id and x.kind = 'credit_card' and x.is_active
       order by (x.mask is not null and position(x.mask in txt) > 0) desc, (position(lower(split_part(x.name, ' ', 1)) in txt) > 0) desc limit 1;
    elsif b.kind = 'credit_card' and t.amount_cents > 0 then
      select x.ledger_account_id into other from public.bk_bank_accounts x where x.company_id = t.company_id and x.kind <> 'credit_card' and x.is_active order by x.created_at limit 1;
    end if;
    if other is not null then
      update public.bk_transactions set suggested_account_id = other, suggest_source = 'history', ai_confidence = 0.95, ai_reason = 'Transfer between the company''s own accounts (card payment)' where id = t.id;
      return;
    end if;
  end if;
  key := lower(left(regexp_replace(coalesce(nullif(t.merchant, ''), t.description), '[0-9#*]+', '', 'g'), 18));
  if char_length(btrim(key)) >= 4 then
    select account_id into h from public.bk_transactions x where x.company_id = t.company_id and x.status = 'posted' and x.account_id is not null and sign(x.amount_cents) = sign(t.amount_cents)
       and lower(left(regexp_replace(coalesce(nullif(x.merchant, ''), x.description), '[0-9#*]+', '', 'g'), 18)) = key
     order by x.txn_date desc limit 1;
    if h is not null then update public.bk_transactions set suggested_account_id = h, suggest_source = 'history', ai_confidence = 0.9, ai_reason = 'Same payee as before' where id = t.id; end if;
  end if;
end $function$;

