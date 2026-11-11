-- Billing flow, proposals that carry the invoice, monthly maintenance, opening documents (intake), ACH on the company account,
-- Endeavor's own company in the books, company logos for reports, and bank-to-card transfer matching.

/* ---------- Endeavor's own company (house) ---------- */
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check check (status = any (array['active', 'archived', 'prospect', 'internal']));
alter table public.clients add column if not exists stripe_subscription_id text;
alter table public.clients add column if not exists subscription_status text;
alter table public.clients add column if not exists monthly_cents integer;
alter table public.clients add column if not exists subscription_started_at timestamptz;
alter table public.companies add column if not exists is_house boolean not null default false;
alter table public.companies add column if not exists logo_path text;
create unique index if not exists companies_one_house on public.companies(is_house) where is_house;

/* ---------- opening documents category ---------- */
alter table public.company_documents drop constraint if exists company_documents_category_check;
alter table public.company_documents add constraint company_documents_category_check check (category = any (array['formation', 'tax_return', 'report', 'uploaded', 'compliance', 'other', 'onboarding']));

/* ---------- saved services (invoice / proposal items) ---------- */
create table if not exists public.billing_services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 300),
  amount_cents integer not null default 0 check (amount_cents between 0 and 10000000),
  recurring text not null default 'none' check (recurring in ('none', 'month')),
  active boolean not null default true,
  created_at timestamptz not null default now(), created_by text,
  unique (name, recurring)
);
alter table public.billing_services enable row level security;
drop policy if exists billing_services_admin on public.billing_services;
create policy billing_services_admin on public.billing_services for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.billing_services(name, amount_cents, recurring) values
  ('Abertura de LLC na Flórida (taxas do estado incluídas)', 0, 'none'),
  ('Obtenção do EIN junto ao IRS', 0, 'none'),
  ('Operating Agreement', 0, 'none'),
  ('Manutenção mensal (registered agent, compliance e suporte)', 0, 'month')
on conflict do nothing;

/* ---------- invoice flow ---------- */
alter table public.invoices add column if not exists kind text not null default 'one_time';
alter table public.invoices drop constraint if exists invoices_kind_check;
alter table public.invoices add constraint invoices_kind_check check (kind in ('one_time', 'proposal', 'subscription'));
alter table public.invoices add column if not exists scheduled_send_at timestamptz;
alter table public.invoices add column if not exists reminders_sent integer not null default 0;
alter table public.invoices add column if not exists last_reminder_at timestamptz;
alter table public.invoices add column if not exists overdue_notified_at timestamptz;
alter table public.invoices add column if not exists receipt_sent_at timestamptz;
alter table public.invoices add column if not exists archived_at timestamptz;
alter table public.invoices add column if not exists bk_entry_id uuid;
alter table public.invoices add column if not exists stripe_subscription_id text;
alter table public.invoices add column if not exists days_until_due integer;
create index if not exists invoices_flow on public.invoices(status, due_date) where archived_at is null;

/* ---------- proposals: rejection and monthly item ---------- */
alter table public.proposals add column if not exists declined_at timestamptz;
alter table public.proposals add column if not exists declined_reason text check (declined_reason is null or char_length(declined_reason) <= 2000);
alter table public.proposals add column if not exists monthly_cents integer not null default 0;
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status = any (array['new', 'contacted', 'qualified', 'proposal', 'rejected', 'client', 'partner', 'lost']));

/* ---------- opening documents request (secure link, no login) ---------- */
create table if not exists public.intake_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  token text not null unique,
  language text not null default 'pt',
  status text not null default 'open' check (status in ('open', 'complete', 'closed')),
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), sent_at timestamptz, updated_at timestamptz,
  completed_at timestamptz, expires_at timestamptz not null default now() + interval '60 days'
);
create index if not exists intake_requests_client on public.intake_requests(client_id);
alter table public.intake_requests enable row level security;
drop policy if exists intake_admin on public.intake_requests;
create policy intake_admin on public.intake_requests for select to authenticated using (public.is_admin() or (public.my_membership(client_id)).id is not null);

/* ---------- ACH authorization on the company's US account ---------- */
create table if not exists public.billing_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null default 'ach' check (kind in ('ach')),
  token text not null unique,
  status text not null default 'open' check (status in ('open', 'done', 'closed')),
  language text not null default 'pt',
  created_at timestamptz not null default now(), created_by text, sent_at timestamptz, done_at timestamptz,
  bank_label text, expires_at timestamptz not null default now() + interval '30 days'
);
alter table public.billing_requests enable row level security;
drop policy if exists billing_requests_admin on public.billing_requests;
create policy billing_requests_admin on public.billing_requests for select to authenticated using (public.is_admin());

/* ---------- books: transfers between the company's own accounts ---------- */
create or replace function public.bk_suggest(p_txn uuid) returns void language plpgsql security definer set search_path = public as $$
declare t public.bk_transactions; r public.bk_rules; h uuid; key text; b public.bk_bank_accounts; other uuid; txt text;
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
  -- card payment from the bank (money out) or payment received on the card (money in): a transfer, not an expense
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
end $$;
revoke all on function public.bk_suggest(uuid) from public, anon, authenticated;

-- posting a transfer also closes the matching line on the other account (same amount, opposite sign, within 5 days) so it is not counted twice
create or replace function public.bk_post_txn_core(p_txn uuid, p_account uuid, p_memo text, p_by text) returns uuid language plpgsql security definer set search_path = public as $$
declare t public.bk_transactions; b public.bk_bank_accounts; ob public.bk_bank_accounts; v uuid; amt bigint; lines jsonb; m uuid;
begin
  select * into t from public.bk_transactions where id = p_txn for update;
  if t.id is null then raise exception 'not_found'; end if;
  if t.status = 'posted' then return t.entry_id; end if;
  if not exists (select 1 from public.bk_accounts where id = p_account and company_id = t.company_id) then raise exception 'invalid_account'; end if;
  select * into b from public.bk_bank_accounts where id = t.bank_account_id;
  if p_account = b.ledger_account_id then raise exception 'same_account'; end if;
  amt := abs(t.amount_cents);
  if amt = 0 then raise exception 'zero_amount'; end if;
  if t.amount_cents > 0 then
    lines := jsonb_build_array(jsonb_build_object('account_id', b.ledger_account_id, 'debit_cents', amt, 'description', t.description),
                               jsonb_build_object('account_id', p_account, 'credit_cents', amt, 'description', t.description, 'contact', t.merchant));
  else
    lines := jsonb_build_array(jsonb_build_object('account_id', p_account, 'debit_cents', amt, 'description', t.description, 'contact', t.merchant),
                               jsonb_build_object('account_id', b.ledger_account_id, 'credit_cents', amt, 'description', t.description));
  end if;
  v := public.bk_post_core(t.company_id, t.txn_date, coalesce(nullif(btrim(coalesce(p_memo, '')), ''), t.description), lines, 'bank', p_by);
  update public.bk_transactions set status = 'posted', account_id = p_account, entry_id = v, memo = nullif(btrim(coalesce(p_memo, '')), '') where id = t.id;
  select * into ob from public.bk_bank_accounts where ledger_account_id = p_account and company_id = t.company_id;
  if ob.id is not null then
    select x.id into m from public.bk_transactions x where x.bank_account_id = ob.id and x.status = 'review' and x.amount_cents = -t.amount_cents
       and abs(x.txn_date - t.txn_date) <= 5 order by abs(x.txn_date - t.txn_date) limit 1;
    if m is not null then update public.bk_transactions set status = 'posted', account_id = b.ledger_account_id, entry_id = v, memo = 'Transfer (matched)' where id = m; end if;
  end if;
  return v;
end $$;
revoke all on function public.bk_post_txn_core(uuid, uuid, text, text) from public, anon, authenticated;

-- paid invoice -> Endeavor's books: Undeposited Funds (Stripe balance) / Service Revenue
create or replace function public.bk_record_invoice_payment(p_invoice uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare i public.invoices; h uuid; dr uuid; cr uuid; v uuid; cl text;
begin
  select * into i from public.invoices where id = p_invoice for update;
  if i.id is null or i.status <> 'paid' or i.bk_entry_id is not null or coalesce(i.amount_paid_cents, 0) <= 0 then return i.bk_entry_id; end if;
  select id into h from public.companies where is_house and books_provider = 'endeavor';
  if h is null then return null; end if;
  select id into dr from public.bk_accounts where company_id = h and code = '1200';
  select id into cr from public.bk_accounts where company_id = h and code = '4100';
  if dr is null or cr is null then return null; end if;
  select name into cl from public.clients where id = i.client_id;
  v := public.bk_post_core(h, coalesce((i.paid_at at time zone 'America/New_York')::date, current_date), 'Invoice ' || coalesce(i.number, '') || ' paid · ' || coalesce(cl, ''),
    jsonb_build_array(jsonb_build_object('account_id', dr, 'debit_cents', i.amount_paid_cents, 'contact', cl), jsonb_build_object('account_id', cr, 'credit_cents', i.amount_paid_cents, 'contact', cl, 'description', left(coalesce(i.description, 'Services'), 300))),
    'import', 'stripe');
  update public.invoices set bk_entry_id = v where id = i.id;
  return v;
end $$;
revoke all on function public.bk_record_invoice_payment(uuid) from public, anon, authenticated;
grant execute on function public.bk_record_invoice_payment(uuid) to service_role;

-- remove the demonstration data of a company's books
create or replace function public.bk_clear_sample(p_company uuid) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  delete from public.bk_transactions where company_id = p_company and external_id like 'sample-%';
  delete from public.bk_entries where company_id = p_company and created_by = 'sample';
  get diagnostics n = row_count;
  delete from public.bk_bank_accounts b where b.company_id = p_company and b.external_id like 'sample-%' and not exists (select 1 from public.bk_transactions t where t.bank_account_id = b.id);
  delete from public.bk_accounts a where a.company_id = p_company and a.subtype in ('bank', 'credit_card') and not exists (select 1 from public.bk_bank_accounts b where b.ledger_account_id = a.id) and not exists (select 1 from public.bk_lines l where l.account_id = a.id);
  delete from public.bk_connections c where c.company_id = p_company and c.external_id = 'sample' and not exists (select 1 from public.bk_bank_accounts b where b.connection_id = c.id);
  return n;
end $$;
revoke all on function public.bk_clear_sample(uuid) from public, anon;
grant execute on function public.bk_clear_sample(uuid) to authenticated;

/* ---------- hourly billing job: scheduled sends, reminders, overdue notices, proposal expiry ---------- */
create or replace function public.billing_tick() returns void language plpgsql security definer set search_path = public as $$
declare k text;
begin
  select decrypted_secret into k from vault.decrypted_secrets where name = 'booking_hook_key';
  perform net.http_post(url := 'https://onaewjlozioderwlvgfm.supabase.co/functions/v1/payments', body := jsonb_build_object('action', 'billing_tick'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-booking-key', k), timeout_milliseconds := 120000);
end $$;
revoke all on function public.billing_tick() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from cron.job where jobname = 'billing-flow') then perform cron.unschedule('billing-flow'); end if;
  perform cron.schedule('billing-flow', '7 * * * *', 'select public.billing_tick();');
end $$;

-- bell notices for the billing flow
alter table public.admin_events drop constraint if exists admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check check (kind = any (array['proposal_accepted', 'payment_received', 'payment_failed', 'referral_new', 'oa_review', 'oa_client', 'oa_signature', 'oa_archived',
  'booking_new', 'booking_cancelled', 'booking_rescheduled', 'partner_new', 'partner_contract', 'lead_chat',
  'invoice_overdue', 'proposal_rejected', 'proposal_expired', 'intake_complete', 'ach_authorized']));
